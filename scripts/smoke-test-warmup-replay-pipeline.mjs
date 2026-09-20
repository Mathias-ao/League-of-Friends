import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);

function readArg(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

const projectId = readArg("--project");
const pythonExecutable = readArg("--python") ?? "python";
const firestorePort = readArg("--firestore-port") ?? "8085";
const keepOutput = args.includes("--keep-output");

if (!projectId) {
  console.error(
    "Usage: node scripts/smoke-test-warmup-replay-pipeline.mjs --project <project-id> " +
    "[--python python] [--firestore-port 8085] [--keep-output]",
  );
  process.exit(1);
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const fixtures = [
  path.join(repoRoot, "replay-fixtures", "1v1_1.aoe2record"),
  path.join(repoRoot, "replay-fixtures", "1v1_2.aoe2record"),
];

for (const fixture of fixtures) {
  if (!existsSync(fixture)) {
    console.error(`Replay fixture not found: ${fixture}`);
    process.exit(1);
  }
}

const adminEmail = "emperor@league.local";
const adminPassword = "league-emulator-admin-only";
const testPassword = "warmup-replay-test-only";
const authBase = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const functionsBase = `http://127.0.0.1:5001/${projectId}/europe-west1`;
const firestoreBase =
  `http://127.0.0.1:${firestorePort}/v1/projects/${projectId}/databases/(default)/documents`;

async function parseResponse(response, label) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} returned non-JSON (${response.status}): ${text}`);
  }
}

async function authRequest(route, body) {
  const response = await fetch(`${authBase}/${route}?key=fake-api-key`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await parseResponse(response, `Auth ${route}`);
  if (!response.ok) {
    throw new Error(`Auth ${route} failed: ${JSON.stringify(payload)}`);
  }
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

async function callCallable(name, token, data = {}) {
  const response = await fetch(`${functionsBase}/${name}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ data }),
  });
  const payload = await parseResponse(response, name);
  if (!response.ok || payload.error) {
    throw new Error(`${name} failed: ${JSON.stringify(payload)}`);
  }
  return payload.result;
}

async function readDocument(documentPath, token, allowMissing = false) {
  const response = await fetch(`${firestoreBase}/${documentPath}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (response.status === 404 && allowMissing) return null;
  const payload = await parseResponse(response, `Firestore ${documentPath}`);
  if (!response.ok) {
    throw new Error(`Firestore read failed for ${documentPath}: ${JSON.stringify(payload)}`);
  }
  return payload;
}

function run(command, commandArgs, label) {
  const result = spawnSync(command, commandArgs, {
    cwd: repoRoot,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error) {
    throw new Error(`${label} could not start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `${label} failed (${result.status}):\n${result.stderr || result.stdout}`,
    );
  }
  if (result.stdout.trim()) console.log(result.stdout.trim());
}

async function projectFixture(fixture, outputRoot) {
  const fixtureName = path.basename(fixture, path.extname(fixture));
  const canonicalDir = path.join(outputRoot, `${fixtureName}-canonical`);
  const adapterFile = path.join(outputRoot, `${fixtureName}-adapter.json`);
  const statisticsFile = path.join(outputRoot, `${fixtureName}-statistics.json`);

  console.log(`\nExtracting canonical evidence from ${path.basename(fixture)}...`);
  run(
    pythonExecutable,
    [
      path.join("replay-tools", "parse_replay.py"),
      fixture,
      "--canonical-dir",
      canonicalDir,
      "--out",
      adapterFile,
    ],
    `Canonical extraction for ${path.basename(fixture)}`,
  );

  console.log(`Projecting current Battle Statistics for ${path.basename(fixture)}...`);
  run(
    pythonExecutable,
    [
      path.join("replay-tools", "statistics_projector.py"),
      canonicalDir,
      "--out",
      statisticsFile,
    ],
    `Statistics projection for ${path.basename(fixture)}`,
  );

  const [adapter, projection, fileStat] = await Promise.all([
    readFile(adapterFile, "utf8").then(JSON.parse),
    readFile(statisticsFile, "utf8").then(JSON.parse),
    stat(fixture),
  ]);

  if (adapter.sourceHash !== projection.source?.replaySha256) {
    throw new Error(
      `Source hash mismatch for ${path.basename(fixture)}: adapter=${adapter.sourceHash}, statistics=${projection.source?.replaySha256}`,
    );
  }
  if (projection.statisticsProjectionVersion !== "AOF_CANONICAL_STATISTICS_V1") {
    throw new Error(
      `Unexpected statistics projection ${projection.statisticsProjectionVersion} for ${path.basename(fixture)}.`,
    );
  }
  if (!Array.isArray(projection.participants) || projection.participants.length !== 2) {
    throw new Error(
      `Expected two canonical statistics participants in ${path.basename(fixture)}.`,
    );
  }

  return {
    fixture,
    fileName: path.basename(fixture),
    sourceByteLength: fileStat.size,
    projection,
  };
}

