import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import { collections, leagueStateDocumentId } from "../../domain/collections.js";
import type {
  CompetitionStyle,
  GameConfiguration,
  GoldRewardConfig,
  MatchPlanningConfig,
  ScoringSnapshot,
} from "../../domain/types.js";
import { writeAdminAudit } from "../../services/audit.js";
import { reserveIdempotencyKey } from "../../services/idempotency.js";

interface CreateEventInput {
  requestId: string;
  title: string;
  description?: string;
  artworkUrl?: string | null;
  startsAt: string;
  endsAt?: string | null;
  signupDeadlineAt: string;
  checkInOpensAt?: string | null;
  minParticipants?: number | null;
  maxParticipants?: number | null;
  waitingListEnabled?: boolean;
  signupRosterVisibility?: "VISIBLE" | "HIDDEN";
  competitionStyle: CompetitionStyle;
  planningConfig: MatchPlanningConfig;
  gameConfig: GameConfiguration;
  scoringSnapshot: ScoringSnapshot;
  goldRewardSnapshot: GoldRewardConfig;
}

const competitionStyles: CompetitionStyle[] = ["ONE_V_ONE", "TWO_V_TWO", "BIG_TEAM", "FFA"];

function parseDate(value: string | null | undefined, fieldName: string, optional = false): Date | null {
  if (!value) {
    if (optional) return null;
    throw new HttpsError("invalid-argument", `${fieldName} is required.`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpsError("invalid-argument", `${fieldName} must be a valid ISO date/time.`);
  }
  return date;
}

function assertIntegerOrNull(value: number | null | undefined, fieldName: string): void {
  if (value == null) return;
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new HttpsError("invalid-argument", `${fieldName} must be an integer between 1 and 100.`);
  }
}

export const adminCreateEvent = onCall<CreateEventInput>(async (request) => {
  const actor = await requireAdmin(request);
  const input = request.data;

  const title = input.title?.trim();
  const description = input.description?.trim() || "";
  const artworkUrl = input.artworkUrl?.trim() || null;

  if (!title || title.length > 120) {
    throw new HttpsError("invalid-argument", "Event title must contain 1–120 characters.");
  }
  if (description.length > 5000) {
    throw new HttpsError("invalid-argument", "Event description is too long.");
  }
  if (!competitionStyles.includes(input.competitionStyle)) {
    throw new HttpsError("invalid-argument", "Unsupported competition style.");
  }

  assertIntegerOrNull(input.minParticipants, "minParticipants");
  assertIntegerOrNull(input.maxParticipants, "maxParticipants");

  const minParticipants = input.minParticipants ?? null;
  const maxParticipants = input.maxParticipants ?? null;
  if (minParticipants != null && maxParticipants != null && minParticipants > maxParticipants) {
    throw new HttpsError("invalid-argument", "minParticipants cannot exceed maxParticipants.");
  }

  const startsAt = parseDate(input.startsAt, "startsAt")!;
  const endsAt = parseDate(input.endsAt, "endsAt", true);
  const signupDeadlineAt = parseDate(input.signupDeadlineAt, "signupDeadlineAt")!;
  const checkInOpensAt = parseDate(input.checkInOpensAt, "checkInOpensAt", true) ?? startsAt;

  if (endsAt && endsAt <= startsAt) {
    throw new HttpsError("invalid-argument", "Event end must be after its start.");
  }
  if (signupDeadlineAt > startsAt) {
    throw new HttpsError("invalid-argument", "Signup deadline cannot be after the event starts.");
  }
  if (checkInOpensAt > startsAt) {
    throw new HttpsError("invalid-argument", "Check-in cannot open after the event starts.");
  }

  if (!input.planningConfig || !input.gameConfig || !input.scoringSnapshot || !input.goldRewardSnapshot) {
    throw new HttpsError("invalid-argument", "Event planning, game, scoring, and Gold configurations are required.");
  }

  const eventRef = db.collection(collections.events).doc();
  const leagueStateRef = db.collection(collections.leagueState).doc(leagueStateDocumentId);

  await db.runTransaction(async (transaction) => {
    const leagueStateSnapshot = await transaction.get(leagueStateRef);
    if (!leagueStateSnapshot.exists) {
      throw new HttpsError("failed-precondition", "League state has not been initialized.");
    }

    const leagueState = leagueStateSnapshot.data() as { activeSeasonId?: string | null };
    if (!leagueState.activeSeasonId) {
      throw new HttpsError("failed-precondition", "An active season is required to create a season event.");
    }

    const seasonRef = db.collection(collections.seasons).doc(leagueState.activeSeasonId);
    const seasonSnapshot = await transaction.get(seasonRef);
    if (!seasonSnapshot.exists || seasonSnapshot.data()?.status !== "ACTIVE") {
      throw new HttpsError("failed-precondition", "The active season reference is invalid.");
    }

    const season = seasonSnapshot.data() as { startsAt?: Timestamp; endsAt?: Timestamp };
    if (season.startsAt instanceof Timestamp && startsAt < season.startsAt.toDate()) {
      throw new HttpsError("failed-precondition", "Event cannot start before the active season.");
    }
    if (season.endsAt instanceof Timestamp && startsAt > season.endsAt.toDate()) {
      throw new HttpsError("failed-precondition", "Event cannot start after the active season ends.");
    }

    await reserveIdempotencyKey(
      transaction,
      input.requestId,
      "adminCreateEvent",
      actor.authUid,
    );

    const now = Timestamp.now();
    const event = {
      seasonId: leagueState.activeSeasonId,
      title,
      description,
      artworkUrl,
      status: "DRAFT" as const,
      featured: false,
      startsAt: Timestamp.fromDate(startsAt),
      endsAt: endsAt ? Timestamp.fromDate(endsAt) : null,
      signupDeadlineAt: Timestamp.fromDate(signupDeadlineAt),
      checkInOpensAt: Timestamp.fromDate(checkInOpensAt),
      checkInClosesAt: null,
      minParticipants,
      maxParticipants,
      waitingListEnabled: input.waitingListEnabled ?? true,
      signupRosterVisibility: input.signupRosterVisibility ?? "VISIBLE",
      competitionStyle: input.competitionStyle,
      planningConfig: input.planningConfig,
      gameConfig: input.gameConfig,
      scoringSnapshot: input.scoringSnapshot,
      goldRewardSnapshot: input.goldRewardSnapshot,
      specialMechanics: [],
      createdBy: actor.playerId,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };

    transaction.create(eventRef, event);
    writeAdminAudit(transaction, {
      actorUid: actor.authUid,
      actorPlayerId: actor.playerId,
      action: "EVENT_CREATED",
      targetType: "EVENT",
      targetId: eventRef.id,
      after: event,
    });
  });

  return { success: true, eventId: eventRef.id, status: "DRAFT" };
});
