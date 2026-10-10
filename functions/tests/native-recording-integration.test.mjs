import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {assertNativeValidationAllowed,artifactBytes,verifyNativePackage,verifyMapping,saveNativeArtifact,
  digest,NATIVE_PACKAGE,NATIVE_DELIVERY} from '../lib/engines/nativeRecordingIntegration.js';

const env={GCLOUD_PROJECT:'demo-aof-native-integration',FUNCTIONS_EMULATOR:'true',
  AOF_NATIVE_REPLAY_PROJECT:'demo-aof-native-integration',AOF_NATIVE_REPLAY_INTEGRATION:'validate-v1',
  AOF_NATIVE_REPLAY_GAME_ALLOWLIST:'m/g',AOF_NATIVE_REPLAY_PROCESSOR_REVISION:'a'.repeat(64),REPLAY_WORKER_AUTH_TOKEN:'test-only'};
test('native route requires independent request/operator/project/role/Game/processor gates',()=>{
  assert.equal(assertNativeValidationAllowed(env,'ADMIN','m','g'),'a'.repeat(64));
  for(const change of [{AOF_NATIVE_REPLAY_INTEGRATION:''},{GCLOUD_PROJECT:'league-of-friends-cc274'},
    {AOF_NATIVE_REPLAY_PROJECT:'other'},{AOF_NATIVE_REPLAY_GAME_ALLOWLIST:'m/other'},
    {AOF_NATIVE_REPLAY_PROCESSOR_REVISION:'unversioned'},{REPLAY_WORKER_AUTH_TOKEN:''}])
    assert.throws(()=>assertNativeValidationAllowed({...env,...change},'ADMIN','m','g'));
  assert.throws(()=>assertNativeValidationAllowed(env,'PLAYER','m','g'));
});

const artifact=(plain,format)=>{const bytes=gzipSync(plain);return {format,compression:'gzip',sha256:digest(bytes),
  bytes:bytes.length,uncompressedSha256:digest(plain),uncompressedBytes:plain.length,base64:bytes.toString('base64')};};
