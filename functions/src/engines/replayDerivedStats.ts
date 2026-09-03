export const REPLAY_DERIVED_STATS_VERSION = "REPLAY_DERIVED_STATS_V1";
export const SUPPORTED_REPLAY_ADAPTER_SCHEMA = "LOF_MGZ_FAST_ADAPTER_V1";

const AGE_TECHNOLOGY_IDS = {
  feudal: 101,
  castle: 102,
  imperial: 103,
} as const;

export interface RawReplayPlayerMapping {
  playerId: string;
  replaySlot: number;
  sourceName: string | null;
}

export interface ReplayDerivedResearchEvent {
  technologyId: number;
  atMs: number;
}

export interface ReplayAgeResearchStarts {
  feudalAtMs: number | null;
  castleAtMs: number | null;
  imperialAtMs: number | null;
}

export interface ReplayDerivedPlayerStats {
  playerId: string;
  replaySlot: number;
  sourceName: string | null;
  civilizationId: number | null;
  teamId: number | null;
  colorId: number | null;
  totalActions: number;
  actionCounts: Record<string, number>;
  totalBuildCommands: number;
  buildCountsByBuildingId: Record<string, number>;
  researchEventCount: number;
  researchEvents: ReplayDerivedResearchEvent[];
  ageResearchStartedAt: ReplayAgeResearchStarts;
  resigned: boolean;
  resignedAtMs: number | null;
}

export interface ReplayDerivedGameStats {
  schemaVersion: typeof REPLAY_DERIVED_STATS_VERSION;
  adapterSchemaVersion: string;
  durationMs: number;
  durationSeconds: number;
  totalActions: number;
  totalSyncOperations: number;
  playerCount: number;
  players: ReplayDerivedPlayerStats[];
}

export class ReplayDerivedStatsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReplayDerivedStatsError";
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nonNegativeInteger(value: unknown, fallback = 0): number {
  const number = finiteNumber(value);
  if (number == null || number < 0) return fallback;
  return Math.trunc(number);
}

function nullableInteger(value: unknown): number | null {
  const number = finiteNumber(value);
  return number == null ? null : Math.trunc(number);
}

function countRecord(value: unknown): Record<string, number> {
  const source = record(value);
  const result: Record<string, number> = {};
  for (const [key, raw] of Object.entries(source)) {
    const count = nonNegativeInteger(raw, -1);
    if (count >= 0) result[key] = count;
  }
  return result;
}

function sumCounts(counts: Record<string, number>): number {
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
}

function playerSlot(value: unknown): number | null {
  const slot = nullableInteger(value);
  return slot != null && slot >= 1 && slot <= 8 ? slot : null;
}

function firstResearchAt(events: ReplayDerivedResearchEvent[], technologyId: number): number | null {
  return events.find((event) => event.technologyId === technologyId)?.atMs ?? null;
}

