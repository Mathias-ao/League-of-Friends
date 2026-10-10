import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {projectSocialIncidents} from '../lib/engines/socialIncidentCore.js';
import {nativeSocialInput} from '../lib/engines/nativeSocialInput.js';
import {projectNativeBattleRecord,selectNativeBattleRecord,NATIVE_BATTLE_RECORD_VERSION}
  from '../lib/engines/nativeBattleRecordRead.js';
import {readActiveNativeBattleRecord} from '../lib/queries/getActiveNativeBattleRecord.js';
import {decodeNativeDetailArtifact} from '../lib/engines/nativeStatisticsDetail.js';
import {statisticsBindingKey} from '../lib/engines/statisticsExperience.js';
import {ACTIVE_NATIVE_SOURCE_VERSION} from '../lib/engines/activeNativeStatisticsSource.js';
const hash=b=>createHash('sha256').update(b).digest('hex');
const S='a'.repeat(64),E='b'.repeat(64),PROC='c'.repeat(64),ART='d'.repeat(64),REV='validated-native-extraction';
const scope={replaySha256:S,recordedEventsSha256:E,
  recordedEventsVersion:'AOF_RECORDED_EVENTS_V1',parserVersion:'mgz-fast/test',extractionRunId:REV};
const official={qualification:'OFFICIAL',resultRevision:1,winnerPlayerIds:['p1'],
  loserPlayerIds:Array.from({length:7},(_,i)=>'p'+(i+2))};
const fixture=()=>JSON.parse(fs.readFileSync(new URL('./fixtures/social-ffa-diplo.json',import.meta.url)));
const normalize=(v)=>{
 if(Array.isArray(v))return v.map(normalize);
 if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v)
   .filter(([key])=>key!=='source').map(([key,x])=>[key,normalize(x)]));
 return v;
};
function build(){
 const canonical=fixture(),native=structuredClone(canonical);
 const playerIds=canonical.matchFacts.players.map(p=>p.playerId);
 const mapping=playerIds.map(id=>({replaySlot:id,playerId:'p'+id,sourceName:'Human '+id}));
 native.source={...scope};
 native.matchFacts.source={...scope};
 native.pairSocialEvidence.gameScope=Object.fromEntries(Object.entries(scope)
   .filter(([key])=>key!=='extractionRunId'));
 native.pairSocialEvidence.identityNamespace='CANONICAL_REPLAY_PLAYER_ID';
 native.pairSocialEvidence.playerIds=playerIds;
 native.participants=native.participants.map(p=>({...p,replaySlot:p.playerId}));
 native.statisticsSchemaVersion='1.2.0';
 native.statisticsProjectionVersion='AOF_RECORDED_EVENTS_STATISTICS_V1';
 native.sharedEpisodeDelivery={version:'AOF_DIRECT_SHARED_EPISODES_V1_EXPERIMENTAL'};
 const plain=Buffer.from(JSON.stringify(native),'utf8'),stored=gzipSync(plain);
 const metadata={format:'json',compression:'gzip',sha256:hash(stored),bytes:stored.length,
   uncompressedSha256:hash(plain),uncompressedBytes:plain.length,
   projectionDeliveryVersion:'AOF_DIRECT_SHARED_EPISODES_V1_EXPERIMENTAL'};
 return {canonical,native,mapping,stored,metadata};
}
function projection(){
 const f=build(),data=projectNativeBattleRecord(f.native,f.mapping,official,'m/g','m');
 return {...f,data};
}

test('real eight-player FFA shadow review is unchanged by native source mode and cannot award points',()=>{
 const f=projection();
 const canonical=projectSocialIncidents({statistics:f.canonical,playerMapping:f.mapping,
   officialOutcome:official,context:{gameId:'m/g',battleId:'m'}});
 assert.equal(canonical.status,'REVIEW_AVAILABLE');
 assert.equal(f.data.review.status,'REVIEW_AVAILABLE');
 assert.deepEqual(normalize(f.data.review),normalize(canonical));
 assert.equal(f.data.review.deeds.length,canonical.deeds.length);
 assert.equal(f.data.review.policy.productionScoringEnabled,false);
 assert.equal(f.data.ledger.incidents.length,42);
 assert.equal(f.data.ledger.observations.length,233);
 assert.equal(f.data.statistics.sharedEpisodeDelivery,undefined,'shared producer data stays isolated');
});

test('native record overview is bounded and reports observations, social qualifications, provenance and official result',()=>{
 const f=projection();
 const result=selectNativeBattleRecord(f.data,f.metadata.sha256,S,{mode:'overview'});
 assert.equal(result.version,NATIVE_BATTLE_RECORD_VERSION);
 assert.equal(result.delivery,'NATIVE_BOUNDED_V1');
 assert.equal(result.officialOutcome.qualification,'OFFICIAL');
 assert.equal(result.officialOutcome.resultRevision,1);
 assert.equal(result.social.status,'REVIEW_AVAILABLE');
 assert.equal(result.social.neutralIncidents,42);
 assert.equal(result.social.neutralObservations,233);
 assert.equal(result.social.productionScoringEnabled,false);
 assert.ok(Buffer.byteLength(JSON.stringify(result))<12*1024);
 assert.equal('incidents' in result,false);
 assert.ok(!JSON.stringify(result).includes('producerGroups'));
});

