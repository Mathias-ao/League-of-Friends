import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const inputPath = path.resolve(process.argv[2] ?? "replay-output.json");
const factsEnginePath = path.resolve("functions/lib/engines/replayDerivedStats.js");
const analysisEnginePath = path.resolve("functions/lib/engines/replayAnalysis.js");

function seconds(ms) {
  return ms == null ? "-" : `${Math.round(ms / 1000)}s`;
}

function strategyEvidence(strategy) {
  const evidence = strategy?.evidence ?? {};
  if (strategy.code.endsWith("OPENING_CANDIDATE")) {
    return `first=${seconds(evidence.firstProductionAtMs)} queued=${evidence.earlyUnitsQueued ?? "?"} unitId=${evidence.unitId ?? "?"} cutoff=${evidence.cutoffSeconds ?? "?"}s`;
  }
  if (strategy.code.startsWith("FAST_")) {
    return `click=${seconds(evidence.researchStartedAtMs)} threshold=${evidence.thresholdSeconds ?? "?"}s`;
  }
  return JSON.stringify(evidence);
}

try {
  const parsed = JSON.parse(await fs.readFile(inputPath, "utf8"));
  const factsEngine = await import(pathToFileURL(factsEnginePath).href);
  const analysisEngine = await import(pathToFileURL(analysisEnginePath).href);

  const sourcePlayers = Array.isArray(parsed.sourcePlayers) ? parsed.sourcePlayers : [];
  const playerMapping = sourcePlayers.map((player, index) => ({
    playerId: `replay-smoke-player-${index + 1}`,
    replaySlot: player.replaySlot,
    sourceName: player.sourceName ?? null,
  }));

  const facts = factsEngine.normalizeReplayDerivedStats({
    adapterSchemaVersion: parsed.schemaVersion,
    payload: parsed.payload,
    playerMapping,
  });
  const analysis = analysisEngine.analyzeReplayStats(facts, analysisEngine.DEFAULT_REPLAY_ANALYSIS_CONFIG);

  if (facts.schemaVersion !== "REPLAY_DERIVED_STATS_V2") {
    throw new Error(`Expected REPLAY_DERIVED_STATS_V2, got ${facts.schemaVersion}.`);
  }
  if (parsed.schemaVersion === "LOF_MGZ_FAST_ADAPTER_V2" && facts.eventDetailLevel !== "TIMELINE_V2") {
    throw new Error("Adapter V2 did not normalize with timeline detail.");
  }
  if (analysis.schemaVersion !== "REPLAY_ANALYSIS_V1") {
    throw new Error(`Expected REPLAY_ANALYSIS_V1, got ${analysis.schemaVersion}.`);
  }
  if (analysis.players.length !== facts.players.length) {
    throw new Error("Analysis player count does not match normalized facts.");
  }

  console.log("Replay Level 1 + Level 2 smoke test");
  console.log(`adapter: ${parsed.schemaVersion}`);
  console.log(`facts: ${facts.schemaVersion} (${facts.eventDetailLevel})`);
  console.log(`analysis: ${analysis.schemaVersion}`);
  console.log(`duration: ${facts.durationSeconds}s`);
  console.log(`players: ${facts.playerCount}`);

  for (const player of facts.players) {
    const playerAnalysis = analysis.players.find((item) => item.playerId === player.playerId);
    if (!playerAnalysis) throw new Error(`Missing analysis for ${player.playerId}.`);

    const productionUnits = player.productionEvents.reduce((sum, event) => sum + event.amount, 0);
    console.log(`  slot ${player.replaySlot} ${player.sourceName}`);
    console.log(
      `    Level 1: actions=${player.totalActions} actionSeconds=${player.actionSeconds.length} ` +
      `builds=${player.buildEvents.length} productionCommands=${player.productionEvents.length} ` +
      `productionUnits=${productionUnits} research=${player.researchEvents.length} ` +
      `market=${player.marketEvents.length} tribute=${player.tributeEvents.length}`,
    );
    console.log(
      `    ages: feudal=${seconds(player.ageResearchStartedAt.feudalAtMs)} ` +
      `castle=${seconds(player.ageResearchStartedAt.castleAtMs)} imperial=${seconds(player.ageResearchStartedAt.imperialAtMs)}`,
    );
    console.log(
      `    Level 2 APM: avg=${playerAnalysis.averageRawApm} ` +
      `peak30=${playerAnalysis.peak30sRawApm?.apm ?? "n/a"} ` +
      `peak60=${playerAnalysis.peak60sRawApm?.apm ?? "n/a"}`,
    );
    if (!playerAnalysis.strategies.length) {
      console.log("    strategy detections: none");
    } else {
      console.log("    strategy detections:");
      for (const strategy of playerAnalysis.strategies) {
        console.log(`      ${strategy.code}: ${strategyEvidence(strategy)}`);
      }
    }
  }

  console.log("Replay Level 1 + Level 2 smoke test passed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