function fixture(){
  const original=Buffer.from('synthetic test recording'),sourceHash=digest(original),revision='11111111-1111-5111-8111-111111111111';
  const players=[{playerId:1,name:'A'},{playerId:2,name:'B'}];
  const header={datasetVersion:'AOF_RECORDED_EVENTS_V1',schemaVersion:'1.0.0',retentionVersion:'AOF_RECORDED_EVENTS_RETENTION_V1',
    layer:'decoded_observations',source:{sha256:sourceHash,bytes:original.length},
    extraction:{revision,extractorCodeSha256:'a'.repeat(64),decoderCodeSha256:'b'.repeat(64),parserVersion:'test'},context:{participants:players}};
  const footer={operationCount:1,initialObjectCount:0,tileCount:0,observedUntilMs:100,operationCounts:{SYNC:1},decodeStatusCounts:{complete:1},framing:'complete'};
  const records=[['header',header],['sync',0,100,'complete',[]],['end',footer]];
  const events={...artifact(Buffer.from(records.map(r=>JSON.stringify(r)+'\n').join('')),'jsonl'),datasetVersion:'AOF_RECORDED_EVENTS_V1'};
  const provenance={replaySha256:sourceHash,recordedEventsSha256:events.sha256,recordedEventsVersion:'AOF_RECORDED_EVENTS_V1',parserVersion:'test'};
  const matchFacts={modelVersion:'AOF_RECORDING_MATCH_FACTS_V1',identityNamespace:'CANONICAL_REPLAY_PLAYER_ID',
    source:{...provenance,extractionRunId:revision},game:{},map:{},rules:{},diplomacy:{},coverage:{},players,
    result:{qualification:'UNRESOLVED',winnerPlayerIds:null,loserPlayerIds:null},policy:{automaticResultSubmissionEnabled:false,
      rewardsEnabled:false,relationshipScoringEnabled:false,reputationScoringEnabled:false,rawFactsVisibleByDefault:false}};
  const groups={skirmishes:[],battles:[],greatBattles:[],defensiveAssistsGiven:[],cooperativeAttacks:[]};
  const raw={statisticsSchemaVersion:'1.2.0',statisticsProjectionVersion:'AOF_RECORDED_EVENTS_STATISTICS_V1',
    source:{...provenance,extractionRunId:revision},matchFacts,
    participants:players.map(p=>({playerId:p.playerId,replaySlot:p.playerId,military:{engagements:{}}})),
    pairSocialEvidence:{identityNamespace:'CANONICAL_REPLAY_PLAYER_ID',gameScope:provenance,playerIds:[1,2]},
    sharedEpisodeDelivery:{version:NATIVE_DELIVERY,producerGroups:{skirmishes:[],battles:[],reinforcements:[],defensiveAssists:[],cooperativeAttacks:[]},
      playerRefs:players.map(p=>({playerId:p.playerId,replaySlot:p.playerId,groups})),sharedEvidence:{}}};
  const worker={contract:NATIVE_PACKAGE,state:'VERIFIED_UNPUBLISHED',originalRecordingRetentionRequired:true,
    sourceHash,sourceBytes:original.length,sourcePlayers:players.map(p=>({replaySlot:p.playerId,sourceName:p.name})),matchFacts,
    recordedEvents:events,statistics:{...artifact(Buffer.from(JSON.stringify(raw)),'json'),projectionDeliveryVersion:NATIVE_DELIVERY}};
  return {original,worker,raw,records};
}
test('native integrity preserves native provenance and refuses arbitrary version/identity/hash claims',async()=>{
  const {original,worker}=fixture();const result=await verifyNativePackage(worker,original);
  assert.equal(result.sourceHash,digest(original));assert.equal(result.raw.source.canonicalManifestSha256,undefined);
  for(const mutate of [w=>{w.contract='unknown';},w=>{w.originalRecordingRetentionRequired=false;},
    w=>{w.sourceHash='0'.repeat(64);},w=>{w.recordedEvents.sha256='0'.repeat(64);},
    w=>{w.recordedEvents.uncompressedSha256='0'.repeat(64);},w=>{w.statistics.projectionDeliveryVersion='full-json';},
    w=>{w.statistics.uncompressedBytes++;},w=>{w.sourcePlayers[0].replaySlot=2;},w=>{w.matchFacts.source.extractionRunId='changed';}]){
    const next=structuredClone(worker);mutate(next);await assert.rejects(verifyNativePackage(next,original));
  }
});
test('event byte verification rejects missing/trailing records and chronology with recomputed transport hashes',async()=>{
  for(const mutate of [rows=>rows.pop(),rows=>rows.push(['sync',1,1,'complete',[]]),
    rows=>{rows[1][1]=2;},rows=>{rows[2][1].observedUntilMs=999;},rows=>{rows[0][1].schemaVersion='2';}]){
    const {original,worker,records}=fixture();mutate(records);
    worker.recordedEvents={...artifact(Buffer.from(records.map(r=>JSON.stringify(r)+'\n').join('')),'jsonl'),datasetVersion:'AOF_RECORDED_EVENTS_V1'};
    await assert.rejects(verifyNativePackage(worker,original));
  }
});
test('strict compressed transport rejects invalid base64 and oversized or unsupported metadata',()=>{
  const a=fixture().worker.statistics;
  for(const change of [{base64:'%%%bad'},{format:'jsonl'},{compression:'none'},{bytes:49*1024*1024},{uncompressedBytes:513*1024*1024}])
    assert.throws(()=>artifactBytes({...a,...change},'json'));
});
test('replay slots cannot become league identities or duplicate a binding',()=>{
  const source=[{replaySlot:1,sourceName:'A'},{replaySlot:2,sourceName:'B'}],roster=[{playerId:'league-a'},{playerId:'league-b'}];
  const mapping=source.map((p,i)=>({...p,playerId:roster[i].playerId}));verifyMapping(mapping,source,roster);
  for(const value of [mapping.map(p=>({...p,playerId:String(p.replaySlot)})),[mapping[0],mapping[0]],
    [{...mapping[0],sourceName:'wrong'},mapping[1]],mapping.slice(1)])assert.throws(()=>verifyMapping(value,source,roster));
});
test('create-only storage retries read the pinned generation; corruption never deletes or overwrites',async()=>{
  let stored=null,generation='1',saves=0;const readGenerations=[];
  const bucket={file:(path,options)=>({
    save:async(bytes,settings)=>{assert.equal(settings.preconditionOpts.ifGenerationMatch,0);saves++;
      if(stored)throw Object.assign(new Error('exists'),{code:412});stored=Buffer.from(bytes);},
    getMetadata:async()=>[{generation}],download:async()=>{readGenerations.push(options.generation);return [stored];},
    delete:()=>assert.fail('Never delete evidence'),
  })};
  const bytes=Buffer.from('immutable');const first=await saveNativeArtifact(bucket,'a',bytes,'application/octet-stream');
  assert.deepEqual(await saveNativeArtifact(bucket,'a',bytes,'application/octet-stream'),first);
  assert.equal(saves,2);assert.deepEqual(readGenerations,['1','1']);
  stored=Buffer.from('corrupt');await assert.rejects(saveNativeArtifact(bucket,'a',bytes,'application/octet-stream'));
  assert.equal(stored.toString(),'corrupt');
  generation='missing';await assert.rejects(saveNativeArtifact(bucket,'a',bytes,'application/octet-stream'));
});
