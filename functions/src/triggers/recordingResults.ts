import {onDocumentWritten} from 'firebase-functions/v2/firestore';
import {resolveRecordingResult} from '../services/recordingResult.js';
export const resolveResultsOnRecordingSource=onDocumentWritten({document:'matches/{matchId}/games/{gameId}/replaySources/{sourceId}',region:'europe-west1',retry:true},async event=>{
  const before=event.data?.before.data(),after=event.data?.after.data();
  if(!after||after.state!=='READY'||before?.state==='READY'&&before?.sourceHash===after.sourceHash)return;
  await resolveRecordingResult(event.params.matchId,event.params.gameId);
});
export const resolveResultsOnActiveRecording=onDocumentWritten({document:'matches/{matchId}/games/{gameId}',region:'europe-west1',retry:true},async event=>{
  const before=event.data?.before.data(),after=event.data?.after.data();
  if(!after?.activeReplayStatisticsId||before?.activeReplayStatisticsId===after.activeReplayStatisticsId&&before?.replayStatisticsState===after.replayStatisticsState)return;
  await resolveRecordingResult(event.params.matchId,event.params.gameId);
});
