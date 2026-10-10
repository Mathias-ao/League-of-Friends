import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {decodeNativeDetailArtifact,selectNativeBattleDetail,NATIVE_DETAIL_VERSION}
  from '../lib/engines/nativeStatisticsDetail.js';
import {readNativeDetailPreview} from '../lib/queries/getNativeBattleDetailPreview.js';
import {bindingDigest,NATIVE_VALIDATION} from '../lib/engines/nativeRecordingIntegration.js';

const sha=b=>createHash('sha256').update(b).digest('hex');
const SOURCE='a'.repeat(64),EVENTS='b'.repeat(64),REVISION='fixed-extraction';
const groupNames=['skirmishes','battles','greatBattles','allyReinforcementsSent',
  'allyReinforcementsReceived','defensiveAssistsGiven','defensiveAssistsReceived','cooperativeAttacks'];
const emptyGroups=()=>Object.fromEntries(groupNames.map(k=>[k,[]]));
const nativeSource={replaySha256:SOURCE,recordedEventsSha256:EVENTS,
  recordedEventsVersion:'AOF_RECORDED_EVENTS_V1',parserVersion:'mgz-fast/test',extractionRunId:REVISION};
const ledgerScope=Object.fromEntries(Object.entries(nativeSource).filter(([k])=>k!=='extractionRunId'));
function fixture(){
  const large=['ø','⚔️','汉字','𝌆','\u0000','\\"','\n'].join('')+'x'.repeat(150000);
  const sharedField=[large,'more evidence',...Array.from({length:100},(_,n)=>'event-'+n)];
  const fields={sourceEventIds:'c'.repeat(64)};
  const episode={body:{battleId:'b1',startedAtMs:60000,endedAtMs:72000,greatBattle:true,
    participantPlayerIds:[1,2]},shared:fields};
  const producerGroups={skirmishes:[],battles:[episode,{body:{battleId:'b2',startedAtMs:90000}}],
    reinforcements:[],defensiveAssists:[],cooperativeAttacks:[]};
  const groups1=emptyGroups();groups1.battles=['battles/0','battles/1'];groups1.greatBattles=['battles/0'];
  const groups2=emptyGroups();groups2.battles=['battles/0'];
  const raw={
    statisticsSchemaVersion:'1.2.0',statisticsProjectionVersion:'AOF_RECORDED_EVENTS_STATISTICS_V1',
    source:{...nativeSource},
    matchFacts:{source:{...nativeSource}},
    pairSocialEvidence:{gameScope:ledgerScope,observations:[],incidents:[]},
    participants:[{playerId:1,replaySlot:1},{playerId:2,replaySlot:2}],
    sharedEpisodeDelivery:{version:'AOF_DIRECT_SHARED_EPISODES_V1_EXPERIMENTAL',
      sourceMode:'producer_unique_episodes',producerGroups,
      playerRefs:[{playerId:1,replaySlot:1,groups:groups1},{playerId:2,replaySlot:2,groups:groups2}],
      sharedEvidence:{[fields.sourceEventIds]:sharedField}},
  };
  const plain=Buffer.from(JSON.stringify(raw),'utf8'),bytes=gzipSync(plain);
  const metadata={format:'json',compression:'gzip',bytes:bytes.length,sha256:sha(bytes),
    uncompressedBytes:plain.length,uncompressedSha256:sha(plain)};
  return {raw,plain,bytes,metadata,sharedField};
}
function binding(){return {sourceHash:SOURCE,eventsSha256:EVENTS,extractionRunId:REVISION};}

test('native evidence pages list only assigned episodes with stable revision-bound cursors',()=>{
  const {raw,metadata}=fixture(),before=structuredClone(raw);
  const request={mode:'list',replaySlot:1,group:'battles',pageSize:1};
  const first=selectNativeBattleDetail(raw,metadata.sha256,request);
  assert.equal(first.version,NATIVE_DETAIL_VERSION);
  assert.equal(first.total,2);assert.equal(first.entries[0].reference,'battles/0');
  assert.equal(first.entries[0].id,'b1');assert.equal(first.entries[0].startedAtMs,60000);
  assert.equal(first.nextOffset,1);
  const second=selectNativeBattleDetail(raw,metadata.sha256,
    {...request,offset:first.nextOffset,expectedArtifactSha256:metadata.sha256});
  assert.equal(second.entries[0].reference,'battles/1');
  assert.equal(second.nextOffset,null);
  assert.deepEqual(selectNativeBattleDetail(raw,metadata.sha256,
    {...request,replaySlot:2,pageSize:10}).entries.map(x=>x.reference),['battles/0']);
  assert.equal(JSON.stringify(first).includes('more evidence'),false,'lists never copy large evidence');
  assert.deepEqual(raw,before,'native artifact stays immutable');
});

