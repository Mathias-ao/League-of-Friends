import { randomUUID } from "node:crypto";

const args = process.argv.slice(2);
function readArg(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

const projectId = readArg("--project");
const matchId = readArg("--match");
const firestorePort = readArg("--firestore-port") ?? "8085";

if (!projectId || !matchId) {
  console.error("Usage: node scripts/smoke-test-statistics.mjs --project <project-id> --match <match-id>");
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

function participantMaps(document) {
  return (document.fields?.participants?.arrayValue?.values ?? [])
    .map((value) => value.mapValue?.fields ?? {});
}

function stringArray(document, field) {
  return (document.fields?.[field]?.arrayValue?.values ?? []).map((value) => value.stringValue);
}

try {
  const token = await signIn();
  const match = await readDocument(`matches/${matchId}`, token);
  if (stringField(match, "status") !== "COMPLETED") {
    throw new Error("Match must be COMPLETED before statistics processing.");
  }

  const seasonId = stringField(match, "seasonId");
  const format = stringField(match, "format");
  const canonical = mapFields(match, "canonicalResult");
  const revision = numberValue(canonical.revision, 1);
  const winnerTeam = numberValue(canonical.winnerTeam);
  const participants = participantMaps(match).map((participant) => ({
    playerId: participant.playerId?.stringValue,
    team: numberValue(participant.team),
  }));

  if (!seasonId || !format || !participants.length) {
    throw new Error("Trigger Match is missing Season, format, or participants.");
  }

  console.log(`Rebuilding competition statistics from canonical history (trigger ${matchId} R${revision})...`);
  const processed = await callCallable("adminProcessStatistics", token, {
    requestId: randomUUID(),
    matchId,
  });
  console.log("Processed:", JSON.stringify(processed));

  if (processed.schemaVersion !== "COMPETITION_STATS_V1") {
    throw new Error(`Unexpected statistics schema: ${processed.schemaVersion}`);
  }

  const playerStats = await Promise.all(participants.map(async (participant) => {
    const [lifetime, seasonal] = await Promise.all([
      readDocument(`players/${participant.playerId}/statistics/lifetime`, token),
      readDocument(`seasons/${seasonId}/statistics/${participant.playerId}`, token),
    ]);

    const matchesPlayed = numberValue(lifetime.fields?.matchesPlayed, 0);
    const matchesWon = numberValue(lifetime.fields?.matchesWon, 0);
    const matchesLost = numberValue(lifetime.fields?.matchesLost, 0);
    const seasonPlayed = numberValue(seasonal.fields?.matchesPlayed, 0);
    const formatStats = lifetime.fields?.byFormat?.mapValue?.fields?.[format]?.mapValue?.fields ?? {};
    const formatPlayed = numberValue(formatStats.played, 0);

    if (matchesPlayed < 1 || seasonPlayed < 1 || formatPlayed < 1) {
      throw new Error(`Player ${participant.playerId} did not receive the expected statistics projection.`);
    }

    if (winnerTeam === 1 || winnerTeam === 2) {
      const won = participant.team === winnerTeam;
      if (won && matchesWon < 1) throw new Error(`Winning player ${participant.playerId} has no recorded win.`);
      if (!won && matchesLost < 1) throw new Error(`Losing player ${participant.playerId} has no recorded loss.`);
    }

    return { ...participant, matchesPlayed, matchesWon, matchesLost };
  }));

  const teamOne = participants.filter((participant) => participant.team === 1);
  const teamTwo = participants.filter((participant) => participant.team === 2);
  if (teamOne.length && teamTwo.length) {
    const opponent = await readDocument(
      `players/${teamOne[0].playerId}/opponentStats/${teamTwo[0].playerId}`,
      token,
    );
    if (numberValue(opponent.fields?.matchesTogether, 0) < 1) {
      throw new Error("Cross-team opponent relationship was not rebuilt.");
    }

    if (teamOne.length > 1) {
      const teammate = await readDocument(
        `players/${teamOne[0].playerId}/teammateStats/${teamOne[1].playerId}`,
        token,
      );
      if (numberValue(teammate.fields?.matchesTogether, 0) < 1) {
        throw new Error("Same-team teammate relationship was not rebuilt.");
      }
    }
  }

  const job = await readDocument(`processingJobs/MATCH_RESULT_${matchId}_R${revision}`, token);
  const completedSteps = stringArray(job, "completedSteps");
  if (!completedSteps.includes("STATISTICS")) {
    throw new Error("Processing job did not mark STATISTICS complete.");
  }

  console.log("Verified competition statistics:");
  console.log(`  schema: ${processed.schemaVersion}`);
  console.log(`  canonical Matches rebuilt: ${processed.canonicalMatches}`);
  console.log(`  lifetime players: ${processed.lifetimePlayers}`);
  console.log(`  seasonal players: ${processed.seasonalPlayers}`);
  console.log(`  opponent relationships: ${processed.opponentRelationships}`);
  console.log(`  teammate relationships: ${processed.teammateRelationships}`);
  for (const player of playerStats.sort((a, b) => (a.team ?? 0) - (b.team ?? 0))) {
    console.log(`  team ${player.team} ${player.playerId}: ${player.matchesWon}W-${player.matchesLost}L (${player.matchesPlayed} played)`);
  }
  console.log(`  completed steps: ${completedSteps.join(", ")}`);
  console.log("Competition statistics smoke test passed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
