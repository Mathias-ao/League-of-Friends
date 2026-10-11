import {Timestamp} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import {NATIVE_READY_CORRECTION_VERSION,readCorrectionAuthority,prepareNativeCorrection,commitNativeCorrection} from './nativeReadyCorrection.js';
import type {GameOutcome} from '../domain/types.js';
import {verifyEvents} from '../engines/nativeRecordingIntegration.js';
import {currentOfficialGameOutcome} from '../engines/recordingMatchFacts.js';
import {statisticsMetadata} from './statisticsExperienceProjection.js';
import {projectStatistics,statisticsBindingKey,EXPERIENCE_VERSION} from '../engines/statisticsExperience.js';
import {augmentSeasonShowcase,SEASON_SHOWCASE_VERSION} from '../engines/seasonShowcaseProjection.js';
import {nativeStatisticsExperienceInput} from '../engines/nativeStatisticsReadAdapter.js';
import {decodeNativeDetailArtifact,type NativeDetailArtifact} from '../engines/nativeStatisticsDetail.js';
import {nativeSocialInput} from '../engines/nativeSocialInput.js';
import {projectSocialIncidents} from '../engines/socialIncidentCore.js';
import {activeNativeStatisticsSource,ACTIVE_NATIVE_SOURCE_VERSION} from '../engines/activeNativeStatisticsSource.js';
import {assertNativeValidationAllowed,bindingDigest,digest,NATIVE_VALIDATION,NATIVE_DELIVERY,NATIVE_PACKAGE} from '../engines/nativeRecordingIntegration.js';

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
  operation:'PUBLISH'|'ROLLBACK'|'CORRECT_REBIND_V1';
  correction?:{disputeId:string;resolution:'CORRECT';outcome:GameOutcome};
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
     !['PUBLISH','ROLLBACK','CORRECT_REBIND_V1'].includes(request.operation))
    throw invalid('Provide a pinned candidate, source hashes, official result/replay revisions and a reviewed reason of 20–1000 characters.');
  if(request.operation==='CORRECT_REBIND_V1'&&(!request.correction||
     !ID.test(request.correction.disputeId??'')||request.correction.resolution!=='CORRECT'||
     !object(request.correction.outcome)||!SHA.test(request.expectedActiveSourceHash??'')||
     request.expectedResultRevision>=Number.MAX_SAFE_INTEGER||
     env.AOF_NATIVE_READY_CORRECTION!=='reviewed-v1'))
    throw fail('Native correction requires a separately reviewed flag, exact dispute, prior source and normalized outcome.');
  if(request.operation!=='CORRECT_REBIND_V1'&&request.correction!==undefined)throw invalid('Correction review requires CORRECT_REBIND_V1.');
  // Emergency rollback must work even when validation or the player/social
  // readers have been disabled following an incident. It still requires
  // staging/demo, admin, pinned processor and a distinct rollback approval.
  if(request.operation==='ROLLBACK'){
    const project=env.GCLOUD_PROJECT||env.GOOGLE_CLOUD_PROJECT;
    if(actor.role!=='ADMIN'||!project||project!==env.AOF_NATIVE_REPLAY_PROJECT||
       !(project==='age-of-friends-staging'||!!env.FUNCTIONS_EMULATOR&&project.startsWith('demo-'))||
       !SHA.test(env.AOF_NATIVE_REPLAY_PROCESSOR_REVISION??'')||
       env.AOF_NATIVE_READY_ROLLBACK!=='reviewed-v1'||
       !(env.AOF_NATIVE_READY_GAME_ALLOWLIST??'').split(',').map(x=>x.trim()).includes(request.matchId+'/'+request.gameId))
      throw fail('Emergency native rollback requires a distinct staged admin, processor and Game approval.');
    return env.AOF_NATIVE_REPLAY_PROCESSOR_REVISION!;
  }
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
     c.validatedBy===undefined||!((c.state==='VALIDATED_NOT_READY'&&c.active===false)||
       (c.state==='PUBLISHED_READY'&&c.active===true)||(c.state==='ROLLED_BACK'&&c.active===false))||
     c.leagueEffectsPermitted!==false||
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

/** Pin the legacy rollback target without treating its mutable read-model
 * cache (experience) as source identity. The stored artifact itself is never
 * changed or deleted by native publication. */
