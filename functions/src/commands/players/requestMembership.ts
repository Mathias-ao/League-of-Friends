import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAuth } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import { collections } from "../../domain/collections.js";

interface RequestMembershipInput {
  steamName: string;
  discordName?: string | null;
}

function normalizeSteamName(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

export const requestLeagueMembership = onCall<RequestMembershipInput>(async (request) => {
  const authUid = requireAuth(request);
  const steamName = request.data.steamName?.trim();
  const discordName = request.data.discordName?.trim() || null;

  if (!steamName || steamName.length > 100) {
    throw new HttpsError("invalid-argument", "Steam name must contain 1–100 characters.");
  }

  if (discordName && discordName.length > 100) {
    throw new HttpsError("invalid-argument", "Discord name must contain at most 100 characters.");
  }

  const authLinkRef = db.collection(collections.authLinks).doc(authUid);
  const playerRef = db.collection(collections.players).doc();

  await db.runTransaction(async (transaction) => {
    const existingAuthLink = await transaction.get(authLinkRef);
    if (existingAuthLink.exists) {
      throw new HttpsError("already-exists", "This Google account is already linked to a league player.");
    }

    const now = Timestamp.now();

    transaction.create(playerRef, {
      steamName,
      steamNameNormalized: normalizeSteamName(steamName),
      discordName,
      avatarUrl: null,
      membershipStatus: "PENDING",
      role: "PLAYER",
      currentPowerRating: null,
      provisionalRating: true,
      goldBalance: 0,
      joinedAt: null,
      requestedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    transaction.create(authLinkRef, {
      playerId: playerRef.id,
      createdAt: now,
    });
  });

  return {
    success: true,
    playerId: playerRef.id,
    membershipStatus: "PENDING",
  };
});
