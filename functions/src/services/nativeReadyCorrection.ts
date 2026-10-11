import {Timestamp} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import {applyCanonicalGameResult,assertResultShape,isSingleGameMatch,previewCanonicalGameResult,
  resultProcessingJobId} from '../commands/results/resultSupport.js';
import {bindingDigest} from '../engines/nativeRecordingIntegration.js';
import {normalizeOutcome} from '../engines/resultEngine.js';
import {currentOfficialGameOutcome} from '../engines/recordingMatchFacts.js';
import type {NativeReadyPublicationRequest} from './nativeReadyPublication.js';

export const NATIVE_READY_CORRECTION_VERSION='AOF_NATIVE_READY_CORRECTION_V1_EXPERIMENTAL';
type Bag=Record<string,any>;
const fail=(message:string):never=>{throw new HttpsError('failed-precondition',message);};
const token=bindingDigest;
export const guidKey=(guid:unknown):string=>{
  if(typeof guid!=='string'||!guid||Buffer.byteLength(guid)>500)fail('A bounded recorded Game GUID is required.');
  return Buffer.from(guid as string).toString('hex');
};

/** Read-only extension to the existing publisher's authority snapshot. No READY writer here. */
export async function readCorrectionAuthority(db:any,gameRef:any,matchRef:any,r:NativeReadyPublicationRequest,
  c:Bag,get:(ref:any)=>Promise<any>){
  const refs={dispute:gameRef.collection('resultDisputes').doc(r.correction!.disputeId),
    oldSource:gameRef.collection('replaySources').doc(r.expectedActiveSourceHash!),
    oldJob:db.collection('processingJobs').doc(resultProcessingJobId(r.matchId,r.expectedResultRevision)),
    legacyJob:db.collection('processingJobs').doc('MATCH_RESULT_'+r.matchId),
    newJob:db.collection('processingJobs').doc(resultProcessingJobId(r.matchId,r.expectedResultRevision+1)),
    gameHistory:gameRef.collection('resultHistory').doc('R'+r.expectedResultRevision),
    matchHistory:matchRef.collection('resultHistory').doc('R'+r.expectedResultRevision)};
  const entries=await Promise.all(Object.entries(refs).map(async([key,ref])=>[key,(await get(ref)).data()??null]));
  const data=Object.fromEntries(entries);
  const oldGuid=guidKey(data.oldSource?.matchFacts?.game?.guid),newGuid=guidKey(c.matchFacts?.game?.guid);
  const oldClaimRef=db.collection('recordingGameClaims').doc(oldGuid);
  const newClaimRef=db.collection('recordingGameClaims').doc(newGuid);
  const [oldClaim,newClaim]=await Promise.all([get(oldClaimRef),get(newClaimRef)]);
  // A query also fences unexpected extra Games created while verification runs.
  const games=await get(matchRef.collection('games'));
  return {refs,oldClaimRef,newClaimRef,data:{...data,oldGuid,newGuid,
    oldClaim:oldClaim.data()??null,newClaim:newClaim.data()??null,gameIds:games.docs.map((d:any)=>d.id).sort()}};
}

