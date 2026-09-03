import { Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { db } from "../config/firebase.js";
import { collections } from "../domain/collections.js";
import {
  REPLAY_PLAYER_AGGREGATES_VERSION,
  type ReplayPlayerAggregate,
} from "../engines/replayPlayerAggregates.js";
import {
  rebuildReplayRecords,
  type ReplayRecordProjection,
} from "../engines/replayRecords.js";

export interface ReplayRecordsProjectionResult {
  rebuiltAt: Timestamp;
  lifetimePlayers: number;
  seasonalPlayers: number;
  lifetimeRecords: ReplayRecordProjection[];
  seasonalRecords: Array<{ seasonId: string; records: ReplayRecordProjection[] }>;
}

function recordDocument(
  record: ReplayRecordProjection,
  rebuiltAt: Timestamp,
  scope: "LIFETIME" | "SEASON",
  seasonId: string | null,
) {
  return {
    ...record,
    scope,
    seasonId,
    rebuiltAt,
  };
}

export async function rebuildReplayRecordsProjection(): Promise<ReplayRecordsProjectionResult> {
  const [playersSnapshot, seasonsSnapshot, lifetimeRecordsSnapshot] = await Promise.all([
    db.collection(collections.players).get(),
    db.collection(collections.seasons).get(),
    db.collection(collections.leagueRecords).get(),
  ]);

  const lifetimeStatsSnapshots = await Promise.all(
    playersSnapshot.docs.map((player) => player.ref.collection("statistics").doc("replayLifetime").get()),
  );

  const lifetime: ReplayPlayerAggregate[] = [];
  for (let index = 0; index < lifetimeStatsSnapshots.length; index += 1) {
    const snapshot = lifetimeStatsSnapshots[index];
    if (!snapshot.exists) continue;
    const stats = snapshot.data() as ReplayPlayerAggregate;
    if (stats.schemaVersion !== REPLAY_PLAYER_AGGREGATES_VERSION) {
      throw new HttpsError(
        "failed-precondition",
        `Player ${playersSnapshot.docs[index].id} uses unsupported replay aggregate schema ${String(stats.schemaVersion)}.`,
      );
    }
    lifetime.push(stats);
  }

  const seasonInputs = await Promise.all(seasonsSnapshot.docs.map(async (season) => {
    const [statsSnapshot, recordsSnapshot] = await Promise.all([
      season.ref.collection("replayStatistics").get(),
      season.ref.collection("replayRecords").get(),
    ]);
    return { season, statsSnapshot, recordsSnapshot };
  }));

  const seasonal: Array<{ seasonId: string; stats: ReplayPlayerAggregate }> = [];
  for (const input of seasonInputs) {
    for (const document of input.statsSnapshot.docs) {
      const stats = document.data() as ReplayPlayerAggregate;
      if (stats.schemaVersion !== REPLAY_PLAYER_AGGREGATES_VERSION) {
        throw new HttpsError(
          "failed-precondition",
          `Season ${input.season.id} player ${document.id} uses unsupported replay aggregate schema ${String(stats.schemaVersion)}.`,
        );
      }
      seasonal.push({ seasonId: input.season.id, stats });
    }
  }

  const rebuilt = rebuildReplayRecords({ lifetime, seasonal });
  const rebuiltAt = Timestamp.now();

  const cleanupWriter = db.bulkWriter();
  for (const document of lifetimeRecordsSnapshot.docs) cleanupWriter.delete(document.ref);
  for (const input of seasonInputs) {
    for (const document of input.recordsSnapshot.docs) cleanupWriter.delete(document.ref);
  }
  await cleanupWriter.close();

  const projectionWriter = db.bulkWriter();
  for (const record of rebuilt.lifetime) {
    projectionWriter.set(
      db.collection(collections.leagueRecords).doc(record.code),
      recordDocument(record, rebuiltAt, "LIFETIME", null),
    );
  }
  for (const season of rebuilt.seasonal) {
    for (const record of season.records) {
      projectionWriter.set(
        db.collection(collections.seasons).doc(season.seasonId).collection("replayRecords").doc(record.code),
        recordDocument(record, rebuiltAt, "SEASON", season.seasonId),
      );
    }
  }
  await projectionWriter.close();

  return {
    rebuiltAt,
    lifetimePlayers: lifetime.length,
    seasonalPlayers: seasonal.length,
    lifetimeRecords: rebuilt.lifetime,
    seasonalRecords: rebuilt.seasonal,
  };
}
