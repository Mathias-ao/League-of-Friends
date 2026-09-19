import type {
  CivilizationConfiguration,
  CivilizationDraftConfiguration,
  CivilizationDraftReusePolicy,
  CivilizationDraftTurnOrder,
  MatchParticipant,
} from "../domain/types.js";

export type CivilizationDraftStatus = "ACTIVE" | "COMPLETED" | "VOID";
export type CivilizationDraftTurnStatus = "PENDING" | "COMPLETED";

export interface CivilizationDraftTurn {
  index: number;
  playerId: string;
  team: number | null;
  slot: number;
  status: CivilizationDraftTurnStatus;
  civilization: string | null;
}

export interface CivilizationDraftSelection {
  turnIndex: number;
  playerId: string;
  team: number | null;
  civilization: string;
}

export interface PriorCivilizationDraftSelection {
  gameNumber: number;
  playerId: string;
  team: number | null;
  civilization: string;
}

export interface CivilizationDraftState {
  ruleVersion: "AOF_CIV_DRAFT_V1";
  status: CivilizationDraftStatus;
  revision: number;
  stateVersion: number;
  gameNumber: number;
  turnOrder: CivilizationDraftTurnOrder;
  reusePolicy: CivilizationDraftReusePolicy;
  uniqueWithinGame: boolean;
  pool: string[];
  available: string[];
  turns: CivilizationDraftTurn[];
  currentTurnIndex: number | null;
  selections: CivilizationDraftSelection[];
  blockedByPlayer: Record<string, string[]>;
  blockedByTeam: Record<string, string[]>;
}

export class CivilizationDraftValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CivilizationDraftValidationError";
  }
}

function uniqueNonEmpty(values: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const value = raw.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function hash32(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function deterministicOrder<T>(values: T[], seed: string, key: (value: T) => string): T[] {
  return [...values].sort((left, right) => {
    const leftKey = key(left);
    const rightKey = key(right);
    const leftRank = hash32(`${seed}|${leftKey}`);
    const rightRank = hash32(`${seed}|${rightKey}`);
    return leftRank - rightRank || leftKey.localeCompare(rightKey);
  });
}

function participantSort(left: MatchParticipant, right: MatchParticipant): number {
  return left.slot - right.slot
    || (left.team ?? Number.MAX_SAFE_INTEGER) - (right.team ?? Number.MAX_SAFE_INTEGER)
    || left.playerId.localeCompare(right.playerId);
}

function teamBlockKey(playerId: string, team: number | null): string {
  return team == null ? `PLAYER:${playerId}` : `TEAM:${team}`;
}

function generateTurnParticipants(
  participants: MatchParticipant[],
  turnOrder: CivilizationDraftTurnOrder,
  seed: string,
): MatchParticipant[] {
  const sorted = [...participants].sort(participantSort);

  if (turnOrder === "SLOT") return sorted;
  if (turnOrder === "RANDOM") {
    return deterministicOrder(sorted, `${seed}|players`, (participant) => participant.playerId);
  }

  const hasTeams = sorted.some((participant) => participant.team != null);
  if (!hasTeams) {
    return deterministicOrder(sorted, `${seed}|ffa`, (participant) => participant.playerId);
  }

  const groups = new Map<string, MatchParticipant[]>();
  for (const participant of sorted) {
    const key = teamBlockKey(participant.playerId, participant.team);
    const group = groups.get(key) ?? [];
    group.push(participant);
    groups.set(key, group);
  }

  const groupKeys = deterministicOrder(
    [...groups.keys()],
    `${seed}|teams`,
    (key) => key,
  );
  const rounds = Math.max(...groupKeys.map((key) => groups.get(key)?.length ?? 0));
  const ordered: MatchParticipant[] = [];

  for (let round = 0; round < rounds; round += 1) {
    const roundKeys = turnOrder === "TEAM_SNAKE" && round % 2 === 1
      ? [...groupKeys].reverse()
      : groupKeys;
    for (const key of roundKeys) {
      const participant = groups.get(key)?.[round];
      if (participant) ordered.push(participant);
    }
  }

  return ordered;
}

function draftConfiguration(configuration: CivilizationConfiguration): CivilizationDraftConfiguration {
  if (configuration.mode !== "DRAFT" || !configuration.draft) {
    throw new CivilizationDraftValidationError("This Game is not configured for an Age of Friends civilization draft.");
  }
  if (configuration.draft.ruleVersion !== "AOF_CIV_DRAFT_V1") {
    throw new CivilizationDraftValidationError("Unsupported civilization draft rule version.");
  }
  return configuration.draft;
}

function resolvePool(
  configuration: CivilizationConfiguration,
  draft: CivilizationDraftConfiguration,
  gameNumber: number,
): string[] {
  const allowed = uniqueNonEmpty(configuration.allowed ?? []);
  if (allowed.length === 0) {
    throw new CivilizationDraftValidationError("Civilization drafts require a non-empty allowed civilization pool.");
  }

  const gamePool = draft.gamePools?.[String(gameNumber)];
  const requested = gamePool ? uniqueNonEmpty(gamePool) : allowed;
  if (requested.length === 0) {
    throw new CivilizationDraftValidationError(`Game ${gameNumber} has an empty civilization pool.`);
  }

  const allowedSet = new Set(allowed);
  for (const civilization of requested) {
    if (!allowedSet.has(civilization)) {
      throw new CivilizationDraftValidationError(
        `Game ${gameNumber} civilization ${civilization} is not in the Event's allowed civilization pool.`,
      );
    }
  }

  const banned = new Set(uniqueNonEmpty(configuration.banned ?? []));
  return requested.filter((civilization) => !banned.has(civilization));
}

function addBlocked(target: Record<string, Set<string>>, key: string, civilization: string): void {
  const values = target[key] ?? new Set<string>();
  values.add(civilization);
  target[key] = values;
}

function toSortedRecord(source: Record<string, Set<string>>): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(source).map(([key, values]) => [key, [...values].sort()]),
  );
}

