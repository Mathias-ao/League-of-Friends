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
  console.error(
    "Usage: node scripts/smoke-test-auto-result-pipeline.mjs --project <project-id> --match <match-id> [--game G1]",
  );
  process.exit(1);
}

const adminEmail = "emperor@league.local";
const adminPassword = "league-emulator-admin-only";
const plannerPassword = "planner-test-only";
const authBase = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const functionsBase = `http://127.0.0.1:5001/${projectId}/europe-west1`;
const firestoreBase = `http://127.0.0.1:${firestorePort}/v1/projects/${projectId}/databases/(default)/documents`;
const expectedSteps = [
  "SCORING",
  "GOLD",
  "POWER_RATING",
  "STATISTICS",
  "ACHIEVEMENTS",
  "RIVALRIES",
  "RECORDS",
  "ACTIVITY",
];

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
  const text = await response.text();
  let payload;
  try { payload = JSON.parse(text); } catch { throw new Error(`${functionName} returned non-JSON: ${text}`); }
  if (!response.ok || payload.error) {
    throw new Error(`${functionName} failed: ${JSON.stringify(payload)}`);
  }
  return payload.result;
}

async function readDocument(path, idToken, allowMissing = false) {
  const response = await fetch(`${firestoreBase}/${path}`, {
    headers: { authorization: `Bearer ${idToken}` },
  });
  if (response.status === 404 && allowMissing) return null;
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
  return decodeFields(document?.fields ?? {});
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollForCompletedJob(path, token) {
  let last = null;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const raw = await readDocument(path, token, true);
    if (raw) {
      last = decodeDocument(raw);
      if (last.automation?.status === "PAUSED") {
        throw new Error(`Automatic pipeline paused: ${last.automation?.lastError ?? last.lastError ?? "unknown error"}`);
      }
      if (last.status === "COMPLETED" && last.automation?.status === "COMPLETED") {
        return last;
      }
    }
    await sleep(500);
  }
  throw new Error(`Automatic pipeline did not complete. Last job: ${JSON.stringify(last)}`);
}

try {
  const adminAuth = await signIn(adminEmail, adminPassword);
  const adminToken = adminAuth.idToken;
  const adminHealth = await callCallable("backendHealth", adminToken, {});

  const matchBefore = decodeDocument(await readDocument(`matches/${matchId}`, adminToken));
  if (matchBefore.status !== "COMPLETED" || !matchBefore.canonicalResult) {
    throw new Error(`Expected an already COMPLETED Match, got ${matchBefore.status}.`);
  }
  if (!matchBefore.eventId) {
    throw new Error("Automatic pipeline smoke test expects an Event-backed planner Match.");
  }

  const eventDocument = decodeDocument(await readDocument(`events/${matchBefore.eventId}`, adminToken));
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

  const disputePlayer = (matchBefore.participants ?? [])
    .map((participant) => participant.playerId)
    .find((playerId) => tokenByPlayerId.has(playerId));
  if (!disputePlayer) throw new Error("Could not authenticate any Match participant for the dispute test.");

  const previousRevision = Number(matchBefore.canonicalResult.revision ?? matchBefore.resultVersion ?? 1);
  const disputeRequestId = randomUUID();
  const dispute = await callCallable(
    "disputeCanonicalGameResult",
    tokenByPlayerId.get(disputePlayer),
    {
      requestId: disputeRequestId,
      matchId,
      gameId,
      category: "WRONG_RESULT",
      reason: "Automatic result pipeline smoke test correction.",
    },
  );

  const correction = {
    requestId: randomUUID(),
    matchId,
    gameId,
    disputeId: dispute.disputeId,
    resolution: "CORRECT",
    reason: "Reapply the same winner to verify automatic post-result processing.",
  };
  if (matchBefore.canonicalResult.type === "TEAM_WIN") {
    correction.winnerTeam = matchBefore.canonicalResult.winnerTeam;
  } else if (matchBefore.canonicalResult.type === "PLAYER_WIN") {
    correction.winnerPlayerId = matchBefore.canonicalResult.winnerPlayerId;
  } else {
    throw new Error(`Unsupported canonical result type ${matchBefore.canonicalResult.type}.`);
  }

  console.log(`Creating result revision R${previousRevision + 1} without running any processor manually...`);
  const resolved = await callCallable("adminResolveCanonicalResultDispute", adminToken, correction);
  const revision = Number(resolved.resultRevision);
  if (revision !== previousRevision + 1) {
    throw new Error(`Expected correction revision ${previousRevision + 1}, got ${revision}.`);
  }

  const jobId = `MATCH_RESULT_${matchId}_R${revision}`;
  const job = await pollForCompletedJob(`processingJobs/${jobId}`, adminToken);
  const completed = new Set(job.completedSteps ?? []);
  const missing = expectedSteps.filter((step) => !completed.has(step));
  if (missing.length) throw new Error(`Automatic job is missing completed steps: ${missing.join(", ")}.`);
  if ((job.pendingSteps ?? []).length) throw new Error(`Automatic job still has pending steps: ${job.pendingSteps.join(", ")}.`);

  const [matchAfterRaw, activityRaw] = await Promise.all([
    readDocument(`matches/${matchId}`, adminToken),
    readDocument(`activity/MATCH_RESULT_${matchId}`, adminToken),
  ]);
  const matchAfter = decodeDocument(matchAfterRaw);
  const activity = decodeDocument(activityRaw);
  if (matchAfter.processingState !== "COMPLETE") {
    throw new Error(`Expected match processingState COMPLETE, got ${matchAfter.processingState}.`);
  }
  if (Number(activity.resultRevision) !== revision) {
    throw new Error(`Expected activity revision ${revision}, got ${activity.resultRevision}.`);
  }

  console.log(`Automatic pipeline completed ${jobId}.`);
  console.log(`  completedSteps: ${(job.completedSteps ?? []).join(", ")}`);
  console.log(`  automation.status: ${job.automation?.status}`);
  console.log(`  automation.attempts: ${job.automation?.attempts}`);
  console.log(`  match.processingState: ${matchAfter.processingState}`);
  console.log(`  activity.resultRevision: ${activity.resultRevision}`);
  console.log("Automatic result pipeline smoke test passed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
