import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import { callableOptions } from "../../config/runtime.js";
import { collections, leagueStateDocumentId } from "../../domain/collections.js";
import type { ReplayDerivedGameStats } from "../../engines/replayDerivedStats.js";
import {
  DEFAULT_REPLAY_ANALYSIS_CONFIG,
  REPLAY_ANALYSIS_VERSION,
  analyzeReplayStats,
  validateReplayAnalysisConfig,
  type ReplayAnalysisConfig,
} from "../../engines/replayAnalysis.js";
import { writeAdminAudit } from "../../services/audit.js";
import { reserveIdempotencyKey } from "../../services/idempotency.js";

interface ProcessReplayAnalysisInput {
  requestId: string;
  matchId: string;
  gameId: string;
}

interface GameForReplayAnalysis {
  activeDerivedReplayStatsId?: string | null;
  activeReplayAnalysisId?: string | null;
  replayAnalysisState?: string | null;
}

interface AnalysisProfile {
  id: string;
  version: number;
  name: string;
  config: ReplayAnalysisConfig;
}

async function loadAnalysisProfile(): Promise<AnalysisProfile> {
  const leagueStateRef = db.collection(collections.leagueState).doc(leagueStateDocumentId);
  const leagueStateSnapshot = await leagueStateRef.get();
  const leagueState = leagueStateSnapshot.exists ? leagueStateSnapshot.data() : {};
  const profileId = typeof leagueState?.replayAnalysisProfileId === "string"
    ? leagueState.replayAnalysisProfileId
    : null;

  if (!profileId) {
    return {
      id: "BUILTIN_DEFAULT",
      version: 0,
      name: "Built-in Replay Analysis V1",
      config: validateReplayAnalysisConfig({ ...DEFAULT_REPLAY_ANALYSIS_CONFIG }),
    };
  }

  const profileSnapshot = await db.collection(collections.replayAnalysisProfiles).doc(profileId).get();
  if (!profileSnapshot.exists) {
    throw new HttpsError("failed-precondition", `Active replay analysis profile ${profileId} does not exist.`);
  }
  const profile = profileSnapshot.data();
  if (profile?.analysisVersion !== REPLAY_ANALYSIS_VERSION) {
    throw new HttpsError(
      "failed-precondition",
      `Replay analysis profile ${profileId} targets unsupported analysis version ${String(profile?.analysisVersion)}.`,
    );
  }

  let config: ReplayAnalysisConfig;
  try {
    config = validateReplayAnalysisConfig(profile.config as ReplayAnalysisConfig);
  } catch (error) {
    throw new HttpsError(
      "failed-precondition",
      error instanceof Error ? error.message : "Active replay analysis profile is invalid.",
    );
  }

  return {
    id: profileId,
    version: Number(profile.profileVersion ?? 0),
    name: typeof profile.name === "string" ? profile.name : profileId,
    config,
  };
}

export const adminProcessReplayAnalysis = onCall<ProcessReplayAnalysisInput>(callableOptions, async (request) => {
  const actor = await requireAdmin(request);
  const { requestId, matchId, gameId } = request.data;
  if (!matchId || !gameId) {
    throw new HttpsError("invalid-argument", "matchId and gameId are required.");
  }

  const gameRef = db.collection(collections.matches).doc(matchId).collection("games").doc(gameId);
  const gameSnapshot = await gameRef.get();
  if (!gameSnapshot.exists) throw new HttpsError("not-found", "Game not found.");

  const game = gameSnapshot.data() as GameForReplayAnalysis;
  const activeDerivedReplayStatsId = game.activeDerivedReplayStatsId;
  if (!activeDerivedReplayStatsId) {
    throw new HttpsError("failed-precondition", "Game has no active normalized replay facts. Process replay-derived stats first.");
  }

  const factsRef = gameRef.collection("derivedStats").doc(activeDerivedReplayStatsId);
  const factsSnapshot = await factsRef.get();
  if (!factsSnapshot.exists) {
    throw new HttpsError("failed-precondition", "Game points to missing normalized replay facts.");
  }
  const facts = factsSnapshot.data() as ReplayDerivedGameStats;
  const profile = await loadAnalysisProfile();
  const analysis = analyzeReplayStats(facts, profile.config);
  const analysisId = `${REPLAY_ANALYSIS_VERSION}_${profile.id}_${activeDerivedReplayStatsId}`;
  const analysisRef = gameRef.collection("analysisStats").doc(analysisId);

  const result = await db.runTransaction(async (transaction) => {
    const [currentGameSnapshot, analysisSnapshot] = await Promise.all([
      transaction.get(gameRef),
      transaction.get(analysisRef),
    ]);
    if (!currentGameSnapshot.exists) throw new HttpsError("not-found", "Game disappeared during replay analysis.");
    const currentGame = currentGameSnapshot.data() as GameForReplayAnalysis;
    if (currentGame.activeDerivedReplayStatsId !== activeDerivedReplayStatsId) {
      throw new HttpsError("failed-precondition", "Normalized replay facts changed during analysis; run it again.");
    }

    if (
      analysisSnapshot.exists &&
      currentGame.activeReplayAnalysisId === analysisId &&
      currentGame.replayAnalysisState === "COMPLETE"
    ) {
      return { alreadyProcessed: true };
    }

    await reserveIdempotencyKey(transaction, requestId, "adminProcessReplayAnalysis", actor.authUid);
    const now = Timestamp.now();
    transaction.set(analysisRef, {
      ...analysis,
      matchId,
      gameId,
      analysisId,
      sourceDerivedReplayStatsId: activeDerivedReplayStatsId,
      analysisProfileId: profile.id,
      analysisProfileVersion: profile.version,
      analysisProfileName: profile.name,
      createdAt: now,
    });
    transaction.update(gameRef, {
      activeReplayAnalysisId: analysisId,
      replayAnalysisState: "COMPLETE",
      replayAnalysisVersion: REPLAY_ANALYSIS_VERSION,
      replayAnalysisProfileId: profile.id,
      replayAnalysisProfileVersion: profile.version,
      replayAnalysisUpdatedAt: now,
      updatedAt: now,
    });

    writeAdminAudit(transaction, {
      actorUid: actor.authUid,
      actorPlayerId: actor.playerId,
      action: "REPLAY_ANALYSIS_PROCESSED",
      targetType: "GAME",
      targetId: `${matchId}/${gameId}`,
      after: {
        analysisId,
        analysisVersion: REPLAY_ANALYSIS_VERSION,
        sourceDerivedReplayStatsId: activeDerivedReplayStatsId,
        analysisProfileId: profile.id,
        analysisProfileVersion: profile.version,
      },
    });
    return { alreadyProcessed: false };
  });

  return {
    success: true,
    matchId,
    gameId,
    analysisId,
    analysisVersion: REPLAY_ANALYSIS_VERSION,
    sourceDerivedReplayStatsId: activeDerivedReplayStatsId,
    profile: {
      id: profile.id,
      version: profile.version,
      name: profile.name,
      config: profile.config,
    },
    alreadyProcessed: result.alreadyProcessed,
    players: analysis.players.map((player) => ({
      playerId: player.playerId,
      replaySlot: player.replaySlot,
      averageRawApm: player.averageRawApm,
      peak30sRawApm: player.peak30sRawApm,
      peak60sRawApm: player.peak60sRawApm,
      ageResearchStartedAt: player.ageResearchStartedAt,
      strategies: player.strategies,
      timelineDetailAvailable: player.timelineDetailAvailable,
    })),
  };
});
