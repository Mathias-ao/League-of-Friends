import type {
  CompetitionStyle,
  MatchFormat,
  MatchPlanningConfig,
  ProposedMatch,
} from "../domain/types.js";

export interface PlannerPlayer {
  playerId: string;
  powerRating: number | null;
}

export interface MatchPlanResult {
  matches: ProposedMatch[];
  sittingOutPlayerIds: string[];
}

const DEFAULT_POWER_RATING = 1000;
const TEAM_SIZE_RATING_BONUS = 200;

function ratingOf(player: PlannerPlayer): number {
  return player.powerRating ?? DEFAULT_POWER_RATING;
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function sortByRating(players: PlannerPlayer[], seed: string): PlannerPlayer[] {
  return [...players].sort((left, right) => {
    const ratingDifference = ratingOf(right) - ratingOf(left);
    if (ratingDifference !== 0) return ratingDifference;

    const leftHash = stableHash(`${seed}:${left.playerId}`);
    const rightHash = stableHash(`${seed}:${right.playerId}`);
    if (leftHash !== rightHash) return leftHash - rightHash;
    return left.playerId.localeCompare(right.playerId);
  });
}

function chooseSitOut(players: PlannerPlayer[], seed: string): PlannerPlayer {
  return [...players].sort((left, right) => {
    const leftHash = stableHash(`${seed}:sit:${left.playerId}`);
    const rightHash = stableHash(`${seed}:sit:${right.playerId}`);
    if (leftHash !== rightHash) return leftHash - rightHash;
    return left.playerId.localeCompare(right.playerId);
  })[0];
}

function meanRating(players: PlannerPlayer[]): number {
  if (players.length === 0) return DEFAULT_POWER_RATING;
  return players.reduce((total, player) => total + ratingOf(player), 0) / players.length;
}

function effectiveTeamRating(players: PlannerPlayer[]): number {
  return meanRating(players) + TEAM_SIZE_RATING_BONUS * Math.log2(players.length);
}

function winProbability(teamOneRating: number, teamTwoRating: number): number {
  return 1 / (1 + 10 ** ((teamTwoRating - teamOneRating) / 400));
}

function teamFormat(teamOneSize: number, teamTwoSize: number): MatchFormat {
  if (teamOneSize !== teamTwoSize) return "ASYMMETRIC_TEAM";
  if (teamOneSize === 1) return "ONE_V_ONE";
  if (teamOneSize === 2) return "TWO_V_TWO";
  if (teamOneSize === 3) return "THREE_V_THREE";
  if (teamOneSize === 4) return "FOUR_V_FOUR";
  return "ASYMMETRIC_TEAM";
}

function combinations<T>(items: T[], choose: number): T[][] {
  const output: T[][] = [];
  const current: T[] = [];

  function visit(start: number): void {
    if (current.length === choose) {
      output.push([...current]);
      return;
    }

    for (let index = start; index <= items.length - (choose - current.length); index += 1) {
      current.push(items[index]);
      visit(index + 1);
      current.pop();
    }
  }

  visit(0);
  return output;
}

function makeBalancedTeamMatch(
  players: PlannerPlayer[],
  teamOneSize: number,
  teamTwoSize: number,
  seed: string,
): ProposedMatch {
  if (players.length !== teamOneSize + teamTwoSize) {
    throw new Error("Team match player count does not match requested team sizes.");
  }

  let bestTeamOne: PlannerPlayer[] | null = null;
  let bestTeamTwo: PlannerPlayer[] | null = null;
  let bestDifference = Number.POSITIVE_INFINITY;
  let bestTieBreak = Number.POSITIVE_INFINITY;

  for (const teamOne of combinations(players, teamOneSize)) {
    const teamOneIds = new Set(teamOne.map((player) => player.playerId));
    const teamTwo = players.filter((player) => !teamOneIds.has(player.playerId));

    if (teamTwo.length !== teamTwoSize) continue;

    const difference = Math.abs(effectiveTeamRating(teamOne) - effectiveTeamRating(teamTwo));
    const tieBreak = stableHash(
      `${seed}:teams:${teamOne.map((player) => player.playerId).sort().join(",")}`,
    );

    if (difference < bestDifference || (difference === bestDifference && tieBreak < bestTieBreak)) {
      bestTeamOne = teamOne;
      bestTeamTwo = teamTwo;
      bestDifference = difference;
      bestTieBreak = tieBreak;
    }
  }

  if (!bestTeamOne || !bestTeamTwo) {
    throw new Error("Could not build balanced teams.");
  }

  const teamOneRating = effectiveTeamRating(bestTeamOne);
  const teamTwoRating = effectiveTeamRating(bestTeamTwo);
  const teamOneWinProbability = winProbability(teamOneRating, teamTwoRating);

  return {
    format: teamFormat(teamOneSize, teamTwoSize),
    teamSizes: [teamOneSize, teamTwoSize],
    participants: [
      ...bestTeamOne.map((player, index) => ({
        playerId: player.playerId,
        team: 1,
        slot: index + 1,
      })),
      ...bestTeamTwo.map((player, index) => ({
        playerId: player.playerId,
        team: 2,
        slot: bestTeamOne!.length + index + 1,
      })),
    ],
    balanceEstimate: {
      teamOneWinProbability,
      teamTwoWinProbability: 1 - teamOneWinProbability,
    },
  };
}

function planOneVsOne(players: PlannerPlayer[], seed: string): MatchPlanResult {
  const sittingOutPlayerIds: string[] = [];
  let available = [...players];

  if (available.length % 2 === 1) {
    const sittingOut = chooseSitOut(available, seed);
    sittingOutPlayerIds.push(sittingOut.playerId);
    available = available.filter((player) => player.playerId !== sittingOut.playerId);
  }

  const ordered = sortByRating(available, seed);
  const matches: ProposedMatch[] = [];

  for (let index = 0; index < ordered.length; index += 2) {
    matches.push(makeBalancedTeamMatch(ordered.slice(index, index + 2), 1, 1, `${seed}:${index}`));
  }

  return { matches, sittingOutPlayerIds };
}

function planTwoVsTwo(players: PlannerPlayer[], seed: string): MatchPlanResult {
  const sittingOutPlayerIds: string[] = [];
  let available = [...players];

  if (available.length % 2 === 1) {
    const sittingOut = chooseSitOut(available, seed);
    sittingOutPlayerIds.push(sittingOut.playerId);
    available = available.filter((player) => player.playerId !== sittingOut.playerId);
  }

  const ordered = sortByRating(available, seed);
  const matches: ProposedMatch[] = [];
  let cursor = 0;

  while (ordered.length - cursor >= 4) {
    const group = ordered.slice(cursor, cursor + 4);
    matches.push(makeBalancedTeamMatch(group, 2, 2, `${seed}:2v2:${cursor}`));
    cursor += 4;
  }

  if (ordered.length - cursor === 2) {
    matches.push(makeBalancedTeamMatch(ordered.slice(cursor), 1, 1, `${seed}:fallback-1v1`));
  }

  return { matches, sittingOutPlayerIds };
}

function planBigTeamRemainder(
  players: PlannerPlayer[],
  config: MatchPlanningConfig,
  seed: string,
): MatchPlanResult {
  const matches: ProposedMatch[] = [];
  const sittingOutPlayerIds: string[] = [];
  const count = players.length;

  if (count === 0) return { matches, sittingOutPlayerIds };
  if (count === 1) return { matches, sittingOutPlayerIds: [players[0].playerId] };
  if (count === 2) {
    matches.push(makeBalancedTeamMatch(players, 1, 1, `${seed}:1v1`));
    return { matches, sittingOutPlayerIds };
  }
  if (count === 3) {
    if (config.allowAsymmetricTeams) {
      matches.push(makeBalancedTeamMatch(players, 2, 1, `${seed}:2v1`));
    } else {
      const sittingOut = chooseSitOut(players, seed);
      sittingOutPlayerIds.push(sittingOut.playerId);
      const remaining = players.filter((player) => player.playerId !== sittingOut.playerId);
      matches.push(makeBalancedTeamMatch(remaining, 1, 1, `${seed}:1v1`));
    }
    return { matches, sittingOutPlayerIds };
  }
  if (count === 4) {
    matches.push(makeBalancedTeamMatch(players, 2, 2, `${seed}:2v2`));
    return { matches, sittingOutPlayerIds };
  }
  if (count === 5) {
    if (config.allowAsymmetricTeams) {
      matches.push(makeBalancedTeamMatch(players, 3, 2, `${seed}:3v2`));
    } else {
      const sittingOut = chooseSitOut(players, seed);
      sittingOutPlayerIds.push(sittingOut.playerId);
      const remaining = players.filter((player) => player.playerId !== sittingOut.playerId);
      matches.push(makeBalancedTeamMatch(remaining, 2, 2, `${seed}:2v2`));
    }
    return { matches, sittingOutPlayerIds };
  }
  if (count === 6) {
    matches.push(makeBalancedTeamMatch(players, 3, 3, `${seed}:3v3`));
    return { matches, sittingOutPlayerIds };
  }
  if (count === 7) {
    if (config.allowAsymmetricTeams) {
      matches.push(makeBalancedTeamMatch(players, 4, 3, `${seed}:4v3`));
    } else {
      const sittingOut = chooseSitOut(players, seed);
      sittingOutPlayerIds.push(sittingOut.playerId);
      const remaining = players.filter((player) => player.playerId !== sittingOut.playerId);
      matches.push(makeBalancedTeamMatch(remaining, 3, 3, `${seed}:3v3`));
    }
    return { matches, sittingOutPlayerIds };
  }

  matches.push(makeBalancedTeamMatch(players.slice(0, 8), 4, 4, `${seed}:4v4`));
  return { matches, sittingOutPlayerIds };
}

function targetBigTeamChunk(config: MatchPlanningConfig): number {
  if (config.prioritizeLargestTeams) return 8;
  if (config.preferredTeamSize === 4) return 8;
  if (config.preferredTeamSize === 3) return 6;
  if (config.preferredTeamSize === 2) return 4;
  return 8;
}

function planBigTeam(players: PlannerPlayer[], config: MatchPlanningConfig, seed: string): MatchPlanResult {
  const ordered = sortByRating(players, seed);
  const matches: ProposedMatch[] = [];
  const sittingOutPlayerIds: string[] = [];
  const chunkSize = targetBigTeamChunk(config);
  let cursor = 0;

  while (ordered.length - cursor >= chunkSize) {
    const group = ordered.slice(cursor, cursor + chunkSize);
    const teamSize = chunkSize / 2;
    matches.push(makeBalancedTeamMatch(group, teamSize, teamSize, `${seed}:big:${cursor}`));
    cursor += chunkSize;
  }

  const remainder = ordered.slice(cursor);
  const remainderPlan = planBigTeamRemainder(remainder, config, `${seed}:remainder`);
  matches.push(...remainderPlan.matches);
  sittingOutPlayerIds.push(...remainderPlan.sittingOutPlayerIds);

  return { matches, sittingOutPlayerIds };
}

function planFfa(players: PlannerPlayer[], seed: string): MatchPlanResult {
  if (players.length === 0) return { matches: [], sittingOutPlayerIds: [] };
  if (players.length === 1) return { matches: [], sittingOutPlayerIds: [players[0].playerId] };
  if (players.length === 2) {
    return {
      matches: [makeBalancedTeamMatch(players, 1, 1, `${seed}:ffa-fallback-1v1`)],
      sittingOutPlayerIds: [],
    };
  }

  const groupCount = Math.ceil(players.length / 8);
  const baseSize = Math.floor(players.length / groupCount);
  const extra = players.length % groupCount;
  const capacities = Array.from({ length: groupCount }, (_, index) => baseSize + (index < extra ? 1 : 0));
  const groups: PlannerPlayer[][] = capacities.map(() => []);
  const groupTotals = capacities.map(() => 0);

  for (const player of sortByRating(players, seed)) {
    let bestGroup = -1;
    let bestTotal = Number.POSITIVE_INFINITY;

    for (let index = 0; index < groups.length; index += 1) {
      if (groups[index].length >= capacities[index]) continue;
      if (groupTotals[index] < bestTotal) {
        bestGroup = index;
        bestTotal = groupTotals[index];
      }
    }

    if (bestGroup < 0) throw new Error("Could not assign FFA group.");
    groups[bestGroup].push(player);
    groupTotals[bestGroup] += ratingOf(player);
  }

  const matches = groups.map<ProposedMatch>((group) => ({
    format: "FFA",
    participants: group.map((player, index) => ({
      playerId: player.playerId,
      team: null,
      slot: index + 1,
    })),
  }));

  return { matches, sittingOutPlayerIds: [] };
}

export function generateMatchPlan(
  competitionStyle: CompetitionStyle,
  players: PlannerPlayer[],
  planningConfig: MatchPlanningConfig,
  seed: string,
): MatchPlanResult {
  if (players.length < 2) {
    return {
      matches: [],
      sittingOutPlayerIds: players.map((player) => player.playerId),
    };
  }

  switch (competitionStyle) {
    case "ONE_V_ONE":
      return planOneVsOne(players, seed);
    case "TWO_V_TWO":
      return planTwoVsTwo(players, seed);
    case "BIG_TEAM":
      return planBigTeam(players, planningConfig, seed);
    case "FFA":
      return planFfa(players, seed);
  }
}
