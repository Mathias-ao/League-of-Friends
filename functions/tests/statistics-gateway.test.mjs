import test from 'node:test';
import assert from 'node:assert/strict';
import {memoryFirestore} from './support/memory-firestore.mjs';
import {readStatisticsGateway,STATISTICS_GATEWAY_MAX_BYTES} from '../lib/services/statisticsGateway.js';
import {EXPERIENCE_VERSION} from '../lib/engines/statisticsExperience.js';
import {getLeagueBootstrap} from '../lib/queries/getLeagueBootstrap.js';

// Public aliases and controlled fixtures only. No real endpoint/token/IAM probe.
const env={GCLOUD_PROJECT:'age-of-friends-staging-eu',AOF_STATISTICS_GATEWAY:'staging-v1',
  AOF_STATISTICS_GATEWAY_TARGET_URI:'https://statistics-fixture.example.run.app'};
const dataset=(extra={})=>({version:EXPERIENCE_VERSION,games:[],unavailableGames:0,...extra});
const data={operation:'STATISTICS_READ_V1',scope:{seasonId:'season-fixture'}};
const headers={Authorization:'Bearer firebase-fixture','X-Firebase-AppCheck':'appcheck-fixture'};
const request=(payload=data,uid='linked',extra={})=>({auth:uid?{uid}:undefined,data:payload,
  rawRequest:{get:name=>headers[name]},...extra});
function setup(){
  return memoryFirestore([
    ['authLinks/linked',{playerId:'viewer'}],
    ['players/viewer',{membershipStatus:'ACTIVE',role:'PLAYER'}],
    ['authLinks/inactive',{playerId:'inactive'}],
    ['players/inactive',{membershipStatus:'INACTIVE',role:'PLAYER'}],
    ['authLinks/suspended',{playerId:'suspended'}],
    ['players/suspended',{membershipStatus:'SUSPENDED',role:'PLAYER'}],
  ]);
}
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8'}});
function harness(overrides={}){
  let tokens=0,calls=0;
  const deps={env,getIdToken:async()=>{tokens++;return 'oidc-fixture';},
    fetcher:async()=>{calls++;return json({result:dataset()});},...overrides};
  return {deps,counts:()=>[tokens,calls],run:(req=request())=>readStatisticsGateway(req,performance.now(),deps)};
}
const code=expected=>error=>error.code===expected;

test('ACTIVE linked member forwards exact scope, original bearer and fixed OIDC audience once',async()=>{
  setup();let audience,transport;
  const result=dataset({games:[{matchId:'other-members-battle',sourceRevision:7}],unavailableGames:1});
  const h=harness({getIdToken:async value=>{audience=value;return 'oidc-fixture';},
    fetcher:async(url,options)=>{transport={url,...options};return json({result});}});
  assert.deepEqual(await h.run(),result,'league-wide data is not restricted to the caller’s own Battles');
  assert.equal(audience,env.AOF_STATISTICS_GATEWAY_TARGET_URI);
  assert.equal(transport.url,audience);assert.equal(transport.redirect,'error');assert.equal(transport.method,'POST');
  assert.equal(transport.body,JSON.stringify({data:{seasonId:'season-fixture'}}));
  assert.deepEqual(transport.headers,{'Content-Type':'application/json',Authorization:'Bearer firebase-fixture',
    'X-Serverless-Authorization':'Bearer oidc-fixture'});
  assert.equal(transport.signal.aborted,true,'controller is cleaned up after success');
});

test('all existing scope kinds retain the direct reader’s trimming and ID rules',async()=>{
  setup();
  for(const key of ['seasonId','eventId','matchId']){
    let body;
    await harness({fetcher:async(_,options)=>{body=JSON.parse(options.body);return json({result:dataset()});}})
      .run(request({operation:'STATISTICS_READ_V1',scope:{[key]:' fixture id '}}));
    assert.deepEqual(body,{data:{[key]:'fixture id'}});
  }
});

