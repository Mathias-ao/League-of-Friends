import type { CanonicalGameResult, MatchParticipant, MatchFormat } from "../domain/types.js";

import {assertScoringRoster,assertSeasonMatchRules,validateSeasonScoringRules} from "./seasonPoints.js";
import {placementBonus,verifiedFFAPlacements,type PlacementSourceBinding,type VerifiedFFAPlacements} from "./ffaPlacements.js";

export interface RewardEngineMatch {
  participants: MatchParticipant[];
  format?:MatchFormat;
  placementEvidence?:VerifiedFFAPlacements|null;
  placementSourceBinding?:PlacementSourceBinding;
  canonicalResult: CanonicalGameResult;
  context?: {
    affectsLeaguePoints?: boolean;
    affectsWarRoomPoints?: boolean;
    affectsGold?: boolean;
  } | null;
  scoringSnapshot?: {
    rules?: Record<string, unknown>;
  } | null;
  goldRewardSnapshot?: {
    matchCompletion?: number;
    matchWin?: number;
  } | null;
}

export interface PlayerMatchReward {
  playerId: string;
  leaguePoints: {
    matchCompletion: number;
    matchWin: number;
    placement:number;
    emperor:number;
  };
  placementState:"NOT_APPLICABLE"|"PENDING"|"VERIFIED";
  warRoomPoints: {
    matchCompletion: number;
    matchWin: number;
  };
  gold: {
    matchCompletion: number;
    matchWin: number;
  };
}

export class RewardConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RewardConfigurationError";
  }
}

function finiteNumber(value: unknown, field: string, fallback = 0): number {
  if (value == null) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RewardConfigurationError(`${field} must be a finite number.`);
  }
  return value;
}

function nonNegativeNumber(value: unknown, field: string, fallback = 0): number {
  const parsed = finiteNumber(value, field, fallback);
  if (parsed < 0) {
    throw new RewardConfigurationError(`${field} cannot be negative.`);
  }
  return parsed;
}

export function computeMatchRewards(match: RewardEngineMatch): PlayerMatchReward[] {
  const winners = new Set(match.canonicalResult.winningPlayerIds);
  const rules = match.scoringSnapshot?.rules ?? {};

  let seasonRules;
  try {seasonRules=validateSeasonScoringRules(rules);}
  catch(error){throw new RewardConfigurationError((error as Error).message);}
  if(seasonRules && match.context?.affectsLeaguePoints) {
    try {
      assertScoringRoster(match.participants);
      if(!match.format)throw new Error("Season rewards require the Match format.");
      assertSeasonMatchRules(seasonRules,match.format);
    }catch(error){throw new RewardConfigurationError((error as Error).message);}
    if(!winners.size||winners.size>=match.participants.length||
       winners.size!==match.canonicalResult.winningPlayerIds.length||
       [...winners].some(id=>!match.participants.some(p=>p.playerId===id))) {
      throw new RewardConfigurationError("Official winners do not match the scoring roster.");
    }
    if(match.format==="FFA"&&winners.size>1&&seasonRules.diplomacyEnabled!==true) {
      throw new RewardConfigurationError("Nondiplomatic FFA must have one winner.");
    }
  }
  const active=seasonRules&&match.context?.affectsLeaguePoints ? seasonRules:null;
  const needsPlacements=!!active&&match.format==="FFA"&&active.diplomacyEnabled===false;
  const placements=needsPlacements&&match.placementSourceBinding
    ? verifiedFFAPlacements(match.placementEvidence,{
        ...match.placementSourceBinding,policy:active!.placementPolicy,
        rosterIds:match.participants.map(p=>p.playerId),winnerIds:[...winners],
        resultRevision:match.canonicalResult.revision,
      }):null;
  const emperorLost=!!active?.emperorPlayerId&&!winners.has(active.emperorPlayerId)&&
    match.participants.some(p=>p.playerId===active.emperorPlayerId);

  const leagueCompletion = match.context?.affectsLeaguePoints
    ? active ? active.act==="MAIN" ? 4:1 : finiteNumber(rules.matchCompletionPoints, "scoringSnapshot.rules.matchCompletionPoints")
    : 0;
  const leagueWin = match.context?.affectsLeaguePoints
    ? active ? active.act==="MAIN" ? 6:2 : finiteNumber(rules.matchWinPoints, "scoringSnapshot.rules.matchWinPoints")
    : 0;

  const warRoomCompletion = match.context?.affectsWarRoomPoints
    ? finiteNumber(rules.warRoomMatchCompletionPoints, "scoringSnapshot.rules.warRoomMatchCompletionPoints")
    : 0;
  const warRoomWin = match.context?.affectsWarRoomPoints
    ? finiteNumber(rules.warRoomMatchWinPoints, "scoringSnapshot.rules.warRoomMatchWinPoints")
    : 0;

  const goldCompletion = match.context?.affectsGold
    ? nonNegativeNumber(match.goldRewardSnapshot?.matchCompletion, "goldRewardSnapshot.matchCompletion")
    : 0;
  const goldWin = match.context?.affectsGold
    ? nonNegativeNumber(match.goldRewardSnapshot?.matchWin, "goldRewardSnapshot.matchWin")
    : 0;

  return match.participants.map((participant) => {
    const isWinner = winners.has(participant.playerId);
    return {
      playerId: participant.playerId,
      leaguePoints: {
        matchCompletion: leagueCompletion,
        matchWin:isWinner ? leagueWin/(active&&match.format==="FFA"&&active.diplomacyEnabled ? winners.size:1):0,
        placement:placements ? placementBonus(placements,participant.playerId):0,
        emperor:active?.act==="MAIN"&&emperorLost&&isWinner ? 2:0,
      },
      placementState:needsPlacements ? placements ? "VERIFIED":"PENDING":"NOT_APPLICABLE",
      warRoomPoints: {
        matchCompletion: warRoomCompletion,
        matchWin: isWinner ? warRoomWin : 0,
      },
      gold: {
        matchCompletion: goldCompletion,
        matchWin: isWinner ? goldWin : 0,
      },
    };
  });
}
