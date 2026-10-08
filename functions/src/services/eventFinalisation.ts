import {type Transaction,type DocumentReference} from 'firebase-admin/firestore';
import {db} from '../config/firebase.js';
import {eventFinalisationBlockers} from '../engines/eventFinalisation.js';
export async function readEventFinalisation(ref:DocumentReference,event:any,tx?:Transaction) {
  const read=(r:any):Promise<any>=>tx?tx.get(r):r.get();
  const [matches,jobs,challenges]=await Promise.all([read(db.collection('matches').where('eventId','==',ref.id)),read(db.collection('processingJobs')),read(ref.collection('warmupChallenges'))]);
  const games=[];
  for(const match of matches.docs)for(const game of (await read(match.ref.collection('games'))).docs){
    const source=game.data().activeReplayStatisticsId?(await read(game.ref.collection('replaySources').doc(game.data().activeReplayStatisticsId))).data():null;
    games.push({matchId:match.id,...game.data(),activeSourceState:source?.state??null});
  }
  const blockers=eventFinalisationBlockers(event,matches.docs.map((m:any)=>({matchId:m.id,...m.data()})),games,jobs.docs.map((j:any)=>j.data()),challenges.docs.map((c:any)=>c.data()),Date.now());
  return {canFinalise:!blockers.length,blockers,notices:matches.docs.filter((m:any)=>m.data().scoringState==='PLACEMENTS_PENDING').map((m:any)=>({matchId:m.id,message:'FFA placement evidence is pending. Closure awards no unverified placement points; later qualified evidence can still reconcile them.'})),finalisedAt:event.finalisedAt?.toDate().toISOString()??null,revision:event.finalisationRevision??0};
}
