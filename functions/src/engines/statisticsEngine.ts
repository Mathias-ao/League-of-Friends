import type { CanonicalGameResult, MatchFormat, MatchParticipant } from "../domain/types.js";

export const COMPETITION_STATS_VERSION = "COMPETITION_STATS_V1";

export interface StatisticsMatchInput {
  matchId: string;
  seasonId: string | null;
  format: MatchFormat;
  participants: MatchParticipant[];
  canonicalResult: CanonicalGameResult;
  affectsLifetimeStats: boolean;
  affectsSeasonStats: boolean;
  orderAtMs: number;
}

export interface FormatStatistics {
  played: number;
  wins: number;
  losses: number;
}

export interface PlayerCompetitionStatistics {
  playerId: string;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  currentWinStreak: number;
  currentLossStreak: number;
  longestWinStreak: number;
  longestLossStreak: number;
  byFormat: Partial<Record<MatchFormat, FormatStatistics>>;
  firstMatchId: string | null;
  lastMatchId: string | null;
  firstPlayedAtMs: number | null;
  lastPlayedAtMs: number | null;
}

export interface PlayerRelationshipStatistics {
  playerId: string;
  otherPlayerId: string;
  matchesTogether: number;
  wins: number;
  losses: number;
  firstMatchId: string;
  lastMatchId: string;
  firstPlayedAtMs: number;
  lastPlayedAtMs: number;
}

export interface SeasonPlayerStatistics extends PlayerCompetitionStatistics {
  seasonId: string;
}

export interface CompetitionStatisticsRebuildResult {
  lifetime: PlayerCompetitionStatistics[];
  seasonal: SeasonPlayerStatistics[];
  opponents: PlayerRelationshipStatistics[];
  teammates: PlayerRelationshipStatistics[];
}

interface MutablePlayerStats extends PlayerCompetitionStatistics {}
interface MutableRelationshipStats extends PlayerRelationshipStatistics {}

function emptyPlayerStats(playerId: string): MutablePlayerStats {
  return {
    playerId,
    matchesPlayed: 0,
    matchesWon: 0,
    matchesLost: 0,
    currentWinStreak: 0,
    currentLossStreak: 0,
    longestWinStreak: 0,
    longestLossStreak: 0,
    byFormat: {},
    firstMatchId: null,
    lastMatchId: null,
    firstPlayedAtMs: null,
    lastPlayedAtMs: null,
  };
}

function updatePlayerStats(
  stats: MutablePlayerStats,
  match: StatisticsMatchInput,
  won: boolean,
): void {
  stats.matchesPlayed += 1;
  if (won) {
    stats.matchesWon += 1;
    stats.currentWinStreak += 1;
    stats.currentLossStreak = 0;
    stats.longestWinStreak = Math.max(stats.longestWinStreak, stats.currentWinStreak);
  } else {
    stats.matchesLost += 1;
    stats.currentLossStreak += 1;
    stats.currentWinStreak = 0;
    stats.longestLossStreak = Math.max(stats.longestLossStreak, stats.currentLossStreak);
  }

  const formatStats = stats.byFormat[match.format] ?? { played: 0, wins: 0, losses: 0 };
  formatStats.played += 1;
  if (won) formatStats.wins += 1;
  else formatStats.losses += 1;
  stats.byFormat[match.format] = formatStats;

  if (stats.firstPlayedAtMs == null) {
    stats.firstPlayedAtMs = match.orderAtMs;
    stats.firstMatchId = match.matchId;
  }
  stats.lastPlayedAtMs = match.orderAtMs;
  stats.lastMatchId = match.matchId;
}

function relationshipKey(playerId: string, otherPlayerId: string): string {
  return `${playerId}\u0000${otherPlayerId}`;
}