function mappingForGame(game, projection) {
  const leagueBySlot = new Map(game.players.map((player) => [Number(player.slot), player.playerId]));
  return projection.participants.map((participant) => {
    const playerId = leagueBySlot.get(Number(participant.replaySlot));
    if (!playerId) {
      throw new Error(
        `No league Game participant occupies replay slot ${participant.replaySlot}.`,
      );
    }
    return {
      playerId,
      canonicalPlayerId: Number(participant.playerId),
      replaySlot: Number(participant.replaySlot),
    };
  });
}

function assertBattleStatisticsPlayer(player) {
  for (const key of ["buildOrder", "opening", "economy", "military", "mapPresence", "execution"]) {
    if (!player?.[key] || typeof player[key] !== "object") {
      throw new Error(`Battle Statistics participant is missing ${key}.`);
    }
  }
}

let outputRoot = null;

try {
  outputRoot = await mkdtemp(path.join(os.tmpdir(), "aof-warmup-replay-"));
  const runTag = randomUUID().replaceAll("-", "").slice(0, 10);

  console.log("Preparing both replay POVs through the current CanonicalReplay pipeline...");
  const projectedFixtures = [];
  for (const fixture of fixtures) {
    projectedFixtures.push(await projectFixture(fixture, outputRoot));
  }

  const adminAuth = await signInAdmin();
  const adminToken = adminAuth.idToken;
  const league = await callCallable("getLeagueBootstrap", adminToken);
  if (!league.activeSeason?.seasonId) {
    throw new Error(
      "No active emulator Season exists. Run scripts/create-emulator-season.mjs before this test.",
    );
  }
  const seasonId = league.activeSeason.seasonId;

  console.log("\nCreating two warmup test players through the current Emperor's Favor membership gate...");
  const favorBatch = await callCallable("adminGenerateEmperorsFavors", adminToken, {
    batchName: `Warmup Replay Pipeline ${runTag}`,
    count: 2,
  });
  if (!Array.isArray(favorBatch.favors) || favorBatch.favors.length !== 2) {
    throw new Error("Emperor's Favor generation did not return two test codes.");
  }

  const testPlayers = [];
  for (let index = 0; index < 2; index += 1) {
    const auth = await createTestUser(`warmup-${runTag}-p${index + 1}@league.local`);
    const membership = await callCallable("requestLeagueMembership", auth.idToken, {
      steamName: `Warmup Fixture Player ${index + 1} ${runTag}`,
      discordName: null,
      favor: favorBatch.favors[index].code,
    });
    await callCallable("enterSeason", auth.idToken, { seasonId });
    testPlayers.push({
      playerId: membership.playerId,
      token: auth.idToken,
    });
    console.log(`  test player ${index + 1}: ${membership.playerId}`);
  }

  const now = Date.now();
  const startsAt = new Date(now + 30 * 60 * 1000).toISOString();
  const endsAt = new Date(now + 3 * 60 * 60 * 1000).toISOString();
  const signupDeadlineAt = new Date(now + 20 * 60 * 1000).toISOString();
  const checkInOpensAt = new Date(now - 60 * 1000).toISOString();

  console.log("\nCreating mock 1v1 warmup Event with drafting disabled...");
  const event = await callCallable("adminCreateEvent", adminToken, {
    requestId: randomUUID(),
    title: `Warmup Duel — Replay Pipeline ${runTag}`,
    description:
      "Emulator-only warmup used to validate canonical replay ingestion and Battle Statistics.",
    startsAt,
    endsAt,
    signupDeadlineAt,
    checkInOpensAt,
    minParticipants: 2,
    maxParticipants: 2,
    waitingListEnabled: false,
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
      additionalSettings: {
        warmup: true,
        replayPipelineSmokeTest: true,
      },
    },
    scoringSnapshot: { profileId: null, profileVersion: 1, rules: {} },
    goldRewardSnapshot: {
      attendance: 0,
      matchCompletion: 0,
      matchWin: 0,
      additionalRewards: {},
    },
  });

  await callCallable("adminPublishEvent", adminToken, {
    requestId: randomUUID(),
    eventId: event.eventId,
    featured: false,
  });

  for (const player of testPlayers) {
    await callCallable("setEventRsvp", player.token, {
      eventId: event.eventId,
      rsvp: "YES",
    });
    await callCallable("checkInToEvent", player.token, {
      eventId: event.eventId,
    });
  }

  const plan = await callCallable("adminGenerateMatchPlan", adminToken, {
    requestId: randomUUID(),
    eventId: event.eventId,
  });
  if (plan.matches?.length !== 1 || plan.matches[0]?.format !== "ONE_V_ONE") {
    throw new Error(`Expected one ONE_V_ONE planned Match: ${JSON.stringify(plan.matches)}`);
  }

  const approved = await callCallable("adminApproveMatchPlan", adminToken, {
    requestId: randomUUID(),
    eventId: event.eventId,
    planId: plan.planId,
  });
  const matchId = approved.officialMatchIds?.[0];
  if (!matchId) throw new Error("Approved warmup plan did not create a Match.");

  const draft = await readDocument(
    `matches/${matchId}/civilizationDrafts/G1`,
    adminToken,
    true,
  );
  if (draft !== null) {
    throw new Error("Warmup unexpectedly created a civilization draft.");
  }

  const beforeIngestion = await callCallable("getMatchDetail", adminToken, { matchId });
  const game = beforeIngestion.games?.find((candidate) => candidate.gameId === "G1");
  if (!game) throw new Error("Warmup Match is missing G1.");
  if (game.draftRequired || game.draft !== null) {
    throw new Error("Warmup G1 incorrectly requires a civilization draft.");
  }

  console.log(`  Event: ${event.eventId}`);
  console.log(`  Match: ${matchId}`);
  console.log("  Civilization draft: disabled and absent");

  console.log("\nIngesting both recorder perspectives as separate replay sources...");
  const ingestionResults = [];
  for (const projected of projectedFixtures) {
    const result = await callCallable(
      "adminIngestCanonicalBattleStatistics",
      adminToken,
      {
        requestId: randomUUID(),
        matchId,
        gameId: "G1",
        sourceFileName: projected.fileName,
        sourceByteLength: projected.sourceByteLength,
        playerMapping: mappingForGame(game, projected.projection),
        projection: projected.projection,
      },
    );
    ingestionResults.push(result);
    console.log(
      `  ${projected.fileName}: ${result.comparisonStatus}; source=${result.replaySourceId.slice(0, 12)}…`,
    );
  }

  if (ingestionResults[0].comparisonStatus !== "SELECTED_FIRST_VALID") {
    throw new Error(
      `First POV should become active, got ${ingestionResults[0].comparisonStatus}.`,
    );
  }
  if (ingestionResults[1].comparisonStatus !== "CORROBORATES_ACTIVE") {
    throw new Error(
      "Second POV does not corroborate the active shared statistics. " +
      `Got ${ingestionResults[1].comparisonStatus}.`,
    );
  }
  if (ingestionResults[1].selectedAsActive) {
    throw new Error("Second POV incorrectly replaced the active replay source.");
  }
  if (ingestionResults[0].sharedStatisticsHash !== ingestionResults[1].sharedStatisticsHash) {
    throw new Error("Paired POVs produced different shared Battle Statistics hashes.");
  }

  console.log("\nRe-ingesting the first POV to verify idempotency...");
  const duplicate = await callCallable(
    "adminIngestCanonicalBattleStatistics",
    adminToken,
    {
      requestId: randomUUID(),
      matchId,
      gameId: "G1",
      sourceFileName: projectedFixtures[0].fileName,
      sourceByteLength: projectedFixtures[0].sourceByteLength,
      playerMapping: mappingForGame(game, projectedFixtures[0].projection),
      projection: projectedFixtures[0].projection,
    },
  );
  if (!duplicate.alreadyIngested) {
    throw new Error("Exact replay-source re-ingestion was not idempotent.");
  }

  const matchDetail = await callCallable("getMatchDetail", adminToken, { matchId });
  const completedGame = matchDetail.games?.find((candidate) => candidate.gameId === "G1");
  if (!completedGame?.battleStatistics) {
    throw new Error("getMatchDetail did not expose the active Battle Statistics.");
  }
  if (completedGame.replay?.replaySourceCount !== 2) {
    throw new Error(
      `Expected two replay sources, got ${completedGame.replay?.replaySourceCount}.`,
    );
  }
  if (
    completedGame.replay.activeCanonicalReplaySourceId !==
    ingestionResults[0].replaySourceId
  ) {
    throw new Error("The corroborating POV replaced the active replay source.");
  }
  if (completedGame.battleStatistics.participants?.length !== 2) {
    throw new Error("Expected two players in exposed Battle Statistics.");
  }
  completedGame.battleStatistics.participants.forEach(assertBattleStatisticsPlayer);

  console.log("\nVerified warmup replay pipeline:");
  console.log("  warmup Event created: yes");
  console.log("  1v1 Match created: yes");
  console.log("  civilization drafting: disabled");
  console.log("  canonical replay sources retained: 2");
  console.log("  second POV corroborates first: yes");
  console.log("  duplicate ingestion idempotent: yes");
  console.log(
    `  statistics projection: ${completedGame.battleStatistics.statisticsProjectionVersion}`,
  );
  console.log("  Battle Statistics categories: Opening, Economy, Military, Map Presence, Execution");
  console.log(`  active source: ${completedGame.replay.activeCanonicalReplaySourceId}`);
  console.log(`  shared statistics hash: ${ingestionResults[0].sharedStatisticsHash}`);
  console.log("\nWarmup canonical replay pipeline smoke test passed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  if (outputRoot) {
    if (keepOutput) {
      console.log(`Canonical test output retained at: ${outputRoot}`);
    } else {
      await rm(outputRoot, { recursive: true, force: true });
    }
  }
}
