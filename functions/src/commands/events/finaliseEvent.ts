import {competitionId} from '../../services/competitionInput.js';
import {Timestamp} from 'firebase-admin/firestore';
import {HttpsError,onCall} from 'firebase-functions/v2/https';
import {requireAdmin} from '../../auth/authorization.js';
import {db} from '../../config/firebase.js';
import {callableOptions} from '../../config/runtime.js';
import {writeAdminAudit} from '../../services/audit.js';
import {readEventFinalisation} from '../../services/eventFinalisation.js';
export const adminFinaliseEvent=onCall(callableOptions,async request=>{
  const actor=await requireAdmin(request),{eventId,expectedRevision}=request.data;
  competitionId(eventId,'Event');
  if(typeof eventId!=='string'||!Number.isInteger(expectedRevision))throw new HttpsError('invalid-argument','Provide the Event and expected closure revision.');
  return db.runTransaction(async tx=>{
    const ref=db.collection('events').doc(eventId),snap=await tx.get(ref),event=snap.data();
    if(!event)throw new HttpsError('not-found','Event not found.');
    const revision=event.finalisationRevision??0;
    if(event.status==='COMPLETED')return {success:true,alreadyFinalised:true,revision};
    if(revision!==expectedRevision)throw new HttpsError('aborted','The Event changed; reload before closing it.');
    const readiness=await readEventFinalisation(ref,event,tx);
    if(!readiness.canFinalise)throw new HttpsError('failed-precondition','Resolve the Event checklist before finalising.',readiness.blockers);
    const now=Timestamp.now();
    tx.update(ref,{status:'COMPLETED',completedAt:now,finalisedAt:now,finalisedBy:actor.playerId,finalisationRevision:revision+1,updatedAt:now});
    writeAdminAudit(tx,{actorUid:actor.authUid,actorPlayerId:actor.playerId,action:'EVENT_FINALISED',targetType:'EVENT',targetId:eventId,after:{revision:revision+1}});
    return {success:true,revision:revision+1};
  });
});
export const adminResolveUnplayedEventMatch=onCall(callableOptions,async request=>{
  const actor=await requireAdmin(request),{matchId,reason}=request.data;
  competitionId(matchId,'Battle');
  if(typeof matchId!=='string'||typeof reason!=='string'||reason.trim().length<8||reason.length>1000)throw new HttpsError('invalid-argument','Explain why this unplayed Battle is cancelled.');
  return db.runTransaction(async tx=>{
    const ref=db.collection('matches').doc(matchId),snap=await tx.get(ref),match=snap.data();
    if(!match?.eventId)throw new HttpsError('not-found','Event Battle not found.');
    const [games,ledger,event]=await Promise.all([tx.get(ref.collection('games')),tx.get(db.collection('leaguePointLedger').where('matchId','==',matchId)),tx.get(db.collection('events').doc(match.eventId))]);
    if(event.data()?.status==='COMPLETED'||match.canonicalResult||match.status==='COMPLETED'||ledger.size||games.docs.some(g=>g.data().canonicalResult||g.data().activeReplayStatisticsId||g.data().status==='COMPLETED'))throw new HttpsError('failed-precondition','Played or closed Battles require the existing correction workflow.');
    const now=Timestamp.now();
    for(const game of games.docs)tx.update(game.ref,{status:'CANCELLED',updatedAt:now});
    tx.update(ref,{status:'CANCELLED',resolutionReason:reason.trim(),resolvedBy:actor.playerId,updatedAt:now});
    writeAdminAudit(tx,{actorUid:actor.authUid,actorPlayerId:actor.playerId,action:'EVENT_MATCH_CANCELLED',targetType:'MATCH',targetId:matchId,after:{reason:reason.trim()}});
    return {success:true};
  });
});

/** Invalid recording evidence can be rejected before any official Game result.
 * Accepted Battles continue through disputes; this cannot bypass reward reversal. */
export const adminRejectUnresolvedEventMatch=onCall(callableOptions,async request=>{
  const actor=await requireAdmin(request),{matchId,reason}=request.data;competitionId(matchId,'Battle');
  if(typeof reason!=='string'||reason.trim().length<8||reason.length>1000)throw new HttpsError('invalid-argument','Explain why the recorded Battle is invalid.');
  await db.runTransaction(async tx=>{
    const ref=db.collection('matches').doc(matchId),match=(await tx.get(ref)).data();
    if(!match?.eventId)throw new HttpsError('not-found','Event Battle not found.');
    const [games,event,ledger]=await Promise.all([tx.get(ref.collection('games')),tx.get(db.collection('events').doc(match.eventId)),tx.get(db.collection('leaguePointLedger').where('matchId','==',matchId))]);
    if(!['PUBLISHED','ACTIVE'].includes(event.data()?.status)||!['READY','ACTIVE','AWAITING_CONFIRMATION'].includes(match.status)||match.canonicalResult||ledger.size||games.docs.some(g=>g.data().canonicalResult||g.data().activeResultDisputeId)||!games.docs.some(g=>g.data().activeReplayStatisticsId))throw new HttpsError('failed-precondition','Reject only recorded Battles without any accepted Game result. Accepted results require the correction workflow.');
    const now=Timestamp.now();
    for(const game of games.docs)tx.update(game.ref,{status:'VOID',resolutionReason:reason.trim(),updatedAt:now});
    tx.update(ref,{status:'VOID',resolutionReason:reason.trim(),resolvedBy:actor.playerId,updatedAt:now});
    writeAdminAudit(tx,{actorUid:actor.authUid,actorPlayerId:actor.playerId,action:'UNRESOLVED_RECORDING_REJECTED',targetType:'MATCH',targetId:matchId,reason:reason.trim()});
  });return {success:true};
});
