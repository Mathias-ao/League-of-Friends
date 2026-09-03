import type { CanonicalGameResult, MatchParticipant } from "../domain/types.js";

export interface RewardEngineMatch {
  participants: MatchParticipant[];
  canonicalResult: CanonicalGameResult;
  context?: {
    affectsLeaguePoints?: boolean;
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

  const leagueCompletion = match.context?.affectsLeaguePoints
    ? finiteNumber(rules.matchCompletionPoints, "scoringSnapshot.rules.matchCompletionPoints")
    : 0;
  const leagueWin = match.context?.affectsLeaguePoints
    ? finiteNumber(rules.matchWinPoints, "scoringSnapshot.rules.matchWinPoints")
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
        matchWin: isWinner ? leagueWin : 0,
      },
      gold: {
        matchCompletion: goldCompletion,
        matchWin: isWinner ? goldWin : 0,
      },
    };
  });
}
