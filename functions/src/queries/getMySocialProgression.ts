import {getStorage} from 'firebase-admin/storage';
import {HttpsError,onCall} from 'firebase-functions/v2/https';
import {requireLeaguePlayer} from '../auth/authorization.js';
import {db} from '../config/firebase.js';
import {callableOptions} from '../config/runtime.js';
import {bindingDigest,digest} from '../engines/nativeRecordingIntegration.js';
import type {CalibratedSocialHistoryRules,HistoricalChapter} from '../engines/socialV1History/history.js';
import {bindSourceGrades,simulatePrivateProgression} from '../integration/privateProgression.js';
import {collectMyCurrentBattleHistory} from './getMyPersonalityHistory.js';
import {callVerifiedWorker} from '../services/nativeRecordingValidation.js';
type Input=Parameters<typeof collectMyCurrentBattleHistory>[0]&{derive?:(p:Record<string,any>)=>Promise<Record<string,any>>};
export function assertPrivateProgressionEnabled(env:NodeJS.ProcessEnv){
 const project=env.GCLOUD_PROJECT||env.GOOGLE_CLOUD_PROJECT;
 let host='';try{host=new URL(env.REPLAY_WORKER_URL??'').hostname;}catch{/* Reject before source I/O. */}
 if(env.AOF_SOCIAL_E2E_PRIVATE_PROGRESS!=='pilot-v1'||env.FUNCTIONS_EMULATOR!=='true'||!project?.startsWith('demo-')||
  !['127.0.0.1','localhost','[::1]'].includes(host))throw new HttpsError('failed-precondition','Private progression simulation is disabled.');
}
export async function readMySocialProgression(input:Input){
 const {env,actor,bucket}=input;assertPrivateProgressionEnabled(env);
 // #166 is deliberately loaded only AFTER an explicit demo-emulator guard.
 const {createSocialE2EPilotCalibration}=await import('../engines/socialV1History/e2ePilotCalibration.js');
 const calibration=createSocialE2EPilotCalibration() as CalibratedSocialHistoryRules;
 const current=await collectMyCurrentBattleHistory({...input,maxOwnGames:8,includeScheduleOrder:true});
 const bound=[],chapters:HistoricalChapter[]=[],pending=[...current.pending];
 const artifact=async(meta:any)=>{
  if(!meta||!Number.isSafeInteger(meta.bytes)||meta.bytes<1||meta.bytes>16*1024*1024||!Number.isSafeInteger(meta.uncompressedBytes)||meta.uncompressedBytes<1||meta.uncompressedBytes>128*1024*1024)
   throw new HttpsError('resource-exhausted','Retained artifact exceeds private simulation budget.');
  let bytes:Buffer;try{[bytes]=await bucket.file(meta.path,{generation:String(meta.generation)}).download();
   if(bytes.length!==meta.bytes||digest(bytes)!==meta.sha256)throw new Error('digest');
  }catch{throw new HttpsError('data-loss','Retained source integrity verification failed.');}
  return {metadata:meta,base64:bytes.toString('base64')};
 };
 for(const loaded of current.loaded){
  const source=loaded.source,schedule=current.scheduleOrders.find(o=>o.battleId===source.battleId&&o.gameId===source.gameId);
  chapters.push({battleId:source.battleId,matchId:source.matchId,gameId:source.gameId,gameGuid:source.gameGuid,eventId:source.eventId,seasonId:source.seasonId,
   sourceAuthority:source.authorityRevision,revision:source.statisticsRevision,state:'READY',order:schedule?.order??null});
  const payload={snapshot:source,events:await artifact(loaded.recordedEvents),statisticsArtifact:await artifact(loaded.statisticsArtifact),
   historicalOrder:{leagueOrderKey:null,gameNumber:loaded.game.gameNumber,order:'UNKNOWN'}};
  if(Buffer.byteLength(JSON.stringify(payload))>40*1024*1024)throw new HttpsError('resource-exhausted','Private simulation transport budget exceeded.');
  let raw;
  try{raw=await(input.derive??(p=>callVerifiedWorker(env.REPLAY_WORKER_URL!,'/social-e2e-progression-v1',p)))(payload);}
  catch{pending.push({battleId:source.battleId,gameId:source.gameId,reason:'SOURCE_METHOD_UNAVAILABLE'});continue;}
  try{bound.push(bindSourceGrades(raw,source,loaded.statistics,env.AOF_NATIVE_REPLAY_PROCESSOR_REVISION??'',schedule,loaded.game.gameNumber,calibration));}
  catch{throw new HttpsError('data-loss','Source grade response did not match current actor, method and episode authority.');}
 }
 const inputDigest=bindingDigest([current.inputDigest,current.scheduleOrders,bound.map(b=>b.sourceMethodRevision),calibration,pending]);
 const response={...simulatePrivateProgression(actor.playerId,bound,chapters,calibration,pending,inputDigest),
  sources:current.loaded.map(s=>s.source),scheduleOrders:current.scheduleOrders,coverage:current.coverage,
  chronicleBinding:{version:'AOF_SOCIAL_PRIVATE_CHRONICLE_SEAM_1',inputDigest,
   sourceRevisions:current.loaded.map(s=>s.source.authorityRevision),scheduleRevisions:current.scheduleOrders.map(s=>s.revision),
   invitationAuthority:false,judgmentAuthority:false}};
 if(Buffer.byteLength(JSON.stringify(response))>4*1024*1024)throw new HttpsError('resource-exhausted','Complete private progression response exceeds budget.');
 await current.revalidate();return response;
}
export const getMySocialProgression=onCall({...callableOptions,timeoutSeconds:120,memory:'1GiB',secrets:['REPLAY_WORKER_AUTH_TOKEN']},async request=>{
 const actor=await requireLeaguePlayer(request),project=process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT;
 return readMySocialProgression({db,bucket:getStorage().bucket(process.env.REPLAY_BUCKET||project+'.appspot.com'),actor,request:request.data,env:process.env});
});
