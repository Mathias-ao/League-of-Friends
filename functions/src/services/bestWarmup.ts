import {createHash} from 'node:crypto';
import {Timestamp} from 'firebase-admin/firestore';
import {db} from '../config/firebase.js';
import {POINT_UNITS} from '../engines/seasonPoints.js';
import {currentOfficialGameOutcome} from '../engines/recordingMatchFacts.js';

export const BEST_WARMUP_POLICY='AOF_BEST_WARMUP_V1';
export function selectBestWarmups(candidates:Array<{matchId:string;playerIds:string[];winnerIds:string[];revision:number;sourceHash:string}>) {
  const selected=new Map<string,{matchId:string;win:boolean;revision:number;sourceHash:string}>();
  for(const match of [...candidates].sort((a,b)=>a.matchId.localeCompare(b.matchId)))for(const id of match.playerIds) {
    const win=match.winnerIds.includes(id),old=selected.get(id);
    if(!old||win&&!old.win)selected.set(id,{matchId:match.matchId,win,revision:match.revision,sourceHash:match.sourceHash});
  }
  return selected;
}
/** Event-owned ledger, one participation and at most one win per player.
 * Recomputed from current accepted recordings on every relevant change. Reading
 * all candidates in one transaction prevents two simultaneous wins double paying. */
export async function reconcileBestWarmups(eventId:string) {
  return db.runTransaction(async tx=>{
    const ref=db.collection('events').doc(eventId),event=(await tx.get(ref)).data();
    if(event?.warmupPolicy?.scoringPolicy!==BEST_WARMUP_POLICY||!event.seasonId)return;
    const [matches,ledger,selections]=await Promise.all([tx.get(db.collection('matches').where('eventId','==',eventId)),tx.get(db.collection('leaguePointLedger').where('eventId','==',eventId)),tx.get(ref.collection('warmupSelections'))]);
    const candidates=[];
    for(const row of matches.docs) {
      const match=row.data();
      if(match.warmupScoringPolicy!==BEST_WARMUP_POLICY||match.status!=='COMPLETED'||match.activeResultDisputeId||match.scoringResultRevision!==match.canonicalResult?.revision)continue;
      const gameId=match.canonicalResult?.sourceGameId;if(typeof gameId!=='string')continue;
      const gameRef=row.ref.collection('games').doc(gameId),game=(await tx.get(gameRef)).data();
      const hash=game?.activeReplayStatisticsId,source=typeof hash==='string'?(await tx.get(gameRef.collection('replaySources').doc(hash))).data():null;
      if(source?.state!=='READY'||game?.replayStatisticsState!=='READY'||source.sourceHash!==hash||source.matchId!==row.id||source.gameId!==gameId||currentOfficialGameOutcome(game,match).qualification!=='OFFICIAL')continue;
      candidates.push({matchId:row.id,playerIds:match.participants.map((p:any)=>p.playerId),winnerIds:match.canonicalResult.winningPlayerIds,revision:match.canonicalResult.revision,sourceHash:hash});
    }
    const best=selectBestWarmups(candidates),ids=[...new Set([...best.keys(),...selections.docs.map(d=>d.id),...ledger.docs.filter(d=>d.data().eventWarmup===true).map(d=>d.data().playerId)])];
    const standings=await Promise.all(ids.map(id=>tx.get(db.collection('seasons').doc(event.seasonId).collection('standings').doc(id))));
    const now=Timestamp.now();
    ids.forEach((playerId,i)=>{
      const selected=best.get(playerId)??null,previous=selections.docs.find(d=>d.id===playerId)?.data(),token=createHash('sha256').update(JSON.stringify(selected)).digest('hex');
      if(previous?.token===token)return;
      const pass=Number(previous?.pass??0)+1;
      const rows=ledger.docs.filter(d=>d.data().eventWarmup===true&&d.data().playerId===playerId).map(d=>d.data());
      let deltaUnits=0;
      for(const component of ['MATCH_COMPLETION','MATCH_WIN']) {
        // Clear each old source independently; rebind the desired net award to
        // the selected recording so disputes mask precisely that source.
        const nets=new Map<string,number>();
        for(const row of rows.filter(r=>r.component===component))nets.set(row.sourceMatchId,(nets.get(row.sourceMatchId)??0)+Number(row.amountUnits??0));
        if(selected&&!nets.has(selected.matchId))nets.set(selected.matchId,0);
        for(const [sourceMatchId,current] of nets) {
          const desired=selected?.matchId===sourceMatchId?(component==='MATCH_COMPLETION'?POINT_UNITS:selected.win?2*POINT_UNITS:0):0;
          const amountUnits=desired-current;if(!amountUnits)continue;
          const entry=db.collection('leaguePointLedger').doc(eventId+'_BEST_W_'+playerId+'_P'+pass+'_'+component+'_'+sourceMatchId);
          tx.create(entry,{eventId,seasonId:event.seasonId,playerId,matchId:null,sourceMatchId,eventWarmup:true,act:'WARMUP',component,amountUnits,amount:amountUnits/POINT_UNITS,sourceVersion:selected?.revision??null,idempotencyKey:entry.id,createdAt:now});deltaUnits+=amountUnits;
        }
      }
      const oldParticipation=rows.filter(r=>r.component==='MATCH_COMPLETION').reduce((n,r)=>n+Number(r.amountUnits??0),0)>0;
      const oldWin=rows.filter(r=>r.component==='MATCH_WIN').reduce((n,r)=>n+Number(r.amountUnits??0),0)>0;
      const standing=standings[i].data()??{},units=Number(standing.leaguePointUnits??Number(standing.leaguePoints??0)*POINT_UNITS)+deltaUnits;
      tx.set(standings[i].ref,{playerId,leaguePointUnits:units,leaguePoints:units/POINT_UNITS,warmupsPlayed:Number(standing.warmupsPlayed??0)+Number(!!selected)-Number(oldParticipation),warmupWins:Number(standing.warmupWins??0)+Number(!!selected?.win)-Number(oldWin),updatedAt:now},{merge:true});
      tx.set(ref.collection('warmupSelections').doc(playerId),{playerId,selected,token,pass,updatedAt:now});
    });
  });
}
