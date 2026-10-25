import {getStorage} from 'firebase-admin/storage';
import {HttpsError,onCall} from 'firebase-functions/v2/https';
import {requireLeaguePlayer} from '../auth/authorization.js';
import {db} from '../config/firebase.js';
import {callableOptions} from '../config/runtime.js';
import {bindingDigest,digest} from '../engines/nativeRecordingIntegration.js';
import {validateC1Worker,projectC1History} from '../integration/gameplayPreview.js';
import {collectMyCurrentBattleHistory} from './getMyPersonalityHistory.js';
import {callVerifiedWorker} from '../services/nativeRecordingValidation.js';

type Bag=Record<string,any>;
export async function readMyGameplayPreview(input:Parameters<typeof collectMyCurrentBattleHistory>[0]&{
 derive?:(payload:Bag)=>Promise<Bag>}){
  const {env,actor,bucket}=input;
  if(env.AOF_INT_C1_PRIVATE_PREVIEW!=='wiring-test-v1')throw new HttpsError('failed-precondition','Gameplay preview is disabled.');
  const current=await collectMyCurrentBattleHistory({...input,maxOwnGames:8});
  const sources=[];
  for(const loaded of current.loaded){
    const meta=loaded.recordedEvents;
    if(!Number.isSafeInteger(meta.bytes)||meta.bytes<1||meta.bytes>16*1024*1024||
      !Number.isSafeInteger(meta.uncompressedBytes)||meta.uncompressedBytes<1||meta.uncompressedBytes>128*1024*1024)
      throw new HttpsError('resource-exhausted','Retained events exceed the bounded private preview budget.');
    let bytes:Buffer;
    try{[bytes]=await bucket.file(meta.path,{generation:String(meta.generation)}).download();
      if(bytes.length!==meta.bytes||digest(bytes)!==meta.sha256)throw new Error('digest');
    }catch{throw new HttpsError('data-loss','Retained original event integrity verification failed.');}
    const payload={snapshot:loaded.source,statistics:loaded.statistics,events:{metadata:meta,base64:bytes.toString('base64')},
      historicalOrder:{leagueOrderKey:null,gameNumber:loaded.game.gameNumber,order:'UNKNOWN'}};
    if(Buffer.byteLength(JSON.stringify(payload))>40*1024*1024)throw new HttpsError('resource-exhausted','Private preview transport budget exceeded.');
    const raw=await (input.derive??(p=>callVerifiedWorker(env.REPLAY_WORKER_URL??'','/social-grade-preview-v1',p)))(payload);
    let preview;try{preview=validateC1Worker(raw,loaded.source,loaded.statistics,env.AOF_NATIVE_REPLAY_PROCESSOR_REVISION??'');}
    catch{throw new HttpsError('data-loss','Gameplay preview response did not match source/actor/method admission.');}
    sources.push({source:loaded.source,preview});
  }
  const revision=bindingDigest([current.inputDigest,sources]);
  const response={...projectC1History(actor.playerId,sources,revision),coverage:current.coverage,
    pendingSources:current.pending,sources:current.loaded.map(s=>s.source)};
  if(Buffer.byteLength(JSON.stringify(response))>4*1024*1024)throw new HttpsError('resource-exhausted','Complete private preview exceeds response budget.');
  await current.revalidate();
  return response;
}
export const getMyGameplayPreview=onCall({...callableOptions,timeoutSeconds:120,memory:'1GiB',secrets:['REPLAY_WORKER_AUTH_TOKEN']},async request=>{
  const actor=await requireLeaguePlayer(request),project=process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT;
  return readMyGameplayPreview({db,bucket:getStorage().bucket(process.env.REPLAY_BUCKET||project+'.appspot.com'),actor,request:request.data,env:process.env});
});
