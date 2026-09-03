import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import { callableOptions } from "../../config/runtime.js";
import { collections } from "../../domain/collections.js";
import type { CompetitionStyle, MatchPlanningConfig } from "../../domain/types.js";
import { generateMatchPlan, type PlannerPlayer } from "../../engines/matchPlanner.js";
import { writeAdminAudit } from "../../services/audit.js";
import { reserveIdempotencyKey } from "../../services/idempotency.js";

interface GenerateMatchPlanInput {
  requestId: string;
  eventId: string;
}

interface EventForPlanning {
  status?: string;
  competitionStyle?: CompetitionStyle;
  planningConfig?: MatchPlanningConfig;
  minParticipants?: number | null;
}

interface EventParticipantForPlanning {
  attendanceStatus?: string;
}

function countFormats(matches: Array<{ format: string }>): Record<string, number> {
  return matches.reduce<Record<string, number>>((counts, match) => {
    counts[match.format] = (counts[match.format] ?? 0) + 1;
    return counts;
  }, {});
}

export const adminGenerateMatchPlan = onCall<GenerateMatchPlanInput>(callableOptions, async (request) => {
  const actor = await requireAdmin(request);
  const { requestId, eventId } = request.data;

  if (!eventId) {
    throw new HttpsError("invalid-argument", "eventId is required.");
  }

  const eventRef = db.collection(collections.events).doc(eventId);
  const participantsRef = eventRef.collection("participants");
  const matchPlansRef = eventRef.collection("matchPlans");
  const planRef = matchPlansRef.doc();

  let result: {
    planId: string;
    eligiblePlayerIds: string[];
    sittingOutPlayerIds: string[];
    matches: ReturnType<typeof generateMatchPlan>["matches"];
  } | null = null;

  await db.runTransaction(async (transaction) => {
    const [eventSnapshot, participantSnapshot, existingPlansSnapshot] = await Promise.all([
      transaction.get(eventRef),
      transaction.get(participantsRef),
      transaction.get(matchPlansRef),
    ]);

    if (!eventSnapshot.exists) {
      throw new HttpsError("not-found", "Event not found.");
    }

    const event = eventSnapshot.data() as EventForPlanning;
    if (event.status !== "PUBLISHED" && event.status !== "ACTIVE") {
      throw new HttpsError("failed-precondition", "Match Plans can only be generated for published or active Events.");
    }
    if (!event.competitionStyle || !event.planningConfig) {
      throw new HttpsError("failed-precondition", "Event planning configuration is incomplete.");
    }

    const eligiblePlayerIds = participantSnapshot.docs
      .filter((document) => {
        const participant = document.data() as EventParticipantForPlanning;
        return participant.attendanceStatus === "CHECKED_IN" || participant.attendanceStatus === "LATE_ADDED";
      })
      .map((document) => document.id);

    if (eligiblePlayerIds.length < 2) {
      throw new HttpsError("failed-precondition", "At least two checked-in players are required to generate a Match Plan.");
    }
    if (event.minParticipants != null && eligiblePlayerIds.length < event.minParticipants) {
      throw new HttpsError(
        "failed-precondition",
        `Event requires at least ${event.minParticipants} checked-in participants.`,
      );
    }

    const playerSnapshots = await Promise.all(
      eligiblePlayerIds.map((playerId) => transaction.get(db.collection(collections.players).doc(playerId))),
    );

    const plannerPlayers: PlannerPlayer[] = playerSnapshots.map((playerSnapshot, index) => {
      if (!playerSnapshot.exists) {
        throw new HttpsError("failed-precondition", `Checked-in player ${eligiblePlayerIds[index]} no longer exists.`);
      }

      const player = playerSnapshot.data() as { currentPowerRating?: number | null };
      return {
        playerId: playerSnapshot.id,
        powerRating: typeof player.currentPowerRating === "number" ? player.currentPowerRating : null,
      };
    });

    await reserveIdempotencyKey(
      transaction,
      requestId,
      "adminGenerateMatchPlan",
      actor.authUid,
    );

    const plan = generateMatchPlan(
      event.competitionStyle,
      plannerPlayers,
      event.planningConfig,
      requestId,
    );

    if (plan.matches.length === 0) {
      throw new HttpsError("failed-precondition", "The planner could not produce any Matches for the checked-in roster.");
    }

    const now = Timestamp.now();

    for (const existingPlanDocument of existingPlansSnapshot.docs) {
      if (existingPlanDocument.data().status === "PROPOSED") {
        transaction.update(existingPlanDocument.ref, {
          status: "SUPERSEDED",
          supersededAt: now,
          updatedAt: now,
        });
      }
    }

    const planDocument = {
      status: "PROPOSED" as const,
      plannerVersion: "MATCH_PLANNER_V1",
      seed: requestId,
      competitionStyle: event.competitionStyle,
      planningConfig: event.planningConfig,
      eligiblePlayerIds,
      sittingOutPlayerIds: plan.sittingOutPlayerIds,
      matches: plan.matches,
      summary: {
        checkedInPlayers: eligiblePlayerIds.length,
        plannedMatches: plan.matches.length,
        sittingOutPlayers: plan.sittingOutPlayerIds.length,
        formats: countFormats(plan.matches),
      },
      generatedBy: actor.playerId,
      generatedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    transaction.create(planRef, planDocument);
    transaction.update(eventRef, {
      currentMatchPlanId: planRef.id,
      updatedAt: now,
    });

    writeAdminAudit(transaction, {
      actorUid: actor.authUid,
      actorPlayerId: actor.playerId,
      action: "EVENT_MATCH_PLAN_GENERATED",
      targetType: "EVENT_MATCH_PLAN",
      targetId: planRef.id,
      after: {
        eventId,
        ...planDocument,
      },
    });

    result = {
      planId: planRef.id,
      eligiblePlayerIds,
      sittingOutPlayerIds: plan.sittingOutPlayerIds,
      matches: plan.matches,
    };
  });

  if (!result) {
    throw new HttpsError("internal", "Match Plan transaction completed without a result.");
  }

  return {
    success: true,
    eventId,
    status: "PROPOSED",
    ...result,
  };
});
