import {Timestamp} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import {db} from '../config/firebase.js';
import {deriveRecordingOutcome} from '../engines/recordingOutcome.js';
import {currentOfficialGameOutcome} from '../engines/recordingMatchFacts.js';
import {applyCanonicalGameResult,assertResultShape} from '../commands/results/resultSupport.js';
import {writeAdminAudit} from './audit.js';

/** Outcome resolution has its own retryable stage. Statistics remain usable as
 * evidence while unsupported outcomes wait for a source-bound Emperor review. */
export async function resolveRecordingResult(matchId:string,gameId:string,review?:{sourceHash:string;outcome:any;reason:string;actorUid:string;actorPlayerId:string;playedWithinWindow:boolean}) {
  return db.runTransaction(async tx=>{
    const matchRef=db.collection('matches').doc(matchId),gameRef=matchRef.collection('games').doc(gameId);
    const [ms,gs]=await Promise.all([tx.get(matchRef),tx.get(gameRef)]),match=ms.data(),game=gs.data();
    if(!match||!game||!game.activeReplayStatisticsId)return {state:'NO_RECORDING'};
    const ref=gameRef.collection('replaySources').doc(game.activeReplayStatisticsId),source=(await tx.get(ref)).data();
    if(!source||source.state!=='READY'||source.sourceHash!==game.activeReplayStatisticsId||source.matchId!==matchId||source.gameId!==gameId)return {state:'NO_RECORDING'};
    if(review&&review.sourceHash!==source.sourceHash)throw new HttpsError('aborted','The active recording changed. Review it again.');
    if(match.opponentKind==='AI')return {state:'LEGACY_AI_REVIEW'};
    const qualification=deriveRecordingOutcome(match,game,source);
    const late=source.timingQualification==='ADMIN_REVIEW_REQUIRED';
    const resolved={...qualification,...(late?{state:'PENDING_ADMIN_REVIEW',reason:'Verify completion before the warm-up deadline against this recording.'}:{})};
    if(game.canonicalResult||game.activeResultDisputeId||match.activeResultDisputeId||['COMPLETED','CANCELLED','VOID','PROPOSED','DISPUTED'].includes(match.status)) {
      if(review)throw new HttpsError('failed-precondition','Use the correction dispute control for an accepted result.');
      // Never override an accepted human/admin result or reopen a cancelled Battle.
      if(game.canonicalResult&&game.recordingResultBinding?.sourceHash===source.sourceHash)return {state:'RESULT_ALREADY_RESOLVED'};
      if(JSON.stringify(source.outcomeQualification)!==JSON.stringify(resolved))tx.update(ref,{outcomeQualification:resolved});
      return {state:'RESULT_ALREADY_RESOLVED'};
    }
    if(review&&late&&!review.playedWithinWindow)throw new HttpsError('failed-precondition','Verify timely play before accepting late warm-up evidence.');
    if(!review&&resolved.state!=='VERIFIED') {
      if(JSON.stringify(source.outcomeQualification)!==JSON.stringify(resolved))tx.update(ref,{outcomeQualification:resolved});
      return resolved;
    }
    assertResultShape(match);
    const outcome=review?.outcome??qualification.outcome!;
    const guid=source.matchFacts?.game?.guid;
    // One recorded Game may have several perspectives, but cannot score in two Battles.
    const claimRef=typeof guid==='string'&&guid?db.collection('recordingGameClaims').doc(Buffer.from(guid).toString('hex').slice(0,1000)):null;
    const claim=claimRef?await tx.get(claimRef):null;
    let reclaimed=false;
    if(claim?.exists&&(claim.data()?.matchId!==matchId||claim.data()?.gameId!==gameId)) {
      const previousMatchRef=db.collection('matches').doc(claim.data()!.matchId),previousGameRef=previousMatchRef.collection('games').doc(claim.data()!.gameId);
      const [previousMatch,previousGame]=await Promise.all([tx.get(previousMatchRef),tx.get(previousGameRef)]),oldMatch=previousMatch.data(),oldGame=previousGame.data();
      const previousSource=typeof oldGame?.activeReplayStatisticsId==='string'?(await tx.get(previousGameRef.collection('replaySources').doc(oldGame.activeReplayStatisticsId))).data():null;
      // A wrong-Battle upload may be reused only after the original attribution
      // is withdrawn or a reviewed correction accepts a different recorded Game.
      reclaimed=['CANCELLED','VOID'].includes(oldMatch?.status)||oldGame?.canonicalResult?.source==='ADMIN_CORRECTED'&&previousSource?.state==='READY'&&typeof previousSource.matchFacts?.game?.guid==='string'&&previousSource.matchFacts.game.guid!==guid&&currentOfficialGameOutcome(oldGame,oldMatch).qualification==='OFFICIAL';
      if(!reclaimed) {
        if(review)throw new HttpsError('failed-precondition','This recorded Game is already attached to another Battle.');
        const blocked={...resolved,state:'PENDING_ADMIN_REVIEW',reason:'This recorded Game is already attached to another Battle. Upload the correct recording.'};
        tx.update(ref,{outcomeQualification:blocked});return blocked;
      }
    }
    const result=applyCanonicalGameResult(tx,{matchId,gameId,matchRef,gameRef,match,submissionId:null,submittedBy:null,confirmedBy:review?.actorPlayerId??null,source:review?'ADMIN_RESOLVED':'RECORDING_VERIFIED',outcome});
    const binding={sourceHash:source.sourceHash,evidenceToken:qualification.evidenceToken,resolverVersion:qualification.modelVersion};
    tx.update(gameRef,{recordingResultBinding:binding});
    tx.update(ref,{outcomeQualification:{...resolved,state:review?'ADMIN_VERIFIED':'VERIFIED',acceptedResultRevision:result.canonicalResult.revision,reviewReason:review?.reason??null},resultQualification:'OFFICIAL'});
    if(claimRef&&!claim?.exists)tx.create(claimRef,{matchId,gameId,sourceHash:source.sourceHash,createdAt:Timestamp.now()});
    if(claimRef&&reclaimed)tx.set(claimRef,{matchId,gameId,sourceHash:source.sourceHash,replacedClaim:claim!.data(),reassignedAt:Timestamp.now()});
    writeAdminAudit(tx,{actorUid:review?.actorUid??'SYSTEM_RECORDING_RESOLVER',actorPlayerId:review?.actorPlayerId??null,action:review?'RECORDING_RESULT_REVIEWED':'RECORDING_RESULT_ACCEPTED',targetType:'GAME',targetId:matchId+'/'+gameId,reason:review?.reason??null,after:{...binding,outcome}});
    return {state:'ACCEPTED',matchCompleted:result.matchCompleted};
  });
}
