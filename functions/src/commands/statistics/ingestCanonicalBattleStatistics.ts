import { createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import { callableOptions } from "../../config/runtime.js";
import { collections } from "../../domain/collections.js";
import type { GamePlayer } from "../../domain/types.js";
import {
  CANONICAL_BATTLE_STATISTICS_CONTRACT_VERSION,
  CanonicalBattleStatisticsValidationError,
  buildCanonicalBattleStatisticsProjection,
  type CanonicalBattlePlayerMapping,
} from "../../engines/canonicalBattleStatistics.js";
import { canonicalJson } from "../../engines/replayStatsIngestion.js";
import { writeAdminAudit } from "../../services/audit.js";
import { reserveIdempotencyKey } from "../../services/idempotency.js";

const REPLAY_SOURCE_SELECTION_POLICY_VERSION = "FIRST_VALID_THEN_CORROBORATE_V1";

interface IngestCanonicalBattleStatisticsInput {
  requestId: string;
  matchId: string;
  gameId: string;
  sourceFileName?: string | null;
  sourceByteLength?: number | null;
  playerMapping: CanonicalBattlePlayerMapping[];
  projection: unknown;
}

interface GameForCanonicalStatistics {
  players?: GamePlayer[];
  replaySourceCount?: number;
  activeCanonicalReplaySourceId?: string | null;
  activeCanonicalStatisticsId?: string | null;
  activeCanonicalStatisticsHash?: string | null;
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

function sourceFileName(value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > 255) {
    throw new HttpsError("invalid-argument", "sourceFileName must contain at most 255 characters.");
  }
  return normalized;
}

function sourceByteLength(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (!Number.isInteger(value) || value <= 0 || value > 128 * 1024 * 1024) {
    throw new HttpsError(
      "invalid-argument",
      "sourceByteLength must be a positive integer no larger than 128 MiB.",
    );
  }
  return value;
}

export const adminIngestCanonicalBattleStatistics = onCall<IngestCanonicalBattleStatisticsInput>(
  callableOptions,
  async (request) => {
    const actor = await requireAdmin(request);
    const { requestId, matchId, gameId } = request.data;
    if (!requestId || !matchId || !gameId) {
      throw new HttpsError("invalid-argument", "requestId, matchId, and gameId are required.");
    }

    let projection;
    try {
      projection = buildCanonicalBattleStatisticsProjection({
        projection: request.data.projection,
        playerMapping: request.data.playerMapping,
      });
    } catch (error) {
      if (error instanceof CanonicalBattleStatisticsValidationError) {
        throw new HttpsError("invalid-argument", error.message);
      }
      throw error;
    }

    const fileName = sourceFileName(request.data.sourceFileName);
    const byteLength = sourceByteLength(request.data.sourceByteLength);
    const replaySourceId = projection.source.replaySha256;
    const projectionHash = sha256(canonicalJson(projection));
    const sharedStatisticsHash = sha256(canonicalJson({
      contractVersion: projection.contractVersion,
      statisticsSchemaVersion: projection.statisticsSchemaVersion,
      statisticsProjectionVersion: projection.statisticsProjectionVersion,
      participants: projection.participants,
    }));
    const statisticsId = sha256(canonicalJson({
      contractVersion: CANONICAL_BATTLE_STATISTICS_CONTRACT_VERSION,
      replaySourceId,
      projectionHash,
    }));

    const matchRef = db.collection(collections.matches).doc(matchId);
    const gameRef = matchRef.collection("games").doc(gameId);
    const sourceRef = gameRef.collection("replaySources").doc(replaySourceId);
    const statisticsRef = gameRef.collection("battleStatistics").doc(statisticsId);

    const transactionResult = await db.runTransaction(async (transaction) => {
      const [matchSnapshot, gameSnapshot, sourceSnapshot, statisticsSnapshot] = await Promise.all([
        transaction.get(matchRef),
        transaction.get(gameRef),
        transaction.get(sourceRef),
        transaction.get(statisticsRef),
      ]);

      if (!matchSnapshot.exists) throw new HttpsError("not-found", "Match not found.");
      if (!gameSnapshot.exists) throw new HttpsError("not-found", "Game not found.");

      const game = gameSnapshot.data() as GameForCanonicalStatistics;
      const gamePlayerIds = (game.players ?? []).map((player) => player.playerId);
      const mappedPlayerIds = projection.participants.map((participant) => participant.playerId);
      if (gamePlayerIds.length < 2 || !samePlayerSet(gamePlayerIds, mappedPlayerIds)) {
        throw new HttpsError(
          "failed-precondition",
          "Canonical player mapping must cover exactly the Players in this Game.",
        );
      }

      if (sourceSnapshot.exists) {
        const existing = sourceSnapshot.data() as {
          projectionHash?: string;
          statisticsId?: string;
          comparisonStatus?: string;
        };
        if (existing.projectionHash !== projectionHash || existing.statisticsId !== statisticsId) {
          throw new HttpsError(
            "failed-precondition",
            "This replay source hash already exists with different canonical statistics.",
          );
        }
        return {
          alreadyIngested: true,
          selectedAsActive: game.activeCanonicalReplaySourceId === replaySourceId,
          comparisonStatus: existing.comparisonStatus ?? "UNKNOWN",
          replaySourceCount: Number(game.replaySourceCount ?? 1),
        };
      }

      await reserveIdempotencyKey(
        transaction,
        requestId,
        "adminIngestCanonicalBattleStatistics",
        actor.authUid,
      );

      const activeSourceId = game.activeCanonicalReplaySourceId ?? null;
      const activeStatisticsHash = game.activeCanonicalStatisticsHash ?? null;
      const selectedAsActive = !activeSourceId;
      const comparisonStatus = selectedAsActive
        ? "SELECTED_FIRST_VALID"
        : activeStatisticsHash === sharedStatisticsHash
          ? "CORROBORATES_ACTIVE"
          : "ALTERNATE_DIVERGES";
      const replaySourceCount = Number(game.replaySourceCount ?? 0) + 1;
      const now = Timestamp.now();

      transaction.create(sourceRef, {
        contractVersion: "AOF_REPLAY_SOURCE_BINDING_V1",
        matchId,
        gameId,
        sourceType: "AOE2_REPLAY",
        replaySourceId,
        sourceHash: replaySourceId,
        sourceFileName: fileName,
        sourceByteLength: byteLength,
        extractionRunId: projection.source.extractionRunId,
        canonicalManifestSha256: projection.source.canonicalManifestSha256,
        canonicalSchemaVersion: projection.source.canonicalSchemaVersion,
        parserVersion: projection.source.parserVersion,
        statisticsProjectionVersion: projection.statisticsProjectionVersion,
        projectionHash,
        sharedStatisticsHash,
        statisticsId,
        playerMapping: projection.participants.map((participant) => ({
          playerId: participant.playerId,
          canonicalPlayerId: participant.canonicalPlayerId,
          replaySlot: participant.replaySlot,
          displayName: participant.displayName,
        })),
        comparisonStatus,
        comparedWithReplaySourceId: activeSourceId,
        ingestedBy: actor.playerId,
        ingestedAt: now,
      });

      if (!statisticsSnapshot.exists) {
        transaction.create(statisticsRef, {
          ...projection,
          matchId,
          gameId,
          statisticsId,
          replaySourceId,
          projectionHash,
          sharedStatisticsHash,
          createdAt: now,
        });
      }

      const gamePatch: Record<string, unknown> = {
        replaySourceCount,
        canonicalStatisticsState: "COMPLETE",
        canonicalStatisticsProjectionVersion: projection.statisticsProjectionVersion,
        replaySelectionPolicyVersion: REPLAY_SOURCE_SELECTION_POLICY_VERSION,
        canonicalStatisticsUpdatedAt: now,
        updatedAt: now,
      };

      if (selectedAsActive) {
        gamePatch.activeCanonicalReplaySourceId = replaySourceId;
        gamePatch.activeCanonicalStatisticsId = statisticsId;
        gamePatch.activeCanonicalStatisticsHash = sharedStatisticsHash;
      }

      transaction.update(gameRef, gamePatch);

      writeAdminAudit(transaction, {
        actorUid: actor.authUid,
        actorPlayerId: actor.playerId,
        action: "CANONICAL_BATTLE_STATISTICS_INGESTED",
        targetType: "GAME",
        targetId: `${matchId}/${gameId}`,
        after: {
          replaySourceId,
          statisticsId,
          projectionHash,
          sharedStatisticsHash,
          comparisonStatus,
          selectedAsActive,
          replaySourceCount,
          selectionPolicyVersion: REPLAY_SOURCE_SELECTION_POLICY_VERSION,
        },
      });

      return {
        alreadyIngested: false,
        selectedAsActive,
        comparisonStatus,
        replaySourceCount,
      };
    });

    return {
      success: true,
      matchId,
      gameId,
      replaySourceId,
      statisticsId,
      projectionHash,
      sharedStatisticsHash,
      contractVersion: CANONICAL_BATTLE_STATISTICS_CONTRACT_VERSION,
      statisticsProjectionVersion: projection.statisticsProjectionVersion,
      selectionPolicyVersion: REPLAY_SOURCE_SELECTION_POLICY_VERSION,
      ...transactionResult,
    };
  },
);
