import {HttpsError} from 'firebase-functions/v2/https';
import {activeNativeStatisticsSource} from '../engines/activeNativeStatisticsSource.js';
import {bindingDigest} from '../engines/nativeRecordingIntegration.js';
import {decodeNativeDetailArtifact,type NativeDetailArtifact} from '../engines/nativeStatisticsDetail.js';
import {currentOfficialGameOutcome} from '../engines/recordingMatchFacts.js';

const ID=/^[A-Za-z0-9_-]{1,200}$/;
type Bag=Record<string,any>;
const abort=()=>new HttpsError('aborted','Battle evidence, official outcome or access changed during the read. Retry.');
const fail=()=>new HttpsError('failed-precondition','No qualified active native Battle evidence is available.');
const corruption=()=>new HttpsError('data-loss','The active native Battle evidence failed integrity verification.');

/**
 * One authenticated read boundary for native Battle-detail and recording/social
 * review. Never uses nativeReplayValidations or trusts paths supplied by clients.
 * This is not a native publisher and does not create an active READY source.
 */
export async function loadActiveNativeEvidence(input:{
  db:any;bucket:any;actor:{playerId:string;authUid:string};
  matchId:string;gameId:string;env:NodeJS.ProcessEnv;allowPending?:boolean;
}):Promise<{statistics:Bag;source:Bag;artifactSha256:string;sourceId:string;officialOutcome:Bag;revalidate:()=>Promise<void>}>{
  const {db,bucket,actor,matchId,gameId,env}=input;
  if(!ID.test(matchId??'')||!ID.test(gameId??''))
    throw new HttpsError('invalid-argument','Invalid Battle identifiers.');
  if(env.AOF_ACTIVE_NATIVE_PLAYER_READS!=='1')throw fail();

  const matchRef=db.collection('matches').doc(matchId);
  const gameRef=matchRef.collection('games').doc(gameId);
  const playerRef=db.collection('players').doc(actor.playerId);
  const linkRef=db.collection('authLinks').doc(actor.authUid);
  const initial=await Promise.all([matchRef.get(),gameRef.get(),playerRef.get(),linkRef.get()]);
  const [match,game,player,link]=initial;
  if(!player.exists||!link.exists||player.data()?.membershipStatus!=='ACTIVE'||
     link.data()?.playerId!==actor.playerId)
    throw new HttpsError('permission-denied','League access is unavailable.');
  if(!match.exists||!game.exists)throw fail();
  const sourceId=game.data()?.activeReplayStatisticsId;
  if(typeof sourceId!=='string')throw fail();
  const sourceRef=gameRef.collection('replaySources').doc(sourceId);
  const src=await sourceRef.get();
  const eligible=activeNativeStatisticsSource(matchId,gameId,match.data(),game.data(),
    sourceId,src.data(),true,input.allowPending===true);
  if(!src.exists||!eligible)throw fail();

  const metadata=eligible.artifact as NativeDetailArtifact&{path:string;generation:string};
  const before=initial.map(s=>bindingDigest(s.data()));
  const sourceToken=bindingDigest(src.data());
  let bytes:Buffer;
  try{[bytes]=await bucket.file(metadata.path,{generation:String(metadata.generation)}).download();}
  catch{throw corruption();}
  let raw:Bag;
  try{
    raw=decodeNativeDetailArtifact(bytes,metadata,{
      sourceHash:sourceId,eventsSha256:eligible.eventsSha256,
      extractionRunId:eligible.extractionRunId,
    });
    const slots=new Set((eligible.source.playerMapping as Bag[]).map(m=>m.replaySlot));
    if(!Array.isArray(raw.participants)||raw.participants.length!==slots.size||
       raw.participants.some((p:Bag)=>!slots.has(p?.replaySlot)||p.playerId!==p.replaySlot))
      throw new Error('Native player attribution mismatch.');
  }catch{throw corruption();}

  // Optimistic correction and membership fence. Even a source document rewrite
  // that retains its ID is an invalid read, not a new social interpretation.
  const revalidate=async()=>{
    const after=await Promise.all([matchRef.get(),gameRef.get(),playerRef.get(),linkRef.get()]);
    if(after.some((snap:any,i:number)=>!snap.exists||bindingDigest(snap.data())!==before[i]))
      throw abort();
    if(after[1].data()?.activeReplayStatisticsId!==sourceId)throw abort();
    const sourceAfter=await sourceRef.get();
    if(!sourceAfter.exists||bindingDigest(sourceAfter.data())!==sourceToken||
       !activeNativeStatisticsSource(matchId,gameId,after[0].data(),after[1].data(),
         sourceId,sourceAfter.data(),true,input.allowPending===true))throw abort();
  };
  await revalidate();

  return {statistics:raw,source:eligible.source,artifactSha256:metadata.sha256,sourceId,
    officialOutcome:currentOfficialGameOutcome(game.data(),match.data()),revalidate};
}
