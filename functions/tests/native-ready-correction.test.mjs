import {statisticsBindingKey} from '../lib/engines/statisticsExperience.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync,gunzipSync} from 'node:zlib';
import {digest} from '../lib/engines/nativeRecordingIntegration.js';
import {correctionFixture,correctionEnv} from './support/native-correction-fixture.mjs';
import {currentOfficialGameOutcome} from '../lib/engines/recordingMatchFacts.js';
import {activeNativeStatisticsSource} from '../lib/engines/activeNativeStatisticsSource.js';
import {nativeSocialInput} from '../lib/engines/nativeSocialInput.js';
import {memoryFirestore} from './support/memory-firestore.mjs';
import {db} from '../lib/config/firebase.js';
import {processMatchRewards} from '../lib/commands/processing/processMatchRewards.js';
import {SYSTEM_RESULT_PROCESSING_ACTOR as system} from '../lib/services/resultProcessingActor.js';
import {seasonScoringSnapshot} from '../lib/engines/seasonPoints.js';
import {runResultProcessingJob} from '../lib/triggers/processResultJob.js';
import {resolveRecordingResult} from '../lib/services/recordingResult.js';

const state=t=>JSON.stringify([...t.rows]);
test('legacy human default and WRONG_RESULT dispute use the same reviewed correction path',async()=>{
 const t=correctionFixture();delete t.match.opponentKind;
 t.rows.get(t.disputePath).category='WRONG_RESULT';t.bind();
 assert.equal((await t.run()).resultRevision,2);
});
test('native correction atomically binds official result, native readers, histories, GUID and exactly one job; retry does not score',async()=>{
 const t=correctionFixture(),prior=structuredClone(t.rows.get(t.oldSourcePath)),oldResult=structuredClone(t.game.canonicalResult);
 const r=await t.run();assert.equal(r.resultRevision,2);assert.equal(r.replayStatisticsRevision,8);
 const game=t.rows.get('matches/m/games/g'),match=t.rows.get('matches/m'),source=t.rows.get(t.sourcePath);
 assert.equal(game.recordingResultBinding.sourceHash,t.sourceHash);assert.equal(game.activeReplayStatisticsId,t.sourceHash);
 assert.equal(currentOfficialGameOutcome(game,match).qualification,'OFFICIAL');
 assert.deepEqual(game.canonicalResult.winningPlayerIds,['p2']);assert.equal(match.canonicalResult.sourceGameId,'g');
 assert.ok(activeNativeStatisticsSource('m','g',match,game,t.sourceHash,source,true));
 assert.ok(nativeSocialInput(t.raw,source.playerMapping));
 assert.equal(source.publication.officialResultRevision,2);assert.equal(source.experience.revision,8);
 assert.deepEqual(t.rows.get(t.oldSourcePath),prior);
 assert.deepEqual(t.rows.get('matches/m/games/g/resultHistory/R1').canonicalResult,oldResult);
 assert.equal(t.rows.get(t.disputePath).status,'RESOLVED_CORRECTED');
 assert.equal(t.rows.get('processingJobs/MATCH_RESULT_m_R1').status,'SUPERSEDED');
 assert.equal(t.rows.get('processingJobs/MATCH_RESULT_m_R2').previousRevision,1);
 assert.equal(t.rows.get('processingJobs/MATCH_RESULT_m_R2').correctionCaseId,'dispute');
 assert.equal(t.rows.has(t.oldClaimPath),false);assert.equal(t.rows.get(t.newClaimPath).sourceHash,t.sourceHash);
 assert.equal(t.rows.get(t.publicationPath).correction.previousOldClaim.sourceHash,t.oldHash);
 assert.equal([...t.rows.keys()].some(k=>/Ledger|standings/.test(k)),false);
 const before=state(t);assert.equal((await t.run()).alreadyPublished,true);assert.equal(state(t),before);
});

test('same GUID alternate recording keeps ownership and updates the bound source; normal publish/rollback still refuse corrections',async()=>{
 const t=correctionFixture({sameGuid:true});
 await assert.rejects(t.run({request:{...t.request,operation:'PUBLISH',correction:undefined}}));
 await t.run();assert.equal(t.oldClaimPath,t.newClaimPath);assert.equal(t.rows.get(t.oldClaimPath).sourceHash,t.sourceHash);
 assert.equal(t.rows.get(t.publicationPath).claimCreated,false);assert.equal(t.rows.get(t.publicationPath).claimRebound,true);
 assert.equal((await t.run()).alreadyPublished,true);
 const before=state(t);
 await assert.rejects(t.run({request:{...t.request,operation:'ROLLBACK',correction:undefined,
   expectedActiveSourceHash:t.sourceHash,expectedResultRevision:2,expectedStatisticsRevision:8}}),/never emergency/);
 assert.equal(state(t),before);
});

