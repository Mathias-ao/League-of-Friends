import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireLeaguePlayer } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import { callableOptions } from "../../config/runtime.js";
import { collections, leagueStateDocumentId } from "../../domain/collections.js";
import { rivalryPairId } from "../../engines/rivalryEngine.js";
import { reserveIdempotencyKey } from "../../services/idempotency.js";

interface CreateWarRoomChallengeInput {
  requestId: string;
  challengedPlayerId: string;
}

interface SeasonDocument {
  warRoom?: { status?: string } | null;
}

interface RivalryDocument {
  playerOneId?: string;
  playerTwoId?: string;
  status?: string;
}

interface ExistingChallenge {
  challengeRevision?: number;
  status?: string;
  challengerPlayerId?: string;
  challengedPlayerId?: string;
  createdAt?: Timestamp | null;
}

export const createWarRoomChallenge = onCall<CreateWarRoomChallengeInput>(callableOptions, async (request) => {
  const actor = await requireLeaguePlayer(request);
  const challengedPlayerId = request.data.challengedPlayerId?.trim();
  if (!request.data.requestId || !challengedPlayerId) {
    throw new HttpsError("invalid-argument", "requestId and challengedPlayerId are required.");
  }
  if (challengedPlayerId === actor.playerId) {
    throw new HttpsError("invalid-argument", "You cannot challenge yourself.");
  }

  const leagueStateRef = db.collection(collections.leagueState).doc(leagueStateDocumentId);
  const leagueStateSnapshot = await leagueStateRef.get();
  const activeSeasonId = leagueStateSnapshot.exists && typeof leagueStateSnapshot.data()?.activeSeasonId === "string"
    ? leagueStateSnapshot.data()!.activeSeasonId as string
    : null;
  if (!activeSeasonId) throw new HttpsError("failed-precondition", "There is no active Season.");

  const pairId = rivalryPairId(actor.playerId, challengedPlayerId);
  const challengeId = `WAR_${activeSeasonId}_${pairId}`;
  const seasonRef = db.collection(collections.seasons).doc(activeSeasonId);
  const rivalryRef = seasonRef.collection("rivalries").doc(pairId);
  const challengedPlayerRef = db.collection(collections.players).doc(challengedPlayerId);
  const challengeRef = db.collection(collections.challenges).doc(challengeId);

  const result = await db.runTransaction(async (transaction) => {
    const [seasonSnapshot, rivalrySnapshot, challengedPlayerSnapshot, existingChallengeSnapshot] = await Promise.all([
      transaction.get(seasonRef),
      transaction.get(rivalryRef),
      transaction.get(challengedPlayerRef),
      transaction.get(challengeRef),
    ]);

    if (!seasonSnapshot.exists || (seasonSnapshot.data() as SeasonDocument).warRoom?.status !== "OPEN") {
      throw new HttpsError("failed-precondition", "The War Room is not open.");
    }
    if (!challengedPlayerSnapshot.exists || challengedPlayerSnapshot.data()?.membershipStatus !== "ACTIVE") {
      throw new HttpsError("not-found", "The challenged player is not an active League member.");
    }
    if (!rivalrySnapshot.exists) {
      throw new HttpsError("failed-precondition", "You can only challenge a detected rival.");
    }
    const rivalry = rivalrySnapshot.data() as RivalryDocument;
    if (rivalry.status !== "QUALIFIED") {
      throw new HttpsError("failed-precondition", "This rivalry has not qualified for a War Room duel.");
    }
    const rivalryPlayers = new Set([rivalry.playerOneId, rivalry.playerTwoId]);
    if (!rivalryPlayers.has(actor.playerId) || !rivalryPlayers.has(challengedPlayerId)) {
      throw new HttpsError("failed-precondition", "The selected player is not your qualified rival.");
    }

    const existing = existingChallengeSnapshot.exists
      ? existingChallengeSnapshot.data() as ExistingChallenge
      : null;
    if (existing?.status === "PENDING") {
      throw new HttpsError("already-exists", "A challenge between these rivals is already awaiting a response.");
    }
    if (existing?.status === "ACCEPTED") {
      throw new HttpsError("failed-precondition", "These rivals already have an accepted duel to play.");
    }

    await reserveIdempotencyKey(transaction, request.data.requestId, "createWarRoomChallenge", actor.authUid);

    const now = Timestamp.now();
    const challengeRevision = Number(existing?.challengeRevision ?? 0) + 1;
    if (existingChallengeSnapshot.exists) {
      transaction.set(
        challengeRef.collection("history").doc(`R${Number(existing?.challengeRevision ?? 1)}`),
        {
          ...existingChallengeSnapshot.data(),
          archivedAt: now,
        },
        { merge: false },
      );
    }

    transaction.set(challengeRef, {
      challengeRevision,
      seasonId: activeSeasonId,
      pairId,
      sourceRivalryId: pairId,
      challengerPlayerId: actor.playerId,
      challengedPlayerId,
      status: "PENDING",
      matchId: null,
      firstCreatedAt: existing?.createdAt ?? now,
      createdAt: now,
      respondedAt: null,
      completedAt: null,
      updatedAt: now,
    }, { merge: false });

    const activityRef = db.collection(collections.activity)
      .doc(`WAR_ROOM_CHALLENGE_${challengeId}_R${challengeRevision}`);
    transaction.set(activityRef, {
      schemaVersion: "WAR_ROOM_ACTIVITY_V1",
      type: "WAR_ROOM_CHALLENGE",
      challengeId,
      challengeRevision,
      seasonId: activeSeasonId,
      pairId,
      playerIds: [actor.playerId, challengedPlayerId],
      challengerPlayerId: actor.playerId,
      challengedPlayerId,
      occurredAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return { challengeRevision };
  });

  return {
    success: true,
    challengeId,
    challengeRevision: result.challengeRevision,
    seasonId: activeSeasonId,
    pairId,
    challengerPlayerId: actor.playerId,
    challengedPlayerId,
    status: "PENDING",
  };
});
