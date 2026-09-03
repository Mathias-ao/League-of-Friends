const args = process.argv.slice(2);
function readArg(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

const projectId = readArg("--project");
const matchId = readArg("--match");
const firestorePort = readArg("--firestore-port") ?? "8085";
if (!projectId || !matchId) {
  console.error("Usage: node scripts/smoke-test-v1-read-models.mjs --project <project-id> --match <match-id>");
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

async function readDocument(path, token) {
  const response = await fetch(`${firestoreBase}/${path}`, { headers: { authorization: `Bearer ${token}` } });
  const payload = await parseResponse(response, `Firestore ${path}`);
  if (!response.ok) throw new Error(`Firestore read failed for ${path}: ${JSON.stringify(payload)}`);
  return payload;
}

function stringField(document, field) {
  return document.fields?.[field]?.stringValue ?? null;
}

function participantIds(document) {
  return (document.fields?.participants?.arrayValue?.values ?? [])
    .map((value) => value.mapValue?.fields?.playerId?.stringValue)
    .filter(Boolean);
}

try {
  const token = await signIn();
  const match = await readDocument(`matches/${matchId}`, token);
  const eventId = stringField(match, "eventId");
  const players = participantIds(match);
  if (!eventId) throw new Error("Synthetic Match has no eventId; cannot verify Event detail.");
  if (!players.length) throw new Error("Synthetic Match has no participants; cannot verify Player profile.");

  const [bootstrap, eventDetail, playerProfile, warRoom, matchDetail] = await Promise.all([
    callCallable("getLeagueBootstrap", token),
    callCallable("getEventDetail", token, { eventId }),
    callCallable("getPlayerProfile", token, { playerId: players[0] }),
    callCallable("getWarRoom", token),
    callCallable("getMatchDetail", token, { matchId }),
  ]);

  if (bootstrap.schemaVersion !== "LEAGUE_BOOTSTRAP_V1") {
    throw new Error(`Unexpected bootstrap schema ${bootstrap.schemaVersion}.`);
  }
  if (eventDetail.schemaVersion !== "EVENT_DETAIL_V1") {
    throw new Error(`Unexpected Event detail schema ${eventDetail.schemaVersion}.`);
  }
  if (!eventDetail.matches.some((item) => item.matchId === matchId)) {
    throw new Error(`Event detail did not include ${matchId}.`);
  }
  if (playerProfile.schemaVersion !== "PLAYER_PROFILE_V1" || playerProfile.player.playerId !== players[0]) {
    throw new Error("Player profile did not return the requested participant.");
  }
  if (warRoom.schemaVersion !== "WAR_ROOM_V1") {
    throw new Error(`Unexpected War Room schema ${warRoom.schemaVersion}.`);
  }
  if (matchDetail.schemaVersion !== "MATCH_DETAIL_V1" || matchDetail.match.matchId !== matchId) {
    throw new Error("Match detail did not return the requested Match.");
  }
  if (!matchDetail.games.length || !matchDetail.games.some((game) => game.gameId === "G1")) {
    throw new Error("Match detail did not expose the synthetic Game.");
  }

  console.log("V1 read models:");
  console.log(`  viewer: ${bootstrap.viewer.steamName} (${bootstrap.viewer.playerId})`);
  console.log(`  active season: ${bootstrap.activeSeason?.name ?? "none"}`);
  console.log(`  event: ${eventDetail.event.title} (${eventId})`);
  console.log(`  event matches: ${eventDetail.matches.length}`);
  console.log(`  match: ${matchDetail.match.matchId}; games=${matchDetail.games.map((game) => game.gameId).join(", ")}`);
  console.log(`  profile: ${playerProfile.player.steamName} (${players[0]})`);
  console.log(`  profile lifetime matches: ${playerProfile.lifetime.competition?.matchesPlayed ?? 0}`);
  console.log(`  War Room: ${warRoom.status}; leaderboard rows=${warRoom.leaderboard.length}`);
  console.log(`  pending incoming challenge: ${bootstrap.warRoom.pendingIncomingChallenge?.challengeId ?? "none"}`);
  console.log("V1 read model smoke test passed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
