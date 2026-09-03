import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import { callableOptions } from "../../config/runtime.js";
import { collections } from "../../domain/collections.js";
import {
  ACHIEVEMENT_ENGINE_VERSION,
  achievementAwardId,
  evaluateAchievement,
  validateAchievementDefinition,
  type AchievementDefinition,
  type AchievementPlayerMetrics,
} from "../../engines/achievementEngine.js";
import { writeAdminAudit } from "../../services/audit.js";
import { reserveIdempotencyKey } from "../../services/idempotency.js";
import { canonicalRevision, resultProcessingJobId, type MatchForResult } from "../results/resultSupport.js";

interface ProcessAchievementsInput {
  requestId: string;
  matchId: string;
}

interface MatchForAchievements {
  status?: string;
  canonicalResult?: MatchForResult["canonicalResult"];
  activeResultDisputeId?: string | null;
}

interface ProcessingJob {
  status?: string;
  pendingSteps?: string[];
  completedSteps?: string[];
  attempts?: number;
}

interface CompetitionStats {
  matchesPlayed?: number;
  matchesWon?: number;
  longestWinStreak?: number;
}

interface ReplayStats {
  highestPeak30sRawApm?: { value?: number } | null;
  highestPeak60sRawApm?: { value?: number } | null;
  strategyCounts?: Record<string, number>;
}

interface ExistingAward {
  engineVersion?: string;
  status?: string;
  firstAwardedAt?: Timestamp;
}

