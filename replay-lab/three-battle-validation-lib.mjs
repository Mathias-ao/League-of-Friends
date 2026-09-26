export const THREE_BATTLE_VALIDATION_VERSION = "AOF_THREE_BATTLE_VALIDATION_V1";
export const PERSONALITY_REVEAL_BATTLE_THRESHOLD = 3;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function finiteOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function countOrNull(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value === "object" && typeof value.count === "number" && Number.isFinite(value.count)) {
    return value.count;
  }
  return null;
}

function slotFromEvent(event) {
  if (!event || typeof event !== "object") return null;
  for (const key of ["replaySlot", "playerId", "actorPlayerId", "sourcePlayerId"]) {
    const value = Number(event[key]);
    if (Number.isInteger(value)) return value;
  }
  const payload = event.payload;
  if (payload && typeof payload === "object") {
    for (const key of ["replaySlot", "playerId", "actorPlayerId", "sourcePlayerId"]) {
      const value = Number(payload[key]);
      if (Number.isInteger(value)) return value;
    }
  }
  return null;
}

export function validateValidationManifest(input) {
  invariant(input && typeof input === "object" && !Array.isArray(input), "Validation manifest must be an object.");
  invariant(input.schemaVersion === THREE_BATTLE_VALIDATION_VERSION,
    `Validation manifest schemaVersion must be ${THREE_BATTLE_VALIDATION_VERSION}.`);
  invariant(typeof input.seasonId === "string" && input.seasonId.trim(), "Validation manifest seasonId is required.");
  invariant(input.players && typeof input.players === "object" && !Array.isArray(input.players), "Validation manifest players are required.");

  const playerEntries = Object.entries(input.players);
  invariant(playerEntries.length === 2, "Three-Battle validation is deliberately limited to exactly two test league players.");
  const ids = new Set();
  for (const [playerKey, player] of playerEntries) {
    invariant(playerKey.trim(), "Player keys must be non-empty.");
    invariant(player && typeof player === "object", `Player ${playerKey} must be an object.`);
    invariant(typeof player.playerId === "string" && player.playerId.trim(), `Player ${playerKey} playerId is required.`);
    invariant(typeof player.displayName === "string" && player.displayName.trim(), `Player ${playerKey} displayName is required.`);
    invariant(!ids.has(player.playerId), `Duplicate test league playerId ${player.playerId}.`);
    ids.add(player.playerId);
  }

  invariant(Array.isArray(input.battles) && input.battles.length === 3,
    "Three-Battle validation requires exactly three Battles / replay files.");
  const battleIds = new Set();
  const gameIds = new Set();
  for (const [index, battle] of input.battles.entries()) {
    const label = `Battle ${index + 1}`;
    invariant(battle && typeof battle === "object", `${label} must be an object.`);
    invariant(typeof battle.battleId === "string" && battle.battleId.trim(), `${label} battleId is required.`);
    invariant(!battleIds.has(battle.battleId), `Duplicate battleId ${battle.battleId}.`);
    battleIds.add(battle.battleId);
    invariant(typeof battle.gameId === "string" && battle.gameId.trim(), `${label} gameId is required.`);
    invariant(!gameIds.has(battle.gameId), `Duplicate gameId ${battle.gameId}.`);
    gameIds.add(battle.gameId);
    invariant(Number.isFinite(battle.orderAtMs), `${label} orderAtMs must be a finite number.`);
    invariant(typeof battle.replayPath === "string" && battle.replayPath.toLowerCase().endsWith(".aoe2record"),
      `${label} replayPath must point to an .aoe2record file.`);
    invariant(Array.isArray(battle.bindings) && battle.bindings.length === 2,
      `${label} must bind exactly two replay slots to the two test league players.`);

    const slots = new Set();
    const boundKeys = new Set();
    for (const binding of battle.bindings) {
      invariant(binding && typeof binding === "object", `${label} binding must be an object.`);
      invariant(Number.isInteger(binding.replaySlot) && binding.replaySlot > 0,
        `${label} binding replaySlot must be a positive integer.`);
      invariant(!slots.has(binding.replaySlot), `${label} binds replay slot ${binding.replaySlot} more than once.`);
      slots.add(binding.replaySlot);
      invariant(typeof binding.playerKey === "string" && input.players[binding.playerKey],
        `${label} binding references unknown playerKey ${String(binding.playerKey)}.`);
      invariant(!boundKeys.has(binding.playerKey), `${label} binds ${binding.playerKey} more than once.`);
      boundKeys.add(binding.playerKey);
      if (binding.expectedReplayName != null) {
        invariant(typeof binding.expectedReplayName === "string" && binding.expectedReplayName.trim(),
          `${label} expectedReplayName must be a non-empty string when provided.`);
      }
    }
    invariant(boundKeys.size === playerEntries.length, `${label} must bind both configured test league players.`);
    if (battle.winnerPlayerKey != null) {
      invariant(typeof battle.winnerPlayerKey === "string" && input.players[battle.winnerPlayerKey],
        `${label} winnerPlayerKey references an unknown player.`);
    }
  }
  return input;
}