test('pages expose short reference headers; full social and neutral records remain fragment-retrievable',()=>{
 const f=projection();
 const first=selectNativeBattleRecord(f.data,f.metadata.sha256,S,{mode:'page',section:'ledgerIncidents'});
 assert.equal(first.total,42);assert.equal(first.entries.length,20);
 assert.equal(first.nextOffset,20);
 const second=selectNativeBattleRecord(f.data,f.metadata.sha256,S,{mode:'page',
   section:'ledgerIncidents',offset:20,expectedArtifactSha256:f.metadata.sha256});
 assert.equal(second.entries.length,20);assert.equal(second.nextOffset,40);
 const third=selectNativeBattleRecord(f.data,f.metadata.sha256,S,{mode:'page',
   section:'ledgerIncidents',offset:40,expectedArtifactSha256:f.metadata.sha256});
 assert.equal(third.entries.length,2);assert.equal(third.nextOffset,null);
 for(const [section,index,expected] of [
   ['ledgerIncident',first.entries[0].index,f.data.ledger.incidents[0]],
   ['ledgerObservation',0,f.data.ledger.observations[0]],
   ['socialIncident',0,f.data.review.incidents[0]],
   ['socialDecision',0,f.data.review.decisions[0]],
   ['matchFacts',undefined,f.data.facts],
   ['diplomacyReview',undefined,f.data.diplomacy],
   ['socialReview',undefined,f.data.review],
 ]){
   if(expected===undefined)continue;
   const chunks=[];let offset=0,checksum=null,total=0;
   do{
     const part=selectNativeBattleRecord(f.data,f.metadata.sha256,S,
       {mode:'fragment',section,index,offset,expectedArtifactSha256:f.metadata.sha256});
     const b=Buffer.from(part.chunkBase64,'base64');
     assert.ok(b.length<=32*1024);
     assert.equal(part.offset,offset);
     if(checksum!==null)assert.equal(part.contentSha256,checksum);
     checksum=part.contentSha256;total=part.totalBytes;chunks.push(b);
     if(part.nextOffset===null)break;
     assert.ok(part.nextOffset>offset);
     offset=part.nextOffset;
   }while(chunks.length<1000);
   const combined=Buffer.concat(chunks);
   assert.equal(combined.length,total);
   assert.equal(hash(combined),checksum);
   assert.deepEqual(JSON.parse(combined.toString('utf8')),expected,section);
 }
});

test('native selectors reject crossed artifact versions and invalid section/index/offset',()=>{
 const f=projection(),id=f.metadata.sha256;
 for(const request of [
   {mode:'page',section:'ledgerIncidents',offset:1},
   {mode:'page',section:'ledgerIncidents',offset:-1},
   {mode:'page',section:'ledgerIncidents',offset:100,expectedArtifactSha256:id},
   {mode:'page',section:'__proto__'},
   {mode:'fragment',section:'ledgerIncident',index:0},
   {mode:'fragment',section:'ledgerIncident',index:100,expectedArtifactSha256:id},
   {mode:'fragment',section:'matchFacts',offset:-1,expectedArtifactSha256:id},
   {mode:'fragment',section:'wrong',expectedArtifactSha256:id},
   {mode:'fragment',section:'socialReview',expectedArtifactSha256:'0'.repeat(64)},
 ]){
   assert.throws(()=>selectNativeBattleRecord(f.data,id,S,request));
 }
});

test('neutral evidence omissions and replay-slot confusion fail closed before social projection',()=>{
 const f=build(),before=structuredClone(f.native);
 assert.ok(nativeSocialInput(f.native,f.mapping));
 for(const mutate of [
   x=>delete x.pairSocialEvidence.observations,
   x=>delete x.pairSocialEvidence.incidents,
   x=>x.pairSocialEvidence.playerIds.pop(),
   x=>x.pairSocialEvidence.identityNamespace='LEAGUE_PLAYER_ID',
   x=>x.participants[0].replaySlot=2,
   x=>x.matchFacts.players[0].playerId=99,
   x=>x.pairSocialEvidence.playerIds[0]=8,
   x=>x.participants[0].playerId='p1',
 ]){
   const n=structuredClone(f.native);mutate(n);assert.throws(()=>nativeSocialInput(n,f.mapping));
 }
 assert.deepEqual(f.native,before);
});

