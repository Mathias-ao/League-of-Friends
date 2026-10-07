import {onCall} from 'firebase-functions/v2/https';
import {requireLeaguePlayer} from '../auth/authorization.js';
import {callableOptions} from '../config/runtime.js';
import {readSocialHistory} from './socialHistoryRead.js';

/** Player-facing Chronicle read. Deliberately omits the full shadow ledger. */
export const getPlayerChronicle=onCall({...callableOptions,timeoutSeconds:120},async request=>{
  const actor=await requireLeaguePlayer(request);
  const result=await readSocialHistory(actor.playerId);
  return {
    success:result.success,
    status:result.status,
    chronicle:result.chronicle,
    names:result.names,
    excluded:result.excluded,
    coverage:result.coverage,
  };
});
