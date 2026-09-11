export const MATCH_ANALYSIS_VERSION = "MATCH_ANALYSIS_V1_4";
export const OPENING_SEQUENCE_MODEL_VERSION = "OPENING_SEQUENCE_V1_4";
export const PAIR_SPATIAL_MODEL_VERSION = "PAIR_SPATIAL_V1_4";
export const PAIR_INTERACTION_MODEL_VERSION = "PAIR_INTERACTIONS_V1_4";
export const TEAM_INTERACTION_MODEL_VERSION = "TEAM_INTERACTIONS_V1_4";
export const RAID_CANDIDATE_MODEL_VERSION = "RAID_CANDIDATES_V1_4";

export type Confidence = "exact" | "high" | "medium" | "low" | "unavailable";
export type MatchTopology = "DUEL" | "FIXED_TEAMS" | "FFA_OR_DYNAMIC" | "UNKNOWN";

export interface MatchAnalysisConfig {
  openingWindowMs: number;
  targetHomeRadiusTiles: number;
  forwardProgressThreshold: number;
  deepProgressThreshold: number;
  raidClusterGapMs: number;
  raidMinDirectTargetCommands: number;
  ffaRaidMinDirectTargetCommands: number;
  coordinationWindowMs: number;
  defenseResponseBeforeMs: number;
  defenseResponseAfterMs: number;
}

export const DEFAULT_MATCH_ANALYSIS_CONFIG: MatchAnalysisConfig = {
  openingWindowMs: 20 * 60 * 1000,
  targetHomeRadiusTiles: 28,
  forwardProgressThreshold: 0.55,
  deepProgressThreshold: 0.72,
  raidClusterGapMs: 25_000,
  raidMinDirectTargetCommands: 2,
  ffaRaidMinDirectTargetCommands: 3,
  coordinationWindowMs: 12_000,
  defenseResponseBeforeMs: 5_000,
  defenseResponseAfterMs: 30_000,
};

export interface CanonicalEntityRef {
  namespace?: string;
  rawId?: number | string | null;
  displayName?: string | null;
  normalizedKey?: string | null;
  familyKey?: string | null;
  lineKey?: string | null;
  roleKeys?: string[];
}

export interface AnalysisEntityCatalogEntry {
  id: number;
  name: string;
  internalName?: string | null;
  kind: "building" | "unit" | "technology";
  cost?: Record<string, number>;
  trainTime?: number | null;
  researchTime?: number | null;
  roleKeys?: string[];
}

export interface AnalysisEntityCatalog {
  schemaVersion: string;
  sourceVersion: string;
  buildings: Record<string, AnalysisEntityCatalogEntry>;
  units: Record<string, AnalysisEntityCatalogEntry>;
  technologies: Record<string, AnalysisEntityCatalogEntry>;
}

export interface CanonicalPosition {
  x: number;
  y: number;
  z?: number | null;
  tileX?: number | null;
  tileY?: number | null;
}

export interface CanonicalReplayEvent {
  eventId: string;
  eventType: string;
  timestampMs: number;
  operationOrdinal?: number | null;
  sourceOperation?: string;
  actorPlayerId?: number | null;
  targetPlayerId?: number | null;
  objectInstanceIds?: number[];
  targetInstanceId?: number | null;
  entity?: CanonicalEntityRef | null;
  position?: CanonicalPosition | null;
  endPosition?: CanonicalPosition | null;
  payload?: Record<string, unknown>;
}

export interface CanonicalParticipant {
  playerId: number;
  number: number;
  name: string;
  lobbyTeamId?: number | null;
  civilization?: CanonicalEntityRef;
  initialObjectIds?: number[];
}

export interface CanonicalTeam {
  teamId: string;
  memberPlayerIds: number[];
  kind: "fixed" | "solo" | "ffa_initial" | "scenario" | "unknown";
}

export interface CanonicalReplayManifest {
  schemaVersion: string;
  match: {
    matchId: string;
    durationMs: number;
    settings?: Record<string, unknown>;
  };
  participants: CanonicalParticipant[];
  teams: CanonicalTeam[];
  initialState: {
    map: {
      width: number;
      height: number;
      mapId?: number | null;
      mapName?: string | null;
    };
    startAnchors?: Array<{
      playerId: number;
      position: CanonicalPosition;
      method?: string;
    }>;
  };
}

export interface OpeningMilestone {
  eventId: string;
  atMs: number;
  kind: "AGE_CLICK" | "BUILDING_PLACEMENT" | "WALL_PLACEMENT" | "FIRST_UNIT_QUEUE" | "FIRST_RESEARCH" | "FIRST_MARKET_USE";
  label: string;
  entity: CanonicalEntityRef | null;
  amount: number | null;
  position: CanonicalPosition | null;
}

export interface PlayerOpeningAnalysis {
  modelVersion: typeof OPENING_SEQUENCE_MODEL_VERSION;
  windowMs: number;
  ageClicks: {
    feudalAtMs: number | null;
    castleAtMs: number | null;
    imperialAtMs: number | null;
  };
  startContext: "STANDARD_TC_START" | "NO_INITIAL_TC" | "UNKNOWN";
  developmentPace: "FAST_CASTLE_CANDIDATE" | "FAST_FEUDAL_CANDIDATE" | "STANDARD_OR_CONTEXTUAL" | "UNKNOWN";
  reconstructedSequence: OpeningMilestone[];
  sourceOpeningEventCount: number;
  openingClassification: {
    status: "pending_entity_catalog" | "available";
    label: string | null;
    confidence: Confidence;
    primaryStrategy: string | null;
    contextTags: string[];
    strategyTags: string[];
    tags: string[];
    evidenceEventIds: string[];
  };
}

export interface PlayerFundamentals {
  playerId: number;
  totalActionCommands: number;
  buildPlacements: number;
  wallPlacements: number;
  queueCommands: number;
  queuedAmountPositive: number;
  queueSignedNet: number;
  researchCommands: number;
  marketCommands: number;
  tributeSentCommands: number;
  tributeReceivedCommands: number;
  flareCommands: number;
  directEnemyTargetCommands: number;
  targetedOpponentCount: number;
  raidCandidatesPerformed: number;
  raidCandidatesSuffered: number;
  highConfidenceRaidCandidatesPerformed: number;
  highConfidenceRaidCandidatesSuffered: number;
}

export interface StartAnchorAnalysis {
  playerId: number;
  position: CanonicalPosition | null;
  method: "manifest_anchor" | "initial_object_median" | "unavailable";
  contributingObjects: number;
  confidence: Confidence;
}

export interface DirectedPairInteraction {
  fromPlayerId: number;
  toPlayerId: number;
  fixedTeamRelation: "ally" | "opponent" | "unknown";
  directTargetCommands: number;
  directHostileTargetCommands: number;
  firstDirectTargetAtMs: number | null;
  targetRegionCommands: number;
  deepTargetRegionCommands: number;
  firstTargetRegionAtMs: number | null;
  forwardBuildPlacements: number;
  forwardWallPlacements: number;
  tributeCommands: number;
  diplomacyChanges: Array<{ atMs: number; diplomacyMode: number | null; commandId: number | null }>;
  hostileTargetFocusShare: number | null;
  raidCandidateCount: number;
  highConfidenceRaidCandidateCount: number;
  evidenceConfidence: Confidence;
}

export interface RaidCandidate {
  raidCandidateId: string;
  modelVersion: typeof RAID_CANDIDATE_MODEL_VERSION;
  attackerPlayerId: number;
  targetPlayerId: number;
  startMs: number;
  endMs: number;
  directTargetCommands: number;
  nearTargetCommands: number;
  uniqueTargetInstanceCount: number;
  highConfidenceTargetCommands: number;
  mediumConfidenceTargetCommands: number;
  targetFocusShare: number | null;
  distanceToTargetAnchorTiles: number | null;
  eventIds: string[];
  centroid: CanonicalPosition | null;
  confidence: "high" | "medium" | "low";
  formatCaution: "normal" | "ffa_conservative";
}

export interface TeamInteraction {
  playerAId: number;
  playerBId: number;
  coordinatedTargetWindows: number;
  sharedTargetObjectCount: number;
  tributeAtoBCommands: number;
  tributeBtoACommands: number;
  defensiveResponsesByAForB: number;
  defensiveResponsesByBForA: number;
}

export interface TeamSupportCandidate {
  helperPlayerId: number;
  defendedPlayerId: number;
  enemyPlayerId: number;
  raidCandidateId: string;
  responseAtMs: number;
  responseDelayMs: number;
  sourceEventId: string;
  confidence: "high" | "medium";
}

