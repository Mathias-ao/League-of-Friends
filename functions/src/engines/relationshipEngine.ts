import type { CanonicalGameResult, MatchFormat, MatchParticipant } from "../domain/types.js";

export const PAIR_HISTORY_VERSION = "AOF_PAIR_HISTORY_V2";
export const PAIR_ENCOUNTER_VERSION = "AOF_PAIR_ENCOUNTER_V1";
export const RELATIONSHIP_ENGINE_VERSION = "AOF_RELATIONSHIP_ENGINE_V2";

export type RelationshipTrack = "RIVALRY" | "HOSTILITY" | "BOND";
export type InteractionCoverage = "AVAILABLE" | "UNAVAILABLE";
export type PairRelation = "ALLIED" | "OPPOSED";
export type PairInteractionState =
  | "OPPOSED_CONTACT"
  | "OPPOSED_NO_CONTACT"
  | "ALLIED_COOPERATION"
  | "ALLIED_NO_COOPERATION"
  | "ALLIED_ANTAGONISM"
  | "ALLIED_MIXED"
  | "UNKNOWN_COVERAGE";

export type RelationshipSignalType =
  | "RAID"
  | "FORWARD_BUILDING"
  | "FORWARD_ECO"
  | "ENEMY_BASE_CONTACT"
  | "DIRECT_ENGAGEMENT"
  | "RELIC_THEFT"
  | "ALLY_SUPPORT"
  | "ALLY_REINFORCEMENT"
  | "DEFENSIVE_ASSIST"
  | "COOPERATIVE_ATTACK";

export interface RelationshipSignal {
  sourcePlayerId: string;
  targetPlayerId: string;
  type: RelationshipSignalType;
  count: number;
  sourceVersion: string;
}

export interface PairHistoryMatchInput {
  matchId: string;
  eventId?: string | null;
  seasonId?: string | null;
  orderAtMs: number;
  format: MatchFormat;
  participants: MatchParticipant[];
  canonicalResult: CanonicalGameResult;
  affectsLifetimeStats: boolean;
  interactionCoverage?: InteractionCoverage;
  signals?: RelationshipSignal[];
}

export interface DirectionalSignalSummary {
  counts: Partial<Record<RelationshipSignalType, number>>;
  sourceVersions: string[];
}

export interface PairEncounter {
  schemaVersion: typeof PAIR_ENCOUNTER_VERSION;
  pairId: string;
  matchId: string;
  eventId: string | null;
  seasonId: string | null;
  playedAtMs: number;
  relation: PairRelation;
  interactionCoverage: InteractionCoverage;
  interactionState: PairInteractionState;
  playerOneId: string;
  playerTwoId: string;
  playerOneWon: boolean;
  playerTwoWon: boolean;
  playerOneToPlayerTwo: DirectionalSignalSummary;
  playerTwoToPlayerOne: DirectionalSignalSummary;
}

export type ChronicleKind =
  | "FIRST_MEETING"
  | "OPPOSED_CONTACT"
  | "OPPOSED_NO_CONTACT"
  | "ALLIED_COOPERATION"
  | "ALLIED_NO_COOPERATION"
  | "ALLIED_ANTAGONISM"
  | "ALLIED_MIXED"
  | "COVERAGE_UNAVAILABLE";

export interface PairChronicleEntry {
  entryId: string;
  matchId: string;
  eventId: string | null;
  seasonId: string | null;
  playedAtMs: number;
  kind: ChronicleKind;
  title: string;
  text: string;
  relation: PairRelation;
  actorPlayerIds: string[];
  tracksTouched: RelationshipTrack[];
  evidence: {
    playerOneToPlayerTwo: Partial<Record<RelationshipSignalType, number>>;
    playerTwoToPlayerOne: Partial<Record<RelationshipSignalType, number>>;
  };
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
  encounterHistory: PairEncounter[];
  chronicle: PairChronicleEntry[];
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
  encounterHistory: PairEncounter[];
}

export type RelationshipPulseEffect = "STRENGTHEN" | "WEAKEN" | "DORMANT";
export type RelationshipPulseReason =
  | "DIRECT_CONTEST"
  | "DIRECTED_HOSTILITY"
  | "OPPOSED_WITHOUT_CONTACT"
  | "ALLIED_COOPERATION"
  | "ALLIED_WITHOUT_COOPERATION"
  | "ANTAGONISM_AGAINST_BOND";

