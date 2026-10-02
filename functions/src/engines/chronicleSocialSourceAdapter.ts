import {
  type CanonicalInitialDiplomacyEdgeLike,
  buildDiplomacyTimelineFromCanonicalEvidence,
} from "./diplomacyEvidenceAdapter.js";
import { diplomacyAt, type DiplomacyTimeline } from "./diplomacyTimeline.js";
import {
  BATTLE_SOCIAL_EVIDENCE_ADAPTER_VERSION,
  type BattleSocialEvidenceAdapterResult,
  type DirectedTributeCommandEvidence,
} from "./battleSocialEvidenceAdapter.js";
import {
  buildPairSocialEvidence,
  type PairSocialCoverage,
  type PairSocialEvidence,
  type PairSocialObservation,
  type SocialEvidenceConfidence,
  type ThirdPartyPressureObservation,
} from "./pairSocialEvidence.js";

export const CHRONICLE_SOCIAL_SOURCE_VERSION = "AOF_CHRONICLE_SOCIAL_SOURCE_V1";
export const CHRONICLE_SOCIAL_SOURCE_ADAPTER_VERSION = "AOF_CHRONICLE_SOCIAL_SOURCE_ADAPTER_V1";

interface DiplomacyCommandSource {
  eventId: string;
  atMs: number;
  operationOrdinal: number;
  fromPlayerId: number;
  toPlayerId: number;
  rawMode: number | null;
  rawCommandId: number | null;
}

interface TributeCommandSource {
  eventId: string;
  atMs: number;
  sourcePlayerId: number;
  targetPlayerId: number;
  resourceId?: number | null;
  amount?: number | null;
  food?: number | null;
  wood?: number | null;
  gold?: number | null;
  stone?: number | null;
}

