import {getStorage} from 'firebase-admin/storage';
import {Timestamp} from 'firebase-admin/firestore';
import {HttpsError,onCall} from 'firebase-functions/v2/https';
import {requireAdmin} from '../auth/authorization.js';
import {db} from '../config/firebase.js';
import {callableOptions} from '../config/runtime.js';
import {ACTIVE_NATIVE_SOURCE_VERSION,activeNativeStatisticsSource} from '../engines/activeNativeStatisticsSource.js';
import {decodeNativeDetailArtifact,type NativeDetailArtifact} from '../engines/nativeStatisticsDetail.js';
import {bindingDigest,digest} from '../engines/nativeRecordingIntegration.js';
import {nativeStatisticsExperienceInput} from '../engines/nativeStatisticsReadAdapter.js';
import {nativeSocialInput} from '../engines/nativeSocialInput.js';
import {projectSocialIncidents} from '../engines/socialIncidentCore.js';
import {currentOfficialGameOutcome} from '../engines/recordingMatchFacts.js';
import {projectStatistics,statisticsBindingKey} from '../engines/statisticsExperience.js';
import {augmentSeasonShowcase} from '../engines/seasonShowcaseProjection.js';
import {statisticsMetadata} from '../services/statisticsExperienceProjection.js';
import {assessNativePublication,assessNativeRollback,assertNativePublicationAllowed,
  nativePublicationReviewToken,NATIVE_PUBLICATION_REVIEW,NATIVE_PUBLICATION_VERSION} from '../engines/nativeReadyPublication.js';

type Bag=Record<string,any>;
const SHA=/^[a-f0-9]{64}$/;
const precondition=(text:string)=>new HttpsError('failed-precondition',text);
const changed=()=>new HttpsError('aborted','Native publication review inputs changed; inspect and review again.');
const loss=()=>new HttpsError('data-loss','Immutable native evidence failed pinned-generation or SHA-256 verification.');
const wrap=(fn:()=>any):any=>{
  try{return fn();}catch(error){throw precondition(error instanceof Error?error.message:'Native publication cannot proceed.');}
};
export interface NativeReadyPublicationRequest {
  matchId:string;gameId:string;candidateId:string;
  mode:'PUBLISH'|'ROLLBACK';phase:'REVIEW'|'COMMIT';
  expectedReviewToken?:string;reason?:string;
}

/** Only pinned, create-only objects may furnish authoritative publishing bytes.
 * Verification uses the original bytes, event gzip bytes, *and* decoded compact
 * statistics. It never silently reconstructs huge full per-player episodes.
 */
