export const REPLAY_RAW_STATS_CONTRACT_VERSION = "REPLAY_RAW_STATS_V1";

export interface ReplayStatsPlayerMapping {
  playerId: string;
  replaySlot: number;
  sourceName: string | null;
}

export interface ReplayStatsIngestionInput {
  parserName: string;
  parserVersion: string;
  schemaVersion: string;
  sourceHash: string;
  sourceFileName?: string | null;
  parserExtractedAt?: string | null;
  playerMapping: ReplayStatsPlayerMapping[];
  warnings?: string[];
  payload: Record<string, unknown>;
}

export interface ValidatedReplayStatsIngestion {
  parserName: string;
  parserVersion: string;
  schemaVersion: string;
  sourceHash: string;
  sourceFileName: string | null;
  parserExtractedAt: string | null;
  playerMapping: ReplayStatsPlayerMapping[];
  warnings: string[];
  payload: Record<string, unknown>;
}

export class ReplayStatsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReplayStatsValidationError";
  }
}

function requiredText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new ReplayStatsValidationError(`${field} must be a string.`);
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    throw new ReplayStatsValidationError(`${field} must contain 1–${maxLength} characters.`);
  }
  return trimmed;
}

function optionalText(value: unknown, field: string, maxLength: number): string | null {
  if (value == null || value === "") return null;
  return requiredText(value, field, maxLength);
}

function assertJsonValue(value: unknown, path: string, depth: number, counter: { nodes: number }): void {
  counter.nodes += 1;
  if (counter.nodes > 50_000) {
    throw new ReplayStatsValidationError("payload contains too many values.");
  }
  if (depth > 30) {
    throw new ReplayStatsValidationError(`payload is nested too deeply near ${path}.`);
  }

  if (value == null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new ReplayStatsValidationError(`payload contains a non-finite number at ${path}.`);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonValue(item, `${path}[${index}]`, depth + 1, counter));
    return;
  }

  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (!key || key.length > 200) {
        throw new ReplayStatsValidationError(`payload contains an invalid key near ${path}.`);
      }
      assertJsonValue(child, `${path}.${key}`, depth + 1, counter);
    }
    return;
  }

  throw new ReplayStatsValidationError(`payload contains an unsupported value at ${path}.`);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort((left, right) => left.localeCompare(right))
        .map((key) => [key, canonicalize(record[key])]),
    );
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function validateReplayStatsIngestion(input: ReplayStatsIngestionInput): ValidatedReplayStatsIngestion {
  const parserName = requiredText(input.parserName, "parserName", 100);
  const parserVersion = requiredText(input.parserVersion, "parserVersion", 100);
  const schemaVersion = requiredText(input.schemaVersion, "schemaVersion", 100);
  const sourceHash = requiredText(input.sourceHash, "sourceHash", 64).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(sourceHash)) {
    throw new ReplayStatsValidationError("sourceHash must be a 64-character SHA-256 hex digest.");
  }

  const sourceFileName = optionalText(input.sourceFileName, "sourceFileName", 255);
  const parserExtractedAt = optionalText(input.parserExtractedAt, "parserExtractedAt", 100);
  if (parserExtractedAt && Number.isNaN(Date.parse(parserExtractedAt))) {
    throw new ReplayStatsValidationError("parserExtractedAt must be a valid ISO/date timestamp when supplied.");
  }

  if (!Array.isArray(input.playerMapping) || input.playerMapping.length < 2 || input.playerMapping.length > 8) {
    throw new ReplayStatsValidationError("playerMapping must contain 2–8 players.");
  }

  const seenPlayerIds = new Set<string>();
  const seenSlots = new Set<number>();
  const playerMapping = input.playerMapping.map((mapping, index) => {
    const playerId = requiredText(mapping?.playerId, `playerMapping[${index}].playerId`, 200);
    const replaySlot = mapping?.replaySlot;
    if (!Number.isInteger(replaySlot) || replaySlot < 1 || replaySlot > 8) {
      throw new ReplayStatsValidationError(`playerMapping[${index}].replaySlot must be an integer from 1 to 8.`);
    }
    if (seenPlayerIds.has(playerId)) {
      throw new ReplayStatsValidationError(`playerMapping contains duplicate playerId ${playerId}.`);
    }
    if (seenSlots.has(replaySlot)) {
      throw new ReplayStatsValidationError(`playerMapping contains duplicate replaySlot ${replaySlot}.`);
    }
    seenPlayerIds.add(playerId);
    seenSlots.add(replaySlot);
    return {
      playerId,
      replaySlot,
      sourceName: optionalText(mapping?.sourceName, `playerMapping[${index}].sourceName`, 200),
    };
  }).sort((left, right) => left.replaySlot - right.replaySlot);

  const warnings = input.warnings ?? [];
  if (!Array.isArray(warnings) || warnings.length > 50) {
    throw new ReplayStatsValidationError("warnings must contain at most 50 strings.");
  }
  const normalizedWarnings = warnings.map((warning, index) => requiredText(warning, `warnings[${index}]`, 500));

  if (!input.payload || typeof input.payload !== "object" || Array.isArray(input.payload)) {
    throw new ReplayStatsValidationError("payload must be a JSON object.");
  }
  assertJsonValue(input.payload, "payload", 0, { nodes: 0 });
  const serializedPayload = canonicalJson(input.payload);
  if (serializedPayload.length > 600_000) {
    throw new ReplayStatsValidationError("payload is too large for one rawStats document (600,000 character safety limit).");
  }

  return {
    parserName,
    parserVersion,
    schemaVersion,
    sourceHash,
    sourceFileName,
    parserExtractedAt,
    playerMapping,
    warnings: normalizedWarnings,
    payload: input.payload,
  };
}
