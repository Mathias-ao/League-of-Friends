import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import { callableOptions } from "../../config/runtime.js";
import { collections } from "../../domain/collections.js";
import type { CanonicalGameResult, MatchFormat, MatchParticipant } from "../../domain/types.js";
import {
  PAIR_HISTORY_VERSION,
  RELATIONSHIP_ENGINE_VERSION,
  evaluateRelationship,
  rebuildPairHistory,
  type PairHistoryMatchInput,
} from "../../engines/relationshipEngine.js";
import { writeAdminAudit } from "../../services/audit.js";
import { reserveIdempotencyKey } from "../../services/idempotency.js";
import {
  adminResultProcessingActor,
  type ResultProcessingActor,
} from "../../services/resultProcessingActor.js";
import { canonicalRevision, resultProcessingJobId } from "../results/resultSupport.js";

export interface ProcessRivalriesInput {
  requestId: string;
  matchId: string;
}

interface MatchForRelationships {
  status?: string;
  format?: MatchFormat;
  participants?: MatchParticipant[];
  canonicalResult?: (Partial<CanonicalGameResult> & Record<string, unknown>) | null;
  activeResultDisputeId?: string | null;
  context?: {
    affectsLifetimeStats?: boolean;
    affectsSeasonStats?: boolean;
  } | null;
  completedAt?: Timestamp | null;
  firstCompletedAt?: Timestamp | null;
}

interface ProcessingJob {
  status?: string;
  pendingSteps?: string[];
  completedSteps?: string[];
  attempts?: number;
}

function timestampMillis(value: unknown): number | null {
  return value instanceof Timestamp ? value.toMillis() : null;
}

function stableOrderAt(
  snapshot: FirebaseFirestore.QueryDocumentSnapshot,
  match: MatchForRelationships,
): number {
  const firstCompletedAt = timestampMillis(match.firstCompletedAt);
  if (firstCompletedAt != null) return firstCompletedAt;
  const completedAt = timestampMillis(match.completedAt);
  if (completedAt != null) return completedAt;
  return snapshot.createTime.toMillis();
}

function assertRelationshipMatch(
  snapshot: FirebaseFirestore.QueryDocumentSnapshot,
  match: MatchForRelationships,
): asserts match is MatchForRelationships & {
  format: MatchFormat;
  participants: MatchParticipant[];
  canonicalResult: CanonicalGameResult;
} {
  if (!match.format || !Array.isArray(match.participants) || match.participants.length < 2 || !match.canonicalResult) {
    throw new HttpsError("failed-precondition", `Completed Match ${snapshot.id} is missing relationship inputs.`);
  }
}

