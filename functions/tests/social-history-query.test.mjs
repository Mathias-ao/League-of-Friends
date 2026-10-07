import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
process.env.GCLOUD_PROJECT='social-query-test';
const {db}=await import('../lib/config/firebase.js');
const {getStorage}=await import('firebase-admin/storage');
const {getSocialHistory}=await import('../lib/queries/getSocialHistory.js');
const {getPlayerChronicle}=await import('../lib/queries/getPlayerChronicle.js');
const records=new Map();let bytes,downloadHook;
const reference=(path,collection=false)=>({path,id:path.split('/').at(-1),doc:id=>reference(path+'/'+id),collection:id=>reference(path+'/'+id,true),
 where:()=>reference(path,true),limit:()=>reference(path,true),get:async()=>collection?query(path):snapshot(path)});
const snapshot=path=>{const value=records.get(path);const copy=value?{...value,canonicalResult:value.canonicalResult?{...value.canonicalResult}:undefined}:undefined;
 return {id:path.split('/').at(-1),exists:!!value,data:()=>copy,ref:reference(path)};};
const query=path=>{const docs=[...records.keys()].filter(k=>k.startsWith(path+'/')&&k.split('/').length===path.split('/').length+1)
 .filter(k=>path!=='matches'||records.get(k).status==='COMPLETED').map(snapshot);return {docs,size:docs.length};};
Object.defineProperty(db,'collection',{value:path=>reference(path,true)});
Object.defineProperty(db,'getAll',{value:async(...refs)=>refs.map(r=>snapshot(r.path))});
Object.defineProperty(getStorage(),'bucket',{value:()=>({file:()=>({download:async()=>{downloadHook?.();return [bytes];}})})});
const request={auth:{uid:'account',token:{}},data:{},rawRequest:{}};
function reset(){
 records.clear();downloadHook=null;
 records.set('authLinks/account',{playerId:'a'});records.set('players/a',{membershipStatus:'ACTIVE',role:'PLAYER'});
 records.set('matches/m',{status:'COMPLETED',completedAt:{toMillis:()=>1000}});
 records.set('matches/m/games/g',{gameNumber:1,status:'COMPLETED',players:[{playerId:'a'},{playerId:'b'}],activeReplayStatisticsId:'r1',
 canonicalResult:{revision:1,source:'PLAYER_CONFIRMED',type:'PLAYER_WIN',winningPlayerIds:['a'],losingPlayerIds:['b']}});
 const source={replaySha256:'replay',canonicalManifestSha256:'manifest'};
 const statistics={source,matchFacts:{modelVersion:'AOF_RECORDING_MATCH_FACTS_V1',identityNamespace:'CANONICAL_REPLAY_PLAYER_ID',source,
 players:[{playerId:1,replaySlot:1,lobbyTeamIdRaw:1},{playerId:2,replaySlot:2,lobbyTeamIdRaw:1}],game:{observedDurationMs:1000},rules:{lockTeams:{value:true}},diplomacy:{commandTimelines:{}}}};
 bytes=Buffer.from(JSON.stringify(statistics));records.set('matches/m/games/g/replaySources/r1',{state:'READY',
 playerMapping:[{replaySlot:1,playerId:'a'},{replaySlot:2,playerId:'b'}],statistics:{path:'stats.json',sha256:createHash('sha256').update(bytes).digest('hex')}});
}
test('history callable authenticates, verifies sources, and returns mapped bounded shadow stages without writes',async()=>{
 reset();await assert.rejects(getSocialHistory.run({data:{},rawRequest:{}}),e=>e.code==='unauthenticated');
 const before=[...records.entries()].map(([k,v])=>[k,JSON.stringify(v)]);
 const r=await getSocialHistory.run(request);assert.equal(r.status,'AVAILABLE');assert.equal(r.history.pairs[0].tracks.RIVALRY.currentStage,1);
 assert.equal(r.history.policy.productionScoringEnabled,false);assert.equal(r.coverage.readableAcceptedGames,1);
 assert.equal(r.chronicle.modelVersion,'AOF_PLAYER_CHRONICLE_V2');assert.equal(r.chronicle.ownerPlayerId,'a');
 assert.equal(r.chronicle.pages[0].counterpartPlayerId,'b');assert.equal(r.chronicle.pages[0].entries.length,1);
 assert.match(r.chronicle.pages[0].entries[0].paragraphs[0],/official duel/);assert.equal(r.chronicle.policy.relationshipAndReputationStagesAreShadow,true);
 assert.deepEqual([...records.entries()].map(([k,v])=>[k,JSON.stringify(v)]),before);
});
test('player Chronicle callable is viewer-owned and exposes prose plus neutral coverage, not shadow internals',async()=>{
 reset();
 const r=await getPlayerChronicle.run({...request,data:{playerId:'b'}});
 assert.equal(r.success,true);assert.equal(r.chronicle.ownerPlayerId,'a','client input cannot request another player book');
 assert.equal(r.chronicle.pages[0].counterpartPlayerId,'b');
 assert.equal(Object.prototype.hasOwnProperty.call(r,'history'),false);
 assert.equal(Object.prototype.hasOwnProperty.call(r,'excluded'),false);
 assert.equal(Object.prototype.hasOwnProperty.call(r.chronicle.pages[0],'relationship'),false);
 assert.equal(Object.prototype.hasOwnProperty.call(r.chronicle.pages[0],'exposure'),false);
 assert.equal(Object.prototype.hasOwnProperty.call(r.chronicle.pages[0].entries[0],'relationshipMarks'),false);
 assert.equal(Object.prototype.hasOwnProperty.call(r.chronicle.pages[0].entries[0],'sourceEventIds'),false);
 assert.equal(Object.prototype.hasOwnProperty.call(r.coverage,'stageMeaning'),false);
 assert.equal(r.coverage.readableAcceptedGames,1);
});
test('artifact mismatch fails closed; a correction during download aborts coherent read',async()=>{
 reset();bytes=Buffer.from('{}');await assert.rejects(getSocialHistory.run(request),e=>e.code==='data-loss');
 reset();downloadHook=()=>{records.get('matches/m/games/g').canonicalResult.revision=2;};
 await assert.rejects(getSocialHistory.run(request),e=>e.code==='aborted');
});
test('missing or disputed Game sources are disclosed rather than interpreted as peacefulness',async()=>{
 reset();delete records.get('matches/m/games/g').activeReplayStatisticsId;
 const r=await getSocialHistory.run(request);assert.equal(r.status,'PARTIAL');assert.equal(r.history.contributions.length,0);
 assert.equal(r.coverage.excludedGames,1);assert.equal(r.excluded[0].reason,'replay_statistics_missing');
 reset();records.get('matches/m/games/g').activeResultDisputeId='dispute';
 const d=await getSocialHistory.run(request);assert.equal(d.history.contributions.length,0);assert.equal(d.excluded[0].reason,'official_result_ineligible');
});
test('unknown chronology and duplicate Game sequence cannot invent historical ordering',async()=>{
 reset();delete records.get('matches/m').completedAt;await assert.rejects(getSocialHistory.run(request),e=>e.code==='failed-precondition');
 reset();records.set('matches/m/games/other',{...records.get('matches/m/games/g')});
 await assert.rejects(getSocialHistory.run(request),e=>e.code==='failed-precondition');
});
