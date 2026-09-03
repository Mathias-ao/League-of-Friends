import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import { callableOptions } from "../../config/runtime.js";
import { collections } from "../../domain/collections.js";
import type { CanonicalGameResult, MatchParticipant } from "../../domain/types.js";
import { computeMatchRewards, RewardConfigurationError } from "../../engines/rewardEngine.js";
import { writeAdminAudit } from "../../services/audit.js";
import { reserveIdempotencyKey } from "../../services/idempotency.js";
import { canonicalRevision, resultProcessingJobId } from "../results/resultSupport.js";

interface ProcessMatchRewardsInput {
  requestId: string;
  matchId: string;
}

interface MatchForRewards {
  seasonId?: string | null;
  eventId?: string | null;
  status?: string;
  participants?: MatchParticipant[];
  canonicalResult?: (Partial<CanonicalGameResult> & Record<string, unknown>) | null;
  activeResultDisputeId?: string | null;
  processingState?: string | null;
  context?: {
    affectsLeaguePoints?: boolean;
    affectsGold?: boolean;
  } | null;
  scoringSnapshot?: {
    rules?: Record<string, unknown>;
  } | null;
  goldRewardSnapshot?: {
    matchCompletion?: number;
    matchWin?: number;
  } | null;
}

interface ProcessingJob {
  status?: string;
  resultRevision?: number;
  pendingSteps?: string[];
  completedSteps?: string[];
}

interface LedgerDocument {
  playerId?: string;
  matchId?: string | null;
  component?: string;
  amount?: number;
}

function netForComponent(
  docs: FirebaseFirestore.QueryDocumentSnapshot[],
  playerId: string,
  component: string,
): number {
  return docs.reduce((total, document) => {
    const data = document.data() as LedgerDocument;
    if (data.playerId !== playerId || data.component !== component) return total;
    return total + (typeof data.amount === "number" ? data.amount : 0);
  }, 0);
}

function ledgerId(matchId: string, revision: number, playerId: string, component: string): string {
  return `${matchId}_R${revision}_${playerId}_${component}`;
}

