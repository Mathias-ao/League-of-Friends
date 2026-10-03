import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildDiplomacyTimelineFromCanonicalEvidence} from '../lib/engines/diplomacyEvidenceAdapter.js';
import {projectRecordingDiplomacyReview} from '../lib/engines/recordingDiplomacyReview.js';
import {buildDeclaredDiplomacyHistory} from '../lib/engines/declaredDiplomacyHistory.js';
const event=(id,atMs,ordinal,from,to,mode)=>({eventId:id,eventType:'command.diplomacy_change',timestampMs:atMs,
  operationOrdinal:ordinal,actorPlayerId:from,targetPlayerId:to,payload:{diplomacy_mode:mode,command_id:0}});
const history=(events,initial=[])=>buildDeclaredDiplomacyHistory(buildDiplomacyTimelineFromCanonicalEvidence({
  playerIds:[1,2],durationMs:5000,canonicalInitialDiplomacy:initial,events,canonicalSchemaVersion:'1.1.0'}).timeline,
  {replaySha256:'test',canonicalManifestSha256:'revision'});
test('directed declarations preserve asymmetric moments and reciprocal requests without engine claims',()=>{
  const commands=[event('a-ally',1000,10,1,2,0),event('b-ally',1000,12,2,1,0),event('a-enemy',1000,14,1,2,3)];
  const result=history(commands);
  assert.deepEqual(result.pairIntervals.map(x=>x.state),['INCOMPLETE_DECLARATIONS','INCOMPLETE_DECLARATIONS',
    'RECIPROCAL_ALLY_DECLARATIONS','ASYMMETRIC_DECLARATIONS']);
  const reciprocal=result.pairIntervals[2];
  assert.equal(reciprocal.start.operationOrdinal,12);assert.equal(reciprocal.end.operationOrdinal,14);
  assert.equal(reciprocal.start.atMs,reciprocal.end.atMs);assert.deepEqual(reciprocal.sourceEventIds,['a-ally','b-ally']);
  const withdrawal=result.turningPoints[2];assert.equal(withdrawal.fromPlayerId,1);assert.equal(withdrawal.toPlayerId,2);
  assert.equal(withdrawal.allyDeclarationWithdrawn,true);assert.equal(withdrawal.previousReciprocalAllyDeclarations,true);
  assert.equal(withdrawal.treacheryEstablished,false);assert.equal(withdrawal.newSocialDeed,false);
});
test('repeats support one declaration episode and do not create turning points or future start evidence',()=>{
  const result=history([event('first',1000,10,1,2,0),event('repeat',1100,11,1,2,0),event('counterpart',1050,12,2,1,0)]);
  assert.equal(result.counters.repeatedRequests,1);assert.equal(result.turningPoints.length,2);
  const episode=result.directedEpisodes.find(x=>x.declaredStance==='ALLY'&&x.fromPlayerId===1);
  assert.deepEqual(episode.sourceEventIds,['first','repeat']);
  const pair=result.pairIntervals.find(x=>x.state==='RECIPROCAL_ALLY_DECLARATIONS');
  assert.deepEqual(pair.sourceEventIds,['counterpart','first']);assert.ok(!pair.sourceEventIds.includes('repeat'));
});
test('unknown orders interrupt declaration coverage; later knowledge cannot prove withdrawal',()=>{
  const result=history([event('ally',1000,10,1,2,0),event('unknown',2000,20,1,2,99),event('enemy',3000,30,1,2,3)]);
  assert.equal(result.counters.unknownOrders,1);assert.equal(result.counters.recordedStanceReversals,0);
  assert.equal(result.counters.allyDeclarationWithdrawals,0);
  assert.equal(result.turningPoints.at(-1).previousDeclaration,'UNKNOWN');
});
test('qualified initial engine edges never seed a command declaration history',()=>{
  const result=history([],[{fromPlayerId:1,toPlayerId:2,stance:'ally'},{fromPlayerId:2,toPlayerId:1,stance:'ally'}]);
  assert.equal(result.pairIntervals[0].state,'INCOMPLETE_DECLARATIONS');
  assert.equal(result.counters.orders,0);assert.equal(result.turningPoints.length,0);
});
test('source revision scopes identities while reordered inputs rebuild identically without mutation',()=>{
  const input=[event('one',1000,10,1,2,0),event('two',2000,20,1,2,3)],before=structuredClone(input);
  const expected=history(input);assert.deepEqual(history([...input].reverse()),expected);assert.deepEqual(input,before);
  const other=buildDeclaredDiplomacyHistory(buildDiplomacyTimelineFromCanonicalEvidence({playerIds:[1,2],durationMs:5000,
    events:input,canonicalSchemaVersion:'1.1.0'}).timeline,{replaySha256:'different'});
  assert.notEqual(other.turningPoints[0].beatId,expected.turningPoints[0].beatId);
});
test('retained FFA orders qualify declaration chronology and exact reversals without scoring',async()=>{
  const file=await readFile(new URL('../../web/src/data/recordingReviewExamples.ts',import.meta.url),'utf8');
  const rows=JSON.parse(file.slice(file.indexOf('= ')+2).trim().replace(/;$/,''));
  const ffa=rows.find(row=>row.id==='ffa');
  const old=ffa.diplomacyReview.timeline;
  const input={modelVersion:'AOF_RECORDING_MATCH_FACTS_V1',identityNamespace:'CANONICAL_REPLAY_PLAYER_ID',
    source:ffa.source,players:old.playerIds.map(playerId=>({playerId})),game:{observedDurationMs:old.durationMs},
    diplomacy:{initialRawByPlayer:{},normalizedInitialEdges:[],commandTimelines:{}}};
  for(const row of old.changes){
    const key=row.fromPlayerId+'->'+row.toPlayerId;
    (input.diplomacy.commandTimelines[key]??=[]).push({sourceEventId:row.eventId,replaySlot:row.fromPlayerId,
      targetReplaySlot:row.toPlayerId,atMs:row.atMs,operationOrdinal:row.operationOrdinal,diplomacyMode:row.rawMode,commandId:row.rawCommandId});
  }
  const result=projectRecordingDiplomacyReview(input);
  assert.equal(result.status,'REVIEW_AVAILABLE');
  const counts=result.declaredHistory.counters;
  assert.equal(counts.orders,143);assert.equal(counts.allyOrders,85);assert.equal(counts.enemyOrders,58);
  assert.equal(counts.directedEdgesObserved,56);assert.equal(counts.recordedStanceReversals,87);assert.equal(counts.repeatedRequests,0);
  assert.equal(result.knownPairSegmentCount,0);assert.equal(result.interpretationEnabled,false);
  assert.ok(result.declaredHistory.turningPoints.every(row=>!row.treacheryEstablished&&!row.newSocialDeed));
});
