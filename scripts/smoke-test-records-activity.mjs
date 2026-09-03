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
  console.error("Usage: node scripts/smoke-test-records-activity.mjs --project <project-id> --match <match-id>");
  process.exit(1);
}

const authBase = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const functionsBase = `http://127.0.0.1:5001/${projectId}/europe-west1`;
const firestoreBase = `http://127.0.0.1:${firestorePort}/v1/projects/${projectId}/databases/(default)/documents`;

async function parseResponse(response, label) {
  const text = await response.text();
  try { return JSON.parse(text); } catch { throw new Error(`${label} returned non-JSON (${response.status}): ${text}`); }
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
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ data }),
  });
  const payload = await parseResponse(response, name);
  if (!response.ok || payload.error) throw new Error(`${name} failed: ${JSON.stringify(payload)}`);
  return payload.result;
}

async function readDocument(path, token) {
  const response = await fetch(`${firestoreBase}/${path}`, { headers: { authorization: `Bearer ${token}` } });
  const payload = await parseResponse(response, `Firestore ${path}`);
  if (!response.ok) throw new Error(`Firestore read failed for ${path}: ${JSON.stringify(payload)}`);
  return payload;
}

function numberValue(value, fallback = 1) {
  if (!value) return fallback;
  if (value.integerValue != null) return Number(value.integerValue);
  if (value.doubleValue != null) return Number(value.doubleValue);
  return fallback;
}

function stringField(document, field) {
  return document.fields?.[field]?.stringValue ?? null;
}

function stringArray(document, field) {
  return (document.fields?.[field]?.arrayValue?.values ?? []).map((value) => value.stringValue).filter(Boolean);
}

try {
  const token = await signIn();
  const match = await readDocument(`matches/${matchId}`, token);
  const revision = numberValue(match.fields?.canonicalResult?.mapValue?.fields?.revision, 1);

  console.log(`Processing Records for ${matchId} R${revision}...`);
  const records = await callCallable("adminProcessRecords", token, {
    requestId: randomUUID(),
    matchId,
  });
  if (records.schemaVersion !== "REPLAY_RECORDS_V1") {
    throw new Error(`Unexpected records schema: ${records.schemaVersion}`);
  }
  if (!records.remainingSteps.includes("ACTIVITY")) {
    throw new Error(`ACTIVITY should remain after RECORDS; remaining=${records.remainingSteps.join(", ")}`);
  }

  console.log(`Processing Activity for ${matchId} R${revision}...`);
  const activity = await callCallable("adminProcessActivity", token, {
    requestId: randomUUID(),
    matchId,
  });
  if (activity.schemaVersion !== "RESULT_ACTIVITY_V1") {
    throw new Error(`Unexpected activity schema: ${activity.schemaVersion}`);
  }

  const [job, processedMatch, activityDocument] = await Promise.all([
    readDocument(`processingJobs/MATCH_RESULT_${matchId}_R${revision}`, token),
    readDocument(`matches/${matchId}`, token),
    readDocument(`activity/MATCH_RESULT_${matchId}`, token),
  ]);

  const completedSteps = stringArray(job, "completedSteps");
  const pendingSteps = stringArray(job, "pendingSteps");
  const jobStatus = stringField(job, "status");
  const processingState = stringField(processedMatch, "processingState");
  const activityType = stringField(activityDocument, "type");

  for (const step of ["RECORDS", "ACTIVITY"]) {
    if (!completedSteps.includes(step)) throw new Error(`Processing job did not mark ${step} complete.`);
  }
  if (pendingSteps.length !== 0 || jobStatus !== "COMPLETED") {
    throw new Error(`Processing job is not complete: status=${jobStatus}, pending=${pendingSteps.join(", ")}`);
  }
  if (processingState !== "COMPLETE") {
    throw new Error(`Match processingState should be COMPLETE, got ${processingState}.`);
  }
  if (activityType !== "MATCH_RESULT") {
    throw new Error(`Unexpected activity type: ${activityType}.`);
  }

  console.log("Verified final post-result pipeline:");
  console.log(`  records schema: ${records.schemaVersion}`);
  console.log(`  lifetime records: ${records.lifetimeRecords}`);
  console.log(`  activity: ${activity.activityId}`);
  console.log(`  completed steps: ${completedSteps.join(", ")}`);
  console.log(`  processing job: ${jobStatus}`);
  console.log(`  match processing state: ${processingState}`);
  console.log("Records + Activity pipeline smoke test passed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
