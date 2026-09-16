export const TOWNBELL_RAW_STATS_CONTRACT_VERSION = "TOWNBELL_RAW_STATS_V1";

export type TownBellJsonValue =
  | null
  | string
  | number
  | boolean
  | TownBellJsonValue[]
  | { [key: string]: TownBellJsonValue };

export interface TownBellStatsIngestionInput {
  sourceSha256: string;
  sourceFileName?: string | null;
  townBellVersion?: string | null;
  payload: unknown;
}

export interface ValidatedTownBellStatsIngestion {
  sourceSha256: string;
  sourceFileName: string | null;
  townBellVersion: string | null;
  payload: TownBellJsonValue;
}

export class TownBellStatsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TownBellStatsValidationError";
  }
}

function requiredText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new TownBellStatsValidationError(`${field} must be a string.`);
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    throw new TownBellStatsValidationError(`${field} must contain 1–${maxLength} characters.`);
  }
  return trimmed;
}

function optionalText(value: unknown, field: string, maxLength: number): string | null {
  if (value == null || value === "") return null;
  return requiredText(value, field, maxLength);
}

function assertJsonValue(
  value: unknown,
  path: string,
  depth: number,
  counter: { nodes: number },
): asserts value is TownBellJsonValue {
  counter.nodes += 1;
  if (counter.nodes > 75_000) {
    throw new TownBellStatsValidationError("payload contains too many values.");
  }
  if (depth > 40) {
    throw new TownBellStatsValidationError(`payload is nested too deeply near ${path}.`);
  }

  if (value == null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TownBellStatsValidationError(`payload contains a non-finite number at ${path}.`);
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
        throw new TownBellStatsValidationError(`payload contains an invalid key near ${path}.`);
      }
      assertJsonValue(child, `${path}.${key}`, depth + 1, counter);
    }
    return;
  }

  throw new TownBellStatsValidationError(`payload contains an unsupported value at ${path}.`);
}

function canonicalize(value: TownBellJsonValue): TownBellJsonValue {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort((left, right) => left.localeCompare(right))
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

export function canonicalTownBellJson(value: TownBellJsonValue): string {
  return JSON.stringify(canonicalize(value));
}

export function validateTownBellStatsIngestion(
  input: TownBellStatsIngestionInput,
): ValidatedTownBellStatsIngestion {
  const sourceSha256 = requiredText(input.sourceSha256, "sourceSha256", 64).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(sourceSha256)) {
    throw new TownBellStatsValidationError("sourceSha256 must be a 64-character SHA-256 hex digest.");
  }

  const sourceFileName = optionalText(input.sourceFileName, "sourceFileName", 255);
  const townBellVersion = optionalText(input.townBellVersion, "townBellVersion", 100);

  if (input.payload == null || (typeof input.payload !== "object" && !Array.isArray(input.payload))) {
    throw new TownBellStatsValidationError("payload must be a JSON object or array.");
  }

  assertJsonValue(input.payload, "payload", 0, { nodes: 0 });
  const serializedPayload = canonicalTownBellJson(input.payload);
  if (serializedPayload.length > 600_000) {
    throw new TownBellStatsValidationError(
      "payload is too large for one TownBell statistics document (600,000 character safety limit).",
    );
  }

  return {
    sourceSha256,
    sourceFileName,
    townBellVersion,
    payload: input.payload,
  };
}
