import type { BattleSocialEvidenceAdapterResult } from "./battleSocialEvidenceAdapter.js";
import {
  CHRONICLE_SOCIAL_SOURCE_ADAPTER_VERSION,
  CHRONICLE_SOCIAL_SOURCE_VERSION,
  buildBattleSocialEvidenceFromChronicleSource,
} from "./chronicleSocialSourceAdapter.js";
import type { DiplomacyTimeline } from "./diplomacyTimeline.js";

export const CHRONICLE_SOCIAL_SOURCE_PRODUCTION_ADAPTER_VERSION =
  "AOF_CHRONICLE_SOCIAL_SOURCE_PRODUCTION_ADAPTER_V1";

type PressureQualification = "QUALIFIED" | "ALLIED" | "UNKNOWN";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function integer(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function pressureQualification(
  timeline: DiplomacyTimeline,
  sourcePlayerId: number,
  targetPlayerId: number,
  startMs: number,
  endMs: number,
): PressureQualification {
  const segments = timeline.directedSegments.filter((segment) =>
    segment.fromPlayerId === sourcePlayerId &&
    segment.toPlayerId === targetPlayerId &&
    segment.startMs <= endMs &&
    segment.endMs >= startMs,
  );
  if (!segments.length) return "UNKNOWN";
  if (segments.some((segment) => segment.coverage !== "QUALIFIED" || segment.stance === "UNKNOWN")) {
    return "UNKNOWN";
  }
  if (segments.some((segment) => segment.stance === "ALLY")) return "ALLIED";
  return "QUALIFIED";
}

function validateOptionalSupportIntervals(source: Record<string, unknown>): void {
  const match = record(source.match);
  const durationMs = integer(match.durationMs);
  if (durationMs == null || durationMs < 0) return;
  for (const family of ["reinforcements", "defensiveAssists"] as const) {
    for (const raw of array(source[family])) {
      const row = record(raw);
      const start = integer(row.startedAtMs) ?? integer(row.firstContributionAtMs);
      const end = integer(row.endedAtMs);
      if (end == null) continue;
      if (start == null || start < 0 || end < start || end > durationMs) {
        throw new Error(`${family} contains an invalid social-evidence interval.`);
      }
    }
  }
}

/**
 * Production/shadow guard around the generic source adapter.
 *
 * The core adapter is reusable by fixtures and development projections. This
 * wrapper enforces the stricter persisted-source contract and recomputes raid
 * suppression diagnostics from temporal diplomacy so ALLIED and UNKNOWN are
 * never conflated in the audit trail.
 */
export function buildProductionBattleSocialEvidence(input: {
  matchId: string;
  source: unknown;
}): BattleSocialEvidenceAdapterResult {
  const source = record(input.source);
  if (source.schemaVersion !== CHRONICLE_SOCIAL_SOURCE_VERSION) {
    throw new Error(`Unsupported production Chronicle social source schema ${String(source.schemaVersion)}.`);
  }
  validateOptionalSupportIntervals(source);

  const result = buildBattleSocialEvidenceFromChronicleSource(input);
  let suppressedAllied = 0;
  let suppressedUnknown = 0;
  let qualified = 0;

  for (const raw of array(source.raids)) {
    const raid = record(raw);
    const sourcePlayerId = integer(raid.attackerPlayerId);
    const targetPlayerId = integer(raid.victimPlayerId);
    const startMs = integer(raid.startedAtMs);
    const endMs = integer(raid.endedAtMs);
    if (sourcePlayerId == null || targetPlayerId == null || startMs == null || endMs == null) {
      suppressedUnknown += 1;
      continue;
    }
    const qualification = pressureQualification(
      result.diplomacyTimeline,
      sourcePlayerId,
      targetPlayerId,
      startMs,
      endMs,
    );
    if (qualification === "ALLIED") suppressedAllied += 1;
    else if (qualification === "UNKNOWN") suppressedUnknown += 1;
    else qualified += 1;
  }

  if (qualified !== result.diagnostics.raidObservationsEmitted) {
    throw new Error(
      `Chronicle raid qualification mismatch: ${qualified} qualified source raids but ` +
      `${result.diagnostics.raidObservationsEmitted} observations were emitted.`,
    );
  }

  return {
    ...result,
    diagnostics: {
      ...result.diagnostics,
      raidCandidatesSeen: array(source.raids).length,
      raidCandidatesSuppressedAllied: suppressedAllied,
      raidCandidatesSuppressedUnknownDiplomacy: suppressedUnknown,
    },
  };
}

export {
  CHRONICLE_SOCIAL_SOURCE_ADAPTER_VERSION,
  CHRONICLE_SOCIAL_SOURCE_VERSION,
};
