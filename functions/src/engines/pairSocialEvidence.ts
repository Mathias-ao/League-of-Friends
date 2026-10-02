import {
  type DiplomacyStance,
  type DiplomacyTimeline,
  type PairDiplomacyState,
  diplomacyAt,
  pairDiplomacyAt,
} from "./diplomacyTimeline.js";

export const PAIR_SOCIAL_EVIDENCE_VERSION = "AOF_PAIR_SOCIAL_EVIDENCE_V1";

export type EvidenceFamilyCoverage = "QUALIFIED" | "NOT_APPLICABLE" | "UNAVAILABLE";
export type SocialEvidenceConfidence = "EXACT" | "HIGH" | "MEDIUM" | "LOW";

export interface PairSocialCoverage {
  diplomacy: EvidenceFamilyCoverage;
  oppositionInteraction: EvidenceFamilyCoverage;
  alliedCooperation: EvidenceFamilyCoverage;
  economicTransfer: EvidenceFamilyCoverage;
  spatialPressure: EvidenceFamilyCoverage;
  communication: EvidenceFamilyCoverage;
}

export type PairObservationType =
  | "DIRECT_ENGAGEMENT"
  | "RAID_PRESSURE"
  | "FORWARD_ENCROACHMENT"
  | "ENEMY_BASE_CONTACT"
  | "MATERIAL_SUPPORT"
  | "ALLY_REINFORCEMENT"
  | "DEFENSIVE_ASSIST"
  | "COOPERATIVE_ATTACK"
  | "FLARE_SIGNAL";

export interface PairSocialObservation {
  observationId: string;
  type: PairObservationType;
  startMs: number;
  endMs: number;
  sourcePlayerId: number;
  targetPlayerId: number;
  thirdPartyPlayerId?: number | null;
  units: number;
  confidence: SocialEvidenceConfidence;
  sourceVersion: string;
  evidenceEventIds: string[];
  metadata?: Record<string, number | string | boolean | null>;
}

export type PairOpportunityKind = "OPPOSITION_CONTACT" | "ALLIED_COOPERATION";

export interface PairInteractionOpportunity {
  opportunityId: string;
  kind: PairOpportunityKind;
  startMs: number;
  endMs: number;
  playerOneId: number;
  playerTwoId: number;
  sourceVersion: string;
  evidenceEventIds: string[];
}

export interface ThirdPartyPressureObservation {
  episodeId: string;
  startMs: number;
  endMs: number;
  playerOneId: number;
  playerTwoId: number;
  targetPlayerId: number;
  sourceVersion: string;
  evidenceEventIds: string[];
  confidence: SocialEvidenceConfidence;
}

export type PairSocialBeatType =
  | "DIPLOMACY_STANCE_CHANGED"
  | "MUTUAL_ALLIANCE_FORMED"
  | "MUTUAL_ALLIANCE_ENDED"
  | "ONE_SIDED_ALLIANCE_BEGAN"
  | "CONFLICTED_DIPLOMACY_BEGAN"
  | "DIRECT_CONTEST"
  | "RAID_PRESSURE"
  | "FORWARD_ENCROACHMENT"
  | "ENEMY_BASE_CONTACT"
  | "MATERIAL_SUPPORT"
  | "ALLY_REINFORCEMENT"
  | "DEFENSIVE_ASSIST"
  | "COOPERATIVE_ATTACK"
  | "FLARE_SIGNAL"
  | "COINCIDENT_THIRD_PARTY_PRESSURE"
  | "NO_QUALIFYING_OPPOSITION_CONTACT"
  | "NO_QUALIFYING_ALLIED_COOPERATION";

export interface PairDiplomacySnapshot {
  sourceToTarget: DiplomacyStance;
  targetToSource: DiplomacyStance;
  pairState: PairDiplomacyState;
}

export interface PairSocialBeat {
  beatId: string;
  type: PairSocialBeatType;
  startMs: number;
  endMs: number;
  sourcePlayerId: number | null;
  targetPlayerId: number | null;
  thirdPartyPlayerId: number | null;
  units: number;
  confidence: SocialEvidenceConfidence;
  sourceVersion: string;
  evidenceEventIds: string[];
  diplomacy: PairDiplomacySnapshot | null;
  metadata: Record<string, number | string | boolean | null>;
}

