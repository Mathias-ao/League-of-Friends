import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireLeaguePlayer } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import { callableOptions } from "../../config/runtime.js";
import { collections } from "../../domain/collections.js";

interface CheckInInput {
  eventId: string;
}

export const checkInToEvent = onCall<CheckInInput>(callableOptions, async (request) => {
  const actor = await requireLeaguePlayer(request);
  const { eventId } = request.data;

  if (!eventId) {
    throw new HttpsError("invalid-argument", "eventId is required.");
  }

  const eventRef = db.collection(collections.events).doc(eventId);
  const participantRef = eventRef.collection("participants").doc(actor.playerId);

  await db.runTransaction(async (transaction) => {
    const [eventSnapshot, participantSnapshot] = await Promise.all([
      transaction.get(eventRef),
      transaction.get(participantRef),
    ]);

    if (!eventSnapshot.exists) {
      throw new HttpsError("not-found", "Event not found.");
    }
    if (!participantSnapshot.exists) {
      throw new HttpsError("failed-precondition", "RSVP YES before checking in.");
    }

    const event = eventSnapshot.data() as {
      status?: string;
      checkInOpensAt?: Timestamp;
      checkInClosesAt?: Timestamp | null;
    };
    const participant = participantSnapshot.data() as {
      rsvp?: string;
      signupState?: string;
      attendanceStatus?: string;
    };

    if (event.status !== "PUBLISHED" && event.status !== "ACTIVE") {
      throw new HttpsError("failed-precondition", "Check-in is unavailable for this Event.");
    }
    if (participant.rsvp !== "YES" || participant.signupState !== "CONFIRMED") {
      throw new HttpsError("failed-precondition", "Only confirmed participants can self check-in.");
    }

    const now = Timestamp.now();
    if (event.checkInOpensAt instanceof Timestamp && now.toMillis() < event.checkInOpensAt.toMillis()) {
      throw new HttpsError("failed-precondition", "Check-in has not opened yet.");
    }
    if (event.checkInClosesAt instanceof Timestamp && now.toMillis() > event.checkInClosesAt.toMillis()) {
      throw new HttpsError("failed-precondition", "Check-in has closed.");
    }

    transaction.update(participantRef, {
      attendanceStatus: "CHECKED_IN",
      checkedInAt: now,
      updatedAt: now,
    });
  });

  return {
    success: true,
    eventId,
    playerId: actor.playerId,
    attendanceStatus: "CHECKED_IN",
  };
});
