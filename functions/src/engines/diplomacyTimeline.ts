export const DIPLOMACY_TIMELINE_VERSION = "AOF_DIPLOMACY_TIMELINE_V2";
export const DIPLOMACY_ACTION_MODE_MAP_VERSION = "AOF_DIPLOMACY_ACTION_MODE_MAP_V1";

/** Replay chronology is (game-clock millisecond, operation ordinal). */
export interface ReplayMoment {
  atMs: number;
  operationOrdinal: number;
}

export type DiplomacyStance = "ALLY" | "NEUTRAL" | "ENEMY" | "UNKNOWN";
export type DiplomacyCoverage = "QUALIFIED" | "UNAVAILABLE";
export type DiplomacyChangeEffectQualification = "COMMAND_ONLY" | "EFFECTIVE_STATE_QUALIFIED";
export type PairDiplomacyState =
  | "MUTUAL_ALLIANCE"
  | "MUTUAL_HOSTILITY"
  | "MUTUAL_NEUTRALITY"
  | "ONE_SIDED_ALLIANCE"
  | "ONE_SIDED_HOSTILITY"
  | "CONFLICTED"
  | "UNKNOWN";

/** Effective initial state only; raw header vectors do not belong here. */
export interface InitialDiplomacyEdge {
  fromPlayerId: number;
  toPlayerId: number;
  stance: DiplomacyStance;
  sourceVersion: string;
}

/**
 * A decoded diplomacy action is not automatically proof that game state changed.
 * `effectQualification` makes that distinction explicit at the type boundary.
 */
export interface RawDiplomacyChange {
  eventId: string;
  atMs: number;
  operationOrdinal: number;
  fromPlayerId: number;
  toPlayerId: number;
  rawMode: number | null;
  rawCommandId: number | null;
  sourceVersion: string;
  effectQualification: DiplomacyChangeEffectQualification;
}

export interface NormalizedDiplomacyChange extends RawDiplomacyChange {
  commandedStance: DiplomacyStance;
  previousEffectiveStance: DiplomacyStance;
  effectiveStanceAfter: DiplomacyStance;
  effectiveStateChanged: boolean;
  effectiveStateInvalidated: boolean;
  effectiveStateEstablished: boolean;
  knowledgeStateChanged: boolean;
  mappingVersion: typeof DIPLOMACY_ACTION_MODE_MAP_VERSION;
}

export interface PairDiplomacySegment {
  playerOneId: number;
  playerTwoId: number;
  start: ReplayMoment;
  end: ReplayMoment;
  elapsedMs: number;
  playerOneToPlayerTwo: DiplomacyStance;
  playerTwoToPlayerOne: DiplomacyStance;
  state: PairDiplomacyState;
  coverage: DiplomacyCoverage;
}

export interface DiplomacyTimeline {
  schemaVersion: typeof DIPLOMACY_TIMELINE_VERSION;
  mappingVersion: typeof DIPLOMACY_ACTION_MODE_MAP_VERSION;
  durationMs: number;
  playerIds: number[];
  initialEdges: InitialDiplomacyEdge[];
  changes: NormalizedDiplomacyChange[];
  pairSegments: PairDiplomacySegment[];
  diagnostics: {
    missingInitialEdges: number;
    unknownInitialEdges: number;
    unknownModeCommands: number;
    commandOnlyChanges: number;
    qualifiedEffectiveChanges: number;
    qualifiedNoOpChanges: number;
    effectiveStateInvalidations: number;
    qualifiedStateEstablishments: number;
  };
}

const INITIAL_ORDINAL = -1;
const BATTLE_END_ORDINAL = Number.MAX_SAFE_INTEGER;

function directedKey(fromPlayerId: number, toPlayerId: number): string {
  return `${fromPlayerId}->${toPlayerId}`;
}

