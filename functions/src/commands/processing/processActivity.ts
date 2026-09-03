import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import { callableOptions } from "../../config/runtime.js";
import { collections, leagueStateDocumentId } from "../../domain/collections.js";
import type { CanonicalGameResult, MatchFormat, MatchParticipant } from "../../domain/types.js";
import { writeAdminAudit } from "../../services/audit.js";
import { reserveIdempotencyKey } from "../../services/idempotency.js";
import {
  adminResultProcessingActor,
  type ResultProcessingActor,
} from "../../services/resultProcessingActor.js";
import { canonicalRevision, resultProcessingJobId } from "../results/resultSupport.js";

export const RESULT_ACTIVITY_VERSION = "RESULT_ACTIVITY_V1";

export interface ProcessActivityInput {
  requestId: string;
  matchId: string;
}

interface MatchForActivity {
  status?: string;
  seasonId?: string | null;
  eventId?: string | null;
  challengeId?: string | null;
  format?: MatchFormat;
  participants?: MatchParticipant[];
  canonicalResult?: (Partial<CanonicalGameResult> & Record<string, unknown>) | null;
  activeResultDisputeId?: string | null;
  processingState?: string | null;
  firstCompletedAt?: Timestamp | null;
  completedAt?: Timestamp | null;
}

interface ProcessingJob {
  status?: string;
  pendingSteps?: string[];
  completedSteps?: string[];
  attempts?: number;
}

function activityAt(match: MatchForActivity): Timestamp {
  if (match.firstCompletedAt instanceof Timestamp) return match.firstCompletedAt;
  if (match.completedAt instanceof Timestamp) return match.completedAt;
  return Timestamp.now();
}

