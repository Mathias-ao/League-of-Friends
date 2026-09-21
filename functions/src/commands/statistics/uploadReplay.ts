import { createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireLeaguePlayer } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import { collections } from "../../domain/collections.js";
import type { GamePlayer } from "../../domain/types.js";

const MAX_REPLAY_BYTES = 32 * 1024 * 1024;

interface UploadReplayInput {
  matchId: string;
  gameId: string;
  fileName: string;
  replayBase64: string;
}

interface ReplayBinding {
  sourceNameNormalized: string;
  playerId: string;
}

interface GameForReplayUpload {
  status?: string;
  players?: GamePlayer[];
  replayParticipantBindings?: ReplayBinding[];
  replayStatisticsRevision?: number;
  activeReplayStatisticsId?: string | null;
  replay?: Record<string, unknown> | null;
}

interface WorkerPlayer {
  replaySlot: number;
  sourceName: string;
}

interface WorkerResult {
  sourceHash: string;
  sourceFileName: string;
  parserName: string;
  parserVersion: string;
  adapterSchemaVersion: string;
  canonicalSchemaVersion: string;
  extractionRunId: string;
  sourcePlayers: WorkerPlayer[];
  replayMeta?: Record<string, unknown>;
  warnings?: string[];
  statistics: Record<string, unknown> & {
    statisticsProjectionVersion?: string;
    statisticsSchemaVersion?: string;
    source?: { replaySha256?: string };
  };
  canonicalBundleBase64: string;
  canonicalBundleSha256: string;
  canonicalBundleBytes: number;
}

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeName(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

function requiredText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") throw new HttpsError("invalid-argument", field + " must be a string.");
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    throw new HttpsError("invalid-argument", field + " must contain 1–" + maxLength + " characters.");
  }
  return trimmed;
}

function replayBytes(value: unknown): Buffer {
  if (typeof value !== "string" || !value || value.length > Math.ceil(MAX_REPLAY_BYTES * 4 / 3) + 16) {
    throw new HttpsError("invalid-argument", "Replay payload is missing or too large.");
  }
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
    throw new HttpsError("invalid-argument", "Replay payload is not valid base64.");
  }
  const bytes = Buffer.from(value, "base64");
  if (!bytes.length || bytes.length > MAX_REPLAY_BYTES) {
    throw new HttpsError("invalid-argument", "Replay must contain 1 byte to 32 MiB.");
  }
  return bytes;
}

function workerUrl(): string {
  const value = process.env.REPLAY_WORKER_URL?.replace(/\/+$/, "");
  if (!value) throw new HttpsError("failed-precondition", "Replay worker is not configured.");
  const parsed = new URL(value);
  const loopback = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  if (!process.env.FUNCTIONS_EMULATOR && loopback) {
    throw new HttpsError("failed-precondition", "Loopback replay worker is only allowed in the Functions emulator.");
  }
  if (!loopback && !process.env.REPLAY_WORKER_AUTH_TOKEN) {
    throw new HttpsError("failed-precondition", "Remote replay worker authentication is not configured.");
  }
  return value;
}

async function callWorker(fileName: string, replayBase64: string): Promise<WorkerResult> {
  const headers: Record<string, string> = {"content-type": "application/json"};
  if (process.env.REPLAY_WORKER_AUTH_TOKEN) {
    headers.authorization = "Bearer " + process.env.REPLAY_WORKER_AUTH_TOKEN;
  }
  const response = await fetch(workerUrl() + "/process", {
    method: "POST",
    headers,
    body: JSON.stringify({ fileName, replayBase64 }),
  });
  const text = await response.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new HttpsError("internal", "Replay worker returned an invalid response.");
  }
  if (!response.ok) {
    const message = (payload as {message?: unknown})?.message;
    throw new HttpsError(
      response.status >= 500 ? "internal" : "invalid-argument",
      typeof message === "string" ? message : "Replay worker rejected the recording.",
    );
  }
  return payload as WorkerResult;
}

function bucketName(): string {
  const configured = process.env.REPLAY_BUCKET?.trim();
  if (configured) return configured;
  const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  if (!project) throw new HttpsError("failed-precondition", "Replay evidence bucket is not configured.");
  return project + ".appspot.com";
}

