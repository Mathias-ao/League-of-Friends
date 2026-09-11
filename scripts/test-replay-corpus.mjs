import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { createGunzip } from "node:zlib";

const fixtureArg = process.argv[2] ?? "replay-tools/fixtures";
const outputArg = process.argv[3] ?? "replay-corpus-output";
const fixturePath = path.resolve(fixtureArg);
const outputRoot = path.resolve(outputArg);
const parserPath = path.resolve("replay-tools/parse_replay.py");
const pythonCommand = process.env.PYTHON ?? "python";

async function sha256(filePath) {
  return await new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function countJsonlGzip(filePath, onRecord = null) {
  return await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath).pipe(createGunzip());
    let buffer = "";
    let count = 0;
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      buffer += chunk;
      let newline;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (!line.trim()) continue;
        count += 1;
        if (onRecord) {
          try {
            onRecord(JSON.parse(line));
          } catch (error) {
            reject(new Error(`Invalid JSONL in ${filePath} line ${count}: ${error.message}`));
            stream.destroy();
            return;
          }
        }
      }
    });
    stream.on("error", reject);
    stream.on("end", () => {
      if (buffer.trim()) {
        count += 1;
        if (onRecord) onRecord(JSON.parse(buffer));
      }
      resolve(count);
    });
  });
}

function sumValues(record) {
  return Object.values(record ?? {}).reduce((sum, value) => sum + Number(value ?? 0), 0);
}

function expectedPlayersFromFilename(fileName) {
  const stem = path.parse(fileName).name.toLowerCase();
  const match = stem.match(/^(\d+)v\1$/);
  if (!match) return null;
  return Number(match[1]) * 2;
}

function check(condition, code, message, errors, warnings, severity = "error") {
  if (condition) return;
  (severity === "error" ? errors : warnings).push({ code, message });
}

async function validateArtifact(bundleDir, ref, label, errors) {
  const filePath = path.join(bundleDir, ref.uri);
  try {
    const stat = await fs.stat(filePath);
    check(stat.isFile(), `${label.toUpperCase()}_NOT_FILE`, `${label} artifact is not a file.`, errors, []);
    const digest = await sha256(filePath);
    check(digest === ref.sha256, `${label.toUpperCase()}_HASH_MISMATCH`, `${label} SHA-256 mismatch.`, errors, []);
    const count = await countJsonlGzip(filePath);
    check(count === ref.recordCount, `${label.toUpperCase()}_COUNT_MISMATCH`, `${label} record count ${count} != manifest ${ref.recordCount}.`, errors, []);
    return { filePath, byteLength: stat.size, recordCount: count };
  } catch (error) {
    errors.push({ code: `${label.toUpperCase()}_READ_FAILED`, message: String(error.message ?? error) });
    return null;
  }
}