test('reviewed correction preserves and fences a previously native source, not only a legacy predecessor',async()=>{
 const makeNative=t=>{
   const old=t.rows.get(t.oldSourcePath),c=t.candidate;
   Object.assign(old,{nativePublicationVersion:'AOF_ACTIVE_NATIVE_STATISTICS_V1',ordinaryUploadVersion:'AOF_NATIVE_PLAYER_UPLOAD_V1',
     replayStatisticsRevision:t.game.replayStatisticsRevision,nativeValidationCandidateId:'1'.repeat(64),artifactRevision:c.artifactRevision,
     processorRevision:c.processorRevision,extraction:c.extraction,
     experience:{version:'AOF_STATISTICS_EXPERIENCE_V3',bindingKey:statisticsBindingKey({sourceHash:t.oldHash,roster:t.game.players,mapping:c.playerMapping,opponents:[]})}});
   for(const field of ['originalRecording','recordedEvents','statistics'])old[field]={...c[field],path:c[field].path.replace(t.sourceHash,t.oldHash)};
   old.originalRecording.sha256=t.oldHash;
   return old;
 };
 const t=correctionFixture(),before=structuredClone(makeNative(t));
 const result=await t.run();
 assert.equal(result.state,'READY');assert.equal(result.resultRevision,2);
 assert.deepEqual(t.rows.get(t.oldSourcePath),before,'previous source remains retained');
 const race=correctionFixture();makeNative(race);
 race.onTransaction(()=>{race.rows.get(race.oldSourcePath).statistics.sha256='8'.repeat(64);});
 await assert.rejects(race.run());
});

const negatives={
 'no open dispute':t=>t.rows.delete(t.disputePath),
 'stale dispute ID':t=>t.request.correction.disputeId='other',
 'UPHOLD is not correction':t=>t.request.correction.resolution='UPHOLD',
 'stale result':t=>t.request.expectedResultRevision=2,
 'stale statistics':t=>t.request.expectedStatisticsRevision=6,
 'unaccepted source binding':t=>t.game.recordingResultBinding.sourceHash='0'.repeat(64),
 'result from other Game':t=>t.match.canonicalResult.sourceGameId='other',
 'series':t=>t.match.seriesRule.maxGames=3,
 'extra Game':t=>t.rows.set('matches/m/games/extra',{status:'READY'}),
 'AI':t=>t.match.opponentKind='AI',
 'candidate state':t=>t.candidate.state='ROLLED_BACK',
 'native predecessor':t=>t.rows.get(t.oldSourcePath).nativePublicationVersion='AOF_ACTIVE_NATIVE_STATISTICS_V1',
 'source collision':t=>t.rows.set(t.sourcePath,{state:'READY'}),
 'history collision':t=>t.rows.set('matches/m/resultHistory/R1',{revision:1}),
 'job collision':t=>t.rows.set('processingJobs/MATCH_RESULT_m_R2',{resultRevision:2}),
 'missing accepted job':t=>t.rows.delete('processingJobs/MATCH_RESULT_m_R1'),
 'wrong old GUID owner':t=>t.rows.get(t.oldClaimPath).matchId='other',
 'claimed new GUID':t=>t.rows.set(t.newClaimPath,{matchId:'other',gameId:'g',sourceHash:t.sourceHash}),
 'new GUID claimed by same Battle with unexpected source':t=>t.rows.set(t.newClaimPath,{matchId:'m',gameId:'g',sourceHash:t.oldHash}),
 'invalid reviewed winner':t=>t.request.correction.outcome.winnerTeam=9,
 'mapping swapped since validation':t=>[t.candidate.playerMapping[0].playerId,t.candidate.playerMapping[1].playerId]=['p2','p1'],
 'validation binding stale':t=>t.candidate.bindingToken='0'.repeat(64),
 'revoked admin':t=>t.rows.get('players/admin').membershipStatus='SUSPENDED',
 'wrong processor':t=>t.candidate.processorRevision='0'.repeat(64),
 'wrong artifact revision':t=>t.candidate.artifactRevision='0'.repeat(64),
 'extraction provenance':t=>t.candidate.extraction.decoderCodeSha256='0'.repeat(64),
 'completeness metadata':t=>t.candidate.completeness.operationCount=2,
 'corrupt original':t=>t.objects.set(t.candidate.originalRecording.path,Buffer.from('corrupt')),
 'corrupt events':t=>t.objects.set(t.candidate.recordedEvents.path,Buffer.from('corrupt')),
 'decoded event hash':t=>t.candidate.recordedEvents.uncompressedSha256='0'.repeat(64),
 'rehashed out-of-order chronology':t=>{
   const artifact=t.candidate.recordedEvents,lines=gunzipSync(t.objects.get(artifact.path)).toString().trimEnd().split('\n').map(JSON.parse);
   lines[1][1]=8;const plain=Buffer.from(lines.map(x=>JSON.stringify(x)+'\n').join('')),bytes=gzipSync(plain);
   Object.assign(artifact,{sha256:digest(bytes),bytes:bytes.length,uncompressedSha256:digest(plain),uncompressedBytes:plain.length});
   t.objects.set(artifact.path,bytes);
   for(const scope of [t.raw.source,t.raw.matchFacts.source,t.raw.pairSocialEvidence.gameScope])scope.recordedEventsSha256=artifact.sha256;
   t.repack();
 },
 'wrong pinned generation':t=>t.candidate.statistics.generation='8',
 'corrupt statistics':t=>t.objects.set(t.candidate.statistics.path,Buffer.from('corrupt')),
 'incomplete social evidence':t=>{delete t.raw.pairSocialEvidence;t.repack();},
};
for(const [name,mutate] of Object.entries(negatives))test('correction fails closed: '+name,async()=>{
 const t=correctionFixture();mutate(t);const before=state(t);
 await assert.rejects(t.run());assert.equal(state(t),before,'failed attempt writes nothing');
});

