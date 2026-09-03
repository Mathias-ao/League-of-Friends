import type {
  PeakApmResult,
  ReplayPlayerAnalysis,
  ReplayStrategyCode,
} from "./replayAnalysis.js";

export const REPLAY_PLAYER_AGGREGATES_VERSION = "REPLAY_PLAYER_AGGREGATES_V1";

export interface ReplayAggregateGameInput {
  matchId: string;
  gameId: string;
  seasonId: string | null;
  affectsLifetimeStats: boolean;
  affectsSeasonStats: boolean;
  durationSeconds: number;
  players: ReplayPlayerAnalysis[];
}

export interface ReplayRecordValue {
  value: number;
  matchId: string;
  gameId: string;
}

export interface ReplayAgeAggregate {
  samples: number;
  averageResearchStartSeconds: number | null;
  fastestResearchStart: ReplayRecordValue | null;
}

export interface ReplayPlayerAggregate {
  schemaVersion: typeof REPLAY_PLAYER_AGGREGATES_VERSION;
  playerId: string;
  gamesAnalyzed: number;
  totalActions: number;
  totalDurationSeconds: number;
  weightedAverageRawApm: number;
  highestPeak30sRawApm: ReplayRecordValue | null;
  highestPeak60sRawApm: ReplayRecordValue | null;
  ageResearch: {
    feudal: ReplayAgeAggregate;
    castle: ReplayAgeAggregate;
    imperial: ReplayAgeAggregate;
  };
  civilizationUsage: Record<string, number>;
  market: {
    buyCommands: number;
    sellCommands: number;
  };
  tribute: {
    commandsSent: number;
  };
  strategyCounts: Partial<Record<ReplayStrategyCode, number>>;
}

export interface ReplayPlayerAggregateRebuild {
  schemaVersion: typeof REPLAY_PLAYER_AGGREGATES_VERSION;
  lifetime: ReplayPlayerAggregate[];
  seasonal: Array<{ seasonId: string; stats: ReplayPlayerAggregate }>;
}

interface MutableAgeAggregate {
  samples: number;
  totalSeconds: number;
  fastestResearchStart: ReplayRecordValue | null;
}

interface MutableAggregate {
  playerId: string;
  gamesAnalyzed: number;
  totalActions: number;
  totalDurationSeconds: number;
  highestPeak30sRawApm: ReplayRecordValue | null;
  highestPeak60sRawApm: ReplayRecordValue | null;
  ageResearch: {
    feudal: MutableAgeAggregate;
    castle: MutableAgeAggregate;
    imperial: MutableAgeAggregate;
  };
  civilizationUsage: Record<string, number>;
  marketBuyCommands: number;
  marketSellCommands: number;
  tributeCommandsSent: number;
  strategyCounts: Partial<Record<ReplayStrategyCode, number>>;
}

function emptyAge(): MutableAgeAggregate {
  return { samples: 0, totalSeconds: 0, fastestResearchStart: null };
}

function emptyAggregate(playerId: string): MutableAggregate {
  return {
    playerId,
    gamesAnalyzed: 0,
    totalActions: 0,
    totalDurationSeconds: 0,
    highestPeak30sRawApm: null,
    highestPeak60sRawApm: null,
    ageResearch: {
      feudal: emptyAge(),
      castle: emptyAge(),
      imperial: emptyAge(),
    },
    civilizationUsage: {},
    marketBuyCommands: 0,
    marketSellCommands: 0,
    tributeCommandsSent: 0,
    strategyCounts: {},
  };
}