export function bindBattleProjection(manifest, battle, projection) {
  validateValidationManifest(manifest);
  invariant(projection && typeof projection === "object", `${battle.battleId} statistics projection is missing.`);
  invariant(Array.isArray(projection.participants) && projection.participants.length === 2,
    `${battle.battleId} must project exactly two replay participants; got ${projection?.participants?.length ?? 0}.`);
  const bySlot = new Map(projection.participants.map((participant) => [Number(participant.replaySlot), participant]));
  const participants = [];
  for (const binding of battle.bindings) {
    const raw = bySlot.get(binding.replaySlot);
    invariant(raw, `${battle.battleId} does not contain bound replay slot ${binding.replaySlot}.`);
    if (binding.expectedReplayName != null) {
      invariant(raw.displayName === binding.expectedReplayName,
        `${battle.battleId} replay slot ${binding.replaySlot} is ${JSON.stringify(raw.displayName)}, expected ${JSON.stringify(binding.expectedReplayName)}.`);
    }
    const testPlayer = manifest.players[binding.playerKey];
    participants.push({
      playerKey: binding.playerKey,
      playerId: testPlayer.playerId,
      displayName: testPlayer.displayName,
      sourceReplay: {
        playerId: raw.playerId,
        replaySlot: raw.replaySlot,
        displayName: raw.displayName,
      },
      statistics: raw,
    });
  }
  return {
    battleId: battle.battleId,
    gameId: battle.gameId,
    orderAtMs: battle.orderAtMs,
    source: projection.source ?? null,
    statisticsProjectionVersion: projection.statisticsProjectionVersion ?? null,
    warningCodes: Array.isArray(projection.warnings)
      ? projection.warnings.map((warning) => warning?.code).filter(Boolean)
      : [],
    participants,
    projection,
  };
}

export function resolveBattleWinner(manifest, battle, boundBattle) {
  if (battle.winnerPlayerKey != null) {
    const player = manifest.players[battle.winnerPlayerKey];
    return {
      status: "RESOLVED",
      playerId: player.playerId,
      playerKey: battle.winnerPlayerKey,
      basis: "validation_manifest_override",
    };
  }

  const resignations = boundBattle.projection?.commandEvidence?.resignCommands ?? [];
  const resignedSlots = new Set(resignations.map(slotFromEvent).filter(Number.isInteger));
  if (resignedSlots.size === 1) {
    const [resignedSlot] = resignedSlots;
    const loser = boundBattle.participants.find((participant) => Number(participant.sourceReplay.replaySlot) === resignedSlot);
    if (loser) {
      const winner = boundBattle.participants.find((participant) => participant.playerId !== loser.playerId);
      if (winner) {
        return {
          status: "RESOLVED",
          playerId: winner.playerId,
          playerKey: winner.playerKey,
          basis: "single_observed_resignation_in_1v1",
        };
      }
    }
  }

  return {
    status: "UNRESOLVED",
    playerId: null,
    playerKey: null,
    basis: "no_unambiguous_1v1_result_in_statistics_projection",
  };
}

