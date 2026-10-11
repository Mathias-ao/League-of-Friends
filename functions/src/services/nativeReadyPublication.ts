import {Timestamp} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import {currentOfficialGameOutcome} from '../engines/recordingMatchFacts.js';
import {statisticsMetadata} from './statisticsExperienceProjection.js';
import {projectStatistics,statisticsBindingKey,EXPERIENCE_VERSION} from '../engines/statisticsExperience.js';
import {augmentSeasonShowcase,SEASON_SHOWCASE_VERSION} from '../engines/seasonShowcaseProjection.js';
import {nativeStatisticsExperienceInput} from '../engines/nativeStatisticsReadAdapter.js';
import {decodeNativeDetailArtifact,type NativeDetailArtifact} from '../engines/nativeStatisticsDetail.js';
import {nativeSocialInput} from '../engines/nativeSocialInput.js';
import {projectSocialIncidents} from '../engines/socialIncidentCore.js';
import {activeNativeStatisticsSource,ACTIVE_NATIVE_SOURCE_VERSION} from '../engines/activeNativeStatisticsSource.js';
import {assertNativeValidationAllowed,bindingDigest,digest,NATIVE_VALIDATION,NATIVE_DELIVERY} from '../engines/nativeRecordingIntegration.js';

const SHA=/^[a-f0-9]{64}$/;
const ID=/^[A-Za-z0-9_-]{1,200}$/;
export const NATIVE_READY_PUBLICATION_VERSION='AOF_NATIVE_READY_PUBLICATION_V1_EXPERIMENTAL';
type Bag=Record<string,any>;
const fail=(message:string)=>new HttpsError('failed-precondition',message);
const abort=()=>new HttpsError('aborted','Native publication authority, replay source or official result changed; review again.');
const invalid=(message:string)=>new HttpsError('invalid-argument',message);
const object=(value:unknown):Bag|null=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Bag:null;
const snap=(value:unknown):string=>bindingDigest(value);
const revision=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>=0;

export interface NativeReadyPublicationRequest {
  operation:'PUBLISH'|'ROLLBACK';
  matchId:string;
  gameId:string;
  candidateId:string;
  sourceHash:string;
  expectedArtifactSha256:string;
  expectedActiveSourceHash:string|null;
  expectedStatisticsRevision:number;
  expectedResultRevision:number;
  reason:string;
}
export interface NativeReadyActor {playerId:string;authUid:string;role:string}

/** Extra explicit operator opt-in. NEVER allowed in production. Staging/demo
 * experiments are not automatically authorized by merging this function. */
export function assertNativePublicationAllowed(env:NodeJS.ProcessEnv,actor:NativeReadyActor,
  request:NativeReadyPublicationRequest):string{
  if(!request||!ID.test(request.matchId??'')||!ID.test(request.gameId??'')||
     !SHA.test(request.candidateId??'')||!SHA.test(request.sourceHash??'')||
     !SHA.test(request.expectedArtifactSha256??'')||
     request.expectedActiveSourceHash!==null&&!SHA.test(request.expectedActiveSourceHash??'')||
     !revision(request.expectedStatisticsRevision)||request.expectedStatisticsRevision>1_000_000||
     !revision(request.expectedResultRevision)||request.expectedResultRevision<1||
     typeof request.reason!=='string'||request.reason.trim().length<20||request.reason.length>1000||
     !['PUBLISH','ROLLBACK'].includes(request.operation))
    throw invalid('Provide a pinned candidate, source hashes, official result/replay revisions and a reviewed reason of 20–1000 characters.');
  let processor:string;
  try{processor=assertNativeValidationAllowed(env,actor.role,request.matchId,request.gameId);}
  catch{throw fail('Native publication is restricted to the configured staging/demo administrator and allowlisted Game.');}
  if(env.AOF_NATIVE_READY_PUBLICATION!=='reviewed-v1'||
     env.AOF_ACTIVE_NATIVE_PLAYER_READS!=='1'||
     env.AOF_ACTIVE_NATIVE_SOCIAL_READS!=='1'||
     !(env.AOF_NATIVE_READY_GAME_ALLOWLIST??'').split(',').map(x=>x.trim()).includes(request.matchId+'/'+request.gameId))
    throw fail('Native publication, player reads, social reads and a separate release allowlist must be explicitly enabled.');
  return processor;
}