async function runFixture(filePath) {
  const fileName = path.basename(filePath);
  const stem = path.parse(fileName).name;
  const fixtureOut = path.join(outputRoot, stem);
  const adapterPath = path.join(fixtureOut, "adapter.json");
  const bundleDir = path.join(fixtureOut, "canonical");
  await fs.mkdir(bundleDir, { recursive: true });

  const args = [parserPath, filePath, "--out", adapterPath, "--canonical-dir", bundleDir, "--pretty"];
  const proc = spawnSync(pythonCommand, args, { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
  if (proc.status !== 0) {
    return {
      fileName,
      passed: false,
      parseFailed: true,
      errors: [{ code: "PARSER_EXIT", message: (proc.stderr || proc.stdout || `exit ${proc.status}`).trim() }],
      warnings: [],
    };
  }

  const adapter = JSON.parse(await fs.readFile(adapterPath, "utf8"));
  const manifestPath = path.join(bundleDir, "canonical-replay.json");
  const canonical = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const errors = [];
  const warnings = [];

  check(adapter.schemaVersion === "LOF_MGZ_FAST_ADAPTER_V3", "ADAPTER_SCHEMA", `Unexpected adapter schema ${adapter.schemaVersion}.`, errors, warnings);
  check(canonical.schemaVersion === "1.0.0", "CANONICAL_SCHEMA", `Unexpected canonical schema ${canonical.schemaVersion}.`, errors, warnings);
  check(adapter.sourceHash === canonical.source.sha256, "SOURCE_HASH", "Adapter and canonical source hashes differ.", errors, warnings);
  check(/^[a-f0-9]{64}$/.test(adapter.sourceHash ?? ""), "SOURCE_HASH_FORMAT", "Source hash is not SHA-256 hex.", errors, warnings);
  check(Array.isArray(adapter.sourcePlayers) && adapter.sourcePlayers.length >= 2 && adapter.sourcePlayers.length <= 8, "PLAYER_COUNT_RANGE", `Expected 2-8 players, got ${adapter.sourcePlayers?.length}.`, errors, warnings);
  check(canonical.participants.length === adapter.sourcePlayers.length, "PARTICIPANT_COUNT", "Canonical participant count differs from adapter player count.", errors, warnings);

  const expectedPlayers = expectedPlayersFromFilename(fileName);
  if (expectedPlayers != null) {
    check(adapter.sourcePlayers.length === expectedPlayers, "FIXTURE_PLAYER_COUNT", `${fileName} implies ${expectedPlayers} players but parser found ${adapter.sourcePlayers.length}.`, errors, warnings);
  }

  const body = adapter.payload?.body ?? {};
  const map = canonical.initialState?.map ?? {};
  const factStore = canonical.factStore ?? {};
  const operationCount = sumValues(factStore.operationCounts);
  check(body.bodyParseComplete === true, "BODY_INCOMPLETE", "Parser did not reach the end of the body.", errors, warnings);
  check(Number(map.width) > 0 && Number(map.height) > 0, "MAP_DIMENSIONS", `Invalid map dimensions ${map.width}x${map.height}.`, errors, warnings);
  check(map.terrainStore.recordCount === Number(map.width) * Number(map.height), "TERRAIN_CELL_COUNT", `Terrain records ${map.terrainStore.recordCount} != ${map.width}x${map.height}.`, errors, warnings);
  check(factStore.recordCount === operationCount, "OPERATION_RECONCILIATION", `Fact records ${factStore.recordCount} != operation-count sum ${operationCount}.`, errors, warnings);
  check(Number(factStore.operationCounts?.ACTION ?? 0) === Number(body.totalActions ?? 0), "ACTION_RECONCILIATION", "ACTION operation count differs from totalActions.", errors, warnings);
  check(Number(factStore.operationCounts?.SYNC ?? 0) === Number(body.totalSyncOperations ?? 0), "SYNC_RECONCILIATION", "SYNC operation count differs from totalSyncOperations.", errors, warnings);
  check(Number(factStore.operationCounts?.VIEWLOCK ?? 0) === Number(body.cameraPointsTotal ?? 0), "CAMERA_RECONCILIATION", "VIEWLOCK count differs from cameraPointsTotal.", errors, warnings);
  check(Number(factStore.operationCounts?.CHAT ?? 0) === Number(body.chatOperationsTotal ?? 0), "CHAT_RECONCILIATION", "CHAT count differs from chatOperationsTotal.", errors, warnings);

  const unknownActions = sumValues(body.unknownActionCounts);
  if (unknownActions > 0) {
    warnings.push({ code: "UNKNOWN_ACTIONS", message: `${unknownActions} ACTION operations were not decoded; affected features must be treated as degraded.` });
  }
  if (Number(body.decodeCoveragePercent ?? 0) < 99.9) {
    warnings.push({ code: "DECODE_COVERAGE", message: `Action decode coverage is ${body.decodeCoveragePercent}%.` });
  }

  const terrainRef = map.terrainStore.chunks[0];
  const objectRef = canonical.initialState.objectStore.chunks[0];
  const factRef = factStore.chunks[0];
  const terrainArtifact = await validateArtifact(bundleDir, terrainRef, "terrain", errors);
  const objectArtifact = await validateArtifact(bundleDir, objectRef, "objects", errors);
  const factArtifact = await validateArtifact(bundleDir, factRef, "facts", errors);

  const startingObjectCounts = {};
  const startingTownCenters = {};
  if (objectArtifact) {
    await countJsonlGzip(objectArtifact.filePath, (record) => {
      const owner = record?.payload?.ownerPlayerId;
      if (owner == null || owner < 1 || owner > 8) return;
      startingObjectCounts[owner] = (startingObjectCounts[owner] ?? 0) + 1;
      // AoE2DE raw object id 109 is Town Center. Diagnostic only; not a canonical classifier.
      if (record?.payload?.objectId === 109) startingTownCenters[owner] = (startingTownCenters[owner] ?? 0) + 1;
    });
  }

  const producerAttributed = (body.productionEvents ?? []).filter((event) => Array.isArray(event.producerObjectIds) && event.producerObjectIds.length > 0).length;
  const researchAttributed = (body.researchEvents ?? []).filter((event) => Array.isArray(event.producerObjectIds) && event.producerObjectIds.length > 0).length;
  const buildBuilderAttributed = (body.buildEvents ?? []).filter((event) => Array.isArray(event.builderObjectIds) && event.builderObjectIds.length > 0).length;
  const signedQueueEvents = (body.productionEvents ?? []).filter((event) => event.signedAmount != null).length;
  const negativeQueueEvents = (body.productionEvents ?? []).filter((event) => Number(event.signedAmount) < 0).length;

  const result = {
    fileName,
    passed: errors.length === 0,
    parseFailed: false,
    replay: adapter.payload?.replay ?? {},
    players: adapter.sourcePlayers.length,
    durationSeconds: Math.round(Number(body.durationMs ?? 0) / 1000),
    map: {
      width: map.width,
      height: map.height,
      terrainRecords: terrainArtifact?.recordCount ?? null,
      initialObjects: objectArtifact?.recordCount ?? null,
      startingObjectCounts,
      startingTownCenters,
    },
    operations: {
      ...factStore.operationCounts,
      facts: factArtifact?.recordCount ?? factStore.recordCount,
      decodeCoveragePercent: body.decodeCoveragePercent,
      unknownActions,
    },
    evidence: {
      builds: body.buildEvents?.length ?? 0,
      walls: body.wallEvents?.length ?? 0,
      queueCommands: body.productionEvents?.length ?? 0,
      signedQueueEvents,
      negativeQueueEvents,
      producerAttributedQueueCommands: producerAttributed,
      researchCommands: body.researchEvents?.length ?? 0,
      producerAttributedResearchCommands: researchAttributed,
      builderAttributedBuildCommands: buildBuilderAttributed,
      marketCommands: body.marketEvents?.length ?? 0,
      tributeCommands: body.tributeEvents?.length ?? 0,
      diplomacyChanges: body.diplomacyEvents?.length ?? 0,
      flares: body.flareEvents?.length ?? 0,
      resignations: body.resignations?.length ?? 0,
    },
    warnings: [...warnings, ...(adapter.warnings ?? []).map((message) => ({ code: "PARSER_WARNING", message }))],
    errors,
    output: { adapterPath, manifestPath },
  };

  return result;
}

function markdown(results) {
  const rows = results.map((r) => {
    if (r.parseFailed) return `| ${r.fileName} | FAIL | - | - | - | - | parser failed |`;
    const e = r.evidence;
    const notes = [...r.errors, ...r.warnings].map((item) => item.code).join(", ") || "clean";
    return `| ${r.fileName} | ${r.passed ? "PASS" : "FAIL"} | ${r.players} | ${r.durationSeconds}s | ${r.operations.ACTION ?? 0}/${r.operations.decodeCoveragePercent}% | ${e.queueCommands}/${e.producerAttributedQueueCommands} | ${notes} |`;
  });
  return [
    "# Age of Friends replay corpus test",
    "",
    "| Fixture | Status | Players | Duration | Actions / decode | Queue / producer-attributed | Notes |",
    "|---|---:|---:|---:|---:|---:|---|",
    ...rows,
    "",
    "## Per-fixture diagnostics",
    "",
    ...results.flatMap((r) => [
      `### ${r.fileName}`,
      "",
      r.parseFailed
        ? `Parser failure: ${r.errors.map((x) => x.message).join("; ")}`
        : [
            `Map: ${r.map.width}×${r.map.height}; initial objects: ${r.map.initialObjects}.`,
            `Starting TC diagnostic by player: ${JSON.stringify(r.map.startingTownCenters)}.`,
            `Builds ${r.evidence.builds}, walls ${r.evidence.walls}, queues ${r.evidence.queueCommands}, research ${r.evidence.researchCommands}.`,
            `Diplomacy changes ${r.evidence.diplomacyChanges}, tribute ${r.evidence.tributeCommands}, flares ${r.evidence.flares}.`,
            `Queue producer attribution ${r.evidence.producerAttributedQueueCommands}/${r.evidence.queueCommands}; research producer attribution ${r.evidence.producerAttributedResearchCommands}/${r.evidence.researchCommands}.`,
            `Negative/signed queue commands ${r.evidence.negativeQueueEvents}/${r.evidence.signedQueueEvents}.`,
          ].join("  \n"),
      "",
    ]),
  ].join("\n");
}

try {
  const preflight = spawnSync(pythonCommand, ["-c", "import importlib.metadata; import mgz.fast; print(importlib.metadata.version(\"mgz-fast\"))"], { encoding: "utf8" });
  if (preflight.status !== 0) {
    throw new Error(`Python preflight failed. Install replay-tools/requirements.txt in the active Python environment.\n${(preflight.stderr || preflight.stdout || "").trim()}`);
  }
  const mgzFastVersion = (preflight.stdout || "").trim();
  console.log(`mgz-fast: ${mgzFastVersion}`);

  await fs.mkdir(outputRoot, { recursive: true });
  const stat = await fs.stat(fixturePath);
  let fixtureFiles = [];
  if (stat.isDirectory()) {
    fixtureFiles = (await fs.readdir(fixturePath))
      .filter((name) => name.toLowerCase().endsWith(".aoe2record"))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((name) => path.join(fixturePath, name));
  } else {
    fixtureFiles = [fixturePath];
  }

  if (fixtureFiles.length === 0) throw new Error(`No .aoe2record fixtures found at ${fixturePath}.`);

  console.log(`Age of Friends replay corpus: ${fixtureFiles.length} fixture(s)`);
  console.log(`Parser: ${parserPath}`);
  console.log(`Output: ${outputRoot}`);

  const results = [];
  for (const file of fixtureFiles) {
    process.stdout.write(`  ${path.basename(file)} ... `);
    const result = await runFixture(file);
    results.push(result);
    console.log(result.passed ? "PASS" : "FAIL");
    if (result.errors?.length) {
      for (const error of result.errors) console.log(`    ERROR ${error.code}: ${error.message}`);
    }
    if (result.warnings?.length) {
      for (const warning of result.warnings) console.log(`    WARN  ${warning.code}: ${warning.message}`);
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    fixturePath,
    parserPath,
    passed: results.every((result) => result.passed),
    results,
  };
  const jsonPath = path.join(outputRoot, "corpus-summary.json");
  const mdPath = path.join(outputRoot, "corpus-summary.md");
  await fs.writeFile(jsonPath, JSON.stringify(summary, null, 2) + "\n", "utf8");
  await fs.writeFile(mdPath, markdown(results) + "\n", "utf8");

  console.log(`\nSummary: ${jsonPath}`);
  console.log(`Report:  ${mdPath}`);
  if (!summary.passed) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
}
