import { Timestamp } from "firebase-admin/firestore";
import { onCall } from "firebase-functions/v2/https";
import { requireLeaguePlayer } from "../auth/authorization.js";
import { db } from "../config/firebase.js";
import { callableOptions } from "../config/runtime.js";
import { collections, leagueStateDocumentId } from "../domain/collections.js";
import { iso, playerMap, publicPlayer } from "./querySupport.js";

interface SeasonDocument {
  name?: string;
  warRoom?: {
    status?: string;
    openedAt?: Timestamp | null;
    openedByRivalryId?: string | null;
    engineVersion?: string | null;
  } | null;
}

interface RivalryDocument {
  pairId?: string;
  playerOneId?: string;
  playerTwoId?: string;
  encounters?: number;
  playerOneWins?: number;
  playerTwoWins?: number;
  noPairWinnerEncounters?: number;
  rivalryScore?: number;
  status?: string;
  contributingMatchIds?: string[];
  updatedAt?: Timestamp | null;
}

interface ChallengeDocument {
  challengeRevision?: number;
  seasonId?: string | null;
  pairId?: string | null;
  challengerPlayerId?: string;
  challengedPlayerId?: string;
  status?: string;
  createdAt?: Timestamp | null;
  respondedAt?: Timestamp | null;
  completedAt?: Timestamp | null;
  sourceRivalryId?: string | null;
  matchId?: string | null;
  winningPlayerIds?: string[];
}

export const getWarRoom = onCall(callableOptions, async (request) => {
  const actor = await requireLeaguePlayer(request);
  const leagueStateSnapshot = await db.collection(collections.leagueState).doc(leagueStateDocumentId).get();
  const activeSeasonId = leagueStateSnapshot.exists && typeof leagueStateSnapshot.data()?.activeSeasonId === "string"
    ? leagueStateSnapshot.data()!.activeSeasonId as string
    : null;

  if (!activeSeasonId) {
    return {
      schemaVersion: "WAR_ROOM_V1",
      generatedAt: new Date().toISOString(),
      visible: false,
      status: "CLOSED",
      activeSeason: null,
      leaderboard: [],
      rivalries: [],
      viewer: { playerId: actor.playerId, canChallenge: false, qualifiedRivals: [] },
      challenges: [],
      viewerChallenges: [],
    };
  }

  const seasonRef = db.collection(collections.seasons).doc(activeSeasonId);
  const [seasonSnapshot, rivalriesSnapshot, challengesSnapshot, standingsSnapshot, playersSnapshot] = await Promise.all([
    seasonRef.get(),
    seasonRef.collection("rivalries").get(),
    db.collection(collections.challenges).where("seasonId", "==", activeSeasonId).get(),
    seasonRef.collection("warRoomStandings").get(),
    db.collection(collections.players).get(),
  ]);

  const season = seasonSnapshot.exists ? seasonSnapshot.data() as SeasonDocument : {};
  const players = playerMap(playersSnapshot);
  const open = season.warRoom?.status === "OPEN";

  const rivalries = rivalriesSnapshot.docs
    .map((document) => ({ pairId: document.id, ...document.data() as RivalryDocument }))
    .map((rivalry) => ({
      pairId: rivalry.pairId,
      playerOne: publicPlayer(rivalry.playerOneId ?? "UNKNOWN", players.get(rivalry.playerOneId ?? "")),
      playerTwo: publicPlayer(rivalry.playerTwoId ?? "UNKNOWN", players.get(rivalry.playerTwoId ?? "")),
      encounters: Number(rivalry.encounters ?? 0),
      playerOneWins: Number(rivalry.playerOneWins ?? 0),
      playerTwoWins: Number(rivalry.playerTwoWins ?? 0),
      noPairWinnerEncounters: Number(rivalry.noPairWinnerEncounters ?? 0),
      rivalryScore: Number(rivalry.rivalryScore ?? 0),
      status: rivalry.status ?? "EMERGING",
      contributingMatchIds: Array.isArray(rivalry.contributingMatchIds) ? rivalry.contributingMatchIds : [],
      updatedAt: iso(rivalry.updatedAt),
    }))
    .sort((left, right) => right.rivalryScore - left.rivalryScore || left.pairId.localeCompare(right.pairId));

  const viewerRivalries = rivalries.filter((rivalry) => (
    rivalry.playerOne.playerId === actor.playerId || rivalry.playerTwo.playerId === actor.playerId
  ));
  const qualifiedRivals = viewerRivalries
    .filter((rivalry) => rivalry.status === "QUALIFIED")
    .map((rivalry) => rivalry.playerOne.playerId === actor.playerId ? rivalry.playerTwo : rivalry.playerOne);

  const leaderboard = standingsSnapshot.docs
    .map((document) => ({
      player: publicPlayer(document.id, players.get(document.id)),
      warRoomPoints: Number(document.data()?.warRoomPoints ?? 0),
    }))
    .sort((left, right) => right.warRoomPoints - left.warRoomPoints || left.player.steamName.localeCompare(right.player.steamName))
    .map((standing, index) => ({ rank: index + 1, ...standing }));

  const challenges = challengesSnapshot.docs
    .map((document) => ({ challengeId: document.id, ...document.data() as ChallengeDocument }))
    .map((challenge) => ({
      challengeId: challenge.challengeId,
      challengeRevision: Number(challenge.challengeRevision ?? 1),
      pairId: challenge.pairId ?? null,
      challenger: publicPlayer(challenge.challengerPlayerId ?? "UNKNOWN", players.get(challenge.challengerPlayerId ?? "")),
      challenged: publicPlayer(challenge.challengedPlayerId ?? "UNKNOWN", players.get(challenge.challengedPlayerId ?? "")),
      status: challenge.status ?? "UNKNOWN",
      sourceRivalryId: challenge.sourceRivalryId ?? null,
      matchId: challenge.matchId ?? null,
      winners: (challenge.winningPlayerIds ?? []).map((playerId) => publicPlayer(playerId, players.get(playerId))),
      createdAt: iso(challenge.createdAt),
      respondedAt: iso(challenge.respondedAt),
      completedAt: iso(challenge.completedAt),
    }))
    .sort((left, right) => String(right.createdAt ?? "").localeCompare(String(left.createdAt ?? "")) || left.challengeId.localeCompare(right.challengeId));

  const viewerChallenges = challenges.filter((challenge) => (
    challenge.challenger.playerId === actor.playerId || challenge.challenged.playerId === actor.playerId
  ));
  const pendingIncomingChallenge = viewerChallenges.find((challenge) => (
    challenge.status === "PENDING" && challenge.challenged.playerId === actor.playerId
  )) ?? null;

  return {
    schemaVersion: "WAR_ROOM_V1",
    generatedAt: new Date().toISOString(),
    visible: open,
    status: open ? "OPEN" : "CLOSED",
    activeSeason: {
      seasonId: activeSeasonId,
      name: season.name ?? activeSeasonId,
      openedAt: iso(season.warRoom?.openedAt),
      openedByRivalryId: season.warRoom?.openedByRivalryId ?? null,
      engineVersion: season.warRoom?.engineVersion ?? null,
    },
    leaderboard: open ? leaderboard : [],
    rivalries: open ? rivalries : [],
    viewer: {
      playerId: actor.playerId,
      canChallenge: open && qualifiedRivals.length > 0,
      qualifiedRivals,
      rivalries: open ? viewerRivalries : [],
      pendingIncomingChallenge: open ? pendingIncomingChallenge : null,
    },
    challenges: open ? challenges : [],
    viewerChallenges: open ? viewerChallenges : [],
  };
});
