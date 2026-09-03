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
  console.error("Usage: node scripts/smoke-test-power-rating.mjs --project <project-id> --match <match-id>");
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
  return (document.fields?.participants?.arrayValue?.values ?? []).map((value) => value.mapValue?.fields ?? {});
}

function stringArray(document, field) {
  return (document.fields?.[field]?.arrayValue?.values ?? []).map((value) => value.stringValue);
}

function average(values) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

try {
  const token = await signIn();
  const matchBefore = await readDocument(`matches/${matchId}`, token);
  if (stringField(matchBefore, "status") !== "COMPLETED") {
    throw new Error("Match must be COMPLETED before Power Rating processing.");
  }

  const participants = participantMaps(matchBefore).map((participant) => ({
    playerId: participant.playerId?.stringValue,
    team: numberValue(participant.team),
  }));
  const canonical = mapFields(matchBefore, "canonicalResult");
  const revision = numberValue(canonical.revision, 1);
  const winnerTeam = numberValue(canonical.winnerTeam);

  if (!participants.length || (winnerTeam !== 1 && winnerTeam !== 2)) {
    throw new Error("This smoke test expects the completed team Match created by the planner flow.");
  }

  console.log(`Rebuilding Power Ratings from canonical history (trigger ${matchId} R${revision})...`);
  const processed = await callCallable("adminProcessPowerRatings", token, {
    requestId: randomUUID(),
    matchId,
  });
  console.log("Processed:", JSON.stringify(processed));

  if (processed.algorithmVersion !== "POWER_RATING_ENGINE_V1") {
    throw new Error(`Unexpected rating engine version: ${processed.algorithmVersion}`);
  }
  if (!processed.powerRatingProfile?.id || !processed.powerRatingProfile?.config) {
    throw new Error("Processor did not report the active Power Rating profile.");
  }
  if (processed.triggerPlayerRatings.length !== participants.length) {
    throw new Error("Trigger player rating count does not match Match participants.");
  }

  const returnedRatings = new Map(processed.triggerPlayerRatings.map((rating) => [rating.playerId, rating]));

  const playerChecks = await Promise.all(participants.map(async (participant) => {
    const [player, history] = await Promise.all([
      readDocument(`players/${participant.playerId}`, token),
      readDocument(`players/${participant.playerId}/ratingHistory/${matchId}`, token),
    ]);

    const rating = numberValue(player.fields?.currentPowerRating);
    const games = numberValue(player.fields?.powerRatingGames, 0);
    const historyRevision = numberValue(history.fields?.sourceRevision, 1);
    const returned = returnedRatings.get(participant.playerId);

    if (rating == null || !returned || rating !== returned.rating) {
      throw new Error(`Player ${participant.playerId} rating projection does not match processor output.`);
    }
    if (games < 1) throw new Error(`Player ${participant.playerId} has no rated Match count.`);
    if (stringField(history, "algorithmVersion") !== "POWER_RATING_ENGINE_V1") {
      throw new Error(`Player ${participant.playerId} rating history has the wrong engine version.`);
    }
    if (stringField(history, "powerRatingProfileId") !== processed.powerRatingProfile.id) {
      throw new Error(`Player ${participant.playerId} rating history has the wrong profile ID.`);
    }
    if (historyRevision !== revision) {
      throw new Error(`Player ${participant.playerId} rating history used revision ${historyRevision}, expected ${revision}.`);
    }

    return { ...participant, rating, games };
  }));

  const winnerRatings = playerChecks.filter((player) => player.team === winnerTeam).map((player) => player.rating);
  const loserRatings = playerChecks.filter((player) => player.team !== winnerTeam).map((player) => player.rating);
  if (!winnerRatings.length || !loserRatings.length) throw new Error("Could not divide rated players into winner and loser teams.");
  if (processed.ratedMatches === 1 && average(winnerRatings) <= average(loserRatings)) {
    throw new Error("After the only rated Match, the winning team should have the higher Power Rating average.");
  }

  const jobId = `MATCH_RESULT_${matchId}_R${revision}`;
  const job = await readDocument(`processingJobs/${jobId}`, token);
  const completedSteps = stringArray(job, "completedSteps");
  if (!completedSteps.includes("POWER_RATING")) {
    throw new Error("Processing job did not mark POWER_RATING complete.");
  }

  const matchAfter = await readDocument(`matches/${matchId}`, token);
  if (!matchAfter.fields?.firstCompletedAt?.timestampValue) {
    throw new Error("Stable firstCompletedAt was not backfilled on the Match.");
  }

  console.log("Verified Power Rating rebuild:");
  console.log(`  engine: ${processed.algorithmVersion}`);
  console.log(`  profile: ${processed.powerRatingProfile.name} (${processed.powerRatingProfile.id}, v${processed.powerRatingProfile.version})`);
  console.log(`  config: ${JSON.stringify(processed.powerRatingProfile.config)}`);
  console.log(`  canonical Matches replayed: ${processed.ratedMatches}`);
  console.log(`  rated players: ${processed.ratedPlayers}`);
  console.log(`  trigger winner team: ${winnerTeam}`);
  for (const player of playerChecks.sort((a, b) => (a.team ?? 0) - (b.team ?? 0))) {
    console.log(`  team ${player.team} ${player.playerId}: ${player.rating} (${player.games} rated Match)`);
  }
  console.log(`  winner average: ${average(winnerRatings).toFixed(1)}`);
  console.log(`  loser average: ${average(loserRatings).toFixed(1)}`);
  console.log(`  completed steps: ${completedSteps.join(", ")}`);
  console.log("Power Rating rebuild smoke test passed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
