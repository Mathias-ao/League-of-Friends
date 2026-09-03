import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireLeaguePlayer } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import { callableOptions } from "../../config/runtime.js";
import { collections } from "../../domain/collections.js";
import { assertMatchParticipant } from "../../engines/resultEngine.js";
import { reserveIdempotencyKey } from "../../services/idempotency.js";
import {
  assertResultShape,
  canonicalRevision,
  rethrowResultValidation,
  resultProcessingJobId,
  type GameForResult,
  type MatchForResult,
} from "./resultSupport.js";

interface DisputeCanonicalGameResultInput {
  requestId: string;
  matchId: string;
  gameId: string;
  category: "WRONG_REPLAY" | "WRONG_RESULT" | "PLAYER_MISMATCH" | "OTHER";
  reason: string;
}

const categories = ["WRONG_REPLAY", "WRONG_RESULT", "PLAYER_MISMATCH", "OTHER"] as const;

export const disputeCanonicalGameResult = onCall<DisputeCanonicalGameResultInput>(
  callableOptions,
  async (request) => {
    const actor = await requireLeaguePlayer(request);
    const { requestId, matchId, gameId, category } = request.data;
    const reason = request.data.reason?.trim();

    if (!matchId || !gameId) {
      throw new HttpsError("invalid-argument", "matchId and gameId are required.");
    }
    if (!categories.includes(category)) {
      throw new HttpsError("invalid-argument", "Unsupported result dispute category.");
    }
    if (!reason || reason.length > 1000) {
      throw new HttpsError("invalid-argument", "A dispute reason of 1–1000 characters is required.");
    }

    const matchRef = db.collection(collections.matches).doc(matchId);
    const gameRef = matchRef.collection("games").doc(gameId);
    const disputeRef = gameRef.collection("resultDisputes").doc(requestId);

    const transactionResult = await db.runTransaction(async (transaction) => {
      const [matchSnapshot, gameSnapshot, existingDisputeSnapshot] = await Promise.all([
        transaction.get(matchRef),
        transaction.get(gameRef),
        transaction.get(disputeRef),
      ]);

      if (!matchSnapshot.exists) throw new HttpsError("not-found", "Match not found.");
      if (!gameSnapshot.exists) throw new HttpsError("not-found", "Game not found.");

      if (existingDisputeSnapshot.exists) {
        const existing = existingDisputeSnapshot.data() as { openedBy?: string; status?: string };
        if (existing.openedBy === actor.playerId) {
          return {
            disputeId: disputeRef.id,
            status: existing.status ?? "OPEN",
            alreadySubmitted: true,
          };
        }
        throw new HttpsError("already-exists", "This dispute request ID is already in use.");
      }

      const match = matchSnapshot.data() as MatchForResult & { activeResultDisputeId?: string | null };
      const game = gameSnapshot.data() as GameForResult & { activeResultDisputeId?: string | null };
      assertResultShape(match);

      try {
        assertMatchParticipant(match.participants, actor.playerId);
      } catch (error) {
        rethrowResultValidation(error);
      }

      if (game.status !== "COMPLETED" || !game.canonicalResult) {
        throw new HttpsError("failed-precondition", "Only a completed Game with a canonical result can be disputed later.");
      }
      if (game.activeResultDisputeId || match.activeResultDisputeId) {
        throw new HttpsError("failed-precondition", "This result already has an open correction dispute.");
      }

      const revision = canonicalRevision(game.canonicalResult);
      const revisionedJobRef = db.collection(collections.processingJobs)
        .doc(resultProcessingJobId(matchId, revision));
      const legacyJobRef = db.collection(collections.processingJobs).doc(`MATCH_RESULT_${matchId}`);
      const [revisionedJobSnapshot, legacyJobSnapshot] = await Promise.all([
        transaction.get(revisionedJobRef),
        transaction.get(legacyJobRef),
      ]);

      await reserveIdempotencyKey(
        transaction,
        requestId,
        "disputeCanonicalGameResult",
        actor.authUid,
      );

      const now = Timestamp.now();
      transaction.create(disputeRef, {
        status: "OPEN",
        category,
        reason,
        openedBy: actor.playerId,
        openedAt: now,
        resultRevision: revision,
        canonicalResultSnapshot: game.canonicalResult,
        resolvedBy: null,
        resolvedAt: null,
        resolution: null,
        resolutionReason: null,
        createdAt: now,
        updatedAt: now,
      });

      transaction.update(gameRef, {
        status: "DISPUTED",
        activeResultDisputeId: disputeRef.id,
        updatedAt: now,
      });
      transaction.update(matchRef, {
        status: "DISPUTED",
        activeResultDisputeId: disputeRef.id,
        processingState: "BLOCKED",
        updatedAt: now,
      });

      for (const jobSnapshot of [revisionedJobSnapshot, legacyJobSnapshot]) {
        if (!jobSnapshot.exists) continue;
        const jobStatus = jobSnapshot.data()?.status;
        if (jobStatus === "COMPLETED" || jobStatus === "SUPERSEDED") continue;
        transaction.update(jobSnapshot.ref, {
          status: "BLOCKED",
          blockedReason: "RESULT_DISPUTED",
          blockedByDisputeId: disputeRef.id,
          updatedAt: now,
        });
      }

      return {
        disputeId: disputeRef.id,
        status: "OPEN",
        alreadySubmitted: false,
      };
    });

    return {
      success: true,
      matchId,
      gameId,
      category,
      ...transactionResult,
    };
  },
);
