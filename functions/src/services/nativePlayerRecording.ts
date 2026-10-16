import {Timestamp} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import {assertNativePlayerUploadAllowed,NATIVE_PLAYER_UPLOAD} from '../engines/nativePlayerUpload.js';
import {bindingDigest,verifyNativePackage,NATIVE_PACKAGE} from '../engines/nativeRecordingIntegration.js';
import {ACTIVE_NATIVE_SOURCE_VERSION,activeNativeStatisticsSource} from '../engines/activeNativeStatisticsSource.js';
import {assertNativePublicationAllowed,checkedCandidate,readImmutable,checkedMapping,type NativeReadyPublicationRequest} from './nativeReadyPublication.js';
import {nativeSocialInput} from '../engines/nativeSocialInput.js';
import {projectStatistics} from '../engines/statisticsExperience.js';
import {augmentSeasonShowcase} from '../engines/seasonShowcaseProjection.js';
import {statisticsMetadata} from './statisticsExperienceProjection.js';
import {assertMatchPlayOpened,matchPlayWindow} from './eventTiming.js';
import {resolveRecordingResult} from './recordingResult.js';
import {currentOfficialGameOutcome} from '../engines/recordingMatchFacts.js';

type Bag=Record<string,any>;
type Actor={playerId:string;authUid:string;role:string};
const fail=(message:string)=>new HttpsError('failed-precondition',message);
const abort=()=>new HttpsError('aborted','Recording source or upload authority changed; retry.');

/** Server-owned authority, read again inside every publication transaction. */
export async function readNativePlayerAuthority(input:{db:any;matchId:string;gameId:string;actor:Actor;sourceHash:string;tx?:any}) {
  const {db,matchId,gameId,actor,sourceHash,tx}=input;
  const read=(ref:any)=>tx?tx.get(ref):ref.get();
  const mr=db.collection('matches').doc(matchId),gr=mr.collection('games').doc(gameId);
  const [ms,gs,ps,ls]=await Promise.all([read(mr),read(gr),read(db.collection('players').doc(actor.playerId)),read(db.collection('authLinks').doc(actor.authUid))]);
  if(!ms.exists||!gs.exists)throw fail('Game is unavailable.');
  const match=ms.data(),game=gs.data(),player=ps.data(),link=ls.data();
  if(player?.membershipStatus!=='ACTIVE'||link?.playerId!==actor.playerId||player.role!==actor.role||
     !(game.players??[]).some((p:Bag)=>p.playerId===actor.playerId)&&player.role!=='ADMIN')
    throw new HttpsError('permission-denied','An active Game participant or administrator is required.');
  if(match.opponentKind==='AI'||game.aiOpponent)throw fail('Native AI recordings are not qualified.');
  if(match.activeResultDisputeId||game.activeResultDisputeId||
     ['CANCELLED','VOID','PROPOSED','DISPUTED'].includes(match.status)||['CANCELLED','VOID','DISPUTED','REMAKE','NO_CONTEST'].includes(game.status))
    throw fail('This Game cannot receive ordinary recording evidence. Use its existing dispute workflow.');
  if(game.canonicalResult&&game.activeReplayStatisticsId!==sourceHash)
    throw fail('An accepted result requires the existing reviewed source publication or correction workflow.');
  const ids=(game.players??[]).map((p:Bag)=>p.playerId);
  if(ids.length<2||ids.length>8||new Set(ids).size!==ids.length||ids.some((id:any)=>typeof id!=='string'||!id||id.includes('/')))
    throw fail('Invalid native league roster.');
  const players=await Promise.all(ids.map((id:string)=>read(db.collection('players').doc(id))));
  if(players.some((p:any)=>!p.exists))throw fail('Game identity is unavailable.');
  const event=match.eventId&&match.scoringSnapshot?.rules?.act==='WARMUP'&&!(match.playOpensAt instanceof Timestamp)
    ?(await read(db.collection('events').doc(match.eventId))).data():null;
  const window=matchPlayWindow(match,event??undefined);
  assertMatchPlayOpened({playOpensAt:window.opensAt});
  return {game,match,window,token:bindingDigest({game,match,players:players.map((p:any)=>p.data()),player,link,event})};
}

/** Existing separately gated administrator rollback surface, for an unresolved
 * first upload only. Accepted results must use the canonical dispute/rebind path.
 * The source and all retained objects survive; only its active pointer is withdrawn. */
