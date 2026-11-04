import type {PersonalityProfile,SourceSnapshot} from '../../domain/socialV1.js';
import {validateSharedRecord} from '../../domain/socialV1Validation.js';
import {bindingDigest} from '../nativeRecordingIntegration.js';

/**
 * Owner's three-GAME Personality *visibility* milestone. This is not the
 * independent-Battle sample rule, calibrated score policy, or a public award.
 *
 * Call only with the complete, authenticated, current READY-source collection
 * from collectMyCurrentBattleHistory. That collector validates native original,
 * current GUID claim/roster/mapping, access and revalidates the full read.
 */
export const PERSONALITY_GAME_UNLOCK_VERSION='AOF_PERSONALITY_THREE_GAME_UNLOCK_V1' as const;
export const PERSONALITY_GAME_UNLOCK_REQUIRED_GAMES=3 as const;
const HASH=/^[a-f0-9]{64}$/;

export type PersonalityGameUnlock={
  version:typeof PERSONALITY_GAME_UNLOCK_VERSION;
  requiredGames:typeof PERSONALITY_GAME_UNLOCK_REQUIRED_GAMES;
  eligibleGames:number;
  status:'LOCKED'|'UNLOCKED';
  reason:'THREE_SOURCE_QUALIFIED_GAMES_REQUIRED'|null;
};

export function qualifyPersonalityGameUnlock(ownerPlayerId:string,
  currentSources:ReadonlyArray<SourceSnapshot>):PersonalityGameUnlock {
  if(!ownerPlayerId)throw Error('PERSONALITY_UNLOCK_OWNER_REQUIRED');
  const hashes=new Set<string>(),guids=new Set<string>(),gameKeys=new Set<string>();
  let eligibleGames=0;
  for(const source of currentSources){
    // Never let a stale, unknown, unbound or invented source count toward an
    // authenticated milestone, even if a caller supplies it to this pure seam.
    const roster=source.roster??[];
    const ownerBindings=roster.filter(p=>p.playerId===ownerPlayerId);
    const valid=source.contract==='AOF_SOCIAL_V1_SHARED_1' &&
      HASH.test(source.sourceHash) && HASH.test(source.authorityRevision) &&
      HASH.test(source.mappingDigest) &&
      source.battleId===source.matchId && !!source.battleId && !!source.gameId &&
      typeof source.gameGuid==='string' && source.gameGuid.length>0 &&
      Number.isSafeInteger(source.statisticsRevision) && source.statisticsRevision>0 &&
      ownerBindings.length===1 &&
      Number.isSafeInteger(ownerBindings[0].replaySlot) &&
      ownerBindings[0].replaySlot>=1 && ownerBindings[0].replaySlot<=8 &&
      roster.length>=2 && roster.length<=8 &&
      new Set(roster.map(p=>p.replaySlot)).size===roster.length &&
      new Set(roster.map(p=>p.playerId)).size===roster.length &&
      (source.outcome?.qualification==='OFFICIAL' ||
        (source.outcome?.qualification==='UNRESOLVED'&&
         source.outcome.resultRevision===null&&
         source.outcome.winningPlayerIds===null));
    if(!valid)throw Error('PERSONALITY_UNLOCK_UNTRUSTED_CURRENT_SOURCE');
    const key=JSON.stringify([source.battleId,source.gameId]);
    if(hashes.has(source.sourceHash)||guids.has(source.gameGuid!)||gameKeys.has(key))
      throw Error('PERSONALITY_UNLOCK_DUPLICATE_GUID_SOURCE_OR_GAME');
    hashes.add(source.sourceHash);
    guids.add(source.gameGuid!);
    gameKeys.add(key);
    eligibleGames++;
  }
  const unlocked=eligibleGames>=PERSONALITY_GAME_UNLOCK_REQUIRED_GAMES;
  return {version:PERSONALITY_GAME_UNLOCK_VERSION,
    requiredGames:PERSONALITY_GAME_UNLOCK_REQUIRED_GAMES,
    eligibleGames,status:unlocked?'UNLOCKED':'LOCKED',
    reason:unlocked?null:'THREE_SOURCE_QUALIFIED_GAMES_REQUIRED'};
}

/** Enforce the milestone on the *server-returned profile*, not just web copy.
 * Raw private Battle feature evidence remains available to the debug/coverage
 * contract; it is NOT a longitudinal Personality slider or a public score.
 */
export function gatePersonalityProfileByGames(
  profile:PersonalityProfile,unlock:PersonalityGameUnlock):PersonalityProfile {
  if(unlock.version!==PERSONALITY_GAME_UNLOCK_VERSION ||
    unlock.requiredGames!==PERSONALITY_GAME_UNLOCK_REQUIRED_GAMES ||
    unlock.eligibleGames<0 ||
    unlock.status!==(unlock.eligibleGames>=PERSONALITY_GAME_UNLOCK_REQUIRED_GAMES?'UNLOCKED':'LOCKED'))
    throw Error('PERSONALITY_UNLOCK_STATE_INVALID');
  if(unlock.status==='UNLOCKED')return profile;
  const sliders=profile.sliders.map(axis=>({
    ...axis,status:'DEVELOPING' as const,value:null,
    coverage:{...axis.coverage,tier:'INSUFFICIENT' as const,
      missing:[...new Set([...axis.coverage.missing,
        'THREE_SOURCE_QUALIFIED_GAMES_REQUIRED'])].sort()},
    featureRefs:[],
  }));
  const result:PersonalityProfile={...profile,sliders,
    projectionRevision:bindingDigest([profile.projectionRevision,unlock])};
  return validateSharedRecord('PersonalityProfile',result);
}
