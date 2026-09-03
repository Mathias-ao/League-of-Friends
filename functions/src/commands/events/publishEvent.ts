import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import { callableOptions } from "../../config/runtime.js";
import { collections, leagueStateDocumentId } from "../../domain/collections.js";
import { writeAdminAudit } from "../../services/audit.js";
import { reserveIdempotencyKey } from "../../services/idempotency.js";

interface PublishEventInput {
  requestId: string;
  eventId: string;
  featured?: boolean;
}

export const adminPublishEvent = onCall<PublishEventInput>(callableOptions, async (request) => {
  const actor = await requireAdmin(request);
  const { requestId, eventId } = request.data;
  const featured = request.data.featured ?? false;

  if (!eventId) {
    throw new HttpsError("invalid-argument", "eventId is required.");
  }

  const eventRef = db.collection(collections.events).doc(eventId);
  const leagueStateRef = db.collection(collections.leagueState).doc(leagueStateDocumentId);

  await db.runTransaction(async (transaction) => {
    const [eventSnapshot, leagueStateSnapshot] = await Promise.all([
      transaction.get(eventRef),
      transaction.get(leagueStateRef),
    ]);

    if (!eventSnapshot.exists) {
      throw new HttpsError("not-found", "Event not found.");
    }

    const event = eventSnapshot.data() as Record<string, unknown>;
    if (event.status !== "DRAFT") {
      throw new HttpsError("failed-precondition", "Only a draft Event can be published.");
    }

    if (!leagueStateSnapshot.exists) {
      throw new HttpsError("failed-precondition", "League state has not been initialized.");
    }

    const leagueState = leagueStateSnapshot.data() as { activeSeasonId?: string | null };
    if (!leagueState.activeSeasonId || leagueState.activeSeasonId !== event.seasonId) {
      throw new HttpsError("failed-precondition", "Event must belong to the active Season.");
    }

    await reserveIdempotencyKey(
      transaction,
      requestId,
      "adminPublishEvent",
      actor.authUid,
    );

    const now = Timestamp.now();
    transaction.update(eventRef, {
      status: "PUBLISHED",
      featured,
      publishedAt: now,
      updatedAt: now,
    });

    if (featured) {
      transaction.set(
        leagueStateRef,
        {
          featuredEventId: eventId,
          updatedAt: now,
        },
        { merge: true },
      );
    }

    writeAdminAudit(transaction, {
      actorUid: actor.authUid,
      actorPlayerId: actor.playerId,
      action: "EVENT_PUBLISHED",
      targetType: "EVENT",
      targetId: eventId,
      before: event,
      after: { ...event, status: "PUBLISHED", featured, publishedAt: now, updatedAt: now },
    });
  });

  return { success: true, eventId, status: "PUBLISHED", featured };
});
