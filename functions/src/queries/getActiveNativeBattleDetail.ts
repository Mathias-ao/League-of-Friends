import {getStorage} from 'firebase-admin/storage';
import {HttpsError,onCall} from 'firebase-functions/v2/https';
import {requireLeaguePlayer} from '../auth/authorization.js';
import {db} from '../config/firebase.js';
import {callableOptions} from '../config/runtime.js';
import {activeNativeStatisticsSource} from '../engines/activeNativeStatisticsSource.js';
import {bindingDigest} from '../engines/nativeRecordingIntegration.js';
import {decodeNativeDetailArtifact,selectNativeBattleDetail,
  type NativeDetailRequest,type NativeDetailArtifact} from '../engines/nativeStatisticsDetail.js';

const ID=/^[A-Za-z0-9_-]{1,200}$/;
const abort=()=>new HttpsError('aborted','Battle evidence, official outcome or access changed during the read. Retry.');
const fail=()=>new HttpsError('failed-precondition','No qualified active native Battle detail is available.');
const corruption=()=>new HttpsError('data-loss','The active native Battle evidence failed integrity verification.');
type Bag=Record<string,any>;
export interface ActiveNativeBattleDetailRequest extends NativeDetailRequest {
  matchId:string;
  gameId:string;
}

/** Read ONLY from the official active READY replaySources pointer.
 *
 * No native validation candidate ID is accepted as input. Neither an admin
 * preview nor a Storage artifact is sufficient authority for player visibility.
 * An activated native publisher is intentionally not implemented here.
 */
export async function readActiveNativeBattleDetail(input:{
  db:any;bucket:any;actor:{playerId:string;authUid:string};
  request:ActiveNativeBattleDetailRequest;env:NodeJS.ProcessEnv;
}) {
  const {db,bucket,actor,request,env}=input;
  if(!request||!ID.test(request.matchId??'')||!ID.test(request.gameId??''))
    throw new HttpsError('invalid-argument','Invalid Battle identifiers.');
  if(env.AOF_ACTIVE_NATIVE_PLAYER_READS!=='1')throw fail();
  const matchRef=db.collection('matches').doc(request.matchId);
  const gameRef=matchRef.collection('games').doc(request.gameId);
  const playerRef=db.collection('players').doc(actor.playerId);
  const linkRef=db.collection('authLinks').doc(actor.authUid);

  const initial=await Promise.all([matchRef.get(),gameRef.get(),playerRef.get(),linkRef.get()]);
  const [match,game,player,link]=initial;
  if(!player.exists||!link.exists||
     player.data()?.membershipStatus!=='ACTIVE'||
     link.data()?.playerId!==actor.playerId)throw new HttpsError('permission-denied','League access is unavailable.');
  if(!match.exists||!game.exists)throw fail();
  const sourceId=game.data()?.activeReplayStatisticsId;
  if(typeof sourceId!=='string')throw fail();
  const sourceRef=gameRef.collection('replaySources').doc(sourceId);
  const src=await sourceRef.get();
  const eligible=activeNativeStatisticsSource(request.matchId,request.gameId,
    match.data(),game.data(),sourceId,src.data(),true);
  if(!src.exists||!eligible)throw fail();

  const metadata=eligible.artifact as NativeDetailArtifact&{path:string;generation:string};
  const before=initial.map(x=>bindingDigest(x.data()));
  const sourceToken=bindingDigest(src.data());
  let bytes:Buffer;
  try{
    [bytes]=await bucket.file(metadata.path,{generation:String(metadata.generation)}).download();
  }catch{throw corruption();}
  let raw:Bag;
  try{
    raw=decodeNativeDetailArtifact(bytes,metadata,{
      sourceHash:sourceId,
      eventsSha256:eligible.eventsSha256,
      extractionRunId:eligible.extractionRunId,
    });
    // The byte-stream's player identities must map to the current qualified Game.
    const slots=new Set((eligible.source.playerMapping as Bag[]).map(m=>m.replaySlot));
    if(!Array.isArray(raw.participants)||raw.participants.length!==slots.size||
       raw.participants.some((p:Bag)=>!slots.has(p?.replaySlot)||p.playerId!==p.replaySlot))
      throw new Error('Native player attribution mismatch.');
  }catch{throw corruption();}

  // Post-download fence: prevents serving a replaced/corrected/disputed Game or
  // a revoked membership from an earlier read snapshot.
  const after=await Promise.all([matchRef.get(),gameRef.get(),playerRef.get(),linkRef.get()]);
  if(after.some((snap:any,i:number)=>!snap.exists||bindingDigest(snap.data())!==before[i]))
    throw abort();
  const active=after[1].data()?.activeReplayStatisticsId;
  if(active!==sourceId)throw abort();
  const sourceAfter=await sourceRef.get();
  if(!sourceAfter.exists||bindingDigest(sourceAfter.data())!==sourceToken||
     !activeNativeStatisticsSource(request.matchId,request.gameId,
       after[0].data(),after[1].data(),sourceId,sourceAfter.data(),true))
    throw abort();
  let selection:Bag;
  try{selection=selectNativeBattleDetail(raw,metadata.sha256,request);}
  catch{throw new HttpsError('invalid-argument','Invalid native episode selection or revision cursor.');}
  return {success:true,delivery:'NATIVE_BOUNDED_V1',state:'READY',
    matchId:request.matchId,gameId:request.gameId,statisticsId:sourceId,
    ...selection};
}

function bucketName(){
  const value=process.env.REPLAY_BUCKET?.trim();
  if(value)return value;
  const project=process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT;
  if(!project)throw fail();
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
