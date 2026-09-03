import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import { callableOptions } from "../../config/runtime.js";
import { collections } from "../../domain/collections.js";
import {
  REPLAY_PLAYER_AGGREGATES_VERSION,
  type ReplayPlayerAggregate,
} from "../../engines/replayPlayerAggregates.js";
import {
  REPLAY_RECORDS_VERSION,
  rebuildReplayRecords,
  type ReplayRecordProjection,
} from "../../engines/replayRecords.js";
import { writeAdminAudit } from "../../services/audit.js";
import { reserveIdempotencyKey } from "../../services/idempotency.js";

interface RebuildReplayRecordsInput {
  requestId: string;
}

function recordDocument(record: ReplayRecordProjection, rebuiltAt: Timestamp, scope: "LIFETIME" | "SEASON", seasonId: string | null) {
  return {
    ...record,
    scope,
    seasonId,
    rebuiltAt,
  };
}

export const adminRebuildReplayRecords = onCall<RebuildReplayRecordsInput>(callableOptions, async (request) => {
  const actor = await requireAdmin(request);
  if (!request.data.requestId) throw new HttpsError("invalid-argument", "requestId is required.");

  const [playersSnapshot, seasonsSnapshot, lifetimeRecordsSnapshot] = await Promise.all([
    db.collection(collections.players).get(),
    db.collection(collections.seasons).get(),
    db.collection(collections.leagueRecords).get(),
  ]);

  const lifetime: ReplayPlayerAggregate[] = [];
  for (const player of playersSnapshot.docs) {
    const snapshot = await player.ref.collection("statistics").doc("replayLifetime").get();
    if (!snapshot.exists) continue;
    const stats = snapshot.data() as ReplayPlayerAggregate;
    if (stats.schemaVersion !== REPLAY_PLAYER_AGGREGATES_VERSION) {
      throw new HttpsError(
        "failed-precondition",
        `Player ${player.id} uses unsupported replay aggregate schema ${String(stats.schemaVersion)}.`,
      );
    }
    lifetime.push(stats);
  }

  const seasonal: Array<{ seasonId: string; stats: ReplayPlayerAggregate }> = [];
  const existingSeasonRecordSnapshots = [] as FirebaseFirestore.QuerySnapshot[];
  for (const season of seasonsSnapshot.docs) {
    const [statsSnapshot, recordsSnapshot] = await Promise.all([
      season.ref.collection("replayStatistics").get(),
      season.ref.collection("replayRecords").get(),
    ]);
    existingSeasonRecordSnapshots.push(recordsSnapshot);
    for (const document of statsSnapshot.docs) {
      const stats = document.data() as ReplayPlayerAggregate;
      if (stats.schemaVersion !== REPLAY_PLAYER_AGGREGATES_VERSION) {
        throw new HttpsError(
          "failed-precondition",
          `Season ${season.id} player ${document.id} uses unsupported replay aggregate schema ${String(stats.schemaVersion)}.`,
        );
      }
      seasonal.push({ seasonId: season.id, stats });
    }
  }

  const rebuilt = rebuildReplayRecords({ lifetime, seasonal });
  const rebuiltAt = Timestamp.now();

  const cleanupWriter = db.bulkWriter();
  for (const document of lifetimeRecordsSnapshot.docs) cleanupWriter.delete(document.ref);
  for (const snapshot of existingSeasonRecordSnapshots) {
    for (const document of snapshot.docs) cleanupWriter.delete(document.ref);
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

  await db.runTransaction(async (transaction) => {
    await reserveIdempotencyKey(transaction, request.data.requestId, "adminRebuildReplayRecords", actor.authUid);
    writeAdminAudit(transaction, {
      actorUid: actor.authUid,
      actorPlayerId: actor.playerId,
      action: "REPLAY_RECORDS_REBUILT",
      targetType: "RECORDS",
      targetId: REPLAY_RECORDS_VERSION,
      after: {
        schemaVersion: REPLAY_RECORDS_VERSION,
        lifetimePlayers: lifetime.length,
        seasonalPlayers: seasonal.length,
        lifetimeRecords: rebuilt.lifetime.length,
        seasonsWithRecords: rebuilt.seasonal.length,
      },
    });
  });

  return {
    success: true,
    schemaVersion: REPLAY_RECORDS_VERSION,
    lifetimePlayers: lifetime.length,
    seasonalPlayers: seasonal.length,
    lifetimeRecords: rebuilt.lifetime,
    seasonalRecords: rebuilt.seasonal,
  };
});