test('signed out, unlinked, inactive, suspended and outside accounts fail before workload/network',async()=>{
  setup();
  for(const [uid,expected] of [[null,'unauthenticated'],['unlinked','permission-denied'],
    ['inactive','failed-precondition'],['suspended','permission-denied'],['outsider','permission-denied']]){
    const h=harness();await assert.rejects(h.run(request(data,uid)),code(expected));assert.deepEqual(h.counts(),[0,0]);
  }
});

test('closed operation rejects malformed/multiple scope and every override before tokens',async()=>{
  setup();
  const malformed=[null,[],{},'STATISTICS_READ_V1',{operation:'unknown',scope:{seasonId:'s'}},
    {operation:'STATISTICS_READ_V1',scope:{}},{operation:'STATISTICS_READ_V1',scope:[]},
    ...[null,'','   ','bad/path','x'.repeat(201),1,{}].map(value=>({operation:'STATISTICS_READ_V1',scope:{seasonId:value}})),
    {operation:'STATISTICS_READ_V1',scope:{seasonId:'s',eventId:'e'}},
    {operation:'STATISTICS_READ_V1',scope:{playerId:'someone'}},
    ...['target','url','function','audience','principal','headers','owner','playerId','rawStorage'].map(key=>({...data,[key]:'override'})),
    ...['headers','owner','playerId','rawStorage'].map(key=>({operation:'STATISTICS_READ_V1',scope:{[key]:'override'}}))];
  for(const payload of malformed){const h=harness();await assert.rejects(h.run(request(payload)),code('invalid-argument'));assert.deepEqual(h.counts(),[0,0]);}
  for(const payload of [[],{operation:'unknown'},'bad'])
    await assert.rejects(getLeagueBootstrap.run(request(payload)),code('invalid-argument'));
});

test('default bootstrap stays on the original authenticated path without gateway config',async()=>{
  setup();
  const result=await getLeagueBootstrap.run(request({}));
  assert.equal(result.schemaVersion,'LEAGUE_BOOTSTRAP_V1');assert.equal(result.activeSeason,null);
});

test('server gate is default-off, staging-only and never enabled by cloud emulator flags',async()=>{
  setup();
  for(const changed of [
    {AOF_STATISTICS_GATEWAY:undefined},{AOF_STATISTICS_GATEWAY:'1'},
    {GCLOUD_PROJECT:'age-of-friends-staging'},
    {GCLOUD_PROJECT:'age-of-friends-staging-eu-extra'},
    {GOOGLE_CLOUD_PROJECT:'age-of-friends-staging'},
    {GCLOUD_PROJECT:'production-fixture'},{GCLOUD_PROJECT:'demo-fixture',FUNCTIONS_EMULATOR:'true'},
    {FUNCTIONS_EMULATOR:'true'},{GOOGLE_CLOUD_PROJECT:'production-fixture'},{GCLOUD_PROJECT:undefined},
  ]){const h=harness({env:{...env,...changed}});await assert.rejects(h.run(),code('failed-precondition'));assert.deepEqual(h.counts(),[0,0]);}
  for(const uri of [undefined,'http://fixture.run.app','https://fixture.run.app/',
    'https://fixture.run.app/path','https://fixture.run.app?x=1','https://fixture.run.app#fragment',
    'https://user:password@fixture.run.app','https://fixture.run.app:8443','https://example.org',
    'https://fixture.run.app.evil.example','https://FIXTURE.run.app']){
    const h=harness({env:{...env,AOF_STATISTICS_GATEWAY_TARGET_URI:uri}});
    await assert.rejects(h.run(),code('failed-precondition'));assert.deepEqual(h.counts(),[0,0]);
  }
});

