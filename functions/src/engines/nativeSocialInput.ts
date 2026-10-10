/** Neutral social inputs are common to canonical and direct-shared statistics.
 * Do not rebuild per-player engagement arrays or synthesize missing incidents.
 * All inputs come from a separately SHA-verified immutable native artifact.
 */
export function nativeSocialInput(raw:unknown,mapping:unknown):Record<string,any> {
  const rec=(v:unknown):Record<string,any>|null=>
    v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,any>:null;
  const data=rec(raw),ledger=rec(data?.pairSocialEvidence),facts=rec(data?.matchFacts);
  const participants=Array.isArray(data?.participants)?data.participants:null;
  const playerMapping=Array.isArray(mapping)?mapping:null;
  if(!data||!ledger||!facts||!participants||!playerMapping||
     ledger.modelVersion!=='AOF_PAIR_SOCIAL_EVIDENCE_V1'||
     ledger.identityNamespace!=='CANONICAL_REPLAY_PLAYER_ID'||
     facts.modelVersion!=='AOF_RECORDING_MATCH_FACTS_V1'||
     facts.identityNamespace!=='CANONICAL_REPLAY_PLAYER_ID'||
     !Array.isArray(ledger.observations)||!Array.isArray(ledger.incidents)||
     !Array.isArray(ledger.playerIds)||!Array.isArray(facts.players)||
     participants.length<2||participants.length>8||
     participants.length!==playerMapping.length||
     ledger.playerIds.length!==participants.length||facts.players.length!==participants.length)
    throw new Error('native_social_input_contract_unavailable');
  const slots=participants.map(p=>rec(p)?.replaySlot);
  if(slots.some((slot,i)=>!Number.isSafeInteger(slot)||slot<1||slot>8||
       rec(participants[i])?.playerId!==slot||ledger.playerIds[i]!==slot)||
     new Set(slots).size!==slots.length||
     facts.players.some(p=>!slots.includes(rec(p)?.playerId))||
     new Set(facts.players.map(p=>rec(p)?.playerId)).size!==slots.length||
     playerMapping.some(p=>!rec(p)||!slots.includes(p.replaySlot)||
       typeof p.playerId!=='string'||!p.playerId)||
     new Set(playerMapping.map(p=>p.replaySlot)).size!==slots.length||
     new Set(playerMapping.map(p=>p.playerId)).size!==slots.length)
    throw new Error('native_social_player_binding_invalid');
  return {source:data.source,matchFacts:facts,pairSocialEvidence:ledger,
    participants:participants.map(p=>({playerId:p.playerId,replaySlot:p.replaySlot,displayName:p.displayName}))};
}
