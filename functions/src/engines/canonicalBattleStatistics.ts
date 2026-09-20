import { canonicalJson } from "./replayStatsIngestion.js";

export const CANONICAL_BATTLE_STATISTICS_CONTRACT_VERSION = "AOF_BATTLE_STATISTICS_INGESTION_V1";
export const CANONICAL_STATISTICS_PROJECTION_VERSION = "AOF_CANONICAL_STATISTICS_V1";
export const CANONICAL_STATISTICS_SCHEMA_VERSION = "1.0.0";

const MAX_FIRESTORE_PROJECTION_BYTES = 700_000;

export interface CanonicalBattlePlayerMapping {
  playerId: string;
  canonicalPlayerId: number;
  replaySlot: number;
}

export interface CanonicalStatisticsParticipant {
  playerId: number;
  replaySlot: number;
  isRecorder?: boolean;
  displayName?: string | null;
  buildOrder: Record<string, unknown>;
  opening: Record<string, unknown>;
  economy: Record<string, unknown>;
  combat: Record<string, unknown>;
  mapPresence: Record<string, unknown>;
  observedCommands: Record<string, unknown>;
  selectionEvidence: Record<string, unknown>;
}

export interface CanonicalStatisticsProjectionInput {
  statisticsSchemaVersion: string;
  statisticsProjectionVersion: string;
  source: {
    replaySha256: string;
    canonicalManifestSha256: string;
    extractionRunId: string;
    canonicalSchemaVersion: string;
    parserVersion: string;
  };
  scope?: Record<string, unknown>;
  participants: CanonicalStatisticsParticipant[];
  coverage?: Record<string, unknown>;
  warnings?: unknown[];
}

export interface BattleStatisticsParticipant {
  playerId: string;
  canonicalPlayerId: number;
  replaySlot: number;
  displayName: string | null;
  buildOrder: Record<string, unknown>;
  opening: Record<string, unknown>;
  economy: Record<string, unknown>;
  military: Record<string, unknown>;
  mapPresence: Record<string, unknown>;
  execution: {
    observedCommands: Record<string, unknown>;
    selectionEvidence: Record<string, unknown>;
  };
}

export interface CanonicalBattleStatisticsProjection {
  contractVersion: typeof CANONICAL_BATTLE_STATISTICS_CONTRACT_VERSION;
  statisticsSchemaVersion: string;
  statisticsProjectionVersion: string;
  source: CanonicalStatisticsProjectionInput["source"];
  scope: Record<string, unknown>;
  participants: BattleStatisticsParticipant[];
  coverage: Record<string, unknown>;
  warnings: unknown[];
}

export class CanonicalBattleStatisticsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanonicalBattleStatisticsValidationError";
  }
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CanonicalBattleStatisticsValidationError(`${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requiredText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new CanonicalBattleStatisticsValidationError(`${field} must be a string.`);
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    throw new CanonicalBattleStatisticsValidationError(
      `${field} must contain 1–${maxLength} characters.`,
    );
  }
  return trimmed;
}

function sha256Text(value: unknown, field: string): string {
  const text = requiredText(value, field, 64).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(text)) {
    throw new CanonicalBattleStatisticsValidationError(`${field} must be a SHA-256 hex digest.`);
  }
  return text;
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isInteger(value) || Number(value) < 1) {
    throw new CanonicalBattleStatisticsValidationError(`${field} must be a positive integer.`);
  }
  return Number(value);
}

function replaySlot(value: unknown, field: string): number {
  const slot = positiveInteger(value, field);
  if (slot > 8) {
    throw new CanonicalBattleStatisticsValidationError(`${field} must be between 1 and 8.`);
  }
  return slot;
}

function normalizeProjectionSource(value: unknown): CanonicalStatisticsProjectionInput["source"] {
  const source = record(value, "source");
  return {
    replaySha256: sha256Text(source.replaySha256, "source.replaySha256"),
    canonicalManifestSha256: sha256Text(
      source.canonicalManifestSha256,
      "source.canonicalManifestSha256",
    ),
    extractionRunId: requiredText(source.extractionRunId, "source.extractionRunId", 200),
    canonicalSchemaVersion: requiredText(
      source.canonicalSchemaVersion,
      "source.canonicalSchemaVersion",
      100,
    ),
    parserVersion: requiredText(source.parserVersion, "source.parserVersion", 200),
  };
}

function normalizeParticipant(value: unknown, index: number): CanonicalStatisticsParticipant {
  const participant = record(value, `participants[${index}]`);
  return {
    playerId: positiveInteger(participant.playerId, `participants[${index}].playerId`),
    replaySlot: replaySlot(participant.replaySlot, `participants[${index}].replaySlot`),
    isRecorder: participant.isRecorder === true,
    displayName: participant.displayName == null
      ? null
      : requiredText(participant.displayName, `participants[${index}].displayName`, 200),
    buildOrder: record(participant.buildOrder, `participants[${index}].buildOrder`),
    opening: record(participant.opening, `participants[${index}].opening`),
    economy: record(participant.economy, `participants[${index}].economy`),
    combat: record(participant.combat, `participants[${index}].combat`),
    mapPresence: record(participant.mapPresence, `participants[${index}].mapPresence`),
    observedCommands: record(
      participant.observedCommands,
      `participants[${index}].observedCommands`,
    ),
    selectionEvidence: record(
      participant.selectionEvidence,
      `participants[${index}].selectionEvidence`,
    ),
  };
}

function normalizeMappings(value: unknown, participantCount: number): CanonicalBattlePlayerMapping[] {
  if (!Array.isArray(value) || value.length !== participantCount) {
    throw new CanonicalBattleStatisticsValidationError(
      "playerMapping must cover every canonical statistics participant exactly once.",
    );
  }

  const playerIds = new Set<string>();
  const canonicalPlayerIds = new Set<number>();
  const slots = new Set<number>();

  return value.map((raw, index) => {
    const mapping = record(raw, `playerMapping[${index}]`);
    const playerId = requiredText(mapping.playerId, `playerMapping[${index}].playerId`, 200);
    const canonicalPlayerId = positiveInteger(
      mapping.canonicalPlayerId,
      `playerMapping[${index}].canonicalPlayerId`,
    );
    const slot = replaySlot(mapping.replaySlot, `playerMapping[${index}].replaySlot`);

    if (playerIds.has(playerId)) {
      throw new CanonicalBattleStatisticsValidationError(
        `playerMapping contains duplicate playerId ${playerId}.`,
      );
    }
    if (canonicalPlayerIds.has(canonicalPlayerId)) {
      throw new CanonicalBattleStatisticsValidationError(
        `playerMapping contains duplicate canonicalPlayerId ${canonicalPlayerId}.`,
      );
    }
    if (slots.has(slot)) {
      throw new CanonicalBattleStatisticsValidationError(
        `playerMapping contains duplicate replaySlot ${slot}.`,
      );
    }

    playerIds.add(playerId);
    canonicalPlayerIds.add(canonicalPlayerId);
    slots.add(slot);
    return { playerId, canonicalPlayerId, replaySlot: slot };
  });
}

export function buildCanonicalBattleStatisticsProjection(input: {
  projection: unknown;
  playerMapping: unknown;
}): CanonicalBattleStatisticsProjection {
  const rawProjection = record(input.projection, "projection");
  const statisticsProjectionVersion = requiredText(
    rawProjection.statisticsProjectionVersion,
    "statisticsProjectionVersion",
    100,
  );
  if (statisticsProjectionVersion !== CANONICAL_STATISTICS_PROJECTION_VERSION) {
    throw new CanonicalBattleStatisticsValidationError(
      `Unsupported statistics projection ${statisticsProjectionVersion}; expected ${CANONICAL_STATISTICS_PROJECTION_VERSION}.`,
    );
  }

  const statisticsSchemaVersion = requiredText(
    rawProjection.statisticsSchemaVersion,
    "statisticsSchemaVersion",
    100,
  );
  if (statisticsSchemaVersion !== CANONICAL_STATISTICS_SCHEMA_VERSION) {
    throw new CanonicalBattleStatisticsValidationError(
      `Unsupported statistics schema ${statisticsSchemaVersion}; expected ${CANONICAL_STATISTICS_SCHEMA_VERSION}.`,
    );
  }

  if (!Array.isArray(rawProjection.participants)) {
    throw new CanonicalBattleStatisticsValidationError("participants must be an array.");
  }
  if (rawProjection.participants.length < 2 || rawProjection.participants.length > 8) {
    throw new CanonicalBattleStatisticsValidationError("participants must contain 2–8 players.");
  }

  const participants = rawProjection.participants.map(normalizeParticipant);
  const mappings = normalizeMappings(input.playerMapping, participants.length);

  const participantsByCanonicalId = new Map<number, CanonicalStatisticsParticipant>();
  const slots = new Set<number>();
  for (const participant of participants) {
    if (participantsByCanonicalId.has(participant.playerId)) {
      throw new CanonicalBattleStatisticsValidationError(
        `Canonical statistics contains duplicate playerId ${participant.playerId}.`,
      );
    }
    if (slots.has(participant.replaySlot)) {
      throw new CanonicalBattleStatisticsValidationError(
        `Canonical statistics contains duplicate replaySlot ${participant.replaySlot}.`,
      );
    }
    participantsByCanonicalId.set(participant.playerId, participant);
    slots.add(participant.replaySlot);
  }

  const projectedParticipants = mappings.map((mapping) => {
    const participant = participantsByCanonicalId.get(mapping.canonicalPlayerId);
    if (!participant || participant.replaySlot !== mapping.replaySlot) {
      throw new CanonicalBattleStatisticsValidationError(
        `playerMapping for ${mapping.playerId} does not match canonical player ${mapping.canonicalPlayerId} / slot ${mapping.replaySlot}.`,
      );
    }

    return {
      playerId: mapping.playerId,
      canonicalPlayerId: participant.playerId,
      replaySlot: participant.replaySlot,
      displayName: participant.displayName ?? null,
      buildOrder: participant.buildOrder,
      opening: participant.opening,
      economy: participant.economy,
      military: participant.combat,
      mapPresence: participant.mapPresence,
      execution: {
        observedCommands: participant.observedCommands,
        selectionEvidence: participant.selectionEvidence,
      },
    };
  }).sort((left, right) => left.replaySlot - right.replaySlot);

  const result: CanonicalBattleStatisticsProjection = {
    contractVersion: CANONICAL_BATTLE_STATISTICS_CONTRACT_VERSION,
    statisticsSchemaVersion,
    statisticsProjectionVersion,
    source: normalizeProjectionSource(rawProjection.source),
    scope: rawProjection.scope && typeof rawProjection.scope === "object" && !Array.isArray(rawProjection.scope)
      ? rawProjection.scope as Record<string, unknown>
      : {},
    participants: projectedParticipants,
    coverage: rawProjection.coverage && typeof rawProjection.coverage === "object" && !Array.isArray(rawProjection.coverage)
      ? rawProjection.coverage as Record<string, unknown>
      : {},
    warnings: Array.isArray(rawProjection.warnings) ? rawProjection.warnings : [],
  };

  const byteLength = Buffer.byteLength(canonicalJson(result), "utf8");
  if (byteLength > MAX_FIRESTORE_PROJECTION_BYTES) {
    throw new CanonicalBattleStatisticsValidationError(
      `Compact Battle Statistics projection is too large for Firestore (${byteLength} bytes).`,
    );
  }

  return result;
}
