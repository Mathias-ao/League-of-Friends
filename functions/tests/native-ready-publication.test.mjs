import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {digest,bindingDigest,NATIVE_VALIDATION,NATIVE_DELIVERY} from '../lib/engines/nativeRecordingIntegration.js';
import {executeNativeReadyPublication,assertNativePublicationAllowed,
  NATIVE_READY_PUBLICATION_VERSION} from '../lib/services/nativeReadyPublication.js';
import {currentOfficialGameOutcome} from '../lib/engines/recordingMatchFacts.js';

const SHA='a'.repeat(64),REVISION='synthetic-native-extraction';
const env={GCLOUD_PROJECT:'demo-native-publication-test',FUNCTIONS_EMULATOR:'true',
  AOF_NATIVE_REPLAY_PROJECT:'demo-native-publication-test',
  AOF_NATIVE_REPLAY_INTEGRATION:'validate-v1',REPLAY_WORKER_AUTH_TOKEN:'test-only',
  AOF_NATIVE_REPLAY_GAME_ALLOWLIST:'m/g',AOF_NATIVE_READY_GAME_ALLOWLIST:'m/g',
  AOF_NATIVE_REPLAY_PROCESSOR_REVISION:'c'.repeat(64),
  AOF_NATIVE_READY_PUBLICATION:'reviewed-v1',
  AOF_ACTIVE_NATIVE_PLAYER_READS:'1',AOF_ACTIVE_NATIVE_SOCIAL_READS:'1'};
const actor={role:'ADMIN',playerId:'admin',authUid:'uid'};
const record=scope=>({replaySha256:scope.sourceHash,recordedEventsSha256:scope.eventsHash,
  recordedEventsVersion:'AOF_RECORDED_EVENTS_V1',parserVersion:'mgz-fast/test'});
const producerGroups=()=>({skirmishes:[],battles:[],reinforcements:[],defensiveAssists:[],cooperativeAttacks:[]});
const refs=()=>({skirmishes:[],battles:[],greatBattles:[],allyReinforcementsSent:[],
  allyReinforcementsReceived:[],defensiveAssistsGiven:[],defensiveAssistsReceived:[],
  cooperativeAttacks:[]});
const saved=(path,bytes,extra={})=>({path,sha256:digest(bytes),bytes:bytes.length,
  generation:'7',...extra});