export interface PairSocialEvidence {
  schemaVersion: typeof PAIR_SOCIAL_EVIDENCE_VERSION;
  matchId: string;
  playerOneId: number;
  playerTwoId: number;
  durationMs: number;
  coverage: PairSocialCoverage;
  opportunities: PairInteractionOpportunity[];
  beats: PairSocialBeat[];
  diagnostics: {
    observationCount: number;
    opportunityCount: number;
    thirdPartyEpisodeCount: number;
    absenceBeatCount: number;
  };
}

const OBSERVATION_TO_BEAT: Record<PairObservationType, PairSocialBeatType> = {
  DIRECT_ENGAGEMENT: "DIRECT_CONTEST",
  RAID_PRESSURE: "RAID_PRESSURE",
  FORWARD_ENCROACHMENT: "FORWARD_ENCROACHMENT",
  ENEMY_BASE_CONTACT: "ENEMY_BASE_CONTACT",
  MATERIAL_SUPPORT: "MATERIAL_SUPPORT",
  ALLY_REINFORCEMENT: "ALLY_REINFORCEMENT",
  DEFENSIVE_ASSIST: "DEFENSIVE_ASSIST",
  COOPERATIVE_ATTACK: "COOPERATIVE_ATTACK",
  FLARE_SIGNAL: "FLARE_SIGNAL",
};

const COOPERATION_BEATS = new Set<PairSocialBeatType>([
  "MATERIAL_SUPPORT",
  "ALLY_REINFORCEMENT",
  "DEFENSIVE_ASSIST",
  "COOPERATIVE_ATTACK",
]);

const OPPOSITION_BEATS = new Set<PairSocialBeatType>([
  "DIRECT_CONTEST",
  "RAID_PRESSURE",
  "FORWARD_ENCROACHMENT",
  "ENEMY_BASE_CONTACT",
]);

function sortedPair(playerA: number, playerB: number): [number, number] {
  return playerA < playerB ? [playerA, playerB] : [playerB, playerA];
}

function assertPlayer(playerId: number, roster: Set<number>, label: string): void {
  if (!Number.isInteger(playerId) || playerId <= 0 || !roster.has(playerId)) {
    throw new Error(`${label} references a player outside the Battle roster.`);
  }
}

function assertWindow(startMs: number, endMs: number, durationMs: number, label: string): void {
  if (
    !Number.isFinite(startMs) ||
    !Number.isFinite(endMs) ||
    startMs < 0 ||
    endMs < startMs ||
    endMs > durationMs
  ) {
    throw new Error(`${label} has an invalid Battle-time window.`);
  }
}

function overlaps(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA <= endB && startB <= endA;
}

function diplomacySnapshot(
  timeline: DiplomacyTimeline,
  sourcePlayerId: number,
  targetPlayerId: number,
  atMs: number,
): PairDiplomacySnapshot {
  return {
    sourceToTarget: diplomacyAt(timeline, sourcePlayerId, targetPlayerId, atMs),
    targetToSource: diplomacyAt(timeline, targetPlayerId, sourcePlayerId, atMs),
    pairState: pairDiplomacyAt(timeline, sourcePlayerId, targetPlayerId, atMs),
  };
}

function pairSegmentFor(timeline: DiplomacyTimeline, playerOneId: number, playerTwoId: number) {
  const [one, two] = sortedPair(playerOneId, playerTwoId);
  return timeline.pairSegments
    .filter((segment) => segment.playerOneId === one && segment.playerTwoId === two)
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
}

