import {
  type DiplomacyStance,
  type InitialDiplomacyEdge,
  type RawDiplomacyChange,
  buildDiplomacyTimeline,
} from "./diplomacyTimeline.js";

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
  sourceCanonicalSchemaVersion: string;
  timeline: ReturnType<typeof buildDiplomacyTimeline>;
  diagnostics: {
    canonicalInitialEdges: number;
    canonicalUnknownInitialStances: number;
    diplomacyCommandEvents: number;
  };
}

function integer(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function normalizeCanonicalStance(value: string): DiplomacyStance {
  const normalized = value.trim().toLowerCase();
  if (normalized === "ally") return "ALLY";
  if (normalized === "neutral") return "NEUTRAL";
  if (normalized === "enemy") return "ENEMY";
  return "UNKNOWN";
}

/**
 * Consume only the canonical normalized initial-diplomacy contract here.
 * Header/raw fallback domains deliberately do not belong in this adapter: if
 * canonical initial diplomacy is absent or partial, the timeline stays UNKNOWN.
 */
export function initialEdgesFromCanonical(
  playerIds: number[],
  canonicalEdges: CanonicalInitialDiplomacyEdgeLike[],
  sourceVersion: string,
): { edges: InitialDiplomacyEdge[]; unknownStances: number } {
  if (!sourceVersion) throw new Error("Canonical diplomacy sourceVersion is required.");
  const roster = new Set(playerIds);
  const edges: InitialDiplomacyEdge[] = [];
  let unknownStances = 0;
  for (const edge of canonicalEdges) {
    if (!roster.has(edge.fromPlayerId) || !roster.has(edge.toPlayerId) || edge.fromPlayerId === edge.toPlayerId) continue;
    const stance = normalizeCanonicalStance(edge.stance);
    if (stance === "UNKNOWN") unknownStances += 1;
    edges.push({
      fromPlayerId: edge.fromPlayerId,
      toPlayerId: edge.toPlayerId,
      stance,
      sourceVersion,
    });
  }
  return { edges, unknownStances };
}

/**
 * Canonical replay events currently qualify the actor/target/raw-mode command,
 * not the successful effective state change. Every imported runtime event is
 * therefore COMMAND_ONLY until a separately qualified adapter can prove more.
 */
export function diplomacyChangesFromCanonicalEvents(
  events: CanonicalDiplomacyEventLike[],
  sourceVersion: string,
): RawDiplomacyChange[] {
  if (!sourceVersion) throw new Error("Canonical diplomacy sourceVersion is required.");
  const changes: RawDiplomacyChange[] = [];
  for (const event of events) {
    if (event.eventType !== "command.diplomacy_change") continue;
    const fromPlayerId = integer(event.actorPlayerId);
    const toPlayerId = integer(event.targetPlayerId);
    const operationOrdinal = integer(event.operationOrdinal);
    if (fromPlayerId == null || toPlayerId == null || operationOrdinal == null) {
      throw new Error(`Diplomacy event ${event.eventId} lacks actor, target, or operation ordinal required for chronology.`);
    }
    const payload = event.payload ?? {};
    changes.push({
      eventId: event.eventId,
      atMs: event.timestampMs,
      operationOrdinal,
      fromPlayerId,
      toPlayerId,
      rawMode: integer(payload.diplomacy_mode),
      rawCommandId: integer(payload.command_id),
      sourceVersion,
      effectQualification: "COMMAND_ONLY",
    });
  }
  return changes;
}

export function buildDiplomacyTimelineFromCanonicalEvidence(input: {
  playerIds: number[];
  durationMs: number;
  canonicalInitialDiplomacy?: CanonicalInitialDiplomacyEdgeLike[];
  events: CanonicalDiplomacyEventLike[];
  canonicalSchemaVersion: string;
}): DiplomacyEvidenceAdapterResult {
  const initial = initialEdgesFromCanonical(
    input.playerIds,
    input.canonicalInitialDiplomacy ?? [],
    input.canonicalSchemaVersion,
  );
  const changes = diplomacyChangesFromCanonicalEvents(input.events, input.canonicalSchemaVersion);
  return {
    adapterVersion: DIPLOMACY_EVIDENCE_ADAPTER_VERSION,
    sourceCanonicalSchemaVersion: input.canonicalSchemaVersion,
    timeline: buildDiplomacyTimeline({
      playerIds: input.playerIds,
      durationMs: input.durationMs,
      initialEdges: initial.edges,
      changes,
    }),
    diagnostics: {
      canonicalInitialEdges: initial.edges.length,
      canonicalUnknownInitialStances: initial.unknownStances,
      diplomacyCommandEvents: changes.length,
    },
  };
}
