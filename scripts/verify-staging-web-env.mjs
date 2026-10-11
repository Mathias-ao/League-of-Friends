#!/usr/bin/env node
/**
 * Offline staging Vite env audit; does not talk to Firebase or deploy.
 * Does not print Firebase API key, Auth config, tokens or file contents.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const staging='age-of-friends-staging';
export function parseViteConfig(contents){
  const values={};
  for(const [i,raw] of contents.split(/\r?\n/).entries()){
    const line=raw.trim();
    if(!line||line.startsWith('#'))continue;
    const match=/^(VITE_[A-Z0-9_]+)=(.*)$/.exec(line);
    if(!match)throw new Error('Invalid staging env syntax on line '+(i+1));
    if(Object.hasOwn(values,match[1]))throw new Error('Duplicate staging setting '+match[1]);
    let value=match[2].trim();
    if((value.startsWith('"')&&value.endsWith('"'))||
       (value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);
    values[match[1]]=value;
  }
  return values;
}
export function checkStagingWebConfig(env,{forManualE2e=false}={}){
  const errors=[];
  const requireExact=(key,value)=>{
    if(env[key]!==value)errors.push(key+' must be exactly '+value);
  };
  requireExact('VITE_FIREBASE_PROJECT_ID',staging);
  requireExact('VITE_FIREBASE_AUTH_DOMAIN',staging+'.firebaseapp.com');
  requireExact('VITE_FIREBASE_REGION','europe-west1');
  requireExact('VITE_USE_EMULATORS','false');
  if(!env.VITE_FIREBASE_API_KEY||/^(?:replace|todo|changeme|test|placeholder)/i.test(env.VITE_FIREBASE_API_KEY))
    errors.push('VITE_FIREBASE_API_KEY must be the approved staging web public API key');
  if(!env.VITE_FIREBASE_APP_ID||/^(?:replace|todo|changeme|test|placeholder)/i.test(env.VITE_FIREBASE_APP_ID))
    errors.push('VITE_FIREBASE_APP_ID must be the approved staging web app ID');
  if(!/^[a-f0-9]{40}$/.test(env.VITE_AOF_COMMIT_SHA??''))
    errors.push('VITE_AOF_COMMIT_SHA must pin the reviewed 40-hex Git commit');
  if(!['true','false'].includes(env.VITE_AOF_STAGING_E2E))
    errors.push('VITE_AOF_STAGING_E2E must be an explicitly selected boolean');
  if(forManualE2e&&env.VITE_AOF_STAGING_E2E!=='true')
    errors.push('Manual browser E2E UI is still disabled; separate activation approval is needed');
  if(!forManualE2e&&env.VITE_AOF_STAGING_E2E==='true')
    errors.push('Staging UI activation requires an explicit --for-manual-e2e release audit and separate user approval');
  if(Object.keys(env).some(k=>!/^VITE_[A-Z0-9_]+$/.test(k)))
    errors.push('Unexpected non-Vite configuration included');
  return {ok:errors.length===0,errors,projectId:staging,
    reviewedCommitValid:/^[a-f0-9]{40}$/.test(env.VITE_AOF_COMMIT_SHA??''),
    requestedUiActivation:env.VITE_AOF_STAGING_E2E==='true',manualE2eAudit:forManualE2e,
    evidence:'OFFLINE_WEB_CONFIG_ONLY',
    caveat:'Cannot certify deployment approval, backend commit, Auth, cloud worker or backups.'};
}
function selfTest(){
  const config={
    VITE_FIREBASE_API_KEY:'a-valid-staging-web-app-public-api-key',
    VITE_FIREBASE_AUTH_DOMAIN:staging+'.firebaseapp.com',
    VITE_FIREBASE_PROJECT_ID:staging,
    VITE_FIREBASE_APP_ID:'1:1234:web:5678',
    VITE_FIREBASE_REGION:'europe-west1',
    VITE_USE_EMULATORS:'false',VITE_AOF_STAGING_E2E:'false',
    VITE_AOF_COMMIT_SHA:'a'.repeat(40)
  };
  assert.equal(checkStagingWebConfig(config).ok,true);
  assert.equal(checkStagingWebConfig(config,{forManualE2e:true}).ok,false);
  assert.equal(checkStagingWebConfig({...config,VITE_AOF_STAGING_E2E:'true'},{forManualE2e:true}).ok,true);
  assert.equal(checkStagingWebConfig({...config,VITE_AOF_STAGING_E2E:'true'}).ok,false);
  for(const bad of [
    {VITE_FIREBASE_PROJECT_ID:'league-of-friends-cc274'},
    {VITE_FIREBASE_PROJECT_ID:'league-of-freinds'},
    {VITE_USE_EMULATORS:'true'}, {VITE_AOF_COMMIT_SHA:'bad'},
    {VITE_FIREBASE_AUTH_DOMAIN:'league-of-friends-cc274.firebaseapp.com'},
    {VITE_FIREBASE_REGION:'us-central1'}
  ])assert.equal(checkStagingWebConfig({...config,...bad}).ok,false);
  assert.deepEqual(parseViteConfig('VITE_AOF_STAGING_E2E=false\n# comment'),{VITE_AOF_STAGING_E2E:'false'});
  assert.throws(()=>parseViteConfig('VITE_AOF_STAGING_E2E=false\nVITE_AOF_STAGING_E2E=true'));
  console.log('PASS: offline staging Firebase web build audit refuses production and activation confusion');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv[2]==='--self-test')selfTest();
  else if(!process.argv[2]||process.argv.slice(3).some(arg=>arg!=='--for-manual-e2e')){
    console.error('Usage: node scripts/verify-staging-web-env.mjs /PRIVATE/web/.env.staging.local [--for-manual-e2e]');
    process.exitCode=2;
  }else{
    try {
      const config=parseViteConfig(readFileSync(resolve(process.argv[2]),'utf8'));
      const result=checkStagingWebConfig(config,{forManualE2e:process.argv.includes('--for-manual-e2e')});
      console.log(JSON.stringify(result,null,2));
      if(!result.ok)process.exitCode=1;
    }catch(e){console.error('NO-GO: staging web env is absent or invalid; contents are not printed.');process.exitCode=1;}
  }
}