function activeContext(){
 const f=build(),match={status:'COMPLETED',opponentKind:'HUMAN',format:'FFA',completedAt:'2026-01-01T00:00:00Z'};
 const game={status:'COMPLETED',activeReplayStatisticsId:S,replayStatisticsState:'READY',replayStatisticsRevision:1,
   players:f.mapping.map(m=>({playerId:m.playerId})),
   canonicalResult:{revision:1,source:'PLAYER_CONFIRMED',type:'COALITION_WIN',winningPlayerIds:['p1']}};
 const root='native-replay-evidence/m/g/'+S+'/';
 const source={state:'READY',nativePublicationVersion:ACTIVE_NATIVE_SOURCE_VERSION,
   sourceHash:S,matchId:'m',gameId:'g',replayStatisticsRevision:1,
   processorRevision:PROC,nativeValidationCandidateId:'f'.repeat(64),artifactRevision:ART,
   recordedEvents:{datasetVersion:'AOF_RECORDED_EVENTS_V1',sha256:E,path:root+ART+'/events.jsonl.gz',generation:'2'},
   extraction:{revision:REV},
   originalRecording:{path:root+'source.aoe2record',generation:'1',permanent:true,sourceDeletionAuthorized:false},
   statistics:{...f.metadata,path:root+ART+'/statistics.direct.json.gz',generation:'3'},
   playerMapping:f.mapping};
 source.experience={version:'AOF_STATISTICS_EXPERIENCE_V3',bindingKey:statisticsBindingKey({
   sourceHash:S,roster:game.players,mapping:f.mapping,opponents:[],
 })};
 const actor={playerId:'viewer',authUid:'uid'};
 const rows=new Map([
   ['matches/m',match],['matches/m/games/g',game],
   ['matches/m/games/g/replaySources/'+S,source],
   ['players/viewer',{membershipStatus:'ACTIVE',role:'PLAYER'}],
   ['authLinks/uid',{playerId:'viewer'}],
 ]);
 const ref=path=>({get:async()=>({exists:rows.has(path),data:()=>structuredClone(rows.get(path))}),
   collection:k=>({doc:id=>ref(path+'/'+k+'/'+id)})});
 const db={collection:k=>({doc:id=>ref(k+'/'+id)})};
 let onDownload=null,downloads=0;
 const bucket={file:(path,opts)=>({download:async()=>{
   assert.equal(path,source.statistics.path);assert.equal(opts.generation,'3');
   downloads++;if(onDownload)onDownload();return [f.stored];}})};
 const request={matchId:'m',gameId:'g',mode:'overview'};
 const env={AOF_ACTIVE_NATIVE_PLAYER_READS:'1'};
 const read=(extra={})=>readActiveNativeBattleRecord({
   db,bucket,actor:extra.actor??actor,request:extra.request??request,env:extra.env??env,
 });
 return {f,game,match,source,actor,rows,request,db,bucket,env,read,
   onDownload:fn=>onDownload=fn,get downloads(){return downloads}};
}

test('authenticated player reads real FFA Battle record from only qualified active READY source',async()=>{
 const a=activeContext();const unchanged=JSON.stringify([...a.rows]);
 const record=await a.read();
 assert.equal(record.state,'READY');assert.equal(record.statisticsId,S);
 assert.equal(record.social.neutralIncidents,42);
 assert.equal(record.social.status,'REVIEW_AVAILABLE');
 assert.equal(record.officialOutcome.qualification,'OFFICIAL');
 assert.equal(a.downloads,1);
 assert.equal(JSON.stringify([...a.rows]),unchanged,'no Game/statistics/reputation mutation');
 const page=await a.read({request:{...a.request,mode:'page',section:'ledgerIncidents',
   expectedArtifactSha256:record.artifactSha256}});
 assert.equal(page.entries.length,20);
});
test('native record excludes unactivated candidates, unqualified official results and disabled flags',async()=>{
 const a=activeContext();
 await assert.rejects(a.read({env:{}}),e=>e.code==='failed-precondition');
 a.source.state='VALIDATED_NOT_READY';
 await assert.rejects(a.read(),e=>e.code==='failed-precondition');
 a.source.state='READY';
 a.game.activeResultDisputeId='review';
 await assert.rejects(a.read(),e=>e.code==='failed-precondition');
 delete a.game.activeResultDisputeId;
 a.game.canonicalResult.winningPlayerIds=['unknown'];
 await assert.rejects(a.read(),e=>e.code==='failed-precondition');
});
test('correcting Game, source, mapping or membership during native read invalidates response',async()=>{
 for(const mutate of [
   a=>a.game.activeReplayStatisticsId='e'.repeat(64),
   a=>a.game.canonicalResult.revision=2,
   a=>a.source.statistics.sha256='0'.repeat(64),
   a=>a.source.playerMapping[0].playerId='outside',
   a=>a.rows.get('players/viewer').membershipStatus='SUSPENDED',
 ]){
   const a=activeContext();a.onDownload(()=>mutate(a));
   await assert.rejects(a.read(),e=>e.code==='aborted');
 }
});
test('pinned native artifact corruption and source revision mismatch are data loss, never zero incidents',async()=>{
 const a=activeContext();a.source.recordedEvents.sha256='0'.repeat(64);
 await assert.rejects(a.read(),e=>e.code==='data-loss');
 const b=activeContext();b.f.stored=Buffer.from('corrupt');
 await assert.rejects(b.read(),e=>e.code==='data-loss');
});
