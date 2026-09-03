import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireLeaguePlayer } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import { callableOptions } from "../../config/runtime.js";
import { collections } from "../../domain/collections.js";
import type { RsvpStatus, SignupState } from "../../domain/types.js";

interface SetEventRsvpInput {
  eventId: string;
  rsvp: Extract<RsvpStatus, "YES" | "NO">;
}

interface ParticipantData {
  playerId?: string;
  rsvp?: RsvpStatus;
  signupState?: SignupState;
  attendanceStatus?: string;
  respondedAt?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export const setEventRsvp = onCall<SetEventRsvpInput>(callableOptions, async (request) => {
  const actor = await requireLeaguePlayer(request);
  const { eventId, rsvp } = request.data;

  if (!eventId) {
    throw new HttpsError("invalid-argument", "eventId is required.");
  }
  if (rsvp !== "YES" && rsvp !== "NO") {
    throw new HttpsError("invalid-argument", "RSVP must be YES or NO.");
  }

  const eventRef = db.collection(collections.events).doc(eventId);
  const participantsRef = eventRef.collection("participants");
  const participantRef = participantsRef.doc(actor.playerId);

  const result = await db.runTransaction(async (transaction) => {
    const [eventSnapshot, participantsSnapshot] = await Promise.all([
      transaction.get(eventRef),
      transaction.get(participantsRef),
    ]);

    if (!eventSnapshot.exists) {
      throw new HttpsError("not-found", "Event not found.");
    }

    const event = eventSnapshot.data() as {
      status?: string;
      signupDeadlineAt?: Timestamp;
      maxParticipants?: number | null;
      waitingListEnabled?: boolean;
    };

    if (event.status !== "PUBLISHED" && event.status !== "ACTIVE") {
      throw new HttpsError("failed-precondition", "RSVP is only available for a published Event.");
    }

    const now = Timestamp.now();
    if (event.signupDeadlineAt instanceof Timestamp && now.toMillis() > event.signupDeadlineAt.toMillis()) {
      throw new HttpsError("failed-precondition", "The RSVP deadline has passed.");
    }

    const existingDocument = participantsSnapshot.docs.find((document) => document.id === actor.playerId);
    const existing = existingDocument?.data() as ParticipantData | undefined;
    const wasConfirmed = existing?.signupState === "CONFIRMED";

    let signupState: SignupState = "NONE";
    let promotedPlayerId: string | null = null;

    if (rsvp === "YES") {
      if (wasConfirmed) {
        signupState = "CONFIRMED";
      } else {
        const confirmedCount = participantsSnapshot.docs.filter((document) => {
          if (document.id === actor.playerId) return false;
          const data = document.data() as ParticipantData;
          return data.rsvp === "YES" && data.signupState === "CONFIRMED";
        }).length;

        const hasCapacity = event.maxParticipants == null || confirmedCount < event.maxParticipants;
        if (hasCapacity) {
          signupState = "CONFIRMED";
        } else if (event.waitingListEnabled !== false) {
          signupState = "WAITING_LIST";
        } else {
          throw new HttpsError("resource-exhausted", "The Event is full and its waiting list is disabled.");
        }
      }
    } else if (wasConfirmed) {
      const waiting = participantsSnapshot.docs
        .filter((document) => {
          if (document.id === actor.playerId) return false;
          const data = document.data() as ParticipantData;
          return data.rsvp === "YES" && data.signupState === "WAITING_LIST";
        })
        .sort((left, right) => {
          const leftTime = (left.data() as ParticipantData).respondedAt?.toMillis() ?? Number.MAX_SAFE_INTEGER;
          const rightTime = (right.data() as ParticipantData).respondedAt?.toMillis() ?? Number.MAX_SAFE_INTEGER;
          return leftTime - rightTime || left.id.localeCompare(right.id);
        });

      const promoted = waiting[0];
      if (promoted) {
        promotedPlayerId = promoted.id;
        transaction.update(promoted.ref, {
          signupState: "CONFIRMED",
          promotedAt: now,
          updatedAt: now,
        });
      }
    }

    const participantData = {
      playerId: actor.playerId,
      rsvp,
      signupState,
      attendanceStatus: existing?.attendanceStatus ?? "NOT_CHECKED",
      respondedAt: now,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    transaction.set(participantRef, participantData, { merge: true });

    return { signupState, promotedPlayerId };
  });

  return {
    success: true,
    eventId,
    playerId: actor.playerId,
    rsvp,
    signupState: result.signupState,
    promotedPlayerId: result.promotedPlayerId,
  };
});
