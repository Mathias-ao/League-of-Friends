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
let first;
const cases=[['1v1_t90-deak','ONE_V_ONE','ACCEPTED'],['2v2_arabia','TWO_V_TWO','PENDING_ADMIN_REVIEW'],
  ['4v4_arabia','FOUR_V_FOUR','ACCEPTED'],['FFA_7','FFA','PENDING_ADMIN_REVIEW']];
await db.doc('players/operator').set({role:'ADMIN',membershipStatus:'ACTIVE'});
await db.doc('authLinks/operator').set({playerId:'operator'});
for(const [name,format,expected] of cases){
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
  await db.doc('events/'+eventId).set({status:'ACTIVE',seasonId});
  for(const p of roster)await db.doc('events/'+eventId+'/scoringSlots/MAIN_'+p.playerId).set({matchId,playerId:p.playerId,seasonId,act:'MAIN'});
  await gr.create({status:'READY',gameNumber:1,players:roster,replayStatisticsRevision:0,activeReplayStatisticsId:null,
    replayParticipantBindings:players.map((p,i)=>({sourceNameNormalized:p.name.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US'),playerId:roster[i].playerId}))});
  process.env.AOF_NATIVE_PLAYER_UPLOAD_GAME_ALLOWLIST=matchId+'/'+gameId;
  const seededMatch=(await mr.get()).data(),seededGame=(await gr.get()).data();
  const request={auth:{uid:actor.authUid},data:{matchId,gameId,fileName:name+'.aoe2record',replayBase64:original.toString('base64'),processingMode:'AUTO'}};
  await assert.rejects(uploadReplay.run({...request,auth:{uid:'operator-unknown'}}));
  const began=Date.now();
  const attempts=await Promise.allSettled(name==='1v1_t90-deak'?[uploadReplay.run(request),uploadReplay.run(request)]:[uploadReplay.run(request)]);
  const successes=attempts.filter(r=>r.status==='fulfilled');
  assert.ok(successes.length>0,attempts.map(r=>r.reason?.message).join('; '));
  const response=successes[0].value;
  const uploadMs=Date.now()-began;
  assert.equal(response.state,'READY');assert.equal(response.outcomeResolution.state,expected,name+': '+JSON.stringify(response.outcomeResolution));
  const sr=gr.collection('replaySources').doc(sourceHash),source=(await sr.get()).data();
  let game=(await gr.get()).data(),match=(await mr.get()).data();
  assert.equal(source.originalRecording.permanent,true);assert.equal(source.originalRecording.sourceDeletionAuthorized,false);
  for(const a of [source.originalRecording,source.recordedEvents,source.statistics]){
    const [bytes]=await bucket.file(a.path,{generation:a.generation}).download();assert.equal(digest(bytes),a.sha256);
  }
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
  const detail=await readActiveNativeBattleDetail({db,bucket,actor,env:process.env,request:{matchId,gameId,mode:'list',replaySlot:players[0].number,group:'battles',pageSize:20}});
  assert.equal(detail.state,'READY');
  let dataset=await collectStatistics({matchId});assert.equal(dataset.games.length,1);assert.equal(dataset.games[0].eligible,expected==='ACCEPTED');
  await rebuildStatisticsReadModels();
  assert.equal((await db.doc('players/'+actor.playerId+'/statistics/experienceLifetime').get()).data().games,expected==='ACCEPTED'?1:0);
  const retry=await uploadReplay.run(request);assert.equal(retry.alreadyProcessed,true);assert.equal(retry.replayStatisticsRevision,1);
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
  reports.push({fixture:name,expectedOutcome:expected,ready:true,retentionVerified:true,independentOutcomeVerified:true,boundedReader:true,
    pendingExclusion:true,retryIdempotent:true,serverReceivedToReadyAndResolutionMs:uploadMs});
  console.log(JSON.stringify(reports.at(-1)));
}
// Fault injection reuses the verified real package; it never changes source facts.
async function faultInput(name){
  const matchId='fault-'+name,gameId='g1',mr=db.doc('matches/'+matchId),gr=mr.collection('games').doc(gameId);
  await mr.set(first.match);await gr.set(first.game);
  process.env.AOF_NATIVE_PLAYER_UPLOAD_GAME_ALLOWLIST=matchId+'/'+gameId;
  return {db,bucket,matchId,gameId,actor:first.actor,bytes:first.original,fileName:'fixture.aoe2record',receivedAt:Date.now(),ordinary:true,
    worker:async()=>first.worker,resolveMapping:async()=>first.mapping,gr};
}
let fault=await faultInput('worker-failure');
await assert.rejects(validateNativeRecording({...fault,worker:async()=>{throw Error('injected worker failure');}}));
assert.equal((await fault.gr.collection('replaySources').get()).size,0);
assert.equal((await fault.gr.collection('nativeReplayValidationJobs').get()).docs[0].data().state,'FAILED');
const [retained]=await bucket.file(`native-replay-evidence/${fault.matchId}/g1/${first.sourceHash}/source.aoe2record`).download();
assert.equal(digest(retained),first.sourceHash);
const recovered=await validateNativeRecording(fault);assert.equal(recovered.state,'VALIDATED_NOT_READY');
await assert.rejects(publishNativePlayerRecording({...fault,sourceHash:first.sourceHash,candidateId:recovered.candidateId,env:process.env}),/already claimed/);
assert.equal((await fault.gr.collection('replaySources').get()).size,0);
fault=await faultInput('stale-authority');
await assert.rejects(validateNativeRecording({...fault,worker:async()=>{await fault.gr.update({activeResultDisputeId:'opened-during-worker'});return first.worker;}}));
assert.equal((await fault.gr.collection('nativeReplayValidations').get()).size,0);
fault=await faultInput('corrupt-artifact');
await assert.rejects(validateNativeRecording({...fault,worker:async()=>({...first.worker,statistics:{...first.worker.statistics,sha256:'0'.repeat(64)}})}));
assert.equal((await fault.gr.collection('nativeReplayValidations').get()).size,0);
await writeFile(resolve(out,'report.json'),JSON.stringify({environment:'local Firestore/Storage emulators; real uploadReplay.run and authenticated native worker; no external callable HTTP/browser',
  fixtures:reports,faults:{concurrentOrdinaryRequests:true,workerFailureRetainsOriginal:true,failedJobRetries:true,crossGameGuidConflict:true,staleAuthority:true,corruptArtifact:true}},null,2)+'\n');
await db.terminate();
