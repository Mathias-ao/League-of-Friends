/** Opt-in, real worker + real Firebase emulators. Never uses a live project.
 * AOF_NATIVE_FIXTURES points to a local JSON array of {path,gameBuild,players}.
 * No recordings, player names, expanded statistics or secrets enter the report. */
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
import {getStorage} from 'firebase-admin/storage';
import {Timestamp} from 'firebase-admin/firestore';
import {db} from '../lib/config/firebase.js';
import {uploadReplay} from '../lib/commands/statistics/uploadReplay.js';
import {callNativeWorker,validateNativeRecording} from '../lib/services/nativeRecordingValidation.js';
import {digest,verifyNativePackage} from '../lib/engines/nativeRecordingIntegration.js';
import {projectStatistics,StatisticsExperience} from '../lib/engines/statisticsExperience.js';
import {augmentSeasonShowcase} from '../lib/engines/seasonShowcaseProjection.js';
import {statisticsMetadata} from '../lib/services/statisticsExperienceProjection.js';

assert.equal(process.env.GCLOUD_PROJECT,'demo-aof-native-integration');
assert.match(process.env.FIRESTORE_EMULATOR_HOST??'',/^127\.0\.0\.1:\d+$/);
assert.match(process.env.FIREBASE_STORAGE_EMULATOR_HOST??'',/^127\.0\.0\.1:\d+$/);
assert.equal(process.env.FUNCTIONS_EMULATOR,'true');
const fixtures=JSON.parse(await readFile(process.env.AOF_NATIVE_FIXTURES,'utf8'));
assert.ok(fixtures.length>=4&&fixtures.every(f=>f.gameBuild===185872));
fixtures.push({...fixtures[0],warmRepeat:true});
const root=resolve('.replay-lab/native-integration'),bucket=getStorage().bucket('demo-aof-native-integration.appspot.com');
await mkdir(root,{recursive:true});
const prefix='native-'+Date.now(),actor={playerId:prefix+'-admin',authUid:prefix+'-uid',role:'ADMIN'};
await db.collection('players').doc(actor.playerId).set({role:'ADMIN',membershipStatus:'ACTIVE',synthetic:true});
await db.collection('authLinks').doc(actor.authUid).set({playerId:actor.playerId});
process.env.AOF_NATIVE_REPLAY_INTEGRATION='validate-v1';
process.env.AOF_NATIVE_REPLAY_PROJECT=process.env.GCLOUD_PROJECT;
const reports=[];
async function seed(fixture,suffix){
  const matchId=prefix+'-'+suffix,gameId='g1';
  const roster=fixture.players.map((p,i)=>({playerId:matchId+'-player-'+(i+1),team:i%2+1}));
  await Promise.all(roster.map((p,i)=>db.collection('players').doc(p.playerId).set({role:'PLAYER',membershipStatus:'ACTIVE',
    steamName:fixture.players[i].sourceName,synthetic:true})));
  const match={status:'ACTIVE',format:roster.length===2?'ONE_V_ONE':roster.length===4?'TWO_V_TWO':'FOUR_V_FOUR',
    eventId:'synthetic-event',seasonId:'synthetic-season',context:{affectsSeasonStats:true,affectsLifetimeStats:true}};
  const game={status:'READY',players:roster,replayStatisticsRevision:0,replayParticipantBindings:fixture.players.map((p,i)=>({
    sourceNameNormalized:p.sourceName.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US'),playerId:roster[i].playerId}))};
  const matchRef=db.collection('matches').doc(matchId),gameRef=matchRef.collection('games').doc(gameId);
  await matchRef.set(match);await gameRef.set(game);
  process.env.AOF_NATIVE_REPLAY_GAME_ALLOWLIST=matchId+'/'+gameId;
  return {matchId,gameId,match,game,gameRef,mapping:fixture.players.map((p,i)=>({...p,playerId:roster[i].playerId}))};
}
function fullView(raw){
  const result={...raw},layer=raw.sharedEpisodeDelivery,registry={};delete result.sharedEpisodeDelivery;
  for(const [group,rows] of Object.entries(layer.producerGroups))rows.forEach((row,index)=>{
    registry[group+'/'+index]={...row.body,...Object.fromEntries(Object.entries(row.shared??{}).map(([field,hash])=>[field,layer.sharedEvidence[hash]]))};
  });
  result.participants=raw.participants.map((p,i)=>({...p,military:{...p.military,engagements:{...p.military.engagements,
    engagementEvidence:Object.fromEntries(Object.entries(layer.playerRefs[i].groups).map(([group,refs])=>[group,refs.map(ref=>registry[ref])]))}}}));
  return result;
}
let firstResponse,firstInput,firstFixture;
for(const [index,fixture] of fixtures.entries()){
  const context=await seed(fixture,'fixture-'+index),bytes=await readFile(fixture.path);let response;
  const receivedAt=Date.now();
  const input={db,bucket,...context,bytes,fileName:basename(fixture.path),actor,receivedAt,
    worker:async()=>{response=await callNativeWorker(process.env.REPLAY_WORKER_URL,basename(fixture.path),bytes.toString('base64'));return response;},
    resolveMapping:async()=>context.mapping};
  const result=await uploadReplay.run({data:{matchId:context.matchId,gameId:context.gameId,fileName:basename(fixture.path),
    replayBase64:bytes.toString('base64'),processingMode:'NATIVE_VALIDATION_V1'},auth:{uid:actor.authUid}});
  assert.equal(result.state,'VALIDATED_NOT_READY');assert.equal(result.activated,false);
  const source=(await context.gameRef.collection('nativeReplayValidations').doc(result.candidateId).get()).data();
  assert.deepEqual((await context.gameRef.get()).data(),context.game,'No active pointer/result/score changes');
  assert.equal((await context.gameRef.collection('replaySources').get()).size,0,'No legacy READY trigger');
  for(const artifact of [source.originalRecording,source.recordedEvents,source.statistics]){
    const [stored]=await bucket.file(artifact.path,{generation:artifact.generation}).download();
    assert.equal(digest(stored),artifact.sha256);assert.equal(stored.length,artifact.bytes);
  }
  const [eventBytes]=await bucket.file(source.recordedEvents.path,{generation:source.recordedEvents.generation}).download();
  const [statsBytes]=await bucket.file(source.statistics.path,{generation:source.statistics.generation}).download();
  // Reconstruct only the transport envelope from the actually persisted, pinned objects.
  response={contract:'AOF_NATIVE_REPLAY_PACKAGE_V1_EXPERIMENTAL',state:'VERIFIED_UNPUBLISHED',
    originalRecordingRetentionRequired:true,sourceHash:source.sourceHash,sourceBytes:bytes.length,
    sourcePlayers:fixture.players,matchFacts:source.matchFacts,processorRevision:source.processorRevision,
    workerStages:result.timings.workerStages,
    recordedEvents:{...source.recordedEvents,base64:eventBytes.toString('base64')},
    statistics:{...source.statistics,base64:statsBytes.toString('base64')}};
  const verified=await verifyNativePackage(response,bytes),full=fullView(verified.raw);
  const metadata=statisticsMetadata(context.matchId,context.gameId,context.match,context.game,{sourceHash:digest(bytes),playerMapping:context.mapping});
  const expected=augmentSeasonShowcase(full,projectStatistics(full,metadata),metadata);
  assert.deepEqual(source.previewExperience,expected,'Existing qualified Battle read model');
  // Check existing Season/Event/Player aggregate calculations on the same eligibility and bindings.
  const aggregateMetadata={...metadata,eligible:true,exclusionReason:null,orderAtMs:1000};
  const reference=augmentSeasonShowcase(full,projectStatistics(full,aggregateMetadata),aggregateMetadata);
  const native=augmentSeasonShowcase(verified.experienceInput,projectStatistics(verified.experienceInput,aggregateMetadata),aggregateMetadata);
  assert.deepEqual(new StatisticsExperience([native]).aggregate(),new StatisticsExperience([reference]).aggregate());
  const retry=await validateNativeRecording({...input,worker:()=>assert.fail('No repeat worker on idempotent retry')});
  assert.equal(retry.alreadyProcessed,true);assert.equal(retry.candidateId,result.candidateId);
  // Exercise the actual uploadReplay handler (real auth links, Game checks and routing) on the retained job.
  const routed=await uploadReplay.run({data:{matchId:context.matchId,gameId:context.gameId,fileName:basename(fixture.path),
    replayBase64:bytes.toString('base64'),processingMode:'NATIVE_VALIDATION_V1'},auth:{uid:actor.authUid}});
  assert.equal(routed.candidateId,result.candidateId);assert.equal(routed.alreadyProcessed,true);
  const packageRoot=resolve(root,'fixture-'+index);await mkdir(packageRoot,{recursive:true});
  const clean=a=>Object.fromEntries(Object.entries(a).filter(([key])=>key!=='base64'));
  await writeFile(resolve(packageRoot,'events.jsonl.gz'),verified.events);
  await writeFile(resolve(packageRoot,'statistics.direct.json.gz'),verified.statistics);
  await writeFile(resolve(packageRoot,'manifest.json'),JSON.stringify({contract:response.contract,
    source:{sha256:response.sourceHash,bytes:response.sourceBytes},
    recordedEvents:{...clean(response.recordedEvents),path:'events.jsonl.gz'},
    statistics:{...clean(response.statistics),path:'statistics.direct.json.gz'},
    retention:{sourceDeletionAuthorized:false,canonicalReplayProduced:false}}));
  reports.push({fixture:index,runKind:index===0?'first worker request':fixture.warmRepeat?'warm repeat':'warm worker',
    gameBuild:fixture.gameBuild,sourceSha256:digest(bytes),sourceBytes:bytes.length,
    eventsBytes:verified.events.length,statisticsBytes:verified.statistics.length,processorRevision:response.processorRevision,
    state:result.state,activated:false,readModelParity:true,aggregateParity:true,retryIdempotent:true,callableRoutingVerified:true,timings:result.timings});
  console.log(JSON.stringify(reports.at(-1)));
  if(index===0){firstResponse=response;firstInput=input;firstFixture=fixture;}
}
// Failure and concurrency tests reuse a verified real package, avoiding repeat extraction.
const runCase=async(name)=>{
  const context=await seed(firstFixture,name);
  return {...firstInput,...context,receivedAt:Date.now(),worker:async()=>firstResponse,resolveMapping:async()=>context.mapping};
};
let input=await runCase('corrupt');
await bucket.file(`native-replay-evidence/${input.matchId}/${input.gameId}/${digest(input.bytes)}/source.aoe2record`).save(Buffer.from('corrupt'));
await assert.rejects(validateNativeRecording({...input,worker:()=>assert.fail('Corrupt source must fail before worker')}));
assert.equal((await input.gameRef.collection('nativeReplayValidations').get()).size,0);
input=await runCase('mapping');
await assert.rejects(validateNativeRecording({...input,resolveMapping:async()=>input.mapping.map(p=>({...p,playerId:String(p.replaySlot)}))}));
assert.equal((await input.gameRef.collection('nativeReplayValidations').get()).size,0);
input=await runCase('stale');
await assert.rejects(validateNativeRecording({...input,worker:async()=>{
  await input.gameRef.update({activeResultDisputeId:'opened-during-processing'});return firstResponse;
}}));
assert.equal((await input.gameRef.collection('nativeReplayValidations').get()).size,0);
input=await runCase('lease');
let release,entered;const reached=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
const first=validateNativeRecording({...input,worker:async()=>{entered();await gate;return firstResponse;}});
await reached;
await assert.rejects(validateNativeRecording(input),/already processing/);
const job=(await input.gameRef.collection('nativeReplayValidationJobs').get()).docs[0];
await job.ref.update({leaseUntil:Timestamp.fromMillis(1)});
const recovered=await validateNativeRecording(input);release();await assert.rejects(first,/changed/);
assert.equal(recovered.state,'VALIDATED_NOT_READY');assert.equal((await job.ref.get()).data().state,'VALIDATED_NOT_READY');
assert.equal((await input.gameRef.collection('nativeReplayValidations').get()).size,1);
process.env.AOF_NATIVE_REPLAY_INTEGRATION='';
await assert.rejects(validateNativeRecording(input),/disabled/);
const report={environment:'isolated Firebase Firestore/Storage emulators + authenticated local HTTP worker',
  transport:'Actual uploadReplay handler from first request; external callable HTTP/Auth emulator overhead not measured. OS cache warm; first request is worker-process cold only.',
  fixtures:reports,failureTests:{corruptExistingSource:true,wrongMapping:true,staleAuthority:true,concurrentLease:true,expiredLeaseRecovery:true,staleWorkerFenced:true,flagRollback:true},
  ready:false,controlledStagingRolloutReady:false};
await writeFile(resolve(root,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log('Native validation emulator acceptance passed; READY remains blocked.');
await db.terminate();
