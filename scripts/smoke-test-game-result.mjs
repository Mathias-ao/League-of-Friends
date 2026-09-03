const args = process.argv.slice(2);

function readArg(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

const projectId = readArg("--project");
const eventId = readArg("--event");
const matchId = readArg("--match");
const gameId = readArg("--game") ?? "G1";
const firestorePort = readArg("--firestore-port") ?? "8085";

if (!projectId || !eventId || !matchId) {
  console.error(
    "Usage: node scripts/smoke-test-game-result.mjs --project <project-id> --event <event-id> --match <match-id> [--game G1]",
  );
  process.exit(1);
}

const adminEmail = "emperor@league.local";
const adminPassword = "league-emulator-admin-only";
const plannerPassword = "planner-test-only";
const authBase = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const functionsBase = `http://127.0.0.1:5001/${projectId}/europe-west1`;
const firestoreBase = `http://127.0.0.1:${firestorePort}/v1/projects/${projectId}/databases/(default)/documents`;

async function authRequest(path, body) {
  const response = await fetch(`${authBase}/${path}?key=fake-api-key`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`Auth request ${path} failed: ${JSON.stringify(payload)}`);
  return payload;
}

async function signIn(email, password) {
  return authRequest("accounts:signInWithPassword", {
    email,
    password,
    returnSecureToken: true,
  });
}

async function callCallable(functionName, idToken, data) {
  const response = await fetch(`${functionsBase}/${functionName}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ data }),
  });
  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(`${functionName} failed: ${JSON.stringify(payload)}`);
  }
  return payload.result;
}

async function readDocument(path, idToken) {
  const response = await fetch(`${firestoreBase}/${path}`, {
    headers: { authorization: `Bearer ${idToken}` },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`Firestore read failed for ${path}: ${JSON.stringify(payload)}`);
  return payload;
}

function decodeValue(value) {
  if (!value) return null;
  if (Object.hasOwn(value, "nullValue")) return null;
  if (Object.hasOwn(value, "stringValue")) return value.stringValue;
  if (Object.hasOwn(value, "integerValue")) return Number(value.integerValue);
  if (Object.hasOwn(value, "doubleValue")) return value.doubleValue;
  if (Object.hasOwn(value, "booleanValue")) return value.booleanValue;
  if (Object.hasOwn(value, "timestampValue")) return value.timestampValue;
  if (value.arrayValue) return (value.arrayValue.values ?? []).map(decodeValue);
  if (value.mapValue) return decodeFields(value.mapValue.fields ?? {});
  return null;
}

function decodeFields(fields) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]));
}

function decodeDocument(document) {
  return decodeFields(document.fields ?? {});
}

try {
  const adminAuth = await signIn(adminEmail, adminPassword);
  const adminToken = adminAuth.idToken;
  const adminHealth = await callCallable("backendHealth", adminToken, {});

  const eventDocument = decodeDocument(await readDocument(`events/${eventId}`, adminToken));
  const runTagMatch = String(eventDocument.title ?? "").match(/Planner Test ([A-Za-z0-9]+)/);
  if (!runTagMatch) {
    throw new Error(`Could not derive planner run tag from Event title: ${eventDocument.title}`);
  }
  const runTag = runTagMatch[1];

  const tokenByPlayerId = new Map([[adminHealth.playerId, adminToken]]);
  for (let index = 1; index <= 7; index += 1) {
    const email = `planner-${runTag}-${index}@league.local`;
    const auth = await signIn(email, plannerPassword);
    const health = await callCallable("backendHealth", auth.idToken, {});
    tokenByPlayerId.set(health.playerId, auth.idToken);
  }

  const matchDocument = decodeDocument(await readDocument(`matches/${matchId}`, adminToken));
  if (matchDocument.status !== "READY") {
    throw new Error(`Expected READY Match before result test, got ${matchDocument.status}.`);
  }

  const participants = matchDocument.participants ?? [];
  const teamOne = participants.filter((participant) => participant.team === 1);
  const teamTwo = participants.filter((participant) => participant.team === 2);
  if (teamOne.length === 0 || teamTwo.length === 0) {
    throw new Error("Result smoke test requires two opposing teams.");
  }

  const submitter = teamOne[0];
  const confirmer = teamTwo[0];
  const submitterToken = tokenByPlayerId.get(submitter.playerId);
  const confirmerToken = tokenByPlayerId.get(confirmer.playerId);
  if (!submitterToken || !confirmerToken) {
    throw new Error("Could not map selected Match participants to emulator Auth users.");
  }

  console.log(`Submitting Team 1 win as ${submitter.playerId}...`);
  const submitted = await callCallable("submitGameResult", submitterToken, {
    matchId,
    gameId,
    winnerTeam: 1,
  });
  console.log("Submitted:", JSON.stringify(submitted));

  const awaitingGame = decodeDocument(await readDocument(`matches/${matchId}/games/${gameId}`, adminToken));
  if (awaitingGame.status !== "AWAITING_CONFIRMATION") {
    throw new Error(`Expected AWAITING_CONFIRMATION after submission, got ${awaitingGame.status}.`);
  }

  console.log(`Confirming from opposing Team 2 player ${confirmer.playerId}...`);
  const confirmed = await callCallable("respondToGameResult", confirmerToken, {
    matchId,
    gameId,
    submissionId: submitted.submissionId,
    response: "CONFIRM",
  });
  console.log("Confirmed:", JSON.stringify(confirmed));

  const [finalGameRaw, finalMatchRaw, processingJobRaw] = await Promise.all([
    readDocument(`matches/${matchId}/games/${gameId}`, adminToken),
    readDocument(`matches/${matchId}`, adminToken),
    readDocument(`processingJobs/MATCH_RESULT_${matchId}`, adminToken),
  ]);

  const finalGame = decodeDocument(finalGameRaw);
  const finalMatch = decodeDocument(finalMatchRaw);
  const processingJob = decodeDocument(processingJobRaw);

  if (finalGame.status !== "COMPLETED") throw new Error(`Expected COMPLETED Game, got ${finalGame.status}.`);
  if (finalMatch.status !== "COMPLETED") throw new Error(`Expected COMPLETED Match, got ${finalMatch.status}.`);
  if (finalGame.canonicalResult?.winnerTeam !== 1) {
    throw new Error(`Expected canonical winnerTeam 1, got ${finalGame.canonicalResult?.winnerTeam}.`);
  }
  if (finalGame.canonicalResult?.source !== "PLAYER_CONFIRMED") {
    throw new Error(`Expected PLAYER_CONFIRMED source, got ${finalGame.canonicalResult?.source}.`);
  }
  if (processingJob.status !== "PENDING") {
    throw new Error(`Expected PENDING processing job, got ${processingJob.status}.`);
  }

  console.log("Verified canonical result:");
  console.log(`  game.status: ${finalGame.status}`);
  console.log(`  match.status: ${finalMatch.status}`);
  console.log(`  winnerTeam: ${finalGame.canonicalResult.winnerTeam}`);
  console.log(`  submittedBy: ${finalGame.canonicalResult.submittedBy}`);
  console.log(`  confirmedBy: ${finalGame.canonicalResult.confirmedBy}`);
  console.log(`  processingJob.status: ${processingJob.status}`);
  console.log("Confirmed Game result smoke test passed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
