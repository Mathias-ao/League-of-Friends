import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin } from "../../auth/authorization.js";
import { callableOptions } from "../../config/runtime.js";
import { REPLAY_RECORDS_VERSION } from "../../engines/replayRecords.js";
import { writeAdminAudit } from "../../services/audit.js";
import { reserveIdempotencyKey } from "../../services/idempotency.js";
import { rebuildReplayRecordsProjection } from "../../services/replayRecordsProjection.js";
import { db } from "../../config/firebase.js";

interface RebuildReplayRecordsInput {
  requestId: string;
}

export const adminRebuildReplayRecords = onCall<RebuildReplayRecordsInput>(callableOptions, async (request) => {
  const actor = await requireAdmin(request);
  if (!request.data.requestId) throw new HttpsError("invalid-argument", "requestId is required.");

  const rebuilt = await rebuildReplayRecordsProjection();

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
        lifetimePlayers: rebuilt.lifetimePlayers,
        seasonalPlayers: rebuilt.seasonalPlayers,
        lifetimeRecords: rebuilt.lifetimeRecords.length,
        seasonsWithRecords: rebuilt.seasonalRecords.length,
      },
    });
  });

  return {
    success: true,
    schemaVersion: REPLAY_RECORDS_VERSION,
    lifetimePlayers: rebuilt.lifetimePlayers,
    seasonalPlayers: rebuilt.seasonalPlayers,
    lifetimeRecords: rebuilt.lifetimeRecords,
    seasonalRecords: rebuilt.seasonalRecords,
  };
});
