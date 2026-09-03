export const REPLAY_DERIVED_STATS_VERSION = "REPLAY_DERIVED_STATS_V2";
export const SUPPORTED_REPLAY_ADAPTER_SCHEMAS = [
  "LOF_MGZ_FAST_ADAPTER_V1",
  "LOF_MGZ_FAST_ADAPTER_V2",
] as const;

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

export interface ReplayActionSecondBucket {
  second: number;
  count: number;
}

export interface ReplayBuildEvent {
  buildingId: number | null;
  atMs: number;
  x: number | null;
  y: number | null;
}

export interface ReplayProductionEvent {
  commandType: string;
  unitId: number | null;
  amount: number;
  buildingId: number | null;
  atMs: number;
}

export interface ReplayMarketEvent {
  type: string;
  resourceId: number | null;
  amount: number | null;
  atMs: number;
}

export interface ReplayTributeEvent {
  targetPlayerId: string | null;
  targetReplaySlot: number | null;
  resourceId: number | null;
  amount: number | null;
  food: number | null;
  wood: number | null;
  gold: number | null;
  stone: number | null;
  atMs: number;
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
  actionSeconds: ReplayActionSecondBucket[];
  totalBuildCommands: number;
  buildCountsByBuildingId: Record<string, number>;
  buildEvents: ReplayBuildEvent[];
  productionEvents: ReplayProductionEvent[];
  researchEventCount: number;
  researchEvents: ReplayDerivedResearchEvent[];
  ageResearchStartedAt: ReplayAgeResearchStarts;
  marketEvents: ReplayMarketEvent[];
  tributeEvents: ReplayTributeEvent[];
  resigned: boolean;
  resignedAtMs: number | null;
}

