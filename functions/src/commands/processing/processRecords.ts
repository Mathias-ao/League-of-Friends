import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import { callableOptions } from "../../config/runtime.js";
import { collections } from "../../domain/collections.js";
import type { CanonicalGameResult } from "../../domain/types.js";
import { REPLAY_RECORDS_VERSION } from "../../engines/replayRecords.js";
import { writeAdminAudit } from "../../services/audit.js";
import { reserveIdempotencyKey } from "../../services/idempotency.js";
import { rebuildReplayRecordsProjection } from "../../services/replayRecordsProjection.js";
import { canonicalRevision, resultProcessingJobId } from "../results/resultSupport.js";

interface ProcessRecordsInput {
  requestId: string;
  matchId: string;
}

interface MatchForRecords {
  status?: string;
  canonicalResult?: (Partial<CanonicalGameResult> & Record<string, unknown>) | null;
  activeResultDisputeId?: string | null;
}

interface ProcessingJob {
  status?: string;
  pendingSteps?: string[];
  completedSteps?: string[];
  attempts?: number;
}

export const adminProcessRecords = onCall<ProcessRecordsInput>(callableOptions, async (request) => {
  const actor = await requireAdmin(request);
  const { requestId, matchId } = request.data;
  if (!requestId || !matchId) throw new HttpsError("invalid-argument", "requestId and matchId are required.");

  const matchRef = db.collection(collections.matches).doc(matchId);
  const matchSnapshot = await matchRef.get();
  if (!matchSnapshot.exists) throw new HttpsError("not-found", "Match not found.");

  const match = matchSnapshot.data() as MatchForRecords;
  if (match.status !== "COMPLETED" || !match.canonicalResult) {
    throw new HttpsError("failed-precondition", "Only a completed Match with a canonical result can trigger records.");
  }
  if (match.activeResultDisputeId) {
    throw new HttpsError("failed-precondition", "Records processing is blocked while a result dispute is open.");
  }

  const resultRevision = canonicalRevision(match.canonicalResult);
  const rebuilt = await rebuildReplayRecordsProjection();
  const revisionedJobRef = db.collection(collections.processingJobs).doc(resultProcessingJobId(matchId, resultRevision));
  const legacyJobRef = db.collection(collections.processingJobs).doc(`MATCH_RESULT_${matchId}`);

  const finalization = await db.runTransaction(async (transaction) => {
    const [currentMatchSnapshot, revisionedJobSnapshot, legacyJobSnapshot] = await Promise.all([
      transaction.get(matchRef),
      transaction.get(revisionedJobRef),
      transaction.get(legacyJobRef),
    ]);
    if (!currentMatchSnapshot.exists) throw new HttpsError("not-found", "Match disappeared during records rebuild.");
    const currentMatch = currentMatchSnapshot.data() as MatchForRecords;
    if (currentMatch.status !== "COMPLETED" || currentMatch.activeResultDisputeId) {
      throw new HttpsError("failed-precondition", "Match state changed during records rebuild; run it again.");
    }
    if (canonicalRevision(currentMatch.canonicalResult) !== resultRevision) {
      throw new HttpsError("failed-precondition", "Canonical result changed during records rebuild; run it again.");
    }

    const jobSnapshot = revisionedJobSnapshot.exists
      ? revisionedJobSnapshot
      : resultRevision === 1 && legacyJobSnapshot.exists
        ? legacyJobSnapshot
        : null;
    if (!jobSnapshot) throw new HttpsError("failed-precondition", "No processing job exists for the current result revision.");

    const job = jobSnapshot.data() as ProcessingJob;
    if (job.status === "BLOCKED" || job.status === "SUPERSEDED") {
      throw new HttpsError("failed-precondition", "The current result processing job cannot process records.");
    }

    await reserveIdempotencyKey(transaction, requestId, "adminProcessRecords", actor.authUid);
    const completedSteps = new Set(job.completedSteps ?? []);
    const alreadyProcessed = completedSteps.has("RECORDS");
    completedSteps.add("RECORDS");
    const pendingSteps = (job.pendingSteps ?? []).filter((step) => step !== "RECORDS");
    const now = Timestamp.now();

    transaction.update(jobSnapshot.ref, {
      status: pendingSteps.length ? "PENDING" : "COMPLETED",
      completedSteps: [...completedSteps],
      pendingSteps,
      attempts: Number(job.attempts ?? 0) + 1,
      lastError: null,
      updatedAt: now,
      ...(pendingSteps.length ? {} : { completedAt: now }),
    });
    transaction.update(matchRef, {
      recordsProcessedRevision: resultRevision,
      recordsSchemaVersion: REPLAY_RECORDS_VERSION,
      recordsRebuiltAt: rebuilt.rebuiltAt,
      processingState: pendingSteps.length ? "PENDING" : "COMPLETE",
      updatedAt: now,
    });
    writeAdminAudit(transaction, {
      actorUid: actor.authUid,
      actorPlayerId: actor.playerId,
      action: "RESULT_RECORDS_REBUILT",
      targetType: "MATCH",
      targetId: matchId,
      after: {
        resultRevision,
        schemaVersion: REPLAY_RECORDS_VERSION,
        lifetimePlayers: rebuilt.lifetimePlayers,
        seasonalPlayers: rebuilt.seasonalPlayers,
        lifetimeRecords: rebuilt.lifetimeRecords.length,
        seasonsWithRecords: rebuilt.seasonalRecords.length,
      },
    });

    return { alreadyProcessed, pendingSteps };
  });

  return {
    success: true,
    matchId,
    resultRevision,
    schemaVersion: REPLAY_RECORDS_VERSION,
    lifetimeRecords: rebuilt.lifetimeRecords.length,
    seasonsWithRecords: rebuilt.seasonalRecords.length,
    alreadyProcessed: finalization.alreadyProcessed,
    remainingSteps: finalization.pendingSteps,
  };
});