export interface RelationshipPulse {
  pulseId: string;
  matchId: string;
  playedAtMs: number;
  track: RelationshipTrack;
  effect: RelationshipPulseEffect;
  reason: RelationshipPulseReason;
  sourcePlayerId: string | null;
  targetPlayerId: string | null;
  units: number;
  countsTowardReciprocity: boolean;
  requiresEstablishedBond?: boolean;
}

export interface RelationshipPulseRule {
  ruleId: string;
  track: RelationshipTrack;
  reason: RelationshipPulseReason;
  pointsPerUnit: number;
  maximumUnitsPerEncounter?: number;
}

export interface RelationshipStageRule {
  stageId: string;
  minimumPoints: number;
  minimumContributingEncounters?: number;
  minimumDirectionalPoints?: number;
  minimumReciprocalEncounters?: number;
}

export interface RelationshipRuleSet {
  ruleVersion: string;
  pulseRules: RelationshipPulseRule[];
  stages: Record<RelationshipTrack, RelationshipStageRule[]>;
  establishedBondDamageMultiplier: number;
}

export interface RelationshipPulseContribution {
  pulseId: string;
  ruleId: string;
  matchId: string;
  track: RelationshipTrack;
  effect: RelationshipPulseEffect;
  reason: RelationshipPulseReason;
  sourcePlayerId: string | null;
  targetPlayerId: string | null;
  observedUnits: number;
  appliedUnits: number;
  points: number;
  establishedBondMultiplierApplied: number;
}

export interface RelationshipTrackProjection {
  track: RelationshipTrack;
  status: "UNCONFIGURED" | "READY";
  state: "UNESTABLISHED" | "ACTIVE" | "DORMANT";
  points: number | null;
  directionalPoints: Record<string, number>;
  stageId: string | null;
  historicalPeakStageId: string | null;
  lastStrengthenedAtMs: number | null;
  contributingEncounterIds: string[];
  reciprocalEncounterIds: Record<string, string[]>;
  contributions: RelationshipPulseContribution[];
}

export interface RelationshipProjection {
  engineVersion: typeof RELATIONSHIP_ENGINE_VERSION;
  ruleVersion: string | null;
  pairHistoryVersion: typeof PAIR_HISTORY_VERSION;
  pairId: string;
  playerOneId: string;
  playerTwoId: string;
  pulses: RelationshipPulse[];
  rivalry: RelationshipTrackProjection;
  hostility: RelationshipTrackProjection;
  bond: RelationshipTrackProjection;
}

export interface RelationshipMetricSnapshot {
  metricId: string;
  value: number;
}

const SIGNAL_TYPES: RelationshipSignalType[] = [
  "RAID",
  "FORWARD_BUILDING",
  "FORWARD_ECO",
  "ENEMY_BASE_CONTACT",
  "DIRECT_ENGAGEMENT",
  "RELIC_THEFT",
  "ALLY_SUPPORT",
  "ALLY_REINFORCEMENT",
  "DEFENSIVE_ASSIST",
  "COOPERATIVE_ATTACK",
];

const HOSTILE_SIGNAL_TYPES: RelationshipSignalType[] = [
  "RAID",
  "FORWARD_BUILDING",
  "FORWARD_ECO",
  "ENEMY_BASE_CONTACT",
  "RELIC_THEFT",
];

const COOPERATION_SIGNAL_TYPES: RelationshipSignalType[] = [
  "ALLY_SUPPORT",
  "ALLY_REINFORCEMENT",
  "DEFENSIVE_ASSIST",
  "COOPERATIVE_ATTACK",
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

function addSignal(summary: MutableSignalSummary, signal: RelationshipSignal): void {
  if (!Number.isFinite(signal.count) || signal.count < 0) {
    throw new Error(`Relationship signal ${signal.type} count must be a non-negative finite number.`);
  }
  if (!signal.sourceVersion) throw new Error(`Relationship signal ${signal.type} sourceVersion is required.`);
  summary.counts[signal.type] = (summary.counts[signal.type] ?? 0) + signal.count;
  summary.sourceVersions.add(signal.sourceVersion);
}

function countSignal(summary: DirectionalSignalSummary, types: RelationshipSignalType[]): number {
  return types.reduce((sum, type) => sum + Number(summary.counts[type] ?? 0), 0);
}

function hasAnySignal(summary: DirectionalSignalSummary): boolean {
  return SIGNAL_TYPES.some((type) => Number(summary.counts[type] ?? 0) > 0);
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
    encounterHistory: [],
  };
}

