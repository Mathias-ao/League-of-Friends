import {Timestamp} from 'firebase-admin/firestore';
import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {requireAdmin} from '../../auth/authorization.js';
import {db} from '../../config/firebase.js';
import {callableOptions} from '../../config/runtime.js';
import {collections} from '../../domain/collections.js';
import type {MatchParticipant, GameConfiguration} from '../../domain/types.js';
import {createCivilizationDraft} from '../../engines/civilizationDraftEngine.js';
import {reserveIdempotencyKey} from '../../services/idempotency.js';
import {writeAdminAudit} from '../../services/audit.js';
interface Input {requestId: string; matchId: string; starterPlayerIds: string[]; reason: string;}
/** Record the actual roster before play; retain all scoring reservations, including no-shows. */
export const adminConfirmMatchStarters = onCall<Input>(callableOptions, async request => {
  const actor = await requireAdmin(request);
  const {requestId, matchId, starterPlayerIds} = request.data;
  const reason = request.data.reason?.trim();
  if (!matchId || !Array.isArray(starterPlayerIds) || starterPlayerIds.length < 2 || starterPlayerIds.some(id => typeof id !== 'string' || !id) || new Set(starterPlayerIds).size !== starterPlayerIds.length || !reason || reason.length > 1000) throw new HttpsError('invalid-argument', 'Provide unique actual starters and the reason for the roster correction.');
  const matchRef = db.collection(collections.matches).doc(matchId);
  return db.runTransaction(async transaction => {
    const [snapshot, games, drafts] = await Promise.all([transaction.get(matchRef), transaction.get(matchRef.collection('games')), transaction.get(matchRef.collection('civilizationDrafts'))]);
    const match = snapshot.data();
    const roster = (match?.plannedParticipants ?? match?.participants ?? []) as MatchParticipant[];
    if (!snapshot.exists || match?.status !== 'READY' || match.canonicalResult || games.docs.some(g => g.data().status !== 'READY' || g.data().canonicalResult || g.data().startedAt) ||
      drafts.docs.some(d => d.data().selections?.length)) throw new HttpsError('failed-precondition', 'Confirm actual starters before play, result submission or civilization picks.');
    if (starterPlayerIds.some(id => !roster.some(p => p.playerId === id))) throw new HttpsError('invalid-argument', 'Starters must belong to the designated roster.');
    const participants = roster.filter(p => starterPlayerIds.includes(p.playerId));
    let format = match.format;
    if (format !== 'FFA') {
      const sizes = [1,2].map(team => participants.filter(p => p.team === team).length);
      if (sizes.some(n => !n)) throw new HttpsError('failed-precondition', 'A played team Match needs starters on both sides. Cancel a no-contest Match.');
      format = sizes[0] === sizes[1] ? ['','ONE_V_ONE','TWO_V_TWO','THREE_V_THREE','FOUR_V_FOUR'][sizes[0]] : 'ASYMMETRIC_TEAM';
    }
    const config = match.gameConfigSnapshot as GameConfiguration;
    if (!config?.civilizations) throw new HttpsError('failed-precondition', 'Game configuration is incomplete.');
    const rebuiltDrafts = games.docs.map(g => config.civilizations.mode === 'DRAFT' ? createCivilizationDraft({matchId, gameId: g.id, gameNumber: g.data().gameNumber, participants, civilizationConfiguration: config.civilizations}) : null);
    await reserveIdempotencyKey(transaction, requestId, 'adminConfirmMatchStarters', actor.authUid);
    const now = Timestamp.now();
    transaction.update(matchRef, {participants, format, teamSizes: format === 'FFA' ? null : [1,2].map(team => participants.filter(p => p.team === team).length), plannedParticipants: match.plannedParticipants ?? roster, startersConfirmedBy: actor.playerId, updatedAt: now});
    games.docs.forEach((g, i) => {
      transaction.update(g.ref, {players: participants.map(p => g.data().players.find((old: MatchParticipant) => old.playerId === p.playerId) ?? {...p, color: null, civilization: null, civilizationSelection: 'UNKNOWN', position: null}), updatedAt: now});
      if (rebuiltDrafts[i]) transaction.set(matchRef.collection('civilizationDrafts').doc(g.id), {matchId, gameId: g.id, participantIds: starterPlayerIds, ...rebuiltDrafts[i], createdBy: actor.playerId, createdAt: now, updatedAt: now, completedAt: null});
    });
    writeAdminAudit(transaction, {actorUid: actor.authUid, actorPlayerId: actor.playerId, action: 'MATCH_STARTERS_CONFIRMED', targetType: 'MATCH', targetId: matchId, reason, before: roster, after: participants});
    return {success: true, matchId, starterPlayerIds, format};
  });
});
