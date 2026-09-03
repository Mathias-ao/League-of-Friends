import type { CanonicalGameResult, MatchFormat, MatchParticipant } from "../domain/types.js";

export const RIVALRY_ENGINE_VERSION = "RIVALRY_ENGINE_V1";

export interface RivalryConfig {
  pointsPerEncounter: number;
  mutualWinBonus: number;
  qualificationThreshold: number;
}

export const DEFAULT_RIVALRY_CONFIG: RivalryConfig = {
  pointsPerEncounter: 2,
  mutualWinBonus: 2,
  qualificationThreshold: 6,
};

export interface RivalryMatchInput {
  matchId: string;
  seasonId: string | null;
  format: MatchFormat;
  participants: MatchParticipant[];
  canonicalResult: CanonicalGameResult;
  affectsLifetimeStats: boolean;
  affectsSeasonStats: boolean;
}

export interface RivalryProjection {
  pairId: string;
  playerOneId: string;
  playerTwoId: string;
  encounters: number;
  playerOneWins: number;
  playerTwoWins: number;
  noPairWinnerEncounters: number;
  rivalryScore: number;
  status: "EMERGING" | "QUALIFIED";
  contributingMatchIds: string[];
}

export interface RivalryRebuild {
  engineVersion: typeof RIVALRY_ENGINE_VERSION;
  config: RivalryConfig;
  lifetime: RivalryProjection[];
  seasonal: Array<{ seasonId: string; rivalries: RivalryProjection[] }>;
}

interface MutableRivalry {
  pairId: string;
  playerOneId: string;
  playerTwoId: string;
  encounters: number;
  playerOneWins: number;
  playerTwoWins: number;
  noPairWinnerEncounters: number;
  contributingMatchIds: Set<string>;
}

export function rivalryPairId(playerA: string, playerB: string): string {
  const [one, two] = [playerA, playerB].sort((left, right) => left.localeCompare(right));
  return `${one}__${two}`;
}

export function validateRivalryConfig(config: RivalryConfig): RivalryConfig {
  for (const [field, value] of Object.entries(config)) {
    if (!Number.isInteger(value) || value < 0 || value > 1000) {
      throw new Error(`${field} must be an integer from 0 to 1000.`);
    }
  }
  if (config.pointsPerEncounter < 1) throw new Error("pointsPerEncounter must be at least 1.");
  if (config.qualificationThreshold < 1) throw new Error("qualificationThreshold must be at least 1.");
  return { ...config };
}

function emptyPair(playerA: string, playerB: string): MutableRivalry {
  const [playerOneId, playerTwoId] = [playerA, playerB].sort((left, right) => left.localeCompare(right));
  return {
    pairId: rivalryPairId(playerOneId, playerTwoId),
    playerOneId,
    playerTwoId,
    encounters: 0,
    playerOneWins: 0,
    playerTwoWins: 0,
    noPairWinnerEncounters: 0,
    contributingMatchIds: new Set<string>(),
  };
}

function opponentPairs(match: RivalryMatchInput): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (let left = 0; left < match.participants.length; left += 1) {
    for (let right = left + 1; right < match.participants.length; right += 1) {
      const first = match.participants[left];
      const second = match.participants[right];
      const opponents = match.format === "FFA"
        ? true
        : first.team != null && second.team != null && first.team !== second.team;
      if (opponents) pairs.push([first.playerId, second.playerId]);
    }
  }
  return pairs;
}

function addMatch(target: Map<string, MutableRivalry>, match: RivalryMatchInput): void {
  const winners = new Set(match.canonicalResult.winningPlayerIds);
  for (const [playerA, playerB] of opponentPairs(match)) {
    const pairId = rivalryPairId(playerA, playerB);
    const pair = target.get(pairId) ?? emptyPair(playerA, playerB);
    pair.encounters += 1;
    pair.contributingMatchIds.add(match.matchId);

    const oneWon = winners.has(pair.playerOneId);
    const twoWon = winners.has(pair.playerTwoId);
    if (oneWon && !twoWon) pair.playerOneWins += 1;
    else if (twoWon && !oneWon) pair.playerTwoWins += 1;
    else pair.noPairWinnerEncounters += 1;

    target.set(pairId, pair);
  }
}

function finish(pair: MutableRivalry, config: RivalryConfig): RivalryProjection {
  const rivalryScore =
    pair.encounters * config.pointsPerEncounter +
    (pair.playerOneWins > 0 && pair.playerTwoWins > 0 ? config.mutualWinBonus : 0);
  return {
    pairId: pair.pairId,
    playerOneId: pair.playerOneId,
    playerTwoId: pair.playerTwoId,
    encounters: pair.encounters,
    playerOneWins: pair.playerOneWins,
    playerTwoWins: pair.playerTwoWins,
    noPairWinnerEncounters: pair.noPairWinnerEncounters,
    rivalryScore,
    status: rivalryScore >= config.qualificationThreshold ? "QUALIFIED" : "EMERGING",
    contributingMatchIds: [...pair.contributingMatchIds].sort((a, b) => a.localeCompare(b)),
  };
}

export function rebuildRivalries(
  matches: RivalryMatchInput[],
  configInput: RivalryConfig = DEFAULT_RIVALRY_CONFIG,
): RivalryRebuild {
  const config = validateRivalryConfig(configInput);
  const lifetime = new Map<string, MutableRivalry>();
  const seasonal = new Map<string, Map<string, MutableRivalry>>();

  for (const match of [...matches].sort((a, b) => a.matchId.localeCompare(b.matchId))) {
    if (match.affectsLifetimeStats) addMatch(lifetime, match);
    if (match.affectsSeasonStats && match.seasonId) {
      const season = seasonal.get(match.seasonId) ?? new Map<string, MutableRivalry>();
      addMatch(season, match);
      seasonal.set(match.seasonId, season);
    }
  }

  return {
    engineVersion: RIVALRY_ENGINE_VERSION,
    config,
    lifetime: [...lifetime.values()].map((pair) => finish(pair, config)).sort((a, b) => a.pairId.localeCompare(b.pairId)),
    seasonal: [...seasonal.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([seasonId, pairs]) => ({
        seasonId,
        rivalries: [...pairs.values()].map((pair) => finish(pair, config)).sort((a, b) => a.pairId.localeCompare(b.pairId)),
      })),
  };
}
