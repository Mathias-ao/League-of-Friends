import {getStorage} from 'firebase-admin/storage';
import {HttpsError,onCall} from 'firebase-functions/v2/https';
import {requireLeaguePlayer} from '../auth/authorization.js';
import {db} from '../config/firebase.js';
import {callableOptions} from '../config/runtime.js';
import {bindingDigest,digest} from '../engines/nativeRecordingIntegration.js';
import {validateC1Worker,projectC1History} from '../integration/gameplayPreview.js';
import {C2A_VERSION,validateC2AWorker} from '../integration/gameplayCandidates.js';
import {collectMyCurrentBattleHistory} from './getMyPersonalityHistory.js';
import {callVerifiedWorker} from '../services/nativeRecordingValidation.js';

type Bag=Record<string,any>;
type PreviewInput=Parameters<typeof collectMyCurrentBattleHistory>[0]&{derive?:(payload:Bag)=>Promise<Bag>};
async function readPreview(input:PreviewInput,candidatesMode:boolean){
  const {env,actor,bucket}=input;
  if(env.AOF_INT_C1_PRIVATE_PREVIEW!=='wiring-test-v1')throw new HttpsError('failed-precondition','Gameplay preview is disabled.');
  if(candidatesMode&&env.AOF_INT_C2A_PRIVATE_PREVIEW!=='source-compatible-v1')throw new HttpsError('failed-precondition','Source-compatible preview is disabled.');
  const current=await collectMyCurrentBattleHistory({...input,maxOwnGames:8});
  const sources=[],episodes=[];
  for(const loaded of current.loaded){
    const meta=loaded.recordedEvents;
    if(!Number.isSafeInteger(meta.bytes)||meta.bytes<1||meta.bytes>16*1024*1024||
      !Number.isSafeInteger(meta.uncompressedBytes)||meta.uncompressedBytes<1||meta.uncompressedBytes>128*1024*1024)
      throw new HttpsError('resource-exhausted','Retained events exceed the bounded private preview budget.');
    let bytes:Buffer;
    try{[bytes]=await bucket.file(meta.path,{generation:String(meta.generation)}).download();
      if(bytes.length!==meta.bytes||digest(bytes)!==meta.sha256)throw new Error('digest');
    }catch{throw new HttpsError('data-loss','Retained original event integrity verification failed.');}
    // Lossless top-level input allowlist for the existing Context/#149 consumers.
    // sharedEpisodeDelivery is a large unrelated Battle detail read model. Keep
    // full verified statistics locally for admission; do not expand or reparse it.
    const statistics=Object.fromEntries(['source','scope','statisticsProjectionVersion','matchFacts','pairSocialEvidence','participants']
      .map(key=>[key,loaded.statistics[key]]));
    const payload={snapshot:loaded.source,statistics,events:{metadata:meta,base64:bytes.toString('base64')},
      historicalOrder:{leagueOrderKey:null,gameNumber:loaded.game.gameNumber,order:'UNKNOWN'}};
    if(Buffer.byteLength(JSON.stringify(payload))>40*1024*1024)throw new HttpsError('resource-exhausted','Private preview transport budget exceeded.');
    const raw=await (input.derive??(p=>callVerifiedWorker(env.REPLAY_WORKER_URL??'',candidatesMode?'/social-grade-candidates-preview-v1':'/social-grade-preview-v1',p)))(payload);
    let preview;try{if(candidatesMode){const bound=validateC2AWorker(raw,loaded.source,loaded.statistics,env.AOF_NATIVE_REPLAY_PROCESSOR_REVISION??'');
      preview=bound.legacy;episodes.push(...bound.episodes.filter(e=>e.binding.actorPlayerId===actor.playerId));
    }else preview=validateC1Worker(raw,loaded.source,loaded.statistics,env.AOF_NATIVE_REPLAY_PROCESSOR_REVISION??'');}
    catch{throw new HttpsError('data-loss','Gameplay preview response did not match source/actor/method admission.');}
    sources.push({source:loaded.source,preview});
  }
  const revision=bindingDigest(candidatesMode?[C2A_VERSION,current.inputDigest,sources,episodes]:[current.inputDigest,sources]);
  const base={...projectC1History(actor.playerId,sources,revision),coverage:current.coverage,
    pendingSources:current.pending,sources:current.loaded.map(s=>s.source)};
  const {grades,inferences,claims,...common}=base;
  const response=candidatesMode?{...common,version:C2A_VERSION,episodes,
    legacyPending:{version:base.version,claimIds:claims.map(c=>c.claimId),inferenceIds:inferences.map(i=>i.inferenceId)}}:base;
  if(Buffer.byteLength(JSON.stringify(response))>4*1024*1024)throw new HttpsError('resource-exhausted','Complete private preview exceeds response budget.');
  await current.revalidate();
  return response;
}
export const readMyGameplayPreview=(input:PreviewInput)=>readPreview(input,false);
export const readMyGameplayCandidates=(input:PreviewInput)=>readPreview(input,true);
export const getMyGameplayCandidates=onCall({...callableOptions,timeoutSeconds:120,memory:'1GiB',secrets:['REPLAY_WORKER_AUTH_TOKEN']},async request=>{
  const actor=await requireLeaguePlayer(request),project=process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT;
  return readMyGameplayCandidates({db,bucket:getStorage().bucket(process.env.REPLAY_BUCKET||project+'.appspot.com'),actor,request:request.data,env:process.env});
});
export const getMyGameplayPreview=onCall({...callableOptions,timeoutSeconds:120,memory:'1GiB',secrets:['REPLAY_WORKER_AUTH_TOKEN']},async request=>{
  const actor=await requireLeaguePlayer(request),project=process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT;
  return readMyGameplayPreview({db,bucket:getStorage().bucket(process.env.REPLAY_BUCKET||project+'.appspot.com'),actor,request:request.data,env:process.env});
});
