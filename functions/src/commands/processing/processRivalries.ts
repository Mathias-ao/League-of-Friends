import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import { callableOptions } from "../../config/runtime.js";
import { collections } from "../../domain/collections.js";
import type { CanonicalGameResult, MatchFormat, MatchParticipant } from "../../domain/types.js";
import {
  DEFAULT_RIVALRY_CONFIG,
  RIVALRY_ENGINE_VERSION,
  rebuildRivalries,
  type RivalryMatchInput,
} from "../../engines/rivalryEngine.js";
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

interface MatchForRivalries {
  status?: string;
  seasonId?: string | null;
  format?: MatchFormat;
  participants?: MatchParticipant[];
  canonicalResult?: (Partial<CanonicalGameResult> & Record<string, unknown>) | null;
  activeResultDisputeId?: string | null;
  context?: {
    affectsLifetimeStats?: boolean;
    affectsSeasonStats?: boolean;
  } | null;
}

interface ProcessingJob {
  status?: string;
  pendingSteps?: string[];
  completedSteps?: string[];
  attempts?: number;
}

interface SeasonDocument {
  warRoom?: {
    status?: string;
    openedAt?: Timestamp | null;
    openedByRivalryId?: string | null;
  } | null;
}

function assertRivalryMatch(
  snapshot: FirebaseFirestore.QueryDocumentSnapshot,
  match: MatchForRivalries,
): asserts match is MatchForRivalries & {
  format: MatchFormat;
  participants: MatchParticipant[];
  canonicalResult: CanonicalGameResult;
} {
  if (!match.format || !Array.isArray(match.participants) || match.participants.length < 2 || !match.canonicalResult) {
    throw new HttpsError("failed-precondition", `Completed Match ${snapshot.id} is missing rivalry inputs.`);
  }
}

