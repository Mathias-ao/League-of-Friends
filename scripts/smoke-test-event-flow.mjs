import { randomUUID } from "node:crypto";

const args = process.argv.slice(2);

function readArg(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

const projectId = readArg("--project");
const firestorePort = readArg("--firestore-port") ?? "8085";

if (!projectId) {
  console.error("Usage: node scripts/smoke-test-event-flow.mjs --project <project-id>");
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

try {
  const idToken = await signIn();
  const health = await callCallable("backendHealth", idToken, {});
  const playerId = health.playerId;

  const now = Date.now();
  const startsAt = new Date(now + 2 * 60 * 60 * 1000).toISOString();
  const endsAt = new Date(now + 5 * 60 * 60 * 1000).toISOString();
  const signupDeadlineAt = new Date(now + 60 * 60 * 1000).toISOString();
  const checkInOpensAt = new Date(now - 60 * 1000).toISOString();

  console.log("Creating emulator Event...");
  const created = await callCallable("adminCreateEvent", idToken, {
    requestId: randomUUID(),
    title: "First Blood — Emulator Event",
    description: "End-to-end test of Event publishing, RSVP, and check-in.",
    startsAt,
    endsAt,
    signupDeadlineAt,
    checkInOpensAt,
    minParticipants: 2,
    maxParticipants: 8,
    waitingListEnabled: true,
    signupRosterVisibility: "VISIBLE",
    competitionStyle: "ONE_V_ONE",
    planningConfig: {
      prioritizeLargestTeams: false,
      preferredTeamSize: null,
      allowAsymmetricTeams: false,
      philosophy: "BALANCED",
      balanceWeight: 1,
    },
    gameConfig: {
      maps: {
        pool: ["Arabia"],
        selectionMode: "ADMIN",
      },
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
    scoringSnapshot: {
      profileId: null,
      profileVersion: 1,
      rules: {},
    },
    goldRewardSnapshot: {
      attendance: 10,
      matchCompletion: 10,
      matchWin: 5,
      additionalRewards: {},
    },
  });
  console.log("Created:", JSON.stringify(created));

  const published = await callCallable("adminPublishEvent", idToken, {
    requestId: randomUUID(),
    eventId: created.eventId,
    featured: true,
  });
  console.log("Published:", JSON.stringify(published));

  const rsvp = await callCallable("setEventRsvp", idToken, {
    eventId: created.eventId,
    rsvp: "YES",
  });
  console.log("RSVP:", JSON.stringify(rsvp));

  const checkIn = await callCallable("checkInToEvent", idToken, {
    eventId: created.eventId,
  });
  console.log("Check-in:", JSON.stringify(checkIn));

  const [eventDoc, participantDoc, leagueStateDoc] = await Promise.all([
    readDocument(`events/${created.eventId}`, idToken),
    readDocument(`events/${created.eventId}/participants/${playerId}`, idToken),
    readDocument("leagueState/singleton", idToken),
  ]);

  const eventStatus = stringField(eventDoc, "status");
  const rsvpStatus = stringField(participantDoc, "rsvp");
  const signupState = stringField(participantDoc, "signupState");
  const attendanceStatus = stringField(participantDoc, "attendanceStatus");
  const featuredEventId = stringField(leagueStateDoc, "featuredEventId");

  console.log("Verified Event state:");
  console.log(`  event.status: ${eventStatus}`);
  console.log(`  participant.rsvp: ${rsvpStatus}`);
  console.log(`  participant.signupState: ${signupState}`);
  console.log(`  participant.attendanceStatus: ${attendanceStatus}`);
  console.log(`  leagueState.featuredEventId: ${featuredEventId}`);

  if (eventStatus !== "PUBLISHED") throw new Error("Verification failed: Event is not PUBLISHED.");
  if (rsvpStatus !== "YES") throw new Error("Verification failed: RSVP is not YES.");
  if (signupState !== "CONFIRMED") throw new Error("Verification failed: signup is not CONFIRMED.");
  if (attendanceStatus !== "CHECKED_IN") throw new Error("Verification failed: player is not CHECKED_IN.");
  if (featuredEventId !== created.eventId) throw new Error("Verification failed: Event is not featured.");

  console.log("Event workflow emulator smoke test passed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
