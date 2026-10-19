import {HttpsError,onCall} from 'firebase-functions/v2/https';
import {requireLeaguePlayer} from '../auth/authorization.js';
import {db} from '../config/firebase.js';
import {callableOptions} from '../config/runtime.js';
import {bindingDigest} from '../engines/nativeRecordingIntegration.js';
import {readSocialHistory} from './socialHistoryRead.js';
import {playerChronicleResponse} from './getPlayerChronicle.js';
import {assertIntBEnabled} from './getMyPersonalityHistory.js';

export async function readMyPrivateChronicle(input:{db:any;actor:{playerId:string;authUid:string};
  request:Record<string,never>;env:NodeJS.ProcessEnv;readFactual?:typeof readSocialHistory}){
  assertIntBEnabled(input.env);
  if(!input.request||typeof input.request!=='object'||Array.isArray(input.request)||Object.keys(input.request).length)
    throw new HttpsError('invalid-argument','Private Chronicle accepts no target player or source.');
  const access=async(tx:any)=>{
    const [p,l]=await Promise.all([tx.get(input.db.doc('players/'+input.actor.playerId)),tx.get(input.db.doc('authLinks/'+input.actor.authUid))]);
    if(p.data()?.membershipStatus!=='ACTIVE'||l.data()?.playerId!==input.actor.playerId)
      throw new HttpsError('permission-denied','Active linked membership is required.');
    return bindingDigest([p.data(),l.data()]);
  };
  const before=await input.db.runTransaction(access);
  const result=await (input.readFactual??readSocialHistory)(input.actor.playerId);
  if(result.chronicle.ownerPlayerId!==input.actor.playerId)throw new HttpsError('data-loss','Chronicle owner mismatch.');
  const response=playerChronicleResponse(result,input.actor.playerId);
  await input.db.runTransaction(async(tx:any)=>{
    if(await access(tx)!==before)throw new HttpsError('aborted','Chronicle access changed during the read.');
  });
  return response;
}
export const getMyPrivateChronicle=onCall({...callableOptions,timeoutSeconds:120,memory:'1GiB'},async request=>{
  const actor=await requireLeaguePlayer(request);
  return readMyPrivateChronicle({db,actor,request:request.data,env:process.env});
});
