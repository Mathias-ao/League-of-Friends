import { randomUUID } from "node:crypto";

const args = process.argv.slice(2);

function readArg(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function numberArg(name, fallback) {
  const raw = readArg(name);
  if (raw == null) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${name} must be a number.`);
  return value;
}

const projectId = readArg("--project");
if (!projectId) {
  console.error("Usage: node scripts/set-emulator-power-rating-profile.mjs --project <project-id> [rating options]");
  process.exit(1);
}

const config = {
  baseRating: numberArg("--base", 1000),
  provisionalMatchCount: numberArg("--provisional-matches", 5),
  provisionalK: numberArg("--provisional-k", 48),
  establishedK: numberArg("--established-k", 24),
  ratingScale: numberArg("--scale", 400),
  teamSizeBonus: numberArg("--team-size-bonus", 200),
  minimumRating: readArg("--minimum-rating") == null ? null : numberArg("--minimum-rating", 0),
  rounding: "NEAREST_INTEGER",
  ffaMode: "WINNER_VS_FIELD_ZERO_SUM",
};

const name = readArg("--name") ?? "Emulator Power Rating Profile";
const authBase = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const functionsBase = `http://127.0.0.1:5001/${projectId}/europe-west1`;

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
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`${name} returned non-JSON (${response.status}): ${text}`);
  }
  if (!response.ok || payload.error) throw new Error(`${name} failed: ${JSON.stringify(payload)}`);
  return payload.result;
}

try {
  const token = await signIn();
  console.log("Activating Power Rating profile:");
  console.log(JSON.stringify({ name, config }, null, 2));

  const result = await callCallable("adminSetPowerRatingConfig", token, {
    requestId: randomUUID(),
    name,
    config,
  });

  console.log("Activated:", JSON.stringify(result));
  console.log("Run adminProcessPowerRatings (or the Power Rating smoke test) to rebuild history with this profile.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
