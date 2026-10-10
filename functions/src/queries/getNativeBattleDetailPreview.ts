import {getStorage} from 'firebase-admin/storage';
import {HttpsError,onCall} from 'firebase-functions/v2/https';
import {requireLeaguePlayer} from '../auth/authorization.js';
import {db} from '../config/firebase.js';
import {callableOptions} from '../config/runtime.js';
import {assertNativeValidationAllowed,bindingDigest,NATIVE_VALIDATION} from '../engines/nativeRecordingIntegration.js';
import {decodeNativeDetailArtifact,selectNativeBattleDetail,type NativeDetailRequest} from '../engines/nativeStatisticsDetail.js';

const SHA=/^[0-9a-f]{64}$/;
const ID=/^[A-Za-z0-9_-]{1,200}$/;
type Bag=Record<string,any>;
const precondition=(message:string)=>new HttpsError('failed-precondition',message);
const aborted=()=>new HttpsError('aborted','Native validation authority or candidate changed; retry.');
const invalid=(message:string)=>new HttpsError('invalid-argument',message);

export interface NativeDetailPreviewInput extends NativeDetailRequest {
  matchId:string;
  gameId:string;
  candidateId:string;
}

/** Restricted to the administrator who created this *non-active* candidate.
 * Strict current-state token comparison also refuses stale roster/authority or
 * Game changes; this cannot access any active replaySource or score ledger.
 */
export async function readNativeDetailPreview(input:{
  db:any;
  bucket:any;
  actor:{playerId:string;authUid:string;role:string};
  request:NativeDetailPreviewInput;
  env:NodeJS.ProcessEnv;
}) {
  const {db,bucket,actor,request,env}=input;
  if(!request||!ID.test(request.matchId??'')||!ID.test(request.gameId??'')||
    !SHA.test(request.candidateId??''))throw invalid('Invalid native preview Game or candidate ID.');
  let pinned:string;
  try{pinned=assertNativeValidationAllowed(env,actor.role,request.matchId,request.gameId);}
  catch{throw precondition('Native evidence preview is disabled or not authorized.');}
  const matchRef=db.collection('matches').doc(request.matchId);
  const gameRef=matchRef.collection('games').doc(request.gameId);
  const candidateRef=gameRef.collection('nativeReplayValidations').doc(request.candidateId);
  const adminRef=db.collection('players').doc(actor.playerId);
  const linkRef=db.collection('authLinks').doc(actor.authUid);
  const firstCandidate=await candidateRef.get();
  const c=firstCandidate.data() as Bag|undefined;
  if(!firstCandidate.exists||!c||c.contract!==NATIVE_VALIDATION||
    c.state!=='VALIDATED_NOT_READY'||c.active!==false||
    c.leagueEffectsPermitted!==false||c.validatedBy!==actor.playerId||
    c.processorRevision!==pinned||c.matchId!==request.matchId||c.gameId!==request.gameId)
    throw precondition('Native validation candidate is not eligible for private detail inspection.');
  const source=c.sourceHash,rev=c.artifactRevision,metadata=c.statistics as Bag|undefined;
  const prefix='native-replay-evidence/'+request.matchId+'/'+request.gameId+'/'+source+'/'+rev+'/';
  if(!SHA.test(source??'')||!SHA.test(rev??'')||!metadata||
    metadata.path!==prefix+'statistics.direct.json.gz'||
    !/^[0-9]+$/.test(String(metadata.generation??''))||
    c.originalRecording?.permanent!==true||c.originalRecording?.sourceDeletionAuthorized!==false||
    c.recordedEvents?.datasetVersion!=='AOF_RECORDED_EVENTS_V1'||
    !SHA.test(c.recordedEvents?.sha256??'')||
    c.provenance?.sourceIdentity!==source||c.provenance?.projectionRevision!==metadata.sha256||
    c.provenance?.extractionRevision!==c.extraction?.revision||
    !SHA.test(c.bindingToken??''))
    throw precondition('Native validation candidate has incomplete evidence bindings.');

  const authority=async()=>{
    const [match,game,admin,link]=await Promise.all([
      matchRef.get(),gameRef.get(),adminRef.get(),linkRef.get(),
    ]);
    if(!match.exists||!game.exists||!admin.exists||!link.exists||
      admin.data()?.membershipStatus!=='ACTIVE'||admin.data()?.role!=='ADMIN'||
      link.data()?.playerId!==actor.playerId)
      throw aborted();
    const gameData=game.data(),matchData=match.data();
    const ids=(gameData.players??[]).map((p:Bag)=>p.playerId);
    if(ids.length<2||ids.length>8||ids.some((id:unknown)=>typeof id!=='string'||!id)||
      new Set(ids).size!==ids.length)throw aborted();
    const players=await Promise.all(ids.map((id:string)=>db.collection('players').doc(id).get()));
    if(players.some((p:any)=>!p.exists))throw aborted();
    return bindingDigest({game:gameData,match:matchData,players:players.map((p:any)=>p.data()),
      admin:admin.data(),link:link.data()});
  };
  const initial=await authority();
  if(initial!==c.bindingToken)throw aborted();
  let bytes:Buffer;
  try{
    // Generation-pinned immutable read: never select the latest generation.
    [bytes]=await bucket.file(metadata.path,{generation:String(metadata.generation)}).download();
  }catch{throw new HttpsError('data-loss','Native detail evidence could not be read from its pinned generation.');}
  let raw:Bag;
  try{
    raw=decodeNativeDetailArtifact(bytes,metadata,{
      sourceHash:source,eventsSha256:c.recordedEvents.sha256,
      extractionRunId:c.extraction.revision,
    });
  }catch{throw new HttpsError('data-loss','Native detail evidence failed integrity or revision validation.');}
  const secondCandidate=await candidateRef.get();
  if(!secondCandidate.exists||bindingDigest(secondCandidate.data())!==bindingDigest(c)||
    await authority()!==initial)throw aborted();

  let result:Bag;
  try{result=selectNativeBattleDetail(raw,metadata.sha256,request);}
  catch{throw invalid('Invalid or unavailable native episode selection or cursor.');}
  return {
    success:true,state:'VALIDATED_NOT_READY',activated:false,
    candidateId:request.candidateId,matchId:request.matchId,gameId:request.gameId,
    ...result,
  };
}

function bucketName(){
  const configured=process.env.REPLAY_BUCKET?.trim();
  if(configured)return configured;
  const project=process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT;
  if(!project)throw precondition('Native detail evidence bucket is not configured.');
  return project+'.appspot.com';
}

/** Explicitly admin/private preview only. No normal website or active-Game route. */
export const getNativeBattleDetailPreview=onCall<NativeDetailPreviewInput>(
  {...callableOptions,memory:'1GiB',timeoutSeconds:120},async request=>{
    const actor=await requireLeaguePlayer(request);
    return readNativeDetailPreview({db,bucket:getStorage().bucket(bucketName()),
      actor,request:request.data,env:process.env});
  },
);