export function prepareNativeCorrection(start:Bag,r:NativeReadyPublicationRequest,actor:Bag){
  const {game,match,c}=start,d=start.correction.data,old=d.oldSource,review=r.correction!;
  assertResultShape(match);
  if(!isSingleGameMatch(match)||(match.opponentKind??'HUMAN')!=='HUMAN'||(match as Bag).aiOpponent||game.aiOpponent||
     token(d.gameIds)!==token([r.gameId])||game.status!=='DISPUTED'||match.status!=='DISPUTED'||
     game.activeResultDisputeId!==review.disputeId||match.activeResultDisputeId!==review.disputeId||
     d.dispute?.status!=='OPEN'||!['WRONG_REPLAY','WRONG_RESULT'].includes(d.dispute.category)||
     d.dispute.resultRevision!==r.expectedResultRevision||
     token(d.dispute.canonicalResultSnapshot)!==token(game.canonicalResult)||
     game.canonicalResult?.revision!==r.expectedResultRevision||
     match.canonicalResult?.revision!==r.expectedResultRevision||match.canonicalResult.sourceGameId!==r.gameId||
     game.recordingResultBinding?.sourceHash!==r.expectedActiveSourceHash||
     game.activeReplayStatisticsId!==r.expectedActiveSourceHash||game.replayStatisticsRevision!==r.expectedStatisticsRevision||
     game.replayStatisticsState!=='READY'||r.sourceHash===r.expectedActiveSourceHash)
    fail('Correction requires one accepted recording-bound human Game and the exact open correction dispute and revisions.');
  const oldGame={...game,status:'COMPLETED',activeResultDisputeId:null};
  const oldMatch={...match,status:'COMPLETED',activeResultDisputeId:null};
  const accepted=currentOfficialGameOutcome(oldGame,oldMatch);
  const matchAccepted=currentOfficialGameOutcome({...oldGame,canonicalResult:match.canonicalResult},oldMatch);
  if(accepted.qualification!=='OFFICIAL'||token(accepted)!==token(matchAccepted))fail('Accepted Game and Match outcomes disagree.');
  if(old?.state!=='READY'||old.sourceHash!==r.expectedActiveSourceHash||old.matchId!==r.matchId||old.gameId!==r.gameId||
     old.nativePublicationVersion!==undefined||old.recordedEvents||old.statistics?.projectionDeliveryVersion)
    fail('Only an immutable legacy predecessor in this Game may be corrected.');
  const own=(claim:Bag)=>claim?.matchId===r.matchId&&claim?.gameId===r.gameId&&claim?.sourceHash===r.expectedActiveSourceHash;
  if(!own(d.oldClaim)||d.newGuid===d.oldGuid&&!own(d.newClaim)||d.newGuid!==d.oldGuid&&d.newClaim)
    fail('GUID ownership is missing, changed or already claimed; correction cannot reclaim another Battle.');
  if(d.gameHistory||d.matchHistory||d.newJob||!d.oldJob||d.oldJob.matchId!==r.matchId||
     d.oldJob.gameId!==r.gameId||d.oldJob.resultRevision!==r.expectedResultRevision||
     !['BLOCKED','COMPLETED'].includes(d.oldJob.status)||d.oldJob.status==='BLOCKED'&&d.oldJob.blockedByDisputeId!==review.disputeId)
    fail('Correction history or processing revision collides, or the accepted revision job is not qualified.');
  if(d.legacyJob&&(d.legacyJob.matchId!==r.matchId||
     !['BLOCKED','COMPLETED','SUPERSEDED'].includes(d.legacyJob.status)))fail('Legacy result job authority is inconsistent.');
  if(c.bindingToken!==start.validationToken)fail('Candidate was not validated against the current disputed Game and administrator.');
  // Recheck the existing upload identity policy against the fenced documents.
  // Never refresh external Steam data or perform network writes in publication.
  const normalized=(name:string)=>name.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US');
  for(const mapped of c.playerMapping){
    const name=normalized(mapped.sourceName);
    const explicit=(game.replayParticipantBindings??[]).filter((p:Bag)=>p.sourceNameNormalized===name);
    const candidates=explicit.length?explicit.map((p:Bag)=>p.playerId):start.rosterPlayers.flatMap((p:Bag,i:number)=>{
      const names=p.steamPersonaName?[p.steamPersonaName,...(p.steamNameHistory??[])]:p.steamIdentityVersion?[]:[p.steamName];
      return names.some((v:unknown)=>typeof v==='string'&&normalized(v)===name)?[game.players[i].playerId]:[];
    });
    if(candidates.length!==1||candidates[0]!==mapped.playerId)fail('Reviewed replay identity mapping no longer resolves uniquely to the roster.');
  }
  const shape=(players:Bag[])=>players.map(p=>({playerId:p.playerId,team:p.team??null})).sort((a,b)=>a.playerId.localeCompare(b.playerId));
  if(token(shape(match.participants))!==token(shape(game.players)))fail('Match and Game rosters differ.');
  let outcome;
  try{outcome=normalizeOutcome(match.format,match.participants,review.outcome,match.gameConfigSnapshot);}
  catch{throw new HttpsError('invalid-argument','Reviewed correction winner is invalid for this Match.');}
  if(token(outcome)!==token(review.outcome))throw new HttpsError('invalid-argument','Supply the exact normalized reviewed official outcome.');
  const now=Timestamp.now(),revision=r.expectedResultRevision+1;
  const canonical=previewCanonicalGameResult({match,outcome,revision,source:'ADMIN_CORRECTED',
    submissionId:null,submittedBy:null,confirmedBy:null});
  const result={...canonical,acceptedAt:now};
  const binding={sourceHash:r.sourceHash,resolverVersion:NATIVE_READY_CORRECTION_VERSION,
    evidenceToken:token({candidateId:r.candidateId,sourceHash:r.sourceHash,events:c.recordedEvents.sha256,
      statistics:r.expectedArtifactSha256,extraction:c.extraction.revision,disputeId:review.disputeId,outcome})};
  const firstCompletedAt=match.firstCompletedAt??match.completedAt??now;
  const correctedGame={...oldGame,firstCompletedAt,canonicalResult:result,resultRevision:revision,recordingResultBinding:binding,
    activeReplayStatisticsId:r.sourceHash,replayStatisticsRevision:r.expectedStatisticsRevision+1,replayStatisticsState:'READY'};
  const correctedMatch={...oldMatch,firstCompletedAt,canonicalResult:{...result,sourceGameId:r.gameId},resultVersion:revision};
  if(currentOfficialGameOutcome(correctedGame,correctedMatch).qualification!=='OFFICIAL')fail('Corrected official result is not qualified.');
  return {now,revision,outcome,binding,game:correctedGame,match:correctedMatch,
    requestToken:token({request:r,actor:{playerId:actor.playerId,authUid:actor.authUid}})};
}

