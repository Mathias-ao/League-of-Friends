import { randomUUID } from "node:crypto";

const args = process.argv.slice(2);
function readArg(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

const projectId = readArg("--project");
const matchId = readArg("--match");
const gameId = readArg("--game") ?? "G1";
const firestorePort = readArg("--firestore-port") ?? "8085";

if (!projectId || !matchId) {
  console.error("Usage: node scripts/smoke-test-replay-stats-ingestion.mjs --project <project-id> --match <match-id> [--game G1]");
  process.exit(1);
}

const authBase = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const functionsBase = `http://127.0.0.1:5001/${projectId}/europe-west1`;
const firestoreBase = `http://127.0.0.1:${firestorePort}/v1/projects/${projectId}/databases/(default)/documents`;

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

async function readDocument(path, token) {
  const response = await fetch(`${firestoreBase}/${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const payload = await parseResponse(response, `Firestore ${path}`);
  if (!response.ok) throw new Error(`Firestore read failed for ${path}: ${JSON.stringify(payload)}`);
  return payload;
}

function stringField(document, field) {
  return document.fields?.[field]?.stringValue ?? null;
}

function numberValue(value, fallback = null) {
  if (!value) return fallback;
  if (value.integerValue != null) return Number(value.integerValue);
  if (value.doubleValue != null) return Number(value.doubleValue);
  return fallback;
}

function mapFields(document, field) {
  return document.fields?.[field]?.mapValue?.fields ?? {};
}

function gamePlayerIds(document) {
  return (document.fields?.players?.arrayValue?.values ?? [])
    .map((value) => value.mapValue?.fields?.playerId?.stringValue)
    .filter(Boolean);
}

function ingestionData(playerIds, sourceHash, sourceFileName, sampleOffset) {
  return {
    requestId: randomUUID(),
    matchId,
    gameId,
    parserName: "league-emulator-synthetic-parser",
    parserVersion: "0.1.0-test",
    schemaVersion: "synthetic-replay-schema-v1",
    sourceHash,
    sourceFileName,
    playerMapping: playerIds.map((playerId, index) => ({
      playerId,
      replaySlot: index + 1,
      sourceName: `Synthetic Player ${index + 1}`,
    })),
    warnings: ["Synthetic smoke-test payload; these are not real AoE2 replay statistics."],
    payload: {
      smokeTest: true,
      game: {
        map: "Arabia",
        durationSeconds: 1320 + sampleOffset,
      },
      players: playerIds.map((playerId, index) => ({
        replaySlot: index + 1,
        playerIdForSmokeTestOnly: playerId,
        sampleMetric: 100 + index + sampleOffset,
      })),
    },
  };
}

try {
  const token = await signIn();
  const gameBefore = await readDocument(`matches/${matchId}/games/${gameId}`, token);
  const playerIds = gamePlayerIds(gameBefore);
  if (playerIds.length < 2 || playerIds.length > 8) {
    throw new Error(`Expected 2–8 Game players, found ${playerIds.length}.`);
  }

  console.log(`Ingesting synthetic replay A for ${matchId}/${gameId}...`);
  const firstInput = ingestionData(playerIds, "a".repeat(64), "synthetic-replay-A.aoe2record", 0);
  const first = await callCallable("adminIngestReplayStats", token, firstInput);
  console.log("First ingestion:", JSON.stringify(first));

  if (first.contractVersion !== "REPLAY_RAW_STATS_V1") {
    throw new Error(`Unexpected contract version ${first.contractVersion}.`);
  }
  if (first.alreadyIngested) throw new Error("First replay ingestion unexpectedly reported a duplicate.");

  console.log("Re-ingesting the exact same replay/parser payload to verify deduplication...");
  const duplicate = await callCallable("adminIngestReplayStats", token, {
    ...firstInput,
    requestId: randomUUID(),
  });
  console.log("Duplicate ingestion:", JSON.stringify(duplicate));

  if (!duplicate.alreadyIngested) throw new Error("Exact duplicate replay ingestion was not deduplicated.");
  if (duplicate.rawStatsId !== first.rawStatsId) throw new Error("Duplicate ingestion returned a different rawStatsId.");
  if (duplicate.rawStatsRevision !== first.rawStatsRevision) throw new Error("Duplicate ingestion changed rawStatsRevision.");

  console.log("Ingesting corrected synthetic replay B to verify immutable replacement history...");
  const secondInput = ingestionData(playerIds, "b".repeat(64), "synthetic-replay-B-corrected.aoe2record", 7);
  const second = await callCallable("adminIngestReplayStats", token, secondInput);
  console.log("Corrected ingestion:", JSON.stringify(second));

  if (second.rawStatsId === first.rawStatsId) throw new Error("Corrected replay did not create a new rawStats document.");
  if (second.supersededRawStatsId !== first.rawStatsId) throw new Error("Corrected replay does not point back to the superseded raw stats.");
  if (second.rawStatsRevision !== first.rawStatsRevision + 1) throw new Error("Corrected replay did not increment rawStatsRevision.");

  const [gameAfter, firstRaw, secondRaw] = await Promise.all([
    readDocument(`matches/${matchId}/games/${gameId}`, token),
    readDocument(`matches/${matchId}/games/${gameId}/rawStats/${first.rawStatsId}`, token),
    readDocument(`matches/${matchId}/games/${gameId}/rawStats/${second.rawStatsId}`, token),
  ]);

  const replay = mapFields(gameAfter, "replay");
  const firstSource = mapFields(firstRaw, "source");
  const secondSource = mapFields(secondRaw, "source");

  if (stringField(gameAfter, "activeRawStatsId") !== second.rawStatsId) {
    throw new Error("Game does not point to corrected replay B as active raw statistics.");
  }
  if (stringField(gameAfter, "replayDerivedStatsState") !== "PENDING") {
    throw new Error("Corrected replay did not mark replay-derived statistics as PENDING.");
  }
  if (stringField(firstRaw, "contractVersion") !== "REPLAY_RAW_STATS_V1") {
    throw new Error("Superseded raw stats document was not preserved.");
  }
  if (firstSource.sourceHash?.stringValue !== "a".repeat(64)) {
    throw new Error("Superseded replay A source hash changed unexpectedly.");
  }
  if (secondSource.sourceHash?.stringValue !== "b".repeat(64)) {
    throw new Error("Active replay B source hash is incorrect.");
  }
  if (stringField(secondRaw, "supersedesRawStatsId") !== first.rawStatsId) {
    throw new Error("Active replay B raw stats does not preserve replacement lineage.");
  }
  if (replay.activeRawStatsId?.stringValue !== second.rawStatsId || replay.status?.stringValue !== "PARSED") {
    throw new Error("Game replay projection was not updated to the corrected parsed replay.");
  }
  if (numberValue(gameAfter.fields?.rawStatsRevision) !== second.rawStatsRevision) {
    throw new Error("Game rawStatsRevision does not match the active ingestion.");
  }

  console.log("Verified replay raw-stat ingestion contract:");
  console.log(`  players mapped: ${playerIds.length}`);
  console.log(`  replay A rawStatsId: ${first.rawStatsId}`);
  console.log("  exact replay A duplicate: deduplicated");
  console.log(`  replay B rawStatsId: ${second.rawStatsId}`);
  console.log(`  active rawStats revision: ${second.rawStatsRevision}`);
  console.log("  replay A remains stored: yes");
  console.log("  replay B supersedes replay A: yes");
  console.log("  replay-derived stats state: PENDING");
  console.log("Replay raw statistics ingestion smoke test passed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
