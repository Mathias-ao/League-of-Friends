import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';

/**
 * Bounded native Battle-detail delivery. This is an opt-in inspection adapter,
 * not the expanded legacy statistics contract and not an authoritative source.
 * Each request verifies the immutable native artifact; no request hydrates all
 * player episodes or combines the 400+ MB legacy statistics document.
 */
export const NATIVE_DETAIL_VERSION = 'AOF_NATIVE_BATTLE_DETAIL_V1';
const DELIVERY = 'AOF_DIRECT_SHARED_EPISODES_V1_EXPERIMENTAL';
const MAX_STORED = 48 * 1024 * 1024;
const MAX_PLAIN = 64 * 1024 * 1024;
const FRAGMENT_BYTES = 32 * 1024;
const MAX_PAGE_SIZE = 50;
const SHA = /^[0-9a-f]{64}$/;
const REF = /^([A-Za-z]+)\/(0|[1-9][0-9]*)$/;
const PRODUCER_GROUPS = new Set([
  'skirmishes','battles','reinforcements','defensiveAssists','cooperativeAttacks',
]);
const PLAYER_GROUPS = new Set([
  'skirmishes','battles','greatBattles',
  'allyReinforcementsSent','allyReinforcementsReceived',
  'defensiveAssistsGiven','defensiveAssistsReceived','cooperativeAttacks',
]);
const SHARED_FIELDS = new Set([
  'sourceEventIds','parentSourceEventIds','directedInteractionEdges',
  'opponentInteractionPairs','contributionSourceEventIdsByPlayer',
  'unitClassEvidenceByPlayer',
]);
type Bag = Record<string,any>;
const object = (v:unknown):Bag|null =>
  v!==null && typeof v==='object' && !Array.isArray(v) ? v as Bag : null;
const digest = (v:Buffer):string => createHash('sha256').update(v).digest('hex');
function requireDetail(condition:unknown,message:string):asserts condition {
  if(!condition)throw new Error(message);
}
const safeInteger = (v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>=0;

export interface NativeDetailBinding {
  sourceHash:string;
  eventsSha256:string;
  extractionRunId:string;
}
export interface NativeDetailArtifact {
  format:string;
  compression:string;
  bytes:number;
  sha256:string;
  uncompressedBytes:number;
  uncompressedSha256:string;
}
export interface NativeDetailRequest {
  mode:'list'|'fragment';
  replaySlot:number;
  group:string;
  offset?:number;
  pageSize?:number;
  reference?:string;
  field?:string;
  expectedArtifactSha256?:string;
}

/** Verify both compressed and decoded hashes, lengths and source revisions. */
export function decodeNativeDetailArtifact(
  bytes:Buffer,meta:NativeDetailArtifact,binding:NativeDetailBinding,
):Bag {
  requireDetail(meta?.format==='json'&&meta.compression==='gzip'&&
    SHA.test(meta.sha256)&&SHA.test(meta.uncompressedSha256)&&
    safeInteger(meta.bytes)&&meta.bytes>0&&meta.bytes<=MAX_STORED&&
    safeInteger(meta.uncompressedBytes)&&meta.uncompressedBytes>0&&meta.uncompressedBytes<=MAX_PLAIN,
  'Unsupported or oversized native detail artifact.');
  requireDetail(bytes.length===meta.bytes&&digest(bytes)===meta.sha256,
    'Native detail stored-byte integrity mismatch.');
  const plain=gunzipSync(bytes,{maxOutputLength:meta.uncompressedBytes});
  requireDetail(plain.length===meta.uncompressedBytes&&digest(plain)===meta.uncompressedSha256,
    'Native detail decoded-byte integrity mismatch.');
  const raw=object(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(plain)));
  const source=object(raw?.source),facts=object(raw?.matchFacts?.source);
  const ledger=object(raw?.pairSocialEvidence?.gameScope);
  const match=(v:Bag|null):boolean=>!!v&&v.replaySha256===binding.sourceHash&&
    v.recordedEventsSha256===binding.eventsSha256&&
    v.recordedEventsVersion==='AOF_RECORDED_EVENTS_V1'&&
    typeof v.parserVersion==='string'&&v.parserVersion.length>0&&
    !Object.hasOwn(v,'canonicalManifestSha256');
  requireDetail(!!raw&&raw.statisticsSchemaVersion==='1.2.0'&&
    raw.statisticsProjectionVersion==='AOF_RECORDED_EVENTS_STATISTICS_V1'&&
    match(source)&&match(facts)&&match(ledger)&&
    facts!.parserVersion===source!.parserVersion&&ledger!.parserVersion===source!.parserVersion&&
    source!.extractionRunId===binding.extractionRunId&&
    facts!.extractionRunId===binding.extractionRunId&&
    raw.sharedEpisodeDelivery?.version===DELIVERY,
  'Native detail revision or format does not match the validated candidate.');
  return raw!;
}

function detailLayer(raw:unknown) {
  const doc=object(raw),layer=object(doc?.sharedEpisodeDelivery);
  const registry=object(layer?.producerGroups),shared=object(layer?.sharedEvidence);
  requireDetail(!!doc&&!!layer&&layer.version===DELIVERY&&
    layer.sourceMode==='producer_unique_episodes'&&
    !!registry&&!!shared&&
    Object.keys(registry).length===PRODUCER_GROUPS.size&&
    [...PRODUCER_GROUPS].every(name=>Array.isArray(registry[name]))&&
    Array.isArray(layer.playerRefs)&&Array.isArray(doc.participants)&&
    layer.playerRefs.length===doc.participants.length,
  'Malformed native episode registry.');
  // Bind *all* native player references before selecting a single requested slot.
  const slots=new Set<number>();
  for(let i=0;i<layer.playerRefs.length;i++){
    const row=object(layer.playerRefs[i]),participant=object(doc.participants[i]);
    requireDetail(!!row&&!!participant&&safeInteger(row.replaySlot)&&
      row.replaySlot>0&&row.replaySlot===participant.replaySlot&&
      row.playerId===participant.playerId&&!slots.has(row.replaySlot)&&
      !!object(row.groups)&&[...PLAYER_GROUPS].every(name=>Array.isArray(row.groups[name])),
    'Native detail player binding mismatch.');
    slots.add(row.replaySlot);
  }
  return {layer,registry:registry!,shared:shared!,slots};
}