async function verifiedSave(path: string, bytes: Buffer, expectedHash: string, contentType: string): Promise<void> {
  const file = getStorage().bucket(bucketName()).file(path);
  await file.save(bytes, {
    resumable: false,
    metadata: {
      contentType,
      cacheControl: "private, no-store",
    },
  });
  const [stored] = await file.download();
  if (sha256(stored) !== expectedHash) {
    await file.delete({ ignoreNotFound: true });
    throw new HttpsError("internal", "Replay evidence persistence verification failed.");
  }
}

async function resolvePlayerMapping(
  game: GameForReplayUpload,
  workerPlayers: WorkerPlayer[],
): Promise<Array<{ replaySlot: number; sourceName: string; playerId: string }>> {
  const gamePlayerIds = (game.players ?? []).map((player) => player.playerId);
  if (gamePlayerIds.length < 2 || workerPlayers.length !== gamePlayerIds.length) {
    throw new HttpsError("failed-precondition", "Replay participant count does not match this Game.");
  }

  const explicit = new Map(
    (game.replayParticipantBindings ?? []).map((binding) => [binding.sourceNameNormalized, binding.playerId]),
  );
  const playerDocs = await Promise.all(
    gamePlayerIds.map(async (playerId) => ({
      playerId,
      snapshot: await db.collection(collections.players).doc(playerId).get(),
    })),
  );
  const bySteamName = new Map<string, string[]>();
  for (const { playerId, snapshot } of playerDocs) {
    const normalized = String(snapshot.data()?.steamNameNormalized ?? "").trim();
    if (!normalized) continue;
    const list = bySteamName.get(normalized) ?? [];
    list.push(playerId);
    bySteamName.set(normalized, list);
  }

  const used = new Set<string>();
  const mapping = workerPlayers
    .map((source) => {
      const normalized = normalizeName(source.sourceName);
      const explicitPlayer = explicit.get(normalized);
      const candidates = explicitPlayer ? [explicitPlayer] : (bySteamName.get(normalized) ?? []);
      if (candidates.length !== 1 || !gamePlayerIds.includes(candidates[0]) || used.has(candidates[0])) {
        throw new HttpsError(
          "failed-precondition",
          "Replay identity '" + source.sourceName + "' cannot be bound uniquely to this Game.",
        );
      }
      used.add(candidates[0]);
      return {
        replaySlot: source.replaySlot,
        sourceName: source.sourceName,
        playerId: candidates[0],
      };
    })
    .sort((left, right) => left.replaySlot - right.replaySlot);

  if (used.size !== gamePlayerIds.length) {
    throw new HttpsError("failed-precondition", "Replay identity mapping does not cover every Game participant.");
  }
  return mapping;
}

