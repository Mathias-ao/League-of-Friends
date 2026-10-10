import {createHash} from 'node:crypto';
import {Readable} from 'node:stream';
import {createGunzip,gunzipSync} from 'node:zlib';
import {nativeStatisticsExperienceInput} from './nativeStatisticsReadAdapter.js';
import {validateRecordingMatchFacts} from './recordingMatchFacts.js';

export const NATIVE_PACKAGE = 'AOF_NATIVE_REPLAY_PACKAGE_V1_EXPERIMENTAL';
export const NATIVE_DELIVERY = 'AOF_DIRECT_SHARED_EPISODES_V1_EXPERIMENTAL';
export const NATIVE_VALIDATION = 'AOF_NATIVE_RECORDING_VALIDATION_V1';
export const READY_BLOCKERS = ['NATIVE_DETAIL_DELIVERY_NOT_QUALIFIED',
  'NATIVE_SOCIAL_READER_NOT_QUALIFIED','NATIVE_RESULT_CORRECTION_NOT_QUALIFIED'];
type Bag = Record<string,any>;
const SHA=/^[a-f0-9]{64}$/;
export const digest=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex');
export const stable=(v:any):any=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'
  ?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
export const bindingDigest=(v:unknown)=>digest(JSON.stringify(stable(v)));
const requireValue=(condition:unknown,message:string):void=>{if(!condition)throw new Error(message);};

/** Explicit request opt-in, operator flag, project boundary and Game allowlist.
 * Never select this route merely because the worker supports it. */
export function assertNativeValidationAllowed(env:NodeJS.ProcessEnv,role:string,matchId:string,gameId:string):string {
  const project=env.GCLOUD_PROJECT||env.GOOGLE_CLOUD_PROJECT;
  requireValue(env.AOF_NATIVE_REPLAY_INTEGRATION==='validate-v1','Native validation is disabled.');
  requireValue(role==='ADMIN','Native validation requires an administrator.');
  requireValue(project===env.AOF_NATIVE_REPLAY_PROJECT&&
    (project==='age-of-friends-staging'||!!env.FUNCTIONS_EMULATOR&&project?.startsWith('demo-')),
  'Native validation is restricted to explicitly configured staging or demo emulators.');
  requireValue((env.AOF_NATIVE_REPLAY_GAME_ALLOWLIST??'').split(',').map(s=>s.trim()).includes(matchId+'/'+gameId),
    'Game is not allowlisted for native validation.');
  requireValue(!!env.REPLAY_WORKER_AUTH_TOKEN,'Native worker authentication is required.');
  requireValue(SHA.test(env.AOF_NATIVE_REPLAY_PROCESSOR_REVISION??''),'Pin the experimental processor revision.');
  return env.AOF_NATIVE_REPLAY_PROCESSOR_REVISION!;
}

export function artifactBytes(value:Bag,format:string):Buffer {
  requireValue(value&&value.format===format&&value.compression==='gzip'&&SHA.test(value.sha256)&&
    SHA.test(value.uncompressedSha256)&&Number.isSafeInteger(value.bytes)&&value.bytes>0&&value.bytes<=48*1024*1024&&
    Number.isSafeInteger(value.uncompressedBytes)&&value.uncompressedBytes>0&&value.uncompressedBytes<=512*1024*1024,
  'Invalid native artifact metadata.');
  requireValue(typeof value.base64==='string'&&value.base64.length<=64*1024*1024&&
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.base64),
  'Invalid native artifact transport.');
  const bytes=Buffer.from(value.base64,'base64');
  requireValue(bytes.length===value.bytes&&digest(bytes)===value.sha256,'Native artifact integrity mismatch.');
  return bytes;
}

/** Recheck byte integrity and chronology while streaming; do not expand the event history.
 * The authenticated worker remains the decoded-observation schema authority. */