export async function prepareNativeReadyEvidence(bucket:any,candidate:Bag,match:Bag,game:Bag,
  matchId:string,gameId:string,revision:number){
  const pinned=async(meta:Bag,max:number):Promise<Buffer>=>{
    if(!meta||typeof meta.path!=='string'||!/^[0-9]+$/.test(String(meta.generation??''))||
       !Number.isSafeInteger(meta.bytes)||meta.bytes<1||meta.bytes>max||
       !SHA.test(meta.sha256??''))throw loss();
    let bytes:Buffer;
    try{[bytes]=await bucket.file(meta.path,{generation:String(meta.generation)}).download();}
    catch{throw loss();}
    if(bytes.length!==meta.bytes||digest(bytes)!==meta.sha256)throw loss();
    return bytes;
  };
  const original=await pinned(candidate.originalRecording,32*1024*1024);
  if(digest(original)!==candidate.sourceHash)throw loss();
  // Event-stream framing and decoded evidence were checked by native validation.
  // Pinned generation plus identical compressed-byte digest preserves that proof.
  const events=await pinned(candidate.recordedEvents,48*1024*1024);
  if(candidate.recordedEvents?.format!=='jsonl'||candidate.recordedEvents?.compression!=='gzip'||
     !SHA.test(candidate.recordedEvents?.uncompressedSha256??'')||
     !Number.isSafeInteger(candidate.recordedEvents?.uncompressedBytes)||
     candidate.recordedEvents.uncompressedBytes<1||candidate.recordedEvents.uncompressedBytes>512*1024*1024||
     !events.length)throw loss();
  const bytes=await pinned(candidate.statistics,48*1024*1024);
  let raw:Bag,experience:Bag;
  try{
    raw=decodeNativeDetailArtifact(bytes,candidate.statistics as NativeDetailArtifact,{
      sourceHash:candidate.sourceHash,eventsSha256:candidate.recordedEvents.sha256,
      extractionRunId:candidate.extraction.revision,
    });
    if(bindingDigest(raw.matchFacts)!==bindingDigest(candidate.matchFacts))
      throw new Error('Native Match facts do not match the validated candidate.');
    const mapping=candidate.playerMapping;
    const neutral=nativeSocialInput(raw,mapping);
    const outcome=currentOfficialGameOutcome(game,match);
    const social=projectSocialIncidents({statistics:neutral,playerMapping:mapping,
      officialOutcome:outcome,context:{battleId:matchId,gameId:matchId+'/'+gameId}});
    if(social.status!=='REVIEW_AVAILABLE')
      throw new Error('Native social interpreter did not qualify this complete neutral evidence.');
    const newGame={...game,activeReplayStatisticsId:candidate.sourceHash,
      replayStatisticsState:'READY',replayStatisticsRevision:revision};
    const metadata=statisticsMetadata(matchId,gameId,match,newGame,{
      sourceHash:candidate.sourceHash,playerMapping:mapping,opponentMapping:[],
    });
    const selective=nativeStatisticsExperienceInput(raw);
    experience=augmentSeasonShowcase(selective,projectStatistics(selective,metadata),metadata);
    if(experience.version!=='AOF_STATISTICS_EXPERIENCE_V3'||experience.eligible!==true||
       experience.bindingKey!==statisticsBindingKey(metadata)||
       experience.players?.length!==mapping.length||
       experience.players.some((p:Bag)=>!mapping.some((m:Bag)=>m.playerId===p.playerId)))
      throw new Error('Native StatisticsExperience does not bind the current official Game.');
  }catch(error){
    throw new HttpsError('data-loss','Native evidence or projection is not safe to publish: '+
      (error instanceof Error?error.message:'invalid candidate'));
  }
  const published={
    state:'READY',nativePublicationVersion:ACTIVE_NATIVE_SOURCE_VERSION,
    matchId,gameId,sourceHash:candidate.sourceHash,
    replayStatisticsRevision:revision,processorRevision:candidate.processorRevision,
    nativeValidationCandidateId:candidate.candidateId??null,
    artifactRevision:candidate.artifactRevision,
    sourceBytes:candidate.originalRecording.bytes,
    playerMapping:candidate.playerMapping,opponentMapping:[],
    originalRecording:candidate.originalRecording,
    recordedEvents:candidate.recordedEvents,
    statistics:candidate.statistics,extraction:candidate.extraction,
    matchFacts:candidate.matchFacts,completeness:candidate.completeness??null,
    experience,officialOutcomeAtIngestion:{...currentOfficialGameOutcome(game,match),historicalSnapshotOnly:true},
    resultQualification:'OFFICIAL',nativeResultAutodetectionEnabled:false,
  };
  // nativeValidationCandidateId is set before checking this payload later.
  return published;
}
function safeEvidenceDoc(candidate:Bag,published:Bag,matchId:string,gameId:string){
  const value={...published,nativeValidationCandidateId:candidate.candidateId};
  if(!SHA.test(value.nativeValidationCandidateId)||Buffer.byteLength(JSON.stringify(value),'utf8')>850_000)
    throw precondition('Native READY source exceeds bounded Firestore document limits.');
  return value;
}

