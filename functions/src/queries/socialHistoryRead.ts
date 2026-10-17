import {decodeReplayStatistics} from '../services/replayStatisticsStorage.js';
import {getStorage} from 'firebase-admin/storage';
import {HttpsError} from 'firebase-functions/v2/https';
import {db} from '../config/firebase.js';
import {collections} from '../domain/collections.js';
import {projectSocialIncidents,rebuildSocialHistory} from '../engines/socialIncidentCore.js';
import {projectPlayerChronicle} from '../engines/playerChronicleCore.js';
import {currentOfficialGameOutcome} from '../engines/recordingMatchFacts.js';
import {activeNativeStatisticsSource,NATIVE_SHARED_DELIVERY} from '../engines/activeNativeStatisticsSource.js';
import {decodeNativeDetailArtifact,type NativeDetailArtifact} from '../engines/nativeStatisticsDetail.js';
import {nativeSocialInput} from '../engines/nativeSocialInput.js';

// Bounded Firestore query pages, not a 100-Battle lifetime ceiling. All pages
// are re-enumerated after source reads to catch inserted/removed Matches.
const MATCH_PAGE_SIZE=64;
const MATCH_STATES=new Set(['READY','ACTIVE','AWAITING_CONFIRMATION','COMPLETED']);
const EVENT_STATES=new Set(['PUBLISHED','ACTIVE','COMPLETED','POSTPONED']);
const SEASON_STATES=new Set(['UPCOMING','ACTIVE','COMPLETED','ARCHIVED']);
const token=(value:unknown)=>JSON.stringify(value);
const matchToken=(v:any)=>token({status:v?.status,opponentKind:v?.opponentKind,
  eventId:v?.eventId??null,seasonId:v?.seasonId??null,dispute:v?.activeResultDisputeId??null,
  firstCompletedAt:v?.firstCompletedAt??null,completedAt:v?.completedAt??null,
  replacementMatchId:v?.replacementMatchId??null});
const gameToken=(v:any)=>token({status:v?.status,dispute:v?.activeResultDisputeId??null,
  statisticsId:v?.activeReplayStatisticsId??null,statisticsState:v?.replayStatisticsState??null,
  statisticsRevision:v?.replayStatisticsRevision??null,result:v?.canonicalResult??null,
  resultBinding:v?.recordingResultBinding??null,players:v?.players??null,number:v?.gameNumber});
const sourceToken=(v:any)=>token({state:v?.state,sourceHash:v?.sourceHash,mapping:v?.playerMapping,
  matchFacts:v?.matchFacts,statistics:v?.statistics,recordedEvents:v?.recordedEvents,
  originalRecording:v?.originalRecording,extraction:v?.extraction,
  nativePublicationVersion:v?.nativePublicationVersion,ordinaryUploadVersion:v?.ordinaryUploadVersion,
  processorRevision:v?.processorRevision,nativeValidationCandidateId:v?.nativeValidationCandidateId,
  replayStatisticsRevision:v?.replayStatisticsRevision,artifactRevision:v?.artifactRevision,
  experienceVersion:v?.experience?.version,experienceBinding:v?.experience?.bindingKey});
const eventToken=(v:any)=>token({status:v?.status,seasonId:v?.seasonId,
  officialMatchIds:v?.officialMatchIds??null,warmupMatchIds:v?.warmupMatchIds??null});
const seasonToken=(v:any)=>token({status:v?.status});

/** Use document-ID cursors so all Matches (not only COMPLETED) are considered.
 * Reject non-advancing pages instead of silently returning truncated history.
 */