test('fragmented shared evidence reconstructs unicode JSON exactly and obeys 32-KiB transport',()=>{
  const {raw,metadata,sharedField}=fixture();
  const query={mode:'fragment',replaySlot:1,group:'battles',reference:'battles/0',
    field:'sourceEventIds',expectedArtifactSha256:metadata.sha256};
  const buffers=[];let offset=0,sha256=null,fragments=0;
  do{
    const r=selectNativeBattleDetail(raw,metadata.sha256,{...query,offset});
    assert.equal(r.artifactSha256,metadata.sha256);
    assert.equal(r.producerSharedSha256,'c'.repeat(64),
      'Python canonical-JSON reference remains distinct from Node content SHA');
    assert.ok(Buffer.byteLength(JSON.stringify(r),'utf8')<50*1024);
    buffers.push(Buffer.from(r.chunkBase64,'base64'));sha256=r.contentSha256;fragments++;
    if(r.nextOffset===null){assert.equal(r.complete,true);break;}
    assert.ok(r.nextOffset>offset);offset=r.nextOffset;
  }while(fragments<100);
  assert.ok(fragments>4);
  const reconstructed=Buffer.concat(buffers);
  assert.equal(sha(reconstructed),sha256);
  assert.deepEqual(JSON.parse(reconstructed.toString('utf8')),sharedField);
  const body=selectNativeBattleDetail(raw,metadata.sha256,
    {...query,field:'body',offset:0});
  assert.equal(JSON.parse(Buffer.from(body.chunkBase64,'base64')).battleId,'b1');
});

test('native selector rejects unassigned references, stale cursors and malformed registries',()=>{
 const {raw,metadata}=fixture();
 const list={mode:'list',group:'battles',replaySlot:1};
 const part={mode:'fragment',group:'battles',replaySlot:2,reference:'battles/1',field:'body'};
 const bad=[
  ()=>selectNativeBattleDetail(raw,metadata.sha256,part),
  ()=>selectNativeBattleDetail(raw,metadata.sha256,{...list,offset:1}),
  ()=>selectNativeBattleDetail(raw,metadata.sha256,{...list,pageSize:100}),
  ()=>selectNativeBattleDetail(raw,metadata.sha256,{...list,offset:-1}),
  ()=>selectNativeBattleDetail(raw,metadata.sha256,{...list,group:'__proto__'}),
  ()=>selectNativeBattleDetail(raw,metadata.sha256,{...list,expectedArtifactSha256:'0'.repeat(64)}),
  ()=>selectNativeBattleDetail(raw,metadata.sha256,{...list,replaySlot:999}),
  ()=>selectNativeBattleDetail(raw,metadata.sha256,{...part,replaySlot:1,field:'unknown'}),
  ()=>selectNativeBattleDetail(raw,metadata.sha256,{...part,replaySlot:1,reference:'battles/1',
    field:'sourceEventIds'}),
 ];
 for(const fn of bad)assert.throws(fn);
 for(const mutate of [
  x=>x.sharedEpisodeDelivery.version='V2_UNREVIEWED',
  x=>delete x.sharedEpisodeDelivery.producerGroups.battles,
  x=>x.sharedEpisodeDelivery.playerRefs[0].replaySlot=2,
  x=>x.sharedEpisodeDelivery.playerRefs[1].playerId=1,
  x=>delete x.sharedEpisodeDelivery.playerRefs[0].groups.greatBattles,
  x=>x.sharedEpisodeDelivery.producerGroups.battles[0].shared.sourceEventIds='unhashed',
  x=>x.sharedEpisodeDelivery.producerGroups.battles[0].body.sourceEventIds=['duplicate'],
 ]){
  const changed=structuredClone(raw);mutate(changed);
  assert.throws(()=>selectNativeBattleDetail(changed,metadata.sha256,list));
 }
});

