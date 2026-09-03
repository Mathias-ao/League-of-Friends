import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";

const args = process.argv.slice(2);

function readArg(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function readRepeatedArg(name) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === name && args[index + 1]) values.push(args[index + 1]);
  }
  return values;
}

const projectId = readArg("--project");
const matchId = readArg("--match");
const gameId = readArg("--game") ?? "G1";
const replayFile = readArg("--file");
const pythonExecutable = readArg("--python") ?? "python";
const firestorePort = readArg("--firestore-port") ?? "8085";
const dryRun = args.includes("--dry-run");
const manualMappings = readRepeatedArg("--map");

if (!projectId || !matchId || !replayFile) {
  console.error(
    "Usage: node scripts/ingest-replay-file.mjs --project <project-id> --match <match-id> --file <replay.aoe2record> " +
    "[--game G1] [--python python] [--map \"Replay Name=playerId\"] [--dry-run]",
  );
  process.exit(1);
}

const authBase = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const functionsBase = `http://127.0.0.1:5001/${projectId}/europe-west1`;
const firestoreBase = `http://127.0.0.1:${firestorePort}/v1/projects/${projectId}/databases/(default)/documents`;

function normalizeName(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en-US");
}

function parseManualMappings(values) {
  const mappings = new Map();
  for (const value of values) {
    const separator = value.lastIndexOf("=");
    if (separator <= 0 || separator === value.length - 1) {
      throw new Error(`Invalid --map value '${value}'. Expected \"Replay Name=playerId\".`);
    }
    const sourceName = value.slice(0, separator).trim();
    const playerId = value.slice(separator + 1).trim();
    mappings.set(normalizeName(sourceName), playerId);
  }
  return mappings;
}

async function parseResponse(response, label) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} returned non-JSON (${response.status}): ${text}`);
  }
}

async function signIn() {
  const response = await fetch(`${authBase}/accounts:signInWithPassword?key=fake-api-key`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "emperor@league.local",
      password: "league-emulator-admin-only",
      returnSecureToken: true,
    }),
  });
  const payload = await parseResponse(response, "Admin sign-in");
  if (!response.ok) throw new Error(`Admin sign-in failed: ${JSON.stringify(payload)}`);
  return payload.idToken;
}

async function callCallable(name, token, data) {
  const response = await fetch(`${functionsBase}/${name}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ data }),
  });
  const payload = await parseResponse(response, name);
  if (!response.ok || payload.error) throw new Error(`${name} failed: ${JSON.stringify(payload)}`);
  return payload.result;
}

async function readDocument(documentPath, token) {
  const response = await fetch(`${firestoreBase}/${documentPath}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const payload = await parseResponse(response, `Firestore ${documentPath}`);
  if (!response.ok) throw new Error(`Firestore read failed for ${documentPath}: ${JSON.stringify(payload)}`);
  return payload;
}

function stringField(document, field) {
  return document.fields?.[field]?.stringValue ?? null;
}

function gamePlayerIds(document) {
  return (document.fields?.players?.arrayValue?.values ?? [])
    .map((value) => value.mapValue?.fields?.playerId?.stringValue)
    .filter(Boolean);
}

function runParser() {
  const parserPath = path.resolve("replay-tools", "parse_replay.py");
  const replayPath = path.resolve(replayFile);
  const result = spawnSync(pythonExecutable, [parserPath, replayPath], {
    encoding: "utf8",
    windowsHide: true,
  });

  if (result.error) {
    throw new Error(`Could not start replay parser with '${pythonExecutable}': ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`Replay parser failed (${result.status}):\n${result.stderr || result.stdout}`);
  }

  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`Replay parser returned invalid JSON:\n${result.stdout}`);
  }
}