function buildPairEncounter(
  pair: MutablePairHistory,
  match: PairHistoryMatchInput,
  first: MatchParticipant,
  second: MatchParticipant,
): PairEncounter {
  const oneToTwo = emptySignalSummary();
  const twoToOne = emptySignalSummary();
  for (const signal of match.signals ?? []) {
    const belongsToPair =
      (signal.sourcePlayerId === pair.playerOneId && signal.targetPlayerId === pair.playerTwoId) ||
      (signal.sourcePlayerId === pair.playerTwoId && signal.targetPlayerId === pair.playerOneId);
    if (!belongsToPair) continue;
    if (signal.sourcePlayerId === pair.playerOneId) addSignal(oneToTwo, signal);
    else addSignal(twoToOne, signal);
  }

  const oneSummary = finishSignalSummary(oneToTwo);
  const twoSummary = finishSignalSummary(twoToOne);
  const relation: PairRelation = sameTeam(match.format, first, second) ? "ALLIED" : "OPPOSED";
  const coverage = match.interactionCoverage ?? "UNAVAILABLE";
  const hostile = countSignal(oneSummary, HOSTILE_SIGNAL_TYPES) + countSignal(twoSummary, HOSTILE_SIGNAL_TYPES);
  const cooperation = countSignal(oneSummary, COOPERATION_SIGNAL_TYPES) + countSignal(twoSummary, COOPERATION_SIGNAL_TYPES);
  const anyInteraction = hasAnySignal(oneSummary) || hasAnySignal(twoSummary);

  let interactionState: PairInteractionState;
  if (coverage !== "AVAILABLE") interactionState = "UNKNOWN_COVERAGE";
  else if (relation === "OPPOSED") interactionState = anyInteraction ? "OPPOSED_CONTACT" : "OPPOSED_NO_CONTACT";
  else if (cooperation > 0 && hostile > 0) interactionState = "ALLIED_MIXED";
  else if (hostile > 0) interactionState = "ALLIED_ANTAGONISM";
  else if (cooperation > 0) interactionState = "ALLIED_COOPERATION";
  else interactionState = "ALLIED_NO_COOPERATION";

  const winners = new Set(match.canonicalResult.winningPlayerIds);
  return {
    schemaVersion: PAIR_ENCOUNTER_VERSION,
    pairId: pair.pairId,
    matchId: match.matchId,
    eventId: match.eventId ?? null,
    seasonId: match.seasonId ?? null,
    playedAtMs: match.orderAtMs,
    relation,
    interactionCoverage: coverage,
    interactionState,
    playerOneId: pair.playerOneId,
    playerTwoId: pair.playerTwoId,
    playerOneWon: winners.has(pair.playerOneId),
    playerTwoWon: winners.has(pair.playerTwoId),
    playerOneToPlayerTwo: oneSummary,
    playerTwoToPlayerOne: twoSummary,
  };
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

  pair.encounterHistory.push(buildPairEncounter(pair, match, first, second));
  store.set(pairId, pair);
}

function tracksTouchedForEncounter(encounter: PairEncounter): RelationshipTrack[] {
  const tracks = new Set<RelationshipTrack>();
  for (const pulse of pulsesForEncounter(encounter)) tracks.add(pulse.track);
  return [...tracks];
}

