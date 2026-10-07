import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireLeaguePlayer } from "../auth/authorization.js";
import { db } from "../config/firebase.js";
import { callableOptions } from "../config/runtime.js";
import { collections, leagueStateDocumentId } from "../domain/collections.js";
import type { Player } from "../domain/types.js";
import {maskUnavailableSeasonAwards} from "../engines/seasonPoints.js";
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

interface ChronicleEntryDocument {
  entryId?: string;
  matchId?: string;
  eventId?: string | null;
  seasonId?: string | null;
  playedAtMs?: number;
  kind?: string;
  title?: string;
  text?: string;
  relation?: string;
  tracksTouched?: string[];
}

interface RelationshipTrackDocument {
  status?: string;
  state?: string;
  stageId?: string | null;
  historicalPeakStageId?: string | null;
}

interface PairRelationshipDocument {
  pairId?: string;
  playerOneId?: string;
  playerTwoId?: string;
  relationshipEngineVersion?: string;
  relationshipRulesConfigured?: boolean;
  relationship?: {
    rivalry?: RelationshipTrackDocument;
    hostility?: RelationshipTrackDocument;
    bond?: RelationshipTrackDocument;
  } | null;
  chronicle?: ChronicleEntryDocument[];
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

function publicRelationshipTrack(track: RelationshipTrackDocument | undefined) {
  return {
    status: track?.status ?? "UNCONFIGURED",
    state: track?.state ?? "UNESTABLISHED",
    stageId: track?.stageId ?? null,
    historicalPeakStageId: track?.historicalPeakStageId ?? null,
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
    relationshipAsOneSnapshot,
    relationshipAsTwoSnapshot,
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
    db.collection(collections.relationships).where("playerOneId", "==", playerId).get(),
    db.collection(collections.relationships).where("playerTwoId", "==", playerId).get(),
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
    const [standingSnapshot, seasonCompetitionSnapshot, seasonReplaySnapshot, seasonRecordsSnapshot, scoringMatchesSnapshot, pointLedgerSnapshot] = await Promise.all([
      seasonRef.collection("standings").doc(playerId).get(),
      seasonRef.collection("statistics").doc(playerId).get(),
      seasonRef.collection("replayStatistics").doc(playerId).get(),
      seasonRef.collection("replayRecords").get(),
      db.collection(collections.matches).where("seasonId","==",activeSeasonId).get(),
      db.collection(collections.leaguePointLedger).where("seasonId","==",activeSeasonId).get(),
    ]);
    const seasonRecordsHeld = seasonRecordsSnapshot.docs
      .map((document) => ({ code: document.id, ...document.data() as RecordDocument }))
      .filter((record) => (record.holders ?? []).some((holder) => holder.playerId === playerId));

    season = {
      seasonId: activeSeasonId,
      leaguePoints:maskUnavailableSeasonAwards(
        [{playerId,steamName:"",leaguePoints:Number(standingSnapshot.data()?.leaguePoints??0)}],
        scoringMatchesSnapshot.docs.map(document=>({matchId:document.id,...document.data()})),
        pointLedgerSnapshot.docs.map(document=>document.data()))[0].leaguePoints,
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

  const pairRelationships = [...relationshipAsOneSnapshot.docs, ...relationshipAsTwoSnapshot.docs]
    .map((document) => {
      const data = document.data() as PairRelationshipDocument;
      const otherPlayerId = data.playerOneId === playerId ? data.playerTwoId : data.playerOneId;
      if (!otherPlayerId) return null;
      return {
        pairId: data.pairId ?? document.id,
        otherPlayer: publicPlayer(otherPlayerId, players.get(otherPlayerId)),
        relationshipEngineVersion: data.relationshipEngineVersion ?? null,
        relationshipRulesConfigured: data.relationshipRulesConfigured === true,
        tracks: {
          rivalry: publicRelationshipTrack(data.relationship?.rivalry),
          hostility: publicRelationshipTrack(data.relationship?.hostility),
          bond: publicRelationshipTrack(data.relationship?.bond),
        },
        chronicle: (data.chronicle ?? [])
          .map((entry) => ({
            entryId: entry.entryId ?? `${entry.matchId ?? "unknown"}:${entry.kind ?? "ENTRY"}`,
            matchId: entry.matchId ?? null,
            eventId: entry.eventId ?? null,
            seasonId: entry.seasonId ?? null,
            playedAt: Number.isFinite(entry.playedAtMs) ? new Date(Number(entry.playedAtMs)).toISOString() : null,
            kind: entry.kind ?? "ENTRY",
            title: entry.title ?? "Recorded encounter",
            text: entry.text ?? "A shared Battle was entered into the chronicle.",
            relation: entry.relation ?? null,
            tracksTouched: entry.tracksTouched ?? [],
          }))
          .sort((left, right) => (right.playedAt ?? "").localeCompare(left.playedAt ?? "")),
      };
    })
    .filter((relationship): relationship is NonNullable<typeof relationship> => relationship != null)
    .sort((left, right) => left.otherPlayer.steamName.localeCompare(right.otherPlayer.steamName));

  const activeAchievements = achievementsSnapshot.docs
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

  const showcasedRecordCodes = playerId === actor.playerId
    ? (((player as Player & { showcasedRecordCodes?: string[] }).showcasedRecordCodes ?? []).filter(code => typeof code === "string").slice(0, 3))
    : [];
  const chronicleSelectedRecords = showcasedRecordCodes
    .map(code => lifetimeRecordsHeld.find(record => record.code === code))
    .filter((record): record is NonNullable<typeof record> => record != null);

  return {
    schemaVersion: "PLAYER_PROFILE_V2",
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
    // Never expose another player's full achievement collection.
    achievements: activeAchievements.filter(achievement =>
      ((player as Player & {showcasedAwardIds?: string[]}).showcasedAwardIds ?? [])
        .slice(0, 3).includes(achievement.awardId),
    ),
    ...(playerId === actor.playerId ? {
      achievementCollection: activeAchievements,
      chronicleShowcase: { selectedRecords: chronicleSelectedRecords },
    } : {}),
    opponents: relationships(opponentsSnapshot),
    teammates: relationships(teammatesSnapshot),
    relationships: pairRelationships,
  };
});
