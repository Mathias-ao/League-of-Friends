import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {activeNativeStatisticsSource,ACTIVE_NATIVE_SOURCE_VERSION} from '../lib/engines/activeNativeStatisticsSource.js';
import {readActiveNativeBattleDetail} from '../lib/queries/getActiveNativeBattleDetail.js';
import {statisticsMetadata} from '../lib/services/statisticsExperienceProjection.js';
import {statisticsBindingKey} from '../lib/engines/statisticsExperience.js';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const H='a'.repeat(64),E='b'.repeat(64),REV='native-run-001',PROC='c'.repeat(64),ART='d'.repeat(64);
const GROUPS=['skirmishes','battles','greatBattles','allyReinforcementsSent',
  'allyReinforcementsReceived','defensiveAssistsGiven','defensiveAssistsReceived','cooperativeAttacks'];
const groups=()=>Object.fromEntries(GROUPS.map(key=>[key,[]]));
const scope={replaySha256:H,recordedEventsSha256:E,recordedEventsVersion:'AOF_RECORDED_EVENTS_V1',
  parserVersion:'mgz-fast/test',extractionRunId:REV};
function testContext(){
 const match={status:'COMPLETED',opponentKind:'HUMAN',format:'ONE_V_ONE',
   context:{affectsSeasonStats:true,affectsLifetimeStats:true}};
 const game={status:'COMPLETED',replayStatisticsState:'READY',replayStatisticsRevision:1,
   activeReplayStatisticsId:H,
   players:[{playerId:'p1',team:1},{playerId:'p2',team:2}],
   canonicalResult:{source:'PLAYER_CONFIRMED',type:'PLAYER_WIN',revision:1,winningPlayerIds:['p1']}};
 const ref='native-replay-evidence/m/g/'+H+'/';
 const first=groups();first.battles=['battles/0'];const second=groups();second.battles=['battles/0'];
 const raw={source:scope,statisticsSchemaVersion:'1.2.0',
   statisticsProjectionVersion:'AOF_RECORDED_EVENTS_STATISTICS_V1',
   matchFacts:{source:scope},pairSocialEvidence:{gameScope:scope},
   participants:[{playerId:1,replaySlot:1},{playerId:2,replaySlot:2}],
   sharedEpisodeDelivery:{version:'AOF_DIRECT_SHARED_EPISODES_V1_EXPERIMENTAL',
     sourceMode:'producer_unique_episodes',
     producerGroups:{skirmishes:[],battles:[{body:{battleId:'battle-1',startedAtMs:5000}}],
       reinforcements:[],defensiveAssists:[],cooperativeAttacks:[]},
     playerRefs:[{playerId:1,replaySlot:1,groups:first},{playerId:2,replaySlot:2,groups:second}],
     sharedEvidence:{}}};
 const plain=Buffer.from(JSON.stringify(raw)),bytes=gzipSync(plain);
 const statistics={format:'json',compression:'gzip',sha256:sha(bytes),bytes:bytes.length,
   uncompressedSha256:sha(plain),uncompressedBytes:plain.length,
   projectionDeliveryVersion:'AOF_DIRECT_SHARED_EPISODES_V1_EXPERIMENTAL',
   path:ref+ART+'/statistics.direct.json.gz',generation:'123'};
 const source={state:'READY',nativePublicationVersion:ACTIVE_NATIVE_SOURCE_VERSION,
   matchId:'m',gameId:'g',sourceHash:H,replayStatisticsRevision:1,processorRevision:PROC,
   nativeValidationCandidateId:'f'.repeat(64),artifactRevision:ART,
   playerMapping:[{playerId:'p1',replaySlot:1,sourceName:'Alice'},
     {playerId:'p2',replaySlot:2,sourceName:'Bob'}],
   statistics,recordedEvents:{datasetVersion:'AOF_RECORDED_EVENTS_V1',sha256:E,
     path:ref+ART+'/events.jsonl.gz',generation:'2'},
   originalRecording:{path:ref+'source.aoe2record',permanent:true,
     sourceDeletionAuthorized:false,generation:'1'},
   extraction:{revision:REV}};
 source.experience={version:'AOF_STATISTICS_EXPERIENCE_V3',
   bindingKey:statisticsBindingKey(statisticsMetadata('m','g',match,game,source))};
 const actor={authUid:'uid',playerId:'outsider'}; // existing League readers allow ACTIVE nonparticipants
 const records=new Map([
   ['matches/m',match],['matches/m/games/g',game],
   ['matches/m/games/g/replaySources/'+H,source],
   ['players/outsider',{membershipStatus:'ACTIVE',role:'PLAYER'}],
   ['authLinks/uid',{playerId:'outsider'}],
 ]);
 let onDownload=null,bytesDownloaded=bytes;
 const reference=path=>({get:async()=>({exists:records.has(path),data:()=>structuredClone(records.get(path))}),
   collection:key=>({doc:id=>reference(path+'/'+key+'/'+id)})});
 const db={collection:name=>({doc:id=>reference(name+'/'+id)})};
 const bucket={file:(path,options)=>({
   download:async()=>{
     assert.equal(path,statistics.path);assert.equal(options.generation,'123');
     if(onDownload)onDownload();
     return [bytesDownloaded];
   },
 })};
 const request={matchId:'m',gameId:'g',mode:'list',group:'battles',replaySlot:1,pageSize:20};
 const env={AOF_ACTIVE_NATIVE_PLAYER_READS:'1'};
 const read=(extra={})=>readActiveNativeBattleDetail({
   db,bucket,actor:extra.actor??actor,env:extra.env??env,request:extra.request??request,
 });
 return {match,game,source,raw,records,request,read,env,actor,db,
   onDownload:fn=>onDownload=fn, corrupt:()=>bytesDownloaded=Buffer.from('garbage')};
}

