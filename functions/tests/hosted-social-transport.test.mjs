import test from 'node:test';
import assert from 'node:assert/strict';
import {callVerifiedWorker} from '../lib/services/nativeRecordingValidation.js';
const saved={...process.env};
async function configured(run){
 try{
  delete process.env.FUNCTIONS_EMULATOR;delete process.env.GOOGLE_CLOUD_PROJECT;
  Object.assign(process.env,{GCLOUD_PROJECT:'age-of-friends-staging',AOF_HOSTED_SOCIAL_PRIVATE:'v1a',REPLAY_WORKER_AUTH_TOKEN:'controlled-transport-token'});
  return await run();
 }finally{for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];Object.assign(process.env,saved);}
}
test('hosted derivation is a fixed POST with separate app bearer and exact workload audience; default-off/project failures precede tokens',async()=>{
 await configured(async()=>{
  const url='https://worker-fixture.example.run.app';let audience,seen,tokens=0;
  const transport={signal:new AbortController().signal,getIdToken:async x=>{tokens++;audience=x;return 'workload-test';},fetcher:async(target,options)=>{
   seen={target,options};return new Response('{}');}};
  assert.deepEqual(await callVerifiedWorker(url,'/social-hosted-grade-v1',{snapshot:'controlled'},transport),{});
  assert.equal(audience,url);assert.equal(seen.target,url+'/social-hosted-grade-v1');
  assert.equal(seen.options.method,'POST');assert.equal(seen.options.redirect,'error');
  assert.equal(seen.options.headers.authorization,'Bearer controlled-transport-token');
  assert.equal(seen.options.headers['X-Serverless-Authorization'],'Bearer workload-test');
  assert.equal(seen.options.body,JSON.stringify({snapshot:'controlled'}));
  await assert.rejects(callVerifiedWorker(url,'/social-hosted-grade-v1',{},
    {...transport,signal:undefined}),/budget is required/);
  for(const change of [{AOF_HOSTED_SOCIAL_PRIVATE:''},{GCLOUD_PROJECT:'production'},
   {GOOGLE_CLOUD_PROJECT:'other'},{REPLAY_WORKER_AUTH_TOKEN:''}]){
   const before={...process.env};Object.assign(process.env,change);const n=tokens;
   await assert.rejects(callVerifiedWorker(url,'/social-hosted-grade-v1',{},transport));assert.equal(tokens,n);
   for(const k of Object.keys(process.env))if(!(k in before))delete process.env[k];Object.assign(process.env,before);
  }
  await assert.rejects(callVerifiedWorker(url,'/social-hosted-grade-v1',{},
   {...transport,getIdToken:async()=>''}));
 });
});
test('remaining caller budget prevents a late token resolution from starting a POST',async()=>{
 await configured(async()=>{
  const controller=new AbortController();let posted=false;
  await assert.rejects(callVerifiedWorker('https://worker-fixture.example.run.app','/social-hosted-grade-v1',{},
   {signal:controller.signal,getIdToken:async()=>{controller.abort();return 'test';},fetcher:async()=>{posted=true;return new Response('{}');}}));
  assert.equal(posted,false);
 });
});