function checkedCandidate(c:Bag|undefined,request:NativeReadyPublicationRequest,processor:string){
  const base='native-replay-evidence/'+request.matchId+'/'+request.gameId+'/'+request.sourceHash+'/';
  const rev=c?.artifactRevision;
  const source=c?.sourceHash;
  if(!c||c.contract!==NATIVE_VALIDATION||c.matchId!==request.matchId||
     c.gameId!==request.gameId||source!==request.sourceHash||
     c.processorRevision!==processor||!SHA.test(rev??'')||
     c.validatedBy===undefined||c.active!==(request.operation==='PUBLISH'?false:c.state==='PUBLISHED_READY')||c.leagueEffectsPermitted!==false||
     !SHA.test(c.bindingToken??'')||c.provenance?.sourceIdentity!==source||
     c.provenance?.projectionRevision!==request.expectedArtifactSha256||
     c.provenance?.extractionRevision!==c.extraction?.revision||
     c.statistics?.sha256!==request.expectedArtifactSha256||
     c.statistics?.projectionDeliveryVersion!==NATIVE_DELIVERY||
     c.statistics?.path!==base+rev+'/statistics.direct.json.gz'||
     c.recordedEvents?.datasetVersion!=='AOF_RECORDED_EVENTS_V1'||
     c.recordedEvents?.path!==base+rev+'/events.jsonl.gz'||
     c.originalRecording?.path!==base+'source.aoe2record'||
     c.originalRecording?.permanent!==true||
     c.originalRecording?.sourceDeletionAuthorized!==false||
     !SHA.test(c.recordedEvents?.sha256??'')||
     !SHA.test(c.originalRecording?.sha256??'')||c.originalRecording.sha256!==source)
    throw fail('Candidate does not bind the retained recording and immutable native artifacts.');
  for(const entry of [c.originalRecording,c.recordedEvents,c.statistics]){
    if(!/^[1-9][0-9]*$/.test(String(entry.generation??''))||
       !SHA.test(entry.sha256??'')||!revision(entry.bytes)||entry.bytes===0)
      throw fail('Native artifact generation and hash metadata are incomplete.');
  }
  if(!Array.isArray(c.playerMapping)||!object(c.matchFacts)||!object(c.previewExperience))
    throw fail('Candidate is missing validated mapping, match facts or statistics.');
}

function checkedOfficial(game:Bag,match:Bag,request:NativeReadyPublicationRequest){
  const result=currentOfficialGameOutcome(game,match);
  if(result.qualification!=='OFFICIAL'||result.resultRevision!==request.expectedResultRevision||
     game.status!=='COMPLETED'||match.status!=='COMPLETED'||
     game.activeResultDisputeId||match.activeResultDisputeId)
    throw fail('Native publication requires a currently accepted, undisputed official Game result and exact revision.');
  // Source-bound results need the original recording. Switching its source
  // without a dedicated correction dispute/result-rebind transaction would
  // make the current official result ineligible.
  if(game.recordingResultBinding||
     game.canonicalResult?.source==='RECORDING_VERIFIED')
    throw fail('A recording-bound official result requires a separate correction-safe source rebind.');
  if(game.activeReplayStatisticsId!==request.expectedActiveSourceHash||
     Number(game.replayStatisticsRevision??0)!==request.expectedStatisticsRevision)
    throw abort();
  return result;
}

async function readImmutable(bucket:any,entry:Bag,maxBytes:number):Promise<Buffer>{
  if(!revision(entry.bytes)||entry.bytes<1||entry.bytes>maxBytes)throw fail('Native artifact exceeds publication limits.');
  let bytes:Buffer;
  try{[bytes]=await bucket.file(entry.path,{generation:String(entry.generation)}).download();}
  catch{throw new HttpsError('data-loss','Pinned native source artifact could not be read.');}
  if(bytes.length!==entry.bytes||digest(bytes)!==entry.sha256)
    throw new HttpsError('data-loss','Pinned native source artifact failed integrity verification.');
  return bytes;
}

