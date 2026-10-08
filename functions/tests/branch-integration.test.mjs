import test from 'node:test';
import assert from 'node:assert/strict';
import {getAuth} from 'firebase-admin/auth';
import {Timestamp} from 'firebase-admin/firestore';
import {memoryFirestore} from './support/memory-firestore.mjs';
import {beginSteamSignIn,steamAuthCallback} from '../lib/auth/steamOpenId.js';
const origin='https://league-of-friends-cc274.web.app';
const startRequest={rawRequest:{get:name=>name==='origin'?origin:undefined},data:{}};
const response=()=>({code:200,body:'',headers:{},set(key,value){this.headers[key]=value;return this;},status(value){this.code=value;return this;},send(value){this.body=value;return this;}});
function callbackRequest(url){return {query:Object.fromEntries(new URL(url).searchParams),originalUrl:url,headers:{}};}
function assertion(start){const authUrl=new URL(start.authUrl),returnTo=authUrl.searchParams.get('openid.return_to'),url=new URL(returnTo);
  for(const [key,value] of Object.entries({'openid.mode':'id_res','openid.return_to':returnTo,'openid.op_endpoint':'https://steamcommunity.com/openid/login','openid.claimed_id':'https://steamcommunity.com/openid/id/76561198000000000','openid.identity':'https://steamcommunity.com/openid/id/76561198000000000'}))url.searchParams.set(key,value);
  return url.toString();
}
test('Steam OpenID realm covers its callback and initiation rejects unknown origins',async()=>{
  memoryFirestore();const start=await beginSteamSignIn.run(startRequest),url=new URL(start.authUrl);
  assert.equal(new URL(url.searchParams.get('openid.return_to')).origin,url.searchParams.get('openid.realm'));
  await assert.rejects(beginSteamSignIn.run({rawRequest:{get:()=> 'https://untrusted.example'},data:{}}),e=>e.code==='permission-denied');
});
test('Steam callbacks verify assertions, consume state once, and deliver tokens only to the initiating origin',async t=>{
  const records=memoryFirestore();const start=await beginSteamSignIn.run(startRequest);
  let requests=0;
  t.mock.method(globalThis,'fetch',async(url,options)=>{if(String(url).includes('/profiles/'))return {ok:true,text:async()=>'<profile><steamID64>76561198000000000</steamID64><steamID>Verified Steam name</steamID></profile>'};requests++;assert.equal(url,'https://steamcommunity.com/openid/login');assert.equal(new URLSearchParams(options.body).get('openid.mode'),'check_authentication');return {ok:true,text:async()=> 'ns:http://specs.openid.net/auth/2.0\nis_valid:true\n'};});
  t.mock.method(getAuth(),'getUser',async uid=>({uid}));
  t.mock.method(getAuth(),'createCustomToken',async(uid,claims)=>{assert.equal(uid,'steam:76561198000000000');assert.equal(claims.provider,'steam');return 'synthetic-test-token';});
  const req=callbackRequest(assertion(start)),res=response();await steamAuthCallback(req,res);
  assert.equal(res.code,200);assert.ok(res.body.includes('synthetic-test-token'));assert.ok(res.body.includes(origin));assert.equal(res.headers['Cache-Control'],'no-store');
  assert.equal([...records.keys()].some(key=>key.startsWith('steamAuthStates/')),false);
  const repeated=response();await steamAuthCallback(req,repeated);assert.equal(repeated.code,400);assert.equal(requests,1);assert.ok(!repeated.body.includes('synthetic-test-token'));
});
test('Steam rejects failed verification and expired states without issuing Firebase tokens',async t=>{
  const records=memoryFirestore();const start=await beginSteamSignIn.run(startRequest);
  let tokens=0;t.mock.method(getAuth(),'createCustomToken',async()=>{tokens++;return 'unexpected';});
  t.mock.method(globalThis,'fetch',async()=>({ok:true,text:async()=> 'is_valid:false\n'}));
  const res=response();await steamAuthCallback(callbackRequest(assertion(start)),res);assert.equal(res.code,401);assert.equal(tokens,0);
  const expired=await beginSteamSignIn.run(startRequest),state=new URL(new URL(expired.authUrl).searchParams.get('openid.return_to')).searchParams.get('state');
  records.get('steamAuthStates/'+state).expiresAt=Timestamp.fromMillis(0);
  const expiredRes=response();await steamAuthCallback(callbackRequest(assertion(expired)),expiredRes);assert.equal(expiredRes.code,400);assert.equal(tokens,0);
});
