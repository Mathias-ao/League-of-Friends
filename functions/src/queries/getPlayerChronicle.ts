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
        sceneId:entry.sceneId,
        sceneRevision:entry.sceneRevision,
        // Aggregate authoritative Match result, not a single Game's winner.
        result:entry.result??{qualification:'UNRESOLVED',resultRevision:null,winningPlayerIds:null},
        resultStatus:entry.resultStatus??'UNRESOLVED',
        chronologyStatus:entry.chronologyStatus??'UNRESOLVED',
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

/** Shared allowlist seam for the existing and INT-B owner-bound surfaces. */
export function playerChronicleResponse(result:any,ownerPlayerId:string){
  const chronicle=publicChronicleProjection(result.chronicle);
  const visibleIds=new Set<string>([ownerPlayerId,...chronicle.pages.map((page:any)=>page.counterpartPlayerId)]);
  const names=Object.fromEntries(Object.entries(result.names).filter(([playerId])=>visibleIds.has(playerId)));
  return {
    success:result.success,
    status:result.status,
    chronicle,
    names,
    coverage:{
      completedBattles:result.coverage.completedBattles,
      scannedBattles:result.coverage.scannedBattles,
      scannedGames:result.coverage.scannedGames,
      unresolvedOutcomeGames:result.coverage.unresolvedOutcomeGames,
      chronologyPendingBattles:result.coverage.chronologyPendingBattles,
      readableAcceptedGames:result.coverage.readableAcceptedGames,
      excludedGames:result.coverage.excludedGames,
      opportunityCompleteness:result.coverage.opportunityCompleteness,
    },
  };
}

/** Player-facing Chronicle read; wire behavior remains unchanged. */
export const getPlayerChronicle=onCall({...callableOptions,timeoutSeconds:120},async request=>{
  const actor=await requireLeaguePlayer(request);
  return playerChronicleResponse(await readSocialHistory(actor.playerId),actor.playerId);
});