function checkedMapping(mapping:Bag[],roster:Bag[],raw:Bag){
  const ids=roster.map(p=>p.playerId),slots=raw.participants?.map((p:Bag)=>p.replaySlot);
  if(ids.length<2||ids.length>8||new Set(ids).size!==ids.length||
     !Array.isArray(slots)||slots.length!==ids.length||
     mapping.length!==ids.length||new Set(mapping.map(p=>p.playerId)).size!==ids.length||
     new Set(mapping.map(p=>p.replaySlot)).size!==ids.length||
     mapping.some(p=>!ids.includes(p.playerId)||!slots.includes(p.replaySlot)||
       typeof p.sourceName!=='string'||!p.sourceName))
    throw fail('Approved Game roster no longer matches the native recording mapping.');
}

function publicationSource(c:Bag,request:NativeReadyPublicationRequest,game:Bag,match:Bag,experience:Bag,
  publicationId:string,official:Bag,revisionNumber:number,actor:NativeReadyActor):Bag{
  return {
    state:'READY',nativePublicationVersion:ACTIVE_NATIVE_SOURCE_VERSION,
    matchId:request.matchId,gameId:request.gameId,sourceHash:request.sourceHash,
    replayStatisticsRevision:revisionNumber,
    nativeValidationCandidateId:request.candidateId,artifactRevision:c.artifactRevision,
    processorRevision:c.processorRevision,playerMapping:c.playerMapping,
    originalRecording:c.originalRecording,recordedEvents:c.recordedEvents,
    statistics:c.statistics,extraction:c.extraction,matchFacts:c.matchFacts,
    experience,resultQualification:'OFFICIAL',officialOutcomeAtIngestion:{
      ...official,historicalSnapshotOnly:true,
    },sourceBytes:c.originalRecording.bytes,
    publication:{version:NATIVE_READY_PUBLICATION_VERSION,publicationId,
      actorPlayerId:actor.playerId,publicationReason:request.reason.trim(),
      officialResultRevision:request.expectedResultRevision,
      previousSourceId:request.expectedActiveSourceHash,
      previousStatisticsRevision:request.expectedStatisticsRevision,
      publishedAt:Timestamp.now()},
  };
}

/** Atomic experimental publication/rollback, with fail-closed missing source
 * checks. All expensive verification is outside the transaction, then every
 * authority input is fenced again *inside* the transaction. */