function assertPlayerId(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer player id.`);
}

function assertDuration(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Diplomacy timeline durationMs must be a non-negative safe integer.");
  return value;
}

function assertEventMoment(moment: ReplayMoment, durationMs: number, label: string): void {
  if (!Number.isSafeInteger(moment.atMs) || moment.atMs < 0 || moment.atMs > durationMs) {
    throw new Error(`${label} atMs must be between 0 and Battle duration ${durationMs}.`);
  }
  if (!Number.isSafeInteger(moment.operationOrdinal) || moment.operationOrdinal < 0) {
    throw new Error(`${label} operationOrdinal must be a non-negative integer.`);
  }
}

export function compareReplayMoments(left: ReplayMoment, right: ReplayMoment): number {
  return left.atMs - right.atMs || left.operationOrdinal - right.operationOrdinal;
}

function sameMoment(left: ReplayMoment, right: ReplayMoment): boolean {
  return left.atMs === right.atMs && left.operationOrdinal === right.operationOrdinal;
}

/**
 * Maps the observed diplomacy ACTION payload only. This does not itself claim
 * the game accepted the command or changed effective state.
 */
export function normalizeDiplomacyActionMode(rawMode: number | null): DiplomacyStance {
  if (rawMode === 0) return "ALLY";
  if (rawMode === 1) return "NEUTRAL";
  if (rawMode === 3) return "ENEMY";
  return "UNKNOWN";
}

export function classifyPairDiplomacy(
  firstToSecond: DiplomacyStance,
  secondToFirst: DiplomacyStance,
): PairDiplomacyState {
  if (firstToSecond === "UNKNOWN" || secondToFirst === "UNKNOWN") return "UNKNOWN";
  if (firstToSecond === "ALLY" && secondToFirst === "ALLY") return "MUTUAL_ALLIANCE";
  if (firstToSecond === "ENEMY" && secondToFirst === "ENEMY") return "MUTUAL_HOSTILITY";
  if (firstToSecond === "NEUTRAL" && secondToFirst === "NEUTRAL") return "MUTUAL_NEUTRALITY";
  if (
    (firstToSecond === "ALLY" && secondToFirst === "ENEMY") ||
    (firstToSecond === "ENEMY" && secondToFirst === "ALLY")
  ) return "CONFLICTED";
  if (firstToSecond === "ALLY" || secondToFirst === "ALLY") return "ONE_SIDED_ALLIANCE";
  if (firstToSecond === "ENEMY" || secondToFirst === "ENEMY") return "ONE_SIDED_HOSTILITY";
  return "UNKNOWN";
}

function coverageFor(first: DiplomacyStance, second: DiplomacyStance): DiplomacyCoverage {
  return first === "UNKNOWN" || second === "UNKNOWN" ? "UNAVAILABLE" : "QUALIFIED";
}

function sortedPlayerIds(playerIds: number[]): number[] {
  if (new Set(playerIds).size !== playerIds.length) throw new Error('Duplicate diplomacy roster player id.');
  const result = [...playerIds];
  for (const playerId of result) assertPlayerId(playerId, "playerId");
  if (result.length < 2) throw new Error("Diplomacy timeline requires at least two players.");
  return result.sort((a, b) => a - b);
}

function validateInitialEdges(
  playerIds: Set<number>,
  edges: InitialDiplomacyEdge[],
): Map<string, InitialDiplomacyEdge> {
  const result = new Map<string, InitialDiplomacyEdge>();
  for (const edge of edges) {
    assertPlayerId(edge.fromPlayerId, "initial diplomacy fromPlayerId");
    assertPlayerId(edge.toPlayerId, "initial diplomacy toPlayerId");
    if (edge.fromPlayerId === edge.toPlayerId) throw new Error("Initial diplomacy cannot target self.");
    if (!playerIds.has(edge.fromPlayerId) || !playerIds.has(edge.toPlayerId)) {
      throw new Error("Initial diplomacy references a player outside the Battle roster.");
    }
    if (!edge.sourceVersion) throw new Error("Initial diplomacy sourceVersion is required.");
    if (!["ALLY","NEUTRAL","ENEMY","UNKNOWN"].includes(edge.stance)) throw new Error("Invalid initial diplomacy stance.");
    const key = directedKey(edge.fromPlayerId, edge.toPlayerId);
    if (result.has(key)) throw new Error(`Duplicate initial diplomacy edge ${key}.`);
    result.set(key, { ...edge });
  }
  return result;
}

function validateAndSortChanges(
  playerIds: Set<number>,
  changes: RawDiplomacyChange[],
  durationMs: number,
): RawDiplomacyChange[] {
  const eventIds = new Set<string>();
  const directedMoments = new Set<string>();
  for (const change of changes) {
    if (!change.eventId) throw new Error("Diplomacy change eventId is required.");
    if (eventIds.has(change.eventId)) throw new Error(`Duplicate diplomacy change eventId ${change.eventId}.`);
    eventIds.add(change.eventId);
    assertPlayerId(change.fromPlayerId, "diplomacy change fromPlayerId");
    assertPlayerId(change.toPlayerId, "diplomacy change toPlayerId");
    if (change.fromPlayerId === change.toPlayerId) throw new Error("Diplomacy change cannot target self.");
    if (!playerIds.has(change.fromPlayerId) || !playerIds.has(change.toPlayerId)) {
      throw new Error(`Diplomacy change ${change.eventId} references a player outside the Battle roster.`);
    }
    assertEventMoment(
      { atMs: change.atMs, operationOrdinal: change.operationOrdinal },
      durationMs,
      `Diplomacy change ${change.eventId}`,
    );
    if (!change.sourceVersion) throw new Error(`Diplomacy change ${change.eventId} sourceVersion is required.`);
    for (const raw of [change.rawMode,change.rawCommandId]) if (raw !== null && !Number.isSafeInteger(raw)) throw new Error("Invalid raw diplomacy mode or command id.");
    if (change.effectQualification !== "COMMAND_ONLY" && change.effectQualification !== "EFFECTIVE_STATE_QUALIFIED") {
      throw new Error(`Diplomacy change ${change.eventId} has an unsupported effectQualification.`);
    }

    const momentKey = `${directedKey(change.fromPlayerId, change.toPlayerId)}@${change.atMs}:${change.operationOrdinal}`;
    if (directedMoments.has(momentKey)) {
      throw new Error(`Ambiguous diplomacy changes share the same replay moment for ${directedKey(change.fromPlayerId, change.toPlayerId)}.`);
    }
    directedMoments.add(momentKey);
  }
  return [...changes].sort((left, right) =>
    left.atMs - right.atMs ||
    left.operationOrdinal - right.operationOrdinal ||
    left.eventId.localeCompare(right.eventId),
  );
}

function normalizeChanges(
  players: number[],
  initialByDirection: Map<string, InitialDiplomacyEdge>,
  changes: RawDiplomacyChange[],
): {
  changes: NormalizedDiplomacyChange[];
  unknownModeCommands: number;
  commandOnlyChanges: number;
  qualifiedEffectiveChanges: number;
  qualifiedNoOpChanges: number;
  effectiveStateInvalidations: number;
  qualifiedStateEstablishments: number;
} {
  const current = new Map<string, DiplomacyStance>();
  for (const from of players) {
    for (const to of players) {
      if (from === to) continue;
      current.set(directedKey(from, to), initialByDirection.get(directedKey(from, to))?.stance ?? "UNKNOWN");
    }
  }

  const normalized: NormalizedDiplomacyChange[] = [];
  let unknownModeCommands = 0;
  let commandOnlyChanges = 0;
  let qualifiedEffectiveChanges = 0;
  let qualifiedNoOpChanges = 0;
  let effectiveStateInvalidations = 0;
  let qualifiedStateEstablishments = 0;

  for (const change of changes) {
    const key = directedKey(change.fromPlayerId, change.toPlayerId);
    const previousEffectiveStance = current.get(key) ?? "UNKNOWN";
    const commandedStance = normalizeDiplomacyActionMode(change.rawMode);
    if (commandedStance === "UNKNOWN") unknownModeCommands += 1;

    let effectiveStanceAfter = previousEffectiveStance;
    let effectiveStateChanged = false;
    let effectiveStateInvalidated = false;
    let effectiveStateEstablished = false;
    if (change.effectQualification === "COMMAND_ONLY") {
      commandOnlyChanges += 1;
      // The old stance is historical knowledge, not proof it still holds after
      // an unverified order. Unknown modes and apparent repeats also fail closed.
      effectiveStanceAfter = 'UNKNOWN';
      effectiveStateInvalidated = previousEffectiveStance !== 'UNKNOWN';
      if (effectiveStateInvalidated) effectiveStateInvalidations += 1;
      current.set(key, effectiveStanceAfter);
    } else {
      if (commandedStance === "UNKNOWN") {
        throw new Error(`Diplomacy change ${change.eventId} cannot be EFFECTIVE_STATE_QUALIFIED with an unknown command mode.`);
      }
      effectiveStanceAfter = commandedStance;
      effectiveStateEstablished = previousEffectiveStance === 'UNKNOWN';
      effectiveStateChanged = !effectiveStateEstablished && effectiveStanceAfter !== previousEffectiveStance;
      if (effectiveStateEstablished) qualifiedStateEstablishments += 1;
      else if (effectiveStateChanged) qualifiedEffectiveChanges += 1;
      else qualifiedNoOpChanges += 1;
      current.set(key, effectiveStanceAfter);
    }

    normalized.push({
      ...change,
      commandedStance,
      previousEffectiveStance,
      effectiveStanceAfter,
      effectiveStateChanged,
      effectiveStateInvalidated,
      effectiveStateEstablished,
      knowledgeStateChanged: effectiveStanceAfter !== previousEffectiveStance,
      mappingVersion: DIPLOMACY_ACTION_MODE_MAP_VERSION,
    });
  }

  return {
    changes: normalized,
    unknownModeCommands,
    commandOnlyChanges,
    qualifiedEffectiveChanges,
    qualifiedNoOpChanges,
    effectiveStateInvalidations,
    qualifiedStateEstablishments,
  };
}

function initialStance(
  initialByDirection: Map<string, InitialDiplomacyEdge>,
  fromPlayerId: number,
  toPlayerId: number,
): DiplomacyStance {
  return initialByDirection.get(directedKey(fromPlayerId, toPlayerId))?.stance ?? "UNKNOWN";
}

function stanceFromEvidence(
  initialByDirection: Map<string, InitialDiplomacyEdge>,
  changes: NormalizedDiplomacyChange[],
  fromPlayerId: number,
  toPlayerId: number,
  moment: ReplayMoment,
): DiplomacyStance {
  let stance = initialStance(initialByDirection, fromPlayerId, toPlayerId);
  for (const change of changes) {
    if (
      change.fromPlayerId !== fromPlayerId ||
      change.toPlayerId !== toPlayerId ||
      !change.knowledgeStateChanged
    ) continue;
    const changeMoment = { atMs: change.atMs, operationOrdinal: change.operationOrdinal };
    if (compareReplayMoments(changeMoment, moment) > 0) break;
    stance = change.effectiveStanceAfter;
  }
  return stance;
}

function buildPairSegments(
  players: number[],
  durationMs: number,
  initialByDirection: Map<string, InitialDiplomacyEdge>,
  changes: NormalizedDiplomacyChange[],
): PairDiplomacySegment[] {
  const start: ReplayMoment = { atMs: 0, operationOrdinal: INITIAL_ORDINAL };
  const end: ReplayMoment = { atMs: durationMs, operationOrdinal: BATTLE_END_ORDINAL };
  const result: PairDiplomacySegment[] = [];

  for (let left = 0; left < players.length; left += 1) {
    for (let right = left + 1; right < players.length; right += 1) {
      const one = players[left];
      const two = players[right];
      const boundaries: ReplayMoment[] = [start, end];
      for (const change of changes) {
        if (!change.knowledgeStateChanged) continue;
        const belongsToPair =
          (change.fromPlayerId === one && change.toPlayerId === two) ||
          (change.fromPlayerId === two && change.toPlayerId === one);
        if (!belongsToPair) continue;
        boundaries.push({ atMs: change.atMs, operationOrdinal: change.operationOrdinal });
      }
      boundaries.sort(compareReplayMoments);
      const uniqueBoundaries = boundaries.filter((moment, index) => index === 0 || !sameMoment(moment, boundaries[index - 1]));

      for (let index = 0; index + 1 < uniqueBoundaries.length; index += 1) {
        const segmentStart = uniqueBoundaries[index];
        const segmentEnd = uniqueBoundaries[index + 1];
        if (compareReplayMoments(segmentEnd, segmentStart) <= 0) continue;
        const oneToTwo = stanceFromEvidence(initialByDirection, changes, one, two, segmentStart);
        const twoToOne = stanceFromEvidence(initialByDirection, changes, two, one, segmentStart);
        const state = classifyPairDiplomacy(oneToTwo, twoToOne);
        const segment: PairDiplomacySegment = {
          playerOneId: one,
          playerTwoId: two,
          start: { ...segmentStart },
          end: { ...segmentEnd },
          elapsedMs: Math.max(0, segmentEnd.atMs - segmentStart.atMs),
          playerOneToPlayerTwo: oneToTwo,
          playerTwoToPlayerOne: twoToOne,
          state,
          coverage: coverageFor(oneToTwo, twoToOne),
        };
        const previous = result[result.length - 1];
        if (
          previous &&
          previous.playerOneId === one &&
          previous.playerTwoId === two &&
          sameMoment(previous.end, segment.start) &&
          previous.playerOneToPlayerTwo === segment.playerOneToPlayerTwo &&
          previous.playerTwoToPlayerOne === segment.playerTwoToPlayerOne &&
          previous.state === segment.state &&
          previous.coverage === segment.coverage
        ) {
          previous.end = { ...segment.end };
          previous.elapsedMs += segment.elapsedMs;
        } else {
          result.push(segment);
        }
      }
    }
  }
  return result;
}

export function buildDiplomacyTimeline(input: {
  playerIds: number[];
  durationMs: number;
  initialEdges?: InitialDiplomacyEdge[];
  changes?: RawDiplomacyChange[];
}): DiplomacyTimeline {
  const durationMs = assertDuration(input.durationMs);
  const players = sortedPlayerIds(input.playerIds);
  const playerSet = new Set(players);
  const initialByDirection = validateInitialEdges(playerSet, input.initialEdges ?? []);
  const rawChanges = validateAndSortChanges(playerSet, input.changes ?? [], durationMs);
  const normalized = normalizeChanges(players, initialByDirection, rawChanges);

  let missingInitialEdges = 0;
  let unknownInitialEdges = 0;
  for (const from of players) {
    for (const to of players) {
      if (from === to) continue;
      const edge = initialByDirection.get(directedKey(from, to));
      if (!edge) missingInitialEdges += 1;
      else if (edge.stance === "UNKNOWN") unknownInitialEdges += 1;
    }
  }

  return {
    schemaVersion: DIPLOMACY_TIMELINE_VERSION,
    mappingVersion: DIPLOMACY_ACTION_MODE_MAP_VERSION,
    durationMs,
    playerIds: players,
    initialEdges: [...initialByDirection.values()].sort((a, b) =>
      a.fromPlayerId - b.fromPlayerId || a.toPlayerId - b.toPlayerId,
    ),
    changes: normalized.changes,
    pairSegments: buildPairSegments(players, durationMs, initialByDirection, normalized.changes),
    diagnostics: {
      missingInitialEdges,
      unknownInitialEdges,
      unknownModeCommands: normalized.unknownModeCommands,
      commandOnlyChanges: normalized.commandOnlyChanges,
      qualifiedEffectiveChanges: normalized.qualifiedEffectiveChanges,
      qualifiedNoOpChanges: normalized.qualifiedNoOpChanges,
      effectiveStateInvalidations: normalized.effectiveStateInvalidations,
      qualifiedStateEstablishments: normalized.qualifiedStateEstablishments,
    },
  };
}

function assertTimelinePlayer(timeline: DiplomacyTimeline, playerId: number, label: string): void {
  assertPlayerId(playerId, label);
  if (!timeline.playerIds.includes(playerId)) throw new Error(`${label} is outside the diplomacy timeline roster.`);
}

export function diplomacyAt(
  timeline: DiplomacyTimeline,
  fromPlayerId: number,
  toPlayerId: number,
  moment: ReplayMoment,
): DiplomacyStance {
  assertTimelinePlayer(timeline, fromPlayerId, "fromPlayerId");
  assertTimelinePlayer(timeline, toPlayerId, "toPlayerId");
  if (fromPlayerId === toPlayerId) throw new Error("Diplomacy stance toward self is not a pair relation.");
  assertEventMoment(moment, timeline.durationMs, "diplomacy query");
  const initialByDirection = new Map(timeline.initialEdges.map((edge) => [directedKey(edge.fromPlayerId, edge.toPlayerId), edge]));
  return stanceFromEvidence(initialByDirection, timeline.changes, fromPlayerId, toPlayerId, moment);
}

export function pairDiplomacyAt(
  timeline: DiplomacyTimeline,
  playerA: number,
  playerB: number,
  moment: ReplayMoment,
): PairDiplomacyState {
  const [one, two] = [playerA, playerB].sort((left, right) => left - right);
  const oneToTwo = diplomacyAt(timeline, one, two, moment);
  const twoToOne = diplomacyAt(timeline, two, one, moment);
  return classifyPairDiplomacy(oneToTwo, twoToOne);
}
