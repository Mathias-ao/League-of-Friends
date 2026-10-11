import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {digest,bindingDigest,NATIVE_VALIDATION,NATIVE_DELIVERY} from '../../lib/engines/nativeRecordingIntegration.js';
import {executeNativeReadyPublication,assertNativePublicationAllowed,
  NATIVE_READY_PUBLICATION_VERSION} from '../../lib/services/nativeReadyPublication.js';
import {currentOfficialGameOutcome} from '../../lib/engines/recordingMatchFacts.js';

const REVISION='synthetic-native-extraction';
export const env={GCLOUD_PROJECT:'demo-native-publication-test',FUNCTIONS_EMULATOR:'true',
  AOF_NATIVE_REPLAY_PROJECT:'demo-native-publication-test',
  AOF_NATIVE_REPLAY_INTEGRATION:'validate-v1',REPLAY_WORKER_AUTH_TOKEN:'test-only',
  AOF_NATIVE_REPLAY_GAME_ALLOWLIST:'m/g',AOF_NATIVE_READY_GAME_ALLOWLIST:'m/g',
  AOF_NATIVE_REPLAY_PROCESSOR_REVISION:'c'.repeat(64),
  AOF_NATIVE_READY_PUBLICATION:'reviewed-v1',AOF_NATIVE_READY_ROLLBACK:'reviewed-v1',
  AOF_ACTIVE_NATIVE_PLAYER_READS:'1',AOF_ACTIVE_NATIVE_SOCIAL_READS:'1'};
export const actor={role:'ADMIN',playerId:'admin',authUid:'uid'};
const record=scope=>({replaySha256:scope.sourceHash,recordedEventsSha256:scope.eventsHash,
  recordedEventsVersion:'AOF_RECORDED_EVENTS_V1',parserVersion:'mgz-fast/test'});
const producerGroups=()=>({skirmishes:[],battles:[],reinforcements:[],defensiveAssists:[],cooperativeAttacks:[]});
const refs=()=>({skirmishes:[],battles:[],greatBattles:[],allyReinforcementsSent:[],
  allyReinforcementsReceived:[],defensiveAssistsGiven:[],defensiveAssistsReceived:[],
  cooperativeAttacks:[]});
const saved=(path,bytes,extra={})=>({path,sha256:digest(bytes),bytes:bytes.length,
  generation:'7',...extra});
export function fixture(){
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
   result:{qualification:'UNRESOLVED',winningPlayerIds:null,loserPlayerIds:null}};
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
     winningPlayerIds:['p1'],losingPlayerIds:['p2'],revision:1},
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
 let onDownload=null,downloads=0,beforeTransaction=null;
 const storage={file:(path,opts)=>({download:async()=>{
   assert.equal(opts.generation,'7','only the pinned immutable Storage generation is read');
   const bytes=objects.get(path);assert.ok(bytes,'unknown Storage path: '+path);
   downloads++;if(onDownload)onDownload();
   return [bytes];
 }})};
 const snapshot=path=>({exists:rows.has(path),id:path.split('/').at(-1),
   data:()=>structuredClone(rows.get(path)),ref:reference(path)});
 const query=path=>({docs:[...rows.keys()].filter(k=>k.startsWith(path+'/')&&k.split('/').length===path.split('/').length+1).map(snapshot)});
 const collection=path=>({path,isQuery:true,get:async()=>query(path),doc:id=>reference(path+'/'+id)});
 const reference=path=>({path,id:path.split('/').at(-1),get:async()=>snapshot(path),
   collection:part=>collection(path+'/'+part)});
 const db={
   collection:part=>collection(part),
   async runTransaction(callback){
     if(beforeTransaction){const mutate=beforeTransaction;beforeTransaction=null;mutate();}
     const changes=[],tx={
       get:async ref=>{assert.equal(changes.length,0,'reads must precede writes');return ref.isQuery?query(ref.path):snapshot(ref.path);},
       create:(ref,value)=>changes.push(['create',ref.path,value]),
       set:(ref,value)=>changes.push(['set',ref.path,value]),
       update:(ref,value)=>changes.push(['update',ref.path,value]),
       delete:ref=>changes.push(['delete',ref.path]),
     };
     const out=await callback(tx);
     const staged=new Map(rows);
     for(const [op,path,value] of changes){
       if(op==='create'){assert.equal(staged.has(path),false,'create-only document: '+path);staged.set(path,value);}
       if(op==='update'){assert.equal(staged.has(path),true,'update existing document: '+path);staged.set(path,{...staged.get(path),...value});}
       if(op==='set')staged.set(path,value);
       if(op==='delete')staged.delete(path);
     }
     rows.clear();for(const [key,value] of staged)rows.set(key,value);
     return out;
   },
 };
 const request={operation:'PUBLISH',matchId:'m',gameId:'g',candidateId,
   sourceHash,expectedArtifactSha256:statistics.sha256,
   expectedActiveSourceHash:null,expectedStatisticsRevision:0,expectedResultRevision:1,
   reason:'Administrator reviewed independent official Game and pinned native evidence.'};
 const run=(extra={})=>executeNativeReadyPublication({
   db:extra.db??db,bucket:extra.bucket??storage,actor:extra.actor??actor,
   env:extra.env??env,request:extra.request??request,
 });
 return {sourceHash,rows,objects,game,match,candidate,request,run,db,storage,
   candidateId,candidatePath:candidatesPath,
   publicationPath:'matches/m/games/g/nativeReplayPublications/'+candidateId,
   sourcePath:'matches/m/games/g/replaySources/'+sourceHash,
   onDownload:fn=>onDownload=fn,onTransaction:fn=>beforeTransaction=fn,
   get downloads(){return downloads},
 };
}
