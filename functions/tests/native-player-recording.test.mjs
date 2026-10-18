import test from 'node:test';
import assert from 'node:assert/strict';
import {gunzipSync,gzipSync} from 'node:zlib';
import {readFileSync} from 'node:fs';
import {correctionFixture,correctionEnv} from './support/native-correction-fixture.mjs';
import {digest} from '../lib/engines/nativeRecordingIntegration.js';
import {NATIVE_PLAYER_UPLOAD} from '../lib/engines/nativePlayerUpload.js';
import {readNativePlayerAuthority,publishNativePlayerRecording} from '../lib/services/nativePlayerRecording.js';
import {deriveRecordingOutcome} from '../lib/engines/recordingOutcome.js';
import {activeNativeStatisticsSource} from '../lib/engines/activeNativeStatisticsSource.js';
import {executeNativeReadyPublication} from '../lib/services/nativeReadyPublication.js';

const actor={role:'PLAYER',playerId:'p1',authUid:'player-uid'};
const env={...correctionEnv,AOF_NATIVE_PLAYER_UPLOAD:'recorded-events-v1',AOF_NATIVE_PLAYER_UPLOAD_GAME_ALLOWLIST:'m/g'};
async function fixture(){
  const t=correctionFixture(),c=t.candidate;
  for(const key of [...t.rows.keys()])if(/resultDisputes|processingJobs|recordingGameClaims|replaySources/.test(key))t.rows.delete(key);
  for(const key of ['canonicalResult','recordingResultBinding','activeResultDisputeId']){delete t.game[key];delete t.match[key];}
  Object.assign(t.game,{status:'READY',activeReplayStatisticsId:null,replayStatisticsRevision:0});
  Object.assign(t.match,{status:'ACTIVE'});
  t.rows.set('players/p1',{role:'PLAYER',membershipStatus:'ACTIVE'});
  t.rows.set('authLinks/player-uid',{playerId:'p1'});
  c.validatedBy='p1';c.ordinaryUploadVersion=NATIVE_PLAYER_UPLOAD;
  const events=gunzipSync(t.objects.get(c.recordedEvents.path)).toString().trim().split('\n').map(JSON.parse);
  events[0][1].extraction.parserVersion=t.raw.source.parserVersion;
  c.extraction=events[0][1].extraction;
  const plain=Buffer.from(events.map(e=>JSON.stringify(e)+'\n').join('')),bytes=gzipSync(plain);
  Object.assign(c.recordedEvents,{sha256:digest(bytes),bytes:bytes.length,uncompressedSha256:digest(plain),uncompressedBytes:plain.length});
  t.objects.set(c.recordedEvents.path,bytes);
  for(const p of [t.raw.source,t.raw.matchFacts.source,t.raw.pairSocialEvidence.gameScope])p.recordedEventsSha256=c.recordedEvents.sha256;
  Object.assign(t.raw.matchFacts,{map:{},coverage:{},policy:{automaticResultSubmissionEnabled:false,rewardsEnabled:false,
    relationshipScoringEnabled:false,reputationScoringEnabled:false,rawFactsVisibleByDefault:false}});
  t.raw.matchFacts.result.winnerPlayerIds=null;
  t.repack();
  t.input={db:t.db,bucket:t.storage,matchId:'m',gameId:'g',sourceHash:t.sourceHash,candidateId:t.candidateId,actor,env};
  t.bind=async()=>{c.bindingToken=(await readNativePlayerAuthority(t.input)).token;};
  await t.bind();t.run=()=>publishNativePlayerRecording(t.input);
  return t;
}

test('ordinary participant publishes retained native READY while outcome stays pending; duplicate retries do not publish or score',async()=>{
  const t=await fixture(),r=await t.run();
  assert.equal(r.state,'READY');assert.equal(r.outcomeResolution.state,'PENDING_ADMIN_REVIEW');
  const g=t.rows.get('matches/m/games/g'),s=t.rows.get(t.sourcePath);
  assert.equal(g.canonicalResult,undefined);assert.equal(s.originalRecording.permanent,true);
  assert.equal(s.originalRecording.sourceDeletionAuthorized,false);assert.equal(s.statistics.generation,'7');
  assert.equal(s.experience.eligible,false);assert.equal(s.resultQualification,'UNRESOLVED');
  assert.ok(activeNativeStatisticsSource('m','g',t.match,g,t.sourceHash,s,true,true));
  assert.equal(activeNativeStatisticsSource('m','g',t.match,g,t.sourceHash,s,true),null);
  const before=[...t.rows.keys()];assert.equal((await t.run()).alreadyProcessed,true);
  assert.equal(t.rows.get('matches/m/games/g').replayStatisticsRevision,1);
  assert.deepEqual([...t.rows.keys()],before);
  assert.equal([...t.rows.keys()].some(k=>k.startsWith('processingJobs/')),false);
});

