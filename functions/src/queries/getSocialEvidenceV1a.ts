import {getStorage} from 'firebase-admin/storage';
import {HttpsError,onCall} from 'firebase-functions/v2/https';
import {requireLeaguePlayer} from '../auth/authorization.js';
import {db} from '../config/firebase.js';
import {callableOptions} from '../config/runtime.js';
import {bindingDigest} from '../engines/nativeRecordingIntegration.js';
import {currentOfficialGameOutcome} from '../engines/recordingMatchFacts.js';
import {loadActiveNativeEvidence} from './activeNativeEvidenceRead.js';
import {decodeReplayStatistics} from '../services/replayStatisticsStorage.js';
import {callVerifiedWorker} from '../services/nativeRecordingValidation.js';

const VERSION='AOF_SOCIAL_EVIDENCE_V1A';
const validId=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,200}$/.test(v);
const fail=(reason:string)=>new HttpsError('failed-precondition',reason);
const stale=()=>new HttpsError('aborted','Social evidence authority changed. Restart this Game read.');
type Bag=Record<string,any>;
export interface SocialEvidenceRequest {matchId:string;gameId:string;cursor?:{authorityRevision:string;offset:number}}

/** Event membership is independent of points, scoring slots and guest enrollment.
 * Replacement commands retain old list entries, so membership alone is insufficient. */
function eventBattleEligibility(matchId:string,match:Bag,event:Bag,season:Bag){
  const lists=[event.officialMatchIds,event.warmupMatchIds];
  if(lists.every(list=>list===undefined)||lists.some(list=>list!==undefined&&
     (!Array.isArray(list)||list.some(id=>!validId(id))||new Set(list).size!==list.length)))
    return {status:'INELIGIBLE',reasonCodes:['EVENT_BATTLE_MEMBERSHIP_UNAVAILABLE']};
  const memberships=lists.filter(list=>list?.includes(matchId)).length;
  if(memberships===0)return {status:'INELIGIBLE',reasonCodes:['MATCH_NOT_IN_EVENT']};
  if(memberships!==1)return {status:'INELIGIBLE',reasonCodes:['AMBIGUOUS_EVENT_BATTLE_MEMBERSHIP']};
  if(match.replacementMatchId!=null)return {status:'INELIGIBLE',reasonCodes:['REPLACED_EVENT_BATTLE']};
  if(!['READY','ACTIVE','AWAITING_CONFIRMATION','COMPLETED'].includes(match.status)||
     !['PUBLISHED','ACTIVE','COMPLETED','POSTPONED'].includes(event.status)||
     !['UPCOMING','ACTIVE','COMPLETED','ARCHIVED'].includes(season.status))
    return {status:'INELIGIBLE',reasonCodes:['EVENT_BATTLE_NOT_ELIGIBLE']};
  return {status:'ELIGIBLE',reasonCodes:[]};
}

/** On-demand read only. No publication, persistence, judgments or progression.
 * The final transaction is the response's linearization point, including Event,
 * roster and membership; no collection scan/date-sort manufactures history.
 */
