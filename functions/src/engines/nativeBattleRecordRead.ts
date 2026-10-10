import {createHash} from 'node:crypto';
import {projectSocialIncidents} from './socialIncidentCore.js';
import {projectRecordingDiplomacyReview} from './recordingDiplomacyReview.js';
import {nativeSocialInput} from './nativeSocialInput.js';

export const NATIVE_BATTLE_RECORD_VERSION='AOF_NATIVE_BATTLE_RECORD_READER_V1';
const SHA=/^[a-f0-9]{64}$/;
const CHUNK=32*1024;
const PAGE=20;
const MAX_HEADER=12*1024;
type Bag=Record<string,any>;
type PageSection='ledgerIncidents'|'ledgerObservations'|'socialIncidents'|'socialDecisions'|'socialDeeds';
type FragmentSection='matchFacts'|'diplomacyReview'|'socialReview'|'ledgerIncident'|'ledgerObservation'|'socialIncident'|'socialDecision'|'socialDeed';
export interface NativeRecordRequest {
  mode:'overview'|'page'|'fragment';
  section?:string;
  offset?:number;
  index?:number;
  expectedArtifactSha256?:string;
  expectedReviewRevision?:string;
}
const indexValid=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>=0;
const hash=(v:Buffer)=>createHash('sha256').update(v).digest('hex');
const rec=(v:unknown):Bag|null=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Bag:null;
const fail=(s:string):never=>{throw new Error(s);};

/** Minimal isolated social projection, never hydrate producer-shared Battle arrays. */
export function projectNativeBattleRecord(raw:unknown,playerMapping:unknown,officialOutcome:unknown,
  gameId:string,battleId:string){
  const statistics=nativeSocialInput(raw,playerMapping);
  const facts=statistics.matchFacts,ledger=statistics.pairSocialEvidence;
  const review=projectSocialIncidents({statistics,playerMapping:playerMapping as unknown[],
    officialOutcome,context:{gameId,battleId}});
  const diplomacy=projectRecordingDiplomacyReview(facts);
  return {statistics,facts,ledger,review,diplomacy,officialOutcome,playerMapping};
}

const pageRows=(data:ReturnType<typeof projectNativeBattleRecord>,section:PageSection):Bag[]=>{
  switch(section){
    case 'ledgerIncidents':return data.ledger.incidents;
    case 'ledgerObservations':return data.ledger.observations;
    case 'socialIncidents':return data.review.status==='REVIEW_AVAILABLE'?data.review.incidents:[];
    case 'socialDecisions':return data.review.status==='REVIEW_AVAILABLE'?data.review.decisions:[];
    case 'socialDeeds':return data.review.status==='REVIEW_AVAILABLE'?data.review.deeds:[];
  }
};
const detailRow=(row:Bag,section:PageSection,index:number):Bag=>{
  const moment=rec(row.startedAt)||rec(row.moment)||rec(row.at);
  const playerPair=Array.isArray(row.pairPlayerIds)?row.pairPlayerIds.slice(0,2):null;
  const label=(value:unknown)=>typeof value==='string'?value.slice(0,160):null;
  return {index,id:label(row.incidentId)??label(row.decisionId)??label(row.deedId)??
    label(row.sourceEventId),
    category:label(row.family)??label(row.kind)??label(row.role)??label(row.status),
    atMs:indexValid(moment?.atMs)?moment!.atMs:null,
    pairPlayerIds:playerPair,
    ...(section==='socialIncidents'?{role:row.role??null}:{}),
    ...(section==='socialDecisions'?{status:row.status??null}:{}),
  };
};

/** Each call selects only the requested read model section or 32-KiB transfer.
 * The returned content hash describes the *transport JSON bytes*, not the
 * Python producer's canonical episode hashes.
 */
