import {assertNativePlayerUploadAllowed,NATIVE_PLAYER_UPLOAD} from '../engines/nativePlayerUpload.js';
import {readNativePlayerAuthority} from './nativePlayerRecording.js';
import {randomUUID} from 'node:crypto';
import {GoogleAuth} from 'google-auth-library';
import {Timestamp,type Firestore} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import {assertNativeValidationAllowed,bindingDigest,digest,NATIVE_VALIDATION,READY_BLOCKERS,
  saveNativeArtifact,verifyMapping,verifyNativePackage} from '../engines/nativeRecordingIntegration.js';
import {projectStatistics,statisticsBindingKey} from '../engines/statisticsExperience.js';
import {augmentSeasonShowcase} from '../engines/seasonShowcaseProjection.js';
import {statisticsMetadata} from './statisticsExperienceProjection.js';

type Bag=Record<string,any>;
const fail=(message:string)=>new HttpsError('failed-precondition',message);
const changed=()=>new HttpsError('aborted','Native validation inputs or lease changed; retry.');

/** Only internal tests supply transport dependencies; request payloads cannot choose a token provider. */
interface NativeWorkerTransport {
  fetcher?:typeof fetch;
  getIdToken?:(audience:string)=>Promise<string>;
}

/** Native HTTP contract is explicit and bounded; legacy /process is never retried here.
 * A private Cloud Run service requires an IAM identity token in addition to its app bearer secret.
 * The IAM token is sent in X-Serverless-Authorization so Cloud Run does not consume the app bearer.
 */
export async function callNativeWorker(
  url:string,fileName:string,replayBase64:string,transport:NativeWorkerTransport={},
):Promise<Bag>{
  return callVerifiedWorker(url,'/process-native-v1',{fileName,replayBase64},transport);
}

