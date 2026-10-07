import {onCall} from 'firebase-functions/v2/https';
import {requireLeaguePlayer} from '../auth/authorization.js';
import {callableOptions} from '../config/runtime.js';
import {readSocialHistory} from './socialHistoryRead.js';

function publicChronicleProjection(chronicle:any){
  return {
    modelVersion:chronicle.modelVersion,
    ownerPlayerId:chronicle.ownerPlayerId,
    status:chronicle.status,
    reason:chronicle.reason,
    pages:(chronicle.pages??[]).map((page:any)=>({
      pairId:page.pairId,
      counterpartPlayerId:page.counterpartPlayerId,
      entries:(page.entries??[]).map((entry:any)=>({
        entryId:entry.entryId,
        battleId:entry.battleId,
        eventId:entry.eventId,
        seasonId:entry.seasonId,
        playedAtMs:entry.playedAtMs,
        rubric:entry.rubric,
        title:entry.title,
        paragraphs:entry.paragraphs,
      })),
    })),
    policy:{
      proseUsesQualifiedSocialEvidence:chronicle.policy?.proseUsesQualifiedSocialEvidence===true,
      coPresenceCreatesOnlyFirstRecord:chronicle.policy?.coPresenceCreatesOnlyFirstRecord===true,
    },
  };
}

/** Player-facing Chronicle read. Deliberately omits shadow scoring and source internals. */
export const getPlayerChronicle=onCall({...callableOptions,timeoutSeconds:120},async request=>{
  const actor=await requireLeaguePlayer(request);
  const result=await readSocialHistory(actor.playerId);
  const chronicle=publicChronicleProjection(result.chronicle);
  const visibleIds=new Set<string>([actor.playerId,...chronicle.pages.map((page:any)=>page.counterpartPlayerId)]);
  const names=Object.fromEntries(Object.entries(result.names).filter(([playerId])=>visibleIds.has(playerId)));
  return {
    success:result.success,
    status:result.status,
    chronicle,
    names,
    coverage:{
      completedBattles:result.coverage.completedBattles,
      readableAcceptedGames:result.coverage.readableAcceptedGames,
      excludedGames:result.coverage.excludedGames,
      opportunityCompleteness:result.coverage.opportunityCompleteness,
    },
  };
});
