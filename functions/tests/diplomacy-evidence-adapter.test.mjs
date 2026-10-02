import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DIPLOMACY_EVIDENCE_ADAPTER_VERSION,
  INITIAL_DIPLOMACY_HEADER_MAP_VERSION,
  buildDiplomacyTimelineFromCanonicalEvidence,
  initialEdgesFromHeaderRaw,
  normalizeInitialHeaderDiplomacyValue,
} from '../lib/engines/diplomacyEvidenceAdapter.js';
import {pairDiplomacyAt} from '../lib/engines/diplomacyTimeline.js';

test('initial header diplomacy uses its own qualified enum domain',()=>{
  assert.equal(INITIAL_DIPLOMACY_HEADER_MAP_VERSION,'AOF_INITIAL_DIPLOMACY_HEADER_MAP_V1');
  assert.equal(normalizeInitialHeaderDiplomacyValue(2),'ALLY');
  assert.equal(normalizeInitialHeaderDiplomacyValue(3),'NEUTRAL');
  assert.equal(normalizeInitialHeaderDiplomacyValue(4),'ENEMY');
  assert.equal(normalizeInitialHeaderDiplomacyValue(0),'UNKNOWN');
  assert.equal(normalizeInitialHeaderDiplomacyValue(1),'UNKNOWN');
});

test('header raw matrix is indexed by replay slot including Gaia at index zero',()=>{
  const raw={
    '1':[0,1,4,2],
    '2':[0,4,1,3],
    '3':[0,2,3,1],
  };
  const result=initialEdgesFromHeaderRaw({playerIds:[1,2,3],initialDiplomacyRaw:raw});
  const byKey=new Map(result.edges.map(edge=>[`${edge.fromPlayerId}->${edge.toPlayerId}`,edge.stance]));
  assert.equal(byKey.get('1->2'),'ENEMY');
  assert.equal(byKey.get('1->3'),'ALLY');
  assert.equal(byKey.get('2->1'),'ENEMY');
  assert.equal(byKey.get('2->3'),'NEUTRAL');
  assert.equal(byKey.get('3->1'),'ALLY');
  assert.equal(byKey.get('3->2'),'NEUTRAL');
  assert.equal(result.unknownValues,0);
});

test('canonical initialDiplomacy outranks the raw-header compatibility fallback',()=>{
  const result=buildDiplomacyTimelineFromCanonicalEvidence({
    playerIds:[1,2],durationMs:10_000,canonicalSchemaVersion:'CANONICAL_TEST_V1',events:[],
    canonicalInitialDiplomacy:[
      {fromPlayerId:1,toPlayerId:2,stance:'ally'},
      {fromPlayerId:2,toPlayerId:1,stance:'ally'},
    ],
    matchSettings:{initialDiplomacyRaw:{'1':[0,1,4],'2':[0,4,1]}},
  });
  assert.equal(result.adapterVersion,DIPLOMACY_EVIDENCE_ADAPTER_VERSION);
  assert.equal(result.initialSource,'CANONICAL');
  assert.equal(pairDiplomacyAt(result.timeline,1,2,1_000),'MUTUAL_ALLIANCE');
});

test('current canonical settings fallback recovers initial FFA diplomacy without pretending it is native canonical data',()=>{
  const result=buildDiplomacyTimelineFromCanonicalEvidence({
    playerIds:[1,2],durationMs:20_000,canonicalSchemaVersion:'CANONICAL_TEST_V1',events:[],
    canonicalInitialDiplomacy:[],
    matchSettings:{initialDiplomacyRaw:{'1':[0,1,4],'2':[0,4,1]}},
  });
  assert.equal(result.initialSource,'HEADER_RAW_FALLBACK');
  assert.equal(result.diagnostics.fallbackInitialEdges,2);
  assert.equal(pairDiplomacyAt(result.timeline,1,2,1_000),'MUTUAL_HOSTILITY');
});

test('runtime diplomacy changes use canonical event order and the separate action enum domain',()=>{
  const result=buildDiplomacyTimelineFromCanonicalEvidence({
    playerIds:[1,2],durationMs:30_000,canonicalSchemaVersion:'CANONICAL_TEST_V1',
    matchSettings:{initialDiplomacyRaw:{'1':[0,1,4],'2':[0,4,1]}},
    events:[
      {eventId:'c1',eventType:'command.diplomacy_change',timestampMs:10_000,operationOrdinal:10,actorPlayerId:1,targetPlayerId:2,payload:{command_id:0,diplomacy_mode:0}},
      {eventId:'c2',eventType:'command.diplomacy_change',timestampMs:12_000,operationOrdinal:20,actorPlayerId:2,targetPlayerId:1,payload:{command_id:0,diplomacy_mode:0}},
      {eventId:'c3',eventType:'command.diplomacy_change',timestampMs:20_000,operationOrdinal:30,actorPlayerId:1,targetPlayerId:2,payload:{command_id:0,diplomacy_mode:3}},
    ],
  });
  assert.equal(pairDiplomacyAt(result.timeline,1,2,5_000),'MUTUAL_HOSTILITY');
  assert.equal(pairDiplomacyAt(result.timeline,1,2,11_000),'CONFLICTED');
  assert.equal(pairDiplomacyAt(result.timeline,1,2,15_000),'MUTUAL_ALLIANCE');
  assert.equal(pairDiplomacyAt(result.timeline,1,2,25_000),'CONFLICTED');
});

test('missing header rows remain unavailable instead of being filled from lobby-team assumptions',()=>{
  const result=buildDiplomacyTimelineFromCanonicalEvidence({
    playerIds:[1,2],durationMs:10_000,canonicalSchemaVersion:'CANONICAL_TEST_V1',events:[],matchSettings:{},
  });
  assert.equal(result.initialSource,'MISSING');
  assert.equal(pairDiplomacyAt(result.timeline,1,2,1_000),'UNKNOWN');
  assert.equal(result.timeline.diagnostics.missingInitialEdges,2);
});

test('diplomacy chronology rejects a change with no operation ordinal',()=>{
  assert.throws(()=>buildDiplomacyTimelineFromCanonicalEvidence({
    playerIds:[1,2],durationMs:10_000,canonicalSchemaVersion:'CANONICAL_TEST_V1',
    matchSettings:{initialDiplomacyRaw:{'1':[0,1,4],'2':[0,4,1]}},
    events:[{eventId:'bad',eventType:'command.diplomacy_change',timestampMs:5_000,actorPlayerId:1,targetPlayerId:2,payload:{command_id:0,diplomacy_mode:0}}],
  }),/lacks actor, target, or operation ordinal/);
});
