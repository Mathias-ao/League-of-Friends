import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Timestamp} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';

// Actual compiled handlers, with ONLY SDK/storage/transport boundaries replaced.
// No Firebase initialization, real Steam request, token or cloud resource.
const source=readFileSync(new URL('../lib/auth/steamOpenId.js',import.meta.url),'utf8')
  .replace(/^import .*;\r?\n/gm,'').replaceAll('export const ','const ');
const project='age-of-friends-staging-eu',hosting='https://'+project+'.web.app';
const callbackOrigin='https://europe-west1-'+project+'.cloudfunctions.net';
function fixture({extraOrigins='',verified=true,tokenError=false,userError=false}={}){
  const rows=new Map();let seq=0,verifiedCalls=0,mints=0;
  const ref=key=>({key,create:async value=>{rows.set(key,value);}});
  const db={collection:collection=>({doc:id=>ref(collection+'/'+id)}),runTransaction:async work=>work({
    get:async r=>{const value=rows.get(r.key);return {exists:rows.has(r.key),data:()=>value};},delete:r=>rows.delete(r.key)})};
  const wrap=(options,run)=>({options,run});
  const auth={getUser:async()=>{if(userError)throw Error('Controlled Auth session failure');},
    createCustomToken:async()=>{mints++;if(tokenError)throw Error('Controlled custom-token mint failure');return 'controlled-token';}};
  const handlers=new Function('process','onCall','onRequest','db','Timestamp','HttpsError','randomUUID','callableOptions','collections','getAuth','refreshSteamProfile','fetch',
    source+'\n;return {beginSteamSignIn,steamAuthCallback};')(
      {env:{GCLOUD_PROJECT:project,STEAM_AUTH_ALLOWED_ORIGINS:extraOrigins}},wrap,wrap,db,Timestamp,HttpsError,
      ()=> 'controlled-state-'+(++seq),{region:'europe-west1'},{steamAuthStates:'states'},()=>auth,async()=>{},
      async(url,options)=>{verifiedCalls++;assert.equal(url,'https://steamcommunity.com/openid/login');
        assert.match(options.body,/openid.mode=check_authentication/);return {ok:true,text:async()=>`is_valid:${verified}\n`};});
  const begin=async(origin=hosting)=>handlers.beginSteamSignIn.run({rawRequest:{get:()=>origin}});
  const finish=async(start,patch={})=>{
    const returnTo=new URL(start.authUrl).searchParams.get('openid.return_to');
    const target=new URL(returnTo);const state=target.searchParams.get('state');
    target.searchParams.set('openid.mode','id_res');target.searchParams.set('openid.return_to',returnTo);
    target.searchParams.set('openid.op_endpoint','https://steamcommunity.com/openid/login');
    // Synthetic test identity generated locally, never an actual full SteamID.
    target.searchParams.set('openid.claimed_id','https://steamcommunity.com/openid/id/'+'7'.repeat(17));
    for(const [key,value] of Object.entries(patch))target.searchParams.set(key,value);
    let status=200,html='',headers={};
    const response={set:(key,value)=>{headers[key]=value;},status:code=>{status=code;return response;},send:value=>{html=value;}};
    await handlers.steamAuthCallback.run({query:{state},originalUrl:target.toString()},response);
    return {status,html,headers};
  };
  return {begin,finish,handlers,rows,counts:()=>({verifiedCalls,mints})};
}

test('unchanged Steam OpenID uses EU callback/default origins and Firebase custom token without a Steam API key',async()=>{
  const f=fixture();
  for(const origin of [hosting,'https://'+project+'.firebaseapp.com']){
    const start=await f.begin(origin),url=new URL(start.authUrl);
    assert.equal(start.callbackOrigin,callbackOrigin);assert.equal(url.searchParams.get('openid.realm'),callbackOrigin);
    assert.match(url.searchParams.get('openid.return_to'),new RegExp('^'+callbackOrigin+'/steamAuthCallback\\?state='));
    const result=await f.finish(start);assert.equal(result.status,200);
    assert.match(result.html,/aof-steam-auth/);assert.ok(result.html.includes(JSON.stringify(origin)));
    assert.equal(result.headers['Cache-Control'],'no-store');
    assert.equal((await f.finish(start)).status,400,'callback state is consumed once');
  }
  assert.deepEqual(f.counts(),{verifiedCalls:2,mints:2});
});

test('old/production/lookalike origins are denied; additional origins require explicit exact configuration',async()=>{
  const f=fixture();
  for(const origin of ['https://age-of-friends-staging.web.app','https://league-of-friends-cc274.web.app',
    hosting+'.evil.example','http://'+project+'.web.app','https://unapproved.example'])
    await assert.rejects(f.begin(origin),e=>e.code==='permission-denied');
  assert.equal(f.rows.size,0);
  assert.ok(await fixture({extraOrigins:'https://approved.example'}).begin('https://approved.example'));
});

test('expired state, invalid assertion, wrong-project return and Auth/token failures never return a successful token',async()=>{
  const expired=fixture(),start=await expired.begin();
  for(const row of expired.rows.values())row.expiresAt=Timestamp.fromMillis(0);
  assert.equal((await expired.finish(start)).status,400);assert.equal(expired.counts().mints,0);
  for(const options of [{verified:false},{tokenError:true},{userError:true}]){
    const f=fixture(options),result=await f.finish(await f.begin());
    assert.equal(result.status,401);assert.match(result.html,/aof-steam-auth-error/);assert.doesNotMatch(result.html,/"token":/);
  }
  const f=fixture(),wrong=await f.finish(await f.begin(),{'openid.return_to':'https://europe-west1-age-of-friends-staging.cloudfunctions.net/steamAuthCallback'});
  assert.equal(wrong.status,401);assert.equal(f.counts().verifiedCalls,0);assert.equal(f.counts().mints,0);
});