function rounded(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function recordFromPeak(peak: PeakApmResult | null, matchId: string, gameId: string): ReplayRecordValue | null {
  if (!peak) return null;
  return { value: peak.apm, matchId, gameId };
}

function maxRecord(current: ReplayRecordValue | null, candidate: ReplayRecordValue | null): ReplayRecordValue | null {
  if (!candidate) return current;
  if (!current || candidate.value > current.value) return candidate;
  if (candidate.value < current.value) return current;
  const candidateKey = `${candidate.matchId}/${candidate.gameId}`;
  const currentKey = `${current.matchId}/${current.gameId}`;
  return candidateKey.localeCompare(currentKey) < 0 ? candidate : current;
}

function addAgeSample(age: MutableAgeAggregate, atMs: number | null, matchId: string, gameId: string): void {
  if (atMs == null) return;
  const seconds = atMs / 1000;
  age.samples += 1;
  age.totalSeconds += seconds;
  const candidate = { value: rounded(seconds, 1), matchId, gameId };
  if (!age.fastestResearchStart || candidate.value < age.fastestResearchStart.value) {
    age.fastestResearchStart = candidate;
  } else if (candidate.value === age.fastestResearchStart.value) {
    const candidateKey = `${candidate.matchId}/${candidate.gameId}`;
    const currentKey = `${age.fastestResearchStart.matchId}/${age.fastestResearchStart.gameId}`;
    if (candidateKey.localeCompare(currentKey) < 0) age.fastestResearchStart = candidate;
  }
}

function addPlayerGame(
  aggregate: MutableAggregate,
  game: ReplayAggregateGameInput,
  player: ReplayPlayerAnalysis,
): void {
  aggregate.gamesAnalyzed += 1;
  aggregate.totalActions += player.totalActions;
  aggregate.totalDurationSeconds += game.durationSeconds;
  aggregate.highestPeak30sRawApm = maxRecord(
    aggregate.highestPeak30sRawApm,
    recordFromPeak(player.peak30sRawApm, game.matchId, game.gameId),
  );
  aggregate.highestPeak60sRawApm = maxRecord(
    aggregate.highestPeak60sRawApm,
    recordFromPeak(player.peak60sRawApm, game.matchId, game.gameId),
  );

  addAgeSample(aggregate.ageResearch.feudal, player.ageResearchStartedAt.feudalAtMs, game.matchId, game.gameId);
  addAgeSample(aggregate.ageResearch.castle, player.ageResearchStartedAt.castleAtMs, game.matchId, game.gameId);
  addAgeSample(aggregate.ageResearch.imperial, player.ageResearchStartedAt.imperialAtMs, game.matchId, game.gameId);

  if (player.civilizationId != null) {
    const key = String(player.civilizationId);
    aggregate.civilizationUsage[key] = (aggregate.civilizationUsage[key] ?? 0) + 1;
  }

  aggregate.marketBuyCommands += player.market.buyCommands;
  aggregate.marketSellCommands += player.market.sellCommands;
  aggregate.tributeCommandsSent += player.tribute.commandsSent;

  for (const strategy of player.strategies) {
    aggregate.strategyCounts[strategy.code] = (aggregate.strategyCounts[strategy.code] ?? 0) + 1;
  }
}

function finishAge(age: MutableAgeAggregate): ReplayAgeAggregate {
  return {
    samples: age.samples,
    averageResearchStartSeconds: age.samples ? rounded(age.totalSeconds / age.samples, 1) : null,
    fastestResearchStart: age.fastestResearchStart,
  };
}

function finish(aggregate: MutableAggregate): ReplayPlayerAggregate {
  const weightedAverageRawApm = aggregate.totalDurationSeconds > 0
    ? rounded(aggregate.totalActions / (aggregate.totalDurationSeconds / 60), 1)
    : 0;

  return {
    schemaVersion: REPLAY_PLAYER_AGGREGATES_VERSION,
    playerId: aggregate.playerId,
    gamesAnalyzed: aggregate.gamesAnalyzed,
    totalActions: aggregate.totalActions,
    totalDurationSeconds: aggregate.totalDurationSeconds,
    weightedAverageRawApm,
    highestPeak30sRawApm: aggregate.highestPeak30sRawApm,
    highestPeak60sRawApm: aggregate.highestPeak60sRawApm,
    ageResearch: {
      feudal: finishAge(aggregate.ageResearch.feudal),
      castle: finishAge(aggregate.ageResearch.castle),
      imperial: finishAge(aggregate.ageResearch.imperial),
    },
    civilizationUsage: Object.fromEntries(
      Object.entries(aggregate.civilizationUsage).sort((a, b) => Number(a[0]) - Number(b[0])),
    ),
    market: {
      buyCommands: aggregate.marketBuyCommands,
      sellCommands: aggregate.marketSellCommands,
    },
    tribute: {
      commandsSent: aggregate.tributeCommandsSent,
    },
    strategyCounts: Object.fromEntries(
      Object.entries(aggregate.strategyCounts).sort(([left], [right]) => left.localeCompare(right)),
    ) as Partial<Record<ReplayStrategyCode, number>>,
  };
}

function aggregateKey(seasonId: string, playerId: string): string {
  return `${seasonId}\u0000${playerId}`;
}

export function rebuildReplayPlayerAggregates(games: ReplayAggregateGameInput[]): ReplayPlayerAggregateRebuild {
  const lifetime = new Map<string, MutableAggregate>();
  const seasonal = new Map<string, MutableAggregate>();

  const orderedGames = [...games].sort((left, right) => {
    const matchCompare = left.matchId.localeCompare(right.matchId);
    return matchCompare || left.gameId.localeCompare(right.gameId);
  });

  for (const game of orderedGames) {
    if (!Number.isFinite(game.durationSeconds) || game.durationSeconds <= 0) continue;

    for (const player of game.players) {
      if (game.affectsLifetimeStats) {
        const aggregate = lifetime.get(player.playerId) ?? emptyAggregate(player.playerId);
        addPlayerGame(aggregate, game, player);
        lifetime.set(player.playerId, aggregate);
      }

      if (game.affectsSeasonStats && game.seasonId) {
        const key = aggregateKey(game.seasonId, player.playerId);
        const aggregate = seasonal.get(key) ?? emptyAggregate(player.playerId);
        addPlayerGame(aggregate, game, player);
        seasonal.set(key, aggregate);
      }
    }
  }

  return {
    schemaVersion: REPLAY_PLAYER_AGGREGATES_VERSION,
    lifetime: [...lifetime.values()].map(finish).sort((a, b) => a.playerId.localeCompare(b.playerId)),
    seasonal: [...seasonal.entries()]
      .map(([key, aggregate]) => ({ seasonId: key.split("\u0000", 1)[0], stats: finish(aggregate) }))
      .sort((a, b) => a.seasonId.localeCompare(b.seasonId) || a.stats.playerId.localeCompare(b.stats.playerId)),
  };
}
