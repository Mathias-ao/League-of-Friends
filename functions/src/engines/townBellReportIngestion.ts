export const TOWNBELL_REPORT_CONTRACT_VERSION = "TOWNBELL_REPORT_V1";
export const TOWNBELL_REPORT_SCHEMA_VERSION = 2;
export const TOWNBELL_METRIC_COUNT = 320;
export const TOWNBELL_MAX_CANONICAL_BYTES = 5_000_000;

export const TOWNBELL_CATEGORIES = [
  "opening",
  "economy",
  "military",
  "combat",
  "map_control",
  "tempo",
  "mechanics",
] as const;

export const TOWNBELL_CHART_KEYS = [
  "spend",
  "eco_military",
  "apm",
  "composition",
  "villagers",
  "fights",
  "timeline_events",
  "camera_heatmap",
  "map_overlay",
] as const;

export type TownBellJsonValue =
  | null
  | string
  | number
  | boolean
  | TownBellJsonValue[]
  | { [key: string]: TownBellJsonValue };

export type TownBellJsonObject = { [key: string]: TownBellJsonValue };

export interface TownBellReportIngestionInput {
  sourceFileName?: string | null;
  payload: unknown;
}

export interface TownBellReportedPlayer {
  number: number;
  name: string;
  profileId: number | null;
  teamId: number | null;
  civilizationId: number | null;
  civilization: string | null;
  winner: boolean | null;
  isPov: boolean;
}

export interface ValidatedTownBellReportIngestion {
  sourceFileName: string | null;
  payload: TownBellJsonObject;
  canonicalJson: string;
  catalog: TownBellJsonValue[];
  guid: string;
  durationMs: number;
  saveVersion: number;
  gameBuild: number;
  entityDataVersion: string;
  playedAtUnix: number;
  povNumber: number;
  degraded: TownBellJsonValue;
  reportedPlayers: TownBellReportedPlayer[];
}

export class TownBellReportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TownBellReportValidationError";
  }
}

function requiredText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new TownBellReportValidationError(`${field} must be a string.`);
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    throw new TownBellReportValidationError(`${field} must contain 1–${maxLength} characters.`);
  }
  return trimmed;
}

function optionalText(value: unknown, field: string, maxLength: number): string | null {
  if (value == null || value === "") return null;
  return requiredText(value, field, maxLength);
}

function requiredInteger(
  value: TownBellJsonValue | undefined,
  field: string,
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > maximum) {
    throw new TownBellReportValidationError(`${field} must be an integer from ${minimum} to ${maximum}.`);
  }
  return value;
}

function nullableInteger(
  value: TownBellJsonValue | undefined,
  field: string,
  minimum: number,
): number | null {
  if (value == null) return null;
  return requiredInteger(value, field, minimum);
}

function requiredBoolean(value: TownBellJsonValue | undefined, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new TownBellReportValidationError(`${field} must be a boolean.`);
  }
  return value;
}

function assertJsonValue(
  value: unknown,
  path: string,
  depth: number,
  counter: { nodes: number },
): asserts value is TownBellJsonValue {
  counter.nodes += 1;
  if (counter.nodes > 250_000) {
    throw new TownBellReportValidationError("payload contains too many values.");
  }
  if (depth > 40) {
    throw new TownBellReportValidationError(`payload is nested too deeply near ${path}.`);
  }

  if (value == null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TownBellReportValidationError(`payload contains a non-finite number at ${path}.`);
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
        throw new TownBellReportValidationError(`payload contains an invalid key near ${path}.`);
      }
      assertJsonValue(child, `${path}.${key}`, depth + 1, counter);
    }
    return;
  }

  throw new TownBellReportValidationError(`payload contains an unsupported value at ${path}.`);
}

function objectValue(value: TownBellJsonValue | undefined, field: string): TownBellJsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TownBellReportValidationError(`${field} must be an object.`);
  }
  return value;
}

