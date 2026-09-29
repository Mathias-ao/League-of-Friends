import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EXPERIENCE_VERSION,
  METRICS,
  StatisticsExperience,
  projectStatistics,
} from '../lib/engines/statisticsExperience.js';

const metricIds = new Set(METRICS.map(metric => metric.id));

function player(playerId, team, overrides = {}) {
  const values = Object.fromEntries(METRICS.map(metric => [metric.id, null]));
  const models = Object.fromEntries(METRICS.map(metric => [metric.id, 'TEST_MODEL_V1']));
  Object.assign(values, overrides);
  return {
    playerId,
    name: playerId,
    team,
    civilization: null,
    opening: null,
    mainUnit: null,
    values,
    unavailable: {},
    models,
    composition: null,
    responseTimes: [],
    byAge: {},
    details: [],
  };
}

function game(id, players) {
  return {
    version: EXPERIENCE_VERSION,
    matchId: id,
    gameId: 'g1',
    seasonId: 's1',
    eventId: null,
    format: players.length === 2 ? 'ONE_V_ONE' : 'TWO_V_TWO',
    contextKey: 'standard',
    orderAtMs: Number(id.replace(/\D/g, '')) || 1,
    revision: 1,
    sourceHash: `hash-${id}`,
    eligible: true,
    exclusionReason: null,
    affectsSeason: true,
    affectsLifetime: true,
    durationMs: 2_000_000,
    players,
    episodes: [],
    evidenceTruncated: false,
    warnings: [],
  };
}

test('Season showcase catalogue exposes the requested metrics', () => {
  assert.equal(EXPERIENCE_VERSION, 'AOF_STATISTICS_EXPERIENCE_V2');
  for (const id of [
    'villagers10', 'darkAgeGap', 'firstMiningCamp', 'firstLumberCamp', 'commands5',
    'housesBuilt', 'tradeUnits', 'tributeSent', 'tributeReceived', 'militaryTechs',
    'contact', 'expansionTCs',
  ]) assert.ok(metricIds.has(id), `missing ${id}`);

  assert.equal(METRICS.find(metric => metric.id === 'tradeUnits')?.eligibility, 'team');
  assert.equal(METRICS.find(metric => metric.id === 'tributeSent')?.eligibility, 'team');
  assert.equal(METRICS.find(metric => metric.id === 'tributeReceived')?.eligibility, 'team');
});

test('team-only Season averages exclude 1v1 Games from the denominator', () => {
  const games = [
    game('m1', [player('p1', 1, {tradeUnits: 99, tributeSent: 999}), player('x1', 2)]),
    game('m2', [player('p1', 1, {tradeUnits: 10, tributeSent: 300}), player('ally-a', 1), player('x2', 2), player('x3', 2)]),
    game('m3', [player('p1', 1, {tradeUnits: 20, tributeSent: 500}), player('ally-b', 1), player('x4', 2), player('x5', 2)]),
  ];
  const row = new StatisticsExperience(games).aggregate('average').find(item => item.playerId === 'p1');
  assert.ok(row);
  assert.equal(row.games, 3);
  assert.deepEqual(row.values.tradeUnits, {value: 15, samples: 2, eligibleGames: 2, models: ['TEST_MODEL_V1']});
  assert.deepEqual(row.values.tributeSent, {value: 400, samples: 2, eligibleGames: 2, models: ['TEST_MODEL_V1']});
});

test('canonical projection maps successor Battle fields into Season measurements', () => {
  const projected = projectStatistics({
    statisticsProjectionVersion: 'AOF_CANONICAL_STATISTICS_V1',
    scope: {observedUntilMs: 2_000_000},
    participants: [{
      playerId: 1,
      replaySlot: 1,
      displayName: 'Replay Player',
      buildOrder: {label: 'Scout Rush'},
      opening: {modelVersion: 'AOF_OPENING_STATISTICS_V6', ageUp: {}},
      economy: {
        modelVersion: 'AOF_ECONOMY_STATISTICS_V5',
        villagersBy10Minutes: {count: 31},
        firstMiningCamp: {atMs: 420000},
        firstLumberCamp: {atMs: 160000},
        housesBuilt: {count: 15},
        tradeUnitsTrained: {count: 7},
        tributeSent: {resourceAmount: 350},
        tributeReceived: {resourceAmount: 200},
      },
      military: {
        modelVersion: 'AOF_MILITARY_STATISTICS_V5',
        militaryTechs: {count: 14},
        engagements: {},
        composition: {},
      },
      mapPresence: {
        modelVersion: 'AOF_MAP_PRESENCE_V7',
        enemyBaseContact: {atMs: 500000},
        expansionTownCenters: {count: 2},
      },
      execution: {
        modelVersion: 'AOF_EXECUTION_STATISTICS_V2',
        commandsFirstFiveMinutes: {count: 180},
        longestActionGapDarkAge: {valueMs: 17500},
      },
    }],
    warnings: [],
  }, {
    matchId: 'm1', gameId: 'g1', seasonId: 's1', eventId: null, format: 'ONE_V_ONE',
    contextKey: 'standard', orderAtMs: 1, revision: 1, sourceHash: 'hash', eligible: true,
    exclusionReason: null, affectsSeason: true, affectsLifetime: true,
    roster: [{playerId: 'league-p1', steamName: 'League Player', team: 1}],
    mapping: [{replaySlot: 1, playerId: 'league-p1'}],
  });
  const values = projected.players[0].values;
  assert.equal(values.villagers10, 31);
  assert.equal(values.darkAgeGap, 17500);
  assert.equal(values.firstMiningCamp, 420000);
  assert.equal(values.firstLumberCamp, 160000);
  assert.equal(values.commands5, 180);
  assert.equal(values.housesBuilt, 15);
  assert.equal(values.tradeUnits, 7);
  assert.equal(values.tributeSent, 350);
  assert.equal(values.tributeReceived, 200);
  assert.equal(values.militaryTechs, 14);
  assert.equal(values.contact, 500000);
  assert.equal(values.expansionTCs, 2);
});
