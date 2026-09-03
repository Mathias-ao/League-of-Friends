import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import { callableOptions } from "../../config/runtime.js";
import { collections, leagueStateDocumentId } from "../../domain/collections.js";
import {
  REPLAY_ANALYSIS_VERSION,
  validateReplayAnalysisConfig,
  type ReplayAnalysisConfig,
} from "../../engines/replayAnalysis.js";
import { writeAdminAudit } from "../../services/audit.js";
import { reserveIdempotencyKey } from "../../services/idempotency.js";

interface SetReplayAnalysisConfigInput {
  requestId: string;
  name: string;
  config: ReplayAnalysisConfig;
}

export const adminSetReplayAnalysisConfig = onCall<SetReplayAnalysisConfigInput>(callableOptions, async (request) => {
  const actor = await requireAdmin(request);
  const name = request.data.name?.trim();
  if (!name || name.length > 100) {
    throw new HttpsError("invalid-argument", "Profile name must contain 1–100 characters.");
  }

  let config: ReplayAnalysisConfig;
  try {
    config = validateReplayAnalysisConfig(request.data.config);
  } catch (error) {
    throw new HttpsError(
      "invalid-argument",
      error instanceof Error ? error.message : "Replay analysis configuration is invalid.",
    );
  }

  const leagueStateRef = db.collection(collections.leagueState).doc(leagueStateDocumentId);
  const profileRef = db.collection(collections.replayAnalysisProfiles).doc();

  const result = await db.runTransaction(async (transaction) => {
    const leagueStateSnapshot = await transaction.get(leagueStateRef);
    const leagueState = leagueStateSnapshot.exists ? leagueStateSnapshot.data() : {};
    const previousProfileId = typeof leagueState?.replayAnalysisProfileId === "string"
      ? leagueState.replayAnalysisProfileId
      : null;
    const previousVersion = Number(leagueState?.replayAnalysisProfileVersion ?? 0);
    const profileVersion = previousVersion + 1;

    await reserveIdempotencyKey(
      transaction,
      request.data.requestId,
      "adminSetReplayAnalysisConfig",
      actor.authUid,
    );

    const now = Timestamp.now();
    const profile = {
      name,
      profileVersion,
      analysisVersion: REPLAY_ANALYSIS_VERSION,
      config,
      supersedesProfileId: previousProfileId,
      createdBy: actor.playerId,
      createdAt: now,
    };

    transaction.create(profileRef, profile);
    transaction.set(
      leagueStateRef,
      {
        replayAnalysisProfileId: profileRef.id,
        replayAnalysisProfileVersion: profileVersion,
        replayAnalysisProfileChangedAt: now,
        updatedAt: now,
      },
      { merge: true },
    );

    writeAdminAudit(transaction, {
      actorUid: actor.authUid,
      actorPlayerId: actor.playerId,
      action: "REPLAY_ANALYSIS_PROFILE_ACTIVATED",
      targetType: "REPLAY_ANALYSIS_PROFILE",
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
    analysisVersion: REPLAY_ANALYSIS_VERSION,
    config,
  };
});