export async function nativeReadyPublication(input:{
  db:any;bucket:any;env:NodeJS.ProcessEnv;
  actor:{playerId:string;authUid:string;role:string};
  request:NativeReadyPublicationRequest;
}){
  const {db,bucket,env,actor,request}=input;
  if(!request||!['PUBLISH','ROLLBACK'].includes(request.mode)||
     !['REVIEW','COMMIT'].includes(request.phase)||
     !SHA.test(request.candidateId??''))throw new HttpsError('invalid-argument','Invalid native publication operation or candidate ID.');
  const {matchId,gameId,candidateId}=request;
  const processor=wrap(()=>assertNativePublicationAllowed(env,actor.role,matchId,gameId,request.mode));
  if(request.phase==='COMMIT'&&
    (!SHA.test(request.expectedReviewToken??'')||typeof request.reason!=='string'||
      request.reason.trim().length<8||request.reason.trim().length>1000))
    throw new HttpsError('invalid-argument','Commit requires the reviewed revision token and an 8–1000 character reason.');

  const matchRef=db.collection('matches').doc(matchId),
    gameRef=matchRef.collection('games').doc(gameId),
    candidateRef=gameRef.collection('nativeReplayValidations').doc(candidateId),
    journalRef=gameRef.collection('nativeReplayPublications').doc(candidateId),
    adminRef=db.collection('players').doc(actor.playerId),
    linkRef=db.collection('authLinks').doc(actor.authUid);
  const readAuthority=async(tx?:any)=>{
    const read=(ref:any)=>tx?tx.get(ref):ref.get();
    const [ms,gs,cs,admin,link,js]=await Promise.all([
      read(matchRef),read(gameRef),read(candidateRef),read(adminRef),read(linkRef),read(journalRef),
    ]);
    if(!ms.exists||!gs.exists||!cs.exists||
       admin.data()?.role!=='ADMIN'||admin.data()?.membershipStatus!=='ACTIVE'||
       link.data()?.playerId!==actor.playerId)throw precondition('Publication authority or validated candidate is unavailable.');
    const match=ms.data() as Bag,game=gs.data() as Bag,candidate={...cs.data(),candidateId} as Bag;
    const ids=(game.players??[]).map((p:Bag)=>p.playerId);
    if(!Array.isArray(game.players)||ids.length<2||ids.length>8||
       new Set(ids).size!==ids.length||ids.some((id:any)=>typeof id!=='string'||!id))
      throw precondition('Invalid current League Game roster.');
    const players=await Promise.all(ids.map((id:string)=>read(db.collection('players').doc(id))));
    if(players.some((s:any)=>!s.exists||s.data()?.membershipStatus!=='ACTIVE'))
      throw precondition('All current League Game participants must retain active membership.');
    const sourceRef=gameRef.collection('replaySources').doc(candidate.sourceHash);
    const [source,prior]=await Promise.all([
      read(sourceRef),
      game.activeReplayStatisticsId&&game.activeReplayStatisticsId!==candidate.sourceHash?
        read(gameRef.collection('replaySources').doc(game.activeReplayStatisticsId)):Promise.resolve(null),
    ]);
    if(game.activeReplayStatisticsId&&game.activeReplayStatisticsId!==candidate.sourceHash&&
       (!prior?.exists||prior.data()?.state!=='READY'||
        prior.data()?.nativePublicationVersion!==undefined||
        prior.data()?.recordedEvents?.datasetVersion==='AOF_RECORDED_EVENTS_V1'))
      throw precondition('Native publishing can replace only a valid legacy READY source under separate review.');
    return {match,game,candidate,source:source.data(),prior:prior?.data()??null,
      journal:js.data()??null,matchRef,gameRef,candidateRef,journalRef,sourceRef,
      players:players.map((s:any)=>s.data()),admin:admin.data(),link:link.data()};
  };

  if(request.mode==='PUBLISH'){
    const first=await readAuthority();
    // A retry with the same review token is idempotent. This guard is repeated
    // inside the transaction; no legacy source can be mutated or overwritten.
    if(first.journal?.state==='ACTIVE'&&first.journal.reviewToken===request.expectedReviewToken&&
       first.game.activeReplayStatisticsId===first.candidate.sourceHash&&request.phase==='COMMIT')
      return {success:true,alreadyPublished:true,matchId,gameId,candidateId,
        sourceHash:first.candidate.sourceHash,revision:first.journal.publishedRevision};
    const assessment=wrap(()=>assessNativePublication({
      matchId,gameId,candidateId,match:first.match,game:first.game,candidate:first.candidate,
      existingSource:first.source,processorRevision:processor,actorPlayerId:actor.playerId,
    }));
    const token=nativePublicationReviewToken({
      candidateId,actorPlayerId:actor.playerId,candidate:first.candidate,
      match:first.match,game:first.game,players:first.players,admin:first.admin,
      link:first.link,previousSource:first.prior,
    });
    if(request.phase==='COMMIT'&&token!==request.expectedReviewToken)throw changed();
    const ready=safeEvidenceDoc(first.candidate,await prepareNativeReadyEvidence(bucket,first.candidate,
      first.match,first.game,matchId,gameId,assessment.newStatisticsRevision),matchId,gameId);
    if(request.phase==='REVIEW')
      return {success:true,phase:'REVIEW',publishable:true,activated:false,
        matchId,gameId,candidateId,sourceHash:first.candidate.sourceHash,
        previousSourceId:assessment.previousSourceId,
        resultRevision:assessment.resultRevision,proposedStatisticsRevision:assessment.newStatisticsRevision,
        reviewToken:token,statisticsArtifactSha256:ready.statistics.sha256,
        originalReplayRetained:true,scoringEffectsApplied:false};
    const committed=await db.runTransaction(async(tx:any)=>{
      const now=await readAuthority(tx);
      if(now.journal?.state==='ACTIVE'&&now.journal.reviewToken===request.expectedReviewToken&&
         now.game.activeReplayStatisticsId===now.candidate.sourceHash)
        return {alreadyPublished:true,revision:now.journal.publishedRevision};
      const fresh=wrap(()=>assessNativePublication({
        matchId,gameId,candidateId,match:now.match,game:now.game,candidate:now.candidate,
        existingSource:now.source,processorRevision:processor,actorPlayerId:actor.playerId,
      }));
      const nextToken=nativePublicationReviewToken({
        candidateId,actorPlayerId:actor.playerId,candidate:now.candidate,match:now.match,
        game:now.game,players:now.players,admin:now.admin,link:now.link,
        previousSource:now.prior,
      });
      if(nextToken!==request.expectedReviewToken||fresh.newStatisticsRevision!==assessment.newStatisticsRevision||
         now.journal!==null)throw changed();
      const currentOfficial=currentOfficialGameOutcome(now.game,now.match);
      if(bindingDigest(currentOfficial)!==bindingDigest(assessment.officialOutcome))
        throw changed();
      const source={...ready,replayStatisticsRevision:fresh.newStatisticsRevision};
      const proposedGame={...now.game,activeReplayStatisticsId:now.candidate.sourceHash,
        replayStatisticsState:'READY',replayStatisticsRevision:fresh.newStatisticsRevision};
      if(!activeNativeStatisticsSource(matchId,gameId,now.match,proposedGame,
        now.candidate.sourceHash,source,true))throw precondition('Published native source fails its own authenticated reader contract.');
      const instant=Timestamp.now();
      const journal={
        version:NATIVE_PUBLICATION_VERSION,state:'ACTIVE',matchId,gameId,candidateId,
        sourceHash:now.candidate.sourceHash,previousSourceId:fresh.previousSourceId,
        previousReplay:now.game.replay??null,
        previousReplayStatisticsState:now.game.replayStatisticsState??null,
        previousReplayStatisticsRevision:now.game.replayStatisticsRevision??0,
        publishedRevision:fresh.newStatisticsRevision,resultRevision:fresh.resultRevision,
        officialOutcomeToken:bindingDigest(currentOfficial),reviewToken:nextToken,
        sourceStatisticsSha256:source.statistics.sha256,
        processorRevision:processor,publishedBy:actor.playerId,publishedAt:instant,
      };
      tx.create(now.sourceRef,source);
      tx.create(now.journalRef,journal);
      tx.update(now.gameRef,{
        activeReplayStatisticsId:now.candidate.sourceHash,
        replayStatisticsState:'READY',
        replayStatisticsRevision:fresh.newStatisticsRevision,
        replayStatisticsUpdatedAt:instant,
        nativeReplayPublication:{candidateId,sourceHash:now.candidate.sourceHash,
          revision:fresh.newStatisticsRevision},
        replay:{...(now.game.replay??{}),status:'PARSED',
          sourceHash:now.candidate.sourceHash,statisticsId:now.candidate.sourceHash,
          statisticsState:'READY'},
        updatedAt:instant,
      });
      tx.create(db.collection('adminAudit').doc('NATIVE_READY_'+candidateId),{
        action:'NATIVE_REPLAY_SOURCE_PUBLISHED',actorUid:actor.authUid,
        actorPlayerId:actor.playerId,targetType:'GAME',targetId:matchId+'/'+gameId,
        reason:request.reason!.trim(),before:{sourceHash:fresh.previousSourceId,
          resultRevision:fresh.resultRevision},
        after:{sourceHash:now.candidate.sourceHash,statisticsRevision:fresh.newStatisticsRevision},
        createdAt:instant,
      });
      return {alreadyPublished:false,revision:fresh.newStatisticsRevision};
    });
    return {success:true,phase:'COMMIT',activated:true,alreadyPublished:committed.alreadyPublished,
      candidateId,matchId,gameId,sourceHash:first.candidate.sourceHash,revision:committed.revision};
  }

  // Rollback is never automatic. Restoring a previous active legacy source is
  // allowed only while the *same* official result and native revision are live.
  const rollbackAuthority=async(tx?:any)=>{
    const state=await readAuthority(tx),source=state.source;
    const prevId=state.journal?.previousSourceId??null;
    const ref=prevId?state.gameRef.collection('replaySources').doc(prevId):null;
    const previous=ref?(tx?await tx.get(ref):await ref.get()):null;
    if(prevId&&(!previous?.exists||previous.data()?.state!=='READY'||
       previous.data()?.nativePublicationVersion!==undefined||
       previous.data()?.recordedEvents?.datasetVersion==='AOF_RECORDED_EVENTS_V1'))
      throw precondition('Historical legacy rollback source is unavailable or changed.');
    return {...state,previous:previous?.data()??null};
  };
  const first=await rollbackAuthority();
  if(first.journal?.state==='ROLLED_BACK'&&request.phase==='COMMIT'&&
     first.journal.rollbackReviewToken===request.expectedReviewToken&&
     first.game.activeReplayStatisticsId===(first.journal.previousSourceId??null))
    return {success:true,phase:'COMMIT',rolledBack:true,alreadyRolledBack:true,matchId,gameId,candidateId};
  const rollback=wrap(()=>assessNativeRollback({
    matchId,gameId,candidateId,match:first.match,game:first.game,source:first.source,
    journal:first.journal,sourceHash:first.candidate.sourceHash,
  }));
  const rollbackToken=bindingDigest([NATIVE_PUBLICATION_REVIEW,'ROLLBACK',
    candidateId,actor.playerId,first.match,first.game,first.source,first.journal,first.previous,
    first.players,first.admin,first.link]);
  if(request.phase==='REVIEW')
    return {success:true,phase:'REVIEW',rollbackEligible:true,activated:true,
      matchId,gameId,candidateId,sourceHash:first.candidate.sourceHash,
      restoreSourceId:rollback.previousSourceId,resultRevision:rollback.resultRevision,
      proposedStatisticsRevision:rollback.newRevision,reviewToken:rollbackToken,
      sourceBytesRetained:true,scoringReconciliationRequired:true};
  if(rollbackToken!==request.expectedReviewToken)throw changed();
  const result=await db.runTransaction(async(tx:any)=>{
    const state=await rollbackAuthority(tx);
    if(state.journal?.state==='ROLLED_BACK'&&state.journal.rollbackReviewToken===request.expectedReviewToken&&
       state.game.activeReplayStatisticsId===(state.journal.previousSourceId??null))
      return {alreadyRolledBack:true,revision:state.game.replayStatisticsRevision};
    const accepted=wrap(()=>assessNativeRollback({
      matchId,gameId,candidateId,match:state.match,game:state.game,source:state.source,
      journal:state.journal,sourceHash:state.candidate.sourceHash,
    }));
    const token=bindingDigest([NATIVE_PUBLICATION_REVIEW,'ROLLBACK',
      candidateId,actor.playerId,state.match,state.game,state.source,state.journal,state.previous,
      state.players,state.admin,state.link]);
    if(token!==request.expectedReviewToken||accepted.newRevision!==rollback.newRevision)
      throw changed();
    const instant=Timestamp.now();
    tx.update(state.gameRef,{
      activeReplayStatisticsId:accepted.previousSourceId,
      replayStatisticsState:accepted.previousSourceId?'READY':'UNAVAILABLE',
      replayStatisticsRevision:accepted.newRevision,
      replayStatisticsUpdatedAt:instant,nativeReplayPublication:null,
      replay:state.journal.previousReplay,
      updatedAt:instant,
    });
    tx.update(state.journalRef,{
      state:'ROLLED_BACK',rollbackReviewToken:token,rolledBackBy:actor.playerId,
      rolledBackAt:instant,rolledBackRevision:accepted.newRevision,
    });
    tx.create(db.collection('adminAudit').doc('NATIVE_READY_ROLLBACK_'+candidateId),{
      action:'NATIVE_REPLAY_SOURCE_ROLLED_BACK',actorUid:actor.authUid,
      actorPlayerId:actor.playerId,targetType:'GAME',targetId:matchId+'/'+gameId,
      reason:request.reason!.trim(),before:{sourceHash:state.candidate.sourceHash,
        statisticsRevision:state.game.replayStatisticsRevision},
      after:{sourceHash:accepted.previousSourceId,statisticsRevision:accepted.newRevision},
      createdAt:instant,
    });
    return {alreadyRolledBack:false,revision:accepted.newRevision};
  });
  return {success:true,phase:'COMMIT',rolledBack:true,alreadyRolledBack:result.alreadyRolledBack,
    matchId,gameId,candidateId,sourceHash:first.candidate.sourceHash,
    restoredSourceId:rollback.previousSourceId,revision:result.revision};
}

function bucketName(){
  const configured=process.env.REPLAY_BUCKET?.trim();
  if(configured)return configured;
  const project=process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT;
  if(!project)throw precondition('Native storage bucket is not configured.');
  return project+'.appspot.com';
}
/** An admin must first inspect REVIEW and explicitly COMMIT with the matching
 * token and explanation. Published only in allowlisted staging/demo environments.
 * No uploader calls this automatically and no normal replay route changes.
 */
export const adminNativeReadyPublication=onCall<NativeReadyPublicationRequest>(
  {...callableOptions,memory:'1GiB',timeoutSeconds:180},async request=>{
    const actor=await requireAdmin(request);
    return nativeReadyPublication({db,bucket:getStorage().bucket(bucketName()),env:process.env,
      actor,request:request.data});
  },
);