function resourceInput(commitment) {
  const resources = commitment?.resourcesCommitted;
  if (!resources || typeof resources !== "object") return undefined;
  return {
    food: finiteOrNull(resources.food),
    wood: finiteOrNull(resources.wood),
    gold: finiteOrNull(resources.gold),
    stone: finiteOrNull(resources.stone),
    total: finiteOrNull(resources.total),
  };
}

function resourceByAgeInput(commitment) {
  const byAge = commitment?.byAge;
  if (!byAge || typeof byAge !== "object") return undefined;
  const result = {};
  for (const age of ["dark", "feudal", "castle", "imperial"]) {
    const row = byAge[age];
    if (!row || typeof row !== "object") continue;
    result[age] = {
      food: finiteOrNull(row.food), wood: finiteOrNull(row.wood), gold: finiteOrNull(row.gold),
      stone: finiteOrNull(row.stone), total: finiteOrNull(row.total),
    };
  }
  return result;
}

export function toLifetimeGameInput(boundBattle, winner) {
  return {
    matchId: boundBattle.battleId,
    gameId: boundBattle.gameId,
    orderAtMs: boundBattle.orderAtMs,
    affectsLifetimeStats: true,
    players: boundBattle.participants.map((participant) => {
      const stats = participant.statistics;
      const opening = stats.opening ?? {};
      const commitment = stats.economy?.resourceCommitment;
      const engagements = stats.military?.engagements ?? {};
      const map = stats.mapPresence ?? {};
      const commands = stats.observedCommands ?? {};
      const selections = stats.selectionEvidence ?? {};
      return {
        playerId: participant.playerId,
        won: winner.status === "RESOLVED" ? winner.playerId === participant.playerId : null,
        opening: {
          buildOrder: stats.buildOrder?.label ?? null,
          executionScore: finiteOrNull(stats.buildOrder?.executionScore),
          feudalAgeUpAtMs: finiteOrNull(opening.ageUp?.feudal?.ageUpAtMs),
          castleAgeUpAtMs: finiteOrNull(opening.ageUp?.castle?.ageUpAtMs),
          imperialAgeUpAtMs: finiteOrNull(opening.ageUp?.imperial?.ageUpAtMs),
          firstMilitaryUnitQueuedAtMs: finiteOrNull(opening.firstMilitaryUnit?.atMs),
          firstMilitaryBuildingAtMs: finiteOrNull(opening.firstMilitaryBuilding?.atMs),
          firstWallAtMs: finiteOrNull(opening.firstWallSegment?.atMs),
          wallTilesBeforeFeudal: finiteOrNull(opening.wallTilesBeforeFeudal),
          wallStyle: typeof opening.wallStyle?.label === "string" ? opening.wallStyle.label : null,
          housesBeforeFeudal: finiteOrNull(opening.housesBeforeFeudal),
          loomAtMs: finiteOrNull(opening.loom?.atMs),
          loomBeforeFeudal: typeof opening.loom?.beforeFeudal === "boolean" ? opening.loom.beforeFeudal : null,
        },
        economy: {
          resourceCommitment: resourceInput(commitment),
          resourceCommitmentByAge: resourceByAgeInput(commitment),
        },
        military: {
          raidsInitiated: finiteOrNull(engagements.raidsInitiated),
          raidsAgainst: finiteOrNull(engagements.raidsAgainstYou),
        },
        mapPresence: {
          commandMapCoveragePercent: finiteOrNull(map.commandMapCoverage?.percent),
          enemyBaseFoundAtMs: finiteOrNull(map.enemyBaseContact?.atMs),
          forwardBuildings: countOrNull(map.forwardBuildings),
          forwardEco: countOrNull(map.forwardEco),
          expansions: countOrNull(map.expansionZones ?? map.expansionTownCenters),
          goldControlPercent: finiteOrNull(map.goldControl?.controlSharePercent),
          firstRelicTouchAtMs: finiteOrNull(map.firstRelicTouch?.atMs),
        },
        execution: {
          totalCommands: finiteOrNull(commands.count),
          commandRatePerObservedMinute: finiteOrNull(commands.ratePerObservedMinute),
          firstCommandAtMs: finiteOrNull(commands.firstAtMs),
          firstFiveObservedMinutesCommands: finiteOrNull(commands.firstFiveObservedMinutesCount),
          activeSeconds: finiteOrNull(commands.activeSecondCount),
          averageSelectionSize: finiteOrNull(selections.averageSelectedObjectCount),
          medianSelectionSize: finiteOrNull(selections.medianSelectedObjectCount),
          maximumSelectionSize: finiteOrNull(selections.maximumSelectedObjectCount),
        },
      };
    }),
  };
}

