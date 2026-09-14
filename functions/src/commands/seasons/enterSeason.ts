import {Timestamp} from 'firebase-admin/firestore';
import {HttpsError,onCall} from 'firebase-functions/v2/https';
import {requireLeaguePlayer} from '../../auth/authorization.js';
import {db} from '../../config/firebase.js';
import {callableOptions} from '../../config/runtime.js';
import {collections} from '../../domain/collections.js';

export const enterSeason=onCall<{seasonId:string}>(callableOptions,async request=>{
  const actor=await requireLeaguePlayer(request);
  const seasonId=request.data.seasonId;
  if(typeof seasonId!=='string'||!seasonId.trim()||seasonId.includes('/'))throw new HttpsError('invalid-argument','A valid season is required.');
  const seasonRef=db.collection(collections.seasons).doc(seasonId);
  const participantRef=seasonRef.collection('participants').doc(actor.playerId);
  await db.runTransaction(async transaction=>{
    const [seasonDoc,participantDoc]=await Promise.all([transaction.get(seasonRef),transaction.get(participantRef)]);
    if(!seasonDoc.exists)throw new HttpsError('not-found','Season not found.');
    const season=seasonDoc.data()!;
    if(!['UPCOMING','ACTIVE'].includes(season.status))throw new HttpsError('failed-precondition','Season entry is not open.');
    if(season.endsAt instanceof Timestamp&&season.endsAt.toMillis()<Date.now())throw new HttpsError('failed-precondition','This season has ended.');
    if(participantDoc.data()?.status==='ENTERED')return;
    const now=Timestamp.now();
    transaction.set(participantRef,{playerId:actor.playerId,seasonId,status:'ENTERED',enteredAt:now,updatedAt:now});
  });
  return {success:true,seasonId,playerId:actor.playerId,status:'ENTERED'};
});
