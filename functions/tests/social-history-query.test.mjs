import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {encodeReplayStatistics} from '../lib/services/replayStatisticsStorage.js';
import {gzipSync} from 'node:zlib';
import {statisticsBindingKey} from '../lib/engines/statisticsExperience.js';
import {ACTIVE_NATIVE_SOURCE_VERSION} from '../lib/engines/activeNativeStatisticsSource.js';
process.env.GCLOUD_PROJECT='social-query-test';
const {db}=await import('../lib/config/firebase.js');
const {getStorage}=await import('firebase-admin/storage');
const {getSocialHistory}=await import('../lib/queries/getSocialHistory.js');
const {getPlayerChronicle}=await import('../lib/queries/getPlayerChronicle.js');
const records=new Map();let bytes,downloadHook;
const reference=(path,collection=false,queryOptions={})=>({
 path,id:path.split('/').at(-1),doc:id=>reference(path+'/'+id),
 collection:id=>reference(path+'/'+id,true),
 where:()=>reference(path,true,queryOptions),
 orderBy:()=>reference(path,true,queryOptions),
 limit:limit=>reference(path,true,{...queryOptions,limit}),
 startAfter:doc=>reference(path,true,{...queryOptions,after:doc.id}),
 get:async()=>collection?query(path,queryOptions):snapshot(path)});
const snapshot=path=>{const value=records.get(path);const copy=value?{...value,canonicalResult:value.canonicalResult?{...value.canonicalResult}:undefined}:undefined;
 return {id:path.split('/').at(-1),exists:!!value,data:()=>copy,ref:reference(path)};};
const query=(path,{after,limit}={})=>{
 const docs=[...records.keys()].filter(k=>k.startsWith(path+'/')&&k.split('/').length===path.split('/').length+1)
  .sort().filter(k=>!after||k.split('/').at(-1)>after).slice(0,limit??Infinity).map(snapshot);
 return {docs,size:docs.length};};
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
 assert.equal(Object.prototype.hasOwnProperty.call(r.chronicle.pages[0].entries[0],'narrativeContext'),false);
 assert.equal(Object.prototype.hasOwnProperty.call(r.coverage,'stageMeaning'),false);
 assert.equal(r.coverage.readableAcceptedGames,1);
});
test('artifact mismatch fails closed; a correction during download aborts coherent read',async()=>{
 reset();bytes=Buffer.from('{}');await assert.rejects(getSocialHistory.run(request),e=>e.code==='data-loss');
 reset();downloadHook=()=>{records.get('matches/m/games/g').canonicalResult.revision=2;};
 await assert.rejects(getSocialHistory.run(request),e=>e.code==='aborted');
});

test('gzip statistics produce the same social history and Chronicle as legacy JSON',async()=>{
 reset();const legacy=await getSocialHistory.run(request);
 const legacyChronicle=await getPlayerChronicle.run(request);
 const artifact=encodeReplayStatistics(JSON.parse(bytes.toString('utf8')));
 bytes=artifact.bytes;
 records.get('matches/m/games/g/replaySources/r1').statistics={...artifact.metadata,path:'stats.json.gz'};
 assert.deepEqual(await getSocialHistory.run(request),legacy);
 assert.deepEqual(await getPlayerChronicle.run(request),legacyChronicle);
});

test('social history fails closed on compressed bytes, original digest, size and codec corruption',async()=>{
 for(const corruption of ['stored','original','length','codec','gzip']){
  reset();const artifact=encodeReplayStatistics(JSON.parse(bytes.toString('utf8')));
  bytes=artifact.bytes;
  const metadata={...artifact.metadata,path:'stats.json.gz'};
  if(corruption==='stored')bytes=Buffer.from('truncated');
  if(corruption==='original')metadata.uncompressedSha256='0'.repeat(64);
  if(corruption==='length')metadata.uncompressedBytes++;
  if(corruption==='codec')metadata.compression='br';
  if(corruption==='gzip'){
   bytes=Buffer.from('invalid gzip');metadata.bytes=bytes.length;
   metadata.sha256=createHash('sha256').update(bytes).digest('hex');
  }
  records.get('matches/m/games/g/replaySources/r1').statistics=metadata;
  await assert.rejects(getSocialHistory.run(request),e=>e.code==='data-loss',corruption);
 }
});
test('unqualified native-looking active source is excluded from Chronicle without claiming peacefulness',async()=>{
 reset();
 const source=records.get('matches/m/games/g/replaySources/r1');
 source.statistics.projectionDeliveryVersion='AOF_DIRECT_SHARED_EPISODES_V1_EXPERIMENTAL';
 const r=await getSocialHistory.run(request);
 assert.equal(r.status,'PARTIAL');assert.equal(r.coverage.excludedGames,1);
 assert.equal(r.coverage.readableAcceptedGames,0);
 assert.equal(r.excluded[0].reason,'native_social_history_reader_not_qualified');
 assert.equal(r.history.contributions.length,0);
});