function fixture(){
 const original=Buffer.from('synthetic immutable Age of Empires native original file');
 const events=Buffer.from('synthetic immutable verified Recorded Events artifact');
 const sourceHash=digest(original),eventsHash=digest(events);
 const scope={sourceHash,eventsHash},provenance=record(scope);
 const mapping=[{playerId:'p1',replaySlot:1,sourceName:'Alice'},
   {playerId:'p2',replaySlot:2,sourceName:'Bob'}];
 const facts={modelVersion:'AOF_RECORDING_MATCH_FACTS_V1',
   identityNamespace:'CANONICAL_REPLAY_PLAYER_ID',
   source:{...provenance,extractionRunId:REVISION},
   game:{observedDurationMs:600_000,guid:'synthetic-native-game-guid'},
   players:[{playerId:1,replaySlot:1,lobbyTeamIdRaw:2},
     {playerId:2,replaySlot:2,lobbyTeamIdRaw:3}],
   rules:{lockTeams:{value:true}},diplomacy:{commandTimelines:{}},
   result:{qualification:'UNRESOLVED',winnerPlayerIds:null,loserPlayerIds:null}};
 const raw={statisticsSchemaVersion:'1.2.0',
   statisticsProjectionVersion:'AOF_RECORDED_EVENTS_STATISTICS_V1',
   source:{...provenance,extractionRunId:REVISION},matchFacts:facts,
   participants:[{playerId:1,replaySlot:1,displayName:'Alice',military:{engagements:{}}},
     {playerId:2,replaySlot:2,displayName:'Bob',military:{engagements:{}}}],
   pairSocialEvidence:{modelVersion:'AOF_PAIR_SOCIAL_EVIDENCE_V1',
     identityNamespace:'CANONICAL_REPLAY_PLAYER_ID',gameScope:provenance,
     playerIds:[1,2],observations:[],incidents:[]},
   sharedEpisodeDelivery:{version:NATIVE_DELIVERY,sourceMode:'producer_unique_episodes',
     producerGroups:producerGroups(),sharedEvidence:{},
     playerRefs:mapping.map(m=>({playerId:m.replaySlot,replaySlot:m.replaySlot,groups:refs()}))}};
 const plain=Buffer.from(JSON.stringify(raw),'utf8'),gzip=gzipSync(plain);
 const base='native-replay-evidence/m/g/'+sourceHash+'/',artifactRevision='d'.repeat(64);
 const originalRecording={...saved(base+'source.aoe2record',original),
   permanent:true,sourceDeletionAuthorized:false};
 const recordedEvents={...saved(base+artifactRevision+'/events.jsonl.gz',events),
   datasetVersion:'AOF_RECORDED_EVENTS_V1',format:'jsonl',compression:'gzip'};
 const statistics={...saved(base+artifactRevision+'/statistics.direct.json.gz',gzip),
   format:'json',compression:'gzip',projectionDeliveryVersion:NATIVE_DELIVERY,
   uncompressedSha256:digest(plain),uncompressedBytes:plain.length};
 const candidateId='e'.repeat(64);
 const candidate={contract:NATIVE_VALIDATION,state:'VALIDATED_NOT_READY',
   active:false,leagueEffectsPermitted:false,validatedBy:actor.playerId,
   matchId:'m',gameId:'g',sourceHash,processorRevision:env.AOF_NATIVE_REPLAY_PROCESSOR_REVISION,
   bindingToken:'f'.repeat(64),artifactRevision,extraction:{revision:REVISION},
   originalRecording,recordedEvents,statistics,matchFacts:facts,playerMapping:mapping,
   previewExperience:{version:'AOF_STATISTICS_EXPERIENCE_V3',players:[]},
   provenance:{sourceIdentity:sourceHash,projectionRevision:statistics.sha256,
     extractionRevision:REVISION,leagueInterpretationRevision:null},
   readyBlockers:['NATIVE_DETAIL_DELIVERY_NOT_QUALIFIED',
     'NATIVE_SOCIAL_READER_NOT_QUALIFIED','NATIVE_RESULT_CORRECTION_NOT_QUALIFIED']};
 const match={status:'COMPLETED',format:'ONE_V_ONE',opponentKind:'HUMAN',
   participants:[{playerId:'p1'},{playerId:'p2'}],
   context:{affectsSeasonStats:true,affectsLifetimeStats:true}};
 const game={status:'COMPLETED',players:[{playerId:'p1',team:1},{playerId:'p2',team:2}],
   canonicalResult:{source:'PLAYER_CONFIRMED',type:'PLAYER_WIN',
     winnerPlayerIds:['p1'],losingPlayerIds:['p2'],revision:1},
   activeReplayStatisticsId:null,replayStatisticsState:'UNAVAILABLE',replayStatisticsRevision:0,
   replay:{status:'NONE'}};
 const candidatesPath='matches/m/games/g/nativeReplayValidations/'+candidateId;
 const rows=new Map([
   ['matches/m',match],['matches/m/games/g',game],
   [candidatesPath,candidate],['players/admin',{role:'ADMIN',membershipStatus:'ACTIVE'}],
   ['authLinks/uid',{playerId:'admin'}],
   ['players/p1',{membershipStatus:'ACTIVE'}],['players/p2',{membershipStatus:'ACTIVE'}],
 ]);
 const objects=new Map([
   [originalRecording.path,original],
   [recordedEvents.path,events],
   [statistics.path,gzip],
 ]);
 let onDownload=null,downloads=0;
 const storage={file:(path,opts)=>({download:async()=>{
   assert.equal(opts.generation,'7','only the pinned immutable Storage generation is read');
   const bytes=objects.get(path);assert.ok(bytes,'unknown Storage path: '+path);
   downloads++;if(onDownload)onDownload();
   return [bytes];
 }})};
 const snapshot=path=>({exists:rows.has(path),id:path.split('/').at(-1),
   data:()=>structuredClone(rows.get(path)),ref:reference(path)});
 const reference=path=>({path,id:path.split('/').at(-1),get:async()=>snapshot(path),
   collection:part=>({doc:id=>reference(path+'/'+part+'/'+id)})});
 const db={
   collection:part=>({doc:id=>reference(part+'/'+id)}),
   async runTransaction(callback){
     const changes=[],tx={
       get:async ref=>snapshot(ref.path),
       create:(ref,value)=>changes.push(['create',ref.path,value]),
       set:(ref,value)=>changes.push(['set',ref.path,value]),
       update:(ref,value)=>changes.push(['update',ref.path,value]),
       delete:ref=>changes.push(['delete',ref.path]),
     };
     const out=await callback(tx);
     for(const [op,path,value] of changes){
       if(op==='create'){assert.equal(rows.has(path),false,'create-only document: '+path);rows.set(path,value);}
       if(op==='update'){assert.equal(rows.has(path),true,'update existing document: '+path);rows.set(path,{...rows.get(path),...value});}
       if(op==='set')rows.set(path,value);
       if(op==='delete')rows.delete(path);
     }
     return out;
   },
 };
 const request={operation:'PUBLISH',matchId:'m',gameId:'g',candidateId,
   sourceHash,expectedArtifactSha256:statistics.sha256,
   expectedActiveSourceHash:null,expectedStatisticsRevision:0,expectedResultRevision:1,
   reason:'Administrator reviewed independent official Game and pinned native evidence.'};
 const run=(extra={})=>executeNativeReadyPublication({
   db,bucket:extra.bucket??storage,actor:extra.actor??actor,
   env:extra.env??env,request:extra.request??request,
 });
 return {sourceHash,rows,objects,game,match,candidate,request,run,db,storage,
   candidateId,candidatePath:candidatesPath,
   publicationPath:'matches/m/games/g/nativeReplayPublications/'+candidateId,
   sourcePath:'matches/m/games/g/replaySources/'+sourceHash,
   onDownload:fn=>onDownload=fn,
   get downloads(){return downloads},
 };
}

