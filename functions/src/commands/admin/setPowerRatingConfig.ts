import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import { callableOptions } from "../../config/runtime.js";
import { collections, leagueStateDocumentId } from "../../domain/collections.js";
import {
  POWER_RATING_ALGORITHM,
  POWER_RATING_ENGINE_VERSION,
  validatePowerRatingConfig,
  type PowerRatingConfig,
} from "../../engines/powerRatingEngine.js";
import { writeAdminAudit } from "../../services/audit.js";
import { reserveIdempotencyKey } from "../../services/idempotency.js";

interface SetPowerRatingConfigInput {
  requestId: string;
  name: string;
  config: PowerRatingConfig;
}

export const adminSetPowerRatingConfig = onCall<SetPowerRatingConfigInput>(callableOptions, async (request) => {
  const actor = await requireAdmin(request);
  const name = request.data.name?.trim();

  if (!name || name.length > 100) {
    throw new HttpsError("invalid-argument", "Profile name must contain 1–100 characters.");
  }

  let config: PowerRatingConfig;
  try {
    config = validatePowerRatingConfig(request.data.config);
  } catch (error) {
    throw new HttpsError(
      "invalid-argument",
      error instanceof Error ? error.message : "Power Rating configuration is invalid.",
    );
  }

  const leagueStateRef = db.collection(collections.leagueState).doc(leagueStateDocumentId);
  const profileRef = db.collection(collections.powerRatingProfiles).doc();

  const result = await db.runTransaction(async (transaction) => {
    const leagueStateSnapshot = await transaction.get(leagueStateRef);
    const leagueState = leagueStateSnapshot.exists ? leagueStateSnapshot.data() : {};
    const previousProfileId = typeof leagueState?.powerRatingProfileId === "string"
      ? leagueState.powerRatingProfileId
      : null;
    const previousVersion = Number(leagueState?.powerRatingProfileVersion ?? 0);
    const profileVersion = previousVersion + 1;

    await reserveIdempotencyKey(
      transaction,
      request.data.requestId,
      "adminSetPowerRatingConfig",
      actor.authUid,
    );

    const now = Timestamp.now();
    const profile = {
      name,
      profileVersion,
      algorithm: POWER_RATING_ALGORITHM,
      engineVersion: POWER_RATING_ENGINE_VERSION,
      config,
      supersedesProfileId: previousProfileId,
      createdBy: actor.playerId,
      createdAt: now,
    };

    transaction.create(profileRef, profile);
    transaction.set(
      leagueStateRef,
      {
        powerRatingProfileId: profileRef.id,
        powerRatingProfileVersion: profileVersion,
        powerRatingProfileChangedAt: now,
        updatedAt: now,
      },
      { merge: true },
    );

    writeAdminAudit(transaction, {
      actorUid: actor.authUid,
      actorPlayerId: actor.playerId,
      action: "POWER_RATING_PROFILE_ACTIVATED",
      targetType: "POWER_RATING_PROFILE",
      targetId: profileRef.id,
      before: { profileId: previousProfileId, profileVersion: previousVersion || null },
      after: profile,
    });

    return { profileVersion, previousProfileId };
  });

  return {
    success: true,
    profileId: profileRef.id,
    profileVersion: result.profileVersion,
    previousProfileId: result.previousProfileId,
    engineVersion: POWER_RATING_ENGINE_VERSION,
    config,
  };
});