test('missing or disputed Game sources are disclosed rather than interpreted as peacefulness',async()=>{
 reset();delete records.get('matches/m/games/g').activeReplayStatisticsId;
 const r=await getSocialHistory.run(request);assert.equal(r.status,'PARTIAL');assert.equal(r.history.contributions.length,0);
 assert.equal(r.coverage.excludedGames,1);assert.equal(r.excluded[0].reason,'replay_statistics_missing');
 reset();records.get('matches/m/games/g').activeResultDisputeId='dispute';
 const d=await getSocialHistory.run(request);assert.equal(d.history.contributions.length,0);assert.equal(d.excluded[0].reason,'official_result_ineligible');
});
test('unknown chronology remains visible but expressly unresolved; duplicate Game sequence is rejected',async()=>{
 reset();delete records.get('matches/m').completedAt;
 const result=await getPlayerChronicle.run(request);
 assert.equal(result.status,'PARTIAL');
 assert.equal(result.coverage.chronologyPendingBattles,1);
 assert.equal(result.chronicle.pages[0].entries[0].chronologyStatus,'UNRESOLVED');
 assert.equal(result.chronicle.pages[0].entries[0].playedAtMs,null);
 reset();records.set('matches/m/games/other',{...records.get('matches/m/games/g')});
 await assert.rejects(getSocialHistory.run(request),e=>e.code==='failed-precondition');
});


