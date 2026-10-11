/**
 * Opt-in authentic AoE2 DE 185872 1v1, 2v2, 4v4 and FFA evidence acceptance.
 * Local Firebase Firestore/Storage and an authenticated loopback native worker
 * ONLY. Original recordings, private fixture names and tokens never enter Git.
 * No automatic READY activation, production writes or cloud deployment.
 */
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,isAbsolute,extname,basename} from 'node:path';
import {getStorage} from 'firebase-admin/storage';
import {db} from '../lib/config/firebase.js';
import {uploadReplay} from '../lib/commands/statistics/uploadReplay.js';
import {submitGameResult} from '../lib/commands/results/submitGameResult.js';
import {respondToGameResult} from '../lib/commands/results/respondToGameResult.js';
import {executeNativeReadyPublication} from '../lib/services/nativeReadyPublication.js';
import {adminGetNativeReadyReview} from '../lib/queries/adminGetNativeReadyReview.js';
import {readActiveNativeBattleDetail} from '../lib/queries/getActiveNativeBattleDetail.js';
import {readActiveNativeBattleRecord} from '../lib/queries/getActiveNativeBattleRecord.js';
import {currentOfficialGameOutcome} from '../lib/engines/recordingMatchFacts.js';
import {activeNativeStatisticsSource} from '../lib/engines/activeNativeStatisticsSource.js';
import {digest} from '../lib/engines/nativeRecordingIntegration.js';

const project='demo-aof-authentic-ready';
assert.equal(process.env.GCLOUD_PROJECT,project,'Refuse anything except the fixed demo Firebase project');
assert.equal(process.env.FUNCTIONS_EMULATOR,'true','The worker may use loopback only in emulators');
for(const key of ['FIRESTORE_EMULATOR_HOST','FIREBASE_STORAGE_EMULATOR_HOST'])
  assert.match(process.env[key]??'',/^(127[.]0[.]0[.]1|localhost):[0-9]+$/,'Local '+key+' required');
const bucketName=project+'.appspot.com';
assert.ok(!process.env.REPLAY_BUCKET||process.env.REPLAY_BUCKET===bucketName,'Do not use an external Storage bucket');
const worker=new URL(process.env.REPLAY_WORKER_URL??'');
assert.ok(['127.0.0.1','localhost'].includes(worker.hostname)&&
  ['http:','https:'].includes(worker.protocol)&&!worker.username&&!worker.password,
  'Only the authenticated local native worker may receive private recordings');
assert.ok(process.env.REPLAY_WORKER_AUTH_TOKEN,'Worker authentication is required');
assert.match(process.env.AOF_NATIVE_REPLAY_PROCESSOR_REVISION??'',/^[a-f0-9]{64}$/,
  'Pin the real local native worker processor revision');
const fixturePath=process.env.AOF_NATIVE_READY_REAL_FIXTURE;
assert.ok(fixturePath&&isAbsolute(fixturePath),'Provide an absolute private fixture manifest path');
const fixture=JSON.parse(await readFile(fixturePath,'utf8'));
assert.equal(fixture.gameBuild,185872);
const caseSpec={
  '1v1':{format:'ONE_V_ONE',count:2,teamSize:1},
  '2v2':{format:'TWO_V_TWO',count:4,teamSize:2},
  '4v4':{format:'FOUR_V_FOUR',count:8,teamSize:4},
  FFA:{format:'FFA',count:null,teamSize:1},
}[fixture.format];
assert.ok(caseSpec,'Only approved 1v1/2v2/4v4/FFA fixtures are supported');
const actualCount=fixture.players?.length;
if(caseSpec.count!==null)assert.equal(actualCount,caseSpec.count,'Fixture roster differs from declared match format');
else assert.ok(actualCount>=3&&actualCount<=8,'FFA requires 3–8 independent human players');
assert.ok(typeof fixture.path==='string'&&isAbsolute(fixture.path)&&
  extname(fixture.path).toLowerCase()==='.aoe2record','Use an absolute real .aoe2record path');
assert.ok(Array.isArray(fixture.players)&&fixture.players.length===actualCount);
assert.ok(fixture.players.every(p=>Number.isInteger(p.replaySlot)&&p.replaySlot>0&&p.replaySlot<=8&&
  typeof p.sourceName==='string'&&p.sourceName.trim().length>0));
assert.equal(new Set(fixture.players.map(p=>p.replaySlot)).size,actualCount);
assert.equal(new Set(fixture.players.map(p=>p.sourceName.normalize('NFKC').trim().toLowerCase())).size,actualCount);
assert.ok(fixture.players.some(p=>p.replaySlot===fixture.reviewedOfficialWinnerReplaySlot),
  'Winner must be an independently reviewed manifest decision, never inferred from the recording');
