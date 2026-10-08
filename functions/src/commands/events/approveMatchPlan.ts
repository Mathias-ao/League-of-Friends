import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import { callableOptions } from "../../config/runtime.js";
import { collections, leagueStateDocumentId } from "../../domain/collections.js";
import type {
  CompetitionStyle,
  GameConfiguration,
  GoldRewardConfig,
  ProposedMatch,
  ScoringSnapshot,
} from "../../domain/types.js";
import {
  CivilizationDraftValidationError,
  createCivilizationDraft,
} from "../../engines/civilizationDraftEngine.js";
import {seasonScoringSnapshot,validateSeasonScoringRules,assertSeasonMatchRules,assertScoringRoster,scoringSlotId} from "../../engines/seasonPoints.js";
import { writeAdminAudit } from "../../services/audit.js";
import { reserveIdempotencyKey } from "../../services/idempotency.js";

interface ApproveMatchPlanInput {
  requestId: string;
  eventId: string;
  planId: string;
}

interface EventForApproval {
  startsAt?:Timestamp;checkInClosesAt?:Timestamp;checkInOpensAt?:Timestamp;
  seasonId?: string;
  status?: string;
  currentMatchPlanId?: string | null;
  gameConfig?: GameConfiguration;
  scoringSnapshot?: ScoringSnapshot;
  goldRewardSnapshot?: GoldRewardConfig;
  replayParticipantBindings?: Array<{sourceName:string;sourceNameNormalized:string;playerId:string}>;
}

interface MatchPlanForApproval {
  forced?:boolean;forceReason?:string;plannerVersion?:string;eligiblePlayerIds?:string[];
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
    const [eventSnapshot, planSnapshot, leagueSnapshot] = await Promise.all([
      transaction.get(eventRef),
      transaction.get(planRef),
      transaction.get(db.collection(collections.leagueState).doc(leagueStateDocumentId)),
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

    if(['MATCH_PLANNER_V2','MATCH_PLANNER_V3'].includes(plan.plannerVersion??'')){
        const attendance=await transaction.get(eventRef.collection('participants'));
      const missing=attendance.docs.some(d=>d.data().rsvp==='YES'&&d.data().signupState==='CONFIRMED'&&!['CHECKED_IN','LATE_ADDED','NO_SHOW'].includes(d.data().attendanceStatus));
      if(missing&&!(plan.plannerVersion==='MATCH_PLANNER_V3'&&plan.forced&&plan.forceReason))throw new HttpsError('failed-precondition','Complete check-in before approving teams.');
      const current=attendance.docs.filter(d=>d.data().rsvp==='YES'&&d.data().signupState==='CONFIRMED'&&['CHECKED_IN','LATE_ADDED'].includes(d.data().attendanceStatus)).map(d=>d.id).sort();
      if(JSON.stringify(current)!==JSON.stringify([...(plan.eligiblePlayerIds??[])].sort()))throw new HttpsError('failed-precondition','Attendance changed; generate and review a new Match plan.');
    }
    let seasonRules;
    try {seasonRules=validateSeasonScoringRules(event.scoringSnapshot.rules);}
    catch(error){throw new HttpsError("failed-precondition",(error as Error).message);}
    const slots=seasonRules ? plan.matches.flatMap(proposed=>proposed.participants.map(p=>({
      ref:eventRef.collection("scoringSlots").doc(scoringSlotId("MAIN",p.playerId)),playerId:p.playerId,
    }))):[];
    if(new Set(slots.map(slot=>slot.playerId)).size!==slots.length) {
      throw new HttpsError("failed-precondition","A player may have only one main scoring Match per Event.");
    }
    const slotSnapshots=await Promise.all(slots.map(slot=>transaction.get(slot.ref)));
    if(slotSnapshots.some(snapshot=>snapshot.exists))throw new HttpsError("failed-precondition","A main scoring slot is already reserved; keep the existing designated Match.");
    const emperorSnapshot=await transaction.get(db.collection(collections.players));
    const emperorPlayerId=leagueSnapshot.data()?.currentEmperorPlayerId ??
      emperorSnapshot.docs.find(document=>document.data().role==="ADMIN"&&document.data().membershipStatus==="ACTIVE")?.id ?? null;
    const pinnedScoring=seasonRules ? seasonScoringSnapshot({...seasonRules,act:"MAIN",emperorPlayerId}):event.scoringSnapshot;
    if(seasonRules) {
      try{for(const proposed of plan.matches) {
        assertScoringRoster(proposed.participants);
        assertSeasonMatchRules(seasonRules,proposed.format);
      }}catch(error){throw new HttpsError("failed-precondition",(error as Error).message);}
    }

    await reserveIdempotencyKey(
      transaction,
      requestId,
      "adminApproveMatchPlan",
      actor.authUid,
    );

    const now = Timestamp.now();
    const officialMatchIds: string[] = [];
    const gameConfig = event.gameConfig;
    const scoringSnapshot = pinnedScoring;
    const goldRewardSnapshot = event.goldRewardSnapshot;

    plan.matches.forEach((proposedMatch, index) => {
      const matchNumber = index + 1;
      const matchId = `${planId}-M${matchNumber}`;
      const matchRef = db.collection(collections.matches).doc(matchId);
      const gameRef = matchRef.collection("games").doc("G1");
      const draftRef = matchRef.collection("civilizationDrafts").doc("G1");

      let civilizationDraft = null;
      if (gameConfig.civilizations.mode === "DRAFT") {
        try {
          civilizationDraft = createCivilizationDraft({
            matchId,
            gameId: "G1",
            gameNumber: 1,
            participants: proposedMatch.participants,
            civilizationConfiguration: gameConfig.civilizations,
          });
        } catch (error) {
          if (error instanceof CivilizationDraftValidationError) {
            throw new HttpsError(
              "failed-precondition",
              `Match ${matchNumber} civilization draft is invalid: ${error.message}`,
            );
          }
          throw error;
        }
      }

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
          affectsPowerRating:true,
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
        gameConfigSnapshot: gameConfig,
        scoringSnapshot,
        goldRewardSnapshot,
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
        gameConfigSnapshot: gameConfig,
        civilizationDraftId: civilizationDraft ? "G1" : null,
        civilizationDraftStatus: civilizationDraft?.status ?? null,
        replayParticipantBindings: (event.replayParticipantBindings ?? []).filter((binding) => proposedMatch.participants.some((participant) => participant.playerId === binding.playerId)),
        replay: null,
        canonicalResult: null,
        startedAt: null,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      };

      if(seasonRules)for(const participant of proposedMatch.participants) {
        transaction.create(eventRef.collection("scoringSlots").doc(scoringSlotId("MAIN",participant.playerId)),{
          playerId:participant.playerId,act:"MAIN",matchId,seasonId:event.seasonId,createdAt:now,
        });
      }
      transaction.create(matchRef, matchDocument);
      transaction.create(gameRef, gameDocument);
      if (civilizationDraft) {
        transaction.create(draftRef, {
          matchId,
          gameId: "G1",
          participantIds: proposedMatch.participants.map((participant) => participant.playerId),
          ...civilizationDraft,
          createdBy: actor.playerId,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        });
      }
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
