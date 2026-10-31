import {getStorage} from 'firebase-admin/storage';
import {HttpsError,onCall} from 'firebase-functions/v2/https';
import {requireLeaguePlayer} from '../auth/authorization.js';
import {db} from '../config/firebase.js';
import {callableOptions} from '../config/runtime.js';
import {projectPrivateHonoursPreview} from '../integration/privateHonoursPreview.js';
import {collectMyCurrentBattleHistory,INT_B_LIMITS} from './getMyPersonalityHistory.js';

export function assertPrivateHonoursPreviewEnabled(env:NodeJS.ProcessEnv){
  const project=env.GCLOUD_PROJECT||env.GOOGLE_CLOUD_PROJECT;
  if(env.AOF_HONOURS_PRIVATE_PREVIEW!=='source-v1'||env.FUNCTIONS_EMULATOR!=='true'||!project?.startsWith('demo-'))
    throw new HttpsError('failed-precondition','Private honours testing is disabled.');
}
export async function readMyHonoursPreview(input:Parameters<typeof collectMyCurrentBattleHistory>[0]){
  assertPrivateHonoursPreviewEnabled(input.env);
  const current=await collectMyCurrentBattleHistory(input);
  const response=projectPrivateHonoursPreview(input.actor.playerId,current);
  if(Buffer.byteLength(JSON.stringify(response))>INT_B_LIMITS.maxResponseBytes)
    throw new HttpsError('resource-exhausted','Private honours preview exceeds its complete-response budget.');
  await current.revalidate();
  return response;
}
export const getMyHonoursPreview=onCall({...callableOptions,timeoutSeconds:120,memory:'1GiB'},async request=>{
  const actor=await requireLeaguePlayer(request),project=process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT;
  return readMyHonoursPreview({db,bucket:getStorage().bucket(process.env.REPLAY_BUCKET||project+'.appspot.com'),actor,
    request:request.data,env:process.env});
});
