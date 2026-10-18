import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {validateObserverConfig,createUploadCapture,observerSnippet,installUploadObserver} from './upload-staging-observer.mjs';

const config={origin:'https://age-of-friends-staging.web.app',project:'age-of-friends-staging',mode:'compact',sourceSha256:'a'.repeat(64),revision:2,matchId:'private-match',gameId:'private-game'};
const upload=()=>({result:{state:'READY',sourceHash:config.sourceSha256,replayStatisticsRevision:2,matchId:config.matchId,gameId:config.gameId,playerMapping:[{sourceName:'PRIVATE NAME'}]}});
const statistics=()=>({result:{version:'AOF_STATISTICS_EXPERIENCE_V3',games:[{matchId:config.matchId,gameId:config.gameId,sourceHash:config.sourceSha256,revision:2,eligible:false,players:[{playerId:'private-one',name:'PRIVATE NAME',values:{apm:0}},{playerId:'private-two',values:{apm:10}}]}]}});
function fixture(){let clock=0;const capture=createUploadCapture(config,()=>clock);return{capture,tick:n=>clock=n};}
function qualify(f){f.capture.commit();f.tick(10);f.capture.uploadStarted({auto:true,auth:true});f.tick(100);f.capture.uploadReturned(upload());f.tick(120);f.capture.statisticsReturned(statistics());f.tick(150);f.capture.observeDom({table:true,docket:true});}

test('refuses production origins, mismatched projects and unpinned sources/revisions',()=>{
  assert.deepEqual(validateObserverConfig(config),config);
  for(const patch of [{origin:'https://age-of-friends.web.app'},{project:'production-project'},{sourceSha256:'bad'},{revision:0},
    {origin:'http://localhost:5173',project:'demo-aof-native-player'},
    {origin:'https://age-of-friends-staging.web.app',project:'demo-aof-native-player'},{mode:'drop'}])assert.throws(()=>validateObserverConfig({...config,...patch}));
  assert.doesNotThrow(()=>validateObserverConfig({...config,origin:'https://age-of-friends-staging.web.app',project:'age-of-friends-staging'}));
});
test('measures commit before transport and permits genuine pending-outcome statistics',()=>{
  const f=fixture();qualify(f);f.tick(200);const r=f.capture.confirmDisplayed();
  assert.equal(r.clientCommitToFetchMs,10);assert.equal(r.uploadResponseMs,100);assert.equal(r.sourceQualifiedQueryMs,120);
  assert.equal(r.manualDisplayUpperBoundMs,200);assert.equal(r.officialAggregateEligible,false);
  assert.equal(r.paintStatus,'NOT_AUTOMATICALLY_MEASURED');assert.equal(r.serverSpanCorrelation,'UNAVAILABLE_ANONYMOUS_SERVER_SPANS');
  assert.equal(r.p95Status,'NOT_ESTABLISHED');
});
test('preflight and progress cannot substitute for source-matched READY and usable statistics',()=>{
  const f=fixture();f.capture.commit();f.capture.uploadStarted({auto:true,auth:true});
  f.capture.uploadReturned({result:{...upload().result,state:'VALIDATED_NOT_READY'}});f.capture.statisticsReturned(statistics());f.capture.observeDom({table:true,docket:true});
  assert.throws(()=>f.capture.confirmDisplayed());
  const g=fixture();qualify(g);const wrong=statistics();wrong.result.games[0].sourceHash='b'.repeat(64);g.capture.statisticsReturned(wrong);
  assert.throws(()=>g.capture.confirmDisplayed());
});
test('newer sources invalidate the attempt even if a stale response arrives afterwards',()=>{
  const f=fixture();f.capture.commit();const newer=statistics();newer.result.games[0].revision=3;f.capture.statisticsReturned(newer);qualify(f);
  assert.equal(f.capture.report().superseded,true);assert.throws(()=>f.capture.confirmDisplayed());
});
test('missing AUTO or auth evidence refuses confirmation',()=>{
  for(const meta of [{auto:false,auth:true},{auto:true,auth:false},{auto:false,auth:false}]){
    const f=fixture();f.capture.commit();f.capture.uploadStarted(meta);f.capture.uploadReturned(upload());
    f.capture.statisticsReturned(statistics());f.capture.observeDom({table:true,docket:true});assert.throws(()=>f.capture.confirmDisplayed());
  }
});
test('stale, ambiguous, empty or wrong-version statistics never qualify',()=>{
  for(const mutate of [d=>d.result.games[0].revision=1,d=>d.result.games.push(d.result.games[0]),d=>d.result.games[0].players=[],
    d=>d.result.games[0].players[0].values={},d=>d.result.version='UNKNOWN',d=>d.result.games=[]]){
    const f=fixture();f.capture.commit();f.capture.uploadStarted({auto:true,auth:true});f.capture.uploadReturned(upload());
    const d=statistics();mutate(d);f.capture.statisticsReturned(d);f.capture.observeDom({table:true,docket:true});assert.throws(()=>f.capture.confirmDisplayed());
  }
});
test('multiple upload requests stay ambiguous instead of borrowing a later response',()=>{
  const f=fixture();qualify(f);assert.equal(f.capture.uploadStarted({auto:true,auth:true}),false);assert.throws(()=>f.capture.confirmDisplayed());
});
test('receipt alone and later docket inspection do not backdate the display boundary',()=>{
  const f=fixture();qualify(f);f.tick(1000);const result=f.capture.confirmDisplayed();assert.equal(result.manualDisplayUpperBoundMs,1000);
  const g=fixture();g.capture.commit();g.capture.uploadStarted({auto:true,auth:true});g.capture.uploadReturned(upload());g.capture.statisticsReturned(statistics());g.capture.observeDom({table:true,docket:false});assert.throws(()=>g.capture.confirmDisplayed());
});
test('exports no target identities, hashes, participant names, headers or raw payloads',()=>{
  const f=fixture();qualify(f);const exported=JSON.stringify(f.capture.report());
  for(const secret of [config.sourceSha256,config.matchId,config.gameId,'PRIVATE NAME','private-one','authorization','replayBase64'])assert.equal(exported.includes(secret),false,secret);
  const snippet=observerSnippet(config);new vm.Script(snippet);assert.equal(snippet.includes('fetch('),false,'Observer must not initiate its own fetch');
});
test('browser installation is origin-bound and restoring observation sends no requests',()=>{
  const listeners=new Map();let requests=0;const fetch=()=>{requests++;return Promise.resolve({ok:false});};
  class Observer{observe(){}disconnect(){}}
  const win={location:{origin:config.origin,href:config.origin+'/'},performance:{now:()=>0},fetch,MutationObserver:Observer,
    document:{documentElement:{},addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)},requestAnimationFrame:()=>{}};
  assert.throws(()=>installUploadObserver({...config,origin:'http://localhost:5173'},win));
  const observer=installUploadObserver(config,win);assert.equal(requests,0);assert.equal(listeners.size,2);observer.stop();
  assert.equal(win.fetch,fetch);assert.equal(listeners.size,0);assert.equal(requests,0);assert.equal(win.__aofUploadObserver,undefined);
});
