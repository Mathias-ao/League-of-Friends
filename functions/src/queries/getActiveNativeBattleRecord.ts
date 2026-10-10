import {getStorage} from 'firebase-admin/storage';
import {HttpsError,onCall} from 'firebase-functions/v2/https';
import {requireLeaguePlayer} from '../auth/authorization.js';
import {db} from '../config/firebase.js';
import {callableOptions} from '../config/runtime.js';
import {loadActiveNativeEvidence} from './activeNativeEvidenceRead.js';
import {projectNativeBattleRecord,selectNativeBattleRecord,
  type NativeRecordRequest} from '../engines/nativeBattleRecordRead.js';

export interface NativeBattleRecordInput extends NativeRecordRequest {
  matchId:string;
  gameId:string;
}

/** Full official result is read from the current Game, never replay scores.
 * Derived social interpretation stays shadow-only. Neutral incident rows and
 * interpretations are paged, and large sections use 32-KiB verified fragments.
 */
export async function readActiveNativeBattleRecord(input:{
  db:any;bucket:any;actor:{playerId:string;authUid:string};
  request:NativeBattleRecordInput;env:NodeJS.ProcessEnv;
}){
  const request=input.request;
  if(input.env.AOF_ACTIVE_NATIVE_SOCIAL_READS!=='1')
    throw new HttpsError('failed-precondition','Native social record reading is not enabled.');
  const active=await loadActiveNativeEvidence({db:input.db,bucket:input.bucket,
    actor:input.actor,matchId:request?.matchId,gameId:request?.gameId,env:input.env});
  let projected:ReturnType<typeof projectNativeBattleRecord>;
  try{
    projected=projectNativeBattleRecord(active.statistics,active.source.playerMapping,
      active.officialOutcome,request.matchId+'/'+request.gameId,request.matchId);
  }catch{
    throw new HttpsError('data-loss','The retained native Battle record failed identity or neutral-evidence validation.');
  }
  let selected:Record<string,any>;
  try{
    selected=selectNativeBattleRecord(projected,active.artifactSha256,active.sourceId,request);
  }catch{
    throw new HttpsError('invalid-argument','Invalid native Battle-record section, cursor or revision.');
  }
  return {success:true,state:'READY',matchId:request.matchId,gameId:request.gameId,...selected};
}

function bucketName(){
  const value=process.env.REPLAY_BUCKET?.trim();
  if(value)return value;
  const project=process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT;
  if(!project)throw new HttpsError('failed-precondition','Native evidence bucket is not configured.');
  return project+'.appspot.com';
}

export const getActiveNativeBattleRecord=onCall<NativeBattleRecordInput>(
  {...callableOptions,memory:'1GiB',timeoutSeconds:120},async request=>{
    const actor=await requireLeaguePlayer(request);
    return readActiveNativeBattleRecord({
      db,bucket:getStorage().bucket(bucketName()),actor,request:request.data,env:process.env,
    });
  },
);