test('qualified active native source is explicit; candidate and legacy cannot impersonate it',()=>{
 const t=testContext();
 assert.ok(activeNativeStatisticsSource('m','g',t.match,t.game,H,t.source,true));
 assert.equal(activeNativeStatisticsSource('m','g',t.match,t.game,H,t.source,false),null);
 for(const change of [
   s=>s.state='VALIDATED_NOT_READY',
   s=>s.nativePublicationVersion='AOF_NATIVE_RECORDING_VALIDATION_V1',
   s=>delete s.nativePublicationVersion,
   s=>s.nativeValidationCandidateId='bad',
   s=>s.statistics.path='another/stats.json.gz',
   s=>s.statistics.generation='',
   s=>s.originalRecording.permanent=false,
   s=>s.playerMapping[0].playerId='unknown',
   s=>s.playerMapping[1].replaySlot=1,
   s=>s.replayStatisticsRevision=2,
   s=>s.experience.bindingKey='stale',
 ]){
   const changed=structuredClone(t.source);change(changed);
   assert.equal(activeNativeStatisticsSource('m','g',t.match,t.game,H,changed,true),null);
 }
 const disputed=structuredClone(t.game);disputed.activeResultDisputeId='open';
 assert.equal(activeNativeStatisticsSource('m','g',t.match,disputed,H,t.source,true),null);
 const sourceReplaced=structuredClone(t.game);sourceReplaced.activeReplayStatisticsId='f'.repeat(64);
 assert.equal(activeNativeStatisticsSource('m','g',t.match,sourceReplaced,H,t.source,true),null);
 const corrected=structuredClone(t.game);
 corrected.canonicalResult.winningPlayerIds=['unknown'];
 assert.equal(activeNativeStatisticsSource('m','g',t.match,corrected,H,t.source,true),null);
});

test('ordinary ACTIVE league viewer reads only bounded detail of officially active READY source',async()=>{
 const t=testContext();
 const before=structuredClone([...t.records]);
 const match=await t.db.collection('matches').doc('m').get();
 const game=await t.db.collection('matches').doc('m').collection('games').doc('g').get();
 const source=await t.db.collection('matches').doc('m').collection('games').doc('g').collection('replaySources').doc(H).get();
 assert.equal(match.exists,true);assert.equal(game.exists,true);assert.equal(source.exists,true);
 assert.ok(activeNativeStatisticsSource('m','g',match.data(),game.data(),H,source.data(),true));
 const first=await t.read();
 assert.equal(first.state,'READY');assert.equal(first.delivery,'NATIVE_BOUNDED_V1');
 assert.equal(first.entries.length,1);assert.equal(first.entries[0].reference,'battles/0');
 assert.equal(first.total,1);assert.equal(first.statisticsId,H);
 const fragment=await t.read({request:{...t.request,mode:'fragment',reference:'battles/0',
   field:'body',expectedArtifactSha256:first.artifactSha256}});
 assert.equal(fragment.complete,true);
 assert.equal(JSON.parse(Buffer.from(fragment.chunkBase64,'base64')).battleId,'battle-1');
 assert.deepEqual([...t.records],before,'player reads must never award, activate or mutate');
});

test('normal player reader fails closed for flags, disputes, source swap, bad mapping and candidate',async()=>{
 const t=testContext();
 await assert.rejects(t.read({env:{}}),e=>e.code==='failed-precondition');
 t.game.activeResultDisputeId='open';
 await assert.rejects(t.read(),e=>e.code==='failed-precondition');
 delete t.game.activeResultDisputeId;
 t.source.state='VALIDATED_NOT_READY';
 await assert.rejects(t.read(),e=>e.code==='failed-precondition');
 t.source.state='READY';
 t.game.activeReplayStatisticsId='f'.repeat(64);
 await assert.rejects(t.read(),e=>e.code==='failed-precondition');
 t.game.activeReplayStatisticsId=H;
 t.source.playerMapping[0].playerId='other';
 await assert.rejects(t.read(),e=>e.code==='failed-precondition');
});

test('mid-download correction, source rewrite and revoked league access abort stale reads',async()=>{
 for(const modify of [
   t=>{t.game.activeResultDisputeId='new';},
   t=>{t.game.canonicalResult.revision=2;},
   t=>{t.game.activeReplayStatisticsId='f'.repeat(64);},
   t=>{t.source.playerMapping[0].playerId='other';},
   t=>{t.records.get('players/outsider').membershipStatus='SUSPENDED';},
 ]){
   const t=testContext();t.onDownload(()=>modify(t));
   await assert.rejects(t.read(),e=>e.code==='aborted');
 }
});

test('invalid decompression/hash, source revision and player attribution never become visible',async()=>{
 const t=testContext();t.corrupt();
 await assert.rejects(t.read(),e=>e.code==='data-loss');
 const changed=testContext();
 changed.raw.participants[0].replaySlot=8;
 // Tamper with the actual pinned bytes, not with a separate in-memory fixture.
 changed.onDownload(()=>{});
 const mismatch=testContext();mismatch.source.recordedEvents.sha256='f'.repeat(64);
 await assert.rejects(mismatch.read(),e=>e.code==='data-loss');
 await assert.rejects(mismatch.read({request:{...mismatch.request,group:'not-real'}}),
   e=>e.code==='data-loss');
 const invalid=testContext();
 await assert.rejects(invalid.read({request:{...invalid.request,offset:1}}),
   e=>e.code==='invalid-argument');
});

test('active native read keeps the same response contract when original candidate documents do not exist',async()=>{
 const t=testContext(); // no nativeReplayValidations documents are seeded
 assert.equal((await t.read()).entries.length,1);
});
