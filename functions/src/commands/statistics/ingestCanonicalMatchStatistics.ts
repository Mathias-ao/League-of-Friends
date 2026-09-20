import { createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import { callableOptions } from "../../config/runtime.js";
import { collections } from "../../domain/collections.js";
import type { GamePlayer } from "../../domain/types.js";
import {
  CANONICAL_MATCH_STATISTICS_CONTRACT_VERSION,
  CanonicalMatchStatisticsValidationError,
  validateCanonicalMatchStatisticsIngestion,
  type CanonicalMatchStatisticsIngestionInput,
} from "../../engines/canonicalMatchStatisticsIngestion.js";
import { canonicalJson } from "../../engines/replayStatsIngestion.js";
import { writeAdminAudit } from "../../services/audit.js";
import { reserveIdempotencyKey } from "../../services/idempotency.js";

interface IngestCanonicalMatchStatisticsInput extends CanonicalMatchStatisticsIngestionInput {
  requestId: string;
  matchId: string;
  gameId: string;
}

interface GameForCanonicalMatchStatistics {
  players?: GamePlayer[];
  replay?: {
    sourceHash?: string | null;
  } | null;
  activeRawStatsId?: string | null;
  activeMatchStatisticsId?: string | null;
  matchStatisticsRevision?: number;
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

export const adminIngestCanonicalMatchStatistics = onCall<IngestCanonicalMatchStatisticsInput>(
  callableOptions,
  async (request) => {
    const actor = await requireAdmin(request);
    const { requestId, matchId, gameId } = request.data;

    if (!requestId || !matchId || !gameId) {
      throw new HttpsError("invalid-argument", "requestId, matchId and gameId are required.");
    }

    let ingestion;
    try {
      ingestion = validateCanonicalMatchStatisticsIngestion(request.data);
    } catch (error) {
      if (error instanceof CanonicalMatchStatisticsValidationError) {
        throw new HttpsError("invalid-argument", error.message);
      }
      throw error;
    }

    const statisticsHash = sha256(canonicalJson(ingestion.statistics));
    const matchStatisticsId = sha256(canonicalJson({
      contractVersion: CANONICAL_MATCH_STATISTICS_CONTRACT_VERSION,
      sourceHash: ingestion.sourceHash,
      statisticsHash,
      playerMapping: ingestion.playerMapping,
      statisticsSchemaVersion: ingestion.statisticsSchemaVersion,
      statisticsProjectionVersion: ingestion.statisticsProjectionVersion,
      canonicalSchemaVersion: ingestion.canonicalSchemaVersion,
    }));

    const matchRef = db.collection(collections.matches).doc(matchId);
    const gameRef = matchRef.collection("games").doc(gameId);
    const statisticsRef = gameRef.collection("matchStatistics").doc(matchStatisticsId);

    const result = await db.runTransaction(async (transaction) => {
      const [matchSnapshot, gameSnapshot, statisticsSnapshot] = await Promise.all([
        transaction.get(matchRef),
        transaction.get(gameRef),
        transaction.get(statisticsRef),
      ]);

      if (!matchSnapshot.exists) throw new HttpsError("not-found", "Match not found.");
      if (!gameSnapshot.exists) throw new HttpsError("not-found", "Game not found.");

      const game = gameSnapshot.data() as GameForCanonicalMatchStatistics;
      const gamePlayerIds = (game.players ?? []).map((player) => player.playerId);
      const mappedPlayerIds = ingestion.playerMapping.map((mapping) => mapping.playerId);
      if (gamePlayerIds.length < 2 || !samePlayerSet(gamePlayerIds, mappedPlayerIds)) {
        throw new HttpsError(
          "failed-precondition",
          "Canonical statistics player mapping must cover exactly the Players in this Game.",
        );
      }

      if (!game.activeRawStatsId || !game.replay?.sourceHash) {
        throw new HttpsError(
          "failed-precondition",
          "Replay raw statistics must be ingested before Canonical Match Statistics.",
        );
      }
      if (game.replay.sourceHash !== ingestion.sourceHash) {
        throw new HttpsError(
          "failed-precondition",
          "Canonical Match Statistics source hash does not match the Game's active replay.",
        );
      }

      if (statisticsSnapshot.exists) {
        if (game.activeMatchStatisticsId === matchStatisticsId) {
          return {
            matchStatisticsId,
            matchStatisticsRevision: Number(game.matchStatisticsRevision ?? 1),
            alreadyIngested: true,
            supersededMatchStatisticsId: null,
          };
        }
        throw new HttpsError(
          "failed-precondition",
          "This exact Canonical Match Statistics payload was previously ingested but is no longer active.",
        );
      }

      await reserveIdempotencyKey(
        transaction,
        requestId,
        "adminIngestCanonicalMatchStatistics",
        actor.authUid,
      );

      const now = Timestamp.now();
      const previousMatchStatisticsId = game.activeMatchStatisticsId ?? null;
      const matchStatisticsRevision = Number(game.matchStatisticsRevision ?? 0) + 1;

      transaction.create(statisticsRef, {
        contractVersion: CANONICAL_MATCH_STATISTICS_CONTRACT_VERSION,
        matchId,
        gameId,
        matchStatisticsRevision,
        sourceRawStatsId: game.activeRawStatsId,
        sourceHash: ingestion.sourceHash,
        statisticsHash,
        statisticsSchemaVersion: ingestion.statisticsSchemaVersion,
        statisticsProjectionVersion: ingestion.statisticsProjectionVersion,
        canonicalSchemaVersion: ingestion.canonicalSchemaVersion,
        playerMapping: ingestion.playerMapping,
        statistics: ingestion.statistics,
        supersedesMatchStatisticsId: previousMatchStatisticsId,
        ingestedBy: actor.playerId,
        ingestedAt: now,
      });

      transaction.update(gameRef, {
        activeMatchStatisticsId: matchStatisticsId,
        matchStatisticsRevision,
        matchStatisticsState: "COMPLETE",
        matchStatisticsContractVersion: CANONICAL_MATCH_STATISTICS_CONTRACT_VERSION,
        matchStatisticsSchemaVersion: ingestion.statisticsSchemaVersion,
        matchStatisticsProjectionVersion: ingestion.statisticsProjectionVersion,
        matchStatisticsCanonicalSchemaVersion: ingestion.canonicalSchemaVersion,
        matchStatisticsSourceHash: ingestion.sourceHash,
        matchStatisticsUpdatedAt: now,
        updatedAt: now,
      });

      writeAdminAudit(transaction, {
        actorUid: actor.authUid,
        actorPlayerId: actor.playerId,
        action: previousMatchStatisticsId
          ? "CANONICAL_MATCH_STATISTICS_REPLACED"
          : "CANONICAL_MATCH_STATISTICS_INGESTED",
        targetType: "GAME",
        targetId: `${matchId}/${gameId}`,
        before: previousMatchStatisticsId
          ? { activeMatchStatisticsId: previousMatchStatisticsId }
          : null,
        after: {
          activeMatchStatisticsId: matchStatisticsId,
          matchStatisticsRevision,
          sourceRawStatsId: game.activeRawStatsId,
          sourceHash: ingestion.sourceHash,
          statisticsSchemaVersion: ingestion.statisticsSchemaVersion,
          statisticsProjectionVersion: ingestion.statisticsProjectionVersion,
          canonicalSchemaVersion: ingestion.canonicalSchemaVersion,
        },
      });

      return {
        matchStatisticsId,
        matchStatisticsRevision,
        alreadyIngested: false,
        supersededMatchStatisticsId: previousMatchStatisticsId,
      };
    });

    return {
      success: true,
      matchId,
      gameId,
      contractVersion: CANONICAL_MATCH_STATISTICS_CONTRACT_VERSION,
      sourceHash: ingestion.sourceHash,
      statisticsHash,
      statisticsSchemaVersion: ingestion.statisticsSchemaVersion,
      statisticsProjectionVersion: ingestion.statisticsProjectionVersion,
      canonicalSchemaVersion: ingestion.canonicalSchemaVersion,
      ...result,
    };
  },
);