test('correction requires its separate disabled-by-default gate and retains all existing gates',async()=>{
 for(const patch of [{AOF_NATIVE_READY_CORRECTION:''},{AOF_NATIVE_READY_PUBLICATION:''},
   {AOF_ACTIVE_NATIVE_PLAYER_READS:''},{AOF_ACTIVE_NATIVE_SOCIAL_READS:''},{GCLOUD_PROJECT:'league-of-friends-cc274'},
   {AOF_NATIVE_READY_GAME_ALLOWLIST:''}]){
   const t=correctionFixture(),before=state(t);await assert.rejects(t.run({env:{...correctionEnv,...patch}}));assert.equal(state(t),before);
 }
});

const races={
 'official revision':t=>t.game.canonicalResult.revision++,
 'source pointer':t=>t.game.activeReplayStatisticsId='0'.repeat(64),
 'roster':t=>t.game.players[0].team=2,
 'match rules':t=>t.match.gameConfigSnapshot={diplomacyEnabled:true},
 'resolved dispute':t=>t.rows.get(t.disputePath).status='RESOLVED_UPHELD',
 'admin revoked':t=>t.rows.get('players/admin').role='PLAYER',
 'auth link changed':t=>t.rows.get('authLinks/uid').playerId='p1',
 'player removed':t=>t.rows.delete('players/p1'),
 'old claim stolen':t=>t.rows.get(t.oldClaimPath).gameId='other',
 'new claim won elsewhere':t=>t.rows.set(t.newClaimPath,{matchId:'other',gameId:'g'}),
 'old job changed':t=>t.rows.get('processingJobs/MATCH_RESULT_m_R1').status='PENDING',
 'future job appeared':t=>t.rows.set('processingJobs/MATCH_RESULT_m_R2',{status:'PENDING'}),
 'prior source altered':t=>t.rows.get(t.oldSourcePath).statistics.sha256='0'.repeat(64),
 'candidate mapping changed':t=>t.candidate.playerMapping[0].sourceName='other',
 'another Game appeared':t=>t.rows.set('matches/m/games/new',{status:'READY'}),
};
for(const [name,mutate] of Object.entries(races))test('correction transaction fences '+name,async()=>{
 const t=correctionFixture();let afterRace;
 t.onTransaction(()=>{mutate(t);afterRace=state(t);});
 await assert.rejects(t.run());assert.equal(state(t),afterRace);
});