function chronicleEntry(encounter: PairEncounter, first: boolean): PairChronicleEntry {
  const state = encounter.interactionState;
  const copy: Record<PairInteractionState, { kind: ChronicleKind; title: string; text: string }> = {
    OPPOSED_CONTACT: {
      kind: "OPPOSED_CONTACT",
      title: "Across the battlefield",
      text: "They fought on opposing sides and qualifying direct interaction was recorded between them.",
    },
    OPPOSED_NO_CONTACT: {
      kind: "OPPOSED_NO_CONTACT",
      title: "Distant enemies",
      text: "They fought on opposing sides, but no qualifying interaction between them was recorded in the Battle.",
    },
    ALLIED_COOPERATION: {
      kind: "ALLIED_COOPERATION",
      title: "Under one banner",
      text: "They fought as allies and qualifying cooperative action was recorded between them.",
    },
    ALLIED_NO_COOPERATION: {
      kind: "ALLIED_NO_COOPERATION",
      title: "An uneasy alliance",
      text: "They fought as allies, but no qualifying cooperation between them was recorded in the Battle.",
    },
    ALLIED_ANTAGONISM: {
      kind: "ALLIED_ANTAGONISM",
      title: "Fracture under one banner",
      text: "They were allied, yet qualifying antagonistic interaction was recorded between them.",
    },
    ALLIED_MIXED: {
      kind: "ALLIED_MIXED",
      title: "A troubled alliance",
      text: "Both cooperative and antagonistic interaction was recorded while they fought under one banner.",
    },
    UNKNOWN_COVERAGE: {
      kind: "COVERAGE_UNAVAILABLE",
      title: encounter.relation === "ALLIED" ? "Under one banner" : "Across the battlefield",
      text: "They shared the Battle, but interaction evidence is not yet complete enough to judge how they dealt with one another.",
    },
  };
  const selected = first
    ? {
        kind: "FIRST_MEETING" as const,
        title: "First meeting",
        text: encounter.relation === "ALLIED"
          ? "Their recorded history began beneath the same banner."
          : "Their recorded history began on opposing sides.",
      }
    : copy[state];
  return {
    entryId: `${encounter.matchId}:${selected.kind}`,
    matchId: encounter.matchId,
    eventId: encounter.eventId,
    seasonId: encounter.seasonId,
    playedAtMs: encounter.playedAtMs,
    kind: selected.kind,
    title: selected.title,
    text: selected.text,
    relation: encounter.relation,
    actorPlayerIds: [encounter.playerOneId, encounter.playerTwoId],
    tracksTouched: tracksTouchedForEncounter(encounter),
    evidence: {
      playerOneToPlayerTwo: { ...encounter.playerOneToPlayerTwo.counts },
      playerTwoToPlayerOne: { ...encounter.playerTwoToPlayerOne.counts },
    },
  };
}

function finishPair(pair: MutablePairHistory): PairHistory {
  const encounterHistory = [...pair.encounterHistory].sort(
    (left, right) => left.playedAtMs - right.playedAtMs || left.matchId.localeCompare(right.matchId),
  );
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
    encounterHistory,
    chronicle: encounterHistory.map((encounter, index) => chronicleEntry(encounter, index === 0)),
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
      if (!SIGNAL_TYPES.includes(signal.type)) throw new Error(`Unsupported relationship signal type: ${signal.type}.`);
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
    const suffix = type.toLowerCase().replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
    values[`playerOneToPlayerTwo.${suffix}`] = history.playerOneToPlayerTwo.counts[type] ?? 0;
    values[`playerTwoToPlayerOne.${suffix}`] = history.playerTwoToPlayerOne.counts[type] ?? 0;
    values[`combined.${suffix}`] = (history.playerOneToPlayerTwo.counts[type] ?? 0) + (history.playerTwoToPlayerOne.counts[type] ?? 0);
  }

  return Object.entries(values)
    .map(([metricId, value]) => ({ metricId, value }))
    .sort((left, right) => left.metricId.localeCompare(right.metricId));
}

function directionalPulses(
  encounter: PairEncounter,
  types: RelationshipSignalType[],
  track: RelationshipTrack,
  effect: RelationshipPulseEffect,
  reason: RelationshipPulseReason,
  reciprocity: boolean,
  requiresEstablishedBond = false,
): RelationshipPulse[] {
  const result: RelationshipPulse[] = [];
  for (const [source, target, summary] of [
    [encounter.playerOneId, encounter.playerTwoId, encounter.playerOneToPlayerTwo],
    [encounter.playerTwoId, encounter.playerOneId, encounter.playerTwoToPlayerOne],
  ] as const) {
    const units = countSignal(summary, types);
    if (units <= 0) continue;
    result.push({
      pulseId: `${encounter.matchId}:${track}:${reason}:${source}`,
      matchId: encounter.matchId,
      playedAtMs: encounter.playedAtMs,
      track,
      effect,
      reason,
      sourcePlayerId: source,
      targetPlayerId: target,
      units,
      countsTowardReciprocity: reciprocity,
      ...(requiresEstablishedBond ? { requiresEstablishedBond: true } : {}),
    });
  }
  return result;
}

