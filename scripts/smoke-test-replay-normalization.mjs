import { pathToFileURL } from "node:url";
import fs from "node:fs/promises";
import path from "node:path";

const inputPath = path.resolve(process.argv[2] ?? "replay-output.json");
const enginePath = path.resolve("functions/lib/engines/replayDerivedStats.js");

function secondsOrDash(ms) {
  return ms == null ? "-" : `${Math.round(ms / 1000)}s`;
}

try {
  const parsed = JSON.parse(await fs.readFile(inputPath, "utf8"));
  const { normalizeReplayDerivedStats, REPLAY_DERIVED_STATS_VERSION } = await import(pathToFileURL(enginePath).href);

  const sourcePlayers = Array.isArray(parsed.sourcePlayers) ? parsed.sourcePlayers : [];
  const playerMapping = sourcePlayers.map((player, index) => ({
    playerId: `replay-smoke-player-${index + 1}`,
    replaySlot: player.replaySlot,
    sourceName: player.sourceName ?? null,
  }));

  const normalized = normalizeReplayDerivedStats({
    adapterSchemaVersion: parsed.schemaVersion,
    payload: parsed.payload,
    playerMapping,
  });

  if (normalized.schemaVersion !== REPLAY_DERIVED_STATS_VERSION) {
    throw new Error(`Unexpected normalized schema ${normalized.schemaVersion}.`);
  }
  if (normalized.playerCount !== sourcePlayers.length) {
    throw new Error(`Player count mismatch: ${normalized.playerCount} normalized vs ${sourcePlayers.length} parsed.`);
  }
  if (normalized.durationSeconds <= 0) throw new Error("Normalized duration is missing.");
  if (normalized.totalActions <= 0) throw new Error("Normalized action total is missing.");

  const resigningPlayers = normalized.players.filter((player) => player.resigned);
  const researchEvents = normalized.players.reduce((sum, player) => sum + player.researchEventCount, 0);
  const buildCommands = normalized.players.reduce((sum, player) => sum + player.totalBuildCommands, 0);
  const playerActions = normalized.players.reduce((sum, player) => sum + player.totalActions, 0);

  console.log("Replay normalization smoke test");
  console.log(`schema: ${normalized.schemaVersion}`);
  console.log(`adapter: ${normalized.adapterSchemaVersion}`);
  console.log(`duration: ${normalized.durationSeconds}s`);
  console.log(`players: ${normalized.playerCount}`);
  console.log(`body actions: ${normalized.totalActions}`);
  console.log(`mapped player actions: ${playerActions}`);
  console.log(`build commands: ${buildCommands}`);
  console.log(`research events: ${researchEvents}`);
  console.log(`resignations: ${resigningPlayers.length}`);
  for (const player of normalized.players) {
    const ages = player.ageResearchStartedAt;
    console.log(
      `  slot ${player.replaySlot} ${player.sourceName}: civ=${player.civilizationId} team=${player.teamId} ` +
      `actions=${player.totalActions} builds=${player.totalBuildCommands} research=${player.researchEventCount} ` +
      `ageResearch(feudal/castle/imperial)=${secondsOrDash(ages.feudalAtMs)}/${secondsOrDash(ages.castleAtMs)}/${secondsOrDash(ages.imperialAtMs)} ` +
      `resigned=${player.resigned}${player.resignedAtMs == null ? "" : ` at ${Math.round(player.resignedAtMs / 1000)}s`}`,
    );
  }

  console.log("Replay normalization smoke test passed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
