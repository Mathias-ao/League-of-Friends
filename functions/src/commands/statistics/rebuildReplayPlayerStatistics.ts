import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import { callableOptions } from "../../config/runtime.js";
import { collections } from "../../domain/collections.js";
import { REPLAY_ANALYSIS_VERSION, type ReplayGameAnalysis } from "../../engines/replayAnalysis.js";
import {
  REPLAY_PLAYER_AGGREGATES_VERSION,
  rebuildReplayPlayerAggregates,
  type ReplayAggregateGameInput,
  type ReplayPlayerAggregate,
} from "../../engines/replayPlayerAggregates.js";
import { writeAdminAudit } from "../../services/audit.js";
import { reserveIdempotencyKey } from "../../services/idempotency.js";

interface RebuildReplayPlayerStatisticsInput {
  requestId: string;
}

interface MatchForReplayAggregates {
  status?: string;
  seasonId?: string | null;
  context?: {
    affectsLifetimeStats?: boolean;
    affectsSeasonStats?: boolean;
  } | null;
}

interface GameForReplayAggregates {
  activeReplayAnalysisId?: string | null;
  replayAnalysisState?: string | null;
}

function projectionDocument(stats: ReplayPlayerAggregate, rebuiltAt: Timestamp) {
  return {
    ...stats,
    rebuiltAt,
  };
}

export const adminRebuildReplayPlayerStatistics = onCall<RebuildReplayPlayerStatisticsInput>(
  callableOptions,
  async (request) => {
    const actor = await requireAdmin(request);
    if (!request.data.requestId) {
      throw new HttpsError("invalid-argument", "requestId is required.");
    }

    const matchesSnapshot = await db.collection(collections.matches).where("status", "==", "COMPLETED").get();
    const aggregateGames: ReplayAggregateGameInput[] = [];

    for (const matchSnapshot of matchesSnapshot.docs) {
      const match = matchSnapshot.data() as MatchForReplayAggregates;
      const affectsLifetimeStats = match.context?.affectsLifetimeStats === true;
      const affectsSeasonStats = match.context?.affectsSeasonStats === true;
      if (!affectsLifetimeStats && !affectsSeasonStats) continue;

      const gamesSnapshot = await matchSnapshot.ref.collection("games").get();
      for (const gameSnapshot of gamesSnapshot.docs) {
        const game = gameSnapshot.data() as GameForReplayAggregates;
        if (game.replayAnalysisState !== "COMPLETE" || !game.activeReplayAnalysisId) continue;

        const analysisSnapshot = await gameSnapshot.ref.collection("analysisStats").doc(game.activeReplayAnalysisId).get();
        if (!analysisSnapshot.exists) {
          throw new HttpsError(
            "failed-precondition",
            `Game ${matchSnapshot.id}/${gameSnapshot.id} points to missing replay analysis ${game.activeReplayAnalysisId}.`,
          );
        }

        const analysis = analysisSnapshot.data() as ReplayGameAnalysis;
        if (analysis.schemaVersion !== REPLAY_ANALYSIS_VERSION) {
          throw new HttpsError(
            "failed-precondition",
            `Game ${matchSnapshot.id}/${gameSnapshot.id} uses unsupported replay analysis ${String(analysis.schemaVersion)}.`,
          );
        }

        aggregateGames.push({
          matchId: matchSnapshot.id,
          gameId: gameSnapshot.id,
          seasonId: match.seasonId ?? null,
          affectsLifetimeStats,
          affectsSeasonStats,
          durationSeconds: Number(analysis.durationSeconds ?? 0),
          players: Array.isArray(analysis.players) ? analysis.players : [],
        });
      }
    }

    const rebuilt = rebuildReplayPlayerAggregates(aggregateGames);
    const [playersSnapshot, seasonsSnapshot] = await Promise.all([
      db.collection(collections.players).get(),
      db.collection(collections.seasons).get(),
    ]);

    const existingSeasonSnapshots = await Promise.all(
      seasonsSnapshot.docs.map((season) => season.ref.collection("replayStatistics").get()),
    );

    const cleanupWriter = db.bulkWriter();
    for (const player of playersSnapshot.docs) {
      cleanupWriter.delete(player.ref.collection("statistics").doc("replayLifetime"));
    }
    for (const snapshot of existingSeasonSnapshots) {
      for (const document of snapshot.docs) cleanupWriter.delete(document.ref);
    }
    await cleanupWriter.close();

    const rebuiltAt = Timestamp.now();
    const projectionWriter = db.bulkWriter();
    for (const stats of rebuilt.lifetime) {
      projectionWriter.set(
        db.collection(collections.players).doc(stats.playerId).collection("statistics").doc("replayLifetime"),
        projectionDocument(stats, rebuiltAt),
      );
    }
    for (const seasonal of rebuilt.seasonal) {
      projectionWriter.set(
        db.collection(collections.seasons).doc(seasonal.seasonId).collection("replayStatistics").doc(seasonal.stats.playerId),
        projectionDocument(seasonal.stats, rebuiltAt),
      );
    }
    await projectionWriter.close();

    await db.runTransaction(async (transaction) => {
      await reserveIdempotencyKey(
        transaction,
        request.data.requestId,
        "adminRebuildReplayPlayerStatistics",
        actor.authUid,
      );
      writeAdminAudit(transaction, {
        actorUid: actor.authUid,
        actorPlayerId: actor.playerId,
        action: "REPLAY_PLAYER_STATISTICS_REBUILT",
        targetType: "STATISTICS",
        targetId: REPLAY_PLAYER_AGGREGATES_VERSION,
        after: {
          schemaVersion: REPLAY_PLAYER_AGGREGATES_VERSION,
          gamesAnalyzed: aggregateGames.length,
          lifetimePlayers: rebuilt.lifetime.length,
          seasonalPlayers: rebuilt.seasonal.length,
        },
      });
    });

    return {
      success: true,
      schemaVersion: REPLAY_PLAYER_AGGREGATES_VERSION,
      gamesAnalyzed: aggregateGames.length,
      lifetimePlayers: rebuilt.lifetime.length,
      seasonalPlayers: rebuilt.seasonal.length,
    };
  },
);
