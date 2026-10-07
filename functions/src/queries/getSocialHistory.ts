import {createHash} from 'node:crypto';
import {getStorage} from 'firebase-admin/storage';
import {HttpsError,onCall} from 'firebase-functions/v2/https';
import {requireLeaguePlayer} from '../auth/authorization.js';
import {db} from '../config/firebase.js';
import {collections} from '../domain/collections.js';
import {callableOptions} from '../config/runtime.js';
import {projectSocialIncidents,rebuildSocialHistory} from '../engines/socialIncidentCore.js';
import {projectPlayerChronicle} from '../engines/playerChronicleCore.js';
import {currentOfficialGameOutcome} from '../engines/recordingMatchFacts.js';

/** Read-only pilot: rebuild from current verified artifacts, never old social award rows. */
export const getSocialHistory=onCall({...callableOptions,timeoutSeconds:120},async request=>{
  const actor=await requireLeaguePlayer(request);
  const matches=await db.collection(collections.matches).where('status','==','COMPLETED').limit(101).get();
  if(matches.size>100)throw new HttpsError('resource-exhausted','Social shadow history currently supports 100 completed Battles; no partial stages were returned.');
  const matchToken=(v:any)=>JSON.stringify({status:v?.status,dispute:v?.activeResultDisputeId??null,firstCompletedAt:v?.firstCompletedAt??null,completedAt:v?.completedAt??null});
  const gameToken=(v:any)=>JSON.stringify({status:v?.status,dispute:v?.activeResultDisputeId??null,statisticsId:v?.activeReplayStatisticsId??null,
    result:v?.canonicalResult??null,players:v?.players??null,number:v?.gameNumber});
  const checkpoints:any[]=matches.docs.map(doc=>({ref:doc.ref,token:matchToken(doc.data()),type:'MATCH'}));
  const ordered=matches.docs.map(doc=>({doc,data:doc.data(),at:(doc.data().firstCompletedAt??doc.data().completedAt)?.toMillis?.()}));
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
      const revision=await game.doc.ref.collection('replaySources').doc(game.data.activeReplayStatisticsId).get();
      const source=revision.data();
      if(source?.state!=='READY'||!source.statistics?.path||!source.statistics?.sha256){excluded.push({gameIdentity,reason:'active_artifact_unavailable'});continue;}
      const [bytes]=await getStorage().bucket(bucket).file(source.statistics.path).download();
      if(createHash('sha256').update(bytes).digest('hex')!==source.statistics.sha256)
        throw new HttpsError('data-loss','A social source failed artifact integrity verification.');
      let statistics:any;try{statistics=JSON.parse(bytes.toString('utf8'));}catch{throw new HttpsError('data-loss','A social source is invalid JSON.');}
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
    for(let n=0;n<batch.length;n++)if(!fresh[n].exists||batch[n].token!==(batch[n].type==='MATCH'?matchToken(fresh[n].data()):gameToken(fresh[n].data())))
      throw new HttpsError('aborted','Accepted social inputs changed during the read; retry to get a coherent revision.');
  }
  const history=rebuildSocialHistory(chapters);
  const chronicle=projectPlayerChronicle({ownerPlayerId:actor.playerId,chapters,history,names});
  return {success:true,status:excluded.length?'PARTIAL':'AVAILABLE',history,chronicle,names,excluded,
    coverage:{completedBattles:matches.size,readableAcceptedGames:chapters.length,excludedGames:excluded.length,
      stageMeaning:'shadow_stages_from_readable_current_accepted_sources',opportunityCompleteness:false}};
});
