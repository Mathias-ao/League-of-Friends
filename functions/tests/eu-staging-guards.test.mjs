import test from 'node:test';
import assert from 'node:assert/strict';
import {EU_STAGING_PROJECT,isolatedStagingProject} from '../lib/config/stagingProject.js';
import {assertNativeValidationAllowed} from '../lib/engines/nativeRecordingIntegration.js';
import {assertNativePlayerUploadAllowed} from '../lib/engines/nativePlayerUpload.js';
import {assertNativePublicationAllowed} from '../lib/services/nativeReadyPublication.js';
import {assertNativeE2eReviewAllowed} from '../lib/queries/adminGetNativeReadyReview.js';
import {stagedNativeEnvironmentStatus} from '../lib/queries/adminGetStagingE2eReadiness.js';
import {readMySocialExperience} from '../lib/queries/getMySocialExperience.js';
import {readMyPersonalityHistory,getMyPersonalityHistory} from '../lib/queries/getMyPersonalityHistory.js';
import {readMyHostedSocialProgression,getMyHostedSocialProgression} from '../lib/queries/getMyHostedSocialProgression.js';
import {uploadReplay} from '../lib/commands/statistics/uploadReplay.js';
import {loadPracticalPersonalityRuntime} from '../lib/engines/personalityV1/practicalPolicy.js';
import {PRACTICAL_POLICY_SHA256} from '../lib/engines/personalityV1/practicalPolicyResource.js';
import {HOSTED_POLICY_SHA256,HOSTED_POLICY_PATH} from '../lib/integration/hostedSocialPolicy.js';
import {fixture,env as nativeEnv,actor} from './support/native-ready-fixture.mjs';
import {ready} from './support/private-history-fixture.mjs';
import {controlledHostedApproval} from './support/hosted-social-approval-fixture.mjs';
import {projectControlledHostedHistory} from './support/hosted-social-projection-fixture.mjs';

const eu=extra=>({...nativeEnv,FUNCTIONS_EMULATOR:undefined,FUNCTION_REGION:'europe-west1',
  GCLOUD_PROJECT:EU_STAGING_PROJECT,GOOGLE_CLOUD_PROJECT:EU_STAGING_PROJECT,
  AOF_NATIVE_REPLAY_PROJECT:EU_STAGING_PROJECT,...extra});
const ordinary=eu({AOF_NATIVE_PLAYER_UPLOAD:'recorded-events-v1',AOF_NATIVE_PLAYER_UPLOAD_GAME_ALLOWLIST:'m/g'});

test('EU runtime requires exact coherent project, region and hosted isolation; local demos remain isolated',()=>{
  assert.equal(isolatedStagingProject(eu()),EU_STAGING_PROJECT);
  assert.equal(isolatedStagingProject({...eu(),GCLOUD_PROJECT:undefined}),EU_STAGING_PROJECT);
  for(const project of ['age-of-friends-staging','league-of-friends-cc274','age-of-friends-staging-eu-more','',undefined])
    assert.equal(isolatedStagingProject(eu({GCLOUD_PROJECT:project,GOOGLE_CLOUD_PROJECT:project})),null);
  for(const change of [{GOOGLE_CLOUD_PROJECT:'age-of-friends-staging'},{FUNCTION_REGION:'us-central1'},
    {FUNCTION_REGION:undefined},{FUNCTIONS_EMULATOR:'true'},{FUNCTIONS_EMULATOR:'yes'},
    {FIRESTORE_EMULATOR_HOST:'localhost:8080'},{FIREBASE_AUTH_EMULATOR_HOST:'localhost:9099'},
    {FIREBASE_STORAGE_EMULATOR_HOST:'localhost:9199'},{STORAGE_EMULATOR_HOST:'localhost:9199'}])
    assert.equal(isolatedStagingProject(eu(change)),null);
  assert.equal(isolatedStagingProject(nativeEnv),nativeEnv.GCLOUD_PROJECT);
  assert.equal(isolatedStagingProject(nativeEnv,false),null);
  assert.equal(isolatedStagingProject({...nativeEnv,FUNCTIONS_EMULATOR:'false'}),null);
});