async function verifyEvents(bytes:Buffer,metadata:Bag,sourceHash:string,sourceBytes:number) {
  let header:Bag|undefined,footer:Bag|undefined,objects=0,tiles=0,operations=0,clock=0,phase=0,total=0,pending='';
  const hash=createHash('sha256'),decoder=new TextDecoder('utf-8',{fatal:true});
  const counts:Bag={},statuses:Bag={};
  const count=(op:string,status:string)=>{counts[op]=(counts[op]??0)+1;statuses[status]=(statuses[status]??0)+1;};
  const consume=(line:string)=>{
    const row=JSON.parse(line);
    requireValue(Array.isArray(row)&&!footer,'Invalid or trailing event record.');
    if(!header){
      requireValue(row[0]==='header'&&row.length===2,'Missing event header.');header=row[1];
      requireValue(header?.datasetVersion==='AOF_RECORDED_EVENTS_V1'&&header.schemaVersion==='1.0.0'&&
        header.retentionVersion==='AOF_RECORDED_EVENTS_RETENTION_V1'&&header.layer==='decoded_observations',
      'Unsupported recorded event version.');
      requireValue(header!.source?.sha256===sourceHash&&header!.source?.bytes===sourceBytes,'Event source mismatch.');
      requireValue(SHA.test(header!.extraction?.extractorCodeSha256)&&SHA.test(header!.extraction?.decoderCodeSha256)&&
        typeof header!.extraction?.revision==='string','Missing extraction identity.');return;
    }
    const kind=row[0];
    if(kind==='object'){requireValue(phase===0&&row.length===3&&row[1]===objects++,'Object order mismatch.');}
    else if(kind==='tile'){requireValue(phase<=1&&row.length===4&&row[1]===tiles++,'Terrain order mismatch.');phase=1;}
    else if(kind==='sync'){
      requireValue(row.length===5&&row[1]===operations++&&Number.isSafeInteger(row[2])&&row[2]>=0&&
        ['complete','partial'].includes(row[3]),'Sync chronology mismatch.');
      phase=2;clock+=row[2];count('SYNC',row[3]);
    }else if(kind==='event'){
      requireValue(row.length===3&&row[1]===operations++&&Array.isArray(row[2])&&row[2].length===17,'Event order mismatch.');
      const event=row[2];
      if(event[1]==='SYNC')clock+=event[12]?.incrementMs;
      requireValue(Number.isSafeInteger(clock)&&clock>=0&&event[0]===clock&&
        ['ACTION','SYNC','VIEWLOCK','CHAT','POSTGAME','START','SAVE','UNKNOWN'].includes(event[1])&&
        ['complete','partial','failed','unknown_action'].includes(event[13]),'Event clock or qualification mismatch.');
      phase=2;count(event[1],event[13]);
    }else if(kind==='end'){
      requireValue(row.length===2,'Invalid event footer.');footer=row[1];
      requireValue(footer?.operationCount===operations&&footer.initialObjectCount===objects&&footer.tileCount===tiles&&
        footer.observedUntilMs===clock&&['complete','partial'].includes(footer.framing)&&
        bindingDigest(footer.operationCounts)===bindingDigest(counts)&&bindingDigest(footer.decodeStatusCounts)===bindingDigest(statuses),
      'Event completeness mismatch.');
    }else throw new Error('Unknown event record version.');
  };
  for await(const block of Readable.from(bytes).pipe(createGunzip())){
    total+=block.length;requireValue(total<=metadata.uncompressedBytes,'Event expansion exceeds declared size.');hash.update(block);
    pending+=decoder.decode(block,{stream:true});
    let end:number;
    while((end=pending.indexOf('\n'))>=0){requireValue(end<=16*1024*1024,'Event record too large.');consume(pending.slice(0,end));pending=pending.slice(end+1);}
    requireValue(pending.length<=16*1024*1024,'Event record too large.');
  }
  pending+=decoder.decode();
  requireValue(!pending&&header&&footer&&total===metadata.uncompressedBytes&&hash.digest('hex')===metadata.uncompressedSha256,
    'Incomplete or corrupt event stream.');
  return {header:header!,footer:footer!};
}

export function verifyMapping(mapping:any[],sourcePlayers:any[],roster:any[]):void {
  const ids=roster.map(p=>p.playerId),slots=sourcePlayers.map(p=>p.replaySlot);
  requireValue(ids.length===sourcePlayers.length&&ids.length===mapping.length&&new Set(ids).size===ids.length&&
    new Set(slots).size===slots.length&&new Set(mapping.map(m=>m.playerId)).size===ids.length&&
    new Set(mapping.map(m=>m.replaySlot)).size===slots.length&&mapping.every(m=>ids.includes(m.playerId)&&
      sourcePlayers.some(p=>p.replaySlot===m.replaySlot&&p.sourceName===m.sourceName)),
  'Native mapping must uniquely cover the authenticated Game roster.');
}

