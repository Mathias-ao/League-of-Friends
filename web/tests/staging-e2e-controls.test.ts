import test from 'node:test';
import assert from 'node:assert/strict';
import {stagingE2eUiEnabled} from '../src/ui/StagingE2eControls';

const enabled={VITE_AOF_STAGING_E2E:'true',VITE_FIREBASE_PROJECT_ID:'age-of-friends-staging',
  VITE_USE_EMULATORS:'false'};
test('staging E2E controls are never displayed for production or preview',()=>{
  assert.equal(stagingE2eUiEnabled(enabled),true);
  assert.equal(stagingE2eUiEnabled({...enabled,VITE_AOF_STAGING_E2E:'false'}),false);
  assert.equal(stagingE2eUiEnabled({...enabled,VITE_FIREBASE_PROJECT_ID:'league-of-friends-cc274'}),false);
  assert.equal(stagingE2eUiEnabled({...enabled,VITE_FIREBASE_PROJECT_ID:'league-of-freinds'}),false);
  assert.equal(stagingE2eUiEnabled({...enabled,VITE_FIREBASE_PROJECT_ID:''}),false);
  assert.equal(stagingE2eUiEnabled({...enabled,VITE_USE_EMULATORS:'true'}),false);
  assert.equal(stagingE2eUiEnabled({...enabled,VITE_FIREBASE_PROJECT_ID:'demo-aof-e2e',VITE_USE_EMULATORS:'true'}),true);
  assert.equal(stagingE2eUiEnabled({...enabled,VITE_FIREBASE_PROJECT_ID:'demo-aof-e2e',VITE_USE_EMULATORS:'false'}),false);
});
