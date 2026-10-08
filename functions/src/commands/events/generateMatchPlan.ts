import {randomUUID} from "node:crypto";
import {maskUnavailableSeasonAwards,rankSeasonStandings} from '../../engines/seasonPoints.js';
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
  pairingMode?: "RANDOM" | "ELO_BALANCED";
  force?: boolean;
  reason?: string;
}

interface EventForPlanning {
  officialMatchIds?:string[];
  seasonId?:string;
  startsAt?:Timestamp;checkInClosesAt?:Timestamp;checkInOpensAt?:Timestamp;
  status?: string;
  competitionStyle?: CompetitionStyle;
  planningConfig?: MatchPlanningConfig;
  minParticipants?: number | null;
}

interface EventParticipantForPlanning {
  rsvp?:string;signupState?:string;
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
  const { requestId, eventId, pairingMode = "RANDOM", force = false, reason } = request.data;
  if (!["RANDOM", "ELO_BALANCED"].includes(pairingMode) || typeof force !== "boolean" || force && (typeof reason !== "string" || reason.trim().length < 8 || reason.length > 1000)) {
    throw new HttpsError("invalid-argument", "Choose the pairing mode and explain any forced draw.");
  }
  const seed = randomUUID();

  if (!eventId) {
    throw new HttpsError("invalid-argument", "eventId is required.");
  }

  const eventRef = db.collection(collections.events).doc(eventId);
  const participantsRef = eventRef.collection("participants");
  const matchPlansRef = eventRef.collection("matchPlans");
  const planRef = matchPlansRef.doc();

  const transactionResult = await db.runTransaction(async (transaction) => {
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
    if(event.officialMatchIds?.length)throw new HttpsError("failed-precondition","Main Battles are already approved. Use starter corrections or unplayed resolution.");
    if (!event.competitionStyle || !event.planningConfig) {
      throw new HttpsError("failed-precondition", "Event planning configuration is incomplete.");
    }

    const eligiblePlayerIds = participantSnapshot.docs
      .filter((document) => {
        const participant = document.data() as EventParticipantForPlanning;
        return participant.rsvp === 'YES' && participant.signupState === 'CONFIRMED' && ['CHECKED_IN','LATE_ADDED'].includes(participant.attendanceStatus??'');
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

    const missingCheckInPlayerIds=participantSnapshot.docs.filter(d=>d.data().rsvp==='YES'&&d.data().signupState==='CONFIRMED'&&!eligiblePlayerIds.includes(d.id)&&d.data().attendanceStatus!=='NO_SHOW').map(d=>d.id);
    if(!force && missingCheckInPlayerIds.length)throw new HttpsError('failed-precondition','Wait for check-in to finish, or use the Emperor force draw with a reason.');
    const planningConfig={...event.planningConfig,pairingMode};
    const [standings,scoringMatches,ledger]=event.seasonId?await Promise.all([
      transaction.get(db.collection(collections.seasons).doc(event.seasonId).collection('standings')),
      transaction.get(db.collection(collections.matches).where('seasonId','==',event.seasonId)),
      transaction.get(db.collection(collections.leaguePointLedger).where('seasonId','==',event.seasonId)),
    ]):[null,null,null];
    const rows=eligiblePlayerIds.map(playerId=>({playerId,steamName:playerId,leaguePoints:0,...(standings?.docs.find(d=>d.id===playerId)?.data()??{})}));
    const ranked=rankSeasonStandings(maskUnavailableSeasonAwards(rows,scoringMatches?.docs.map(d=>({matchId:d.id,...d.data()}))??[],ledger?.docs.map(d=>d.data())??[]));
    const playerSnapshots = await Promise.all(
      eligiblePlayerIds.map((playerId) => transaction.get(db.collection(collections.players).doc(playerId))),
    );

    const plannerPlayers: PlannerPlayer[] = playerSnapshots.map((playerSnapshot, index) => {
      if (!playerSnapshot.exists) {
        throw new HttpsError("failed-precondition", `Checked-in player ${eligiblePlayerIds[index]} no longer exists.`);
      }

      const player = playerSnapshot.data() as { currentPowerRating?: number | null;membershipStatus?:string };
      if(player.membershipStatus!=='ACTIVE')throw new HttpsError('failed-precondition','Resolve attendance for the inactive player before drawing teams.');
      return {
        playerId: playerSnapshot.id,
        seasonRank:ranked.find(row=>row.playerId===playerSnapshot.id)!.rank,
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
      planningConfig,
      seed,
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
      plannerVersion: "MATCH_PLANNER_V3",
      forced:force,forceReason:force?reason!.trim():null,missingCheckInPlayerIds,
      unevenTeamPolicy:"SEASON_STANDINGS_SMALLER_TEAM_V1",
      standingsSnapshot:ranked,
      seed,
      competitionStyle: event.competitionStyle,
      planningConfig,
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

    return {
      planId: planRef.id,
      eligiblePlayerIds,
      sittingOutPlayerIds: plan.sittingOutPlayerIds,
      matches: plan.matches,
    };
  });

  return {
    success: true,
    eventId,
    status: "PROPOSED",
    ...transactionResult,
  };
});