export async function rollbackPendingNativePlayerRecording(input:{db:any;actor:Actor;request:NativeReadyPublicationRequest;env:NodeJS.ProcessEnv}){
  const {db,actor,request:r,env}=input;
  assertNativePublicationAllowed(env,actor,r);
  if(r.operation!=='ROLLBACK'||r.expectedResultRevision!==0||r.expectedActiveSourceHash!==r.sourceHash)throw fail('Pin an unresolved native first upload for rollback.');
  const mr=db.collection('matches').doc(r.matchId),gr=mr.collection('games').doc(r.gameId);
  const sr=gr.collection('replaySources').doc(r.sourceHash),pr=gr.collection('nativeReplayPublications').doc(r.candidateId),cr=gr.collection('nativeReplayValidations').doc(r.candidateId);
  return db.runTransaction(async(tx:any)=>{
    const [ms,gs,ss,ps,cs,admin,link]=await Promise.all([tx.get(mr),tx.get(gr),tx.get(sr),tx.get(pr),tx.get(cr),
      tx.get(db.collection('players').doc(actor.playerId)),tx.get(db.collection('authLinks').doc(actor.authUid))]);
    const m=ms.data(),g=gs.data(),s=ss.data(),p=ps.data(),c=cs.data();
    if(admin.data()?.role!=='ADMIN'||admin.data()?.membershipStatus!=='ACTIVE'||link.data()?.playerId!==actor.playerId)
      throw new HttpsError('permission-denied','Current administrator authority is required.');
    if(!m||!g||!s||!p||!c||g.canonicalResult||g.activeResultDisputeId||m.activeResultDisputeId||
       ['CANCELLED','VOID','PROPOSED','DISPUTED'].includes(m.status)||
       s.ordinaryUploadVersion!==NATIVE_PLAYER_UPLOAD||p.version!==NATIVE_PLAYER_UPLOAD||
       p.sourceHash!==r.sourceHash||s.nativeValidationCandidateId!==r.candidateId||
       s.statistics.sha256!==r.expectedArtifactSha256||p.artifactSha256!==r.expectedArtifactSha256||
       p.previousActiveSourceId!==null||p.publishedStatisticsRevision!==r.expectedStatisticsRevision)
      throw fail('Only a pinned unresolved first upload can be withdrawn; accepted results require correction.');
    const claimRef=db.collection('recordingGameClaims').doc(p.claimGuidHex),claim=await tx.get(claimRef);
    if(p.state==='ROLLED_BACK'&&g.activeReplayStatisticsId===null&&g.replayStatisticsRevision===p.rollbackRevision&&c.state==='ROLLED_BACK'&&!claim.exists)
      return {success:true,state:'ROLLED_BACK',alreadyRolledBack:true};
    if(p.state!=='ACTIVE'||c.state!=='PUBLISHED_READY'||g.activeReplayStatisticsId!==r.sourceHash||g.replayStatisticsRevision!==r.expectedStatisticsRevision||
       !p.claimCreated||claim.data()?.matchId!==r.matchId||claim.data()?.gameId!==r.gameId||claim.data()?.sourceHash!==r.sourceHash)throw abort();
    const now=Timestamp.now(),revision=r.expectedStatisticsRevision+1;
    tx.update(gr,{activeReplayStatisticsId:null,replayStatisticsState:'UNAVAILABLE',replayStatisticsRevision:revision,
      replay:{...(g.replay??{}),status:'NONE',sourceHash:null,statisticsId:null,statisticsState:'UNAVAILABLE'},updatedAt:now});
    tx.update(pr,{state:'ROLLED_BACK',rollbackRevision:revision,rolledBackBy:actor.playerId,rolledBackAt:now});
    tx.update(cr,{state:'ROLLED_BACK',active:false});tx.delete(claimRef);
    tx.create(db.collection('adminAudit').doc(r.candidateId+'-PENDING_ROLLBACK'),{actorUid:actor.authUid,actorPlayerId:actor.playerId,
      action:'NATIVE_PENDING_UPLOAD_ROLLED_BACK',targetType:'GAME',targetId:r.matchId+'/'+r.gameId,reason:r.reason,
      before:{sourceHash:r.sourceHash,statisticsRevision:r.expectedStatisticsRevision},after:{sourceHash:null,statisticsRevision:revision},createdAt:now});
    return {success:true,state:'ROLLED_BACK',alreadyRolledBack:false,replayStatisticsRevision:revision};
  });
}

