import {onDocumentWritten} from 'firebase-functions/v2/firestore';
import {db} from '../config/firebase.js';
import {produceFFAPlacements} from '../engines/ffaPlacementProducer.js';
export async function reconcileFFAPlacementEvidence(matchId:string,gameId:string) {
  await db.runTransaction(async tx=>{
    const ref=db.collection('matches').doc(matchId),gameRef=ref.collection('games').doc(gameId);
    const [matchSnap,gameSnap]=await Promise.all([tx.get(ref),tx.get(gameRef)]),match=matchSnap.data(),game=gameSnap.data();
    if(match?.format!=='FFA'||match.scoringSnapshot?.rules?.diplomacyEnabled!==false||!game?.activeReplayStatisticsId)return;
    const sourceRef=gameRef.collection('replaySources').doc(game.activeReplayStatisticsId),source=(await tx.get(sourceRef)).data();
    if(!source)return;
    const eligible=source.state==='READY'&&source.matchId===matchId&&source.gameId===gameId&&source.sourceHash===game.activeReplayStatisticsId&&game.status==='COMPLETED'&&!game.activeResultDisputeId&&!match.activeResultDisputeId&&match.status==='COMPLETED';
    const projection=eligible?produceFFAPlacements(source.matchFacts,{policy:match.scoringSnapshot.rules.placementPolicy,sourceStatisticsId:game.activeReplayStatisticsId,replaySha256:source.sourceHash,rosterIds:(game.players??[]).map((p:any)=>p.playerId),winnerIds:game.canonicalResult?.winningPlayerIds??[],resultRevision:game.canonicalResult?.revision??0,replayPlayerMapping:(source.matchFacts?.players??[]).map((p:any)=>({replayPlayerId:p.playerId,playerId:source.playerMapping?.find((m:any)=>m.replaySlot===p.replaySlot)?.playerId}))}):{state:'PENDING',reason:'An accepted current result and active recording are required.',qualifiedFFAPlacements:null};
    if(JSON.stringify(source.placementQualification)!==JSON.stringify(projection))tx.update(sourceRef,{placementQualification:projection,qualifiedFFAPlacements:projection.qualifiedFFAPlacements});
  });
}
export const qualifyFFAPlacementsOnGame=onDocumentWritten({document:'matches/{matchId}/games/{gameId}',region:'europe-west1',retry:true},async event=>{
  const signature=(v:any)=>JSON.stringify([v?.status,v?.activeReplayStatisticsId,v?.canonicalResult,v?.activeResultDisputeId,v?.players]);
  if(signature(event.data?.before.data())!==signature(event.data?.after.data()))await reconcileFFAPlacementEvidence(event.params.matchId,event.params.gameId);
});
export const qualifyFFAPlacementsOnSource=onDocumentWritten({document:'matches/{matchId}/games/{gameId}/replaySources/{sourceId}',region:'europe-west1',retry:true},async event=>{
  const signature=(v:any)=>JSON.stringify([v?.state,v?.matchFacts,v?.playerMapping]);
  if(signature(event.data?.before.data())!==signature(event.data?.after.data()))await reconcileFFAPlacementEvidence(event.params.matchId,event.params.gameId);
});
export const qualifyFFAPlacementsOnMatch=onDocumentWritten({document:'matches/{matchId}',region:'europe-west1',retry:true},async event=>{
  const signature=(v:any)=>JSON.stringify([v?.status,v?.canonicalResult,v?.activeResultDisputeId,v?.scoringSnapshot]);
  if(signature(event.data?.before.data())===signature(event.data?.after.data())||event.data?.after.data()?.format!=='FFA')return;
  const games=await db.collection('matches').doc(event.params.matchId).collection('games').get();
  for(const game of games.docs)await reconcileFFAPlacementEvidence(event.params.matchId,game.id);
});