export function normalizeReplayDerivedStats(input: {
  adapterSchemaVersion: string;
  payload: Record<string, unknown>;
  playerMapping: RawReplayPlayerMapping[];
}): ReplayDerivedGameStats {
  if (input.adapterSchemaVersion !== SUPPORTED_REPLAY_ADAPTER_SCHEMA) {
    throw new ReplayDerivedStatsError(
      `Unsupported replay adapter schema ${input.adapterSchemaVersion}; expected ${SUPPORTED_REPLAY_ADAPTER_SCHEMA}.`,
    );
  }

  const payloadPlayers = Array.isArray(input.payload.players) ? input.payload.players : [];
  const body = record(input.payload.body);
  const durationMs = nonNegativeInteger(body.durationMs);
  const totalActions = nonNegativeInteger(body.totalActions);
  const totalSyncOperations = nonNegativeInteger(body.totalSyncOperations);
  const actionCountsByPlayer = record(body.actionCountsByPlayer);
  const buildCountsByPlayer = record(body.buildCountsByPlayer);
  const researchEvents = Array.isArray(body.researchEvents) ? body.researchEvents : [];
  const resignations = Array.isArray(body.resignations) ? body.resignations : [];

  const payloadBySlot = new Map<number, Record<string, unknown>>();
  for (const rawPlayer of payloadPlayers) {
    const player = record(rawPlayer);
    const slot = playerSlot(player.replaySlot);
    if (slot != null) payloadBySlot.set(slot, player);
  }

  const mappingBySlot = new Map<number, RawReplayPlayerMapping>();
  for (const mapping of input.playerMapping) {
    if (!Number.isInteger(mapping.replaySlot) || mapping.replaySlot < 1 || mapping.replaySlot > 8) {
      throw new ReplayDerivedStatsError(`Invalid replay slot ${mapping.replaySlot} in player mapping.`);
    }
    if (mappingBySlot.has(mapping.replaySlot)) {
      throw new ReplayDerivedStatsError(`Duplicate replay slot ${mapping.replaySlot} in player mapping.`);
    }
    mappingBySlot.set(mapping.replaySlot, mapping);
  }

  const players: ReplayDerivedPlayerStats[] = [];
  for (const [slot, mapping] of [...mappingBySlot.entries()].sort((a, b) => a[0] - b[0])) {
    const rawPlayer = payloadBySlot.get(slot);
    if (!rawPlayer) {
      throw new ReplayDerivedStatsError(`Replay payload is missing mapped player slot ${slot}.`);
    }

    const actionCounts = countRecord(actionCountsByPlayer[String(slot)]);
    const buildCounts = countRecord(buildCountsByPlayer[String(slot)]);
    const playerResearchEvents: ReplayDerivedResearchEvent[] = researchEvents
      .map((value) => record(value))
      .filter((event) => playerSlot(event.replaySlot) === slot)
      .map((event) => ({
        technologyId: nonNegativeInteger(event.technologyId),
        atMs: nonNegativeInteger(event.atMs),
      }))
      .sort((left, right) => left.atMs - right.atMs || left.technologyId - right.technologyId);

    const resignationTimes = resignations
      .map((value) => record(value))
      .filter((event) => playerSlot(event.replaySlot) === slot)
      .map((event) => nonNegativeInteger(event.atMs))
      .sort((left, right) => left - right);

    players.push({
      playerId: mapping.playerId,
      replaySlot: slot,
      sourceName: mapping.sourceName,
      civilizationId: nullableInteger(rawPlayer.civilizationId),
      teamId: nullableInteger(rawPlayer.teamId),
      colorId: nullableInteger(rawPlayer.colorId),
      totalActions: sumCounts(actionCounts),
      actionCounts,
      totalBuildCommands: sumCounts(buildCounts),
      buildCountsByBuildingId: buildCounts,
      researchEventCount: playerResearchEvents.length,
      researchEvents: playerResearchEvents,
      ageResearchStartedAt: {
        feudalAtMs: firstResearchAt(playerResearchEvents, AGE_TECHNOLOGY_IDS.feudal),
        castleAtMs: firstResearchAt(playerResearchEvents, AGE_TECHNOLOGY_IDS.castle),
        imperialAtMs: firstResearchAt(playerResearchEvents, AGE_TECHNOLOGY_IDS.imperial),
      },
      resigned: resignationTimes.length > 0,
      resignedAtMs: resignationTimes[0] ?? null,
    });
  }

  if (players.length < 2 || players.length > 8) {
    throw new ReplayDerivedStatsError(`Expected 2–8 normalized players, found ${players.length}.`);
  }

  return {
    schemaVersion: REPLAY_DERIVED_STATS_VERSION,
    adapterSchemaVersion: input.adapterSchemaVersion,
    durationMs,
    durationSeconds: Math.round(durationMs / 1000),
    totalActions,
    totalSyncOperations,
    playerCount: players.length,
    players,
  };
}
