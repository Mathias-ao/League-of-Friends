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
  console.error("Usage: node scripts/smoke-test-result-correction.mjs --project <project-id> --match <match-id> [--game G1]");
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

function integerLike(value) {
  if (!value) return null;
  if (value.integerValue != null) return Number(value.integerValue);
  if (value.doubleValue != null) return Number(value.doubleValue);
  return null;
}

function mapFields(document, field) {
  return document.fields?.[field]?.mapValue?.fields ?? {};
}

function participantMaps(document) {
  return (document.fields?.participants?.arrayValue?.values ?? [])
    .map((value) => value.mapValue?.fields ?? {});
}

try {
  const token = await signIn();
  const health = await callCallable("backendHealth", token, {});
  const beforeMatch = await readDocument(`matches/${matchId}`, token);
  const beforeGame = await readDocument(`matches/${matchId}/games/${gameId}`, token);

  if (stringField(beforeMatch, "status") !== "COMPLETED") {
    throw new Error("Expected the Match to be COMPLETED before the late-dispute test.");
  }
  if (stringField(beforeGame, "status") !== "COMPLETED") {
    throw new Error("Expected the Game to be COMPLETED before the late-dispute test.");
  }

  const participants = participantMaps(beforeMatch);
  const adminParticipant = participants.find((participant) => participant.playerId?.stringValue === health.playerId);
  if (!adminParticipant) {
    throw new Error("The emulator admin is not a participant in this Match; use the planner smoke-test Match.");
  }

  const canonicalBefore = mapFields(beforeGame, "canonicalResult");
  const oldWinnerTeam = integerLike(canonicalBefore.winnerTeam);
  if (oldWinnerTeam !== 1 && oldWinnerTeam !== 2) {
    throw new Error(`Expected a team winner of 1 or 2, got ${oldWinnerTeam}.`);
  }
  const correctedWinnerTeam = oldWinnerTeam === 1 ? 2 : 1;

  console.log(`Opening a post-completion WRONG_REPLAY dispute on ${matchId}/${gameId}...`);
  const disputed = await callCallable("disputeCanonicalGameResult", token, {
    requestId: randomUUID(),
    matchId,
    gameId,
    category: "WRONG_REPLAY",
    reason: "Emulator test: the wrong replay/result was attached after confirmation.",
  });
  console.log("Disputed:", JSON.stringify(disputed));

  const disputedMatch = await readDocument(`matches/${matchId}`, token);
  const disputedGame = await readDocument(`matches/${matchId}/games/${gameId}`, token);
  if (stringField(disputedMatch, "status") !== "DISPUTED") throw new Error("Match did not enter DISPUTED state.");
  if (stringField(disputedGame, "status") !== "DISPUTED") throw new Error("Game did not enter DISPUTED state.");

  console.log(`Correcting winner Team ${oldWinnerTeam} → Team ${correctedWinnerTeam}...`);
  const corrected = await callCallable("adminResolveCanonicalResultDispute", token, {
    requestId: randomUUID(),
    matchId,
    gameId,
    disputeId: disputed.disputeId,
    resolution: "CORRECT",
    reason: "Emulator test correction after wrong replay/result was discovered.",
    winnerTeam: correctedWinnerTeam,
  });
  console.log("Corrected:", JSON.stringify(corrected));

  const [afterMatch, afterGame, gameHistory, matchHistory, newJob] = await Promise.all([
    readDocument(`matches/${matchId}`, token),
    readDocument(`matches/${matchId}/games/${gameId}`, token),
    readDocument(`matches/${matchId}/games/${gameId}/resultHistory/R1`, token),
    readDocument(`matches/${matchId}/resultHistory/R1`, token),
    readDocument(`processingJobs/MATCH_RESULT_${matchId}_R2`, token),
  ]);

  const canonicalAfter = mapFields(afterGame, "canonicalResult");
  const newWinnerTeam = integerLike(canonicalAfter.winnerTeam);
  const revision = integerLike(canonicalAfter.revision);

  if (stringField(afterMatch, "status") !== "COMPLETED") throw new Error("Corrected Match is not COMPLETED.");
  if (stringField(afterGame, "status") !== "COMPLETED") throw new Error("Corrected Game is not COMPLETED.");
  if (newWinnerTeam !== correctedWinnerTeam) throw new Error("Corrected winner was not stored canonically.");
  if (revision !== 2) throw new Error(`Expected canonical revision 2, got ${revision}.`);
  if (integerLike(gameHistory.fields?.revision) !== 1) throw new Error("Game revision 1 history was not archived.");
  if (integerLike(matchHistory.fields?.revision) !== 1) throw new Error("Match revision 1 history was not archived.");
  if (stringField(newJob, "status") !== "PENDING") throw new Error("Correction processing job is not PENDING.");

  console.log("Verified post-completion correction:");
  console.log(`  old winnerTeam: ${oldWinnerTeam}`);
  console.log(`  new winnerTeam: ${newWinnerTeam}`);
  console.log(`  canonical revision: ${revision}`);
  console.log("  R1 history archived: yes");
  console.log(`  correction job: MATCH_RESULT_${matchId}_R2`);
  console.log("Post-completion result correction smoke test passed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
