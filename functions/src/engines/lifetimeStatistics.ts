export const LIFETIME_STATISTICS_VERSION = "AOF_LIFETIME_STATISTICS_V1";

export type AgeKey = "dark" | "feudal" | "castle" | "imperial";
export type ResourceKey = "food" | "wood" | "gold" | "stone" | "total";

export interface RecordValue {
  value: number;
  matchId: string;
  gameId: string;
}

export interface NumericAggregate {
  samples: number;
  total: number;
  average: number | null;
  minimum: RecordValue | null;
  maximum: RecordValue | null;
}

export interface BooleanAggregate {
  samples: number;
  trueCount: number;
  falseCount: number;
  trueRatePercent: number | null;
}

export interface MatchPlayerStatisticsInput {
  playerId: string;
  won?: boolean | null;
  opening?: {
    buildOrder?: string | null;
    executionScore?: number | null;
    feudalAgeUpAtMs?: number | null;
    castleAgeUpAtMs?: number | null;
    imperialAgeUpAtMs?: number | null;
    firstMilitaryUnitQueuedAtMs?: number | null;
    firstMilitaryBuildingAtMs?: number | null;
    firstWallAtMs?: number | null;
    wallTilesBeforeFeudal?: number | null;
    wallStyle?: string | null;
    housesBeforeFeudal?: number | null;
    loomAtMs?: number | null;
    loomBeforeFeudal?: boolean | null;
  };
  economy?: {
    resourceCommitment?: Partial<Record<ResourceKey, number | null>>;
    resourceCommitmentByAge?: Partial<Record<AgeKey, Partial<Record<ResourceKey, number | null>>>>;
  };
  military?: {
    raidsInitiated?: number | null;
    raidsAgainst?: number | null;
  };
  mapPresence?: {
    commandMapCoveragePercent?: number | null;
    enemyBaseFoundAtMs?: number | null;
    forwardBuildings?: number | null;
    forwardEco?: number | null;
    expansions?: number | null;
    goldControlPercent?: number | null;
    firstRelicTouchAtMs?: number | null;
  };
  execution?: {
    totalCommands?: number | null;
    commandRatePerObservedMinute?: number | null;
    firstCommandAtMs?: number | null;
    firstFiveObservedMinutesCommands?: number | null;
    activeSeconds?: number | null;
    averageSelectionSize?: number | null;
    medianSelectionSize?: number | null;
    maximumSelectionSize?: number | null;
  };
}

export interface LifetimeStatisticsGameInput {
  matchId: string;
  gameId: string;
  orderAtMs: number;
  affectsLifetimeStats: boolean;
  players: MatchPlayerStatisticsInput[];
}

export interface LifetimePlayerStatistics {
  schemaVersion: typeof LIFETIME_STATISTICS_VERSION;
  playerId: string;
  gamesAnalyzed: number;
  result: {
    samples: number;
    wins: number;
    losses: number;
    winRatePercent: number | null;
  };
  opening: {
    buildOrderCounts: Record<string, number>;
    executionScore: NumericAggregate;
    ageUpAtMs: {
      feudal: NumericAggregate;
      castle: NumericAggregate;
      imperial: NumericAggregate;
    };
    firstMilitaryUnitQueuedAtMs: NumericAggregate;
    firstMilitaryBuildingAtMs: NumericAggregate;
    firstWallAtMs: NumericAggregate;
    wallTilesBeforeFeudal: NumericAggregate;
    wallStyleCounts: Record<string, number>;
    housesBeforeFeudal: NumericAggregate;
    loomAtMs: NumericAggregate;
    loomBeforeFeudal: BooleanAggregate;
  };
  economy: {
    resourceCommitment: Record<ResourceKey, NumericAggregate>;
    resourceCommitmentByAge: Record<AgeKey, Record<ResourceKey, NumericAggregate>>;
  };
  military: {
    raidsInitiated: NumericAggregate;
    raidsAgainst: NumericAggregate;
  };
  mapPresence: {
    commandMapCoveragePercent: NumericAggregate;
    enemyBaseFoundAtMs: NumericAggregate;
    forwardBuildings: NumericAggregate;
    forwardEco: NumericAggregate;
    expansions: NumericAggregate;
    goldControlPercent: NumericAggregate;
    firstRelicTouchAtMs: NumericAggregate;
  };
  execution: {
    totalCommands: NumericAggregate;
    commandRatePerObservedMinute: NumericAggregate;
    firstCommandAtMs: NumericAggregate;
    firstFiveObservedMinutesCommands: NumericAggregate;
    activeSeconds: NumericAggregate;
    averageSelectionSize: NumericAggregate;
    medianSelectionSize: NumericAggregate;
    maximumSelectionSize: NumericAggregate;
  };
  contributingMatchIds: string[];
}

