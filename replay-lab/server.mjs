import http from "node:http";
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import { createGunzip } from "node:zlib";
import readline from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { normalizeTownBellControl, safeFileName, semanticDiff, unresolvedEntities } from "./lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const PUBLIC = path.join(HERE, "public");
const WORK_ROOT = path.resolve(process.env.AOF_REPLAY_LAB_HOME || path.join(ROOT, ".replay-lab"));
const PYTHON = process.env.PYTHON || "python";
const PORT = Number(process.env.AOF_REPLAY_LAB_PORT || 4317);
const HOST = process.env.AOF_REPLAY_LAB_HOST || "127.0.0.1";
const MAX_UPLOAD_BYTES = Number(process.env.AOF_REPLAY_LAB_MAX_BYTES || 128 * 1024 * 1024);
const ANALYSIS_DATASET_VERSION = "AOF_REPLAY_ANALYSIS_V3";

const PARSER = path.join(ROOT, "replay-tools", "parse_replay.py");
const ANALYSIS_DATASET = path.join(ROOT, "replay-tools", "analysis_dataset.py");
const CANONICAL_RUN = path.join(ROOT, "replay-tools", "canonical_run.py");
const STATISTICS = path.join(ROOT, "replay-tools", "statistics_projector.py");

await fs.mkdir(WORK_ROOT, { recursive: true });

function json(res, status, value) {
  const body = Buffer.from(JSON.stringify(value, null, 2));
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": body.length,
    "cache-control": "no-store",
  });
  res.end(body);
}

async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(file, value) {
  await fs.writeFile(file, JSON.stringify(value, null, 2) + "\n", "utf8");
}

async function readJsonBody(req, maxBytes = 16 * 1024 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) throw new Error(`JSON upload exceeds ${maxBytes} byte lab limit`);
    chunks.push(chunk);
  }
  if (!total) throw new Error("Empty JSON upload");
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function fileExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

function roundedMs(started) {
  return Math.round((performance.now() - started) * 1000) / 1000;
}

function runDir(id) {
  if (!/^[a-zA-Z0-9._-]+$/.test(id)) throw new Error("Invalid run id");
  return path.join(WORK_ROOT, id);
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error((stderr || stdout || `${command} exited ${code}`).trim()));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function receiveUpload(req, destination) {
  const handle = await fs.open(destination, "wx");
  let total = 0;
  try {
    for await (const chunk of req) {
      total += chunk.length;
      if (total > MAX_UPLOAD_BYTES) throw new Error(`Replay exceeds ${MAX_UPLOAD_BYTES} byte lab limit`);
      await handle.write(chunk);
    }
  } finally {
    await handle.close();
  }
  if (!total) throw new Error("Empty replay upload");
  return total;
}

function uniqueWarnings(...collections) {
  const seen = new Set();
  const result = [];
  for (const collection of collections) {
    for (const item of collection ?? []) {
      const value = typeof item === "string" ? { message: item } : item;
      const key = JSON.stringify(value);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(value);
      }
    }
  }
  return result;
}

async function loadRun(id) {
  const directory = runDir(id);
  const [metadata, adapter, canonical, extraction, statistics, coverage, comparison, townBellControl] = await Promise.all([
    readJson(path.join(directory, "metadata.json")),
    readJson(path.join(directory, "adapter.json")),
    readJson(path.join(directory, "canonical", "canonical-replay.json")),
    readJson(path.join(directory, "canonical", "extraction-manifest.json")),
    readJson(path.join(directory, "statistics-current.json")),
    readJson(path.join(directory, "canonical", "coverage-report.json")),
    readJson(path.join(directory, "comparison-latest.json")),
    readJson(path.join(directory, "townbell-control.json")),
  ]);
  if (!metadata) return null;

  const unknownActions = canonical?.factStore?.unknownActionCounts ?? {};
  const unresolved = unresolvedEntities(statistics);
  return {
    metadata,
    replay: adapter?.payload?.replay ?? null,
    settings: adapter?.payload?.settings ?? null,
    players: adapter?.payload?.players ?? [],
    canonical,
    canonicalRun: extraction,
    statistics,
    comparison,
    townBellControl,
    diagnostics: {
      compatibility: canonical?.source?.compatibility ?? null,
      unknownActions,
      unknownActionCount: Object.values(unknownActions).reduce((sum, value) => sum + Number(value || 0), 0),
      unresolvedEntities: unresolved,
      warnings: uniqueWarnings(adapter?.warnings, canonical?.warnings, coverage?.warnings, statistics?.warnings),
      coverage,
    },
  };
}

