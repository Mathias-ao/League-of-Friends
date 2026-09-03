import type {
  ReplayActionSecondBucket,
  ReplayDerivedGameStats,
  ReplayDerivedPlayerStats,
  ReplayProductionEvent,
} from "./replayDerivedStats.js";

export const REPLAY_ANALYSIS_VERSION = "REPLAY_ANALYSIS_V1";

export const DEFAULT_REPLAY_ANALYSIS_CONFIG = {
  fastFeudalMaxSeconds: 600,
  fastCastleMaxSeconds: 960,
  fastImperialMaxSeconds: 1800,
  openingCandidateMaxSeconds: 900,
  openingCandidateMinUnits: 2,
  peakApmWindowsSeconds: [30, 60] as [30, 60],
} as const;

export interface ReplayAnalysisConfig {
  fastFeudalMaxSeconds: number;
  fastCastleMaxSeconds: number;
  fastImperialMaxSeconds: number;
  openingCandidateMaxSeconds: number;
  openingCandidateMinUnits: number;
  peakApmWindowsSeconds: [30, 60];
}

export type ReplayStrategyCode =
  | "FAST_FEUDAL"
  | "FAST_CASTLE"
  | "FAST_IMPERIAL"
  | "MILITIA_OPENING_CANDIDATE"
  | "SCOUT_OPENING_CANDIDATE"
  | "ARCHER_OPENING_CANDIDATE";

export interface ReplayStrategyDetection {
  code: ReplayStrategyCode;
  detectedAtMs: number;
  evidence: Record<string, number | string | null>;
}

export interface PeakApmResult {
  windowSeconds: number;
  apm: number;
  actions: number;
  windowStartSecond: number;
  windowEndSecond: number;
}

export interface ReplayApmMinuteBucket {
  minute: number;
  startSecond: number;
  endSecond: number;
  actions: number;
  rawApm: number;
}

export interface ReplayPlayerAnalysis {
  playerId: string;
  replaySlot: number;
  sourceName: string | null;
  civilizationId: number | null;
  totalActions: number;
  averageRawApm: number;
  peak30sRawApm: PeakApmResult | null;
  peak60sRawApm: PeakApmResult | null;
  apmByMinute: ReplayApmMinuteBucket[];
  ageResearchStartedAt: ReplayDerivedPlayerStats["ageResearchStartedAt"];
  firstProductionByUnitId: Record<string, { atMs: number; amount: number }>;
  market: {
    buyCommands: number;
    sellCommands: number;
  };
  tribute: {
    commandsSent: number;
  };
  strategies: ReplayStrategyDetection[];
  timelineDetailAvailable: boolean;
}

export interface ReplayGameAnalysis {
  schemaVersion: typeof REPLAY_ANALYSIS_VERSION;
  sourceFactsSchemaVersion: string;
  config: ReplayAnalysisConfig;
  durationSeconds: number;
  players: ReplayPlayerAnalysis[];
}

const UNIT_IDS = {
  archer: 4,
  militia: 74,
  scoutCavalry: 448,
} as const;

