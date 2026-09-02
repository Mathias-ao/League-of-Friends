import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import { collections } from "../../domain/collections.js";
import type { MembershipStatus } from "../../domain/types.js";
import { writeAdminAudit } from "../../services/audit.js";
import { reserveIdempotencyKey } from "../../services/idempotency.js";

interface SetMembershipStatusInput {
  requestId: string;
  playerId: string;
  status: MembershipStatus;
  reason?: string | null;
}

const allowedStatuses: MembershipStatus[] = ["ACTIVE", "INACTIVE", "SUSPENDED"];

export const adminSetMembershipStatus = onCall<SetMembershipStatusInput>(async (request) => {
  const actor = await requireAdmin(request);
  const { requestId, playerId, status } = request.data;
  const reason = request.data.reason?.trim() || null;

  if (!playerId) {
    throw new HttpsError("invalid-argument", "playerId is required.");
  }
  if (!allowedStatuses.includes(status)) {
    throw new HttpsError("invalid-argument", "Unsupported membership status.");
  }
  if (status === "SUSPENDED" && !reason) {
    throw new HttpsError("invalid-argument", "Suspension requires a reason.");
  }

  const playerRef = db.collection(collections.players).doc(playerId);

  await db.runTransaction(async (transaction) => {
    const playerSnapshot = await transaction.get(playerRef);
    if (!playerSnapshot.exists) {
      throw new HttpsError("not-found", "Player not found.");
    }

    await reserveIdempotencyKey(
      transaction,
      requestId,
      "adminSetMembershipStatus",
      actor.authUid,
    );

    const before = playerSnapshot.data() as Record<string, unknown>;
    const now = Timestamp.now();
    const patch: Record<string, unknown> = {
      membershipStatus: status,
      updatedAt: now,
    };

    if (status === "ACTIVE" && before.joinedAt == null) {
      patch.joinedAt = now;
    }

    transaction.update(playerRef, patch);

    writeAdminAudit(transaction, {
      actorUid: actor.authUid,
      actorPlayerId: actor.playerId,
      action: "PLAYER_MEMBERSHIP_STATUS_CHANGED",
      targetType: "PLAYER",
      targetId: playerId,
      reason,
      before,
      after: { ...before, ...patch },
    });
  });

  return { success: true, playerId, membershipStatus: status };
});
