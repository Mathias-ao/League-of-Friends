import type { DiplomacyTimeline, PairDiplomacyState } from "./diplomacyTimeline.js";
import type { PairSocialBeat, PairSocialEvidence, PairSocialBeatType } from "./pairSocialEvidence.js";

export const CHRONICLE_EVENT_VERSION = "AOF_CHRONICLE_EVENT_V1";

export type ChronicleSignificance = "RECORD" | "NOTABLE" | "LANDMARK" | "TURNING_POINT";
export type ChronicleAlignmentSummary = "ALLIANCE" | "HOSTILITY" | "NEUTRALITY" | "MIXED" | "UNKNOWN";
export type ChronicleTrack = "RIVALRY" | "HOSTILITY" | "BOND";
export type ChronicleRelationshipTransitionKind =
  | "ESTABLISHED"
  | "STAGE_ADVANCED"
  | "HISTORICAL_PEAK"
  | "DORMANT"
  | "REACTIVATED"
  | "WEAKENED";

export interface ChronicleRelationshipTransition {
  track: ChronicleTrack;
  kind: ChronicleRelationshipTransitionKind;
  beforeStageId: string | null;
  afterStageId: string | null;
  sourceBeatIds: string[];
}

export type ChronicleConcept =
  | "FIRST_MEETING"
  | "REPEAT_MEETING"
  | "MUTUAL_ALLIANCE_PRESENT"
  | "MUTUAL_HOSTILITY_PRESENT"
  | "MUTUAL_NEUTRALITY_PRESENT"
  | "MIXED_DIPLOMACY"
  | "MUTUAL_ALLIANCE_FORMED"
  | "MUTUAL_ALLIANCE_ENDED"
  | "ONE_SIDED_ALLIANCE"
  | "CONFLICTED_DIPLOMACY"
  | "DIRECT_CONTEST"
  | "RAID_PRESSURE"
  | "FORWARD_ENCROACHMENT"
  | "ENEMY_BASE_CONTACT"
  | "MATERIAL_SUPPORT"
  | "ALLY_REINFORCEMENT"
  | "DEFENSIVE_ASSIST"
  | "COOPERATIVE_ATTACK"
  | "COINCIDENT_THIRD_PARTY_PRESSURE"
  | "NO_QUALIFYING_OPPOSITION_CONTACT"
  | "NO_QUALIFYING_ALLIED_COOPERATION"
  | "FIRST_MUTUAL_ALLIANCE"
  | "FIRST_RECORDED_COOPERATION"
  | "FIRST_RECORDED_PRESSURE"
  | "PREVIOUS_MEETING_ALLIED"
  | "PREVIOUS_MEETING_HOSTILE"
  | "PREVIOUS_MEETING_MIXED"
  | "RELATIONSHIP_ESTABLISHED"
  | "RELATIONSHIP_ADVANCED"
  | "RELATIONSHIP_DORMANT"
  | "RELATIONSHIP_REACTIVATED"
  | "RELATIONSHIP_WEAKENED";

export type ChronicleTitleKey =
  | "FIRST_MEETING"
  | "ALLIANCE_AND_RUPTURE"
  | "ALLIANCE_FORMED"
  | "ALLIANCE_UNDER_STRAIN"
  | "CONTEST"
  | "PRESSURE"
  | "COOPERATION"
  | "DIPLOMATIC_SHIFT"
  | "QUIET_OPPOSITION"
  | "RELATIONSHIP_TURNING_POINT"
  | "RECORDED_MEETING";

export interface ChronicleEvent {
  schemaVersion: typeof CHRONICLE_EVENT_VERSION;
  eventId: string;
  matchId: string;
  leagueEventId: string | null;
  seasonId: string | null;
  playedAtMs: number;
  playerOneId: number;
  playerTwoId: number;
  encounterNumber: number;
  significance: ChronicleSignificance;
  titleKey: ChronicleTitleKey;
  alignment: ChronicleAlignmentSummary;
  concepts: ChronicleConcept[];
  primaryBeatIds: string[];
  sourceBeatIds: string[];
  sourceEvidenceEventIds: string[];
  relationshipTransitions: ChronicleRelationshipTransition[];
  storyFacts: {
    opposedMeetingCountBefore: number;
    alliedMeetingCountBefore: number;
    previousAlignment: ChronicleAlignmentSummary | null;
    mutualAllianceFormationsThisBattle: number;
    mutualAllianceEndingsThisBattle: number;
    substantiveBeatCount: number;
  };
}

export interface ChronicleBattleInput {
  matchId: string;
  leagueEventId?: string | null;
  seasonId?: string | null;
  playedAtMs: number;
  socialEvidence: PairSocialEvidence;
  diplomacyTimeline: DiplomacyTimeline;
  relationshipTransitions?: ChronicleRelationshipTransition[];
}