test('native READY publication requires separate operator/role/project/Game/processor and official reader gates',()=>{
 const t=fixture();
 assert.equal(assertNativePublicationAllowed(env,actor,t.request),env.AOF_NATIVE_REPLAY_PROCESSOR_REVISION);
 for(const field of [
   {AOF_NATIVE_READY_PUBLICATION:''},{AOF_NATIVE_REPLAY_INTEGRATION:''},
   {AOF_ACTIVE_NATIVE_PLAYER_READS:''},{AOF_ACTIVE_NATIVE_SOCIAL_READS:''},
   {AOF_NATIVE_READY_GAME_ALLOWLIST:'m/wrong'},
   {AOF_NATIVE_REPLAY_GAME_ALLOWLIST:'m/wrong'},
   {AOF_NATIVE_REPLAY_PROJECT:'other'},
   {AOF_NATIVE_REPLAY_PROCESSOR_REVISION:'wrong'},
   {GCLOUD_PROJECT:'league-of-friends-cc274'},
 ]){
   assert.throws(()=>assertNativePublicationAllowed({...env,...field},actor,t.request));
 }
 assert.throws(()=>assertNativePublicationAllowed(env,{...actor,role:'PLAYER'},t.request));
 assert.throws(()=>assertNativePublicationAllowed(env,actor,{...t.request,reason:'too short'}));
});