function pushSignal(target, sourcePlayerId, targetPlayerId, type, count, sourceVersion) {
  if (!(typeof count === "number" && Number.isFinite(count) && count > 0)) return;
  if (!sourceVersion) return;
  target.push({ sourcePlayerId, targetPlayerId, type, count, sourceVersion });
}

export function relationshipSignalsForBattle(boundBattle) {
  const signals = [];
  invariant(boundBattle.participants.length === 2, `${boundBattle.battleId} relationship signal adapter only supports 1v1.`);
  for (const source of boundBattle.participants) {
    const target = boundBattle.participants.find((candidate) => candidate.playerId !== source.playerId);
    const stats = source.statistics;
    const engagements = stats.military?.engagements ?? {};
    const map = stats.mapPresence ?? {};
    const raidVersion = "AOF_RAID_DETECTION_V3";
    const mapVersion = map.modelVersion ?? "AOF_MAP_PRESENCE_V6";
    const forwardEco = map.forwardEco;
    const forwardEcoCount = countOrNull(forwardEco);
    const forwardEcoVersion = forwardEco?.ruleVersion ?? "AOF_FORWARD_ECO_V2";

    pushSignal(signals, source.playerId, target.playerId, "RAID", finiteOrNull(engagements.raidsInitiated), raidVersion);
    pushSignal(signals, source.playerId, target.playerId, "FORWARD_BUILDING", countOrNull(map.forwardBuildings), mapVersion);
    pushSignal(signals, source.playerId, target.playerId, "FORWARD_ECO", forwardEcoCount, forwardEcoVersion);
    if (map.enemyBaseContact?.atMs != null) {
      pushSignal(signals, source.playerId, target.playerId, "ENEMY_BASE_CONTACT", 1, mapVersion);
    }
  }
  return signals;
}

export function pairHistoryMatchInput(boundBattle, winner) {
  invariant(winner.status === "RESOLVED",
    `${boundBattle.battleId} needs a resolved winner before Pair History can use the current CanonicalGameResult contract.`);
  return {
    matchId: boundBattle.battleId,
    orderAtMs: boundBattle.orderAtMs,
    format: "ONE_V_ONE",
    participants: boundBattle.participants.map((participant, index) => ({
      playerId: participant.playerId,
      team: index + 1,
      slot: index + 1,
    })),
    canonicalResult: {
      type: "PLAYER_WIN",
      winnerTeam: null,
      winnerPlayerId: winner.playerId,
      revision: 1,
      winningPlayerIds: [winner.playerId],
      source: "TEST_VALIDATION",
      submissionId: null,
      submittedBy: null,
      confirmedBy: null,
    },
    affectsLifetimeStats: true,
    signals: relationshipSignalsForBattle(boundBattle),
  };
}

export function personalityEligibility(playerId, eligibleBattles) {
  return {
    playerId,
    eligibleBattles,
    revealThresholdBattles: PERSONALITY_REVEAL_BATTLE_THRESHOLD,
    revealEligible: eligibleBattles >= PERSONALITY_REVEAL_BATTLE_THRESHOLD,
    interpretationStatus: "RULE_SET_REQUIRED",
  };
}
