import test from "node:test";
import assert from "node:assert/strict";
import {
  CANONICAL_MATCH_STATISTICS_CONTRACT_VERSION,
  CANONICAL_STATISTICS_PROJECTION_VERSION,
  CanonicalMatchStatisticsValidationError,
  validateCanonicalMatchStatisticsIngestion,
} from "../lib/engines/canonicalMatchStatisticsIngestion.js";

const sourceHash = "a".repeat(64);

function participant(replaySlot) {
  return {
    playerId: replaySlot,
    replaySlot,
    isRecorder: replaySlot === 1,
    displayName: `Replay Player ${replaySlot}`,
    buildOrder: {},
    opening: {},
    economy: {},
    combat: {},
    mapPresence: {},
    observedCommands: {},
    selectionEvidence: {},
  };
}

function statistics(overrides = {}) {
  return {
    statisticsSchemaVersion: "1.0.0",
    statisticsProjectionVersion: CANONICAL_STATISTICS_PROJECTION_VERSION,
    source: {
      replaySha256: sourceHash,
      canonicalManifestSha256: "b".repeat(64),
      extractionRunId: "run-1",
      canonicalSchemaVersion: "1.1.0",
      parserVersion: "test",
    },
    participants: [participant(1), participant(2)],
    commandEvidence: {},
    warnings: [],
    ...overrides,
  };
}

function input(overrides = {}) {
  return {
    sourceHash,
    playerMapping: [
      { playerId: "league-b", replaySlot: 2, sourceName: "Replay Player 2" },
      { playerId: "league-a", replaySlot: 1, sourceName: "Replay Player 1" },
    ],
    statistics: statistics(),
    ...overrides,
  };
}

test("canonical match statistics ingestion accepts the current projector and normalizes mapping order", () => {
  const validated = validateCanonicalMatchStatisticsIngestion(input());

  assert.equal(CANONICAL_MATCH_STATISTICS_CONTRACT_VERSION, "AOF_CANONICAL_MATCH_STATISTICS_V1");
  assert.equal(validated.statisticsProjectionVersion, "AOF_CANONICAL_STATISTICS_V1");
  assert.equal(validated.canonicalSchemaVersion, "1.1.0");
  assert.deepEqual(validated.playerMapping.map(item => item.replaySlot), [1, 2]);
  assert.deepEqual(validated.playerMapping.map(item => item.playerId), ["league-a", "league-b"]);
});

test("canonical match statistics ingestion rejects a projection for a different replay", () => {
  assert.throws(
    () => validateCanonicalMatchStatisticsIngestion(input({
      statistics: statistics({
        source: {
          replaySha256: "c".repeat(64),
          canonicalSchemaVersion: "1.1.0",
        },
      }),
    })),
    CanonicalMatchStatisticsValidationError,
  );
});

test("canonical match statistics ingestion requires the mapping to cover the projected replay slots exactly", () => {
  assert.throws(
    () => validateCanonicalMatchStatisticsIngestion(input({
      playerMapping: [
        { playerId: "league-a", replaySlot: 1, sourceName: "Replay Player 1" },
        { playerId: "league-b", replaySlot: 3, sourceName: "Replay Player 2" },
      ],
    })),
    /cover exactly the projected statistics participants/,
  );
});

test("canonical match statistics ingestion requires all Battle statistics category inputs", () => {
  const broken = statistics();
  delete broken.participants[0].mapPresence;

  assert.throws(
    () => validateCanonicalMatchStatisticsIngestion(input({ statistics: broken })),
    /mapPresence must be an object/,
  );
});