export async function processActivity(
  input: ProcessActivityInput,
  actor: ResultProcessingActor,
) {
  const { requestId, matchId } = input;
  if (!requestId || !matchId) throw new HttpsError("invalid-argument", "requestId and matchId are required.");

  const matchRef = db.collection(collections.matches).doc(matchId);
  const matchSnapshot = await matchRef.get();
  if (!matchSnapshot.exists) throw new HttpsError("not-found", "Match not found.");

  const match = matchSnapshot.data() as MatchForActivity;
  if (match.status !== "COMPLETED" || !match.canonicalResult) {
    throw new HttpsError("failed-precondition", "Only a completed Match with a canonical result can trigger activity.");
  }
  if (match.activeResultDisputeId) {
    throw new HttpsError("failed-precondition", "Activity processing is blocked while a result dispute is open.");
  }
  if (!match.format || !Array.isArray(match.participants) || match.participants.length < 2) {
    throw new HttpsError("failed-precondition", "Completed Match is missing activity inputs.");
  }

  const revision = canonicalRevision(match.canonicalResult);
  const playerIds = match.participants.map((participant) => participant.playerId);
  const winningPlayerIds = Array.isArray(match.canonicalResult.winningPlayerIds)
    ? match.canonicalResult.winningPlayerIds
    : [];
  const feedRef = db.collection(collections.activity).doc(`MATCH_RESULT_${matchId}`);
  const revisionedJobRef = db.collection(collections.processingJobs).doc(resultProcessingJobId(matchId, revision));
  const legacyJobRef = db.collection(collections.processingJobs).doc(`MATCH_RESULT_${matchId}`);
  const occurredAt = activityAt(match);

  const result = await db.runTransaction(async (transaction) => {
    const [currentMatchSnapshot, revisionedJobSnapshot, legacyJobSnapshot, existingActivitySnapshot] = await Promise.all([
      transaction.get(matchRef),
      transaction.get(revisionedJobRef),
      transaction.get(legacyJobRef),
      transaction.get(feedRef),
    ]);
    if (!currentMatchSnapshot.exists) throw new HttpsError("not-found", "Match disappeared during activity processing.");
    const currentMatch = currentMatchSnapshot.data() as MatchForActivity;
    if (currentMatch.status !== "COMPLETED" || currentMatch.activeResultDisputeId) {
      throw new HttpsError("failed-precondition", "Match state changed during activity processing; run it again.");
    }
    if (canonicalRevision(currentMatch.canonicalResult) !== revision) {
      throw new HttpsError("failed-precondition", "Canonical result changed during activity processing; run it again.");
    }

    const jobSnapshot = revisionedJobSnapshot.exists
      ? revisionedJobSnapshot
      : revision === 1 && legacyJobSnapshot.exists
        ? legacyJobSnapshot
        : null;
    if (!jobSnapshot) throw new HttpsError("failed-precondition", "No processing job exists for the current result revision.");

    const job = jobSnapshot.data() as ProcessingJob;
    if (job.status === "BLOCKED" || job.status === "SUPERSEDED") {
      throw new HttpsError("failed-precondition", "The current result processing job cannot process activity.");
    }

    let challengeRef: FirebaseFirestore.DocumentReference | null = null;
    let challengeSnapshot: FirebaseFirestore.DocumentSnapshot | null = null;
    if (currentMatch.challengeId) {
      challengeRef = db.collection(collections.challenges).doc(currentMatch.challengeId);
      challengeSnapshot = await transaction.get(challengeRef);
    }

    let eventRef: FirebaseFirestore.DocumentReference | null = null;
    let eventSnapshot: FirebaseFirestore.DocumentSnapshot | null = null;
    let eventMatchesSnapshot: FirebaseFirestore.QuerySnapshot | null = null;
    let leagueStateSnapshot: FirebaseFirestore.DocumentSnapshot | null = null;
    const leagueStateRef = db.collection(collections.leagueState).doc(leagueStateDocumentId);
    if (currentMatch.eventId) {
      eventRef = db.collection(collections.events).doc(currentMatch.eventId);
      [eventSnapshot, eventMatchesSnapshot, leagueStateSnapshot] = await Promise.all([
        transaction.get(eventRef),
        transaction.get(db.collection(collections.matches).where("eventId", "==", currentMatch.eventId)),
        transaction.get(leagueStateRef),
      ]);
    }

    if (actor.source === "ADMIN") {
      await reserveIdempotencyKey(transaction, requestId, "adminProcessActivity", actor.authUid);
    }
    const completedSteps = new Set(job.completedSteps ?? []);
    const alreadyProcessed = completedSteps.has("ACTIVITY");
    completedSteps.add("ACTIVITY");
    const pendingSteps = (job.pendingSteps ?? []).filter((step) => step !== "ACTIVITY");
    const now = Timestamp.now();

    transaction.set(feedRef, {
      schemaVersion: RESULT_ACTIVITY_VERSION,
      type: "MATCH_RESULT",
      matchId,
      seasonId: currentMatch.seasonId ?? null,
      eventId: currentMatch.eventId ?? null,
      challengeId: currentMatch.challengeId ?? null,
      format: currentMatch.format,
      playerIds,
      winningPlayerIds,
      resultRevision: revision,
      resultSource: currentMatch.canonicalResult?.source ?? null,
      occurredAt,
      createdAt: existingActivitySnapshot.exists
        ? existingActivitySnapshot.data()?.createdAt ?? now
        : now,
      updatedAt: now,
    }, { merge: false });

    if (challengeRef && challengeSnapshot?.exists && challengeSnapshot.data()?.matchId === matchId) {
      transaction.set(challengeRef, {
        status: "COMPLETED",
        completedAt: occurredAt,
        winningPlayerIds,
        resultRevision: revision,
        updatedAt: now,
      }, { merge: true });
    }

    let eventCompleted = false;
    if (eventRef && eventSnapshot?.exists && eventMatchesSnapshot && pendingSteps.length === 0) {
      const allMatchesFinished = eventMatchesSnapshot.docs.length > 0 && eventMatchesSnapshot.docs.every((document) => {
        if (document.id === matchId) return true;
        const data = document.data() as MatchForActivity;
        if (data.status === "CANCELLED") return true;
        return data.status === "COMPLETED" && data.processingState === "COMPLETE";
      });

      const eventStatus = eventSnapshot.data()?.status;
      if (allMatchesFinished && eventStatus !== "COMPLETED" && eventStatus !== "CANCELLED") {
        const eventPlayerIds = [...new Set(eventMatchesSnapshot.docs.flatMap((document) => {
          const data = document.data() as MatchForActivity;
          return Array.isArray(data.participants) ? data.participants.map((participant) => participant.playerId) : [];
        }))];

        transaction.set(eventRef, {
          status: "COMPLETED",
          featured: false,
          completedAt: now,
          updatedAt: now,
        }, { merge: true });
        if (leagueStateSnapshot?.exists && leagueStateSnapshot.data()?.featuredEventId === currentMatch.eventId) {
          transaction.set(leagueStateRef, {
            featuredEventId: null,
            updatedAt: now,
          }, { merge: true });
        }
        transaction.set(db.collection(collections.activity).doc(`EVENT_COMPLETED_${currentMatch.eventId}`), {
          schemaVersion: "EVENT_ACTIVITY_V1",
          type: "EVENT_COMPLETED",
          eventId: currentMatch.eventId,
          seasonId: currentMatch.seasonId ?? null,
          playerIds: eventPlayerIds,
          matchIds: eventMatchesSnapshot.docs.map((document) => document.id),
          occurredAt: now,
          createdAt: now,
          updatedAt: now,
        }, { merge: true });
        eventCompleted = true;
      }
    }

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
      activityProcessedRevision: revision,
      activitySchemaVersion: RESULT_ACTIVITY_VERSION,
      activityUpdatedAt: now,
      processingState: pendingSteps.length ? "PENDING" : "COMPLETE",
      updatedAt: now,
    });
    writeAdminAudit(transaction, {
      actorUid: actor.authUid,
      actorPlayerId: actor.playerId,
      action: "RESULT_ACTIVITY_PUBLISHED",
      targetType: "MATCH",
      targetId: matchId,
      after: {
        resultRevision: revision,
        schemaVersion: RESULT_ACTIVITY_VERSION,
        activityId: feedRef.id,
        challengeId: currentMatch.challengeId ?? null,
        eventCompleted,
        processingSource: actor.source,
      },
    });

    return { alreadyProcessed, pendingSteps, eventCompleted };
  });

  return {
    success: true,
    matchId,
    resultRevision: revision,
    schemaVersion: RESULT_ACTIVITY_VERSION,
    activityId: feedRef.id,
    alreadyProcessed: result.alreadyProcessed,
    eventCompleted: result.eventCompleted,
    remainingSteps: result.pendingSteps,
  };
}

export const adminProcessActivity = onCall<ProcessActivityInput>(callableOptions, async (request) => {
  const actor = await requireAdmin(request);
  return processActivity(request.data, adminResultProcessingActor(actor));
});