function makeNativeSource(){
 reset();
 const H='a'.repeat(64),E='b'.repeat(64),proc='c'.repeat(64),revision='native-social-run',artifact='d'.repeat(64);
 const game=records.get('matches/m/games/g');
 game.activeReplayStatisticsId=H;game.replayStatisticsState='READY';game.replayStatisticsRevision=1;
 const provenance={replaySha256:H,recordedEventsSha256:E,recordedEventsVersion:'AOF_RECORDED_EVENTS_V1',
   parserVersion:'mgz-fast/test',extractionRunId:revision};
 const original=JSON.parse(bytes.toString('utf8'));
 original.source={...provenance};
 original.matchFacts.source={...provenance};
 original.pairSocialEvidence={modelVersion:'AOF_PAIR_SOCIAL_EVIDENCE_V1',identityNamespace:'CANONICAL_REPLAY_PLAYER_ID',
   gameScope:{...provenance},playerIds:[1,2],observations:[],incidents:[]};
 original.participants=[{playerId:1,replaySlot:1,displayName:'Alice'},
   {playerId:2,replaySlot:2,displayName:'Bob'}];
 original.statisticsSchemaVersion='1.2.0';
 original.statisticsProjectionVersion='AOF_RECORDED_EVENTS_STATISTICS_V1';
 original.sharedEpisodeDelivery={version:'AOF_DIRECT_SHARED_EPISODES_V1_EXPERIMENTAL'};
 const encoded=encodeReplayStatistics(original);
 bytes=encoded.bytes;
 const prefix='native-replay-evidence/m/g/'+H+'/';
 const mapping=[{replaySlot:1,playerId:'a',sourceName:'Alice'},{replaySlot:2,playerId:'b',sourceName:'Bob'}];
 const source={state:'READY',nativePublicationVersion:ACTIVE_NATIVE_SOURCE_VERSION,
   sourceHash:H,matchId:'m',gameId:'g',replayStatisticsRevision:1,
   nativeValidationCandidateId:'f'.repeat(64),processorRevision:proc,artifactRevision:artifact,
   extraction:{revision},playerMapping:mapping,
   originalRecording:{path:prefix+'source.aoe2record',generation:'1',
     permanent:true,sourceDeletionAuthorized:false},
   recordedEvents:{datasetVersion:'AOF_RECORDED_EVENTS_V1',sha256:E,
     path:prefix+artifact+'/events.jsonl.gz',generation:'2'},
   statistics:{...encoded.metadata,projectionDeliveryVersion:'AOF_DIRECT_SHARED_EPISODES_V1_EXPERIMENTAL',
     path:prefix+artifact+'/statistics.direct.json.gz',generation:'3'}};
 source.experience={version:'AOF_STATISTICS_EXPERIENCE_V3',bindingKey:statisticsBindingKey({
   sourceHash:H,roster:game.players,mapping,opponents:[],
 })};
 records.delete('matches/m/games/g/replaySources/r1');
 records.set('matches/m/games/g/replaySources/'+H,source);
 return {game,source,original,H};
}
test('social-history reader accepts only qualified native source and preserves accepted official duel and owner Chronicle',async()=>{
 const {original,H}=makeNativeSource();
 const priorReads=await getSocialHistory.run(request);
 assert.equal(priorReads.status,'PARTIAL','new native source remains off by default');
 assert.equal(priorReads.excluded[0].reason,'native_social_history_reader_not_qualified');
 const prior=process.env.AOF_ACTIVE_NATIVE_PLAYER_READS,shadow=process.env.AOF_ACTIVE_NATIVE_SOCIAL_READS;
 try{
  process.env.AOF_ACTIVE_NATIVE_PLAYER_READS='1';process.env.AOF_ACTIVE_NATIVE_SOCIAL_READS='1';
  const before=JSON.stringify([...records]);
  const social=await getSocialHistory.run(request);
  assert.equal(social.status,'AVAILABLE');
  assert.equal(social.coverage.readableAcceptedGames,1);
  assert.equal(social.history.pairs[0].tracks.RIVALRY.currentStage,1);
  assert.equal(social.history.policy.productionScoringEnabled,false);
  assert.equal(social.chronicle.ownerPlayerId,'a');
  assert.equal(social.chronicle.pages[0].counterpartPlayerId,'b');
  assert.equal(social.chronicle.pages[0].entries.length,1);
  assert.equal(JSON.stringify([...records]),before,'no social award or source writes');
  assert.equal(original.source.recordedEventsSha256,'b'.repeat(64));
  assert.equal(records.has('matches/m/games/g/nativeReplayValidations/'+H),false);
 }finally{
  if(prior===undefined)delete process.env.AOF_ACTIVE_NATIVE_PLAYER_READS;else process.env.AOF_ACTIVE_NATIVE_PLAYER_READS=prior;
  if(shadow===undefined)delete process.env.AOF_ACTIVE_NATIVE_SOCIAL_READS;else process.env.AOF_ACTIVE_NATIVE_SOCIAL_READS=shadow;
 }
});
test('qualified native social history fails closed on mid-read source rewrite and revised official outcome',async()=>{
 for(const mutator of [
  ({source})=>source.replayStatisticsRevision=2,
  ({game})=>game.canonicalResult.revision=2,
  ({game})=>game.activeResultDisputeId='open',
  ({game})=>game.activeReplayStatisticsId='0'.repeat(64),
 ]){
  const ctx=makeNativeSource();
  const prior=process.env.AOF_ACTIVE_NATIVE_PLAYER_READS,shadow=process.env.AOF_ACTIVE_NATIVE_SOCIAL_READS;
  process.env.AOF_ACTIVE_NATIVE_PLAYER_READS='1';process.env.AOF_ACTIVE_NATIVE_SOCIAL_READS='1';
  try{
   downloadHook=()=>mutator(ctx);
   await assert.rejects(getSocialHistory.run(request),e=>e.code==='aborted');
  }finally{
   if(prior===undefined)delete process.env.AOF_ACTIVE_NATIVE_PLAYER_READS;else process.env.AOF_ACTIVE_NATIVE_PLAYER_READS=prior;
   if(shadow===undefined)delete process.env.AOF_ACTIVE_NATIVE_SOCIAL_READS;else process.env.AOF_ACTIVE_NATIVE_SOCIAL_READS=shadow;
  }
 }
});
test('native social history rejects missing neutral evidence and corrupted pinned compressed artifacts',async()=>{
 for(const corrupt of ['bytes','missing-ledger','wrong-roster','wrong-extraction']){
  const ctx=makeNativeSource();
  const prior=process.env.AOF_ACTIVE_NATIVE_PLAYER_READS,shadow=process.env.AOF_ACTIVE_NATIVE_SOCIAL_READS;
  process.env.AOF_ACTIVE_NATIVE_PLAYER_READS='1';process.env.AOF_ACTIVE_NATIVE_SOCIAL_READS='1';
  try{
   if(corrupt==='bytes')bytes=Buffer.from('corrupt gzip');
   else {
    const raw=structuredClone(ctx.original);
    if(corrupt==='missing-ledger')delete raw.pairSocialEvidence.observations;
    if(corrupt==='wrong-roster')raw.pairSocialEvidence.playerIds=[2,1];
    if(corrupt==='wrong-extraction')raw.source.extractionRunId='stale';
    const updated=encodeReplayStatistics(raw);
    bytes=updated.bytes;
    ctx.source.statistics={...ctx.source.statistics,...updated.metadata};
   }
   await assert.rejects(getSocialHistory.run(request),e=>e.code==='data-loss',corrupt);
  }finally{
   if(prior===undefined)delete process.env.AOF_ACTIVE_NATIVE_PLAYER_READS;else process.env.AOF_ACTIVE_NATIVE_PLAYER_READS=prior;
   if(shadow===undefined)delete process.env.AOF_ACTIVE_NATIVE_SOCIAL_READS;else process.env.AOF_ACTIVE_NATIVE_SOCIAL_READS=shadow;
  }
 }
});

