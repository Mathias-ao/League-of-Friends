/** Explicit local-only Firestore/Storage transaction acceptance; no worker or live cloud.
 * Run from repo root with Firebase emulators:exec --project demo-aof-native-correction. */
import assert from 'node:assert/strict';
import {getStorage} from 'firebase-admin/storage';
import {db} from '../lib/config/firebase.js';
import {correctionFixture,correctionEnv,actor} from './support/native-correction-fixture.mjs';
import {executeNativeReadyPublication} from '../lib/services/nativeReadyPublication.js';
import {bindingDigest,digest} from '../lib/engines/nativeRecordingIntegration.js';
import {processMatchRewards} from '../lib/commands/processing/processMatchRewards.js';
import {SYSTEM_RESULT_PROCESSING_ACTOR as system} from '../lib/services/resultProcessingActor.js';
import {seasonScoringSnapshot} from '../lib/engines/seasonPoints.js';
import {runResultProcessingJob} from '../lib/triggers/processResultJob.js';
import {resolveRecordingResult} from '../lib/services/recordingResult.js';
import {currentOfficialGameOutcome} from '../lib/engines/recordingMatchFacts.js';
import {mkdir,writeFile} from 'node:fs/promises';

assert.equal(process.env.GCLOUD_PROJECT,'demo-aof-native-correction');
for(const name of ['FIRESTORE_EMULATOR_HOST','FIREBASE_STORAGE_EMULATOR_HOST'])assert.match(process.env[name]??'',/^127\.0\.0\.1:\d+$/);
const t=correctionFixture(),bucket=getStorage().bucket('demo-aof-native-correction.appspot.com');
const env={...correctionEnv,GCLOUD_PROJECT:process.env.GCLOUD_PROJECT,AOF_NATIVE_REPLAY_PROJECT:process.env.GCLOUD_PROJECT};
const gameRef=db.doc('matches/m/games/g'),matchRef=db.doc('matches/m');
// Never reuse a nonempty database, including a prior emulator session.
assert.equal((await matchRef.get()).exists,false,'Use a fresh isolated emulator database.');
for(const artifact of [t.candidate.originalRecording,t.candidate.recordedEvents,t.candidate.statistics]){
 const bytes=t.objects.get(artifact.path),file=bucket.file(artifact.path);
 await file.save(bytes,{resumable:false,preconditionOpts:{ifGenerationMatch:0}});
 const [metadata]=await file.getMetadata();artifact.generation=String(metadata.generation);
 const [readback]=await bucket.file(artifact.path,{generation:artifact.generation}).download();assert.equal(digest(readback),artifact.sha256);
}
Object.assign(t.match,{seasonId:'s',eventId:'e',scoringSnapshot:seasonScoringSnapshot({act:'MAIN',diplomacyEnabled:false,placementPolicy:'NONE',emperorPlayerId:null}),
 goldRewardSnapshot:{matchCompletion:1,matchWin:2},context:{affectsLeaguePoints:true,affectsGold:true,affectsPowerRating:false}});
for(const id of ['p1','p2']){
 t.rows.get('players/'+id).goldBalance=0;
 t.rows.set('events/e/scoringSlots/MAIN_'+id,{matchId:'m',playerId:id,seasonId:'s',act:'MAIN'});
}
for(const [path,value] of t.rows)await db.doc(path).create(value);
await matchRef.update({status:'COMPLETED',activeResultDisputeId:null});
await gameRef.update({status:'COMPLETED',activeResultDisputeId:null});
await db.doc('processingJobs/MATCH_RESULT_m_R1').update({status:'PENDING'});
await processMatchRewards({matchId:'m',requestId:'before'},system);
await matchRef.update({status:'DISPUTED',activeResultDisputeId:'dispute'});
await gameRef.update({status:'DISPUTED',activeResultDisputeId:'dispute'});
const candidateRef=db.doc(t.candidatePath);
const bind=async()=>{
 const [game,match,admin,link,p1,p2]=await Promise.all([gameRef.get(),matchRef.get(),db.doc('players/admin').get(),
   db.doc('authLinks/uid').get(),db.doc('players/p1').get(),db.doc('players/p2').get()]);
 await candidateRef.update({bindingToken:bindingDigest({game:game.data(),match:match.data(),admin:admin.data(),link:link.data(),players:[p1.data(),p2.data()]})});
};
await bind();
const run=(options={})=>executeNativeReadyPublication({db,bucket,actor,request:t.request,env,...options});
const before=(await gameRef.get()).data(),oldSource=(await db.doc(t.oldSourcePath).get()).data();
let changed=false;
const racingBucket={file:(...args)=>({download:async()=>{const value=await bucket.file(...args).download();
 if(!changed){changed=true;await db.doc('authLinks/uid').update({playerId:'revoked'});}return value;}})};