function pulsesForEncounter(encounter: PairEncounter): RelationshipPulse[] {
  if (encounter.interactionCoverage !== "AVAILABLE") return [];
  const pulses: RelationshipPulse[] = [];

  if (encounter.relation === "OPPOSED") {
    pulses.push(...directionalPulses(
      encounter,
      ["DIRECT_ENGAGEMENT"],
      "RIVALRY",
      "STRENGTHEN",
      "DIRECT_CONTEST",
      true,
    ));
    pulses.push(...directionalPulses(
      encounter,
      HOSTILE_SIGNAL_TYPES,
      "HOSTILITY",
      "STRENGTHEN",
      "DIRECTED_HOSTILITY",
      true,
    ));
    pulses.push(...directionalPulses(
      encounter,
      HOSTILE_SIGNAL_TYPES,
      "BOND",
      "WEAKEN",
      "ANTAGONISM_AGAINST_BOND",
      false,
      true,
    ));
    if (encounter.interactionState === "OPPOSED_NO_CONTACT") {
      for (const track of ["RIVALRY", "HOSTILITY"] as const) {
        pulses.push({
          pulseId: `${encounter.matchId}:${track}:OPPOSED_WITHOUT_CONTACT`,
          matchId: encounter.matchId,
          playedAtMs: encounter.playedAtMs,
          track,
          effect: "DORMANT",
          reason: "OPPOSED_WITHOUT_CONTACT",
          sourcePlayerId: null,
          targetPlayerId: null,
          units: 1,
          countsTowardReciprocity: false,
        });
      }
    }
    return pulses;
  }

  const cooperationUnits =
    countSignal(encounter.playerOneToPlayerTwo, COOPERATION_SIGNAL_TYPES) +
    countSignal(encounter.playerTwoToPlayerOne, COOPERATION_SIGNAL_TYPES);
  const hostileUnits =
    countSignal(encounter.playerOneToPlayerTwo, HOSTILE_SIGNAL_TYPES) +
    countSignal(encounter.playerTwoToPlayerOne, HOSTILE_SIGNAL_TYPES);

  pulses.push(...directionalPulses(
    encounter,
    COOPERATION_SIGNAL_TYPES,
    "BOND",
    "STRENGTHEN",
    "ALLIED_COOPERATION",
    true,
  ));

  if (cooperationUnits > 0) {
    pulses.push({
      pulseId: `${encounter.matchId}:HOSTILITY:ALLIED_COOPERATION`,
      matchId: encounter.matchId,
      playedAtMs: encounter.playedAtMs,
      track: "HOSTILITY",
      effect: "WEAKEN",
      reason: "ALLIED_COOPERATION",
      sourcePlayerId: null,
      targetPlayerId: null,
      units: cooperationUnits,
      countsTowardReciprocity: false,
    });
  } else if (hostileUnits === 0) {
    pulses.push({
      pulseId: `${encounter.matchId}:HOSTILITY:ALLIED_WITHOUT_COOPERATION`,
      matchId: encounter.matchId,
      playedAtMs: encounter.playedAtMs,
      track: "HOSTILITY",
      effect: "STRENGTHEN",
      reason: "ALLIED_WITHOUT_COOPERATION",
      sourcePlayerId: null,
      targetPlayerId: null,
      units: 1,
      countsTowardReciprocity: false,
    });
  }

  pulses.push(...directionalPulses(
    encounter,
    HOSTILE_SIGNAL_TYPES,
    "HOSTILITY",
    "STRENGTHEN",
    "DIRECTED_HOSTILITY",
    true,
  ));
  pulses.push(...directionalPulses(
    encounter,
    HOSTILE_SIGNAL_TYPES,
    "BOND",
    "WEAKEN",
    "ANTAGONISM_AGAINST_BOND",
    false,
    true,
  ));
  return pulses;
}

export function deriveRelationshipPulses(history: PairHistory): RelationshipPulse[] {
  return history.encounterHistory
    .flatMap((encounter) => pulsesForEncounter(encounter))
    .sort((left, right) => left.playedAtMs - right.playedAtMs || left.pulseId.localeCompare(right.pulseId));
}

