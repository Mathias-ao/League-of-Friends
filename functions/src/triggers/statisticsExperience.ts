import {onDocumentWritten} from 'firebase-functions/v2/firestore';
import {rebuildStatisticsReadModels} from '../services/statisticsExperienceProjection.js';

export const rebuildStatisticsOnGameChange=onDocumentWritten({document:'matches/{matchId}/games/{gameId}',region:'europe-west1',retry:true},async event=>{
  const before=event.data?.before.data(),after=event.data?.after.data();
  const signature=(g:any)=>JSON.stringify([g?.status,g?.canonicalResult,g?.activeResultDisputeId,g?.activeReplayStatisticsId,g?.replayStatisticsRevision,g?.players,g?.completedAt,g?.gameConfigSnapshot]);
  if(signature(before)!==signature(after))await rebuildStatisticsReadModels();
});
export const rebuildStatisticsOnMatchChange=onDocumentWritten({document:'matches/{matchId}',region:'europe-west1',retry:true},async event=>{
  const signature=(m:any)=>JSON.stringify([m?.status,m?.activeResultDisputeId,m?.seasonId,m?.context,m?.gameConfigSnapshot,m?.completedAt,m?.format]);
  if(signature(event.data?.before.data())!==signature(event.data?.after.data()))await rebuildStatisticsReadModels();
});

// Also rebuild after lazy hydration of a pre-V1 source. This never writes sources,
// so duplicate delivery is safe and does not form a trigger loop.
export const rebuildStatisticsOnSourceChange=onDocumentWritten({document:'matches/{matchId}/games/{gameId}/replaySources/{sourceId}',region:'europe-west1',retry:true},async event=>{
  const signature=(s:any)=>JSON.stringify([s?.state,s?.experience]);
  if(signature(event.data?.before.data())!==signature(event.data?.after.data()))await rebuildStatisticsReadModels();
});
