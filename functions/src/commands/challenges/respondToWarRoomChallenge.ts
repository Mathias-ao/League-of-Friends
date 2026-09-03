import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireLeaguePlayer } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import { callableOptions } from "../../config/runtime.js";
import { collections } from "../../domain/collections.js";

interface RespondToWarRoomChallengeInput {
  challengeId: string;
  response: "ACCEPT" | "DECLINE";
}

interface ChallengeDocument {
  challengeRevision?: number;
  seasonId?: string | null;
  pairId?: string;
  sourceRivalryId?: string | null;
  challengerPlayerId?: string;
  challengedPlayerId?: string;
  status?: string;
  matchId?: string | null;
}

const WAR_ROOM_SCORING_VERSION = "WAR_ROOM_SCORING_V1";
const WAR_ROOM_MATCH_COMPLETION_POINTS = 0;
const WAR_ROOM_MATCH_WIN_POINTS = 3;

function defaultWarRoomGameConfig() {
  return {
    maps: {
      pool: [],
      selectionMode: "UNRESTRICTED" as const,
    },
    civilizations: {
      mode: "UNRESTRICTED" as const,
      allowed: [],
      banned: [],
      customRuleCode: null,
    },
    victory: {
      conquest: true,
      wonder: false,
      relic: false,
      customRuleCode: null,
    },
    diplomacyEnabled: false,
    additionalSettings: {},
  };
}

export const respondToWarRoomChallenge = onCall<RespondToWarRoomChallengeInput>(callableOptions, async (request) => {
  const actor = await requireLeaguePlayer(request);
  const challengeId = request.data.challengeId?.trim();
  const response = request.data.response;
  if (!challengeId || (response !== "ACCEPT" && response !== "DECLINE")) {
    throw new HttpsError("invalid-argument", "challengeId and a valid response are required.");
  }

  const challengeRef = db.collection(collections.challenges).doc(challengeId);
  const result = await db.runTransaction(async (transaction) => {
    const challengeSnapshot = await transaction.get(challengeRef);
    if (!challengeSnapshot.exists) throw new HttpsError("not-found", "Challenge not found.");

    const challenge = challengeSnapshot.data() as ChallengeDocument;
    if (challenge.challengedPlayerId !== actor.playerId) {
      throw new HttpsError("permission-denied", "Only the challenged player can answer this challenge.");
    }
    if (!challenge.seasonId || !challenge.challengerPlayerId || !challenge.challengedPlayerId) {
      throw new HttpsError("failed-precondition", "Challenge data is incomplete.");
    }

    const desiredStatus = response === "ACCEPT" ? "ACCEPTED" : "DECLINED";
    if (challenge.status === desiredStatus) {
      return {
        alreadyProcessed: true,
        status: desiredStatus,
        matchId: challenge.matchId ?? null,
        challengeRevision: Number(challenge.challengeRevision ?? 1),
      };
    }
    if (challenge.status !== "PENDING") {
      throw new HttpsError("failed-precondition", `Challenge is already ${String(challenge.status ?? "resolved")}.`);
    }

    const seasonRef = db.collection(collections.seasons).doc(challenge.seasonId);
    const seasonSnapshot = await transaction.get(seasonRef);
    if (!seasonSnapshot.exists || seasonSnapshot.data()?.warRoom?.status !== "OPEN") {
      throw new HttpsError("failed-precondition", "The War Room is no longer open.");
    }

    const now = Timestamp.now();
    const challengeRevision = Number(challenge.challengeRevision ?? 1);
    let matchId: string | null = null;

    if (response === "ACCEPT") {
      matchId = `${challengeId}-R${challengeRevision}-M1`;
      const matchRef = db.collection(collections.matches).doc(matchId);
      const gameRef = matchRef.collection("games").doc("G1");
      const [existingMatchSnapshot, challengerSnapshot] = await Promise.all([
        transaction.get(matchRef),
        transaction.get(db.collection(collections.players).doc(challenge.challengerPlayerId)),
      ]);
      if (!challengerSnapshot.exists || challengerSnapshot.data()?.membershipStatus !== "ACTIVE") {
        throw new HttpsError("failed-precondition", "The challenger is no longer an active League member.");
      }

      const participants = [
        { playerId: challenge.challengerPlayerId, team: 1, slot: 1 },
        { playerId: challenge.challengedPlayerId, team: 2, slot: 2 },
      ];
      const gameConfig = defaultWarRoomGameConfig();

      if (!existingMatchSnapshot.exists) {
        transaction.create(matchRef, {
          seasonId: challenge.seasonId,
          eventId: null,
          challengeId,
          sourceRivalryId: challenge.sourceRivalryId ?? challenge.pairId ?? null,
          context: {
            type: "WAR_ROOM",
            affectsLeaguePoints: false,
            affectsWarRoomPoints: true,
            affectsGold: false,
            affectsSeasonStats: true,
            affectsLifetimeStats: true,
            affectsPowerRating: true,
          },
          format: "ONE_V_ONE",
          teamSizes: [1, 1],
          participants,
          balanceEstimate: null,
          status: "READY",
          seriesRule: {
            maxGames: 1,
            gamesRequiredToWin: 1,
          },
          gameConfigSnapshot: gameConfig,
          scoringSnapshot: {
            profileId: WAR_ROOM_SCORING_VERSION,
            profileVersion: 1,
            rules: {
              warRoomMatchCompletionPoints: WAR_ROOM_MATCH_COMPLETION_POINTS,
              warRoomMatchWinPoints: WAR_ROOM_MATCH_WIN_POINTS,
            },
          },
          goldRewardSnapshot: {
            attendance: 0,
            matchCompletion: 0,
            matchWin: 0,
            additionalRewards: {},
          },
          canonicalResult: null,
          createdBy: actor.playerId,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        });

        transaction.create(gameRef, {
          gameNumber: 1,
          status: "READY",
          players: participants.map((participant) => ({
            ...participant,
            color: null,
            civilization: null,
            civilizationSelection: "UNKNOWN",
            position: null,
          })),
          gameConfigSnapshot: gameConfig,
          replay: null,
          canonicalResult: null,
          startedAt: null,
          completedAt: null,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    transaction.update(challengeRef, {
      status: desiredStatus,
      matchId,
      respondedAt: now,
      respondedBy: actor.playerId,
      updatedAt: now,
    });

    const activityRef = db.collection(collections.activity)
      .doc(`WAR_ROOM_CHALLENGE_RESPONSE_${challengeId}_R${challengeRevision}`);
    transaction.set(activityRef, {
      schemaVersion: "WAR_ROOM_ACTIVITY_V1",
      type: response === "ACCEPT" ? "WAR_ROOM_CHALLENGE_ACCEPTED" : "WAR_ROOM_CHALLENGE_DECLINED",
      challengeId,
      challengeRevision,
      seasonId: challenge.seasonId,
      pairId: challenge.pairId ?? null,
      matchId,
      playerIds: [challenge.challengerPlayerId, challenge.challengedPlayerId],
      challengerPlayerId: challenge.challengerPlayerId,
      challengedPlayerId: challenge.challengedPlayerId,
      occurredAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return {
      alreadyProcessed: false,
      status: desiredStatus,
      matchId,
      challengeRevision,
    };
  });

  return {
    success: true,
    challengeId,
    response,
    ...result,
    scoring: result.status === "ACCEPTED" ? {
      version: WAR_ROOM_SCORING_VERSION,
      matchCompletionPoints: WAR_ROOM_MATCH_COMPLETION_POINTS,
      matchWinPoints: WAR_ROOM_MATCH_WIN_POINTS,
    } : null,
  };
});
