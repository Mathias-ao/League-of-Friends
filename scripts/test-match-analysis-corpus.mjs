import fsp from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readCanonicalStore } from "./lib/canonical-artifacts.mjs";

const corpusDir = path.resolve(process.argv[2] ?? "replay-corpus-output");
const outputDir = path.resolve(process.argv[3] ?? "match-analysis-output");
const enginePath = path.resolve(process.env.AOF_ANALYSIS_ENGINE ?? "functions/lib/engines/matchAnalysis.js");
const entityCatalogPath = path.resolve(
  process.argv[4] ?? "replay-tools/entity-catalog/aoe2techtree-b9d494df6921.json",
);

function fmtMs(ms) {
  if (ms == null) return "-";
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function compactPair(pair) {
  return {
    from: pair.fromPlayerId,
    to: pair.toPlayerId,
    relation: pair.fixedTeamRelation,
    directHostile: pair.directHostileTargetCommands,
    focusShare: pair.hostileTargetFocusShare,
    targetRegion: pair.targetRegionCommands,
    deepRegion: pair.deepTargetRegionCommands,
    forwardBuilds: pair.forwardBuildPlacements,
    forwardWalls: pair.forwardWallPlacements,
    raids: pair.raidCandidateCount,
    highConfidenceRaids: pair.highConfidenceRaidCandidateCount ?? 0,
    diplomacyChanges: pair.diplomacyChanges.length,
    diplomacyModes: pair.diplomacyChanges.map((change) => change.diplomacyMode),
  };
}

function compactTeam(team) {
  return {
    a: team.playerAId,
    b: team.playerBId,
    coordinatedTargetWindows: team.coordinatedTargetWindows,
    sharedTargetObjects: team.sharedTargetObjectCount,
    tributeAtoB: team.tributeAtoBCommands,
    tributeBtoA: team.tributeBtoACommands,
    defenseAforB: team.defensiveResponsesByAForB,
    defenseBforA: team.defensiveResponsesByBForA,
  };
}


function topCounts(record, limit = 8) {
  return Object.entries(record ?? {})
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([type, count]) => ({ type, count }));
}

