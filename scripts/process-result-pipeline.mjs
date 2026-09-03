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
  console.error("Usage: node scripts/process-result-pipeline.mjs --project <project-id> --match <match-id>");
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

async function callCallable(name, token) {
  const response = await fetch(`${functionsBase}/${name}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ data: { requestId: randomUUID(), matchId } }),
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

function stringArray(document, field) {
  return (document.fields?.[field]?.arrayValue?.values ?? []).map((value) => value.stringValue).filter(Boolean);
}

const processors = [
  { steps: ["SCORING", "GOLD"], callable: "adminProcessMatchRewards" },
  { steps: ["POWER_RATING"], callable: "adminProcessPowerRatings" },
  { steps: ["STATISTICS"], callable: "adminProcessStatistics" },
  { steps: ["ACHIEVEMENTS"], callable: "adminProcessAchievements" },
  { steps: ["RIVALRIES"], callable: "adminProcessRivalries" },
  { steps: ["RECORDS"], callable: "adminProcessRecords" },
  { steps: ["ACTIVITY"], callable: "adminProcessActivity" },
];

try {
  const token = await signIn();
  const match = await readDocument(`matches/${matchId}`, token);
  const revision = numberValue(match.fields?.canonicalResult?.mapValue?.fields?.revision, 1);
  const jobPath = `processingJobs/MATCH_RESULT_${matchId}_R${revision}`;
  let job = await readDocument(jobPath, token);
  let pending = new Set(stringArray(job, "pendingSteps"));

  console.log(`Result pipeline: ${matchId} R${revision}`);
  console.log(`Pending: ${[...pending].join(", ") || "none"}`);

  for (const processor of processors) {
    if (!processor.steps.some((step) => pending.has(step))) continue;
    process.stdout.write(`  ${processor.callable}... `);
    const result = await callCallable(processor.callable, token);
    console.log("ok");
    pending = new Set(Array.isArray(result.remainingSteps) ? result.remainingSteps : []);
  }

  job = await readDocument(jobPath, token);
  const finalPending = stringArray(job, "pendingSteps");
  const status = job.fields?.status?.stringValue ?? null;
  if (finalPending.length || status !== "COMPLETED") {
    throw new Error(`Pipeline did not finish: status=${status}, pending=${finalPending.join(", ")}`);
  }

  console.log("Result pipeline complete.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