function blockedCivilizations(
  reusePolicy: CivilizationDraftReusePolicy,
  priorSelections: PriorCivilizationDraftSelection[],
): {
  globallyBlocked: Set<string>;
  blockedByPlayer: Record<string, string[]>;
  blockedByTeam: Record<string, string[]>;
} {
  const globallyBlocked = new Set<string>();
  const blockedByPlayerSets: Record<string, Set<string>> = {};
  const blockedByTeamSets: Record<string, Set<string>> = {};

  for (const selection of priorSelections) {
    if (reusePolicy === "MATCH_UNIQUE") {
      globallyBlocked.add(selection.civilization);
    } else if (reusePolicy === "PLAYER_UNIQUE_IN_MATCH") {
      addBlocked(blockedByPlayerSets, selection.playerId, selection.civilization);
    } else if (reusePolicy === "TEAM_UNIQUE_IN_MATCH") {
      addBlocked(
        blockedByTeamSets,
        teamBlockKey(selection.playerId, selection.team),
        selection.civilization,
      );
    }
  }

  return {
    globallyBlocked,
    blockedByPlayer: toSortedRecord(blockedByPlayerSets),
    blockedByTeam: toSortedRecord(blockedByTeamSets),
  };
}

function legalPoolForParticipant(
  pool: string[],
  participant: MatchParticipant,
  blockedByPlayer: Record<string, string[]>,
  blockedByTeam: Record<string, string[]>,
): string[] {
  const blocked = new Set([
    ...(blockedByPlayer[participant.playerId] ?? []),
    ...(blockedByTeam[teamBlockKey(participant.playerId, participant.team)] ?? []),
  ]);
  return pool.filter((civilization) => !blocked.has(civilization));
}

function assertFeasibleUniqueAssignment(
  participants: MatchParticipant[],
  pool: string[],
  blockedByPlayer: Record<string, string[]>,
  blockedByTeam: Record<string, string[]>,
): void {
  const ownerByCivilization = new Map<string, string>();

  const assign = (participant: MatchParticipant, visited: Set<string>): boolean => {
    const legal = legalPoolForParticipant(pool, participant, blockedByPlayer, blockedByTeam);
    for (const civilization of legal) {
      if (visited.has(civilization)) continue;
      visited.add(civilization);
      const owner = ownerByCivilization.get(civilization);
      if (!owner) {
        ownerByCivilization.set(civilization, participant.playerId);
        return true;
      }
      const displaced = participants.find((candidate) => candidate.playerId === owner);
      if (displaced && assign(displaced, visited)) {
        ownerByCivilization.set(civilization, participant.playerId);
        return true;
      }
    }
    return false;
  };

  for (const participant of participants) {
    if (!assign(participant, new Set<string>())) {
      throw new CivilizationDraftValidationError(
        "The civilization pool and carry-over rules cannot provide one legal unique civilization to every player.",
      );
    }
  }
}

function assertParticipants(participants: MatchParticipant[]): MatchParticipant[] {
  if (!Array.isArray(participants) || participants.length < 2) {
    throw new CivilizationDraftValidationError("A civilization draft requires at least two Match participants.");
  }
  const playerIds = new Set<string>();
  for (const participant of participants) {
    if (!participant.playerId?.trim()) {
      throw new CivilizationDraftValidationError("Every draft participant requires a playerId.");
    }
    if (playerIds.has(participant.playerId)) {
      throw new CivilizationDraftValidationError("A player cannot appear twice in the same civilization draft.");
    }
    playerIds.add(participant.playerId);
  }
  return participants;
}