export function validateRelationshipRuleSet(ruleSet: RelationshipRuleSet): RelationshipRuleSet {
  if (!ruleSet.ruleVersion) throw new Error("Relationship ruleVersion is required.");
  if (!Number.isFinite(ruleSet.establishedBondDamageMultiplier) || ruleSet.establishedBondDamageMultiplier < 1) {
    throw new Error("establishedBondDamageMultiplier must be a finite number >= 1.");
  }
  const ruleIds = new Set<string>();
  for (const rule of ruleSet.pulseRules) {
    if (!rule.ruleId) throw new Error("Relationship pulse rules require ruleId.");
    if (ruleIds.has(rule.ruleId)) throw new Error(`Duplicate relationship ruleId: ${rule.ruleId}.`);
    ruleIds.add(rule.ruleId);
    if (!Number.isFinite(rule.pointsPerUnit) || rule.pointsPerUnit < 0) {
      throw new Error(`Rule ${rule.ruleId} pointsPerUnit must be a non-negative finite number.`);
    }
    if (rule.maximumUnitsPerEncounter != null && (!Number.isFinite(rule.maximumUnitsPerEncounter) || rule.maximumUnitsPerEncounter < 0)) {
      throw new Error(`Rule ${rule.ruleId} maximumUnitsPerEncounter must be non-negative when provided.`);
    }
  }

  for (const track of ["RIVALRY", "HOSTILITY", "BOND"] as RelationshipTrack[]) {
    let previous = Number.NEGATIVE_INFINITY;
    const stageIds = new Set<string>();
    for (const [index, stage] of ruleSet.stages[track].entries()) {
      if (!stage.stageId) throw new Error(`${track} stages require stageId.`);
      if (stageIds.has(stage.stageId)) throw new Error(`Duplicate ${track} stageId: ${stage.stageId}.`);
      stageIds.add(stage.stageId);
      if (!Number.isFinite(stage.minimumPoints) || stage.minimumPoints < previous) {
        throw new Error(`${track} stages must be ordered by non-decreasing minimumPoints.`);
      }
      previous = stage.minimumPoints;
      for (const [field, value] of [
        ["minimumContributingEncounters", stage.minimumContributingEncounters],
        ["minimumDirectionalPoints", stage.minimumDirectionalPoints],
        ["minimumReciprocalEncounters", stage.minimumReciprocalEncounters],
      ] as const) {
        if (value != null && (!Number.isFinite(value) || value < 0)) {
          throw new Error(`${track} stage ${stage.stageId} ${field} must be non-negative when provided.`);
        }
      }
      if (index >= 2 && stage.minimumDirectionalPoints === 0) {
        throw new Error(`${track} stage ${stage.stageId} cannot disable the level-three reciprocity gate.`);
      }
    }
  }

  return {
    ruleVersion: ruleSet.ruleVersion,
    pulseRules: ruleSet.pulseRules.map((rule) => ({ ...rule })),
    stages: {
      RIVALRY: ruleSet.stages.RIVALRY.map((stage) => ({ ...stage })),
      HOSTILITY: ruleSet.stages.HOSTILITY.map((stage) => ({ ...stage })),
      BOND: ruleSet.stages.BOND.map((stage) => ({ ...stage })),
    },
    establishedBondDamageMultiplier: ruleSet.establishedBondDamageMultiplier,
  };
}

interface RuntimeTrackState {
  points: number;
  directionalPoints: Record<string, number>;
  contributingEncounterIds: Set<string>;
  reciprocalEncounterIds: Record<string, Set<string>>;
  dormant: boolean;
  lastStrengthenedAtMs: number | null;
  peakStageIndex: number;
}

function runtimeTrack(history: PairHistory): RuntimeTrackState {
  return {
    points: 0,
    directionalPoints: { [history.playerOneId]: 0, [history.playerTwoId]: 0 },
    contributingEncounterIds: new Set<string>(),
    reciprocalEncounterIds: {
      [history.playerOneId]: new Set<string>(),
      [history.playerTwoId]: new Set<string>(),
    },
    dormant: false,
    lastStrengthenedAtMs: null,
    peakStageIndex: -1,
  };
}

