import {verifiedFFAPlacements,type PlacementSourceBinding} from './ffaPlacements.js';
/** Only independently footage-qualified adapters belong here. No current adapter qualifies elimination outcomes. */
export const QUALIFIED_FFA_ELIMINATION_ADAPTERS:readonly string[]=Object.freeze([]);
export function produceFFAPlacements(facts:any,binding:PlacementSourceBinding,qualifiedAdapters:readonly string[]=QUALIFIED_FFA_ELIMINATION_ADAPTERS) {
  const pending=(reason:string)=>({state:'PENDING' as const,reason,qualifiedFFAPlacements:null});
  if(binding.policy!=='ELIMINATION_ORDER')return pending('This objective ranking policy requires separate qualification.');
  const witness=facts?.result?.eliminationOutcomeEvidence;
  if(!witness||!qualifiedAdapters.includes(witness.adapterVersion))return pending('No qualified elimination-outcome adapter is available for this recording. Resignation commands do not prove finishing order.');
  if(facts.source?.replaySha256!==binding.replaySha256||witness.sourceHash!==binding.replaySha256||witness.coverage!=='COMPLETE'||witness.diplomacyEnabled!==false||witness.restoredGame!==false||!Number.isFinite(facts.game?.observedDurationMs)||!Array.isArray(witness.eliminations)||binding.winnerIds.length!==1)return pending('Elimination evidence has incomplete or incompatible coverage.');
  const roster=facts.players?.map((p:any)=>p.playerId)??[],mapping=binding.replayPlayerMapping;
  if(!Array.isArray(mapping)||mapping.length!==binding.rosterIds.length||new Set(mapping.map((p:any)=>p.replayPlayerId)).size!==mapping.length||new Set(mapping.map((p:any)=>p.playerId)).size!==mapping.length||mapping.some((p:any)=>!roster.includes(p.replayPlayerId)||!binding.rosterIds.includes(p.playerId)))return pending('Elimination evidence does not bind every approved player uniquely.');
  const events=witness.eliminations;
  if(events.length!==binding.rosterIds.length-1||new Set(events.map((e:any)=>e.replayPlayerId)).size!==events.length||new Set(events.map((e:any)=>e.sourceEventId)).size!==events.length||events.some((e:any)=>!roster.includes(e.replayPlayerId)||typeof e.sourceEventId!=='string'||!e.sourceEventId||!Number.isInteger(e.operationOrdinal)||!Number.isFinite(e.atMs)||e.atMs<0||e.atMs>facts.game?.observedDurationMs||e.outcome!=='ELIMINATED'))return pending('Elimination outcomes are missing, duplicated or outside the observed Game.');
  const winner=binding.winnerIds[0];
  if(events.some((e:any)=>mapping.find((p:any)=>p.replayPlayerId===e.replayPlayerId)?.playerId===winner))return pending('Elimination evidence conflicts with the official winner.');
  const ordered=[...events].sort((a,b)=>b.atMs-a.atMs||b.operationOrdinal-a.operationOrdinal);
  const ranks=[{playerId:winner,rank:1}];
  for(let i=0;i<ordered.length;i++) {
    // Equal qualified outcome times share the occupied places; command order does not break the tie.
    const first=ordered.findIndex(e=>e.atMs===ordered[i].atMs);
    ranks.push({playerId:mapping.find((p:any)=>p.replayPlayerId===ordered[i].replayPlayerId)!.playerId,rank:first+2});
  }
  const qualifiedFFAPlacements={modelVersion:'AOF_FFA_PLACEMENTS_V1' as const,qualification:'VERIFIED' as const,policy:'ELIMINATION_ORDER' as const,sourceStatisticsId:binding.sourceStatisticsId,replaySha256:binding.replaySha256,resultRevision:binding.resultRevision,ranks};
  if(!verifiedFFAPlacements(qualifiedFFAPlacements,binding))return pending('Finishing-order validation failed.');
  return {state:'VERIFIED' as const,reason:null,qualifiedFFAPlacements};
}
