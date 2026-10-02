import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DIPLOMACY_ACTION_MODE_MAP_VERSION,
  DIPLOMACY_TIMELINE_VERSION,
  buildDiplomacyTimeline,
  classifyPairDiplomacy,
  diplomacyAt,
  normalizeDiplomacyActionMode,
  pairDiplomacyAt,
} from '../lib/engines/diplomacyTimeline.js';
import {
  DIPLOMACY_EVIDENCE_ADAPTER_VERSION,
  buildDiplomacyTimelineFromCanonicalEvidence,
} from '../lib/engines/diplomacyEvidenceAdapter.js';

const initial=(fromPlayerId,toPlayerId,stance)=>({fromPlayerId,toPlayerId,stance,sourceVersion:'CANONICAL_TEST_V1'});
const change=(eventId,atMs,operationOrdinal,fromPlayerId,toPlayerId,rawMode)=>({
  eventId,atMs,operationOrdinal,fromPlayerId,toPlayerId,rawMode,rawCommandId:0,sourceVersion:'CANONICAL_TEST_V1',
});
const moment=(atMs,operationOrdinal)=>({atMs,operationOrdinal});

test('diplomacy V1 constants identify independent versioned contracts',()=>{
  assert.equal(DIPLOMACY_TIMELINE_VERSION,'AOF_DIPLOMACY_TIMELINE_V1');
  assert.equal(DIPLOMACY_ACTION_MODE_MAP_VERSION,'AOF_DIPLOMACY_ACTION_MODE_MAP_V1');
  assert.equal(DIPLOMACY_EVIDENCE_ADAPTER_VERSION,'AOF_DIPLOMACY_EVIDENCE_ADAPTER_V1');
});

test('runtime diplomacy modes preserve the qualified AoE2 action enum and unknown stays unknown',()=>{
  assert.equal(normalizeDiplomacyActionMode(0),'ALLY');
  assert.equal(normalizeDiplomacyActionMode(1),'NEUTRAL');
  assert.equal(normalizeDiplomacyActionMode(3),'ENEMY');
  assert.equal(normalizeDiplomacyActionMode(2),'UNKNOWN');
  assert.equal(normalizeDiplomacyActionMode(null),'UNKNOWN');
});

test('pair diplomacy remains directional and does not promote asymmetric stances to mutual states',()=>{
  assert.equal(classifyPairDiplomacy('ALLY','NEUTRAL'),'ONE_SIDED_ALLIANCE');
  assert.equal(classifyPairDiplomacy('NEUTRAL','ENEMY'),'ONE_SIDED_HOSTILITY');
  assert.equal(classifyPairDiplomacy('ALLY','ENEMY'),'CONFLICTED');
  assert.equal(classifyPairDiplomacy('ALLY','ALLY'),'MUTUAL_ALLIANCE');
  assert.equal(classifyPairDiplomacy('ENEMY','ENEMY'),'MUTUAL_HOSTILITY');
  assert.equal(classifyPairDiplomacy('NEUTRAL','NEUTRAL'),'MUTUAL_NEUTRALITY');
  assert.equal(classifyPairDiplomacy('UNKNOWN','ALLY'),'UNKNOWN');
});

test('same-millisecond diplomacy is resolved by operation ordinal',()=>{
  const timeline=buildDiplomacyTimeline({
    playerIds:[1,2],durationMs:10_000,
    initialEdges:[initial(1,2,'ENEMY'),initial(2,1,'ENEMY')],
    changes:[
      change('a-allies-b',1000,10,1,2,0),
      change('b-allies-a',1000,12,2,1,0),
    ],
  });

  assert.equal(pairDiplomacyAt(timeline,1,2,moment(1000,9)),'MUTUAL_HOSTILITY');
  assert.equal(pairDiplomacyAt(timeline,1,2,moment(1000,10)),'CONFLICTED');
  assert.equal(pairDiplomacyAt(timeline,1,2,moment(1000,11)),'CONFLICTED');
  assert.equal(pairDiplomacyAt(timeline,1,2,moment(1000,12)),'MUTUAL_ALLIANCE');

  const pairSegments=timeline.pairSegments.filter(segment=>segment.playerOneId===1&&segment.playerTwoId===2);
  const betweenChanges=pairSegments.find(segment=>
    segment.start.atMs===1000&&segment.start.operationOrdinal===10&&
    segment.end.atMs===1000&&segment.end.operationOrdinal===12
  );
  assert.ok(betweenChanges,'the ordinal-only interval must be retained even though elapsed milliseconds are zero');
  assert.equal(betweenChanges.state,'CONFLICTED');
  assert.equal(betweenChanges.elapsedMs,0);
});

test('a mixed FFA history remains an ordered sequence instead of one Battle-wide alignment',()=>{
  const timeline=buildDiplomacyTimeline({
    playerIds:[1,2],durationMs:60_000,
    initialEdges:[initial(1,2,'ENEMY'),initial(2,1,'ENEMY')],
    changes:[
      change('a-allies-b',10_000,100,1,2,0),
      change('b-allies-a',11_000,110,2,1,0),
      change('a-enemies-b',40_000,400,1,2,3),
      change('b-enemies-a',41_000,410,2,1,3),
    ],
  });
  const states=timeline.pairSegments.map(segment=>segment.state);
  assert.deepEqual(states,[
    'MUTUAL_HOSTILITY',
    'CONFLICTED',
    'MUTUAL_ALLIANCE',
    'CONFLICTED',
    'MUTUAL_HOSTILITY',
  ]);
  assert.equal(pairDiplomacyAt(timeline,1,2,moment(20_000,200)),'MUTUAL_ALLIANCE');
  assert.equal(pairDiplomacyAt(timeline,1,2,moment(50_000,500)),'MUTUAL_HOSTILITY');
});

