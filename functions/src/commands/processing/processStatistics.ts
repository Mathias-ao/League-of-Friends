import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import { callableOptions } from "../../config/runtime.js";
import { collections } from "../../domain/collections.js";
import type { CanonicalGameResult, MatchFormat, MatchParticipant } from "../../domain/types.js";
import {
  COMPETITION_STATS_VERSION,
  rebuildCompetitionStatistics,
  type StatisticsMatchInput,
} from "../../engines/statisticsEngine.js";
import { writeAdminAudit } from "../../services/audit.js";
import { reserveIdempotencyKey } from "../../services/idempotency.js";
import { canonicalRevision, resultProcessingJobId } from "../results/resultSupport.js";

interface ProcessStatisticsInput {
  requestId: string;
  matchId: string;
}

interface MatchForStatistics {
  status?: string;
  seasonId?: string | null;
  format?: MatchFormat;
  participants?: MatchParticipant[];
  canonicalResult?: (Partial<CanonicalGameResult> & Record<string, unknown>) | null;
  context?: {
    affectsLifetimeStats?: boolean;
    affectsSeasonStats?: boolean;
  } | null;
  activeResultDisputeId?: string | null;
  completedAt?: Timestamp | null;
  firstCompletedAt?: Timestamp | null;
}

interface ProcessingJob {
  status?: string;
  resultRevision?: number;
  pendingSteps?: string[];
  completedSteps?: string[];
  attempts?: number;
}

function timestampMillis(value: unknown): number | null {
  return value instanceof Timestamp ? value.toMillis() : null;
}

async function stableOrderAt(
  snapshot: FirebaseFirestore.QueryDocumentSnapshot,
  match: MatchForStatistics,
): Promise<number> {
  const firstCompletedAt = timestampMillis(match.firstCompletedAt);
  if (firstCompletedAt != null) return firstCompletedAt;

  if (canonicalRevision(match.canonicalResult) > 1) {
    const history = await snapshot.ref.collection("resultHistory").doc("R1").get();
    const acceptedAt = history.data()?.canonicalResult?.acceptedAt;
    const historyMillis = timestampMillis(acceptedAt);
    if (historyMillis != null) return historyMillis;
  }

  const completedAt = timestampMillis(match.completedAt);
  if (completedAt != null) return completedAt;

  throw new HttpsError(
    "failed-precondition",
    `Completed Match ${snapshot.id} is missing a stable completion timestamp.`,
  );
}

function assertStatableMatch(
  snapshot: FirebaseFirestore.QueryDocumentSnapshot,
  match: MatchForStatistics,
): asserts match is MatchForStatistics & {
  format: MatchFormat;
  participants: MatchParticipant[];
  canonicalResult: CanonicalGameResult;
} {
  if (!match.format || !Array.isArray(match.participants) || match.participants.length < 2 || !match.canonicalResult) {
    throw new HttpsError("failed-precondition", `Completed Match ${snapshot.id} is missing statistics inputs.`);
  }
}

function statsDocument(stats: {
  playerId: string;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  currentWinStreak: number;
  currentLossStreak: number;
  longestWinStreak: number;
  longestLossStreak: number;
  byFormat: unknown;
  firstMatchId: string | null;
  lastMatchId: string | null;
  firstPlayedAtMs: number | null;
  lastPlayedAtMs: number | null;
}, rebuiltAt: Timestamp) {
  return {
    schemaVersion: COMPETITION_STATS_VERSION,
    playerId: stats.playerId,
    matchesPlayed: stats.matchesPlayed,
    matchesWon: stats.matchesWon,
    matchesLost: stats.matchesLost,
    currentWinStreak: stats.currentWinStreak,
    currentLossStreak: stats.currentLossStreak,
    longestWinStreak: stats.longestWinStreak,
    longestLossStreak: stats.longestLossStreak,
    byFormat: stats.byFormat,
    firstMatchId: stats.firstMatchId,
    lastMatchId: stats.lastMatchId,
    firstPlayedAt: stats.firstPlayedAtMs == null ? null : Timestamp.fromMillis(stats.firstPlayedAtMs),
    lastPlayedAt: stats.lastPlayedAtMs == null ? null : Timestamp.fromMillis(stats.lastPlayedAtMs),
    rebuiltAt,
  };
}

