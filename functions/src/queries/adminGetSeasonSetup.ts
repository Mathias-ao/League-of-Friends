import {HttpsError,onCall} from 'firebase-functions/v2/https';
import {requireAdmin} from '../auth/authorization.js';
import {db} from '../config/firebase.js';
import {callableOptions} from '../config/runtime.js';
import {collections,leagueStateDocumentId} from '../domain/collections.js';
import {iso} from './querySupport.js';

/** Read-only administration, independent of Season enrollment or activation.
 * No private player/source data, lifecycle mutation or client Firestore access. */
export const adminGetSeasonSetup=onCall(callableOptions,async request=>{
  const actor=await requireAdmin(request);
  const data=request.data;
  if(data!=null&&(typeof data!=='object'||Array.isArray(data)||Object.keys(data).length))
    throw new HttpsError('invalid-argument','Season setup accepts no owner, role or Season override.');
  return db.runTransaction(async tx=>{
    const [state,seasons,player,link]=await Promise.all([
      tx.get(db.collection(collections.leagueState).doc(leagueStateDocumentId)),
      tx.get(db.collection(collections.seasons).limit(101)),
      tx.get(db.collection(collections.players).doc(actor.playerId)),
      tx.get(db.collection(collections.authLinks).doc(actor.authUid)),
    ]);
    if(player.data()?.membershipStatus!=='ACTIVE'||player.data()?.role!=='ADMIN'||link.data()?.playerId!==actor.playerId)
      throw new HttpsError('permission-denied','Administrator authority changed. Sign in again.');
    if(seasons.size>100)throw new HttpsError('resource-exhausted','Season setup exceeds its complete-read limit. Contact the administrator.');
    const active=state.data()?.activeSeasonId;
    return {schemaVersion:'AOF_SEASON_ADMINISTRATION_1' as const,
      activeSeasonId:typeof active==='string'?active:null,
      seasons:seasons.docs.map(document=>{
        const season=document.data();
        return {seasonId:document.id,name:String(season.name??document.id),status:String(season.status??'UNKNOWN'),
          startsAt:iso(season.startsAt),endsAt:iso(season.endsAt)};
      }).sort((a,b)=>(a.startsAt??'').localeCompare(b.startsAt??'')||a.seasonId.localeCompare(b.seasonId))};
  });
});
