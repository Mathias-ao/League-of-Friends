import {readEventRoundoff} from "../services/eventRoundoff.js";
import {readEventFinalisation} from '../services/eventFinalisation.js';
import {matchPlayWindow,checkInWindow} from "../services/eventTiming.js";
import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireLeaguePlayer } from "../auth/authorization.js";
import { db } from "../config/firebase.js";
import { callableOptions } from "../config/runtime.js";
import { collections } from "../domain/collections.js";
import type { CanonicalGameResult, MatchParticipant, Player } from "../domain/types.js";
import { iso, playerMap, publicPlayer } from "./querySupport.js";

interface EventDetailInput {
  eventId: string;
}

interface EventDocument {
  currentMatchPlanId?:string;
  timezone?:string;warmupPolicy?:any;warmupSchedule?:any;finalisationRevision?:number;
  seasonId?: string | null;
  title?: string;
  description?: string;
  artworkUrl?: string | null;
  status?: string;
  featured?: boolean;
  startsAt?: Timestamp | null;
  endsAt?: Timestamp | null;
  signupDeadlineAt?: Timestamp | null;
  warmupOpensAt?:Timestamp|null;
  checkInOpensAt?: Timestamp | null;
  checkInClosesAt?: Timestamp | null;
  minParticipants?: number | null;
  maxParticipants?: number | null;
  waitingListEnabled?: boolean;
  signupRosterVisibility?: string;
  competitionStyle?: string;
  officialMatchIds?: string[];
}

interface ParticipantDocument {
  playerId?: string;
  rsvp?: string;
  signupState?: string;
  attendanceStatus?: string;
  respondedAt?: Timestamp | null;
  promotedAt?: Timestamp | null;
}

interface MatchDocument {
  opponentKind?:string;aiOpponent?:any;
  eventId?: string | null;
  matchNumber?: number;
  format?: string;
  scoringSnapshot?:{rules?:Record<string,unknown>};
  teamSizes?: [number, number] | null;
  participants?: MatchParticipant[];
  status?: string;
  playOpensAt?:Timestamp|null;
  playClosesAt?:Timestamp|null;
  canonicalResult?: (Partial<CanonicalGameResult> & Record<string, unknown>) | null;
  completedAt?: Timestamp | null;
  firstCompletedAt?: Timestamp | null;
  processingState?: string | null;
  gameConfigSnapshot?: { civilizations?: { mode?: string } };
}

