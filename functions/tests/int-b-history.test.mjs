import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import {fixture,env as baseEnv} from './support/native-ready-fixture.mjs';
import {bindingDigest,digest} from '../lib/engines/nativeRecordingIntegration.js';
import {statisticsBindingKey} from '../lib/engines/statisticsExperience.js';
import {readMyPersonalityHistory,getMyPersonalityHistory} from '../lib/queries/getMyPersonalityHistory.js';
import {readMyPrivateChronicle} from '../lib/queries/getMyPrivateChronicle.js';
import {projectPrivatePersonalityHistory} from '../lib/integration/personalityHistory.js';
import {validateSharedRecord} from '../lib/domain/socialV1Validation.js';

const env={...baseEnv,AOF_INT_V1_PRIVATE_READS:'source-v1',AOF_INT_V1_PRIVATE_HISTORY:'battle-v1'};
const copy=v=>Array.isArray(v)?v.map(copy):v&&typeof v==='object'?
 typeof v.toMillis==='function'?{toMillis:()=>v.toMillis()}:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,copy(x)])):v;
async function ready(){
 const f=fixture();await f.run();
 Object.assign(f.rows.get('matches/m'),{eventId:'e',seasonId:'s',firstCompletedAt:{toMillis:()=>1000},participants:[{playerId:'p1'},{playerId:'p2'}]});
 Object.assign(f.rows.get('matches/m/games/g'),{gameNumber:1});
 f.rows.set('events/e',{status:'ACTIVE',seasonId:'s',officialMatchIds:['m'],warmupMatchIds:[]});f.rows.set('seasons/s',{status:'ACTIVE'});
 f.rows.set('authLinks/owner',{playerId:'p1'});f.rows.set('authLinks/other',{playerId:'p2'});
 const snap=path=>{const data=copy(f.rows.get(path));return {exists:f.rows.has(path),id:path.split('/').at(-1),ref:ref(path),data:()=>data};};
 const list=(path,opts={})=>{const docs=[...f.rows.keys()].filter(k=>k.startsWith(path+'/')&&k.split('/').length===path.split('/').length+1)
  .sort().filter(k=>!opts.after||k.split('/').at(-1)>opts.after).slice(0,opts.limit??Infinity).map(snap);return {docs,size:docs.length};};
 const ref=path=>({path,get:async()=>snap(path),collection:k=>collection(path+'/'+k)});
 const collection=(path,opts={})=>({path,isQuery:true,opts,doc:id=>ref(path+'/'+id),orderBy:()=>collection(path,opts),
  limit:limit=>collection(path,{...opts,limit}),startAfter:d=>collection(path,{...opts,after:d.id}),get:async()=>list(path,opts)});
 f.db.doc=ref;f.db.collection=collection;let onFinal=null;
 f.db.runTransaction=async fn=>{if(onFinal){const run=onFinal;onFinal=null;run();}return fn({get:async r=>r.isQuery?list(r.path,r.opts):snap(r.path)});};
 const input={db:f.db,bucket:f.storage,actor:{playerId:'p1',authUid:'owner'},request:{},env};
 return {...f,input,read:()=>readMyPersonalityHistory(input),onFinal:fn=>onFinal=fn};
}
function addSyntheticSecondGame(f){
 const sourceHash=digest('second synthetic original'),gameId='g2';
 const game=structuredClone(f.game);Object.assign(game,{gameNumber:2,status:'COMPLETED',activeReplayStatisticsId:sourceHash,replayStatisticsState:'READY',replayStatisticsRevision:1});
 const old=f.rows.get(f.sourcePath),s=structuredClone(old),raw=JSON.parse(gunzipSync(f.objects.get(old.statistics.path)));
 raw.source.replaySha256=sourceHash;raw.matchFacts.source.replaySha256=sourceHash;
 raw.matchFacts.game.guid='synthetic-second-guid';raw.pairSocialEvidence.gameScope.replaySha256=sourceHash;
 const plain=Buffer.from(JSON.stringify(raw)),stored=gzipSync(plain),prefix='native-replay-evidence/m/g2/'+sourceHash+'/';
 Object.assign(s,{gameId,sourceHash,matchFacts:raw.matchFacts,ordinaryUploadVersion:'AOF_NATIVE_PLAYER_UPLOAD_V1'});
 s.originalRecording={...s.originalRecording,path:prefix+'source.aoe2record',sha256:sourceHash};
 s.recordedEvents={...s.recordedEvents,path:prefix+s.artifactRevision+'/events.jsonl.gz'};
 s.statistics={...s.statistics,path:prefix+s.artifactRevision+'/statistics.direct.json.gz',sha256:digest(stored),bytes:stored.length,
  uncompressedSha256:digest(plain),uncompressedBytes:plain.length};
 s.experience.bindingKey=statisticsBindingKey({sourceHash,roster:game.players,mapping:s.playerMapping,opponents:[]});
 f.objects.set(s.statistics.path,stored);f.rows.set('matches/m/games/g2',game);f.rows.set('matches/m/games/g2/replaySources/'+sourceHash,s);
 f.rows.set('recordingGameClaims/'+Buffer.from(raw.matchFacts.game.guid).toString('hex'),{matchId:'m',gameId:'g2',sourceHash});
 return s;
}