export interface MatchAnalysisV1 {
  schemaVersion: typeof MATCH_ANALYSIS_VERSION;
  sourceCanonicalSchemaVersion: string;
  modelVersions: {
    opening: typeof OPENING_SEQUENCE_MODEL_VERSION;
    spatial: typeof PAIR_SPATIAL_MODEL_VERSION;
    pairInteractions: typeof PAIR_INTERACTION_MODEL_VERSION;
    teamInteractions: typeof TEAM_INTERACTION_MODEL_VERSION;
    raids: typeof RAID_CANDIDATE_MODEL_VERSION;
  };
  match: {
    matchId: string;
    durationMs: number;
    playerCount: number;
    topology: MatchTopology;
    mapWidth: number;
    mapHeight: number;
  };
  startAnchors: StartAnchorAnalysis[];
  players: Array<{
    playerId: number;
    name: string;
    opening: PlayerOpeningAnalysis;
    fundamentals: PlayerFundamentals;
  }>;
  pairInteractions: DirectedPairInteraction[];
  raidCandidates: RaidCandidate[];
  teamInteractions: TeamInteraction[];
  teamSupportCandidates: TeamSupportCandidate[];
  diagnostics: {
    ownedObjectInstances: number;
    objectOwnershipConflicts: number;
    objectOwnerReassignments: number;
    objectOwnerReassignmentsByEventType: Record<string, number>;
    initialDuplicateOwnershipClaims: number;
    ignoredInitialDoppelObjects: number;
    ambiguousProducerInstances: number;
    targetCommandsWithPlayerOwner: number;
    targetCommandsWithSelfOwner: number;
    targetCommandsWithGaiaOwner: number;
    targetCommandsWithUnknownOwner: number;
    targetOwnerResolutionPercent: number;
    combatTargetCommandsWithPlayerOwner: number;
    combatTargetCommandsWithSelfOwner: number;
    combatTargetCommandsWithGaiaOwner: number;
    combatTargetCommandsWithUnknownOwner: number;
    combatTargetOwnerResolutionPercent: number;
    targetOwnerResolutionMethods: Record<string, number>;
    playerOwnedTargetCommandsByEventType: Record<string, number>;
    gaiaOwnedTargetCommandsByEventType: Record<string, number>;
    unknownTargetCommandsByEventType: Record<string, number>;
    diplomacyChangeEvents: number;
    diplomacyModeCounts: Record<string, number>;
    eventsAnalyzed: number;
  };
}

interface SpatialRelation {
  progress: number;
  distanceFromActor: number;
  distanceToTarget: number;
}

const AGE_TECH_IDS = {
  101: "FEUDAL",
  102: "CASTLE",
  103: "IMPERIAL",
} as const;

const SPATIAL_COMMAND_TYPES = new Set([
  "command.move",
  "command.order",
  "command.patrol",
  "command.attack_move",
  "command.attack_ground",
  "command.special",
]);

// ORDER is the only target-bearing action we currently treat as generically hostile.
// SPECIAL has a target_id too, but its semantics vary by ability/order and must be
// classified before it can safely contribute to raids or hostility.
const DIRECT_HOSTILE_TARGET_TYPES = new Set([
  "command.order",
]);

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function integerValue(value: unknown): number | null {
  const valueNumber = numberValue(value);
  return valueNumber == null ? null : Math.trunc(valueNumber);
}

function arrayNumbers(value: unknown): number[] {
  return Array.isArray(value)
    ? value.map(integerValue).filter((item): item is number => item != null)
    : [];
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function distance(a: CanonicalPosition, b: CanonicalPosition): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function spatialRelation(actor: CanonicalPosition, target: CanonicalPosition, point: CanonicalPosition): SpatialRelation | null {
  const vx = target.x - actor.x;
  const vy = target.y - actor.y;
  const magnitudeSquared = vx * vx + vy * vy;
  if (magnitudeSquared <= 0.000001) return null;
  const px = point.x - actor.x;
  const py = point.y - actor.y;
  return {
    progress: (px * vx + py * vy) / magnitudeSquared,
    distanceFromActor: distance(actor, point),
    distanceToTarget: distance(target, point),
  };
}

function entityId(event: CanonicalReplayEvent): number | null {
  return integerValue(event.entity?.rawId);
}

function eventPayload(event: CanonicalReplayEvent): Record<string, unknown> {
  return event.payload ?? {};
}

function cleanEntityName(value: string): string {
  return value.replace(/<br\s*\/?>(?:\n)?/gi, " ").replace(/\s+/g, " ").trim();
}

function catalogEntryForEvent(event: CanonicalReplayEvent, catalog?: AnalysisEntityCatalog): AnalysisEntityCatalogEntry | null {
  if (!catalog) return null;
  const id = entityId(event);
  if (id == null) return null;
  const namespace = event.entity?.namespace ?? "";
  if (namespace.includes("building")) return catalog.buildings[String(id)] ?? null;
  if (namespace.includes("unit")) return catalog.units[String(id)] ?? null;
  if (namespace.includes("technology") || namespace.includes("tech")) return catalog.technologies[String(id)] ?? null;
  if (namespace.includes("object")) {
    const building = catalog.buildings[String(id)] ?? null;
    const unit = catalog.units[String(id)] ?? null;
    if (building && !unit) return building;
    if (unit && !building) return unit;
  }
  return null;
}

function enrichedEntity(event: CanonicalReplayEvent, catalog?: AnalysisEntityCatalog): CanonicalEntityRef | null {
  if (!event.entity) return null;
  const entry = catalogEntryForEvent(event, catalog);
  if (!entry) return event.entity;
  const name = cleanEntityName(entry.name);
  return {
    ...event.entity,
    displayName: name,
    normalizedKey: name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""),
    roleKeys: [...new Set([...(event.entity.roleKeys ?? []), ...(entry.roleKeys ?? [])])],
  };
}

function entityName(event: CanonicalReplayEvent, catalog?: AnalysisEntityCatalog): string | null {
  const enriched = enrichedEntity(event, catalog);
  return enriched?.displayName ?? enriched?.normalizedKey ?? catalogEntryForEvent(event, catalog)?.internalName ?? null;
}

function normalizedName(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/<br\s*\/?>(?:\n)?/gi, " ").replace(/[^a-z0-9]+/g, " ").trim();
}

function eventRoleKeys(event: CanonicalReplayEvent, catalog?: AnalysisEntityCatalog): Set<string> {
  const enriched = enrichedEntity(event, catalog);
  return new Set(enriched?.roleKeys ?? []);
}

function eventHasRole(event: CanonicalReplayEvent, role: string, catalog?: AnalysisEntityCatalog): boolean {
  return eventRoleKeys(event, catalog).has(role);
}

function isStaticTeamKind(kind: CanonicalTeam["kind"]): boolean {
  // `scenario` is used by the current canonical parser when lobby team ids are
  // shared but the lock-teams flag is not authoritative. For analysis purposes
  // those shared team memberships are still the best static ally evidence.
  return kind === "fixed" || kind === "scenario";
}

function sameStaticTeam(manifest: CanonicalReplayManifest, a: number, b: number): boolean {
  return manifest.teams.some((team) =>
    isStaticTeamKind(team.kind) &&
    team.memberPlayerIds.includes(a) &&
    team.memberPlayerIds.includes(b),
  );
}

function hasStaticTeam(manifest: CanonicalReplayManifest, playerId: number): boolean {
  return manifest.teams.some((team) =>
    isStaticTeamKind(team.kind) && team.memberPlayerIds.length > 1 && team.memberPlayerIds.includes(playerId),
  );
}

function fixedRelation(
  manifest: CanonicalReplayManifest,
  topology: MatchTopology,
  a: number,
  b: number,
): "ally" | "opponent" | "unknown" {
  if (topology === "FIXED_TEAMS") {
    if (sameStaticTeam(manifest, a, b)) return "ally";
    if (hasStaticTeam(manifest, a) && hasStaticTeam(manifest, b)) return "opponent";
  }
  if (topology === "DUEL") return "opponent";
  // Dynamic/FFA relations must be resolved at event time from diplomacy history;
  // lobby/scenario team ids are not authoritative once diplomacy can change.
  return "unknown";
}

function sameAnalysisTeam(
  manifest: CanonicalReplayManifest,
  topology: MatchTopology,
  a: number,
  b: number,
): boolean {
  return topology === "FIXED_TEAMS" && sameStaticTeam(manifest, a, b);
}