test('READY recording with unresolved Game outcome enters the factual book but not the official-duel shadow',async()=>{
 reset();
 const match=records.get('matches/m'),game=records.get('matches/m/games/g');
 match.status='ACTIVE';delete match.completedAt;
 game.status='AWAITING_CONFIRMATION';delete game.canonicalResult;
 const factual=await getPlayerChronicle.run(request);
 assert.equal(factual.status,'PARTIAL','unknown chronology is disclosed');
 assert.equal(factual.coverage.unresolvedOutcomeGames,1);
 assert.equal(factual.coverage.readableAcceptedGames,1);
 const entry=factual.chronicle.pages[0].entries[0];
 assert.equal(entry.resultStatus,'UNRESOLVED');
 assert.equal(entry.chronologyStatus,'UNRESOLVED');
 assert.doesNotMatch(entry.paragraphs.join(' '),/official duel|accepted result|victor|winner|defeat|rescue/i);
 const shadow=await getSocialHistory.run(request);
 assert.equal(shadow.history.contributions.length,0);
 assert.equal(shadow.history.policy.productionScoringEnabled,false);
});

test('long Match histories page beyond 100 without truncation and stable scene IDs survive source correction',async()=>{
 reset();
 const seedMatch=records.get('matches/m'),seedGame=records.get('matches/m/games/g');
 const seedSource=records.get('matches/m/games/g/replaySources/r1');
 for(let i=1;i<=134;i++){
  const matchId='m'+String(i).padStart(3,'0'),sourceId='r'+String(i+1);
  records.set('matches/'+matchId,{...seedMatch,completedAt:{toMillis:()=>1000+i}});
  records.set('matches/'+matchId+'/games/g',{...seedGame,activeReplayStatisticsId:sourceId});
  records.set('matches/'+matchId+'/games/g/replaySources/'+sourceId,{...seedSource});
 }
 const read=await getPlayerChronicle.run(request);
 assert.equal(read.coverage.scannedBattles,135);
 assert.equal(read.coverage.readableAcceptedGames,135);
 assert.equal(read.coverage.excludedGames,0);
 assert.equal(new Set(read.chronicle.pages[0].entries.map(x=>x.entryId)).size,read.chronicle.pages[0].entries.length);
 const original=read.chronicle.pages[0].entries[0].entryId;
 const revisedGame=records.get('matches/m/games/g');
 revisedGame.canonicalResult={...revisedGame.canonicalResult,revision:2};
 const corrected=await getPlayerChronicle.run(request);
 assert.equal(corrected.chronicle.pages[0].entries[0].entryId,original);
 assert.equal(corrected.coverage.readableAcceptedGames,135);
});