const COOPERATION_TYPES = new Set<PairSocialBeatType>([
  "MATERIAL_SUPPORT",
  "ALLY_REINFORCEMENT",
  "DEFENSIVE_ASSIST",
  "COOPERATIVE_ATTACK",
]);

const PRESSURE_TYPES = new Set<PairSocialBeatType>([
  "DIRECT_CONTEST",
  "RAID_PRESSURE",
  "FORWARD_ENCROACHMENT",
  "ENEMY_BASE_CONTACT",
]);

const SUBSTANTIVE_TYPES = new Set<PairSocialBeatType>([
  ...COOPERATION_TYPES,
  ...PRESSURE_TYPES,
  "MUTUAL_ALLIANCE_FORMED",
  "MUTUAL_ALLIANCE_ENDED",
  "ONE_SIDED_ALLIANCE_BEGAN",
  "CONFLICTED_DIPLOMACY_BEGAN",
  "COINCIDENT_THIRD_PARTY_PRESSURE",
  "NO_QUALIFYING_OPPOSITION_CONTACT",
  "NO_QUALIFYING_ALLIED_COOPERATION",
]);

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function sortedPair(a: number, b: number): [number, number] {
  return a < b ? [a, b] : [b, a];
}

function pairStatesForBattle(input: ChronicleBattleInput): PairDiplomacyState[] {
  const [one, two] = sortedPair(input.socialEvidence.playerOneId, input.socialEvidence.playerTwoId);
  return input.diplomacyTimeline.pairSegments
    .filter((segment) => segment.playerOneId === one && segment.playerTwoId === two && segment.endMs > segment.startMs)
    .map((segment) => segment.state);
}

export function summarizeBattleAlignment(states: PairDiplomacyState[]): ChronicleAlignmentSummary {
  const known = new Set(states.filter((state) => state !== "UNKNOWN"));
  if (!known.size) return "UNKNOWN";
  const hasAlliance = [...known].some((state) => state === "MUTUAL_ALLIANCE" || state === "ONE_SIDED_ALLIANCE");
  const hasHostility = [...known].some((state) => state === "MUTUAL_HOSTILITY" || state === "ONE_SIDED_HOSTILITY" || state === "CONFLICTED");
  const hasNeutral = known.has("MUTUAL_NEUTRALITY");
  const families = Number(hasAlliance) + Number(hasHostility) + Number(hasNeutral);
  if (families > 1 || known.has("CONFLICTED")) return "MIXED";
  if (hasAlliance) return "ALLIANCE";
  if (hasHostility) return "HOSTILITY";
  if (hasNeutral) return "NEUTRALITY";
  return "UNKNOWN";
}

function conceptsForBeats(beats: PairSocialBeat[]): ChronicleConcept[] {
  const concepts: ChronicleConcept[] = [];
  for (const beat of beats) {
    const mapped: Partial<Record<PairSocialBeatType, ChronicleConcept>> = {
      MUTUAL_ALLIANCE_FORMED: "MUTUAL_ALLIANCE_FORMED",
      MUTUAL_ALLIANCE_ENDED: "MUTUAL_ALLIANCE_ENDED",
      ONE_SIDED_ALLIANCE_BEGAN: "ONE_SIDED_ALLIANCE",
      CONFLICTED_DIPLOMACY_BEGAN: "CONFLICTED_DIPLOMACY",
      DIRECT_CONTEST: "DIRECT_CONTEST",
      RAID_PRESSURE: "RAID_PRESSURE",
      FORWARD_ENCROACHMENT: "FORWARD_ENCROACHMENT",
      ENEMY_BASE_CONTACT: "ENEMY_BASE_CONTACT",
      MATERIAL_SUPPORT: "MATERIAL_SUPPORT",
      ALLY_REINFORCEMENT: "ALLY_REINFORCEMENT",
      DEFENSIVE_ASSIST: "DEFENSIVE_ASSIST",
      COOPERATIVE_ATTACK: "COOPERATIVE_ATTACK",
      COINCIDENT_THIRD_PARTY_PRESSURE: "COINCIDENT_THIRD_PARTY_PRESSURE",
      NO_QUALIFYING_OPPOSITION_CONTACT: "NO_QUALIFYING_OPPOSITION_CONTACT",
      NO_QUALIFYING_ALLIED_COOPERATION: "NO_QUALIFYING_ALLIED_COOPERATION",
    };
    const concept = mapped[beat.type];
    if (concept) concepts.push(concept);
  }
  return unique(concepts);
}