export async function processRivalries(
  input: ProcessRivalriesInput,
  actor: ResultProcessingActor,
) {
  const { requestId, matchId } = input;
  if (!requestId || !matchId) throw new HttpsError("invalid-argument", "requestId and matchId are required.");

  const triggerMatchRef = db.collection(collections.matches).doc(matchId);
  const [triggerSnapshot, completedSnapshot, seasonsSnapshot] = await Promise.all([
    triggerMatchRef.get(),
    db.collection(collections.matches).where("status", "==", "COMPLETED").get(),
    db.collection(collections.seasons).get(),
  ]);

  if (!triggerSnapshot.exists) throw new HttpsError("not-found", "Match not found.");
  const triggerMatch = triggerSnapshot.data() as MatchForRivalries;
  if (triggerMatch.status !== "COMPLETED" || !triggerMatch.canonicalResult) {
    throw new HttpsError("failed-precondition", "Only a completed Match with a canonical result can trigger rivalries.");
  }
  if (triggerMatch.activeResultDisputeId) {
    throw new HttpsError("failed-precondition", "Rivalry processing is blocked while a result dispute is open.");
  }

  const inputs: RivalryMatchInput[] = completedSnapshot.docs
    .map((snapshot) => ({ snapshot, match: snapshot.data() as MatchForRivalries }))
    .filter(({ match }) => (
      !match.activeResultDisputeId &&
      match.canonicalResult &&
      (match.context?.affectsLifetimeStats === true || match.context?.affectsSeasonStats === true)
    ))
    .map(({ snapshot, match }) => {
      assertRivalryMatch(snapshot, match);
      return {
        matchId: snapshot.id,
        seasonId: match.seasonId ?? null,
        format: match.format,
        participants: match.participants,
        canonicalResult: {
          ...match.canonicalResult,
          revision: canonicalRevision(match.canonicalResult),
        } as CanonicalGameResult,
        affectsLifetimeStats: match.context?.affectsLifetimeStats === true,
        affectsSeasonStats: match.context?.affectsSeasonStats === true,
      };
    });

  if (!inputs.some((entry) => entry.matchId === matchId)) {
    throw new HttpsError("failed-precondition", "The triggering Match is not eligible to affect rivalries.");
  }

  const rebuilt = rebuildRivalries(inputs, DEFAULT_RIVALRY_CONFIG);
  const rebuiltAt = Timestamp.now();
  const writer = db.bulkWriter();

  for (const rivalry of rebuilt.lifetime) {
    writer.set(db.collection(collections.rivalries).doc(rivalry.pairId), {
      ...rivalry,
      engineVersion: RIVALRY_ENGINE_VERSION,
      config: rebuilt.config,
      scope: "LIFETIME",
      seasonId: null,
      updatedAt: rebuiltAt,
    }, { merge: true });
  }

  for (const season of rebuilt.seasonal) {
    const seasonRef = db.collection(collections.seasons).doc(season.seasonId);
    for (const rivalry of season.rivalries) {
      writer.set(seasonRef.collection("rivalries").doc(rivalry.pairId), {
        ...rivalry,
        engineVersion: RIVALRY_ENGINE_VERSION,
        config: rebuilt.config,
        scope: "SEASON",
        seasonId: season.seasonId,
        updatedAt: rebuiltAt,
      }, { merge: true });
    }
  }
  await writer.close();

  const openedSeasons: Array<{ seasonId: string; rivalryId: string }> = [];
  for (const seasonSnapshot of seasonsSnapshot.docs) {
    const seasonData = seasonSnapshot.data() as SeasonDocument;
    const seasonRivalries = rebuilt.seasonal.find((item) => item.seasonId === seasonSnapshot.id)?.rivalries ?? [];
    const qualifier = seasonRivalries.find((rivalry) => rivalry.status === "QUALIFIED") ?? null;
    const currentStatus = seasonData.warRoom?.status === "OPEN" ? "OPEN" : "CLOSED";

    if (currentStatus === "OPEN") continue;
    if (qualifier) {
      await seasonSnapshot.ref.set({
        warRoom: {
          status: "OPEN",
          openedAt: rebuiltAt,
          openedByRivalryId: qualifier.pairId,
          engineVersion: RIVALRY_ENGINE_VERSION,
        },
        updatedAt: rebuiltAt,
      }, { merge: true });
      openedSeasons.push({ seasonId: seasonSnapshot.id, rivalryId: qualifier.pairId });
    } else if (!seasonData.warRoom) {
      await seasonSnapshot.ref.set({
        warRoom: {
          status: "CLOSED",
          openedAt: null,
          openedByRivalryId: null,
          engineVersion: RIVALRY_ENGINE_VERSION,
        },
        updatedAt: rebuiltAt,
      }, { merge: true });
    }
  }

  const triggerRevision = canonicalRevision(triggerMatch.canonicalResult);
  const revisionedJobRef = db.collection(collections.processingJobs).doc(resultProcessingJobId(matchId, triggerRevision));
  const legacyJobRef = db.collection(collections.processingJobs).doc(`MATCH_RESULT_${matchId}`);

  const finalization = await db.runTransaction(async (transaction) => {
    const [currentMatchSnapshot, revisionedJobSnapshot, legacyJobSnapshot] = await Promise.all([
      transaction.get(triggerMatchRef),
      transaction.get(revisionedJobRef),
      transaction.get(legacyJobRef),
    ]);
    if (!currentMatchSnapshot.exists) throw new HttpsError("not-found", "Match disappeared during rivalry rebuild.");
    const currentMatch = currentMatchSnapshot.data() as MatchForRivalries;
    if (currentMatch.status !== "COMPLETED" || currentMatch.activeResultDisputeId) {
      throw new HttpsError("failed-precondition", "Match state changed during rivalry rebuild; run it again.");
    }
    if (canonicalRevision(currentMatch.canonicalResult) !== triggerRevision) {
      throw new HttpsError("failed-precondition", "Canonical result changed during rivalry rebuild; run it again.");
    }

    const jobSnapshot = revisionedJobSnapshot.exists
      ? revisionedJobSnapshot
      : triggerRevision === 1 && legacyJobSnapshot.exists
        ? legacyJobSnapshot
        : null;
    if (!jobSnapshot) throw new HttpsError("failed-precondition", "No processing job exists for the current result revision.");

    const job = jobSnapshot.data() as ProcessingJob;
    if (job.status === "BLOCKED" || job.status === "SUPERSEDED") {
      throw new HttpsError("failed-precondition", "The current processing job cannot process rivalries.");
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
      rivalryEngineVersion: RIVALRY_ENGINE_VERSION,
      rivalryRebuiltAt: rebuiltAt,
      processingState: pendingSteps.length ? "PENDING" : "COMPLETE",
      updatedAt: now,
    });
    writeAdminAudit(transaction, {
      actorUid: actor.authUid,
      actorPlayerId: actor.playerId,
      action: "RIVALRIES_REBUILT",
      targetType: "MATCH",
      targetId: matchId,
      after: {
        engineVersion: RIVALRY_ENGINE_VERSION,
        resultRevision: triggerRevision,
        lifetimeRivalries: rebuilt.lifetime.length,
        seasonalRivalries: rebuilt.seasonal.reduce((sum, season) => sum + season.rivalries.length, 0),
        openedSeasons,
        processingSource: actor.source,
      },
    });

    return { alreadyProcessed, pendingSteps };
  });

  return {
    success: true,
    matchId,
    resultRevision: triggerRevision,
    engineVersion: RIVALRY_ENGINE_VERSION,
    config: rebuilt.config,
    lifetimeRivalries: rebuilt.lifetime.length,
    seasonalRivalries: rebuilt.seasonal.reduce((sum, season) => sum + season.rivalries.length, 0),
    qualifiedLifetime: rebuilt.lifetime.filter((rivalry) => rivalry.status === "QUALIFIED").length,
    qualifiedSeasonal: rebuilt.seasonal.reduce(
      (sum, season) => sum + season.rivalries.filter((rivalry) => rivalry.status === "QUALIFIED").length,
      0,
    ),
    openedSeasons,
    alreadyProcessed: finalization.alreadyProcessed,
    remainingSteps: finalization.pendingSteps,
  };
}

export const adminProcessRivalries = onCall<ProcessRivalriesInput>(callableOptions, async (request) => {
  const actor = await requireAdmin(request);
  return processRivalries(request.data, adminResultProcessingActor(actor));
});