test('missing original bearer fails before OIDC; App Check forwards only outer-verified token',async()=>{
  setup();const h=harness();
  await assert.rejects(h.run(request(data,'linked',{rawRequest:{get:()=>undefined}})),code('unauthenticated'));
  assert.deepEqual(h.counts(),[0,0]);
  let sent;
  await harness({fetcher:async(_,options)=>{sent=options.headers;return json({result:dataset()});}})
    .run(request(data,'linked',{app:{appId:'fixture'}}));
  assert.equal(sent['X-Firebase-AppCheck'],'appcheck-fixture');
  assert.equal(sent.Authorization,headers.Authorization);
});

test('callable source/auth error codes survive but private details/messages never escape',async()=>{
  setup();
  for(const [status,expected] of [['ABORTED','aborted'],['UNAUTHENTICATED','unauthenticated'],
    ['PERMISSION_DENIED','permission-denied'],['FAILED_PRECONDITION','failed-precondition'],['NOT_FOUND','not-found']]){
    let attempts=0;
    await assert.rejects(harness({fetcher:async()=>{attempts++;return json({error:{status,
      message:'PRIVATE upstream secret oidc-fixture',details:{token:'firebase-fixture'}}},401);}}).run(),
      error=>error.code===expected&&!/PRIVATE|fixture/.test(JSON.stringify(error)));
    assert.equal(attempts,1,'even 401 and ABORTED never retry the Statistics POST');
  }
});

test('IAM HTML, malformed JSON/protocol, redirect and transport/token failures sanitize errors',async()=>{
  setup();
  for(const response of [new Response('<html>PRIVATE oidc-fixture</html>',{status:403}),
    new Response('PRIVATE firebase-fixture',{headers:{'content-type':'application/json'}}),
    json({error:{status:'PRIVATE'}}),json({result:{},error:{status:'ABORTED'}}),json({data:{}}),json({result:{}},403)]){
    await assert.rejects(harness({fetcher:async()=>response}).run(),
      error=>error.code==='unavailable'&&!/PRIVATE|fixture/.test(JSON.stringify(error)));
  }
  for(const overrides of [{fetcher:async()=>{throw new Error('PRIVATE redirect oidc-fixture');}},
    {getIdToken:async()=>{throw new Error('PRIVATE firebase-fixture');}},
    {getIdToken:async()=>''}]){
    await assert.rejects(harness(overrides).run(),error=>error.code==='unavailable'&&!/PRIVATE|fixture/.test(JSON.stringify(error)));
  }
});

test('valid JSON outside the exact public Statistics DTO is rejected without forwarding private envelopes',async()=>{
  setup();
  for(const result of [null,[],{},dataset({version:'wrong-version'}),dataset({games:{}}),
    dataset({unavailableGames:-1}),dataset({unavailableGames:0.5}),
    dataset({privateStorage:'PRIVATE'}),{privateToken:'PRIVATE'}]){
    await assert.rejects(harness({fetcher:async()=>json({result})}).run(),
      error=>error.code==='unavailable'&&!/PRIVATE/.test(JSON.stringify(error)));
  }
});

test('response bound is non-streaming provider ceiling, counts bytes and never truncates',async()=>{
  setup();assert.equal(STATISTICS_GATEWAY_MAX_BYTES,32*1024*1024);
  let cancelled=false;
  const stream=new ReadableStream({start(controller){
    controller.enqueue(new Uint8Array(STATISTICS_GATEWAY_MAX_BYTES));controller.enqueue(new Uint8Array(1));
  },cancel(){cancelled=true;}});
  await assert.rejects(harness({fetcher:async()=>new Response(stream,{headers:{'content-type':'application/json'}})}).run(),code('resource-exhausted'));
  assert.equal(cancelled,true);
  // Valid season responses above the streaming limit remain intact.
  const result=dataset({games:[{padding:'x'.repeat(10*1024*1024+1)}]});
  assert.deepEqual(await harness({fetcher:async()=>json({result})}).run(),result);
});

