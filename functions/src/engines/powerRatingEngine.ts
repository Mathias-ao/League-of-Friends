import type { CanonicalGameResult, MatchFormat, MatchParticipant } from "../domain/types.js";

export const POWER_RATING_ALGORITHM = "LEAGUE_POWER_ELO";
export const POWER_RATING_VERSION = "POWER_RATING_V1";
export const DEFAULT_POWER_RATING = 1000;
export const PROVISIONAL_MATCH_COUNT = 5;

const PROVISIONAL_K = 48;
const ESTABLISHED_K = 24;
const TEAM_SIZE_RATING_BONUS = 200;

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

function kFactor(games: number): number {
  return games < PROVISIONAL_MATCH_COUNT ? PROVISIONAL_K : ESTABLISHED_K;
}

function roundRating(value: number): number {
  return Math.round(value);
}

function expectedScore(rating: number, opposingRating: number): number {
  return 1 / (1 + 10 ** ((opposingRating - rating) / 400));
}

function mean(values: number[]): number {
  if (values.length === 0) return DEFAULT_POWER_RATING;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function effectiveTeamRating(ratings: number[]): number {
  return mean(ratings) + TEAM_SIZE_RATING_BONUS * Math.log2(Math.max(1, ratings.length));
}

function strength(rating: number): number {
  return 10 ** (rating / 400);
}

function stateFor(states: Map<string, MutablePlayerState>, playerId: string): MutablePlayerState {
  let state = states.get(playerId);
  if (!state) {
    state = { rating: DEFAULT_POWER_RATING, games: 0 };
    states.set(playerId, state);
  }
  return state;
}

function pushHistory(
  history: PowerRatingHistoryEntry[],
  state: MutablePlayerState,
  input: {
    playerId: string;
    match: PowerRatingMatchInput;
    delta: number;
    expected: number;
    actual: number;
  },
): void {
  const previousRating = state.rating;
  const newRating = roundRating(previousRating + input.delta);
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
    provisionalAfter: state.games < PROVISIONAL_MATCH_COUNT,
    orderAtMs: input.match.orderAtMs,
  });
}

function processTeamMatch(
  states: Map<string, MutablePlayerState>,
  history: PowerRatingHistoryEntry[],
  match: PowerRatingMatchInput,
): void {
  const teamOne = match.participants.filter((participant) => participant.team === 1);
  const teamTwo = match.participants.filter((participant) => participant.team === 2);

  if (teamOne.length === 0 || teamTwo.length === 0) {
    throw new Error(`Match ${match.matchId} is missing one of its teams.`);
  }
  if (match.canonicalResult.type !== "TEAM_WIN") {
    throw new Error(`Match ${match.matchId} requires a team winner.`);
  }

  const teamOneRatings = teamOne.map((participant) => stateFor(states, participant.playerId).rating);
  const teamTwoRatings = teamTwo.map((participant) => stateFor(states, participant.playerId).rating);
  const teamOneExpected = expectedScore(
    effectiveTeamRating(teamOneRatings),
    effectiveTeamRating(teamTwoRatings),
  );
  const teamTwoExpected = 1 - teamOneExpected;
  const teamOneActual = match.canonicalResult.winnerTeam === 1 ? 1 : 0;
  const teamTwoActual = 1 - teamOneActual;

  const updates = [
    ...teamOne.map((participant) => ({
      participant,
      expected: teamOneExpected,
      actual: teamOneActual,
    })),
    ...teamTwo.map((participant) => ({
      participant,
      expected: teamTwoExpected,
      actual: teamTwoActual,
    })),
  ];

  for (const update of updates) {
    const state = stateFor(states, update.participant.playerId);
    const delta = kFactor(state.games) * (update.actual - update.expected);
    pushHistory(history, state, {
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
): void {
  if (match.canonicalResult.type !== "PLAYER_WIN") {
    throw new Error(`FFA Match ${match.matchId} requires a player winner.`);
  }

  const participants = match.participants;
  const winnerId = match.canonicalResult.winnerPlayerId;
  if (!participants.some((participant) => participant.playerId === winnerId)) {
    throw new Error(`FFA Match ${match.matchId} winner is not a participant.`);
  }

  const before = participants.map((participant) => {
    const state = stateFor(states, participant.playerId);
    return {
      participant,
      rating: state.rating,
      games: state.games,
      strength: strength(state.rating),
    };
  });
  const totalStrength = before.reduce((total, item) => total + item.strength, 0);
  const winner = before.find((item) => item.participant.playerId === winnerId)!;
  const winnerExpected = winner.strength / totalStrength;
  const averageK = mean(before.map((item) => kFactor(item.games)));
  const winnerDelta = averageK * (1 - winnerExpected);
  const loserProbabilityMass = Math.max(1e-9, 1 - winnerExpected);

  const deltas = new Map<string, { delta: number; expected: number; actual: number }>();
  deltas.set(winnerId, {
    delta: winnerDelta,
    expected: winnerExpected,
    actual: 1,
  });

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
    const state = stateFor(states, item.participant.playerId);
    pushHistory(history, state, {
      playerId: item.participant.playerId,
      match,
      delta: update.delta,
      expected: update.expected,
      actual: update.actual,
    });
  }
}

export function rebuildPowerRatings(matches: PowerRatingMatchInput[]): PowerRatingRebuildResult {
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
      processFfaMatch(states, history, match);
    } else {
      processTeamMatch(states, history, match);
    }
  }

  const projections = [...states.entries()]
    .map<PowerRatingPlayerProjection>(([playerId, state]) => ({
      playerId,
      currentPowerRating: state.rating,
      ratedMatchCount: state.games,
      provisionalRating: state.games < PROVISIONAL_MATCH_COUNT,
    }))
    .sort((left, right) => left.playerId.localeCompare(right.playerId));

  return { projections, history };
}