function stageIndexForState(
  track: RelationshipTrack,
  state: RuntimeTrackState,
  history: PairHistory,
  ruleSet: RelationshipRuleSet,
): number {
  let eligibleIndex = -1;
  for (const [index, stage] of ruleSet.stages[track].entries()) {
    if (state.points < stage.minimumPoints) continue;
    if (state.contributingEncounterIds.size < Number(stage.minimumContributingEncounters ?? 0)) continue;
    if (index >= 2) {
      const minimumDirectional = Math.max(1, Number(stage.minimumDirectionalPoints ?? 1));
      const minimumReciprocalEncounters = Math.max(1, Number(stage.minimumReciprocalEncounters ?? 1));
      if (state.directionalPoints[history.playerOneId] < minimumDirectional) continue;
      if (state.directionalPoints[history.playerTwoId] < minimumDirectional) continue;
      if (state.reciprocalEncounterIds[history.playerOneId].size < minimumReciprocalEncounters) continue;
      if (state.reciprocalEncounterIds[history.playerTwoId].size < minimumReciprocalEncounters) continue;
    }
    eligibleIndex = index;
  }
  return eligibleIndex;
}

function establishedBond(state: RuntimeTrackState, ruleSet: RelationshipRuleSet): boolean {
  const firstStage = ruleSet.stages.BOND[0];
  return firstStage != null && state.points >= firstStage.minimumPoints;
}

function pulseRule(ruleSet: RelationshipRuleSet, pulse: RelationshipPulse): RelationshipPulseRule | null {
  return ruleSet.pulseRules.find((rule) => rule.track === pulse.track && rule.reason === pulse.reason) ?? null;
}

function emptyConfiguredTrack(track: RelationshipTrack, history: PairHistory): RelationshipTrackProjection {
  return {
    track,
    status: "READY",
    state: "UNESTABLISHED",
    points: 0,
    directionalPoints: { [history.playerOneId]: 0, [history.playerTwoId]: 0 },
    stageId: null,
    historicalPeakStageId: null,
    lastStrengthenedAtMs: null,
    contributingEncounterIds: [],
    reciprocalEncounterIds: { [history.playerOneId]: [], [history.playerTwoId]: [] },
    contributions: [],
  };
}

function unconfiguredTrack(track: RelationshipTrack, history: PairHistory): RelationshipTrackProjection {
  return {
    ...emptyConfiguredTrack(track, history),
    status: "UNCONFIGURED",
    points: null,
  };
}

