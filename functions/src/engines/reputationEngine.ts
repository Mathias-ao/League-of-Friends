export const REPUTATION_ENGINE_VERSION = "AOF_REPUTATION_ENGINE_V1";

export type ReputationTrack = "GALLANTRY" | "CRUELTY" | "CHIVALRY";

export type ReputationDeedType =
  | "DIRECT_CONTEST"
  | "FORWARD_ASSAULT"
  | "GREAT_BATTLE_PARTICIPATION"
  | "REPEATED_ECONOMIC_PRESSURE"
  | "RELIC_THEFT"
  | "CONCENTRATED_HOSTILITY"
  | "DEFENSIVE_ASSIST"
  | "ALLY_REINFORCEMENT"
  | "COOPERATIVE_ATTACK"
  | "MATERIAL_SUPPORT";

export interface ReputationDeed {
  deedId: string;
  playerId: string;
  battleId: string;
  eventId?: string | null;
  occurredAtMs: number;
  type: ReputationDeedType;
  units: number;
  sourceVersion: string;
  evidenceRefs: string[];
}

export interface ReputationRule {
  ruleId: string;
  track: ReputationTrack;
  deedType: ReputationDeedType;
  pointsPerUnit: number;
  maximumUnitsPerBattle?: number;
}

export interface ReputationRuleSet {
  ruleVersion: string;
  rules: ReputationRule[];
}

export interface ReputationContribution {
  ruleId: string;
  deedId: string;
  battleId: string;
  track: ReputationTrack;
  deedType: ReputationDeedType;
  observedUnits: number;
  appliedUnits: number;
  points: number;
}

export interface ReputationTrackProjection {
  track: ReputationTrack;
  status: "UNCONFIGURED" | "READY";
  points: number | null;
  contributions: ReputationContribution[];
}

export interface ReputationProjection {
  engineVersion: typeof REPUTATION_ENGINE_VERSION;
  ruleVersion: string | null;
  playerId: string;
  gallantry: ReputationTrackProjection;
  cruelty: ReputationTrackProjection;
  chivalry: ReputationTrackProjection;
}

export function validateReputationRuleSet(ruleSet: ReputationRuleSet): ReputationRuleSet {
  if (!ruleSet.ruleVersion) throw new Error("Reputation ruleVersion is required.");
  const ids = new Set<string>();
  for (const rule of ruleSet.rules) {
    if (!rule.ruleId) throw new Error("Reputation rules require ruleId.");
    if (ids.has(rule.ruleId)) throw new Error(`Duplicate reputation ruleId: ${rule.ruleId}.`);
    ids.add(rule.ruleId);
    if (!Number.isFinite(rule.pointsPerUnit) || rule.pointsPerUnit < 0) {
      throw new Error(`Rule ${rule.ruleId} pointsPerUnit must be a non-negative finite number.`);
    }
    if (rule.maximumUnitsPerBattle != null && (!Number.isFinite(rule.maximumUnitsPerBattle) || rule.maximumUnitsPerBattle < 0)) {
      throw new Error(`Rule ${rule.ruleId} maximumUnitsPerBattle must be non-negative when provided.`);
    }
  }
  return { ruleVersion: ruleSet.ruleVersion, rules: ruleSet.rules.map((rule) => ({ ...rule })) };
}

function unconfigured(track: ReputationTrack): ReputationTrackProjection {
  return { track, status: "UNCONFIGURED", points: null, contributions: [] };
}

function evaluateTrack(
  track: ReputationTrack,
  deeds: ReputationDeed[],
  rules: ReputationRule[],
): ReputationTrackProjection {
  const contributions: ReputationContribution[] = [];
  for (const deed of deeds) {
    for (const rule of rules.filter((candidate) => candidate.track === track && candidate.deedType === deed.type)) {
      const appliedUnits = rule.maximumUnitsPerBattle == null
        ? deed.units
        : Math.min(deed.units, rule.maximumUnitsPerBattle);
      contributions.push({
        ruleId: rule.ruleId,
        deedId: deed.deedId,
        battleId: deed.battleId,
        track,
        deedType: deed.type,
        observedUnits: deed.units,
        appliedUnits,
        points: appliedUnits * rule.pointsPerUnit,
      });
    }
  }
  return {
    track,
    status: "READY",
    points: contributions.reduce((sum, contribution) => sum + contribution.points, 0),
    contributions,
  };
}

export function evaluateReputation(
  playerId: string,
  deeds: ReputationDeed[],
  ruleSetInput: ReputationRuleSet | null,
): ReputationProjection {
  for (const deed of deeds) {
    if (deed.playerId !== playerId) throw new Error(`Reputation deed ${deed.deedId} belongs to another player.`);
    if (!Number.isFinite(deed.units) || deed.units < 0) throw new Error(`Reputation deed ${deed.deedId} units must be non-negative.`);
    if (!deed.sourceVersion) throw new Error(`Reputation deed ${deed.deedId} sourceVersion is required.`);
  }
  if (!ruleSetInput) {
    return {
      engineVersion: REPUTATION_ENGINE_VERSION,
      ruleVersion: null,
      playerId,
      gallantry: unconfigured("GALLANTRY"),
      cruelty: unconfigured("CRUELTY"),
      chivalry: unconfigured("CHIVALRY"),
    };
  }
  const ruleSet = validateReputationRuleSet(ruleSetInput);
  return {
    engineVersion: REPUTATION_ENGINE_VERSION,
    ruleVersion: ruleSet.ruleVersion,
    playerId,
    gallantry: evaluateTrack("GALLANTRY", deeds, ruleSet.rules),
    cruelty: evaluateTrack("CRUELTY", deeds, ruleSet.rules),
    chivalry: evaluateTrack("CHIVALRY", deeds, ruleSet.rules),
  };
}
