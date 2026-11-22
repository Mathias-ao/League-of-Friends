import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase/app';
import {getFunctions,connectFunctionsEmulator} from 'firebase/functions';
import {FirebaseLeagueRepository} from '../src/data/FirebaseLeagueRepository';

test('actual hosted repository callable accepts a 75s SDK response and bounds exhaustion at 125s',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const app=initializeApp({projectId:'demo-private-callable',apiKey:'controlled-test-only'},'hosted-deadline-test');
 const functions=getFunctions(app,'europe-west1');connectFunctionsEmulator(functions,'127.0.0.1',5001);
 // Bypass construction only: exercise the actual repository method and SDK,
 // with no auth/persistence/browser bootstrap or real network access.
 const repository=Object.create(FirebaseLeagueRepository.prototype) as FirebaseLeagueRepository;
 (repository as any).functions=functions;
 const originalFetch=globalThis.fetch;let requests=0;
 globalThis.fetch=(async (url,options)=>{
  requests++;assert.match(String(url),/\/getMyHostedSocialProgression$/);
  assert.equal(options?.body,JSON.stringify({data:{}}));
  return new Promise<Response>(resolve=>setTimeout(()=>resolve(new Response(JSON.stringify({data:{ok:true}}))),75_000));
 }) as typeof fetch;
 const drain=()=>new Promise<void>(resolve=>setImmediate(resolve));
 try{
  const read=repository.myHostedSocialProgression();await drain();
  t.mock.timers.tick(70_000);await drain();t.mock.timers.tick(5_000);await drain();
  assert.deepEqual(await read,{ok:true});assert.equal(requests,1);
  globalThis.fetch=(async()=>new Promise<Response>(()=>{})) as typeof fetch;
  const hung=repository.myHostedSocialProgression();
  const rejected=assert.rejects(hung,(error:any)=>error.code==='functions/deadline-exceeded');
  await drain();t.mock.timers.tick(125_000);await rejected;
 }finally{globalThis.fetch=originalFetch;await deleteApp(app);t.mock.timers.reset();}
});
