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

/** Rebuild the current verified social read model for one Chronicle owner.
 * Pure read path: no social awards, relationship state, or statistics are mutated.
 */
export async function readSocialHistory(ownerPlayerId:string){
  const matches=await db.collection(collections.matches).where('status','==','COMPLETED').limit(101).get();
  if(matches.size>100)throw new HttpsError('resource-exhausted','Social shadow history currently supports 100 completed Battles; no partial stages were returned.');
  const matchToken=(v:any)=>JSON.stringify({status:v?.status,dispute:v?.activeResultDisputeId??null,firstCompletedAt:v?.firstCompletedAt??null,completedAt:v?.completedAt??null});
  const gameToken=(v:any)=>JSON.stringify({status:v?.status,dispute:v?.activeResultDisputeId??null,statisticsId:v?.activeReplayStatisticsId??null,
    result:v?.canonicalResult??null,players:v?.players??null,number:v?.gameNumber});
  const sourceToken=(v:any)=>JSON.stringify({state:v?.state,sourceHash:v?.sourceHash,mapping:v?.playerMapping,
    statistics:v?.statistics,recordedEvents:v?.recordedEvents,originalRecording:v?.originalRecording,
    extraction:v?.extraction,nativePublicationVersion:v?.nativePublicationVersion,
    processorRevision:v?.processorRevision,nativeValidationCandidateId:v?.nativeValidationCandidateId,
    replayStatisticsRevision:v?.replayStatisticsRevision,artifactRevision:v?.artifactRevision,
    experienceVersion:v?.experience?.version,experienceBinding:v?.experience?.bindingKey});
  const checkpoints:any[]=matches.docs.map(doc=>({ref:doc.ref,token:matchToken(doc.data()),type:'MATCH'}));
  const ordered=matches.docs.filter(doc=>doc.data().opponentKind!=='AI').map(doc=>({doc,data:doc.data(),at:(doc.data().firstCompletedAt??doc.data().completedAt)?.toMillis?.()}));
  if(ordered.some(m=>!Number.isSafeInteger(m.at)))throw new HttpsError('failed-precondition','Accepted Battle chronology is missing; social stages cannot be ordered.');
  ordered.sort((a,b)=>a.at-b.at||a.doc.id.localeCompare(b.doc.id));
  const project=process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT;
  const bucket=process.env.REPLAY_BUCKET?.trim()||(project?project+'.appspot.com':null);
  if(!bucket)throw new HttpsError('failed-precondition','Replay evidence bucket is not configured.');
  const chapters:any[]=[],excluded:any[]=[],names:Record<string,string>={};
  let order=0;
  for(const match of ordered){
    const games=await match.doc.ref.collection('games').get();
    const orderedGames=games.docs.map(doc=>({doc,data:doc.data()}));
    if(orderedGames.some(g=>!Number.isSafeInteger(g.data.gameNumber)||g.data.gameNumber<1)||
       new Set(orderedGames.map(g=>g.data.gameNumber)).size!==orderedGames.length)
      throw new HttpsError('failed-precondition','Game sequence is missing or duplicated; social stages cannot be ordered.');
    orderedGames.sort((a,b)=>a.data.gameNumber-b.data.gameNumber);
    for(const game of orderedGames){
      order++;
      checkpoints.push({ref:game.doc.ref,token:gameToken(game.data),type:'GAME'});
      const gameIdentity=match.doc.id+'/'+game.doc.id;
      const official=currentOfficialGameOutcome(game.data,match.data);
      if(official.qualification!=='OFFICIAL'){excluded.push({gameIdentity,reason:'official_result_ineligible'});continue;}
      if(!game.data.activeReplayStatisticsId){excluded.push({gameIdentity,reason:'replay_statistics_missing'});continue;}
      const sourceRef=game.doc.ref.collection('replaySources').doc(game.data.activeReplayStatisticsId);
      const revision=await sourceRef.get(),source=revision.data();
      if(source?.state!=='READY'||!source.statistics?.path||!source.statistics?.sha256){
        excluded.push({gameIdentity,reason:'active_artifact_unavailable'});continue;
      }
      checkpoints.push({ref:sourceRef,token:sourceToken(source),type:'SOURCE'});
      const nativeLooking=source.nativePublicationVersion!==undefined||
        source.recordedEvents?.datasetVersion==='AOF_RECORDED_EVENTS_V1'||
        source.statistics?.projectionDeliveryVersion===NATIVE_SHARED_DELIVERY;
      const native=nativeLooking?activeNativeStatisticsSource(match.doc.id,game.doc.id,
        match.data,game.data,game.data.activeReplayStatisticsId,source,
        process.env.AOF_ACTIVE_NATIVE_PLAYER_READS==='1'&&
        process.env.AOF_ACTIVE_NATIVE_SOCIAL_READS==='1'):null;
      if(nativeLooking&&!native){
        excluded.push({gameIdentity,reason:'native_social_history_reader_not_qualified'});continue;
      }
      let statistics:any;
      if(native){
        let bytes:Buffer;
        try{
          [bytes]=await getStorage().bucket(bucket).file(native.artifact.path,
            {generation:String(native.artifact.generation)}).download();
          const verified=decodeNativeDetailArtifact(bytes,native.artifact as NativeDetailArtifact,{
            sourceHash:game.data.activeReplayStatisticsId,eventsSha256:native.eventsSha256,
            extractionRunId:native.extractionRunId,
          });
          statistics=nativeSocialInput(verified,source.playerMapping);
        }catch{
          throw new HttpsError('data-loss','Active native social evidence failed source, integrity or roster validation.');
        }
      }else{
        const [bytes]=await getStorage().bucket(bucket).file(source.statistics.path).download();
        try{statistics=decodeReplayStatistics(bytes,source.statistics);}
        catch{throw new HttpsError('data-loss','A social source failed statistics decoding or integrity verification.');}
      }
      const review=projectSocialIncidents({statistics,playerMapping:source.playerMapping??[],officialOutcome:official,
        context:{gameId:gameIdentity,battleId:match.doc.id}});
      if(review.status!=='REVIEW_AVAILABLE'){excluded.push({gameIdentity,reason:review.reason});continue;}
      for(const p of review.participants)if(p.leaguePlayerId)names[p.leaguePlayerId]=p.name;
      chapters.push({gameIdentity,battleId:match.doc.id,playedAtMs:Number(match.at),eventId:match.data.eventId??null,seasonId:match.data.seasonId??null,
        order,revision:official.resultRevision,accepted:true,review});
    }
  }
  // Optimistic read consistency: do not mix a correction/dispute with earlier artifacts.
  for(let index=0;index<checkpoints.length;index+=50){
    const batch=checkpoints.slice(index,index+50),fresh=await db.getAll(...batch.map(c=>c.ref));
    for(let n=0;n<batch.length;n++)if(!fresh[n].exists||batch[n].token!==(batch[n].type==='MATCH'?matchToken(fresh[n].data()):batch[n].type==='SOURCE'?sourceToken(fresh[n].data()):gameToken(fresh[n].data())))
      throw new HttpsError('aborted','Accepted social inputs changed during the read; retry to get a coherent revision.');
  }
  const history=rebuildSocialHistory(chapters);
  const chronicle=projectPlayerChronicle({ownerPlayerId,chapters,history,names});
  return {success:true,status:excluded.length?'PARTIAL':'AVAILABLE',history,chronicle,names,excluded,
    coverage:{completedBattles:matches.size,readableAcceptedGames:chapters.length,excludedGames:excluded.length,
      stageMeaning:'shadow_stages_from_readable_current_accepted_sources',opportunityCompleteness:false}};
}
