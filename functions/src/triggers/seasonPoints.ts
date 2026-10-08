import {reconcileAIWarmupParticipation} from '../services/aiWarmupParticipation.js';
import {onDocumentUpdated,onDocumentWritten} from "firebase-functions/v2/firestore";
import {db} from "../config/firebase.js";
import {collections} from "../domain/collections.js";
import {SEASON_POINTS_VERSION} from "../engines/seasonPoints.js";
import {processMatchRewards} from "../commands/processing/processMatchRewards.js";
import {SYSTEM_RESULT_PROCESSING_ACTOR} from "../services/resultProcessingActor.js";
async function reconcile(matchId:string,eventId:string) {
  const snapshot=await db.collection(collections.matches).doc(matchId).get(),match=snapshot.data();
  if(match?.opponentKind==='AI'){await reconcileAIWarmupParticipation(matchId);return;}
  if(match?.status!=="COMPLETED"||match.activeResultDisputeId||!match.canonicalResult||
    match.scoringSnapshot?.rules?.modelVersion!==SEASON_POINTS_VERSION)return;
  await processMatchRewards({matchId,requestId:"SOURCE_"+eventId},SYSTEM_RESULT_PROCESSING_ACTOR);
}
export const reconcileSeasonPointsOnGameSource=onDocumentUpdated({
  document:"matches/{matchId}/games/{gameId}",region:"europe-west1",retry:true,
},async event=>{
  const before=event.data?.before.data(),after=event.data?.after.data();
  if(before?.activeReplayStatisticsId===after?.activeReplayStatisticsId &&
    before?.replayStatisticsState===after?.replayStatisticsState &&
    before?.status===after?.status && before?.activeResultDisputeId===after?.activeResultDisputeId &&
    before?.canonicalResult?.revision===after?.canonicalResult?.revision)return;
  await reconcile(event.params.matchId,event.id);
});
export const reconcileSeasonPointsOnPlacementSource=onDocumentWritten({
  document:"matches/{matchId}/games/{gameId}/replaySources/{sourceId}",region:"europe-west1",retry:true,
},async event=>{
  const before=event.data?.before.data(),after=event.data?.after.data();
  if(JSON.stringify([before?.qualifiedFFAPlacements,before?.playerMapping,before?.opponentMapping])===JSON.stringify([after?.qualifiedFFAPlacements,after?.playerMapping,after?.opponentMapping])&&before?.state===after?.state)return;
  await reconcile(event.params.matchId,event.id);
});
