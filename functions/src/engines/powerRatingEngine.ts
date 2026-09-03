import type { CanonicalGameResult, MatchFormat, MatchParticipant } from "../domain/types.js";

export const POWER_RATING_ALGORITHM = "LEAGUE_POWER_ELO";
export const POWER_RATING_ENGINE_VERSION = "POWER_RATING_ENGINE_V1";

export type PowerRatingRounding = "NEAREST_INTEGER";
export type PowerRatingFfaMode = "WINNER_VS_FIELD_ZERO_SUM";

export interface PowerRatingConfig {
  baseRating: number;
  provisionalMatchCount: number;
  provisionalK: number;
  establishedK: number;
  ratingScale: number;
  teamSizeBonus: number;
  minimumRating: number | null;
  rounding: PowerRatingRounding;
  ffaMode: PowerRatingFfaMode;
}

export const DEFAULT_POWER_RATING_CONFIG: PowerRatingConfig = {
  baseRating: 1000,
  provisionalMatchCount: 5,
  provisionalK: 48,
  establishedK: 24,
  ratingScale: 400,
  teamSizeBonus: 200,
  minimumRating: null,
  rounding: "NEAREST_INTEGER",
  ffaMode: "WINNER_VS_FIELD_ZERO_SUM",
};

export interface PowerRatingMatchInput {
  matchId: string;
  format: MatchFormat;
  participants: MatchParticipant[];
  canonicalResult: CanonicalGameResult;
  orderAtMs: number;
}

export interface PowerRatingHistoryEntry {
  playerId: string;
  matchId: string;
  sourceRevision: number;
  previousRating: number;
  newRating: number;
  delta: number;
  expectedScore: number;
  actualScore: number;
  ratedMatchNumber: number;
  provisionalAfter: boolean;
  orderAtMs: number;
}

export interface PowerRatingPlayerProjection {
  playerId: string;
  currentPowerRating: number;
  ratedMatchCount: number;
  provisionalRating: boolean;
}

export interface PowerRatingRebuildResult {
  projections: PowerRatingPlayerProjection[];
  history: PowerRatingHistoryEntry[];
}

interface MutablePlayerState {
  rating: number;
  games: number;
}

