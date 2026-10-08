import {onDocumentWritten} from 'firebase-functions/v2/firestore';
import {db} from '../config/firebase.js';
import {resolveSeriesResult} from '../engines/seriesResult.js';
import {finalizeMatchSeries} from '../commands/results/finalizeMatchSeries.js';
import {SYSTEM_RESULT_PROCESSING_ACTOR} from '../services/resultProcessingActor.js';
export const finalizeRecordingSeries=onDocumentWritten({document:'matches/{matchId}/games/{gameId}',region:'europe-west1',retry:true},async event=>{
  const before=event.data?.before.data(),after=event.data?.after.data();
  if(before?.canonicalResult?.revision===after?.canonicalResult?.revision&&before?.status===after?.status)return;
  const ref=db.collection('matches').doc(event.params.matchId),match=(await ref.get()).data();
  if(!match?.seriesRule||match.seriesRule.maxGames<=1||match.format==='FFA'||match.activeResultDisputeId||!['ACTIVE','AWAITING_CONFIRMATION','COMPLETED'].includes(match.status)||match.canonicalResult&&match.canonicalResult.source!=='RECORDING_VERIFIED')return;
  const games=(await ref.collection('games').get()).docs.map(g=>({...g.data(),gameId:g.id})) as any[];
  if(games.some(g=>g.canonicalResult&&g.canonicalResult.source!=='RECORDING_VERIFIED'))return;
  try{resolveSeriesResult(games,match.seriesRule,match.participants);}catch{return;}
  await finalizeMatchSeries({requestId:'AUTO_SERIES_'+event.id,matchId:ref.id,expectedResultRevision:match.canonicalResult?.revision??0,reason:'Series resolved from accepted recording outcomes.'},SYSTEM_RESULT_PROCESSING_ACTOR);
});