test('native gzip detail decoder verifies compressed, uncompressed and extraction bindings',()=>{
 const f=fixture();
 assert.deepEqual(decodeNativeDetailArtifact(f.bytes,f.metadata,binding()),f.raw);
 for(const [bytes,meta,source] of [
  [Buffer.from('invalid'),f.metadata,binding()],
  [f.bytes,{...f.metadata,sha256:'0'.repeat(64)},binding()],
  [f.bytes,{...f.metadata,uncompressedSha256:'0'.repeat(64)},binding()],
  [f.bytes,{...f.metadata,uncompressedBytes:f.metadata.uncompressedBytes-1},binding()],
  [f.bytes,{...f.metadata,compression:'plain'},binding()],
  [f.bytes,{...f.metadata,uncompressedBytes:65*1024*1024},binding()],
  [f.bytes,f.metadata,{...binding(),eventsSha256:'0'.repeat(64)}],
  [f.bytes,f.metadata,{...binding(),extractionRunId:'stale'}],
 ])assert.throws(()=>decodeNativeDetailArtifact(bytes,meta,source));
 for(const mutate of [
  d=>{d.source.canonicalManifestSha256='not-native';},
  d=>{d.matchFacts.source.recordedEventsSha256='0'.repeat(64);},
  d=>{d.pairSocialEvidence.gameScope.parserVersion='wrong';},
  d=>{d.source.recordedEventsVersion='v2';},
 ]){
  const next=structuredClone(f.raw);mutate(next);
  const plain=Buffer.from(JSON.stringify(next)),bytes=gzipSync(plain);
  const meta={...f.metadata,bytes:bytes.length,sha256:sha(bytes),
    uncompressedBytes:plain.length,uncompressedSha256:sha(plain)};
  assert.throws(()=>decodeNativeDetailArtifact(bytes,meta,binding()));
 }
});

