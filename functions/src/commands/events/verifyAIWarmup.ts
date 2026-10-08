import {competitionId} from '../../services/competitionInput.js';
import {Timestamp} from 'firebase-admin/firestore';
import {HttpsError,onCall} from 'firebase-functions/v2/https';
import {requireAdmin,requireLeaguePlayer} from '../../auth/authorization.js';
import {db} from '../../config/firebase.js';
import {callableOptions} from '../../config/runtime.js';
import {writeAdminAudit} from '../../services/audit.js';
import {reconcileAIWarmupParticipation} from '../../services/aiWarmupParticipation.js';
export const adminVerifyAIWarmup=onCall(callableOptions,async request=>{
  const actor=await requireAdmin(request),{matchId,sourceHash,reason}=request.data;
  competitionId(matchId,'Battle');
  if(typeof matchId!=='string'||typeof sourceHash!=='string'||!/^[0-9a-f]{64}$/.test(sourceHash)||typeof reason!=='string'||reason.trim().length<8||reason.length>1000||request.data.settingsVerified!==true||request.data.playedWithinWindow!==true)throw new HttpsError('invalid-argument','Verify the AI opponent, announced settings and play deadline against the recording; explain the evidence.');
  await db.runTransaction(async tx=>{
    const ref=db.collection('matches').doc(matchId),gameRef=ref.collection('games').doc('G1');
    const [snap,gameSnap,sourceSnap]=await Promise.all([tx.get(ref),tx.get(gameRef),tx.get(gameRef.collection('replaySources').doc(sourceHash))]);
    const match=snap.data(),game=gameSnap.data(),source=sourceSnap.data();
    if(match?.opponentKind!=='AI'||['CANCELLED','VOID'].includes(match.status)||match.participants?.length!==1||game?.activeReplayStatisticsId!==sourceHash||source?.state!=='READY'||source.sourceHash!==sourceHash||source.matchId!==matchId||source.gameId!=='G1'||source?.opponentMapping?.length!==1||source.opponentMapping[0].opponentId!==match.aiOpponent?.opponentId||source?.playerMapping?.length!==1||source.playerMapping[0].playerId!==match.participants[0].playerId)throw new HttpsError('failed-precondition','An active, mapped AI warm-up recording is required.');
    const slot=await tx.get(db.collection('events').doc(match.eventId).collection('scoringSlots').doc('WARMUP_'+match.participants[0].playerId));
    if(slot.data()?.matchId!==matchId)throw new HttpsError('failed-precondition','The designated warm-up slot changed.');
    if(match.aiParticipation?.state==='ADMIN_VERIFIED'&&match.aiParticipation.sourceHash===sourceHash&&!match.activeResultDisputeId)return;
    const now=Timestamp.now(),revision=(match.canonicalResult?.revision??0)+1;
    const participation={state:'ADMIN_VERIFIED',sourceHash,verifiedBy:actor.playerId,verifiedAt:now,reason:reason.trim(),difficulty:match.aiOpponent.difficulty};
    tx.update(ref,{aiParticipation:participation,status:'COMPLETED',canonicalResult:{type:'AI_PARTICIPATION',revision,source:'ADMIN_VERIFIED_PARTICIPATION',winningPlayerIds:[],losingPlayerIds:[]},activeResultDisputeId:null,completedAt:now,processingState:'COMPLETE',updatedAt:now});
    tx.update(gameRef,{status:'COMPLETED',aiParticipation:participation,activeResultDisputeId:null,completedAt:now,updatedAt:now});
    writeAdminAudit(tx,{actorUid:actor.authUid,actorPlayerId:actor.playerId,action:'AI_WARMUP_VERIFIED',targetType:'MATCH',targetId:matchId,after:{sourceHash,reason:reason.trim(),revision}});
  });
  await reconcileAIWarmupParticipation(matchId);return {success:true};
});
export const disputeAIWarmup=onCall(callableOptions,async request=>{
  const actor=await requireLeaguePlayer(request),{matchId,reason}=request.data;
  competitionId(matchId,'Battle');
  if(typeof matchId!=='string'||typeof reason!=='string'||reason.trim().length<8||reason.length>1000)throw new HttpsError('invalid-argument','Explain the AI warm-up correction.');
  await db.runTransaction(async tx=>{
    const ref=db.collection('matches').doc(matchId),snap=await tx.get(ref),match=snap.data();
    if(match?.opponentKind!=='AI'||!match.participants.some((p:any)=>p.playerId===actor.playerId)||match.status!=='COMPLETED')throw new HttpsError('permission-denied','Only the participant may dispute this completed AI warm-up.');
    const now=Timestamp.now();tx.update(ref,{status:'DISPUTED',activeResultDisputeId:'AI_REVIEW',aiDisputeReason:reason.trim(),updatedAt:now});
    tx.update(ref.collection('games').doc('G1'),{status:'DISPUTED',activeResultDisputeId:'AI_REVIEW',updatedAt:now});
  });await reconcileAIWarmupParticipation(matchId);return {success:true};
});

export const adminRejectAIWarmup=onCall(callableOptions,async request=>{
  const actor=await requireAdmin(request),{matchId,reason}=request.data;
  competitionId(matchId,'Battle');
  if(typeof reason!=='string'||reason.trim().length<8||reason.length>1000)throw new HttpsError('invalid-argument','Explain why participation evidence is rejected.');
  await db.runTransaction(async tx=>{
    const ref=db.collection('matches').doc(matchId),match=(await tx.get(ref)).data();
    if(match?.opponentKind!=='AI')throw new HttpsError('failed-precondition','This is not an AI warm-up.');
    const gameRef=ref.collection('games').doc('G1'),game=await tx.get(gameRef);
    if(!game.exists)throw new HttpsError('failed-precondition','AI Game is missing.');
    const now=Timestamp.now();
    tx.update(ref,{status:'VOID',resolutionReason:reason.trim(),aiParticipation:{...(match.aiParticipation??{}),state:'REJECTED',reviewedBy:actor.playerId},activeResultDisputeId:null,updatedAt:now});
    tx.update(gameRef,{status:'VOID',activeResultDisputeId:null,updatedAt:now});
    writeAdminAudit(tx,{actorUid:actor.authUid,actorPlayerId:actor.playerId,action:'AI_WARMUP_EVIDENCE_REJECTED',targetType:'MATCH',targetId:matchId,after:{reason:reason.trim()}});
  });await reconcileAIWarmupParticipation(matchId);return {success:true};
});
