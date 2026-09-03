import { Timestamp } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { db } from "../config/firebase.js";
import { collections } from "../domain/collections.js";
import { writeAdminAudit } from "../services/audit.js";

interface BootstrapBody {
  authUid?: string;
  steamName?: string;
  discordName?: string | null;
}

function normalizeSteamName(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

function emulatorEnvironmentIsActive(): boolean {
  return Boolean(
    process.env.FIRESTORE_EMULATOR_HOST &&
    process.env.FIREBASE_AUTH_EMULATOR_HOST,
  );
}

/**
 * Emulator-only escape hatch for creating the very first local administrator.
 *
 * This function is intentionally unusable in production. It only responds when
 * both the Firestore and Authentication emulator environment variables exist.
 */
export const bootstrapEmulatorAdmin = onRequest(
  { region: "europe-west1" },
  async (request, response) => {
    if (!emulatorEnvironmentIsActive()) {
      response.status(404).send("Not found.");
      return;
    }

    if (request.method !== "POST") {
      response.status(405).json({ error: "POST required." });
      return;
    }

    const body = (request.body ?? {}) as BootstrapBody;
    const authUid = body.authUid?.trim();
    const steamName = body.steamName?.trim();
    const discordName = body.discordName?.trim() || null;

    if (!authUid || authUid.length > 128) {
      response.status(400).json({ error: "A valid authUid is required." });
      return;
    }
    if (!steamName || steamName.length > 100) {
      response.status(400).json({ error: "Steam name must contain 1–100 characters." });
      return;
    }
    if (discordName && discordName.length > 100) {
      response.status(400).json({ error: "Discord name must contain at most 100 characters." });
      return;
    }

    const playerRef = db.collection(collections.players).doc();
    const authLinkRef = db.collection(collections.authLinks).doc(authUid);

    try {
      await db.runTransaction(async (transaction) => {
        const [existingAuthLink, existingAdmins] = await Promise.all([
          transaction.get(authLinkRef),
          transaction.get(
            db.collection(collections.players)
              .where("role", "==", "ADMIN")
              .limit(1),
          ),
        ]);

        if (existingAuthLink.exists) {
          throw new Error("AUTH_LINK_EXISTS");
        }
        if (!existingAdmins.empty) {
          throw new Error("ADMIN_ALREADY_EXISTS");
        }

        const now = Timestamp.now();
        const player = {
          steamName,
          steamNameNormalized: normalizeSteamName(steamName),
          discordName,
          avatarUrl: null,
          membershipStatus: "ACTIVE" as const,
          role: "ADMIN" as const,
          currentPowerRating: null,
          provisionalRating: true,
          goldBalance: 0,
          joinedAt: now,
          requestedAt: null,
          createdAt: now,
          updatedAt: now,
        };

        transaction.create(playerRef, player);
        transaction.create(authLinkRef, {
          playerId: playerRef.id,
          createdAt: now,
        });

        writeAdminAudit(transaction, {
          actorUid: authUid,
          actorPlayerId: playerRef.id,
          action: "EMULATOR_FIRST_ADMIN_BOOTSTRAPPED",
          targetType: "PLAYER",
          targetId: playerRef.id,
          reason: "Local emulator bootstrap",
          after: player,
        });
      });
    } catch (error) {
      if (error instanceof Error && error.message === "AUTH_LINK_EXISTS") {
        response.status(409).json({ error: "This auth user is already linked." });
        return;
      }
      if (error instanceof Error && error.message === "ADMIN_ALREADY_EXISTS") {
        response.status(409).json({ error: "An emulator admin already exists." });
        return;
      }
      throw error;
    }

    response.status(201).json({
      success: true,
      playerId: playerRef.id,
      role: "ADMIN",
      membershipStatus: "ACTIVE",
    });
  },
);
