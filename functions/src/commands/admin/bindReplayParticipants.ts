import {Timestamp} from 'firebase-admin/firestore';
import {HttpsError,onCall} from 'firebase-functions/v2/https';
import {requireAdmin} from '../../auth/authorization.js';
import {db} from '../../config/firebase.js';
import {callableOptions} from '../../config/runtime.js';
import {competitionId} from '../../services/competitionInput.js';
import {normalizeReplayName} from '../../services/steamProfile.js';
import {writeAdminAudit} from '../../services/audit.js';
export const adminBindReplayParticipants=onCall(callableOptions,async request=>{
  const actor=await requireAdmin(request),{matchId,gameId,bindings,reason}=request.data;
  competitionId(matchId,'Battle');competitionId(gameId,'Game');
  if(typeof reason!=='string'||reason.trim().length<8||reason.length>1000||!Array.isArray(bindings)||bindings.length<2||bindings.length>8||bindings.some(p=>typeof p.sourceName!=='string'||!p.sourceName.trim()||p.sourceName.length>100||typeof p.playerId!=='string'))throw new HttpsError('invalid-argument','Provide a unique observed name for each starter and explain the identity review.');
  const normalized=bindings.map(p=>({sourceNameNormalized:normalizeReplayName(p.sourceName),playerId:p.playerId}));
  if(new Set(normalized.map(p=>p.sourceNameNormalized)).size!==normalized.length||new Set(normalized.map(p=>p.playerId)).size!==normalized.length)throw new HttpsError('invalid-argument','Names and starters must be unique.');
  await db.runTransaction(async tx=>{
    const ref=db.collection('matches').doc(matchId),gameRef=ref.collection('games').doc(gameId);
    const [ms,gs]=await Promise.all([tx.get(ref),tx.get(gameRef)]),match=ms.data(),game=gs.data();
    if(!match||!game||!['READY','ACTIVE','AWAITING_CONFIRMATION'].includes(match.status)||game.status!=='READY'||game.canonicalResult||game.activeReplayStatisticsId)throw new HttpsError('failed-precondition','Resolve identities for an open, unrecorded Game before its first recording is accepted.');
    if(game.players?.length!==normalized.length||normalized.some(p=>!game.players.some((q:any)=>q.playerId===p.playerId)))throw new HttpsError('failed-precondition','Bind exactly the approved Game starters.');
    tx.update(gameRef,{replayParticipantBindings:normalized,updatedAt:Timestamp.now()});
    writeAdminAudit(tx,{actorUid:actor.authUid,actorPlayerId:actor.playerId,action:'REPLAY_IDENTITIES_BOUND',targetType:'GAME',targetId:matchId+'/'+gameId,reason:reason.trim(),before:game.replayParticipantBindings??[],after:normalized});
  });return {success:true};
});