function finite(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function metrics(competition: CompetitionStats | null, replay: ReplayStats | null): AchievementPlayerMetrics {
  const strategies = replay?.strategyCounts ?? {};
  return {
    matchesPlayed: finite(competition?.matchesPlayed),
    matchesWon: finite(competition?.matchesWon),
    longestWinStreak: finite(competition?.longestWinStreak),
    peak30sRawApm: finite(replay?.highestPeak30sRawApm?.value),
    peak60sRawApm: finite(replay?.highestPeak60sRawApm?.value),
    fastFeudalCount: finite(strategies.FAST_FEUDAL),
    fastCastleCount: finite(strategies.FAST_CASTLE),
    fastImperialCount: finite(strategies.FAST_IMPERIAL),
    militiaOpeningCount: finite(strategies.MILITIA_OPENING_CANDIDATE),
    scoutOpeningCount: finite(strategies.SCOUT_OPENING_CANDIDATE),
    archerOpeningCount: finite(strategies.ARCHER_OPENING_CANDIDATE),
  };
}

export const adminProcessAchievements = onCall<ProcessAchievementsInput>(callableOptions, async (request) => {
  const actor = await requireAdmin(request);
  const { requestId, matchId } = request.data;
  if (!requestId || !matchId) throw new HttpsError("invalid-argument", "requestId and matchId are required.");

  const triggerMatchRef = db.collection(collections.matches).doc(matchId);
  const [triggerSnapshot, definitionsSnapshot, playersSnapshot, seasonsSnapshot] = await Promise.all([
    triggerMatchRef.get(),
    db.collection(collections.achievementDefinitions).get(),
    db.collection(collections.players).get(),
    db.collection(collections.seasons).get(),
  ]);

  if (!triggerSnapshot.exists) throw new HttpsError("not-found", "Match not found.");
  const triggerMatch = triggerSnapshot.data() as MatchForAchievements;
  if (triggerMatch.status !== "COMPLETED" || !triggerMatch.canonicalResult) {
    throw new HttpsError("failed-precondition", "Only a completed Match with a canonical result can trigger achievements.");
  }
  if (triggerMatch.activeResultDisputeId) {
    throw new HttpsError("failed-precondition", "Achievement processing is blocked while a result dispute is open.");
  }

  const definitions: AchievementDefinition[] = definitionsSnapshot.docs.map((snapshot) => {
    const data = snapshot.data();
    if (data.engineVersion !== ACHIEVEMENT_ENGINE_VERSION) {
      throw new HttpsError(
        "failed-precondition",
        `Achievement ${snapshot.id} uses unsupported engine version ${String(data.engineVersion)}.`,
      );
    }
    try {
      return validateAchievementDefinition(data as AchievementDefinition);
    } catch (error) {
      throw new HttpsError(
        "failed-precondition",
        `Achievement ${snapshot.id} is invalid: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  });

  const lifetimeStats = new Map<string, { competition: CompetitionStats | null; replay: ReplayStats | null }>();
  const existingAwards = new Map<string, FirebaseFirestore.QuerySnapshot>();
  await Promise.all(playersSnapshot.docs.map(async (player) => {
    const [competitionSnapshot, replaySnapshot, awardsSnapshot] = await Promise.all([
      player.ref.collection("statistics").doc("lifetime").get(),
      player.ref.collection("statistics").doc("replayLifetime").get(),
      player.ref.collection("achievements").get(),
    ]);
    lifetimeStats.set(player.id, {
      competition: competitionSnapshot.exists ? competitionSnapshot.data() as CompetitionStats : null,
      replay: replaySnapshot.exists ? replaySnapshot.data() as ReplayStats : null,
    });
    existingAwards.set(player.id, awardsSnapshot);
  }));

  const seasonalStats = new Map<string, Map<string, { competition: CompetitionStats | null; replay: ReplayStats | null }>>();
  for (const season of seasonsSnapshot.docs) {
    const [competitionSnapshot, replaySnapshot] = await Promise.all([
      season.ref.collection("statistics").get(),
      season.ref.collection("replayStatistics").get(),
    ]);
    const byPlayer = new Map<string, { competition: CompetitionStats | null; replay: ReplayStats | null }>();
    for (const document of competitionSnapshot.docs) {
      byPlayer.set(document.id, { competition: document.data() as CompetitionStats, replay: null });
    }
    for (const document of replaySnapshot.docs) {
      const current = byPlayer.get(document.id) ?? { competition: null, replay: null };
      current.replay = document.data() as ReplayStats;
      byPlayer.set(document.id, current);
    }
    seasonalStats.set(season.id, byPlayer);
  }

  const desired = new Map<string, Map<string, Record<string, unknown>>>();
  const evaluatedAt = Timestamp.now();

  function qualify(
    playerId: string,
    definition: AchievementDefinition,
    seasonId: string | null,
    source: { competition: CompetitionStats | null; replay: ReplayStats | null } | undefined,
  ): void {
    if (!source || (!source.competition && !source.replay)) return;
    const evaluation = evaluateAchievement(definition, metrics(source.competition, source.replay));
    if (!evaluation.qualified) return;

    const awardId = achievementAwardId(definition, seasonId);
    const playerAwards = desired.get(playerId) ?? new Map<string, Record<string, unknown>>();
    playerAwards.set(awardId, {
      awardId,
      achievementId: definition.achievementId,
      definitionVersion: definition.definitionVersion,
      name: definition.name,
      description: definition.description,
      scope: definition.scope,
      seasonId,
      status: "ACTIVE",
      engineVersion: ACHIEVEMENT_ENGINE_VERSION,
      evaluation,
      lastEvaluatedAt: evaluatedAt,
    });
    desired.set(playerId, playerAwards);
  }

  for (const definition of definitions) {
    if (definition.status !== "ACTIVE") continue;
    if (definition.scope === "LIFETIME") {
      for (const player of playersSnapshot.docs) {
        qualify(player.id, definition, null, lifetimeStats.get(player.id));
      }
    } else {
      for (const [seasonId, byPlayer] of seasonalStats) {
        for (const player of playersSnapshot.docs) {
          qualify(player.id, definition, seasonId, byPlayer.get(player.id));
        }
      }
    }
  }

  const writer = db.bulkWriter();
  let activeAwards = 0;
  let revokedAwards = 0;

  for (const player of playersSnapshot.docs) {
    const playerDesired = desired.get(player.id) ?? new Map<string, Record<string, unknown>>();
    const existingSnapshot = existingAwards.get(player.id);
    const existingById = new Map(existingSnapshot?.docs.map((document) => [document.id, document]) ?? []);

    for (const [awardId, document] of playerDesired) {
      const existing = existingById.get(awardId)?.data() as ExistingAward | undefined;
      writer.set(
        player.ref.collection("achievements").doc(awardId),
        {
          ...document,
          firstAwardedAt: existing?.firstAwardedAt ?? evaluatedAt,
          reactivatedAt: existing?.status === "REVOKED" ? evaluatedAt : null,
          revokedAt: null,
        },
        { merge: true },
      );
      activeAwards += 1;
    }

    for (const existing of existingSnapshot?.docs ?? []) {
      const data = existing.data() as ExistingAward;
      if (data.engineVersion !== ACHIEVEMENT_ENGINE_VERSION || playerDesired.has(existing.id) || data.status === "REVOKED") {
        continue;
      }
      writer.set(existing.ref, {
        status: "REVOKED",
        revokedAt: evaluatedAt,
        lastEvaluatedAt: evaluatedAt,
        revocationReason: "NO_LONGER_QUALIFIES_OR_DEFINITION_INACTIVE",
      }, { merge: true });
      revokedAwards += 1;
    }
  }

  await writer.close();

  const triggerRevision = canonicalRevision(triggerMatch.canonicalResult);
  const revisionedJobRef = db.collection(collections.processingJobs).doc(resultProcessingJobId(matchId, triggerRevision));
  const legacyJobRef = db.collection(collections.processingJobs).doc(`MATCH_RESULT_${matchId}`);

  const finalization = await db.runTransaction(async (transaction) => {
    const [currentMatchSnapshot, revisionedJobSnapshot, legacyJobSnapshot] = await Promise.all([
      transaction.get(triggerMatchRef),
      transaction.get(revisionedJobRef),
      transaction.get(legacyJobRef),
    ]);
    if (!currentMatchSnapshot.exists) throw new HttpsError("not-found", "Match disappeared during achievement rebuild.");
    const currentMatch = currentMatchSnapshot.data() as MatchForAchievements;
    if (currentMatch.status !== "COMPLETED" || currentMatch.activeResultDisputeId) {
      throw new HttpsError("failed-precondition", "Match state changed during achievement rebuild; run it again.");
    }
    if (canonicalRevision(currentMatch.canonicalResult) !== triggerRevision) {
      throw new HttpsError("failed-precondition", "Canonical result changed during achievement rebuild; run it again.");
    }

    const jobSnapshot = revisionedJobSnapshot.exists
      ? revisionedJobSnapshot
      : triggerRevision === 1 && legacyJobSnapshot.exists
        ? legacyJobSnapshot
        : null;
    if (!jobSnapshot) throw new HttpsError("failed-precondition", "No processing job exists for the current result revision.");

    const job = jobSnapshot.data() as ProcessingJob;
    if (job.status === "BLOCKED" || job.status === "SUPERSEDED") {
      throw new HttpsError("failed-precondition", "The current processing job cannot process achievements.");
    }

    await reserveIdempotencyKey(transaction, requestId, "adminProcessAchievements", actor.authUid);
    const completedSteps = new Set(job.completedSteps ?? []);
    const alreadyProcessed = completedSteps.has("ACHIEVEMENTS");
    completedSteps.add("ACHIEVEMENTS");
    const pendingSteps = (job.pendingSteps ?? []).filter((step) => step !== "ACHIEVEMENTS");
    const now = Timestamp.now();

    transaction.update(jobSnapshot.ref, {
      status: pendingSteps.length ? "PENDING" : "COMPLETED",
      completedSteps: [...completedSteps],
      pendingSteps,
      attempts: Number(job.attempts ?? 0) + 1,
      lastError: null,
      updatedAt: now,
      ...(pendingSteps.length ? {} : { completedAt: now }),
    });
    transaction.update(triggerMatchRef, {
      achievementProcessedRevision: triggerRevision,
      achievementEngineVersion: ACHIEVEMENT_ENGINE_VERSION,
      achievementRebuiltAt: evaluatedAt,
      processingState: pendingSteps.length ? "PENDING" : "COMPLETE",
      updatedAt: now,
    });
    writeAdminAudit(transaction, {
      actorUid: actor.authUid,
      actorPlayerId: actor.playerId,
      action: "ACHIEVEMENTS_REBUILT",
      targetType: "MATCH",
      targetId: matchId,
      after: {
        engineVersion: ACHIEVEMENT_ENGINE_VERSION,
        resultRevision: triggerRevision,
        definitions: definitions.length,
        activeAwards,
        revokedAwards,
      },
    });

    return { alreadyProcessed, pendingSteps };
  });

  return {
    success: true,
    matchId,
    resultRevision: triggerRevision,
    engineVersion: ACHIEVEMENT_ENGINE_VERSION,
    definitions: definitions.length,
    activeAwards,
    revokedAwards,
    alreadyProcessed: finalization.alreadyProcessed,
    remainingSteps: finalization.pendingSteps,
  };
});