function detectTopology(manifest: CanonicalReplayManifest, facts: CanonicalReplayEvent[]): MatchTopology {
  if (manifest.participants.length === 2) return "DUEL";

  // Dynamic diplomacy outranks lobby/scenario team ids. In FFA and unlocked
  // diplomacy games the latter can look like shared teams even though relations
  // change during the match.
  if (facts.some((event) => event.eventType === "command.diplomacy_change")) {
    return "FFA_OR_DYNAMIC";
  }
  if (manifest.teams.some((team) => team.kind === "ffa_initial")) {
    return "FFA_OR_DYNAMIC";
  }
  if (manifest.teams.some((team) => isStaticTeamKind(team.kind) && team.memberPlayerIds.length > 1)) {
    return "FIXED_TEAMS";
  }
  return "UNKNOWN";
}

type OwnershipObservationSource = "initial" | "strong_control";

interface OwnershipObservation {
  ownerPlayerId: number;
  atMs: number;
  ordinal: number;
  source: OwnershipObservationSource;
  eventType: string;
}

interface OwnerResolution {
  ownerPlayerId: number | null;
  method: "strong_prior" | "initial_prior" | "future_backfill" | "consistent_producer" | "unresolved";
  confidence: Confidence;
}

interface OwnershipTimelineIndex {
  observations: Map<number, OwnershipObservation[]>;
  consistentProducerOwners: Map<number, number>;
  ambiguousProducerInstances: number;
  distinctInstances: number;
  conflicts: number;
  ownerReassignments: number;
  ownerReassignmentsByEventType: Record<string, number>;
  initialDuplicateClaims: number;
  ignoredInitialDoppelObjects: number;
}

const PRODUCER_CONTROL_EVENT_TYPES = new Set([
  "command.unit_queue",
  "command.research_start",
]);

const STRONG_OBJECT_CONTROL_EVENT_TYPES = new Set([
  "command.move",
  "command.order",
  "command.patrol",
  "command.attack_move",
  "command.attack_ground",
  "command.special",
  "command.stance",
  "command.formation",
  "command.guard_follow",
  "command.stop",
  "command.repair",
  "command.ungarrison",
  "command.back_to_work",
  "command.delete",
  "command.build_placement",
  "command.wall_placement",
  "command.gate",
  "command.drop_relic",
  "command.ai_order",
  "command.autoscout",
  "command.transform",
  "command.ability",
  "command.add_waypoint",
]);

function eventOrdinal(event: CanonicalReplayEvent): number {
  return integerValue(event.operationOrdinal) ?? Number.MAX_SAFE_INTEGER;
}

function buildOwnershipIndex(
  participants: CanonicalParticipant[],
  initialObjects: CanonicalReplayEvent[],
  facts: CanonicalReplayEvent[],
): OwnershipTimelineIndex {
  const validPlayers = new Set(participants.map((player) => player.playerId));
  const validOwners = new Set<number>([0, ...validPlayers]);
  const observations = new Map<number, OwnershipObservation[]>();
  const producerOwners = new Map<number, Set<number>>();
  let conflicts = 0;
  let ownerReassignments = 0;
  const ownerReassignmentsByEventType: Record<string, number> = {};
  let initialDuplicateClaims = 0;
  let ignoredInitialDoppelObjects = 0;

  const addStrong = (instanceId: number, observation: OwnershipObservation): void => {
    if (!validOwners.has(observation.ownerPlayerId)) return;
    const list = observations.get(instanceId) ?? [];
    const previous = list[list.length - 1];
    // Avoid counting repeated selections by the same owner as separate evidence.
    if (previous && previous.ownerPlayerId === observation.ownerPlayerId && previous.atMs === observation.atMs && previous.ordinal === observation.ordinal) {
      return;
    }
    if (previous && previous.ownerPlayerId !== observation.ownerPlayerId) {
      if (observation.atMs > previous.atMs || observation.ordinal > previous.ordinal) {
        ownerReassignments += 1;
        ownerReassignmentsByEventType[observation.eventType] =
          (ownerReassignmentsByEventType[observation.eventType] ?? 0) + 1;
      } else conflicts += 1;
    }
    list.push(observation);
    observations.set(instanceId, list);
  };

  const initialClaims = new Map<number, Set<number>>();
  for (const event of initialObjects) {
    const payload = eventPayload(event);
    const owner = integerValue(payload.ownerPlayerId);
    if (owner == null || !validOwners.has(owner)) continue;
    const blockIndex = integerValue(payload.objectBlockIndex);
    // Preserve the V1.2 guard. Current fixtures do not expose block index 2,
    // but older parser layouts can contain mirrored/doppel object records.
    if (blockIndex === 2) {
      ignoredInitialDoppelObjects += event.objectInstanceIds?.length ?? 0;
      continue;
    }
    for (const instanceId of event.objectInstanceIds ?? []) {
      const claims = initialClaims.get(instanceId) ?? new Set<number>();
      claims.add(owner);
      initialClaims.set(instanceId, claims);
    }
  }

  for (const [instanceId, claims] of initialClaims) {
    if (claims.size !== 1) {
      initialDuplicateClaims += 1;
      conflicts += claims.size - 1;
      continue;
    }
    const [owner] = [...claims];
    addStrong(instanceId, {
      ownerPlayerId: owner,
      atMs: 0,
      ordinal: -1,
      source: "initial",
      eventType: "object.initial",
    });
  }

  for (const event of facts) {
    const actor = event.actorPlayerId;
    if (actor == null || !validPlayers.has(actor)) continue;

    if (PRODUCER_CONTROL_EVENT_TYPES.has(event.eventType)) {
      for (const instanceId of event.objectInstanceIds ?? []) {
        const owners = producerOwners.get(instanceId) ?? new Set<number>();
        owners.add(actor);
        producerOwners.set(instanceId, owners);
      }
      continue;
    }

    if (!STRONG_OBJECT_CONTROL_EVENT_TYPES.has(event.eventType)) continue;
    for (const instanceId of event.objectInstanceIds ?? []) {
      addStrong(instanceId, {
        ownerPlayerId: actor,
        atMs: event.timestampMs,
        ordinal: eventOrdinal(event),
        source: "strong_control",
        eventType: event.eventType,
      });
    }
  }

  for (const list of observations.values()) {
    list.sort((a, b) => a.atMs - b.atMs || a.ordinal - b.ordinal);
  }

  const consistentProducerOwners = new Map<number, number>();
  let ambiguousProducerInstances = 0;
  for (const [instanceId, owners] of producerOwners) {
    if (owners.size === 1) consistentProducerOwners.set(instanceId, [...owners][0]);
    else ambiguousProducerInstances += 1;
  }

  return {
    observations,
    consistentProducerOwners,
    ambiguousProducerInstances,
    distinctInstances: new Set([...observations.keys(), ...producerOwners.keys()]).size,
    conflicts,
    ownerReassignments,
    ownerReassignmentsByEventType,
    initialDuplicateClaims,
    ignoredInitialDoppelObjects,
  };
}

function ownerAtDetailed(
  ownership: OwnershipTimelineIndex,
  instanceId: number,
  event: CanonicalReplayEvent,
): OwnerResolution {
  const list = ownership.observations.get(instanceId) ?? [];
  const atMs = event.timestampMs;
  const ordinal = eventOrdinal(event);
  let previous: OwnershipObservation | null = null;
  let next: OwnershipObservation | null = null;

  for (const observation of list) {
    if (observation.atMs < atMs || (observation.atMs === atMs && observation.ordinal <= ordinal)) {
      previous = observation;
      continue;
    }
    next = observation;
    break;
  }

  if (previous) {
    return {
      ownerPlayerId: previous.ownerPlayerId,
      method: previous.source === "initial" ? "initial_prior" : "strong_prior",
      confidence: previous.source === "initial" ? "high" : "high",
    };
  }

  // Backfill only when every strong observation for this ID agrees on the same
  // owner. This recovers units first seen as attack targets before their owner
  // ever selects them, without guessing across IDs that later change controller.
  if (next && list.every((observation) => observation.ownerPlayerId === next!.ownerPlayerId)) {
    return {
      ownerPlayerId: next.ownerPlayerId,
      method: "future_backfill",
      confidence: "medium",
    };
  }

  const producerOwner = ownership.consistentProducerOwners.get(instanceId);
  if (producerOwner != null) {
    return {
      ownerPlayerId: producerOwner,
      method: "consistent_producer",
      confidence: "medium",
    };
  }

  return { ownerPlayerId: null, method: "unresolved", confidence: "unavailable" };
}