export async function verifyNativePackage(worker:Bag,original:Buffer){
  const sourceHash=digest(original);
  requireValue(worker?.contract===NATIVE_PACKAGE&&worker.state==='VERIFIED_UNPUBLISHED'&&
    worker.originalRecordingRetentionRequired===true&&worker.sourceHash===sourceHash&&worker.sourceBytes===original.length,
  'Native package contract/source mismatch.');
  requireValue(worker.recordedEvents?.datasetVersion==='AOF_RECORDED_EVENTS_V1'&&
    worker.statistics?.projectionDeliveryVersion===NATIVE_DELIVERY,'Unknown native artifact version.');
  const events=artifactBytes(worker.recordedEvents,'jsonl'),statistics=artifactBytes(worker.statistics,'json');
  requireValue(events.length+statistics.length<=48*1024*1024,'Native transport exceeds limit.');
  const {header,footer}=await verifyEvents(events,worker.recordedEvents,sourceHash,original.length);
  // Compact shared statistics only. Reject unexpectedly huge native JSON before allocation.
  requireValue(worker.statistics.uncompressedBytes<=64*1024*1024,'Native statistics exceeds integration limit.');
  const plain=gunzipSync(statistics,{maxOutputLength:worker.statistics.uncompressedBytes});
  requireValue(plain.length===worker.statistics.uncompressedBytes&&digest(plain)===worker.statistics.uncompressedSha256,
    'Native statistics integrity mismatch.');
  const raw=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(plain));
  requireValue(raw.statisticsSchemaVersion==='1.2.0'&&raw.statisticsProjectionVersion==='AOF_RECORDED_EVENTS_STATISTICS_V1'&&
    raw.sharedEpisodeDelivery?.version===NATIVE_DELIVERY,'Unsupported native statistics contract.');
  const provenance={replaySha256:sourceHash,recordedEventsSha256:worker.recordedEvents.sha256,
    recordedEventsVersion:'AOF_RECORDED_EVENTS_V1',parserVersion:header.extraction.parserVersion};
  for(const source of [raw.source,raw.matchFacts?.source,raw.pairSocialEvidence?.gameScope])
    requireValue(source&&Object.entries(provenance).every(([k,v])=>source[k]===v),'Native provenance mismatch.');
  requireValue(raw.source.extractionRunId===header.extraction.revision&&raw.matchFacts.source.extractionRunId===header.extraction.revision&&
    bindingDigest(worker.matchFacts)===bindingDigest(raw.matchFacts),'Extraction/match facts mismatch.');
  const players=header.context?.participants;
  requireValue(Array.isArray(players)&&players.length>=2&&players.length<=8&&Array.isArray(worker.sourcePlayers)&&
    new Set(players.map((p:Bag)=>p.playerId)).size===players.length&&
    bindingDigest(worker.sourcePlayers)===bindingDigest(players.map((p:Bag)=>({replaySlot:p.playerId,sourceName:p.name})))&&
    Array.isArray(raw.participants)&&raw.participants.length===players.length&&
    raw.participants.every((p:Bag,i:number)=>p.playerId===players[i].playerId&&p.replaySlot===players[i].playerId),
  'Native source player binding mismatch.');
  validateRecordingMatchFacts(raw.matchFacts,{replaySha256:sourceHash,extractionRunId:header.extraction.revision},players.map((p:Bag)=>p.playerId));
  requireValue(raw.pairSocialEvidence.identityNamespace==='CANONICAL_REPLAY_PLAYER_ID'&&
    bindingDigest(raw.pairSocialEvidence.playerIds)===bindingDigest(players.map((p:Bag)=>p.playerId)),
  'Native social evidence identities mismatch.');
  // Resolve every shared reference, including those unused by compact read models.
  const layer=raw.sharedEpisodeDelivery;
  requireValue(layer.sharedEvidence&&typeof layer.sharedEvidence==='object','Missing shared evidence.');
  const allowed=new Set(['sourceEventIds','parentSourceEventIds','directedInteractionEdges','opponentInteractionPairs',
    'contributionSourceEventIdsByPlayer','unitClassEvidenceByPlayer']);
  for(const rows of Object.values(layer.producerGroups??{}) as Bag[][])for(const episode of rows){
    for(const [field,hash] of Object.entries(episode.shared??{}))
      requireValue(allowed.has(field)&&!Object.hasOwn(episode.body,field)&&typeof hash==='string'&&SHA.test(hash)&&
        Object.hasOwn(layer.sharedEvidence,hash),'Missing native shared evidence reference.');
  }
  // Do not re-hash Python canonical JSON with a different JS number serializer.
  // The entire exact-byte shared artifact has already passed dual SHA verification.
  const experienceInput=nativeStatisticsExperienceInput(raw);
  return {events,statistics,raw,experienceInput,sourceHash,sourcePlayers:worker.sourcePlayers as
    Array<{replaySlot:number;sourceName:string}>,extraction:header.extraction,completeness:footer,
    revision:bindingDigest([NATIVE_PACKAGE,worker.recordedEvents.sha256,worker.statistics.sha256])};
}

/** Generation-zero creation plus pinned-generation readback; never delete on mismatch. */
export async function saveNativeArtifact(bucket:any,path:string,bytes:Buffer,contentType:string){
  const sha256=digest(bytes),file=bucket.file(path);
  try{await file.save(bytes,{resumable:false,preconditionOpts:{ifGenerationMatch:0},
    metadata:{contentType,cacheControl:'private, no-store',metadata:{sha256}}});}
  catch(error:any){if(Number(error?.code)!==412)throw error;}
  const [metadata]=await file.getMetadata();
  requireValue(/^\d+$/.test(String(metadata.generation)),'Storage generation missing.');
  const [stored]=await bucket.file(path,{generation:metadata.generation}).download();
  requireValue(stored.length===bytes.length&&digest(stored)===sha256,'Immutable native artifact readback failed.');
  return {path,sha256,bytes:bytes.length,generation:String(metadata.generation)};
}