function conceptsForRelationshipTransitions(transitions: ChronicleRelationshipTransition[]): ChronicleConcept[] {
  return unique(transitions.map((transition): ChronicleConcept => {
    if (transition.kind === "ESTABLISHED") return "RELATIONSHIP_ESTABLISHED";
    if (transition.kind === "STAGE_ADVANCED" || transition.kind === "HISTORICAL_PEAK") return "RELATIONSHIP_ADVANCED";
    if (transition.kind === "DORMANT") return "RELATIONSHIP_DORMANT";
    if (transition.kind === "REACTIVATED") return "RELATIONSHIP_REACTIVATED";
    return "RELATIONSHIP_WEAKENED";
  }));
}

function significanceFor(
  encounterNumber: number,
  concepts: ChronicleConcept[],
  transitions: ChronicleRelationshipTransition[],
): ChronicleSignificance {
  const has = (concept: ChronicleConcept) => concepts.includes(concept);
  if (
    transitions.some((transition) => ["ESTABLISHED", "STAGE_ADVANCED", "HISTORICAL_PEAK", "DORMANT", "REACTIVATED"].includes(transition.kind)) ||
    (has("MUTUAL_ALLIANCE_FORMED") && has("MUTUAL_ALLIANCE_ENDED")) ||
    (has("MUTUAL_ALLIANCE_ENDED") && (has("DIRECT_CONTEST") || has("RAID_PRESSURE")))
  ) return "TURNING_POINT";
  if (
    encounterNumber === 1 ||
    has("FIRST_MUTUAL_ALLIANCE") ||
    has("FIRST_RECORDED_COOPERATION") ||
    has("FIRST_RECORDED_PRESSURE") ||
    has("MUTUAL_ALLIANCE_FORMED") ||
    has("CONFLICTED_DIPLOMACY")
  ) return "LANDMARK";
  if (concepts.some((concept) => !["REPEAT_MEETING", "MUTUAL_HOSTILITY_PRESENT", "MUTUAL_ALLIANCE_PRESENT", "MUTUAL_NEUTRALITY_PRESENT"].includes(concept))) {
    return "NOTABLE";
  }
  return "RECORD";
}

function titleFor(concepts: ChronicleConcept[], transitions: ChronicleRelationshipTransition[]): ChronicleTitleKey {
  const has = (concept: ChronicleConcept) => concepts.includes(concept);
  if (has("FIRST_MEETING")) return "FIRST_MEETING";
  if (transitions.length > 0) return "RELATIONSHIP_TURNING_POINT";
  if (has("MUTUAL_ALLIANCE_FORMED") && has("MUTUAL_ALLIANCE_ENDED")) return "ALLIANCE_AND_RUPTURE";
  if (has("MUTUAL_ALLIANCE_ENDED") && (has("DIRECT_CONTEST") || has("RAID_PRESSURE"))) return "ALLIANCE_UNDER_STRAIN";
  if (has("MUTUAL_ALLIANCE_FORMED")) return "ALLIANCE_FORMED";
  if (has("DEFENSIVE_ASSIST") || has("ALLY_REINFORCEMENT") || has("COOPERATIVE_ATTACK") || has("MATERIAL_SUPPORT")) return "COOPERATION";
  if (has("RAID_PRESSURE") || has("FORWARD_ENCROACHMENT") || has("ENEMY_BASE_CONTACT")) return "PRESSURE";
  if (has("DIRECT_CONTEST")) return "CONTEST";
  if (has("NO_QUALIFYING_OPPOSITION_CONTACT")) return "QUIET_OPPOSITION";
  if (has("ONE_SIDED_ALLIANCE") || has("CONFLICTED_DIPLOMACY")) return "DIPLOMATIC_SHIFT";
  return "RECORDED_MEETING";
}

function primaryBeatIds(beats: PairSocialBeat[], significance: ChronicleSignificance): string[] {
  const meaningful = beats.filter((beat) => SUBSTANTIVE_TYPES.has(beat.type));
  const maximum = significance === "TURNING_POINT" ? 6 : significance === "LANDMARK" ? 4 : significance === "NOTABLE" ? 3 : 1;
  return meaningful.slice(0, maximum).map((beat) => beat.beatId);
}