function ownerAt(ownership: OwnershipTimelineIndex, instanceId: number, event: CanonicalReplayEvent): number | null {
  return ownerAtDetailed(ownership, instanceId, event).ownerPlayerId;
}

function buildStartAnchors(
  manifest: CanonicalReplayManifest,
  initialObjects: CanonicalReplayEvent[],
): StartAnchorAnalysis[] {
  const explicit = new Map<number, CanonicalPosition>();
  for (const anchor of manifest.initialState.startAnchors ?? []) explicit.set(anchor.playerId, anchor.position);

  const positions = new Map<number, CanonicalPosition[]>();
  for (const event of initialObjects) {
    const owner = integerValue(eventPayload(event).ownerPlayerId);
    if (owner == null || !event.position) continue;
    const list = positions.get(owner) ?? [];
    list.push(event.position);
    positions.set(owner, list);
  }

  return manifest.participants.map((participant) => {
    const explicitPosition = explicit.get(participant.playerId);
    if (explicitPosition) {
      return {
        playerId: participant.playerId,
        position: explicitPosition,
        method: "manifest_anchor" as const,
        contributingObjects: 1,
        confidence: "high" as const,
      };
    }
    const candidates = positions.get(participant.playerId) ?? [];
    const x = median(candidates.map((item) => item.x));
    const y = median(candidates.map((item) => item.y));
    if (x == null || y == null) {
      return {
        playerId: participant.playerId,
        position: null,
        method: "unavailable" as const,
        contributingObjects: 0,
        confidence: "unavailable" as const,
      };
    }
    return {
      playerId: participant.playerId,
      position: { x, y },
      method: "initial_object_median" as const,
      contributingObjects: candidates.length,
      confidence: candidates.length >= 3 ? "medium" as const : "low" as const,
    };
  });
}

function ageClicksForPlayer(events: CanonicalReplayEvent[]): PlayerOpeningAnalysis["ageClicks"] {
  const result: PlayerOpeningAnalysis["ageClicks"] = { feudalAtMs: null, castleAtMs: null, imperialAtMs: null };
  for (const event of events) {
    if (event.eventType !== "command.research_start") continue;
    const id = entityId(event);
    if (id === 101 && result.feudalAtMs == null) result.feudalAtMs = event.timestampMs;
    if (id === 102 && result.castleAtMs == null) result.castleAtMs = event.timestampMs;
    if (id === 103 && result.imperialAtMs == null) result.imperialAtMs = event.timestampMs;
  }
  return result;
}

function milestoneLabel(
  event: CanonicalReplayEvent,
  kind: OpeningMilestone["kind"],
  catalog?: AnalysisEntityCatalog,
): string {
  const enriched = enrichedEntity(event, catalog);
  const name = enriched?.displayName ?? enriched?.normalizedKey ?? null;
  const raw = enriched?.rawId ?? event.entity?.rawId ?? null;
  const suffix = name ?? (raw == null ? "Unknown" : `#${String(raw)}`);
  if (kind === "AGE_CLICK") {
    const age = AGE_TECH_IDS[entityId(event) as keyof typeof AGE_TECH_IDS];
    return age ? `${age[0]}${age.slice(1).toLowerCase()} Age click` : `${suffix} click`;
  }
  if (kind === "BUILDING_PLACEMENT") return `${suffix} placement`;
  if (kind === "WALL_PLACEMENT") return `${suffix} placement`;
  if (kind === "FIRST_UNIT_QUEUE") return `${suffix} queued`;
  if (kind === "FIRST_RESEARCH") return `${suffix} researched`;
  return "First market use";
}

function classifyOpening(
  events: CanonicalReplayEvent[],
  ageClicks: PlayerOpeningAnalysis["ageClicks"],
  startContext: PlayerOpeningAnalysis["startContext"],
  catalog?: AnalysisEntityCatalog,
): PlayerOpeningAnalysis["openingClassification"] {
  if (!catalog) {
    return {
      status: "pending_entity_catalog",
      label: null,
      confidence: "unavailable",
      primaryStrategy: null,
      contextTags: [],
      strategyTags: [],
      tags: [],
      evidenceEventIds: [],
    };
  }

  const feudal = ageClicks.feudalAtMs;
  const castle = ageClicks.castleAtMs;
  const first = (predicate: (event: CanonicalReplayEvent) => boolean) => events.find(predicate) ?? null;
  const before = (event: CanonicalReplayEvent, limit: number | null) => limit == null || event.timestampMs <= limit;
  const firstAfter = (predicate: (event: CanonicalReplayEvent) => boolean, afterMs: number, beforeMs: number) =>
    events.find((event) => event.timestampMs >= afterMs && event.timestampMs <= beforeMs && predicate(event)) ?? null;

  const dock = first((event) => event.eventType === "command.build_placement" && eventHasRole(event, "dock", catalog));
  const fishingShip = first((event) => event.eventType === "command.unit_queue" && eventHasRole(event, "fishing_ship", catalog));
  const militia = first((event) => event.eventType === "command.unit_queue" && eventHasRole(event, "militia", catalog));
  const manAtArms = first((event) =>
    (event.eventType === "command.unit_queue" || event.eventType === "command.research_start") &&
    eventHasRole(event, "man_at_arms", catalog),
  );
  const scout = first((event) => event.eventType === "command.unit_queue" && eventHasRole(event, "scout_cavalry", catalog));
  const archer = first((event) => event.eventType === "command.unit_queue" && eventHasRole(event, "archer", catalog));
  const skirmisher = first((event) => event.eventType === "command.unit_queue" && eventHasRole(event, "skirmisher", catalog));
  const archeryRange = first((event) => event.eventType === "command.build_placement" && eventHasRole(event, "archery_range", catalog));
  const earlyTower = first((event) =>
    event.eventType === "command.build_placement" &&
    eventHasRole(event, "tower", catalog) &&
    event.timestampMs <= (feudal ?? 10 * 60 * 1000) + 5 * 60 * 1000,
  );

  const standardTimingContext = startContext !== "NO_INITIAL_TC";
  const fastCastle = standardTimingContext && castle != null && castle <= 17 * 60 * 1000;
  const fastFeudal = standardTimingContext && feudal != null && feudal <= 10 * 60 * 1000;

  const darkAgeDock = dock != null && before(dock, feudal);
  const darkAgeFishing = fishingShip != null && before(fishingShip, feudal);
  const waterOpening = darkAgeDock || darkAgeFishing;

  const feudalMilitaryDeadline = castle ?? ((feudal ?? 10 * 60 * 1000) + 7 * 60 * 1000);
  const scoutsOpening = scout != null && scout.timestampMs <= feudalMilitaryDeadline;
  const archersOpening = archer != null && archer.timestampMs <= feudalMilitaryDeadline;
  const skirmisherOpening = skirmisher != null && skirmisher.timestampMs <= feudalMilitaryDeadline;
  const rangeOpening = archeryRange != null && (archersOpening || skirmisherOpening);
  const drush = militia != null && before(militia, feudal);
  const menAtArms = manAtArms != null && manAtArms.timestampMs <= feudalMilitaryDeadline;

  const castleMonk = castle == null ? null : firstAfter(
    (event) => event.eventType === "command.unit_queue" && eventHasRole(event, "monk", catalog),
    castle,
    castle + 7 * 60 * 1000,
  );
  const castleExtraTc = castle == null ? null : firstAfter(
    (event) => event.eventType === "command.build_placement" && eventHasRole(event, "town_center", catalog),
    castle + 1,
    castle + 7 * 60 * 1000,
  );

  const contextTags: string[] = [];
  const strategyTags: string[] = [];
  const evidence = new Set<string>();
  const addContext = (tag: string, source?: CanonicalReplayEvent | null) => {
    if (!contextTags.includes(tag)) contextTags.push(tag);
    if (source) evidence.add(source.eventId);
  };
  const addStrategy = (tag: string, source?: CanonicalReplayEvent | null) => {
    if (!strategyTags.includes(tag)) strategyTags.push(tag);
    if (source) evidence.add(source.eventId);
  };

  if (startContext === "NO_INITIAL_TC") addContext("no_initial_tc");
  if (darkAgeDock) addContext("dark_age_dock", dock);
  if (darkAgeFishing) addContext("dark_age_fishing_economy", fishingShip);
  if (waterOpening) addContext("water_opening", darkAgeDock ? dock : fishingShip);
  if (fastFeudal) addContext("fast_feudal", events.find((event) => event.eventType === "command.research_start" && entityId(event) === 101) ?? null);
  if (fastCastle) addContext("fast_castle", events.find((event) => event.eventType === "command.research_start" && entityId(event) === 102) ?? null);

  if (drush) addStrategy("drush", militia);
  if (menAtArms) addStrategy("men_at_arms", manAtArms);
  if (scoutsOpening) addStrategy("scouts", scout);
  if (archersOpening) addStrategy("archers", archer);
  if (!archersOpening && rangeOpening && skirmisherOpening) addStrategy("range_skirmishers", skirmisher);
  if (earlyTower) addStrategy("early_tower", earlyTower);
  if (fastCastle && castleMonk) addStrategy("fast_castle_monks", castleMonk);
  if (fastCastle && castleExtraTc) addStrategy("fast_castle_boom", castleExtraTc);

  let primaryStrategy: string | null = null;
  let baseLabel: string | null = null;
  let confidence: Confidence = "low";

  // Tactical military evidence outranks generic timing labels.
  if (strategyTags.includes("fast_castle_monks")) {
    primaryStrategy = "FAST_CASTLE_MONKS";
    baseLabel = "Fast Castle → Monks";
    confidence = "high";
  } else if (strategyTags.includes("drush")) {
    primaryStrategy = "DRUSH";
    baseLabel = "Drush";
    confidence = "high";
  } else if (strategyTags.includes("men_at_arms")) {
    primaryStrategy = "MEN_AT_ARMS";
    baseLabel = "Men-at-Arms";
    confidence = "high";
  } else if (strategyTags.includes("scouts")) {
    primaryStrategy = "SCOUTS";
    baseLabel = "Scouts";
    confidence = "high";
  } else if (strategyTags.includes("archers")) {
    primaryStrategy = "ARCHERS";
    baseLabel = "Archers";
    confidence = "high";
  } else if (strategyTags.includes("range_skirmishers")) {
    primaryStrategy = "RANGE_SKIRMISHERS";
    baseLabel = "Skirmisher / Range Opening";
    confidence = "medium";
  } else if (strategyTags.includes("early_tower")) {
    primaryStrategy = "TOWER_PRESSURE";
    baseLabel = "Tower / Donjon Pressure";
    confidence = "medium";
  } else if (strategyTags.includes("fast_castle_boom")) {
    primaryStrategy = "FAST_CASTLE_BOOM";
    baseLabel = "Fast Castle → Boom";
    confidence = "high";
  } else if (fastCastle) {
    primaryStrategy = "FAST_CASTLE";
    baseLabel = "Fast Castle";
    confidence = "medium";
  } else if (waterOpening) {
    primaryStrategy = "WATER_ECONOMY";
    baseLabel = "Water Opening";
    confidence = "high";
  } else if (startContext === "NO_INITIAL_TC") {
    primaryStrategy = "NO_TC_CONTEXTUAL";
    baseLabel = "No-TC Opening";
    confidence = "medium";
  } else if (fastFeudal) {
    primaryStrategy = "FAST_FEUDAL_UNCLASSIFIED";
    baseLabel = "Fast Feudal / Unclassified";
    confidence = "low";
  } else {
    primaryStrategy = "UNCLASSIFIED";
    baseLabel = "Unclassified opening";
    confidence = "low";
  }

  // Context is useful, but should not erase the strategy. A Nomad player can
  // have a water opening; a water player can Fast Castle into a boom.
  let label = baseLabel;
  if (startContext === "NO_INITIAL_TC" && waterOpening) {
    label = baseLabel === "Water Opening" ? "No-TC → Water" : `No-TC → ${baseLabel}`;
  } else if (waterOpening && baseLabel !== "Water Opening") {
    label = `Water → ${baseLabel}`;
  } else if (startContext === "NO_INITIAL_TC" && baseLabel !== "No-TC Opening") {
    label = `No-TC → ${baseLabel}`;
  }

  return {
    status: "available",
    label,
    confidence,
    primaryStrategy,
    contextTags,
    strategyTags,
    tags: [...new Set([...contextTags, ...strategyTags])],
    evidenceEventIds: [...evidence],
  };
}