/** Shared authenticated transport; route is server-selected, never a client URL. */
export async function callVerifiedWorker(url:string,route:'/process-native-v1'|'/social-evidence-v1a',payload:Bag,transport:NativeWorkerTransport={}):Promise<Bag>{
  const target=url.replace(/\/+$/,'');
  const parsed=new URL(target),loopback=['127.0.0.1','localhost'].includes(parsed.hostname);
  if(parsed.username||parsed.password||(!loopback&&parsed.protocol!=='https:')||
    (loopback&&!process.env.FUNCTIONS_EMULATOR)||!process.env.REPLAY_WORKER_AUTH_TOKEN)
    throw fail('Native worker requires authenticated HTTPS or an emulator loopback endpoint.');
  const headers:Record<string,string>={
    'content-type':'application/json',authorization:'Bearer '+process.env.REPLAY_WORKER_AUTH_TOKEN,
  };
  if(!process.env.FUNCTIONS_EMULATOR){
    const identity=transport.getIdToken
      ?await transport.getIdToken(target)
      :await (await new GoogleAuth().getIdTokenClient(target)).idTokenProvider.fetchIdToken(target);
    if(!identity)throw fail('Native Cloud Run identity token was not available.');
    headers['X-Serverless-Authorization']='Bearer '+identity;
  }
  const response=await (transport.fetcher??fetch)(target+route,{method:'POST',redirect:'error',
    headers,body:JSON.stringify(payload),signal:AbortSignal.timeout(240_000)});
  if(!response.ok){await response.body?.cancel();throw fail('Native worker rejected the recording; legacy was not invoked.');}
  if(!response.body)throw fail('Missing native worker response.');
  const reader=response.body.getReader(),chunks:Buffer[]=[];let total=0;
  try{while(true){const next=await reader.read();if(next.done)break;total+=next.value.length;
    if(total>(route==='/social-evidence-v1a'?1:70)*1024*1024)throw fail('Worker response exceeds transport limit.');chunks.push(Buffer.from(next.value));}}
  finally{await reader.cancel();}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

/** Uses real Firebase interfaces; the injectable worker is also used by emulator tests.
 * Candidate documents are NOT replaySources and can never activate legacy readers/triggers. */
export async function validateNativeRecording(input:{
  ordinary?:boolean;
  db:Firestore;bucket:any;matchId:string;gameId:string;fileName:string;bytes:Buffer;
  actor:{playerId:string;authUid:string;role:string};receivedAt:number;
  worker:()=>Promise<Bag>;
  resolveMapping:(game:any,players:Array<{replaySlot:number;sourceName:string}>)=>Promise<any[]>;
}){
  const {db,bucket,matchId,gameId,actor,bytes}=input;
  const readyBlockers=input.ordinary?['NATIVE_PLAYER_PUBLICATION_PENDING']:READY_BLOCKERS;
  const processorRevision=input.ordinary?assertNativePlayerUploadAllowed(process.env,matchId,gameId):assertNativeValidationAllowed(process.env,actor.role,matchId,gameId);
  if(!/^[A-Za-z0-9_-]{1,200}$/.test(matchId)||!/^[A-Za-z0-9_-]{1,200}$/.test(gameId))throw fail('Invalid native Game path.');
  if(!bytes.length||bytes.length>32*1024*1024)throw fail('Native recording exceeds input limit.');
  const sourceHash=digest(bytes),owner=randomUUID(),matchRef=db.collection('matches').doc(matchId),gameRef=matchRef.collection('games').doc(gameId);
  const trace:Bag={readyPublicationMs:null,totalServerReceivedToReadyMs:null};
  const started=Date.now();
  const authority=async(tx?:any)=>{
    if(input.ordinary)return readNativePlayerAuthority({db,matchId,gameId,actor,sourceHash,tx});
    const read=(ref:any)=>tx?tx.get(ref):ref.get();
    const [ms,gs,admin,link]=await Promise.all([read(matchRef),read(gameRef),read(db.collection('players').doc(actor.playerId)),
      read(db.collection('authLinks').doc(actor.authUid))]);
    if(!ms.exists||!gs.exists)throw fail('Native Game does not exist.');
    if(admin.data()?.role!=='ADMIN'||admin.data()?.membershipStatus!=='ACTIVE'||link.data()?.playerId!==actor.playerId)
      throw fail('Native administrator authority changed.');
    const game=gs.data(),match=ms.data();
    if(game.aiOpponent||match.opponentKind==='AI')throw fail('Native AI integration is not qualified.');
    if(game.canonicalResult&&game.activeReplayStatisticsId!==sourceHash&&!game.activeResultDisputeId)
      throw fail('Open a correction dispute before validating replacement evidence.');
    const ids=(game.players??[]).map((p:Bag)=>p.playerId);
    if(ids.length<2||ids.length>8||new Set(ids).size!==ids.length||ids.some((id:any)=>typeof id!=='string'||!id||id.includes('/')))
      throw fail('Invalid native league roster.');
    const players=await Promise.all(ids.map((id:string)=>read(db.collection('players').doc(id))));
    if(players.some(p=>!p.exists))throw fail('Native league identity missing.');
    // Include all authority inputs. Extra aborts are preferable to stale bindings.
    return {game,match,token:bindingDigest({game,match,players:players.map(p=>p.data()),admin:admin.data(),link:link.data()})};
  };
  const initial=await authority();
  const jobId=bindingDigest([input.ordinary?NATIVE_PLAYER_UPLOAD:NATIVE_VALIDATION,sourceHash,processorRevision,initial.token]);
  const jobRef=gameRef.collection('nativeReplayValidationJobs').doc(jobId);
  const claim=await db.runTransaction(async tx=>{
    const fresh=await authority(tx),job=await tx.get(jobRef);
    if(fresh.token!==initial.token)throw changed();
    const previous=job.data();
    if(previous?.state==='VALIDATED_NOT_READY')return previous.response;
    if(previous?.state==='PROCESSING'&&previous.leaseUntil?.toMillis()>Date.now())
      throw new HttpsError('aborted','Native validation is already processing; retry later.');
    tx.set(jobRef,{state:'PROCESSING',owner,leaseUntil:Timestamp.fromMillis(Date.now()+600_000),
      sourceHash,processorRevision,bindingToken:initial.token,attempt:Number(previous?.attempt??0)+1,startedAt:Timestamp.now()});
    return null;
  });
  trace.authorityAndClaimMs=Date.now()-started;
  if(claim)return {...claim,alreadyProcessed:true};
  try{
    let t=Date.now();
    // Permanent original first. Failed processing never authorizes source deletion.
    const prefix=`native-replay-evidence/${matchId}/${gameId}/${sourceHash}`;
    const original=await saveNativeArtifact(bucket,prefix+'/source.aoe2record',bytes,'application/octet-stream');
    trace.originalStorageAndVerificationMs=Date.now()-t;
    t=Date.now();const worker=await input.worker();trace.workerResponseMs=Date.now()-t;
    trace.serverReceivedToWorkerResponseMs=Date.now()-input.receivedAt;
    if(worker.processorRevision!==processorRevision)throw fail('Native worker processor revision changed.');
    trace.workerStages=worker.workerStages??null;
    t=Date.now();const verified=await verifyNativePackage(worker,bytes);trace.responseIntegrityVerificationMs=Date.now()-t;
    t=Date.now();const playerMapping=await input.resolveMapping(initial.game,verified.sourcePlayers);
    verifyMapping(playerMapping,verified.sourcePlayers,initial.game.players);trace.mappingMs=Date.now()-t;
    t=Date.now();
    const artifactPrefix=prefix+'/'+verified.revision;
    const [recordedEvents,statistics]=await Promise.all([
      saveNativeArtifact(bucket,artifactPrefix+'/events.jsonl.gz',verified.events,'application/gzip'),
      saveNativeArtifact(bucket,artifactPrefix+'/statistics.direct.json.gz',verified.statistics,'application/gzip')]);
    trace.derivedStorageAndVerificationMs=Date.now()-t;
    t=Date.now();
    const metadata=statisticsMetadata(matchId,gameId,initial.match,initial.game,{sourceHash,playerMapping});
    const experience=augmentSeasonShowcase(verified.experienceInput,projectStatistics(verified.experienceInput,metadata),metadata);
    if(experience.bindingKey!==statisticsBindingKey(metadata)||experience.players.length!==playerMapping.length||
      experience.players.some(p=>!playerMapping.some(m=>m.playerId===p.playerId)))throw fail('Native read-model binding mismatch.');
    trace.readModelCreationMs=Date.now()-t;
    const candidateId=bindingDigest([verified.revision,initial.token,processorRevision,...(input.ordinary?[NATIVE_PLAYER_UPLOAD]:[])]);
    const candidateRef=gameRef.collection('nativeReplayValidations').doc(candidateId);
    const cleanArtifact=(raw:Bag,stored:Bag)=>({format:raw.format,compression:raw.compression,
      uncompressedSha256:raw.uncompressedSha256,uncompressedBytes:raw.uncompressedBytes,...stored});
    const candidate={...(input.ordinary?{ordinaryUploadVersion:NATIVE_PLAYER_UPLOAD}:{}),contract:NATIVE_VALIDATION,state:'VALIDATED_NOT_READY',readyBlockers,
      matchId,gameId,sourceHash,processorRevision,bindingToken:initial.token,extraction:verified.extraction,
      artifactRevision:verified.revision,originalRecording:{...original,permanent:true,sourceDeletionAuthorized:false},
      recordedEvents:{...cleanArtifact(worker.recordedEvents,recordedEvents),datasetVersion:'AOF_RECORDED_EVENTS_V1'},
      statistics:{...cleanArtifact(worker.statistics,statistics),projectionDeliveryVersion:worker.statistics.projectionDeliveryVersion},
      completeness:verified.completeness,playerMapping,previewExperience:experience,
      matchFacts:verified.raw.matchFacts,leagueEffectsPermitted:false,active:false,validatedBy:actor.playerId,
      provenance:{sourceIdentity:sourceHash,extractionRevision:verified.extraction.revision,
        projectionRevision:statistics.sha256,leagueInterpretationRevision:null}};
    if(Buffer.byteLength(JSON.stringify(candidate))>850_000)throw fail('Native validation document exceeds bounded Firestore size.');
    t=Date.now();
    const response={success:true,state:'VALIDATED_NOT_READY',activated:false,alreadyProcessed:false,matchId,gameId,
      candidateId,sourceHash,readyBlockers,playerMapping};
    await db.runTransaction(async tx=>{
      const fresh=await authority(tx),job=await tx.get(jobRef),prior=await tx.get(candidateRef);
      if(fresh.token!==initial.token||job.data()?.owner!==owner||job.data()?.state!=='PROCESSING'||
        job.data()?.leaseUntil?.toMillis()<=Date.now())throw changed();
      if(prior.exists)throw changed();
      tx.create(candidateRef,{...candidate,validatedAt:Timestamp.now()});
      tx.update(jobRef,{state:'VALIDATED_NOT_READY',candidateId,response,finishedAt:Timestamp.now(),timings:trace});
      // Deliberately no Game, replaySources, result, aggregate or social-award writes.
    });
    trace.validationPublicationMs=Date.now()-t;trace.totalServerReceivedToValidationMs=Date.now()-input.receivedAt;
    console.info(JSON.stringify({event:'AOF_NATIVE_VALIDATION_TIMING_V1',timings:trace}));
    return {...response,timings:trace};
  }catch(error){
    await db.runTransaction(async tx=>{const job=await tx.get(jobRef);
      if(job.data()?.owner===owner&&job.data()?.state==='PROCESSING')tx.update(jobRef,{state:'FAILED',
        failureCode:'NATIVE_VALIDATION_FAILED',finishedAt:Timestamp.now(),timings:trace});});
    throw error;
  }
}
