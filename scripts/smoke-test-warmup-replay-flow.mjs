import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";

const args = process.argv.slice(2);

function readArg(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

const projectId = readArg("--project");
const pythonExecutable = readArg("--python") ?? "python";
const firestorePort = readArg("--firestore-port") ?? "8085";
const fixtureDir = readArg("--fixture-dir") ?? "replay-fixtures";
const canonicalRoot = readArg("--canonical-root") ?? "replay-ingest-output";

if (!projectId) {
  console.error(
    "Usage: node scripts/smoke-test-warmup-replay-flow.mjs --project <project-id> " +
    "[--python python] [--fixture-dir replay-fixtures] [--canonical-root replay-ingest-output]",
  );
  process.exit(1);
}

const adminEmail = "emperor@league.local";
const adminPassword = ["league", "emulator", "admin", "only"].join("-");
const authBase = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const functionsBase = "http://127.0.0.1:5001/" + projectId + "/europe-west1";
const firestoreBase =
  "http://127.0.0.1:" +
  firestorePort +
  "/v1/projects/" +
  projectId +
  "/databases/(default)/documents";

async function parseResponse(response, label) {
  const body = await response.text();
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(label + " returned non-JSON (" + response.status + "): " + body);
  }
}

async function authRequest(endpoint, body) {
  const response = await fetch(authBase + "/" + endpoint + "?key=fake-api-key", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await parseResponse(response, "Auth " + endpoint);
  if (!response.ok) {
    throw new Error("Auth " + endpoint + " failed: " + JSON.stringify(payload));
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
    password: "test-" + randomUUID(),
    returnSecureToken: true,
  });
}

async function callCallable(name, token, data) {
  const response = await fetch(functionsBase + "/" + name, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer " + token,
    },
    body: JSON.stringify({ data }),
  });
  const payload = await parseResponse(response, name);
  if (!response.ok || payload.error) {
    throw new Error(name + " failed: " + JSON.stringify(payload));
  }
  return payload.result;
}

async function readDocument(documentPath, token, allowMissing = false) {
  const response = await fetch(firestoreBase + "/" + documentPath, {
    headers: { authorization: "Bearer " + token },
  });
  if (response.status === 404 && allowMissing) return null;
  const payload = await parseResponse(response, "Firestore " + documentPath);
  if (!response.ok) {
    throw new Error(
      "Firestore read failed for " + documentPath + ": " + JSON.stringify(payload),
    );
  }
  return payload;
}

function stringField(document, field) {
  return document?.fields?.[field]?.stringValue ?? null;
}

function numberValue(value, fallback = null) {
  if (!value) return fallback;
  if (value.integerValue != null) return Number(value.integerValue);
  if (value.doubleValue != null) return Number(value.doubleValue);
  return fallback;
}

function mapFields(document, field) {
  return document?.fields?.[field]?.mapValue?.fields ?? {};
}

function arrayValues(document, field) {
  return document?.fields?.[field]?.arrayValue?.values ?? [];
}

function parseFixturePlayers(fixturePath) {
  const parserPath = path.resolve("replay-tools", "parse_replay.py");
  const result = spawnSync(
    pythonExecutable,
    [parserPath, path.resolve(fixturePath)],
    { encoding: "utf8", windowsHide: true },
  );

  if (result.error) {
    throw new Error("Could not start replay parser: " + result.error.message);
  }
  if (result.status !== 0) {
    throw new Error(
      "Replay parser failed (" +
        result.status +
        "):\n" +
        (result.stderr || result.stdout),
    );
  }

  const parsed = JSON.parse(result.stdout);
  const players = Array.isArray(parsed.sourcePlayers) ? parsed.sourcePlayers : [];
  if (players.length !== 2) {
    throw new Error(
      "Warmup fixture must contain exactly two source players; found " +
        players.length +
        ".",
    );
  }
  if (
    players.some(
      (player) => !player.sourceName || !String(player.sourceName).trim(),
    )
  ) {
    throw new Error(
      "Warmup fixture source players must have names for automatic league mapping.",
    );
  }
  if (new Set(players.map((player) => player.sourceName)).size !== 2) {
    throw new Error("Warmup fixture source player names must be unique.");
  }

  return players.sort((left, right) => left.replaySlot - right.replaySlot);
}

function runIngestion(matchId, fixturePath, outputRoot) {
  const result = spawnSync(
    process.execPath,
    [
      path.resolve("scripts", "ingest-replay-file.mjs"),
      "--project",
      projectId,
      "--match",
      matchId,
      "--game",
      "G1",
      "--file",
      path.resolve(fixturePath),
      "--python",
      pythonExecutable,
      "--firestore-port",
      firestorePort,
      "--canonical-root",
      outputRoot,
    ],
    { stdio: "inherit", windowsHide: true },
  );

  if (result.error) {
    throw new Error("Could not start replay ingestion: " + result.error.message);
  }
  if (result.status !== 0) {
    throw new Error(
      "Replay ingestion failed with exit code " + result.status + ".",
    );
  }
}

