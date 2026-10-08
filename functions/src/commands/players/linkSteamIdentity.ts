import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import { callableOptions } from "../../config/runtime.js";
import { collections } from "../../domain/collections.js";
import type { Player } from "../../domain/types.js";
import { writeAdminAudit } from "../../services/audit.js";

interface LinkSteamIdentityInput {
  playerId: string;
  steamId64: string;
}

export const adminLinkSteamIdentity = onCall<LinkSteamIdentityInput>(
  callableOptions,
  async (request) => {
    const actor = await requireAdmin(request);
    const playerId = request.data.playerId?.trim();
    const steamId64 = request.data.steamId64?.trim();

    if (!playerId) {
      throw new HttpsError("invalid-argument", "playerId is required.");
    }
    if (!/^\d{17}$/.test(steamId64 ?? "")) {
      throw new HttpsError("invalid-argument", "A valid 17-digit SteamID64 is required.");
    }

    const playerRef = db.collection(collections.players).doc(playerId);
    const authUid = `steam:${steamId64}`;
    const authLinkRef = db.collection(collections.authLinks).doc(authUid);

    await db.runTransaction(async (transaction) => {
      const [playerSnapshot, authLinkSnapshot] = await Promise.all([
        transaction.get(playerRef),
        transaction.get(authLinkRef),
      ]);

      if (!playerSnapshot.exists) {
        throw new HttpsError("not-found", "Player not found.");
      }
      const player = playerSnapshot.data() as Player & Record<string, unknown>;

      if (player.steamId64 && player.steamId64 !== steamId64) {
        throw new HttpsError(
          "failed-precondition",
          "This player is already linked to a different Steam account.",
        );
      }
      if (
        authLinkSnapshot.exists &&
        authLinkSnapshot.data()?.playerId !== playerId
      ) {
        throw new HttpsError(
          "already-exists",
          "This Steam account is already linked to another league player.",
        );
      }

      const now = Timestamp.now();
      transaction.set(
        authLinkRef,
        {
          playerId,
          provider: "STEAM",
          steamId64,
          createdAt: authLinkSnapshot.exists
            ? authLinkSnapshot.data()?.createdAt ?? now
            : now,
          updatedAt: now,
        },
        { merge: true },
      );
      transaction.update(playerRef, {
        steamId64,
        updatedAt: now,
      });

      writeAdminAudit(transaction, {
        actorUid: actor.authUid,
        actorPlayerId: actor.playerId,
        action: "PLAYER_STEAM_IDENTITY_LINKED",
        targetType: "PLAYER",
        targetId: playerId,
        before: player,
        after: { ...player, steamId64, updatedAt: now },
      });
    });

    return { success: true, playerId, steamId64, authUid };
  },
);
