import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import { callableOptions } from "../../config/runtime.js";
import { collections } from "../../domain/collections.js";
import type { CanonicalGameResult, MatchFormat, MatchParticipant } from "../../domain/types.js";
import {
  POWER_RATING_ALGORITHM,
  POWER_RATING_VERSION,
  rebuildPowerRatings,
  type PowerRatingMatchInput,
} from "../../engines/powerRatingEngine.js";
import { writeAdminAudit } from "../../services/audit.js";
import { reserveIdempotencyKey } from "../../services/idempotency.js";
import { canonicalRevision, resultProcessingJobId } from "../results/resultSupport.js";

interface ProcessPowerRatingsInput {
  requestId: string;
  matchId: string;
}

interface MatchForRating {
  status?: string;
  format?: MatchFormat;
  participants?: MatchParticipant[];
  canonicalResult?: (Partial<CanonicalGameResult> & Record<string, unknown>) | null;
  context?: { affectsPowerRating?: boolean } | null;
  activeResultDisputeId?: string | null;
  completedAt?: Timestamp | null;
  firstCompletedAt?: Timestamp | null;
}

interface ProcessingJob {
  status?: string;
  resultRevision?: number;
  pendingSteps?: string[];
  completedSteps?: string[];
  attempts?: number;
}

function timestampMillis(value: unknown): number | null {
  return value instanceof Timestamp ? value.toMillis() : null;
}

async function resolveStableOrderAt(
  matchSnapshot: FirebaseFirestore.QueryDocumentSnapshot,
  match: MatchForRating,
): Promise<number> {
  const firstCompletedAt = timestampMillis(match.firstCompletedAt);
  if (firstCompletedAt != null) return firstCompletedAt;

  const revision = canonicalRevision(match.canonicalResult);
  if (revision > 1) {
    const historySnapshot = await matchSnapshot.ref.collection("resultHistory").doc("R1").get();
    if (historySnapshot.exists) {
      const acceptedAt = historySnapshot.data()?.canonicalResult?.acceptedAt;
      const historyMillis = timestampMillis(acceptedAt);
      if (historyMillis != null) return historyMillis;
    }
  }

  const completedAt = timestampMillis(match.completedAt);
  if (completedAt != null) return completedAt;

  throw new HttpsError(
    "failed-precondition",
    `Completed Match ${matchSnapshot.id} is missing a stable completion timestamp.`,
  );
}

function assertRateableMatch(
  snapshot: FirebaseFirestore.QueryDocumentSnapshot,
  data: MatchForRating,
): asserts data is MatchForRating & {
  format: MatchFormat;
  participants: MatchParticipant[];
  canonicalResult: CanonicalGameResult;
} {
  if (!data.format || !Array.isArray(data.participants) || data.participants.length < 2 || !data.canonicalResult) {
    throw new HttpsError(
      "failed-precondition",
      `Completed Match ${snapshot.id} is missing rating inputs.`,
    );
  }
  if (data.canonicalResult.type !== "TEAM_WIN" && data.canonicalResult.type !== "PLAYER_WIN") {
    throw new HttpsError(
      "failed-precondition",
      `Completed Match ${snapshot.id} has an unsupported canonical result.`,
    );
  }
}

