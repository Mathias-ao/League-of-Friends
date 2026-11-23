import test from 'node:test';
import assert from 'node:assert/strict';
import {checkStagingWebConfig,parseViteConfig} from '../../scripts/verify-staging-web-env.mjs';

// Controlled public config stand-ins, not an actual registered app or key.
const appId='1:1234:web:5678';
const config={VITE_FIREBASE_PROJECT_ID:'age-of-friends-staging-eu',
  VITE_FIREBASE_AUTH_DOMAIN:'age-of-friends-staging-eu.firebaseapp.com',
  VITE_FIREBASE_APP_ID:appId,VITE_FIREBASE_API_KEY:'controlled-public-web-key',
  VITE_FIREBASE_REGION:'europe-west1',VITE_USE_EMULATORS:'false',
  VITE_AOF_STAGING_E2E:'false',VITE_AOF_COMMIT_SHA:'a'.repeat(40)};
const audit=(patch={},options={})=>checkStagingWebConfig({...config,...patch},{approvedAppId:appId,...options});

test('offline EU staging audit requires a separate approved app pin and exact project/domain/region',()=>{
  assert.equal(audit().ok,true);
  for(const patch of [
    {VITE_FIREBASE_PROJECT_ID:'age-of-friends-staging'},
    {VITE_FIREBASE_PROJECT_ID:'league-of-friends-cc274'},
    {VITE_FIREBASE_PROJECT_ID:'league-of-freinds'},
    {VITE_FIREBASE_PROJECT_ID:'age-of-friends-staging-eu-extra'},
    {VITE_FIREBASE_AUTH_DOMAIN:'age-of-friends-staging.firebaseapp.com'},
    {VITE_FIREBASE_AUTH_DOMAIN:'age-of-friends-staging-eu.firebaseapp.com.evil.example'},
    {VITE_FIREBASE_REGION:'us-central1'},
    {VITE_FIREBASE_APP_ID:'1:9999:web:deadbeef'},
    {VITE_FIREBASE_APP_ID:'placeholder'},
  ])assert.equal(audit(patch).ok,false);
  assert.equal(audit({},{approvedAppId:undefined}).ok,false);
  assert.equal(audit({},{approvedAppId:'1:9999:web:deadbeef'}).ok,false);
  assert.ok(!JSON.stringify(audit()).includes(appId),'audit output does not disclose config values');
});

test('existing emulator, exact SHA and separately authorized E2E activation fences remain strict',()=>{
  for(const patch of [{VITE_USE_EMULATORS:'true'},{VITE_AOF_COMMIT_SHA:'main'},
    {VITE_AOF_COMMIT_SHA:'a'.repeat(39)},{VITE_FIREBASE_API_KEY:'placeholder'},
    {VITE_AOF_STAGING_E2E:'1'},{VITE_AOF_STAGING_E2E:'true'}])assert.equal(audit(patch).ok,false);
  assert.equal(audit({},{forManualE2e:true}).ok,false);
  assert.equal(audit({VITE_AOF_STAGING_E2E:'true'},{forManualE2e:true}).ok,true);
  assert.equal(audit({NOT_A_VITE_SETTING:'unexpected'}).ok,false);
});

test('env parser rejects duplicate or injected non-Vite settings',()=>{
  assert.deepEqual(parseViteConfig('VITE_USE_EMULATORS=false\n# comment'),{VITE_USE_EMULATORS:'false'});
  assert.throws(()=>parseViteConfig('VITE_USE_EMULATORS=false\nVITE_USE_EMULATORS=true'));
  assert.throws(()=>parseViteConfig('AOF_STAGING_APPROVED_WEB_APP_ID=not-a-vite-setting'));
});