interface MutableNumericAggregate {
  samples: number;
  total: number;
  minimum: RecordValue | null;
  maximum: RecordValue | null;
}

interface MutableBooleanAggregate {
  samples: number;
  trueCount: number;
  falseCount: number;
}

interface MutableLifetimePlayerStatistics {
  playerId: string;
  gamesAnalyzed: number;
  result: { samples: number; wins: number; losses: number };
  opening: {
    buildOrderCounts: Record<string, number>;
    executionScore: MutableNumericAggregate;
    ageUpAtMs: { feudal: MutableNumericAggregate; castle: MutableNumericAggregate; imperial: MutableNumericAggregate };
    firstMilitaryUnitQueuedAtMs: MutableNumericAggregate;
    firstMilitaryBuildingAtMs: MutableNumericAggregate;
    firstWallAtMs: MutableNumericAggregate;
    wallTilesBeforeFeudal: MutableNumericAggregate;
    wallStyleCounts: Record<string, number>;
    housesBeforeFeudal: MutableNumericAggregate;
    loomAtMs: MutableNumericAggregate;
    loomBeforeFeudal: MutableBooleanAggregate;
  };
  economy: {
    resourceCommitment: Record<ResourceKey, MutableNumericAggregate>;
    resourceCommitmentByAge: Record<AgeKey, Record<ResourceKey, MutableNumericAggregate>>;
  };
  military: { raidsInitiated: MutableNumericAggregate; raidsAgainst: MutableNumericAggregate };
  mapPresence: {
    commandMapCoveragePercent: MutableNumericAggregate;
    enemyBaseFoundAtMs: MutableNumericAggregate;
    forwardBuildings: MutableNumericAggregate;
    forwardEco: MutableNumericAggregate;
    expansions: MutableNumericAggregate;
    goldControlPercent: MutableNumericAggregate;
    firstRelicTouchAtMs: MutableNumericAggregate;
  };
  execution: {
    totalCommands: MutableNumericAggregate;
    commandRatePerObservedMinute: MutableNumericAggregate;
    firstCommandAtMs: MutableNumericAggregate;
    firstFiveObservedMinutesCommands: MutableNumericAggregate;
    activeSeconds: MutableNumericAggregate;
    averageSelectionSize: MutableNumericAggregate;
    medianSelectionSize: MutableNumericAggregate;
    maximumSelectionSize: MutableNumericAggregate;
  };
  contributingMatchIds: Set<string>;
}

const AGE_KEYS: AgeKey[] = ["dark", "feudal", "castle", "imperial"];
const RESOURCE_KEYS: ResourceKey[] = ["food", "wood", "gold", "stone", "total"];

function numeric(): MutableNumericAggregate {
  return { samples: 0, total: 0, minimum: null, maximum: null };
}

function booleanAggregate(): MutableBooleanAggregate {
  return { samples: 0, trueCount: 0, falseCount: 0 };
}

function resourceAggregates(): Record<ResourceKey, MutableNumericAggregate> {
  return { food: numeric(), wood: numeric(), gold: numeric(), stone: numeric(), total: numeric() };
}

function ageResourceAggregates(): Record<AgeKey, Record<ResourceKey, MutableNumericAggregate>> {
  return {
    dark: resourceAggregates(),
    feudal: resourceAggregates(),
    castle: resourceAggregates(),
    imperial: resourceAggregates(),
  };
}

