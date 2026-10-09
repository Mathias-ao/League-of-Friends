import {createHash} from 'node:crypto';
import {db} from '../config/firebase.js';
import {POINT_UNITS} from '../engines/seasonPoints.js';
import {selectEventShowcase} from '../engines/eventRoundoffShowcase.js';
import {collectStatistics} from './statisticsExperienceProjection.js';
import {currentOfficialGameOutcome} from '../engines/recordingMatchFacts.js';
export async function readEventRoundoff(eventId:string,viewerPlayerId?:string) {
 return db.runTransaction(async tx=>{
  const [matches,ledger,dataset,selections]=await Promise.all([tx.get(db.collection('matches').where('eventId','==',eventId)),tx.get(db.collection('leaguePointLedger').where('eventId','==',eventId)),collectStatistics({eventId},tx),tx.get(db.collection('events').doc(eventId).collection('warmupSelections'))]);
  const points=new Map<string,{playerId:string;warmup:number;main:number;placement:number;emperor:number}>(),showcaseMatches=[];
  const eligible=new Set<string>();
  const currentGames=new Map<string,any[]>();
  for(const row of matches.docs) {
    const match=row.data(),games=await tx.get(row.ref.collection('games'));
    currentGames.set(row.id,games.docs.map(g=>g.data()));
    const accepted=games.docs.filter(g=>currentOfficialGameOutcome(g.data(),match).qualification==='OFFICIAL').map(g=>g.id);
    const manifest=match.canonicalResult?.seriesGameRevisions??{[match.canonicalResult?.sourceGameId]:match.canonicalResult?.revision};
    const currentManifest=Object.entries(manifest).every(([id,revision])=>accepted.includes(id)&&games.docs.find(g=>g.id===id)?.data().canonicalResult?.revision===revision);
    if(currentManifest&&match.status==='COMPLETED'&&!match.activeResultDisputeId&&match.scoringResultRevision===match.canonicalResult?.revision&&accepted.includes(match.canonicalResult?.sourceGameId))eligible.add(row.id);
    showcaseMatches.push({matchId:row.id,eventId,status:match.activeResultDisputeId?'DISPUTED':match.status,format:match.format,scoringAct:match.scoringSnapshot?.rules?.act,participants:match.participants??[],result:match.canonicalResult,acceptedGameIds:accepted,emperorPlayerIdAtApproval:match.emperorPlayerIdAtApproval,standardStart:match.gameConfigSnapshot?.additionalSettings?.startingAge==='DARK_AGE',countedWarmupPlayerIds:match.warmupScoringPolicy==='AOF_BEST_WARMUP_V1'?selections.docs.filter(s=>s.data().selected?.matchId===row.id&&s.data().selected?.revision===match.canonicalResult?.revision).map(s=>s.id):undefined});
  }
  for(const row of ledger.docs) {
    const entry=row.data(),matchId=entry.sourceMatchId??entry.matchId;
    if(!eligible.has(matchId)||typeof entry.playerId!=='string')continue;
    const match=matches.docs.find(m=>m.id===matchId)!.data(),act=entry.act??match.scoringSnapshot?.rules?.act;
    const item=points.get(entry.playerId)??{playerId:entry.playerId,warmup:0,main:0,placement:0,emperor:0};
    const field=entry.component==='FFA_PLACEMENT'?'placement':entry.component==='EMPEROR_DEFEATED'?'emperor':act==='WARMUP'?'warmup':'main';
    item[field]+=Number(entry.amountUnits??Number(entry.amount??0)*POINT_UNITS)/POINT_UNITS;points.set(entry.playerId,item);
  }
  const rows=[...points.values()].sort((a,b)=>a.playerId.localeCompare(b.playerId));
  const showcase=selectEventShowcase({eventId,matches:showcaseMatches,games:dataset.games});
  const revision=Number.parseInt(createHash('sha256').update(JSON.stringify([rows,showcase,dataset.games.map(g=>[g.matchId,g.gameId,g.revision,g.sourceHash])])).digest('hex').slice(0,8),16)||1;
  // Read only the authenticated viewer's current, reconciled selection. Never
  // infer the chosen Battle from the public roster or merely the largest award.
  const selection=viewerPlayerId?selections.docs.find(s=>s.id===viewerPlayerId)?.data().selected:null;
  const ownWarmups=viewerPlayerId?matches.docs.filter(m=>m.data().warmupScoringPolicy==='AOF_BEST_WARMUP_V1'&&m.data().scoringSnapshot?.rules?.act==='WARMUP'&&!['CANCELLED','VOID','PROPOSED'].includes(m.data().status)&&m.data().participants?.some((p:any)=>p.playerId===viewerPlayerId)):[];
  const selectedMatch=selection?ownWarmups.find(m=>m.id===selection.matchId):null;
  const warmupPoints=rows.find(row=>row.playerId===viewerPlayerId)?.warmup;
  const currentSource=selectedMatch&&(currentGames.get(selectedMatch.id)??[]).find(g=>g.activeReplayStatisticsId===selection.sourceHash&&g.canonicalResult?.revision===selection.revision);
  const viewerWarmupSelection=ownWarmups.length>1&&selectedMatch&&eligible.has(selectedMatch.id)&&selectedMatch.data().canonicalResult?.revision===selection.revision&&currentSource&&warmupPoints===(selection.win?3:1)?{
    playerId:viewerPlayerId!,matchId:selectedMatch.id,points:warmupPoints,win:selection.win===true,resultRevision:selection.revision,sourceHash:selection.sourceHash,otherWarmupCount:ownWarmups.length-1
  }:null;
  return {revision,points:rows,showcase,viewerWarmupSelection};
 });
}
