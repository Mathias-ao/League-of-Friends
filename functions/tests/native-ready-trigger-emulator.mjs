/**
 * Real Functions-trigger delivery acceptance, deliberately separate from the
 * direct-processor correction emulator test. Nothing is deployed or activated.
 *
 * Run from repo root using an isolated demo project:
 * npx firebase-tools@14 emulators:exec --project demo-aof-native-trigger \
 *   --only firestore,storage,functions "node functions/tests/native-ready-trigger-emulator.mjs"
 */
import assert from 'node:assert/strict';
import {setTimeout as sleep} from 'node:timers/promises';
import {Timestamp} from 'firebase-admin/firestore';
import {getStorage} from 'firebase-admin/storage';
import {db} from '../lib/config/firebase.js';
import {correctionFixture,correctionEnv,actor} from './support/native-correction-fixture.mjs';
import {executeNativeReadyPublication} from '../lib/services/nativeReadyPublication.js';
import {bindingDigest,digest} from '../lib/engines/nativeRecordingIntegration.js';
import {processMatchRewards} from '../lib/commands/processing/processMatchRewards.js';
import {SYSTEM_RESULT_PROCESSING_ACTOR as system} from '../lib/services/resultProcessingActor.js';
import {runResultProcessingJob} from '../lib/triggers/processResultJob.js';
import {currentOfficialGameOutcome} from '../lib/engines/recordingMatchFacts.js';
import {seasonScoringSnapshot} from '../lib/engines/seasonPoints.js';

const project='demo-aof-native-trigger';
assert.equal(process.env.GCLOUD_PROJECT,project,'Never run outside the dedicated demo project');
for(const key of ['FIRESTORE_EMULATOR_HOST','FIREBASE_STORAGE_EMULATOR_HOST']) {
  assert.match(process.env[key]??'',/^(127[.]0[.]0[.]1|localhost):[0-9]+$/,'Requires local '+key);
}
const t=correctionFixture(),bucket=getStorage().bucket(project+'.appspot.com');
const env={...correctionEnv,GCLOUD_PROJECT:project,AOF_NATIVE_REPLAY_PROJECT:project};
const matchRef=db.doc('matches/m'),gameRef=db.doc('matches/m/games/g');
const oldJob=db.doc('processingJobs/MATCH_RESULT_m_R1');
const newJob=db.doc('processingJobs/MATCH_RESULT_m_R2');
assert.equal((await matchRef.get()).exists,false,'Requires a fresh, isolated emulator');

for(const entry of [t.candidate.originalRecording,t.candidate.recordedEvents,t.candidate.statistics]){
  const file=bucket.file(entry.path),bytes=t.objects.get(entry.path);
  await file.save(bytes,{resumable:false,preconditionOpts:{ifGenerationMatch:0}});
  const [metadata]=await file.getMetadata();
  entry.generation=String(metadata.generation);
  const [stored]=await bucket.file(entry.path,{generation:entry.generation}).download();
  assert.equal(digest(stored),entry.sha256,'Pinned source integrity must survive Storage');
}

const acceptedAt=Timestamp.fromDate(new Date('2026-10-11T00:00:00.000Z'));
Object.assign(t.match,{
  seasonId:'s',eventId:'e',firstCompletedAt:acceptedAt,completedAt:acceptedAt,
  scoringSnapshot:seasonScoringSnapshot({act:'MAIN',diplomacyEnabled:false,placementPolicy:'NONE',emperorPlayerId:null}),
  goldRewardSnapshot:{matchCompletion:1,matchWin:2},
  context:{affectsLeaguePoints:true,affectsGold:true,affectsPowerRating:false,
    affectsLifetimeStats:true,affectsSeasonStats:true},
});
Object.assign(t.game,{firstCompletedAt:acceptedAt,completedAt:acceptedAt});
t.rows.set('seasons/s',{status:'ACTIVE'});
t.rows.set('events/e',{status:'ACTIVE',seasonId:'s'});
for(const id of ['p1','p2']){
  t.rows.get('players/'+id).goldBalance=0;
  t.rows.set('events/e/scoringSlots/MAIN_'+id,{matchId:'m',playerId:id,seasonId:'s',act:'MAIN'});
}
for(const [path,value] of t.rows)await db.doc(path).create(value);

// Establish old real rewards without asking a Functions trigger to process the
// intentionally disputed R1. This is the baseline, not the target under test.
await matchRef.update({status:'COMPLETED',activeResultDisputeId:null});
await gameRef.update({status:'COMPLETED',activeResultDisputeId:null});
await oldJob.update({status:'PENDING'});
await processMatchRewards({matchId:'m',requestId:'baseline'},system);
assert.equal((await db.doc('players/p1').get()).data()?.goldBalance,3);
assert.equal((await db.doc('players/p2').get()).data()?.goldBalance,1);
await matchRef.update({status:'DISPUTED',activeResultDisputeId:'dispute'});
await gameRef.update({status:'DISPUTED',activeResultDisputeId:'dispute'});