test('optional performance spans preserve publication response and remain inert when disabled',async()=>{
  const plain=await fixture(),traced=await fixture();
  const disabled={},enabled={};
  plain.input.performanceTimings=disabled;
  traced.input.performanceTimings=enabled;
  traced.input.env={...env,AOF_REPLAY_UPLOAD_PERF_TRACE:'1'};
  const expected=await plain.run(),actual=await traced.run();
  assert.deepEqual(actual,expected);
  assert.deepEqual(disabled,{});
  for(const name of ['nativePublicationAuthorityAndSourceReadMs','nativeCandidateReadAndCheckMs',
    'nativeImmutableArtifactsReadMs','nativePublicationPackageVerificationMs','nativePublicationMappingAndReadModelMs',
    'nativeReadyPublicationTransactionMs','nativeResultResolutionMs','nativePostResolverFenceMs']){
    assert.ok(Number.isFinite(enabled[name])&&enabled[name]>=0,name);
  }
  assert.equal(Object.keys(actual).some(key=>/timing|performance/i.test(key)),false);
  assert.deepEqual([...plain.rows.keys()].sort(),[...traced.rows.keys()].sort());
  assert.deepEqual([...plain.objects.keys()].sort(),[...traced.objects.keys()].sort());
  await traced.run();
  assert.ok(Number.isFinite(enabled.nativeRetryAuthorityTransactionMs));
  assert.equal(traced.rows.get('matches/m/games/g').replayStatisticsRevision,1);
});

for(const [name,mutate] of Object.entries({
  'suspended membership':t=>t.rows.get('players/p1').membershipStatus='SUSPENDED',
  'changed auth link':t=>t.rows.get('authLinks/player-uid').playerId='p2',
  'lost participation':t=>t.game.players[0].playerId='p3',
  'accepted result':t=>t.game.canonicalResult={revision:1},
  'open dispute':t=>t.game.activeResultDisputeId='d',
  'same GUID elsewhere':t=>t.rows.set(t.newClaimPath,{matchId:'other',gameId:'g',sourceHash:t.sourceHash}),
  'corrupt original':t=>t.objects.set(t.candidate.originalRecording.path,Buffer.from('corrupt')),
  'corrupt events':t=>t.objects.set(t.candidate.recordedEvents.path,Buffer.from('corrupt')),
  'corrupt statistics':t=>t.objects.set(t.candidate.statistics.path,Buffer.from('corrupt')),
  'stale candidate binding':t=>t.candidate.bindingToken='0'.repeat(64),
}))test('ordinary publication rejects '+name,async()=>{
  const t=await fixture();mutate(t);await assert.rejects(t.run());
  assert.equal(t.rows.has(t.sourcePath),false);assert.equal(t.rows.has(t.publicationPath),false);
});

test('publication fences concurrent correction and source changes after Storage verification',async()=>{
  for(const mutate of [t=>t.game.activeResultDisputeId='new-dispute',t=>t.game.replayStatisticsRevision=7,
    t=>t.rows.get('players/p2').steamName='changed']){
    const t=await fixture();t.onTransaction(()=>mutate(t));await assert.rejects(t.run());assert.equal(t.rows.has(t.sourcePath),false);
  }
});
test('duplicate retries recheck GUID ownership and active source, not just an old successful job',async()=>{
  const t=await fixture();await t.run();t.rows.get(t.newClaimPath).gameId='different';await assert.rejects(t.run());
});
test('ordinary gate cannot be substituted for admin validation or production approval',async()=>{
  for(const change of [{AOF_NATIVE_PLAYER_UPLOAD:''},{AOF_NATIVE_PLAYER_UPLOAD_GAME_ALLOWLIST:''},
    {AOF_ACTIVE_NATIVE_PLAYER_READS:''},{GCLOUD_PROJECT:'league-of-friends-cc274'}]){
    const t=await fixture();t.input.env={...env,...change};await assert.rejects(t.run());
  }
});