const original=await readFile(fixture.path);
assert.ok(original.length>0&&original.length<=32*1024*1024,'Native input has a bounded original size');

const sourceHash=digest(original);
const matchId='real185872-'+sourceHash.slice(0,20);
const gameId='g1',actor={role:'ADMIN',playerId:matchId+'-admin',authUid:matchId+'-admin-uid'};
const viewer={playerId:matchId+'-player-1',authUid:matchId+'-viewer-uid'};
const matchRef=db.collection('matches').doc(matchId),gameRef=matchRef.collection('games').doc(gameId);
assert.equal((await matchRef.get()).exists,false,'Use a fresh isolated emulator database');
const bucket=getStorage().bucket(bucketName);
// Synthetic source-independent teams exercise the official reviewed-result
// contract. FFA never promotes an inferred historical final placement.
const roster=fixture.players.map((p,index)=>({
  playerId:matchId+'-player-'+(index+1),
  team:Math.floor(index/caseSpec.teamSize)+1,
}));
const slotName=s=>s.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US');
await db.collection('players').doc(actor.playerId).create({role:'ADMIN',membershipStatus:'ACTIVE',synthetic:true});
await db.collection('authLinks').doc(actor.authUid).create({playerId:actor.playerId});
for(let i=0;i<roster.length;i++)
  await db.collection('players').doc(roster[i].playerId).create({
    role:'PLAYER',membershipStatus:'ACTIVE',steamName:fixture.players[i].sourceName,synthetic:true});
await db.collection('authLinks').doc(viewer.authUid).create({playerId:viewer.playerId});
// A different independently authenticated opposing participant must confirm.
const confirmerPlayerId=roster[caseSpec.teamSize].playerId;
const confirmerAuthUid=matchId+'-independent-confirmer-uid';
assert.notEqual(confirmerPlayerId,viewer.playerId);
await db.collection('authLinks').doc(confirmerAuthUid).create({playerId:confirmerPlayerId});
await matchRef.create({status:'ACTIVE',opponentKind:'HUMAN',format:caseSpec.format,
  participants:roster,seriesRule:{maxGames:1,gamesRequiredToWin:1},
  context:{affectsSeasonStats:false,affectsLifetimeStats:true}});
await gameRef.create({status:'READY',gameNumber:1,players:roster,
  replayStatisticsRevision:0,replayStatisticsState:'UNAVAILABLE',activeReplayStatisticsId:null,
  replayParticipantBindings:fixture.players.map((p,i)=>({
    sourceNameNormalized:slotName(p.sourceName),playerId:roster[i].playerId
  }))});

// Local-process-only flags. These do not configure deployed Firebase services.
process.env.AOF_NATIVE_REPLAY_INTEGRATION='validate-v1';
process.env.AOF_NATIVE_REPLAY_PROJECT=project;
process.env.AOF_NATIVE_REPLAY_GAME_ALLOWLIST=matchId+'/'+gameId;
const validated=await uploadReplay.run({
  data:{matchId,gameId,fileName:basename(fixture.path),
    replayBase64:original.toString('base64'),processingMode:'NATIVE_VALIDATION_V1'},
  auth:{uid:actor.authUid},
});
assert.equal(validated.state,'VALIDATED_NOT_READY');
assert.equal(validated.activated,false);
assert.equal((await gameRef.collection('replaySources').get()).empty,true,
  'Validation cannot activate a source');
const candidateRef=gameRef.collection('nativeReplayValidations').doc(validated.candidateId);
const candidate=(await candidateRef.get()).data();
assert.equal(candidate?.sourceHash,sourceHash);
assert.equal(candidate?.processorRevision,process.env.AOF_NATIVE_REPLAY_PROCESSOR_REVISION);
for(const artifact of [candidate.originalRecording,candidate.recordedEvents,candidate.statistics]){
  const [stored]=await bucket.file(artifact.path,{generation:String(artifact.generation)}).download();
  assert.equal(digest(stored),artifact.sha256);
  assert.equal(stored.length,artifact.bytes);
}
assert.equal(candidate.originalRecording.permanent,true);
assert.equal(candidate.originalRecording.sourceDeletionAuthorized,false);
const claimId=Buffer.from(candidate.matchFacts.game.guid,'utf8').toString('hex');
const claimRef=db.collection('recordingGameClaims').doc(claimId);
assert.equal((await claimRef.get()).exists,false,'The real Game GUID must not already be attributed');