async function allMatchPages(){
  const docs:any[]=[];
  let last:any=null;
  const seen=new Set<string>();
  while(true){
    let query:any=db.collection(collections.matches).orderBy('__name__').limit(MATCH_PAGE_SIZE);
    if(last)query=query.startAfter(last);
    const page=await query.get();
    if(!Array.isArray(page.docs)||page.docs.length>MATCH_PAGE_SIZE)
      throw new HttpsError('data-loss','Invalid Chronicle history page.');
    for(const doc of page.docs){
      if(typeof doc.id!=='string'||seen.has(doc.id)||
         last&&doc.id<=last.id)
        throw new HttpsError('aborted','Chronicle Match cursor did not advance.');
      seen.add(doc.id);
      docs.push(doc);
    }
    if(page.docs.length<MATCH_PAGE_SIZE)break;
    last=page.docs[page.docs.length-1];
  }
  return docs;
}

function matchOrder(value:any):number|null{
  const date=(value?.firstCompletedAt??value?.completedAt)?.toMillis?.();
  return Number.isSafeInteger(date)&&date>=0?date:null;
}
function linkedEventStatus(event:any,season:any,match:any,matchId:string):string|null{
  if(!event||!season||event.seasonId!==match.seasonId||
     !EVENT_STATES.has(event.status)||!SEASON_STATES.has(season.status))
    return 'event_season_eligibility_unverified';
  const official=event.officialMatchIds,warmups=event.warmupMatchIds;
  if((official!==undefined&&!Array.isArray(official))||
     (warmups!==undefined&&!Array.isArray(warmups))||
     (official===undefined&&warmups===undefined))
    return 'event_match_membership_unverified';
  const count=[official,warmups].filter((list:any)=>Array.isArray(list)&&list.includes(matchId)).length;
  if(count!==1||match.replacementMatchId!=null)
    return 'event_match_not_currently_eligible';
  return null;
}

/** An owner-bound read of current verified factual chapters and the existing
 * shadow history. READY gameplay evidence need not await official Game outcome,
 * completed Match, or Event finalization. Shadow contributions are restricted
 * to historically ordered OFFICIAL Games and never published as official state.
 */
