import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin } from "../auth/authorization.js";
import { db } from "../config/firebase.js";
import { callableOptions } from "../config/runtime.js";
import { collections } from "../domain/collections.js";

interface Input {
  eventId: string;
  playerId: string;
}

function emulatorActive(): boolean {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST);
}

export const seedReplayWarmupOpponent = onCall<Input>(callableOptions, async (request) => {
  await requireAdmin(request);
  if (!emulatorActive()) {
    throw new HttpsError("not-found", "Not found.");
  }

  const eventId = request.data.eventId?.trim();
  const playerId = request.data.playerId?.trim();
  if (!eventId || !playerId) {
    throw new HttpsError("invalid-argument", "eventId and playerId are required.");
  }

  const eventRef = db.collection(collections.events).doc(eventId);
  const playerRef = db.collection(collections.players).doc(playerId);

  await db.runTransaction(async (transaction) => {
    const [eventSnapshot, playerSnapshot] = await Promise.all([
      transaction.get(eventRef),
      transaction.get(playerRef),
    ]);
    if (!eventSnapshot.exists) throw new HttpsError("not-found", "Event not found.");
    if (!playerSnapshot.exists) throw new HttpsError("not-found", "Opponent player not found.");
    if (playerSnapshot.data()?.membershipStatus !== "ACTIVE") {
      throw new HttpsError("failed-precondition", "Opponent must be an active league member.");
    }

    const seasonId = eventSnapshot.data()?.seasonId as string | undefined;
    if (!seasonId) throw new HttpsError("failed-precondition", "Event is missing its Season.");
    const now = Timestamp.now();

    transaction.set(
      db.collection(collections.seasons).doc(seasonId).collection("participants").doc(playerId),
      {
        playerId,
        seasonId,
        status: "ENTERED",
        enteredAt: now,
        updatedAt: now,
      },
      { merge: true },
    );
    transaction.set(
      eventRef.collection("participants").doc(playerId),
      {
        playerId,
        rsvp: "YES",
        signupState: "CONFIRMED",
        attendanceStatus: "CHECKED_IN",
        respondedAt: now,
        checkedInAt: now,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true },
    );
  });

  return {
    success: true,
    eventId,
    playerId,
    attendanceStatus: "CHECKED_IN",
  };
});
