import {Timestamp} from 'firebase-admin/firestore';
import {HttpsError,onCall} from 'firebase-functions/v2/https';
import {requireAdmin} from '../../auth/authorization.js';
import {db} from '../../config/firebase.js';
import {callableOptions} from '../../config/runtime.js';
import {competitionId} from '../../services/competitionInput.js';
import {writeAdminAudit} from '../../services/audit.js';
export const adminMarkEventAttendance=onCall(callableOptions,async request=>{
  const actor=await requireAdmin(request),{eventId,playerId,status,reason}=request.data;competitionId(eventId,'Event');competitionId(playerId,'player');
  if(!['LATE_ADDED','NO_SHOW'].includes(status)||typeof reason!=='string'||reason.trim().length<8||reason.length>1000)throw new HttpsError('invalid-argument','Choose attendance and explain the exception.');
  await db.runTransaction(async tx=>{
    const ref=db.collection('events').doc(eventId),event=(await tx.get(ref)).data();
    if(!event||!['PUBLISHED','ACTIVE'].includes(event.status)||event.officialMatchIds?.length)throw new HttpsError('failed-precondition','Resolve attendance before approving the main Battle plan.');
    const participantRef=ref.collection('participants').doc(playerId),[signup,player,member]=await Promise.all([tx.get(participantRef),tx.get(db.collection('players').doc(playerId)),tx.get(db.collection('seasons').doc(event.seasonId).collection('participants').doc(playerId))]);
    if(signup.data()?.rsvp!=='YES'||signup.data()?.signupState!=='CONFIRMED'||status==='LATE_ADDED'&&player.data()?.membershipStatus!=='ACTIVE'||member.data()?.status!=='ENTERED')throw new HttpsError('failed-precondition','The player must be confirmed in the Season, and active to enter the draw.');
    const now=Timestamp.now();tx.update(participantRef,{attendanceStatus:status,attendanceResolvedBy:actor.playerId,updatedAt:now});
    writeAdminAudit(tx,{actorUid:actor.authUid,actorPlayerId:actor.playerId,action:'EVENT_ATTENDANCE_RESOLVED',targetType:'EVENT_PARTICIPANT',targetId:eventId+'/'+playerId,reason:reason.trim(),before:signup.data()?.attendanceStatus,after:status});
  });return {success:true};
});
