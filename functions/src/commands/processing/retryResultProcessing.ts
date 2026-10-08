import {randomUUID} from 'node:crypto';
import {HttpsError,onCall} from 'firebase-functions/v2/https';
import {requireAdmin} from '../../auth/authorization.js';
import {db} from '../../config/firebase.js';
import {callableOptions} from '../../config/runtime.js';
import {competitionId} from '../../services/competitionInput.js';
import {runResultProcessingJob} from '../../triggers/processResultJob.js';
import {resultProcessingJobId} from '../results/resultSupport.js';
import {writeAdminAudit} from '../../services/audit.js';
export const adminRetryResultProcessing=onCall({...callableOptions,timeoutSeconds:540},async request=>{
  const actor=await requireAdmin(request),{matchId,reason}=request.data;competitionId(matchId,'Battle');
  if(typeof reason!=='string'||reason.trim().length<8||reason.length>1000)throw new HttpsError('invalid-argument','Explain why result processing should be retried.');
  const ref=db.collection('matches').doc(matchId);
  const jobRef=await db.runTransaction(async tx=>{
    const match=(await tx.get(ref)).data();
    if(match?.status!=='COMPLETED'||match.activeResultDisputeId||!match.canonicalResult)throw new HttpsError('failed-precondition','Resolve the Battle result before retrying processing.');
    const job=db.collection('processingJobs').doc(resultProcessingJobId(matchId,match.canonicalResult.revision)),snapshot=await tx.get(job);
    if(!snapshot.exists||['BLOCKED','SUPERSEDED'].includes(snapshot.data()?.status))throw new HttpsError('failed-precondition','No current retryable processing job exists.');
    writeAdminAudit(tx,{actorUid:actor.authUid,actorPlayerId:actor.playerId,action:'RESULT_PROCESSING_RETRIED',targetType:'MATCH',targetId:matchId,reason:reason.trim()});return job;
  });
  await runResultProcessingJob(jobRef,'ADMIN_RETRY_'+randomUUID());
  const job=(await jobRef.get()).data();
  return {success:job?.status==='COMPLETED',pendingSteps:job?.pendingSteps??[],lastError:job?.lastError??null};
});
