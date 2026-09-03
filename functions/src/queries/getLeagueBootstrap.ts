import { Timestamp } from "firebase-admin/firestore";
import { onCall } from "firebase-functions/v2/https";
import { requireLeaguePlayer } from "../auth/authorization.js";
import { db } from "../config/firebase.js";
import { callableOptions } from "../config/runtime.js";
import { collections, leagueStateDocumentId } from "../domain/collections.js";
import type { Player } from "../domain/types.js";

interface LeagueStateDocument {
  activeSeasonId?: string | null;
  featuredEventId?: string | null;
  currentEmperorPlayerId?: string | null;
}

interface SeasonDocument {
  name?: string;
  status?: string;
  startsAt?: Timestamp | null;
  endsAt?: Timestamp | null;
  warRoom?: {
    status?: string;
    openedAt?: Timestamp | null;
    openedByRivalryId?: string | null;
    engineVersion?: string | null;
  } | null;
}

interface EventDocument {
  seasonId?: string | null;
  title?: string;
  description?: string;
  artworkUrl?: string | null;
  status?: string;
  startsAt?: Timestamp | null;
  endsAt?: Timestamp | null;
  signupDeadlineAt?: Timestamp | null;
  checkInOpensAt?: Timestamp | null;
  checkInClosesAt?: Timestamp | null;
  minParticipants?: number | null;
  maxParticipants?: number | null;
  signupRosterVisibility?: string;
  competitionStyle?: string;
}

interface EventParticipantDocument {
  playerId?: string;
  rsvp?: string;
  signupState?: string;
  attendanceStatus?: string;
  respondedAt?: Timestamp | null;
}

interface StandingDocument {
  playerId?: string;
  leaguePoints?: number;
}

interface RivalryDocument {
  pairId?: string;
  playerOneId?: string;
  playerTwoId?: string;
  encounters?: number;
  playerOneWins?: number;
  playerTwoWins?: number;
  rivalryScore?: number;
  status?: string;
}

interface ActivityDocument {
  type?: string;
  matchId?: string;
  seasonId?: string | null;
  eventId?: string | null;
  format?: string;
  playerIds?: string[];
  winningPlayerIds?: string[];
  resultRevision?: number;
  occurredAt?: Timestamp | null;
}

