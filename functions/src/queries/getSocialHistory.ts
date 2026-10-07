import {onCall} from 'firebase-functions/v2/https';
import {requireLeaguePlayer} from '../auth/authorization.js';
import {callableOptions} from '../config/runtime.js';
import {readSocialHistory} from './socialHistoryRead.js';

/** Read-only review surface. Returns the full shadow ledger for authenticated inspection. */
export const getSocialHistory=onCall({...callableOptions,timeoutSeconds:120},async request=>{
  const actor=await requireLeaguePlayer(request);
  return readSocialHistory(actor.playerId);
});
