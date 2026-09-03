import { Timestamp } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { db } from "../config/firebase.js";
import { collections } from "../domain/collections.js";
import { processAchievements } from "../commands/processing/processAchievements.js";
import { processActivity } from "../commands/processing/processActivity.js";
import { processMatchRewards } from "../commands/processing/processMatchRewards.js";
import { processPowerRatings } from "../commands/processing/processPowerRatings.js";
import { processRecords } from "../commands/processing/processRecords.js";
import { processRivalries } from "../commands/processing/processRivalries.js";
import { processStatistics } from "../commands/processing/processStatistics.js";
import { SYSTEM_RESULT_PROCESSING_ACTOR } from "../services/resultProcessingActor.js";

interface ResultProcessingJob {
  type?: string;
  status?: string;
  matchId?: string;
  resultRevision?: number;
  pendingSteps?: string[];
  completedSteps?: string[];
  automation?: {
    status?: string;
    eventId?: string;
    attempts?: number;
    startedAt?: Timestamp | null;
    leaseExpiresAt?: Timestamp | null;
    completedAt?: Timestamp | null;
    lastError?: string | null;
  } | null;
}

const LEASE_MS = 10 * 60 * 1000;
const MATCH_RESULT_TYPES = new Set(["MATCH_RESULT_ACCEPTED", "MATCH_RESULT_CORRECTED"]);

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 2000);
  return String(error).slice(0, 2000);
}

function isPermanentPipelineError(error: unknown): boolean {
  if (!(error instanceof HttpsError)) return false;
  return [
    "invalid-argument",
    "failed-precondition",
    "not-found",
    "permission-denied",
  ].includes(error.code);
}

async function readJob(jobRef: FirebaseFirestore.DocumentReference): Promise<ResultProcessingJob | null> {
  const snapshot = await jobRef.get();
  return snapshot.exists ? snapshot.data() as ResultProcessingJob : null;
}

async function claimJob(
  jobRef: FirebaseFirestore.DocumentReference,
  eventId: string,
): Promise<{ claimed: boolean; matchId: string | null; revision: number | null }> {
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(jobRef);
    if (!snapshot.exists) return { claimed: false, matchId: null, revision: null };

    const job = snapshot.data() as ResultProcessingJob;
    if (!MATCH_RESULT_TYPES.has(job.type ?? "")) {
      return { claimed: false, matchId: null, revision: null };
    }
    if (!job.matchId || !Number.isInteger(job.resultRevision)) {
      throw new Error(`Result processing job ${snapshot.id} is missing matchId or resultRevision.`);
    }
    if (job.status === "COMPLETED" || job.status === "BLOCKED" || job.status === "SUPERSEDED") {
      return { claimed: false, matchId: job.matchId, revision: job.resultRevision ?? null };
    }

    const now = Timestamp.now();
    const automation = job.automation ?? {};
    const leaseExpiresAt = automation.leaseExpiresAt;
    if (
      automation.status === "RUNNING" &&
      leaseExpiresAt instanceof Timestamp &&
      leaseExpiresAt.toMillis() > now.toMillis()
    ) {
      throw new Error(`Result processing job ${snapshot.id} already has an active automation lease.`);
    }

    transaction.set(jobRef, {
      automation: {
        status: "RUNNING",
        eventId,
        attempts: Number(automation.attempts ?? 0) + 1,
        startedAt: automation.startedAt instanceof Timestamp ? automation.startedAt : now,
        leaseExpiresAt: Timestamp.fromMillis(now.toMillis() + LEASE_MS),
        completedAt: null,
        lastError: null,
        updatedAt: now,
      },
      updatedAt: now,
    }, { merge: true });

    return { claimed: true, matchId: job.matchId, revision: job.resultRevision ?? null };
  });
}

async function markAutomationComplete(jobRef: FirebaseFirestore.DocumentReference): Promise<void> {
  const now = Timestamp.now();
  await jobRef.set({
    automation: {
      status: "COMPLETED",
      leaseExpiresAt: null,
      completedAt: now,
      lastError: null,
      updatedAt: now,
    },
    updatedAt: now,
  }, { merge: true });
}

