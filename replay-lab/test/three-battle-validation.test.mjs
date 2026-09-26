import assert from "node:assert/strict";
import test from "node:test";

import {
  bindBattleProjection,
  pairHistoryMatchInput,
  personalityEligibility,
  relationshipSignalsForBattle,
  resolveBattleWinner,
  toLifetimeGameInput,
  validateValidationManifest,
} from "../three-battle-validation-lib.mjs";

function manifest() {
  return {
    schemaVersion: "AOF_THREE_BATTLE_VALIDATION_V1",
    seasonId: "validation-season",
    players: {
      emperor: { playerId: "player-emperor", displayName: "Emperor" },
      challenger: { playerId: "player-challenger", displayName: "Test Player" },
    },
    battles: [1, 2, 3].map((index) => ({
      battleId: `B${index}`,
      gameId: `G${index}`,
      orderAtMs: index,
      replayPath: `replay-fixtures/1v1${index === 1 ? "" : `_${index - 1}`}.aoe2record`,
      bindings: [
        { replaySlot: 1, playerKey: "emperor", expectedReplayName: "Raw A" },
        { replaySlot: 2, playerKey: "challenger", expectedReplayName: "Raw B" },
      ],
    })),
  };
}

function projection() {
  const participant = (slot, name) => ({
    playerId: slot,
    replaySlot: slot,
    displayName: name,
    buildOrder: { label: slot === 1 ? "Scout Rush" : "Fast Castle", executionScore: 82.5 },
    opening: {
      feudalAgeUpAtMs: 600000,
      castleAgeUpAtMs: 1200000,
      imperialAgeUpAtMs: null,
      firstMilitaryUnitQueuedAtMs: 650000,
      firstMilitaryBuildingAtMs: 500000,
      firstWallAtMs: null,
      wallTilesBeforeFeudal: 0,
      wallStyle: "open",
      housesBeforeFeudal: 3,
      loomAtMs: 480000,
      loomBeforeFeudal: true,
    },
    economy: {
      resourceCommitment: {
        resourcesCommitted: { food: 100, wood: 200, gold: 50, stone: 0, total: 350 },
        byAge: {
          dark: { food: 50, wood: 50, gold: 0, stone: 0, total: 100 },
          feudal: { food: 50, wood: 150, gold: 50, stone: 0, total: 250 },
          castle: { food: 0, wood: 0, gold: 0, stone: 0, total: 0 },
          imperial: { food: 0, wood: 0, gold: 0, stone: 0, total: 0 },
        },
      },
    },
    military: {
      engagements: {
        modelVersion: "AOF_RAID_DETECTION_V3",
        raidsInitiated: slot === 1 ? 2 : 0,
        raidsAgainstYou: slot === 2 ? 2 : 0,
      },
    },
    mapPresence: {
      modelVersion: "AOF_MAP_PRESENCE_V6",
      commandCoveragePercent: 20 + slot,
      enemyBaseContactAtMs: slot === 1 ? 900000 : null,
      forwardBuildings: slot === 1 ? 3 : 0,
      forwardEco: slot === 1 ? { count: 1, ruleVersion: "AOF_FORWARD_ECO_V2" } : { count: 0, ruleVersion: "AOF_FORWARD_ECO_V2" },
      expansionZones: 2,
      goldControlSharePercent: 55,
      firstRelicTouchAtMs: null,
    },
    observedCommands: {
      count: 1000,
      ratePerObservedMinute: 35,
      firstAtMs: 1000,
      firstFiveObservedMinutesCount: 120,
      activeSecondCount: 700,
    },
    selectionEvidence: {
      averageSelectedObjectCount: 2.5,
      medianSelectedObjectCount: 2,
      maximumSelectedObjectCount: 20,
    },
  });
  return {
    statisticsProjectionVersion: "AOF_CANONICAL_STATISTICS_V1",
    source: { replaySha256: "abc", canonicalSchemaVersion: "1.1.0" },
    participants: [participant(1, "Raw A"), participant(2, "Raw B")],
    commandEvidence: { resignCommands: [{ actorPlayerId: 2 }] },
    warnings: [{ code: "REQUESTS_NOT_OUTCOMES" }],
  };
}

test("manifest is deliberately exactly three 1v1 Battles", () => {
  const value = manifest();
  assert.equal(validateValidationManifest(value), value);
  value.battles.pop();
  assert.throws(() => validateValidationManifest(value), /exactly three Battles/);
});

test("identity substitution happens after projection and preserves raw replay identity", () => {
  const value = manifest();
  const bound = bindBattleProjection(value, value.battles[0], projection());
  assert.equal(bound.participants[0].playerId, "player-emperor");
  assert.equal(bound.participants[0].sourceReplay.displayName, "Raw A");
  assert.equal(bound.participants[0].statistics.displayName, "Raw A");
  assert.equal(bound.source.replaySha256, "abc");
});

test("1v1 result resolves only from a single observed resignation when no override exists", () => {
  const value = manifest();
  const bound = bindBattleProjection(value, value.battles[0], projection());
  const winner = resolveBattleWinner(value, value.battles[0], bound);
  assert.deepEqual(winner, {
    status: "RESOLVED",
    playerId: "player-emperor",
    playerKey: "emperor",
    basis: "single_observed_resignation_in_1v1",
  });
});

test("Battle projection adapts into neutral longitudinal and directional pair inputs", () => {
  const value = manifest();
  const bound = bindBattleProjection(value, value.battles[0], projection());
  const winner = resolveBattleWinner(value, value.battles[0], bound);
  const lifetime = toLifetimeGameInput(bound, winner);
  assert.equal(lifetime.players[0].opening.buildOrder, "Scout Rush");
  assert.equal(lifetime.players[0].economy.resourceCommitment.total, 350);
  assert.equal(lifetime.players[0].mapPresence.forwardEco, 1);
  assert.equal(lifetime.players[0].won, true);

  const signals = relationshipSignalsForBattle(bound);
  assert.ok(signals.some((signal) => signal.type === "RAID" && signal.count === 2));
  assert.ok(signals.some((signal) => signal.type === "FORWARD_BUILDING" && signal.count === 3));
  assert.ok(signals.some((signal) => signal.type === "ENEMY_BASE_CONTACT" && signal.count === 1));

  const pairInput = pairHistoryMatchInput(bound, winner);
  assert.deepEqual(pairInput.canonicalResult.winningPlayerIds, ["player-emperor"]);
  assert.equal(pairInput.canonicalResult.source, "TEST_VALIDATION");
});

test("three eligible Battles unlock reveal eligibility without inventing personality rules", () => {
  assert.deepEqual(personalityEligibility("player-emperor", 3), {
    playerId: "player-emperor",
    eligibleBattles: 3,
    revealThresholdBattles: 3,
    revealEligible: true,
    interpretationStatus: "RULE_SET_REQUIRED",
  });
});
