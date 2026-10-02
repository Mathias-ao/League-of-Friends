import {
  type DiplomacyStance,
  type InitialDiplomacyEdge,
  type RawDiplomacyChange,
  buildDiplomacyTimeline,
} from "./diplomacyTimeline.js";

export const INITIAL_DIPLOMACY_HEADER_MAP_VERSION = "AOF_INITIAL_DIPLOMACY_HEADER_MAP_V1";
export const DIPLOMACY_EVIDENCE_ADAPTER_VERSION = "AOF_DIPLOMACY_EVIDENCE_ADAPTER_V1";

export interface CanonicalInitialDiplomacyEdgeLike {
  fromPlayerId: number;
  toPlayerId: number;
  stance: string;
}

export interface CanonicalDiplomacyEventLike {
  eventId: string;
  eventType: string;
  timestampMs: number;
  operationOrdinal?: number | null;
  actorPlayerId?: number | null;
  targetPlayerId?: number | null;
  payload?: Record<string, unknown>;
}

export interface DiplomacyEvidenceAdapterResult {
  adapterVersion: typeof DIPLOMACY_EVIDENCE_ADAPTER_VERSION;
  initialSource: "CANONICAL" | "HEADER_RAW_FALLBACK" | "MISSING";
  timeline: ReturnType<typeof buildDiplomacyTimeline>;
  diagnostics: {
    canonicalInitialEdges: number;
    fallbackInitialEdges: number;
    fallbackUnknownValues: number;
    diplomacyChangeEvents: number;
    unexpectedDiplomacyCommandIds: number;
  };
}

function integer(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

/**
 * Header fallback mapping qualified against aoc-mgz MyDiplomacyEnum.
 * The fast header parser skips `their_diplomacy` bytes and exposes the following
 * `my_diplomacy` Int32 array as player.diplomacy. The array is indexed by replay
 * player number (including Gaia at index 0): ally=2, neutral=3, enemy=4.
 *
 * This domain is intentionally separate from runtime GAME diplomacy action modes.
 */
export function normalizeInitialHeaderDiplomacyValue(value: unknown): DiplomacyStance {
  if (value === 2) return "ALLY";
  if (value === 3) return "NEUTRAL";
  if (value === 4) return "ENEMY";
  return "UNKNOWN";
}

function normalizeCanonicalStance(value: string): DiplomacyStance {
  const normalized = value.trim().toLowerCase();
  if (normalized === "ally") return "ALLY";
  if (normalized === "neutral") return "NEUTRAL";
  if (normalized === "enemy") return "ENEMY";
  return "UNKNOWN";
}

export function initialEdgesFromCanonical(
  playerIds: number[],
  canonicalEdges: CanonicalInitialDiplomacyEdgeLike[],
  sourceVersion: string,
): InitialDiplomacyEdge[] {
  const roster = new Set(playerIds);
  return canonicalEdges
    .filter((edge) => roster.has(edge.fromPlayerId) && roster.has(edge.toPlayerId) && edge.fromPlayerId !== edge.toPlayerId)
    .map((edge) => ({
      fromPlayerId: edge.fromPlayerId,
      toPlayerId: edge.toPlayerId,
      stance: normalizeCanonicalStance(edge.stance),
      sourceVersion,
    }));
}

export function initialEdgesFromHeaderRaw(input: {
  playerIds: number[];
  initialDiplomacyRaw: unknown;
}): { edges: InitialDiplomacyEdge[]; unknownValues: number } {
  const matrix = input.initialDiplomacyRaw && typeof input.initialDiplomacyRaw === "object" && !Array.isArray(input.initialDiplomacyRaw)
    ? input.initialDiplomacyRaw as Record<string, unknown>
    : {};
  const edges: InitialDiplomacyEdge[] = [];
  let unknownValues = 0;

  for (const fromPlayerId of input.playerIds) {
    const rowValue = matrix[String(fromPlayerId)];
    if (!Array.isArray(rowValue)) continue;
    for (const toPlayerId of input.playerIds) {
      if (fromPlayerId === toPlayerId) continue;
      if (toPlayerId < 0 || toPlayerId >= rowValue.length) continue;
      const raw = rowValue[toPlayerId];
      const stance = normalizeInitialHeaderDiplomacyValue(raw);
      if (stance === "UNKNOWN") unknownValues += 1;
      edges.push({
        fromPlayerId,
        toPlayerId,
        stance,
        sourceVersion: INITIAL_DIPLOMACY_HEADER_MAP_VERSION,
      });
    }
  }
  return { edges, unknownValues };
}

export function diplomacyChangesFromCanonicalEvents(
  events: CanonicalDiplomacyEventLike[],
  sourceVersion: string,
): { changes: RawDiplomacyChange[]; unexpectedCommandIds: number } {
  const changes: RawDiplomacyChange[] = [];
  let unexpectedCommandIds = 0;
  for (const event of events) {
    if (event.eventType !== "command.diplomacy_change") continue;
    const fromPlayerId = integer(event.actorPlayerId);
    const toPlayerId = integer(event.targetPlayerId);
    const operationOrdinal = integer(event.operationOrdinal);
    if (fromPlayerId == null || toPlayerId == null || operationOrdinal == null) {
      throw new Error(`Diplomacy event ${event.eventId} lacks actor, target, or operation ordinal required for chronology.`);
    }
    const payload = event.payload ?? {};
    const commandId = integer(payload.command_id);
    if (commandId != null && commandId !== 0) unexpectedCommandIds += 1;
    changes.push({
      eventId: event.eventId,
      atMs: event.timestampMs,
      operationOrdinal,
      fromPlayerId,
      toPlayerId,
      rawMode: integer(payload.diplomacy_mode),
      rawCommandId: commandId,
      sourceVersion,
    });
  }
  return { changes, unexpectedCommandIds };
}

export function buildDiplomacyTimelineFromCanonicalEvidence(input: {
  playerIds: number[];
  durationMs: number;
  canonicalInitialDiplomacy?: CanonicalInitialDiplomacyEdgeLike[];
  matchSettings?: Record<string, unknown>;
  events: CanonicalDiplomacyEventLike[];
  canonicalSchemaVersion: string;
}): DiplomacyEvidenceAdapterResult {
  const canonical = initialEdgesFromCanonical(
    input.playerIds,
    input.canonicalInitialDiplomacy ?? [],
    input.canonicalSchemaVersion,
  );
  const fallback = initialEdgesFromHeaderRaw({
    playerIds: input.playerIds,
    initialDiplomacyRaw: input.matchSettings?.initialDiplomacyRaw,
  });
  const initialEdges = canonical.length > 0 ? canonical : fallback.edges;
  const initialSource: DiplomacyEvidenceAdapterResult["initialSource"] = canonical.length > 0
    ? "CANONICAL"
    : fallback.edges.length > 0
      ? "HEADER_RAW_FALLBACK"
      : "MISSING";
  const runtime = diplomacyChangesFromCanonicalEvents(input.events, input.canonicalSchemaVersion);

  return {
    adapterVersion: DIPLOMACY_EVIDENCE_ADAPTER_VERSION,
    initialSource,
    timeline: buildDiplomacyTimeline({
      playerIds: input.playerIds,
      durationMs: input.durationMs,
      initialEdges,
      changes: runtime.changes,
    }),
    diagnostics: {
      canonicalInitialEdges: canonical.length,
      fallbackInitialEdges: fallback.edges.length,
      fallbackUnknownValues: fallback.unknownValues,
      diplomacyChangeEvents: runtime.changes.length,
      unexpectedDiplomacyCommandIds: runtime.unexpectedCommandIds,
    },
  };
}
