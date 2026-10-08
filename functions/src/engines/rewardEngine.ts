import type { CanonicalGameResult, MatchParticipant, MatchFormat, SeasonScoringLock } from "../domain/types.js";

import {normalizeOutcome, winningPlayerIds} from "./resultEngine.js";
import { SEASON_SCORING_VERSION, validateFfaPlacements } from "./seasonScoring.js";

export interface RewardEngineMatch {
  participants: MatchParticipant[];
  format?: MatchFormat;
  seasonScoring?: SeasonScoringLock;
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
    ffaPlacement?: number;
    emperorBounty?: number;
  };
  seasonCounters?: {mainEventWins: number; warmupWins: number; mainEventsPlayed: number; warmupsPlayed: number};
  placementStatus?: "PENDING" | "VERIFIED" | "NOT_APPLICABLE";
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
  const version = rules.seasonScoringVersion;
  if (version != null && version !== SEASON_SCORING_VERSION) throw new RewardConfigurationError('Unsupported season scoring version.');
  const v1 = version === SEASON_SCORING_VERSION && match.context?.affectsLeaguePoints === true;
  const lock = match.seasonScoring;
  if (v1 && (!lock || lock.version !== version || !['MAIN_EVENT', 'WARMUP'].includes(lock.act) || !match.format)) {
    throw new RewardConfigurationError('Season scoring requires locked act, format and rules.');
  }
  if (new Set(match.participants.map(p => p.playerId)).size !== match.participants.length ||
    winners.size === 0 || winners.size !== match.canonicalResult.winningPlayerIds.length ||
    [...winners].some(id => !match.participants.some(p => p.playerId === id))) {
    throw new RewardConfigurationError('Accepted winners and roster must be unique Match participants.');
  }
  if (v1) {
    try {
      const outcome = normalizeOutcome(match.format!, match.participants, match.canonicalResult, {diplomacyEnabled: lock!.diplomacyEnabled});
      const expected = winningPlayerIds(outcome, match.participants);
      if (expected.length !== winners.size || expected.some(id => !winners.has(id))) throw new Error('Canonical winning roster disagrees with the accepted outcome.');
      if (match.format === 'FFA' && lock!.act === 'MAIN_EVENT' && !lock!.diplomacyEnabled && !lock!.placementRule) throw new Error('Nondiplomatic FFA lacks its announced placement rule.');
    } catch (error) { throw new RewardConfigurationError((error as Error).message); }
  }
  if (v1 && match.format === 'FFA' && (!lock!.diplomacyEnabled && winners.size !== 1 || winners.size >= match.participants.length)) {
    throw new RewardConfigurationError('FFA must have nonwinners; nondiplomatic FFA must have one winner.');
  }
  if (v1 && winners.size >= match.participants.length) throw new RewardConfigurationError('A competitive Match must have a nonwinning side.');
  if (v1 && match.participants.length > 8) throw new RewardConfigurationError('Season scoring supports at most eight starters.');
  if (v1 && match.canonicalResult.ffaPlacements) {
    try { validateFfaPlacements(match.canonicalResult.ffaPlacements, lock!, match.participants, [...winners]); }
    catch (error) { throw new RewardConfigurationError((error as Error).message); }
  }

  const leagueCompletion = match.context?.affectsLeaguePoints
    ? finiteNumber(rules.matchCompletionPoints, "scoringSnapshot.rules.matchCompletionPoints")
    : 0;
  const leagueWin = match.context?.affectsLeaguePoints
    ? finiteNumber(rules.matchWinPoints, "scoringSnapshot.rules.matchWinPoints")
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
    const main = lock?.act === 'MAIN_EVENT';
    const emperor = match.participants.find(p => p.playerId === lock?.emperorPlayerId);
    const bounty = v1 && main && isWinner && emperor && !winners.has(emperor.playerId) ? 2 : 0;
    const placementApplicable = v1 && main && match.format === 'FFA' && !lock!.diplomacyEnabled;
    const placements = match.canonicalResult.ffaPlacements;
    const position = placements?.finishingOrder.indexOf(participant.playerId);
    const placement = placementApplicable && !isWinner && placements ?
      (position === 1 && match.participants.length >= 3 ? 2 : position === 2 && match.participants.length >= 5 ? 1 : 0) : 0;
    return {
      ...(v1 ? {seasonCounters: {mainEventWins: main && isWinner ? 1 : 0, warmupWins: !main && isWinner ? 1 : 0,
        mainEventsPlayed: main ? 1 : 0, warmupsPlayed: main ? 0 : 1},
        placementStatus: placementApplicable ? placements ? 'VERIFIED' as const : 'PENDING' as const : 'NOT_APPLICABLE' as const} : {}),
      playerId: participant.playerId,
      leaguePoints: {
        matchCompletion: v1 ? main ? 4 : 1 : leagueCompletion,
        matchWin: isWinner ? v1 ? (main ? 6 : 2) / (match.format === 'FFA' && lock!.diplomacyEnabled ? winners.size : 1) : leagueWin : 0,
        ...(v1 ? {ffaPlacement: placement, emperorBounty: bounty} : {}),
      },
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