export const uploadReplay = onCall<UploadReplayInput>(
  {
    region: "europe-west1",
    timeoutSeconds: 300,
    memory: "1GiB",
  },
  async (request) => {
    const actor = await requireLeaguePlayer(request);
    const matchId = requiredText(request.data.matchId, "matchId", 200);
    const gameId = requiredText(request.data.gameId, "gameId", 200);
    const fileName = requiredText(request.data.fileName, "fileName", 255);
    if (!/\.(aoe2record|mgz)$/i.test(fileName)) {
      throw new HttpsError("invalid-argument", "Choose an .aoe2record recording.");
    }
    const bytes = replayBytes(request.data.replayBase64);
    const localSourceHash = sha256(bytes);

    const matchRef = db.collection(collections.matches).doc(matchId);
    const gameRef = matchRef.collection("games").doc(gameId);
    const sourceRef = gameRef.collection("replaySources").doc(localSourceHash);
    const [matchSnapshot, gameSnapshot, existingSource] = await Promise.all([
      matchRef.get(),
      gameRef.get(),
      sourceRef.get(),
    ]);
    if (!matchSnapshot.exists) throw new HttpsError("not-found", "Match not found.");
    if (!gameSnapshot.exists) throw new HttpsError("not-found", "Game not found.");

    const game = gameSnapshot.data() as GameForReplayUpload;
    const participant = (game.players ?? []).some((player) => player.playerId === actor.playerId);
    if (!participant && actor.role !== "ADMIN") {
      throw new HttpsError("permission-denied", "Only a Game participant or administrator may upload its replay.");
    }

    if (existingSource.exists && existingSource.data()?.state === "READY") {
      return {
        success: true,
        alreadyProcessed: true,
        matchId,
        gameId,
        statisticsId: localSourceHash,
        sourceHash: localSourceHash,
        playerMapping: existingSource.data()?.playerMapping ?? [],
        resultQualification: existingSource.data()?.resultQualification ?? "UNRESOLVED",
      };
    }

    const worker = await callWorker(fileName, request.data.replayBase64);
    if (!/^[0-9a-f]{64}$/.test(worker.sourceHash) || worker.sourceHash !== localSourceHash) {
      throw new HttpsError("internal", "Replay worker source hash did not match the uploaded recording.");
    }
    if (worker.statistics?.source?.replaySha256 !== localSourceHash) {
      throw new HttpsError("internal", "Statistics provenance does not match the uploaded recording.");
    }

    const bundleBytes = Buffer.from(worker.canonicalBundleBase64, "base64");
    if (bundleBytes.length !== worker.canonicalBundleBytes || sha256(bundleBytes) !== worker.canonicalBundleSha256) {
      throw new HttpsError("internal", "Canonical evidence bundle failed integrity verification.");
    }

    const playerMapping = await resolvePlayerMapping(game, worker.sourcePlayers);
    const statisticsBytes = Buffer.from(JSON.stringify(worker.statistics));
    const statisticsSha256 = sha256(statisticsBytes);
    const prefix = "replay-evidence/" + matchId + "/" + gameId + "/" + localSourceHash;
    const canonicalPath = prefix + "/canonical-bundle.zip";
    const statisticsPath = prefix + "/statistics.json";

    await verifiedSave(canonicalPath, bundleBytes, worker.canonicalBundleSha256, "application/zip");
    await verifiedSave(statisticsPath, statisticsBytes, statisticsSha256, "application/json");

    const transactionResult = await db.runTransaction(async (transaction) => {
      const [freshGameSnapshot, freshSourceSnapshot] = await Promise.all([
        transaction.get(gameRef),
        transaction.get(sourceRef),
      ]);
      if (!freshGameSnapshot.exists) throw new HttpsError("not-found", "Game no longer exists.");
      const freshGame = freshGameSnapshot.data() as GameForReplayUpload;
      const stillParticipant = (freshGame.players ?? []).some((player) => player.playerId === actor.playerId);
      if (!stillParticipant && actor.role !== "ADMIN") {
        throw new HttpsError("permission-denied", "You are no longer a participant in this Game.");
      }
      if (freshSourceSnapshot.exists && freshSourceSnapshot.data()?.state === "READY") {
        return {
          alreadyProcessed: true,
          revision: Number(freshGame.replayStatisticsRevision ?? 1),
        };
      }

      const revision = Number(freshGame.replayStatisticsRevision ?? 0) + 1;
      const now = Timestamp.now();
      transaction.create(sourceRef, {
        state: "READY",
        matchId,
        gameId,
        sourceHash: localSourceHash,
        sourceFileName: fileName,
        sourceBytes: bytes.length,
        replayMeta: worker.replayMeta ?? {},
        playerMapping,
        parser: {
          name: worker.parserName,
          version: worker.parserVersion,
          adapterSchemaVersion: worker.adapterSchemaVersion,
        },
        canonical: {
          schemaVersion: worker.canonicalSchemaVersion,
          extractionRunId: worker.extractionRunId,
          bundlePath: canonicalPath,
          bundleSha256: worker.canonicalBundleSha256,
          bundleBytes: worker.canonicalBundleBytes,
        },
        statistics: {
          path: statisticsPath,
          sha256: statisticsSha256,
          schemaVersion: worker.statistics.statisticsSchemaVersion ?? null,
          projectionVersion: worker.statistics.statisticsProjectionVersion ?? null,
        },
        warnings: worker.warnings ?? [],
        resultQualification: "UNRESOLVED",
        uploadedBy: actor.playerId,
        uploadedAt: now,
        replayStatisticsRevision: revision,
      });

      transaction.update(gameRef, {
        activeReplayStatisticsId: localSourceHash,
        replayStatisticsState: "READY",
        replayStatisticsRevision: revision,
        replayStatisticsUpdatedAt: now,
        replay: {
          ...(freshGame.replay ?? {}),
          status: "PARSED",
          sourceHash: localSourceHash,
          statisticsId: localSourceHash,
          statisticsState: "READY",
        },
        updatedAt: now,
      });
      return { alreadyProcessed: false, revision };
    });

    return {
      success: true,
      alreadyProcessed: transactionResult.alreadyProcessed,
      matchId,
      gameId,
      statisticsId: localSourceHash,
      sourceHash: localSourceHash,
      replayStatisticsRevision: transactionResult.revision,
      playerMapping,
      resultQualification: "UNRESOLVED",
    };
  },
);
