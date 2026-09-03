export const ACHIEVEMENT_ENGINE_VERSION = "ACHIEVEMENT_ENGINE_V1";

export type AchievementScope = "LIFETIME" | "SEASON";
export type AchievementStatus = "ACTIVE" | "INACTIVE";

export type AchievementMetric =
  | "MATCHES_PLAYED"
  | "MATCHES_WON"
  | "LONGEST_WIN_STREAK"
  | "PEAK_30S_RAW_APM"
  | "PEAK_60S_RAW_APM"
  | "FAST_FEUDAL_COUNT"
  | "FAST_CASTLE_COUNT"
  | "FAST_IMPERIAL_COUNT"
  | "MILITIA_OPENING_COUNT"
  | "SCOUT_OPENING_COUNT"
  | "ARCHER_OPENING_COUNT";

export interface AchievementRule {
  metric: AchievementMetric;
  operator: "GTE";
  threshold: number;
}

export interface AchievementDefinition {
  achievementId: string;
  name: string;
  description: string;
  status: AchievementStatus;
  scope: AchievementScope;
  definitionVersion: number;
  rule: AchievementRule;
}

export interface AchievementPlayerMetrics {
  matchesPlayed: number;
  matchesWon: number;
  longestWinStreak: number;
  peak30sRawApm: number;
  peak60sRawApm: number;
  fastFeudalCount: number;
  fastCastleCount: number;
  fastImperialCount: number;
  militiaOpeningCount: number;
  scoutOpeningCount: number;
  archerOpeningCount: number;
}

export interface AchievementEvaluation {
  qualified: boolean;
  metric: AchievementMetric;
  actualValue: number;
  threshold: number;
}

const METRICS: AchievementMetric[] = [
  "MATCHES_PLAYED",
  "MATCHES_WON",
  "LONGEST_WIN_STREAK",
  "PEAK_30S_RAW_APM",
  "PEAK_60S_RAW_APM",
  "FAST_FEUDAL_COUNT",
  "FAST_CASTLE_COUNT",
  "FAST_IMPERIAL_COUNT",
  "MILITIA_OPENING_COUNT",
  "SCOUT_OPENING_COUNT",
  "ARCHER_OPENING_COUNT",
];

export function validateAchievementDefinition(input: AchievementDefinition): AchievementDefinition {
  const achievementId = input.achievementId?.trim();
  const name = input.name?.trim();
  const description = input.description?.trim();

  if (!achievementId || !/^[A-Z0-9_]{2,80}$/.test(achievementId)) {
    throw new Error("achievementId must use 2–80 uppercase letters, numbers, or underscores.");
  }
  if (!name || name.length > 100) throw new Error("Achievement name must contain 1–100 characters.");
  if (!description || description.length > 500) {
    throw new Error("Achievement description must contain 1–500 characters.");
  }
  if (input.status !== "ACTIVE" && input.status !== "INACTIVE") {
    throw new Error("Achievement status must be ACTIVE or INACTIVE.");
  }
  if (input.scope !== "LIFETIME" && input.scope !== "SEASON") {
    throw new Error("Achievement scope must be LIFETIME or SEASON.");
  }
  if (!Number.isInteger(input.definitionVersion) || input.definitionVersion < 1) {
    throw new Error("definitionVersion must be a positive integer.");
  }
  if (!METRICS.includes(input.rule?.metric)) throw new Error("Unsupported achievement metric.");
  if (input.rule?.operator !== "GTE") throw new Error("Achievement Engine V1 supports only GTE rules.");
  if (!Number.isFinite(input.rule.threshold) || input.rule.threshold < 0) {
    throw new Error("Achievement threshold must be a non-negative number.");
  }

  return {
    achievementId,
    name,
    description,
    status: input.status,
    scope: input.scope,
    definitionVersion: input.definitionVersion,
    rule: { ...input.rule },
  };
}

function metricValue(metrics: AchievementPlayerMetrics, metric: AchievementMetric): number {
  switch (metric) {
    case "MATCHES_PLAYED": return metrics.matchesPlayed;
    case "MATCHES_WON": return metrics.matchesWon;
    case "LONGEST_WIN_STREAK": return metrics.longestWinStreak;
    case "PEAK_30S_RAW_APM": return metrics.peak30sRawApm;
    case "PEAK_60S_RAW_APM": return metrics.peak60sRawApm;
    case "FAST_FEUDAL_COUNT": return metrics.fastFeudalCount;
    case "FAST_CASTLE_COUNT": return metrics.fastCastleCount;
    case "FAST_IMPERIAL_COUNT": return metrics.fastImperialCount;
    case "MILITIA_OPENING_COUNT": return metrics.militiaOpeningCount;
    case "SCOUT_OPENING_COUNT": return metrics.scoutOpeningCount;
    case "ARCHER_OPENING_COUNT": return metrics.archerOpeningCount;
  }
}

export function evaluateAchievement(
  definition: AchievementDefinition,
  metrics: AchievementPlayerMetrics,
): AchievementEvaluation {
  const actualValue = metricValue(metrics, definition.rule.metric);
  return {
    qualified: definition.status === "ACTIVE" && actualValue >= definition.rule.threshold,
    metric: definition.rule.metric,
    actualValue,
    threshold: definition.rule.threshold,
  };
}

export function achievementAwardId(
  definition: AchievementDefinition,
  seasonId: string | null,
): string {
  if (definition.scope === "LIFETIME") return `LIFETIME_${definition.achievementId}`;
  if (!seasonId) throw new Error(`Season achievement ${definition.achievementId} requires a seasonId.`);
  return `SEASON_${seasonId}_${definition.achievementId}`;
}