export async function executeNativeReadyPublication(input:{
  db:any;bucket:any;actor:NativeReadyActor;request:NativeReadyPublicationRequest;env:NodeJS.ProcessEnv;
}):Promise<Bag>{
  const {db,bucket,actor,request,env}=input;
  const processor=assertNativePublicationAllowed(env,actor,request);
  const matchRef=db.collection('matches').doc(request.matchId);
  const gameRef=matchRef.collection('games').doc(request.gameId);
  const candidateRef=gameRef.collection('nativeReplayValidations').doc(request.candidateId);
  const publicationRef=gameRef.collection('nativeReplayPublications').doc(request.candidateId);
  const sourceRef=gameRef.collection('replaySources').doc(request.sourceHash);
  const adminRef=db.collection('players').doc(actor.playerId);
  const linkRef=db.collection('authLinks').doc(actor.authUid);

  const authority=async(tx?:any)=>{
    const get=(ref:any)=>tx?tx.get(ref):ref.get();
    const [ms,gs,cs,ps,ss,admin,link]=await Promise.all([
      get(matchRef),get(gameRef),get(candidateRef),get(publicationRef),
      get(sourceRef),get(adminRef),get(linkRef),
    ]);
    const match=ms.data(),game=gs.data(),c=cs.data(),publication=ps.data(),source=ss.data();
    if(!ms.exists||!gs.exists||!cs.exists||!admin.exists||!link.exists||
       admin.data()?.role!=='ADMIN'||admin.data()?.membershipStatus!=='ACTIVE'||
       link.data()?.playerId!==actor.playerId)
      throw fail('The Game, candidate or administrator authority is missing.');
    checkedCandidate(c,request,processor);
    if(c.validatedBy!==actor.playerId)throw fail('Only the administrator who validated this candidate may publish or roll it back.');
    const roster=game.players??[];
    if(!Array.isArray(roster)||roster.length<2||roster.length>8)throw fail('Game roster unavailable.');
    const ids=roster.map((p:Bag)=>p.playerId);
    if(ids.some((id:unknown)=>typeof id!=='string'||!id)||new Set(ids).size!==ids.length)
      throw fail('Game roster is incomplete or duplicated.');
    const players=await Promise.all(ids.map((id:string)=>get(db.collection('players').doc(id))));
    if(players.some((doc:any)=>!doc.exists))throw fail('Game player identity has been removed.');
    const fingerprint=snap({match,game,candidate:c,publication,source,
      players:players.map((x:any)=>x.data()),admin:admin.data(),link:link.data()});
    return {match,game,c,publication,source,sourceExists:ss.exists,publicationExists:ps.exists,fingerprint};
  };
  const start=await authority();
  if(request.operation==='ROLLBACK')return rollbackNativePublication({db,actor,request,publicationRef,candidateRef,gameRef,
    matchRef,sourceRef,authority});
  if(start.publicationExists){
    if(start.publication?.state==='ACTIVE'&&start.game.activeReplayStatisticsId===request.sourceHash&&
       start.publication.publishedStatisticsRevision===start.game.replayStatisticsRevision&&
       start.c.state==='PUBLISHED_READY')
      return {success:true,alreadyPublished:true,state:'READY',sourceHash:request.sourceHash,
        replayStatisticsRevision:start.game.replayStatisticsRevision};
    throw fail('This native candidate already has a publication history; do not republish after rollback.');
  }
  if(start.c.state!=='VALIDATED_NOT_READY'||start.sourceExists)
    throw fail('Only a previously unpublished validated candidate with a new source identity may be activated.');
  const official=checkedOfficial(start.game,start.match,request);
  if(start.game.aiOpponent||start.match.opponentKind==='AI')throw fail('Native AI Game publication is not qualified.');
  if(start.game.activeReplayStatisticsId!==null&&start.game.activeReplayStatisticsId!==undefined){
    const oldRef=gameRef.collection('replaySources').doc(start.game.activeReplayStatisticsId);
    const oldSource=await oldRef.get();
    if(!oldSource.exists||oldSource.data()?.state!=='READY'||oldSource.data()?.nativePublicationVersion)
      throw fail('Only an immutable legacy READY predecessor may be replaced by native publication.');
  }
  checkedMapping(start.c.playerMapping,start.game.players,{participants:start.c.playerMapping.map((m:Bag)=>({replaySlot:m.replaySlot}))});

  // Generation-pinned source, full native events and statistics must still
  // exist. A prior successful validation is not a substitute for this read.
  await Promise.all([
    readImmutable(bucket,start.c.originalRecording,32*1024*1024),
    readImmutable(bucket,start.c.recordedEvents,48*1024*1024),
  ]);
  const bytes=await readImmutable(bucket,start.c.statistics,48*1024*1024);
  let raw:Bag;
  try{
    raw=decodeNativeDetailArtifact(bytes,start.c.statistics as NativeDetailArtifact,{
      sourceHash:request.sourceHash,
      eventsSha256:start.c.recordedEvents.sha256,
      extractionRunId:start.c.extraction.revision,
    });
    nativeSocialInput(raw,start.c.playerMapping);
    if(snap(raw.matchFacts)!==snap(start.c.matchFacts))throw new Error('Native match facts changed');
  }catch{throw new HttpsError('data-loss','Native statistics, provenance, neutral evidence or match facts are inconsistent.');}
  checkedMapping(start.c.playerMapping,start.game.players,raw);
  const projected=projectSocialIncidents({statistics:raw,playerMapping:start.c.playerMapping,
    officialOutcome:official,context:{gameId:request.matchId+'/'+request.gameId,battleId:request.matchId}});
  if(projected.status!=='REVIEW_AVAILABLE')
    throw fail('The native social interpretation is not qualified: '+String(projected.reason??'unavailable'));

  const nextRevision=request.expectedStatisticsRevision+1;
  const metadata=statisticsMetadata(request.matchId,request.gameId,start.match,
    {...start.game,replayStatisticsRevision:nextRevision,activeReplayStatisticsId:request.sourceHash,
      replayStatisticsState:'READY'},{sourceHash:request.sourceHash,playerMapping:start.c.playerMapping});
  if(!metadata.eligible)throw fail('The current Game is not eligible for official native statistics.');
  const inputStats=nativeStatisticsExperienceInput(raw);
  const experience=augmentSeasonShowcase(inputStats,projectStatistics(inputStats,metadata),metadata);
  if(experience.version!==EXPERIENCE_VERSION||
     experience.seasonShowcaseVersion!==SEASON_SHOWCASE_VERSION||
     experience.bindingKey!==statisticsBindingKey(metadata)||
     experience.players.length!==start.c.playerMapping.length||
     experience.players.some((p:Bag)=>!start.c.playerMapping.some((m:Bag)=>m.playerId===p.playerId)))
    throw fail('Native Season and player read-model bindings could not be qualified.');
  const source=publicationSource(start.c,request,start.game,start.match,experience,
    request.candidateId,official,nextRevision,actor);
  const approvedGame={...start.game,
    activeReplayStatisticsId:request.sourceHash,replayStatisticsRevision:nextRevision,
    replayStatisticsState:'READY'};
  if(!activeNativeStatisticsSource(request.matchId,request.gameId,start.match,approvedGame,
    request.sourceHash,source,true))
    throw fail('The proposed native source would fail normal authenticated Game reader qualification.');

  // Game GUID is the same global single-Game claim used for legacy recording
  // results. A claimed recording cannot be attached to a second Battle.
  const guid=start.c.matchFacts.game?.guid;
  if(typeof guid!=='string'||!guid||guid.length>500)
    throw fail('Recorded Game GUID is required to prevent duplicate Battle attribution.');
  const claimRef=db.collection('recordingGameClaims').doc(Buffer.from(guid).toString('hex').slice(0,1000));
  const claim=await claimRef.get();
  if(claim.exists&&(claim.data()?.matchId!==request.matchId||claim.data()?.gameId!==request.gameId))
    throw fail('The recorded Game is already claimed by another Battle.');
  const claimToken=snap(claim.data()??null);
  const txResult=await db.runTransaction(async(tx:any)=>{
    const now=Timestamp.now();
    const fresh=await authority(tx);
    const claimNow=await tx.get(claimRef);
    if(fresh.fingerprint!==start.fingerprint||
       snap(claimNow.data()??null)!==claimToken||
       fresh.publicationExists||fresh.sourceExists)throw abort();
    checkedOfficial(fresh.game,fresh.match,request);
    const former=fresh.game.activeReplayStatisticsId;
    if(former){
      const prior=await tx.get(gameRef.collection('replaySources').doc(former));
      if(!prior.exists||prior.data()?.state!=='READY'||prior.data()?.nativePublicationVersion)
        throw abort();
    }
    const publishedRevision=nextRevision;
    const journal={
      version:NATIVE_READY_PUBLICATION_VERSION,state:'ACTIVE',
      matchId:request.matchId,gameId:request.gameId,candidateId:request.candidateId,
      sourceHash:request.sourceHash,artifactSha256:request.expectedArtifactSha256,
      originalSourceRetained:true,officialResultRevision:request.expectedResultRevision,
      resultBinding:snap({canonicalResult:fresh.game.canonicalResult,recordingResultBinding:fresh.game.recordingResultBinding??null}),
      previousActiveSourceId:request.expectedActiveSourceHash,
      previousStatisticsState:fresh.game.replayStatisticsState??null,
      previousStatisticsRevision:request.expectedStatisticsRevision,
      previousReplay:fresh.game.replay??null,
      publishedStatisticsRevision:publishedRevision,
      claimCreated:!claimNow.exists,claimGuidHex:claimRef.id,
      reviewedBy:actor.playerId,reason:request.reason.trim(),publishedAt:now,
    };
    tx.create(sourceRef,source);
    tx.create(publicationRef,journal);
    tx.update(candidateRef,{state:'PUBLISHED_READY',active:true,
      publishedSourceId:request.sourceHash,publishedAt:now});
    if(!claimNow.exists)tx.create(claimRef,{matchId:request.matchId,gameId:request.gameId,
      sourceHash:request.sourceHash,createdAt:now,nativePublicationCandidateId:request.candidateId});
    tx.update(gameRef,{
      activeReplayStatisticsId:request.sourceHash,replayStatisticsState:'READY',
      replayStatisticsRevision:publishedRevision,replayStatisticsUpdatedAt:now,
      replay:{...(fresh.game.replay??{}),status:'PARSED',sourceHash:request.sourceHash,
        statisticsId:request.sourceHash,statisticsState:'READY'},
      updatedAt:now,
    });
    const auditRef=db.collection('adminAudit').doc(request.candidateId+'-NATIVE_READY');
    tx.create(auditRef,{actorUid:actor.authUid,actorPlayerId:actor.playerId,
      action:'NATIVE_READY_SOURCE_PUBLISHED',targetType:'GAME',
      targetId:request.matchId+'/'+request.gameId,reason:request.reason.trim(),
      before:{statisticsId:request.expectedActiveSourceHash,statisticsRevision:request.expectedStatisticsRevision},
      after:{statisticsId:request.sourceHash,statisticsRevision:publishedRevision,
        candidateId:request.candidateId,officialRevision:request.expectedResultRevision},
      createdAt:now});
    return {revision:publishedRevision};
  });
  return {success:true,alreadyPublished:false,state:'READY',activated:true,
    sourceHash:request.sourceHash,replayStatisticsRevision:txResult.revision,
    candidateId:request.candidateId};
}