export const getEventDetail = onCall<EventDetailInput>(callableOptions, async (request) => {
  const actor = await requireLeaguePlayer(request);
  const eventId = request.data.eventId?.trim();
  if (!eventId) throw new HttpsError("invalid-argument", "eventId is required.");

  const eventRef = db.collection(collections.events).doc(eventId);
  const [eventSnapshot, participantsSnapshot, matchesSnapshot, playersSnapshot] = await Promise.all([
    eventRef.get(),
    eventRef.collection("participants").get(),
    db.collection(collections.matches).where("eventId", "==", eventId).get(),
    db.collection(collections.players).get(),
  ]);

  if (!eventSnapshot.exists) throw new HttpsError("not-found", "Event not found.");

  const event = eventSnapshot.data() as EventDocument;
  if(event.status==='DRAFT'&&actor.role!=='ADMIN')throw new HttpsError("permission-denied","This Event has not been announced.");
  const checkIn=checkInWindow(event);
  const [challenges,seasonMembers,slots,guests]=await Promise.all([eventRef.collection('warmupChallenges').get(),event.seasonId?db.collection('seasons').doc(event.seasonId).collection('participants').get():Promise.resolve(null),eventRef.collection('scoringSlots').get(),eventRef.collection('warmupGuests').get()]);
  const finalisation=actor.role==='ADMIN'?await readEventFinalisation(eventRef,event):null;
  const invites=challenges.docs.filter(d=>d.data().guestPlayerId===actor.playerId||d.data().challengerPlayerId===actor.playerId||actor.role==='ADMIN').map(d=>({challengeId:d.id,...d.data(),challengerName:playersSnapshot.docs.find(p=>p.id===d.data().challengerPlayerId)?.data().steamName??d.data().challengerPlayerId,guestName:playersSnapshot.docs.find(p=>p.id===d.data().guestPlayerId)?.data().steamName??d.data().guestPlayerId,deadlineAt:iso(d.data().deadlineAt)}));
  const eligibleGuestIds=event.warmupSchedule?.unpairedPlayerId===actor.playerId&&['GUEST_PENDING','ADMIN_REVIEW'].includes(event.warmupSchedule?.status)?playersSnapshot.docs.filter(d=>d.id!==actor.playerId&&d.data().membershipStatus==='ACTIVE').map(d=>d.id):[];
  const players = playerMap(playersSnapshot);
  const participantDocs = participantsSnapshot.docs.map((document) => ({
    id: document.id,
    data: document.data() as ParticipantDocument,
  }));
  const viewerParticipation = participantDocs.find((participant) => participant.id === actor.playerId)?.data ?? null;

  const confirmed = participantDocs.filter((participant) => (
    participant.data.rsvp === "YES" && participant.data.signupState === "CONFIRMED"
  ));
  const waiting = participantDocs.filter((participant) => (
    participant.data.rsvp === "YES" && participant.data.signupState === "WAITING_LIST"
  ));
  const declined = participantDocs.filter((participant) => participant.data.rsvp === "NO");
  const rosterVisible = event.signupRosterVisibility !== "HIDDEN" || actor.role === "ADMIN";

  const matches = matchesSnapshot.docs
    .map((document) => ({ id: document.id, data: document.data() as MatchDocument }))
    .sort((left, right) => Number(left.data.matchNumber ?? Number.MAX_SAFE_INTEGER) - Number(right.data.matchNumber ?? Number.MAX_SAFE_INTEGER)
      || left.id.localeCompare(right.id))
    .map(({ id: matchId, data: match }) => {
      const window=matchPlayWindow(match,event);
      const participants = Array.isArray(match.participants) ? match.participants : [];
      const result = match.canonicalResult ?? null;
      const winningPlayerIds = Array.isArray(result?.winningPlayerIds) ? result.winningPlayerIds : [];
      return {
        matchId,opponentKind:match.opponentKind??"HUMAN",aiOpponent:match.aiOpponent??null,
        matchNumber: Number(match.matchNumber ?? 0),
        format: match.format ?? null,
        scoringAct:match.scoringSnapshot?.rules?.act??null,
        teamSizes: match.teamSizes ?? null,
        status: match.status ?? "UNKNOWN",
        playOpensAt:iso(window.opensAt),playClosesAt:iso(window.closesAt),
        draftRequired: match.gameConfigSnapshot?.civilizations?.mode === "DRAFT",
        processingState: match.processingState ?? null,
        completedAt: iso(match.completedAt ?? match.firstCompletedAt),
        participants: participants.map((participant) => ({
          ...publicPlayer(participant.playerId, players.get(participant.playerId)),
          team: participant.team,
          slot: participant.slot,
        })),
        result: result ? {
          revision: Number(result.revision ?? 1),
          source: result.source ?? null,
          winnerTeam: result.winnerTeam ?? null,
          winnerPlayerId: result.winnerPlayerId ?? null,
          winners: winningPlayerIds.map((playerId) => publicPlayer(playerId, players.get(playerId))),
        } : null,
      };
    });

  const plan=actor.role==='ADMIN'&&event.currentMatchPlanId?(await eventRef.collection('matchPlans').doc(event.currentMatchPlanId).get()).data():null;
  const publicRoster = (list: Array<{ id: string; data: ParticipantDocument }>) => list.map((participant) => ({
    ...publicPlayer(participant.id, players.get(participant.id)),
    rsvp: participant.data.rsvp ?? "UNANSWERED",
    signupState: participant.data.signupState ?? "NONE",
    attendanceStatus: participant.data.attendanceStatus ?? "NOT_CHECKED",
    respondedAt: iso(participant.data.respondedAt),
  }));

  return {
    schemaVersion: "EVENT_DETAIL_V1",
    generatedAt: new Date().toISOString(),
    event: {
      eventId,
      timezone:event.timezone??"Europe/Copenhagen",
      seasonId: event.seasonId ?? null,
      title: event.title ?? eventId,
      description: event.description ?? "",
      artworkUrl: event.artworkUrl ?? null,
      status: event.status ?? "UNKNOWN",
      featured: event.featured === true,
      startsAt: iso(event.startsAt),
      endsAt: iso(event.endsAt),
      signupDeadlineAt: iso(event.signupDeadlineAt),
      checkInOpensAt: iso(checkIn.opensAt),
      checkInClosesAt: iso(checkIn.closesAt),
      warmupOpensAt:iso(event.warmupOpensAt??(event.startsAt instanceof Timestamp?Timestamp.fromMillis(event.startsAt.toMillis()-7*86400000):null)),
      minParticipants: event.minParticipants ?? null,
      maxParticipants: event.maxParticipants ?? null,
      waitingListEnabled: event.waitingListEnabled !== false,
      signupRosterVisibility: event.signupRosterVisibility ?? "VISIBLE",
      competitionStyle: event.competitionStyle ?? null,
      officialMatchIds: Array.isArray(event.officialMatchIds) ? event.officialMatchIds : [],
    },
    warmup:{configured:!!event.warmupPolicy,schedule:event.warmupSchedule?{status:event.warmupSchedule.status,unpairedPlayerId:event.warmupSchedule.unpairedPlayerId??null}:null,aiDifficulty:event.warmupPolicy?.aiDifficulty??null,map:event.warmupPolicy?.gameConfig?.maps?.pool?.[0]??null,guestAcceptanceDeadlineAt:iso(event.warmupPolicy?.guestAcceptanceDeadlineAt),challenges:invites,eligibleGuests:eligibleGuestIds.map(id=>publicPlayer(id,players.get(id))),replacementGuests:actor.role==='ADMIN'?playersSnapshot.docs.filter(d=>d.data().membershipStatus==='ACTIVE').map(d=>publicPlayer(d.id,players.get(d.id))):[],isGuest:guests.docs.some(d=>d.id===actor.playerId)},
    pairingPlan:plan?{planId:event.currentMatchPlanId,status:plan.status,pairingMode:plan.planningConfig?.pairingMode??"ELO_BALANCED",sittingOutPlayerIds:plan.sittingOutPlayerIds??[],matches:(plan.matches??[]).map((m:any)=>({...m,participants:m.participants.map((p:any)=>({...p,...publicPlayer(p.playerId,players.get(p.playerId))}))}))}:null,
    finalisation,
    roundoff:await readEventRoundoff(eventId),
    viewer: {
      playerId: actor.playerId,
      role: actor.role,
      rsvp: viewerParticipation?.rsvp ?? "UNANSWERED",
      signupState: viewerParticipation?.signupState ?? "NONE",
      attendanceStatus: viewerParticipation?.attendanceStatus ?? "NOT_CHECKED",
      respondedAt: iso(viewerParticipation?.respondedAt),
      promotedAt: iso(viewerParticipation?.promotedAt),
    },
    signup: {
      confirmedCount: confirmed.length,
      waitingListCount: waiting.length,
      declinedCount: declined.length,
      rosterVisible,
      confirmed: rosterVisible ? publicRoster(confirmed) : null,
      waitingList: rosterVisible ? publicRoster(waiting) : null,
    },
    matches,
  };
});
