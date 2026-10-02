import type {
  CanonicalReplayEvent,
  MatchAnalysisV1,
  RaidCandidate,
  TeamSupportCandidate,
} from "./matchAnalysis.js";
import {
  type DiplomacyTimeline,
  diplomacyAt,
} from "./diplomacyTimeline.js";
import {
  type CanonicalInitialDiplomacyEdgeLike,
  buildDiplomacyTimelineFromCanonicalEvidence,
} from "./diplomacyEvidenceAdapter.js";
import {
  type PairSocialCoverage,
  type PairSocialEvidence,
  type PairSocialObservation,
  type SocialEvidenceConfidence,
  type ThirdPartyPressureObservation,
  buildPairSocialEvidence,
} from "./pairSocialEvidence.js";

export const BATTLE_SOCIAL_EVIDENCE_ADAPTER_VERSION = "AOF_BATTLE_SOCIAL_EVIDENCE_ADAPTER_V1";

export interface DirectedTributeCommandEvidence {
  evidenceId: string;
  eventId: string;
  atMs: number;
  sourcePlayerId: number;
  targetPlayerId: number;
  resourceId: number | null;
  amount: number | null;
  food: number | null;
  wood: number | null;
  gold: number | null;
  stone: number | null;
  sourceVersion: string;
}

