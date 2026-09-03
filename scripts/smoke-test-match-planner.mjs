import { randomUUID } from "node:crypto";

const args = process.argv.slice(2);

function readArg(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

const projectId = readArg("--project");
const firestorePort = readArg("--firestore-port") ?? "8085";

if (!projectId) {
  console.error("Usage: node scripts/smoke-test-match-planner.mjs --project <project-id>");
  process.exit(1);
}

const adminEmail = "emperor@league.local";
const adminPassword = "league-emulator-admin-only";
const testPassword = "planner-test-only";
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

async function signInAdmin() {
  return authRequest("accounts:signInWithPassword", {
    email: adminEmail,
    password: adminPassword,
    returnSecureToken: true,
  });
}

async function createTestUser(email) {
  return authRequest("accounts:signUp", {
    email,
    password: testPassword,
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

function stringField(document, field) {
  return document.fields?.[field]?.stringValue ?? null;
}

try {
  const runTag = randomUUID().replaceAll("-", "").slice(0, 10);
  const adminAuth = await signInAdmin();
  const adminToken = adminAuth.idToken;

  const now = Date.now();
  const startsAt = new Date(now + 2 * 60 * 60 * 1000).toISOString();
  const endsAt = new Date(now + 5 * 60 * 60 * 1000).toISOString();
  const signupDeadlineAt = new Date(now + 60 * 60 * 1000).toISOString();
  const checkInOpensAt = new Date(now - 60 * 1000).toISOString();

  console.log("Creating 8-player Big Team emulator Event...");
  const created = await callCallable("adminCreateEvent", adminToken, {
    requestId: randomUUID(),
    title: `Eight Banners — Planner Test ${runTag}`,
    description: "End-to-end test of membership, RSVP, check-in, and 4v4 Match Plan generation.",
    startsAt,
    endsAt,
    signupDeadlineAt,
    checkInOpensAt,
    minParticipants: 8,
    maxParticipants: 8,
    waitingListEnabled: true,
    signupRosterVisibility: "VISIBLE",
    competitionStyle: "BIG_TEAM",
    planningConfig: {
      prioritizeLargestTeams: true,
      preferredTeamSize: 4,
      allowAsymmetricTeams: true,
      philosophy: "BALANCED",
      balanceWeight: 1,
    },
    gameConfig: {
      maps: { pool: ["Arabia"], selectionMode: "ADMIN" },
      civilizations: {
        mode: "UNRESTRICTED",
        allowed: [],
        banned: [],
        customRuleCode: null,
      },
      victory: {
        conquest: true,
        wonder: false,
        relic: false,
        customRuleCode: null,
      },
      diplomacyEnabled: false,
      additionalSettings: {},
    },
    scoringSnapshot: { profileId: null, profileVersion: 1, rules: {} },
    goldRewardSnapshot: {
      attendance: 10,
      matchCompletion: 10,
      matchWin: 5,
      additionalRewards: {},
    },
  });

  await callCallable("adminPublishEvent", adminToken, {
    requestId: randomUUID(),
    eventId: created.eventId,
    featured: false,
  });

  await callCallable("setEventRsvp", adminToken, { eventId: created.eventId, rsvp: "YES" });
  await callCallable("checkInToEvent", adminToken, { eventId: created.eventId });
  console.log("Admin checked in (1/8). Creating seven normal emulator members...");

  const playerIds = [];
  for (let index = 1; index <= 7; index += 1) {
    const email = `planner-${runTag}-${index}@league.local`;
    const user = await createTestUser(email);
    const membership = await callCallable("requestLeagueMembership", user.idToken, {
      steamName: `Planner Bot ${index}`,
      discordName: null,
    });

    await callCallable("adminSetMembershipStatus", adminToken, {
      requestId: randomUUID(),
      playerId: membership.playerId,
      status: "ACTIVE",
      reason: "Emulator Match Planner smoke test",
    });

    await callCallable("setEventRsvp", user.idToken, {
      eventId: created.eventId,
      rsvp: "YES",
    });
    await callCallable("checkInToEvent", user.idToken, {
      eventId: created.eventId,
    });

    playerIds.push(membership.playerId);
    console.log(`  Player ${index} active and checked in (${index + 1}/8).`);
  }

  console.log("Generating Match Plan...");
  const generated = await callCallable("adminGenerateMatchPlan", adminToken, {
    requestId: randomUUID(),
    eventId: created.eventId,
  });

  if (generated.matches.length !== 1) {
    throw new Error(`Expected one Match, got ${generated.matches.length}.`);
  }

  const match = generated.matches[0];
  if (match.format !== "FOUR_V_FOUR") {
    throw new Error(`Expected FOUR_V_FOUR, got ${match.format}.`);
  }
  if (match.participants.length !== 8) {
    throw new Error(`Expected 8 Match participants, got ${match.participants.length}.`);
  }
  if (generated.sittingOutPlayerIds.length !== 0) {
    throw new Error("Expected no sitting-out players in an 8-player Big Team Event.");
  }

  const teamOne = match.participants.filter((participant) => participant.team === 1);
  const teamTwo = match.participants.filter((participant) => participant.team === 2);
  if (teamOne.length !== 4 || teamTwo.length !== 4) {
    throw new Error(`Expected 4v4 teams, got ${teamOne.length}v${teamTwo.length}.`);
  }

  const planDocument = await readDocument(
    `events/${created.eventId}/matchPlans/${generated.planId}`,
    adminToken,
  );

  const planStatus = stringField(planDocument, "status");
  const plannerVersion = stringField(planDocument, "plannerVersion");
  if (planStatus !== "PROPOSED") throw new Error(`Expected PROPOSED plan, got ${planStatus}.`);
  if (plannerVersion !== "MATCH_PLANNER_V1") {
    throw new Error(`Expected MATCH_PLANNER_V1, got ${plannerVersion}.`);
  }

  console.log("Match Plan generated and verified:");
  console.log(`  Event ID: ${created.eventId}`);
  console.log(`  Plan ID: ${generated.planId}`);
  console.log(`  Format: ${match.format}`);
  console.log(`  Team 1: ${teamOne.map((participant) => participant.playerId).join(", ")}`);
  console.log(`  Team 2: ${teamTwo.map((participant) => participant.playerId).join(", ")}`);
  console.log(
    `  Estimated win chance: ${(match.balanceEstimate.teamOneWinProbability * 100).toFixed(1)}% / ${(match.balanceEstimate.teamTwoWinProbability * 100).toFixed(1)}%`,
  );
  console.log("8-player Big Team Match Planner smoke test passed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
