import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import { callableOptions } from "../../config/runtime.js";
import { collections } from "../../domain/collections.js";
import {
  ACHIEVEMENT_ENGINE_VERSION,
  validateAchievementDefinition,
  type AchievementMetric,
  type AchievementScope,
  type AchievementStatus,
} from "../../engines/achievementEngine.js";
import { writeAdminAudit } from "../../services/audit.js";
import { reserveIdempotencyKey } from "../../services/idempotency.js";

interface UpsertAchievementDefinitionInput {
  requestId: string;
  achievementId: string;
  name: string;
  description: string;
  status: AchievementStatus;
  scope: AchievementScope;
  rule: {
    metric: AchievementMetric;
    operator: "GTE";
    threshold: number;
  };
}

export const adminUpsertAchievementDefinition = onCall<UpsertAchievementDefinitionInput>(
  callableOptions,
  async (request) => {
    const actor = await requireAdmin(request);
    const achievementId = request.data.achievementId?.trim();
    if (!achievementId) throw new HttpsError("invalid-argument", "achievementId is required.");

    const ref = db.collection(collections.achievementDefinitions).doc(achievementId);

    const result = await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(ref);
      const before = existing.exists ? existing.data() : null;
      const definitionVersion = Number(before?.definitionVersion ?? 0) + 1;

      let definition;
      try {
        definition = validateAchievementDefinition({
          achievementId,
          name: request.data.name,
          description: request.data.description,
          status: request.data.status,
          scope: request.data.scope,
          definitionVersion,
          rule: request.data.rule,
        });
      } catch (error) {
        throw new HttpsError(
          "invalid-argument",
          error instanceof Error ? error.message : "Achievement definition is invalid.",
        );
      }

      await reserveIdempotencyKey(
        transaction,
        request.data.requestId,
        "adminUpsertAchievementDefinition",
        actor.authUid,
      );

      const now = Timestamp.now();
      const document = {
        ...definition,
        engineVersion: ACHIEVEMENT_ENGINE_VERSION,
        updatedBy: actor.playerId,
        updatedAt: now,
        ...(existing.exists ? {} : { createdBy: actor.playerId, createdAt: now }),
      };

      transaction.set(ref, document, { merge: true });
      writeAdminAudit(transaction, {
        actorUid: actor.authUid,
        actorPlayerId: actor.playerId,
        action: existing.exists ? "ACHIEVEMENT_DEFINITION_UPDATED" : "ACHIEVEMENT_DEFINITION_CREATED",
        targetType: "ACHIEVEMENT_DEFINITION",
        targetId: achievementId,
        before,
        after: document,
      });

      return definition;
    });

    return {
      success: true,
      engineVersion: ACHIEVEMENT_ENGINE_VERSION,
      definition: result,
    };
  },
);
