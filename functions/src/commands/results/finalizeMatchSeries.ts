import {Timestamp} from 'firebase-admin/firestore';
import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {requireAdmin} from '../../auth/authorization.js';
import {db} from '../../config/firebase.js';
import {callableOptions} from '../../config/runtime.js';
import {collections} from '../../domain/collections.js';
import {resolveSeriesResult, type AcceptedSeriesGame} from '../../engines/seriesResult.js';
import {normalizeOutcome, winningPlayerIds, losingPlayerIds} from '../../engines/resultEngine.js';
import {reserveIdempotencyKey} from '../../services/idempotency.js';
import {writeAdminAudit} from '../../services/audit.js';
import {assertResultShape, canonicalRevision, queueResultProcessingJob, resultProcessingJobId, type MatchForResult} from './resultSupport.js';
interface Input {requestId: string; matchId: string; expectedResultRevision: number; reason: string;}
export const adminFinalizeMatchSeries = onCall<Input>(callableOptions, async request => {
  const actor = await requireAdmin(request);
  const {requestId, matchId, expectedResultRevision} = request.data;
  const reason = request.data.reason?.trim();
  if (!matchId || !Number.isInteger(expectedResultRevision) || expectedResultRevision < 0 || !reason || reason.length > 1000) throw new HttpsError('invalid-argument', 'Provide Match, expected result revision (zero before finalization), and a reason.');
  const matchRef = db.collection(collections.matches).doc(matchId);
  return db.runTransaction(async transaction => {
    const [snapshot, games] = await Promise.all([transaction.get(matchRef), transaction.get(matchRef.collection('games'))]);
    if (!snapshot.exists) throw new HttpsError('not-found', 'Match not found.');
    const match = snapshot.data() as MatchForResult;
    assertResultShape(match);
    if (match.activeResultDisputeId || !['ACTIVE','AWAITING_CONFIRMATION','COMPLETED'].includes(match.status ?? '') || !match.seriesRule || match.seriesRule.maxGames <= 1 || match.format === 'FFA') throw new HttpsError('failed-precondition', 'Finalize an undisputed team series from accepted Games.');
    const previousRevision = match.canonicalResult ? canonicalRevision(match.canonicalResult) : 0;
    if (expectedResultRevision !== previousRevision) throw new HttpsError('aborted', 'Match result changed; review its current revision.');
    let resolved, outcome;
    try {
      resolved = resolveSeriesResult(games.docs.map(g => ({...g.data(), gameId: g.id}) as AcceptedSeriesGame), match.seriesRule, match.participants);
      outcome = normalizeOutcome(match.format, match.participants, resolved.result);
    } catch(error) {throw new HttpsError('failed-precondition', (error as Error).message);}
    if (JSON.stringify(match.canonicalResult?.seriesGameRevisions) === JSON.stringify(resolved.seriesGameRevisions) && match.status === 'COMPLETED') return {success: true, matchId, alreadyFinalized: true, resultRevision: previousRevision};
    const oldJobRef = db.collection(collections.processingJobs).doc(resultProcessingJobId(matchId, previousRevision));
    const oldJob = previousRevision ? await transaction.get(oldJobRef) : null;
    await reserveIdempotencyKey(transaction, requestId, 'adminFinalizeMatchSeries', actor.authUid);
    const now = Timestamp.now(), revision = previousRevision + 1;
    const canonicalResult = {...outcome, revision, winningPlayerIds: winningPlayerIds(outcome, match.participants), losingPlayerIds: losingPlayerIds(outcome, match.participants),
      source: previousRevision ? 'ADMIN_CORRECTED' : 'ADMIN_RESOLVED', submissionId: null, submittedBy: null, confirmedBy: null,
      acceptedAt: now, sourceGameId: resolved.sourceGameId, seriesGameRevisions: resolved.seriesGameRevisions};
    if (previousRevision) transaction.set(matchRef.collection('resultHistory').doc(`R${previousRevision}`), {canonicalResult: match.canonicalResult, revision: previousRevision, replacedByRevision: revision, archivedAt: now});
    if (oldJob?.exists && oldJob.data()?.status !== 'COMPLETED') transaction.update(oldJobRef, {status: 'SUPERSEDED', supersededByRevision: revision, updatedAt: now});
    transaction.update(matchRef, {status: 'COMPLETED', canonicalResult, resultVersion: revision, processingState: 'PENDING',
      firstCompletedAt: match.firstCompletedAt ?? match.completedAt ?? now, ...(previousRevision ? {} : {completedAt: now}), updatedAt: now});
    queueResultProcessingJob(transaction, {matchId, gameId: resolved.sourceGameId, seasonId: match.seasonId ?? null, eventId: match.eventId ?? null, revision, previousRevision: previousRevision || null, correctionCaseId: null});
    writeAdminAudit(transaction, {actorUid: actor.authUid, actorPlayerId: actor.playerId, action: 'MATCH_SERIES_FINALIZED', targetType: 'MATCH', targetId: matchId, reason, before: match.canonicalResult ?? null, after: canonicalResult});
    return {success: true, matchId, alreadyFinalized: false, resultRevision: revision};
  });
});