export function createCivilizationDraft(input: {
  matchId: string;
  gameId: string;
  gameNumber: number;
  participants: MatchParticipant[];
  civilizationConfiguration: CivilizationConfiguration;
  priorSelections?: PriorCivilizationDraftSelection[];
  revision?: number;
}): CivilizationDraftState {
  const participants = assertParticipants(input.participants);
  if (!Number.isInteger(input.gameNumber) || input.gameNumber < 1) {
    throw new CivilizationDraftValidationError("gameNumber must be a positive integer.");
  }

  const draft = draftConfiguration(input.civilizationConfiguration);
  const resolvedPool = resolvePool(input.civilizationConfiguration, draft, input.gameNumber);
  const priorSelections = input.priorSelections ?? [];
  const blocks = blockedCivilizations(draft.reusePolicy, priorSelections);
  const pool = resolvedPool.filter((civilization) => !blocks.globallyBlocked.has(civilization));

  if (pool.length === 0) {
    throw new CivilizationDraftValidationError("No civilizations remain legal for this Game.");
  }

  for (const participant of participants) {
    if (legalPoolForParticipant(pool, participant, blocks.blockedByPlayer, blocks.blockedByTeam).length === 0) {
      throw new CivilizationDraftValidationError(
        `No legal civilization remains for player ${participant.playerId} under the Match carry-over rules.`,
      );
    }
  }

  if (draft.uniqueWithinGame) {
    if (pool.length < participants.length) {
      throw new CivilizationDraftValidationError(
        `The Game requires ${participants.length} unique civilizations but only ${pool.length} are available.`,
      );
    }
    assertFeasibleUniqueAssignment(participants, pool, blocks.blockedByPlayer, blocks.blockedByTeam);
  }

  const revision = input.revision ?? 1;
  const seed = `${input.matchId}|${input.gameId}|${input.gameNumber}|${draft.ruleVersion}|R${revision}`;
  const ordered = generateTurnParticipants(participants, draft.turnOrder, seed);
  const turns = ordered.map<CivilizationDraftTurn>((participant, index) => ({
    index,
    playerId: participant.playerId,
    team: participant.team,
    slot: participant.slot,
    status: "PENDING",
    civilization: null,
  }));

  return {
    ruleVersion: draft.ruleVersion,
    status: "ACTIVE",
    revision,
    stateVersion: 1,
    gameNumber: input.gameNumber,
    turnOrder: draft.turnOrder,
    reusePolicy: draft.reusePolicy,
    uniqueWithinGame: draft.uniqueWithinGame,
    pool,
    available: [...pool],
    turns,
    currentTurnIndex: 0,
    selections: [],
    blockedByPlayer: blocks.blockedByPlayer,
    blockedByTeam: blocks.blockedByTeam,
  };
}

export function availableCivilizationsForPlayer(
  state: CivilizationDraftState,
  playerId: string,
  team: number | null,
): string[] {
  const blocked = new Set([
    ...(state.blockedByPlayer[playerId] ?? []),
    ...(state.blockedByTeam[teamBlockKey(playerId, team)] ?? []),
  ]);
  const source = state.uniqueWithinGame ? state.available : state.pool;
  return source.filter((civilization) => !blocked.has(civilization));
}

export function applyCivilizationDraftPick(
  state: CivilizationDraftState,
  playerId: string,
  civilization: string,
): CivilizationDraftState {
  if (state.status !== "ACTIVE" || state.currentTurnIndex == null) {
    throw new CivilizationDraftValidationError("This civilization draft is not accepting picks.");
  }

  const choice = civilization.trim();
  if (!choice) {
    throw new CivilizationDraftValidationError("A civilization is required.");
  }

  const currentTurn = state.turns[state.currentTurnIndex];
  if (!currentTurn || currentTurn.status !== "PENDING") {
    throw new CivilizationDraftValidationError("The civilization draft turn state is invalid.");
  }
  if (currentTurn.playerId !== playerId) {
    throw new CivilizationDraftValidationError("It is not this player's turn to choose a civilization.");
  }

  const legal = availableCivilizationsForPlayer(state, currentTurn.playerId, currentTurn.team);
  if (!legal.includes(choice)) {
    throw new CivilizationDraftValidationError("That civilization is not available to this player.");
  }

  const turns = state.turns.map((turn) => (
    turn.index === currentTurn.index
      ? { ...turn, status: "COMPLETED" as const, civilization: choice }
      : { ...turn }
  ));
  const selections = [
    ...state.selections,
    {
      turnIndex: currentTurn.index,
      playerId: currentTurn.playerId,
      team: currentTurn.team,
      civilization: choice,
    },
  ];
  const available = state.uniqueWithinGame
    ? state.available.filter((candidate) => candidate !== choice)
    : [...state.available];

  const nextTurn = turns.find((turn) => turn.status === "PENDING");
  return {
    ...state,
    status: nextTurn ? "ACTIVE" : "COMPLETED",
    stateVersion: state.stateVersion + 1,
    available,
    turns,
    currentTurnIndex: nextTurn?.index ?? null,
    selections,
  };
}