function rounded(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function assertPositiveInteger(value: number, field: string, max: number): void {
  if (!Number.isInteger(value) || value <= 0 || value > max) {
    throw new Error(`${field} must be a positive integer <= ${max}.`);
  }
}

export function validateReplayAnalysisConfig(config: ReplayAnalysisConfig): ReplayAnalysisConfig {
  assertPositiveInteger(config.fastFeudalMaxSeconds, "fastFeudalMaxSeconds", 3600);
  assertPositiveInteger(config.fastCastleMaxSeconds, "fastCastleMaxSeconds", 7200);
  assertPositiveInteger(config.fastImperialMaxSeconds, "fastImperialMaxSeconds", 10800);
  assertPositiveInteger(config.openingCandidateMaxSeconds, "openingCandidateMaxSeconds", 3600);
  assertPositiveInteger(config.openingCandidateMinUnits, "openingCandidateMinUnits", 20);
  if (config.fastFeudalMaxSeconds >= config.fastCastleMaxSeconds) {
    throw new Error("fastFeudalMaxSeconds must be lower than fastCastleMaxSeconds.");
  }
  if (config.fastCastleMaxSeconds >= config.fastImperialMaxSeconds) {
    throw new Error("fastCastleMaxSeconds must be lower than fastImperialMaxSeconds.");
  }
  return { ...config, peakApmWindowsSeconds: [30, 60] };
}

function averageRawApm(player: ReplayDerivedPlayerStats, durationSeconds: number): number {
  if (durationSeconds <= 0) return 0;
  return rounded(player.totalActions / (durationSeconds / 60), 1);
}

function actionArray(buckets: ReplayActionSecondBucket[], durationSeconds: number): number[] {
  const length = Math.max(1, durationSeconds + 1);
  const values = new Array<number>(length).fill(0);
  for (const bucket of buckets) {
    if (bucket.second >= 0 && bucket.second < length) values[bucket.second] += bucket.count;
  }
  return values;
}

function peakApm(buckets: ReplayActionSecondBucket[], durationSeconds: number, windowSeconds: number): PeakApmResult | null {
  if (!buckets.length || durationSeconds <= 0) return null;
  const values = actionArray(buckets, durationSeconds);
  let rolling = 0;
  let bestActions = -1;
  let bestEnd = 0;

  for (let second = 0; second < values.length; second += 1) {
    rolling += values[second];
    if (second >= windowSeconds) rolling -= values[second - windowSeconds];
    if (rolling > bestActions) {
      bestActions = rolling;
      bestEnd = second;
    }
  }

  const start = Math.max(0, bestEnd - windowSeconds + 1);
  return {
    windowSeconds,
    actions: Math.max(0, bestActions),
    apm: rounded(Math.max(0, bestActions) * (60 / windowSeconds), 1),
    windowStartSecond: start,
    windowEndSecond: bestEnd,
  };
}

function minuteBuckets(buckets: ReplayActionSecondBucket[], durationSeconds: number): ReplayApmMinuteBucket[] {
  if (!buckets.length || durationSeconds <= 0) return [];
  const values = actionArray(buckets, durationSeconds);
  const result: ReplayApmMinuteBucket[] = [];
  for (let start = 0, minute = 1; start <= durationSeconds; start += 60, minute += 1) {
    const end = Math.min(durationSeconds, start + 59);
    let actions = 0;
    for (let second = start; second <= end; second += 1) actions += values[second] ?? 0;
    const secondsInBucket = Math.max(1, end - start + 1);
    result.push({
      minute,
      startSecond: start,
      endSecond: end,
      actions,
      rawApm: rounded(actions * (60 / secondsInBucket), 1),
    });
  }
  return result;
}

function firstProductionByUnitId(events: ReplayProductionEvent[]): Record<string, { atMs: number; amount: number }> {
  const result: Record<string, { atMs: number; amount: number }> = {};
  for (const event of events) {
    if (event.unitId == null) continue;
    const key = String(event.unitId);
    if (!result[key]) result[key] = { atMs: event.atMs, amount: event.amount };
  }
  return result;
}

function earlyUnitEvidence(
  events: ReplayProductionEvent[],
  unitId: number,
  maxSeconds: number,
): { count: number; firstAtMs: number | null } {
  const cutoffMs = maxSeconds * 1000;
  const matching = events.filter((event) => event.unitId === unitId && event.atMs <= cutoffMs);
  return {
    count: matching.reduce((sum, event) => sum + event.amount, 0),
    firstAtMs: matching.length ? matching[0].atMs : null,
  };
}

function strategies(player: ReplayDerivedPlayerStats, config: ReplayAnalysisConfig): ReplayStrategyDetection[] {
  const result: ReplayStrategyDetection[] = [];
  const ages = player.ageResearchStartedAt;

  if (ages.feudalAtMs != null && ages.feudalAtMs <= config.fastFeudalMaxSeconds * 1000) {
    result.push({
      code: "FAST_FEUDAL",
      detectedAtMs: ages.feudalAtMs,
      evidence: { researchStartedAtMs: ages.feudalAtMs, thresholdSeconds: config.fastFeudalMaxSeconds },
    });
  }
  if (ages.castleAtMs != null && ages.castleAtMs <= config.fastCastleMaxSeconds * 1000) {
    result.push({
      code: "FAST_CASTLE",
      detectedAtMs: ages.castleAtMs,
      evidence: { researchStartedAtMs: ages.castleAtMs, thresholdSeconds: config.fastCastleMaxSeconds },
    });
  }
  if (ages.imperialAtMs != null && ages.imperialAtMs <= config.fastImperialMaxSeconds * 1000) {
    result.push({
      code: "FAST_IMPERIAL",
      detectedAtMs: ages.imperialAtMs,
      evidence: { researchStartedAtMs: ages.imperialAtMs, thresholdSeconds: config.fastImperialMaxSeconds },
    });
  }

  const openingCandidates: Array<[number, ReplayStrategyCode]> = [
    [UNIT_IDS.militia, "MILITIA_OPENING_CANDIDATE"],
    [UNIT_IDS.scoutCavalry, "SCOUT_OPENING_CANDIDATE"],
    [UNIT_IDS.archer, "ARCHER_OPENING_CANDIDATE"],
  ];
  for (const [unitId, code] of openingCandidates) {
    const evidence = earlyUnitEvidence(player.productionEvents, unitId, config.openingCandidateMaxSeconds);
    if (evidence.count >= config.openingCandidateMinUnits && evidence.firstAtMs != null) {
      result.push({
        code,
        detectedAtMs: evidence.firstAtMs,
        evidence: {
          unitId,
          earlyUnitsQueued: evidence.count,
          firstProductionAtMs: evidence.firstAtMs,
          cutoffSeconds: config.openingCandidateMaxSeconds,
        },
      });
    }
  }

  return result.sort((left, right) => left.detectedAtMs - right.detectedAtMs || left.code.localeCompare(right.code));
}

export function analyzeReplayStats(
  facts: ReplayDerivedGameStats,
  configInput: ReplayAnalysisConfig = DEFAULT_REPLAY_ANALYSIS_CONFIG,
): ReplayGameAnalysis {
  const config = validateReplayAnalysisConfig(configInput);
  return {
    schemaVersion: REPLAY_ANALYSIS_VERSION,
    sourceFactsSchemaVersion: facts.schemaVersion,
    config,
    durationSeconds: facts.durationSeconds,
    players: facts.players.map((player) => ({
      playerId: player.playerId,
      replaySlot: player.replaySlot,
      sourceName: player.sourceName,
      civilizationId: player.civilizationId,
      totalActions: player.totalActions,
      averageRawApm: averageRawApm(player, facts.durationSeconds),
      peak30sRawApm: peakApm(player.actionSeconds, facts.durationSeconds, 30),
      peak60sRawApm: peakApm(player.actionSeconds, facts.durationSeconds, 60),
      apmByMinute: minuteBuckets(player.actionSeconds, facts.durationSeconds),
      ageResearchStartedAt: player.ageResearchStartedAt,
      firstProductionByUnitId: firstProductionByUnitId(player.productionEvents),
      market: {
        buyCommands: player.marketEvents.filter((event) => event.type === "BUY").length,
        sellCommands: player.marketEvents.filter((event) => event.type === "SELL").length,
      },
      tribute: {
        commandsSent: player.tributeEvents.length,
      },
      strategies: strategies(player, config),
      timelineDetailAvailable: facts.eventDetailLevel === "TIMELINE_V2",
    })),
  };
}
