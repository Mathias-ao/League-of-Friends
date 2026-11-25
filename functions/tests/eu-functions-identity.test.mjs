import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {euFunctionsRuntimeIdentity,EU_FUNCTIONS_SERVICE_ACCOUNT} from '../lib/config/runtime.js';

// Inspect the actual Firebase v2 endpoint metadata in a fresh process. Merely
// checking the service-account constant would miss Steam, triggers and scheduler.
const manifestScript = `
import * as exported from './lib/index.js';
const endpoints = Object.entries(exported)
  .filter(([,fn])=>typeof fn==='function'&&fn.__endpoint)
  .map(([name,fn])=>({name,serviceAccountEmail:fn.__endpoint.serviceAccountEmail??null,
    region:fn.__endpoint.region??null,platform:fn.__endpoint.platform??null}));
console.log('AOF_FUNCTION_ENDPOINTS='+JSON.stringify(endpoints));
`;
function manifest(overrides={}){
  const env={...process.env,GCLOUD_PROJECT:'age-of-friends-staging-eu',
    GOOGLE_CLOUD_PROJECT:'age-of-friends-staging-eu',GCP_PROJECT:'age-of-friends-staging-eu',
    FUNCTION_REGION:'europe-west1',...overrides};
  for(const key of ['FUNCTIONS_EMULATOR','FIRESTORE_EMULATOR_HOST',
    'FIREBASE_AUTH_EMULATOR_HOST','FIREBASE_STORAGE_EMULATOR_HOST','STORAGE_EMULATOR_HOST']){
    if(!(key in overrides))delete env[key];
  }
  const output=execFileSync(process.execPath,['--input-type=module','-e',manifestScript],
    {cwd:new URL('..',import.meta.url),env,encoding:'utf8',timeout:30000});
  const line=output.split(String.fromCharCode(10)).find(s=>s.startsWith('AOF_FUNCTION_ENDPOINTS='));
  assert.ok(line,'Firebase SDK entry point must expose function endpoint metadata');
  return JSON.parse(line.slice('AOF_FUNCTION_ENDPOINTS='.length));
}

test('EU discovery binds every exported Firebase v2 endpoint, not only callables',()=>{
  const endpoints=manifest();
  const names=new Set(endpoints.map(e=>e.name));
  assert.ok(endpoints.length>=70,'an unexpectedly incomplete Functions entry point must fail preflight');
  for(const name of ['backendHealth','beginSteamSignIn','steamAuthCallback',
    'scheduleEventWarmups','resolveResultsOnRecordingSource','resolveResultsOnActiveRecording',
    'rebuildStatisticsOnGameChange','getMyHonoursPreview','getMyHostedSocialProgression']){
    assert.ok(names.has(name),name+' must be in the Functions entry point');
  }
  for(const endpoint of endpoints){
    assert.equal(endpoint.platform,'gcfv2',endpoint.name+' must be a v2 endpoint');
    assert.equal(endpoint.serviceAccountEmail,EU_FUNCTIONS_SERVICE_ACCOUNT,
      endpoint.name+' must not inherit the Editor-capable default identity');
  }
});

test('CLI discovery does not require a runtime FUNCTION_REGION environment variable',()=>{
  const endpoints=manifest({FUNCTION_REGION:undefined});
  assert.ok(endpoints.length>=70);
  assert.ok(endpoints.every(e=>e.serviceAccountEmail===EU_FUNCTIONS_SERVICE_ACCOUNT));
});

test('existing production, old staging and emulator endpoint identities are untouched',()=>{
  for(const project of ['age-of-friends-staging','league-of-friends-cc274','demo-league']){
    const endpoints=manifest({GCLOUD_PROJECT:project,GOOGLE_CLOUD_PROJECT:project,GCP_PROJECT:project,
      FUNCTION_REGION:'europe-west1'});
    assert.ok(endpoints.length>=70);
    assert.ok(endpoints.every(e=>e.serviceAccountEmail===null),
      project+' must not receive the EU runtime identity');
  }
  const emulated=manifest({FUNCTIONS_EMULATOR:'true'});
  assert.ok(emulated.every(e=>e.serviceAccountEmail===null));
});

test('mismatched EU project and region discovery fail closed',()=>{
  const env={GCLOUD_PROJECT:'age-of-friends-staging-eu',GOOGLE_CLOUD_PROJECT:'league-of-friends-cc274'};
  assert.throws(()=>euFunctionsRuntimeIdentity(env),/Conflicting Firebase project/);
  assert.throws(()=>euFunctionsRuntimeIdentity({GCLOUD_PROJECT:'age-of-friends-staging-eu',
    FUNCTION_REGION:'us-central1'}),/Unexpected region/);
  assert.throws(()=>euFunctionsRuntimeIdentity({GCLOUD_PROJECT:'age-of-friends-staging-eu',
    FUNCTIONS_EMULATOR:'unexpected'}),/Unrecognized emulator/);
  assert.equal(euFunctionsRuntimeIdentity({GCLOUD_PROJECT:'age-of-friends-staging-eu',
    FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080'}),null);
});
