import type { Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { db } from "../config/firebase.js";
import { collections } from "../domain/collections.js";

export interface IdempotencyRecord {
  operation: string;
  actorUid: string;
  createdAt: FirebaseFirestore.Timestamp;
}

export async function reserveIdempotencyKey(
  transaction: Transaction,
  key: string,
  operation: string,
  actorUid: string,
): Promise<void> {
  if (!key || key.length < 8 || key.length > 200) {
    throw new HttpsError("invalid-argument", "A valid idempotency key is required.");
  }

  const ref = db.collection(collections.idempotencyKeys).doc(key);
  const existing = await transaction.get(ref);

  if (existing.exists) {
    const data = existing.data() as Partial<IdempotencyRecord>;
    if (data.operation !== operation || data.actorUid !== actorUid) {
      throw new HttpsError("already-exists", "This idempotency key is already reserved for another operation.");
    }
    throw new HttpsError("already-exists", "This operation has already been submitted.");
  }

  transaction.create(ref, {
    operation,
    actorUid,
    createdAt: FirebaseFirestore.Timestamp.now(),
  });
}
