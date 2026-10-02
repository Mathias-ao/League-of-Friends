import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DIPLOMACY_ACTION_MODE_MAP_VERSION,
  DIPLOMACY_TIMELINE_VERSION,
  buildDiplomacyTimeline,
  diplomacyAt,
  normalizeDiplomacyActionMode,
  pairDiplomacyAt,
} from '../lib/engines/diplomacyTimeline.js';

const INITIAL='TEST_CANONICAL_INITIAL_DIPLOMACY_V1';
const ACTIONS='TEST_CANONICAL_ACTIONS_V1';

function edge(from,to,stance){
  return {fromPlayerId:from,toPlayerId:to,stance,sourceVersion:INITIAL};
}

function change(id,atMs,from,to,rawMode,operationOrdinal=1){
  return {
    eventId:id,
    atMs,
    operationOrdinal,
    fromPlayerId:from,
    toPlayerId:to,
    rawMode,
    rawCommandId:0,
    sourceVersion:ACTIONS,
  };
}

test('diplomacy timeline has explicit versioned action-mode semantics',()=>{
  assert.equal(DIPLOMACY_TIMELINE_VERSION,'AOF_DIPLOMACY_TIMELINE_V1');
  assert.equal(DIPLOMACY_ACTION_MODE_MAP_VERSION,'AOF_DIPLOMACY_ACTION_MODE_MAP_V1');
  assert.equal(normalizeDiplomacyActionMode(0),'ALLY');
  assert.equal(normalizeDiplomacyActionMode(1),'NEUTRAL');
  assert.equal(normalizeDiplomacyActionMode(3),'ENEMY');
  assert.equal(normalizeDiplomacyActionMode(2),'UNKNOWN');
  assert.equal(normalizeDiplomacyActionMode(null),'UNKNOWN');
});

test('missing initial diplomacy remains unknown rather than defaulting to enemy',()=>{
  const timeline=buildDiplomacyTimeline({playerIds:[1,2],durationMs:10_000});
  assert.equal(timeline.diagnostics.missingInitialEdges,2);
  assert.equal(diplomacyAt(timeline,1,2,1_000),'UNKNOWN');
  assert.equal(diplomacyAt(timeline,2,1,1_000),'UNKNOWN');
  assert.equal(pairDiplomacyAt(timeline,1,2,1_000),'UNKNOWN');
  assert.ok(timeline.pairSegments.every(segment=>segment.coverage==='UNAVAILABLE'));
});

test('one-sided alliance is preserved until reciprocity actually occurs',()=>{
  const timeline=buildDiplomacyTimeline({
    playerIds:[1,2],
    durationMs:60_000,
    initialEdges:[edge(1,2,'ENEMY'),edge(2,1,'ENEMY')],
    changes:[
      change('c1',10_000,1,2,0,10),
      change('c2',20_000,2,1,0,20),
    ],
  });
  assert.equal(pairDiplomacyAt(timeline,1,2,5_000),'MUTUAL_HOSTILITY');
  assert.equal(pairDiplomacyAt(timeline,1,2,15_000),'CONFLICTED');
  assert.equal(pairDiplomacyAt(timeline,1,2,25_000),'MUTUAL_ALLIANCE');
  assert.deepEqual(
    timeline.pairSegments.map(segment=>[segment.startMs,segment.endMs,segment.state]),
    [
      [0,10_000,'MUTUAL_HOSTILITY'],
      [10_000,20_000,'CONFLICTED'],
      [20_000,60_000,'MUTUAL_ALLIANCE'],
    ],
  );
});

test('breaking one direction immediately ends a mutual alliance',()=>{
  const timeline=buildDiplomacyTimeline({
    playerIds:[1,2],
    durationMs:50_000,
    initialEdges:[edge(1,2,'ALLY'),edge(2,1,'ALLY')],
    changes:[change('break',30_000,1,2,3,100)],
  });
  assert.equal(pairDiplomacyAt(timeline,1,2,29_999),'MUTUAL_ALLIANCE');
  assert.equal(pairDiplomacyAt(timeline,1,2,30_000),'CONFLICTED');
});

test('neutral-versus-ally and neutral-versus-enemy stay asymmetric instead of being flattened',()=>{
  const allied=buildDiplomacyTimeline({
    playerIds:[1,2],durationMs:100,
    initialEdges:[edge(1,2,'ALLY'),edge(2,1,'NEUTRAL')],
  });
  assert.equal(pairDiplomacyAt(allied,1,2,50),'ONE_SIDED_ALLIANCE');

  const hostile=buildDiplomacyTimeline({
    playerIds:[1,2],durationMs:100,
    initialEdges:[edge(1,2,'ENEMY'),edge(2,1,'NEUTRAL')],
  });
  assert.equal(pairDiplomacyAt(hostile,1,2,50),'ONE_SIDED_HOSTILITY');
});

test('changes are ordered by replay operation ordinal when timestamps tie',()=>{
  const timeline=buildDiplomacyTimeline({
    playerIds:[1,2],
    durationMs:1_000,
    initialEdges:[edge(1,2,'ENEMY'),edge(2,1,'ENEMY')],
    changes:[
      change('later-operation',500,1,2,3,20),
      change('earlier-operation',500,1,2,0,10),
    ],
  });
  assert.deepEqual(timeline.changes.map(item=>item.eventId),['earlier-operation','later-operation']);
  assert.equal(timeline.changes[0].previousStance,'ENEMY');
  assert.equal(timeline.changes[0].stance,'ALLY');
  assert.equal(timeline.changes[1].previousStance,'ALLY');
  assert.equal(timeline.changes[1].stance,'ENEMY');
  assert.equal(diplomacyAt(timeline,1,2,500),'ENEMY');
});

test('an unsupported runtime mode destroys certainty from that moment instead of guessing',()=>{
  const timeline=buildDiplomacyTimeline({
    playerIds:[1,2],
    durationMs:10_000,
    initialEdges:[edge(1,2,'ENEMY'),edge(2,1,'ENEMY')],
    changes:[change('unknown',4_000,1,2,99,5)],
  });
  assert.equal(timeline.diagnostics.unknownModeChanges,1);
  assert.equal(diplomacyAt(timeline,1,2,3_999),'ENEMY');
  assert.equal(diplomacyAt(timeline,1,2,4_000),'UNKNOWN');
  assert.equal(pairDiplomacyAt(timeline,1,2,5_000),'UNKNOWN');
});

test('repeated no-op diplomacy commands are retained diagnostically without inventing transitions',()=>{
  const timeline=buildDiplomacyTimeline({
    playerIds:[1,2],
    durationMs:10_000,
    initialEdges:[edge(1,2,'ENEMY'),edge(2,1,'ENEMY')],
    changes:[change('noop',2_000,1,2,3,1)],
  });
  assert.equal(timeline.changes.length,1);
  assert.equal(timeline.changes[0].changed,false);
  assert.equal(timeline.diagnostics.noOpChanges,1);
  assert.deepEqual(timeline.pairSegments.map(item=>item.state),['MUTUAL_HOSTILITY']);
});

test('invalid temporal or roster evidence is rejected rather than silently repaired',()=>{
  assert.throws(()=>buildDiplomacyTimeline({
    playerIds:[1,2],durationMs:10,
    initialEdges:[edge(1,3,'ALLY')],
  }),/outside the Battle roster/);

  assert.throws(()=>buildDiplomacyTimeline({
    playerIds:[1,2],durationMs:10,
    changes:[change('late',11,1,2,0)],
  }),/between 0 and Battle duration/);
});