test('late competing correction aborts; its exact retry observes one coherent commit',async()=>{
 const t=correctionFixture();let reached,release;
 const ready=new Promise(r=>reached=r),wait=new Promise(r=>release=r);
 let once=true;
 const paused={file:(...args)=>({download:async()=>{const out=await t.storage.file(...args).download();
   if(once){once=false;reached();await wait;}return out;}})};
 const late=t.run({bucket:paused});await ready;await t.run();release();await assert.rejects(late);
 assert.equal((await t.run()).alreadyPublished,true);
 assert.equal([...t.rows.keys()].filter(k=>k.includes('nativeReplayPublications/')).length,1);
 assert.equal(t.rows.get('matches/m/games/g').canonicalResult.revision,2);
});

test('correction retries reject changed review, dispute, history, claim or active authority',async()=>{
 for(const mutate of [t=>t.request.correction.outcome.winnerTeam=1,
   t=>t.rows.get(t.disputePath).correctedToRevision=3,
   t=>t.rows.get('matches/m/resultHistory/R1').canonicalResult.revision=9,
   t=>t.rows.get(t.newClaimPath).matchId='other',
   t=>t.rows.get('matches/m/games/g').activeResultDisputeId='new-dispute']){
   const t=correctionFixture();await t.run();mutate(t);const before=state(t);
   await assert.rejects(t.run());assert.equal(state(t),before);
 }
});

test('existing rewards processor reconciles corrected native source once; stale jobs and native resolver do not duplicate ledgers',async()=>{
 const t=correctionFixture();
 Object.assign(t.match,{seasonId:'s',eventId:'e',scoringSnapshot:seasonScoringSnapshot({act:'MAIN',diplomacyEnabled:false,placementPolicy:'NONE',emperorPlayerId:null}),
   goldRewardSnapshot:{matchCompletion:1,matchWin:2},context:{affectsLeaguePoints:true,affectsGold:true,affectsPowerRating:false}});
 for(const id of ['p1','p2']){
   t.rows.get('players/'+id).goldBalance=0;
   t.rows.set('events/e/scoringSlots/MAIN_'+id,{matchId:'m',playerId:id,seasonId:'s',act:'MAIN'});
 }
 const records=memoryFirestore([...t.rows]);
 records.set('matches/m',{...t.match,status:'COMPLETED',activeResultDisputeId:null});
 records.set('matches/m/games/g',{...t.game,status:'COMPLETED',activeResultDisputeId:null});
 records.set('processingJobs/MATCH_RESULT_m_R1',{matchId:'m',gameId:'g',resultRevision:1,status:'PENDING',pendingSteps:['SCORING','GOLD']});
 await processMatchRewards({matchId:'m',requestId:'initial'},system);
 assert.equal(records.get('players/p1').goldBalance,3);assert.equal(records.get('players/p2').goldBalance,1);
 const job=records.get('processingJobs/MATCH_RESULT_m_R1');
 Object.assign(records.get('matches/m'),{status:'DISPUTED',activeResultDisputeId:'dispute'});
 Object.assign(records.get('matches/m/games/g'),{status:'DISPUTED',activeResultDisputeId:'dispute'});
 // Completed ledger jobs remain completed, matching the canonical dispute workflow.
 for(const [k,v] of records)t.rows.set(k,v);
 Object.assign(t.game,records.get('matches/m/games/g'));Object.assign(t.match,records.get('matches/m'));t.bind();
 records.get(t.candidatePath).bindingToken=t.candidate.bindingToken;
 const ledgerBefore=[...records].filter(([k])=>/Ledger\//.test(k));
 await t.run({db});
 assert.deepEqual([...records].filter(([k])=>/Ledger\//.test(k)),ledgerBefore,'publisher never scores');
 assert.equal(records.get('processingJobs/MATCH_RESULT_m_R1').status,job.status);
 await processMatchRewards({matchId:'m',requestId:'corrected'},system);
 assert.equal(records.get('players/p1').goldBalance,1);assert.equal(records.get('players/p2').goldBalance,3);
 assert.equal(records.get('seasons/s/standings/p1').leaguePoints,4);assert.equal(records.get('seasons/s/standings/p2').leaguePoints,10);
 const after=[...records].filter(([k])=>/Ledger\//.test(k));
 assert.equal((await processMatchRewards({matchId:'m',requestId:'duplicate'},system)).alreadyProcessed,true);
 await runResultProcessingJob(db.collection('processingJobs').doc('MATCH_RESULT_m_R1'),'late-old-job');
 assert.equal((await resolveRecordingResult('m','g',undefined,db)).state,'RESULT_ALREADY_RESOLVED');
 assert.deepEqual([...records].filter(([k])=>/Ledger\//.test(k)),after);
});
