import { HttpsError } from 'firebase-functions/v2/https';
import type { Transaction, DocumentReference } from 'firebase-admin/firestore';
import type { MatchParticipant, ScoringAct } from '../domain/types.js';
export function scoringSlotRef(eventRef: DocumentReference, act: ScoringAct, playerId: string) {
  return eventRef.collection('scoringSlots').doc(`${act}_${encodeURIComponent(playerId)}`);
}
// Read every claim before the caller begins writes. A designated opportunity is never reset by result corrections.
export async function prepareScoringSlots(transaction: Transaction, eventRef: DocumentReference, act: ScoringAct,
  matches: Array<{matchId: string; participants: MatchParticipant[]}>) {
  const seen = new Set<string>();
  const claims = matches.flatMap(match => match.participants.map(p => {
    if (seen.has(p.playerId)) throw new HttpsError('failed-precondition', 'A player has more than one scoring opportunity in this act.');
    seen.add(p.playerId);
    return {ref: scoringSlotRef(eventRef, act, p.playerId), playerId: p.playerId, matchId: match.matchId};
  }));
  const snapshots = await Promise.all(claims.map(c => transaction.get(c.ref)));
  snapshots.forEach((s, i) => {
    if (s.exists && s.data()?.matchId !== claims[i].matchId) throw new HttpsError('failed-precondition', 'This player already has a designated scoring Match for this act.');
  });
  return () => claims.forEach(c => transaction.set(c.ref, {playerId: c.playerId, matchId: c.matchId, act}));
}