function emptyPlayer(playerId: string): MutableLifetimePlayerStatistics {
  return {
    playerId,
    gamesAnalyzed: 0,
    result: { samples: 0, wins: 0, losses: 0 },
    opening: {
      buildOrderCounts: {},
      executionScore: numeric(),
      ageUpAtMs: { feudal: numeric(), castle: numeric(), imperial: numeric() },
      firstMilitaryUnitQueuedAtMs: numeric(),
      firstMilitaryBuildingAtMs: numeric(),
      firstWallAtMs: numeric(),
      wallTilesBeforeFeudal: numeric(),
      wallStyleCounts: {},
      housesBeforeFeudal: numeric(),
      loomAtMs: numeric(),
      loomBeforeFeudal: booleanAggregate(),
    },
    economy: {
      resourceCommitment: resourceAggregates(),
      resourceCommitmentByAge: ageResourceAggregates(),
    },
    military: { raidsInitiated: numeric(), raidsAgainst: numeric() },
    mapPresence: {
      commandMapCoveragePercent: numeric(),
      enemyBaseFoundAtMs: numeric(),
      forwardBuildings: numeric(),
      forwardEco: numeric(),
      expansions: numeric(),
      goldControlPercent: numeric(),
      firstRelicTouchAtMs: numeric(),
    },
    execution: {
      totalCommands: numeric(),
      commandRatePerObservedMinute: numeric(),
      firstCommandAtMs: numeric(),
      firstFiveObservedMinutesCommands: numeric(),
      activeSeconds: numeric(),
      averageSelectionSize: numeric(),
      medianSelectionSize: numeric(),
      maximumSelectionSize: numeric(),
    },
    contributingMatchIds: new Set<string>(),
  };
}