try {
  const runTag = randomUUID().replaceAll("-", "").slice(0, 10);
  const fixtureOne = path.resolve(fixtureDir, "1v1_1.aoe2record");
  const fixtureTwo = path.resolve(fixtureDir, "1v1_2.aoe2record");
  const replayPlayers = parseFixturePlayers(fixtureOne);

  const adminAuth = await signInAdmin();
  const adminToken = adminAuth.idToken;
  const league = await callCallable("getLeagueBootstrap", adminToken, {});
  if (!league.activeSeason?.seasonId) {
    throw new Error(
      "An active emulator Season is required. Run scripts/create-emulator-season.mjs first.",
    );
  }

  const now = Date.now();
  const startsAt = new Date(now + 2 * 60 * 60 * 1000).toISOString();
  const endsAt = new Date(now + 4 * 60 * 60 * 1000).toISOString();
  const signupDeadlineAt = new Date(now + 60 * 60 * 1000).toISOString();
  const checkInOpensAt = new Date(now - 60 * 1000).toISOString();

  console.log(
    "Creating 1v1 warmup Event with civilization drafting disabled...",
  );
  const created = await callCallable("adminCreateEvent", adminToken, {
    requestId: randomUUID(),
    title: "Replay Warmup — " + runTag,
    description:
      "Mock 1v1 warmup used to exercise replay ingestion and Battle Statistics.",
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
      maps: { pool: ["Arabia"], selectionMode: "UNRESTRICTED" },
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
      additionalSettings: { warmup: true },
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
    eventId: created.eventId,
    featured: false,
  });

  console.log(
    "Generating two emulator-only Emperor's Favors for the warmup players...",
  );
  const favorBatch = await callCallable(
    "adminGenerateEmperorsFavors",
    adminToken,
    {
      batchName: "Warmup Replay " + runTag,
      count: 2,
    },
  );
  if (!Array.isArray(favorBatch.favors) || favorBatch.favors.length !== 2) {
    throw new Error(
      "Expected exactly two generated Emperor's Favors for the warmup players.",
    );
  }

  console.log("Creating two warmup players from replay identities...");
  const testPlayers = [];
  for (let index = 0; index < replayPlayers.length; index += 1) {
    const replayPlayer = replayPlayers[index];
    const user = await createTestUser(
      "warmup-" + runTag + "-" + (index + 1) + "@league.local",
    );
    const membership = await callCallable(
      "requestLeagueMembership",
      user.idToken,
      {
        steamName: replayPlayer.sourceName,
        discordName: null,
        favor: favorBatch.favors[index].code,
      },
    );
    if (membership.membershipStatus !== "ACTIVE") {
      throw new Error(
        "Warmup fixture player was not admitted as an ACTIVE league member.",
      );
    }

    await callCallable("enterSeason", user.idToken, {
      seasonId: league.activeSeason.seasonId,
    });
    await callCallable("setEventRsvp", user.idToken, {
      eventId: created.eventId,
      rsvp: "YES",
    });
    await callCallable("checkInToEvent", user.idToken, {
      eventId: created.eventId,
    });

    testPlayers.push({
      playerId: membership.playerId,
      replaySlot: replayPlayer.replaySlot,
      steamName: replayPlayer.sourceName,
    });
    console.log(
      "  slot " +
        replayPlayer.replaySlot +
        " -> " +
        replayPlayer.sourceName +
        " -> " +
        membership.playerId,
    );
  }

  const generated = await callCallable(
    "adminGenerateMatchPlan",
    adminToken,
    {
      requestId: randomUUID(),
      eventId: created.eventId,
    },
  );
  if (
    generated.matches?.length !== 1 ||
    generated.matches[0]?.format !== "ONE_V_ONE"
  ) {
    throw new Error(
      "Warmup planner did not produce exactly one ONE_V_ONE Match.",
    );
  }

  const approved = await callCallable(
    "adminApproveMatchPlan",
    adminToken,
    {
      requestId: randomUUID(),
      eventId: created.eventId,
      planId: generated.planId,
    },
  );
  if (
    !Array.isArray(approved.officialMatchIds) ||
    approved.officialMatchIds.length !== 1
  ) {
    throw new Error(
      "Warmup approval did not produce exactly one official Match.",
    );
  }
  const matchId = approved.officialMatchIds[0];

  const [gameBefore, draftDocument] = await Promise.all([
    readDocument("matches/" + matchId + "/games/G1", adminToken),
    readDocument(
      "matches/" + matchId + "/civilizationDrafts/G1",
      adminToken,
      true,
    ),
  ]);

  if (stringField(gameBefore, "civilizationDraftId") !== null) {
    throw new Error(
      "Warmup Game unexpectedly references a civilization draft.",
    );
  }
  if (draftDocument !== null) {
    throw new Error(
      "Warmup Match unexpectedly created a civilization draft document.",
    );
  }
  console.log("Verified warmup drafting: disabled.");

  const outputRoot = path.resolve(canonicalRoot, "warmup-" + runTag);
  console.log("Ingesting first POV fixture...");
  runIngestion(matchId, fixtureOne, outputRoot);

  const gameAfterFirst = await readDocument(
    "matches/" + matchId + "/games/G1",
    adminToken,
  );
  const firstRawStatsId = stringField(gameAfterFirst, "activeRawStatsId");
  const firstMatchStatisticsId = stringField(
    gameAfterFirst,
    "activeMatchStatisticsId",
  );
  const firstRawRevision = numberValue(
    gameAfterFirst.fields?.rawStatsRevision,
  );
  const firstStatisticsRevision = numberValue(
    gameAfterFirst.fields?.matchStatisticsRevision,
  );

  if (
    !firstRawStatsId ||
    !firstMatchStatisticsId ||
    firstRawRevision !== 1 ||
    firstStatisticsRevision !== 1
  ) {
    throw new Error(
      "First POV did not create raw replay evidence and Canonical Match Statistics revision 1.",
    );
  }

  const firstStatistics = await readDocument(
    "matches/" +
      matchId +
      "/games/G1/matchStatistics/" +
      firstMatchStatisticsId,
    adminToken,
  );
  if (
    stringField(firstStatistics, "statisticsProjectionVersion") !==
    "AOF_CANONICAL_STATISTICS_V1"
  ) {
    throw new Error(
      "First POV stored the wrong Canonical Statistics projection version.",
    );
  }

  console.log(
    "Ingesting second POV fixture as the active replay/statistics revision...",
  );
  runIngestion(matchId, fixtureTwo, outputRoot);

  const gameAfterSecond = await readDocument(
    "matches/" + matchId + "/games/G1",
    adminToken,
  );
  const secondRawStatsId = stringField(gameAfterSecond, "activeRawStatsId");
  const secondMatchStatisticsId = stringField(
    gameAfterSecond,
    "activeMatchStatisticsId",
  );
  const secondRawRevision = numberValue(
    gameAfterSecond.fields?.rawStatsRevision,
  );
  const secondStatisticsRevision = numberValue(
    gameAfterSecond.fields?.matchStatisticsRevision,
  );

  if (
    !secondRawStatsId ||
    secondRawStatsId === firstRawStatsId ||
    secondRawRevision !== 2
  ) {
    throw new Error(
      "Second POV did not supersede raw replay evidence as revision 2.",
    );
  }
  if (
    !secondMatchStatisticsId ||
    secondMatchStatisticsId === firstMatchStatisticsId ||
    secondStatisticsRevision !== 2
  ) {
    throw new Error(
      "Second POV did not supersede Canonical Match Statistics as revision 2.",
    );
  }

  const [preservedFirst, activeSecond] = await Promise.all([
    readDocument(
      "matches/" +
        matchId +
        "/games/G1/matchStatistics/" +
        firstMatchStatisticsId,
      adminToken,
    ),
    readDocument(
      "matches/" +
        matchId +
        "/games/G1/matchStatistics/" +
        secondMatchStatisticsId,
      adminToken,
    ),
  ]);

  if (!preservedFirst) {
    throw new Error(
      "Superseded Canonical Match Statistics revision 1 was not preserved.",
    );
  }
  if (
    stringField(activeSecond, "supersedesMatchStatisticsId") !==
    firstMatchStatisticsId
  ) {
    throw new Error(
      "Active Canonical Match Statistics revision 2 does not point to revision 1.",
    );
  }
  if (
    stringField(activeSecond, "contractVersion") !==
    "AOF_CANONICAL_MATCH_STATISTICS_V1"
  ) {
    throw new Error(
      "Active Canonical Match Statistics uses the wrong ingestion contract.",
    );
  }

  const statisticsFields = mapFields(activeSecond, "statistics");
  const projectedParticipants =
    statisticsFields.participants?.arrayValue?.values ?? [];
  if (projectedParticipants.length !== 2) {
    throw new Error(
      "Active Canonical Match Statistics does not contain exactly two projected participants.",
    );
  }

  for (const value of projectedParticipants) {
    const participant = value.mapValue?.fields ?? {};
    for (const field of [
      "opening",
      "economy",
      "combat",
      "mapPresence",
      "observedCommands",
      "selectionEvidence",
    ]) {
      if (!participant[field]?.mapValue) {
        throw new Error(
          "Projected participant is missing Battle statistics field " +
            field +
            ".",
        );
      }
    }
  }

  if (arrayValues(activeSecond, "playerMapping").length !== 2) {
    throw new Error(
      "Active Canonical Match Statistics does not retain the two-player league mapping.",
    );
  }

  console.log("Warmup replay conclusion integration passed.");
  console.log("  Event: " + created.eventId);
  console.log("  Match: " + matchId);
  console.log("  Drafting: disabled / no draft document");
  console.log(
    "  POV 1 raw revision: " +
      firstRawRevision +
      " | statistics revision: " +
      firstStatisticsRevision,
  );
  console.log(
    "  POV 2 raw revision: " +
      secondRawRevision +
      " | statistics revision: " +
      secondStatisticsRevision,
  );
  console.log("  Active projection: AOF_CANONICAL_STATISTICS_V1");
  console.log("  Canonical artifacts: " + outputRoot);
  console.log(
    "  Test players: " +
      testPlayers.map((player) => player.steamName).join(" vs "),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