export const adminProcessStatistics = onCall<ProcessStatisticsInput>(callableOptions, async (request) => {
  const actor = await requireAdmin(request);
  const { requestId, matchId } = request.data;
  if (!matchId) throw new HttpsError("invalid-argument", "matchId is required.");

  const triggerMatchRef = db.collection(collections.matches).doc(matchId);
  const triggerSnapshot = await triggerMatchRef.get();
  if (!triggerSnapshot.exists) throw new HttpsError("not-found", "Match not found.");

  const triggerMatch = triggerSnapshot.data() as MatchForStatistics;
  if (triggerMatch.status !== "COMPLETED" || !triggerMatch.canonicalResult) {
    throw new HttpsError("failed-precondition", "Only a completed Match with a canonical result can trigger statistics.");
  }
  if (triggerMatch.activeResultDisputeId) {
    throw new HttpsError("failed-precondition", "Statistics processing is blocked while a result dispute is open.");
  }

  const [completedSnapshot, playersSnapshot, seasonsSnapshot] = await Promise.all([
    db.collection(collections.matches).where("status", "==", "COMPLETED").get(),
    db.collection(collections.players).get(),
    db.collection(collections.seasons).get(),
  ]);

  const eligible = completedSnapshot.docs
    .map((snapshot) => ({ snapshot, data: snapshot.data() as MatchForStatistics }))
    .filter(({ data }) => (
      !data.activeResultDisputeId &&
      data.canonicalResult &&
      (data.context?.affectsLifetimeStats === true || data.context?.affectsSeasonStats === true)
    ));

  const matches: StatisticsMatchInput[] = await Promise.all(eligible.map(async ({ snapshot, data }) => {
    assertStatableMatch(snapshot, data);
    return {
      matchId: snapshot.id,
      seasonId: data.seasonId ?? null,
      format: data.format,
      participants: data.participants,
      canonicalResult: {
        ...data.canonicalResult,
        revision: canonicalRevision(data.canonicalResult),
      } as CanonicalGameResult,
      affectsLifetimeStats: data.context?.affectsLifetimeStats === true,
      affectsSeasonStats: data.context?.affectsSeasonStats === true,
      orderAtMs: await stableOrderAt(snapshot, data),
    };
  }));

  if (!matches.some((match) => match.matchId === matchId)) {
    throw new HttpsError("failed-precondition", "The triggering Match is not eligible to affect statistics.");
  }

  let rebuilt;
  try {
    rebuilt = rebuildCompetitionStatistics(matches);
  } catch (error) {
    throw new HttpsError(
      "failed-precondition",
      error instanceof Error ? error.message : "Statistics rebuild failed.",
    );
  }

  const [opponentSnapshots, teammateSnapshots, seasonStatisticsSnapshots] = await Promise.all([
    Promise.all(playersSnapshot.docs.map((player) => player.ref.collection("opponentStats").get())),
    Promise.all(playersSnapshot.docs.map((player) => player.ref.collection("teammateStats").get())),
    Promise.all(seasonsSnapshot.docs.map((season) => season.ref.collection("statistics").get())),
  ]);

  const rebuiltAt = Timestamp.now();

  // Phase 1: remove all existing derived statistics and wait for the cleanup
  // to finish completely. BulkWriter does not provide a cross-operation barrier
  // when delete + set target the same document path, so mixing both phases in
  // one writer can allow a stale delete to remove a freshly rebuilt document.
  const cleanupWriter = db.bulkWriter();

  for (const player of playersSnapshot.docs) {
    cleanupWriter.delete(player.ref.collection("statistics").doc("lifetime"));
  }
  for (const snapshot of opponentSnapshots) {
    for (const document of snapshot.docs) cleanupWriter.delete(document.ref);
  }
  for (const snapshot of teammateSnapshots) {
    for (const document of snapshot.docs) cleanupWriter.delete(document.ref);
  }
  for (const snapshot of seasonStatisticsSnapshots) {
    for (const document of snapshot.docs) cleanupWriter.delete(document.ref);
  }

  await cleanupWriter.close();

  // Phase 2: write the complete rebuilt projection only after cleanup has
  // finished. This makes rebuilds deterministic and safe to rerun.
  const projectionWriter = db.bulkWriter();

  for (const stats of rebuilt.lifetime) {
    projectionWriter.set(
      db.collection(collections.players).doc(stats.playerId).collection("statistics").doc("lifetime"),
      statsDocument(stats, rebuiltAt),
    );
  }

  for (const stats of rebuilt.seasonal) {
    projectionWriter.set(
      db.collection(collections.seasons).doc(stats.seasonId).collection("statistics").doc(stats.playerId),
      {
        ...statsDocument(stats, rebuiltAt),
        seasonId: stats.seasonId,
      },
    );
  }

  for (const relationship of rebuilt.opponents) {
    projectionWriter.set(
      db.collection(collections.players).doc(relationship.playerId).collection("opponentStats").doc(relationship.otherPlayerId),
      {
        schemaVersion: COMPETITION_STATS_VERSION,
        ...relationship,
        firstPlayedAt: Timestamp.fromMillis(relationship.firstPlayedAtMs),
        lastPlayedAt: Timestamp.fromMillis(relationship.lastPlayedAtMs),
        rebuiltAt,
      },
    );
  }

  for (const relationship of rebuilt.teammates) {
    projectionWriter.set(
      db.collection(collections.players).doc(relationship.playerId).collection("teammateStats").doc(relationship.otherPlayerId),
      {
        schemaVersion: COMPETITION_STATS_VERSION,
        ...relationship,
        firstPlayedAt: Timestamp.fromMillis(relationship.firstPlayedAtMs),
        lastPlayedAt: Timestamp.fromMillis(relationship.lastPlayedAtMs),
        rebuiltAt,
      },
    );
  }

  await projectionWriter.close();

  const triggerRevision = canonicalRevision(triggerMatch.canonicalResult);
  const revisionedJobRef = db.collection(collections.processingJobs).doc(resultProcessingJobId(matchId, triggerRevision));
  const legacyJobRef = db.collection(collections.processingJobs).doc(`MATCH_RESULT_${matchId}`);

  const finalization = await db.runTransaction(async (transaction) => {
    const [currentTriggerSnapshot, revisionedJobSnapshot, legacyJobSnapshot] = await Promise.all([
      transaction.get(triggerMatchRef),
      transaction.get(revisionedJobRef),
      transaction.get(legacyJobRef),
    ]);

    if (!currentTriggerSnapshot.exists) throw new HttpsError("not-found", "Match disappeared during statistics rebuild.");
    const currentTrigger = currentTriggerSnapshot.data() as MatchForStatistics;
    if (currentTrigger.status !== "COMPLETED" || currentTrigger.activeResultDisputeId) {
      throw new HttpsError("failed-precondition", "Match state changed during statistics rebuild; run it again.");
    }
    if (canonicalRevision(currentTrigger.canonicalResult) !== triggerRevision) {
      throw new HttpsError("failed-precondition", "Canonical result changed during statistics rebuild; run it again.");
    }

    const jobSnapshot = revisionedJobSnapshot.exists
      ? revisionedJobSnapshot
      : triggerRevision === 1 && legacyJobSnapshot.exists
        ? legacyJobSnapshot
        : null;
    if (!jobSnapshot) throw new HttpsError("failed-precondition", "No processing job exists for the current result revision.");

    const job = jobSnapshot.data() as ProcessingJob;
    if (job.status === "BLOCKED" || job.status === "SUPERSEDED") {
      throw new HttpsError("failed-precondition", "The current result processing job cannot process statistics.");
    }

    await reserveIdempotencyKey(transaction, requestId, "adminProcessStatistics", actor.authUid);

    const completedSteps = new Set(job.completedSteps ?? []);
    const alreadyProcessed = completedSteps.has("STATISTICS");
    completedSteps.add("STATISTICS");
    const pendingSteps = (job.pendingSteps ?? []).filter((step) => step !== "STATISTICS");
    const jobCompleted = pendingSteps.length === 0;
    const now = Timestamp.now();

    transaction.update(jobSnapshot.ref, {
      status: jobCompleted ? "COMPLETED" : "PENDING",
      completedSteps: [...completedSteps],
      pendingSteps,
      attempts: Number(job.attempts ?? 0) + 1,
      lastError: null,
      updatedAt: now,
      ...(jobCompleted ? { completedAt: now } : {}),
    });

    transaction.update(triggerMatchRef, {
      processingState: jobCompleted ? "COMPLETE" : "PENDING",
      statisticsProcessedRevision: triggerRevision,
      statisticsSchemaVersion: COMPETITION_STATS_VERSION,
      statisticsRebuiltAt: rebuiltAt,
      updatedAt: now,
    });

    writeAdminAudit(transaction, {
      actorUid: actor.authUid,
      actorPlayerId: actor.playerId,
      action: "COMPETITION_STATISTICS_REBUILT",
      targetType: "MATCH",
      targetId: matchId,
      after: {
        triggerResultRevision: triggerRevision,
        schemaVersion: COMPETITION_STATS_VERSION,
        canonicalMatches: matches.length,
        lifetimePlayers: rebuilt.lifetime.length,
        seasonalPlayers: rebuilt.seasonal.length,
        opponentRelationships: rebuilt.opponents.length,
        teammateRelationships: rebuilt.teammates.length,
      },
    });

    return { alreadyProcessed, pendingSteps };
  });

  const triggerPlayerIds = new Set(triggerMatch.participants?.map((participant) => participant.playerId) ?? []);
  const triggerPlayerStats = rebuilt.lifetime.filter((stats) => triggerPlayerIds.has(stats.playerId));

  return {
    success: true,
    matchId,
    resultRevision: triggerRevision,
    schemaVersion: COMPETITION_STATS_VERSION,
    canonicalMatches: matches.length,
    lifetimePlayers: rebuilt.lifetime.length,
    seasonalPlayers: rebuilt.seasonal.length,
    opponentRelationships: rebuilt.opponents.length,
    teammateRelationships: rebuilt.teammates.length,
    alreadyProcessed: finalization.alreadyProcessed,
    remainingSteps: finalization.pendingSteps,
    triggerPlayerStats,
  };
});
