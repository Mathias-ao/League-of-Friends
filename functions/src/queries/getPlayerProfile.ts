import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireLeaguePlayer } from "../auth/authorization.js";
import { db } from "../config/firebase.js";
import { callableOptions } from "../config/runtime.js";
import { collections, leagueStateDocumentId } from "../domain/collections.js";
import type { Player } from "../domain/types.js";
import { iso, playerMap, publicPlayer } from "./querySupport.js";

interface PlayerProfileInput {
  playerId?: string;
}

interface CompetitionStatsDocument {
  schemaVersion?: string;
  playerId?: string;
  seasonId?: string;
  matchesPlayed?: number;
  matchesWon?: number;
  matchesLost?: number;
  currentWinStreak?: number;
  currentLossStreak?: number;
  longestWinStreak?: number;
  longestLossStreak?: number;
  byFormat?: Record<string, unknown>;
  firstMatchId?: string | null;
  lastMatchId?: string | null;
  firstPlayedAt?: Timestamp | null;
  lastPlayedAt?: Timestamp | null;
}

interface ReplayStatsDocument {
  schemaVersion?: string;
  gamesAnalyzed?: number;
  totalActions?: number;
  totalDurationSeconds?: number;
  weightedAverageRawApm?: number;
  highestPeak30sRawApm?: Record<string, unknown> | null;
  highestPeak60sRawApm?: Record<string, unknown> | null;
  ageResearch?: Record<string, unknown>;
  civilizationUsage?: Record<string, number>;
  market?: Record<string, number>;
  tribute?: Record<string, number>;
  strategyCounts?: Record<string, number>;
}

interface RelationshipDocument {
  otherPlayerId?: string;
  matchesTogether?: number;
  wins?: number;
  losses?: number;
  firstMatchId?: string;
  lastMatchId?: string;
  firstPlayedAt?: Timestamp | null;
  lastPlayedAt?: Timestamp | null;
}

interface AchievementDocument {
  achievementId?: string;
  name?: string;
  description?: string;
  scope?: string;
  seasonId?: string | null;
  status?: string;
  firstAwardedAt?: Timestamp | null;
  evaluation?: Record<string, unknown>;
}

interface RecordDocument {
  code?: string;
  direction?: string;
  unit?: string;
  value?: number | null;
  holders?: Array<{ playerId?: string; value?: number; matchId?: string; gameId?: string }>;
}

function competitionStats(data: CompetitionStatsDocument | null) {
  if (!data) return null;
  return {
    schemaVersion: data.schemaVersion ?? null,
    matchesPlayed: Number(data.matchesPlayed ?? 0),
    matchesWon: Number(data.matchesWon ?? 0),
    matchesLost: Number(data.matchesLost ?? 0),
    currentWinStreak: Number(data.currentWinStreak ?? 0),
    currentLossStreak: Number(data.currentLossStreak ?? 0),
    longestWinStreak: Number(data.longestWinStreak ?? 0),
    longestLossStreak: Number(data.longestLossStreak ?? 0),
    byFormat: data.byFormat ?? {},
    firstMatchId: data.firstMatchId ?? null,
    lastMatchId: data.lastMatchId ?? null,
    firstPlayedAt: iso(data.firstPlayedAt),
    lastPlayedAt: iso(data.lastPlayedAt),
  };
}

function replayStats(data: ReplayStatsDocument | null) {
  if (!data) return null;
  return {
    schemaVersion: data.schemaVersion ?? null,
    gamesAnalyzed: Number(data.gamesAnalyzed ?? 0),
    totalActions: Number(data.totalActions ?? 0),
    totalDurationSeconds: Number(data.totalDurationSeconds ?? 0),
    weightedAverageRawApm: Number(data.weightedAverageRawApm ?? 0),
    highestPeak30sRawApm: data.highestPeak30sRawApm ?? null,
    highestPeak60sRawApm: data.highestPeak60sRawApm ?? null,
    ageResearch: data.ageResearch ?? {},
    civilizationUsage: data.civilizationUsage ?? {},
    market: data.market ?? {},
    tribute: data.tribute ?? {},
    strategyCounts: data.strategyCounts ?? {},
  };
}

