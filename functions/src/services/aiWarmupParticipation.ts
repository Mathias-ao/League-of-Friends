import {Timestamp} from 'firebase-admin/firestore';
import {db} from '../config/firebase.js';
import {POINT_UNITS} from '../engines/seasonPoints.js';
/** Dedicated accounting: no winner, rating job, Gold, pair history or implicit Achievement. */
export async function reconcileAIWarmupParticipation(matchId:string) {
  return db.runTransaction(async tx=>{
    const ref=db.collection('matches').doc(matchId),match=(await tx.get(ref)).data();
    if(match?.opponentKind!=='AI'||match.aiScoringPolicy!=='AOF_AI_WARMUP_PARTICIPATION_V1')return;
    const playerId=match.participants?.[0]?.playerId;
    if(match.participants?.length!==1||!match.eventId||!match.seasonId)return;
    const gameRef=ref.collection('games').doc('G1');
    const game=(await tx.get(gameRef)).data();
    const source=game?.activeReplayStatisticsId?(await tx.get(gameRef.collection('replaySources').doc(game.activeReplayStatisticsId))).data():null;
    const slot=await tx.get(db.collection('events').doc(match.eventId).collection('scoringSlots').doc('WARMUP_'+playerId));
    const entries=await tx.get(db.collection('leaguePointLedger').where('matchId','==',matchId));
    const standingRef=db.collection('seasons').doc(match.seasonId).collection('standings').doc(playerId),standing=(await tx.get(standingRef)).data()??{};
    const desired=match.status==='COMPLETED'&&!match.activeResultDisputeId&&!game?.activeResultDisputeId&&game?.status==='COMPLETED'&&
      slot.data()?.matchId===matchId&&match.aiParticipation?.state==='ADMIN_VERIFIED'&&match.aiParticipation.sourceHash===game?.activeReplayStatisticsId&&source?.state==='READY'&&source?.sourceHash===game?.activeReplayStatisticsId&&source?.matchId===matchId&&source?.gameId==='G1'&&source?.playerMapping?.length===1&&source.playerMapping[0].playerId===playerId&&source?.opponentMapping?.length===1&&source.opponentMapping[0].opponentId===match.aiOpponent?.opponentId&&game.players?.length===1&&game.players[0].playerId===playerId?POINT_UNITS:0;
    const net=entries.docs.reduce((n,d)=>n+Number(d.data().amountUnits??Math.round((d.data().amount??0)*POINT_UNITS)),0),delta=desired-net;
    if(!delta)return;
    const pass=(match.aiScoringPass??0)+1,now=Timestamp.now(),units=(standing.leaguePointUnits??Math.round((standing.leaguePoints??0)*POINT_UNITS))+delta;
    tx.create(db.collection('leaguePointLedger').doc(matchId+'_AI_'+pass),{playerId,matchId,eventId:match.eventId,seasonId:match.seasonId,component:'MATCH_COMPLETION',amountUnits:delta,amount:delta/POINT_UNITS,createdAt:now,policy:'AOF_AI_WARMUP_PARTICIPATION_V1'});
    tx.set(standingRef,{...standing,playerId,leaguePointUnits:units,leaguePoints:units/POINT_UNITS,warmupsPlayed:(standing.warmupsPlayed??0)+(desired>0?1:0)-(net>0?1:0),updatedAt:now});
    tx.update(ref,{aiScoringPass:pass,scoringResultRevision:match.canonicalResult?.revision??0,scoringState:desired?'READY':'PENDING',scoringBreakdown:desired?[{playerId,matchCompletion:1,matchWin:0,placement:0,emperor:0,total:1}]:[],updatedAt:now});
  });
}
