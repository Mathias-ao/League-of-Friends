import type { CanonicalGameResult, MatchFormat, MatchParticipant } from "../domain/types.js";

export const PAIR_HISTORY_VERSION = "AOF_PAIR_HISTORY_V1";
export const RELATIONSHIP_ENGINE_VERSION = "AOF_RELATIONSHIP_ENGINE_V1";

export type RelationshipTrack = "RIVALRY" | "ENEMY" | "FRIEND";
export type RelationshipSignalType =
  | "RAID"
  | "FORWARD_BUILDING"
  | "FORWARD_ECO"
  | "ENEMY_BASE_CONTACT"
  | "ALLY_SUPPORT";

export interface RelationshipSignal {
  sourcePlayerId: string;
  targetPlayerId: string;
  type: RelationshipSignalType;
  count: number;
  sourceVersion: string;
}

export interface PairHistoryMatchInput {
  matchId: string;
  orderAtMs: number;
  format: MatchFormat;
  participants: MatchParticipant[];
  canonicalResult: CanonicalGameResult;
  affectsLifetimeStats: boolean;
  signals?: RelationshipSignal[];
}

export interface DirectionalSignalSummary {
  counts: Partial<Record<RelationshipSignalType, number>>;
  sourceVersions: string[];
}

export interface PairHistory {
  schemaVersion: typeof PAIR_HISTORY_VERSION;
  pairId: string;
  playerOneId: string;
  playerTwoId: string;
  encounters: number;
  opposedMatches: number;
  alliedMatches: number;
  playerOneOpponentWins: number;
  playerTwoOpponentWins: number;
  noPairWinnerOpponentMatches: number;
  alliedWins: number;
  alliedLosses: number;
  playerOneToPlayerTwo: DirectionalSignalSummary;
  playerTwoToPlayerOne: DirectionalSignalSummary;
  firstMatchId: string;
  lastMatchId: string;
  firstPlayedAtMs: number;
  lastPlayedAtMs: number;
  contributingMatchIds: string[];
}

interface MutableSignalSummary {
  counts: Partial<Record<RelationshipSignalType, number>>;
  sourceVersions: Set<string>;
}

interface MutablePairHistory {
  pairId: string;
  playerOneId: string;
  playerTwoId: string;
  encounters: number;
  opposedMatches: number;
  alliedMatches: number;
  playerOneOpponentWins: number;
  playerTwoOpponentWins: number;
  noPairWinnerOpponentMatches: number;
  alliedWins: number;
  alliedLosses: number;
  playerOneToPlayerTwo: MutableSignalSummary;
  playerTwoToPlayerOne: MutableSignalSummary;
  firstMatchId: string;
  lastMatchId: string;
  firstPlayedAtMs: number;
  lastPlayedAtMs: number;
  contributingMatchIds: Set<string>;
}

export interface RelationshipMetricSnapshot {
  metricId: string;
  value: number;
}

export interface RelationshipPointRule {
  ruleId: string;
  track: RelationshipTrack;
  metricId: string;
  pointsPerUnit: number;
  maximumUnits?: number;
}

export interface RelationshipStageRule {
  stageId: string;
  minimumPoints: number;
}

export interface RelationshipRuleSet {
  ruleVersion: string;
  pointRules: RelationshipPointRule[];
  stages: Record<RelationshipTrack, RelationshipStageRule[]>;
}

export interface RelationshipPointContribution {
  ruleId: string;
  metricId: string;
  observedUnits: number;
  appliedUnits: number;
  pointsPerUnit: number;
  points: number;
}

export interface RelationshipTrackProjection {
  track: RelationshipTrack;
  status: "UNCONFIGURED" | "READY";
  points: number | null;
  stageId: string | null;
  contributions: RelationshipPointContribution[];
}

export interface RelationshipProjection {
  engineVersion: typeof RELATIONSHIP_ENGINE_VERSION;
  ruleVersion: string | null;
  pairHistoryVersion: typeof PAIR_HISTORY_VERSION;
  pairId: string;
  playerOneId: string;
  playerTwoId: string;
  rivalry: RelationshipTrackProjection;
  enemy: RelationshipTrackProjection;
  friend: RelationshipTrackProjection;
}

const SIGNAL_TYPES: RelationshipSignalType[] = [
  "RAID",
  "FORWARD_BUILDING",
  "FORWARD_ECO",
  "ENEMY_BASE_CONTACT",
  "ALLY_SUPPORT",
];

export function relationshipPairId(playerA: string, playerB: string): string {
  const [one, two] = [playerA, playerB].sort((left, right) => left.localeCompare(right));
  return `${one}__${two}`;
}