export const getPlayerProfile = onCall<PlayerProfileInput>(callableOptions, async (request) => {
  const actor = await requireLeaguePlayer(request);
  const playerId = request.data.playerId?.trim() || actor.playerId;
  const playerRef = db.collection(collections.players).doc(playerId);

  const [
    playerSnapshot,
    playersSnapshot,
    leagueStateSnapshot,
    lifetimeCompetitionSnapshot,
    lifetimeReplaySnapshot,
    achievementsSnapshot,
    opponentsSnapshot,
    teammatesSnapshot,
    lifetimeRecordsSnapshot,
  ] = await Promise.all([
    playerRef.get(),
    db.collection(collections.players).get(),
    db.collection(collections.leagueState).doc(leagueStateDocumentId).get(),
    playerRef.collection("statistics").doc("lifetime").get(),
    playerRef.collection("statistics").doc("replayLifetime").get(),
    playerRef.collection("achievements").get(),
    playerRef.collection("opponentStats").get(),
    playerRef.collection("teammateStats").get(),
    db.collection(collections.leagueRecords).get(),
  ]);

  if (!playerSnapshot.exists) throw new HttpsError("not-found", "Player not found.");
  const player = playerSnapshot.data() as Player;
  if (player.membershipStatus === "SUSPENDED") {
    throw new HttpsError("not-found", "Player not found.");
  }

  const players = playerMap(playersSnapshot);
  const leagueState = leagueStateSnapshot.exists ? leagueStateSnapshot.data() : {};
  const activeSeasonId = typeof leagueState?.activeSeasonId === "string" ? leagueState.activeSeasonId : null;

  let season = null;
  if (activeSeasonId) {
    const seasonRef = db.collection(collections.seasons).doc(activeSeasonId);
    const [standingSnapshot, seasonCompetitionSnapshot, seasonReplaySnapshot, seasonRecordsSnapshot] = await Promise.all([
      seasonRef.collection("standings").doc(playerId).get(),
      seasonRef.collection("statistics").doc(playerId).get(),
      seasonRef.collection("replayStatistics").doc(playerId).get(),
      seasonRef.collection("replayRecords").get(),
    ]);
    const seasonRecordsHeld = seasonRecordsSnapshot.docs
      .map((document) => ({ code: document.id, ...document.data() as RecordDocument }))
      .filter((record) => (record.holders ?? []).some((holder) => holder.playerId === playerId));

    season = {
      seasonId: activeSeasonId,
      leaguePoints: Number(standingSnapshot.data()?.leaguePoints ?? 0),
      competition: competitionStats(
        seasonCompetitionSnapshot.exists ? seasonCompetitionSnapshot.data() as CompetitionStatsDocument : null,
      ),
      replay: replayStats(
        seasonReplaySnapshot.exists ? seasonReplaySnapshot.data() as ReplayStatsDocument : null,
      ),
      recordsHeld: seasonRecordsHeld,
    };
  }

  const relationships = (snapshot: FirebaseFirestore.QuerySnapshot) => snapshot.docs
    .map((document) => {
      const data = document.data() as RelationshipDocument;
      const otherPlayerId = data.otherPlayerId ?? document.id;
      return {
        player: publicPlayer(otherPlayerId, players.get(otherPlayerId)),
        matchesTogether: Number(data.matchesTogether ?? 0),
        wins: Number(data.wins ?? 0),
        losses: Number(data.losses ?? 0),
        firstMatchId: data.firstMatchId ?? null,
        lastMatchId: data.lastMatchId ?? null,
        firstPlayedAt: iso(data.firstPlayedAt),
        lastPlayedAt: iso(data.lastPlayedAt),
      };
    })
    .sort((left, right) => right.matchesTogether - left.matchesTogether || left.player.steamName.localeCompare(right.player.steamName));

  const achievements = achievementsSnapshot.docs
    .map((document) => ({ awardId: document.id, ...document.data() as AchievementDocument }))
    .filter((achievement) => achievement.status === "ACTIVE")
    .map((achievement) => ({
      awardId: achievement.awardId,
      achievementId: achievement.achievementId ?? null,
      name: achievement.name ?? achievement.achievementId ?? achievement.awardId,
      description: achievement.description ?? "",
      scope: achievement.scope ?? null,
      seasonId: achievement.seasonId ?? null,
      firstAwardedAt: iso(achievement.firstAwardedAt),
      evaluation: achievement.evaluation ?? {},
    }));

  const lifetimeRecordsHeld = lifetimeRecordsSnapshot.docs
    .map((document) => ({ code: document.id, ...document.data() as RecordDocument }))
    .filter((record) => (record.holders ?? []).some((holder) => holder.playerId === playerId));

  return {
    schemaVersion: "PLAYER_PROFILE_V1",
    generatedAt: new Date().toISOString(),
    player: {
      ...publicPlayer(playerId, player),
      membershipStatus: player.membershipStatus,
      role: player.role,
      powerRatingGames: Number(player.powerRatingGames ?? 0),
      powerRatingAlgorithmVersion: player.powerRatingAlgorithmVersion ?? null,
      ...(playerId === actor.playerId || actor.role === "ADMIN" ? { goldBalance: Number(player.goldBalance ?? 0) } : {}),
    },
    lifetime: {
      competition: competitionStats(
        lifetimeCompetitionSnapshot.exists ? lifetimeCompetitionSnapshot.data() as CompetitionStatsDocument : null,
      ),
      replay: replayStats(
        lifetimeReplaySnapshot.exists ? lifetimeReplaySnapshot.data() as ReplayStatsDocument : null,
      ),
      recordsHeld: lifetimeRecordsHeld,
    },
    activeSeason: season,
    achievements,
    opponents: relationships(opponentsSnapshot),
    teammates: relationships(teammatesSnapshot),
  };
});
