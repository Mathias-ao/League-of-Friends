import test from 'node:test';
import assert from 'node:assert/strict';
import {stagedNativeEnvironmentStatus} from '../lib/queries/adminGetStagingE2eReadiness.js';

const staging='age-of-friends-staging',sha='a'.repeat(40);
const env={
  GCLOUD_PROJECT:staging,AOF_NATIVE_REPLAY_PROJECT:staging,
  AOF_DEPLOY_GIT_SHA:sha,
  AOF_NATIVE_REPLAY_INTEGRATION:'validate-v1',
  AOF_NATIVE_READY_PUBLICATION:'reviewed-v1',
  AOF_ACTIVE_NATIVE_PLAYER_READS:'1',
  AOF_ACTIVE_NATIVE_SOCIAL_READS:'1',
  AOF_NATIVE_READY_ROLLBACK:'reviewed-v1',
  AOF_NATIVE_REPLAY_GAME_ALLOWLIST:'m/g',
  AOF_NATIVE_READY_GAME_ALLOWLIST:'m/g',
  AOF_NATIVE_REPLAY_PROCESSOR_REVISION:'b'.repeat(64),
  REPLAY_WORKER_AUTH_TOKEN:'private-fake-unit-test-token',
  REPLAY_WORKER_URL:'https://worker.staging.example.invalid',
  REPLAY_BUCKET:staging+'.appspot.com'
};
test('staging read-only status ties every configured gate and deployed SHA to exactly one Game',()=>{
  const pass=stagedNativeEnvironmentStatus(env,'m','g',sha);
  assert.equal(pass.project,staging);
  assert.equal(pass.configReady,true);
  assert.equal(pass.validationReady,true);
  assert.deepEqual(pass.validationBlockers,[]);
  assert.equal(pass.rollbackReady,true);
  assert.deepEqual(pass.blockers,[]);
  assert.ok(!JSON.stringify(pass).includes('private-fake-unit-test-token'));
  assert.ok(!JSON.stringify(pass).includes('worker.staging.example.invalid'));
  const wrongSha=stagedNativeEnvironmentStatus(env,'m','g','c'.repeat(40));
  assert.equal(wrongSha.configReady,false);
  assert.ok(wrongSha.blockers.includes('deployedCommitMatches'));
  assert.equal(stagedNativeEnvironmentStatus(env,'other','g',sha).configReady,false);
  assert.equal(stagedNativeEnvironmentStatus({...env,REPLAY_WORKER_URL:'http://localhost:8090'},'m','g',sha).configReady,false);
  assert.equal(stagedNativeEnvironmentStatus({...env,GCLOUD_PROJECT:staging,
    REPLAY_BUCKET:'league-of-friends-cc274.appspot.com'},'m','g',sha).configReady,false);
});
test('read-only staging status does not misrepresent rollback availability',()=>{
  const emergency={...env,AOF_NATIVE_READY_PUBLICATION:'0',
    AOF_NATIVE_REPLAY_INTEGRATION:'0',AOF_ACTIVE_NATIVE_PLAYER_READS:'0',AOF_ACTIVE_NATIVE_SOCIAL_READS:'0'};
  const result=stagedNativeEnvironmentStatus(emergency,'m','g',sha);
  assert.equal(result.configReady,false);
  assert.equal(result.validationReady,false);
  assert.ok(result.validationBlockers.includes('nativeValidation'));
  assert.equal(result.rollbackReady,true);
  assert.ok(result.blockers.includes('nativePublish'));
  assert.equal(stagedNativeEnvironmentStatus({...emergency,
    AOF_NATIVE_READY_ROLLBACK:'0'},'m','g',sha).rollbackReady,false);
});
test('validation-only readiness does not require READY publication, readers or rollback',()=>{
  const validation={...env,
    AOF_NATIVE_READY_PUBLICATION:'0',
    AOF_ACTIVE_NATIVE_PLAYER_READS:'0',
    AOF_ACTIVE_NATIVE_SOCIAL_READS:'0',
    AOF_NATIVE_READY_ROLLBACK:'0',
    AOF_NATIVE_READY_GAME_ALLOWLIST:''};
  const status=stagedNativeEnvironmentStatus(validation,'m','g',sha);
  assert.equal(status.validationReady,true);
  assert.deepEqual(status.validationBlockers,[]);
  assert.equal(status.configReady,false);
  assert.equal(status.rollbackReady,false);
  for(const patch of [
    {AOF_NATIVE_REPLAY_INTEGRATION:'0'},
    {AOF_NATIVE_REPLAY_GAME_ALLOWLIST:'other/g'},
    {AOF_NATIVE_REPLAY_PROCESSOR_REVISION:'unversioned'},
    {REPLAY_WORKER_AUTH_TOKEN:''},
    {REPLAY_WORKER_URL:'http://127.0.0.1:8090'},
    {AOF_DEPLOY_GIT_SHA:'b'.repeat(40)},
  ]){
    const blocked=stagedNativeEnvironmentStatus({...validation,...patch},'m','g',sha);
    assert.equal(blocked.validationReady,false);
    assert.ok(blocked.validationBlockers.length>0);
  }
});
test('no production, wrong project, unpinned commit or unapproved demo project',()=>{
  for(const project of ['league-of-friends-cc274','league-of-freinds','unrelated-project']){
    assert.throws(()=>stagedNativeEnvironmentStatus({...env,GCLOUD_PROJECT:project},'m','g',sha));
  }
  assert.throws(()=>stagedNativeEnvironmentStatus(env,'../../','g',sha));
  assert.throws(()=>stagedNativeEnvironmentStatus(env,'m','g','bad'));
  const demo=stagedNativeEnvironmentStatus({
    ...env,GCLOUD_PROJECT:'demo-aof-e2e',AOF_NATIVE_REPLAY_PROJECT:'demo-aof-e2e',
    FUNCTIONS_EMULATOR:'true',REPLAY_BUCKET:'demo-aof-e2e.appspot.com',
    REPLAY_WORKER_URL:'http://127.0.0.1:18765'
  },'m','g',sha);
  assert.equal(demo.configReady,true);
});
