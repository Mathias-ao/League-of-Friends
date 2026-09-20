import {
  canonicalJson,
  type ReplayStatsPlayerMapping,
} from "./replayStatsIngestion.js";

export const CANONICAL_MATCH_STATISTICS_CONTRACT_VERSION = "AOF_CANONICAL_MATCH_STATISTICS_V1";
export const CANONICAL_STATISTICS_SCHEMA_VERSION = "1.0.0";
export const CANONICAL_STATISTICS_PROJECTION_VERSION = "AOF_CANONICAL_STATISTICS_V1";

export interface CanonicalMatchStatisticsIngestionInput {
  sourceHash: string;
  playerMapping: ReplayStatsPlayerMapping[];
  statistics: Record<string, unknown>;
}

export interface ValidatedCanonicalMatchStatisticsIngestion {
  sourceHash: string;
  playerMapping: ReplayStatsPlayerMapping[];
  statistics: Record<string, unknown>;
  statisticsSchemaVersion: typeof CANONICAL_STATISTICS_SCHEMA_VERSION;
  statisticsProjectionVersion: typeof CANONICAL_STATISTICS_PROJECTION_VERSION;
  canonicalSchemaVersion: string;
}

export class CanonicalMatchStatisticsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanonicalMatchStatisticsValidationError";
  }
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CanonicalMatchStatisticsValidationError(`${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new CanonicalMatchStatisticsValidationError(`${field} must be a string.`);
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    throw new CanonicalMatchStatisticsValidationError(`${field} must contain 1–${maxLength} characters.`);
  }
  return trimmed;
}

function replaySlot(value: unknown, field: string): number {
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 8) {
    throw new CanonicalMatchStatisticsValidationError(`${field} must be an integer from 1 to 8.`);
  }
  return Number(value);
}

function validatePlayerMapping(input: ReplayStatsPlayerMapping[]): ReplayStatsPlayerMapping[] {
  if (!Array.isArray(input) || input.length < 2 || input.length > 8) {
    throw new CanonicalMatchStatisticsValidationError("playerMapping must contain 2–8 players.");
  }

  const playerIds = new Set<string>();
  const slots = new Set<number>();
  return input.map((mapping, index) => {
    const playerId = text(mapping?.playerId, `playerMapping[${index}].playerId`, 200);
    const slot = replaySlot(mapping?.replaySlot, `playerMapping[${index}].replaySlot`);
    if (playerIds.has(playerId)) {
      throw new CanonicalMatchStatisticsValidationError(`playerMapping contains duplicate playerId ${playerId}.`);
    }
    if (slots.has(slot)) {
      throw new CanonicalMatchStatisticsValidationError(`playerMapping contains duplicate replaySlot ${slot}.`);
    }
    playerIds.add(playerId);
    slots.add(slot);
    return {
      playerId,
      replaySlot: slot,
      sourceName: mapping?.sourceName == null ? null : text(mapping.sourceName, `playerMapping[${index}].sourceName`, 200),
    };
  }).sort((left, right) => left.replaySlot - right.replaySlot);
}

function sameSlots(expected: number[], actual: number[]): boolean {
  if (expected.length !== actual.length) return false;
  const left = [...expected].sort((a, b) => a - b);
  const right = [...actual].sort((a, b) => a - b);
  return left.every((slot, index) => slot === right[index]);
}

export function validateCanonicalMatchStatisticsIngestion(
  input: CanonicalMatchStatisticsIngestionInput,
): ValidatedCanonicalMatchStatisticsIngestion {
  const sourceHash = text(input.sourceHash, "sourceHash", 64).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(sourceHash)) {
    throw new CanonicalMatchStatisticsValidationError("sourceHash must be a 64-character SHA-256 hex digest.");
  }

  const playerMapping = validatePlayerMapping(input.playerMapping);
  const statistics = record(input.statistics, "statistics");

  const statisticsSchemaVersion = text(
    statistics.statisticsSchemaVersion,
    "statistics.statisticsSchemaVersion",
    100,
  );
  if (statisticsSchemaVersion !== CANONICAL_STATISTICS_SCHEMA_VERSION) {
    throw new CanonicalMatchStatisticsValidationError(
      `Unsupported canonical statistics schema ${statisticsSchemaVersion}; expected ${CANONICAL_STATISTICS_SCHEMA_VERSION}.`,
    );
  }

  const statisticsProjectionVersion = text(
    statistics.statisticsProjectionVersion,
    "statistics.statisticsProjectionVersion",
    100,
  );
  if (statisticsProjectionVersion !== CANONICAL_STATISTICS_PROJECTION_VERSION) {
    throw new CanonicalMatchStatisticsValidationError(
      `Unsupported canonical statistics projection ${statisticsProjectionVersion}; expected ${CANONICAL_STATISTICS_PROJECTION_VERSION}.`,
    );
  }

  const source = record(statistics.source, "statistics.source");
  const projectedSourceHash = text(source.replaySha256, "statistics.source.replaySha256", 64).toLowerCase();
  if (projectedSourceHash !== sourceHash) {
    throw new CanonicalMatchStatisticsValidationError(
      "statistics.source.replaySha256 must match sourceHash.",
    );
  }
  const canonicalSchemaVersion = text(
    source.canonicalSchemaVersion,
    "statistics.source.canonicalSchemaVersion",
    100,
  );

  if (!Array.isArray(statistics.participants) || statistics.participants.length < 2 || statistics.participants.length > 8) {
    throw new CanonicalMatchStatisticsValidationError("statistics.participants must contain 2–8 players.");
  }

  const participantSlots = new Set<number>();
  for (let index = 0; index < statistics.participants.length; index += 1) {
    const participant = record(statistics.participants[index], `statistics.participants[${index}]`);
    const slot = replaySlot(participant.replaySlot, `statistics.participants[${index}].replaySlot`);
    if (participantSlots.has(slot)) {
      throw new CanonicalMatchStatisticsValidationError(`statistics.participants contains duplicate replaySlot ${slot}.`);
    }
    participantSlots.add(slot);

    record(participant.opening, `statistics.participants[${index}].opening`);
    record(participant.economy, `statistics.participants[${index}].economy`);
    record(participant.combat, `statistics.participants[${index}].combat`);
    record(participant.mapPresence, `statistics.participants[${index}].mapPresence`);
    record(participant.observedCommands, `statistics.participants[${index}].observedCommands`);
    record(participant.selectionEvidence, `statistics.participants[${index}].selectionEvidence`);
  }

  if (!sameSlots(
    playerMapping.map((mapping) => mapping.replaySlot),
    [...participantSlots],
  )) {
    throw new CanonicalMatchStatisticsValidationError(
      "playerMapping replay slots must cover exactly the projected statistics participants.",
    );
  }

  record(statistics.commandEvidence, "statistics.commandEvidence");
  if (!Array.isArray(statistics.warnings)) {
    throw new CanonicalMatchStatisticsValidationError("statistics.warnings must be an array.");
  }

  const serialized = canonicalJson(statistics);
  if (serialized.length > 800_000) {
    throw new CanonicalMatchStatisticsValidationError(
      "statistics are too large for one Firestore Match Statistics document (800,000 character safety limit).",
    );
  }

  return {
    sourceHash,
    playerMapping,
    statistics,
    statisticsSchemaVersion: CANONICAL_STATISTICS_SCHEMA_VERSION,
    statisticsProjectionVersion: CANONICAL_STATISTICS_PROJECTION_VERSION,
    canonicalSchemaVersion,
  };
}