function evaluateConfiguredRelationship(
  history: PairHistory,
  pulses: RelationshipPulse[],
  ruleSet: RelationshipRuleSet,
): Record<RelationshipTrack, RelationshipTrackProjection> {
  const states: Record<RelationshipTrack, RuntimeTrackState> = {
    RIVALRY: runtimeTrack(history),
    HOSTILITY: runtimeTrack(history),
    BOND: runtimeTrack(history),
  };
  const contributions: Record<RelationshipTrack, RelationshipPulseContribution[]> = {
    RIVALRY: [],
    HOSTILITY: [],
    BOND: [],
  };

  for (const pulse of pulses) {
    const state = states[pulse.track];
    if (pulse.effect === "DORMANT") {
      if (pulse.track !== "BOND" && state.points > 0) state.dormant = true;
      continue;
    }
    const rule = pulseRule(ruleSet, pulse);
    if (!rule) continue;
    const appliedUnits = rule.maximumUnitsPerEncounter == null
      ? pulse.units
      : Math.min(pulse.units, rule.maximumUnitsPerEncounter);
    let multiplier = 1;
    if (pulse.requiresEstablishedBond && establishedBond(states.BOND, ruleSet)) {
      multiplier = ruleSet.establishedBondDamageMultiplier;
    }
    const magnitude = appliedUnits * rule.pointsPerUnit * multiplier;
    const signed = pulse.effect === "STRENGTHEN" ? magnitude : -magnitude;
    const before = state.points;
    state.points = Math.max(0, state.points + signed);
    const appliedPoints = state.points - before;

    if (pulse.sourcePlayerId) {
      const current = state.directionalPoints[pulse.sourcePlayerId] ?? 0;
      state.directionalPoints[pulse.sourcePlayerId] = Math.max(0, current + appliedPoints);
    } else if (pulse.effect === "WEAKEN" && appliedPoints < 0) {
      const half = Math.abs(appliedPoints) / 2;
      for (const playerId of [history.playerOneId, history.playerTwoId]) {
        state.directionalPoints[playerId] = Math.max(0, (state.directionalPoints[playerId] ?? 0) - half);
      }
    }

    if (pulse.effect === "STRENGTHEN" && appliedPoints > 0) {
      state.contributingEncounterIds.add(pulse.matchId);
      state.dormant = false;
      state.lastStrengthenedAtMs = pulse.playedAtMs;
      if (pulse.countsTowardReciprocity && pulse.sourcePlayerId) {
        state.reciprocalEncounterIds[pulse.sourcePlayerId].add(pulse.matchId);
      }
    }

    contributions[pulse.track].push({
      pulseId: pulse.pulseId,
      ruleId: rule.ruleId,
      matchId: pulse.matchId,
      track: pulse.track,
      effect: pulse.effect,
      reason: pulse.reason,
      sourcePlayerId: pulse.sourcePlayerId,
      targetPlayerId: pulse.targetPlayerId,
      observedUnits: pulse.units,
      appliedUnits,
      points: appliedPoints,
      establishedBondMultiplierApplied: multiplier,
    });

    for (const track of ["RIVALRY", "HOSTILITY", "BOND"] as RelationshipTrack[]) {
      const currentStageIndex = stageIndexForState(track, states[track], history, ruleSet);
      states[track].peakStageIndex = Math.max(states[track].peakStageIndex, currentStageIndex);
    }
  }

  const result = {} as Record<RelationshipTrack, RelationshipTrackProjection>;
  for (const track of ["RIVALRY", "HOSTILITY", "BOND"] as RelationshipTrack[]) {
    const state = states[track];
    const stageIndex = stageIndexForState(track, state, history, ruleSet);
    const stageId = stageIndex >= 0 ? ruleSet.stages[track][stageIndex]?.stageId ?? null : null;
    const peakStageId = state.peakStageIndex >= 0 ? ruleSet.stages[track][state.peakStageIndex]?.stageId ?? null : null;
    result[track] = {
      track,
      status: "READY",
      state: stageId == null ? "UNESTABLISHED" : state.dormant && track !== "BOND" ? "DORMANT" : "ACTIVE",
      points: state.points,
      directionalPoints: { ...state.directionalPoints },
      stageId,
      historicalPeakStageId: peakStageId,
      lastStrengthenedAtMs: state.lastStrengthenedAtMs,
      contributingEncounterIds: [...state.contributingEncounterIds].sort(),
      reciprocalEncounterIds: {
        [history.playerOneId]: [...state.reciprocalEncounterIds[history.playerOneId]].sort(),
        [history.playerTwoId]: [...state.reciprocalEncounterIds[history.playerTwoId]].sort(),
      },
      contributions: contributions[track],
    };
  }
  return result;
}

export function evaluateRelationship(
  history: PairHistory,
  ruleSetInput: RelationshipRuleSet | null,
): RelationshipProjection {
  const pulses = deriveRelationshipPulses(history);
  if (!ruleSetInput) {
    return {
      engineVersion: RELATIONSHIP_ENGINE_VERSION,
      ruleVersion: null,
      pairHistoryVersion: PAIR_HISTORY_VERSION,
      pairId: history.pairId,
      playerOneId: history.playerOneId,
      playerTwoId: history.playerTwoId,
      pulses,
      rivalry: unconfiguredTrack("RIVALRY", history),
      hostility: unconfiguredTrack("HOSTILITY", history),
      bond: unconfiguredTrack("BOND", history),
    };
  }

  const ruleSet = validateRelationshipRuleSet(ruleSetInput);
  const tracks = evaluateConfiguredRelationship(history, pulses, ruleSet);
  return {
    engineVersion: RELATIONSHIP_ENGINE_VERSION,
    ruleVersion: ruleSet.ruleVersion,
    pairHistoryVersion: PAIR_HISTORY_VERSION,
    pairId: history.pairId,
    playerOneId: history.playerOneId,
    playerTwoId: history.playerTwoId,
    pulses,
    rivalry: tracks.RIVALRY,
    hostility: tracks.HOSTILITY,
    bond: tracks.BOND,
  };
}