async function listRuns() {
  const names = await fs.readdir(WORK_ROOT, { withFileTypes: true });
  const result = [];
  for (const entry of names) {
    if (!entry.isDirectory()) continue;
    const metadata = await readJson(path.join(WORK_ROOT, entry.name, "metadata.json"));
    if (metadata) result.push(metadata);
  }
  return result.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

async function extractReplay(req) {
  const encodedName = String(req.headers["x-aof-filename"] || "replay.aoe2record");
  let decodedName;
  try { decodedName = decodeURIComponent(encodedName); } catch { decodedName = encodedName; }
  const fileName = safeFileName(decodedName);
  if (!fileName.toLowerCase().endsWith(".aoe2record")) throw new Error("Replay Lab accepts .aoe2record files only");

  const id = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const directory = runDir(id);
  const canonical = path.join(directory, "canonical");
  const source = path.join(directory, fileName);
  const adapter = path.join(directory, "adapter.json");
  const parserTimingsPath = path.join(directory, "parser-timings.json");
  const analysis = path.join(directory, "analysis.json");
  const statistics = path.join(directory, "statistics-current.json");
  const totalStarted = performance.now();
  await fs.mkdir(directory, { recursive: false });

  try {
    const uploadStarted = performance.now();
    const byteLength = await receiveUpload(req, source);
    const uploadMs = roundedMs(uploadStarted);

    await runCommand(PYTHON, [
      PARSER, source,
      "--canonical-dir", canonical,
      "--out", adapter,
      "--pretty",
      "--timings-out", parserTimingsPath,
      "--seal-mode", "fast",
    ]);
    const [parsed, parserTimings] = await Promise.all([
      readJson(adapter),
      readJson(parserTimingsPath, {}),
    ]);

    const analysisStarted = performance.now();
    await runCommand(PYTHON, [
      ANALYSIS_DATASET, canonical,
      "--out", analysis,
      "--already-sealed",
    ]);
    const analysisDatasetMs = roundedMs(analysisStarted);
    const analysisDocument = await readJson(analysis);

    const statisticsStarted = performance.now();
    await runCommand(PYTHON, [STATISTICS, "--analysis", analysis, "--out", statistics]);
    const statisticsProjectionMs = roundedMs(statisticsStarted);

    const parseCanonicalWriteMs =
      Number(parserTimings?.sourcePreflightHeaderMs || 0) +
      Number(parserTimings?.replayDecodeCanonicalWriteMs || 0);

    const metadata = {
      id,
      fileName,
      createdAt: new Date().toISOString(),
      byteLength,
      sourceHash: parsed?.sourceHash ?? null,
      parserName: parsed?.parserName ?? null,
      parserVersion: parsed?.parserVersion ?? null,
      adapterSchemaVersion: parsed?.schemaVersion ?? null,
      statisticsRevision: 1,
      status: "ready",
      statisticsUpdatedAt: new Date().toISOString(),
      analysisDataset: {
        fileName: "analysis.json",
        schemaVersion: analysisDocument?.schemaVersion ?? null,
        datasetVersion: analysisDocument?.datasetVersion ?? null,
        summary: analysisDocument?.summary ?? null,
      },
      timings: {
        uploadMs,
        replayParseCanonicalWriteMs: Math.round(parseCanonicalWriteMs * 1000) / 1000,
        canonicalSealMs: Number(parserTimings?.canonicalSealMs || 0),
        canonicalSealMode: parserTimings?.canonicalSealMode ?? "unknown",
        canonicalVerificationMs: Number(parserTimings?.canonicalVerificationMs || 0),
        analysisDatasetMs,
        statisticsProjectionMs,
        totalMs: roundedMs(totalStarted),
        parserDetail: parserTimings,
      },
    };
    const extraction = await readJson(path.join(canonical, "extraction-manifest.json"));
    metadata.canonicalState = extraction?.state ?? null;
    await writeJson(path.join(directory, "metadata.json"), metadata);
    return id;
  } finally {
    // The browser upload is a disposable local copy. Canonical evidence remains.
    await fs.rm(source, { force: true });
  }
}

async function recalculate(id) {
  const directory = runDir(id);
  const metadataPath = path.join(directory, "metadata.json");
  const metadata = await readJson(metadataPath);
  if (!metadata) throw Object.assign(new Error("Run not found"), { statusCode: 404 });

  const current = path.join(directory, "statistics-current.json");
  const canonical = path.join(directory, "canonical");
  const analysis = path.join(directory, "analysis.json");
  const before = await readJson(current);
  const previousRevision = Number(metadata.statisticsRevision || 0);
  const history = path.join(directory, "history");
  await fs.mkdir(history, { recursive: true });
  if (before) await fs.copyFile(current, path.join(history, `statistics-r${previousRevision}.json`));

  let analysisDatasetMs = 0;
  const existingAnalysis = await readJson(analysis);
  const rebuildAnalysis = (
    !existingAnalysis
    || existingAnalysis?.datasetVersion !== ANALYSIS_DATASET_VERSION
  );
  if (rebuildAnalysis) {
    const analysisStarted = performance.now();
    await runCommand(PYTHON, [
      ANALYSIS_DATASET, canonical,
      "--out", analysis,
      "--already-sealed",
    ]);
    analysisDatasetMs = roundedMs(analysisStarted);
    const analysisDocument = await readJson(analysis);
    metadata.analysisDataset = {
      fileName: "analysis.json",
      schemaVersion: analysisDocument?.schemaVersion ?? null,
      datasetVersion: analysisDocument?.datasetVersion ?? null,
      summary: analysisDocument?.summary ?? null,
      migratedFromLegacyRun: !existingAnalysis,
      rebuiltForDatasetVersion: existingAnalysis?.datasetVersion ?? null,
    };
  }

  const next = path.join(directory, "statistics-next.json");
  await fs.rm(next, { force: true });
  const statisticsStarted = performance.now();
  await runCommand(PYTHON, [STATISTICS, "--analysis", analysis, "--out", next]);
  const statisticsProjectionMs = roundedMs(statisticsStarted);
  const after = await readJson(next);
  const changes = semanticDiff(before, after);
  await fs.rename(next, current);

  metadata.statisticsRevision = previousRevision + 1;
  metadata.statisticsUpdatedAt = new Date().toISOString();
  metadata.status = "ready";
  metadata.lastRecalculation = {
    analysisDatasetMs,
    statisticsProjectionMs,
    totalMs: Math.round((analysisDatasetMs + statisticsProjectionMs) * 1000) / 1000,
    replayReparsed: false,
    canonicalRevalidated: false,
    analysisCacheRebuilt: rebuildAnalysis,
  };
  await writeJson(metadataPath, metadata);
  await writeJson(path.join(directory, "comparison-latest.json"), {
    beforeRevision: previousRevision,
    afterRevision: metadata.statisticsRevision,
    generatedAt: metadata.statisticsUpdatedAt,
    changeCount: changes.length,
    truncatedAt: 500,
    changes,
  });
}

async function attachTownBellControl(id, req) {
  const directory = runDir(id);
  const metadataPath = path.join(directory, "metadata.json");
  const metadata = await readJson(metadataPath);
  if (!metadata) throw Object.assign(new Error("Run not found"), { statusCode: 404 });

  const report = await readJsonBody(req);
  const control = normalizeTownBellControl(report);
  const encodedName = String(req.headers["x-aof-filename"] || "townbell-report.json");
  let decodedName;
  try { decodedName = decodeURIComponent(encodedName); } catch { decodedName = encodedName; }

  const aofPlayers = (await readJson(path.join(directory, "adapter.json")))?.payload?.players ?? [];
  const byNumber = new Map(control.players.map((player) => [Number(player.number), player]));
  const playerMatches = aofPlayers.map((player) => {
    const townBell = byNumber.get(Number(player.replaySlot)) ?? null;
    return {
      replaySlot: player.replaySlot,
      aofName: player.name ?? null,
      townBellName: townBell?.name ?? null,
      nameMatches: (
        !player.name || !townBell?.name
          ? null
          : String(player.name).trim().toLowerCase() === String(townBell.name).trim().toLowerCase()
      ),
    };
  });

  const saved = {
    ...control,
    fileName: safeFileName(decodedName),
    attachedAt: new Date().toISOString(),
    playerMatches,
  };
  await writeJson(path.join(directory, "townbell-control.json"), saved);
  metadata.townBellControl = {
    fileName: saved.fileName,
    attachedAt: saved.attachedAt,
    schemaVersion: saved.schemaVersion,
    playerCount: saved.playerCount,
    nameMismatchCount: playerMatches.filter((match) => match.nameMatches === false).length,
  };
  await writeJson(metadataPath, metadata);
}


async function fullAudit(id) {
  const directory = runDir(id);
  const metadataPath = path.join(directory, "metadata.json");
  const metadata = await readJson(metadataPath);
  if (!metadata) throw Object.assign(new Error("Run not found"), { statusCode: 404 });

  const canonical = path.join(directory, "canonical");
  const started = performance.now();
  await runCommand(PYTHON, [CANONICAL_RUN, canonical, "--full-audit"]);
  const durationMs = roundedMs(started);
  const extraction = await readJson(path.join(canonical, "extraction-manifest.json"));
  metadata.canonicalState = extraction?.state ?? null;
  metadata.lastFullAudit = {
    durationMs,
    state: extraction?.state ?? null,
    completedAt: new Date().toISOString(),
  };
  await writeJson(metadataPath, metadata);
}

async function timeline(id, search) {
  const directory = runDir(id);
  const canonicalDir = path.join(directory, "canonical");
  const manifest = await readJson(path.join(canonicalDir, "canonical-replay.json"));
  if (!manifest) throw Object.assign(new Error("Run not found"), { statusCode: 404 });

  const limit = Math.max(1, Math.min(1000, Number(search.get("limit") || 250)));
  const player = search.get("player") ? Number(search.get("player")) : null;
  const action = (search.get("action") || "").trim().toUpperCase();
  const q = (search.get("q") || "").trim().toLowerCase();
  const fromMs = search.get("fromMs") ? Number(search.get("fromMs")) : null;
  const toMs = search.get("toMs") ? Number(search.get("toMs")) : null;
  const includeRaw = search.get("includeRaw") === "1";
  const rows = [];
  let matched = 0;

  outer:
  for (const ref of manifest.factStore?.chunks ?? []) {
    const stream = createReadStream(path.join(canonicalDir, ref.uri)).pipe(createGunzip());
    const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
    for await (const line of lines) {
      const event = JSON.parse(line);
      if (player !== null && event.actorPlayerId !== player) continue;
      if (action && String(event.sourceActionName || event.sourceOperation || "").toUpperCase() !== action) continue;
      if (fromMs !== null && event.timestampMs < fromMs) continue;
      if (toMs !== null && event.timestampMs > toMs) continue;
      if (q && !JSON.stringify(event).toLowerCase().includes(q)) continue;
      matched += 1;
      if (!includeRaw) {
        if (event.payload) {
          event.payload = { ...event.payload };
          delete event.payload._rawOperationBase64;
        }
        if (event.decode) {
          event.decode = { ...event.decode };
          delete event.decode.unknownBytesBase64;
        }
      }
      rows.push(event);
      if (rows.length >= limit) {
        lines.close();
        stream.destroy();
        break outer;
      }
    }
  }
  return { rows, matchedAtLeast: matched, limit, truncated: rows.length >= limit };
}

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

async function serveStatic(urlPath, res) {
  const requested = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  const file = path.resolve(PUBLIC, requested);
  if (!file.startsWith(PUBLIC + path.sep) && file !== path.join(PUBLIC, "index.html")) return false;
  try {
    const body = await fs.readFile(file);
    res.writeHead(200, {
      "content-type": contentTypes[path.extname(file)] || "application/octet-stream",
      "content-length": body.length,
    });
    res.end(body);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (req.method === "GET" && url.pathname === "/api/health") {
      return json(res, 200, { ok: true, workRoot: WORK_ROOT, python: PYTHON });
    }
    if (req.method === "GET" && url.pathname === "/api/runs") return json(res, 200, await listRuns());
    if (req.method === "POST" && url.pathname === "/api/runs") {
      const id = await extractReplay(req);
      return json(res, 201, await loadRun(id));
    }

    const runMatch = url.pathname.match(/^\/api\/runs\/([^/]+)$/);
    if (runMatch && req.method === "GET") {
      const value = await loadRun(runMatch[1]);
      return value ? json(res, 200, value) : json(res, 404, { error: "Run not found" });
    }

    const townBellMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/townbell$/);
    if (townBellMatch && req.method === "POST") {
      await attachTownBellControl(townBellMatch[1], req);
      return json(res, 200, await loadRun(townBellMatch[1]));
    }

    const recalcMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/recalculate$/);
    if (recalcMatch && req.method === "POST") {
      await recalculate(recalcMatch[1]);
      return json(res, 200, await loadRun(recalcMatch[1]));
    }

    const auditMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/audit$/);
    if (auditMatch && req.method === "POST") {
      await fullAudit(auditMatch[1]);
      return json(res, 200, await loadRun(auditMatch[1]));
    }

    const timelineMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/timeline$/);
    if (timelineMatch && req.method === "GET") {
      return json(res, 200, await timeline(timelineMatch[1], url.searchParams));
    }

    if (req.method === "GET" && await serveStatic(url.pathname, res)) return;
    json(res, 404, { error: "Not found" });
  } catch (error) {
    console.error(error);
    json(res, error?.statusCode || 500, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`AoF Replay Lab: http://${HOST}:${PORT}`);
  console.log(`Work data: ${WORK_ROOT}`);
  console.log("Development only — no Firebase, no production writes.");
});
