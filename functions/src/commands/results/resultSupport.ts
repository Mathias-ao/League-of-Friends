import { Timestamp, type DocumentReference, type Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config/firebase.js";
import { collections } from "../../domain/collections.js";
import type {
  CanonicalGameResult,
  GameOutcome,
  MatchFormat,
  MatchParticipant,
  SeriesRule,
} from "../../domain/types.js";
import { ResultValidationError, winningPlayerIds } from "../../engines/resultEngine.js";

export interface MatchForResult {
  seasonId?: string | null;
  eventId?: string | null;
  format?: MatchFormat;
  participants?: MatchParticipant[];
  status?: string;
  seriesRule?: SeriesRule;
  canonicalResult?: unknown;
}

export interface GameForResult {
  status?: string;
  canonicalResult?: unknown;
}

export interface ResultSubmissionDocument {
  submittedBy: string;
  outcome: GameOutcome;
  status: string;
}

export function rethrowResultValidation(error: unknown): never {
  if (!(error instanceof ResultValidationError)) throw error;

  switch (error.code) {
    case "INVALID_ARGUMENT":
      throw new HttpsError("invalid-argument", error.message);
    case "PERMISSION_DENIED":
      throw new HttpsError("permission-denied", error.message);
    case "FAILED_PRECONDITION":
      throw new HttpsError("failed-precondition", error.message);
  }
}

export function assertResultShape(match: MatchForResult): asserts match is MatchForResult & {
  format: MatchFormat;
  participants: MatchParticipant[];
} {
  if (!match.format || !Array.isArray(match.participants) || match.participants.length < 2) {
    throw new HttpsError("failed-precondition", "Match result configuration is incomplete.");
  }
}

export function isSingleGameMatch(match: MatchForResult): boolean {
  return match.seriesRule?.maxGames === 1 && match.seriesRule.gamesRequiredToWin === 1;
}

export function applyCanonicalGameResult(
  transaction: Transaction,
  input: {
    matchId: string;
    gameId: string;
    matchRef: DocumentReference;
    gameRef: DocumentReference;
    match: MatchForResult & { format: MatchFormat; participants: MatchParticipant[] };
    submissionId: string;
    submittedBy: string;
    confirmedBy: string | null;
    source: "PLAYER_CONFIRMED" | "ADMIN_RESOLVED";
    outcome: GameOutcome;
  },
): { canonicalResult: CanonicalGameResult; matchCompleted: boolean } {
  const now = Timestamp.now();
  const canonicalResult: CanonicalGameResult = {
    ...input.outcome,
    winningPlayerIds: winningPlayerIds(input.outcome, input.match.participants),
    source: input.source,
    submissionId: input.submissionId,
    submittedBy: input.submittedBy,
    confirmedBy: input.confirmedBy,
  };

  transaction.update(input.gameRef, {
    status: "COMPLETED",
    canonicalResult: {
      ...canonicalResult,
      acceptedAt: now,
    },
    completedAt: now,
    updatedAt: now,
  });

  const matchCompleted = isSingleGameMatch(input.match);
  if (matchCompleted) {
    transaction.update(input.matchRef, {
      status: "COMPLETED",
      canonicalResult: {
        ...canonicalResult,
        sourceGameId: input.gameId,
        acceptedAt: now,
      },
      completedAt: now,
      updatedAt: now,
    });

    const processingJobRef = db.collection(collections.processingJobs).doc(`MATCH_RESULT_${input.matchId}`);
    transaction.set(processingJobRef, {
      type: "MATCH_RESULT_ACCEPTED",
      status: "PENDING",
      pipelineVersion: 1,
      matchId: input.matchId,
      gameId: input.gameId,
      seasonId: input.match.seasonId ?? null,
      eventId: input.match.eventId ?? null,
      pendingSteps: [
        "SCORING",
        "GOLD",
        "POWER_RATING",
        "STATISTICS",
        "ACHIEVEMENTS",
        "RIVALRIES",
        "RECORDS",
        "ACTIVITY",
      ],
      completedSteps: [],
      attempts: 0,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    });
  } else {
    transaction.update(input.matchRef, {
      status: "ACTIVE",
      updatedAt: now,
    });
  }

  return { canonicalResult, matchCompleted };
}