export const adminProcessPowerRatings = onCall<ProcessPowerRatingsInput>(callableOptions, async (request) => {
  const actor = await requireAdmin(request);
  const { requestId, matchId } = request.data;

  if (!matchId) {
    throw new HttpsError("invalid-argument", "matchId is required.");
  }

  const triggerMatchRef = db.collection(collections.matches).doc(matchId);
  const triggerSnapshot = await triggerMatchRef.get();
  if (!triggerSnapshot.exists) throw new HttpsError("not-found", "Match not found.");

  const triggerMatch = triggerSnapshot.data() as MatchForRating;
  if (triggerMatch.status !== "COMPLETED" || !triggerMatch.canonicalResult) {
    throw new HttpsError("failed-precondition", "Only a completed Match with a canonical result can trigger rating processing.");
  }
  if (triggerMatch.activeResultDisputeId) {
    throw new HttpsError("failed-precondition", "Power Rating processing is blocked while a result dispute is open.");
  }

  const completedSnapshot = await db.collection(collections.matches)
    .where("status", "==", "COMPLETED")
    .get();

  const eligible = completedSnapshot.docs
    .map((snapshot) => ({ snapshot, data: snapshot.data() as MatchForRating }))
    .filter(({ data }) => (
      data.context?.affectsPowerRating === true &&
      !data.activeResultDisputeId &&
      data.canonicalResult
    ));

  const ratingMatches: PowerRatingMatchInput[] = await Promise.all(
    eligible.map(async ({ snapshot, data }) => {
      assertRateableMatch(snapshot, data);
      const orderAtMs = await resolveStableOrderAt(snapshot, data);
      return {
        matchId: snapshot.id,
        format: data.format,
        participants: data.participants,
        canonicalResult: {
          ...data.canonicalResult,
          revision: canonicalRevision(data.canonicalResult),
        } as CanonicalGameResult,
        orderAtMs,
      };
    }),
  );

  if (!ratingMatches.some((match) => match.matchId === matchId)) {
    throw new HttpsError("failed-precondition", "The triggering Match is not eligible to affect Power Rating.");
  }

  let rebuilt;
  try {
    rebuilt = rebuildPowerRatings(ratingMatches);
  } catch (error) {
    throw new HttpsError(
      "failed-precondition",
      error instanceof Error ? error.message : "Power Rating rebuild failed.",
    );
  }

  const playerIds = [...new Set(ratingMatches.flatMap((match) => match.participants.map((participant) => participant.playerId)))];
  const playerRefs = playerIds.map((playerId) => db.collection(collections.players).doc(playerId));
  const playerSnapshots = await Promise.all(playerRefs.map((ref) => ref.get()));
  const missingPlayer = playerSnapshots.find((snapshot) => !snapshot.exists);
  if (missingPlayer) {
    throw new HttpsError("failed-precondition", `Rated player ${missingPlayer.id} no longer exists.`);
  }

  const existingHistory = await Promise.all(
    playerRefs.map((playerRef) => playerRef.collection("ratingHistory")
      .where("algorithmVersion", "==", POWER_RATING_VERSION)
      .get()),
  );

  const rebuildAt = Timestamp.now();
  const writer = db.bulkWriter();

  for (const historySnapshot of existingHistory) {
    for (const historyDocument of historySnapshot.docs) {
      writer.delete(historyDocument.ref);
    }
  }

  for (const entry of rebuilt.history) {
    const historyRef = db.collection(collections.players)
      .doc(entry.playerId)
      .collection("ratingHistory")
      .doc(entry.matchId);
    writer.set(historyRef, {
      previousRating: entry.previousRating,
      newRating: entry.newRating,
      delta: entry.delta,
      expectedScore: entry.expectedScore,
      actualScore: entry.actualScore,
      algorithm: POWER_RATING_ALGORITHM,
      algorithmVersion: POWER_RATING_VERSION,
      matchId: entry.matchId,
      sourceRevision: entry.sourceRevision,
      ratedMatchNumber: entry.ratedMatchNumber,
      provisionalAfter: entry.provisionalAfter,
      orderAt: Timestamp.fromMillis(entry.orderAtMs),
      reason: "MATCH_RESULT",
      rebuiltAt: rebuildAt,
    });
  }

  for (const projection of rebuilt.projections) {
    const playerRef = db.collection(collections.players).doc(projection.playerId);
    writer.update(playerRef, {
      currentPowerRating: projection.currentPowerRating,
      powerRatingGames: projection.ratedMatchCount,
      provisionalRating: projection.provisionalRating,
      powerRatingAlgorithmVersion: POWER_RATING_VERSION,
      powerRatingUpdatedAt: rebuildAt,
      updatedAt: rebuildAt,
    });
  }

  for (const ratingMatch of ratingMatches) {
    const sourceSnapshot = eligible.find(({ snapshot }) => snapshot.id === ratingMatch.matchId)?.data;
    if (!sourceSnapshot?.firstCompletedAt) {
      writer.update(db.collection(collections.matches).doc(ratingMatch.matchId), {
        firstCompletedAt: Timestamp.fromMillis(ratingMatch.orderAtMs),
      });
    }
  }

  await writer.close();

  const triggerRevision = canonicalRevision(triggerMatch.canonicalResult);
  const revisionedJobRef = db.collection(collections.processingJobs)
    .doc(resultProcessingJobId(matchId, triggerRevision));
  const legacyJobRef = db.collection(collections.processingJobs).doc(`MATCH_RESULT_${matchId}`);

  const finalization = await db.runTransaction(async (transaction) => {
    const [currentTriggerSnapshot, revisionedJobSnapshot, legacyJobSnapshot] = await Promise.all([
      transaction.get(triggerMatchRef),
      transaction.get(revisionedJobRef),
      transaction.get(legacyJobRef),
    ]);

    if (!currentTriggerSnapshot.exists) throw new HttpsError("not-found", "Match disappeared during rating rebuild.");
    const currentTrigger = currentTriggerSnapshot.data() as MatchForRating;
    if (currentTrigger.activeResultDisputeId || currentTrigger.status !== "COMPLETED") {
      throw new HttpsError("failed-precondition", "Match state changed during rating rebuild; run it again after resolution.");
    }
    if (canonicalRevision(currentTrigger.canonicalResult) !== triggerRevision) {
      throw new HttpsError("failed-precondition", "Canonical result changed during rating rebuild; run it again.");
    }

    const jobSnapshot = revisionedJobSnapshot.exists
      ? revisionedJobSnapshot
      : triggerRevision === 1 && legacyJobSnapshot.exists
        ? legacyJobSnapshot
        : null;
    if (!jobSnapshot) {
      throw new HttpsError("failed-precondition", "No processing job exists for the current result revision.");
    }

    const job = jobSnapshot.data() as ProcessingJob;
    if (job.status === "BLOCKED" || job.status === "SUPERSEDED") {
      throw new HttpsError("failed-precondition", "The current result processing job cannot process ratings.");
    }

    await reserveIdempotencyKey(
      transaction,
      requestId,
      "adminProcessPowerRatings",
      actor.authUid,
    );

    const completedSteps = new Set(job.completedSteps ?? []);
    const alreadyProcessed = completedSteps.has("POWER_RATING");
    completedSteps.add("POWER_RATING");
    const pendingSteps = (job.pendingSteps ?? []).filter((step) => step !== "POWER_RATING");
    const jobCompleted = pendingSteps.length === 0;
    const now = Timestamp.now();

    transaction.update(jobSnapshot.ref, {
      status: jobCompleted ? "COMPLETED" : "PENDING",
      completedSteps: [...completedSteps],
      pendingSteps,
      attempts: Number(job.attempts ?? 0) + 1,
      lastError: null,
      updatedAt: now,
      ...(jobCompleted ? { completedAt: now } : {}),
    });

    transaction.update(triggerMatchRef, {
      processingState: jobCompleted ? "COMPLETE" : "PENDING",
      powerRatingProcessedRevision: triggerRevision,
      powerRatingAlgorithmVersion: POWER_RATING_VERSION,
      powerRatingRebuiltAt: rebuildAt,
      updatedAt: now,
    });

    writeAdminAudit(transaction, {
      actorUid: actor.authUid,
      actorPlayerId: actor.playerId,
      action: "POWER_RATINGS_REBUILT",
      targetType: "MATCH",
      targetId: matchId,
      after: {
        triggerResultRevision: triggerRevision,
        algorithmVersion: POWER_RATING_VERSION,
        ratedMatches: ratingMatches.length,
        ratedPlayers: rebuilt.projections.length,
        historyEntries: rebuilt.history.length,
      },
    });

    return { alreadyProcessed, pendingSteps };
  });

  const triggerPlayerIds = new Set(triggerMatch.participants?.map((participant) => participant.playerId) ?? []);
  const triggerPlayerRatings = rebuilt.projections
    .filter((projection) => triggerPlayerIds.has(projection.playerId))
    .map((projection) => ({
      playerId: projection.playerId,
      rating: projection.currentPowerRating,
      ratedMatchCount: projection.ratedMatchCount,
      provisional: projection.provisionalRating,
    }));

  return {
    success: true,
    matchId,
    resultRevision: triggerRevision,
    algorithmVersion: POWER_RATING_VERSION,
    ratedMatches: ratingMatches.length,
    ratedPlayers: rebuilt.projections.length,
    historyEntries: rebuilt.history.length,
    alreadyProcessed: finalization.alreadyProcessed,
    remainingSteps: finalization.pendingSteps,
    triggerPlayerRatings,
  };
});
