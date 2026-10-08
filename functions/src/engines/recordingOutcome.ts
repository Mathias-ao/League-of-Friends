import {createHash} from 'node:crypto';
import type {GameOutcome} from '../domain/types.js';

export const RECORDING_OUTCOME_VERSION='AOF_RECORDING_OUTCOME_V1';
/** Qualified only for the DE wire formats exercised by our known-result corpus.
 * Resignations are terminal only when every opposing starter resigned normally,
 * a terminal postgame agrees with the stream clock, and locked teams match the
 * approved Battle. Disconnects, restores, diplomacy and incomplete outcomes go
 * to the Emperor; leaderboard rank is never interpreted as finishing order.
 */
export function deriveRecordingOutcome(match:any,game:any,source:any) {
  const facts=source?.matchFacts,hash=source?.sourceHash;
  const base={modelVersion:RECORDING_OUTCOME_VERSION,sourceHash:hash??null};
  const pending=(reason:string)=>({...base,state:'PENDING_ADMIN_REVIEW' as const,reason,outcome:null as GameOutcome|null,evidenceToken:null as string|null});
  if(source?.state!=='READY'||facts?.source?.replaySha256!==hash)return pending('Recording provenance is incomplete.');
  const players=game?.players??[],mapping=source.playerMapping??[],roster=facts.players??[];
  if(players.length<2||mapping.length!==players.length||roster.length!==players.length||
    new Set(mapping.map((p:any)=>p.playerId)).size!==players.length||new Set(mapping.map((p:any)=>p.replaySlot)).size!==players.length||
    mapping.some((p:any)=>!players.some((q:any)=>q.playerId===p.playerId)||!roster.some((q:any)=>q.playerId===p.replaySlot)))return pending('Every approved starter must map uniquely to the recording.');
  if(match.format==='FFA')return pending('Fixed FFA winner and elimination order await a known-result recording test.');
  const h=facts.headerFieldCandidates??{},save=facts.game?.recordingVersion?.save_version;
  if(!((save===68&&h['de.build']===180059)||(save===68.9&&h['de.build']===185872)))return pending('This recording version needs outcome validation.');
  if(h['map.restore_time']!==0||facts.rules?.lockTeams?.value!==true||match.gameConfigSnapshot?.diplomacyEnabled===true)return pending('Restored or diplomatic Games require outcome review.');
  const config=game.gameConfigSnapshot??match.gameConfigSnapshot;
  if(!config?.victory||config.victory.customRuleCode||config.victory.conquest!==true||
    facts.rules?.victoryTypeId?.value!==(config.victory.wonder||config.victory.relic?0:1)||h['de.cheats']!==false)return pending('Victory rules or cheat settings need recording review.');
  // Numeric Arabia identity is exercised by the known-result fixtures. Other
  // maps can be announced with a server-owned recordingMapIds binding; names
  // alone are insufficient for custom/modded RMS identity.
  const mapIds=config.maps?.recordingMapIds??{Arabia:9,'African Clearing':149,'Gold Rush':17};
  if(!config.maps?.pool?.length||!config.maps.pool.some((name:string)=>mapIds[name]===facts.rules?.mapId?.value)||h['de.rms_mod_id']!=null&&h['de.rms_mod_id']!==0)return pending('The played map is not qualified against the announced pool.');
  if(config.civilizations?.mode!=='UNRESTRICTED'||Object.keys(config.additionalSettings??{}).length)return pending('Drafted civilizations or additional settings require recording review.');
  const teams=[...new Set(players.map((p:any)=>p.team))];
  if(teams.length!==2||teams.some(team=>team!==1&&team!==2))return pending('The approved sides are incomplete.');
  const replayTeam=(p:any)=>roster.find((r:any)=>r.playerId===mapping.find((m:any)=>m.playerId===p.playerId)?.replaySlot)?.lobbyTeamIdRaw;
  const teamGroups=teams.map(team=>new Set(players.filter((p:any)=>p.team===team).map(replayTeam)));
  if(teamGroups.some(s=>s.size!==1||![...s].every(t=>Number.isInteger(t)&&Number(t)>1))||[...teamGroups[0]][0]===[...teamGroups[1]][0])return pending('Recording teams do not match the approved sides.');
  if(Object.values(facts.diplomacy?.commandTimelines??{}).some((v:any)=>Array.isArray(v)?v.length>0:Object.keys(v??{}).length>0))return pending('Diplomacy changes require review.');
  const duration=facts.game?.observedDurationMs,resigns=facts.result?.resignationEvidence??[],postgame=facts.result?.postgameEvidence??[];
  if(facts.game?.bodyParseComplete!==true||facts.game?.resignationCommandCount!==resigns.length||typeof facts.game?.guid!=='string'||!facts.game.guid)return pending('The recording has incomplete framing, identity or resignation coverage.');
  if(!Number.isFinite(duration)||duration<=0||!postgame.some((e:any)=>e.decoded?.world_time===duration&&e.timestampMs===duration&&Number.isInteger(e.operationOrdinal)))return pending('The recording does not establish a complete terminal postgame.');
  if(!resigns.length||resigns.some((e:any)=>e.commandLayout!=='de_legacy_resign_v1'||e.disconnected!==false||!Number.isInteger(e.operationOrdinal)||!Number.isFinite(e.atMs)||e.atMs<0||e.atMs>duration||!e.sourceEventId||!roster.some((r:any)=>r.playerId===e.replaySlot)))return pending('Resignation evidence is incomplete, disconnected or unsupported.');
  if(!postgame.some((e:any)=>e.decoded?.world_time===duration&&e.operationOrdinal>Math.max(...resigns.map((r:any)=>r.operationOrdinal))))return pending('Terminal evidence precedes the outcome commands.');
  const resigned=new Set(resigns.map((e:any)=>mapping.find((m:any)=>m.replaySlot===e.replaySlot)?.playerId));
  const candidates=teams.filter(team=>players.filter((p:any)=>p.team===team).every((p:any)=>!resigned.has(p.playerId))&&players.filter((p:any)=>p.team!==team).every((p:any)=>resigned.has(p.playerId)));
  if(candidates.length!==1)return pending('The stream does not establish exactly one winning side.');
  const outcome:GameOutcome={type:'TEAM_WIN',winnerTeam:candidates[0] as number,winnerPlayerId:null};
  return {...base,state:'VERIFIED' as const,reason:null,outcome,evidenceToken:createHash('sha256').update(JSON.stringify([RECORDING_OUTCOME_VERSION,hash,mapping,outcome,resigns,postgame.map((e:any)=>e.sourceEventId)])).digest('hex')};
}
