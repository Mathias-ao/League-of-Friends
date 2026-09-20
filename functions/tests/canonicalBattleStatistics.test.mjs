import test from "node:test";
import assert from "node:assert/strict";
import {
  CANONICAL_BATTLE_STATISTICS_CONTRACT_VERSION,
  CanonicalBattleStatisticsValidationError,
  buildCanonicalBattleStatisticsProjection,
} from "../lib/engines/canonicalBattleStatistics.js";

function participant(playerId, replaySlot, displayName, isRecorder = false) {
  return {
    playerId,
    replaySlot,
    displayName,
    isRecorder,
    buildOrder: { modelVersion: "AOF_BUILD_ORDER_V2", label: "Fast Castle" },
    opening: { modelVersion: "AOF_OPENING_STATISTICS_V1", housesBeforeFeudal: 2 },
    economy: {
      resourceCommitment: {
        modelVersion: "AOF_RESOURCE_COMMITMENT_V1",
        total: { food: 100, wood: 75, gold: 50, stone: 0 },
      },
    },
    combat: {
      modelVersion: "AOF_RAID_DETECTION_V1",
      raidsInitiated: 1,
      raidsAgainstPlayer: 0,
    },
    mapPresence: {
      modelVersion: "AOF_MAP_PRESENCE_V2",
      commandMapCoveragePercent: 12.5,
    },
    observedCommands: {
      count: 321,
      formulaVersion: "AOF_OBSERVED_COMMAND_FORMULAS_V1",
    },
    selectionEvidence: {
      sampleCount: 200,
      averageSelectedObjectCount: 3.2,
    },
  };
}

function projection() {
  return {
    statisticsSchemaVersion: "1.0.0",
    statisticsProjectionVersion: "AOF_CANONICAL_STATISTICS_V1",
    source: {
      replaySha256: "a".repeat(64),
      canonicalManifestSha256: "b".repeat(64),
      extractionRunId: "run-1",
      canonicalSchemaVersion: "1.1.0",
      parserVersion: "mgz-fast 1.0.0",
    },
    scope: { observedUntilMs: 1_234_567 },
    participants: [
      participant(1, 1, "Replay One", true),
      participant(2, 2, "Replay Two"),
    ],
    coverage: { complete: true },
    warnings: [],
  };
}

test("canonical Battle Statistics map replay identities onto durable league players", () => {
  const result = buildCanonicalBattleStatisticsProjection({
    projection: projection(),
    playerMapping: [
      { playerId: "league-a", canonicalPlayerId: 1, replaySlot: 1 },
      { playerId: "league-b", canonicalPlayerId: 2, replaySlot: 2 },
    ],
  });

  assert.equal(result.contractVersion, CANONICAL_BATTLE_STATISTICS_CONTRACT_VERSION);
  assert.equal(result.source.replaySha256, "a".repeat(64));
  assert.deepEqual(
    result.participants.map((player) => [player.playerId, player.canonicalPlayerId, player.replaySlot]),
    [["league-a", 1, 1], ["league-b", 2, 2]],
  );
  assert.equal(result.participants[0].military.modelVersion, "AOF_RAID_DETECTION_V1");
  assert.equal(result.participants[0].execution.observedCommands.count, 321);
  assert.equal("combat" in result.participants[0], false);
  assert.equal("isRecorder" in result.participants[0], false);
});

test("canonical Battle Statistics reject mismatched player mappings", () => {
  assert.throws(
    () => buildCanonicalBattleStatisticsProjection({
      projection: projection(),
      playerMapping: [
        { playerId: "league-a", canonicalPlayerId: 1, replaySlot: 2 },
        { playerId: "league-b", canonicalPlayerId: 2, replaySlot: 1 },
      ],
    }),
    CanonicalBattleStatisticsValidationError,
  );
});

test("canonical Battle Statistics reject obsolete projection versions", () => {
  const wrongVersion = projection();
  wrongVersion.statisticsProjectionVersion = "AOF_CANONICAL_STATISTICS_V0";

  assert.throws(
    () => buildCanonicalBattleStatisticsProjection({
      projection: wrongVersion,
      playerMapping: [
        { playerId: "league-a", canonicalPlayerId: 1, replaySlot: 1 },
        { playerId: "league-b", canonicalPlayerId: 2, replaySlot: 2 },
      ],
    }),
    /Unsupported statistics projection/,
  );
});