interface ChronicleSocialSource {
  schemaVersion: typeof CHRONICLE_SOCIAL_SOURCE_VERSION;
  source: {
    replaySha256?: string | null;
    canonicalManifestSha256?: string | null;
    extractionRunId?: string | null;
    canonicalSchemaVersion?: string | null;
    statisticsProjectionVersion?: string | null;
  };
  match: {
    durationMs: number;
    settings: Record<string, unknown>;
  };
  playerIds: number[];
  initialDiplomacy: CanonicalInitialDiplomacyEdgeLike[];
  diplomacyCommands: DiplomacyCommandSource[];
  tributeCommands: TributeCommandSource[];
  raids: Record<string, unknown>[];
  battles: Record<string, unknown>[];
  reinforcements: Record<string, unknown>[];
  defensiveAssists: Record<string, unknown>[];
  cooperativeAttacks: Record<string, unknown>[];
  forwardBuildings: Record<string, unknown>[];
  enemyBaseContacts: Record<string, unknown>[];
  coverage: Record<string, unknown>;
  semantics: Record<string, unknown>;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function integer(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function stringArray(value: unknown): string[] {
  return array(value).filter((item): item is string => typeof item === "string" && item.length > 0);
}

function requirePlayer(value: unknown, roster: Set<number>, label: string): number {
  const result = integer(value);
  if (result == null || !roster.has(result)) throw new Error(`${label} references a player outside the replay roster.`);
  return result;
}

function requireTime(value: unknown, durationMs: number, label: string): number {
  const result = integer(value);
  if (result == null || result < 0 || result > durationMs) throw new Error(`${label} has invalid Battle time.`);
  return result;
}

function pairKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function confidence(value: unknown): SocialEvidenceConfidence {
  if (value === "high") return "HIGH";
  if (value === "low") return "LOW";
  // Command-derived episode models are inference. When a source does not publish
  // its own confidence tier, MEDIUM is the conservative neutral default; this
  // controls Chronicle wording only and is not relationship score.
  return "MEDIUM";
}

function parseSource(input: unknown): ChronicleSocialSource {
  const root = record(input);
  if (root.schemaVersion !== CHRONICLE_SOCIAL_SOURCE_VERSION) {
    throw new Error(`Unsupported Chronicle social source schema ${String(root.schemaVersion)}.`);
  }
  const source = record(root.source);
  const match = record(root.match);
  const durationMs = integer(match.durationMs);
  if (durationMs == null || durationMs < 0) throw new Error("Chronicle social source requires non-negative durationMs.");
  const playerIds = array(root.playerIds).map((value) => integer(value)).filter((value): value is number => value != null);
  const unique = [...new Set(playerIds)].sort((a, b) => a - b);
  if (unique.length < 2 || unique.length !== playerIds.length) throw new Error("Chronicle social source requires unique replay player ids.");

  const initialDiplomacy = array(root.initialDiplomacy).map((value) => record(value)).map((edge) => ({
    fromPlayerId: integer(edge.fromPlayerId) ?? -1,
    toPlayerId: integer(edge.toPlayerId) ?? -1,
    stance: String(edge.stance ?? "unknown"),
  }));
  const diplomacyCommands = array(root.diplomacyCommands).map((value) => record(value)).map((row) => ({
    eventId: String(row.eventId ?? ""),
    atMs: integer(row.atMs) ?? -1,
    operationOrdinal: integer(row.operationOrdinal) ?? -1,
    fromPlayerId: integer(row.fromPlayerId) ?? -1,
    toPlayerId: integer(row.toPlayerId) ?? -1,
    rawMode: integer(row.rawMode),
    rawCommandId: integer(row.rawCommandId),
  }));
  const tributeCommands = array(root.tributeCommands).map((value) => record(value)).map((row) => ({
    eventId: String(row.eventId ?? ""),
    atMs: integer(row.atMs) ?? -1,
    sourcePlayerId: integer(row.sourcePlayerId) ?? -1,
    targetPlayerId: integer(row.targetPlayerId) ?? -1,
    resourceId: integer(row.resourceId),
    amount: numberValue(row.amount),
    food: numberValue(row.food),
    wood: numberValue(row.wood),
    gold: numberValue(row.gold),
    stone: numberValue(row.stone),
  }));

  return {
    schemaVersion: CHRONICLE_SOCIAL_SOURCE_VERSION,
    source: {
      replaySha256: text(source.replaySha256),
      canonicalManifestSha256: text(source.canonicalManifestSha256),
      extractionRunId: text(source.extractionRunId),
      canonicalSchemaVersion: text(source.canonicalSchemaVersion),
      statisticsProjectionVersion: text(source.statisticsProjectionVersion),
    },
    match: { durationMs, settings: record(match.settings) },
    playerIds: unique,
    initialDiplomacy,
    diplomacyCommands,
    tributeCommands,
    raids: array(root.raids).map(record),
    battles: array(root.battles).map(record),
    reinforcements: array(root.reinforcements).map(record),
    defensiveAssists: array(root.defensiveAssists).map(record),
    cooperativeAttacks: array(root.cooperativeAttacks).map(record),
    forwardBuildings: array(root.forwardBuildings).map(record),
    enemyBaseContacts: array(root.enemyBaseContacts).map(record),
    coverage: record(root.coverage),
    semantics: record(root.semantics),
  };
}

function diplomacyCoverage(timeline: DiplomacyTimeline, a: number, b: number): PairSocialCoverage["diplomacy"] {
  const one = Math.min(a, b);
  const two = Math.max(a, b);
  const segments = timeline.pairSegments.filter((segment) => segment.playerOneId === one && segment.playerTwoId === two);
  const covered = segments.reduce((sum, segment) => sum + Math.max(0, segment.endMs - segment.startMs), 0);
  return segments.length > 0 && covered === timeline.durationMs && segments.every((segment) => segment.coverage === "QUALIFIED")
    ? "QUALIFIED"
    : "UNAVAILABLE";
}

function pairCoverage(timeline: DiplomacyTimeline, a: number, b: number): PairSocialCoverage {
  return {
    diplomacy: diplomacyCoverage(timeline, a, b),
    // V1 live projection deliberately enables positive facts only. Complete
    // opportunity/absence coverage must be separately qualified before AoF may
    // narrate silence, refusal, neglect or lack of contact.
    oppositionInteraction: "UNAVAILABLE",
    alliedCooperation: "UNAVAILABLE",
    economicTransfer: "UNAVAILABLE",
    spatialPressure: "UNAVAILABLE",
    communication: "UNAVAILABLE",
  };
}

function overlappingDirectedStances(
  timeline: DiplomacyTimeline,
  source: number,
  target: number,
  startMs: number,
  endMs: number,
) {
  return timeline.directedSegments.filter((segment) =>
    segment.fromPlayerId === source && segment.toPlayerId === target &&
    segment.startMs <= endMs && segment.endMs >= startMs,
  );
}

function mayNarratePressure(
  timeline: DiplomacyTimeline,
  source: number,
  target: number,
  startMs: number,
  endMs: number,
): boolean {
  const segments = overlappingDirectedStances(timeline, source, target, startMs, endMs);
  return segments.length > 0 &&
    segments.every((segment) => segment.coverage === "QUALIFIED" && segment.stance !== "UNKNOWN" && segment.stance !== "ALLY");
}

function mutualAllianceAt(timeline: DiplomacyTimeline, a: number, b: number, atMs: number): boolean {
  return diplomacyAt(timeline, a, b, atMs) === "ALLY" && diplomacyAt(timeline, b, a, atMs) === "ALLY";
}

function observationFromRaid(row: Record<string, unknown>, roster: Set<number>, durationMs: number): PairSocialObservation {
  const source = requirePlayer(row.attackerPlayerId, roster, "Raid attacker");
  const target = requirePlayer(row.victimPlayerId, roster, "Raid victim");
  const startMs = requireTime(row.startedAtMs, durationMs, "Raid start");
  const endMs = requireTime(row.endedAtMs, durationMs, "Raid end");
  const raidId = text(row.raidId) ?? `${source}:${target}:${startMs}`;
  return {
    observationId: `raid:${raidId}`,
    type: "RAID_PRESSURE",
    startMs,
    endMs,
    sourcePlayerId: source,
    targetPlayerId: target,
    units: 1,
    confidence: "MEDIUM",
    sourceVersion: text(row.modelVersion) ?? "AOF_RAID_DETECTION_V3",
    evidenceEventIds: stringArray(row.sourceEventIds),
    metadata: {
      strongCommandCount: integer(row.strongCommandCount) ?? 0,
      commandCount: integer(row.commandCount) ?? 0,
    },
  };
}

function observationsFromBattles(rows: Record<string, unknown>[], roster: Set<number>, durationMs: number): PairSocialObservation[] {
  const observations: PairSocialObservation[] = [];
  for (const battle of rows) {
    const battleId = text(battle.battleId) ?? "battle";
    for (const rawEdge of array(battle.directedInteractionEdges)) {
      const edge = record(rawEdge);
      const source = requirePlayer(edge.fromPlayerId, roster, `Battle ${battleId} interaction source`);
      const target = requirePlayer(edge.toPlayerId, roster, `Battle ${battleId} interaction target`);
      const startMs = requireTime(edge.firstAtMs, durationMs, `Battle ${battleId} interaction start`);
      const endMs = requireTime(edge.lastAtMs, durationMs, `Battle ${battleId} interaction end`);
      observations.push({
        observationId: `engagement:${battleId}:${source}:${target}`,
        type: "DIRECT_ENGAGEMENT",
        startMs,
        endMs,
        sourcePlayerId: source,
        targetPlayerId: target,
        units: 1,
        confidence: confidence(edge.confidence),
        sourceVersion: "AOF_ENGAGEMENT_STATISTICS_V3",
        evidenceEventIds: stringArray(edge.sourceEventIds),
        metadata: { battleId },
      });
    }
  }
  return observations;
}

function observationsFromForwardBuildings(rows: Record<string, unknown>[], roster: Set<number>, durationMs: number): PairSocialObservation[] {
  return rows.map((row) => {
    const source = requirePlayer(row.sourcePlayerId, roster, "Forward building source");
    const target = requirePlayer(row.enemyPlayerId, roster, "Forward building target");
    const atMs = requireTime(row.atMs, durationMs, "Forward building time");
    const eventId = text(row.sourceEventId) ?? `forward:${source}:${target}:${atMs}`;
    return {
      observationId: `forward:${eventId}`,
      type: "FORWARD_ENCROACHMENT" as const,
      startMs: atMs,
      endMs: atMs,
      sourcePlayerId: source,
      targetPlayerId: target,
      units: 1,
      confidence: "MEDIUM" as const,
      sourceVersion: "AOF_MAP_PRESENCE_V7",
      evidenceEventIds: text(row.sourceEventId) ? [String(row.sourceEventId)] : [],
      metadata: {
        distanceToEnemyTownCenterTiles: numberValue(row.distanceToEnemyTownCenterTiles),
        distanceFromHomeTownCenterTiles: numberValue(row.distanceFromHomeTownCenterTiles),
      },
    };
  });
}

function supportObservations(
  source: ChronicleSocialSource,
  timeline: DiplomacyTimeline,
  roster: Set<number>,
): PairSocialObservation[] {
  const result: PairSocialObservation[] = [];
  const add = (
    type: "ALLY_REINFORCEMENT" | "DEFENSIVE_ASSIST",
    rows: Record<string, unknown>[],
    sourceField: string,
    targetField: string,
    timeField: string,
    idField: string,
  ) => {
    for (const row of rows) {
      const helper = requirePlayer(row[sourceField], roster, `${type} source`);
      const supported = requirePlayer(row[targetField], roster, `${type} target`);
      const atMs = requireTime(row[timeField], source.match.durationMs, `${type} time`);
      if (!mutualAllianceAt(timeline, helper, supported, atMs)) continue;
      const id = text(row[idField]) ?? `${helper}:${supported}:${atMs}`;
      result.push({
        observationId: `${type.toLowerCase()}:${id}`,
        type,
        startMs: atMs,
        endMs: integer(row.endedAtMs) ?? atMs,
        sourcePlayerId: helper,
        targetPlayerId: supported,
        thirdPartyPlayerId: null,
        units: 1,
        confidence: "MEDIUM",
        sourceVersion: "AOF_ENGAGEMENT_STATISTICS_V3",
        evidenceEventIds: stringArray(row.sourceEventIds),
        metadata: {},
      });
    }
  };
  add("ALLY_REINFORCEMENT", source.reinforcements, "helperPlayerId", "supportedPlayerId", "startedAtMs", "reinforcementId");
  add("DEFENSIVE_ASSIST", source.defensiveAssists, "helperPlayerId", "defendedPlayerId", "firstContributionAtMs", "battleId");
  return result;
}

function thirdPartyPressureFromRaids(raids: PairSocialObservation[]): ThirdPartyPressureObservation[] {
  const result: ThirdPartyPressureObservation[] = [];
  const seen = new Set<string>();
  for (let left = 0; left < raids.length; left += 1) {
    for (let right = left + 1; right < raids.length; right += 1) {
      const first = raids[left];
      const second = raids[right];
      if (first.targetPlayerId !== second.targetPlayerId || first.sourcePlayerId === second.sourcePlayerId) continue;
      const startMs = Math.max(first.startMs, second.startMs);
      const endMs = Math.min(first.endMs, second.endMs);
      if (endMs < startMs) continue;
      const one = Math.min(first.sourcePlayerId, second.sourcePlayerId);
      const two = Math.max(first.sourcePlayerId, second.sourcePlayerId);
      const episodeId = `third-pressure:${first.targetPlayerId}:${one}:${two}:${startMs}:${endMs}`;
      if (seen.has(episodeId)) continue;
      seen.add(episodeId);
      result.push({
        episodeId,
        startMs,
        endMs,
        playerOneId: one,
        playerTwoId: two,
        targetPlayerId: first.targetPlayerId,
        sourceVersion: CHRONICLE_SOCIAL_SOURCE_ADAPTER_VERSION,
        evidenceEventIds: [...new Set([...first.evidenceEventIds, ...second.evidenceEventIds])].sort(),
        confidence: first.confidence === "LOW" || second.confidence === "LOW" ? "LOW" : "MEDIUM",
      });
    }
  }
  return result.sort((a, b) => a.startMs - b.startMs || a.episodeId.localeCompare(b.episodeId));
}

function retainTribute(source: ChronicleSocialSource, roster: Set<number>): DirectedTributeCommandEvidence[] {
  return source.tributeCommands.map((row) => {
    const from = requirePlayer(row.sourcePlayerId, roster, "Tribute source");
    const to = requirePlayer(row.targetPlayerId, roster, "Tribute target");
    const atMs = requireTime(row.atMs, source.match.durationMs, "Tribute time");
    if (!row.eventId) throw new Error("Tribute command requires source event id.");
    return {
      evidenceId: `tribute-command:${row.eventId}`,
      eventId: row.eventId,
      atMs,
      sourcePlayerId: from,
      targetPlayerId: to,
      resourceId: row.resourceId ?? null,
      amount: row.amount ?? null,
      food: row.food ?? null,
      wood: row.wood ?? null,
      gold: row.gold ?? null,
      stone: row.stone ?? null,
      sourceVersion: source.source.canonicalSchemaVersion ?? CHRONICLE_SOCIAL_SOURCE_VERSION,
    };
  }).sort((a, b) => a.atMs - b.atMs || a.eventId.localeCompare(b.eventId));
}

export function buildBattleSocialEvidenceFromChronicleSource(input: {
  matchId: string;
  source: unknown;
}): BattleSocialEvidenceAdapterResult {
  const source = parseSource(input.source);
  const roster = new Set(source.playerIds);
  const canonicalSchemaVersion = source.source.canonicalSchemaVersion ?? CHRONICLE_SOCIAL_SOURCE_VERSION;
  const diplomacyEvents = source.diplomacyCommands.map((row) => ({
    eventId: row.eventId,
    eventType: "command.diplomacy_change",
    timestampMs: row.atMs,
    operationOrdinal: row.operationOrdinal,
    actorPlayerId: row.fromPlayerId,
    targetPlayerId: row.toPlayerId,
    payload: { diplomacy_mode: row.rawMode, command_id: row.rawCommandId },
  }));
  const diplomacy = buildDiplomacyTimelineFromCanonicalEvidence({
    playerIds: source.playerIds,
    durationMs: source.match.durationMs,
    canonicalInitialDiplomacy: source.initialDiplomacy,
    matchSettings: source.match.settings,
    events: diplomacyEvents,
    canonicalSchemaVersion,
  });

  const rawObservations = [
    ...source.raids.map((row) => observationFromRaid(row, roster, source.match.durationMs)),
    ...observationsFromBattles(source.battles, roster, source.match.durationMs),
    ...observationsFromForwardBuildings(source.forwardBuildings, roster, source.match.durationMs),
    ...supportObservations(source, diplomacy.timeline, roster),
  ];
  const observations = rawObservations.filter((observation) => {
    if (observation.type === "ALLY_REINFORCEMENT" || observation.type === "DEFENSIVE_ASSIST") return true;
    return mayNarratePressure(
      diplomacy.timeline,
      observation.sourcePlayerId,
      observation.targetPlayerId,
      observation.startMs,
      observation.endMs,
    );
  });
  const raidObservations = observations.filter((observation) => observation.type === "RAID_PRESSURE");
  const thirdPartyPressure = thirdPartyPressureFromRaids(raidObservations);

  const byPair = new Map<string, PairSocialObservation[]>();
  for (const observation of observations) {
    const key = pairKey(observation.sourcePlayerId, observation.targetPlayerId);
    const list = byPair.get(key) ?? [];
    list.push(observation);
    byPair.set(key, list);
  }
  const thirdByPair = new Map<string, ThirdPartyPressureObservation[]>();
  for (const episode of thirdPartyPressure) {
    const key = pairKey(episode.playerOneId, episode.playerTwoId);
    const list = thirdByPair.get(key) ?? [];
    list.push(episode);
    thirdByPair.set(key, list);
  }

  const pairEvidence: PairSocialEvidence[] = [];
  for (let left = 0; left < source.playerIds.length; left += 1) {
    for (let right = left + 1; right < source.playerIds.length; right += 1) {
      const one = source.playerIds[left];
      const two = source.playerIds[right];
      const key = pairKey(one, two);
      pairEvidence.push(buildPairSocialEvidence({
        matchId: input.matchId,
        playerOneId: one,
        playerTwoId: two,
        rosterPlayerIds: source.playerIds,
        durationMs: source.match.durationMs,
        diplomacyTimeline: diplomacy.timeline,
        coverage: pairCoverage(diplomacy.timeline, one, two),
        observations: byPair.get(key) ?? [],
        opportunities: [],
        thirdPartyPressure: thirdByPair.get(key) ?? [],
      }));
    }
  }

  const tributeCommands = retainTribute(source, roster);
  const pressureSeen = source.raids.length + source.battles.reduce((sum, battle) => sum + array(battle.directedInteractionEdges).length, 0) + source.forwardBuildings.length;
  const pressureEmitted = observations.filter((row) => row.type === "RAID_PRESSURE" || row.type === "DIRECT_ENGAGEMENT" || row.type === "FORWARD_ENCROACHMENT").length;
  const supportSeen = source.reinforcements.length + source.defensiveAssists.length;
  const supportEmitted = observations.filter((row) => row.type === "ALLY_REINFORCEMENT" || row.type === "DEFENSIVE_ASSIST").length;

  return {
    schemaVersion: BATTLE_SOCIAL_EVIDENCE_ADAPTER_VERSION,
    matchId: input.matchId,
    diplomacyTimeline: diplomacy.timeline,
    pairEvidence,
    tributeCommands,
    diagnostics: {
      raidCandidatesSeen: source.raids.length,
      raidObservationsEmitted: raidObservations.length,
      raidCandidatesSuppressedAllied: Math.max(0, pressureSeen - pressureEmitted),
      raidCandidatesSuppressedUnknownDiplomacy: 0,
      defensiveSupportCandidatesSeen: supportSeen,
      defensiveSupportObservationsEmitted: supportEmitted,
      defensiveSupportSuppressedDiplomacy: Math.max(0, supportSeen - supportEmitted),
      thirdPartyPressureEpisodes: thirdPartyPressure.length,
      tributeCommandsRetained: tributeCommands.length,
      aggregateOnlyPairSignalsNotPromoted: source.enemyBaseContacts.length + source.cooperativeAttacks.length,
    },
  };
}
