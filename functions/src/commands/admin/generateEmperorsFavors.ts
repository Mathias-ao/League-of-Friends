import { randomUUID } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import {
  emperorsFavorCallableOptions,
  readEmperorsFavorHmacKey,
} from "../../config/emperorsFavor.js";
import { collections } from "../../domain/collections.js";
import {
  fingerprintEmperorsFavor,
  generateEmperorsFavorCode,
  randomEmperor,
  romanNumeral,
} from "../../domain/emperorsFavor.js";
import { writeAdminAudit } from "../../services/audit.js";

interface GenerateFavorsInput {
  batchName: string;
  count: number;
}

export const adminGenerateEmperorsFavors = onCall<GenerateFavorsInput>(
  emperorsFavorCallableOptions,
  async (request) => {
    const actor = await requireAdmin(request);
    const batchName = request.data.batchName?.trim();
    const count = Number(request.data.count);

    if (!batchName || batchName.length > 80) {
      throw new HttpsError("invalid-argument", "Batch name must contain 1–80 characters.");
    }
    if (!Number.isInteger(count) || count < 1 || count > 50) {
      throw new HttpsError("invalid-argument", "Create between 1 and 50 Favors per batch.");
    }

    let hmacKey: string;
    try {
      hmacKey = readEmperorsFavorHmacKey();
    } catch {
      throw new HttpsError(
        "failed-precondition",
        "The Emperor's Favor secret has not been configured.",
      );
    }

    const batchId = randomUUID();
    const batchRef = db.collection(collections.emperorFavorBatches).doc(batchId);
    const generated: Array<{
      code: string;
      fingerprint: string;
      emperor: string;
      serialNumber: number;
      printLabel: string;
    }> = [];
    const seen = new Set<string>();

    while (generated.length < count) {
      const code = generateEmperorsFavorCode();
      if (seen.has(code)) continue;
      seen.add(code);
      generated.push({
        code,
        fingerprint: fingerprintEmperorsFavor(code, hmacKey),
        emperor: randomEmperor(),
        serialNumber: generated.length + 1,
        printLabel: `${romanNumeral(generated.length + 1)} / ${romanNumeral(count)}`,
      });
    }

    const favorRefs = generated.map((favor) =>
      db.collection(collections.emperorFavors).doc(favor.fingerprint),
    );

    await db.runTransaction(async (transaction) => {
      const existing = await Promise.all(favorRefs.map((ref) => transaction.get(ref)));
      if (existing.some((document) => document.exists)) {
        throw new HttpsError("aborted", "A Favor collision occurred. Generate the batch again.");
      }

      const now = Timestamp.now();
      transaction.create(batchRef, {
        batchId,
        batchName,
        count,
        status: "ACTIVE",
        codeLength: 6,
        alphabetVersion: "AOF_UNAMBIGUOUS_32_V1",
        fingerprintVersion: "HMAC_SHA256_V1",
        createdAt: now,
        createdByPlayerId: actor.playerId,
        createdByAuthUid: actor.authUid,
      });

      generated.forEach((favor, index) => {
        transaction.create(favorRefs[index], {
          favorId: `${batchId}:${favor.serialNumber}`,
          batchId,
          batchName,
          serialNumber: favor.serialNumber,
          emperor: favor.emperor,
          status: "UNUSED",
          fingerprintVersion: "HMAC_SHA256_V1",
          createdAt: now,
          createdByPlayerId: actor.playerId,
          redeemedAt: null,
          redeemedByPlayerId: null,
          redeemedByAuthUid: null,
        });
      });

      writeAdminAudit(transaction, {
        actorUid: actor.authUid,
        actorPlayerId: actor.playerId,
        action: "EMPERORS_FAVOR_BATCH_CREATED",
        targetType: "EMPERORS_FAVOR_BATCH",
        targetId: batchId,
        reason: `Created ${count} one-time Emperor's Favors.`,
        after: { batchId, batchName, count },
      });
    });

    return {
      success: true,
      batchId,
      batchName,
      count,
      favors: generated.map(({ code, emperor, serialNumber, printLabel }) => ({
        code,
        emperor,
        serialNumber,
        total: count,
        printLabel,
      })),
    };
  },
);
