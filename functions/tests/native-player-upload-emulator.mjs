import {intV1SourceAcceptance} from './int-v1-private-experience-emulator.mjs';
import {socialEvidenceAcceptance} from './social-evidence-v1a-emulator.mjs';
/** Ordinary upload acceptance. Real local worker + Firebase emulators only.
 * Fixture metadata and expected winners come from the pinned independent TownBell reports.
 * No real identities or recordings are committed in the resulting report. */
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {getStorage} from 'firebase-admin/storage';
import {db} from '../lib/config/firebase.js';
import {uploadReplay} from '../lib/commands/statistics/uploadReplay.js';
import {adminReviewRecordingResult} from '../lib/commands/results/reviewRecordingResult.js';
import {getPlayerChronicle} from '../lib/queries/getPlayerChronicle.js';
import {getStatisticsExperience} from '../lib/queries/getStatisticsExperience.js';
import {readActiveNativeBattleDetail} from '../lib/queries/getActiveNativeBattleDetail.js';
import {collectStatistics,rebuildStatisticsReadModels} from '../lib/services/statisticsExperienceProjection.js';
import {resolveRecordingResult} from '../lib/services/recordingResult.js';
import {deriveRecordingOutcome} from '../lib/engines/recordingOutcome.js';
import {currentOfficialGameOutcome} from '../lib/engines/recordingMatchFacts.js';
import {digest} from '../lib/engines/nativeRecordingIntegration.js';
import {processMatchRewards} from '../lib/commands/processing/processMatchRewards.js';
import {SYSTEM_RESULT_PROCESSING_ACTOR} from '../lib/services/resultProcessingActor.js';
import {seasonScoringSnapshot} from '../lib/engines/seasonPoints.js';
import {validateNativeRecording} from '../lib/services/nativeRecordingValidation.js';
import {publishNativePlayerRecording} from '../lib/services/nativePlayerRecording.js';
import {AsyncLocalStorage} from 'node:async_hooks';
import {diagnosticRenderWitness} from './support/upload-diagnostic-render-witness.mjs';

// Associate only safe diagnostic records with this local test invocation.
const performanceContext=new AsyncLocalStorage();
const serverInfo=console.info;
console.info=(message,...rest)=>{
  try{const value=JSON.parse(message);
    if(value.event==='AOF_REPLAY_UPLOAD_NATIVE_PERFORMANCE_V1'){
      const context=performanceContext.getStore();context?.push(value.timings);context?.records?.push(value);
    }
  }catch{/* Other existing logs are not performance records. */}
  serverInfo(message,...rest);
};

const project='demo-aof-native-player';
assert.equal(process.env.GCLOUD_PROJECT,project);
assert.equal(process.env.FUNCTIONS_EMULATOR,'true');
for(const k of ['FIRESTORE_EMULATOR_HOST','FIREBASE_STORAGE_EMULATOR_HOST'])assert.match(process.env[k]??'',/^127\.0\.0\.1:\d+$/);
assert.equal(new URL(process.env.REPLAY_WORKER_URL).hostname,'127.0.0.1');
assert.equal(process.env.REPLAY_BUCKET,project+'.appspot.com');
const root=resolve(process.env.AOF_NATIVE_CORPUS),out=resolve('.replay-lab/native-player');
await mkdir(out,{recursive:true});
Object.assign(process.env,{AOF_NATIVE_PLAYER_UPLOAD:'recorded-events-v1',AOF_NATIVE_REPLAY_PROJECT:project,AOF_ACTIVE_NATIVE_PLAYER_READS:'1',AOF_ACTIVE_NATIVE_SOCIAL_READS:'1'});
// Admin validation/publication flags stay OFF. Existing read-only history is enabled locally, never social scoring.
assert.ok(!process.env.AOF_NATIVE_REPLAY_INTEGRATION&&!process.env.AOF_NATIVE_READY_PUBLICATION);
const bucket=getStorage().bucket(process.env.REPLAY_BUCKET),reports=[];
const witnessMode=process.env.AOF_NATIVE_DIAGNOSTIC_WITNESS==='1',witnesses=[],witnessGuids=new Set(),witnessActors=new Set(),witnessIntervals=[];
if(witnessMode){assert.equal(process.env.AOF_REPLAY_UPLOAD_PERF_TRACE,'1');assert.ok(process.env.AOF_NATIVE_DIAGNOSTIC_WORKER_LOG);}
let first;
const allCases=[['1v1_t90-deak','ONE_V_ONE','ACCEPTED'],['2v2_arabia','TWO_V_TWO','PENDING_ADMIN_REVIEW'],
  ['4v4_arabia','FOUR_V_FOUR','ACCEPTED'],['FFA_7','FFA','PENDING_ADMIN_REVIEW']];
