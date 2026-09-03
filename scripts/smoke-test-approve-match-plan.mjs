import { randomUUID } from "node:crypto";

const args = process.argv.slice(2);

function readArg(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

const projectId = readArg("--project");
const eventId = readArg("--event");
const planId = readArg("--plan");
const firestorePort = readArg("--firestore-port") ?? "8085";

if (!projectId || !eventId || !planId) {
  console.error(
    "Usage: node scripts/smoke-test-approve-match-plan.mjs --project <project-id> --event <event-id> --plan <plan-id>",
  );
  process.exit(1);
}

const email = "emperor@league.local";
const password = "league-emulator-admin-only";
const authBase = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const functionsBase = `http://127.0.0.1:5001/${projectId}/europe-west1`;
const firestoreBase = `http://127.0.0.1:${firestorePort}/v1/projects/${projectId}/databases/(default)/documents`;

async function signIn() {
  const response = await fetch(`${authBase}/accounts:signInWithPassword?key=fake-api-key`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Auth emulator sign-in failed: ${JSON.stringify(payload)}`);
  }
  return payload.idToken;
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
  if (!response.ok) {
    throw new Error(`Firestore read failed for ${path}: ${JSON.stringify(payload)}`);
  }
  return payload;
}

function stringField(document, field) {
  return document.fields?.[field]?.stringValue ?? null;
}

function arrayStrings(document, field) {
  return (document.fields?.[field]?.arrayValue?.values ?? []).map((value) => value.stringValue);
}

try {
  const idToken = await signIn();

  console.log("Approving Match Plan...");
  const approved = await callCallable("adminApproveMatchPlan", idToken, {
    requestId: randomUUID(),
    eventId,
    planId,
  });

  console.log("Approved:", JSON.stringify(approved));

  if (!Array.isArray(approved.officialMatchIds) || approved.officialMatchIds.length === 0) {
    throw new Error("Approval returned no official Match IDs.");
  }

  const firstMatchId = approved.officialMatchIds[0];
  const [eventDoc, planDoc, matchDoc, gameDoc] = await Promise.all([
    readDocument(`events/${eventId}`, idToken),
    readDocument(`events/${eventId}/matchPlans/${planId}`, idToken),
    readDocument(`matches/${firstMatchId}`, idToken),
    readDocument(`matches/${firstMatchId}/games/G1`, idToken),
  ]);

  const planStatus = stringField(planDoc, "status");
  const matchStatus = stringField(matchDoc, "status");
  const gameStatus = stringField(gameDoc, "status");
  const sourcePlanId = stringField(matchDoc, "sourceMatchPlanId");
  const approvedPlanId = stringField(eventDoc, "approvedMatchPlanId");
  const eventMatchIds = arrayStrings(eventDoc, "officialMatchIds");

  console.log("Verified approval state:");
  console.log(`  plan.status: ${planStatus}`);
  console.log(`  event.approvedMatchPlanId: ${approvedPlanId}`);
  console.log(`  official Match count: ${eventMatchIds.length}`);
  console.log(`  first Match: ${firstMatchId}`);
  console.log(`  match.status: ${matchStatus}`);
  console.log(`  match.sourceMatchPlanId: ${sourcePlanId}`);
  console.log(`  G1.status: ${gameStatus}`);

  if (planStatus !== "APPROVED") throw new Error("Verification failed: Match Plan is not APPROVED.");
  if (approvedPlanId !== planId) throw new Error("Verification failed: Event does not reference the approved plan.");
  if (!eventMatchIds.includes(firstMatchId)) throw new Error("Verification failed: Event does not reference the Match.");
  if (matchStatus !== "READY") throw new Error("Verification failed: Match is not READY.");
  if (sourcePlanId !== planId) throw new Error("Verification failed: Match source plan is incorrect.");
  if (gameStatus !== "READY") throw new Error("Verification failed: Game 1 is not READY.");

  console.log("Match Plan approval smoke test passed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
