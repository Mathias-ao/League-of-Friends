import { randomUUID } from "node:crypto";

const args = process.argv.slice(2);

function readArg(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function integerArg(name, fallback) {
  const raw = readArg(name);
  if (raw == null) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value)) throw new Error(`${name} must be an integer.`);
  return value;
}

const projectId = readArg("--project");
if (!projectId) {
  console.error("Usage: node scripts/set-emulator-replay-analysis-profile.mjs --project <project-id> [analysis options]");
  process.exit(1);
}

const config = {
  fastFeudalMaxSeconds: integerArg("--fast-feudal", 600),
  fastCastleMaxSeconds: integerArg("--fast-castle", 960),
  fastImperialMaxSeconds: integerArg("--fast-imp", 1800),
  openingCandidateMaxSeconds: integerArg("--opening-cutoff", 900),
  openingCandidateMinUnits: integerArg("--opening-min-units", 2),
  peakApmWindowsSeconds: [30, 60],
};

const name = readArg("--name") ?? "Emulator Replay Analysis Profile";
const authBase = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const functionsBase = `http://127.0.0.1:5001/${projectId}/europe-west1`;

async function parseResponse(response, label) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} returned non-JSON (${response.status}): ${text}`);
  }
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
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ data }),
  });
  const payload = await parseResponse(response, name);
  if (!response.ok || payload.error) throw new Error(`${name} failed: ${JSON.stringify(payload)}`);
  return payload.result;
}

try {
  const token = await signIn();
  console.log("Activating Replay Analysis profile:");
  console.log(JSON.stringify({ name, config }, null, 2));

  const result = await callCallable("adminSetReplayAnalysisConfig", token, {
    requestId: randomUUID(),
    name,
    config,
  });

  console.log("Activated:", JSON.stringify(result));
  console.log("Future adminProcessReplayAnalysis runs will use this profile. Replay facts are unchanged.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