test('two current Games form one canonical Battle intake; retries and correction replace rather than append',async()=>{
 const f=await ready();addSyntheticSecondGame(f);
 const before=JSON.stringify([...f.rows]),r=await f.read();
 assert.equal(r.coverage.ownBattles,1);assert.equal(r.coverage.ownGames,2);assert.equal(r.coverage.currentSources,2);
 assert.equal(r.personality.battleFeatures.length,5);
 for(const row of r.personality.battleFeatures){validateSharedRecord('BattleFeature',row);assert.equal(row.battleId,'m');assert.equal(row.evidenceRefs.length,2);assert.equal(row.numerator,null);}
 assert.ok(r.personality.personalityProfile.sliders.every(s=>s.status==='DEVELOPING'&&s.value===null));
 assert.deepEqual(await f.read(),r);assert.equal(JSON.stringify([...f.rows]),before);
 f.rows.get('matches/m/games/g2').canonicalResult.revision=2;
 const corrected=await f.read();assert.notEqual(corrected.inputDigest,r.inputDigest);
 assert.notEqual(corrected.personality.personalityProfile.projectionRevision,r.personality.personalityProfile.projectionRevision);
 assert.equal(corrected.personality.battleFeatures.length,5);
});

test('withdrawal, missing sibling, source rebind, no chronology and pending outcome cannot inflate evidence',async()=>{
 const f=await ready(),second=addSyntheticSecondGame(f),r=await f.read();
 const path='matches/m/games/g2/replaySources/'+second.sourceHash;
 f.rows.get(path).state='WITHDRAWN';
 const withdrawn=await f.read();assert.equal(withdrawn.coverage.currentSources,1);assert.equal(withdrawn.pending.length,1);
 assert.equal(withdrawn.personality.battleFeatures.length,5);
 assert.ok(withdrawn.personality.battleFeatures.every(x=>x.normalized===null&&x.coverage.missing.includes('INCOMPLETE_OR_UNORDERED_BATTLE_INPUT')));
 f.rows.get(path).state='READY';
 const source=f.rows.get(f.sourcePath),mapping=[...source.playerMapping].reverse().map((x,i,a)=>({...x,replaySlot:a[(i+1)%a.length].replaySlot}));
 source.playerMapping=mapping;source.experience.bindingKey=statisticsBindingKey({sourceHash:f.sourceHash,roster:f.rows.get('matches/m/games/g').players,mapping,opponents:[]});
 assert.notEqual((await f.read()).inputDigest,r.inputDigest);
 delete f.rows.get('matches/m').firstCompletedAt;
 assert.ok((await f.read()).personality.battleFeatures.every(x=>x.numerator===null));
});

test('complete bounded query exceeds 100 Battles; at 257 or 65 own Games it fails before artifact reads',async()=>{
 const f=await ready();for(let i=0;i<144;i++)f.rows.set('matches/outsider-'+i.toString().padStart(3,'0'),{participants:[{playerId:'outsider'}]});
 const r=await f.read();assert.equal(r.coverage.scannedLeagueBattles,145);assert.equal(r.coverage.ownBattles,1);
 for(let i=144;i<256;i++)f.rows.set('matches/outsider-'+i,{participants:[]});
 const downloads=f.downloads;await assert.rejects(f.read,e=>e.code==='resource-exhausted');assert.equal(f.downloads,downloads);
 const g=await ready();for(let i=2;i<=65;i++)g.rows.set('matches/m/games/g'+i,{gameNumber:i,players:[{playerId:'p1'}]});
 await assert.rejects(g.read,e=>e.code==='resource-exhausted');assert.equal(g.downloads,3,'only original publication verification downloads');
});

test('owner comes only from authenticated link; no caller policy/context/source selection, no cross-owner leak',async()=>{
 const f=await ready();
 for(const field of ['playerId','context','calibration','sourceHash','cursor'])await assert.rejects(readMyPersonalityHistory({...f.input,request:{[field]:'forged'}}),e=>e.code==='invalid-argument');
 await assert.rejects(getMyPersonalityHistory.run({data:{}}),e=>e.code==='unauthenticated');
 const other=await readMyPersonalityHistory({...f.input,actor:{playerId:'p2',authUid:'other'}});
 assert.equal(other.ownerPlayerId,'p2');assert.ok(other.personality.battleFeatures.every(f=>f.playerId==='p2'));
 for(const field of ['sourceName','native-replay-evidence','privateNote','auditRef','relationshipMarks'])assert.ok(!JSON.stringify(other).includes(field));
 await assert.rejects(readMyPersonalityHistory({...f.input,env:{...env,GCLOUD_PROJECT:'league-of-friends-cc274'}}));
 await assert.rejects(readMyPersonalityHistory({...f.input,env:{...env,AOF_INT_V1_PRIVATE_HISTORY:undefined}}));
});

