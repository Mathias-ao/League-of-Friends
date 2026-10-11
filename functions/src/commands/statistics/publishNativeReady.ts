import {getStorage} from 'firebase-admin/storage';
import {onCall} from 'firebase-functions/v2/https';
import {requireAdmin} from '../../auth/authorization.js';
import {db} from '../../config/firebase.js';
import {callableOptions} from '../../config/runtime.js';
import {executeNativeReadyPublication,type NativeReadyPublicationRequest} from '../../services/nativeReadyPublication.js';

/** Explicit admin review workflow, disabled by default and never production.
 * The source is published by the transaction only after pinned evidence checks.
 * This callable does not rewrite Game winners, League points or social scores.
 */
export const adminPublishNativeReady=onCall<NativeReadyPublicationRequest>(
  {...callableOptions,memory:'1GiB',timeoutSeconds:120},async request=>{
    const actor=await requireAdmin(request);
    const configured=process.env.REPLAY_BUCKET?.trim();
    const project=process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT;
    const bucket=configured??(project?project+'.appspot.com':'');
    return executeNativeReadyPublication({
      db,bucket:getStorage().bucket(bucket),
      actor,request:request.data,env:process.env,
    });
  },
);
