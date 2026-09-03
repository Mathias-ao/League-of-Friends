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
  console.error("Usage: node scripts/smoke-test-match-rewards.mjs --project <project-id> --match <match-id>");
  process.exit(1);
}

const authBase = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const functionsBase = `http://127.0.0.1:5001/${projectId}/europe-west1`;
const firestoreBase = `http://127.0.0.1:${firestorePort}/v1/projects/${projectId}/databases/(default)/documents`;

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
  const payload = await response.json();
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
  const payload = await response.json();
  if (!response.ok || payload.error) throw new Error(`${name} failed: ${JSON.stringify(payload)}`);
  return payload.result;
}

async function readDocument(path, token) {
  const response = await fetch(`${firestoreBase}/${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`Firestore read failed for ${path}: ${JSON.stringify(payload)}`);
  return payload;
}

function stringField(document, field) {
  return document.fields?.[field]?.stringValue ?? null;
}

function numberValue(value, fallback = 0) {
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
    throw new Error("Match must be COMPLETED before reward processing.");
  }

  const participants = participantMaps(match);
  const canonical = mapFields(match, "canonicalResult");
  const winners = new Set(
    (canonical.winningPlayerIds?.arrayValue?.values ?? []).map((value) => value.stringValue),
  );
  const revision = numberValue(canonical.revision, 1);
  const goldSnapshot = mapFields(match, "goldRewardSnapshot");
  const scoringSnapshot = mapFields(match, "scoringSnapshot");
  const scoringRules = scoringSnapshot.rules?.mapValue?.fields ?? {};

  const matchCompletionGold = numberValue(goldSnapshot.matchCompletion);
  const matchWinGold = numberValue(goldSnapshot.matchWin);
  const matchCompletionPoints = numberValue(scoringRules.matchCompletionPoints);
  const matchWinPoints = numberValue(scoringRules.matchWinPoints);

  const expectedGold = participants.length * matchCompletionGold + winners.size * matchWinGold;
  const expectedLeaguePoints = participants.length * matchCompletionPoints + winners.size * matchWinPoints;

  console.log(`Processing rewards for ${matchId} revision ${revision}...`);
  const processed = await callCallable("adminProcessMatchRewards", token, {
    requestId: randomUUID(),
    matchId,
  });
  console.log("Processed:", JSON.stringify(processed));

  if (!processed.alreadyProcessed) {
    if (processed.goldDelta !== expectedGold) {
      throw new Error(`Expected Gold delta ${expectedGold}, got ${processed.goldDelta}.`);
    }
    if (processed.leaguePointDelta !== expectedLeaguePoints) {
      throw new Error(`Expected League Point delta ${expectedLeaguePoints}, got ${processed.leaguePointDelta}.`);
    }
  }

  const jobId = `MATCH_RESULT_${matchId}_R${revision}`;
  const job = await readDocument(`processingJobs/${jobId}`, token);
  const completedSteps = stringArray(job, "completedSteps");
  if (!completedSteps.includes("SCORING") || !completedSteps.includes("GOLD")) {
    throw new Error("Processing job did not mark SCORING and GOLD complete.");
  }

  console.log("Verified reward processing:");
  console.log(`  result revision: ${revision}`);
  console.log(`  participants: ${participants.length}`);
  console.log(`  winners: ${winners.size}`);
  console.log(`  League Point delta: ${processed.leaguePointDelta}`);
  console.log(`  Gold delta: ${processed.goldDelta}`);
  console.log(`  job.status: ${stringField(job, "status")}`);
  console.log(`  completed steps: ${completedSteps.join(", ")}`);
  console.log("Match reward processing smoke test passed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
