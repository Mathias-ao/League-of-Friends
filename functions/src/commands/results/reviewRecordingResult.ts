import {HttpsError,onCall} from 'firebase-functions/v2/https';
import {requireAdmin} from '../../auth/authorization.js';
import {callableOptions} from '../../config/runtime.js';
import {competitionId} from '../../services/competitionInput.js';
import {resolveRecordingResult} from '../../services/recordingResult.js';
export const adminReviewRecordingResult=onCall(callableOptions,async request=>{
  const actor=await requireAdmin(request),{matchId,gameId,sourceHash,outcome,reason,playedWithinWindow}=request.data;
  competitionId(matchId,'Battle');competitionId(gameId,'Game');
  if(typeof sourceHash!=='string'||!/^[a-f0-9]{64}$/.test(sourceHash)||typeof reason!=='string'||reason.trim().length<8||reason.length>1000||typeof playedWithinWindow!=='boolean')throw new HttpsError('invalid-argument','Provide the active recording, outcome and evidence review reason.');
  return resolveRecordingResult(matchId,gameId,{sourceHash,outcome,reason:reason.trim(),playedWithinWindow,actorUid:actor.authUid,actorPlayerId:actor.playerId});
});