function resolveEpisode(registry:Bag,reference:unknown) {
  requireDetail(typeof reference==='string', 'Invalid native episode reference.');
  const match=REF.exec(reference);
  requireDetail(!!match&&PRODUCER_GROUPS.has(match[1]),'Unsupported native episode reference.');
  const index=Number(match[2]),rows=registry[match[1]] as unknown[];
  requireDetail(safeInteger(index)&&index<rows.length,'Missing native episode reference.');
  const stored=object(rows[index]),body=object(stored?.body),shared=stored?.shared===undefined?{}:object(stored.shared);
  requireDetail(!!stored&&!!body&&!!shared,'Malformed native episode body.');
  requireDetail(Object.keys(shared!).every(key=>SHARED_FIELDS.has(key)&&
    !Object.hasOwn(body!,key)&&SHA.test(shared![key])),
  'Invalid native shared-field reference.');
  return {body:body!,fields:shared!,reference};
}

function shortHeader(body:Bag):Bag {
  const id=['battleId','skirmishId','episodeId','reinforcementId','assistId','cooperationId']
    .map(k=>body[k]).find(v=>typeof v==='string'&&v.length<=128)??null;
  const start=safeInteger(body.startedAtMs)?body.startedAtMs:null;
  const end=safeInteger(body.endedAtMs)?body.endedAtMs:null;
  return {id,startedAtMs:start,endedAtMs:end};
}

/** List only references/short headers or return one 32-KiB UTF-8 JSON fragment.
 * Fragment bytes are Base64: clients concatenate decoded chunks, then verify
 * contentSha256 and parse the final JSON. Shared field hashes are Python
 * canonical-JSON fingerprints and are NOT relabeled as Node JSON hashes.
 */
export function selectNativeBattleDetail(
  raw:unknown,artifactSha256:string,input:NativeDetailRequest,
):Bag {
  requireDetail(SHA.test(artifactSha256),'Missing native artifact revision.');
  requireDetail(input&&PLAYER_GROUPS.has(input.group)&&safeInteger(input.replaySlot)&&input.replaySlot>0,
    'Unsupported player episode group or replay slot.');
  const offset=input.offset??0;
  requireDetail(safeInteger(offset),'Invalid native detail cursor.');
  requireDetail(input.expectedArtifactSha256===undefined||
    input.expectedArtifactSha256===artifactSha256,'Native detail cursor points to another artifact.');
  requireDetail(offset===0||input.expectedArtifactSha256===artifactSha256,
    'A nonzero cursor must bind the immutable artifact revision.');
  const {layer,registry,shared}=detailLayer(raw);
  const row=(layer.playerRefs as Bag[]).find(p=>p.replaySlot===input.replaySlot);
  requireDetail(!!row,'Unknown native replay slot.');
  const references=row.groups[input.group] as unknown[];
  requireDetail(Array.isArray(references),'Native player episode group missing.');
  if(input.mode==='list'){
    const pageSize=input.pageSize??20;
    requireDetail(safeInteger(pageSize)&&pageSize>=1&&pageSize<=MAX_PAGE_SIZE&&offset<=references.length,
      'Native detail page is outside bounds.');
    const entries=references.slice(offset,offset+pageSize).map(ref=>{
      const episode=resolveEpisode(registry,ref);
      return {reference:episode.reference,...shortHeader(episode.body)};
    });
    const next=offset+entries.length<references.length?offset+entries.length:null;
    return {version:NATIVE_DETAIL_VERSION,mode:'list',artifactSha256,replaySlot:input.replaySlot,
      group:input.group,total:references.length,offset,entries,nextOffset:next};
  }
  requireDetail(input.mode==='fragment'&&typeof input.reference==='string'&&
    references.includes(input.reference),'Episode is not assigned to this player/group.');
  const episode=resolveEpisode(registry,input.reference);
  const field=input.field??'body';
  requireDetail(field==='body'||SHARED_FIELDS.has(field),'Unsupported native detail field.');
  let content:unknown,producerSharedSha256:string|null=null;
  if(field==='body')content=episode.body;
  else {
    const hash=episode.fields[field];
    requireDetail(typeof hash==='string'&&SHA.test(hash)&&Object.hasOwn(shared,hash),
      'Episode does not contain that referenced shared field.');
    content=shared[hash];
    producerSharedSha256=hash;
  }
  const serialized=JSON.stringify(content);
  requireDetail(typeof serialized==='string','Invalid native detail JSON value.');
  const buffer=Buffer.from(serialized,'utf8');
  requireDetail(offset<=buffer.length,'Native detail fragment offset is outside bounds.');
  const end=Math.min(offset+FRAGMENT_BYTES,buffer.length);
  const bytes=buffer.subarray(offset,end);
  return {version:NATIVE_DETAIL_VERSION,mode:'fragment',artifactSha256,
    replaySlot:input.replaySlot,group:input.group,reference:episode.reference,field,
    producerSharedSha256,contentSha256:digest(buffer),totalBytes:buffer.length,
    offset,chunkBase64:bytes.toString('base64'),nextOffset:end<buffer.length?end:null,
    complete:end===buffer.length};
}
