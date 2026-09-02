import { HttpsError } from "firebase-functions/v2/https";
import type { CallableRequest } from "firebase-functions/v2/https";
import { db } from "../config/firebase.js";
import { collections } from "../domain/collections.js";
import type { Player, PlayerRole } from "../domain/types.js";

export interface AuthenticatedPlayer {
  playerId: string;
  authUid: string;
  role: PlayerRole;
  player: Player;
}

interface AuthLink {
  playerId: string;
}

export function requireAuth(request: CallableRequest<unknown>): string {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }
  return uid;
}

export async function requireLeaguePlayer(request: CallableRequest<unknown>): Promise<AuthenticatedPlayer> {
  const uid = requireAuth(request);

  const authLinkDocument = await db.collection(collections.authLinks).doc(uid).get();
  if (!authLinkDocument.exists) {
    throw new HttpsError("permission-denied", "No league player is linked to this account.");
  }

  const { playerId } = authLinkDocument.data() as AuthLink;
  const playerDocument = await db.collection(collections.players).doc(playerId).get();

  if (!playerDocument.exists) {
    throw new HttpsError("internal", "The authenticated player link is invalid.");
  }

  const player = playerDocument.data() as Player;

  if (player.membershipStatus === "SUSPENDED") {
    throw new HttpsError("permission-denied", "This league membership is suspended.");
  }

  if (player.membershipStatus !== "ACTIVE") {
    throw new HttpsError("failed-precondition", "League membership is not active.");
  }

  return {
    playerId,
    authUid: uid,
    role: player.role,
    player
  };
}

export async function requireAdmin(request: CallableRequest<unknown>): Promise<AuthenticatedPlayer> {
  const actor = await requireLeaguePlayer(request);
  if (actor.role !== "ADMIN") {
    throw new HttpsError("permission-denied", "Administrator permission is required.");
  }
  return actor;
}