function updateRelationship(
  store: Map<string, MutableRelationshipStats>,
  playerId: string,
  otherPlayerId: string,
  match: StatisticsMatchInput,
  won: boolean,
): void {
  const key = relationshipKey(playerId, otherPlayerId);
  let stats = store.get(key);
  if (!stats) {
    stats = {
      playerId,
      otherPlayerId,
      matchesTogether: 0,
      wins: 0,
      losses: 0,
      firstMatchId: match.matchId,
      lastMatchId: match.matchId,
      firstPlayedAtMs: match.orderAtMs,
      lastPlayedAtMs: match.orderAtMs,
    };
    store.set(key, stats);
  }

  stats.matchesTogether += 1;
  if (won) stats.wins += 1;
  else stats.losses += 1;
  stats.lastMatchId = match.matchId;
  stats.lastPlayedAtMs = match.orderAtMs;
}

function ordered(matches: StatisticsMatchInput[]): StatisticsMatchInput[] {
  return [...matches].sort((left, right) => {
    if (left.orderAtMs !== right.orderAtMs) return left.orderAtMs - right.orderAtMs;
    return left.matchId.localeCompare(right.matchId);
  });
}

function winningSet(match: StatisticsMatchInput): Set<string> {
  const winners = match.canonicalResult.winningPlayerIds ?? [];
  if (winners.length === 0) {
    throw new Error(`Match ${match.matchId} has no canonical winning players.`);
  }
  return new Set(winners);
}

export function rebuildCompetitionStatistics(
  matches: StatisticsMatchInput[],
): CompetitionStatisticsRebuildResult {
  const lifetime = new Map<string, MutablePlayerStats>();
  const seasonal = new Map<string, MutablePlayerStats>();
  const opponents = new Map<string, MutableRelationshipStats>();
  const teammates = new Map<string, MutableRelationshipStats>();

  for (const match of ordered(matches)) {
    if (!Array.isArray(match.participants) || match.participants.length < 2) {
      throw new Error(`Match ${match.matchId} has fewer than two participants.`);
    }

    const winners = winningSet(match);
    const participantIds = new Set(match.participants.map((participant) => participant.playerId));
    for (const winnerId of winners) {
      if (!participantIds.has(winnerId)) {
        throw new Error(`Match ${match.matchId} has a winner who is not a participant.`);
      }
    }

    for (const participant of match.participants) {
      const won = winners.has(participant.playerId);

      if (match.affectsLifetimeStats) {
        const stats = lifetime.get(participant.playerId) ?? emptyPlayerStats(participant.playerId);
        updatePlayerStats(stats, match, won);
        lifetime.set(participant.playerId, stats);
      }

      if (match.affectsSeasonStats && match.seasonId) {
        const key = `${match.seasonId}\u0000${participant.playerId}`;
        const stats = seasonal.get(key) ?? emptyPlayerStats(participant.playerId);
        updatePlayerStats(stats, match, won);
        seasonal.set(key, stats);
      }

      if (!match.affectsLifetimeStats) continue;

      for (const other of match.participants) {
        if (other.playerId === participant.playerId) continue;

        const sameTeam = match.format !== "FFA" &&
          participant.team != null &&
          other.team === participant.team;

        updateRelationship(
          sameTeam ? teammates : opponents,
          participant.playerId,
          other.playerId,
          match,
          won,
        );
      }
    }
  }

  const seasonalOutput = [...seasonal.entries()].map(([key, stats]) => {
    const seasonId = key.split("\u0000", 1)[0];
    return { ...stats, seasonId };
  });

  return {
    lifetime: [...lifetime.values()].sort((a, b) => a.playerId.localeCompare(b.playerId)),
    seasonal: seasonalOutput.sort((a, b) => a.seasonId.localeCompare(b.seasonId) || a.playerId.localeCompare(b.playerId)),
    opponents: [...opponents.values()].sort((a, b) => a.playerId.localeCompare(b.playerId) || a.otherPlayerId.localeCompare(b.otherPlayerId)),
    teammates: [...teammates.values()].sort((a, b) => a.playerId.localeCompare(b.playerId) || a.otherPlayerId.localeCompare(b.otherPlayerId)),
  };
}