function iso(value: Timestamp | null | undefined): string | null {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

function publicPlayer(playerId: string, player: Player | undefined) {
  return {
    playerId,
    steamName: player?.steamName ?? playerId,
    avatarUrl: player?.avatarUrl ?? null,
    currentPowerRating: player?.currentPowerRating ?? null,
    provisionalRating: player?.provisionalRating ?? true,
  };
}

function eventSummary(eventId: string, event: EventDocument) {
  return {
    eventId,
    title: event.title ?? eventId,
    description: event.description ?? "",
    artworkUrl: event.artworkUrl ?? null,
    status: event.status ?? "UNKNOWN",
    startsAt: iso(event.startsAt),
    endsAt: iso(event.endsAt),
    signupDeadlineAt: iso(event.signupDeadlineAt),
    checkInOpensAt: iso(event.checkInOpensAt),
    checkInClosesAt: iso(event.checkInClosesAt),
    minParticipants: event.minParticipants ?? null,
    maxParticipants: event.maxParticipants ?? null,
    signupRosterVisibility: event.signupRosterVisibility ?? "VISIBLE",
    competitionStyle: event.competitionStyle ?? null,
  };
}

export const getLeagueBootstrap = onCall(callableOptions, async (request) => {
  const actor = await requireLeaguePlayer(request);
  const [leagueStateSnapshot, playersSnapshot, activitySnapshot] = await Promise.all([
    db.collection(collections.leagueState).doc(leagueStateDocumentId).get(),
    db.collection(collections.players).get(),
    db.collection(collections.activity).orderBy("occurredAt", "desc").limit(12).get(),
  ]);

  const playerById = new Map<string, Player>(
    playersSnapshot.docs.map((document) => [document.id, document.data() as Player]),
  );
  const leagueState = leagueStateSnapshot.exists
    ? leagueStateSnapshot.data() as LeagueStateDocument
    : {};
  const activeSeasonId = leagueState.activeSeasonId ?? null;

  const activity = activitySnapshot.docs.map((document) => {
    const data = document.data() as ActivityDocument;
    const playerIds = Array.isArray(data.playerIds) ? data.playerIds : [];
    const winningPlayerIds = Array.isArray(data.winningPlayerIds) ? data.winningPlayerIds : [];
    return {
      activityId: document.id,
      type: data.type ?? "UNKNOWN",
      matchId: data.matchId ?? null,
      seasonId: data.seasonId ?? null,
      eventId: data.eventId ?? null,
      format: data.format ?? null,
      resultRevision: Number(data.resultRevision ?? 1),
      occurredAt: iso(data.occurredAt),
      players: playerIds.map((playerId) => publicPlayer(playerId, playerById.get(playerId))),
      winners: winningPlayerIds.map((playerId) => publicPlayer(playerId, playerById.get(playerId))),
    };
  });

  if (!activeSeasonId) {
    return {
      schemaVersion: "LEAGUE_BOOTSTRAP_V1",
      generatedAt: new Date().toISOString(),
      viewer: {
        ...publicPlayer(actor.playerId, playerById.get(actor.playerId)),
        role: actor.role,
        goldBalance: actor.player.goldBalance,
      },
      activeSeason: null,
      upcomingEvent: null,
      leaderboard: [],
      activity,
      warRoom: {
        visible: false,
        status: "CLOSED",
        canChallenge: false,
        qualifiedRivals: [],
      },
    };
  }

  const seasonRef = db.collection(collections.seasons).doc(activeSeasonId);
  const [seasonSnapshot, eventsSnapshot, standingsSnapshot, rivalriesSnapshot] = await Promise.all([
    seasonRef.get(),
    db.collection(collections.events).where("seasonId", "==", activeSeasonId).get(),
    seasonRef.collection("standings").get(),
    seasonRef.collection("rivalries").get(),
  ]);

  const season = seasonSnapshot.exists ? seasonSnapshot.data() as SeasonDocument : {};
  const now = Date.now();
  const eligibleEvents = eventsSnapshot.docs
    .map((document) => ({ id: document.id, data: document.data() as EventDocument }))
    .filter(({ data }) => data.status === "PUBLISHED" || data.status === "ACTIVE")
    .sort((left, right) => {
      const leftTime = left.data.startsAt instanceof Timestamp ? left.data.startsAt.toMillis() : Number.MAX_SAFE_INTEGER;
      const rightTime = right.data.startsAt instanceof Timestamp ? right.data.startsAt.toMillis() : Number.MAX_SAFE_INTEGER;
      return leftTime - rightTime || left.id.localeCompare(right.id);
    });

  const featured = leagueState.featuredEventId
    ? eligibleEvents.find((event) => event.id === leagueState.featuredEventId) ?? null
    : null;
  const upcoming = eligibleEvents.find((event) => (
    !(event.data.startsAt instanceof Timestamp) || event.data.startsAt.toMillis() >= now
  )) ?? null;
  const active = eligibleEvents.find((event) => event.data.status === "ACTIVE") ?? null;
  const selectedEvent = featured ?? active ?? upcoming ?? eligibleEvents[0] ?? null;

  let upcomingEvent = null;
  if (selectedEvent) {
    const participantsSnapshot = await db.collection(collections.events)
      .doc(selectedEvent.id)
      .collection("participants")
      .get();
    const participantDocs = participantsSnapshot.docs.map((document) => ({
      id: document.id,
      data: document.data() as EventParticipantDocument,
    }));
    const viewerParticipation = participantDocs.find((participant) => participant.id === actor.playerId)?.data ?? null;
    const confirmed = participantDocs.filter((participant) => (
      participant.data.rsvp === "YES" && participant.data.signupState === "CONFIRMED"
    ));
    const waiting = participantDocs.filter((participant) => (
      participant.data.rsvp === "YES" && participant.data.signupState === "WAITING_LIST"
    ));
    const rosterVisible = selectedEvent.data.signupRosterVisibility !== "HIDDEN";

    upcomingEvent = {
      ...eventSummary(selectedEvent.id, selectedEvent.data),
      confirmedCount: confirmed.length,
      waitingListCount: waiting.length,
      viewer: {
        rsvp: viewerParticipation?.rsvp ?? "UNANSWERED",
        signupState: viewerParticipation?.signupState ?? "NONE",
        attendanceStatus: viewerParticipation?.attendanceStatus ?? "NOT_CHECKED",
        respondedAt: iso(viewerParticipation?.respondedAt),
      },
      roster: rosterVisible
        ? confirmed.map((participant) => publicPlayer(participant.id, playerById.get(participant.id)))
        : null,
    };
  }

  const leaderboard = standingsSnapshot.docs
    .map((document) => {
      const standing = document.data() as StandingDocument;
      const playerId = standing.playerId ?? document.id;
      return {
        ...publicPlayer(playerId, playerById.get(playerId)),
        leaguePoints: Number(standing.leaguePoints ?? 0),
      };
    })
    .sort((left, right) => (
      right.leaguePoints - left.leaguePoints ||
      Number(right.currentPowerRating ?? -Infinity) - Number(left.currentPowerRating ?? -Infinity) ||
      left.steamName.localeCompare(right.steamName)
    ))
    .map((standing, index) => ({ ...standing, rank: index + 1 }));

  const viewerRivalries = rivalriesSnapshot.docs
    .map((document) => ({ pairId: document.id, ...document.data() as RivalryDocument }))
    .filter((rivalry) => rivalry.playerOneId === actor.playerId || rivalry.playerTwoId === actor.playerId)
    .map((rivalry) => {
      const rivalPlayerId = rivalry.playerOneId === actor.playerId
        ? rivalry.playerTwoId!
        : rivalry.playerOneId!;
      return {
        pairId: rivalry.pairId,
        rival: publicPlayer(rivalPlayerId, playerById.get(rivalPlayerId)),
        encounters: Number(rivalry.encounters ?? 0),
        rivalryScore: Number(rivalry.rivalryScore ?? 0),
        status: rivalry.status ?? "EMERGING",
      };
    })
    .sort((left, right) => right.rivalryScore - left.rivalryScore || left.pairId.localeCompare(right.pairId));

  const qualifiedRivals = viewerRivalries.filter((rivalry) => rivalry.status === "QUALIFIED");
  const warRoomOpen = season.warRoom?.status === "OPEN";

  return {
    schemaVersion: "LEAGUE_BOOTSTRAP_V1",
    generatedAt: new Date().toISOString(),
    viewer: {
      ...publicPlayer(actor.playerId, playerById.get(actor.playerId)),
      role: actor.role,
      goldBalance: actor.player.goldBalance,
    },
    activeSeason: {
      seasonId: activeSeasonId,
      name: season.name ?? activeSeasonId,
      status: season.status ?? "UNKNOWN",
      startsAt: iso(season.startsAt),
      endsAt: iso(season.endsAt),
      currentEmperorPlayerId: leagueState.currentEmperorPlayerId ?? null,
    },
    upcomingEvent,
    leaderboard,
    activity,
    warRoom: {
      visible: warRoomOpen,
      status: warRoomOpen ? "OPEN" : "CLOSED",
      openedAt: iso(season.warRoom?.openedAt),
      openedByRivalryId: season.warRoom?.openedByRivalryId ?? null,
      canChallenge: warRoomOpen && qualifiedRivals.length > 0,
      qualifiedRivals,
      viewerRivalries,
    },
  };
});
