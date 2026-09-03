const args = process.argv.slice(2);
function readArg(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

const projectId = readArg("--project");
const expectedMatchId = readArg("--match") ?? null;
if (!projectId) {
  console.error("Usage: node scripts/smoke-test-league-bootstrap.mjs --project <project-id> [--match <match-id>]");
  process.exit(1);
}

const authBase = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const functionsBase = `http://127.0.0.1:5001/${projectId}/europe-west1`;

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

async function callCallable(name, token, data = {}) {
  const response = await fetch(`${functionsBase}/${name}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ data }),
  });
  const payload = await parseResponse(response, name);
  if (!response.ok || payload.error) throw new Error(`${name} failed: ${JSON.stringify(payload)}`);
  return payload.result;
}

try {
  const token = await signIn();
  const result = await callCallable("getLeagueBootstrap", token);

  if (result.schemaVersion !== "LEAGUE_BOOTSTRAP_V1") {
    throw new Error(`Unexpected bootstrap schema ${result.schemaVersion}.`);
  }
  if (!result.viewer?.playerId) throw new Error("Bootstrap is missing the authenticated viewer.");
  if (!Array.isArray(result.leaderboard)) throw new Error("Bootstrap leaderboard is not an array.");
  if (!Array.isArray(result.activity)) throw new Error("Bootstrap activity is not an array.");
  if (!result.warRoom || typeof result.warRoom.visible !== "boolean") {
    throw new Error("Bootstrap is missing War Room visibility state.");
  }

  if (expectedMatchId && !result.activity.some((item) => item.matchId === expectedMatchId)) {
    throw new Error(`Expected activity feed to contain Match ${expectedMatchId}.`);
  }

  console.log("League bootstrap query:");
  console.log(`  viewer: ${result.viewer.steamName} (${result.viewer.playerId})`);
  console.log(`  season: ${result.activeSeason?.name ?? "none"}`);
  console.log(`  upcoming event: ${result.upcomingEvent?.title ?? "none"}`);
  console.log(`  leaderboard rows: ${result.leaderboard.length}`);
  console.log(`  activity rows: ${result.activity.length}`);
  console.log(`  War Room: ${result.warRoom.status}; canChallenge=${result.warRoom.canChallenge}`);
  if (expectedMatchId) console.log(`  verified activity Match: ${expectedMatchId}`);
  console.log("League bootstrap smoke test passed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