function sameTeam(format: MatchFormat, first: MatchParticipant, second: MatchParticipant): boolean {
  return format !== "FFA" && first.team != null && second.team != null && first.team === second.team;
}

function emptySignalSummary(): MutableSignalSummary {
  return { counts: {}, sourceVersions: new Set<string>() };
}

function emptyPair(first: MatchParticipant, second: MatchParticipant, match: PairHistoryMatchInput): MutablePairHistory {
  const [playerOneId, playerTwoId] = [first.playerId, second.playerId].sort((left, right) => left.localeCompare(right));
  return {
    pairId: relationshipPairId(playerOneId, playerTwoId),
    playerOneId,
    playerTwoId,
    encounters: 0,
    opposedMatches: 0,
    alliedMatches: 0,
    playerOneOpponentWins: 0,
    playerTwoOpponentWins: 0,
    noPairWinnerOpponentMatches: 0,
    alliedWins: 0,
    alliedLosses: 0,
    playerOneToPlayerTwo: emptySignalSummary(),
    playerTwoToPlayerOne: emptySignalSummary(),
    firstMatchId: match.matchId,
    lastMatchId: match.matchId,
    firstPlayedAtMs: match.orderAtMs,
    lastPlayedAtMs: match.orderAtMs,
    contributingMatchIds: new Set<string>(),
  };
}

function addSignal(summary: MutableSignalSummary, signal: RelationshipSignal): void {
  if (!Number.isFinite(signal.count) || signal.count < 0) {
    throw new Error(`Relationship signal ${signal.type} count must be a non-negative finite number.`);
  }
  if (!signal.sourceVersion) throw new Error(`Relationship signal ${signal.type} sourceVersion is required.`);
  summary.counts[signal.type] = (summary.counts[signal.type] ?? 0) + signal.count;
  summary.sourceVersions.add(signal.sourceVersion);
}

function addMatchPair(
  store: Map<string, MutablePairHistory>,
  match: PairHistoryMatchInput,
  first: MatchParticipant,
  second: MatchParticipant,
): void {
  const pairId = relationshipPairId(first.playerId, second.playerId);
  const pair = store.get(pairId) ?? emptyPair(first, second, match);
  const winners = new Set(match.canonicalResult.winningPlayerIds);
  const allied = sameTeam(match.format, first, second);

  pair.encounters += 1;
  pair.contributingMatchIds.add(match.matchId);
  if (match.orderAtMs < pair.firstPlayedAtMs || (match.orderAtMs === pair.firstPlayedAtMs && match.matchId.localeCompare(pair.firstMatchId) < 0)) {
    pair.firstPlayedAtMs = match.orderAtMs;
    pair.firstMatchId = match.matchId;
  }
  if (match.orderAtMs > pair.lastPlayedAtMs || (match.orderAtMs === pair.lastPlayedAtMs && match.matchId.localeCompare(pair.lastMatchId) > 0)) {
    pair.lastPlayedAtMs = match.orderAtMs;
    pair.lastMatchId = match.matchId;
  }

  if (allied) {
    pair.alliedMatches += 1;
    const bothWon = winners.has(pair.playerOneId) && winners.has(pair.playerTwoId);
    if (bothWon) pair.alliedWins += 1;
    else pair.alliedLosses += 1;
  } else {
    pair.opposedMatches += 1;
    const oneWon = winners.has(pair.playerOneId);
    const twoWon = winners.has(pair.playerTwoId);
    if (oneWon && !twoWon) pair.playerOneOpponentWins += 1;
    else if (twoWon && !oneWon) pair.playerTwoOpponentWins += 1;
    else pair.noPairWinnerOpponentMatches += 1;
  }

  for (const signal of match.signals ?? []) {
    const belongsToPair =
      (signal.sourcePlayerId === pair.playerOneId && signal.targetPlayerId === pair.playerTwoId) ||
      (signal.sourcePlayerId === pair.playerTwoId && signal.targetPlayerId === pair.playerOneId);
    if (!belongsToPair) continue;
    if (signal.sourcePlayerId === pair.playerOneId) addSignal(pair.playerOneToPlayerTwo, signal);
    else addSignal(pair.playerTwoToPlayerOne, signal);
  }

  store.set(pairId, pair);
}

function finishSignalSummary(summary: MutableSignalSummary): DirectionalSignalSummary {
  const counts: Partial<Record<RelationshipSignalType, number>> = {};
  for (const type of SIGNAL_TYPES) {
    const value = summary.counts[type];
    if (value != null) counts[type] = value;
  }
  return {
    counts,
    sourceVersions: [...summary.sourceVersions].sort((a, b) => a.localeCompare(b)),
  };
}