function analyzeOpening(
  playerId: number,
  facts: CanonicalReplayEvent[],
  initialObjects: CanonicalReplayEvent[],
  config: MatchAnalysisConfig,
  catalog?: AnalysisEntityCatalog,
): PlayerOpeningAnalysis {
  const events = facts
    .filter((event) => event.actorPlayerId === playerId && event.timestampMs <= config.openingWindowMs)
    .sort((a, b) => a.timestampMs - b.timestampMs || a.eventId.localeCompare(b.eventId));
  const ageClicks = ageClicksForPlayer(events);
  const ownInitial = initialObjects.filter((event) => integerValue(eventPayload(event).ownerPlayerId) === playerId);
  let startContext: PlayerOpeningAnalysis["startContext"] = "UNKNOWN";
  if (catalog && ownInitial.length > 0) {
    const hasTownCenter = ownInitial.some((event) => normalizedName(entityName(event, catalog)) === "town center");
    startContext = hasTownCenter ? "STANDARD_TC_START" : "NO_INITIAL_TC";
  }
  const milestones: OpeningMilestone[] = [];
  const firstQueuedUnit = new Set<string>();
  const firstResearch = new Set<string>();
  const seenAgeClicks = new Set<number>();
  let marketSeen = false;
  let sourceOpeningEventCount = 0;

  for (const event of events) {
    let kind: OpeningMilestone["kind"] | null = null;
    if (event.eventType === "command.research_start") {
      sourceOpeningEventCount += 1;
      const id = entityId(event);
      if (id === 101 || id === 102 || id === 103) {
        if (!seenAgeClicks.has(id)) {
          seenAgeClicks.add(id);
          kind = "AGE_CLICK";
        }
      } else {
        const key = String(event.entity?.rawId ?? event.entity?.normalizedKey ?? "unknown");
        if (!firstResearch.has(key)) {
          firstResearch.add(key);
          kind = "FIRST_RESEARCH";
        }
      }
    } else if (event.eventType === "command.build_placement") {
      sourceOpeningEventCount += 1;
      kind = "BUILDING_PLACEMENT";
    } else if (event.eventType === "command.wall_placement") {
      sourceOpeningEventCount += 1;
      kind = "WALL_PLACEMENT";
    } else if (event.eventType === "command.unit_queue") {
      sourceOpeningEventCount += 1;
      const key = String(event.entity?.rawId ?? event.entity?.normalizedKey ?? "unknown");
      if (!firstQueuedUnit.has(key)) {
        firstQueuedUnit.add(key);
        kind = "FIRST_UNIT_QUEUE";
      }
    } else if (event.eventType === "command.market_buy" || event.eventType === "command.market_sell") {
      sourceOpeningEventCount += 1;
      if (!marketSeen) {
        marketSeen = true;
        kind = "FIRST_MARKET_USE";
      }
    }
    if (!kind) continue;
    const amount = integerValue(eventPayload(event).amount);
    milestones.push({
      eventId: event.eventId,
      atMs: event.timestampMs,
      kind,
      label: milestoneLabel(event, kind, catalog),
      entity: enrichedEntity(event, catalog),
      amount,
      position: event.position ?? null,
    });
  }

  let developmentPace: PlayerOpeningAnalysis["developmentPace"] = "UNKNOWN";
  if (startContext !== "NO_INITIAL_TC" && ageClicks.castleAtMs != null && ageClicks.castleAtMs <= 17 * 60 * 1000) developmentPace = "FAST_CASTLE_CANDIDATE";
  else if (startContext !== "NO_INITIAL_TC" && ageClicks.feudalAtMs != null && ageClicks.feudalAtMs <= 10 * 60 * 1000) developmentPace = "FAST_FEUDAL_CANDIDATE";
  else if (ageClicks.feudalAtMs != null || ageClicks.castleAtMs != null) developmentPace = "STANDARD_OR_CONTEXTUAL";

  return {
    modelVersion: OPENING_SEQUENCE_MODEL_VERSION,
    windowMs: config.openingWindowMs,
    ageClicks,
    startContext,
    developmentPace,
    reconstructedSequence: milestones,
    sourceOpeningEventCount,
    openingClassification: classifyOpening(events, ageClicks, startContext, catalog),
  };
}

