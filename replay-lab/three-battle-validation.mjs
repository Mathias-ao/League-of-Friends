import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  THREE_BATTLE_VALIDATION_VERSION,
  bindBattleProjection,
  pairHistoryMatchInput,
  personalityEligibility,
  resolveBattleWinner,
  toLifetimeGameInput,
  validateValidationManifest,
} from "./three-battle-validation-lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const PYTHON = process.env.PYTHON || "python";
const PARSER = path.join(ROOT, "replay-tools", "parse_replay.py");
const ANALYSIS_DATASET = path.join(ROOT, "replay-tools", "analysis_dataset.py");
const STATISTICS = path.join(ROOT, "replay-tools", "statistics_projector.py");

function parseArgs(argv) {
  const args = {
    manifest: path.join(HERE, "fixtures", "three-battle-validation.json"),
    out: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--manifest") args.manifest = argv[++index];
    else if (value === "--out") args.out = argv[++index];
    else if (value === "--help" || value === "-h") {
      console.log("Usage: node replay-lab/three-battle-validation.mjs [--manifest FILE] [--out FILE]");
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  return args;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, 2) + "\n", "utf8");
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error((stderr || stdout || `${command} exited ${code}`).trim()));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function fileSha256(file) {
  const hash = crypto.createHash("sha256");
  hash.update(await fs.readFile(file));
  return hash.digest("hex");
}

function repoPath(value) {
  return path.resolve(ROOT, value);
}

