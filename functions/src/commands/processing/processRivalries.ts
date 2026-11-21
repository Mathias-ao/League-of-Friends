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
import {relationshipQueryRevision,relationshipReplacementPlan,relationshipPairUnchanged} from "../../engines/relationshipAtomicPlan.js";
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
  eventId?: string | null;
  seasonId?: string | null;
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
  const completedQuery=db.collection(collections.matches).where("status", "==", "COMPLETED");
  const relationshipsQuery=db.collection(collections.relationships);
  const [triggerSnapshot, completedSnapshot, existingRelationships] = await Promise.all([
    triggerMatchRef.get(),completedQuery.get(),relationshipsQuery.get(),
  ]);
  if(completedSnapshot.size>250||existingRelationships.size>450)
    throw new HttpsError("failed-precondition",
      "Atomic relationship rebuild is outside the current bounded league limit.");

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
        eventId: match.eventId ?? null,
        seasonId: match.seasonId ?? null,
        orderAtMs: stableOrderAt(snapshot, match),
        format: match.format,
        participants: match.participants,
        canonicalResult: {
          ...match.canonicalResult,
          revision: canonicalRevision(match.canonicalResult),
        } as CanonicalGameResult,
        affectsLifetimeStats: match.context?.affectsLifetimeStats === true,
        // V2 never treats missing Battle Statistics as proof of non-interaction.
        // This remains UNAVAILABLE until replay-derived social signals are durably
        // supplied by the Match/Battle Statistics pipeline.
        interactionCoverage: "UNAVAILABLE" as const,
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
  const replacements=histories.map(history=>({
    pairId:history.pairId,
    doc:{
      schemaVersion: PAIR_HISTORY_VERSION,
      pairId: history.pairId,
      playerOneId: history.playerOneId,
      playerTwoId: history.playerTwoId,
      pairHistory: history,
      relationship: evaluateRelationship(history, null),
      chronicle: history.chronicle,
      relationshipEngineVersion: RELATIONSHIP_ENGINE_VERSION,
      relationshipRuleVersion: null,
      relationshipRulesConfigured: false,
      interactionCoverage: "UNAVAILABLE",
      updatedAt: rebuiltAt,
    },
  }));
  // Keep a structurally identical pair untouched, including its write time;
  // one corrected Battle must not churn unrelated player/Chronicle documents.
  const priorPairs=new Map(existingRelationships.docs.map(doc=>[doc.id,doc.data()]));
  const changedReplacements=replacements.filter(row=>
    !relationshipPairUnchanged(priorPairs.get(row.pairId),row.doc));
  let plan;
  try{
    plan=relationshipReplacementPlan(existingRelationships.docs.map(doc=>doc.id),
      replacements.map(row=>row.pairId));
  }catch(error){
    throw new HttpsError("failed-precondition",
      error instanceof Error?error.message:"Unsafe relationship replacement.");
  }
  const completedWitness=relationshipQueryRevision(completedSnapshot.docs);
  const relationshipWitness=relationshipQueryRevision(existingRelationships.docs);
  const triggerRevision = canonicalRevision(triggerMatch.canonicalResult);
  const revisionedJobRef = db.collection(collections.processingJobs).doc(resultProcessingJobId(matchId, triggerRevision));
  const legacyJobRef = db.collection(collections.processingJobs).doc(`MATCH_RESULT_${matchId}`);

  const finalization = await db.runTransaction(async (transaction) => {
    const [currentMatchSnapshot, revisionedJobSnapshot, legacyJobSnapshot,
      currentMatches, currentRelationships] = await Promise.all([
      transaction.get(triggerMatchRef),
      transaction.get(revisionedJobRef),
      transaction.get(legacyJobRef),
      transaction.get(completedQuery),
      transaction.get(relationshipsQuery),
    ]);
    if(relationshipQueryRevision(currentMatches.docs)!==completedWitness||
       relationshipQueryRevision(currentRelationships.docs)!==relationshipWitness)
      throw new HttpsError("aborted",
        "Matches or relationships changed while rebuilding. Retry with current sources.");
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

    // The idempotency service MAY READ the transaction. Every read must
    // finish before ANY paired-history set/delete or processing-job update.
    if (actor.source === "ADMIN") {
      await reserveIdempotencyKey(transaction, requestId, "adminProcessRivalries", actor.authUid);
    }
    // Atomically replace only current pairs, remove genuinely obsolete pairs,
    // and finish the processing job together. No external bulk-writer window.
    if(replacements.length+plan.obsoletePairIds.length!==plan.totalPairWrites)
      throw new HttpsError("aborted","Relationship replacement plan changed.");
    for(const row of changedReplacements)
      transaction.set(relationshipsQuery.doc(row.pairId),row.doc);
    for(const obsoleteId of plan.obsoletePairIds)
      transaction.delete(relationshipsQuery.doc(obsoleteId));
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
        chronicleEntries: histories.reduce((sum, history) => sum + history.chronicle.length, 0),
        relationshipRulesConfigured: false,
        interactionCoverage: "UNAVAILABLE",
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
    interactionCoverage: "UNAVAILABLE",
    pairHistories: histories.length,
    chronicleEntries: histories.reduce((sum, history) => sum + history.chronicle.length, 0),
    alreadyProcessed: finalization.alreadyProcessed,
    remainingSteps: finalization.pendingSteps,
  };
}

export const adminProcessRivalries = onCall<ProcessRivalriesInput>(callableOptions, async (request) => {
  const actor = await requireAdmin(request);
  return processRivalries(request.data, adminResultProcessingActor(actor));
});