test('whole-set fence catches inserted/deleted Games/Battles, pending admission, GUID and access races',async()=>{
 for(const change of [
  f=>f.rows.set('matches/m/games/new',{gameNumber:2,players:[{playerId:'p1'}]}),
  f=>f.rows.set('matches/new',{participants:[{playerId:'p1'}]}),
  f=>f.rows.delete('matches/m/games/g'),
  f=>f.rows.get('events/e').warmupMatchIds.push('m'),
  f=>f.rows.get('authLinks/owner').playerId='p2',
  f=>f.rows.get('recordingGameClaims/'+Buffer.from(f.candidate.matchFacts.game.guid).toString('hex')).sourceHash='f'.repeat(64),
 ]){const f=await ready();let once=false;f.onDownload(()=>{if(!once){once=true;change(f);}});await assert.rejects(f.read);}
 const f=await ready();f.rows.get(f.sourcePath).state='PROCESSING';
 // Even a source that was pending at collection must be fenced, not silently admitted mid-read.
 f.onFinal(()=>{f.rows.get(f.sourcePath).state='READY';});await assert.rejects(f.read,e=>e.code==='aborted');
});

test('accepted engine computes raw unnormalized features only with independently supplied test context; no numeric calibration',()=>{
 const base=JSON.parse(readFileSync(new URL('../../contracts/social-v1/fixtures/conformance.json',import.meta.url))).bases.SourceSnapshot;
 const playerId=base.roster[0].playerId,slot=base.roster[0].replaySlot;
 const item={source:{...base,outcome:{qualification:'OFFICIAL',resultRevision:1,winningPlayerIds:[playerId]}},
  match:{firstCompletedAt:{toMillis:()=>1000}},game:{gameNumber:1},statistics:{participants:[{playerId:slot,replaySlot:slot,
   economy:{resourceCommitment:{modelVersion:'AOF_RESOURCE_COMMITMENT_V1',resourcesCommitted:{total:1000},coverage:{unpricedRequestCommands:0}}},
   military:{modelVersion:'AOF_MILITARY_STATISTICS_V5',militarySpend:{resources:300,unpricedMilitaryCommandAmount:0}}}]}};
 const battles=[{battleId:base.battleId,gameIds:[base.gameId],sources:[item]}];
 const no=projectPrivatePersonalityHistory(playerId,battles,bindingDigest('input'));
 assert.ok(no.battleFeatures.every(f=>f.numerator===null));
 const context={format:'ONE_V_ONE',mapFamily:'LAND',startFamily:'STANDARD',mapId:'synthetic',durationFamily:'TEST_ONLY',
  civilization:'TEST_ONLY',civilizationOpportunityKey:'TEST_ONLY',durationMs:1000,observedUntilMs:1000,dynamicDiplomacyQualified:false};
 const yes=projectPrivatePersonalityHistory(playerId,battles,bindingDigest('input'),()=>context);
 const raw=yes.battleFeatures.find(f=>f.featureId==='BOOMER_AGGRESSOR');assert.equal(raw.numerator,.3);assert.equal(raw.denominator,1);assert.equal(raw.normalized,null);
 assert.ok(yes.personalityProfile.sliders.every(s=>s.value===null));assert.equal(yes.personalityProfile.policy.status,'PROPOSED');
});

test('private Chronicle reuses factual allowlist, rejects caller target and fences revoked membership',async()=>{
 const f=await ready();
 const factual=async owner=>({success:true,status:'AVAILABLE',names:{[owner]:'Owner',p2:'Other',outsider:'Hidden'},coverage:{},
  chronicle:{ownerPlayerId:owner,pages:[{pairId:'pair',counterpartPlayerId:'p2',entries:[{entryId:'old',sceneId:'scene',sourceHash:'secret',privateNote:'never',relationshipMarks:[1],paragraphs:['Factual text.']}]}]}});
 const input={db:f.db,actor:f.input.actor,env,request:{},readFactual:factual};
 const read=await readMyPrivateChronicle(input);assert.equal(read.chronicle.ownerPlayerId,'p1');
 assert.ok(!JSON.stringify(read).includes('never'));assert.ok(!('outsider' in read.names));
 await assert.rejects(readMyPrivateChronicle({...input,request:{playerId:'p2'}}),e=>e.code==='invalid-argument');
 await assert.rejects(readMyPrivateChronicle({...input,readFactual:async owner=>{const r=await factual(owner);f.rows.get('authLinks/owner').playerId='p2';return r;}}),e=>e.code==='permission-denied');
});
