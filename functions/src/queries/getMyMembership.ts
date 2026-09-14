import {HttpsError,onCall} from 'firebase-functions/v2/https';
import {requireAuth} from '../auth/authorization.js';
import {db} from '../config/firebase.js';
import {callableOptions} from '../config/runtime.js';
import {collections} from '../domain/collections.js';
import type {Player} from '../domain/types.js';
import {publicPlayer} from './querySupport.js';

/** Resolve only the authenticated account; pending members cannot read the league. */
export const getMyMembership=onCall(callableOptions,async request=>{
  const uid=requireAuth(request);
  const link=await db.collection(collections.authLinks).doc(uid).get();
  if(!link.exists)return {status:'UNLINKED',player:null};
  const playerId=link.data()!.playerId as string;
  const document=await db.collection(collections.players).doc(playerId).get();
  if(!document.exists)throw new HttpsError('failed-precondition','Your league identity needs administrator attention.');
  const player=document.data() as Player;
  return {status:player.membershipStatus,player:publicPlayer(playerId,player)};
});
