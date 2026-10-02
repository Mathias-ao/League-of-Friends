import test from 'node:test';
import assert from 'node:assert/strict';
import {BATTLE_SOCIAL_EVIDENCE_ADAPTER_VERSION,buildBattleSocialEvidence} from '../lib/engines/battleSocialEvidenceAdapter.js';

const CANONICAL='CANONICAL_TEST_V1';
const RAID_MODEL='RAID_TEST_V1';

function raid(id,attacker,target,startMs,endMs,confidence='medium'){
  return {raidCandidateId:id,modelVersion:RAID_MODEL,attackerPlayerId:attacker,targetPlayerId:target,startMs,endMs,directTargetCommands:3,nearTargetCommands:3,uniqueTargetInstanceCount:2,highConfidenceTargetCommands:2,mediumConfidenceTargetCommands:1,targetFocusShare:50,distanceToTargetAnchorTiles:10,eventIds:[`${id}-1`,`${id}-2`],centroid:{x:10,y:10},confidence,formatCaution:'ffa_conservative'};
}
function support(id,helper,defended,enemy,responseAtMs){
  return {helperPlayerId:helper,defendedPlayerId:defended,enemyPlayerId:enemy,raidCandidateId:id,responseAtMs,responseDelayMs:5000,sourceEventId:`support-${id}`,confidence:'high'};
}
function analysis({players=[1,2,3],raids=[],supportCandidates=[],pairInteractions=[],teamInteractions=[]}={}){
  return {
    schemaVersion:'MATCH_ANALYSIS_V1_4',sourceCanonicalSchemaVersion:CANONICAL,modelVersions:{},
    match:{matchId:'M1',durationMs:60_000,playerCount:players.length,topology:'FFA_OR_DYNAMIC',mapWidth:120,mapHeight:120},
    players:players.map(playerId=>({playerId,name:`P${playerId}`,opening:{},fundamentals:{}})),
    pairInteractions,raidCandidates:raids,teamInteractions,teamSupportCandidates:supportCandidates,diagnostics:{},
  };
}
function settings(matrix){return {initialDiplomacyRaw:matrix};}
function hostileMatrix(){return {'1':[0,1,4,4],'2':[0,4,1,4],'3':[0,4,4,1]};}
function ally12Matrix(){return {'1':[0,1,2,4],'2':[0,2,1,4],'3':[0,4,4,1]};}
function diplomacy(id,atMs,from,to,mode,ordinal){return {eventId:id,eventType:'command.diplomacy_change',timestampMs:atMs,operationOrdinal:ordinal,actorPlayerId:from,targetPlayerId:to,payload:{command_id:0,diplomacy_mode:mode}};}
function tribute(id,atMs,from,to){return {eventId:id,eventType:'command.tribute',timestampMs:atMs,operationOrdinal:99,actorPlayerId:from,targetPlayerId:to,payload:{resource_id:0,amount:500,food:500,wood:0,gold:0,stone:0}};}
function build({a=analysis(),events=[],matrix=hostileMatrix()}={}){
  return buildBattleSocialEvidence({analysis:a,canonicalEvents:events,canonicalSchemaVersion:CANONICAL,matchSettings:settings(matrix)});
}
function pair(result,a,b){return result.pairEvidence.find(item=>item.playerOneId===Math.min(a,b)&&item.playerTwoId===Math.max(a,b));}

test('Battle social evidence bridge is explicitly versioned and emits all unordered pairs',()=>{
  const result=build();
  assert.equal(result.schemaVersion,BATTLE_SOCIAL_EVIDENCE_ADAPTER_VERSION);
  assert.equal(result.schemaVersion,'AOF_BATTLE_SOCIAL_EVIDENCE_ADAPTER_V1');
  assert.equal(result.pairEvidence.length,3);
});

test('qualified FFA raid pressure is emitted with source evidence but absence coverage remains unavailable',()=>{
  const result=build({a:analysis({raids:[raid('r1',1,2,10_000,12_000)]})});
  const history=pair(result,1,2);
  const beat=history.beats.find(item=>item.type==='RAID_PRESSURE');
  assert.ok(beat);
  assert.deepEqual(beat.evidenceEventIds,['r1-1','r1-2']);
  assert.equal(beat.diplomacy?.sourceToTarget,'ENEMY');
  assert.equal(history.coverage.oppositionInteraction,'UNAVAILABLE');
  assert.equal(history.coverage.alliedCooperation,'UNAVAILABLE');
  assert.ok(!history.beats.some(item=>item.type.startsWith('NO_QUALIFYING_')));
});

