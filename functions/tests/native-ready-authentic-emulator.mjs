/**
 * Opt-in authentic AoE2 DE 185872 single-Game evidence acceptance.
 * Local Firebase Firestore/Storage and an authenticated loopback native worker
 * ONLY. Original recordings, private fixture names and tokens never enter Git.
 * No automatic READY activation, production writes or cloud deployment.
 */
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,isAbsolute,extname,basename} from 'node:path';
import {getStorage} from 'firebase-admin/storage';
import {Timestamp} from 'firebase-admin/firestore';
import {db} from '../lib/config/firebase.js';
import {uploadReplay} from '../lib/commands/statistics/uploadReplay.js';
import {executeNativeReadyPublication} from '../lib/services/nativeReadyPublication.js';
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
assert.equal(fixture.format,'1v1','First bounded milestone is an authentic 1v1 recording');
assert.ok(typeof fixture.path==='string'&&isAbsolute(fixture.path)&&
  extname(fixture.path).toLowerCase()==='.aoe2record','Use an absolute real .aoe2record path');
assert.ok(Array.isArray(fixture.players)&&fixture.players.length===2);
assert.ok(fixture.players.every(p=>Number.isInteger(p.replaySlot)&&p.replaySlot>0&&p.replaySlot<=8&&
  typeof p.sourceName==='string'&&p.sourceName.trim().length>0));
assert.equal(new Set(fixture.players.map(p=>p.replaySlot)).size,2);
assert.equal(new Set(fixture.players.map(p=>p.sourceName.normalize('NFKC').trim().toLowerCase())).size,2);
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
const now=Timestamp.now();
const roster=fixture.players.map((p,index)=>({playerId:matchId+'-player-'+(index+1),team:index+1}));
const slotName=s=>s.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US');
await db.collection('players').doc(actor.playerId).create({role:'ADMIN',membershipStatus:'ACTIVE',synthetic:true});
await db.collection('authLinks').doc(actor.authUid).create({playerId:actor.playerId});
for(let i=0;i<roster.length;i++)
  await db.collection('players').doc(roster[i].playerId).create({
    role:'PLAYER',membershipStatus:'ACTIVE',steamName:fixture.players[i].sourceName,synthetic:true});
await db.collection('authLinks').doc(viewer.authUid).create({playerId:viewer.playerId});
await matchRef.create({status:'ACTIVE',opponentKind:'HUMAN',format:'ONE_V_ONE',
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
const gameResult={source:'PLAYER_CONFIRMED',type:'PLAYER_WIN',winnerPlayerId:roster[winner].playerId,
  winnerTeam:null,revision:1,
  winningPlayerIds:[roster[winner].playerId],losingPlayerIds:[roster[1-winner].playerId]};
await gameRef.update({status:'COMPLETED',canonicalResult:gameResult,completedAt:now});
await matchRef.update({status:'COMPLETED',canonicalResult:{...gameResult,sourceGameId:gameId},
  completedAt:now,firstCompletedAt:now});
const acceptedGame=(await gameRef.get()).data(),acceptedMatch=(await matchRef.get()).data();
assert.equal(currentOfficialGameOutcome(acceptedGame,acceptedMatch).qualification,'OFFICIAL');

// The existing manual publisher is separately gated and refuses automatic
// promotions. We use only a local demo Game allowlist, not a live project flag.
process.env.AOF_NATIVE_READY_PUBLICATION='reviewed-v1';
process.env.AOF_ACTIVE_NATIVE_PLAYER_READS='1';
process.env.AOF_ACTIVE_NATIVE_SOCIAL_READS='1';
process.env.AOF_NATIVE_READY_GAME_ALLOWLIST=matchId+'/'+gameId;
process.env.AOF_NATIVE_READY_ROLLBACK='reviewed-v1';
const env={...process.env};
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
assert.equal(rolled.replayStatisticsRevision,2);
assert.equal((await gameRef.get()).data().activeReplayStatisticsId,null);
assert.equal((await candidateRef.get()).data().state,'ROLLED_BACK');
assert.equal((await gameRef.collection('replaySources').doc(sourceHash).get()).exists,true,
  'Rollback must retain the immutable published evidence');
await assert.rejects(readActiveNativeBattleRecord({...reread(),request:{
  matchId,gameId,mode:'overview'}}),error=>error?.code==='failed-precondition');
assert.equal((await claimRef.get()).exists,false,
  'Publisher-created GUID attribution must be released after rollback');
assert.equal((await db.collection('processingJobs').get()).empty,true,
  'Manual source switching must not invent an official scoring job');
for(const artifact of [candidate.originalRecording,candidate.recordedEvents,candidate.statistics]){
  const [stored]=await bucket.file(artifact.path,{generation:String(artifact.generation)}).download();
  assert.equal(digest(stored),artifact.sha256);
}

const report={test:'authentic-185872-reviewed-ready-local-v1',environment:project,
  fixtureBuildDeclared:fixture.gameBuild,sourceSha256:sourceHash,sourceBytes:original.length,
  originalRetained:true,eventsSha256:candidate.recordedEvents.sha256,
  statisticsSha256:candidate.statistics.sha256,reviewedOutcomeSource:'synthetic_independent_fixture',
  validationState:'VALIDATED_NOT_READY',reviewedPublicationState:'READY',
  finalState:'ROLLED_BACK',nativeReaderAndSocialOverview:true,rollbackRetainsSource:true,
  timingsMs:{handlerReceivedToValidation:validated.timings?.totalServerReceivedToValidationMs??null,
    reviewedPublication:publicationMs,readBattleDetail:detailMs,readBattleRecord:recordMs,
    sourceRollback:rollbackMs},
  notMeasured:'Live callable/network overhead, real browser, actual cloud worker cold starts, autonomous upload-to-READY, total cloud received-to-READY SLA, multi-format acceptance'};
const root=resolve('.replay-lab/authentic-185872-ready');
await mkdir(root,{recursive:true});
await writeFile(resolve(root,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',...report}));
await db.terminate();