test('source withdrawal and replacement remove stale facts without writing scores or leaking sources',async()=>{
 reset();
 const initial=await getPlayerChronicle.run(request);
 const initialId=initial.chronicle.pages[0].entries[0].entryId;
 const game=records.get('matches/m/games/g'),old=records.get('matches/m/games/g/replaySources/r1');
 game.activeReplayStatisticsId='r2';
 records.set('matches/m/games/g/replaySources/r2',{...old,state:'READY'});
 const updated=await getPlayerChronicle.run(request);
 assert.equal(updated.coverage.readableAcceptedGames,1);
 assert.equal(updated.chronicle.pages[0].entries[0].entryId,initialId);
 assert.equal(JSON.stringify(updated).includes('r2'),false,'private source IDs remain internal');
 records.get('matches/m/games/g/replaySources/r2').state='WITHDRAWN';
 const withdrawn=await getPlayerChronicle.run(request);
 assert.equal(withdrawn.coverage.readableAcceptedGames,0);
 assert.equal(withdrawn.coverage.excludedGames,1);
 assert.equal(withdrawn.chronicle.pages.length,0);
});

test('valid warmup Event membership counts independent of scoring slot and wrong membership blocks',async()=>{
 reset();
 const match=records.get('matches/m');
 match.eventId='e';match.seasonId='s';
 records.set('events/e',{seasonId:'s',status:'ACTIVE',warmupMatchIds:['m'],officialMatchIds:[]});
 records.set('seasons/s',{status:'ACTIVE'});
 const ok=await getPlayerChronicle.run(request);
 assert.equal(ok.coverage.readableAcceptedGames,1);
 records.get('events/e').warmupMatchIds=[];
 const blocked=await getPlayerChronicle.run(request);
 assert.equal(blocked.coverage.readableAcceptedGames,0);
 assert.equal(blocked.coverage.excludedGames,1);
});

test('another account cannot select someone else Chronicle, and suspended members cannot read',async()=>{
 reset();records.set('authLinks/account-b',{playerId:'b'});records.set('players/b',{membershipStatus:'ACTIVE',role:'PLAYER'});
 const other=await getPlayerChronicle.run({...request,auth:{uid:'account-b',token:{}},data:{playerId:'a'}});
 assert.equal(other.chronicle.ownerPlayerId,'b');
 assert.equal(other.chronicle.pages[0].counterpartPlayerId,'a');
 records.get('players/b').membershipStatus='SUSPENDED';
 await assert.rejects(getPlayerChronicle.run({...request,auth:{uid:'account-b',token:{}},data:{playerId:'a'}}),e=>e.code==='permission-denied');
});

test('two Games in one Battle remain one scene; duplicate recorded source is not counted twice',async()=>{
 reset();
 const g=records.get('matches/m/games/g'),src=records.get('matches/m/games/g/replaySources/r1');
 records.set('matches/m/games/g2',{...g,gameNumber:2,activeReplayStatisticsId:'r2'});
 records.set('matches/m/games/g2/replaySources/r2',{...src});
 const result=await getPlayerChronicle.run(request);
 assert.equal(result.coverage.readableAcceptedGames,2);
 assert.equal(result.chronicle.pages[0].entries.length,1);
 const firstId=result.chronicle.pages[0].entries[0].entryId;
 records.get('matches/m/games/g2').activeReplayStatisticsId='r1';
 records.set('matches/m/games/g2/replaySources/r1',{...src});
 const duplicate=await getPlayerChronicle.run(request);
 assert.equal(duplicate.coverage.readableAcceptedGames,1);
 assert.equal(duplicate.coverage.excludedGames,1);
 assert.equal(duplicate.chronicle.pages[0].entries[0].entryId,firstId);
});