function diplomacyBeats(
  timeline: DiplomacyTimeline,
  playerOneId: number,
  playerTwoId: number,
): PairSocialBeat[] {
  const pair = new Set([playerOneId, playerTwoId]);
  const beats: PairSocialBeat[] = [];

  for (const change of timeline.changes) {
    if (!change.changed || !pair.has(change.fromPlayerId) || !pair.has(change.toPlayerId)) continue;
    beats.push({
      beatId: `diplomacy:${change.eventId}`,
      type: "DIPLOMACY_STANCE_CHANGED",
      startMs: change.atMs,
      endMs: change.atMs,
      sourcePlayerId: change.fromPlayerId,
      targetPlayerId: change.toPlayerId,
      thirdPartyPlayerId: null,
      units: 1,
      confidence: change.stance === "UNKNOWN" ? "LOW" : "EXACT",
      sourceVersion: change.sourceVersion,
      evidenceEventIds: [change.eventId],
      diplomacy: diplomacySnapshot(timeline, change.fromPlayerId, change.toPlayerId, change.atMs),
      metadata: {
        previousStance: change.previousStance,
        newStance: change.stance,
        rawMode: change.rawMode,
        rawCommandId: change.rawCommandId,
      },
    });
  }

  const segments = pairSegmentFor(timeline, playerOneId, playerTwoId);
  for (let index = 1; index < segments.length; index += 1) {
    const previous = segments[index - 1];
    const current = segments[index];
    let type: PairSocialBeatType | null = null;
    if (current.state === "MUTUAL_ALLIANCE" && previous.state !== "MUTUAL_ALLIANCE") {
      type = "MUTUAL_ALLIANCE_FORMED";
    } else if (previous.state === "MUTUAL_ALLIANCE" && current.state !== "MUTUAL_ALLIANCE") {
      type = "MUTUAL_ALLIANCE_ENDED";
    } else if (current.state === "ONE_SIDED_ALLIANCE" && previous.state !== "ONE_SIDED_ALLIANCE") {
      type = "ONE_SIDED_ALLIANCE_BEGAN";
    } else if (current.state === "CONFLICTED" && previous.state !== "CONFLICTED") {
      type = "CONFLICTED_DIPLOMACY_BEGAN";
    }
    if (!type) continue;
    beats.push({
      beatId: `diplomacy-state:${playerOneId}:${playerTwoId}:${current.startMs}:${type}`,
      type,
      startMs: current.startMs,
      endMs: current.startMs,
      sourcePlayerId: null,
      targetPlayerId: null,
      thirdPartyPlayerId: null,
      units: 1,
      confidence: current.coverage === "QUALIFIED" ? "EXACT" : "LOW",
      sourceVersion: timeline.schemaVersion,
      evidenceEventIds: timeline.changes
        .filter((change) => change.atMs === current.startMs && pair.has(change.fromPlayerId) && pair.has(change.toPlayerId))
        .map((change) => change.eventId),
      diplomacy: {
        sourceToTarget: current.playerOneToPlayerTwo,
        targetToSource: current.playerTwoToPlayerOne,
        pairState: current.state,
      },
      metadata: { previousPairState: previous.state, newPairState: current.state },
    });
  }

  return beats;
}

function observationBeats(
  observations: PairSocialObservation[],
  timeline: DiplomacyTimeline,
  pair: Set<number>,
  roster: Set<number>,
  durationMs: number,
): PairSocialBeat[] {
  const ids = new Set<string>();
  const result: PairSocialBeat[] = [];
  for (const observation of observations) {
    if (!observation.observationId || ids.has(observation.observationId)) {
      throw new Error(`Pair observation id is missing or duplicated: ${observation.observationId}.`);
    }
    ids.add(observation.observationId);
    assertPlayer(observation.sourcePlayerId, roster, `Observation ${observation.observationId} sourcePlayerId`);
    assertPlayer(observation.targetPlayerId, roster, `Observation ${observation.observationId} targetPlayerId`);
    if (observation.sourcePlayerId === observation.targetPlayerId) {
      throw new Error(`Observation ${observation.observationId} cannot target self.`);
    }
    if (!pair.has(observation.sourcePlayerId) || !pair.has(observation.targetPlayerId)) {
      continue;
    }
    if (observation.thirdPartyPlayerId != null) {
      assertPlayer(observation.thirdPartyPlayerId, roster, `Observation ${observation.observationId} thirdPartyPlayerId`);
      if (pair.has(observation.thirdPartyPlayerId)) {
        throw new Error(`Observation ${observation.observationId} thirdPartyPlayerId must be outside the pair.`);
      }
    }
    assertWindow(observation.startMs, observation.endMs, durationMs, `Observation ${observation.observationId}`);
    if (!Number.isFinite(observation.units) || observation.units <= 0) {
      throw new Error(`Observation ${observation.observationId} units must be positive.`);
    }
    if (!observation.sourceVersion) throw new Error(`Observation ${observation.observationId} sourceVersion is required.`);
    result.push({
      beatId: `observation:${observation.observationId}`,
      type: OBSERVATION_TO_BEAT[observation.type],
      startMs: observation.startMs,
      endMs: observation.endMs,
      sourcePlayerId: observation.sourcePlayerId,
      targetPlayerId: observation.targetPlayerId,
      thirdPartyPlayerId: observation.thirdPartyPlayerId ?? null,
      units: observation.units,
      confidence: observation.confidence,
      sourceVersion: observation.sourceVersion,
      evidenceEventIds: [...new Set(observation.evidenceEventIds)].sort((a, b) => a.localeCompare(b)),
      diplomacy: diplomacySnapshot(timeline, observation.sourcePlayerId, observation.targetPlayerId, observation.startMs),
      metadata: { ...(observation.metadata ?? {}) },
    });
  }
  return result;
}

