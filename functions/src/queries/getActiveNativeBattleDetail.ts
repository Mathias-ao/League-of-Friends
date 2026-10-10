import {getStorage} from 'firebase-admin/storage';
import {HttpsError,onCall} from 'firebase-functions/v2/https';
import {requireLeaguePlayer} from '../auth/authorization.js';
import {db} from '../config/firebase.js';
import {callableOptions} from '../config/runtime.js';
import {selectNativeBattleDetail,type NativeDetailRequest} from '../engines/nativeStatisticsDetail.js';
import {loadActiveNativeEvidence} from './activeNativeEvidenceRead.js';

export interface ActiveNativeBattleDetailRequest extends NativeDetailRequest {
  matchId:string;
  gameId:string;
}

/** One qualified source and correction fence shared with the native Battle
 * record; player episodes are still fetched a bounded fragment at a time. */
export async function readActiveNativeBattleDetail(input:{
  db:any;bucket:any;actor:{playerId:string;authUid:string};
  request:ActiveNativeBattleDetailRequest;env:NodeJS.ProcessEnv;
}) {
  const {request}=input;
  const eligible=await loadActiveNativeEvidence({
    db:input.db,bucket:input.bucket,actor:input.actor,
    matchId:request?.matchId,gameId:request?.gameId,env:input.env,
  });
  let selection:Record<string,any>;
  try{selection=selectNativeBattleDetail(eligible.statistics,eligible.artifactSha256,request);}
  catch{throw new HttpsError('invalid-argument','Invalid native episode selection or revision cursor.');}
  return {success:true,delivery:'NATIVE_BOUNDED_V1',state:'READY',
    matchId:request.matchId,gameId:request.gameId,statisticsId:eligible.sourceId,
    ...selection};
}

function bucketName(){
  const value=process.env.REPLAY_BUCKET?.trim();
  if(value)return value;
  const project=process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT;
  if(!project)throw new HttpsError('failed-precondition','Native evidence bucket is not configured.');
  return project+'.appspot.com';
}

export const getActiveNativeBattleDetail=onCall<ActiveNativeBattleDetailRequest>(
  {...callableOptions,timeoutSeconds:120,memory:'1GiB'},async request=>{
    const actor=await requireLeaguePlayer(request);
    return readActiveNativeBattleDetail({
      db,bucket:getStorage().bucket(bucketName()),actor,request:request.data,env:process.env,
    });
  },
);