test('missing initial direction is unavailable rather than inferred from the opposite player stance',()=>{
  const timeline=buildDiplomacyTimeline({
    playerIds:[1,2],durationMs:5000,
    initialEdges:[initial(1,2,'ALLY')],
  });
  assert.equal(timeline.diagnostics.missingInitialEdges,1);
  assert.equal(diplomacyAt(timeline,1,2,moment(1,0)),'ALLY');
  assert.equal(diplomacyAt(timeline,2,1,moment(1,0)),'UNKNOWN');
  assert.equal(pairDiplomacyAt(timeline,1,2,moment(1,0)),'UNKNOWN');
  assert.equal(timeline.pairSegments[0].coverage,'UNAVAILABLE');
});

test('unsupported runtime stance invalidates that direction until later qualified evidence restores it',()=>{
  const timeline=buildDiplomacyTimeline({
    playerIds:[1,2],durationMs:5000,
    initialEdges:[initial(1,2,'ENEMY'),initial(2,1,'ENEMY')],
    changes:[
      change('unknown-mode',1000,10,1,2,99),
      change('known-mode',2000,20,1,2,1),
    ],
  });
  assert.equal(timeline.diagnostics.unknownModeChanges,1);
  assert.equal(pairDiplomacyAt(timeline,1,2,moment(1500,15)),'UNKNOWN');
  assert.equal(pairDiplomacyAt(timeline,1,2,moment(2500,25)),'ONE_SIDED_HOSTILITY');
});

test('no-op diplomacy commands are retained for provenance but do not manufacture state transitions',()=>{
  const timeline=buildDiplomacyTimeline({
    playerIds:[1,2],durationMs:5000,
    initialEdges:[initial(1,2,'ENEMY'),initial(2,1,'ENEMY')],
    changes:[change('still-enemy',1000,10,1,2,3)],
  });
  assert.equal(timeline.changes.length,1);
  assert.equal(timeline.changes[0].changed,false);
  assert.equal(timeline.diagnostics.noOpChanges,1);
  assert.equal(timeline.pairSegments.length,1);
  assert.equal(timeline.pairSegments[0].state,'MUTUAL_HOSTILITY');
});

test('ambiguous duplicate changes on the same directed edge and replay moment fail closed',()=>{
  assert.throws(()=>buildDiplomacyTimeline({
    playerIds:[1,2],durationMs:5000,
    initialEdges:[initial(1,2,'ENEMY'),initial(2,1,'ENEMY')],
    changes:[
      change('first',1000,10,1,2,0),
      change('second',1000,10,1,2,1),
    ],
  }),/Ambiguous diplomacy changes share the same replay moment/);
});

test('canonical adapter does not invent a header fallback when normalized initial diplomacy is absent',()=>{
  const result=buildDiplomacyTimelineFromCanonicalEvidence({
    playerIds:[1,2],durationMs:5000,
    canonicalInitialDiplomacy:[],
    events:[],
    canonicalSchemaVersion:'1.1.0-test',
  });
  assert.equal(result.timeline.diagnostics.missingInitialEdges,2);
  assert.equal(pairDiplomacyAt(result.timeline,1,2,moment(1000,10)),'UNKNOWN');
});

test('canonical adapter preserves directed initial stances and operation ordinals',()=>{
  const result=buildDiplomacyTimelineFromCanonicalEvidence({
    playerIds:[1,2],durationMs:5000,
    canonicalInitialDiplomacy:[
      {fromPlayerId:1,toPlayerId:2,stance:'enemy'},
      {fromPlayerId:2,toPlayerId:1,stance:'enemy'},
    ],
    events:[{
      eventId:'dip-1',eventType:'command.diplomacy_change',timestampMs:1000,operationOrdinal:77,
      actorPlayerId:1,targetPlayerId:2,payload:{diplomacy_mode:0,command_id:0},
    }],
    canonicalSchemaVersion:'1.1.0-test',
  });
  assert.equal(result.diagnostics.canonicalInitialEdges,2);
  assert.equal(result.diagnostics.diplomacyChangeEvents,1);
  assert.equal(result.timeline.changes[0].operationOrdinal,77);
  assert.equal(pairDiplomacyAt(result.timeline,1,2,moment(1000,76)),'MUTUAL_HOSTILITY');
  assert.equal(pairDiplomacyAt(result.timeline,1,2,moment(1000,77)),'CONFLICTED');
});

test('canonical diplomacy event without chronology-critical fields fails loudly',()=>{
  assert.throws(()=>buildDiplomacyTimelineFromCanonicalEvidence({
    playerIds:[1,2],durationMs:5000,
    canonicalInitialDiplomacy:[],
    events:[{
      eventId:'broken',eventType:'command.diplomacy_change',timestampMs:1000,
      actorPlayerId:1,targetPlayerId:2,payload:{diplomacy_mode:0},
    }],
    canonicalSchemaVersion:'1.1.0-test',
  }),/lacks actor, target, or operation ordinal/);
});