/** All reads/fences belong to the publisher transaction and precede this write-only step.
 * Reuse canonical acceptance/job semantics; never award or reconcile in the publisher. */
export function commitNativeCorrection(tx:any,fresh:Bag,r:NativeReadyPublicationRequest,plan:Bag,actor:Bag,matchRef:any,gameRef:any){
  const {refs,oldClaimRef}=fresh.correction,d=fresh.correction.data,now=plan.now;
  const history={revision:r.expectedResultRevision,replacedByRevision:plan.revision,
    correctionCaseId:r.correction!.disputeId,archivedAt:now};
  tx.create(refs.gameHistory,{...history,canonicalResult:fresh.game.canonicalResult,
    recordingResultBinding:fresh.game.recordingResultBinding,activeReplayStatisticsId:r.expectedActiveSourceHash});
  tx.create(refs.matchHistory,{...history,canonicalResult:fresh.match.canonicalResult});
  for(const key of ['oldJob','legacyJob'])if(d[key]&&!['COMPLETED','SUPERSEDED'].includes(d[key].status))
    tx.update(refs[key],{status:'SUPERSEDED',blockedReason:'RESULT_CORRECTED',supersededByRevision:plan.revision,updatedAt:now});
  applyCanonicalGameResult(tx,{matchId:r.matchId,gameId:r.gameId,matchRef,gameRef,match:fresh.match,
    source:'ADMIN_CORRECTED',outcome:plan.outcome,revision:plan.revision,previousRevision:r.expectedResultRevision,
    correctionCaseId:r.correction!.disputeId,submissionId:null,submittedBy:null,confirmedBy:null,
    acceptedAt:now,processingJobRef:refs.newJob});
  tx.update(gameRef,{recordingResultBinding:plan.binding});
  tx.update(refs.dispute,{status:'RESOLVED_CORRECTED',resolution:'CORRECT',resolutionReason:r.reason.trim(),
    resolvedBy:actor.playerId,resolvedAt:now,correctedToRevision:plan.revision,correctedOutcome:plan.outcome,updatedAt:now,
    nativePublicationCandidateId:r.candidateId});
  // Same GUID: update its source attribution. Different GUID: release only the
  // exact old claim fenced above; both full claim snapshots are kept in the journal.
  if(d.oldGuid!==d.newGuid)tx.delete(oldClaimRef);
}
