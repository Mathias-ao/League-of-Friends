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
  console.error("Usage: node scripts/reconcile-match-activity.mjs --project <project-id> --match <match-id>");
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

function stringField(document, field) {
  return document.fields?.[field]?.stringValue ?? null;
}

try {
  const token = await signIn();
  const before = await readDocument(`matches/${matchId}`, token);
  const eventId = stringField(before, "eventId");

  const result = await callCallable("adminProcessActivity", token, {
    requestId: randomUUID(),
    matchId,
  });

  console.log("Activity reconciled:", JSON.stringify(result));

  const after = await readDocument(`matches/${matchId}`, token);
  const processingState = stringField(after, "processingState");
  if (processingState !== "COMPLETE") {
    throw new Error(`Expected Match processingState COMPLETE, got ${processingState}.`);
  }

  if (eventId) {
    const event = await readDocument(`events/${eventId}`, token);
    const eventStatus = stringField(event, "status");
    console.log(`Event ${eventId}: ${eventStatus}`);
    if (result.eventCompleted && eventStatus !== "COMPLETED") {
      throw new Error("Activity reported eventCompleted but Event is not COMPLETED.");
    }
  }

  console.log("Activity lifecycle reconciliation passed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
