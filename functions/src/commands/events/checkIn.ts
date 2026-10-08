import {checkInWindow} from "../../services/eventTiming.js";
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
      startsAt?:Timestamp;
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

    if(eventSnapshot.data()?.officialMatchIds?.length)throw new HttpsError("failed-precondition","Main Battles are already approved. Ask the Emperor to resolve a roster exception.");
    const now = Timestamp.now();
    const window=checkInWindow(event);
    if(!(window.opensAt instanceof Timestamp))throw new HttpsError("failed-precondition","The organizer has not set a main-event check-in window.");
    const closesAt=window.closesAt;
    if (now.toMillis() < window.opensAt.toMillis()) {
      throw new HttpsError("failed-precondition", "Check-in has not opened yet.");
    }
    if (closesAt instanceof Timestamp && now.toMillis() >= closesAt.toMillis()) {
      throw new HttpsError("failed-precondition", "Check-in has closed.");
    }

    if(participant.attendanceStatus==="CHECKED_IN")return;
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
