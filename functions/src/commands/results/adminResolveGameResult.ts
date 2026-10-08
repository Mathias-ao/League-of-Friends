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
  rethrowResultValidation,
  type GameForResult,
  type MatchForResult,
  type ResultSubmissionDocument,
} from "./resultSupport.js";

interface AdminResolveGameResultInput {
  requestId: string;
  matchId: string;
  gameId: string;
  submissionId: string;
  reason: string;
  sourceHash?:string;
  playedWithinWindow?:boolean;
}

export const adminResolveGameResult = onCall<AdminResolveGameResultInput>(callableOptions, async (request) => {
  const actor = await requireAdmin(request);
  const { requestId, matchId, gameId, submissionId } = request.data;
  const reason = request.data.reason?.trim();

  if (!matchId || !gameId || !submissionId) {
    throw new HttpsError("invalid-argument", "matchId, gameId, and submissionId are required.");
  }
  if (!reason || reason.length > 1000) {
    throw new HttpsError("invalid-argument", "A resolution reason of 1–1000 characters is required.");
  }

  const matchRef = db.collection(collections.matches).doc(matchId);
  const gameRef = matchRef.collection("games").doc(gameId);
  const submissionRef = gameRef.collection("resultSubmissions").doc(submissionId);

  const transactionResult = await db.runTransaction(async (transaction) => {
    const [matchSnapshot, gameSnapshot, submissionSnapshot] = await Promise.all([
      transaction.get(matchRef),
      transaction.get(gameRef),
      transaction.get(submissionRef),
    ]);

    if (!matchSnapshot.exists) throw new HttpsError("not-found", "Match not found.");
    if (!gameSnapshot.exists) throw new HttpsError("not-found", "Game not found.");
    if (!submissionSnapshot.exists) throw new HttpsError("not-found", "Result submission not found.");

    const match = matchSnapshot.data() as MatchForResult;
    const game = gameSnapshot.data() as GameForResult;
    const submission = submissionSnapshot.data() as ResultSubmissionDocument;
    assertResultShape(match);
    if(submissionSnapshot.data()?.requiresTimingReview) {
      const sourceHash=request.data.sourceHash;
      if(typeof sourceHash!=='string'||!/^[0-9a-f]{64}$/.test(sourceHash)||gameSnapshot.data()?.activeReplayStatisticsId!==sourceHash||request.data.playedWithinWindow!==true||reason.length<8)throw new HttpsError('failed-precondition','Verify timely completion against the active recording and explain the evidence.');
      const source=(await transaction.get(gameRef.collection('replaySources').doc(sourceHash))).data();
      if(source?.state!=='READY'||source.sourceHash!==sourceHash||source.matchId!==matchId||source.gameId!==gameId)throw new HttpsError('failed-precondition','The active recording is not ready for timing review.');
    }

    if (game.status === "COMPLETED") {
      throw new HttpsError("failed-precondition", "This Game already has a canonical result.");
    }

    let outcome;
    try {
      outcome = normalizeOutcome(match.format, match.participants, submission.outcome, match.gameConfigSnapshot);
    } catch (error) {
      rethrowResultValidation(error);
    }

    await reserveIdempotencyKey(
      transaction,
      requestId,
      "adminResolveGameResult",
      actor.authUid,
    );

    const accepted = applyCanonicalGameResult(transaction, {
      matchId,
      gameId,
      matchRef,
      gameRef,
      match,
      submissionId,
      submittedBy: submission.submittedBy,
      confirmedBy: null,
      source: "ADMIN_RESOLVED",
      outcome,
    });

    const now = Timestamp.now();
    transaction.update(submissionRef, {
      status: "ADMIN_ACCEPTED",
      resolvedBy: actor.playerId,
      resolvedAt: now,
      resolutionReason: reason,
      updatedAt: now,
    });

    writeAdminAudit(transaction, {
      actorUid: actor.authUid,
      actorPlayerId: actor.playerId,
      action: "GAME_RESULT_ADMIN_RESOLVED",
      targetType: "GAME",
      targetId: `${matchId}/${gameId}`,
      reason,
      before: {
        matchStatus: match.status ?? null,
        gameStatus: game.status ?? null,
      },
      after: {
        submissionId,
        timingReview:submissionSnapshot.data()?.requiresTimingReview?{sourceHash:request.data.sourceHash,playedWithinWindow:true}:null,
        canonicalResult: accepted.canonicalResult,
        matchCompleted: accepted.matchCompleted,
      },
    });

    return {
      matchCompleted: accepted.matchCompleted,
      canonicalResult: accepted.canonicalResult,
    };
  });

  return {
    success: true,
    matchId,
    gameId,
    submissionId,
    status: "RESOLVED",
    ...transactionResult,
  };
});
