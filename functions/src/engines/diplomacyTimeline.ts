export const DIPLOMACY_TIMELINE_VERSION = "AOF_DIPLOMACY_TIMELINE_V1";
export const DIPLOMACY_ACTION_MODE_MAP_VERSION = "AOF_DIPLOMACY_ACTION_MODE_MAP_V1";

export type DiplomacyStance = "ALLY" | "NEUTRAL" | "ENEMY" | "UNKNOWN";
export type DiplomacyCoverage = "QUALIFIED" | "UNAVAILABLE";
export type PairDiplomacyState =
  | "MUTUAL_ALLIANCE"
  | "MUTUAL_HOSTILITY"
  | "MUTUAL_NEUTRALITY"
  | "ONE_SIDED_ALLIANCE"
  | "ONE_SIDED_HOSTILITY"
  | "CONFLICTED"
  | "UNKNOWN";

export interface InitialDiplomacyEdge {
  fromPlayerId: number;
  toPlayerId: number;
  stance: DiplomacyStance;
  sourceVersion: string;
}

export interface RawDiplomacyChange {
  eventId: string;
  atMs: number;
  operationOrdinal: number;
  fromPlayerId: number;
  toPlayerId: number;
  rawMode: number | null;
  rawCommandId: number | null;
  sourceVersion: string;
}

export interface NormalizedDiplomacyChange extends RawDiplomacyChange {
  stance: DiplomacyStance;
  previousStance: DiplomacyStance;
  changed: boolean;
  mappingVersion: typeof DIPLOMACY_ACTION_MODE_MAP_VERSION;
}

export interface DirectedDiplomacySegment {
  fromPlayerId: number;
  toPlayerId: number;
  startMs: number;
  endMs: number;
  stance: DiplomacyStance;
  coverage: DiplomacyCoverage;
  sourceKind: "INITIAL" | "CHANGE" | "UNKNOWN_INITIAL";
  sourceEventId: string | null;
  sourceVersion: string | null;
}

export interface PairDiplomacySegment {
  playerOneId: number;
  playerTwoId: number;
  startMs: number;
  endMs: number;
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
  changes: NormalizedDiplomacyChange[];
  directedSegments: DirectedDiplomacySegment[];
  pairSegments: PairDiplomacySegment[];
  diagnostics: {
    missingInitialEdges: number;
    unknownModeChanges: number;
    noOpChanges: number;
  };
}

interface DirectionState {
  stance: DiplomacyStance;
  startMs: number;
  sourceKind: DirectedDiplomacySegment["sourceKind"];
  sourceEventId: string | null;
  sourceVersion: string | null;
}

function directedKey(fromPlayerId: number, toPlayerId: number): string {
  return `${fromPlayerId}->${toPlayerId}`;
}

function pairKey(playerA: number, playerB: number): string {
  return playerA < playerB ? `${playerA}:${playerB}` : `${playerB}:${playerA}`;
}

