import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import { callableOptions } from "../../config/runtime.js";
import { collections } from "../../domain/collections.js";
import {
  REPLAY_DERIVED_STATS_VERSION,
  ReplayDerivedStatsError,
  normalizeReplayDerivedStats,
  type RawReplayPlayerMapping,
} from "../../engines/replayDerivedStats.js";
import { writeAdminAudit } from "../../services/audit.js";
import { reserveIdempotencyKey } from "../../services/idempotency.js";

interface ProcessReplayDerivedStatsInput {
  requestId: string;
  matchId: string;
  gameId: string;
}

interface GameForReplayDerivedStats {
  activeRawStatsId?: string | null;
  rawStatsRevision?: number;
  activeDerivedReplayStatsId?: string | null;
  replayDerivedStatsState?: string | null;
}

interface RawStatsDocument {
  rawStatsRevision?: number;
  source?: {
    sourceHash?: string;
  };
  parser?: {
    name?: string;
    version?: string;
    schemaVersion?: string;
  };
  playerMapping?: RawReplayPlayerMapping[];
  payload?: Record<string, unknown>;
}

export const adminProcessReplayDerivedStats = onCall<ProcessReplayDerivedStatsInput>(callableOptions, async (request) => {
  const actor = await requireAdmin(request);
  const { requestId, matchId, gameId } = request.data;
  if (!matchId || !gameId) {
    throw new HttpsError("invalid-argument", "matchId and gameId are required.");
  }

  const matchRef = db.collection(collections.matches).doc(matchId);
  const gameRef = matchRef.collection("games").doc(gameId);
  const gameSnapshot = await gameRef.get();
  if (!gameSnapshot.exists) throw new HttpsError("not-found", "Game not found.");

  const game = gameSnapshot.data() as GameForReplayDerivedStats;
  const activeRawStatsId = game.activeRawStatsId;
  if (!activeRawStatsId) {
    throw new HttpsError("failed-precondition", "Game has no active replay raw statistics to normalize.");
  }

  const rawStatsRef = gameRef.collection("rawStats").doc(activeRawStatsId);
  const rawStatsSnapshot = await rawStatsRef.get();
  if (!rawStatsSnapshot.exists) {
    throw new HttpsError("failed-precondition", "Game points to a missing active raw statistics document.");
  }

  const rawStats = rawStatsSnapshot.data() as RawStatsDocument;
  const adapterSchemaVersion = rawStats.parser?.schemaVersion;
  const payload = rawStats.payload;
  const playerMapping = rawStats.playerMapping;
  if (!adapterSchemaVersion || !payload || !Array.isArray(playerMapping)) {
    throw new HttpsError("failed-precondition", "Active raw replay statistics are missing normalization inputs.");
  }

  let normalized;
  try {
    normalized = normalizeReplayDerivedStats({
      adapterSchemaVersion,
      payload,
      playerMapping,
    });
  } catch (error) {
    if (error instanceof ReplayDerivedStatsError) {
      throw new HttpsError("failed-precondition", error.message);
    }
    throw error;
  }

  const derivedStatsId = `${REPLAY_DERIVED_STATS_VERSION}_${activeRawStatsId}`;
  const derivedStatsRef = gameRef.collection("derivedStats").doc(derivedStatsId);

  const result = await db.runTransaction(async (transaction) => {
    const [currentGameSnapshot, derivedSnapshot] = await Promise.all([
      transaction.get(gameRef),
      transaction.get(derivedStatsRef),
    ]);

    if (!currentGameSnapshot.exists) throw new HttpsError("not-found", "Game disappeared during replay normalization.");
    const currentGame = currentGameSnapshot.data() as GameForReplayDerivedStats;
    if (currentGame.activeRawStatsId !== activeRawStatsId) {
      throw new HttpsError("failed-precondition", "Active replay changed during normalization; run it again.");
    }

    if (
      derivedSnapshot.exists &&
      currentGame.activeDerivedReplayStatsId === derivedStatsId &&
      currentGame.replayDerivedStatsState === "COMPLETE"
    ) {
      return { alreadyProcessed: true };
    }

    await reserveIdempotencyKey(
      transaction,
      requestId,
      "adminProcessReplayDerivedStats",
      actor.authUid,
    );

    const now = Timestamp.now();
    transaction.set(derivedStatsRef, {
      ...normalized,
      matchId,
      gameId,
      derivedStatsId,
      sourceRawStatsId: activeRawStatsId,
      sourceRawStatsRevision: Number(rawStats.rawStatsRevision ?? currentGame.rawStatsRevision ?? 1),
      sourceHash: rawStats.source?.sourceHash ?? null,
      parserName: rawStats.parser?.name ?? null,
      parserVersion: rawStats.parser?.version ?? null,
      createdAt: now,
    });

    transaction.update(gameRef, {
      durationSeconds: normalized.durationSeconds,
      activeDerivedReplayStatsId: derivedStatsId,
      replayDerivedStatsState: "COMPLETE",
      replayDerivedStatsSchemaVersion: REPLAY_DERIVED_STATS_VERSION,
      replayDerivedStatsRawStatsId: activeRawStatsId,
      replayDerivedStatsUpdatedAt: now,
      updatedAt: now,
    });

    writeAdminAudit(transaction, {
      actorUid: actor.authUid,
      actorPlayerId: actor.playerId,
      action: "REPLAY_DERIVED_STATS_PROCESSED",
      targetType: "GAME",
      targetId: `${matchId}/${gameId}`,
      after: {
        derivedStatsId,
        schemaVersion: REPLAY_DERIVED_STATS_VERSION,
        sourceRawStatsId: activeRawStatsId,
        sourceRawStatsRevision: Number(rawStats.rawStatsRevision ?? currentGame.rawStatsRevision ?? 1),
        durationSeconds: normalized.durationSeconds,
        playerCount: normalized.playerCount,
      },
    });

    return { alreadyProcessed: false };
  });

  return {
    success: true,
    matchId,
    gameId,
    derivedStatsId,
    schemaVersion: REPLAY_DERIVED_STATS_VERSION,
    sourceRawStatsId: activeRawStatsId,
    sourceRawStatsRevision: Number(rawStats.rawStatsRevision ?? game.rawStatsRevision ?? 1),
    durationSeconds: normalized.durationSeconds,
    playerCount: normalized.playerCount,
    totalActions: normalized.totalActions,
    alreadyProcessed: result.alreadyProcessed,
    players: normalized.players.map((player) => ({
      playerId: player.playerId,
      replaySlot: player.replaySlot,
      civilizationId: player.civilizationId,
      teamId: player.teamId,
      colorId: player.colorId,
      totalActions: player.totalActions,
      totalBuildCommands: player.totalBuildCommands,
      researchEventCount: player.researchEventCount,
      resigned: player.resigned,
      resignedAtMs: player.resignedAtMs,
    })),
  };
});
