import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireLeaguePlayer } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import { callableOptions } from "../../config/runtime.js";
import { collections } from "../../domain/collections.js";
import { assertIndependentConfirmation } from "../../engines/resultEngine.js";
import {
  applyCanonicalGameResult,
  assertResultShape,
  rethrowResultValidation,
  type GameForResult,
  type MatchForResult,
  type ResultSubmissionDocument,
} from "./resultSupport.js";

interface RespondToGameResultInput {
  matchId: string;
  gameId: string;
  submissionId: string;
  response: "CONFIRM" | "DISPUTE";
  reason?: string | null;
}

export const respondToGameResult = onCall<RespondToGameResultInput>(callableOptions, async (request) => {
  const actor = await requireLeaguePlayer(request);
  const { matchId, gameId, submissionId, response } = request.data;
  const reason = request.data.reason?.trim() || null;

  if (!matchId || !gameId || !submissionId) {
    throw new HttpsError("invalid-argument", "matchId, gameId, and submissionId are required.");
  }
  if (response !== "CONFIRM" && response !== "DISPUTE") {
    throw new HttpsError("invalid-argument", "response must be CONFIRM or DISPUTE.");
  }
  if (reason && reason.length > 1000) {
    throw new HttpsError("invalid-argument", "Dispute reason must contain at most 1000 characters.");
  }
  if (response === "DISPUTE" && !reason) {
    throw new HttpsError("invalid-argument", "A dispute reason is required.");
  }

  const matchRef = db.collection(collections.matches).doc(matchId);
  const gameRef = matchRef.collection("games").doc(gameId);
  const submissionRef = gameRef.collection("resultSubmissions").doc(submissionId);
  const responseRef = submissionRef.collection("responses").doc(actor.playerId);

  const transactionResult = await db.runTransaction(async (transaction) => {
    const [matchSnapshot, gameSnapshot, submissionSnapshot, existingResponseSnapshot] = await Promise.all([
      transaction.get(matchRef),
      transaction.get(gameRef),
      transaction.get(submissionRef),
      transaction.get(responseRef),
    ]);

    if (!matchSnapshot.exists) throw new HttpsError("not-found", "Match not found.");
    if (!gameSnapshot.exists) throw new HttpsError("not-found", "Game not found.");
    if (!submissionSnapshot.exists) throw new HttpsError("not-found", "Result submission not found.");

    if (existingResponseSnapshot.exists) {
      const existing = existingResponseSnapshot.data() as { response?: string };
      if (existing.response === response) {
        return {
          response,
          alreadyResponded: true,
          matchCompleted: gameSnapshot.data()?.status === "COMPLETED",
        };
      }
      throw new HttpsError("failed-precondition", "This player has already responded to the submission.");
    }

    const match = matchSnapshot.data() as MatchForResult;
    const game = gameSnapshot.data() as GameForResult;
    const submission = submissionSnapshot.data() as ResultSubmissionDocument;
    assertResultShape(match);

    if (game.status === "COMPLETED") {
      throw new HttpsError("failed-precondition", "This Game already has a canonical result.");
    }
    if (submission.status !== "PENDING_CONFIRMATION") {
      throw new HttpsError("failed-precondition", "This result submission is no longer awaiting confirmation.");
    }

    try {
      assertIndependentConfirmation(match.participants, submission.submittedBy, actor.playerId);
    } catch (error) {
      rethrowResultValidation(error);
    }

    const now = Timestamp.now();
    transaction.create(responseRef, {
      playerId: actor.playerId,
      response,
      reason,
      createdAt: now,
    });

    if (response === "DISPUTE") {
      transaction.update(submissionRef, {
        status: "DISPUTED",
        disputedBy: actor.playerId,
        disputedAt: now,
        disputeReason: reason,
        updatedAt: now,
      });
      transaction.update(gameRef, {
        status: "DISPUTED",
        updatedAt: now,
      });
      transaction.update(matchRef, {
        status: "DISPUTED",
        updatedAt: now,
      });

      return {
        response,
        alreadyResponded: false,
        matchCompleted: false,
      };
    }

    const accepted = applyCanonicalGameResult(transaction, {
      matchId,
      gameId,
      matchRef,
      gameRef,
      match,
      submissionId,
      submittedBy: submission.submittedBy,
      confirmedBy: actor.playerId,
      source: "PLAYER_CONFIRMED",
      outcome: submission.outcome,
    });

    transaction.update(submissionRef, {
      status: "CONFIRMED",
      confirmedBy: actor.playerId,
      confirmedAt: now,
      updatedAt: now,
    });

    return {
      response,
      alreadyResponded: false,
      matchCompleted: accepted.matchCompleted,
      canonicalResult: accepted.canonicalResult,
    };
  });

  return {
    success: true,
    matchId,
    gameId,
    submissionId,
    ...transactionResult,
  };
});