function legacySourceFingerprint(value:Bag|undefined,matchId:string,gameId:string,sourceId:string):string{
  if(!value||value.state!=='READY'||value.nativePublicationVersion!==undefined||
     value.sourceHash!==sourceId||value.matchId!==matchId||value.gameId!==gameId||
     !object(value.statistics)||!SHA.test(value.statistics.sha256??'')||
     typeof value.statistics.path!=='string'||!value.statistics.path)
    throw fail('The predecessor is not a qualified immutable legacy READY source.');
  return snap({sourceHash:value.sourceHash,matchId:value.matchId,gameId:value.gameId,
    statistics:value.statistics,canonical:value.canonical??null,
    playerMapping:value.playerMapping??null});
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
    if(request.operation!=='ROLLBACK'&&c.validatedBy!==actor.playerId)
      throw fail('Only the administrator who validated this candidate may publish it.');
    const roster=game.players??[];
    if(!Array.isArray(roster)||roster.length<2||roster.length>8)throw fail('Game roster unavailable.');
    const ids=roster.map((p:Bag)=>p.playerId);
    if(ids.some((id:unknown)=>typeof id!=='string'||!id)||new Set(ids).size!==ids.length)
      throw fail('Game roster is incomplete or duplicated.');
    const players=await Promise.all(ids.map((id:string)=>get(db.collection('players').doc(id))));
    if(players.some((doc:any)=>!doc.exists))throw fail('Game player identity has been removed.');
    const correction=request.operation==='CORRECT_REBIND_V1'
      ?await readCorrectionAuthority(db,gameRef,matchRef,request,c,get):null;
    const validationToken=snap({game,match,players:players.map((x:any)=>x.data()),admin:admin.data(),link:link.data()});
    const fingerprint=snap({match,game,candidate:c,publication,source,correction:correction?.data??null,
      players:players.map((x:any)=>x.data()),admin:admin.data(),link:link.data()});
    return {match,game,c,publication,source,sourceExists:ss.exists,publicationExists:ps.exists,fingerprint,correction,validationToken,
      rosterPlayers:players.map((p:any)=>p.data())};
  };
  const start=await authority();
  if(request.operation==='ROLLBACK')return rollbackNativePublication({db,actor,request,publicationRef,candidateRef,gameRef,
    matchRef,sourceRef,authority});
  if(start.publicationExists){
    // A retry is a read-only transaction: it must observe ONE coherent
    // publication, current Game/result and global GUID claim. A stale early
    // snapshot must never return an invented READY success after correction.
    return db.runTransaction(async(tx:any)=>{
      let fresh:any;
      try{fresh=await authority(tx);}catch{throw abort();}
      const journal=fresh.publication,active=fresh.source;
      if(!fresh.publicationExists||!fresh.sourceExists||journal?.state!=='ACTIVE'||
         journal.version!==NATIVE_READY_PUBLICATION_VERSION||
         journal.sourceHash!==request.sourceHash||
         journal.candidateId!==request.candidateId||
         journal.artifactSha256!==request.expectedArtifactSha256||
         fresh.game.activeReplayStatisticsId!==request.sourceHash||
         fresh.game.replayStatisticsRevision!==journal.publishedStatisticsRevision||
         journal.previousActiveSourceId!==request.expectedActiveSourceHash||
         journal.previousStatisticsRevision!==request.expectedStatisticsRevision||
         journal.officialResultRevision!==request.expectedResultRevision+(request.operation==='CORRECT_REBIND_V1'?1:0)||
         journal.resultBinding!==snap({canonicalResult:fresh.game.canonicalResult,
           recordingResultBinding:fresh.game.recordingResultBinding??null})||
         fresh.c.state!=='PUBLISHED_READY'||fresh.c.active!==true||
         fresh.c.validatedBy!==actor.playerId||
         active?.nativeValidationCandidateId!==request.candidateId||
         active?.statistics?.sha256!==request.expectedArtifactSha256||
         active?.publication?.publicationId!==request.candidateId||
         snap(active.matchFacts)!==snap(fresh.c.matchFacts)||
         snap(active.playerMapping)!==snap(fresh.c.playerMapping)||
         snap(active.statistics)!==snap(fresh.c.statistics)||
         active.experience?.seasonShowcaseVersion!==SEASON_SHOWCASE_VERSION||
         !activeNativeStatisticsSource(request.matchId,request.gameId,fresh.match,
           fresh.game,request.sourceHash,active,true))
        throw fail('Existing native publication is no longer a qualified active READY source.');
      if(request.operation==='CORRECT_REBIND_V1'){
        const d=fresh.correction.data,review=journal.correction;
        if(review?.version!==NATIVE_READY_CORRECTION_VERSION||review.requestToken!==snap({request,actor:{playerId:actor.playerId,authUid:actor.authUid}})||
           d.dispute?.status!=='RESOLVED_CORRECTED'||d.dispute.nativePublicationCandidateId!==request.candidateId||
           d.dispute.correctedToRevision!==journal.officialResultRevision||
           d.newJob?.matchId!==request.matchId||d.newJob?.gameId!==request.gameId||
           d.newJob?.resultRevision!==journal.officialResultRevision||d.newJob?.correctionCaseId!==request.correction!.disputeId||
           d.newJob?.previousRevision!==request.expectedResultRevision||
           snap(d.gameHistory)!==review.gameHistoryFingerprint||snap(d.matchHistory)!==review.matchHistoryFingerprint||
           snap(currentOfficialGameOutcome(fresh.game,fresh.match))!==snap(currentOfficialGameOutcome(
             {...fresh.game,canonicalResult:fresh.match.canonicalResult},fresh.match))||
           fresh.match.canonicalResult?.sourceGameId!==request.gameId||
           fresh.game.recordingResultBinding?.resolverVersion!==NATIVE_READY_CORRECTION_VERSION||
           active.experience?.revision!==fresh.game.replayStatisticsRevision||
           ['originalRecording','recordedEvents','extraction','processorRevision','artifactRevision'].some(key=>snap(active[key])!==snap(fresh.c[key])))
          throw fail('Correction retry no longer matches its immutable history, dispute and processing revision.');
      }else if(journal.correction)throw fail('A correction publication requires its exact correction retry contract.');
      const claimRef=db.collection('recordingGameClaims').doc(journal.claimGuidHex);
      const claim=await tx.get(claimRef);
      if(!claim.exists||claim.data()?.matchId!==request.matchId||
         claim.data()?.gameId!==request.gameId||
         (journal.claimCreated||journal.claimRebound)&&(
           claim.data()?.sourceHash!==request.sourceHash||
           claim.data()?.nativePublicationCandidateId!==request.candidateId)||
         !journal.claimCreated&&!journal.claimRebound&&journal.previousClaimFingerprint!==undefined&&
           snap(claim.data())!==journal.previousClaimFingerprint)
        throw fail('Global recorded-Game GUID claim no longer matches the active publication.');
      if(journal.previousActiveSourceId){
        const former=await tx.get(gameRef.collection('replaySources').doc(journal.previousActiveSourceId));
        if(!former.exists||legacySourceFingerprint(former.data(),request.matchId,request.gameId,
          journal.previousActiveSourceId)!==journal.previousSourceFingerprint)
          throw fail('The prior immutable source is no longer a safe rollback target.');
      }
      return {success:true,alreadyPublished:true,state:'READY',sourceHash:request.sourceHash,
        replayStatisticsRevision:fresh.game.replayStatisticsRevision,
        ...(request.operation==='CORRECT_REBIND_V1'?{resultRevision:journal.officialResultRevision}: {})};
    });
  }
  if(start.c.state!=='VALIDATED_NOT_READY'||start.sourceExists)
    throw fail('Only a previously unpublished validated candidate with a new source identity may be activated.');
  const correction=request.operation==='CORRECT_REBIND_V1'?prepareNativeCorrection(start,request,actor):null;
  const effectiveGame=correction?.game??start.game,effectiveMatch=correction?.match??start.match;
  const official=correction?currentOfficialGameOutcome(effectiveGame,effectiveMatch):checkedOfficial(start.game,start.match,request);
  const officialRevision=correction?.revision??request.expectedResultRevision;
  if(start.game.aiOpponent||start.match.opponentKind==='AI')throw fail('Native AI Game publication is not qualified.');
  let previousSourceFingerprint:string|null=null;
  if(start.game.activeReplayStatisticsId!==null&&start.game.activeReplayStatisticsId!==undefined){
    const oldRef=gameRef.collection('replaySources').doc(start.game.activeReplayStatisticsId);
    const oldSource=await oldRef.get();
    if(!oldSource.exists)throw fail('Previous legacy source is missing.');
    previousSourceFingerprint=legacySourceFingerprint(oldSource.data(),
      request.matchId,request.gameId,start.game.activeReplayStatisticsId);
  }
  checkedMapping(start.c.playerMapping,start.game.players,{participants:start.c.playerMapping.map((m:Bag)=>({replaySlot:m.replaySlot}))});

  // Generation-pinned source, full native events and statistics must still
  // exist. A prior successful validation is not a substitute for this read.
  const [,eventBytes]=await Promise.all([
    readImmutable(bucket,start.c.originalRecording,32*1024*1024),
    readImmutable(bucket,start.c.recordedEvents,48*1024*1024),
  ]);
  if(correction){
    const metadata=start.c.recordedEvents;
    if(start.c.artifactRevision!==snap([NATIVE_PACKAGE,metadata.sha256,start.c.statistics.sha256]))
      throw fail('Correction candidate artifact revision does not match the immutable evidence.');
    if(!revision(metadata.uncompressedBytes)||metadata.uncompressedBytes<1||metadata.uncompressedBytes>512*1024*1024||
       !SHA.test(metadata.uncompressedSha256??'')||metadata.compression!=='gzip')throw fail('Correction requires decoded event integrity metadata.');
    try{
      const verified=await verifyEvents(eventBytes,metadata,request.sourceHash,start.c.originalRecording.bytes);
      if(snap(verified.header.extraction)!==snap(start.c.extraction)||
         snap(verified.footer)!==snap(start.c.completeness)||
         snap(verified.header.context?.participants?.map((p:Bag)=>({replaySlot:p.playerId,sourceName:p.name})))!==
         snap(start.c.playerMapping.map((p:Bag)=>({replaySlot:p.replaySlot,sourceName:p.sourceName}))))
        throw new Error('Event mapping/extraction/completeness mismatch');
    }catch{throw new HttpsError('data-loss','Correction event chronology, decoded integrity or mapping is inconsistent.');}
  }
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
  const metadata=statisticsMetadata(request.matchId,request.gameId,effectiveMatch,
    {...effectiveGame,replayStatisticsRevision:nextRevision,activeReplayStatisticsId:request.sourceHash,
      replayStatisticsState:'READY'},{sourceHash:request.sourceHash,playerMapping:start.c.playerMapping});
  if(!metadata.eligible)throw fail('The current Game is not eligible for official native statistics.');
  const inputStats=nativeStatisticsExperienceInput(raw);
  const experience=augmentSeasonShowcase(inputStats,projectStatistics(inputStats,metadata),metadata) as
    ReturnType<typeof augmentSeasonShowcase>&{seasonShowcaseVersion?:string};
  if(experience.version!==EXPERIENCE_VERSION||
     experience.seasonShowcaseVersion!==SEASON_SHOWCASE_VERSION||
     experience.bindingKey!==statisticsBindingKey(metadata)||
     experience.players.length!==start.c.playerMapping.length||
     experience.players.some((p:Bag)=>!start.c.playerMapping.some((m:Bag)=>m.playerId===p.playerId)))
    throw fail('Native Season and player read-model bindings could not be qualified.');
  const source=publicationSource(start.c,{...request,expectedResultRevision:officialRevision},effectiveGame,effectiveMatch,experience,
    request.candidateId,official,nextRevision,actor);
  if(Buffer.byteLength(JSON.stringify(source),'utf8')>850_000)
    throw fail('Qualified native READY source exceeds the bounded Firestore document budget.');
  const approvedGame={...effectiveGame,
    activeReplayStatisticsId:request.sourceHash,replayStatisticsRevision:nextRevision,
    replayStatisticsState:'READY'};
  if(!activeNativeStatisticsSource(request.matchId,request.gameId,effectiveMatch,approvedGame,
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
    let fresh:any;
    try{fresh=await authority(tx);}catch{throw abort();}
    const claimNow=await tx.get(claimRef);
    if(fresh.fingerprint!==start.fingerprint||
       snap(claimNow.data()??null)!==claimToken||
       fresh.publicationExists||fresh.sourceExists)throw abort();
    if(correction)prepareNativeCorrection(fresh,request,actor);
    else checkedOfficial(fresh.game,fresh.match,request);
    const former=fresh.game.activeReplayStatisticsId;
    if(former){
      const prior=await tx.get(gameRef.collection('replaySources').doc(former));
      if(!prior.exists)throw abort();
      try{
        if(legacySourceFingerprint(prior.data(),request.matchId,request.gameId,former)!==previousSourceFingerprint)
          throw abort();
      }catch{throw abort();}
    }
    const publishedRevision=nextRevision;
    const journal={
      version:NATIVE_READY_PUBLICATION_VERSION,state:'ACTIVE',
      matchId:request.matchId,gameId:request.gameId,candidateId:request.candidateId,
      sourceHash:request.sourceHash,artifactSha256:request.expectedArtifactSha256,
      originalSourceRetained:true,officialResultRevision:officialRevision,
      resultBinding:snap({canonicalResult:effectiveGame.canonicalResult,recordingResultBinding:effectiveGame.recordingResultBinding??null}),
      previousActiveSourceId:request.expectedActiveSourceHash,
      previousSourceFingerprint,
      previousStatisticsState:fresh.game.replayStatisticsState??null,
      previousStatisticsRevision:request.expectedStatisticsRevision,
      previousReplay:fresh.game.replay??null,
      publishedStatisticsRevision:publishedRevision,
      claimCreated:!claimNow.exists,claimGuidHex:claimRef.id,
      ...(correction?{claimRebound:claimNow.exists}:{}),
      previousClaimFingerprint:claimNow.exists?snap(claimNow.data()):null,
      ...(correction?{correction:{version:NATIVE_READY_CORRECTION_VERSION,requestToken:correction.requestToken,
        disputeId:request.correction!.disputeId,priorResultRevision:request.expectedResultRevision,
        outcome:correction.outcome,priorBinding:fresh.game.recordingResultBinding,
        oldGuid:fresh.correction.data.oldGuid,newGuid:fresh.correction.data.newGuid,
        previousOldClaim:fresh.correction.data.oldClaim,previousNewClaim:fresh.correction.data.newClaim,
        gameHistoryFingerprint:snap({revision:request.expectedResultRevision,replacedByRevision:correction.revision,
          correctionCaseId:request.correction!.disputeId,archivedAt:correction.now,canonicalResult:fresh.game.canonicalResult,
          recordingResultBinding:fresh.game.recordingResultBinding,activeReplayStatisticsId:request.expectedActiveSourceHash}),
        matchHistoryFingerprint:snap({revision:request.expectedResultRevision,replacedByRevision:correction.revision,
          correctionCaseId:request.correction!.disputeId,archivedAt:correction.now,canonicalResult:fresh.match.canonicalResult})}}:{}),
      reviewedBy:actor.playerId,reason:request.reason.trim(),publishedAt:now,
    };
    if(correction)commitNativeCorrection(tx,fresh,request,correction,actor,matchRef,gameRef);
    tx.create(sourceRef,source);
    tx.create(publicationRef,journal);
    tx.update(candidateRef,{state:'PUBLISHED_READY',active:true,
      publishedSourceId:request.sourceHash,publishedAt:now});
    if(correction&&claimNow.exists)tx.update(claimRef,{sourceHash:request.sourceHash,
      nativePublicationCandidateId:request.candidateId,correctedAt:now});
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
      action:correction?'NATIVE_READY_RESULT_CORRECTED':'NATIVE_READY_SOURCE_PUBLISHED',targetType:'GAME',
      targetId:request.matchId+'/'+request.gameId,reason:request.reason.trim(),
      before:{statisticsId:request.expectedActiveSourceHash,statisticsRevision:request.expectedStatisticsRevision,
        ...(correction?{canonicalResult:fresh.game.canonicalResult,recordingResultBinding:fresh.game.recordingResultBinding}: {})},
      after:{statisticsId:request.sourceHash,statisticsRevision:publishedRevision,
        candidateId:request.candidateId,officialRevision,
        ...(correction?{canonicalResult:effectiveGame.canonicalResult,recordingResultBinding:correction.binding,disputeId:request.correction!.disputeId}: {})},
      createdAt:now});
    return {revision:publishedRevision};
  });
  return {success:true,alreadyPublished:false,state:'READY',activated:true,
    sourceHash:request.sourceHash,replayStatisticsRevision:txResult.revision,
    candidateId:request.candidateId,...(correction?{resultRevision:correction.revision}: {})};
}