function serviceFixture(){
 const f=fixture(),env={GCLOUD_PROJECT:'demo-aof-native-integration',FUNCTIONS_EMULATOR:'true',
  AOF_NATIVE_REPLAY_PROJECT:'demo-aof-native-integration',AOF_NATIVE_REPLAY_INTEGRATION:'validate-v1',
  AOF_NATIVE_REPLAY_GAME_ALLOWLIST:'m/g',AOF_NATIVE_REPLAY_PROCESSOR_REVISION:'e'.repeat(64),
  REPLAY_WORKER_AUTH_TOKEN:'test-only'};
 const actor={role:'ADMIN',playerId:'admin',authUid:'uid'};
 const game={players:[{playerId:'a'},{playerId:'b'}]},match={opponentKind:'HUMAN'};
 const rows=new Map([
  ['matches/m',match],['matches/m/games/g',game],
  ['players/admin',{role:'ADMIN',membershipStatus:'ACTIVE'}],
  ['players/a',{role:'PLAYER',membershipStatus:'ACTIVE'}],
  ['players/b',{role:'PLAYER',membershipStatus:'ACTIVE'}],
  ['authLinks/uid',{playerId:'admin'}],
 ]);
 const token=bindingDigest({game,match,players:[rows.get('players/a'),rows.get('players/b')],
   admin:rows.get('players/admin'),link:rows.get('authLinks/uid')});
 const candidateId='f'.repeat(64),rev='d'.repeat(64);
 const prefix='native-replay-evidence/m/g/'+SOURCE+'/'+rev+'/';
 const candidate={contract:NATIVE_VALIDATION,state:'VALIDATED_NOT_READY',active:false,
   leagueEffectsPermitted:false,validatedBy:'admin',processorRevision:env.AOF_NATIVE_REPLAY_PROCESSOR_REVISION,
   matchId:'m',gameId:'g',sourceHash:SOURCE,artifactRevision:rev,bindingToken:token,
   originalRecording:{permanent:true,sourceDeletionAuthorized:false},
   recordedEvents:{sha256:EVENTS,datasetVersion:'AOF_RECORDED_EVENTS_V1'},
   extraction:{revision:REVISION},provenance:{sourceIdentity:SOURCE,projectionRevision:f.metadata.sha256,
     extractionRevision:REVISION},
   statistics:{...f.metadata,path:prefix+'statistics.direct.json.gz',generation:'123'}};
 rows.set('matches/m/games/g/nativeReplayValidations/'+candidateId,candidate);
 let changedOnDownload=null;
 const bucket={file:(path,opts)=>({
  download:async()=>{
   assert.equal(path,candidate.statistics.path);
   assert.equal(opts.generation,candidate.statistics.generation);
   if(changedOnDownload)changedOnDownload();
   return [f.bytes];
  },
 })};
 const ref=path=>({get:async()=>({exists:rows.has(path),data:()=>structuredClone(rows.get(path))}),
  collection:name=>({doc:id=>ref(path+'/'+name+'/'+id)})});
 const db={collection:name=>({doc:id=>ref(name+'/'+id)})};
 const request={matchId:'m',gameId:'g',candidateId,mode:'list',group:'battles',replaySlot:1,pageSize:1};
 return {f,db,bucket,actor,env,rows,candidate,request,changeOnDownload:fn=>changedOnDownload=fn};
}
test('private preview reads pinned Storage generation and returns bounded episodes',async()=>{
 const t=serviceFixture();
 const r=await readNativeDetailPreview({db:t.db,bucket:t.bucket,actor:t.actor,
  env:t.env,request:t.request});
 assert.equal(r.success,true);assert.equal(r.activated,false);
 assert.equal(r.state,'VALIDATED_NOT_READY');assert.equal(r.entries.length,1);
 assert.equal(r.artifactSha256,t.f.metadata.sha256);
 assert.ok(JSON.stringify(r).length<2000);
 const part=await readNativeDetailPreview({db:t.db,bucket:t.bucket,actor:t.actor,env:t.env,
  request:{...t.request,mode:'fragment',reference:'battles/0',field:'sourceEventIds',
    expectedArtifactSha256:r.artifactSha256}});
 assert.equal(part.mode,'fragment');assert.ok(Buffer.from(part.chunkBase64,'base64').length<=32768);
});

test('preview rejects disabled flags, other administrators, changed Game and storage corruption',async()=>{
 const t=serviceFixture();
 const call=async(extra={})=>readNativeDetailPreview({
  db:t.db,bucket:extra.bucket??t.bucket,actor:extra.actor??t.actor,
  env:extra.env??t.env,request:extra.request??t.request,
 });
 for(const env of [{...t.env,AOF_NATIVE_REPLAY_INTEGRATION:''},
   {...t.env,GCLOUD_PROJECT:'league-of-friends-cc274'},
   {...t.env,AOF_NATIVE_REPLAY_GAME_ALLOWLIST:'m/wrong'}]){
  await assert.rejects(call({env}),e=>e.code==='failed-precondition');
 }
 await assert.rejects(call({actor:{...t.actor,playerId:'other'}}),
   e=>['failed-precondition','aborted'].includes(e.code));
 const bad={...t.bucket,file:(path,opts)=>({
   download:async()=>[Buffer.from('corrupt')],
 })};
 await assert.rejects(call({bucket:bad}),e=>e.code==='data-loss');
 const changed=serviceFixture();
 changed.changeOnDownload(()=>changed.rows.get('matches/m').opponentKind='AI');
 await assert.rejects(readNativeDetailPreview({db:changed.db,bucket:changed.bucket,
   actor:changed.actor,env:changed.env,request:changed.request}),e=>e.code==='aborted');
 const before=serviceFixture();
 before.rows.get('players/a').membershipStatus='SUSPENDED';
 await assert.rejects(readNativeDetailPreview({db:before.db,bucket:before.bucket,
   actor:before.actor,env:before.env,request:before.request}),e=>e.code==='aborted');
});

test('validation preview never updates Game, source revisions or league ledgers',async()=>{
 const t=serviceFixture();
 const before=structuredClone([...t.rows]);
 await readNativeDetailPreview({db:t.db,bucket:t.bucket,actor:t.actor,env:t.env,request:t.request});
 assert.deepEqual([...t.rows],before,'read-only contract');
});