const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
test('50s handler-entry deadline covers pending membership and prevents late OIDC/network',async t=>{
  setup();t.mock.timers.enable({apis:['setTimeout']});let release;
  const h=harness({authorize:()=>new Promise(resolve=>{release=resolve;})});
  const pending=h.run();const rejected=assert.rejects(pending,code('deadline-exceeded'));
  t.mock.timers.tick(50_000);await rejected;release({});await flush();assert.deepEqual(h.counts(),[0,0]);
});

test('pending OIDC uses remaining application budget and cannot start a late POST',async t=>{
  setup();t.mock.timers.enable({apis:['setTimeout']});let release,posts=0;
  const h=harness({getIdToken:()=>new Promise(resolve=>{release=resolve;}),fetcher:async()=>{posts++;return json({result:dataset()});}});
  const pending=h.run();const rejected=assert.rejects(pending,code('deadline-exceeded'));await flush();
  t.mock.timers.tick(50_000);await rejected;release('late-oidc');await flush();assert.equal(posts,0);
});

test('45s upstream cap includes stalled body and cancels without blocking cleanup',async t=>{
  setup();t.mock.timers.enable({apis:['setTimeout']});let cancelled=false,signal;
  const stream=new ReadableStream({pull(){return new Promise(()=>{});},cancel(){cancelled=true;return new Promise(()=>{});}});
  const pending=harness({fetcher:async(_,options)=>{signal=options.signal;return new Response(stream,{headers:{'content-type':'application/json'}});}}).run();
  const rejected=assert.rejects(pending,code('deadline-exceeded'));await flush();
  t.mock.timers.tick(44_999);await flush();assert.equal(signal.aborted,false);
  t.mock.timers.tick(1);await rejected;assert.equal(signal.aborted,true);assert.equal(cancelled,true);
});

test('elapsed auth/token time reduces body budget and an expired entry never starts work',async t=>{
  setup();t.mock.timers.enable({apis:['setTimeout']});let clock=0,signal;
  const deps={...harness().deps,now:()=>clock,getIdToken:async()=>{clock=49_000;return 'oidc-fixture';},
    fetcher:async(_,options)=>{signal=options.signal;return new Promise(()=>{});}};
  const pending=readStatisticsGateway(request(),0,deps);const rejected=assert.rejects(pending,code('deadline-exceeded'));await flush();
  t.mock.timers.tick(1_000);await rejected;assert.equal(signal.aborted,true);
  const h=harness({now:()=>50_000});await assert.rejects(readStatisticsGateway(request(),0,h.deps),code('deadline-exceeded'));
  assert.deepEqual(h.counts(),[0,0]);
});

test('success and failure clear both timers instead of later aborting another request',async t=>{
  setup();t.mock.timers.enable({apis:['setTimeout']});
  const scheduled=t.mock.method(globalThis,'setTimeout');
  const cleared=t.mock.method(globalThis,'clearTimeout');
  const results=await Promise.allSettled([harness().run(),harness({getIdToken:async()=>{throw new Error('fixture');}}).run()]);
  assert.deepEqual(results.map(x=>x.status),['fulfilled','rejected']);
  const clearedHandles=cleared.mock.calls.map(call=>call.arguments[0]);
  assert.equal(scheduled.mock.calls.length,3,'success schedules application+upstream; token failure only application');
  assert.ok(scheduled.mock.calls.every(call=>clearedHandles.includes(call.result)));
  t.mock.timers.tick(100_000);await flush();
  assert.deepEqual(await harness().run(),dataset());
});


test('EU staging exact project aliases agree; a single GOOGLE_CLOUD_PROJECT is also supported',async()=>{
 setup();
 for(const projectEnv of [
  {GCLOUD_PROJECT:'age-of-friends-staging-eu',GOOGLE_CLOUD_PROJECT:'age-of-friends-staging-eu'},
  {GCLOUD_PROJECT:undefined,GOOGLE_CLOUD_PROJECT:'age-of-friends-staging-eu'},
 ]){
  const h=harness({env:{...env,...projectEnv}});assert.deepEqual(await h.run(),dataset());assert.deepEqual(h.counts(),[1,1]);
 }
});