// This independently reviewed winner is test authority only. Do not copy or
// assert that this historical match was played by these synthetic league users.
const winner=fixture.players.findIndex(p=>p.replaySlot===fixture.reviewedOfficialWinnerReplaySlot);
const isTeamResult=caseSpec.teamSize>1,winningTeam=roster[winner].team;
const winners=roster.filter(p=>!isTeamResult||p.team===winningTeam).filter((p,i)=>
  isTeamResult||p.playerId===roster[winner].playerId).map(p=>p.playerId);
const losingIds=roster.map(p=>p.playerId).filter(id=>!winners.includes(id));
assert.equal(winners.length,isTeamResult?caseSpec.teamSize:1);
// Previously the harness directly wrote canonicalResult; this deliberately
// runs the actual two distinct Firebase auth-bound callable result commands.
// Historical fixture teams/outcome remain explicitly SYNTHETIC TEST AUTHORITY.
// Actual participant result contract: 1v1 is a team-of-one result, while
// FFA alone accepts winnerPlayerId. Deliberately avoid an invented 1v1 player-win.
const claimOutcome=fixture.format==='FFA'?{winnerPlayerId:roster[winner].playerId}:
  {winnerTeam:winningTeam};
const submitted=await submitGameResult.run({
  data:{matchId,gameId,...claimOutcome},auth:{uid:viewer.authUid}});
assert.equal(submitted.success,true);
assert.equal(submitted.status,'PENDING_CONFIRMATION');
assert.equal(submitted.alreadySubmitted,false);
assert.equal((await gameRef.get()).data().canonicalResult,undefined,
  'A lone submitter can never establish the official result');
assert.equal((await db.collection('processingJobs').get()).empty,true,
  'Submitting a claim cannot queue official scoring');
await assert.rejects(()=>respondToGameResult.run({
  data:{matchId,gameId,submissionId:submitted.submissionId,response:'CONFIRM'},
  auth:{uid:viewer.authUid}}),/cannot confirm their own|failed-precondition/i,
  'Self-confirmation must fail before an official result is created');
const independentlyConfirmed=await respondToGameResult.run({
  data:{matchId,gameId,submissionId:submitted.submissionId,response:'CONFIRM'},
  auth:{uid:confirmerAuthUid}});
assert.equal(independentlyConfirmed.success,true);
assert.equal(independentlyConfirmed.response,'CONFIRM');
assert.equal(independentlyConfirmed.matchCompleted,true);
assert.equal(independentlyConfirmed.canonicalResult.source,'PLAYER_CONFIRMED');
assert.equal(independentlyConfirmed.canonicalResult.revision,1);
assert.deepEqual([...independentlyConfirmed.canonicalResult.winningPlayerIds].sort(),
  [...winners].sort());
assert.deepEqual([...independentlyConfirmed.canonicalResult.losingPlayerIds].sort(),
  [...losingIds].sort());
const acceptedGame=(await gameRef.get()).data(),acceptedMatch=(await matchRef.get()).data();
assert.equal(currentOfficialGameOutcome(acceptedGame,acceptedMatch).qualification,'OFFICIAL');
const officialJobsBeforeReady=await db.collection('processingJobs').get();
assert.equal(officialJobsBeforeReady.size,1,
  'Exactly one official scoring job is created by independent result acceptance');
const originalOfficialJobId=officialJobsBeforeReady.docs[0].id;
assert.equal(officialJobsBeforeReady.docs[0].data().type,'MATCH_RESULT_ACCEPTED');

// The existing manual publisher is separately gated and refuses automatic
// promotions. We use only a local demo Game allowlist, not a live project flag.
process.env.AOF_NATIVE_READY_PUBLICATION='reviewed-v1';
process.env.AOF_ACTIVE_NATIVE_PLAYER_READS='1';
process.env.AOF_ACTIVE_NATIVE_SOCIAL_READS='1';
process.env.AOF_NATIVE_READY_GAME_ALLOWLIST=matchId+'/'+gameId;
process.env.AOF_NATIVE_READY_ROLLBACK='reviewed-v1';
const env={...process.env};
// Exercise the actual authenticated read-only staging/demo admin callable
// with this genuine recording, rather than only its isolated projector.
const nativeReviewRequest={matchId,gameId,candidateId:validated.candidateId};
const browserReview=await adminGetNativeReadyReview.run({
  data:nativeReviewRequest,auth:{uid:actor.authUid}});
