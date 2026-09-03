import fs from "node:fs";
import path from "node:path";

const inputPath = process.argv[2] ?? "replay-output.json";
const resolved = path.resolve(inputPath);

if (!fs.existsSync(resolved)) {
  console.error(`Replay output not found: ${resolved}`);
  process.exit(1);
}

let document;
try {
  document = JSON.parse(fs.readFileSync(resolved, "utf8"));
} catch (error) {
  console.error(`Could not parse JSON: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}

const payload = document?.payload ?? {};
const replay = payload?.replay ?? {};
const settings = payload?.settings ?? {};
const players = Array.isArray(payload?.players) ? payload.players : [];
const body = payload?.body ?? {};
const warnings = Array.isArray(document?.warnings) ? document.warnings : [];
const researchEvents = Array.isArray(body?.researchEvents) ? body.researchEvents : [];
const resignations = Array.isArray(body?.resignations) ? body.resignations : [];
const actionCounts = body?.actionCountsByPlayer ?? {};
const buildCounts = body?.buildCountsByPlayer ?? {};

function formatDuration(ms) {
  if (!Number.isFinite(ms)) return "unknown";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")} (${totalSeconds}s)`;
}

function countObjectValues(object) {
  return Object.values(object ?? {}).reduce((total, value) => total + Number(value ?? 0), 0);
}

console.log("Replay parse inventory");
console.log(`  file: ${document?.sourceFileName ?? path.basename(resolved)}`);
console.log(`  parser: ${document?.parserName ?? "?"} ${document?.parserVersion ?? "?"}`);
console.log(`  adapter schema: ${document?.schemaVersion ?? "?"}`);
console.log(`  source SHA-256: ${document?.sourceHash ?? "?"}`);
console.log(`  format: ${replay?.format ?? "unknown"}`);
console.log(`  game version: ${replay?.gameVersion ?? "unknown"}`);
console.log(`  save version: ${replay?.saveVersion ?? "unknown"}`);
console.log(`  build: ${replay?.build ?? "unknown"}`);
console.log(`  file size: ${replay?.fileSizeBytes ?? "unknown"} bytes`);
console.log(`  duration: ${formatDuration(Number(body?.durationMs))}`);
console.log(`  total actions: ${body?.totalActions ?? "unknown"}`);
console.log(`  sync operations: ${body?.totalSyncOperations ?? "unknown"}`);
console.log("");

console.log("Settings");
for (const [label, key] of [
  ["mapId", "mapId"],
  ["mapSize", "mapSize"],
  ["population", "population"],
  ["gameTypeId", "gameTypeId"],
  ["revealMapId", "revealMapId"],
  ["seed", "seed"],
  ["speed", "speed"],
  ["rated", "rated"],
  ["lockTeams", "lockTeams"],
  ["victoryTypeId", "victoryTypeId"],
  ["startingResourcesId", "startingResourcesId"],
  ["startingAgeId", "startingAgeId"],
  ["endingAgeId", "endingAgeId"],
]) {
  console.log(`  ${label}: ${settings?.[key] ?? "unknown"}`);
}
console.log("");

console.log(`Players (${players.length})`);
for (const player of players) {
  const slot = player?.replaySlot;
  const actions = actionCounts?.[String(slot)] ?? {};
  const builds = buildCounts?.[String(slot)] ?? {};
  const playerResearch = researchEvents.filter((event) => event?.replaySlot === slot);
  const resignation = resignations.find((event) => event?.replaySlot === slot);
  console.log(`  slot ${slot}: ${player?.name ?? "unknown"}`);
  console.log(`    profileId=${player?.profileId ?? "unknown"} teamId=${player?.teamId ?? "unknown"} civId=${player?.civilizationId ?? "unknown"} colorId=${player?.colorId ?? "unknown"}`);
  console.log(`    actions=${countObjectValues(actions)} actionTypes=${Object.keys(actions).length} builds=${countObjectValues(builds)} researchEvents=${playerResearch.length}`);
  console.log(`    resignedAt=${resignation ? formatDuration(Number(resignation.atMs)) : "not observed"}`);
}
console.log("");

console.log("Body evidence");
console.log(`  research events: ${researchEvents.length}`);
console.log(`  resignations: ${resignations.length}`);
console.log(`  players with action counts: ${Object.keys(actionCounts).length}`);
console.log(`  players with build counts: ${Object.keys(buildCounts).length}`);

if (warnings.length) {
  console.log("");
  console.log(`Warnings (${warnings.length})`);
  warnings.forEach((warning) => console.log(`  - ${warning}`));
} else {
  console.log("  warnings: none");
}

const suspiciousSettings = [
  settings?.mapId,
  settings?.mapSize,
  settings?.population,
  settings?.gameTypeId,
  settings?.revealMapId,
  settings?.seed,
].every((value) => Number(value) === 0);

const normalizedCandidates = [
  ["game duration", Number.isFinite(Number(body?.durationMs)) && Number(body?.durationMs) > 0, ""],
  ["player identity / slot", players.length >= 2 && players.every((player) => player?.replaySlot && player?.name), ""],
  ["civilization", players.length >= 2 && players.every((player) => player?.civilizationId != null), ""],
  ["team assignment", players.length >= 2 && players.every((player) => player?.teamId != null), ""],
  ["color", players.length >= 2 && players.every((player) => player?.colorId != null), ""],
  ["map/settings IDs", settings?.mapId != null && !suspiciousSettings, suspiciousSettings ? " (raw-only: suspicious all-zero lobby/settings values)" : ""],
  ["action counts", Object.keys(actionCounts).length > 0, ""],
  ["build command counts", Object.keys(buildCounts).length > 0, ""],
  ["research command timeline", researchEvents.length > 0, ""],
  ["resignation timeline", resignations.length > 0, ""],
];

console.log("");
console.log("Candidate normalized facts");
for (const [name, available, note] of normalizedCandidates) {
  console.log(`  ${available ? "YES" : "NO "}  ${name}${note}`);
}