await assert.rejects(run({bucket:racingBucket}));
assert.deepEqual((await gameRef.get()).data(),before);assert.equal((await db.doc(t.sourcePath).get()).exists,false);
await db.doc('authLinks/uid').update({playerId:'admin'});await bind();
const started=Date.now();
const outcomes=await Promise.allSettled([run(),run()]);
assert.ok(outcomes.some(r=>r.status==='fulfilled'));
for(const result of outcomes)if(result.status==='rejected')assert.equal(result.reason.code,'aborted');
assert.equal((await run()).alreadyPublished,true);
const game=(await gameRef.get()).data(),match=(await matchRef.get()).data();
assert.equal(game.canonicalResult.revision,2);assert.equal(game.replayStatisticsRevision,8);
assert.equal(currentOfficialGameOutcome(game,match).qualification,'OFFICIAL');
assert.equal(game.activeReplayStatisticsId,game.recordingResultBinding.sourceHash);
assert.equal((await gameRef.collection('nativeReplayPublications').get()).size,1);
assert.equal((await db.collection('processingJobs').get()).size,2);
assert.equal((await db.doc(t.oldClaimPath).get()).exists,false);
assert.equal((await db.doc(t.newClaimPath).get()).data().sourceHash,t.sourceHash);
assert.deepEqual((await db.doc(t.oldSourcePath).get()).data(),oldSource);
assert.equal((await db.doc('players/p1').get()).data().goldBalance,3,'publisher did not award');
await Promise.all([processMatchRewards({matchId:'m',requestId:'new-a'},system),processMatchRewards({matchId:'m',requestId:'new-b'},system)]);
const ledger=async()=>JSON.stringify((await db.collection('goldLedger').get()).docs.map(d=>[d.id,d.data()]).sort());
const once=await ledger();
await runResultProcessingJob(db.doc('processingJobs/MATCH_RESULT_m_R1'),'stale-r1');
await processMatchRewards({matchId:'m',requestId:'repeat'},system);
assert.equal((await resolveRecordingResult('m','g',undefined,db)).state,'RESULT_ALREADY_RESOLVED');
assert.equal(await ledger(),once);
assert.equal((await db.doc('players/p1').get()).data().goldBalance,1);
assert.equal((await db.doc('players/p2').get()).data().goldBalance,3);
assert.equal((await db.doc('seasons/s/standings/p1').get()).data().leaguePoints,4);
assert.equal((await db.doc('seasons/s/standings/p2').get()).data().leaguePoints,10);
for(const artifact of [t.candidate.originalRecording,t.candidate.recordedEvents,t.candidate.statistics]){
 const [bytes]=await bucket.file(artifact.path,{generation:artifact.generation}).download();assert.equal(digest(bytes),artifact.sha256);
}
const report={environment:'fresh demo-aof-native-correction Firestore/Storage emulators',
 fixture:'synthetic native publication + replay-driven legacy result corpus; not real recording extraction',
 concurrentCalls:outcomes.map(r=>r.status==='fulfilled'?'committed/qualified':r.reason.code),
 atomicResultRevision:2,atomicStatisticsRevision:8,revocationRaceRejected:true,exactRetryIdempotent:true,
 immutableArtifactsRetained:true,oldClaimReleased:true,newClaimOwned:true,
 rewardsReconciledOnce:true,staleJobAndNativeResolverNoDuplicateAwards:true,
 totalCorrectionAndLedgerTestMs:Date.now()-started,
 limitation:'Invokes real transaction/processor functions; automatic Functions trigger delivery and real cloud/browser acceptance not exercised.'};
await mkdir('.replay-lab',{recursive:true});await writeFile('.replay-lab/native-correction-emulator-report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
await db.terminate();
