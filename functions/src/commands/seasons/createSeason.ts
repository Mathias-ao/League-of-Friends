import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import { collections } from "../../domain/collections.js";
import { writeAdminAudit } from "../../services/audit.js";
import { reserveIdempotencyKey } from "../../services/idempotency.js";

interface CreateSeasonInput {
  requestId: string;
  name: string;
  startsAt: string;
  endsAt: string;
}

function parseDate(value: string, fieldName: string): Date {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) {
    throw new HttpsError("invalid-argument", `${fieldName} must be a valid ISO date/time.`);
  }
  return date;
}

export const adminCreateSeason = onCall<CreateSeasonInput>(async (request) => {
  const actor = await requireAdmin(request);
  const input = request.data;

  const name = input.name?.trim();
  if (!name || name.length > 100) {
    throw new HttpsError("invalid-argument", "Season name must contain 1–100 characters.");
  }

  const startsAt = parseDate(input.startsAt, "startsAt");
  const endsAt = parseDate(input.endsAt, "endsAt");
  if (startsAt >= endsAt) {
    throw new HttpsError("invalid-argument", "Season end must be after its start.");
  }

  const seasonRef = db.collection(collections.seasons).doc();

  await db.runTransaction(async (transaction) => {
    await reserveIdempotencyKey(
      transaction,
      input.requestId,
      "adminCreateSeason",
      actor.authUid,
    );

    // This league is intentionally small and permits no overlapping seasons.
    // Reading the season collection keeps this invariant straightforward and
    // avoids prematurely optimizing around a large multi-league workload.
    const seasonsSnapshot = await transaction.get(db.collection(collections.seasons));

    const overlapping = seasonsSnapshot.docs.some((document) => {
      const season = document.data() as {
        status?: string;
        startsAt?: Timestamp;
        endsAt?: Timestamp;
      };

      if (season.status === "ARCHIVED") {
        // Archived seasons still occupy their historical date range.
      }

      if (!(season.startsAt instanceof Timestamp) || !(season.endsAt instanceof Timestamp)) {
        return false;
      }

      return season.startsAt.toDate() < endsAt && season.endsAt.toDate() > startsAt;
    });

    if (overlapping) {
      throw new HttpsError("failed-precondition", "Season dates overlap an existing season.");
    }

    const now = Timestamp.now();
    const season = {
      name,
      status: "DRAFT" as const,
      startsAt: Timestamp.fromDate(startsAt),
      endsAt: Timestamp.fromDate(endsAt),
      scoringDefaults: {
        profileId: null,
        profileVersion: 1,
        rules: {},
      },
      championshipConfig: {
        version: 1,
        regularSeasonWeight: 0.4,
        finalsWeight: 0.6,
        tiebreakerMethod: "MATCH",
      },
      finalSnapshot: null,
      createdBy: actor.playerId,
      createdAt: now,
      updatedAt: now,
    };

    transaction.create(seasonRef, season);
    writeAdminAudit(transaction, {
      actorUid: actor.authUid,
      actorPlayerId: actor.playerId,
      action: "SEASON_CREATED",
      targetType: "SEASON",
      targetId: seasonRef.id,
      after: season,
    });
  });

  return {
    success: true,
    seasonId: seasonRef.id,
    status: "DRAFT",
  };
});
