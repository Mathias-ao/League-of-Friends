import { randomUUID } from "node:crypto";

const args = process.argv.slice(2);

function readArg(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

const projectId = readArg("--project");
const name = readArg("--name") ?? "Season 1 (Emulator)";
const startsAt = readArg("--starts") ?? "2026-09-01T00:00:00+02:00";
const endsAt = readArg("--ends") ?? "2027-03-01T00:00:00+01:00";
const firestorePort = readArg("--firestore-port") ?? "8085";

if (!projectId) {
  console.error(
    "Usage: node scripts/create-emulator-season.mjs --project <project-id> [--name \"Season 1\"] [--starts <ISO>] [--ends <ISO>]",
  );
  process.exit(1);
}

const email = "emperor@league.local";
const password = "league-emulator-admin-only";
const authBase = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const functionsBase = `http://127.0.0.1:5001/${projectId}/europe-west1`;

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

async function readLeagueState() {
  const url = `http://127.0.0.1:${firestorePort}/v1/projects/${projectId}/databases/(default)/documents/leagueState/singleton`;
  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Could not read leagueState from Firestore emulator: ${JSON.stringify(payload)}`);
  }
  return payload;
}

function readStringField(fields, name) {
  return fields?.[name]?.stringValue ?? null;
}

try {
  const idToken = await signIn();

  console.log(`Creating ${name}...`);
  const created = await callCallable("adminCreateSeason", idToken, {
    requestId: randomUUID(),
    name,
    startsAt,
    endsAt,
  });

  console.log("Created:", JSON.stringify(created));

  const activated = await callCallable("adminActivateSeason", idToken, {
    requestId: randomUUID(),
    seasonId: created.seasonId,
  });

  console.log("Activated:", JSON.stringify(activated));

  const leagueState = await readLeagueState();
  const fields = leagueState.fields ?? {};
  const warRoomFields = fields.warRoom?.mapValue?.fields ?? {};

  console.log("Verified league state:");
  console.log(`  activeSeasonId: ${readStringField(fields, "activeSeasonId")}`);
  console.log(`  warRoom.status: ${readStringField(warRoomFields, "status")}`);
  console.log(`  warRoom.seasonId: ${readStringField(warRoomFields, "seasonId")}`);

  if (readStringField(fields, "activeSeasonId") !== created.seasonId) {
    throw new Error("Verification failed: activeSeasonId does not match the created Season.");
  }
  if (readStringField(warRoomFields, "status") !== "CLOSED") {
    throw new Error("Verification failed: War Room is not CLOSED.");
  }

  console.log("Season 1 emulator smoke test passed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