function artifactRelative(file) {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

async function loadLongitudinalEngines() {
  const engineDir = path.join(ROOT, "functions", "lib", "engines");
  const expected = ["lifetimeStatistics.js", "playstyleEngine.js", "relationshipEngine.js"];
  for (const file of expected) {
    const candidate = path.join(engineDir, file);
    if (!(await exists(candidate))) {
      throw new Error(
        `Missing compiled Functions engine ${artifactRelative(candidate)}. Run \`npm --prefix functions run build\` first.`,
      );
    }
  }
  const lifetime = await import(pathToFileURL(path.join(engineDir, "lifetimeStatistics.js")).href);
  const playstyle = await import(pathToFileURL(path.join(engineDir, "playstyleEngine.js")).href);
  const relationship = await import(pathToFileURL(path.join(engineDir, "relationshipEngine.js")).href);
  return { lifetime, playstyle, relationship };
}

async function projectReplay(battle, runDir) {
  const replay = repoPath(battle.replayPath);
  if (!(await exists(replay))) throw new Error(`${battle.battleId} replay not found: ${replay}`);
  const extension = path.extname(replay).toLowerCase();
  if (extension !== ".aoe2record") throw new Error(`${battle.battleId} replay must be .aoe2record, got ${extension}.`);

  const battleDir = path.join(runDir, battle.battleId);
  const canonicalDir = path.join(battleDir, "canonical");
  const adapterPath = path.join(battleDir, "adapter.json");
  const analysisPath = path.join(battleDir, "analysis.json");
  const statisticsPath = path.join(battleDir, "statistics.json");
  await fs.mkdir(battleDir, { recursive: true });

  await runCommand(PYTHON, [
    PARSER,
    replay,
    "--canonical-dir", canonicalDir,
    "--out", adapterPath,
    "--pretty",
    "--seal-mode", "full",
  ]);
  await runCommand(PYTHON, [
    ANALYSIS_DATASET,
    canonicalDir,
    "--out", analysisPath,
    "--already-sealed",
  ]);
  await runCommand(PYTHON, [
    STATISTICS,
    "--analysis", analysisPath,
    "--out", statisticsPath,
  ]);

  const [adapter, projection] = await Promise.all([readJson(adapterPath), readJson(statisticsPath)]);
  const replaySha256 = await fileSha256(replay);
  if (projection?.source?.replaySha256 && projection.source.replaySha256 !== replaySha256) {
    throw new Error(`${battle.battleId} projected replay hash does not match the input recording.`);
  }
  return { replay, replaySha256, adapter, projection, battleDir, statisticsPath };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifestPath = path.resolve(process.cwd(), args.manifest);
  const manifest = validateValidationManifest(await readJson(manifestPath));
  const engines = await loadLongitudinalEngines();

  const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomUUID().slice(0, 8)}`;
  const runDir = path.join(ROOT, ".replay-lab", "three-battle-validation", runId);
  await fs.mkdir(runDir, { recursive: true });

  const boundBattles = [];
  const winners = [];
  const battleReport = [];

  for (const battle of manifest.battles) {
    console.log(`[${battle.battleId}] full-conformance extraction and Battle statistics...`);
    const projected = await projectReplay(battle, runDir);
    const bound = bindBattleProjection(manifest, battle, projected.projection);
    const winner = resolveBattleWinner(manifest, battle, bound);
    if (winner.status !== "RESOLVED") {
      throw new Error(
        `${battle.battleId} result is not unambiguously recoverable from the projected 1v1 resignation evidence. ` +
        `Set winnerPlayerKey in the validation manifest after verifying the source replay result; AoF will not guess it.`,
      );
    }
    boundBattles.push(bound);
    winners.push(winner);
    battleReport.push({
      battleId: battle.battleId,
      gameId: battle.gameId,
      replayPath: battle.replayPath,
      replaySha256: projected.replaySha256,
      statisticsPath: artifactRelative(projected.statisticsPath),
      statisticsProjectionVersion: projected.projection.statisticsProjectionVersion ?? null,
      canonicalSchemaVersion: projected.projection.source?.canonicalSchemaVersion ?? null,
      result: winner,
      identityBindings: bound.participants.map((participant) => ({
        playerKey: participant.playerKey,
        testLeaguePlayerId: participant.playerId,
        testLeagueDisplayName: participant.displayName,
        sourceReplayPlayerId: participant.sourceReplay.playerId,
        sourceReplaySlot: participant.sourceReplay.replaySlot,
        sourceReplayDisplayName: participant.sourceReplay.displayName,
      })),
      warnings: bound.warningCodes,
    });
  }

  const lifetimeInputs = boundBattles.map((battle, index) => toLifetimeGameInput(battle, winners[index]));
  const neutralSeasonAggregate = engines.lifetime.rebuildLifetimeStatistics(lifetimeInputs);

  const pairInputs = boundBattles.map((battle, index) => pairHistoryMatchInput(battle, winners[index]));
  const pairHistory = engines.relationship.rebuildPairHistory(pairInputs);
  if (pairHistory.length !== 1) {
    throw new Error(`Expected one 1v1 pair history, got ${pairHistory.length}.`);
  }

  const personality = neutralSeasonAggregate.map((player) => ({
    eligibility: personalityEligibility(player.playerId, player.gamesAnalyzed),
    engineProjection: engines.playstyle.evaluatePlaystyleProfile(player.playerId, "CAREER", [], null),
  }));
  const relationshipProjection = engines.relationship.evaluateRelationship(pairHistory[0], null);

  const report = {
    schemaVersion: THREE_BATTLE_VALIDATION_VERSION,
    generatedAt: new Date().toISOString(),
    testOnly: true,
    season: {
      seasonId: manifest.seasonId,
      label: manifest.seasonLabel ?? null,
      battleCount: boundBattles.length,
      players: Object.fromEntries(Object.entries(manifest.players).map(([key, value]) => [key, { ...value }])),
    },
    truthBoundary: {
      canonicalReplayIdentityMutated: false,
      identitySubstitutionLayer: "validation_manifest_after_battle_statistics_projection",
      sourceReplayFactsPreserved: true,
      productionLeagueStateTouched: false,
      canonicalSealMode: "full",
    },
    battleStatistics: battleReport,
    seasonStatistics: {
      status: "VALIDATION_AGGREGATE",
      scope: "exactly_the_three_manifest_battles",
      sourceEngineVersion: neutralSeasonAggregate[0]?.schemaVersion ?? "AOF_LIFETIME_STATISTICS_V1",
      note: (
        "Production Season Statistics aggregation/presentation is not implemented yet. " +
        "This validation view deliberately reuses the neutral AOF_LIFETIME_STATISTICS_V1 aggregator over only these three season-scoped Battles; it does not invent an AOF_SEASON_STATISTICS model."
      ),
      players: neutralSeasonAggregate,
    },
    personality: {
      revealRule: "3 eligible Battles",
      status: "ELIGIBLE_BUT_UNCONFIGURED",
      note: (
        "Three Battles satisfy the current reveal threshold, but normalization, slider weights and the explicit PlaystyleRuleSet remain unapproved. " +
        "AOF_PLAYSTYLE_ENGINE_V1 is therefore exercised with a null rule set and must return UNCONFIGURED rather than fabricated slider scores."
      ),
      players: personality,
    },
    pairHistory: pairHistory[0],
    relationshipInterpretation: {
      status: "UNCONFIGURED",
      note: (
        "AOF_PAIR_HISTORY_V1 is generated from the three mapped 1v1 Battles and replay-derived directional signals. " +
        "The current relationship engine still predates Rivalry/Hostility/Bond and no approved relationship point/stage rule set exists, so relationship points must remain null."
      ),
      engineProjection: relationshipProjection,
    },
  };

  const outputPath = args.out
    ? path.resolve(process.cwd(), args.out)
    : path.join(runDir, "report.json");
  await writeJson(outputPath, report);
  console.log(`Wrote Three-Battle validation report: ${outputPath}`);
  console.log("Personality and relationship interpretation are expected to remain UNCONFIGURED until explicit AoF rule sets are approved.");
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exitCode = 1;
});
