import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHRONICLE_SOCIAL_SOURCE_PRODUCTION_ADAPTER_VERSION,
  CHRONICLE_SOCIAL_SOURCE_VERSION,
  buildProductionBattleSocialEvidence,
} from '../lib/engines/chronicleSocialSourceProductionAdapter.js';

function hostileMatrix(){return {'1':[0,1,4,4],'2':[0,4,1,4],'3':[0,4,4,1]};}
function ally12Matrix(){return {'1':[0,1,2,4],'2':[0,2,1,4],'3':[0,4,4,1]};}
function raid(id,attacker,victim,startMs,endMs){
  return {raidId:id,attackerPlayerId:attacker,victimPlayerId:victim,startedAtMs:startMs,endedAtMs:endMs,commandCount:4,strongCommandCount:2,sourceEventIds:[`${id}-a`,`${id}-b`],modelVersion:'AOF_RAID_DETECTION_V3'};
}
function diplomacy(id,atMs,from,to,rawMode,ordinal){return {eventId:id,atMs,operationOrdinal:ordinal,fromPlayerId:from,toPlayerId:to,rawMode,rawCommandId:0};}
function battle(id,edges){return {battleId:id,directedInteractionEdges:edges};}
function edge(from,to,startMs,endMs,confidence='high'){
  return {fromPlayerId:from,toPlayerId:to,firstAtMs:startMs,lastAtMs:endMs,confidence,sourceEventIds:[`edge-${from}-${to}-${startMs}`]};
}
function source({matrix=hostileMatrix(),diplomacyCommands=[],raids=[],battles=[],reinforcements=[],defensiveAssists=[],tributeCommands=[],forwardBuildings=[],enemyBaseContacts=[],cooperativeAttacks=[]}={}){
  return {
    schemaVersion:CHRONICLE_SOCIAL_SOURCE_VERSION,
    source:{replaySha256:'a'.repeat(64),canonicalSchemaVersion:'1.0.0',statisticsProjectionVersion:'AOF_CANONICAL_STATISTICS_V1'},
    match:{durationMs:60_000,settings:{initialDiplomacyRaw:matrix,lockTeams:false}},
    playerIds:[1,2,3],initialDiplomacy:[],diplomacyCommands,tributeCommands,raids,battles,
    reinforcements,defensiveAssists,cooperativeAttacks,forwardBuildings,enemyBaseContacts,
    coverage:{bodyFramingStatus:'complete'},
    semantics:{diplomacyCommandsAreRequestedChanges:true,tributeCommandsAreNotSettledTransfers:true,engagementsAreInferredFromCommands:true,narrativeOrRelationshipInterpretationIncluded:false},
  };
}
function pair(result,a,b){return result.pairEvidence.find(item=>item.playerOneId===Math.min(a,b)&&item.playerTwoId===Math.max(a,b));}

test('production adapter is separately versioned and emits every unordered pair',()=>{
  assert.equal(CHRONICLE_SOCIAL_SOURCE_PRODUCTION_ADAPTER_VERSION,'AOF_CHRONICLE_SOCIAL_SOURCE_PRODUCTION_ADAPTER_V1');
  const result=buildProductionBattleSocialEvidence({matchId:'M1',source:source()});
  assert.equal(result.pairEvidence.length,3);
});

test('qualified hostile raid is promoted with event provenance',()=>{
  const result=buildProductionBattleSocialEvidence({matchId:'M1',source:source({raids:[raid('r1',1,2,10_000,12_000)]})});
  assert.equal(result.diagnostics.raidCandidatesSeen,1);
  assert.equal(result.diagnostics.raidObservationsEmitted,1);
  assert.equal(result.diagnostics.raidCandidatesSuppressedAllied,0);
  assert.equal(result.diagnostics.raidCandidatesSuppressedUnknownDiplomacy,0);
  const beat=pair(result,1,2).beats.find(item=>item.type==='RAID_PRESSURE');
  assert.ok(beat);
  assert.deepEqual(beat.evidenceEventIds,['r1-a','r1-b']);
});

test('raid crossing an alliance boundary is conservatively suppressed and diagnosed as allied',()=>{
  const result=buildProductionBattleSocialEvidence({matchId:'M1',source:source({
    raids:[raid('before',1,2,8_000,9_000),raid('cross',1,2,9_500,10_500)],
    diplomacyCommands:[diplomacy('ally',10_000,1,2,0,10)],
  })});
  assert.equal(result.diagnostics.raidCandidatesSeen,2);
  assert.equal(result.diagnostics.raidObservationsEmitted,1);
  assert.equal(result.diagnostics.raidCandidatesSuppressedAllied,1);
  assert.equal(result.diagnostics.raidCandidatesSuppressedUnknownDiplomacy,0);
});