assert.equal(browserReview.contract,'AOF_NATIVE_E2E_REVIEW_V1');
assert.equal(browserReview.candidateState,'VALIDATED_NOT_READY');
assert.equal(browserReview.candidatePublishEligible,true);
assert.equal(browserReview.expectedResultRevision,1);
assert.equal(browserReview.expectedStatisticsRevision,0);
assert.equal(browserReview.sourceHash,sourceHash);
assert.equal(browserReview.statisticsSha256,candidate.statistics.sha256);
assert.equal(browserReview.sourcePlayers.length,actualCount);
await assert.rejects(
  ()=>adminGetNativeReadyReview.run({data:nativeReviewRequest,auth:{uid:viewer.authUid}}),
  /permission|administrator|ADMIN/i,'A normal player cannot inspect unpublished native candidates');
const reviewedRequest={operation:'PUBLISH',matchId,gameId,candidateId:validated.candidateId,
  sourceHash,expectedArtifactSha256:candidate.statistics.sha256,
  expectedActiveSourceHash:null,expectedStatisticsRevision:0,expectedResultRevision:1,
  reason:'Isolated genuine-recording acceptance: independently reviewed synthetic Game result.'};
const publishStarted=Date.now();
const published=await executeNativeReadyPublication({db,bucket,actor,request:reviewedRequest,env});
const publicationMs=Date.now()-publishStarted;
assert.equal(published.state,'READY');
assert.equal(published.replayStatisticsRevision,1);
assert.equal(published.alreadyPublished,false);
const activeGame=(await gameRef.get()).data(),activeMatch=(await matchRef.get()).data();
const source=(await gameRef.collection('replaySources').doc(sourceHash).get()).data();
assert.ok(activeNativeStatisticsSource(matchId,gameId,activeMatch,activeGame,sourceHash,source,true),
  'The real native source must be accepted by the ordinary active-source reader');
assert.equal(activeGame.activeReplayStatisticsId,sourceHash);
assert.equal(currentOfficialGameOutcome(activeGame,activeMatch).qualification,'OFFICIAL');
assert.equal((await candidateRef.get()).data()?.state,'PUBLISHED_READY');
const afterPublish=await adminGetNativeReadyReview.run({data:nativeReviewRequest,auth:{uid:actor.authUid}});
assert.equal(afterPublish.candidateState,'PUBLISHED_READY');
assert.equal(afterPublish.nativeSourceIsActive,true);
assert.equal(afterPublish.candidatePublishEligible,false);
const reread=()=>({db,bucket,actor:viewer,env});
const detailStarted=Date.now();
const detail=await readActiveNativeBattleDetail({...reread(),request:{
  matchId,gameId,mode:'list',replaySlot:fixture.players[0].replaySlot,group:'battles',
  offset:0,pageSize:5}});
const detailMs=Date.now()-detailStarted;
assert.equal(detail.success,true);
assert.equal(detail.delivery,'NATIVE_BOUNDED_V1');
assert.ok((detail.entries??[]).length<=5,'Bounded Battle detail, never giant expanded JSON');
const recordStarted=Date.now();
const record=await readActiveNativeBattleRecord({...reread(),request:{
  matchId,gameId,mode:'overview'}});
const recordMs=Date.now()-recordStarted;
assert.equal(record.success,true);
assert.equal(record.state,'READY');
assert.equal(record.officialOutcome?.qualification,'OFFICIAL');
const socialPage=await readActiveNativeBattleRecord({...reread(),request:{
  matchId,gameId,mode:'page',section:'ledgerIncidents',offset:0,
  expectedArtifactSha256:record.artifactSha256,
  expectedReviewRevision:record.reviewRevision}});
assert.ok((socialPage.entries??[]).length<=20,'Native social pages must be bounded');
let fragmentOffset=0,fragmentComplete=false,fragmentHash=null;
const matchFactsParts=[];
for(let i=0;i<8;i++){
  const chunk=await readActiveNativeBattleRecord({...reread(),request:{
    matchId,gameId,mode:'fragment',section:'matchFacts',offset:fragmentOffset,
    expectedArtifactSha256:record.artifactSha256,
    expectedReviewRevision:record.reviewRevision}});
  assert.equal(chunk.totalBytes<=256*1024,true,'No enormous inline social review object');
  const bytes=Buffer.from(chunk.chunkBase64,'base64');
  assert.ok(bytes.length<=32*1024&&bytes.length>0,'Each native record transfer remains bounded');
  matchFactsParts.push(bytes);
  fragmentHash=chunk.contentSha256;
  if(chunk.complete){fragmentComplete=true;break;}
  assert.ok(chunk.nextOffset>fragmentOffset,'Fragment offsets must progress');
  fragmentOffset=chunk.nextOffset;
}
assert.equal(fragmentComplete,true,'The bounded match-facts review must be reconstructible');
const reviewedBytes=Buffer.concat(matchFactsParts);
assert.equal(digest(reviewedBytes),fragmentHash,'Verified transfer JSON sha256');
assert.equal(JSON.parse(reviewedBytes.toString('utf8')).modelVersion,candidate.matchFacts.modelVersion);
if(detail.entries?.length){
  const fragment=await readActiveNativeBattleDetail({...reread(),request:{
    matchId,gameId,mode:'fragment',replaySlot:fixture.players[0].replaySlot,
    group:'battles',reference:detail.entries[0].reference,offset:0,
    expectedArtifactSha256:detail.artifactSha256}});
  assert.equal(fragment.mode,'fragment');
  assert.ok(Buffer.from(fragment.chunkBase64,'base64').length<=32*1024);
}
await assert.rejects(readActiveNativeBattleDetail({...reread(),env:{
  ...env,AOF_ACTIVE_NATIVE_PLAYER_READS:''},request:{
  matchId,gameId,mode:'list',replaySlot:fixture.players[0].replaySlot,group:'battles'}}),
  error=>error?.code==='failed-precondition');