await fsp.mkdir(outputDir, { recursive: true });
const engine = await import(pathToFileURL(enginePath).href);
const children = (await fsp.readdir(corpusDir, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

let entityCatalog;
try {
  entityCatalog = JSON.parse(await fsp.readFile(entityCatalogPath, "utf8"));
} catch (error) {
  throw new Error(`Entity catalog not found at ${entityCatalogPath}. Run: node scripts/build-aoe2-entity-catalog.mjs`);
}
if (entityCatalog.sourceVersion !== "aoe2techtree@b9d494df6921d4080df69b22f9dbb7a4d1dcd9f0") {
  throw new Error(`Unexpected entity catalog version: ${entityCatalog.sourceVersion ?? "missing"}`);
}

const results = [];
for (const name of children) {
  const fixtureDir = path.join(corpusDir, name);
  const canonicalDir = path.join(fixtureDir, "canonical");
  const manifestPath = path.join(canonicalDir, "canonical-replay.json");
  try {
    const manifest = JSON.parse(await fsp.readFile(manifestPath, "utf8"));
    if (!["1.0.0", "1.1.0"].includes(manifest.schemaVersion)) throw new Error(`Unsupported canonical schema: ${manifest.schemaVersion}`);
    const facts = await readCanonicalStore(
      canonicalDir, manifest.factStore,
      (event) => event.sourceOperation === "ACTION" || String(event.eventType ?? "").startsWith("command."),
    );
    const initialObjects = await readCanonicalStore(
      canonicalDir, manifest.initialState.objectStore,
      (event) => event.eventType === "object.initial",
    );
    const analysis = engine.analyzeCanonicalReplay({ manifest, facts, initialObjects, entityCatalog });
    if (name === "1v1" && analysis.match.topology !== "DUEL") {
      throw new Error(`Expected DUEL topology for 1v1, got ${analysis.match.topology}`);
    }
    if (["2v2", "3v3", "4v4", "nomad", "water"].includes(name) && analysis.match.topology !== "FIXED_TEAMS") {
      throw new Error(`Expected FIXED_TEAMS topology for ${name}, got ${analysis.match.topology}`);
    }
    if (name === "FFA" && analysis.match.topology !== "FFA_OR_DYNAMIC") {
      throw new Error(`Expected FFA_OR_DYNAMIC topology for FFA, got ${analysis.match.topology}`);
    }
    if (name === "FFA" && analysis.teamInteractions.length !== 0) {
      throw new Error(`Expected no static team interactions for dynamic FFA, got ${analysis.teamInteractions.length}`);
    }
    if (name === "FFA" && analysis.pairInteractions.some((pair) => pair.fixedTeamRelation === "ally")) {
      throw new Error("Dynamic FFA exposed static ally relations; diplomacy must be resolved over time instead.");
    }
    if (name === "2v2" && analysis.players.some((player) => player.opening.startContext !== "NO_INITIAL_TC")) {
      throw new Error("Expected every 2v2 fixture player to retain the known Nomad/no-TC start context.");
    }
    if (["1v1", "3v3", "4v4"].includes(name)) {
      const scouts = analysis.players.filter((player) => player.opening.openingClassification.primaryStrategy === "SCOUTS").length;
      if (scouts === 0) throw new Error(`Expected at least one Scouts opening in ${name}; entity roles/classifier may have regressed.`);
    }
    if (name === "water") {
      const waterOpeners = analysis.players.filter((player) => player.opening.openingClassification.contextTags.includes("water_opening")).length;
      if (waterOpeners < 4) throw new Error(`Expected multiple water openings in water fixture, got ${waterOpeners}.`);
    }
    const fixtureOut = path.join(outputDir, name);
    await fsp.mkdir(fixtureOut, { recursive: true });
    await fsp.writeFile(path.join(fixtureOut, "match-analysis.json"), JSON.stringify(analysis, null, 2) + "\n");

    results.push({
      fixture: name,
      passed: true,
      topology: analysis.match.topology,
      players: analysis.match.playerCount,
      diagnostics: analysis.diagnostics,
      ownerReassignmentsByEventType: topCounts(analysis.diagnostics.objectOwnerReassignmentsByEventType),
      targetOwnerResolutionMethods: topCounts(analysis.diagnostics.targetOwnerResolutionMethods),
      playerOwnedTargetByEventType: topCounts(analysis.diagnostics.playerOwnedTargetCommandsByEventType),
      gaiaOwnedTargetByEventType: topCounts(analysis.diagnostics.gaiaOwnedTargetCommandsByEventType),
      unknownTargetByEventType: topCounts(analysis.diagnostics.unknownTargetCommandsByEventType),
      raidCandidates: analysis.raidCandidates.length,
      raidCandidatesByConfidence: {
        high: analysis.raidCandidates.filter((raid) => raid.confidence === "high").length,
        medium: analysis.raidCandidates.filter((raid) => raid.confidence === "medium").length,
        low: analysis.raidCandidates.filter((raid) => raid.confidence === "low").length,
      },
      teamSupportCandidates: analysis.teamSupportCandidates.length,
      teamCoordinationWindows: analysis.teamInteractions.reduce((sum, item) => sum + item.coordinatedTargetWindows, 0),
      teamPairCount: analysis.teamInteractions.length,
      allyDirectedPairCount: analysis.pairInteractions.filter((pair) => pair.fixedTeamRelation === "ally").length,
      playersSummary: analysis.players.map((player) => ({
        playerId: player.playerId,
        name: player.name,
        feudal: player.opening.ageClicks.feudalAtMs,
        castle: player.opening.ageClicks.castleAtMs,
        openingMilestones: player.opening.reconstructedSequence.length,
        startContext: player.opening.startContext,
        openingLabel: player.opening.openingClassification.label,
        openingConfidence: player.opening.openingClassification.confidence,
        openingPrimaryStrategy: player.opening.openingClassification.primaryStrategy,
        openingContextTags: player.opening.openingClassification.contextTags,
        openingStrategyTags: player.opening.openingClassification.strategyTags,
        openingTags: player.opening.openingClassification.tags,
        openingPreview: player.opening.reconstructedSequence.slice(0, 20).map((item) => `${fmtMs(item.atMs)} ${item.label}`),
        directEnemyTargetCommands: player.fundamentals.directEnemyTargetCommands,
        targetedOpponents: player.fundamentals.targetedOpponentCount,
        raidCandidatesPerformed: player.fundamentals.raidCandidatesPerformed,
        raidCandidatesSuffered: player.fundamentals.raidCandidatesSuffered,
        highConfidenceRaidCandidatesPerformed: player.fundamentals.highConfidenceRaidCandidatesPerformed,
        highConfidenceRaidCandidatesSuffered: player.fundamentals.highConfidenceRaidCandidatesSuffered,
      })),
      topDirectedPairs: analysis.pairInteractions
        .filter((pair) => pair.directHostileTargetCommands > 0 || pair.raidCandidateCount > 0 || pair.diplomacyChanges.length > 0)
        .sort((a, b) => b.directHostileTargetCommands - a.directHostileTargetCommands)
        .slice(0, 20)
        .map(compactPair),
      teamInteractions: analysis.teamInteractions
        .filter((team) => team.coordinatedTargetWindows > 0 || team.tributeAtoBCommands > 0 || team.tributeBtoACommands > 0 || team.defensiveResponsesByAForB > 0 || team.defensiveResponsesByBForA > 0)
        .map(compactTeam),
    });
    console.log(`PASS ${name}: ${analysis.match.topology}, teamPairs=${analysis.teamInteractions.length}, raids=${analysis.raidCandidates.length} (high=${analysis.raidCandidates.filter((raid) => raid.confidence === "high").length}), combatTargetOwner=${analysis.diagnostics.combatTargetOwnerResolutionPercent}%, allTargetOwner=${analysis.diagnostics.targetOwnerResolutionPercent}%, coordination=${analysis.teamInteractions.reduce((sum, item) => sum + item.coordinatedTargetWindows, 0)}, support=${analysis.teamSupportCandidates.length}`);
  } catch (error) {
    results.push({ fixture: name, passed: false, error: error instanceof Error ? error.message : String(error) });
    console.error(`FAIL ${name}:`, error instanceof Error ? error.message : error);
  }
}

const summary = {
  generatedAt: new Date().toISOString(),
  corpusDir,
  engineVersion: engine.MATCH_ANALYSIS_VERSION,
  entityCatalogVersion: entityCatalog.sourceVersion,
  passed: results.length > 0 && results.every((item) => item.passed),
  results,
};
await fsp.writeFile(path.join(outputDir, "match-analysis-summary.json"), JSON.stringify(summary, null, 2) + "\n");

const md = [];
md.push("# Age of Friends Match Analysis V1 corpus test", "");
md.push("| Fixture | Status | Topology | Players | Owner reassignments / ambiguous producers | Combat target-owner resolution | All target-owner resolution | Other-player/self/Gaia/unknown targets | Raid candidates (H/M/L) | Team pairs | Team coordination | Team support |", "|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
for (const result of results) {
  if (!result.passed) {
    md.push(`| ${result.fixture} | FAIL | - | - | - | - | - | - | - | - | - | - |`);
    continue;
  }
  md.push(`| ${result.fixture} | PASS | ${result.topology} | ${result.players} | ${result.diagnostics.objectOwnerReassignments}/${result.diagnostics.ambiguousProducerInstances} | ${result.diagnostics.combatTargetOwnerResolutionPercent}% | ${result.diagnostics.targetOwnerResolutionPercent}% | ${result.diagnostics.targetCommandsWithPlayerOwner}/${result.diagnostics.targetCommandsWithSelfOwner}/${result.diagnostics.targetCommandsWithGaiaOwner}/${result.diagnostics.targetCommandsWithUnknownOwner} | ${result.raidCandidates} (${result.raidCandidatesByConfidence.high}/${result.raidCandidatesByConfidence.medium}/${result.raidCandidatesByConfidence.low}) | ${result.teamPairCount} | ${result.teamCoordinationWindows} | ${result.teamSupportCandidates} |`);
}
md.push("");
for (const result of results) {
  md.push(`## ${result.fixture}`, "");
  if (!result.passed) {
    md.push(`Error: ${result.error}`, "");
    continue;
  }
  md.push(`Topology: **${result.topology}**. Owned object instances: ${result.diagnostics.ownedObjectInstances}; ownership conflicts: ${result.diagnostics.objectOwnershipConflicts}; strong owner reassignments: ${result.diagnostics.objectOwnerReassignments}; ambiguous producer IDs: ${result.diagnostics.ambiguousProducerInstances}; combat target-owner resolution: ${result.diagnostics.combatTargetOwnerResolutionPercent}%; all target-owner resolution: ${result.diagnostics.targetOwnerResolutionPercent}%; diplomacy changes: ${result.diagnostics.diplomacyChangeEvents}.`, "");
  if (result.ownerReassignmentsByEventType?.length) md.push(`Strong owner reassignments by event type: ${result.ownerReassignmentsByEventType.map((item) => `${item.type}=${item.count}`).join(", ")}.`, "");
  if (Object.keys(result.diagnostics.diplomacyModeCounts ?? {}).length) md.push(`Diplomacy modes: ${Object.entries(result.diagnostics.diplomacyModeCounts).map(([mode, count]) => `mode ${mode}=${count}`).join(", ")}.`, "");
  if (result.targetOwnerResolutionMethods?.length) md.push(`Target-owner resolution methods: ${result.targetOwnerResolutionMethods.map((item) => `${item.type}=${item.count}`).join(", ")}.`, "");
  if (result.gaiaOwnedTargetByEventType?.length) md.push(`Gaia-owned targets by event type: ${result.gaiaOwnedTargetByEventType.map((item) => `${item.type}=${item.count}`).join(", ")}.`, "");
  if (result.unknownTargetByEventType?.length) md.push(`Unresolved target owners by event type: ${result.unknownTargetByEventType.map((item) => `${item.type}=${item.count}`).join(", ")}.`, "");
  md.push("### Players", "");
  for (const player of result.playersSummary) {
    md.push(`- ${player.playerId} ${player.name}: **${player.openingLabel ?? "Unclassified"}** (${player.openingConfidence}; ${player.startContext}), Feudal ${fmtMs(player.feudal)}, Castle ${fmtMs(player.castle)}, opening milestones ${player.openingMilestones}, direct enemy targets ${player.directEnemyTargetCommands} across ${player.targetedOpponents} opponents, raid candidates ${player.raidCandidatesPerformed} performed / ${player.raidCandidatesSuffered} suffered (high-confidence ${player.highConfidenceRaidCandidatesPerformed}/${player.highConfidenceRaidCandidatesSuffered}).`);
    if (player.openingPreview.length) md.push(`  Opening preview: ${player.openingPreview.join(" → ")}`);
  }
  md.push("");
  if (result.topDirectedPairs.length) {
    md.push("### Strongest directed interaction evidence", "");
    for (const pair of result.topDirectedPairs) {
      md.push(`- ${pair.from} → ${pair.to}: direct hostile ${pair.directHostile}, focus ${pair.focusShare ?? "-"}%, target-region ${pair.targetRegion}, deep-region ${pair.deepRegion}, forward builds ${pair.forwardBuilds}, walls ${pair.forwardWalls}, raids ${pair.raids} (high ${pair.highConfidenceRaids}), diplomacy changes ${pair.diplomacyChanges}${pair.diplomacyModes?.length ? ` [modes ${pair.diplomacyModes.join("→")}]` : ""}.`);
    }
    md.push("");
  }
  if (result.teamInteractions?.length) {
    md.push("### Team interaction evidence", "");
    for (const team of result.teamInteractions) {
      md.push(`- ${team.a} ↔ ${team.b}: coordination windows ${team.coordinatedTargetWindows}, shared target objects ${team.sharedTargetObjects}, tribute ${team.tributeAtoB}/${team.tributeBtoA}, defensive responses ${team.defenseAforB}/${team.defenseBforA}.`);
    }
    md.push("");
  }
}
await fsp.writeFile(path.join(outputDir, "match-analysis-summary.md"), md.join("\n") + "\n");

if (!summary.passed) process.exitCode = 1;