test('actual native validation/upload/READY/review gates accept only explicitly scoped EU requests',async()=>{
  const f=fixture(),env=eu();
  assert.equal(assertNativeValidationAllowed(env,'ADMIN','m','g'),env.AOF_NATIVE_REPLAY_PROCESSOR_REVISION);
  assert.equal(assertNativePlayerUploadAllowed(ordinary,'m','g'),env.AOF_NATIVE_REPLAY_PROCESSOR_REVISION);
  assert.equal(assertNativePublicationAllowed(env,actor,f.request),env.AOF_NATIVE_REPLAY_PROCESSOR_REVISION);
  assert.equal(assertNativeE2eReviewAllowed(env,'ADMIN','m','g',f.request.candidateId),EU_STAGING_PROJECT);
  // In-memory Firebase/Storage boundaries only, not a cloud READY write.
  const result=await f.run({env});assert.equal(result.state,'READY');
  for(const patch of [{GOOGLE_CLOUD_PROJECT:'age-of-friends-staging'},
    {GCLOUD_PROJECT:'age-of-friends-staging',GOOGLE_CLOUD_PROJECT:'age-of-friends-staging',AOF_NATIVE_REPLAY_PROJECT:'age-of-friends-staging'},
    {GCLOUD_PROJECT:'league-of-friends-cc274'},{FUNCTIONS_EMULATOR:'true'},
    {FUNCTION_REGION:'us-central1'},{AOF_NATIVE_REPLAY_PROJECT:'age-of-friends-staging'},
    {AOF_NATIVE_REPLAY_PROCESSOR_REVISION:'unversioned'}]){
    assert.throws(()=>assertNativeValidationAllowed({...env,...patch},'ADMIN','m','g'));
    assert.throws(()=>assertNativePlayerUploadAllowed({...ordinary,...patch},'m','g'));
    assert.throws(()=>assertNativePublicationAllowed({...env,...patch},actor,f.request));
  }
  for(const patch of [{AOF_NATIVE_PLAYER_UPLOAD:undefined},{AOF_NATIVE_PLAYER_UPLOAD_GAME_ALLOWLIST:'*'},
    {AOF_ACTIVE_NATIVE_PLAYER_READS:'0'},{AOF_ACTIVE_NATIVE_SOCIAL_READS:'0'},{REPLAY_WORKER_AUTH_TOKEN:''}])
    assert.throws(()=>assertNativePlayerUploadAllowed({...ordinary,...patch},'m','g'));
  assert.throws(()=>assertNativeValidationAllowed(env,'PLAYER','m','g'));
  assert.throws(()=>assertNativeE2eReviewAllowed(env,'PLAYER','m','g',f.request.candidateId));
  const mismatch=fixture();mismatch.candidate.processorRevision='0'.repeat(64);
  await assert.rejects(mismatch.run({env}),'a current EU gate cannot accept a different producer fingerprint');
  const status=stagedNativeEnvironmentStatus(eu({AOF_DEPLOY_GIT_SHA:'a'.repeat(40),
    REPLAY_BUCKET:EU_STAGING_PROJECT+'.firebasestorage.app',REPLAY_WORKER_URL:'https://worker.example.run.app'}),'m','g','a'.repeat(40));
  assert.equal(status.validationReady,true);
});