function assertPlayerId(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer player id.`);
}

function assertTime(value: number, label: string, durationMs: number): void {
  if (!Number.isFinite(value) || value < 0 || value > durationMs) {
    throw new Error(`${label} must be between 0 and Battle duration ${durationMs}.`);
  }
}

/**
 * Runtime diplomacy-change mapping qualified against aoc-mgz DiplomacyStanceEnum:
 * allied=0, neutral=1, enemy=3. Unsupported values remain UNKNOWN.
 *
 * Header initial diplomacy uses a different integer domain and must be normalized
 * before it enters this engine. Keeping the domains separate is deliberate.
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

function stateCoverage(first: DiplomacyStance, second: DiplomacyStance): DiplomacyCoverage {
  return first === "UNKNOWN" || second === "UNKNOWN" ? "UNAVAILABLE" : "QUALIFIED";
}

function sortedPlayerIds(playerIds: number[]): number[] {
  const result = [...new Set(playerIds)];
  for (const playerId of result) assertPlayerId(playerId, "playerId");
  if (result.length < 2) throw new Error("Diplomacy timeline requires at least two players.");
  return result.sort((a, b) => a - b);
}

function validateInitialEdges(playerIds: Set<number>, edges: InitialDiplomacyEdge[]): Map<string, InitialDiplomacyEdge> {
  const byDirection = new Map<string, InitialDiplomacyEdge>();
  for (const edge of edges) {
    assertPlayerId(edge.fromPlayerId, "initial diplomacy fromPlayerId");
    assertPlayerId(edge.toPlayerId, "initial diplomacy toPlayerId");
    if (edge.fromPlayerId === edge.toPlayerId) throw new Error("Initial diplomacy cannot target self.");
    if (!playerIds.has(edge.fromPlayerId) || !playerIds.has(edge.toPlayerId)) {
      throw new Error("Initial diplomacy references a player outside the Battle roster.");
    }
    if (!edge.sourceVersion) throw new Error("Initial diplomacy sourceVersion is required.");
    const key = directedKey(edge.fromPlayerId, edge.toPlayerId);
    if (byDirection.has(key)) throw new Error(`Duplicate initial diplomacy edge ${key}.`);
    byDirection.set(key, edge);
  }
  return byDirection;
}

function validateChanges(
  playerIds: Set<number>,
  changes: RawDiplomacyChange[],
  durationMs: number,
): RawDiplomacyChange[] {
  const eventIds = new Set<string>();
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
    assertTime(change.atMs, `Diplomacy change ${change.eventId} atMs`, durationMs);
    if (!Number.isInteger(change.operationOrdinal) || change.operationOrdinal < 0) {
      throw new Error(`Diplomacy change ${change.eventId} operationOrdinal must be a non-negative integer.`);
    }
    if (!change.sourceVersion) throw new Error(`Diplomacy change ${change.eventId} sourceVersion is required.`);
  }
  return [...changes].sort(
    (left, right) => left.atMs - right.atMs ||
      left.operationOrdinal - right.operationOrdinal ||
      left.eventId.localeCompare(right.eventId),
  );
}

function finishDirectedSegment(
  result: DirectedDiplomacySegment[],
  fromPlayerId: number,
  toPlayerId: number,
  state: DirectionState,
  endMs: number,
): void {
  if (endMs <= state.startMs) return;
  result.push({
    fromPlayerId,
    toPlayerId,
    startMs: state.startMs,
    endMs,
    stance: state.stance,
    coverage: state.stance === "UNKNOWN" ? "UNAVAILABLE" : "QUALIFIED",
    sourceKind: state.sourceKind,
    sourceEventId: state.sourceEventId,
    sourceVersion: state.sourceVersion,
  });
}

function pairSegmentsFromDirected(
  players: number[],
  directedSegments: DirectedDiplomacySegment[],
  durationMs: number,
): PairDiplomacySegment[] {
  const byDirection = new Map<string, DirectedDiplomacySegment[]>();
  for (const segment of directedSegments) {
    const key = directedKey(segment.fromPlayerId, segment.toPlayerId);
    const list = byDirection.get(key) ?? [];
    list.push(segment);
    byDirection.set(key, list);
  }

  const result: PairDiplomacySegment[] = [];
  for (let left = 0; left < players.length; left += 1) {
    for (let right = left + 1; right < players.length; right += 1) {
      const one = players[left];
      const two = players[right];
      const oneToTwo = byDirection.get(directedKey(one, two)) ?? [];
      const twoToOne = byDirection.get(directedKey(two, one)) ?? [];
      const boundaries = new Set<number>([0, durationMs]);
      for (const segment of [...oneToTwo, ...twoToOne]) {
        boundaries.add(segment.startMs);
        boundaries.add(segment.endMs);
      }
      const ordered = [...boundaries].sort((a, b) => a - b);
      for (let index = 0; index + 1 < ordered.length; index += 1) {
        const startMs = ordered[index];
        const endMs = ordered[index + 1];
        if (endMs <= startMs) continue;
        const first = oneToTwo.find((segment) => segment.startMs <= startMs && segment.endMs > startMs)?.stance ?? "UNKNOWN";
        const second = twoToOne.find((segment) => segment.startMs <= startMs && segment.endMs > startMs)?.stance ?? "UNKNOWN";
        const state = classifyPairDiplomacy(first, second);
        const previous = result[result.length - 1];
        if (
          previous &&
          pairKey(previous.playerOneId, previous.playerTwoId) === pairKey(one, two) &&
          previous.endMs === startMs &&
          previous.playerOneToPlayerTwo === first &&
          previous.playerTwoToPlayerOne === second &&
          previous.state === state
        ) {
          previous.endMs = endMs;
          continue;
        }
        result.push({
          playerOneId: one,
          playerTwoId: two,
          startMs,
          endMs,
          playerOneToPlayerTwo: first,
          playerTwoToPlayerOne: second,
          state,
          coverage: stateCoverage(first, second),
        });
      }
    }
  }
  return result.sort((a, b) =>
    a.playerOneId - b.playerOneId ||
    a.playerTwoId - b.playerTwoId ||
    a.startMs - b.startMs ||
    a.endMs - b.endMs,
  );
}

export function buildDiplomacyTimeline(input: {
  playerIds: number[];
  durationMs: number;
  initialEdges?: InitialDiplomacyEdge[];
  changes?: RawDiplomacyChange[];
}): DiplomacyTimeline {
  if (!Number.isFinite(input.durationMs) || input.durationMs < 0) {
    throw new Error("Diplomacy timeline durationMs must be a non-negative finite number.");
  }
  const durationMs = Math.trunc(input.durationMs);
  const players = sortedPlayerIds(input.playerIds);
  const playerSet = new Set(players);
  const initial = validateInitialEdges(playerSet, input.initialEdges ?? []);
  const changes = validateChanges(playerSet, input.changes ?? [], durationMs);

  const state = new Map<string, DirectionState>();
  let missingInitialEdges = 0;
  for (const from of players) {
    for (const to of players) {
      if (from === to) continue;
      const key = directedKey(from, to);
      const edge = initial.get(key);
      if (!edge) missingInitialEdges += 1;
      state.set(key, {
        stance: edge?.stance ?? "UNKNOWN",
        startMs: 0,
        sourceKind: edge ? "INITIAL" : "UNKNOWN_INITIAL",
        sourceEventId: null,
        sourceVersion: edge?.sourceVersion ?? null,
      });
    }
  }

  const directedSegments: DirectedDiplomacySegment[] = [];
  const normalizedChanges: NormalizedDiplomacyChange[] = [];
  let unknownModeChanges = 0;
  let noOpChanges = 0;

  for (const change of changes) {
    const key = directedKey(change.fromPlayerId, change.toPlayerId);
    const current = state.get(key);
    if (!current) throw new Error(`Missing directed diplomacy state ${key}.`);
    const stance = normalizeDiplomacyActionMode(change.rawMode);
    if (stance === "UNKNOWN") unknownModeChanges += 1;
    const changed = stance !== current.stance;
    if (!changed) noOpChanges += 1;
    normalizedChanges.push({
      ...change,
      stance,
      previousStance: current.stance,
      changed,
      mappingVersion: DIPLOMACY_ACTION_MODE_MAP_VERSION,
    });
    if (!changed) continue;
    finishDirectedSegment(directedSegments, change.fromPlayerId, change.toPlayerId, current, change.atMs);
    state.set(key, {
      stance,
      startMs: change.atMs,
      sourceKind: "CHANGE",
      sourceEventId: change.eventId,
      sourceVersion: change.sourceVersion,
    });
  }

  for (const from of players) {
    for (const to of players) {
      if (from === to) continue;
      const current = state.get(directedKey(from, to));
      if (!current) continue;
      finishDirectedSegment(directedSegments, from, to, current, durationMs);
    }
  }

  directedSegments.sort((a, b) =>
    a.fromPlayerId - b.fromPlayerId ||
    a.toPlayerId - b.toPlayerId ||
    a.startMs - b.startMs ||
    a.endMs - b.endMs,
  );

  return {
    schemaVersion: DIPLOMACY_TIMELINE_VERSION,
    mappingVersion: DIPLOMACY_ACTION_MODE_MAP_VERSION,
    durationMs,
    playerIds: players,
    changes: normalizedChanges,
    directedSegments,
    pairSegments: pairSegmentsFromDirected(players, directedSegments, durationMs),
    diagnostics: {
      missingInitialEdges,
      unknownModeChanges,
      noOpChanges,
    },
  };
}

export function diplomacyAt(
  timeline: DiplomacyTimeline,
  fromPlayerId: number,
  toPlayerId: number,
  atMs: number,
): DiplomacyStance {
  assertTime(atMs, "diplomacyAt atMs", timeline.durationMs);
  if (fromPlayerId === toPlayerId) throw new Error("diplomacyAt does not accept self relations.");
  const segment = timeline.directedSegments.find((item) =>
    item.fromPlayerId === fromPlayerId &&
    item.toPlayerId === toPlayerId &&
    item.startMs <= atMs &&
    (item.endMs > atMs || (atMs === timeline.durationMs && item.endMs === timeline.durationMs)),
  );
  return segment?.stance ?? "UNKNOWN";
}

export function pairDiplomacyAt(
  timeline: DiplomacyTimeline,
  playerA: number,
  playerB: number,
  atMs: number,
): PairDiplomacyState {
  const first = diplomacyAt(timeline, playerA, playerB, atMs);
  const second = diplomacyAt(timeline, playerB, playerA, atMs);
  return classifyPairDiplomacy(first, second);
}
