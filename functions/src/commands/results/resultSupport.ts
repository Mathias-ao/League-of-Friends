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
  canonicalResult?: (Partial<CanonicalGameResult> & Record<string, unknown>) | null;
  scoringSnapshot?: { rules?: Record<string, unknown> } | null;
  goldRewardSnapshot?: {
    attendance?: number;
    matchCompletion?: number;
    matchWin?: number;
    additionalRewards?: Record<string, number>;
  } | null;
  context?: {
    affectsLeaguePoints?: boolean;
    affectsGold?: boolean;
  } | null;
}

export interface GameForResult {
  status?: string;
  canonicalResult?: (Partial<CanonicalGameResult> & Record<string, unknown>) | null;
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

export function canonicalRevision(result: MatchForResult["canonicalResult"] | GameForResult["canonicalResult"]): number {
  const revision = result?.revision;
  return typeof revision === "number" && Number.isInteger(revision) && revision >= 1 ? revision : 1;
}

export function resultProcessingJobId(matchId: string, revision: number): string {
  return `MATCH_RESULT_${matchId}_R${revision}`;
}

export function queueResultProcessingJob(
  transaction: Transaction,
  input: {
    matchId: string;
    gameId: string;
    seasonId: string | null;
    eventId: string | null;
    revision: number;
    previousRevision: number | null;
    correctionCaseId: string | null;
  },
): void {
  const now = Timestamp.now();
  const processingJobRef = db.collection(collections.processingJobs)
    .doc(resultProcessingJobId(input.matchId, input.revision));

  transaction.set(
    processingJobRef,
    {
      type: input.revision === 1 ? "MATCH_RESULT_ACCEPTED" : "MATCH_RESULT_CORRECTED",
      status: "PENDING",
      pipelineVersion: 1,
      matchId: input.matchId,
      gameId: input.gameId,
      seasonId: input.seasonId,
      eventId: input.eventId,
      resultRevision: input.revision,
      previousRevision: input.previousRevision,
      correctionCaseId: input.correctionCaseId,
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
      blockedReason: null,
      createdAt: now,
      updatedAt: now,
    },
    { merge: false },
  );
}

export function applyCanonicalGameResult(
  transaction: Transaction,
  input: {
    matchId: string;
    gameId: string;
    matchRef: DocumentReference;
    gameRef: DocumentReference;
    match: MatchForResult & { format: MatchFormat; participants: MatchParticipant[] };
    submissionId: string | null;
    submittedBy: string | null;
    confirmedBy: string | null;
    source: "PLAYER_CONFIRMED" | "ADMIN_RESOLVED" | "ADMIN_CORRECTED";
    outcome: GameOutcome;
    revision?: number;
    previousRevision?: number | null;
    correctionCaseId?: string | null;
  },
): { canonicalResult: CanonicalGameResult; matchCompleted: boolean } {
  const now = Timestamp.now();
  const revision = input.revision ?? 1;
  const canonicalResult: CanonicalGameResult = {
    ...input.outcome,
    revision,
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
    resultRevision: revision,
    activeResultDisputeId: null,
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
      resultVersion: revision,
      processingState: "PENDING",
      activeResultDisputeId: null,
      completedAt: now,
      updatedAt: now,
    });

    queueResultProcessingJob(transaction, {
      matchId: input.matchId,
      gameId: input.gameId,
      seasonId: input.match.seasonId ?? null,
      eventId: input.match.eventId ?? null,
      revision,
      previousRevision: input.previousRevision ?? null,
      correctionCaseId: input.correctionCaseId ?? null,
    });
  } else {
    transaction.update(input.matchRef, {
      status: "ACTIVE",
      updatedAt: now,
    });
  }

  return { canonicalResult, matchCompleted };
}
