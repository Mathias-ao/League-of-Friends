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
  seasonId?: string | null;
  title?: string;
  description?: string;
  artworkUrl?: string | null;
  status?: string;
  featured?: boolean;
  startsAt?: Timestamp | null;
  endsAt?: Timestamp | null;
  signupDeadlineAt?: Timestamp | null;
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
  eventId?: string | null;
  matchNumber?: number;
  format?: string;
  teamSizes?: [number, number] | null;
  participants?: MatchParticipant[];
  status?: string;
  canonicalResult?: (Partial<CanonicalGameResult> & Record<string, unknown>) | null;
  completedAt?: Timestamp | null;
  firstCompletedAt?: Timestamp | null;
  processingState?: string | null;
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
      const participants = Array.isArray(match.participants) ? match.participants : [];
      const result = match.canonicalResult ?? null;
      const winningPlayerIds = Array.isArray(result?.winningPlayerIds) ? result.winningPlayerIds : [];
      return {
        matchId,
        matchNumber: Number(match.matchNumber ?? 0),
        format: match.format ?? null,
        teamSizes: match.teamSizes ?? null,
        status: match.status ?? "UNKNOWN",
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
      seasonId: event.seasonId ?? null,
      title: event.title ?? eventId,
      description: event.description ?? "",
      artworkUrl: event.artworkUrl ?? null,
      status: event.status ?? "UNKNOWN",
      featured: event.featured === true,
      startsAt: iso(event.startsAt),
      endsAt: iso(event.endsAt),
      signupDeadlineAt: iso(event.signupDeadlineAt),
      checkInOpensAt: iso(event.checkInOpensAt),
      checkInClosesAt: iso(event.checkInClosesAt),
      minParticipants: event.minParticipants ?? null,
      maxParticipants: event.maxParticipants ?? null,
      waitingListEnabled: event.waitingListEnabled !== false,
      signupRosterVisibility: event.signupRosterVisibility ?? "VISIBLE",
      competitionStyle: event.competitionStyle ?? null,
      officialMatchIds: Array.isArray(event.officialMatchIds) ? event.officialMatchIds : [],
    },
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