export async function readSocialEvidenceV1a(input:{db:any;bucket:any;actor:{playerId:string;authUid:string};
  request:SocialEvidenceRequest;env:NodeJS.ProcessEnv;derive?:(payload:Bag)=>Promise<Bag>}){
  const {db,bucket,actor,request:r,env}=input;
  if(env.AOF_SOCIAL_EVIDENCE_V1A_READS!=='1')throw fail('Social evidence read is disabled.');
  if(!r||!validId(r.matchId)||!validId(r.gameId)||Object.keys(r).some(k=>!['matchId','gameId','cursor'].includes(k)))
    throw new HttpsError('invalid-argument','Only Game identifiers and a revision cursor are accepted.');
  if(r.cursor&&(!/^[a-f0-9]{64}$/.test(r.cursor.authorityRevision)||!Number.isSafeInteger(r.cursor.offset)||r.cursor.offset<0))
    throw new HttpsError('invalid-argument','Invalid evidence cursor.');
  const mr=db.doc('matches/'+r.matchId),gr=mr.collection('games').doc(r.gameId);
  const snapshot=async(tx:any)=>{
    const refs=[mr,gr,db.doc('players/'+actor.playerId),db.doc('authLinks/'+actor.authUid)];
    const docs=await Promise.all(refs.map(ref=>tx.get(ref)));
    const [m,g,p,l]=docs.map(s=>s.data());
    if(p?.membershipStatus!=='ACTIVE'||l?.playerId!==actor.playerId)
      throw new HttpsError('permission-denied','Active authenticated league membership is required.');
    if(!m||!g)throw fail('Game unavailable.');
    const roster=(g.players??[]).map((p:Bag)=>p.playerId);
    if(roster.length<2||roster.length>8||new Set(roster).size!==roster.length||roster.some((id:any)=>!validId(id)||
       !(m.participants??[]).some((p:Bag)=>p.playerId===id)))throw fail('Ambiguous Game/Match roster.');
    const extra=roster.map((id:string)=>db.doc('players/'+id));
    for(const [collection,id] of [['events',m.eventId],['seasons',m.seasonId]]){
      if(!validId(id??''))throw fail('Event/Season authority unavailable.');
      extra.push(db.doc(collection+'/'+id));
    }
    if(g.activeReplayStatisticsId){
      if(!/^[a-f0-9]{64}$/.test(g.activeReplayStatisticsId))throw fail('Invalid source identity.');
      extra.push(gr.collection('replaySources').doc(g.activeReplayStatisticsId));
    }
    const additional=await Promise.all(extra.map((ref:any)=>tx.get(ref)));
    if(additional.slice(0,roster.length+2).some((s:any)=>!s.exists))throw fail('Roster/Event/Season authority missing.');
    const event=additional[roster.length].data(),season=additional[roster.length+1].data();
    if(event.seasonId!==m.seasonId)throw fail('Event/Season attribution mismatch.');
    const source=g.activeReplayStatisticsId?additional.at(-1)?.data():null;
    if(source?.nativePublicationVersion&&source.matchFacts?.game?.guid){
      const claim=await tx.get(db.doc('recordingGameClaims/'+Buffer.from(source.matchFacts.game.guid).toString('hex')));
      additional.push(claim);
      if(claim.data()?.matchId!==r.matchId||claim.data()?.gameId!==r.gameId||claim.data()?.sourceHash!==g.activeReplayStatisticsId)
        throw fail('Current native GUID claim unavailable.');
    }
    const token=bindingDigest([...docs,...additional].map(s=>({path:s.ref.path,data:s.data()??null})));
    return {m,g,event,season,source,roster,token};
  };
  const initial=await db.runTransaction(snapshot);
  const {m,g,event,source,roster}=initial;
  if(r.cursor&&r.cursor.authorityRevision!==initial.token)throw stale();
  const official=currentOfficialGameOutcome(g,m);
  const reasons:string[]=[];
  // m.eventId selects this Event document and its lists must reciprocally name
  // this Match; snapshot() also verifies the Event and Match share a Season.
  const eligibility=eventBattleEligibility(r.matchId,m,event,initial.season);
  reasons.push(...eligibility.reasonCodes);
  if(m.opponentKind==='AI'||g.aiOpponent)reasons.push('AI_EXCLUDED');
  if(m.activeResultDisputeId||g.activeResultDisputeId||m.status==='DISPUTED'||g.status==='DISPUTED')reasons.push('DISPUTED_AUTHORITY');
  if(['CANCELLED','VOID','PROPOSED'].includes(m.status)||['CANCELLED','VOID','REMAKE','NO_CONTEST'].includes(g.status)||
     ['CANCELLED','VOID'].includes(event.status)||['CANCELLED','VOID'].includes(initial.season.status))reasons.push('WITHDRAWN_AUTHORITY');
  if(!source||source.state!=='READY'||g.replayStatisticsState!=='READY')reasons.push('NO_CURRENT_READY_SOURCE');
  const fence=async()=>{await db.runTransaction(async(tx:any)=>{
    if((await snapshot(tx)).token!==initial.token)throw stale();
  });};
  const history={battleId:r.matchId,gameId:r.gameId,eventId:m.eventId,seasonId:m.seasonId,
    gameNumber:g.gameNumber??null,officialOutcome:official,
    factualHistoryEligible:false,
    socialCreditRequired:false,crossBattleOrder:null};
  if(reasons.length){await fence();return {version:VERSION,authorityRevision:initial.token,
    state:'CURRENT_EVIDENCE_UNAVAILABLE',reasonCodes:reasons,history,deeds:[],nextCursor:null};}
  if(source.sourceHash!==g.activeReplayStatisticsId||source.matchId!==r.matchId||source.gameId!==r.gameId||
     source.replayStatisticsRevision!==g.replayStatisticsRevision||!Number.isSafeInteger(g.replayStatisticsRevision)||g.replayStatisticsRevision<1)
    throw fail('Source publication revision mismatch.');
  const mapping=source.playerMapping;
  if(!Array.isArray(mapping)||mapping.length!==roster.length||new Set(mapping.map(p=>p.playerId)).size!==roster.length||
     new Set(mapping.map(p=>p.replaySlot)).size!==roster.length||mapping.some(p=>!roster.includes(p.playerId)||!Number.isSafeInteger(p.replaySlot)))
    throw fail('Ambiguous recording participant mapping.');
  let raw:Bag;
  const native=source.nativePublicationVersion!==undefined||source.recordedEvents!==undefined;
  if(native){
    const loaded=await loadActiveNativeEvidence({db,bucket,actor,matchId:r.matchId,gameId:r.gameId,env,allowPending:true});
    if(loaded.sourceId!==g.activeReplayStatisticsId||bindingDigest(loaded.source)!==bindingDigest(source))throw stale();
    raw=loaded.statistics;
  }else{
    const meta=source.statistics;
    if(!meta?.path||!Number.isSafeInteger(meta.bytes)||meta.bytes<1||meta.bytes>48*1024*1024)throw fail('Legacy artifact metadata unavailable.');
    try{const [bytes]=await bucket.file(meta.path,meta.generation?{generation:String(meta.generation)}:undefined).download();
      raw=decodeReplayStatistics(bytes,meta) as Bag;
    }catch{throw new HttpsError('data-loss','Legacy statistics integrity verification failed.');}
  }
  if(raw.source?.replaySha256!==source.sourceHash||bindingDigest(raw.matchFacts)!==bindingDigest(source.matchFacts)||
     !Array.isArray(raw.participants)||raw.participants.length!==mapping.length||
     new Set(raw.participants.map((p:Bag)=>p.playerId)).size!==mapping.length||
     raw.participants.some((p:Bag)=>!mapping.some(m=>m.replaySlot===p.playerId))||
     (!native&&raw.source?.extractionRunId!==source.canonical?.extractionRunId))throw fail('Published source provenance/roster mismatch.');
  // Scheduled metadata is not historical gameplay. Only the verified active
  // artifact establishes facts; an official winner is a separate qualification.
  history.factualHistoryEligible=true;
  // Send only retained social evidence, not the huge canonical statistical payload.
  const statistics={statisticsProjectionVersion:raw.statisticsProjectionVersion,source:raw.source,
    matchFacts:raw.matchFacts,pairSocialEvidence:raw.pairSocialEvidence,
    participants:raw.participants.map((p:Bag)=>({playerId:p.playerId}))};
  const leagueContext={matchId:r.matchId,battleId:r.matchId,gameId:r.gameId,eventId:m.eventId,seasonId:m.seasonId,
    chapterRevision:g.replayStatisticsRevision,resultRevision:official.resultRevision,
    officialOutcomeQualification:official.qualification,gameNumber:g.gameNumber,battleOrder:null,
    playerMappingRevision:bindingDigest(mapping),eventBattleEligibility:eligibility.status,
    eventEligibilitySourceRef:'events/'+m.eventId+';matches/'+r.matchId,
    playerMapping:mapping.map(p=>({replayPlayerId:p.replaySlot,leaguePlayerId:p.playerId}))};
  const payload={statistics,leagueContext,offset:r.cursor?.offset??0};
  if(Buffer.byteLength(JSON.stringify(payload))>32*1024*1024)throw fail('Social evidence exceeds read budget.');
  const projected=await (input.derive??(p=>callVerifiedWorker(env.REPLAY_WORKER_URL??'','/social-evidence-v1a',p)))(payload);
  if(projected.version!==VERSION||projected.trust?.qualifiedSocialProgression!==false||
     !Array.isArray(projected.deeds)||projected.deeds.length>20||Buffer.byteLength(JSON.stringify(projected))>1024*1024)
    throw fail('Unsupported social evidence DTO.');
  await fence();
  return {...projected,authorityRevision:initial.token,state:'CURRENT_SOURCE_FACTS',
    provenance:{sourceHash:source.sourceHash,statisticsSha256:source.statistics.sha256,
      statisticsRevision:g.replayStatisticsRevision,mappingRevision:leagueContext.playerMappingRevision,
      resultRevision:official.resultRevision,eventRevision:bindingDigest(event),sourceScope:'ACTIVE_ONLY'},
    trust:{...projected.trust,leagueAuthority:'AUTHENTICATED_CURRENT_SNAPSHOT'},
    history:{...projected.history,...history},nextOffset:undefined,
    nextCursor:projected.nextOffset===null?null:{authorityRevision:initial.token,offset:projected.nextOffset}};
}

export const getSocialEvidenceV1a=onCall<SocialEvidenceRequest>({...callableOptions,timeoutSeconds:120,memory:'1GiB',
  secrets:['REPLAY_WORKER_AUTH_TOKEN']},async request=>{
  const actor=await requireLeaguePlayer(request);
  const project=process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT;
  return readSocialEvidenceV1a({db,bucket:getStorage().bucket(process.env.REPLAY_BUCKET||project+'.appspot.com'),
    actor,request:request.data,env:process.env});
});
