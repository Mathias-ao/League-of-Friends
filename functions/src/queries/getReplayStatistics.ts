import {projectSocialIncidents} from '../engines/socialIncidentCore.js';
import {projectRecordingDiplomacyReview} from '../engines/recordingDiplomacyReview.js';
import { createHash } from "node:crypto";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireLeaguePlayer } from "../auth/authorization.js";
import { db } from "../config/firebase.js";
import { collections } from "../domain/collections.js";
import { callableOptions } from "../config/runtime.js";
import {currentOfficialGameOutcome} from "../engines/recordingMatchFacts.js";

interface Input {
  matchId: string;
  gameId: string;
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function bucketName(): string {
  const configured = process.env.REPLAY_BUCKET?.trim();
  if (configured) return configured;
  const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  if (!project) throw new HttpsError("failed-precondition", "Replay evidence bucket is not configured.");
  return project + ".appspot.com";
}

export const getReplayStatistics = onCall<Input>(callableOptions, async (request) => {
  await requireLeaguePlayer(request);
  const matchId = request.data.matchId?.trim();
  const gameId = request.data.gameId?.trim();
  if (!matchId || !gameId) throw new HttpsError("invalid-argument", "matchId and gameId are required.");

  const gameRef = db.collection(collections.matches).doc(matchId).collection("games").doc(gameId);
  const [gameSnapshot, matchSnapshot] = await Promise.all([
    gameRef.get(), db.collection(collections.matches).doc(matchId).get(),
  ]);
  if (!gameSnapshot.exists) throw new HttpsError("not-found", "Game not found.");
  const statisticsId = gameSnapshot.data()?.activeReplayStatisticsId as string | undefined;
  if (!statisticsId) throw new HttpsError("failed-precondition", "Battle Statistics are not available yet.");

  const sourceSnapshot = await gameRef.collection("replaySources").doc(statisticsId).get();
  if (!sourceSnapshot.exists || sourceSnapshot.data()?.state !== "READY") {
    throw new HttpsError("failed-precondition", "The active replay statistics revision is unavailable.");
  }
  const source = sourceSnapshot.data() as {
    playerMapping?: unknown[];
    resultQualification?: string;
    statistics?: { path?: string; sha256?: string };
  };
  const path = source.statistics?.path;
  const expectedHash = source.statistics?.sha256;
  if (!path || !expectedHash) throw new HttpsError("internal", "Statistics artifact metadata is incomplete.");

  const [bytes] = await getStorage().bucket(bucketName()).file(path).download();
  if (sha256(bytes) !== expectedHash) {
    throw new HttpsError("data-loss", "Stored Battle Statistics failed integrity verification.");
  }

  let statistics: unknown;
  try {
    statistics = JSON.parse(bytes.toString("utf-8"));
  } catch {
    throw new HttpsError("data-loss", "Stored Battle Statistics are not valid JSON.");
  }

  const officialOutcome = currentOfficialGameOutcome(gameSnapshot.data(), matchSnapshot.data());
  const socialIncidents = matchSnapshot.data()?.opponentKind==='AI'?{status:'UNAVAILABLE',reason:'AI warm-ups do not produce player Relationships or Reputation.'}:projectSocialIncidents({ statistics, playerMapping: source.playerMapping ?? [], officialOutcome,
    context: { gameId, battleId: matchId } });

  return {
    success: true,
    matchId,
    gameId,
    statisticsId,
    playerMapping: source.playerMapping ?? [],
    resultQualification: source.resultQualification ?? "UNRESOLVED",
    statistics,
    diplomacyReview: projectRecordingDiplomacyReview((statistics as any)?.matchFacts),
    officialOutcome,
    socialIncidents,
  };
});
