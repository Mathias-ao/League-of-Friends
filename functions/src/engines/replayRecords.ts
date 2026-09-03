import type { ReplayPlayerAggregate, ReplayRecordValue } from "./replayPlayerAggregates.js";

export const REPLAY_RECORDS_VERSION = "REPLAY_RECORDS_V1";

export type ReplayRecordCode =
  | "HIGHEST_PEAK_30S_RAW_APM"
  | "HIGHEST_PEAK_60S_RAW_APM"
  | "FASTEST_FEUDAL_RESEARCH_START"
  | "FASTEST_CASTLE_RESEARCH_START"
  | "FASTEST_IMPERIAL_RESEARCH_START";

export type ReplayRecordDirection = "MAX" | "MIN";
export type ReplayRecordUnit = "APM" | "SECONDS";

export interface ReplayRecordHolder {
  playerId: string;
  value: number;
  matchId: string;
  gameId: string;
}

export interface ReplayRecordProjection {
  schemaVersion: typeof REPLAY_RECORDS_VERSION;
  code: ReplayRecordCode;
  direction: ReplayRecordDirection;
  unit: ReplayRecordUnit;
  holders: ReplayRecordHolder[];
  value: number | null;
}

export interface ReplayRecordsRebuild {
  schemaVersion: typeof REPLAY_RECORDS_VERSION;
  lifetime: ReplayRecordProjection[];
  seasonal: Array<{ seasonId: string; records: ReplayRecordProjection[] }>;
}

interface RecordDefinition {
  code: ReplayRecordCode;
  direction: ReplayRecordDirection;
  unit: ReplayRecordUnit;
  select: (aggregate: ReplayPlayerAggregate) => ReplayRecordValue | null;
}

const DEFINITIONS: RecordDefinition[] = [
  {
    code: "HIGHEST_PEAK_30S_RAW_APM",
    direction: "MAX",
    unit: "APM",
    select: (aggregate) => aggregate.highestPeak30sRawApm,
  },
  {
    code: "HIGHEST_PEAK_60S_RAW_APM",
    direction: "MAX",
    unit: "APM",
    select: (aggregate) => aggregate.highestPeak60sRawApm,
  },
  {
    code: "FASTEST_FEUDAL_RESEARCH_START",
    direction: "MIN",
    unit: "SECONDS",
    select: (aggregate) => aggregate.ageResearch.feudal.fastestResearchStart,
  },
  {
    code: "FASTEST_CASTLE_RESEARCH_START",
    direction: "MIN",
    unit: "SECONDS",
    select: (aggregate) => aggregate.ageResearch.castle.fastestResearchStart,
  },
  {
    code: "FASTEST_IMPERIAL_RESEARCH_START",
    direction: "MIN",
    unit: "SECONDS",
    select: (aggregate) => aggregate.ageResearch.imperial.fastestResearchStart,
  },
];

function isBetter(direction: ReplayRecordDirection, candidate: number, current: number): boolean {
  return direction === "MAX" ? candidate > current : candidate < current;
}

function buildRecords(aggregates: ReplayPlayerAggregate[]): ReplayRecordProjection[] {
  return DEFINITIONS.map((definition) => {
    let bestValue: number | null = null;
    let holders: ReplayRecordHolder[] = [];

    for (const aggregate of aggregates) {
      const candidate = definition.select(aggregate);
      if (!candidate || !Number.isFinite(candidate.value)) continue;

      const holder: ReplayRecordHolder = {
        playerId: aggregate.playerId,
        value: candidate.value,
        matchId: candidate.matchId,
        gameId: candidate.gameId,
      };

      if (bestValue == null || isBetter(definition.direction, candidate.value, bestValue)) {
        bestValue = candidate.value;
        holders = [holder];
      } else if (candidate.value === bestValue) {
        holders.push(holder);
      }
    }

    holders.sort((left, right) => (
      left.playerId.localeCompare(right.playerId) ||
      left.matchId.localeCompare(right.matchId) ||
      left.gameId.localeCompare(right.gameId)
    ));

    return {
      schemaVersion: REPLAY_RECORDS_VERSION,
      code: definition.code,
      direction: definition.direction,
      unit: definition.unit,
      holders,
      value: bestValue,
    };
  });
}

export function rebuildReplayRecords(input: {
  lifetime: ReplayPlayerAggregate[];
  seasonal: Array<{ seasonId: string; stats: ReplayPlayerAggregate }>;
}): ReplayRecordsRebuild {
  const seasonalGroups = new Map<string, ReplayPlayerAggregate[]>();
  for (const item of input.seasonal) {
    const current = seasonalGroups.get(item.seasonId) ?? [];
    current.push(item.stats);
    seasonalGroups.set(item.seasonId, current);
  }

  return {
    schemaVersion: REPLAY_RECORDS_VERSION,
    lifetime: buildRecords(input.lifetime),
    seasonal: [...seasonalGroups.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([seasonId, aggregates]) => ({ seasonId, records: buildRecords(aggregates) })),
  };
}
