import test from 'node:test';
import assert from 'node:assert/strict';
import {db} from '../lib/config/firebase.js';
import {memoryFirestore} from './support/memory-firestore.mjs';
import {bindingDigest} from '../lib/engines/nativeRecordingIntegration.js';
import {attestBattleOccurrence,reviewBattleOccurrence,readMyBattleOccurrence,assertBattleOccurrenceEnabled}
  from '../lib/commands/results/battleOccurrence.js';
import {BATTLE_OCCURRENCE_VERSION,occurrenceSourceBinding,verifiedOccurrence}
  from '../lib/integration/battleOccurrence.js';

const sourceHash='b'.repeat(64),guid='genuine-guid-controlled-test',id='warmup-battle',gameId='G1';
const roster=[{playerId:'A',team:1},{playerId:'B',team:2}];
const game={status:'COMPLETED',gameNumber:1,players:roster,activeReplayStatisticsId:sourceHash,
 replayStatisticsRevision:1,
 canonicalResult:{source:'PLAYER_CONFIRMED',type:'PLAYER_WIN',revision:1,
  winningPlayerIds:['A'],losingPlayerIds:['B']}};
const match={eventId:'event',seasonId:'season',status:'COMPLETED',opponentKind:'HUMAN',format:'ONE_V_ONE',
 participants:roster,scoringSnapshot:{rules:{act:'WARMUP'}},
 seriesRule:{maxGames:1,gamesRequiredToWin:1},matchNumber:0};
const event={seasonId:'season',officialMatchIds:[],warmupMatchIds:[id]};
const published=()=>({toMillis:()=>100000});
const source={state:'READY',matchId:id,gameId,sourceHash,originalRecording:{sha256:sourceHash,generation:'7'},
 recordedEvents:{sha256:'c'.repeat(64),generation:'7'},
 statistics:{sha256:'d'.repeat(64),generation:'7'},processorRevision:'e'.repeat(64),
 playerMapping:[{playerId:'A',replaySlot:1},{playerId:'B',replaySlot:2}],
 matchFacts:{game:{guid}},ordinaryUploadVersion:'AOF_NATIVE_PLAYER_UPLOAD_V1',uploadedAt:published()};