async function rollbackNativePublication(input:{
  db:any;actor:NativeReadyActor;request:NativeReadyPublicationRequest;publicationRef:any;
  candidateRef:any;gameRef:any;matchRef:any;sourceRef:any;authority:(tx?:any)=>Promise<any>;
}):Promise<Bag>{
  const {db,actor,request,publicationRef,candidateRef,gameRef,sourceRef,authority}=input;
  const start=await authority();
  const publication=start.publication;
  if(publication?.correction)throw fail('Corrected native results require a new correction protocol, never emergency source rollback.');
  if(!start.publicationExists||!publication||publication.version!==NATIVE_READY_PUBLICATION_VERSION||
     publication.sourceHash!==request.sourceHash||publication.candidateId!==request.candidateId||
     publication.artifactSha256!==request.expectedArtifactSha256)
    throw fail('No matching audited native publication exists for this rollback.');
  if(publication.state==='ROLLED_BACK'){
    if(start.game.activeReplayStatisticsId===publication.previousActiveSourceId&&
       start.game.replayStatisticsRevision===publication.rolledBackStatisticsRevision&&
       publication.officialResultRevision===request.expectedResultRevision&&
       publication.resultBinding===snap({canonicalResult:start.game.canonicalResult,
         recordingResultBinding:start.game.recordingResultBinding??null})&&
       start.c.state==='ROLLED_BACK')
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
    if(!prior.exists||legacySourceFingerprint(prior.data(),request.matchId,request.gameId,
        publication.previousActiveSourceId)!==publication.previousSourceFingerprint)
      throw fail('The previous legacy recording source changed or is unavailable for rollback.');
  }
  const claimRef=db.collection('recordingGameClaims').doc(publication.claimGuidHex);
  const claim=await claimRef.get();
  if(!claim.exists||claim.data()?.matchId!==request.matchId||
     claim.data()?.gameId!==request.gameId||
     publication.claimCreated&&(claim.data()?.sourceHash!==request.sourceHash||
       claim.data()?.nativePublicationCandidateId!==request.candidateId)||
     !publication.claimCreated&&publication.previousClaimFingerprint!==undefined&&
       snap(claim.data())!==publication.previousClaimFingerprint)
    throw fail('The native recording claim changed ownership or revision and requires an audited correction.');
  const claimToken=snap(claim.data()??null);
  const rollbackRevision=request.expectedStatisticsRevision+1;
  const result=await db.runTransaction(async(tx:any)=>{
    const now=Timestamp.now();
    let fresh:any;
    try{fresh=await authority(tx);}catch{throw abort();}
    const freshClaim=await tx.get(claimRef);
    if(fresh.fingerprint!==start.fingerprint||snap(freshClaim.data()??null)!==claimToken||
       !freshClaim.exists||freshClaim.data()?.matchId!==request.matchId||
       freshClaim.data()?.gameId!==request.gameId||
       publication.claimCreated&&(
         freshClaim.data()?.sourceHash!==request.sourceHash||
         freshClaim.data()?.nativePublicationCandidateId!==request.candidateId)||
       !publication.claimCreated&&publication.previousClaimFingerprint!==undefined&&
         snap(freshClaim.data())!==publication.previousClaimFingerprint)
      throw abort();
    checkedOfficialForRollback(fresh.game,fresh.match,request);
    if(fresh.game.activeReplayStatisticsId!==request.sourceHash||
       fresh.game.replayStatisticsRevision!==request.expectedStatisticsRevision||
       fresh.publication?.state!=='ACTIVE')throw abort();
    if(publication.previousActiveSourceId){
      const former=await tx.get(gameRef.collection('replaySources').doc(publication.previousActiveSourceId));
      if(!former.exists)throw abort();
      try{
        if(legacySourceFingerprint(former.data(),request.matchId,request.gameId,
          publication.previousActiveSourceId)!==publication.previousSourceFingerprint)throw abort();
      }catch{throw abort();}
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
  const dispute=game.activeResultDisputeId??null;
  const disputed=!!dispute||!!match.activeResultDisputeId;
  // A formally opened dispute freezes downstream scoring. Restoring the old
  // evidence pointer during that dispute is safe and MUST NOT resolve it.
  if(disputed){
    if(!dispute||dispute!==match.activeResultDisputeId||
       game.status!=='DISPUTED'||match.status!=='DISPUTED')
      throw fail('Rollback dispute authority or status is inconsistent.');
  }else{
    const official=currentOfficialGameOutcome(game,match);
    if(official.qualification!=='OFFICIAL'||game.status!=='COMPLETED'||match.status!=='COMPLETED')
      throw fail('The official Game result is no longer eligible for native rollback.');
  }
  if(game.canonicalResult?.revision!==request.expectedResultRevision||
     game.recordingResultBinding||game.canonicalResult?.source==='RECORDING_VERIFIED')
    throw fail('The original accepted result changed or requires a separate recording rebind.');
}
