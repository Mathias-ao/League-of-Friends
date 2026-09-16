import { createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import { callableOptions } from "../../config/runtime.js";
import { collections } from "../../domain/collections.js";
import {
  TOWNBELL_RAW_STATS_CONTRACT_VERSION,
  TownBellStatsValidationError,
  canonicalTownBellJson,
  validateTownBellStatsIngestion,
  type TownBellStatsIngestionInput,
} from "../../engines/townBellStatsIngestion.js";
import { writeAdminAudit } from "../../services/audit.js";
import { reserveIdempotencyKey } from "../../services/idempotency.js";

interface IngestTownBellStatsInput extends TownBellStatsIngestionInput {
  requestId: string;
  matchId: string;
  gameId: string;
}

interface GameForTownBellStats {
  activeTownBellStatsId?: string | null;
  townBellStatsRevision?: number;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export const adminIngestTownBellStats = onCall<IngestTownBellStatsInput>(callableOptions, async (request) => {
  const actor = await requireAdmin(request);
  const { requestId, matchId, gameId } = request.data;

  if (!requestId || !matchId || !gameId) {
    throw new HttpsError("invalid-argument", "requestId, matchId and gameId are required.");
  }

  let ingestion;
  try {
    ingestion = validateTownBellStatsIngestion(request.data);
  } catch (error) {
    if (error instanceof TownBellStatsValidationError) {
      throw new HttpsError("invalid-argument", error.message);
    }
    throw error;
  }

  const payloadHash = sha256(canonicalTownBellJson(ingestion.payload));
  const townBellStatsId = sha256(canonicalTownBellJson({
    contractVersion: TOWNBELL_RAW_STATS_CONTRACT_VERSION,
    sourceSha256: ingestion.sourceSha256,
    payloadHash,
    townBellVersion: ingestion.townBellVersion,
  }));

  const matchRef = db.collection(collections.matches).doc(matchId);
  const gameRef = matchRef.collection("games").doc(gameId);
  const statsRef = gameRef.collection("townBellStats").doc(townBellStatsId);

  const result = await db.runTransaction(async (transaction) => {
    const [matchSnapshot, gameSnapshot, statsSnapshot] = await Promise.all([
      transaction.get(matchRef),
      transaction.get(gameRef),
      transaction.get(statsRef),
    ]);

    if (!matchSnapshot.exists) throw new HttpsError("not-found", "Match not found.");
    if (!gameSnapshot.exists) throw new HttpsError("not-found", "Game not found.");

    const game = gameSnapshot.data() as GameForTownBellStats;
    if (statsSnapshot.exists) {
      if (game.activeTownBellStatsId === townBellStatsId) {
        return {
          townBellStatsId,
          townBellStatsRevision: Number(game.townBellStatsRevision ?? 1),
          alreadyIngested: true,
          supersededTownBellStatsId: null,
        };
      }
      throw new HttpsError(
        "failed-precondition",
        "This exact TownBell JSON was previously ingested but is no longer the active revision.",
      );
    }

    await reserveIdempotencyKey(
      transaction,
      requestId,
      "adminIngestTownBellStats",
      actor.authUid,
    );

    const now = Timestamp.now();
    const previousStatsId = game.activeTownBellStatsId ?? null;
    const revision = Number(game.townBellStatsRevision ?? 0) + 1;

    transaction.create(statsRef, {
      contractVersion: TOWNBELL_RAW_STATS_CONTRACT_VERSION,
      matchId,
      gameId,
      townBellStatsRevision: revision,
      source: {
        type: "TOWNBELL_JSON",
        sourceSha256: ingestion.sourceSha256,
        sourceFileName: ingestion.sourceFileName,
        townBellVersion: ingestion.townBellVersion,
      },
      payloadHash,
      payload: ingestion.payload,
      interpretationState: "PENDING",
      supersedesTownBellStatsId: previousStatsId,
      importedBy: actor.playerId,
      importedAt: now,
    });

    transaction.update(gameRef, {
      launchStatisticsSource: {
        type: "TOWNBELL_JSON",
        activeStatsId: townBellStatsId,
        sourceSha256: ingestion.sourceSha256,
        payloadHash,
        townBellVersion: ingestion.townBellVersion,
        importedAt: now,
      },
      activeTownBellStatsId: townBellStatsId,
      townBellStatsRevision: revision,
      townBellInterpretationState: "PENDING",
      townBellStatsUpdatedAt: now,
      updatedAt: now,
    });

    writeAdminAudit(transaction, {
      actorUid: actor.authUid,
      actorPlayerId: actor.playerId,
      action: previousStatsId ? "TOWNBELL_STATS_REPLACED" : "TOWNBELL_STATS_INGESTED",
      targetType: "GAME",
      targetId: `${matchId}/${gameId}`,
      before: previousStatsId ? { activeTownBellStatsId: previousStatsId } : null,
      after: {
        activeTownBellStatsId: townBellStatsId,
        townBellStatsRevision: revision,
        sourceSha256: ingestion.sourceSha256,
        payloadHash,
        townBellVersion: ingestion.townBellVersion,
      },
    });

    return {
      townBellStatsId,
      townBellStatsRevision: revision,
      alreadyIngested: false,
      supersededTownBellStatsId: previousStatsId,
    };
  });

  return {
    success: true,
    matchId,
    gameId,
    contractVersion: TOWNBELL_RAW_STATS_CONTRACT_VERSION,
    sourceSha256: ingestion.sourceSha256,
    payloadHash,
    interpretationState: "PENDING",
    ...result,
  };
});