// Other onDocumentWritten triggers see the setup writes too; let them settle
// before binding this deliberately conservative candidate.
await sleep(1500);
const bind=async()=>{
  const [game,match,admin,link,p1,p2]=await Promise.all([
    gameRef.get(),matchRef.get(),db.doc('players/admin').get(),
    db.doc('authLinks/uid').get(),db.doc('players/p1').get(),db.doc('players/p2').get()]);
  await db.doc(t.candidatePath).update({bindingToken:bindingDigest({
    game:game.data(),match:match.data(),admin:admin.data(),link:link.data(),
    players:[p1.data(),p2.data()],
  })});
};
await bind();

// The correction is committed by the reviewed publisher, NOT by a test-only
// event shim. Everything after R2 job creation must run via Functions emulator.
const publication=await executeNativeReadyPublication({db,bucket,actor,request:t.request,env});
assert.equal(publication.resultRevision,2);
const created=(await newJob.get()).data();
assert.equal(created?.status,'PENDING');
console.log('Correction R2 committed; awaiting actual onDocumentCreated trigger');

// An absent Functions emulator or unhandled trigger cannot pass: the script
// never invokes the R2 processor. Capture its real terminal state on failure.
let job;
const deadline=Date.now()+120_000;
while(Date.now()<deadline){
  job=(await newJob.get()).data();
  if(job?.status==='COMPLETED'&&job?.automation?.status==='COMPLETED')break;
  if(job?.automation?.status==='FAILED'||job?.automation?.status==='BLOCKED')
    throw new Error('Automatic processing failed: '+JSON.stringify(job));
  await sleep(750);
}
assert.equal(job?.automation?.status,'COMPLETED',
  'Functions onDocumentCreated delivery did not complete: '+JSON.stringify(job));
assert.equal(job?.status,'COMPLETED',
  'Result job did not finish all steps: '+JSON.stringify(job));
const steps=['SCORING','GOLD','STATISTICS','ACHIEVEMENTS','RIVALRIES','RECORDS','ACTIVITY'];
for(const step of steps)assert.ok(job.completedSteps?.includes(step),'Missing automatic step '+step);
assert.equal((await matchRef.get()).data()?.processingState,'COMPLETE');
const game=(await gameRef.get()).data(),match=(await matchRef.get()).data();
assert.equal(currentOfficialGameOutcome(game,match).qualification,'OFFICIAL');
assert.equal(game.activeReplayStatisticsId,game.recordingResultBinding.sourceHash);
assert.equal(game.canonicalResult.revision,2);
assert.equal((await db.doc('players/p1').get()).data()?.goldBalance,1);
assert.equal((await db.doc('players/p2').get()).data()?.goldBalance,3);
assert.equal((await db.doc('seasons/s/standings/p1').get()).data()?.leaguePoints,4);
assert.equal((await db.doc('seasons/s/standings/p2').get()).data()?.leaguePoints,10);
assert.equal((await db.collection('processingJobs').get()).size,2);
assert.equal((await gameRef.collection('nativeReplayPublications').get()).size,1);
assert.equal((await db.doc(t.oldClaimPath).get()).exists,false);
assert.equal((await db.doc(t.newClaimPath).get()).data()?.sourceHash,t.sourceHash);

// A stale R1 job and a repeated R2 runner must not re-award or rewrite ledgers.
const ledger=async()=>JSON.stringify((await db.collection('goldLedger').get()).docs
  .map(x=>[x.id,x.data()]).sort((a,b)=>a[0].localeCompare(b[0])));
const before=await ledger();
await runResultProcessingJob(oldJob,'stale-result-delivery');
await runResultProcessingJob(newJob,'duplicate-result-delivery');
await sleep(1800);
assert.equal(await ledger(),before,'Stale/duplicate delivery changed the Gold ledger');
assert.equal((await db.doc('players/p1').get()).data()?.goldBalance,1);
assert.equal((await db.doc('players/p2').get()).data()?.goldBalance,3);
assert.deepEqual((await newJob.get()).data()?.completedSteps.sort(),[...steps].sort());
for(const artifact of [t.candidate.originalRecording,t.candidate.recordedEvents,t.candidate.statistics]){
  const [bytes]=await bucket.file(artifact.path,{generation:artifact.generation}).download();
  assert.equal(digest(bytes),artifact.sha256);
}
console.log(JSON.stringify({acceptance:'PASSED',project,realFunctionsTriggerDelivery:true,
  correctedResultRevision:2,activeStatisticsRevision:8,
  steps:job.completedSteps,oldJobStatus:(await oldJob.get()).data()?.status,
  gold:{p1:1,p2:3},mainPoints:{p1:4,p2:10},
  duplicateLedgerStable:true,originalArtifactsRetained:true,
  limitations:'Synthetic 1v1; no automatic native upload or browser/cloud/build-185872 acceptance'},null,2));
await db.terminate();