function finiteNumber(name: string, value: number, minimum: number, maximum: number): void {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}.`);
  }
}

export function validatePowerRatingConfig(config: PowerRatingConfig): PowerRatingConfig {
  finiteNumber("baseRating", config.baseRating, 0, 10000);
  if (!Number.isInteger(config.provisionalMatchCount) || config.provisionalMatchCount < 0 || config.provisionalMatchCount > 100) {
    throw new Error("provisionalMatchCount must be an integer between 0 and 100.");
  }
  finiteNumber("provisionalK", config.provisionalK, 0, 500);
  finiteNumber("establishedK", config.establishedK, 0, 500);
  finiteNumber("ratingScale", config.ratingScale, 1, 5000);
  finiteNumber("teamSizeBonus", config.teamSizeBonus, -2000, 2000);
  if (config.minimumRating != null) finiteNumber("minimumRating", config.minimumRating, 0, 10000);
  if (config.rounding !== "NEAREST_INTEGER") throw new Error("Unsupported Power Rating rounding mode.");
  if (config.ffaMode !== "WINNER_VS_FIELD_ZERO_SUM") throw new Error("Unsupported Power Rating FFA mode.");
  return config;
}

function kFactor(games: number, config: PowerRatingConfig): number {
  return games < config.provisionalMatchCount ? config.provisionalK : config.establishedK;
}

function roundRating(value: number, config: PowerRatingConfig): number {
  const rounded = Math.round(value);
  return config.minimumRating == null ? rounded : Math.max(config.minimumRating, rounded);
}

function expectedScore(rating: number, opposingRating: number, config: PowerRatingConfig): number {
  return 1 / (1 + 10 ** ((opposingRating - rating) / config.ratingScale));
}

function mean(values: number[], config: PowerRatingConfig): number {
  if (values.length === 0) return config.baseRating;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function effectiveTeamRating(ratings: number[], config: PowerRatingConfig): number {
  return mean(ratings, config) + config.teamSizeBonus * Math.log2(Math.max(1, ratings.length));
}

function strength(rating: number, config: PowerRatingConfig): number {
  return 10 ** (rating / config.ratingScale);
}

function stateFor(
  states: Map<string, MutablePlayerState>,
  playerId: string,
  config: PowerRatingConfig,
): MutablePlayerState {
  let state = states.get(playerId);
  if (!state) {
    state = { rating: config.baseRating, games: 0 };
    states.set(playerId, state);
  }
  return state;
}

function pushHistory(
  history: PowerRatingHistoryEntry[],
  state: MutablePlayerState,
  config: PowerRatingConfig,
  input: {
    playerId: string;
    match: PowerRatingMatchInput;
    delta: number;
    expected: number;
    actual: number;
  },
): void {
  const previousRating = state.rating;
  const newRating = roundRating(previousRating + input.delta, config);
  state.rating = newRating;
  state.games += 1;

  history.push({
    playerId: input.playerId,
    matchId: input.match.matchId,
    sourceRevision: input.match.canonicalResult.revision ?? 1,
    previousRating,
    newRating,
    delta: newRating - previousRating,
    expectedScore: input.expected,
    actualScore: input.actual,
    ratedMatchNumber: state.games,
    provisionalAfter: state.games < config.provisionalMatchCount,
    orderAtMs: input.match.orderAtMs,
  });
}

function processTeamMatch(
  states: Map<string, MutablePlayerState>,
  history: PowerRatingHistoryEntry[],
  match: PowerRatingMatchInput,
  config: PowerRatingConfig,
): void {
  const teamOne = match.participants.filter((participant) => participant.team === 1);
  const teamTwo = match.participants.filter((participant) => participant.team === 2);

  if (teamOne.length === 0 || teamTwo.length === 0) {
    throw new Error(`Match ${match.matchId} is missing one of its teams.`);
  }
  if (match.canonicalResult.type !== "TEAM_WIN") {
    throw new Error(`Match ${match.matchId} requires a team winner.`);
  }

  const teamOneRatings = teamOne.map((participant) => stateFor(states, participant.playerId, config).rating);
  const teamTwoRatings = teamTwo.map((participant) => stateFor(states, participant.playerId, config).rating);
  const teamOneExpected = expectedScore(
    effectiveTeamRating(teamOneRatings, config),
    effectiveTeamRating(teamTwoRatings, config),
    config,
  );
  const teamTwoExpected = 1 - teamOneExpected;
  const teamOneActual = match.canonicalResult.winnerTeam === 1 ? 1 : 0;
  const teamTwoActual = 1 - teamOneActual;

  const updates = [
    ...teamOne.map((participant) => ({ participant, expected: teamOneExpected, actual: teamOneActual })),
    ...teamTwo.map((participant) => ({ participant, expected: teamTwoExpected, actual: teamTwoActual })),
  ];

  for (const update of updates) {
    const state = stateFor(states, update.participant.playerId, config);
    const delta = kFactor(state.games, config) * (update.actual - update.expected);
    pushHistory(history, state, config, {
      playerId: update.participant.playerId,
      match,
      delta,
      expected: update.expected,
      actual: update.actual,
    });
  }
}

function processFfaMatch(
  states: Map<string, MutablePlayerState>,
  history: PowerRatingHistoryEntry[],
  match: PowerRatingMatchInput,
  config: PowerRatingConfig,
): void {
  if (config.ffaMode !== "WINNER_VS_FIELD_ZERO_SUM") {
    throw new Error(`Unsupported FFA rating mode ${config.ffaMode}.`);
  }
  if (match.canonicalResult.type !== "PLAYER_WIN") {
    throw new Error(`FFA Match ${match.matchId} requires a player winner.`);
  }

  const participants = match.participants;
  const winnerId = match.canonicalResult.winnerPlayerId;
  if (!participants.some((participant) => participant.playerId === winnerId)) {
    throw new Error(`FFA Match ${match.matchId} winner is not a participant.`);
  }

  const before = participants.map((participant) => {
    const state = stateFor(states, participant.playerId, config);
    return {
      participant,
      rating: state.rating,
      games: state.games,
      strength: strength(state.rating, config),
    };
  });
  const totalStrength = before.reduce((total, item) => total + item.strength, 0);
  const winner = before.find((item) => item.participant.playerId === winnerId)!;
  const winnerExpected = winner.strength / totalStrength;
  const averageK = mean(before.map((item) => kFactor(item.games, config)), config);
  const winnerDelta = averageK * (1 - winnerExpected);
  const loserProbabilityMass = Math.max(1e-9, 1 - winnerExpected);

  const deltas = new Map<string, { delta: number; expected: number; actual: number }>();
  deltas.set(winnerId, { delta: winnerDelta, expected: winnerExpected, actual: 1 });

  for (const item of before) {
    if (item.participant.playerId === winnerId) continue;
    const playerExpected = item.strength / totalStrength;
    deltas.set(item.participant.playerId, {
      delta: -winnerDelta * (playerExpected / loserProbabilityMass),
      expected: playerExpected,
      actual: 0,
    });
  }

  for (const item of before) {
    const update = deltas.get(item.participant.playerId)!;
    const state = stateFor(states, item.participant.playerId, config);
    pushHistory(history, state, config, {
      playerId: item.participant.playerId,
      match,
      delta: update.delta,
      expected: update.expected,
      actual: update.actual,
    });
  }
}

export function rebuildPowerRatings(
  matches: PowerRatingMatchInput[],
  configInput: PowerRatingConfig = DEFAULT_POWER_RATING_CONFIG,
): PowerRatingRebuildResult {
  const config = validatePowerRatingConfig(configInput);
  const states = new Map<string, MutablePlayerState>();
  const history: PowerRatingHistoryEntry[] = [];

  const orderedMatches = [...matches].sort((left, right) => {
    if (left.orderAtMs !== right.orderAtMs) return left.orderAtMs - right.orderAtMs;
    return left.matchId.localeCompare(right.matchId);
  });

  for (const match of orderedMatches) {
    if (!Array.isArray(match.participants) || match.participants.length < 2) {
      throw new Error(`Match ${match.matchId} has fewer than two participants.`);
    }

    if (match.format === "FFA") {
      processFfaMatch(states, history, match, config);
    } else {
      processTeamMatch(states, history, match, config);
    }
  }

  const projections = [...states.entries()]
    .map<PowerRatingPlayerProjection>(([playerId, state]) => ({
      playerId,
      currentPowerRating: state.rating,
      ratedMatchCount: state.games,
      provisionalRating: state.games < config.provisionalMatchCount,
    }))
    .sort((left, right) => left.playerId.localeCompare(right.playerId));

  return { projections, history };
}