try {
  const overrides = parseManualMappings(manualMappings);
  console.log(`Parsing replay: ${path.resolve(replayFile)}`);
  const parsed = runParser();

  console.log(`Parser: ${parsed.parserName} ${parsed.parserVersion}`);
  console.log(`Schema: ${parsed.schemaVersion}`);
  console.log(`Source SHA-256: ${parsed.sourceHash}`);
  console.log(`Duration: ${Math.round((parsed.payload?.body?.durationMs ?? 0) / 1000)} seconds`);
  console.log("Replay players:");
  for (const player of parsed.payload?.players ?? []) {
    console.log(
      `  slot ${player.replaySlot}: ${player.name} | team ${player.teamId ?? "?"} | civ ${player.civilizationId ?? "?"}`,
    );
  }

  const token = await signIn();
  const game = await readDocument(`matches/${matchId}/games/${gameId}`, token);
  const playerIds = gamePlayerIds(game);
  if (playerIds.length < 2 || playerIds.length > 8) {
    throw new Error(`Expected 2–8 Game players, found ${playerIds.length}.`);
  }

  const playerDocs = await Promise.all(playerIds.map(async (playerId) => ({
    playerId,
    document: await readDocument(`players/${playerId}`, token),
  })));

  const candidates = playerDocs.map(({ playerId, document }) => ({
    playerId,
    steamName: stringField(document, "steamName"),
    normalizedSteamName: normalizeName(stringField(document, "steamName")),
  }));

  const usedPlayerIds = new Set();
  const playerMapping = [];
  const unresolved = [];

  for (const source of parsed.sourcePlayers ?? []) {
    const normalizedSource = normalizeName(source.sourceName);
    const overridePlayerId = overrides.get(normalizedSource);
    let matches;

    if (overridePlayerId) {
      matches = candidates.filter((candidate) => candidate.playerId === overridePlayerId);
      if (matches.length !== 1) {
        throw new Error(`Manual mapping for '${source.sourceName}' points to non-participant ${overridePlayerId}.`);
      }
    } else {
      matches = candidates.filter((candidate) => candidate.normalizedSteamName === normalizedSource);
    }

    if (matches.length !== 1 || usedPlayerIds.has(matches[0]?.playerId)) {
      unresolved.push({ source, matches });
      continue;
    }

    usedPlayerIds.add(matches[0].playerId);
    playerMapping.push({
      playerId: matches[0].playerId,
      replaySlot: source.replaySlot,
      sourceName: source.sourceName ?? null,
    });
  }

  if (unresolved.length > 0 || playerMapping.length !== playerIds.length) {
    console.error("\nReplay player mapping is incomplete; nothing was ingested.");
    console.error("League Game participants:");
    for (const candidate of candidates) {
      console.error(`  ${candidate.playerId}: ${candidate.steamName ?? "(no Steam name)"}`);
    }
    console.error("Replay players needing explicit mapping:");
    for (const item of unresolved) {
      console.error(`  slot ${item.source.replaySlot}: ${item.source.sourceName}`);
    }
    console.error("\nAdd one or more overrides, for example:");
    console.error('  --map "Replay Player Name=PLAYER_DOCUMENT_ID"');
    process.exit(2);
  }

  console.log("Resolved player mapping:");
  for (const mapping of playerMapping.sort((left, right) => left.replaySlot - right.replaySlot)) {
    console.log(`  slot ${mapping.replaySlot}: ${mapping.sourceName} -> ${mapping.playerId}`);
  }

  if (dryRun) {
    console.log("Dry run complete; no Firestore data was changed.");
    process.exit(0);
  }

  const result = await callCallable("adminIngestReplayStats", token, {
    requestId: randomUUID(),
    matchId,
    gameId,
    parserName: parsed.parserName,
    parserVersion: parsed.parserVersion,
    schemaVersion: parsed.schemaVersion,
    sourceHash: parsed.sourceHash,
    sourceFileName: parsed.sourceFileName ?? path.basename(replayFile),
    parserExtractedAt: parsed.parserExtractedAt ?? null,
    playerMapping,
    warnings: parsed.warnings ?? [],
    payload: parsed.payload,
  });

  console.log("Replay ingested:", JSON.stringify(result));
  console.log(`Active raw-stat revision: ${result.rawStatsRevision}`);
  console.log(`rawStatsId: ${result.rawStatsId}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