function finishPair(pair: MutablePairHistory): PairHistory {
  return {
    schemaVersion: PAIR_HISTORY_VERSION,
    pairId: pair.pairId,
    playerOneId: pair.playerOneId,
    playerTwoId: pair.playerTwoId,
    encounters: pair.encounters,
    opposedMatches: pair.opposedMatches,
    alliedMatches: pair.alliedMatches,
    playerOneOpponentWins: pair.playerOneOpponentWins,
    playerTwoOpponentWins: pair.playerTwoOpponentWins,
    noPairWinnerOpponentMatches: pair.noPairWinnerOpponentMatches,
    alliedWins: pair.alliedWins,
    alliedLosses: pair.alliedLosses,
    playerOneToPlayerTwo: finishSignalSummary(pair.playerOneToPlayerTwo),
    playerTwoToPlayerOne: finishSignalSummary(pair.playerTwoToPlayerOne),
    firstMatchId: pair.firstMatchId,
    lastMatchId: pair.lastMatchId,
    firstPlayedAtMs: pair.firstPlayedAtMs,
    lastPlayedAtMs: pair.lastPlayedAtMs,
    contributingMatchIds: [...pair.contributingMatchIds].sort((a, b) => a.localeCompare(b)),
  };
}

export function rebuildPairHistory(matches: PairHistoryMatchInput[]): PairHistory[] {
  const pairs = new Map<string, MutablePairHistory>();
  const ordered = [...matches].sort((left, right) => left.orderAtMs - right.orderAtMs || left.matchId.localeCompare(right.matchId));

  for (const match of ordered) {
    if (!match.affectsLifetimeStats) continue;
    if (match.participants.length < 2) throw new Error(`Match ${match.matchId} has fewer than two participants.`);
    const participantIds = new Set(match.participants.map((participant) => participant.playerId));
    for (const signal of match.signals ?? []) {
      if (!participantIds.has(signal.sourcePlayerId) || !participantIds.has(signal.targetPlayerId)) {
        throw new Error(`Match ${match.matchId} contains a relationship signal for a non-participant.`);
      }
      if (signal.sourcePlayerId === signal.targetPlayerId) {
        throw new Error(`Match ${match.matchId} contains a self-directed relationship signal.`);
      }
    }

    for (let left = 0; left < match.participants.length; left += 1) {
      for (let right = left + 1; right < match.participants.length; right += 1) {
        addMatchPair(pairs, match, match.participants[left], match.participants[right]);
      }
    }
  }

  return [...pairs.values()].map(finishPair).sort((a, b) => a.pairId.localeCompare(b.pairId));
}

export function pairHistoryMetrics(history: PairHistory): RelationshipMetricSnapshot[] {
  const values: Record<string, number> = {
    encounters: history.encounters,
    opposedMatches: history.opposedMatches,
    alliedMatches: history.alliedMatches,
    playerOneOpponentWins: history.playerOneOpponentWins,
    playerTwoOpponentWins: history.playerTwoOpponentWins,
    mutualOpponentWinHistory: history.playerOneOpponentWins > 0 && history.playerTwoOpponentWins > 0 ? 1 : 0,
    alliedWins: history.alliedWins,
    alliedLosses: history.alliedLosses,
  };

  for (const type of SIGNAL_TYPES) {
    const suffix = type
      .toLowerCase()
      .replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
    values[`playerOneToPlayerTwo.${suffix}`] = history.playerOneToPlayerTwo.counts[type] ?? 0;
    values[`playerTwoToPlayerOne.${suffix}`] = history.playerTwoToPlayerOne.counts[type] ?? 0;
    values[`combined.${suffix}`] = (history.playerOneToPlayerTwo.counts[type] ?? 0) + (history.playerTwoToPlayerOne.counts[type] ?? 0);
  }

  return Object.entries(values)
    .map(([metricId, value]) => ({ metricId, value }))
    .sort((left, right) => left.metricId.localeCompare(right.metricId));
}