export async function readSocialHistory(ownerPlayerId:string){
  const matches=await allMatchPages();
  const checkpoints:any[]=matches.map(doc=>({ref:doc.ref,token:matchToken(doc.data()),type:'MATCH'}));
  const ordered=matches.filter(doc=>doc.data().opponentKind!=='AI'&&MATCH_STATES.has(doc.data().status))
    .map(doc=>({doc,data:doc.data(),at:matchOrder(doc.data())}))
    .sort((a,b)=>{
      // Unknown order must not be represented as an established historical date.
      if(a.at===null)return b.at===null?a.doc.id.localeCompare(b.doc.id):1;
      if(b.at===null)return -1;
      return a.at-b.at||a.doc.id.localeCompare(b.doc.id);
    });
  const project=process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT;
  const bucket=process.env.REPLAY_BUCKET?.trim()||(project?project+'.appspot.com':null);
  if(!bucket)throw new HttpsError('failed-precondition','Replay evidence bucket is not configured.');
  const chapters:any[]=[],excluded:any[]=[],names:Record<string,string>={};
  const duplicateSources=new Set<string>(),duplicateGuids=new Set<string>();
  let order=0,unresolvedOutcomes=0,chronologyPending=0;
  for(const match of ordered){
    const data=match.data;
    let eventBlock:string|null=null;
    if(data.eventId!=null||data.seasonId!=null){
      if(typeof data.eventId!=='string'||typeof data.seasonId!=='string'){
        eventBlock='event_season_eligibility_unverified';
      }else{
        const eventRef=db.collection(collections.events).doc(data.eventId);
        const seasonRef=db.collection(collections.seasons).doc(data.seasonId);
        const [event,season]=await Promise.all([eventRef.get(),seasonRef.get()]);
        checkpoints.push({ref:eventRef,token:eventToken(event.data()),type:'EVENT'},
          {ref:seasonRef,token:seasonToken(season.data()),type:'SEASON'});
        eventBlock=linkedEventStatus(event.data(),season.data(),data,match.doc.id);
      }
    }
    const games=await match.doc.ref.collection('games').get();
    const orderedGames=games.docs.map((doc:any)=>({doc,data:doc.data()}));
    if(orderedGames.some((g:any)=>!Number.isSafeInteger(g.data.gameNumber)||g.data.gameNumber<1)||
       new Set(orderedGames.map((g:any)=>g.data.gameNumber)).size!==orderedGames.length)
      throw new HttpsError('failed-precondition','Game sequence is missing or duplicated; Chronicle cannot assign Game order.');
    orderedGames.sort((a:any,b:any)=>a.data.gameNumber-b.data.gameNumber);
    let admittedInMatch=false;
    for(const game of orderedGames){
      order++;
      checkpoints.push({ref:game.doc.ref,token:gameToken(game.data),type:'GAME'});
      const gameIdentity=match.doc.id+'/'+game.doc.id;
      const sourceId=game.data.activeReplayStatisticsId;
      if(!sourceId){
        // Planned Matches without an uploaded recording do not have historical
        // evidence yet; completed Matches with a missing Game remain incomplete.
        if(data.status==='COMPLETED')excluded.push({gameIdentity,reason:'replay_statistics_missing'});
        continue;
      }
      if(eventBlock){excluded.push({gameIdentity,reason:eventBlock});continue;}
      if(data.activeResultDisputeId||game.data.activeResultDisputeId||
         ['REMAKE','NO_CONTEST','DISPUTED'].includes(game.data.status)){
        excluded.push({gameIdentity,reason:'disputed_or_withdrawn_Game'});continue;
      }
      const sourceRef=game.doc.ref.collection('replaySources').doc(sourceId);
      const revision=await sourceRef.get(),source=revision.data();
      if(source?.state!=='READY'||!source.statistics?.path||!source.statistics?.sha256){
        excluded.push({gameIdentity,reason:'active_artifact_unavailable'});continue;
      }
      checkpoints.push({ref:sourceRef,token:sourceToken(source),type:'SOURCE'});
      const nativeLooking=source.nativePublicationVersion!==undefined||
        source.recordedEvents?.datasetVersion==='AOF_RECORDED_EVENTS_V1'||
        source.statistics?.projectionDeliveryVersion===NATIVE_SHARED_DELIVERY;
      const native=nativeLooking?activeNativeStatisticsSource(match.doc.id,game.doc.id,
        data,game.data,sourceId,source,
        process.env.AOF_ACTIVE_NATIVE_PLAYER_READS==='1'&&
        process.env.AOF_ACTIVE_NATIVE_SOCIAL_READS==='1',true):null;
      if(nativeLooking&&!native){
        excluded.push({gameIdentity,reason:'native_social_history_reader_not_qualified'});continue;
      }
      if(!nativeLooking&&!['READY','AWAITING_CONFIRMATION','COMPLETED'].includes(game.data.status)){
        excluded.push({gameIdentity,reason:'Game_source_not_eligible'});continue;
      }
      // Duplicate Game uploads or POVs cannot manufacture another chapter.
      // Historical legacy IDs are scoped to the active source, not upload time.
      const sourceKey=(source.sourceHash??sourceId);
      const guid=source.matchFacts?.game?.guid;
      if(duplicateSources.has(sourceKey)||typeof guid==='string'&&guid.length>0&&duplicateGuids.has(guid)){
        excluded.push({gameIdentity,reason:'duplicate_recording_evidence'});continue;
      }
      let statistics:any;
      if(native){
        let bytes:Buffer;
        try{
          [bytes]=await getStorage().bucket(bucket).file(native.artifact.path,
            {generation:String(native.artifact.generation)}).download();
          const verified=decodeNativeDetailArtifact(bytes,native.artifact as NativeDetailArtifact,{
            sourceHash:sourceId,eventsSha256:native.eventsSha256,
            extractionRunId:native.extractionRunId,
          });
          statistics=nativeSocialInput(verified,source.playerMapping);
        }catch{
          throw new HttpsError('data-loss','Active native social evidence failed source, integrity or roster validation.');
        }
      }else{
        const [bytes]=await getStorage().bucket(bucket).file(source.statistics.path,
          source.statistics.generation?{generation:String(source.statistics.generation)}:undefined).download();
        try{statistics=decodeReplayStatistics(bytes,source.statistics);}
        catch{throw new HttpsError('data-loss','A social source failed statistics decoding or integrity verification.');}
      }
      const official=currentOfficialGameOutcome(game.data,data);
      const review=projectSocialIncidents({statistics,playerMapping:source.playerMapping??[],
        officialOutcome:official,context:{gameId:gameIdentity,battleId:match.doc.id}});
      if(review.status!=='REVIEW_AVAILABLE'){
        excluded.push({gameIdentity,reason:review.reason});continue;
      }
      // A Game is admitted only after integrity, roster mapping, active source,
      // Game identity and current Event admission are all verified.
      duplicateSources.add(sourceKey);
      if(typeof guid==='string'&&guid.length>0)duplicateGuids.add(guid);
      admittedInMatch=true;
      if(official.qualification!=='OFFICIAL')unresolvedOutcomes++;
      for(const p of review.participants)if(p.leaguePlayerId)names[p.leaguePlayerId]=p.name;
      chapters.push({gameIdentity,battleId:match.doc.id,
        playedAtMs:match.at,eventId:data.eventId??null,seasonId:data.seasonId??null,
        chronologyQualified:match.at!==null,order,revision:official.resultRevision,
        resultStatus:official.qualification==='OFFICIAL'?'OFFICIAL':'UNRESOLVED',
        accepted:true,review});
    }
    if(admittedInMatch&&match.at===null)chronologyPending++;
  }
  // Optimistic revision fence covers the entire Match population, current
  // selected sources, Event/Season admission and correction/dispute state.
  for(let index=0;index<checkpoints.length;index+=50){
    const batch=checkpoints.slice(index,index+50),fresh=await db.getAll(...batch.map(c=>c.ref));
    for(let n=0;n<batch.length;n++){
      const item=batch[n],current=fresh[n]?.data();
      const digest=item.type==='MATCH'?matchToken(current):item.type==='SOURCE'?sourceToken(current):
        item.type==='GAME'?gameToken(current):item.type==='EVENT'?eventToken(current):seasonToken(current);
      if(!fresh[n]?.exists||item.token!==digest)
        throw new HttpsError('aborted','Accepted Chronicle authority changed during the read; retry.');
    }
  }
  const after=await allMatchPages();
  if(after.length!==matches.length||after.some((doc:any,i:number)=>doc.id!==matches[i].id))
    throw new HttpsError('aborted','Chronicle Match population changed during the read; retry.');
  // The legacy shadow evaluator is *not* a factual eligibility gate: pending
  // outcomes and undated Battles stay in the factual Chronicle only.
  const history=rebuildSocialHistory(chapters.filter(ch=>
    ch.resultStatus==='OFFICIAL'&&ch.chronologyQualified));
  const chronicle=projectPlayerChronicle({ownerPlayerId,chapters,history,names});
  return {success:true,
    status:excluded.length||chronologyPending?'PARTIAL':'AVAILABLE',
    history,chronicle,names,excluded,
    coverage:{completedBattles:matches.filter(doc=>doc.data().status==='COMPLETED').length,
      scannedBattles:matches.length,readableAcceptedGames:chapters.length,excludedGames:excluded.length,
      unresolvedOutcomeGames:unresolvedOutcomes,chronologyPendingBattles:chronologyPending,
      stageMeaning:'shadow_stages_from_ordered_official_sources_only',
      opportunityCompleteness:excluded.length===0&&chronologyPending===0}};
}
