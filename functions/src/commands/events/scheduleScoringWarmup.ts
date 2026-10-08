import {Timestamp} from 'firebase-admin/firestore';
import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {requireAdmin} from '../../auth/authorization.js';
import {db} from '../../config/firebase.js';
import {callableOptions} from '../../config/runtime.js';
import {collections, leagueStateDocumentId} from '../../domain/collections.js';
import type {MatchFormat, MatchParticipant, GameConfiguration} from '../../domain/types.js';
import {scoringSnapshot, lockSeasonScoring} from '../../engines/seasonScoring.js';
import {prepareScoringSlots} from '../../services/scoringSlots.js';
import {reserveIdempotencyKey} from '../../services/idempotency.js';
import {writeAdminAudit} from '../../services/audit.js';
import {createCivilizationDraft} from '../../engines/civilizationDraftEngine.js';
interface Input {requestId: string; eventId: string; format: MatchFormat; participants: MatchParticipant[];}
export const adminScheduleScoringWarmup = onCall<Input>(callableOptions, async request => {
  const actor = await requireAdmin(request);
  const {eventId, format, participants, requestId} = request.data;
  if (!eventId || !['ONE_V_ONE','TWO_V_TWO','THREE_V_THREE','FOUR_V_FOUR','ASYMMETRIC_TEAM'].includes(format) ||
    !Array.isArray(participants) || participants.length < 2 || participants.length > 8 || participants.some(p => !p || typeof p.playerId !== 'string') ||
    new Set(participants.map(p => p.playerId)).size !== participants.length ||
    new Set(participants.map(p => p.slot)).size !== participants.length ||
    participants.some(p => !p.playerId || !Number.isInteger(p.slot) || p.slot < 1 || p.slot > 8 || ![1,2].includes(p.team!))) {
    throw new HttpsError('invalid-argument', 'Warm-up requires a valid two-sided roster with unique slots and players.');
  }
  const sizes = [1,2].map(team => participants.filter(p => p.team === team).length);
  const expectedSizes: Partial<Record<MatchFormat, number>> = {ONE_V_ONE: 1, TWO_V_TWO: 2, THREE_V_THREE: 3, FOUR_V_FOUR: 4};
  const expected = expectedSizes[format];
  if (sizes.some(n => n === 0) || expected && sizes.some(n => n !== expected)) throw new HttpsError('invalid-argument', 'Warm-up roster does not match its format.');
  const eventRef = db.collection(collections.events).doc(eventId);
  const matchRef = db.collection(collections.matches).doc();
  await db.runTransaction(async transaction => {
    const [event, state] = await Promise.all([transaction.get(eventRef), transaction.get(db.collection(collections.leagueState).doc(leagueStateDocumentId))]);
    const data = event.data();
    if (!event.exists || !data?.seasonId || !['PUBLISHED','ACTIVE'].includes(data.status)) throw new HttpsError('failed-precondition', 'Warm-up requires a published or active Event.');
    const players = await Promise.all(participants.map(p => transaction.get(db.collection(collections.players).doc(p.playerId))));
    const entries = await Promise.all(participants.map(p => transaction.get(db.collection(collections.seasons).doc(data.seasonId).collection('participants').doc(p.playerId))));
    if (players.some(p => p.data()?.membershipStatus !== 'ACTIVE') || entries.some(e => e.data()?.status !== 'ENTERED')) throw new HttpsError('failed-precondition', 'Warm-up players must be active members entered in this Season.');
    const config = data.gameConfig as GameConfiguration;
    const lock = lockSeasonScoring({act: 'WARMUP', format, gameConfig: config, emperorPlayerId: state.data()?.currentEmperorPlayerId ?? null});
    const commitSlots = await prepareScoringSlots(transaction, eventRef, 'WARMUP', [{matchId: matchRef.id, participants}]);
    const draft = config.civilizations.mode === 'DRAFT' ? createCivilizationDraft({matchId: matchRef.id, gameId: 'G1', gameNumber: 1, participants, civilizationConfiguration: config.civilizations}) : null;
    await reserveIdempotencyKey(transaction, requestId, 'adminScheduleScoringWarmup', actor.authUid);
    const now = Timestamp.now();
    commitSlots();
    transaction.create(matchRef, {seasonId: data.seasonId, eventId, format, participants, status: 'READY',
      context: {type: 'SEASON_EVENT', affectsLeaguePoints: true, affectsWarRoomPoints: false, affectsGold: true, affectsSeasonStats: true, affectsLifetimeStats: true, affectsPowerRating: true},
      seriesRule: {maxGames: 1, gamesRequiredToWin: 1}, seasonScoring: lock, scoringSnapshot: scoringSnapshot(),
      gameConfigSnapshot: config, goldRewardSnapshot: data.goldRewardSnapshot, canonicalResult: null,
      createdBy: actor.playerId, createdAt: now, updatedAt: now, completedAt: null});
    transaction.create(matchRef.collection('games').doc('G1'), {gameNumber: 1, status: 'READY',
      players: participants.map(p => ({...p, color: null, civilization: null, civilizationSelection: 'UNKNOWN', position: null})),
      gameConfigSnapshot: config, civilizationDraftId: draft ? 'G1' : null, civilizationDraftStatus: draft?.status ?? null,
      replayParticipantBindings: (data.replayParticipantBindings ?? []).filter((b: {playerId: string}) => participants.some(p => p.playerId === b.playerId)),
      replay: null, canonicalResult: null, startedAt: null, completedAt: null, createdAt: now, updatedAt: now});
    if (draft) transaction.create(matchRef.collection('civilizationDrafts').doc('G1'), {matchId: matchRef.id, gameId: 'G1', participantIds: participants.map(p => p.playerId), ...draft, createdBy: actor.playerId, createdAt: now, updatedAt: now, completedAt: null});
    writeAdminAudit(transaction, {actorUid: actor.authUid, actorPlayerId: actor.playerId, action: 'SCORING_WARMUP_SCHEDULED', targetType: 'MATCH', targetId: matchRef.id, after: {eventId, participants, seasonScoring: lock}});
  });
  return {success: true, eventId, matchId: matchRef.id};
});
