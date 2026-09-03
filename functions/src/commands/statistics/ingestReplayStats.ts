import { createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import { callableOptions } from "../../config/runtime.js";
import { collections } from "../../domain/collections.js";
import type { CanonicalGameResult, GamePlayer } from "../../domain/types.js";
import {
  REPLAY_RAW_STATS_CONTRACT_VERSION,
  ReplayStatsValidationError,
  canonicalJson,
  validateReplayStatsIngestion,
  type ReplayStatsIngestionInput,
  type ReplayStatsPlayerMapping,
} from "../../engines/replayStatsIngestion.js";
import { writeAdminAudit } from "../../services/audit.js";
import { reserveIdempotencyKey } from "../../services/idempotency.js";
import { canonicalRevision } from "../results/resultSupport.js";

interface IngestReplayStatsInput extends ReplayStatsIngestionInput {
  requestId: string;
  matchId: string;
  gameId: string;
  playerMapping: ReplayStatsPlayerMapping[];
}

interface GameForReplayStats {
  players?: GamePlayer[];
  canonicalResult?: (Partial<CanonicalGameResult> & Record<string, unknown>) | null;
  replay?: {
    externalReference?: string | null;
  } | null;
  activeRawStatsId?: string | null;
  rawStatsRevision?: number;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function samePlayerSet(expected: string[], actual: string[]): boolean {
  if (expected.length !== actual.length) return false;
  const left = [...expected].sort((a, b) => a.localeCompare(b));
  const right = [...actual].sort((a, b) => a.localeCompare(b));
  return left.every((playerId, index) => playerId === right[index]);
}

export const adminIngestReplayStats = onCall<IngestReplayStatsInput>(callableOptions, async (request) => {
  const actor = await requireAdmin(request);
  const { requestId, matchId, gameId } = request.data;

  if (!matchId || !gameId) {
    throw new HttpsError("invalid-argument", "matchId and gameId are required.");
  }

  let ingestion;
  try {
    ingestion = validateReplayStatsIngestion(request.data);
  } catch (error) {
    if (error instanceof ReplayStatsValidationError) {
      throw new HttpsError("invalid-argument", error.message);
    }
    throw error;
  }

  const payloadHash = sha256(canonicalJson(ingestion.payload));
  const rawStatsId = sha256(canonicalJson({
    contractVersion: REPLAY_RAW_STATS_CONTRACT_VERSION,
    parserName: ingestion.parserName,
    parserVersion: ingestion.parserVersion,
    schemaVersion: ingestion.schemaVersion,
    sourceHash: ingestion.sourceHash,
    payloadHash,
    playerMapping: ingestion.playerMapping,
  }));

  const matchRef = db.collection(collections.matches).doc(matchId);
  const gameRef = matchRef.collection("games").doc(gameId);
  const rawStatsRef = gameRef.collection("rawStats").doc(rawStatsId);

  const result = await db.runTransaction(async (transaction) => {
    const [matchSnapshot, gameSnapshot, rawStatsSnapshot] = await Promise.all([
      transaction.get(matchRef),
      transaction.get(gameRef),
      transaction.get(rawStatsRef),
    ]);

    if (!matchSnapshot.exists) throw new HttpsError("not-found", "Match not found.");
    if (!gameSnapshot.exists) throw new HttpsError("not-found", "Game not found.");

    const game = gameSnapshot.data() as GameForReplayStats;
    const gamePlayerIds = (game.players ?? []).map((player) => player.playerId);
    const mappedPlayerIds = ingestion.playerMapping.map((mapping) => mapping.playerId);
    if (gamePlayerIds.length < 2 || !samePlayerSet(gamePlayerIds, mappedPlayerIds)) {
      throw new HttpsError(
        "failed-precondition",
        "Replay player mapping must cover exactly the Players in this Game.",
      );
    }

    if (rawStatsSnapshot.exists) {
      if (game.activeRawStatsId === rawStatsId) {
        return {
          rawStatsId,
          rawStatsRevision: Number(game.rawStatsRevision ?? 1),
          alreadyIngested: true,
          supersededRawStatsId: null,
        };
      }
      throw new HttpsError(
        "failed-precondition",
        "This exact replay statistics payload was previously ingested but is no longer active.",
      );
    }

    await reserveIdempotencyKey(
      transaction,
      requestId,
      "adminIngestReplayStats",
      actor.authUid,
    );

    const now = Timestamp.now();
    const previousRawStatsId = game.activeRawStatsId ?? null;
    const rawStatsRevision = Number(game.rawStatsRevision ?? 0) + 1;
    const resultRevision = game.canonicalResult ? canonicalRevision(game.canonicalResult) : null;

    transaction.create(rawStatsRef, {
      contractVersion: REPLAY_RAW_STATS_CONTRACT_VERSION,
      matchId,
      gameId,
      rawStatsRevision,
      source: {
        type: "AOE2_REPLAY",
        sourceHash: ingestion.sourceHash,
        sourceFileName: ingestion.sourceFileName,
      },
      parser: {
        name: ingestion.parserName,
        version: ingestion.parserVersion,
        schemaVersion: ingestion.schemaVersion,
        extractedAt: ingestion.parserExtractedAt
          ? Timestamp.fromDate(new Date(ingestion.parserExtractedAt))
          : null,
      },
      playerMapping: ingestion.playerMapping,
      warnings: ingestion.warnings,
      payloadHash,
      payload: ingestion.payload,
      canonicalResultRevisionAtIngestion: resultRevision,
      supersedesRawStatsId: previousRawStatsId,
      ingestedBy: actor.playerId,
      ingestedAt: now,
    });

    transaction.update(gameRef, {
      replay: {
        status: "PARSED",
        externalReference: game.replay?.externalReference ?? null,
        parserName: ingestion.parserName,
        parserVersion: ingestion.parserVersion,
        schemaVersion: ingestion.schemaVersion,
        parsedAt: now,
        sourceHash: ingestion.sourceHash,
        activeRawStatsId: rawStatsId,
      },
      activeRawStatsId: rawStatsId,
      rawStatsRevision,
      replayDerivedStatsState: "PENDING",
      replayStatsUpdatedAt: now,
      updatedAt: now,
    });

    writeAdminAudit(transaction, {
      actorUid: actor.authUid,
      actorPlayerId: actor.playerId,
      action: previousRawStatsId ? "REPLAY_RAW_STATS_REPLACED" : "REPLAY_RAW_STATS_INGESTED",
      targetType: "GAME",
      targetId: `${matchId}/${gameId}`,
      before: previousRawStatsId ? { activeRawStatsId: previousRawStatsId } : null,
      after: {
        activeRawStatsId: rawStatsId,
        rawStatsRevision,
        sourceHash: ingestion.sourceHash,
        parserName: ingestion.parserName,
        parserVersion: ingestion.parserVersion,
        schemaVersion: ingestion.schemaVersion,
      },
    });

    return {
      rawStatsId,
      rawStatsRevision,
      alreadyIngested: false,
      supersededRawStatsId: previousRawStatsId,
    };
  });

  return {
    success: true,
    matchId,
    gameId,
    contractVersion: REPLAY_RAW_STATS_CONTRACT_VERSION,
    parserName: ingestion.parserName,
    parserVersion: ingestion.parserVersion,
    schemaVersion: ingestion.schemaVersion,
    sourceHash: ingestion.sourceHash,
    payloadHash,
    ...result,
  };
});