export async function processRivalries(
  input: ProcessRivalriesInput,
  actor: ResultProcessingActor,
) {
  const { requestId, matchId } = input;
  if (!requestId || !matchId) throw new HttpsError("invalid-argument", "requestId and matchId are required.");

  const triggerMatchRef = db.collection(collections.matches).doc(matchId);
  const [triggerSnapshot, completedSnapshot, existingRelationships] = await Promise.all([
    triggerMatchRef.get(),
    db.collection(collections.matches).where("status", "==", "COMPLETED").get(),
    db.collection(collections.relationships).get(),
  ]);

  if (!triggerSnapshot.exists) throw new HttpsError("not-found", "Match not found.");
  const triggerMatch = triggerSnapshot.data() as MatchForRelationships;
  if (triggerMatch.status !== "COMPLETED" || !triggerMatch.canonicalResult) {
    throw new HttpsError("failed-precondition", "Only a completed Match with a canonical result can trigger relationship history.");
  }
  if (triggerMatch.activeResultDisputeId) {
    throw new HttpsError("failed-precondition", "Relationship processing is blocked while a result dispute is open.");
  }

  const inputs: PairHistoryMatchInput[] = completedSnapshot.docs
    .map((snapshot) => ({ snapshot, match: snapshot.data() as MatchForRelationships }))
    .filter(({ match }) => (
      !match.activeResultDisputeId &&
      match.canonicalResult &&
      (match.context?.affectsLifetimeStats === true || match.context?.affectsSeasonStats === true)
    ))
    .map(({ snapshot, match }) => {
      assertRelationshipMatch(snapshot, match);
      return {
        matchId: snapshot.id,
        orderAtMs: stableOrderAt(snapshot, match),
        format: match.format,
        participants: match.participants,
        canonicalResult: {
          ...match.canonicalResult,
          revision: canonicalRevision(match.canonicalResult),
        } as CanonicalGameResult,
        affectsLifetimeStats: match.context?.affectsLifetimeStats === true,
        // Replay-derived directional signals are added here once the current Match Statistics
        // projection is durably available to the Functions backend. Until then Pair History is
        // deliberately limited to neutral encounter/team/result evidence.
        signals: [],
      };
    });

  if (!inputs.some((entry) => entry.matchId === matchId)) {
    throw new HttpsError("failed-precondition", "The triggering Match is not eligible to affect relationship processing.");
  }

  let histories;
  try {
    histories = rebuildPairHistory(inputs);
  } catch (error) {
    throw new HttpsError(
      "failed-precondition",
      error instanceof Error ? error.message : "Pair History rebuild failed.",
    );
  }

  const rebuiltAt = Timestamp.now();
  const cleanupWriter = db.bulkWriter();
  for (const document of existingRelationships.docs) cleanupWriter.delete(document.ref);
  await cleanupWriter.close();

  const writer = db.bulkWriter();
  for (const history of histories) {
    const relationship = evaluateRelationship(history, null);
    writer.set(db.collection(collections.relationships).doc(history.pairId), {
      schemaVersion: PAIR_HISTORY_VERSION,
      pairHistory: history,
      relationship,
      relationshipEngineVersion: RELATIONSHIP_ENGINE_VERSION,
      relationshipRuleVersion: null,
      relationshipRulesConfigured: false,
      updatedAt: rebuiltAt,
    });
  }
  await writer.close();

  const triggerRevision = canonicalRevision(triggerMatch.canonicalResult);
  const revisionedJobRef = db.collection(collections.processingJobs).doc(resultProcessingJobId(matchId, triggerRevision));
  const legacyJobRef = db.collection(collections.processingJobs).doc(`MATCH_RESULT_${matchId}`);

  const finalization = await db.runTransaction(async (transaction) => {
    const [currentMatchSnapshot, revisionedJobSnapshot, legacyJobSnapshot] = await Promise.all([
      transaction.get(triggerMatchRef),
      transaction.get(revisionedJobRef),
      transaction.get(legacyJobRef),
    ]);
    if (!currentMatchSnapshot.exists) throw new HttpsError("not-found", "Match disappeared during Pair History rebuild.");
    const currentMatch = currentMatchSnapshot.data() as MatchForRelationships;
    if (currentMatch.status !== "COMPLETED" || currentMatch.activeResultDisputeId) {
      throw new HttpsError("failed-precondition", "Match state changed during Pair History rebuild; run it again.");
    }
    if (canonicalRevision(currentMatch.canonicalResult) !== triggerRevision) {
      throw new HttpsError("failed-precondition", "Canonical result changed during Pair History rebuild; run it again.");
    }

    const jobSnapshot = revisionedJobSnapshot.exists
      ? revisionedJobSnapshot
      : triggerRevision === 1 && legacyJobSnapshot.exists
        ? legacyJobSnapshot
        : null;
    if (!jobSnapshot) throw new HttpsError("failed-precondition", "No processing job exists for the current result revision.");

    const job = jobSnapshot.data() as ProcessingJob;
    if (job.status === "BLOCKED" || job.status === "SUPERSEDED") {
      throw new HttpsError("failed-precondition", "The current processing job cannot process relationship history.");
    }

    if (actor.source === "ADMIN") {
      await reserveIdempotencyKey(transaction, requestId, "adminProcessRivalries", actor.authUid);
    }
    const completedSteps = new Set(job.completedSteps ?? []);
    const alreadyProcessed = completedSteps.has("RIVALRIES");
    completedSteps.add("RIVALRIES");
    const pendingSteps = (job.pendingSteps ?? []).filter((step) => step !== "RIVALRIES");
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
    transaction.update(triggerMatchRef, {
      rivalryProcessedRevision: triggerRevision,
      pairHistoryVersion: PAIR_HISTORY_VERSION,
      relationshipEngineVersion: RELATIONSHIP_ENGINE_VERSION,
      relationshipRuleVersion: null,
      relationshipRulesConfigured: false,
      relationshipRebuiltAt: rebuiltAt,
      processingState: pendingSteps.length ? "PENDING" : "COMPLETE",
      updatedAt: now,
    });
    writeAdminAudit(transaction, {
      actorUid: actor.authUid,
      actorPlayerId: actor.playerId,
      action: "PAIR_HISTORY_REBUILT",
      targetType: "MATCH",
      targetId: matchId,
      after: {
        pairHistoryVersion: PAIR_HISTORY_VERSION,
        relationshipEngineVersion: RELATIONSHIP_ENGINE_VERSION,
        relationshipRuleVersion: null,
        resultRevision: triggerRevision,
        pairHistories: histories.length,
        relationshipRulesConfigured: false,
        processingSource: actor.source,
      },
    });

    return { alreadyProcessed, pendingSteps };
  });

  return {
    success: true,
    matchId,
    resultRevision: triggerRevision,
    pairHistoryVersion: PAIR_HISTORY_VERSION,
    relationshipEngineVersion: RELATIONSHIP_ENGINE_VERSION,
    relationshipRuleVersion: null,
    relationshipRulesConfigured: false,
    pairHistories: histories.length,
    alreadyProcessed: finalization.alreadyProcessed,
    remainingSteps: finalization.pendingSteps,
  };
}

export const adminProcessRivalries = onCall<ProcessRivalriesInput>(callableOptions, async (request) => {
  const actor = await requireAdmin(request);
  return processRivalries(request.data, adminResultProcessingActor(actor));
});