// A retry must be a read-only success with the same source and revision.
assert.equal((await executeNativeReadyPublication({db,bucket,actor,request:reviewedRequest,env}))
  .alreadyPublished,true);
const rollbackStarted=Date.now();
const rolled=await executeNativeReadyPublication({db,bucket,actor,env,request:{
  ...reviewedRequest,operation:'ROLLBACK',expectedActiveSourceHash:sourceHash,
  expectedStatisticsRevision:1,
  reason:'Isolated genuine-recording acceptance complete; restore the unpublished source pointer.'}});
const rollbackMs=Date.now()-rollbackStarted;
assert.equal(rolled.state,'ROLLED_BACK');
const afterRollback=await adminGetNativeReadyReview.run({data:nativeReviewRequest,auth:{uid:actor.authUid}});
assert.equal(afterRollback.candidateState,'ROLLED_BACK');
assert.equal(afterRollback.nativeSourceIsActive,false);
assert.equal(rolled.replayStatisticsRevision,2);
assert.equal((await gameRef.get()).data().activeReplayStatisticsId,null);
assert.equal((await candidateRef.get()).data().state,'ROLLED_BACK');
assert.equal((await gameRef.collection('replaySources').doc(sourceHash).get()).exists,true,
  'Rollback must retain the immutable published evidence');
await assert.rejects(readActiveNativeBattleRecord({...reread(),request:{
  matchId,gameId,mode:'overview'}}),error=>error?.code==='failed-precondition');
assert.equal((await claimRef.get()).exists,false,
  'Publisher-created GUID attribution must be released after rollback');
const jobsAfterSourceRollback=await db.collection('processingJobs').get();
assert.equal(jobsAfterSourceRollback.size,1,
  'Native source publication/rollback must not create or duplicate result jobs');
assert.equal(jobsAfterSourceRollback.docs[0].id,originalOfficialJobId,
  'The original independently accepted result job must retain its identity');
for(const artifact of [candidate.originalRecording,candidate.recordedEvents,candidate.statistics]){
  const [stored]=await bucket.file(artifact.path,{generation:String(artifact.generation)}).download();
  assert.equal(digest(stored),artifact.sha256);
}

const report={test:'authentic-185872-reviewed-ready-local-v2',environment:project,fixtureFormat:fixture.format,recordedHumanSlots:actualCount,
  fixtureBuildDeclared:fixture.gameBuild,sourceSha256:sourceHash,sourceBytes:original.length,
  originalRetained:true,eventsSha256:candidate.recordedEvents.sha256,
  statisticsSha256:candidate.statistics.sha256,reviewedOutcomeSource:'synthetic_fixture_through_real_two_person_result_callables',
  independentOfficialResultCallables:true,officialResultProcessingJobPreserved:true,
  validationState:'VALIDATED_NOT_READY',reviewedPublicationState:'READY',
  finalState:'ROLLED_BACK',nativeReaderAndSocialOverview:true,verifiedSocialFragment:true,rollbackRetainsSource:true,
  timingsMs:{handlerReceivedToValidation:validated.timings?.totalServerReceivedToValidationMs??null,
    reviewedPublication:publicationMs,readBattleDetail:detailMs,readBattleRecord:recordMs,
    sourceRollback:rollbackMs},
  notMeasured:'Live callable/network overhead, real browser, actual cloud worker cold starts, autonomous upload-to-READY, total cloud received-to-READY SLA, independently certified FFA placement'};
const root=resolve('.replay-lab/authentic-185872-ready');
await mkdir(root,{recursive:true});
await writeFile(resolve(root,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',...report}));
await db.terminate();