test('verified native publication atomically switches qualified source and preserves official result/old evidence',async()=>{
 const t=fixture(),before=structuredClone([...t.rows]);
 assert.equal(currentOfficialGameOutcome(t.game,t.match).qualification,'OFFICIAL',
   JSON.stringify(currentOfficialGameOutcome(t.game,t.match)));
 const r=await t.run();
 assert.equal(r.state,'READY');assert.equal(r.activated,true);
 assert.equal(r.replayStatisticsRevision,1);
 assert.ok(t.downloads>=3);
 assert.equal(t.game.activeReplayStatisticsId,null,'mock snapshot not mutated by new publication');
 const game=t.rows.get('matches/m/games/g'),source=t.rows.get(t.sourcePath);
 assert.equal(game.activeReplayStatisticsId,t.sourceHash);
 assert.equal(game.replayStatisticsState,'READY');
 assert.equal(game.replayStatisticsRevision,1);
 assert.deepEqual(game.canonicalResult,before.find(([k])=>k==='matches/m/games/g')[1].canonicalResult,
   'published native statistics never rewrite the official winner');
 assert.equal(source.state,'READY');
 assert.equal(source.nativePublicationVersion,'AOF_ACTIVE_NATIVE_STATISTICS_V1');
 assert.equal(source.statistics.sha256,t.request.expectedArtifactSha256);
 assert.equal(source.originalRecording.permanent,true);
 assert.equal(source.originalRecording.sourceDeletionAuthorized,false);
 assert.equal(source.experience.version,'AOF_STATISTICS_EXPERIENCE_V3');
 assert.equal(source.experience.seasonShowcaseVersion,'AOF_SEASON_SHOWCASE_V2');
 assert.equal(source.experience.eligible,true);
 const journal=t.rows.get(t.publicationPath);
 assert.equal(journal.version,NATIVE_READY_PUBLICATION_VERSION);
 assert.equal(journal.state,'ACTIVE');assert.equal(journal.previousActiveSourceId,null);
 assert.equal(journal.officialResultRevision,1);
 assert.equal(t.rows.get(t.candidatePath).state,'PUBLISHED_READY');
 assert.equal(t.rows.get(t.candidatePath).leagueEffectsPermitted,false);
 assert.ok([...t.rows.keys()].some(key=>key.startsWith('recordingGameClaims/')));
 assert.ok([...t.rows.values()].some(row=>row?.action==='NATIVE_READY_SOURCE_PUBLISHED'));
 const second=await t.run();
 assert.equal(second.alreadyPublished,true);
 assert.equal(t.rows.get('matches/m/games/g').replayStatisticsRevision,1,
   'same candidate is idempotent instead of creating duplicate revisions');
});

test('rollback restores the prior Game source, increments the revision and retains native evidence',async()=>{
 const t=fixture();await t.run();
 const rollback={...t.request,operation:'ROLLBACK',
   expectedActiveSourceHash:t.sourceHash,expectedStatisticsRevision:1,
   reason:'Undo trial native source after independent detailed reader qualification.'};
 const r=await t.run({request:rollback});
 assert.equal(r.state,'ROLLED_BACK');assert.equal(r.activated,undefined);
 assert.equal(r.replayStatisticsRevision,2);
 const game=t.rows.get('matches/m/games/g');
 assert.equal(game.activeReplayStatisticsId,null);
 assert.equal(game.replayStatisticsRevision,2);
 assert.equal(game.replayStatisticsState,'UNAVAILABLE');
 assert.equal(t.rows.get(t.publicationPath).state,'ROLLED_BACK');
 assert.equal(t.rows.get(t.candidatePath).active,false);
 assert.equal(t.rows.get(t.candidatePath).state,'ROLLED_BACK');
 assert.equal(t.rows.get(t.sourcePath).state,'READY','rollback does not delete or rewrite source evidence');
 assert.equal(t.rows.get(t.sourcePath).originalRecording.permanent,true);
 assert.equal([...t.rows.keys()].filter(x=>x.startsWith('recordingGameClaims/')).length,0);
 assert.equal((await t.run({request:rollback})).alreadyRolledBack,true);
 await assert.rejects(t.run(),e=>e.code==='failed-precondition',
   'rolled-back candidate cannot republish without new validation and approval');
});

test('when swapping a legacy READY source, rollback restores exactly that immutable legacy pointer',async()=>{
 const t=fixture(),old='1'.repeat(64);
 t.rows.set('matches/m/games/g/replaySources/'+old,
   {state:'READY',sourceHash:old,statistics:{path:'old/immutable.json.gz',sha256:'2'.repeat(64)}});
 t.game.activeReplayStatisticsId=old;t.game.replayStatisticsState='READY';t.game.replayStatisticsRevision=7;
 t.request.expectedActiveSourceHash=old;t.request.expectedStatisticsRevision=7;
 await t.run();
 assert.equal(t.rows.get('matches/m/games/g').activeReplayStatisticsId,t.sourceHash);
 const r=await t.run({request:{...t.request,operation:'ROLLBACK',
   expectedActiveSourceHash:t.sourceHash,expectedStatisticsRevision:8,
   reason:'Restore prior verified legacy Game statistics after native trial.'}});
 assert.equal(r.replayStatisticsRevision,9);
 assert.equal(t.rows.get('matches/m/games/g').activeReplayStatisticsId,old);
 assert.equal(t.rows.get('matches/m/games/g/replaySources/'+old).state,'READY');
});