export function validateRelationshipRuleSet(ruleSet: RelationshipRuleSet): RelationshipRuleSet {
  if (!ruleSet.ruleVersion) throw new Error("Relationship ruleVersion is required.");
  const ruleIds = new Set<string>();
  for (const rule of ruleSet.pointRules) {
    if (!rule.ruleId || !rule.metricId) throw new Error("Relationship rules require ruleId and metricId.");
    if (ruleIds.has(rule.ruleId)) throw new Error(`Duplicate relationship ruleId: ${rule.ruleId}.`);
    ruleIds.add(rule.ruleId);
    if (!Number.isFinite(rule.pointsPerUnit)) throw new Error(`Rule ${rule.ruleId} pointsPerUnit must be finite.`);
    if (rule.maximumUnits != null && (!Number.isFinite(rule.maximumUnits) || rule.maximumUnits < 0)) {
      throw new Error(`Rule ${rule.ruleId} maximumUnits must be non-negative when provided.`);
    }
  }

  for (const track of ["RIVALRY", "ENEMY", "FRIEND"] as RelationshipTrack[]) {
    let previous = Number.NEGATIVE_INFINITY;
    const stageIds = new Set<string>();
    for (const stage of ruleSet.stages[track]) {
      if (!stage.stageId) throw new Error(`${track} stages require stageId.`);
      if (stageIds.has(stage.stageId)) throw new Error(`Duplicate ${track} stageId: ${stage.stageId}.`);
      stageIds.add(stage.stageId);
      if (!Number.isFinite(stage.minimumPoints) || stage.minimumPoints < previous) {
        throw new Error(`${track} stages must be ordered by non-decreasing minimumPoints.`);
      }
      previous = stage.minimumPoints;
    }
  }

  return {
    ruleVersion: ruleSet.ruleVersion,
    pointRules: ruleSet.pointRules.map((rule) => ({ ...rule })),
    stages: {
      RIVALRY: ruleSet.stages.RIVALRY.map((stage) => ({ ...stage })),
      ENEMY: ruleSet.stages.ENEMY.map((stage) => ({ ...stage })),
      FRIEND: ruleSet.stages.FRIEND.map((stage) => ({ ...stage })),
    },
  };
}

function unconfiguredTrack(track: RelationshipTrack): RelationshipTrackProjection {
  return { track, status: "UNCONFIGURED", points: null, stageId: null, contributions: [] };
}

function evaluateTrack(
  track: RelationshipTrack,
  metrics: Map<string, number>,
  ruleSet: RelationshipRuleSet,
): RelationshipTrackProjection {
  const contributions: RelationshipPointContribution[] = [];
  for (const rule of ruleSet.pointRules.filter((candidate) => candidate.track === track)) {
    const observedUnits = metrics.get(rule.metricId) ?? 0;
    const appliedUnits = rule.maximumUnits == null ? observedUnits : Math.min(observedUnits, rule.maximumUnits);
    const points = appliedUnits * rule.pointsPerUnit;
    contributions.push({
      ruleId: rule.ruleId,
      metricId: rule.metricId,
      observedUnits,
      appliedUnits,
      pointsPerUnit: rule.pointsPerUnit,
      points,
    });
  }

  const points = contributions.reduce((sum, contribution) => sum + contribution.points, 0);
  let stageId: string | null = null;
  for (const stage of ruleSet.stages[track]) {
    if (points >= stage.minimumPoints) stageId = stage.stageId;
  }

  return {
    track,
    status: "READY",
    points,
    stageId,
    contributions,
  };
}

export function evaluateRelationship(
  history: PairHistory,
  ruleSetInput: RelationshipRuleSet | null,
): RelationshipProjection {
  if (!ruleSetInput) {
    return {
      engineVersion: RELATIONSHIP_ENGINE_VERSION,
      ruleVersion: null,
      pairHistoryVersion: PAIR_HISTORY_VERSION,
      pairId: history.pairId,
      playerOneId: history.playerOneId,
      playerTwoId: history.playerTwoId,
      rivalry: unconfiguredTrack("RIVALRY"),
      enemy: unconfiguredTrack("ENEMY"),
      friend: unconfiguredTrack("FRIEND"),
    };
  }

  const ruleSet = validateRelationshipRuleSet(ruleSetInput);
  const metrics = new Map(pairHistoryMetrics(history).map((metric) => [metric.metricId, metric.value]));

  return {
    engineVersion: RELATIONSHIP_ENGINE_VERSION,
    ruleVersion: ruleSet.ruleVersion,
    pairHistoryVersion: PAIR_HISTORY_VERSION,
    pairId: history.pairId,
    playerOneId: history.playerOneId,
    playerTwoId: history.playerTwoId,
    rivalry: evaluateTrack("RIVALRY", metrics, ruleSet),
    enemy: evaluateTrack("ENEMY", metrics, ruleSet),
    friend: evaluateTrack("FRIEND", metrics, ruleSet),
  };
}