const actor=(playerId,authUid,role='PLAYER')=>({playerId,authUid,role});
const A=actor('A','uid-a'),B=actor('B','uid-b'),ADMIN=actor('admin','uid-admin','ADMIN');
const bounds=[{gameId,notBeforeMs:1000,notAfterMs:2000}];
function setup(){
 const items=[
  ['matches/'+id,structuredClone(match)],['matches/'+id+'/games/'+gameId,structuredClone(game)],
  ['events/event',structuredClone(event)],
  ['matches/'+id+'/games/'+gameId+'/replaySources/'+sourceHash,source],
  ['recordingGameClaims/'+Buffer.from(guid).toString('hex'),{matchId:id,gameId,sourceHash}],
  ['players/A',{role:'PLAYER',membershipStatus:'ACTIVE'}],
  ['players/B',{role:'PLAYER',membershipStatus:'ACTIVE'}],
  ['players/admin',{role:'ADMIN',membershipStatus:'ACTIVE'}],
  ['authLinks/uid-a',{playerId:'A'}],['authLinks/uid-b',{playerId:'B'}],
  ['authLinks/uid-admin',{playerId:'admin'}],
 ];
 const records=memoryFirestore(items);
 // Purely local Firestore test ref routing: memory double owns collection/query
 // behavior, while the production implementation continues using db.doc.
 Object.defineProperty(db,'doc',{configurable:true,value:path=>{
  const xs=path.split('/');let current=db.collection(xs[0]).doc(xs[1]);
  for(let i=2;i<xs.length;i+=2)current=current.collection(xs[i]).doc(xs[i+1]);
  return current;
 }});
 return records;
}
const currentBinding=records=>{
 const b={battleId:id,match:records.get('matches/'+id),event:records.get('events/event'),
  planId:null,plan:null,games:[{gameId,game:records.get('matches/'+id+'/games/'+gameId),
   source:{sourceHash,gameGuid:guid,mappingDigest:bindingDigest(source.playerMapping),
    provenanceDigest:bindingDigest([sourceHash,1,
      [{kind:'STATISTICS',digest:source.statistics.sha256,generation:'7'},
       {kind:'RECORDED_EVENTS',digest:source.recordedEvents.sha256,generation:'7'},
       {kind:'ORIGINAL',digest:sourceHash,generation:'7'}],source.processorRevision]),
    publicationAtMs:100000}}]};
 return occurrenceSourceBinding(b);
};
test('hosted occurrence callable gate is exact EU/default-OFF and refuses emulator and wrong region',()=>{
 const allowed={GCLOUD_PROJECT:'age-of-friends-staging-eu',GOOGLE_CLOUD_PROJECT:'age-of-friends-staging-eu',
  FUNCTION_REGION:'europe-west1',FUNCTIONS_EMULATOR:'false',AOF_BATTLE_OCCURRENCE_V1:'source-v1'};
 assert.doesNotThrow(()=>assertBattleOccurrenceEnabled(allowed));
 for(const env of [
  {...allowed,AOF_BATTLE_OCCURRENCE_V1:undefined},
  {...allowed,GCLOUD_PROJECT:'production'},
  {...allowed,GOOGLE_CLOUD_PROJECT:'old-staging'},
  {...allowed,FUNCTION_REGION:'us-central1'},
  {...allowed,FUNCTIONS_EMULATOR:'true'},
  {...allowed,FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080'}
 ])assert.throws(()=>assertBattleOccurrenceEnabled(env),e=>e.code==='failed-precondition');
});
test('owner-private Battle status supplies opaque current revision but no native source refs',async()=>{
 const records=setup();
 const status=await readMyBattleOccurrence({actor:A,request:{battleId:id}});
 assert.equal(status.status,'PENDING');
 assert.equal(status.expectedSourceBinding,currentBinding(records));
 assert.deepEqual(status.gameIds,['G1']);
 assert.deepEqual(status.games,[{gameId:'G1',receiptUpperBoundAtMs:100000}]);
 for(const forbidden of ['sourceHash','processorRevision','artifactRefs','sourcePath','privateNote'])
  assert.equal(JSON.stringify(status).includes(forbidden),false);
 await assert.rejects(readMyBattleOccurrence({actor:actor('outsider','nobody'),
  request:{battleId:id}}),e=>e.code==='permission-denied');
 await assert.rejects(readMyBattleOccurrence({actor:A,request:{battleId:id,ownerPlayerId:'B'}}),
  e=>e.code==='invalid-argument');
});
test('opposing ACTIVE confirmations approve once; stale source correction retracts without affecting result',async()=>{
 const records=setup();
 const expectedSourceBinding=currentBinding(records);
 const first=await attestBattleOccurrence({actor:A,request:{battleId:id,bounds,expectedSourceBinding}});
 assert.equal(first.status,'PENDING');
 const second=await attestBattleOccurrence({actor:B,request:{battleId:id,bounds,expectedSourceBinding}});
 assert.equal(second.status,'APPROVED');
 const current=records.get('matches/'+id+'/occurrence/current');
 assert.equal(current.proof.kind,'MUTUAL_PARTICIPANTS');
 const idempotent=await attestBattleOccurrence({actor:B,request:{battleId:id,bounds,expectedSourceBinding}});
 assert.equal(idempotent.idempotent,true);
 assert.equal(records.get('matches/'+id+'/occurrenceRevisions/R2').status,'APPROVED');
 assert.equal(records.has('matches/'+id+'/occurrenceRevisions/R3'),false);
 // The result remains official but its revision invalidates this reviewed
 // original. New independent confirmation is necessary to authorize history.
 records.get('matches/'+id+'/games/'+gameId).canonicalResult.revision=2;
 const before={battleId:id,match:records.get('matches/'+id),event:records.get('events/event'),
  planId:null,plan:null,games:[{gameId,game:records.get('matches/'+id+'/games/'+gameId),
   source:{sourceHash,gameGuid:guid,mappingDigest:bindingDigest(source.playerMapping),
    provenanceDigest:bindingDigest([sourceHash,1,
      [{kind:'STATISTICS',digest:source.statistics.sha256,generation:'7'},
       {kind:'RECORDED_EVENTS',digest:source.recordedEvents.sha256,generation:'7'},
       {kind:'ORIGINAL',digest:sourceHash,generation:'7'}],source.processorRevision]),
    publicationAtMs:100000}}],occurrence:current};
 assert.equal(verifiedOccurrence(before),null);
 assert.equal(records.get('matches/'+id+'/games/'+gameId).canonicalResult.winningPlayerIds[0],'A');
});
test('foreign, inactive and raw source-injection attestations fail without occurrence writes',async()=>{
 const records=setup();
 const expectedSourceBinding=currentBinding(records);
 await assert.rejects(attestBattleOccurrence({actor:actor('outsider','uid-outside'),request:{battleId:id,bounds,expectedSourceBinding}}));
 await assert.rejects(attestBattleOccurrence({actor:A,request:{
  battleId:id,bounds,expectedSourceBinding:'0'.repeat(64)}}),e=>e.code==='failed-precondition');
 records.get('players/B').membershipStatus='SUSPENDED';
 await assert.rejects(attestBattleOccurrence({actor:B,request:{battleId:id,bounds,expectedSourceBinding}}),e=>e.code==='permission-denied');
 assert.equal(records.has('matches/'+id+'/occurrence/current'),false);
});
test('ordinary AUTO receipt rejects impossible post-upload Game end without altering result',async()=>{
 const records=setup(),expectedSourceBinding=currentBinding(records);
 const gameBefore=structuredClone(records.get('matches/'+id+'/games/'+gameId));
 await assert.rejects(attestBattleOccurrence({actor:A,request:{battleId:id,
  expectedSourceBinding,bounds:[{gameId,notBeforeMs:1000,notAfterMs:100001}]}}),
  e=>e.code==='invalid-argument');
 assert.equal(records.has('matches/'+id+'/occurrence/current'),false);
 assert.deepEqual(records.get('matches/'+id+'/games/'+gameId),gameBefore);
});
test('the second participant must still be ACTIVE and linked with a different UID',async()=>{
 for(const scenario of ['REVOKED_LINK','SUSPENDED','REUSED_UID']){
  const records=setup(),expectedSourceBinding=currentBinding(records);
  assert.equal((await attestBattleOccurrence({actor:A,request:{battleId:id,bounds,
    expectedSourceBinding}})).status,'PENDING');
  let second=B;
  if(scenario==='REVOKED_LINK')records.delete('authLinks/uid-a');
  if(scenario==='SUSPENDED')records.get('players/A').membershipStatus='SUSPENDED';
  if(scenario==='REUSED_UID'){
   records.set('authLinks/uid-a',{playerId:'B'});
   second=actor('B','uid-a');
  }
  const result=await attestBattleOccurrence({actor:second,request:{battleId:id,bounds,
   expectedSourceBinding}});
  assert.equal(result.status,'PENDING',scenario);
  assert.equal(records.get('matches/'+id+'/occurrence/current').status,'PENDING');
 }
});
test('BO3 attestation uses every canonically required Game, never the first document only',async()=>{
 for(const sameSide of [true,false]){
  const records=setup(),m=records.get('matches/'+id);
  m.seriesRule={maxGames:3,gamesRequiredToWin:2};
  m.canonicalResult={revision:1,sourceGameId:'G2',seriesGameRevisions:{G1:1,G2:1},
    winningPlayerIds:['A']};
  const g2Hash='f'.repeat(64),g2Guid='controlled-second-original';
  const g2={...structuredClone(game),gameNumber:2,activeReplayStatisticsId:g2Hash,
    players:[{playerId:'A',team:1},{playerId:'B',team:sameSide?1:2}]};
  records.set('matches/'+id+'/games/G2',g2);
  const second={...source,sourceHash:g2Hash,gameId:'G2',
    originalRecording:{...source.originalRecording,sha256:g2Hash},
    matchFacts:{game:{guid:g2Guid}}};
  records.set('matches/'+id+'/games/G2/replaySources/'+g2Hash,second);
  records.set('recordingGameClaims/'+Buffer.from(g2Guid).toString('hex'),
    {matchId:id,gameId:'G2',sourceHash:g2Hash});
  records.set('matches/'+id+'/games/G3',{gameNumber:3,status:'NO_CONTEST',
    resolutionReason:'Series decided by G2',players:roster,
    activeReplayStatisticsId:null,canonicalResult:null});
  const status=await readMyBattleOccurrence({actor:A,request:{battleId:id}});
  assert.deepEqual(status.gameIds,['G1','G2']);
  const twoBounds=[bounds[0],{gameId:'G2',notBeforeMs:3000,notAfterMs:4000}];
  assert.equal((await attestBattleOccurrence({actor:A,request:{battleId:id,
    expectedSourceBinding:status.expectedSourceBinding,bounds:twoBounds}})).status,'PENDING');
  const secondActor=await attestBattleOccurrence({actor:B,request:{battleId:id,
    expectedSourceBinding:status.expectedSourceBinding,bounds:twoBounds}});
  assert.equal(secondActor.status,sameSide?'PENDING':'APPROVED',
    'a terminal unused slot is excluded; each required Game must prove opponents');
 }
});
test('source-current independent admin evidence approval/revoke uses explicit revision and blocks player override',async()=>{
 const records=setup();
 const sourceBinding=currentBinding(records);assert.ok(sourceBinding);
 const base={battleId:id,expectedSourceBinding:sourceBinding,bounds,
  reason:'Independently reviewed actual play window with original source records.',
  evidenceRefs:['review-evidence-claim-A','review-evidence-claim-B'],expectedRevision:null};
 const first=await reviewBattleOccurrence({actor:ADMIN,request:{...base,action:'APPROVE'}});
 assert.equal(first.status,'APPROVED');assert.equal(first.revision,1);
 await assert.rejects(attestBattleOccurrence({actor:A,request:{battleId:id,bounds,expectedSourceBinding:sourceBinding}}));
 await assert.rejects(reviewBattleOccurrence({actor:ADMIN,request:{...base,action:'REVOKE'}}));
 const revoked=await reviewBattleOccurrence({actor:ADMIN,request:{...base,expectedRevision:1,action:'REVOKE'}});
 assert.equal(revoked.status,'REVOKED');
 assert.equal(records.get('matches/'+id+'/occurrenceRevisions/R1').status,'APPROVED');
 assert.equal(records.get('matches/'+id+'/occurrenceRevisions/R2').status,'REVOKED');
 await assert.rejects(attestBattleOccurrence({actor:B,
  request:{battleId:id,bounds,expectedSourceBinding:sourceBinding}}),
  e=>e.code==='failed-precondition','participant agreement cannot defeat admin revocation');
});