function arrayValue(value: TownBellJsonValue | undefined, field: string): TownBellJsonValue[] {
  if (!Array.isArray(value)) {
    throw new TownBellReportValidationError(`${field} must be an array.`);
  }
  return value;
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

function sameOrderedStrings(actual: string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function validateCatalog(catalog: TownBellJsonValue[], categories: string[]): string[] {
  if (catalog.length !== TOWNBELL_METRIC_COUNT) {
    throw new TownBellReportValidationError(
      `payload.catalog must contain exactly ${TOWNBELL_METRIC_COUNT} metrics for TOWNBELL_REPORT_V1.`,
    );
  }

  const ids: string[] = [];
  const seen = new Set<string>();
  const allowedCategories = new Set(categories);

  catalog.forEach((item, index) => {
    const metric = objectValue(item, `payload.catalog[${index}]`);
    const id = requiredText(metric.id, `payload.catalog[${index}].id`, 120);
    if (seen.has(id)) {
      throw new TownBellReportValidationError(`payload.catalog contains duplicate metric id ${id}.`);
    }
    seen.add(id);
    ids.push(id);

    const category = requiredText(metric.category, `payload.catalog[${index}].category`, 60);
    if (!allowedCategories.has(category)) {
      throw new TownBellReportValidationError(`payload.catalog metric ${id} has unknown category ${category}.`);
    }

    for (const field of ["unit", "direction", "thresholds", "pov_only", "group"] as const) {
      if (!(field in metric)) {
        throw new TownBellReportValidationError(`payload.catalog metric ${id} is missing ${field}.`);
      }
    }
  });

  return ids;
}

function validatePlayers(
  metaPlayers: TownBellJsonValue[],
  playerReports: TownBellJsonObject,
  metricIds: string[],
  povNumber: number,
): TownBellReportedPlayer[] {
  if (metaPlayers.length < 2 || metaPlayers.length > 8) {
    throw new TownBellReportValidationError("payload.meta.players must contain 2–8 players.");
  }

  const expectedMetricIds = new Set(metricIds);
  const reportedNumbers = new Set<number>();
  const summaries: TownBellReportedPlayer[] = [];

  metaPlayers.forEach((item, index) => {
    const player = objectValue(item, `payload.meta.players[${index}]`);
    const number = requiredInteger(player.number, `payload.meta.players[${index}].number`, 1, 8);
    if (reportedNumbers.has(number)) {
      throw new TownBellReportValidationError(`payload.meta.players contains duplicate player number ${number}.`);
    }
    reportedNumbers.add(number);

    const name = requiredText(player.name, `payload.meta.players[${index}].name`, 200);
    const isPov = requiredBoolean(player.is_pov, `payload.meta.players[${index}].is_pov`);
    const reportPlayer = objectValue(playerReports[String(number)], `payload.players.${number}`);
    const metrics = objectValue(reportPlayer.metrics, `payload.players.${number}.metrics`);
    objectValue(reportPlayer.data_coverage, `payload.players.${number}.data_coverage`);
    objectValue(reportPlayer.buildings, `payload.players.${number}.buildings`);

    const actualMetricIds = Object.keys(metrics);
    if (
      actualMetricIds.length !== metricIds.length ||
      actualMetricIds.some((metricId) => !expectedMetricIds.has(metricId))
    ) {
      throw new TownBellReportValidationError(
        `payload.players.${number}.metrics must contain exactly the ${TOWNBELL_METRIC_COUNT} catalog metric ids.`,
      );
    }

    for (const metricId of metricIds) {
      const metric = objectValue(metrics[metricId], `payload.players.${number}.metrics.${metricId}`);
      if (!("value" in metric)) {
        throw new TownBellReportValidationError(
          `payload.players.${number}.metrics.${metricId} is missing value.`,
        );
      }
    }

    summaries.push({
      number,
      name,
      profileId: nullableInteger(player.profile_id, `payload.meta.players[${index}].profile_id`, 0),
      teamId: nullableInteger(player.team_id, `payload.meta.players[${index}].team_id`, 0),
      civilizationId: nullableInteger(
        player.civilization_id,
        `payload.meta.players[${index}].civilization_id`,
        0,
      ),
      civilization: player.civilization == null
        ? null
        : requiredText(player.civilization, `payload.meta.players[${index}].civilization`, 120),
      winner: player.winner == null
        ? null
        : requiredBoolean(player.winner, `payload.meta.players[${index}].winner`),
      isPov,
    });
  });

  const playerKeys = Object.keys(playerReports);
  if (
    playerKeys.length !== reportedNumbers.size ||
    playerKeys.some((key) => !reportedNumbers.has(Number(key)))
  ) {
    throw new TownBellReportValidationError("payload.players keys must match payload.meta.players player numbers.");
  }

  if (!reportedNumbers.has(povNumber)) {
    throw new TownBellReportValidationError("payload.meta.pov_number must identify one of payload.meta.players.");
  }

  const povPlayers = summaries.filter((player) => player.isPov);
  if (povPlayers.length !== 1 || povPlayers[0].number !== povNumber) {
    throw new TownBellReportValidationError(
      "Exactly one payload.meta.players entry must have is_pov=true and match payload.meta.pov_number.",
    );
  }

  return summaries;
}

export function validateTownBellReportIngestion(
  input: TownBellReportIngestionInput,
): ValidatedTownBellReportIngestion {
  const sourceFileName = optionalText(input.sourceFileName, "sourceFileName", 255);

  if (!input.payload || typeof input.payload !== "object" || Array.isArray(input.payload)) {
    throw new TownBellReportValidationError("payload must be a TownBell JSON object.");
  }

  assertJsonValue(input.payload, "payload", 0, { nodes: 0 });
  const payload = input.payload as TownBellJsonObject;

  const schemaVersion = requiredInteger(payload.schema_version, "payload.schema_version", 0);
  if (schemaVersion !== TOWNBELL_REPORT_SCHEMA_VERSION) {
    throw new TownBellReportValidationError(
      `TOWNBELL_REPORT_V1 accepts TownBell schema_version ${TOWNBELL_REPORT_SCHEMA_VERSION}; received ${schemaVersion}.`,
    );
  }

  const meta = objectValue(payload.meta, "payload.meta");
  const catalog = arrayValue(payload.catalog, "payload.catalog");
  const categories = arrayValue(payload.categories, "payload.categories").map((value, index) => (
    requiredText(value, `payload.categories[${index}]`, 60)
  ));
  const playerReports = objectValue(payload.players, "payload.players");
  const charts = objectValue(payload.charts, "payload.charts");

  if (!sameOrderedStrings(categories, TOWNBELL_CATEGORIES)) {
    throw new TownBellReportValidationError(
      `payload.categories must be ${TOWNBELL_CATEGORIES.join(", ")} for TOWNBELL_REPORT_V1.`,
    );
  }
  for (const chartKey of TOWNBELL_CHART_KEYS) {
    if (!(chartKey in charts)) {
      throw new TownBellReportValidationError(`payload.charts is missing ${chartKey}.`);
    }
  }

  const metricIds = validateCatalog(catalog, categories);
  const guid = requiredText(meta.guid, "payload.meta.guid", 100);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(guid)) {
    throw new TownBellReportValidationError("payload.meta.guid must be a GUID string.");
  }

  const durationMs = requiredInteger(meta.duration_ms, "payload.meta.duration_ms", 1);
  const saveVersion = requiredInteger(meta.save_version, "payload.meta.save_version", 1);
  const gameBuild = requiredInteger(meta.game_build, "payload.meta.game_build", 1);
  const entityDataVersion = requiredText(meta.entity_data_version, "payload.meta.entity_data_version", 100);
  const playedAtUnix = requiredInteger(meta.played_at_unix, "payload.meta.played_at_unix", 1);
  const povNumber = requiredInteger(meta.pov_number, "payload.meta.pov_number", 1, 8);

  objectValue(meta.settings, "payload.meta.settings");
  objectValue(meta.map, "payload.meta.map");
  objectValue(meta.accounting, "payload.meta.accounting");
  const metaPlayers = arrayValue(meta.players, "payload.meta.players");
  const reportedPlayers = validatePlayers(metaPlayers, playerReports, metricIds, povNumber);

  const canonicalJson = canonicalTownBellJson(payload);
  const canonicalBytes = Buffer.byteLength(canonicalJson, "utf8");
  if (canonicalBytes > TOWNBELL_MAX_CANONICAL_BYTES) {
    throw new TownBellReportValidationError(
      `TownBell report exceeds the ${TOWNBELL_MAX_CANONICAL_BYTES.toLocaleString()} byte V1 canonical size limit.`,
    );
  }

  return {
    sourceFileName,
    payload,
    canonicalJson,
    catalog,
    guid,
    durationMs,
    saveVersion,
    gameBuild,
    entityDataVersion,
    playedAtUnix,
    povNumber,
    degraded: meta.degraded ?? null,
    reportedPlayers,
  };
}