function rounded(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function record(value: number, matchId: string, gameId: string): RecordValue {
  return { value: rounded(value), matchId, gameId };
}

function recordKey(value: RecordValue): string {
  return `${value.matchId}/${value.gameId}`;
}

function addNumeric(target: MutableNumericAggregate, value: number | null | undefined, matchId: string, gameId: string): void {
  if (value == null || !Number.isFinite(value)) return;
  const candidate = record(value, matchId, gameId);
  target.samples += 1;
  target.total += value;
  if (!target.minimum || candidate.value < target.minimum.value ||
      (candidate.value === target.minimum.value && recordKey(candidate).localeCompare(recordKey(target.minimum)) < 0)) {
    target.minimum = candidate;
  }
  if (!target.maximum || candidate.value > target.maximum.value ||
      (candidate.value === target.maximum.value && recordKey(candidate).localeCompare(recordKey(target.maximum)) < 0)) {
    target.maximum = candidate;
  }
}

function addBoolean(target: MutableBooleanAggregate, value: boolean | null | undefined): void {
  if (value == null) return;
  target.samples += 1;
  if (value) target.trueCount += 1;
  else target.falseCount += 1;
}

function addCount(target: Record<string, number>, value: string | null | undefined): void {
  if (!value) return;
  target[value] = (target[value] ?? 0) + 1;
}

function addPlayer(target: MutableLifetimePlayerStatistics, game: LifetimeStatisticsGameInput, player: MatchPlayerStatisticsInput): void {
  const { matchId, gameId } = game;
  target.gamesAnalyzed += 1;
  target.contributingMatchIds.add(matchId);

  if (player.won != null) {
    target.result.samples += 1;
    if (player.won) target.result.wins += 1;
    else target.result.losses += 1;
  }

  const opening = player.opening;
  if (opening) {
    addCount(target.opening.buildOrderCounts, opening.buildOrder);
    addNumeric(target.opening.executionScore, opening.executionScore, matchId, gameId);
    addNumeric(target.opening.ageUpAtMs.feudal, opening.feudalAgeUpAtMs, matchId, gameId);
    addNumeric(target.opening.ageUpAtMs.castle, opening.castleAgeUpAtMs, matchId, gameId);
    addNumeric(target.opening.ageUpAtMs.imperial, opening.imperialAgeUpAtMs, matchId, gameId);
    addNumeric(target.opening.firstMilitaryUnitQueuedAtMs, opening.firstMilitaryUnitQueuedAtMs, matchId, gameId);
    addNumeric(target.opening.firstMilitaryBuildingAtMs, opening.firstMilitaryBuildingAtMs, matchId, gameId);
    addNumeric(target.opening.firstWallAtMs, opening.firstWallAtMs, matchId, gameId);
    addNumeric(target.opening.wallTilesBeforeFeudal, opening.wallTilesBeforeFeudal, matchId, gameId);
    addCount(target.opening.wallStyleCounts, opening.wallStyle);
    addNumeric(target.opening.housesBeforeFeudal, opening.housesBeforeFeudal, matchId, gameId);
    addNumeric(target.opening.loomAtMs, opening.loomAtMs, matchId, gameId);
    addBoolean(target.opening.loomBeforeFeudal, opening.loomBeforeFeudal);
  }

  const economy = player.economy;
  if (economy?.resourceCommitment) {
    for (const resource of RESOURCE_KEYS) {
      addNumeric(target.economy.resourceCommitment[resource], economy.resourceCommitment[resource], matchId, gameId);
    }
  }
  if (economy?.resourceCommitmentByAge) {
    for (const age of AGE_KEYS) {
      const source = economy.resourceCommitmentByAge[age];
      if (!source) continue;
      for (const resource of RESOURCE_KEYS) {
        addNumeric(target.economy.resourceCommitmentByAge[age][resource], source[resource], matchId, gameId);
      }
    }
  }

  addNumeric(target.military.raidsInitiated, player.military?.raidsInitiated, matchId, gameId);
  addNumeric(target.military.raidsAgainst, player.military?.raidsAgainst, matchId, gameId);

  addNumeric(target.mapPresence.commandMapCoveragePercent, player.mapPresence?.commandMapCoveragePercent, matchId, gameId);
  addNumeric(target.mapPresence.enemyBaseFoundAtMs, player.mapPresence?.enemyBaseFoundAtMs, matchId, gameId);
  addNumeric(target.mapPresence.forwardBuildings, player.mapPresence?.forwardBuildings, matchId, gameId);
  addNumeric(target.mapPresence.forwardEco, player.mapPresence?.forwardEco, matchId, gameId);
  addNumeric(target.mapPresence.expansions, player.mapPresence?.expansions, matchId, gameId);
  addNumeric(target.mapPresence.goldControlPercent, player.mapPresence?.goldControlPercent, matchId, gameId);
  addNumeric(target.mapPresence.firstRelicTouchAtMs, player.mapPresence?.firstRelicTouchAtMs, matchId, gameId);

  addNumeric(target.execution.totalCommands, player.execution?.totalCommands, matchId, gameId);
  addNumeric(target.execution.commandRatePerObservedMinute, player.execution?.commandRatePerObservedMinute, matchId, gameId);
  addNumeric(target.execution.firstCommandAtMs, player.execution?.firstCommandAtMs, matchId, gameId);
  addNumeric(target.execution.firstFiveObservedMinutesCommands, player.execution?.firstFiveObservedMinutesCommands, matchId, gameId);
  addNumeric(target.execution.activeSeconds, player.execution?.activeSeconds, matchId, gameId);
  addNumeric(target.execution.averageSelectionSize, player.execution?.averageSelectionSize, matchId, gameId);
  addNumeric(target.execution.medianSelectionSize, player.execution?.medianSelectionSize, matchId, gameId);
  addNumeric(target.execution.maximumSelectionSize, player.execution?.maximumSelectionSize, matchId, gameId);
}

function finishNumeric(value: MutableNumericAggregate): NumericAggregate {
  return {
    samples: value.samples,
    total: rounded(value.total),
    average: value.samples ? rounded(value.total / value.samples) : null,
    minimum: value.minimum,
    maximum: value.maximum,
  };
}

function finishBoolean(value: MutableBooleanAggregate): BooleanAggregate {
  return {
    samples: value.samples,
    trueCount: value.trueCount,
    falseCount: value.falseCount,
    trueRatePercent: value.samples ? rounded((value.trueCount / value.samples) * 100) : null,
  };
}

function finishResources(source: Record<ResourceKey, MutableNumericAggregate>): Record<ResourceKey, NumericAggregate> {
  return {
    food: finishNumeric(source.food),
    wood: finishNumeric(source.wood),
    gold: finishNumeric(source.gold),
    stone: finishNumeric(source.stone),
    total: finishNumeric(source.total),
  };
}

function sortedCounts(source: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(source).sort(([left], [right]) => left.localeCompare(right)));
}