interface PairWorking {
  pair: DirectedPairInteraction;
  hostileEvents: CanonicalReplayEvent[];
  nearTargetHostileEvents: CanonicalReplayEvent[];
}

function pairKey(fromPlayerId: number, toPlayerId: number): string {
  return `${fromPlayerId}->${toPlayerId}`;
}

function unorderedPairKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function centroid(events: CanonicalReplayEvent[]): CanonicalPosition | null {
  const positions = events.map((event) => event.position).filter((item): item is CanonicalPosition => item != null);
  if (!positions.length) return null;
  return {
    x: positions.reduce((sum, item) => sum + item.x, 0) / positions.length,
    y: positions.reduce((sum, item) => sum + item.y, 0) / positions.length,
  };
}

function groupRaidCandidates(
  fromPlayerId: number,
  toPlayerId: number,
  nearEvents: CanonicalReplayEvent[],
  topology: MatchTopology,
  config: MatchAnalysisConfig,
  ownership: OwnershipTimelineIndex,
  targetAnchor: CanonicalPosition | null,
  targetFocusShare: number | null,
): RaidCandidate[] {
  const ordered = [...nearEvents].sort((a, b) => a.timestampMs - b.timestampMs);
  const groups: CanonicalReplayEvent[][] = [];
  for (const event of ordered) {
    const current = groups[groups.length - 1];
    if (!current || event.timestampMs - current[current.length - 1].timestampMs > config.raidClusterGapMs) groups.push([event]);
    else current.push(event);
  }
  const minimum = topology === "FFA_OR_DYNAMIC" ? config.ffaRaidMinDirectTargetCommands : config.raidMinDirectTargetCommands;
  return groups
    .filter((group) => group.length >= minimum)
    .map((group, index) => {
      let high = 0;
      let medium = 0;
      const targets = new Set<number>();
      for (const event of group) {
        if (event.targetInstanceId != null) targets.add(event.targetInstanceId);
        if (event.targetInstanceId == null) continue;
        const resolution = ownerAtDetailed(ownership, event.targetInstanceId, event);
        if (resolution.ownerPlayerId !== toPlayerId) continue;
        if (resolution.method === "initial_prior" || resolution.method === "strong_prior") high += 1;
        else if (resolution.method === "future_backfill" || resolution.method === "consistent_producer") medium += 1;
      }
      const center = centroid(group);
      const distanceToTarget = center && targetAnchor ? Math.round(distance(center, targetAnchor) * 10) / 10 : null;
      let confidence: "high" | "medium" | "low" = "low";
      if (topology === "FFA_OR_DYNAMIC") {
        // Dynamic diplomacy semantics are preserved but not yet interpreted, so
        // an FFA raid candidate cannot be promoted to high confidence yet.
        confidence = high + medium >= minimum ? "medium" : "low";
      } else if (high >= 2 && group.length >= 3) {
        confidence = "high";
      } else if (high + medium >= minimum) {
        confidence = "medium";
      }

      return {
        raidCandidateId: `raid-${fromPlayerId}-${toPlayerId}-${index + 1}`,
        modelVersion: RAID_CANDIDATE_MODEL_VERSION,
        attackerPlayerId: fromPlayerId,
        targetPlayerId: toPlayerId,
        startMs: group[0].timestampMs,
        endMs: group[group.length - 1].timestampMs,
        directTargetCommands: group.length,
        nearTargetCommands: group.length,
        uniqueTargetInstanceCount: targets.size,
        highConfidenceTargetCommands: high,
        mediumConfidenceTargetCommands: medium,
        targetFocusShare,
        distanceToTargetAnchorTiles: distanceToTarget,
        eventIds: group.map((event) => event.eventId),
        centroid: center,
        confidence,
        formatCaution: topology === "FFA_OR_DYNAMIC" ? "ffa_conservative" as const : "normal" as const,
      };
    });
}

