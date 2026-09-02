import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import { collections, leagueStateDocumentId } from "../../domain/collections.js";
import { writeAdminAudit } from "../../services/audit.js";
import { reserveIdempotencyKey } from "../../services/idempotency.js";

interface ActivateSeasonInput {
  requestId: string;
  seasonId: string;
}

export const adminActivateSeason = onCall<ActivateSeasonInput>(async (request) => {
  const actor = await requireAdmin(request);
  const { requestId, seasonId } = request.data;

  if (!seasonId) {
    throw new HttpsError("invalid-argument", "seasonId is required.");
  }

  const seasonRef = db.collection(collections.seasons).doc(seasonId);
  const leagueStateRef = db.collection(collections.leagueState).doc(leagueStateDocumentId);

  await db.runTransaction(async (transaction) => {
    const [seasonSnapshot, leagueStateSnapshot] = await Promise.all([
      transaction.get(seasonRef),
      transaction.get(leagueStateRef),
    ]);

    if (!seasonSnapshot.exists) {
      throw new HttpsError("not-found", "Season not found.");
    }

    const season = seasonSnapshot.data() as Record<string, unknown>;
    if (season.status !== "DRAFT" && season.status !== "UPCOMING") {
      throw new HttpsError("failed-precondition", "Only a draft or upcoming season can be activated.");
    }

    const existingLeagueState = leagueStateSnapshot.exists
      ? (leagueStateSnapshot.data() as Record<string, unknown>)
      : null;
    const activeSeasonId = existingLeagueState?.activeSeasonId ?? null;

    if (activeSeasonId && activeSeasonId !== seasonId) {
      throw new HttpsError("failed-precondition", "Another season is already active.");
    }

    await reserveIdempotencyKey(
      transaction,
      requestId,
      "adminActivateSeason",
      actor.authUid,
    );

    const now = Timestamp.now();
    transaction.update(seasonRef, {
      status: "ACTIVE",
      activatedAt: now,
      updatedAt: now,
    });

    transaction.set(
      leagueStateRef,
      {
        activeSeasonId: seasonId,
        featuredEventId: existingLeagueState?.featuredEventId ?? null,
        currentEmperorPlayerId: existingLeagueState?.currentEmperorPlayerId ?? null,
        warRoom: {
          seasonId,
          status: "CLOSED",
          openedAt: null,
          triggerRef: null,
        },
        updatedAt: now,
      },
      { merge: true },
    );

    writeAdminAudit(transaction, {
      actorUid: actor.authUid,
      actorPlayerId: actor.playerId,
      action: "SEASON_ACTIVATED",
      targetType: "SEASON",
      targetId: seasonId,
      before: season,
      after: { ...season, status: "ACTIVE", activatedAt: now, updatedAt: now },
    });
  });

  return { success: true, seasonId, status: "ACTIVE", warRoomStatus: "CLOSED" };
});