test('raid candidate is suppressed when attacker had target marked ally during the raid window',()=>{
  const result=build({
    a:analysis({raids:[raid('r1',1,2,20_000,22_000)]}),
    events:[diplomacy('one-sided-ally',10_000,1,2,0,10)],
  });
  assert.equal(result.diagnostics.raidCandidatesSuppressedAllied,1);
  assert.equal(result.diagnostics.raidObservationsEmitted,0);
  assert.ok(!pair(result,1,2).beats.some(item=>item.type==='RAID_PRESSURE'));
});

test('raid before an alliance remains evidence while raid overlapping the alliance boundary is suppressed',()=>{
  const result=build({
    a:analysis({raids:[raid('before',1,2,8_000,9_000),raid('crosses',1,2,9_500,10_500)]}),
    events:[diplomacy('one-sided-ally',10_000,1,2,0,10)],
  });
  assert.equal(result.diagnostics.raidObservationsEmitted,1);
  assert.equal(result.diagnostics.raidCandidatesSuppressedAllied,1);
  assert.ok(pair(result,1,2).beats.some(item=>item.beatId==='observation:raid:before'));
  assert.ok(!pair(result,1,2).beats.some(item=>item.beatId==='observation:raid:crosses'));
});

test('unknown diplomacy suppresses FFA raid promotion instead of guessing hostility',()=>{
  const result=build({
    a:analysis({raids:[raid('r1',1,2,20_000,22_000)]}),
    matrix:{},
  });
  assert.equal(result.diagnostics.raidCandidatesSuppressedUnknownDiplomacy,1);
  assert.equal(result.diagnostics.raidObservationsEmitted,0);
  assert.equal(pair(result,1,2).coverage.diplomacy,'UNAVAILABLE');
});

test('defensive assistance is promoted only when diplomacy is mutually allied at response time',()=>{
  const mutual=build({a:analysis({supportCandidates:[support('s1',1,2,3,20_000)]}),matrix:ally12Matrix()});
  assert.equal(mutual.diagnostics.defensiveSupportObservationsEmitted,1);
  assert.ok(pair(mutual,1,2).beats.some(item=>item.type==='DEFENSIVE_ASSIST'));

  const hostile=build({a:analysis({supportCandidates:[support('s1',1,2,3,20_000)]})});
  assert.equal(hostile.diagnostics.defensiveSupportSuppressedDiplomacy,1);
  assert.ok(!pair(hostile,1,2).beats.some(item=>item.type==='DEFENSIVE_ASSIST'));
});

test('overlapping qualified raids against one third player become coincident pressure, never cooperative attack',()=>{
  const result=build({a:analysis({raids:[raid('a',1,3,20_000,25_000),raid('b',2,3,22_000,27_000)]})});
  const history=pair(result,1,2);
  const overlap=history.beats.find(item=>item.type==='COINCIDENT_THIRD_PARTY_PRESSURE');
  assert.ok(overlap);
  assert.equal(overlap.thirdPartyPlayerId,3);
  assert.equal(overlap.startMs,22_000);
  assert.equal(overlap.endMs,25_000);
  assert.equal(overlap.metadata.coordinationClaimed,false);
  assert.ok(!history.beats.some(item=>item.type==='COOPERATIVE_ATTACK'));
});

test('tribute commands are retained directionally but are not promoted to material support without transfer qualification',()=>{
  const result=build({events:[tribute('t1',15_000,1,2)]});
  assert.equal(result.tributeCommands.length,1);
  assert.equal(result.tributeCommands[0].sourcePlayerId,1);
  assert.equal(result.tributeCommands[0].targetPlayerId,2);
  assert.equal(result.tributeCommands[0].food,500);
  assert.equal(result.diagnostics.tributeCommandsRetained,1);
  assert.ok(!pair(result,1,2).beats.some(item=>item.type==='MATERIAL_SUPPORT'));
});

test('aggregate-only interaction counts are diagnosed but not promoted without event provenance',()=>{
  const aggregatePair={directHostileTargetCommands:4,forwardBuildPlacements:2,forwardWallPlacements:1,targetRegionCommands:3,deepTargetRegionCommands:2};
  const aggregateTeam={coordinatedTargetWindows:3,sharedTargetObjectCount:2};
  const result=build({a:analysis({pairInteractions:[aggregatePair],teamInteractions:[aggregateTeam]})});
  assert.equal(result.diagnostics.aggregateOnlyPairSignalsNotPromoted,17);
  assert.ok(result.pairEvidence.every(history=>!history.beats.some(item=>['DIRECT_CONTEST','FORWARD_ENCROACHMENT','ENEMY_BASE_CONTACT','COOPERATIVE_ATTACK'].includes(item.type))));
});
