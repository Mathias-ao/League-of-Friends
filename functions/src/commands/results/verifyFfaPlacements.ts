import {Timestamp} from 'firebase-admin/firestore';
import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {requireAdmin} from '../../auth/authorization.js';
import {db} from '../../config/firebase.js';
import {callableOptions} from '../../config/runtime.js';
import {collections} from '../../domain/collections.js';
import type {VerifiedFfaPlacements} from '../../domain/types.js';
import {validateFfaPlacements} from '../../engines/seasonScoring.js';
import {reserveIdempotencyKey} from '../../services/idempotency.js';
import {writeAdminAudit} from '../../services/audit.js';
import {canonicalRevision, queueResultProcessingJob, resultProcessingJobId, type MatchForResult} from './resultSupport.js';
interface Input {requestId: string; matchId: string; expectedResultRevision: number; finishingOrder: string[]; evidence: string;}
export const adminVerifyFfaPlacements = onCall<Input>(callableOptions, async request => {
  const actor = await requireAdmin(request);
  const {requestId, matchId, expectedResultRevision, finishingOrder} = request.data;
  const evidence = request.data.evidence?.trim();
  if (!matchId || !Number.isInteger(expectedResultRevision) || !evidence || evidence.length > 2000) throw new HttpsError('invalid-argument', 'Provide Match, expected revision and verification evidence.');
  const matchRef = db.collection(collections.matches).doc(matchId);
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(matchRef);
    const match = snapshot.data() as MatchForResult;
    if (!snapshot.exists || match.status !== 'COMPLETED' || match.activeResultDisputeId || match.format !== 'FFA' || !match.seasonScoring?.placementRule || !match.canonicalResult || !match.participants) {
      throw new HttpsError('failed-precondition', 'Placements require a completed, undisputed nondiplomatic FFA with locked ranking rules.');
    }
    const oldRevision = canonicalRevision(match.canonicalResult);
    if (oldRevision !== expectedResultRevision) throw new HttpsError('aborted', 'Result changed; review the current revision.');
    const placements: VerifiedFfaPlacements = {qualification: 'VERIFIED', rule: match.seasonScoring.placementRule, finishingOrder, evidence, verifiedBy: actor.playerId};
    try {validateFfaPlacements(placements, match.seasonScoring, match.participants, match.canonicalResult.winningPlayerIds ?? []);}
    catch (error) {throw new HttpsError('invalid-argument', (error as Error).message);}
    const gameId = match.canonicalResult.sourceGameId as string;
    if (!gameId || match.seriesRule?.maxGames !== 1) throw new HttpsError('failed-precondition', 'FFA placements require a single accepted Game.');
    const gameRef = matchRef.collection('games').doc(gameId);
    const oldJobRef = db.collection(collections.processingJobs).doc(resultProcessingJobId(matchId, oldRevision));
    const [game, oldJob] = await Promise.all([transaction.get(gameRef), transaction.get(oldJobRef)]);
    if (!game.exists || game.data()?.activeResultDisputeId || canonicalRevision(game.data()?.canonicalResult) !== oldRevision) throw new HttpsError('aborted', 'Game and Match results disagree.');
    await reserveIdempotencyKey(transaction, requestId, 'adminVerifyFfaPlacements', actor.authUid);
    const now = Timestamp.now();
    const revision = oldRevision + 1;
    const result = {...match.canonicalResult, revision, ffaPlacements: placements};
    for (const ref of [matchRef, gameRef]) transaction.set(ref.collection('resultHistory').doc(`R${oldRevision}`), {canonicalResult: ref === matchRef ? match.canonicalResult : game.data()?.canonicalResult, revision: oldRevision, replacedByRevision: revision, archivedAt: now});
    transaction.update(matchRef, {canonicalResult: result, resultVersion: revision, processingState: 'PENDING', updatedAt: now});
    transaction.update(gameRef, {canonicalResult: {...game.data()?.canonicalResult, revision, ffaPlacements: placements}, resultRevision: revision, updatedAt: now});
    if (oldJob.exists && oldJob.data()?.status !== 'COMPLETED') transaction.update(oldJobRef, {status: 'SUPERSEDED', supersededByRevision: revision, updatedAt: now});
    queueResultProcessingJob(transaction, {matchId, gameId, seasonId: match.seasonId ?? null, eventId: match.eventId ?? null, revision, previousRevision: oldRevision, correctionCaseId: null});
    writeAdminAudit(transaction, {actorUid: actor.authUid, actorPlayerId: actor.playerId, action: 'FFA_PLACEMENTS_VERIFIED', targetType: 'MATCH', targetId: matchId, reason: evidence, before: match.canonicalResult, after: result});
    return {success: true, matchId, resultRevision: revision, placementStatus: 'VERIFIED'};
  });
});