test('separately approved admin rollback withdraws pending first upload without deleting evidence; retries are idempotent',async()=>{
  const t=await fixture();await t.run();
  const input={db:t.db,bucket:t.storage,actor:{playerId:'admin',authUid:'uid',role:'ADMIN'},
    env:{...env,AOF_NATIVE_PLAYER_UPLOAD:'',AOF_ACTIVE_NATIVE_PLAYER_READS:''},
    request:{...t.request,operation:'ROLLBACK',correction:undefined,expectedResultRevision:0,
      expectedActiveSourceHash:t.sourceHash,expectedStatisticsRevision:1}};
  assert.equal((await executeNativeReadyPublication(input)).state,'ROLLED_BACK');
  assert.equal(t.rows.get('matches/m/games/g').activeReplayStatisticsId,null);
  assert.equal(t.rows.get('matches/m/games/g').replayStatisticsRevision,2);
  assert.equal(t.rows.get(t.sourcePath).state,'READY');assert.ok(t.objects.size>=3);
  assert.equal(t.rows.has(t.newClaimPath),false);
  assert.equal((await executeNativeReadyPublication(input)).alreadyRolledBack,true);
  await assert.rejects(t.run());
});

test('native READY uses the existing resolver to accept a supported winner exactly once',async()=>{
  const t=await fixture(),f=JSON.parse(readFileSync(new URL('./fixtures/recording-outcomes.json',import.meta.url)))[0];
  const source=t.raw.matchFacts.source;
  Object.assign(t.raw.matchFacts,structuredClone(f.matchFacts),{source});
  t.raw.matchFacts.game.guid='ordinary-supported-guid';
  Object.assign(t.raw.matchFacts.result,{qualification:'UNRESOLVED',winnerPlayerIds:null,loserPlayerIds:null});
  t.match.gameConfigSnapshot={maps:{pool:['Arabia']},civilizations:{mode:'UNRESTRICTED'},
    victory:{conquest:true,wonder:false,relic:false},diplomacyEnabled:false,additionalSettings:{}};
  t.repack();await t.bind();
  const result=await t.run();assert.equal(result.outcomeResolution.state,'ACCEPTED');
  const g=t.rows.get('matches/m/games/g');
  assert.deepEqual(g.canonicalResult.winningPlayerIds,['p2']);
  assert.equal(g.canonicalResult.revision,1);assert.equal(g.recordingResultBinding.sourceHash,t.sourceHash);
  assert.equal([...t.rows.keys()].filter(k=>k.startsWith('processingJobs/')).length,1);
  await t.run();assert.equal([...t.rows.keys()].filter(k=>k.startsWith('processingJobs/')).length,1);
  assert.equal(t.rows.get('matches/m/games/g').canonicalResult.revision,1);
});

test('same outcome evaluator accepts genuine READY native facts with legacy-identical qualification; unsupported evidence stays pending',()=>{
  const corpus=JSON.parse(readFileSync(new URL('./fixtures/recording-outcomes.json',import.meta.url)));
  for(const item of corpus){
    const mapping=item.players.map((p,i)=>({replaySlot:p.replaySlot,playerId:'p'+i}));
    const teams=[...new Set(item.players.map(p=>p.teamId))];
    const game={players:item.players.map((p,i)=>({playerId:'p'+i,team:teams.indexOf(p.teamId)+1}))};
    const match={format:'ONE_V_ONE',gameConfigSnapshot:{victory:{conquest:true,wonder:false,relic:false},maps:{pool:['fixture'],recordingMapIds:{fixture:item.matchFacts.rules.mapId.value}},civilizations:{mode:'UNRESTRICTED'}}};
    const legacy={state:'READY',sourceHash:item.sourceHash,matchFacts:item.matchFacts,playerMapping:mapping};
    const native={...legacy,nativePublicationVersion:'AOF_ACTIVE_NATIVE_STATISTICS_V1',ordinaryUploadVersion:NATIVE_PLAYER_UPLOAD};
    assert.deepEqual(deriveRecordingOutcome(match,game,native),deriveRecordingOutcome(match,game,legacy));
    assert.equal(deriveRecordingOutcome(match,game,native).state,'VERIFIED');
    assert.equal(deriveRecordingOutcome({...match,format:'FFA'},game,native).state,'PENDING_ADMIN_REVIEW');
    assert.equal(deriveRecordingOutcome(match,game,{...native,state:'VALIDATED_NOT_READY'}).state,'PENDING_ADMIN_REVIEW');
    for(const change of [f=>f.result.postgameEvidence=[],f=>f.game.bodyParseComplete=false,
      f=>f.result.resignationEvidence[0].disconnected=true,f=>f.headerFieldCandidates['de.build']=0]){
      const changed=structuredClone(native);change(changed.matchFacts);
      assert.equal(deriveRecordingOutcome(match,game,changed).state,'PENDING_ADMIN_REVIEW');
    }
    assert.equal(deriveRecordingOutcome({...match,gameConfigSnapshot:{...match.gameConfigSnapshot,civilizations:{mode:'DRAFT'}}},game,native).state,'PENDING_ADMIN_REVIEW');
  }
});