test('unknown initial diplomacy suppresses raid instead of inventing hostility',()=>{
  const result=buildProductionBattleSocialEvidence({matchId:'M1',source:source({matrix:{},raids:[raid('r1',1,2,10_000,12_000)]})});
  assert.equal(result.diagnostics.raidObservationsEmitted,0);
  assert.equal(result.diagnostics.raidCandidatesSuppressedUnknownDiplomacy,1);
  assert.equal(pair(result,1,2).coverage.diplomacy,'UNAVAILABLE');
});

test('direct engagement keeps directed source evidence and remains temporal',()=>{
  const result=buildProductionBattleSocialEvidence({matchId:'M1',source:source({battles:[battle('b1',[edge(1,2,20_000,21_000)])]})});
  const beat=pair(result,1,2).beats.find(item=>item.type==='DIRECT_CONTEST');
  assert.ok(beat);
  assert.equal(beat.sourcePlayerId,1);
  assert.equal(beat.targetPlayerId,2);
  assert.deepEqual(beat.evidenceEventIds,['edge-1-2-20000']);
});

test('fixed-team support is emitted only under mutual alliance at the evidence time',()=>{
  const reinforcement={reinforcementId:'reinforce-1',helperPlayerId:1,supportedPlayerId:2,startedAtMs:15_000,endedAtMs:16_000,sourceEventIds:['reinforce-event']};
  const allied=buildProductionBattleSocialEvidence({matchId:'M1',source:source({matrix:ally12Matrix(),reinforcements:[reinforcement]})});
  assert.ok(pair(allied,1,2).beats.some(item=>item.type==='ALLY_REINFORCEMENT'));
  const hostile=buildProductionBattleSocialEvidence({matchId:'M1',source:source({reinforcements:[reinforcement]})});
  assert.ok(!pair(hostile,1,2).beats.some(item=>item.type==='ALLY_REINFORCEMENT'));
});

test('invalid support interval beyond Battle duration is rejected before persistence',()=>{
  const reinforcement={reinforcementId:'bad',helperPlayerId:1,supportedPlayerId:2,startedAtMs:59_000,endedAtMs:61_000,sourceEventIds:['bad-event']};
  assert.throws(()=>buildProductionBattleSocialEvidence({matchId:'M1',source:source({matrix:ally12Matrix(),reinforcements:[reinforcement]})}),/invalid social-evidence interval/);
});

test('tribute remains directed command evidence and never becomes material support',()=>{
  const tribute={eventId:'tribute-1',atMs:15_000,sourcePlayerId:1,targetPlayerId:2,resourceId:0,amount:500,food:500,wood:0,gold:0,stone:0};
  const result=buildProductionBattleSocialEvidence({matchId:'M1',source:source({tributeCommands:[tribute]})});
  assert.equal(result.tributeCommands.length,1);
  assert.equal(result.tributeCommands[0].sourcePlayerId,1);
  assert.ok(!pair(result,1,2).beats.some(item=>item.type==='MATERIAL_SUPPORT'));
});

test('enemy base contact and cooperative attack rows stay unpromoted until their semantics are qualified for this bridge',()=>{
  const result=buildProductionBattleSocialEvidence({matchId:'M1',source:source({
    enemyBaseContacts:[{sourcePlayerId:1,targetPlayerId:2,atMs:8_000,sourceEventId:'contact-1'}],
    cooperativeAttacks:[{battleId:'b1',attackerPlayerIds:[1,2],targetPlayerIds:[3],startedAtMs:20_000}],
  })});
  const beats=result.pairEvidence.flatMap(item=>item.beats);
  assert.ok(!beats.some(item=>item.type==='ENEMY_BASE_CONTACT'));
  assert.ok(!beats.some(item=>item.type==='COOPERATIVE_ATTACK'));
  assert.equal(result.diagnostics.aggregateOnlyPairSignalsNotPromoted,2);
});

test('overlapping raids against the same third player create coincident pressure without claiming cooperation',()=>{
  const result=buildProductionBattleSocialEvidence({matchId:'M1',source:source({raids:[raid('a',1,3,20_000,25_000),raid('b',2,3,22_000,27_000)]})});
  const beat=pair(result,1,2).beats.find(item=>item.type==='COINCIDENT_THIRD_PARTY_PRESSURE');
  assert.ok(beat);
  assert.equal(beat.thirdPartyPlayerId,3);
  assert.equal(beat.metadata.coordinationClaimed,false);
  assert.ok(!pair(result,1,2).beats.some(item=>item.type==='COOPERATIVE_ATTACK'));
});