function finishPlayer(source: MutableLifetimePlayerStatistics): LifetimePlayerStatistics {
  const byAge = {} as Record<AgeKey, Record<ResourceKey, NumericAggregate>>;
  for (const age of AGE_KEYS) byAge[age] = finishResources(source.economy.resourceCommitmentByAge[age]);

  return {
    schemaVersion: LIFETIME_STATISTICS_VERSION,
    playerId: source.playerId,
    gamesAnalyzed: source.gamesAnalyzed,
    result: {
      ...source.result,
      winRatePercent: source.result.samples ? rounded((source.result.wins / source.result.samples) * 100) : null,
    },
    opening: {
      buildOrderCounts: sortedCounts(source.opening.buildOrderCounts),
      executionScore: finishNumeric(source.opening.executionScore),
      ageUpAtMs: {
        feudal: finishNumeric(source.opening.ageUpAtMs.feudal),
        castle: finishNumeric(source.opening.ageUpAtMs.castle),
        imperial: finishNumeric(source.opening.ageUpAtMs.imperial),
      },
      firstMilitaryUnitQueuedAtMs: finishNumeric(source.opening.firstMilitaryUnitQueuedAtMs),
      firstMilitaryBuildingAtMs: finishNumeric(source.opening.firstMilitaryBuildingAtMs),
      firstWallAtMs: finishNumeric(source.opening.firstWallAtMs),
      wallTilesBeforeFeudal: finishNumeric(source.opening.wallTilesBeforeFeudal),
      wallStyleCounts: sortedCounts(source.opening.wallStyleCounts),
      housesBeforeFeudal: finishNumeric(source.opening.housesBeforeFeudal),
      loomAtMs: finishNumeric(source.opening.loomAtMs),
      loomBeforeFeudal: finishBoolean(source.opening.loomBeforeFeudal),
    },
    economy: {
      resourceCommitment: finishResources(source.economy.resourceCommitment),
      resourceCommitmentByAge: byAge,
    },
    military: {
      raidsInitiated: finishNumeric(source.military.raidsInitiated),
      raidsAgainst: finishNumeric(source.military.raidsAgainst),
    },
    mapPresence: {
      commandMapCoveragePercent: finishNumeric(source.mapPresence.commandMapCoveragePercent),
      enemyBaseFoundAtMs: finishNumeric(source.mapPresence.enemyBaseFoundAtMs),
      forwardBuildings: finishNumeric(source.mapPresence.forwardBuildings),
      forwardEco: finishNumeric(source.mapPresence.forwardEco),
      expansions: finishNumeric(source.mapPresence.expansions),
      goldControlPercent: finishNumeric(source.mapPresence.goldControlPercent),
      firstRelicTouchAtMs: finishNumeric(source.mapPresence.firstRelicTouchAtMs),
    },
    execution: {
      totalCommands: finishNumeric(source.execution.totalCommands),
      commandRatePerObservedMinute: finishNumeric(source.execution.commandRatePerObservedMinute),
      firstCommandAtMs: finishNumeric(source.execution.firstCommandAtMs),
      firstFiveObservedMinutesCommands: finishNumeric(source.execution.firstFiveObservedMinutesCommands),
      activeSeconds: finishNumeric(source.execution.activeSeconds),
      averageSelectionSize: finishNumeric(source.execution.averageSelectionSize),
      medianSelectionSize: finishNumeric(source.execution.medianSelectionSize),
      maximumSelectionSize: finishNumeric(source.execution.maximumSelectionSize),
    },
    contributingMatchIds: [...source.contributingMatchIds].sort((a, b) => a.localeCompare(b)),
  };
}

export function rebuildLifetimeStatistics(games: LifetimeStatisticsGameInput[]): LifetimePlayerStatistics[] {
  const players = new Map<string, MutableLifetimePlayerStatistics>();
  const ordered = [...games].sort((left, right) => left.orderAtMs - right.orderAtMs || left.matchId.localeCompare(right.matchId) || left.gameId.localeCompare(right.gameId));

  for (const game of ordered) {
    if (!game.affectsLifetimeStats) continue;
    for (const player of game.players) {
      const target = players.get(player.playerId) ?? emptyPlayer(player.playerId);
      addPlayer(target, game, player);
      players.set(player.playerId, target);
    }
  }

  return [...players.values()].map(finishPlayer).sort((a, b) => a.playerId.localeCompare(b.playerId));
}
