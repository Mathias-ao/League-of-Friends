import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import { callableOptions } from "../../config/runtime.js";
import { collections } from "../../domain/collections.js";
import {
  TOWNBELL_REPORT_CONTRACT_VERSION,
  TOWNBELL_REPORT_SCHEMA_VERSION,
  TownBellReportValidationError,
  canonicalTownBellJson,
  validateTownBellReportIngestion,
  type TownBellReportIngestionInput,
} from "../../engines/townBellReportIngestion.js";
import { writeAdminAudit } from "../../services/audit.js";
import { reserveIdempotencyKey } from "../../services/idempotency.js";

const MAX_STORED_REPORT_BASE64_CHARS = 600_000;

interface IngestTownBellReportInput extends TownBellReportIngestionInput {
  requestId: string;
  matchId: string;
  gameId: string;
}

interface GameForTownBellReport {
  activeTownBellReportId?: string | null;
  townBellReportRevision?: number;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export const adminIngestTownBellReport = onCall<IngestTownBellReportInput>(callableOptions, async (request) => {
  const actor = await requireAdmin(request);
  const { requestId, matchId, gameId } = request.data;

  if (!requestId || !matchId || !gameId) {
    throw new HttpsError("invalid-argument", "requestId, matchId and gameId are required.");
  }

  let ingestion;
  try {
    ingestion = validateTownBellReportIngestion(request.data);
  } catch (error) {
    if (error instanceof TownBellReportValidationError) {
      throw new HttpsError("invalid-argument", error.message);
    }
    throw error;
  }

  const reportHash = sha256(ingestion.canonicalJson);
  const catalogHash = sha256(canonicalTownBellJson(ingestion.catalog));
  const reportGzip = gzipSync(Buffer.from(ingestion.canonicalJson, "utf8"), { level: 9 });
  const reportGzipBase64 = reportGzip.toString("base64");

  if (reportGzipBase64.length > MAX_STORED_REPORT_BASE64_CHARS) {
    throw new HttpsError(
      "invalid-argument",
      "TownBell report is too large for the TOWNBELL_REPORT_V1 Firestore storage envelope after compression.",
    );
  }

  const townBellReportId = reportHash;
  const matchRef = db.collection(collections.matches).doc(matchId);
  const gameRef = matchRef.collection("games").doc(gameId);
  const reportRef = gameRef.collection("townBellReports").doc(townBellReportId);

  const result = await db.runTransaction(async (transaction) => {
    const [matchSnapshot, gameSnapshot, reportSnapshot] = await Promise.all([
      transaction.get(matchRef),
      transaction.get(gameRef),
      transaction.get(reportRef),
    ]);

    if (!matchSnapshot.exists) throw new HttpsError("not-found", "Match not found.");
    if (!gameSnapshot.exists) throw new HttpsError("not-found", "Game not found.");

    const game = gameSnapshot.data() as GameForTownBellReport;
    if (reportSnapshot.exists) {
      if (game.activeTownBellReportId === townBellReportId) {
        return {
          townBellReportId,
          townBellReportRevision: Number(game.townBellReportRevision ?? 1),
          alreadyIngested: true,
          supersededTownBellReportId: null,
        };
      }
      throw new HttpsError(
        "failed-precondition",
        "This TownBell report was previously ingested but is no longer the active report revision.",
      );
    }

    await reserveIdempotencyKey(
      transaction,
      requestId,
      "adminIngestTownBellReport",
      actor.authUid,
    );

    const now = Timestamp.now();
    const previousReportId = game.activeTownBellReportId ?? null;
    const revision = Number(game.townBellReportRevision ?? 0) + 1;
    const canonicalBytes = Buffer.byteLength(ingestion.canonicalJson, "utf8");

    transaction.create(reportRef, {
      contractVersion: TOWNBELL_REPORT_CONTRACT_VERSION,
      townBellSchemaVersion: TOWNBELL_REPORT_SCHEMA_VERSION,
      matchId,
      gameId,
      townBellReportRevision: revision,
      reportHash,
      catalogHash,
      source: {
        type: "TOWNBELL_JSON_REPORT",
        sourceFileName: ingestion.sourceFileName,
      },
      townBell: {
        guid: ingestion.guid,
        durationMs: ingestion.durationMs,
        saveVersion: ingestion.saveVersion,
        gameBuild: ingestion.gameBuild,
        entityDataVersion: ingestion.entityDataVersion,
        playedAtUnix: ingestion.playedAtUnix,
        povNumber: ingestion.povNumber,
        degraded: ingestion.degraded,
      },
      reportedPlayers: ingestion.reportedPlayers,
      storage: {
        encoding: "canonical-json+gzip+base64",
        canonicalBytes,
        gzipBytes: reportGzip.byteLength,
        base64Chars: reportGzipBase64.length,
        reportGzipBase64,
      },
      interpretationState: "NOT_STARTED",
      inferredStatisticsState: "NOT_STARTED",
      supersedesTownBellReportId: previousReportId,
      importedBy: actor.playerId,
      importedAt: now,
    });

    transaction.update(gameRef, {
      launchStatisticsSource: {
        type: "TOWNBELL_JSON_REPORT",
        activeReportId: townBellReportId,
        reportHash,
        catalogHash,
        townBellSchemaVersion: TOWNBELL_REPORT_SCHEMA_VERSION,
        townBellGuid: ingestion.guid,
        importedAt: now,
      },
      activeTownBellReportId: townBellReportId,
      townBellReportRevision: revision,
      townBellIngestionState: "COMPLETE",
      townBellInterpretationState: "NOT_STARTED",
      townBellInferredStatisticsState: "NOT_STARTED",
      townBellReportUpdatedAt: now,
      updatedAt: now,
    });

    writeAdminAudit(transaction, {
      actorUid: actor.authUid,
      actorPlayerId: actor.playerId,
      action: previousReportId ? "TOWNBELL_REPORT_REPLACED" : "TOWNBELL_REPORT_INGESTED",
      targetType: "GAME",
      targetId: `${matchId}/${gameId}`,
      before: previousReportId ? { activeTownBellReportId: previousReportId } : null,
      after: {
        activeTownBellReportId: townBellReportId,
        townBellReportRevision: revision,
        reportHash,
        catalogHash,
        townBellSchemaVersion: TOWNBELL_REPORT_SCHEMA_VERSION,
        townBellGuid: ingestion.guid,
        participantCount: ingestion.reportedPlayers.length,
      },
    });

    return {
      townBellReportId,
      townBellReportRevision: revision,
      alreadyIngested: false,
      supersededTownBellReportId: previousReportId,
    };
  });

  return {
    success: true,
    matchId,
    gameId,
    contractVersion: TOWNBELL_REPORT_CONTRACT_VERSION,
    townBellSchemaVersion: TOWNBELL_REPORT_SCHEMA_VERSION,
    townBellGuid: ingestion.guid,
    reportHash,
    catalogHash,
    participantCount: ingestion.reportedPlayers.length,
    ingestionState: "COMPLETE",
    interpretationState: "NOT_STARTED",
    inferredStatisticsState: "NOT_STARTED",
    ...result,
  };
});
