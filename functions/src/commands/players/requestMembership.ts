import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAuth } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import {
  emperorsFavorCallableOptions,
  readEmperorsFavorHmacKey,
} from "../../config/emperorsFavor.js";
import { collections } from "../../domain/collections.js";
import {
  fingerprintEmperorsFavor,
  isValidEmperorsFavorFormat,
  normalizeEmperorsFavor,
} from "../../domain/emperorsFavor.js";

interface RequestMembershipInput {
  steamName: string;
  discordName?: string | null;
  favor: string;
}

const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

function normalizeSteamName(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

export const requestLeagueMembership = onCall<RequestMembershipInput>(
  emperorsFavorCallableOptions,
  async (request) => {
    const authUid = requireAuth(request);
    const steamName = request.data.steamName?.trim();
    const discordName = request.data.discordName?.trim() || null;
    const favor = normalizeEmperorsFavor(request.data.favor ?? "");

    if (!steamName || steamName.length > 100) {
      throw new HttpsError("invalid-argument", "Steam name must contain 1–100 characters.");
    }
    if (discordName && discordName.length > 100) {
      throw new HttpsError("invalid-argument", "Discord name must contain at most 100 characters.");
    }
    if (!isValidEmperorsFavorFormat(favor)) {
      throw new HttpsError(
        "invalid-argument",
        "Enter the six-character Emperor's Favor exactly as printed.",
      );
    }

    let hmacKey: string;
    try {
      hmacKey = readEmperorsFavorHmacKey();
    } catch {
      throw new HttpsError(
        "failed-precondition",
        "The league gate is not ready. Contact the league administrator.",
      );
    }

    const fingerprint = fingerprintEmperorsFavor(favor, hmacKey);
    const authLinkRef = db.collection(collections.authLinks).doc(authUid);
    const playerRef = db.collection(collections.players).doc();
    const favorRef = db.collection(collections.emperorFavors).doc(fingerprint);
    const attemptRef = db.collection(collections.emperorFavorAttempts).doc(authUid);

    const outcome = await db.runTransaction(async (transaction) => {
      const [existingAuthLink, favorDocument, attemptDocument] = await Promise.all([
        transaction.get(authLinkRef),
        transaction.get(favorRef),
        transaction.get(attemptRef),
      ]);

      if (existingAuthLink.exists) {
        return { type: "ALREADY_LINKED" as const };
      }

      const now = Timestamp.now();
      const nowMs = now.toMillis();
      const attempt = attemptDocument.data() as {
        failedAttempts?: number;
        windowStartedAt?: Timestamp | null;
        blockedUntil?: Timestamp | null;
      } | undefined;

      if (
        attempt?.blockedUntil instanceof Timestamp &&
        attempt.blockedUntil.toMillis() > nowMs
      ) {
        return { type: "RATE_LIMITED" as const };
      }

      const favorData = favorDocument.data() as {
        favorId?: string;
        batchId?: string;
        serialNumber?: number;
        emperor?: string;
        status?: string;
      } | undefined;

      if (!favorDocument.exists || favorData?.status !== "UNUSED") {
        const existingWindowStart =
          attempt?.windowStartedAt instanceof Timestamp
            ? attempt.windowStartedAt.toMillis()
            : null;
        const withinWindow =
          existingWindowStart !== null &&
          nowMs - existingWindowStart < ATTEMPT_WINDOW_MS;
        const failedAttempts =
          (withinWindow ? Number(attempt?.failedAttempts ?? 0) : 0) + 1;
        const blockedUntil =
          failedAttempts >= MAX_FAILED_ATTEMPTS
            ? Timestamp.fromMillis(nowMs + ATTEMPT_WINDOW_MS)
            : null;

        transaction.set(
          attemptRef,
          {
            failedAttempts,
            windowStartedAt: withinWindow
              ? attempt?.windowStartedAt ?? now
              : now,
            blockedUntil,
            lastFailedAt: now,
            updatedAt: now,
          },
          { merge: true },
        );

        return {
          type: blockedUntil ? "RATE_LIMITED" as const : "INVALID_FAVOR" as const,
        };
      }

      const player = {
        steamName,
        steamNameNormalized: normalizeSteamName(steamName),
        discordName,
        avatarUrl: null,
        membershipStatus: "ACTIVE" as const,
        role: "PLAYER" as const,
        currentPowerRating: null,
        powerRatingGames: 0,
        powerRatingAlgorithmVersion: null,
        provisionalRating: true,
        goldBalance: 0,
        joinedAt: now,
        requestedAt: now,
        createdAt: now,
        updatedAt: now,
        admission: {
          method: "EMPERORS_FAVOR",
          favorId: favorData.favorId ?? null,
          batchId: favorData.batchId ?? null,
          serialNumber: favorData.serialNumber ?? null,
          emperor: favorData.emperor ?? null,
        },
      };

      transaction.create(playerRef, player);
      transaction.create(authLinkRef, {
        playerId: playerRef.id,
        createdAt: now,
      });
      transaction.update(favorRef, {
        status: "REDEEMED",
        redeemedAt: now,
        redeemedByPlayerId: playerRef.id,
        redeemedByAuthUid: authUid,
      });
      transaction.set(
        attemptRef,
        {
          failedAttempts: 0,
          windowStartedAt: null,
          blockedUntil: null,
          lastSucceededAt: now,
          updatedAt: now,
        },
        { merge: true },
      );

      return {
        type: "SUCCESS" as const,
        favorId: favorData.favorId ?? null,
      };
    });

    if (outcome.type === "ALREADY_LINKED") {
      throw new HttpsError(
        "already-exists",
        "This Google account is already linked to a league player.",
      );
    }
    if (outcome.type === "RATE_LIMITED") {
      throw new HttpsError(
        "resource-exhausted",
        "Too many attempts. The league gate is sealed for fifteen minutes.",
      );
    }
    if (outcome.type === "INVALID_FAVOR") {
      throw new HttpsError(
        "permission-denied",
        "That Emperor's Favor is invalid or has already been invoked.",
      );
    }

    return {
      success: true,
      playerId: playerRef.id,
      membershipStatus: "ACTIVE",
      favorId: outcome.favorId,
    };
  },
);