test('all source-switch/replay mismatch, accepted binding, dispute and result corrections fail closed',async()=>{
 for(const mutate of [
   t=>t.game.recordingResultBinding={sourceHash:'7'.repeat(64)},
   t=>t.game.canonicalResult.source='RECORDING_VERIFIED',
   t=>t.game.activeResultDisputeId='dispute',
   t=>t.match.activeResultDisputeId='dispute',
   t=>t.game.canonicalResult.revision=2,
   t=>t.game.canonicalResult.winningPlayerIds=['other'],
   t=>t.game.replayStatisticsRevision=1,
   t=>t.game.activeReplayStatisticsId='0'.repeat(64),
   t=>t.match.status='DISPUTED',
   t=>t.candidate.processorRevision='wrong',
   t=>t.candidate.originalRecording.sourceDeletionAuthorized=true,
   t=>t.candidate.playerMapping[1].playerId='other',
 ]){
   const t=fixture();mutate(t);
   await assert.rejects(t.run());
   assert.equal(t.rows.has(t.sourcePath),false);
   assert.equal(t.rows.has(t.publicationPath),false);
 }
});

test('corrupt immutable source/event/statistics and cross-Game GUID claims never activate',async()=>{
 for(const path of ['originalRecording','recordedEvents','statistics']){
   const t=fixture(),p=t.candidate[path].path;
   t.objects.set(p,Buffer.from('corrupt'));
   await assert.rejects(t.run(),e=>e.code==='data-loss');
   assert.equal(t.rows.has(t.sourcePath),false);
 }
 const t=fixture(),guid=t.candidate.matchFacts.game.guid;
 const claimKey=Buffer.from(guid).toString('hex');
 t.rows.set('recordingGameClaims/'+claimKey,{matchId:'someone-else',gameId:'elsewhere'});
 await assert.rejects(t.run(),e=>e.code==='failed-precondition');
});

test('mutable authority and result changes during immutable Storage read abort publication',async()=>{
 for(const mutate of [
   t=>{t.game.canonicalResult.revision=3;},
   t=>{t.rows.get('players/admin').membershipStatus='SUSPENDED';},
   t=>{t.candidate.statistics.sha256='0'.repeat(64);},
   t=>{t.game.activeReplayStatisticsId='1'.repeat(64);},
   t=>{t.rows.get('players/p2').steamName='Changed since review';},
 ]){
   const t=fixture();let changed=false;
   t.onDownload(()=>{if(!changed){changed=true;mutate(t);}});
   await assert.rejects(t.run(),e=>e.code==='aborted');
   assert.equal(t.rows.has(t.sourcePath),false);
 }
});

test('rollback refuses result changes, active disputes, tampered source or stale cursor',async()=>{
 for(const mutate of [
   t=>{t.game.canonicalResult.revision=3;},
   t=>{t.game.activeResultDisputeId='opened';},
   t=>{t.rows.get(t.sourcePath).nativeValidationCandidateId='wrong';},
   t=>{t.game.activeReplayStatisticsId='1'.repeat(64);},
   t=>{t.rows.get(t.publicationPath).state='REVOKED';},
 ]){
   const t=fixture();await t.run();mutate(t);
   const rollback={...t.request,operation:'ROLLBACK',expectedActiveSourceHash:t.sourceHash,
     expectedStatisticsRevision:1,reason:'Rollback reviewed native Game after source/correction condition changed.'};
   await assert.rejects(t.run({request:rollback}));
   assert.equal(t.rows.get(t.publicationPath).state==='ROLLED_BACK',false);
 }
});