export function analyzeCanonicalReplay(input: {
  manifest: CanonicalReplayManifest;
  facts: CanonicalReplayEvent[];
  initialObjects: CanonicalReplayEvent[];
  entityCatalog?: AnalysisEntityCatalog;
  config?: MatchAnalysisConfig;
}): MatchAnalysisV1 {
  const config = input.config ?? DEFAULT_MATCH_ANALYSIS_CONFIG;
  const participants = [...input.manifest.participants].sort((a, b) => a.playerId - b.playerId);
  const playerIds = new Set(participants.map((player) => player.playerId));
  const actionFacts = input.facts
    .filter((event) => event.sourceOperation === "ACTION" || event.eventType.startsWith("command."))
    .sort((a, b) => a.timestampMs - b.timestampMs || a.eventId.localeCompare(b.eventId));
  const topology = detectTopology(input.manifest, actionFacts);
  const ownership = buildOwnershipIndex(participants, input.initialObjects, actionFacts);
  const anchors = buildStartAnchors(input.manifest, input.initialObjects);
  const anchorByPlayer = new Map(anchors.map((anchor) => [anchor.playerId, anchor.position]));

  const pairs = new Map<string, PairWorking>();
  for (const from of participants) {
    for (const to of participants) {
      if (from.playerId === to.playerId) continue;
      pairs.set(pairKey(from.playerId, to.playerId), {
        pair: {
          fromPlayerId: from.playerId,
          toPlayerId: to.playerId,
          fixedTeamRelation: fixedRelation(input.manifest, topology, from.playerId, to.playerId),
          directTargetCommands: 0,
          directHostileTargetCommands: 0,
          firstDirectTargetAtMs: null,
          targetRegionCommands: 0,
          deepTargetRegionCommands: 0,
          firstTargetRegionAtMs: null,
          forwardBuildPlacements: 0,
          forwardWallPlacements: 0,
          tributeCommands: 0,
          diplomacyChanges: [],
          hostileTargetFocusShare: null,
          raidCandidateCount: 0,
          highConfidenceRaidCandidateCount: 0,
          evidenceConfidence: "low",
        },
        hostileEvents: [],
        nearTargetHostileEvents: [],
      });
    }
  }

  let playerOwnedTarget = 0;
  let selfOwnedTarget = 0;
  let gaiaOwnedTarget = 0;
  let unknownTarget = 0;
  let combatPlayerOwnedTarget = 0;
  let combatSelfOwnedTarget = 0;
  let combatGaiaOwnedTarget = 0;
  let combatUnknownTarget = 0;
  const targetOwnerResolutionMethods: Record<string, number> = {};
  const playerOwnedTargetByEventType: Record<string, number> = {};
  const gaiaOwnedTargetByEventType: Record<string, number> = {};
  const unknownTargetByEventType: Record<string, number> = {};
  const actorHostileTotals = new Map<number, number>();

  for (const event of actionFacts) {
    const actor = event.actorPlayerId;
    if (actor == null || !playerIds.has(actor)) continue;

    const targetInstance = event.targetInstanceId;
    if (targetInstance != null) {
      const resolution = ownerAtDetailed(ownership, targetInstance, event);
      const targetOwner = resolution.ownerPlayerId;
      targetOwnerResolutionMethods[resolution.method] = (targetOwnerResolutionMethods[resolution.method] ?? 0) + 1;
      const isCombatTarget = DIRECT_HOSTILE_TARGET_TYPES.has(event.eventType);

      if (targetOwner === actor) {
        selfOwnedTarget += 1;
        if (isCombatTarget) combatSelfOwnedTarget += 1;
      } else if (targetOwner != null && playerIds.has(targetOwner)) {
        playerOwnedTarget += 1;
        if (isCombatTarget) combatPlayerOwnedTarget += 1;
        playerOwnedTargetByEventType[event.eventType] = (playerOwnedTargetByEventType[event.eventType] ?? 0) + 1;
        const working = pairs.get(pairKey(actor, targetOwner));
        if (working) {
          working.pair.directTargetCommands += 1;
          working.pair.firstDirectTargetAtMs ??= event.timestampMs;
          if (isCombatTarget && working.pair.fixedTeamRelation !== "ally") {
            working.pair.directHostileTargetCommands += 1;
            working.hostileEvents.push(event);
            actorHostileTotals.set(actor, (actorHostileTotals.get(actor) ?? 0) + 1);
            const targetAnchor = anchorByPlayer.get(targetOwner);
            if (event.position && targetAnchor && distance(event.position, targetAnchor) <= config.targetHomeRadiusTiles) {
              working.nearTargetHostileEvents.push(event);
            }
          }
        }
      } else if (targetOwner === 0) {
        gaiaOwnedTarget += 1;
        if (isCombatTarget) combatGaiaOwnedTarget += 1;
        gaiaOwnedTargetByEventType[event.eventType] = (gaiaOwnedTargetByEventType[event.eventType] ?? 0) + 1;
      } else if (targetOwner == null) {
        unknownTarget += 1;
        if (isCombatTarget) combatUnknownTarget += 1;
        unknownTargetByEventType[event.eventType] = (unknownTargetByEventType[event.eventType] ?? 0) + 1;
      }
    }

    if (event.eventType === "command.tribute" && event.targetPlayerId != null && event.targetPlayerId !== actor) {
      pairs.get(pairKey(actor, event.targetPlayerId))!.pair.tributeCommands += 1;
    }
    if (event.eventType === "command.diplomacy_change" && event.targetPlayerId != null && event.targetPlayerId !== actor) {
      const payload = eventPayload(event);
      pairs.get(pairKey(actor, event.targetPlayerId))?.pair.diplomacyChanges.push({
        atMs: event.timestampMs,
        diplomacyMode: integerValue(payload.diplomacy_mode),
        commandId: integerValue(payload.command_id),
      });
    }

    if (event.position && SPATIAL_COMMAND_TYPES.has(event.eventType)) {
      const actorAnchor = anchorByPlayer.get(actor);
      if (actorAnchor) {
        for (const target of participants) {
          if (target.playerId === actor) continue;
          const targetAnchor = anchorByPlayer.get(target.playerId);
          if (!targetAnchor) continue;
          const relation = spatialRelation(actorAnchor, targetAnchor, event.position);
          if (!relation) continue;
          const working = pairs.get(pairKey(actor, target.playerId));
          if (!working) continue;
          if (relation.distanceToTarget <= config.targetHomeRadiusTiles) {
            working.pair.targetRegionCommands += 1;
            working.pair.firstTargetRegionAtMs ??= event.timestampMs;
          }
          if (relation.progress >= config.deepProgressThreshold && relation.distanceToTarget < relation.distanceFromActor) {
            working.pair.deepTargetRegionCommands += 1;
          }
        }
      }
    }

    if (event.position && (event.eventType === "command.build_placement" || event.eventType === "command.wall_placement")) {
      const actorAnchor = anchorByPlayer.get(actor);
      if (!actorAnchor) continue;
      let bestTarget: { playerId: number; distanceToTarget: number } | null = null;
      for (const target of participants) {
        if (target.playerId === actor || sameAnalysisTeam(input.manifest, topology, actor, target.playerId)) continue;
        const targetAnchor = anchorByPlayer.get(target.playerId);
        if (!targetAnchor) continue;
        const relation = spatialRelation(actorAnchor, targetAnchor, event.position);
        if (!relation || relation.progress < config.forwardProgressThreshold || relation.distanceToTarget >= relation.distanceFromActor) continue;
        if (!bestTarget || relation.distanceToTarget < bestTarget.distanceToTarget) {
          bestTarget = { playerId: target.playerId, distanceToTarget: relation.distanceToTarget };
        }
      }
      if (bestTarget) {
        const pair = pairs.get(pairKey(actor, bestTarget.playerId))?.pair;
        if (pair) {
          if (event.eventType === "command.build_placement") pair.forwardBuildPlacements += 1;
          else pair.forwardWallPlacements += 1;
        }
      }
    }
  }

  const raidCandidates: RaidCandidate[] = [];
  for (const working of pairs.values()) {
    const totalHostile = actorHostileTotals.get(working.pair.fromPlayerId) ?? 0;
    working.pair.hostileTargetFocusShare = totalHostile > 0
      ? Math.round((working.pair.directHostileTargetCommands / totalHostile) * 1000) / 10
      : null;
    const pairRaids = working.pair.fixedTeamRelation === "ally"
      ? []
      : groupRaidCandidates(
        working.pair.fromPlayerId,
        working.pair.toPlayerId,
        working.nearTargetHostileEvents,
        topology,
        config,
        ownership,
        anchorByPlayer.get(working.pair.toPlayerId) ?? null,
        working.pair.hostileTargetFocusShare,
      );
    working.pair.raidCandidateCount = pairRaids.length;
    working.pair.highConfidenceRaidCandidateCount = pairRaids.filter((raid) => raid.confidence === "high").length;
    raidCandidates.push(...pairRaids);
    working.pair.evidenceConfidence = working.pair.directTargetCommands > 0
      ? (anchorByPlayer.get(working.pair.toPlayerId) ? "high" : "medium")
      : (working.pair.targetRegionCommands > 0 ? "medium" : "low");
  }

  const teamPairs = new Map<string, TeamInteraction>();
  const analysisTeams = topology === "FIXED_TEAMS"
    ? input.manifest.teams.filter((item) => isStaticTeamKind(item.kind) && item.memberPlayerIds.length > 1)
    : [];
  for (const team of analysisTeams) {
    for (let i = 0; i < team.memberPlayerIds.length; i += 1) {
      for (let j = i + 1; j < team.memberPlayerIds.length; j += 1) {
        const a = team.memberPlayerIds[i];
        const b = team.memberPlayerIds[j];
        teamPairs.set(unorderedPairKey(a, b), {
          playerAId: Math.min(a, b),
          playerBId: Math.max(a, b),
          coordinatedTargetWindows: 0,
          sharedTargetObjectCount: 0,
          tributeAtoBCommands: pairs.get(pairKey(a, b))?.pair.tributeCommands ?? 0,
          tributeBtoACommands: pairs.get(pairKey(b, a))?.pair.tributeCommands ?? 0,
          defensiveResponsesByAForB: 0,
          defensiveResponsesByBForA: 0,
        });
      }
    }
  }

  const targetEvents = new Map<number, CanonicalReplayEvent[]>();
  for (const event of actionFacts) {
    const actor = event.actorPlayerId;
    const target = event.targetInstanceId;
    if (actor == null || target == null || !DIRECT_HOSTILE_TARGET_TYPES.has(event.eventType)) continue;
    const targetOwner = ownerAt(ownership, target, event);
    if (targetOwner == null || targetOwner === actor || sameAnalysisTeam(input.manifest, topology, actor, targetOwner)) continue;
    const list = targetEvents.get(target) ?? [];
    list.push(event);
    targetEvents.set(target, list);
  }

  for (const [targetInstanceId, events] of targetEvents) {
    const sorted = [...events].sort((a, b) => a.timestampMs - b.timestampMs);
    const windows: CanonicalReplayEvent[][] = [];
    for (const event of sorted) {
      const current = windows[windows.length - 1];
      if (!current || event.timestampMs - current[current.length - 1].timestampMs > config.coordinationWindowMs) windows.push([event]);
      else current.push(event);
    }

    const touchedTeamPairs = new Set<string>();
    for (const window of windows) {
      const actors = [...new Set(window.map((event) => event.actorPlayerId).filter((id): id is number => id != null))];
      for (let i = 0; i < actors.length; i += 1) {
        for (let j = i + 1; j < actors.length; j += 1) {
          const a = actors[i];
          const b = actors[j];
          if (!sameAnalysisTeam(input.manifest, topology, a, b)) continue;
          const key = unorderedPairKey(a, b);
          const teamPair = teamPairs.get(key);
          if (!teamPair) continue;
          teamPair.coordinatedTargetWindows += 1;
          touchedTeamPairs.add(key);
        }
      }
    }
    for (const key of touchedTeamPairs) {
      const teamPair = teamPairs.get(key);
      if (teamPair) teamPair.sharedTargetObjectCount += 1;
    }
    void targetInstanceId;
  }

  const teamSupportCandidates: TeamSupportCandidate[] = [];
  for (const raid of raidCandidates) {
    if (raid.confidence === "low") continue;
    const defendedAnchor = anchorByPlayer.get(raid.targetPlayerId);
    if (!defendedAnchor) continue;
    const allies = participants
      .map((player) => player.playerId)
      .filter((playerId) => playerId !== raid.targetPlayerId && sameAnalysisTeam(input.manifest, topology, playerId, raid.targetPlayerId));
    for (const helper of allies) {
      const response = actionFacts.find((event) => {
        if (event.actorPlayerId !== helper || !DIRECT_HOSTILE_TARGET_TYPES.has(event.eventType)) return false;
        if (event.timestampMs < raid.startMs - config.defenseResponseBeforeMs || event.timestampMs > raid.endMs + config.defenseResponseAfterMs) return false;
        const targetOwner = event.targetInstanceId == null ? null : ownerAt(ownership, event.targetInstanceId, event);
        if (targetOwner !== raid.attackerPlayerId) return false;
        return event.position != null && distance(event.position, defendedAnchor) <= config.targetHomeRadiusTiles * 1.25;
      });
      if (!response) continue;
      const delay = Math.max(0, response.timestampMs - raid.startMs);
      teamSupportCandidates.push({
        helperPlayerId: helper,
        defendedPlayerId: raid.targetPlayerId,
        enemyPlayerId: raid.attackerPlayerId,
        raidCandidateId: raid.raidCandidateId,
        responseAtMs: response.timestampMs,
        responseDelayMs: delay,
        sourceEventId: response.eventId,
        confidence: raid.confidence === "high" ? "high" : "medium",
      });
      const key = unorderedPairKey(helper, raid.targetPlayerId);
      const teamPair = teamPairs.get(key);
      if (teamPair) {
        if (helper === teamPair.playerAId) teamPair.defensiveResponsesByAForB += 1;
        else teamPair.defensiveResponsesByBForA += 1;
      }
    }
  }

  const pairInteractions = [...pairs.values()].map((working) => working.pair)
    .sort((a, b) => a.fromPlayerId - b.fromPlayerId || a.toPlayerId - b.toPlayerId);

  const raidsPerformed = new Map<number, number>();
  const raidsSuffered = new Map<number, number>();
  const highRaidsPerformed = new Map<number, number>();
  const highRaidsSuffered = new Map<number, number>();
  for (const raid of raidCandidates) {
    raidsPerformed.set(raid.attackerPlayerId, (raidsPerformed.get(raid.attackerPlayerId) ?? 0) + 1);
    raidsSuffered.set(raid.targetPlayerId, (raidsSuffered.get(raid.targetPlayerId) ?? 0) + 1);
    if (raid.confidence === "high") {
      highRaidsPerformed.set(raid.attackerPlayerId, (highRaidsPerformed.get(raid.attackerPlayerId) ?? 0) + 1);
      highRaidsSuffered.set(raid.targetPlayerId, (highRaidsSuffered.get(raid.targetPlayerId) ?? 0) + 1);
    }
  }

  const players = participants.map((participant) => {
    const ownFacts = actionFacts.filter((event) => event.actorPlayerId === participant.playerId);
    const queues = ownFacts.filter((event) => event.eventType === "command.unit_queue");
    const tributesSent = ownFacts.filter((event) => event.eventType === "command.tribute");
    const tributesReceived = actionFacts.filter((event) => event.eventType === "command.tribute" && event.targetPlayerId === participant.playerId);
    const directEnemyPairs = pairInteractions.filter((pair) => pair.fromPlayerId === participant.playerId && pair.directHostileTargetCommands > 0);
    return {
      playerId: participant.playerId,
      name: participant.name,
      opening: analyzeOpening(participant.playerId, actionFacts, input.initialObjects, config, input.entityCatalog),
      fundamentals: {
        playerId: participant.playerId,
        totalActionCommands: ownFacts.length,
        buildPlacements: ownFacts.filter((event) => event.eventType === "command.build_placement").length,
        wallPlacements: ownFacts.filter((event) => event.eventType === "command.wall_placement").length,
        queueCommands: queues.length,
        queuedAmountPositive: queues.reduce((sum, event) => sum + Math.max(0, integerValue(eventPayload(event).amount) ?? 0), 0),
        queueSignedNet: queues.reduce((sum, event) => sum + (integerValue(eventPayload(event).amount) ?? 0), 0),
        researchCommands: ownFacts.filter((event) => event.eventType === "command.research_start").length,
        marketCommands: ownFacts.filter((event) => event.eventType === "command.market_buy" || event.eventType === "command.market_sell").length,
        tributeSentCommands: tributesSent.length,
        tributeReceivedCommands: tributesReceived.length,
        flareCommands: ownFacts.filter((event) => event.eventType === "command.flare").length,
        directEnemyTargetCommands: directEnemyPairs.reduce((sum, pair) => sum + pair.directHostileTargetCommands, 0),
        targetedOpponentCount: directEnemyPairs.length,
        raidCandidatesPerformed: raidsPerformed.get(participant.playerId) ?? 0,
        raidCandidatesSuffered: raidsSuffered.get(participant.playerId) ?? 0,
        highConfidenceRaidCandidatesPerformed: highRaidsPerformed.get(participant.playerId) ?? 0,
        highConfidenceRaidCandidatesSuffered: highRaidsSuffered.get(participant.playerId) ?? 0,
      },
    };
  });


  const diplomacyModeCounts: Record<string, number> = {};
  for (const event of actionFacts) {
    if (event.eventType !== "command.diplomacy_change") continue;
    const mode = integerValue(eventPayload(event).diplomacy_mode);
    const key = mode == null ? "null" : String(mode);
    diplomacyModeCounts[key] = (diplomacyModeCounts[key] ?? 0) + 1;
  }

  return {
    schemaVersion: MATCH_ANALYSIS_VERSION,
    sourceCanonicalSchemaVersion: input.manifest.schemaVersion,
    modelVersions: {
      opening: OPENING_SEQUENCE_MODEL_VERSION,
      spatial: PAIR_SPATIAL_MODEL_VERSION,
      pairInteractions: PAIR_INTERACTION_MODEL_VERSION,
      teamInteractions: TEAM_INTERACTION_MODEL_VERSION,
      raids: RAID_CANDIDATE_MODEL_VERSION,
    },
    match: {
      matchId: input.manifest.match.matchId,
      durationMs: input.manifest.match.durationMs,
      playerCount: participants.length,
      topology,
      mapWidth: input.manifest.initialState.map.width,
      mapHeight: input.manifest.initialState.map.height,
    },
    startAnchors: anchors,
    players,
    pairInteractions,
    raidCandidates,
    teamInteractions: [...teamPairs.values()].sort((a, b) => a.playerAId - b.playerAId || a.playerBId - b.playerBId),
    teamSupportCandidates,
    diagnostics: {
      ownedObjectInstances: ownership.distinctInstances,
      objectOwnershipConflicts: ownership.conflicts,
      objectOwnerReassignments: ownership.ownerReassignments,
      objectOwnerReassignmentsByEventType: ownership.ownerReassignmentsByEventType,
      initialDuplicateOwnershipClaims: ownership.initialDuplicateClaims,
      ignoredInitialDoppelObjects: ownership.ignoredInitialDoppelObjects,
      ambiguousProducerInstances: ownership.ambiguousProducerInstances,
      targetCommandsWithPlayerOwner: playerOwnedTarget,
      targetCommandsWithSelfOwner: selfOwnedTarget,
      targetCommandsWithGaiaOwner: gaiaOwnedTarget,
      targetCommandsWithUnknownOwner: unknownTarget,
      targetOwnerResolutionPercent: playerOwnedTarget + selfOwnedTarget + gaiaOwnedTarget + unknownTarget > 0
        ? Math.round(((playerOwnedTarget + selfOwnedTarget + gaiaOwnedTarget) / (playerOwnedTarget + selfOwnedTarget + gaiaOwnedTarget + unknownTarget)) * 1000) / 10
        : 100,
      combatTargetCommandsWithPlayerOwner: combatPlayerOwnedTarget,
      combatTargetCommandsWithSelfOwner: combatSelfOwnedTarget,
      combatTargetCommandsWithGaiaOwner: combatGaiaOwnedTarget,
      combatTargetCommandsWithUnknownOwner: combatUnknownTarget,
      combatTargetOwnerResolutionPercent: combatPlayerOwnedTarget + combatSelfOwnedTarget + combatGaiaOwnedTarget + combatUnknownTarget > 0
        ? Math.round(((combatPlayerOwnedTarget + combatSelfOwnedTarget + combatGaiaOwnedTarget) / (combatPlayerOwnedTarget + combatSelfOwnedTarget + combatGaiaOwnedTarget + combatUnknownTarget)) * 1000) / 10
        : 100,
      targetOwnerResolutionMethods,
      playerOwnedTargetCommandsByEventType: playerOwnedTargetByEventType,
      gaiaOwnedTargetCommandsByEventType: gaiaOwnedTargetByEventType,
      unknownTargetCommandsByEventType: unknownTargetByEventType,
      diplomacyChangeEvents: actionFacts.filter((event) => event.eventType === "command.diplomacy_change").length,
      diplomacyModeCounts,
      eventsAnalyzed: actionFacts.length,
    },
  };
}