export const adminProcessMatchRewards = onCall<ProcessMatchRewardsInput>(callableOptions, async (request) => {
  const actor = await requireAdmin(request);
  const { requestId, matchId } = request.data;

  if (!matchId) {
    throw new HttpsError("invalid-argument", "matchId is required.");
  }

  const matchRef = db.collection(collections.matches).doc(matchId);

  const result = await db.runTransaction(async (transaction) => {
    const matchSnapshot = await transaction.get(matchRef);
    if (!matchSnapshot.exists) throw new HttpsError("not-found", "Match not found.");

    const match = matchSnapshot.data() as MatchForRewards;
    if (match.status !== "COMPLETED" || !match.canonicalResult) {
      throw new HttpsError("failed-precondition", "Only a completed Match with a canonical result can be processed.");
    }
    if (match.activeResultDisputeId) {
      throw new HttpsError("failed-precondition", "Result processing is blocked while a correction dispute is open.");
    }
    if (!Array.isArray(match.participants) || match.participants.length < 2) {
      throw new HttpsError("failed-precondition", "Match participants are missing.");
    }

    const revision = canonicalRevision(match.canonicalResult);
    const revisionedJobRef = db.collection(collections.processingJobs)
      .doc(resultProcessingJobId(matchId, revision));
    const legacyJobRef = db.collection(collections.processingJobs).doc(`MATCH_RESULT_${matchId}`);

    const [revisionedJobSnapshot, legacyJobSnapshot, leagueLedgerSnapshot, goldLedgerSnapshot] = await Promise.all([
      transaction.get(revisionedJobRef),
      transaction.get(legacyJobRef),
      transaction.get(db.collection(collections.leaguePointLedger).where("matchId", "==", matchId)),
      transaction.get(db.collection(collections.goldLedger).where("matchId", "==", matchId)),
    ]);

    const jobSnapshot = revisionedJobSnapshot.exists
      ? revisionedJobSnapshot
      : revision === 1 && legacyJobSnapshot.exists
        ? legacyJobSnapshot
        : null;

    if (!jobSnapshot) {
      throw new HttpsError("failed-precondition", "No processing job exists for the current result revision.");
    }

    const job = jobSnapshot.data() as ProcessingJob;
    if (job.status === "BLOCKED") {
      throw new HttpsError("failed-precondition", "The current processing job is blocked.");
    }
    if (job.status === "SUPERSEDED") {
      throw new HttpsError("failed-precondition", "The current processing job has been superseded.");
    }
    if (typeof job.resultRevision === "number" && job.resultRevision !== revision) {
      throw new HttpsError("failed-precondition", "Processing job revision does not match the canonical result.");
    }

    const completedSteps = new Set(job.completedSteps ?? []);
    if (completedSteps.has("SCORING") && completedSteps.has("GOLD")) {
      return {
        resultRevision: revision,
        alreadyProcessed: true,
        leaguePointDelta: 0,
        goldDelta: 0,
      };
    }

    const canonicalResult = {
      ...match.canonicalResult,
      revision,
    } as CanonicalGameResult;

    let rewards;
    try {
      rewards = computeMatchRewards({
        participants: match.participants,
        canonicalResult,
        context: match.context,
        scoringSnapshot: match.scoringSnapshot,
        goldRewardSnapshot: match.goldRewardSnapshot,
      });
    } catch (error) {
      if (error instanceof RewardConfigurationError) {
        throw new HttpsError("failed-precondition", error.message);
      }
      throw error;
    }

    if (match.context?.affectsLeaguePoints && !match.seasonId) {
      throw new HttpsError("failed-precondition", "A Season is required for League Point rewards.");
    }

    const playerRefs = rewards.map((reward) => db.collection(collections.players).doc(reward.playerId));
    const standingRefs = match.seasonId
      ? rewards.map((reward) => db.collection(collections.seasons)
        .doc(match.seasonId!)
        .collection("standings")
        .doc(reward.playerId))
      : [];

    const [playerSnapshots, standingSnapshots] = await Promise.all([
      Promise.all(playerRefs.map((ref) => transaction.get(ref))),
      Promise.all(standingRefs.map((ref) => transaction.get(ref))),
    ]);

    for (const snapshot of playerSnapshots) {
      if (!snapshot.exists) {
        throw new HttpsError("failed-precondition", `Match player ${snapshot.id} no longer exists.`);
      }
    }

    await reserveIdempotencyKey(
      transaction,
      requestId,
      "adminProcessMatchRewards",
      actor.authUid,
    );

    const now = Timestamp.now();
    let totalLeaguePointDelta = 0;
    let totalGoldDelta = 0;

    rewards.forEach((reward, index) => {
      const leagueComponents = [
        ["MATCH_COMPLETION", reward.leaguePoints.matchCompletion],
        ["MATCH_WIN", reward.leaguePoints.matchWin],
      ] as const;
      let playerLeagueDelta = 0;

      for (const [component, desired] of leagueComponents) {
        const current = netForComponent(leagueLedgerSnapshot.docs, reward.playerId, component);
        const delta = desired - current;
        if (delta === 0) continue;

        const entryRef = db.collection(collections.leaguePointLedger)
          .doc(ledgerId(matchId, revision, reward.playerId, component));
        transaction.create(entryRef, {
          seasonId: match.seasonId,
          playerId: reward.playerId,
          eventId: match.eventId ?? null,
          matchId,
          gameId: null,
          amount: delta,
          component,
          reasonCode: component,
          description: revision === 1
            ? `Match reward: ${component}`
            : `Result correction reconciliation: ${component}`,
          sourceId: matchId,
          sourceVersion: revision,
          correction: revision > 1,
          reversalOfEntryId: null,
          idempotencyKey: entryRef.id,
          createdAt: now,
        });
        playerLeagueDelta += delta;
        totalLeaguePointDelta += delta;
      }

      if (match.seasonId && playerLeagueDelta !== 0) {
        const standingSnapshot = standingSnapshots[index];
        const previousPoints = standingSnapshot?.exists
          ? Number(standingSnapshot.data()?.leaguePoints ?? 0)
          : 0;
        transaction.set(
          standingRefs[index],
          {
            playerId: reward.playerId,
            leaguePoints: previousPoints + playerLeagueDelta,
            updatedAt: now,
          },
          { merge: true },
        );
      }

      const goldComponents = [
        ["MATCH_COMPLETION", reward.gold.matchCompletion],
        ["MATCH_WIN", reward.gold.matchWin],
      ] as const;
      let playerGoldDelta = 0;

      for (const [component, desired] of goldComponents) {
        const current = netForComponent(goldLedgerSnapshot.docs, reward.playerId, component);
        const delta = desired - current;
        if (delta === 0) continue;

        const entryRef = db.collection(collections.goldLedger)
          .doc(ledgerId(matchId, revision, reward.playerId, `GOLD_${component}`));
        transaction.create(entryRef, {
          playerId: reward.playerId,
          amount: delta,
          transactionType: "MATCH_REWARD",
          component,
          eventId: match.eventId ?? null,
          matchId,
          achievementId: null,
          challengeId: null,
          sourceVersion: revision,
          correction: revision > 1,
          reversalOfEntryId: null,
          idempotencyKey: entryRef.id,
          createdAt: now,
        });
        playerGoldDelta += delta;
        totalGoldDelta += delta;
      }

      if (playerGoldDelta !== 0) {
        const playerSnapshot = playerSnapshots[index];
        const previousBalance = Number(playerSnapshot.data()?.goldBalance ?? 0);
        transaction.update(playerRefs[index], {
          goldBalance: previousBalance + playerGoldDelta,
          updatedAt: now,
        });
      }
    });

    completedSteps.add("SCORING");
    completedSteps.add("GOLD");
    const pendingSteps = (job.pendingSteps ?? []).filter((step) => step !== "SCORING" && step !== "GOLD");
    const jobCompleted = pendingSteps.length === 0;

    transaction.update(jobSnapshot.ref, {
      status: jobCompleted ? "COMPLETED" : "PENDING",
      completedSteps: [...completedSteps],
      pendingSteps,
      attempts: Number(jobSnapshot.data()?.attempts ?? 0) + 1,
      lastError: null,
      updatedAt: now,
      ...(jobCompleted ? { completedAt: now } : {}),
    });

    transaction.update(matchRef, {
      processingState: jobCompleted ? "COMPLETE" : "PENDING",
      updatedAt: now,
    });

    writeAdminAudit(transaction, {
      actorUid: actor.authUid,
      actorPlayerId: actor.playerId,
      action: "MATCH_REWARDS_PROCESSED",
      targetType: "MATCH",
      targetId: matchId,
      after: {
        resultRevision: revision,
        leaguePointDelta: totalLeaguePointDelta,
        goldDelta: totalGoldDelta,
      },
    });

    return {
      resultRevision: revision,
      alreadyProcessed: false,
      leaguePointDelta: totalLeaguePointDelta,
      goldDelta: totalGoldDelta,
    };
  });

  return {
    success: true,
    matchId,
    completedSteps: ["SCORING", "GOLD"],
    ...result,
  };
});