async function rollbackNativePublication(input:{
  db:any;actor:NativeReadyActor;request:NativeReadyPublicationRequest;publicationRef:any;
  candidateRef:any;gameRef:any;matchRef:any;sourceRef:any;authority:(tx?:any)=>Promise<any>;
}):Promise<Bag>{
  const {db,actor,request,publicationRef,candidateRef,gameRef,sourceRef,authority}=input;
  const start=await authority();
  const publication=start.publication;
  if(!start.publicationExists||!publication||publication.version!==NATIVE_READY_PUBLICATION_VERSION||
     publication.sourceHash!==request.sourceHash||publication.candidateId!==request.candidateId||
     publication.artifactSha256!==request.expectedArtifactSha256)
    throw fail('No matching audited native publication exists for this rollback.');
  if(publication.state==='ROLLED_BACK'){
    if(start.game.activeReplayStatisticsId===publication.previousActiveSourceId&&
       start.game.replayStatisticsRevision===publication.rolledBackStatisticsRevision)
      return {success:true,alreadyRolledBack:true,state:'ROLLED_BACK',
        sourceHash:request.sourceHash,replayStatisticsRevision:start.game.replayStatisticsRevision};
    throw fail('Rollback already occurred, but the Game has since changed.');
  }
  if(publication.state!=='ACTIVE'||start.c.state!=='PUBLISHED_READY'||
     start.game.activeReplayStatisticsId!==request.sourceHash||
     start.game.replayStatisticsRevision!==request.expectedStatisticsRevision||
     publication.publishedStatisticsRevision!==request.expectedStatisticsRevision||
     request.expectedActiveSourceHash!==request.sourceHash||
     publication.officialResultRevision!==request.expectedResultRevision||
     publication.resultBinding!==snap({canonicalResult:start.game.canonicalResult,
       recordingResultBinding:start.game.recordingResultBinding??null})||
     !start.sourceExists||start.source?.nativeValidationCandidateId!==request.candidateId)
    throw fail('Native source or official result has changed; use the correction dispute workflow instead of rollback.');
  checkedOfficialForRollback(start.game,start.match,request);
  if(publication.previousActiveSourceId){
    const prior=await gameRef.collection('replaySources').doc(publication.previousActiveSourceId).get();
    if(!prior.exists||prior.data()?.state!=='READY'||prior.data()?.nativePublicationVersion)
      throw fail('The previous legacy recording source is unavailable for rollback.');
  }
  const claimRef=db.collection('recordingGameClaims').doc(publication.claimGuidHex);
  const claim=await claimRef.get();
  if(publication.claimCreated&&(!claim.exists||
     claim.data()?.nativePublicationCandidateId!==request.candidateId))
    throw fail('The native recording claim changed and requires an audited correction.');
  const claimToken=snap(claim.data()??null);
  const rollbackRevision=request.expectedStatisticsRevision+1;
  const result=await db.runTransaction(async(tx:any)=>{
    const now=Timestamp.now();
    const fresh=await authority(tx);
    const freshClaim=await tx.get(claimRef);
    if(fresh.fingerprint!==start.fingerprint||snap(freshClaim.data()??null)!==claimToken)
      throw abort();
    checkedOfficialForRollback(fresh.game,fresh.match,request);
    if(fresh.game.activeReplayStatisticsId!==request.sourceHash||
       fresh.game.replayStatisticsRevision!==request.expectedStatisticsRevision||
       fresh.publication?.state!=='ACTIVE')throw abort();
    if(publication.previousActiveSourceId){
      const former=await tx.get(gameRef.collection('replaySources').doc(publication.previousActiveSourceId));
      if(!former.exists||former.data()?.state!=='READY'||former.data()?.nativePublicationVersion)throw abort();
    }
    tx.update(gameRef,{
      activeReplayStatisticsId:publication.previousActiveSourceId??null,
      replayStatisticsState:publication.previousActiveSourceId?'READY':(publication.previousStatisticsState??'UNAVAILABLE'),
      replayStatisticsRevision:rollbackRevision,
      replayStatisticsUpdatedAt:now,replay:publication.previousReplay??null,updatedAt:now,
    });
    tx.update(candidateRef,{state:'ROLLED_BACK',active:false,
      rolledBackAt:now,rolledBackStatisticsRevision:rollbackRevision});
    tx.update(publicationRef,{state:'ROLLED_BACK',rolledBackAt:now,
      rolledBackStatisticsRevision:rollbackRevision,rolledBackBy:actor.playerId,
      rollbackReason:request.reason.trim()});
    if(publication.claimCreated)tx.delete(claimRef);
    const auditRef=db.collection('adminAudit').doc(request.candidateId+'-NATIVE_ROLLBACK');
    tx.create(auditRef,{actorUid:actor.authUid,actorPlayerId:actor.playerId,
      action:'NATIVE_READY_SOURCE_ROLLED_BACK',targetType:'GAME',
      targetId:request.matchId+'/'+request.gameId,reason:request.reason.trim(),
      before:{statisticsId:request.sourceHash,statisticsRevision:request.expectedStatisticsRevision},
      after:{statisticsId:publication.previousActiveSourceId??null,statisticsRevision:rollbackRevision},
      createdAt:now});
    return {revision:rollbackRevision};
  });
  return {success:true,alreadyRolledBack:false,state:'ROLLED_BACK',
    sourceHash:request.sourceHash,replayStatisticsRevision:result.revision};
}

function checkedOfficialForRollback(game:Bag,match:Bag,request:NativeReadyPublicationRequest){
  const official=currentOfficialGameOutcome(game,match);
  if(official.qualification!=='OFFICIAL'||official.resultRevision!==request.expectedResultRevision||
     game.status!=='COMPLETED'||match.status!=='COMPLETED'||
     game.activeResultDisputeId||match.activeResultDisputeId||
     game.recordingResultBinding||game.canonicalResult?.source==='RECORDING_VERIFIED')
    throw fail('Official result or source binding is no longer eligible for native rollback.');
}
