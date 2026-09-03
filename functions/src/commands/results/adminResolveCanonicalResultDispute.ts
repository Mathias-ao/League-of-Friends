import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import { callableOptions } from "../../config/runtime.js";
import { collections } from "../../domain/collections.js";
import { normalizeOutcome } from "../../engines/resultEngine.js";
import { writeAdminAudit } from "../../services/audit.js";
import { reserveIdempotencyKey } from "../../services/idempotency.js";
import {
  applyCanonicalGameResult,
  assertResultShape,
  canonicalRevision,
  rethrowResultValidation,
  resultProcessingJobId,
  type GameForResult,
  type MatchForResult,
} from "./resultSupport.js";

interface AdminResolveCanonicalResultDisputeInput {
  requestId: string;
  matchId: string;
  gameId: string;
  disputeId: string;
  resolution: "UPHOLD" | "CORRECT";
  reason: string;
  winnerTeam?: number | null;
  winnerPlayerId?: string | null;
}

interface ResultDisputeDocument {
  status?: string;
  openedBy?: string;
  resultRevision?: number;
  canonicalResultSnapshot?: unknown;
}

export const adminResolveCanonicalResultDispute = onCall<AdminResolveCanonicalResultDisputeInput>(
  callableOptions,
  async (request) => {
    const actor = await requireAdmin(request);
    const { requestId, matchId, gameId, disputeId, resolution } = request.data;
    const reason = request.data.reason?.trim();

    if (!matchId || !gameId || !disputeId) {
      throw new HttpsError("invalid-argument", "matchId, gameId, and disputeId are required.");
    }
    if (resolution !== "UPHOLD" && resolution !== "CORRECT") {
      throw new HttpsError("invalid-argument", "resolution must be UPHOLD or CORRECT.");
    }
    if (!reason || reason.length > 1000) {
      throw new HttpsError("invalid-argument", "A resolution reason of 1–1000 characters is required.");
    }

    const matchRef = db.collection(collections.matches).doc(matchId);
    const gameRef = matchRef.collection("games").doc(gameId);
    const disputeRef = gameRef.collection("resultDisputes").doc(disputeId);

    const transactionResult = await db.runTransaction(async (transaction) => {
      const [matchSnapshot, gameSnapshot, disputeSnapshot] = await Promise.all([
        transaction.get(matchRef),
        transaction.get(gameRef),
        transaction.get(disputeRef),
      ]);

      if (!matchSnapshot.exists) throw new HttpsError("not-found", "Match not found.");
      if (!gameSnapshot.exists) throw new HttpsError("not-found", "Game not found.");
      if (!disputeSnapshot.exists) throw new HttpsError("not-found", "Result dispute not found.");

      const match = matchSnapshot.data() as MatchForResult & { activeResultDisputeId?: string | null };
      const game = gameSnapshot.data() as GameForResult & { activeResultDisputeId?: string | null };
      const dispute = disputeSnapshot.data() as ResultDisputeDocument;
      assertResultShape(match);

      if (dispute.status !== "OPEN") {
        throw new HttpsError("failed-precondition", "This result dispute is already resolved.");
      }
      if (game.activeResultDisputeId !== disputeId || match.activeResultDisputeId !== disputeId) {
        throw new HttpsError("failed-precondition", "This is not the active correction dispute for the result.");
      }
      if (!game.canonicalResult || !match.canonicalResult) {
        throw new HttpsError("failed-precondition", "The disputed canonical result is missing.");
      }

      const oldRevision = canonicalRevision(game.canonicalResult);
      const currentJobRef = db.collection(collections.processingJobs)
        .doc(resultProcessingJobId(matchId, oldRevision));
      const legacyJobRef = db.collection(collections.processingJobs).doc(`MATCH_RESULT_${matchId}`);
      const [currentJobSnapshot, legacyJobSnapshot] = await Promise.all([
        transaction.get(currentJobRef),
        transaction.get(legacyJobRef),
      ]);

      let correctedOutcome = null;
      if (resolution === "CORRECT") {
        try {
          correctedOutcome = normalizeOutcome(match.format, match.participants, {
            winnerTeam: request.data.winnerTeam,
            winnerPlayerId: request.data.winnerPlayerId,
          });
        } catch (error) {
          rethrowResultValidation(error);
        }
      }

      await reserveIdempotencyKey(
        transaction,
        requestId,
        "adminResolveCanonicalResultDispute",
        actor.authUid,
      );

      const now = Timestamp.now();

      if (resolution === "UPHOLD") {
        transaction.update(disputeRef, {
          status: "RESOLVED_UPHELD",
          resolution: "UPHOLD",
          resolutionReason: reason,
          resolvedBy: actor.playerId,
          resolvedAt: now,
          updatedAt: now,
        });
        transaction.update(gameRef, {
          status: "COMPLETED",
          activeResultDisputeId: null,
          updatedAt: now,
        });
        transaction.update(matchRef, {
          status: "COMPLETED",
          activeResultDisputeId: null,
          processingState: "PENDING",
          updatedAt: now,
        });

        for (const jobSnapshot of [currentJobSnapshot, legacyJobSnapshot]) {
          if (!jobSnapshot.exists) continue;
          if (jobSnapshot.data()?.status !== "BLOCKED") continue;
          transaction.update(jobSnapshot.ref, {
            status: "PENDING",
            blockedReason: null,
            blockedByDisputeId: null,
            updatedAt: now,
          });
        }

        writeAdminAudit(transaction, {
          actorUid: actor.authUid,
          actorPlayerId: actor.playerId,
          action: "CANONICAL_RESULT_DISPUTE_UPHELD",
          targetType: "GAME",
          targetId: `${matchId}/${gameId}`,
          reason,
          before: dispute.canonicalResultSnapshot ?? game.canonicalResult,
          after: game.canonicalResult,
        });

        return {
          resolution: "UPHOLD" as const,
          resultRevision: oldRevision,
          canonicalResult: game.canonicalResult,
        };
      }

      if (!correctedOutcome) {
        throw new HttpsError("internal", "Correction outcome was not prepared.");
      }

      const newRevision = oldRevision + 1;
      const gameHistoryRef = gameRef.collection("resultHistory").doc(`R${oldRevision}`);
      const matchHistoryRef = matchRef.collection("resultHistory").doc(`R${oldRevision}`);

      transaction.set(gameHistoryRef, {
        revision: oldRevision,
        canonicalResult: game.canonicalResult,
        replacedByRevision: newRevision,
        correctionCaseId: disputeId,
        archivedAt: now,
      });
      transaction.set(matchHistoryRef, {
        revision: oldRevision,
        canonicalResult: match.canonicalResult,
        replacedByRevision: newRevision,
        correctionCaseId: disputeId,
        archivedAt: now,
      });

      for (const jobSnapshot of [currentJobSnapshot, legacyJobSnapshot]) {
        if (!jobSnapshot.exists) continue;
        const status = jobSnapshot.data()?.status;
        if (status === "COMPLETED" || status === "SUPERSEDED") continue;
        transaction.update(jobSnapshot.ref, {
          status: "SUPERSEDED",
          blockedReason: "RESULT_CORRECTED",
          supersededByRevision: newRevision,
          updatedAt: now,
        });
      }

      const accepted = applyCanonicalGameResult(transaction, {
        matchId,
        gameId,
        matchRef,
        gameRef,
        match,
        submissionId: null,
        submittedBy: null,
        confirmedBy: null,
        source: "ADMIN_CORRECTED",
        outcome: correctedOutcome,
        revision: newRevision,
        previousRevision: oldRevision,
        correctionCaseId: disputeId,
      });

      transaction.update(disputeRef, {
        status: "RESOLVED_CORRECTED",
        resolution: "CORRECT",
        resolutionReason: reason,
        resolvedBy: actor.playerId,
        resolvedAt: now,
        correctedToRevision: newRevision,
        correctedOutcome,
        updatedAt: now,
      });

      writeAdminAudit(transaction, {
        actorUid: actor.authUid,
        actorPlayerId: actor.playerId,
        action: "CANONICAL_RESULT_CORRECTED",
        targetType: "GAME",
        targetId: `${matchId}/${gameId}`,
        reason,
        before: game.canonicalResult,
        after: accepted.canonicalResult,
      });

      return {
        resolution: "CORRECT" as const,
        resultRevision: newRevision,
        canonicalResult: accepted.canonicalResult,
      };
    });

    return {
      success: true,
      matchId,
      gameId,
      disputeId,
      ...transactionResult,
    };
  },
);