function thirdPartyBeats(
  episodes: ThirdPartyPressureObservation[],
  timeline: DiplomacyTimeline,
  playerOneId: number,
  playerTwoId: number,
  roster: Set<number>,
  durationMs: number,
): PairSocialBeat[] {
  const result: PairSocialBeat[] = [];
  const ids = new Set<string>();
  for (const episode of episodes) {
    if (!episode.episodeId || ids.has(episode.episodeId)) throw new Error(`Third-party episode id is missing or duplicated: ${episode.episodeId}.`);
    ids.add(episode.episodeId);
    const [episodeOne, episodeTwo] = sortedPair(episode.playerOneId, episode.playerTwoId);
    const [pairOne, pairTwo] = sortedPair(playerOneId, playerTwoId);
    if (episodeOne !== pairOne || episodeTwo !== pairTwo) continue;
    assertPlayer(episode.targetPlayerId, roster, `Third-party episode ${episode.episodeId} targetPlayerId`);
    if (episode.targetPlayerId === pairOne || episode.targetPlayerId === pairTwo) {
      throw new Error(`Third-party episode ${episode.episodeId} target must be outside the pair.`);
    }
    assertWindow(episode.startMs, episode.endMs, durationMs, `Third-party episode ${episode.episodeId}`);
    result.push({
      beatId: `third-party:${episode.episodeId}`,
      type: "COINCIDENT_THIRD_PARTY_PRESSURE",
      startMs: episode.startMs,
      endMs: episode.endMs,
      sourcePlayerId: pairOne,
      targetPlayerId: pairTwo,
      thirdPartyPlayerId: episode.targetPlayerId,
      units: 1,
      confidence: episode.confidence,
      sourceVersion: episode.sourceVersion,
      evidenceEventIds: [...new Set(episode.evidenceEventIds)].sort((a, b) => a.localeCompare(b)),
      diplomacy: diplomacySnapshot(timeline, pairOne, pairTwo, episode.startMs),
      metadata: { coordinationClaimed: false },
    });
  }
  return result;
}

function opportunityAbsenceBeats(
  opportunities: PairInteractionOpportunity[],
  existingBeats: PairSocialBeat[],
  coverage: PairSocialCoverage,
  timeline: DiplomacyTimeline,
  playerOneId: number,
  playerTwoId: number,
  roster: Set<number>,
  durationMs: number,
): PairSocialBeat[] {
  const result: PairSocialBeat[] = [];
  const ids = new Set<string>();
  for (const opportunity of opportunities) {
    if (!opportunity.opportunityId || ids.has(opportunity.opportunityId)) {
      throw new Error(`Pair opportunity id is missing or duplicated: ${opportunity.opportunityId}.`);
    }
    ids.add(opportunity.opportunityId);
    assertPlayer(opportunity.playerOneId, roster, `Opportunity ${opportunity.opportunityId} playerOneId`);
    assertPlayer(opportunity.playerTwoId, roster, `Opportunity ${opportunity.opportunityId} playerTwoId`);
    const expected = sortedPair(playerOneId, playerTwoId);
    const actual = sortedPair(opportunity.playerOneId, opportunity.playerTwoId);
    if (expected[0] !== actual[0] || expected[1] !== actual[1]) continue;
    assertWindow(opportunity.startMs, opportunity.endMs, durationMs, `Opportunity ${opportunity.opportunityId}`);
    if (!opportunity.sourceVersion) throw new Error(`Opportunity ${opportunity.opportunityId} sourceVersion is required.`);

    const isCooperation = opportunity.kind === "ALLIED_COOPERATION";
    const familyCoverage = isCooperation ? coverage.alliedCooperation : coverage.oppositionInteraction;
    if (familyCoverage !== "QUALIFIED") continue;
    const qualifyingSet = isCooperation ? COOPERATION_BEATS : OPPOSITION_BEATS;
    const found = existingBeats.some((beat) =>
      qualifyingSet.has(beat.type) && overlaps(beat.startMs, beat.endMs, opportunity.startMs, opportunity.endMs),
    );
    if (found) continue;

    result.push({
      beatId: `absence:${opportunity.opportunityId}`,
      type: isCooperation ? "NO_QUALIFYING_ALLIED_COOPERATION" : "NO_QUALIFYING_OPPOSITION_CONTACT",
      startMs: opportunity.startMs,
      endMs: opportunity.endMs,
      sourcePlayerId: null,
      targetPlayerId: null,
      thirdPartyPlayerId: null,
      units: 1,
      confidence: "HIGH",
      sourceVersion: opportunity.sourceVersion,
      evidenceEventIds: [...new Set(opportunity.evidenceEventIds)].sort((a, b) => a.localeCompare(b)),
      diplomacy: diplomacySnapshot(timeline, playerOneId, playerTwoId, opportunity.startMs),
      metadata: { opportunityKind: opportunity.kind },
    });
  }
  return result;
}