export interface ReplayDerivedGameStats {
  schemaVersion: typeof REPLAY_DERIVED_STATS_VERSION;
  adapterSchemaVersion: string;
  eventDetailLevel: "AGGREGATES_ONLY" | "TIMELINE_V2";
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

function playerEvents(values: unknown, slot: number): Record<string, unknown>[] {
  return (Array.isArray(values) ? values : [])
    .map((value) => record(value))
    .filter((event) => playerSlot(event.replaySlot) === slot);
}

function firstResearchAt(events: ReplayDerivedResearchEvent[], technologyId: number): number | null {
  return events.find((event) => event.technologyId === technologyId)?.atMs ?? null;
}

function normalizeActionSeconds(value: unknown): ReplayActionSecondBucket[] {
  return (Array.isArray(value) ? value : [])
    .map((raw) => record(raw))
    .map((bucket) => ({
      second: nonNegativeInteger(bucket.second),
      count: nonNegativeInteger(bucket.count),
    }))
    .filter((bucket) => bucket.count > 0)
    .sort((left, right) => left.second - right.second);
}

export function normalizeReplayDerivedStats(input: {
  adapterSchemaVersion: string;
  payload: Record<string, unknown>;
  playerMapping: RawReplayPlayerMapping[];
}): ReplayDerivedGameStats {
  if (!(SUPPORTED_REPLAY_ADAPTER_SCHEMAS as readonly string[]).includes(input.adapterSchemaVersion)) {
    throw new ReplayDerivedStatsError(
      `Unsupported replay adapter schema ${input.adapterSchemaVersion}; supported: ${SUPPORTED_REPLAY_ADAPTER_SCHEMAS.join(", ")}.`,
    );
  }

  const payloadPlayers = Array.isArray(input.payload.players) ? input.payload.players : [];
  const body = record(input.payload.body);
  const durationMs = nonNegativeInteger(body.durationMs);
  const totalActions = nonNegativeInteger(body.totalActions);
  const totalSyncOperations = nonNegativeInteger(body.totalSyncOperations);
  const actionCountsByPlayer = record(body.actionCountsByPlayer);
  const actionSecondsByPlayer = record(body.actionSecondsByPlayer);
  const buildCountsByPlayer = record(body.buildCountsByPlayer);
  const researchEvents = body.researchEvents;
  const buildEvents = body.buildEvents;
  const productionEvents = body.productionEvents;
  const marketEvents = body.marketEvents;
  const tributeEvents = body.tributeEvents;
  const resignations = body.resignations;

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
    const actionSeconds = normalizeActionSeconds(actionSecondsByPlayer[String(slot)]);
    const buildCounts = countRecord(buildCountsByPlayer[String(slot)]);
    const playerResearchEvents: ReplayDerivedResearchEvent[] = playerEvents(researchEvents, slot)
      .map((event) => ({
        technologyId: nonNegativeInteger(event.technologyId),
        atMs: nonNegativeInteger(event.atMs),
      }))
      .sort((left, right) => left.atMs - right.atMs || left.technologyId - right.technologyId);

    const playerBuildEvents: ReplayBuildEvent[] = playerEvents(buildEvents, slot)
      .map((event) => ({
        buildingId: nullableInteger(event.buildingId),
        atMs: nonNegativeInteger(event.atMs),
        x: finiteNumber(event.x),
        y: finiteNumber(event.y),
      }))
      .sort((left, right) => left.atMs - right.atMs);

    const playerProductionEvents: ReplayProductionEvent[] = playerEvents(productionEvents, slot)
      .map((event) => ({
        commandType: typeof event.commandType === "string" ? event.commandType : "UNKNOWN",
        unitId: nullableInteger(event.unitId),
        amount: Math.max(1, nonNegativeInteger(event.amount, 1)),
        buildingId: nullableInteger(event.buildingId),
        atMs: nonNegativeInteger(event.atMs),
      }))
      .sort((left, right) => left.atMs - right.atMs);

    const playerMarketEvents: ReplayMarketEvent[] = playerEvents(marketEvents, slot)
      .map((event) => ({
        type: typeof event.type === "string" ? event.type : "UNKNOWN",
        resourceId: nullableInteger(event.resourceId),
        amount: finiteNumber(event.amount),
        atMs: nonNegativeInteger(event.atMs),
      }))
      .sort((left, right) => left.atMs - right.atMs);

    const playerTributeEvents: ReplayTributeEvent[] = playerEvents(tributeEvents, slot)
      .map((event) => {
        const targetReplaySlot = playerSlot(event.targetReplaySlot);
        return {
          targetPlayerId: targetReplaySlot == null ? null : mappingBySlot.get(targetReplaySlot)?.playerId ?? null,
          targetReplaySlot,
          resourceId: nullableInteger(event.resourceId),
          amount: finiteNumber(event.amount),
          food: finiteNumber(event.food),
          wood: finiteNumber(event.wood),
          gold: finiteNumber(event.gold),
          stone: finiteNumber(event.stone),
          atMs: nonNegativeInteger(event.atMs),
        };
      })
      .sort((left, right) => left.atMs - right.atMs);

    const resignationTimes = playerEvents(resignations, slot)
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
      actionSeconds,
      totalBuildCommands: sumCounts(buildCounts),
      buildCountsByBuildingId: buildCounts,
      buildEvents: playerBuildEvents,
      productionEvents: playerProductionEvents,
      researchEventCount: playerResearchEvents.length,
      researchEvents: playerResearchEvents,
      ageResearchStartedAt: {
        feudalAtMs: firstResearchAt(playerResearchEvents, AGE_TECHNOLOGY_IDS.feudal),
        castleAtMs: firstResearchAt(playerResearchEvents, AGE_TECHNOLOGY_IDS.castle),
        imperialAtMs: firstResearchAt(playerResearchEvents, AGE_TECHNOLOGY_IDS.imperial),
      },
      marketEvents: playerMarketEvents,
      tributeEvents: playerTributeEvents,
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
    eventDetailLevel: input.adapterSchemaVersion === "LOF_MGZ_FAST_ADAPTER_V2" ? "TIMELINE_V2" : "AGGREGATES_ONLY",
    durationMs,
    durationSeconds: Math.round(durationMs / 1000),
    totalActions,
    totalSyncOperations,
    playerCount: players.length,
    players,
  };
}