export function buildChronicleEvents(inputs: ChronicleBattleInput[]): ChronicleEvent[] {
  const ordered = [...inputs].sort((left, right) => left.playedAtMs - right.playedAtMs || left.matchId.localeCompare(right.matchId));
  const result: ChronicleEvent[] = [];
  let seenMutualAlliance = false;
  let seenCooperation = false;
  let seenPressure = false;
  let alliedMeetingCount = 0;
  let opposedMeetingCount = 0;
  let previousAlignment: ChronicleAlignmentSummary | null = null;

  for (const [index, input] of ordered.entries()) {
    if (input.socialEvidence.matchId !== input.matchId) throw new Error(`Chronicle input ${input.matchId} has mismatched Pair Social Evidence.`);
    if (input.socialEvidence.durationMs !== input.diplomacyTimeline.durationMs) throw new Error(`Chronicle input ${input.matchId} has mismatched diplomacy duration.`);
    if (!Number.isFinite(input.playedAtMs) || input.playedAtMs < 0) throw new Error(`Chronicle input ${input.matchId} playedAtMs is invalid.`);
    if (result.length > 0) {
      const previous = result[result.length - 1];
      if (previous.playerOneId !== input.socialEvidence.playerOneId || previous.playerTwoId !== input.socialEvidence.playerTwoId) {
        throw new Error("buildChronicleEvents accepts one stable unordered pair at a time.");
      }
    }

    const states = pairStatesForBattle(input);
    const alignment = summarizeBattleAlignment(states);
    const beats = input.socialEvidence.beats;
    const transitions = input.relationshipTransitions ?? [];
    const concepts: ChronicleConcept[] = [index === 0 ? "FIRST_MEETING" : "REPEAT_MEETING"];

    if (states.includes("MUTUAL_ALLIANCE")) concepts.push("MUTUAL_ALLIANCE_PRESENT");
    if (states.some((state) => state === "MUTUAL_HOSTILITY" || state === "ONE_SIDED_HOSTILITY" || state === "CONFLICTED")) concepts.push("MUTUAL_HOSTILITY_PRESENT");
    if (states.includes("MUTUAL_NEUTRALITY")) concepts.push("MUTUAL_NEUTRALITY_PRESENT");
    if (alignment === "MIXED") concepts.push("MIXED_DIPLOMACY");
    concepts.push(...conceptsForBeats(beats));
    concepts.push(...conceptsForRelationshipTransitions(transitions));

    const hasMutualAlliance = states.includes("MUTUAL_ALLIANCE");
    const hasCooperation = beats.some((beat) => COOPERATION_TYPES.has(beat.type));
    const hasPressure = beats.some((beat) => PRESSURE_TYPES.has(beat.type));
    if (hasMutualAlliance && !seenMutualAlliance) concepts.push("FIRST_MUTUAL_ALLIANCE");
    if (hasCooperation && !seenCooperation) concepts.push("FIRST_RECORDED_COOPERATION");
    if (hasPressure && !seenPressure) concepts.push("FIRST_RECORDED_PRESSURE");
    if (previousAlignment === "ALLIANCE") concepts.push("PREVIOUS_MEETING_ALLIED");
    else if (previousAlignment === "HOSTILITY") concepts.push("PREVIOUS_MEETING_HOSTILE");
    else if (previousAlignment === "MIXED") concepts.push("PREVIOUS_MEETING_MIXED");

    const uniqueConcepts = unique(concepts);
    const encounterNumber = index + 1;
    const significance = significanceFor(encounterNumber, uniqueConcepts, transitions);
    const sourceBeatIds = beats.map((beat) => beat.beatId);
    const sourceEvidenceEventIds = unique(beats.flatMap((beat) => beat.evidenceEventIds)).sort((a, b) => a.localeCompare(b));
    const formed = beats.filter((beat) => beat.type === "MUTUAL_ALLIANCE_FORMED").length;
    const ended = beats.filter((beat) => beat.type === "MUTUAL_ALLIANCE_ENDED").length;
    const substantiveBeatCount = beats.filter((beat) => SUBSTANTIVE_TYPES.has(beat.type)).length;

    result.push({
      schemaVersion: CHRONICLE_EVENT_VERSION,
      eventId: `${input.matchId}:chronicle:${CHRONICLE_EVENT_VERSION}`,
      matchId: input.matchId,
      leagueEventId: input.leagueEventId ?? null,
      seasonId: input.seasonId ?? null,
      playedAtMs: Math.trunc(input.playedAtMs),
      playerOneId: input.socialEvidence.playerOneId,
      playerTwoId: input.socialEvidence.playerTwoId,
      encounterNumber,
      significance,
      titleKey: titleFor(uniqueConcepts, transitions),
      alignment,
      concepts: uniqueConcepts,
      primaryBeatIds: primaryBeatIds(beats, significance),
      sourceBeatIds,
      sourceEvidenceEventIds,
      relationshipTransitions: transitions.map((transition) => ({ ...transition, sourceBeatIds: [...transition.sourceBeatIds] })),
      storyFacts: {
        opposedMeetingCountBefore: opposedMeetingCount,
        alliedMeetingCountBefore: alliedMeetingCount,
        previousAlignment,
        mutualAllianceFormationsThisBattle: formed,
        mutualAllianceEndingsThisBattle: ended,
        substantiveBeatCount,
      },
    });

    if (alignment === "ALLIANCE") alliedMeetingCount += 1;
    if (alignment === "HOSTILITY") opposedMeetingCount += 1;
    seenMutualAlliance ||= hasMutualAlliance;
    seenCooperation ||= hasCooperation;
    seenPressure ||= hasPressure;
    previousAlignment = alignment;
  }

  return result;
}
