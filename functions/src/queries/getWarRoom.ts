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
  seasonId?: string | null;
  challengerPlayerId?: string;
  challengedPlayerId?: string;
  status?: string;
  createdAt?: Timestamp | null;
  respondedAt?: Timestamp | null;
  scheduledAt?: Timestamp | null;
  sourceRivalryId?: string | null;
  matchId?: string | null;
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
      rivalries: [],
      viewer: { playerId: actor.playerId, canChallenge: false, qualifiedRivals: [] },
      challenges: [],
    };
  }

  const seasonRef = db.collection(collections.seasons).doc(activeSeasonId);
  const [seasonSnapshot, rivalriesSnapshot, challengesSnapshot, playersSnapshot] = await Promise.all([
    seasonRef.get(),
    seasonRef.collection("rivalries").get(),
    db.collection(collections.challenges).where("seasonId", "==", activeSeasonId).get(),
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

  const challenges = challengesSnapshot.docs
    .map((document) => ({ challengeId: document.id, ...document.data() as ChallengeDocument }))
    .map((challenge) => ({
      challengeId: challenge.challengeId,
      challenger: publicPlayer(challenge.challengerPlayerId ?? "UNKNOWN", players.get(challenge.challengerPlayerId ?? "")),
      challenged: publicPlayer(challenge.challengedPlayerId ?? "UNKNOWN", players.get(challenge.challengedPlayerId ?? "")),
      status: challenge.status ?? "UNKNOWN",
      sourceRivalryId: challenge.sourceRivalryId ?? null,
      matchId: challenge.matchId ?? null,
      createdAt: iso(challenge.createdAt),
      respondedAt: iso(challenge.respondedAt),
      scheduledAt: iso(challenge.scheduledAt),
    }))
    .sort((left, right) => String(right.createdAt ?? "").localeCompare(String(left.createdAt ?? "")) || left.challengeId.localeCompare(right.challengeId));

  const viewerChallenges = challenges.filter((challenge) => (
    challenge.challenger.playerId === actor.playerId || challenge.challenged.playerId === actor.playerId
  ));

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
    rivalries: open ? rivalries : [],
    viewer: {
      playerId: actor.playerId,
      canChallenge: open && qualifiedRivals.length > 0,
      qualifiedRivals,
      rivalries: open ? viewerRivalries : [],
    },
    challenges: open ? challenges : [],
    viewerChallenges: open ? viewerChallenges : [],
  };
});