async function markAutomationFailure(
  jobRef: FirebaseFirestore.DocumentReference,
  matchId: string,
  error: unknown,
  permanent: boolean,
): Promise<void> {
  const now = Timestamp.now();
  const message = errorMessage(error);
  const automationStatus = permanent ? "PAUSED" : "RETRYING";
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(jobRef);
    if (!snapshot.exists) return;
    transaction.set(jobRef, {
      automation: {
        status: automationStatus,
        leaseExpiresAt: null,
        lastError: message,
        updatedAt: now,
      },
      lastError: message,
      updatedAt: now,
    }, { merge: true });
    transaction.set(db.collection(collections.matches).doc(matchId), {
      processingState: "PENDING",
      updatedAt: now,
    }, { merge: true });
  });
}

async function pendingSteps(jobRef: FirebaseFirestore.DocumentReference): Promise<string[]> {
  const job = await readJob(jobRef);
  return Array.isArray(job?.pendingSteps) ? job!.pendingSteps! : [];
}

async function hasAnyPending(
  jobRef: FirebaseFirestore.DocumentReference,
  steps: string[],
): Promise<boolean> {
  const pending = new Set(await pendingSteps(jobRef));
  return steps.some((step) => pending.has(step));
}

function systemInput(eventId: string, step: string, matchId: string) {
  return {
    requestId: `AUTO_${eventId}_${step}`,
    matchId,
  };
}

export const processResultJob = onDocumentCreated(
  {
    document: "processingJobs/{jobId}",
    region: "europe-west1",
    retry: true,
    timeoutSeconds: 540,
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const initial = snapshot.data() as ResultProcessingJob;
    if (!MATCH_RESULT_TYPES.has(initial.type ?? "")) return;

    const jobRef = snapshot.ref;
    const claim = await claimJob(jobRef, event.id);
    if (!claim.claimed || !claim.matchId) return;

    const matchId = claim.matchId;
    try {
      if (await hasAnyPending(jobRef, ["SCORING", "GOLD"])) {
        await processMatchRewards(
          systemInput(event.id, "REWARDS", matchId),
          SYSTEM_RESULT_PROCESSING_ACTOR,
        );
      }
      if (await hasAnyPending(jobRef, ["POWER_RATING"])) {
        await processPowerRatings(
          systemInput(event.id, "POWER_RATING", matchId),
          SYSTEM_RESULT_PROCESSING_ACTOR,
        );
      }
      if (await hasAnyPending(jobRef, ["STATISTICS"])) {
        await processStatistics(
          systemInput(event.id, "STATISTICS", matchId),
          SYSTEM_RESULT_PROCESSING_ACTOR,
        );
      }
      if (await hasAnyPending(jobRef, ["ACHIEVEMENTS"])) {
        await processAchievements(
          systemInput(event.id, "ACHIEVEMENTS", matchId),
          SYSTEM_RESULT_PROCESSING_ACTOR,
        );
      }
      if (await hasAnyPending(jobRef, ["RIVALRIES"])) {
        await processRivalries(
          systemInput(event.id, "RIVALRIES", matchId),
          SYSTEM_RESULT_PROCESSING_ACTOR,
        );
      }
      if (await hasAnyPending(jobRef, ["RECORDS"])) {
        await processRecords(
          systemInput(event.id, "RECORDS", matchId),
          SYSTEM_RESULT_PROCESSING_ACTOR,
        );
      }
      if (await hasAnyPending(jobRef, ["ACTIVITY"])) {
        await processActivity(
          systemInput(event.id, "ACTIVITY", matchId),
          SYSTEM_RESULT_PROCESSING_ACTOR,
        );
      }

      const remaining = await pendingSteps(jobRef);
      if (remaining.length > 0) {
        throw new Error(`Automatic result pipeline stopped with pending steps: ${remaining.join(", ")}.`);
      }

      await markAutomationComplete(jobRef);
    } catch (error) {
      const permanent = isPermanentPipelineError(error);
      await markAutomationFailure(jobRef, matchId, error, permanent);
      if (!permanent) throw error;
      console.error(
        `Automatic result pipeline paused for ${matchId}: ${errorMessage(error)}`,
      );
    }
  },
);
