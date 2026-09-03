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
  console.error("Usage: node scripts/smoke-test-achievements.mjs --project <project-id> --match <match-id>");
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

function stringArray(document, field) {
  return (document.fields?.[field]?.arrayValue?.values ?? []).map((value) => value.stringValue);
}

try {
  const token = await signIn();
  const match = await readDocument(`matches/${matchId}`, token);
  const revision = numberValue(match.fields?.canonicalResult?.mapValue?.fields?.revision, 1);

  console.log(`Processing Achievement Engine V1 for ${matchId} R${revision}...`);
  const result = await callCallable("adminProcessAchievements", token, {
    requestId: randomUUID(),
    matchId,
  });
  console.log("Processed:", JSON.stringify(result));

  if (result.engineVersion !== "ACHIEVEMENT_ENGINE_V1") {
    throw new Error(`Unexpected achievement engine: ${result.engineVersion}`);
  }

  const job = await readDocument(`processingJobs/MATCH_RESULT_${matchId}_R${revision}`, token);
  const completedSteps = stringArray(job, "completedSteps");
  if (!completedSteps.includes("ACHIEVEMENTS")) {
    throw new Error("Processing job did not mark ACHIEVEMENTS complete.");
  }

  console.log("Verified achievement pipeline:");
  console.log(`  definitions evaluated: ${result.definitions}`);
  console.log(`  active awards: ${result.activeAwards}`);
  console.log(`  revoked awards: ${result.revokedAwards}`);
  console.log(`  completed steps: ${completedSteps.join(", ")}`);
  if (result.definitions === 0) {
    console.log("  catalogue: intentionally empty — achievement content deferred");
  }
  console.log("Achievement pipeline smoke test passed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
