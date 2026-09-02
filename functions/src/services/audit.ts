import { Timestamp, type Transaction } from "firebase-admin/firestore";
import { db } from "../config/firebase.js";
import { collections } from "../domain/collections.js";

export interface AdminAuditInput {
  actorUid: string;
  actorPlayerId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  reason?: string | null;
  before?: unknown | null;
  after?: unknown | null;
}

export function writeAdminAudit(transaction: Transaction, input: AdminAuditInput): void {
  const ref = db.collection(collections.adminAudit).doc();
  transaction.create(ref, {
    actorUid: input.actorUid,
    actorPlayerId: input.actorPlayerId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    reason: input.reason ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    createdAt: Timestamp.now(),
  });
}
