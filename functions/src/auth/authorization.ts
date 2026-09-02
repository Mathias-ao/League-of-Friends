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

export function requireAuth(request: CallableRequest<unknown>): string {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }
  return uid;
}

export async function requireLeaguePlayer(request: CallableRequest<unknown>): Promise<AuthenticatedPlayer> {
  const uid = requireAuth(request);

  const snapshot = await db
    .collection(collections.players)
    .where("authUid", "==", uid)
    .limit(1)
    .get();

  if (snapshot.empty) {
    throw new HttpsError("permission-denied", "No league player is linked to this account.");
  }

  const document = snapshot.docs[0];
  const player = document.data() as Player;

  if (player.membershipStatus === "SUSPENDED") {
    throw new HttpsError("permission-denied", "This league membership is suspended.");
  }

  if (player.membershipStatus !== "ACTIVE") {
    throw new HttpsError("failed-precondition", "League membership is not active.");
  }

  return {
    playerId: document.id,
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