test('actual EU owner reads stay Developing under absent or copied old D2/R numerical approvals',async()=>{
  const f=await ready(),input={...f.input,env:eu({...f.input.env,GCLOUD_PROJECT:EU_STAGING_PROJECT,
    GOOGLE_CLOUD_PROJECT:EU_STAGING_PROJECT,AOF_NATIVE_REPLAY_PROJECT:EU_STAGING_PROJECT,
    FUNCTIONS_EMULATOR:undefined,FUNCTION_REGION:'europe-west1'})};
  for(const flag of [undefined,'practical-v1']){
    input.env.AOF_PERSONALITY_PRIVATE_POLICY=flag;
    const history=await readMyPersonalityHistory(input);
    assert.equal(history.coverage.currentSources,1);
    assert.equal(history.numericalPolicy.runtime,'DISABLED');
    assert.ok(history.personality.personalityProfile.sliders.every(s=>s.value===null));
  }
  const noRead={doc:()=>assert.fail('EU cannot reuse an old project-bound approval record')};
  assert.equal(await loadPracticalPersonalityRuntime(noRead,{...input.env,AOF_PERSONALITY_PRIVATE_POLICY:'practical-v1'}),null);
  for(const project of ['age-of-friends-staging',EU_STAGING_PROJECT]){
    f.rows.set(HOSTED_POLICY_PATH,{...controlledHostedApproval(),project});
    await assert.rejects(readMyHostedSocialProgression({...input,env:{...input.env,AOF_HOSTED_SOCIAL_PRIVATE:'v1a'},
      derive:()=>assert.fail('No derivation before a separately approved EU policy')}),e=>e.code==='failed-precondition');
  }
  assert.equal(PRACTICAL_POLICY_SHA256,'7ec5d2dce94eb6e04e0a5f3a1130b54fc0b890489ffa7bb652996e136e32083c');
  assert.equal(HOSTED_POLICY_SHA256,'e96e6ed6ccb846ec41f895c0dab90795cbf919cea0d823eb02371d18a8267c88');
});

test('EU private source reads reject foreign Game/actor, revoked membership and correction races',async()=>{
  for(const change of [f=>f.rows.get('authLinks/owner').playerId='p2',
    f=>f.rows.get('players/p1').membershipStatus='SUSPENDED']){
    const f=await ready();change(f);
    await assert.rejects(readMyPersonalityHistory({...f.input,env:eu({
      AOF_INT_V1_PRIVATE_READS:'source-v1',AOF_INT_V1_PRIVATE_HISTORY:'battle-v1'})}),e=>e.code==='permission-denied');
  }
  const f=await ready(),input={...f.input,env:eu({AOF_INT_V1_PRIVATE_READS:'source-v1',AOF_INT_V1_PRIVATE_HISTORY:'battle-v1'})};
  await assert.rejects(readMySocialExperience({...input,request:{matchId:'foreign',gameId:'g'}}));
  f.onFinal(()=>f.rows.get(f.sourcePath).state='WITHDRAWN');
  await assert.rejects(readMyPersonalityHistory(input),e=>e.code==='aborted');
  assert.equal((await readMyPersonalityHistory(input)).coverage.currentSources,0);
  for(const callable of [getMyPersonalityHistory,getMyHostedSocialProgression,uploadReplay])
    await assert.rejects(callable.run({data:{}}),e=>e.code==='unauthenticated');
});

test('demo-only proposed projection preserves unmeasured factual pairs and withdraws them without hosted approval',async()=>{
  const f=await ready();
  const projected=await projectControlledHostedHistory(f.input,new Map());
  assert.equal(projected.coverage.complete,false);
  assert.equal(projected.relationships[0].factualCurrentSourceGames,1);
  assert.ok(Object.values(projected.relationships[0].tracks).every(t=>t.outgoing.stage===null&&t.incoming.stage===null));
  f.rows.get(f.sourcePath).state='WITHDRAWN';
  const withdrawn=await projectControlledHostedHistory(f.input,new Map());
  assert.equal(withdrawn.coverage.currentSources,0);assert.deepEqual(withdrawn.relationships,[]);
  await assert.rejects(projectControlledHostedHistory({...f.input,env:eu()},new Map()));
});