function beatSort(left: PairSocialBeat, right: PairSocialBeat): number {
  return left.startMs - right.startMs ||
    left.endMs - right.endMs ||
    left.type.localeCompare(right.type) ||
    left.beatId.localeCompare(right.beatId);
}

export function buildPairSocialEvidence(input: {
  matchId: string;
  playerOneId: number;
  playerTwoId: number;
  rosterPlayerIds: number[];
  durationMs: number;
  diplomacyTimeline: DiplomacyTimeline;
  coverage: PairSocialCoverage;
  observations?: PairSocialObservation[];
  opportunities?: PairInteractionOpportunity[];
  thirdPartyPressure?: ThirdPartyPressureObservation[];
}): PairSocialEvidence {
  if (!input.matchId) throw new Error("Pair Social Evidence matchId is required.");
  if (input.playerOneId === input.playerTwoId) throw new Error("Pair Social Evidence requires two different players.");
  if (!Number.isFinite(input.durationMs) || input.durationMs < 0) throw new Error("Pair Social Evidence durationMs is invalid.");
  if (input.diplomacyTimeline.durationMs !== Math.trunc(input.durationMs)) {
    throw new Error("Pair Social Evidence and diplomacy timeline must describe the same Battle duration.");
  }
  const roster = new Set(input.rosterPlayerIds);
  assertPlayer(input.playerOneId, roster, "playerOneId");
  assertPlayer(input.playerTwoId, roster, "playerTwoId");
  const pair = new Set([input.playerOneId, input.playerTwoId]);
  const observations = input.observations ?? [];
  const opportunities = input.opportunities ?? [];
  const thirdParty = input.thirdPartyPressure ?? [];

  const beats = [
    ...diplomacyBeats(input.diplomacyTimeline, input.playerOneId, input.playerTwoId),
    ...observationBeats(observations, input.diplomacyTimeline, pair, roster, input.durationMs),
    ...thirdPartyBeats(thirdParty, input.diplomacyTimeline, input.playerOneId, input.playerTwoId, roster, input.durationMs),
  ];
  const absence = opportunityAbsenceBeats(
    opportunities,
    beats,
    input.coverage,
    input.diplomacyTimeline,
    input.playerOneId,
    input.playerTwoId,
    roster,
    input.durationMs,
  );
  beats.push(...absence);
  beats.sort(beatSort);

  const [playerOneId, playerTwoId] = sortedPair(input.playerOneId, input.playerTwoId);
  return {
    schemaVersion: PAIR_SOCIAL_EVIDENCE_VERSION,
    matchId: input.matchId,
    playerOneId,
    playerTwoId,
    durationMs: Math.trunc(input.durationMs),
    coverage: { ...input.coverage },
    opportunities: [...opportunities].sort((a, b) => a.startMs - b.startMs || a.opportunityId.localeCompare(b.opportunityId)),
    beats,
    diagnostics: {
      observationCount: observations.length,
      opportunityCount: opportunities.length,
      thirdPartyEpisodeCount: thirdParty.length,
      absenceBeatCount: absence.length,
    },
  };
}