/** No winner is needed for READY statistics. Result resolution remains the existing retryable stage. */
export async function publishNativePlayerRecording(input:{db:any;bucket:any;matchId:string;gameId:string;sourceHash:string;candidateId?:string;actor:Actor;env:NodeJS.ProcessEnv}) {
  const {db,bucket,matchId,gameId,sourceHash,actor,env}=input;
  const processor=assertNativePlayerUploadAllowed(env,matchId,gameId);
  const mr=db.collection('matches').doc(matchId),gr=mr.collection('games').doc(gameId);
  const sr=gr.collection('replaySources').doc(sourceHash);
  const authority=(tx?:any)=>readNativePlayerAuthority({...input,tx});
  const initial=await authority();
  const existing=await sr.get();
  if(existing.exists){
    const result=await db.runTransaction(async(tx:any)=>{
      const fresh=await authority(tx),s=(await tx.get(sr)).data();
      if(s?.ordinaryUploadVersion!==NATIVE_PLAYER_UPLOAD||
         !activeNativeStatisticsSource(matchId,gameId,fresh.match,fresh.game,sourceHash,s,true,true))throw abort();
      const journal=await tx.get(gr.collection('nativeReplayPublications').doc(s.nativeValidationCandidateId));
      const claim=await tx.get(db.collection('recordingGameClaims').doc(Buffer.from(s.matchFacts.game.guid).toString('hex')));
      if(journal.data()?.state!=='ACTIVE'||journal.data()?.sourceHash!==sourceHash||
         journal.data()?.publishedStatisticsRevision!==fresh.game.replayStatisticsRevision||
         claim.data()?.matchId!==matchId||claim.data()?.gameId!==gameId||claim.data()?.sourceHash!==sourceHash)throw abort();
      return {revision:fresh.game.replayStatisticsRevision,mapping:s.playerMapping};
    });
    return finish(result.revision,result.mapping,true);
  }
  if(!input.candidateId)throw fail('A verified recording candidate is required.');
  const cr=gr.collection('nativeReplayValidations').doc(input.candidateId);
  const pr=gr.collection('nativeReplayPublications').doc(input.candidateId);
  const cs=await cr.get(),c=cs.data();
  if(!cs.exists||c.ordinaryUploadVersion!==NATIVE_PLAYER_UPLOAD||c.validatedBy!==actor.playerId||
     c.bindingToken!==initial.token||c.state!=='VALIDATED_NOT_READY')throw abort();
  checkedCandidate(c,{matchId,gameId,sourceHash,candidateId:input.candidateId,expectedArtifactSha256:c.statistics.sha256} as any,processor);
  // Use the same package verifier and immutable generation reader, not a second parser.
  const [original,events,statistics]=await Promise.all([
    readImmutable(bucket,c.originalRecording,32*1024*1024),readImmutable(bucket,c.recordedEvents,48*1024*1024),readImmutable(bucket,c.statistics,48*1024*1024),
  ]);
  const verified=await verifyNativePackage({contract:NATIVE_PACKAGE,state:'VERIFIED_UNPUBLISHED',originalRecordingRetentionRequired:true,
    sourceHash,sourceBytes:original.length,sourcePlayers:c.playerMapping.map((p:Bag)=>({replaySlot:p.replaySlot,sourceName:p.sourceName})),
    matchFacts:c.matchFacts,recordedEvents:{...c.recordedEvents,base64:events.toString('base64')},
    statistics:{...c.statistics,base64:statistics.toString('base64')}},original);
  if(verified.revision!==c.artifactRevision||bindingDigest(verified.extraction)!==bindingDigest(c.extraction)||
     bindingDigest(verified.completeness)!==bindingDigest(c.completeness))throw fail('Native candidate provenance changed.');
  checkedMapping(c.playerMapping,initial.game.players,verified.raw);
  nativeSocialInput(verified.raw,c.playerMapping); // evidence availability only; no social interpretation
  const guid=c.matchFacts.game?.guid;
  if(typeof guid!=='string'||!guid||Buffer.byteLength(guid)>500)throw fail('A recorded Game GUID is required.');
  const claimRef=db.collection('recordingGameClaims').doc(Buffer.from(guid).toString('hex'));
  const revision=Number(initial.game.replayStatisticsRevision??0)+1;
  const metadata=statisticsMetadata(matchId,gameId,initial.match,{...initial.game,replayStatisticsRevision:revision},c);
  const experience=augmentSeasonShowcase(verified.experienceInput,projectStatistics(verified.experienceInput,metadata),metadata);
  const now=Timestamp.now();
  const source={state:'READY',nativePublicationVersion:ACTIVE_NATIVE_SOURCE_VERSION,ordinaryUploadVersion:NATIVE_PLAYER_UPLOAD,
    matchId,gameId,sourceHash,replayStatisticsRevision:revision,nativeValidationCandidateId:input.candidateId,
    artifactRevision:c.artifactRevision,processorRevision:c.processorRevision,playerMapping:c.playerMapping,
    originalRecording:c.originalRecording,recordedEvents:c.recordedEvents,statistics:c.statistics,extraction:c.extraction,
    matchFacts:c.matchFacts,experience,resultQualification:'UNRESOLVED',sourceBytes:original.length,
    timingQualification:initial.match.timingPolicy&&initial.window.closesAt&&Date.now()>=initial.window.closesAt.toMillis()?'ADMIN_REVIEW_REQUIRED':'WITHIN_UPLOAD_WINDOW',
    uploadedBy:actor.playerId,uploadedAt:now};
  if(Buffer.byteLength(JSON.stringify(source))>850_000)throw fail('Native source exceeds Firestore size budget.');
  await db.runTransaction(async(tx:any)=>{
    const fresh=await authority(tx);
    const [candidate,journal,prior,claim]=await Promise.all([tx.get(cr),tx.get(pr),tx.get(sr),tx.get(claimRef)]);
    if(fresh.token!==initial.token||bindingDigest(candidate.data())!==bindingDigest(c)||journal.exists||prior.exists)throw abort();
    if(claim.exists&&(claim.data()?.matchId!==matchId||claim.data()?.gameId!==gameId))throw fail('This recorded Game is already claimed by another Battle.');
    // Pending evidence may be replaced; accepted results were rejected by authority().
    // Retain every source and GUID claim. Only the current pointer contributes.
    const previousId=fresh.game.activeReplayStatisticsId;
    const previous=previousId?(await tx.get(gr.collection('replaySources').doc(previousId))).data():null;
    if(previousId&&previous?.state!=='READY')throw abort();
    const previousJournalRef=previous?.ordinaryUploadVersion===NATIVE_PLAYER_UPLOAD
      ?gr.collection('nativeReplayPublications').doc(previous.nativeValidationCandidateId):null;
    const previousJournal=previousJournalRef?await tx.get(previousJournalRef):null;
    if(previousJournalRef&&previousJournal?.data()?.state!=='ACTIVE')throw abort();
    if(previousJournalRef)tx.update(previousJournalRef,{state:'SUPERSEDED',supersededBy:input.candidateId,supersededAt:now});
    tx.create(sr,source);
    tx.create(pr,{version:NATIVE_PLAYER_UPLOAD,state:'ACTIVE',matchId,gameId,candidateId:input.candidateId,sourceHash,
      artifactSha256:c.statistics.sha256,previousActiveSourceId:fresh.game.activeReplayStatisticsId??null,
      previousStatisticsRevision:Number(fresh.game.replayStatisticsRevision??0),publishedStatisticsRevision:revision,
      originalSourceRetained:true,claimGuidHex:claimRef.id,claimCreated:!claim.exists,publishedBy:actor.playerId,publishedAt:now});
    tx.update(cr,{state:'PUBLISHED_READY',active:true,readyBlockers:[],publishedSourceId:sourceHash,publishedAt:now});
    if(!claim.exists)tx.create(claimRef,{matchId,gameId,sourceHash,nativePublicationCandidateId:input.candidateId,createdAt:now});
    else if(claim.data()?.sourceHash!==sourceHash)tx.update(claimRef,{sourceHash,nativePublicationCandidateId:input.candidateId,previousClaim:claim.data(),updatedAt:now});
    tx.update(gr,{activeReplayStatisticsId:sourceHash,replayStatisticsState:'READY',replayStatisticsRevision:revision,
      replayStatisticsUpdatedAt:now,replay:{...(fresh.game.replay??{}),status:'PARSED',sourceHash,statisticsId:sourceHash,statisticsState:'READY'},updatedAt:now});
    tx.create(db.collection('adminAudit').doc(input.candidateId+'-NATIVE_UPLOAD'),{actorUid:actor.authUid,actorPlayerId:actor.playerId,
      action:'NATIVE_PLAYER_RECORDING_PUBLISHED',targetType:'GAME',targetId:matchId+'/'+gameId,
      after:{sourceHash,statisticsRevision:revision,candidateId:input.candidateId},createdAt:now});
  });
  return finish(revision,c.playerMapping,false);
  async function finish(revision:number,mapping:Bag[],alreadyProcessed:boolean){
    const outcomeResolution=await resolveRecordingResult(matchId,gameId,undefined,db);
    const resultQualification=await db.runTransaction(async(tx:any)=>{
      const fresh=await authority(tx),source=(await tx.get(sr)).data();
      if(fresh.game.replayStatisticsRevision!==revision||
         !activeNativeStatisticsSource(matchId,gameId,fresh.match,fresh.game,sourceHash,source,true,true))throw abort();
      return currentOfficialGameOutcome(fresh.game,fresh.match).qualification;
    });
    return {success:true,state:'READY',alreadyProcessed,matchId,gameId,statisticsId:sourceHash,sourceHash,
      replayStatisticsRevision:revision,playerMapping:mapping,outcomeResolution,resultQualification};
  }
}
