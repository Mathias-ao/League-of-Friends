import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireLeaguePlayer } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import { callableOptions } from "../../config/runtime.js";
import { collections } from "../../domain/collections.js";
import {
  assertMatchParticipant,
  normalizeOutcome,
  type SubmittedOutcomeInput,
} from "../../engines/resultEngine.js";
import {
  assertResultShape,
  rethrowResultValidation,
  type GameForResult,
  type MatchForResult,
  type ResultSubmissionDocument,
} from "./resultSupport.js";

interface SubmitGameResultInput extends SubmittedOutcomeInput {
  matchId: string;
  gameId: string;
}

function sameOutcome(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export const submitGameResult = onCall<SubmitGameResultInput>(callableOptions, async (request) => {
  const actor = await requireLeaguePlayer(request);
  const { matchId, gameId } = request.data;

  if (!matchId || !gameId) {
    throw new HttpsError("invalid-argument", "matchId and gameId are required.");
  }

  const matchRef = db.collection(collections.matches).doc(matchId);
  const gameRef = matchRef.collection("games").doc(gameId);
  const submissionRef = gameRef.collection("resultSubmissions").doc(actor.playerId);

  const transactionResult = await db.runTransaction(async (transaction) => {
    const [matchSnapshot, gameSnapshot, existingSubmissionSnapshot] = await Promise.all([
      transaction.get(matchRef),
      transaction.get(gameRef),
      transaction.get(submissionRef),
    ]);

    if (!matchSnapshot.exists) throw new HttpsError("not-found", "Match not found.");
    if (!gameSnapshot.exists) throw new HttpsError("not-found", "Game not found.");

    const match = matchSnapshot.data() as MatchForResult;
    const game = gameSnapshot.data() as GameForResult;
    assertResultShape(match);

    if (match.status === "COMPLETED" || match.status === "CANCELLED") {
      throw new HttpsError("failed-precondition", "This Match no longer accepts result submissions.");
    }
    if (game.status === "COMPLETED" || game.status === "REMAKE" || game.status === "NO_CONTEST") {
      throw new HttpsError("failed-precondition", "This Game no longer accepts result submissions.");
    }

    try {
      assertMatchParticipant(match.participants, actor.playerId);
    } catch (error) {
      rethrowResultValidation(error);
    }

    let outcome;
    try {
      outcome = normalizeOutcome(match.format, match.participants, request.data);
    } catch (error) {
      rethrowResultValidation(error);
    }

    if (existingSubmissionSnapshot.exists) {
      const existing = existingSubmissionSnapshot.data() as ResultSubmissionDocument;
      if (existing.status === "PENDING_CONFIRMATION" && sameOutcome(existing.outcome, outcome)) {
        return {
          submissionId: submissionRef.id,
          outcome,
          alreadySubmitted: true,
        };
      }
      if (existing.status === "CONFIRMED" || existing.status === "ADMIN_ACCEPTED") {
        throw new HttpsError("failed-precondition", "This player's result submission has already been accepted.");
      }
    }

    const now = Timestamp.now();
    transaction.set(submissionRef, {
      submittedBy: actor.playerId,
      outcome,
      status: "PENDING_CONFIRMATION",
      submittedAt: existingSubmissionSnapshot.exists
        ? existingSubmissionSnapshot.data()?.submittedAt ?? now
        : now,
      updatedAt: now,
    });

    if (game.status !== "DISPUTED") {
      transaction.update(gameRef, {
        status: "AWAITING_CONFIRMATION",
        updatedAt: now,
      });
    }
    if (match.status !== "DISPUTED") {
      transaction.update(matchRef, {
        status: "AWAITING_CONFIRMATION",
        updatedAt: now,
      });
    }

    return {
      submissionId: submissionRef.id,
      outcome,
      alreadySubmitted: false,
    };
  });

  return {
    success: true,
    matchId,
    gameId,
    status: "PENDING_CONFIRMATION",
    ...transactionResult,
  };
});