const cases=witnessMode?allCases.slice(0,2):allCases;
const concurrency=Number(process.env.AOF_NATIVE_PERF_CONCURRENCY??1);
assert.ok([1,2].includes(concurrency),'Local authentic performance diagnostic supports one or two users.');
if(concurrency===2)process.env.AOF_NATIVE_PLAYER_UPLOAD_GAME_ALLOWLIST=cases.map(([name])=>'player-'+name+'/g1').join(',');
await db.doc('players/operator').set({role:'ADMIN',membershipStatus:'ACTIVE'});
await db.doc('authLinks/operator').set({playerId:'operator'});
async function runCase([name,format,expected]){
  const independent=JSON.parse(await readFile(resolve(root,name+'.json'),'utf8'));
  assert.equal(independent.meta.game_build,185872);
  const matchId='player-'+name,gameId='g1',mr=db.doc('matches/'+matchId),gr=mr.collection('games').doc(gameId);
  const original=await readFile(resolve(root,name+'.aoe2record')),sourceHash=digest(original);
  const players=independent.meta.players,teams=[...new Set(players.map(p=>p.team_id))].sort();
  const roster=players.map(p=>({playerId:matchId+'-p'+p.number,team:format==='FFA'?p.number:teams.indexOf(p.team_id)+1}));
  const actor={playerId:roster[0].playerId,authUid:roster[0].playerId,role:'PLAYER'};
  for(let i=0;i<players.length;i++){
    await db.doc('players/'+roster[i].playerId).set({role:'PLAYER',membershipStatus:'ACTIVE',steamName:players[i].name,goldBalance:0});
    await db.doc('authLinks/'+roster[i].playerId).set({playerId:roster[i].playerId});
  }
  const eventId=matchId+'-event',seasonId=matchId+'-season';
  const config={maps:{pool:['Arabia']},civilizations:{mode:'UNRESTRICTED'},victory:{conquest:true,wonder:false,relic:false},diplomacyEnabled:false,additionalSettings:{}};
  await mr.create({status:'ACTIVE',format,opponentKind:'HUMAN',participants:roster,seriesRule:{maxGames:1,gamesRequiredToWin:1},
    gameConfigSnapshot:config,seasonId,eventId,context:{affectsSeasonStats:true,affectsLifetimeStats:true,affectsLeaguePoints:true,affectsGold:true},
    scoringSnapshot:seasonScoringSnapshot({act:'MAIN',diplomacyEnabled:false,placementPolicy:'NONE',emperorPlayerId:null}),goldRewardSnapshot:{matchCompletion:1,matchWin:2}});
  await db.doc('seasons/'+seasonId).set({status:'ACTIVE'});
  await db.doc('events/'+eventId).set({status:'ACTIVE',seasonId,officialMatchIds:[matchId],warmupMatchIds:[]});
  for(const p of roster)await db.doc('events/'+eventId+'/scoringSlots/MAIN_'+p.playerId).set({matchId,playerId:p.playerId,seasonId,act:'MAIN'});
  await gr.create({status:'READY',gameNumber:1,players:roster,replayStatisticsRevision:0,activeReplayStatisticsId:null,
    replayParticipantBindings:players.map((p,i)=>({sourceNameNormalized:p.name.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US'),playerId:roster[i].playerId}))});
  if(concurrency===1)process.env.AOF_NATIVE_PLAYER_UPLOAD_GAME_ALLOWLIST=matchId+'/'+gameId;
  const seededMatch=(await mr.get()).data(),seededGame=(await gr.get()).data();
  const request={auth:{uid:actor.authUid},data:{matchId,gameId,fileName:name+'.aoe2record',replayBase64:original.toString('base64'),processingMode:'AUTO'}};
  const diagnosticOn=process.env.AOF_REPLAY_UPLOAD_PERF_TRACE==='1';
  if(diagnosticOn)request.data.diagnosticTraceId='00000000-0000-4000-8000-000000000000'; // Must never be trusted.
  await assert.rejects(uploadReplay.run({...request,auth:{uid:'operator-unknown'}}),error=>{assert.equal(error.details?.diagnosticTraceId,undefined);return true;});
  const began=Date.now();
  const nativeHandlerTimings=[];nativeHandlerTimings.records=[];
  const initialUpload=()=>performanceContext.run(nativeHandlerTimings,()=>uploadReplay.run(request));
  const attempts=await Promise.allSettled(name==='1v1_t90-deak'&&concurrency===1&&!witnessMode?[initialUpload(),initialUpload()]:[initialUpload()]);
  const successes=attempts.filter(r=>r.status==='fulfilled');
  assert.ok(successes.length>0,attempts.map(r=>r.reason?.message).join('; '));
  const response=successes[0].value;
  const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
  if(diagnosticOn){
    assert.match(response.diagnosticTraceId,uuid);assert.notEqual(response.diagnosticTraceId,request.data.diagnosticTraceId);
    const record=nativeHandlerTimings.records.find(record=>record.diagnosticTraceId===response.diagnosticTraceId);
    assert.equal(record?.status,'READY');assert.equal(typeof record?.workerInvoked,'boolean');
    assert.ok(nativeHandlerTimings.records.some(record=>record.workerInvoked));
    assert.equal(record?.route,'/process-native-v1');assert.equal(record?.configuredProcessorRevision,process.env.AOF_NATIVE_REPLAY_PROCESSOR_REVISION);
    assert.equal(new Set(nativeHandlerTimings.records.map(record=>record.diagnosticTraceId)).size,attempts.length);
    for(const attempt of attempts)if(attempt.status==='rejected'&&attempt.reason.details?.diagnosticTraceId){
      assert.match(attempt.reason.details.diagnosticTraceId,uuid);
      assert.ok(nativeHandlerTimings.records.some(record=>record.diagnosticTraceId===attempt.reason.details.diagnosticTraceId&&record.status==='FAILED'));
    }
  }else assert.equal(response.diagnosticTraceId,undefined);
  const uploadMs=Date.now()-began;
  assert.equal(response.state,'READY');assert.equal(response.outcomeResolution.state,expected,name+': '+JSON.stringify(response.outcomeResolution));
  const sr=gr.collection('replaySources').doc(sourceHash),source=(await sr.get()).data();
  let game=(await gr.get()).data(),match=(await mr.get()).data();
  assert.equal(source.originalRecording.permanent,true);assert.equal(source.originalRecording.sourceDeletionAuthorized,false);
  for(const a of [source.originalRecording,source.recordedEvents,source.statistics]){
    const [bytes]=await bucket.file(a.path,{generation:a.generation}).download();assert.equal(digest(bytes),a.sha256);
  }
  if(process.env.AOF_SOCIAL_EVIDENCE_V1A_READS==='1')await socialEvidenceAcceptance({db,bucket,actor,matchId,gameId,name});
  if(process.env.AOF_INT_V1_ACCEPTANCE==='1')await intV1SourceAcceptance({db,bucket,actor,matchId,gameId,name});
  const candidate=(await gr.collection('nativeReplayValidations').doc(source.nativeValidationCandidateId).get()).data();
  const directory=resolve(out,name);await mkdir(directory,{recursive:true});
  for(const [field,file] of [['recordedEvents','events.jsonl.gz'],['statistics','statistics.direct.json.gz']]){
    const [bytes]=await bucket.file(source[field].path,{generation:source[field].generation}).download();await writeFile(resolve(directory,file),bytes);
  }
  await writeFile(resolve(directory,'manifest.json'),JSON.stringify({contract:'AOF_NATIVE_REPLAY_PACKAGE_V1_EXPERIMENTAL',source:{sha256:sourceHash,bytes:original.length},
    recordedEvents:{...source.recordedEvents,path:'events.jsonl.gz'},statistics:{...source.statistics,path:'statistics.direct.json.gz'},
    retention:{sourceDeletionAuthorized:false,canonicalReplayProduced:false}}));
  if(!first)first={original,actor,match:seededMatch,game:seededGame,sourceHash,mapping:source.playerMapping,
    worker:{contract:'AOF_NATIVE_REPLAY_PACKAGE_V1_EXPERIMENTAL',state:'VERIFIED_UNPUBLISHED',originalRecordingRetentionRequired:true,
      sourceHash,sourceBytes:original.length,processorRevision:source.processorRevision,matchFacts:source.matchFacts,
      sourcePlayers:source.playerMapping.map(p=>({replaySlot:p.replaySlot,sourceName:p.sourceName})),
      recordedEvents:{...source.recordedEvents,base64:(await readFile(resolve(directory,'events.jsonl.gz'))).toString('base64')},
      statistics:{...source.statistics,base64:(await readFile(resolve(directory,'statistics.direct.json.gz'))).toString('base64')}}};
  const qualified=deriveRecordingOutcome(match,game,source);
  assert.equal(qualified.state,expected==='ACCEPTED'?'VERIFIED':'PENDING_ADMIN_REVIEW');
  assert.deepEqual(qualified,deriveRecordingOutcome(match,game,{...source,nativePublicationVersion:undefined,ordinaryUploadVersion:undefined}));
  if(expected==='ACCEPTED'){
    const chronicle=await getPlayerChronicle.run({auth:{uid:actor.authUid},data:{}});
    assert.ok(chronicle.chronicle.pages.length>0);
    const winners=players.filter(p=>p.winner===true).map(p=>matchId+'-p'+p.number).sort();
    assert.ok(winners.length);assert.deepEqual([...game.canonicalResult.winningPlayerIds].sort(),winners);
    assert.equal(game.canonicalResult.revision,1);assert.equal(game.recordingResultBinding.sourceHash,sourceHash);
    const rewardInput={matchId,requestId:'ordinary-'+matchId};
    await processMatchRewards(rewardInput,SYSTEM_RESULT_PROCESSING_ACTOR);
    const ledger=await db.collection('leaguePointLedger').where('matchId','==',matchId).get();
    const gold=await db.collection('goldLedger').where('matchId','==',matchId).get();
    assert.ok(ledger.size>0&&gold.size>0);
    await processMatchRewards(rewardInput,SYSTEM_RESULT_PROCESSING_ACTOR);
    assert.equal((await db.collection('leaguePointLedger').where('matchId','==',matchId).get()).size,ledger.size);
    for(const p of roster)assert.equal((await db.doc('players/'+p.playerId).get()).data().goldBalance,winners.includes(p.playerId)?3:1);
  }else{
    assert.equal(game.canonicalResult,undefined);assert.equal((await db.collection('processingJobs').where('matchId','==',matchId).get()).size,0);
  }
  const readBegan=performance.now();
  const detail=await readActiveNativeBattleDetail({db,bucket,actor,env:process.env,request:{matchId,gameId,mode:'list',replaySlot:players[0].number,group:'battles',pageSize:20}});
  const authenticatedBoundedReadMs=performance.now()-readBegan;
  assert.equal(detail.state,'READY');
  await assert.rejects(getStatisticsExperience.run({auth:{uid:'operator-unknown'},data:{matchId}}));
  const battleQueryBegan=performance.now();
  const battleDataset=await getStatisticsExperience.run({auth:{uid:actor.authUid},data:{matchId}});
  const authenticatedBattleStatisticsQueryMs=performance.now()-battleQueryBegan;
  assert.equal(battleDataset.games.length,1);
  assert.equal(battleDataset.games[0].sourceHash,sourceHash);
  assert.equal(battleDataset.games[0].revision,1);
  assert.equal(battleDataset.games[0].eligible,expected==='ACCEPTED');
  assert.deepEqual(battleDataset.games[0].players.map(p=>p.playerId).sort(),roster.map(p=>p.playerId).sort());
  if(witnessMode){
    const witness=await diagnosticRenderWitness({receipt:response,dataset:battleDataset,
      expected:{matchId,gameId,sourceSha256:sourceHash,revision:response.replayStatisticsRevision},
      records:nativeHandlerTimings.records,workerLogPath:process.env.AOF_NATIVE_DIAGNOSTIC_WORKER_LOG,root:resolve('.')});
    const current=(await gr.get()).data();
    assert.ok(current.activeReplayStatisticsId===sourceHash&&current.replayStatisticsRevision===response.replayStatisticsRevision,'Current source changed during render witness');
    assert.ok(!witnessGuids.has(source.matchFacts.game.guid)&&!witnessActors.has(actor.authUid),'Witness requires independent recorded Games and authenticated actors');
    witnessGuids.add(source.matchFacts.game.guid);witnessActors.add(actor.authUid);witnessIntervals.push([began,began+uploadMs]);
    witnesses.push({...witness,currentSourceRevisionRechecked:true});
  }
  let dataset=await collectStatistics({matchId});assert.equal(dataset.games.length,1);assert.equal(dataset.games[0].eligible,expected==='ACCEPTED');
  await rebuildStatisticsReadModels();
  assert.equal((await db.doc('players/'+actor.playerId+'/statistics/experienceLifetime').get()).data().games,expected==='ACCEPTED'?1:0);
  const retryBegan=performance.now();
  const retryRecords=[];retryRecords.records=[];
  const retry=await performanceContext.run(retryRecords,()=>uploadReplay.run(request));assert.equal(retry.alreadyProcessed,true);assert.equal(retry.replayStatisticsRevision,1);
  const idempotentRetryMs=performance.now()-retryBegan;
  let diagnosticTraceOffResponseEquivalent=null;
  if(diagnosticOn){
    assert.match(retry.diagnosticTraceId,uuid);assert.notEqual(retry.diagnosticTraceId,response.diagnosticTraceId);
    const record=retryRecords.records.find(record=>record.diagnosticTraceId===retry.diagnosticTraceId);
    assert.equal(record?.workerInvoked,false);assert.deepEqual(record?.validationTimings,{});
    if(concurrency===1){
      const saved=process.env.AOF_REPLAY_UPLOAD_PERF_TRACE;
      try{delete process.env.AOF_REPLAY_UPLOAD_PERF_TRACE;const plain=await uploadReplay.run(request);
        const {diagnosticTraceId,...expected}=retry;assert.equal(plain.diagnosticTraceId,undefined);
        assert.equal(JSON.stringify(plain),JSON.stringify(expected));diagnosticTraceOffResponseEquivalent=true;
      }finally{if(saved===undefined)delete process.env.AOF_REPLAY_UPLOAD_PERF_TRACE;else process.env.AOF_REPLAY_UPLOAD_PERF_TRACE=saved;}
    }
  }else assert.equal(retry.diagnosticTraceId,undefined);
  assert.equal((await gr.collection('replaySources').get()).size,1);assert.equal((await gr.collection('nativeReplayPublications').get()).size,1);
  await resolveRecordingResult(matchId,gameId);assert.equal((await gr.get()).data().resultRevision,expected==='ACCEPTED'?1:undefined);
  if(name==='2v2_arabia'){
    const winning=players.find(p=>p.winner===true),winnerTeam=teams.indexOf(winning.team_id)+1;
    await assert.rejects(adminReviewRecordingResult.run({auth:{uid:actor.authUid},data:{matchId,gameId,sourceHash,outcome:{winnerTeam},reason:'Independent fixture outcome review',playedWithinWindow:true}}));
    await adminReviewRecordingResult.run({auth:{uid:'operator'},data:{matchId,gameId,sourceHash,outcome:{winnerTeam},reason:'Independent fixture outcome review',playedWithinWindow:true}});
    game=(await gr.get()).data();match=(await mr.get()).data();assert.equal(currentOfficialGameOutcome(game,match).qualification,'OFFICIAL');
    assert.equal((await collectStatistics({matchId})).games[0].eligible,true);
    assert.equal((await uploadReplay.run(request)).replayStatisticsRevision,1);
  }
  assert.equal(candidate.ordinaryUploadVersion,'AOF_NATIVE_PLAYER_UPLOAD_V1');
  const jobs=await gr.collection('nativeReplayValidationJobs').get();
  const validationTimings=jobs.docs.find(d=>d.data().candidateId===source.nativeValidationCandidateId)?.data().timings;
  reports.push({fixture:name,sourceSha256:sourceHash,inputBytes:original.length,processorRevision:source.processorRevision,
    expectedOutcome:expected,ready:true,retentionVerified:true,independentOutcomeVerified:true,boundedReader:true,
    pendingExclusion:true,retryIdempotent:true,serverReceivedToReadyAndResolutionMs:uploadMs,
    authenticatedBoundedReadMs,authenticatedBattleStatisticsQueryMs,idempotentRetryMs,validationTimings:validationTimings??null,nativeHandlerTimings,
    diagnosticTraceOffResponseEquivalent,
    ordinaryRequestAttempts:attempts.map(r=>r.status==='fulfilled'?{state:r.value.state,alreadyProcessed:r.value.alreadyProcessed}:
      {state:'REJECTED',code:r.reason?.code??null})});
  if(!witnessMode)console.log(JSON.stringify(reports.at(-1)));
}
for(let offset=0;offset<cases.length;offset+=concurrency)await Promise.all(cases.slice(offset,offset+concurrency).map(runCase));
if(witnessMode){
  assert.equal(witnesses.length,2);assert.equal(new Set(witnesses.map(row=>row.diagnosticTraceId)).size,2);
  const concurrentHandlerOverlap=concurrency===2&&Math.max(...witnessIntervals.map(row=>row[0]))<Math.min(...witnessIntervals.map(row=>row[1]));
  if(concurrency===2)assert.ok(concurrentHandlerOverlap,'Independent handler attempts did not overlap');
  await writeFile(resolve(out,'diagnostic-render-witness.json'),JSON.stringify({contract:'AOF_UPLOAD_DIAGNOSTIC_RENDER_WITNESS_1',
    demoOnly:true,distinctRecordedGuids:witnessGuids.size===2,distinctAuthenticatedActors:witnessActors.size===2,
    distinctAttemptTraceIds:true,concurrentHandlerOverlap,witnesses},null,2)+'\n');
}
// Fault injection reuses the verified real package; it never changes source facts.
const faultMeasurements=[];
async function rejectFault(name,run,expected){
  const started=performance.now();let code=null;
  await assert.rejects(async()=>{try{return await run();}catch(error){code=error.code??null;throw error;}},expected);
  faultMeasurements.push({fault:name,elapsedMs:performance.now()-started,code,injectedOrControlled:true,
    boundary:'Local service rejection; not a real worker/network timeout.'});
}
async function faultInput(name){
  const matchId='fault-'+name,gameId='g1',mr=db.doc('matches/'+matchId),gr=mr.collection('games').doc(gameId);
  await mr.set(first.match);await gr.set(first.game);
  process.env.AOF_NATIVE_PLAYER_UPLOAD_GAME_ALLOWLIST=matchId+'/'+gameId;
  return {db,bucket,matchId,gameId,actor:first.actor,bytes:first.original,fileName:'fixture.aoe2record',receivedAt:Date.now(),ordinary:true,
    worker:async()=>first.worker,resolveMapping:async()=>first.mapping,gr};
}
let fault=await faultInput('worker-failure');
await rejectFault('worker-failure',()=>validateNativeRecording({...fault,worker:async()=>{throw Error('injected worker failure');}}));
assert.equal((await fault.gr.collection('replaySources').get()).size,0);
assert.equal((await fault.gr.collection('nativeReplayValidationJobs').get()).docs[0].data().state,'FAILED');
const [retained]=await bucket.file(`native-replay-evidence/${fault.matchId}/g1/${first.sourceHash}/source.aoe2record`).download();
assert.equal(digest(retained),first.sourceHash);
const recovered=await validateNativeRecording(fault);assert.equal(recovered.state,'VALIDATED_NOT_READY');
await rejectFault('cross-game-guid-claim',()=>publishNativePlayerRecording({...fault,sourceHash:first.sourceHash,candidateId:recovered.candidateId,env:process.env}),/already claimed/);
assert.equal((await fault.gr.collection('replaySources').get()).size,0);
fault=await faultInput('stale-authority');
await rejectFault('stale-authority',()=>validateNativeRecording({...fault,worker:async()=>{await fault.gr.update({activeResultDisputeId:'opened-during-worker'});return first.worker;}}));
assert.equal((await fault.gr.collection('nativeReplayValidations').get()).size,0);
fault=await faultInput('corrupt-artifact');
await rejectFault('corrupt-artifact',()=>validateNativeRecording({...fault,worker:async()=>({...first.worker,statistics:{...first.worker.statistics,sha256:'0'.repeat(64)}})}));
assert.equal((await fault.gr.collection('nativeReplayValidations').get()).size,0);
await writeFile(resolve(out,'report.json'),JSON.stringify({environment:'local Firestore/Storage emulators; real uploadReplay.run and authenticated native worker; no external callable HTTP/browser',
  independentUserConcurrency:concurrency,
  workload:concurrency===2?'Two independent authenticated uploads; existing read-model/reward audits may overlap the other upload.':'Serial formats; separate duplicate-request race control on 1v1.',
  fixtures:reports,faultMeasurements,faults:{concurrentOrdinaryRequests:concurrency===1,workerFailureRetainsOriginal:true,failedJobRetries:true,crossGameGuidConflict:true,staleAuthority:true,corruptArtifact:true}},null,2)+'\n');
await db.terminate();