export interface BattleSocialEvidenceAdapterResult {
  schemaVersion: typeof BATTLE_SOCIAL_EVIDENCE_ADAPTER_VERSION;
  matchId: string;
  diplomacyTimeline: DiplomacyTimeline;
  pairEvidence: PairSocialEvidence[];
  tributeCommands: DirectedTributeCommandEvidence[];
  diagnostics: {
    raidCandidatesSeen: number;
    raidObservationsEmitted: number;
    raidCandidatesSuppressedAllied: number;
    raidCandidatesSuppressedUnknownDiplomacy: number;
    defensiveSupportCandidatesSeen: number;
    defensiveSupportObservationsEmitted: number;
    defensiveSupportSuppressedDiplomacy: number;
    thirdPartyPressureEpisodes: number;
    tributeCommandsRetained: number;
    aggregateOnlyPairSignalsNotPromoted: number;
  };
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function integerValue(value: unknown): number | null {
  const valueNumber = numberValue(value);
  return valueNumber == null ? null : Math.trunc(valueNumber);
}

function confidence(value: "high" | "medium" | "low"): SocialEvidenceConfidence {
  if (value === "high") return "HIGH";
  if (value === "medium") return "MEDIUM";
  return "LOW";
}

function pairKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function sortedPair(a: number, b: number): [number, number] {
  return a < b ? [a, b] : [b, a];
}

function pairDiplomacyCoverage(timeline: DiplomacyTimeline, a: number, b: number): PairSocialCoverage["diplomacy"] {
  const [one, two] = sortedPair(a, b);
  const segments = timeline.pairSegments.filter((segment) => segment.playerOneId === one && segment.playerTwoId === two);
  if (!segments.length) return "UNAVAILABLE";
  const coveredMs = segments.reduce((sum, segment) => sum + Math.max(0, segment.endMs - segment.startMs), 0);
  if (coveredMs !== timeline.durationMs) return "UNAVAILABLE";
  return segments.every((segment) => segment.coverage === "QUALIFIED") ? "QUALIFIED" : "UNAVAILABLE";
}

function defaultCoverage(timeline: DiplomacyTimeline, a: number, b: number): PairSocialCoverage {
  return {
    diplomacy: pairDiplomacyCoverage(timeline, a, b),
    // Positive evidence can be emitted before AoF has proved complete family
    // coverage. Absence claims therefore stay unavailable in this bridge V1.
    oppositionInteraction: "UNAVAILABLE",
    alliedCooperation: "UNAVAILABLE",
    economicTransfer: "UNAVAILABLE",
    spatialPressure: "UNAVAILABLE",
    communication: "UNAVAILABLE",
  };
}

function directedSegmentsOverlapping(
  timeline: DiplomacyTimeline,
  sourcePlayerId: number,
  targetPlayerId: number,
  startMs: number,
  endMs: number,
) {
  return timeline.directedSegments.filter((segment) =>
    segment.fromPlayerId === sourcePlayerId &&
    segment.toPlayerId === targetPlayerId &&
    segment.startMs <= endMs &&
    segment.endMs >= startMs,
  );
}

function pressureDiplomacyQualification(
  timeline: DiplomacyTimeline,
  sourcePlayerId: number,
  targetPlayerId: number,
  startMs: number,
  endMs: number,
): "QUALIFIED" | "ALLIED" | "UNKNOWN" {
  const segments = directedSegmentsOverlapping(timeline, sourcePlayerId, targetPlayerId, startMs, endMs);
  if (!segments.length) return "UNKNOWN";
  if (segments.some((segment) => segment.stance === "UNKNOWN" || segment.coverage !== "QUALIFIED")) return "UNKNOWN";
  if (segments.some((segment) => segment.stance === "ALLY")) return "ALLIED";
  return "QUALIFIED";
}

function raidObservation(raid: RaidCandidate): PairSocialObservation {
  return {
    observationId: `raid:${raid.raidCandidateId}`,
    type: "RAID_PRESSURE",
    startMs: raid.startMs,
    endMs: raid.endMs,
    sourcePlayerId: raid.attackerPlayerId,
    targetPlayerId: raid.targetPlayerId,
    units: 1,
    confidence: confidence(raid.confidence),
    sourceVersion: raid.modelVersion,
    evidenceEventIds: [...raid.eventIds],
    metadata: {
      directTargetCommands: raid.directTargetCommands,
      nearTargetCommands: raid.nearTargetCommands,
      targetFocusShare: raid.targetFocusShare,
      distanceToTargetAnchorTiles: raid.distanceToTargetAnchorTiles,
      formatCaution: raid.formatCaution,
    },
  };
}

function defensiveSupportObservation(candidate: TeamSupportCandidate): PairSocialObservation {
  return {
    observationId: `defensive-assist:${candidate.raidCandidateId}:${candidate.helperPlayerId}:${candidate.defendedPlayerId}`,
    type: "DEFENSIVE_ASSIST",
    startMs: candidate.responseAtMs,
    endMs: candidate.responseAtMs,
    sourcePlayerId: candidate.helperPlayerId,
    targetPlayerId: candidate.defendedPlayerId,
    thirdPartyPlayerId: candidate.enemyPlayerId,
    units: 1,
    confidence: candidate.confidence === "high" ? "HIGH" : "MEDIUM",
    sourceVersion: "TEAM_INTERACTIONS_V1_4",
    evidenceEventIds: [candidate.sourceEventId],
    metadata: {
      raidCandidateId: candidate.raidCandidateId,
      responseDelayMs: candidate.responseDelayMs,
    },
  };
}

function retainTributeCommands(
  events: CanonicalReplayEvent[],
  roster: Set<number>,
  sourceVersion: string,
): DirectedTributeCommandEvidence[] {
  const result: DirectedTributeCommandEvidence[] = [];
  for (const event of events) {
    if (event.eventType !== "command.tribute") continue;
    const sourcePlayerId = event.actorPlayerId;
    const targetPlayerId = event.targetPlayerId;
    if (
      sourcePlayerId == null ||
      targetPlayerId == null ||
      sourcePlayerId === targetPlayerId ||
      !roster.has(sourcePlayerId) ||
      !roster.has(targetPlayerId)
    ) continue;
    const payload = event.payload ?? {};
    result.push({
      evidenceId: `tribute-command:${event.eventId}`,
      eventId: event.eventId,
      atMs: event.timestampMs,
      sourcePlayerId,
      targetPlayerId,
      resourceId: integerValue(payload.resource_id),
      amount: numberValue(payload.amount),
      food: numberValue(payload.food),
      wood: numberValue(payload.wood),
      gold: numberValue(payload.gold),
      stone: numberValue(payload.stone),
      sourceVersion,
    });
  }
  return result.sort((a, b) => a.atMs - b.atMs || a.eventId.localeCompare(b.eventId));
}

function overlapWindow(a: PairSocialObservation, b: PairSocialObservation): { startMs: number; endMs: number } | null {
  const startMs = Math.max(a.startMs, b.startMs);
  const endMs = Math.min(a.endMs, b.endMs);
  return endMs >= startMs ? { startMs, endMs } : null;
}

function thirdPartyPressureFromRaids(
  raids: PairSocialObservation[],
): ThirdPartyPressureObservation[] {
  const byTarget = new Map<number, PairSocialObservation[]>();
  for (const raid of raids) {
    const list = byTarget.get(raid.targetPlayerId) ?? [];
    list.push(raid);
    byTarget.set(raid.targetPlayerId, list);
  }
  const result: ThirdPartyPressureObservation[] = [];
  const ids = new Set<string>();
  for (const [targetPlayerId, targetRaids] of byTarget) {
    const ordered = [...targetRaids].sort((a, b) => a.startMs - b.startMs || a.observationId.localeCompare(b.observationId));
    for (let left = 0; left < ordered.length; left += 1) {
      for (let right = left + 1; right < ordered.length; right += 1) {
        const first = ordered[left];
        const second = ordered[right];
        if (first.sourcePlayerId === second.sourcePlayerId) continue;
        const overlap = overlapWindow(first, second);
        if (!overlap) continue;
        const [one, two] = sortedPair(first.sourcePlayerId, second.sourcePlayerId);
        const id = `third-pressure:${targetPlayerId}:${one}:${two}:${overlap.startMs}:${overlap.endMs}`;
        if (ids.has(id)) continue;
        ids.add(id);
        const confidenceValue: SocialEvidenceConfidence = first.confidence === "LOW" || second.confidence === "LOW"
          ? "LOW"
          : first.confidence === "MEDIUM" || second.confidence === "MEDIUM"
            ? "MEDIUM"
            : "HIGH";
        result.push({
          episodeId: id,
          startMs: overlap.startMs,
          endMs: overlap.endMs,
          playerOneId: one,
          playerTwoId: two,
          targetPlayerId,
          sourceVersion: BATTLE_SOCIAL_EVIDENCE_ADAPTER_VERSION,
          evidenceEventIds: [...new Set([...first.evidenceEventIds, ...second.evidenceEventIds])].sort((a, b) => a.localeCompare(b)),
          confidence: confidenceValue,
        });
      }
    }
  }
  return result.sort((a, b) => a.startMs - b.startMs || a.episodeId.localeCompare(b.episodeId));
}

function aggregateOnlySignalCount(analysis: MatchAnalysisV1): number {
  return analysis.pairInteractions.reduce((sum, pair) => sum +
    pair.directHostileTargetCommands +
    pair.forwardBuildPlacements +
    pair.forwardWallPlacements +
    pair.targetRegionCommands +
    pair.deepTargetRegionCommands,
  0) + analysis.teamInteractions.reduce((sum, team) => sum +
    team.coordinatedTargetWindows + team.sharedTargetObjectCount,
  0);
}

export function buildBattleSocialEvidence(input: {
  analysis: MatchAnalysisV1;
  canonicalEvents: CanonicalReplayEvent[];
  canonicalSchemaVersion: string;
  canonicalInitialDiplomacy?: CanonicalInitialDiplomacyEdgeLike[];
  matchSettings?: Record<string, unknown>;
}): BattleSocialEvidenceAdapterResult {
  const rosterPlayerIds = input.analysis.players.map((player) => player.playerId).sort((a, b) => a - b);
  const roster = new Set(rosterPlayerIds);
  const diplomacy = buildDiplomacyTimelineFromCanonicalEvidence({
    playerIds: rosterPlayerIds,
    durationMs: input.analysis.match.durationMs,
    canonicalInitialDiplomacy: input.canonicalInitialDiplomacy,
    matchSettings: input.matchSettings,
    events: input.canonicalEvents,
    canonicalSchemaVersion: input.canonicalSchemaVersion,
  });

  const observations: PairSocialObservation[] = [];
  let raidCandidatesSuppressedAllied = 0;
  let raidCandidatesSuppressedUnknownDiplomacy = 0;
  for (const raid of input.analysis.raidCandidates) {
    const qualification = pressureDiplomacyQualification(
      diplomacy.timeline,
      raid.attackerPlayerId,
      raid.targetPlayerId,
      raid.startMs,
      raid.endMs,
    );
    if (qualification === "ALLIED") {
      raidCandidatesSuppressedAllied += 1;
      continue;
    }
    if (qualification === "UNKNOWN") {
      raidCandidatesSuppressedUnknownDiplomacy += 1;
      continue;
    }
    observations.push(raidObservation(raid));
  }
  const raidObservations = observations.filter((observation) => observation.type === "RAID_PRESSURE");

  let defensiveSupportSuppressedDiplomacy = 0;
  for (const candidate of input.analysis.teamSupportCandidates) {
    const helperToDefended = diplomacyAt(diplomacy.timeline, candidate.helperPlayerId, candidate.defendedPlayerId, candidate.responseAtMs);
    const defendedToHelper = diplomacyAt(diplomacy.timeline, candidate.defendedPlayerId, candidate.helperPlayerId, candidate.responseAtMs);
    if (helperToDefended !== "ALLY" || defendedToHelper !== "ALLY") {
      defensiveSupportSuppressedDiplomacy += 1;
      continue;
    }
    observations.push(defensiveSupportObservation(candidate));
  }

  const thirdPartyPressure = thirdPartyPressureFromRaids(raidObservations);
  const tributeCommands = retainTributeCommands(input.canonicalEvents, roster, input.canonicalSchemaVersion);

  const observationsByPair = new Map<string, PairSocialObservation[]>();
  for (const observation of observations) {
    const key = pairKey(observation.sourcePlayerId, observation.targetPlayerId);
    const list = observationsByPair.get(key) ?? [];
    list.push(observation);
    observationsByPair.set(key, list);
  }
  const thirdPartyByPair = new Map<string, ThirdPartyPressureObservation[]>();
  for (const episode of thirdPartyPressure) {
    const key = pairKey(episode.playerOneId, episode.playerTwoId);
    const list = thirdPartyByPair.get(key) ?? [];
    list.push(episode);
    thirdPartyByPair.set(key, list);
  }

  const pairEvidence: PairSocialEvidence[] = [];
  for (let left = 0; left < rosterPlayerIds.length; left += 1) {
    for (let right = left + 1; right < rosterPlayerIds.length; right += 1) {
      const one = rosterPlayerIds[left];
      const two = rosterPlayerIds[right];
      const key = pairKey(one, two);
      pairEvidence.push(buildPairSocialEvidence({
        matchId: input.analysis.match.matchId,
        playerOneId: one,
        playerTwoId: two,
        rosterPlayerIds,
        durationMs: input.analysis.match.durationMs,
        diplomacyTimeline: diplomacy.timeline,
        coverage: defaultCoverage(diplomacy.timeline, one, two),
        observations: observationsByPair.get(key) ?? [],
        opportunities: [],
        thirdPartyPressure: thirdPartyByPair.get(key) ?? [],
      }));
    }
  }

  return {
    schemaVersion: BATTLE_SOCIAL_EVIDENCE_ADAPTER_VERSION,
    matchId: input.analysis.match.matchId,
    diplomacyTimeline: diplomacy.timeline,
    pairEvidence,
    tributeCommands,
    diagnostics: {
      raidCandidatesSeen: input.analysis.raidCandidates.length,
      raidObservationsEmitted: raidObservations.length,
      raidCandidatesSuppressedAllied,
      raidCandidatesSuppressedUnknownDiplomacy,
      defensiveSupportCandidatesSeen: input.analysis.teamSupportCandidates.length,
      defensiveSupportObservationsEmitted: observations.filter((observation) => observation.type === "DEFENSIVE_ASSIST").length,
      defensiveSupportSuppressedDiplomacy,
      thirdPartyPressureEpisodes: thirdPartyPressure.length,
      tributeCommandsRetained: tributeCommands.length,
      aggregateOnlyPairSignalsNotPromoted: aggregateOnlySignalCount(input.analysis),
    },
  };
}
