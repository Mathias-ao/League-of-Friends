import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import { callableOptions } from "../../config/runtime.js";
import { collections } from "../../domain/collections.js";
import type {
  CompetitionStyle,
  GameConfiguration,
  GoldRewardConfig,
  ProposedMatch,
  ScoringSnapshot,
} from "../../domain/types.js";
import { writeAdminAudit } from "../../services/audit.js";
import { reserveIdempotencyKey } from "../../services/idempotency.js";

interface ApproveMatchPlanInput {
  requestId: string;
  eventId: string;
  planId: string;
}

interface EventForApproval {
  seasonId?: string;
  status?: string;
  currentMatchPlanId?: string | null;
  gameConfig?: GameConfiguration;
  scoringSnapshot?: ScoringSnapshot;
  goldRewardSnapshot?: GoldRewardConfig;
}

interface MatchPlanForApproval {
  status?: string;
  competitionStyle?: CompetitionStyle;
  matches?: ProposedMatch[];
  officialMatchIds?: string[];
}

export const adminApproveMatchPlan = onCall<ApproveMatchPlanInput>(callableOptions, async (request) => {
  const actor = await requireAdmin(request);
  const { requestId, eventId, planId } = request.data;

  if (!eventId || !planId) {
    throw new HttpsError("invalid-argument", "eventId and planId are required.");
  }

  const eventRef = db.collection(collections.events).doc(eventId);
  const planRef = eventRef.collection("matchPlans").doc(planId);

  const transactionResult = await db.runTransaction(async (transaction) => {
    const [eventSnapshot, planSnapshot] = await Promise.all([
      transaction.get(eventRef),
      transaction.get(planRef),
    ]);

    if (!eventSnapshot.exists) {
      throw new HttpsError("not-found", "Event not found.");
    }
    if (!planSnapshot.exists) {
      throw new HttpsError("not-found", "Match Plan not found.");
    }

    const event = eventSnapshot.data() as EventForApproval;
    const plan = planSnapshot.data() as MatchPlanForApproval;

    if (plan.status === "APPROVED" && Array.isArray(plan.officialMatchIds)) {
      return {
        officialMatchIds: plan.officialMatchIds,
        alreadyApproved: true,
      };
    }

    if (event.status !== "PUBLISHED" && event.status !== "ACTIVE") {
      throw new HttpsError("failed-precondition", "Only published or active Events can approve a Match Plan.");
    }
    if (event.currentMatchPlanId !== planId) {
      throw new HttpsError("failed-precondition", "Only the Event's current Match Plan can be approved.");
    }
    if (plan.status !== "PROPOSED") {
      throw new HttpsError("failed-precondition", "Only a proposed Match Plan can be approved.");
    }
    if (!event.seasonId) {
      throw new HttpsError("failed-precondition", "Event is missing its Season reference.");
    }
    if (!event.gameConfig || !event.scoringSnapshot || !event.goldRewardSnapshot) {
      throw new HttpsError("failed-precondition", "Event competition snapshots are incomplete.");
    }
    if (!Array.isArray(plan.matches) || plan.matches.length === 0) {
      throw new HttpsError("failed-precondition", "Match Plan contains no proposed Matches.");
    }

    await reserveIdempotencyKey(
      transaction,
      requestId,
      "adminApproveMatchPlan",
      actor.authUid,
    );

    const now = Timestamp.now();
    const officialMatchIds: string[] = [];

    plan.matches.forEach((proposedMatch, index) => {
      const matchNumber = index + 1;
      const matchId = `${planId}-M${matchNumber}`;
      const matchRef = db.collection(collections.matches).doc(matchId);
      const gameRef = matchRef.collection("games").doc("G1");

      const matchDocument = {
        seasonId: event.seasonId,
        eventId,
        sourceMatchPlanId: planId,
        matchNumber,
        context: {
          type: "SEASON_EVENT" as const,
          affectsLeaguePoints: true,
          affectsWarRoomPoints: false,
          affectsGold: true,
          affectsSeasonStats: true,
          affectsLifetimeStats: true,
          affectsPowerRating: true,
        },
        format: proposedMatch.format,
        teamSizes: proposedMatch.teamSizes ?? null,
        participants: proposedMatch.participants,
        balanceEstimate: proposedMatch.balanceEstimate ?? null,
        status: "READY" as const,
        seriesRule: {
          maxGames: 1,
          gamesRequiredToWin: 1,
        },
        gameConfigSnapshot: event.gameConfig,
        scoringSnapshot: event.scoringSnapshot,
        goldRewardSnapshot: event.goldRewardSnapshot,
        canonicalResult: null,
        createdBy: actor.playerId,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      };

      const gamePlayers = proposedMatch.participants.map((participant) => ({
        ...participant,
        color: null,
        civilization: null,
        civilizationSelection: "UNKNOWN" as const,
        position: null,
      }));

      const gameDocument = {
        gameNumber: 1,
        status: "READY" as const,
        players: gamePlayers,
        gameConfigSnapshot: event.gameConfig,
        replay: null,
        canonicalResult: null,
        startedAt: null,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      };

      transaction.create(matchRef, matchDocument);
      transaction.create(gameRef, gameDocument);
      officialMatchIds.push(matchId);
    });

    transaction.update(planRef, {
      status: "APPROVED",
      officialMatchIds,
      approvedBy: actor.playerId,
      approvedAt: now,
      updatedAt: now,
    });

    transaction.update(eventRef, {
      matchPlanStatus: "APPROVED",
      approvedMatchPlanId: planId,
      officialMatchIds,
      matchPlanApprovedAt: now,
      updatedAt: now,
    });

    writeAdminAudit(transaction, {
      actorUid: actor.authUid,
      actorPlayerId: actor.playerId,
      action: "EVENT_MATCH_PLAN_APPROVED",
      targetType: "EVENT_MATCH_PLAN",
      targetId: planId,
      after: {
        eventId,
        officialMatchIds,
        plannedMatchCount: plan.matches.length,
      },
    });

    return {
      officialMatchIds,
      alreadyApproved: false,
    };
  });

  return {
    success: true,
    eventId,
    planId,
    status: "APPROVED",
    ...transactionResult,
  };
});
