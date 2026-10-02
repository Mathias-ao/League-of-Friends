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
  console.error("Usage: node scripts/smoke-test-rivalries.mjs --project <project-id> --match <completed-match-id>");
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

function booleanField(document, field) {
  return document.fields?.[field]?.booleanValue ?? null;
}

function nestedStringField(document, mapField, field) {
  return document.fields?.[mapField]?.mapValue?.fields?.[field]?.stringValue ?? null;
}

function stringArray(document, field) {
  return (document.fields?.[field]?.arrayValue?.values ?? []).map((value) => value.stringValue);
}

try {
  const token = await signIn();
  const match = await readDocument(`matches/${matchId}`, token);
  const revision = numberValue(match.fields?.canonicalResult?.mapValue?.fields?.revision, 1);

  console.log(`Rebuilding Pair History V2 from canonical history (trigger ${matchId} R${revision})...`);
  const result = await callCallable("adminProcessRivalries", token, {
    requestId: randomUUID(),
    matchId,
  });
  console.log("Processed:", JSON.stringify(result));

  if (result.pairHistoryVersion !== "AOF_PAIR_HISTORY_V2") {
    throw new Error(`Unexpected Pair History version: ${result.pairHistoryVersion}`);
  }
  if (result.relationshipEngineVersion !== "AOF_RELATIONSHIP_ENGINE_V2") {
    throw new Error(`Unexpected relationship engine: ${result.relationshipEngineVersion}`);
  }
  if (result.relationshipRulesConfigured !== false) {
    throw new Error("Production relationship rules must remain unconfigured on this branch.");
  }
  if (result.interactionCoverage !== "UNAVAILABLE") {
    throw new Error(`Expected interaction coverage UNAVAILABLE until Battle Statistics are wired; got ${result.interactionCoverage}.`);
  }
  if (Number(result.pairHistories ?? 0) < 1) {
    throw new Error("Expected at least one Pair History from the completed Match.");
  }
  if (Number(result.chronicleEntries ?? 0) < 1) {
    throw new Error("Expected the completed Match to create at least one factual Chronicle entry.");
  }

  const rebuiltMatch = await readDocument(`matches/${matchId}`, token);
  if (stringField(rebuiltMatch, "pairHistoryVersion") !== "AOF_PAIR_HISTORY_V2") {
    throw new Error("Match did not retain the Pair History V2 processing version.");
  }
  if (stringField(rebuiltMatch, "relationshipEngineVersion") !== "AOF_RELATIONSHIP_ENGINE_V2") {
    throw new Error("Match did not retain the Relationship Engine V2 processing version.");
  }
  if (booleanField(rebuiltMatch, "relationshipRulesConfigured") !== false) {
    throw new Error("Match incorrectly reports configured relationship rules.");
  }

  const leagueState = await readDocument("leagueState/singleton", token);
  const warRoomStatus = nestedStringField(leagueState, "warRoom", "status");
  if (warRoomStatus !== "CLOSED") {
    throw new Error(`War Room must remain CLOSED while relationship rules are unconfigured; got ${warRoomStatus}.`);
  }

  const job = await readDocument(`processingJobs/MATCH_RESULT_${matchId}_R${revision}`, token);
  const completedSteps = stringArray(job, "completedSteps");
  if (!completedSteps.includes("RIVALRIES")) {
    throw new Error("Processing job did not mark RIVALRIES complete.");
  }

  console.log("Verified Relationship Pulse V2 processing boundary:");
  console.log(`  Pair History: ${result.pairHistoryVersion}`);
  console.log(`  Relationship engine: ${result.relationshipEngineVersion}`);
  console.log(`  pair histories: ${result.pairHistories}`);
  console.log(`  Chronicle entries: ${result.chronicleEntries}`);
  console.log(`  interaction coverage: ${result.interactionCoverage}`);
  console.log(`  rules configured: ${result.relationshipRulesConfigured}`);
  console.log(`  War Room: ${warRoomStatus}`);
  console.log(`  completed steps: ${completedSteps.join(", ")}`);
  console.log("Relationship Pulse V2 smoke test passed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
