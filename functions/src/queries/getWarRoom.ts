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
  matchId?: string | null;
  winningPlayerIds?: string[];
}

export const getWarRoom = onCall(callableOptions, async (request) => {
  const actor = await requireLeaguePlayer(request);
  const state = await db.collection(collections.leagueState).doc(leagueStateDocumentId).get();
  const activeSeasonId = state.exists && typeof state.data()?.activeSeasonId === "string"
    ? state.data()!.activeSeasonId as string
    : null;

  const empty = {
    schemaVersion: "WAR_ROOM_V1",
    generatedAt: new Date().toISOString(),
    visible: true,
    status: "CLOSED",
    activeSeason: null,
    qualification: { status: "PENDING_SOURCE", canIssueChallenges: false, canRespond: false },
    standingsStatus: "PENDING_REVIEW",
    leaderboard: [],
    rivalries: [],
    viewer: {
      playerId: actor.playerId,
      canChallenge: false,
      qualifiedRivals: [],
      rivalries: [],
      pendingIncomingChallenge: null,
    },
    challenges: [],
    viewerChallenges: [],
  };
  if (!activeSeasonId) return { ...empty, visible: false };

  // Challenge history is private to its two participants. Do not return the
  // previous season-wide challenges collection to every active member.
  const seasonRef = db.collection(collections.seasons).doc(activeSeasonId);
  const [seasonSnapshot, sent, received, playersSnapshot] = await Promise.all([
    seasonRef.get(),
    db.collection(collections.challenges).where("challengerPlayerId", "==", actor.playerId).get(),
    db.collection(collections.challenges).where("challengedPlayerId", "==", actor.playerId).get(),
    db.collection(collections.players).get(),
  ]);
  const season = seasonSnapshot.exists ? seasonSnapshot.data() as SeasonDocument : {};
  const players = playerMap(playersSnapshot);
  const docs = new Map([...sent.docs, ...received.docs]
    .filter(document => (document.data() as ChallengeDocument).seasonId === activeSeasonId)
    .filter(document => {
      const row = document.data() as ChallengeDocument;
      return row.challengerPlayerId === actor.playerId || row.challengedPlayerId === actor.playerId;
    })
    .map(document => [document.id, document]));

  const viewerChallenges = [...docs.values()].map(document => {
    const challenge = document.data() as ChallengeDocument;
    return {
      challengeId: document.id,
      challengeRevision: Number(challenge.challengeRevision ?? 1),
      pairId: challenge.pairId ?? null,
      challenger: publicPlayer(challenge.challengerPlayerId ?? "UNKNOWN", players.get(challenge.challengerPlayerId ?? "")),
      challenged: publicPlayer(challenge.challengedPlayerId ?? "UNKNOWN", players.get(challenge.challengedPlayerId ?? "")),
      status: challenge.status ?? "UNKNOWN",
      matchId: challenge.matchId ?? null,
      winners: (challenge.winningPlayerIds ?? []).map(playerId => publicPlayer(playerId, players.get(playerId))),
      createdAt: iso(challenge.createdAt),
      respondedAt: iso(challenge.respondedAt),
      completedAt: iso(challenge.completedAt),
      eligibilityReview: "PENDING_SOURCE",
      canRespond: false,
    };
  }).sort((left, right) =>
    String(right.createdAt ?? "").localeCompare(String(left.createdAt ?? "")) ||
    left.challengeId.localeCompare(right.challengeId));

  // Historical legacy rivalry rows/QUALIFIED flags and proposed, private
  // six-track simulations are NOT published current Relationship authority.
  // Therefore no stage-3 challenger, eligible pair or challenge-dependent
  // leaderboard may be represented as verified in this release slice.
  return {
    ...empty,
    status: season.warRoom?.status === "OPEN" ? "PENDING_SOURCE" : "CLOSED",
    activeSeason: {
      seasonId: activeSeasonId,
      name: season.name ?? activeSeasonId,
      openedAt: iso(season.warRoom?.openedAt),
      engineVersion: season.warRoom?.engineVersion ?? null,
    },
    challenges: viewerChallenges,
    viewerChallenges,
  };
});