export function selectNativeBattleRecord(
  data:ReturnType<typeof projectNativeBattleRecord>,
  artifactSha256:string,sourceId:string,request:NativeRecordRequest,
):Bag{
  if(!SHA.test(artifactSha256)||!SHA.test(sourceId)||!request||
     !['overview','page','fragment'].includes(request.mode))
    return fail('invalid_native_battle_record_request');
  const expected=request.expectedArtifactSha256;
  if(expected!==undefined&&expected!==artifactSha256)fail('stale_native_record_revision');
  const o=data.officialOutcome as Bag;
  // An official-result correction can change social interpretation without
  // changing a single recording byte. Freeze page/fragment navigation to BOTH
  // the immutable artifact and the current official Game + mapping revision.
  const reviewRevision=hash(Buffer.from(JSON.stringify({
    artifactSha256,sourceId,officialOutcome:data.officialOutcome,playerMapping:data.playerMapping,
  }),'utf8'));
  if(request.mode!=='overview'&&request.expectedReviewRevision!==reviewRevision)
    fail('stale_native_social_review_revision');
  const base={version:NATIVE_BATTLE_RECORD_VERSION,delivery:'NATIVE_BOUNDED_V1',
    artifactSha256,reviewRevision,statisticsId:sourceId,mode:request.mode};
  if(request.mode==='overview'){
    const facts=data.facts,review=data.review,ledger=data.ledger;
    const result={...base,
      source:{...data.statistics.source},
      officialOutcome:o,
      matchFacts:{modelVersion:facts.modelVersion,
        observedDurationMs:facts.game?.observedDurationMs??null,
        mapName:facts.map?.mapName??facts.map?.rmsFileName??null,
        mapId:facts.map?.mapId??null,
        rules:{population:facts.rules?.population?.value??null,
          lockTeams:facts.rules?.lockTeams?.value??null,
          speed:facts.rules?.speed?.value??null}},
      social:{status:review.status,
        ...(review.status==='REVIEW_AVAILABLE'?{counters:review.counters,
          neutralObservations:ledger.observations.length,neutralIncidents:ledger.incidents.length,
          socialIncidents:review.incidents.length,decisions:review.decisions.length,
          deeds:review.deeds.length,exposure:review.exposure.length,
          productionScoringEnabled:false}: {reason:review.reason??'native_social_interpretation_unavailable'})},
      diplomacy:{status:data.diplomacy.status,
        ...(data.diplomacy.status==='REVIEW_AVAILABLE'?{
          commandCount:data.diplomacy.commandCount,
          knownPairSegmentCount:data.diplomacy.knownPairSegmentCount,
          unknownPairSegmentCount:data.diplomacy.unknownPairSegmentCount
        }:{reason:data.diplomacy.reason??'diplomacy_unavailable'})},
      sections:['matchFacts','diplomacyReview','socialReview','ledgerIncidents',
        'ledgerObservations','socialIncidents','socialDecisions','socialDeeds'],
    };
    if(Buffer.byteLength(JSON.stringify(result))>MAX_HEADER)fail('native_record_header_too_large');
    return result;
  }
  if(request.mode==='page'){
    if(!['ledgerIncidents','ledgerObservations','socialIncidents','socialDecisions','socialDeeds'].includes(request.section??''))
      fail('unsupported_native_record_page');
    const section=request.section as PageSection,all=pageRows(data,section);
    const offset=request.offset??0;
    if(!indexValid(offset)||offset>all.length||
       offset>0&&expected!==artifactSha256)fail('invalid_native_record_page_cursor');
    const items=all.slice(offset,offset+PAGE).map((r,i)=>detailRow(r,section,offset+i));
    return {...base,section,total:all.length,offset,entries:items,
      nextOffset:offset+items.length<all.length?offset+items.length:null,
      interpretationStatus:data.review.status};
  }
  const section=request.section as FragmentSection;
  if(!['matchFacts','diplomacyReview','socialReview','ledgerIncident','ledgerObservation',
       'socialIncident','socialDecision','socialDeed'].includes(section))
    fail('unsupported_native_record_fragment');
  if(expected!==artifactSha256)fail('native_record_fragment_revision_required');
  const offset=request.offset??0;
  if(!indexValid(offset))fail('invalid_native_record_fragment_offset');
  let value:unknown;
  if(section==='matchFacts')value=data.facts;
  else if(section==='diplomacyReview')value=data.diplomacy;
  else if(section==='socialReview')value=data.review;
  else{
    const counterpart:Record<string,PageSection>={
      ledgerIncident:'ledgerIncidents',ledgerObservation:'ledgerObservations',
      socialIncident:'socialIncidents',socialDecision:'socialDecisions',socialDeed:'socialDeeds'};
    if(!indexValid(request.index))fail('native_record_entry_index_required');
    const index=Number(request.index);
    const rows=pageRows(data,counterpart[section]);
    if(index>=rows.length)fail('native_record_entry_missing');
    value=rows[index];
  }
  const bytes=Buffer.from(JSON.stringify(value),'utf8');
  if(offset>bytes.length)fail('native_record_fragment_offset_outside_bounds');
  const end=Math.min(bytes.length,offset+CHUNK);
  return {...base,section,index:request.index??null,totalBytes:bytes.length,
    contentSha256:hash(bytes),offset,chunkBase64:bytes.subarray(offset,end).toString('base64'),
    nextOffset:end<bytes.length?end:null,complete:end===bytes.length};
}
