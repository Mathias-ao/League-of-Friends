import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireLeaguePlayer } from "../auth/authorization.js";
import { db } from "../config/firebase.js";
import { callableOptions } from "../config/runtime.js";
import { collections } from "../domain/collections.js";
import type { CanonicalGameResult, GamePlayer, MatchParticipant } from "../domain/types.js";
import { iso, playerMap, publicPlayer } from "./querySupport.js";

interface MatchDetailInput {
  matchId: string;
}

interface MatchDocument {
  seasonId?: string | null;
  eventId?: string | null;
  challengeId?: string | null;
  sourceRivalryId?: string | null;
  matchNumber?: number | null;
  format?: string;
  teamSizes?: [number, number] | null;
  participants?: MatchParticipant[];
  status?: string;
  context?: Record<string, unknown> | null;
  canonicalResult?: (Partial<CanonicalGameResult> & Record<string, unknown>) | null;
  processingState?: string | null;
  completedAt?: Timestamp | null;
  firstCompletedAt?: Timestamp | null;
}

interface GameDocument {
  gameNumber?: number;
  status?: string;
  players?: GamePlayer[];
  canonicalResult?: (Partial<CanonicalGameResult> & Record<string, unknown>) | null;
  activeResultDisputeId?: string | null;
  rawStatsState?: string | null;
  derivedStatsState?: string | null;
  replayAnalysisState?: string | null;
  activeRawStatsId?: string | null;
  activeDerivedReplayStatsId?: string | null;
  activeReplayAnalysisId?: string | null;
  replayAnalysisVersion?: string | null;
  startedAt?: Timestamp | null;
  completedAt?: Timestamp | null;
}

interface SubmissionDocument {
  submittedBy?: string;
  outcome?: Record<string, unknown>;
  status?: string;
  submittedAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

function canonicalResult(result: MatchDocument["canonicalResult"] | GameDocument["canonicalResult"]) {
  if (!result) return null;
  return {
    type: result.type ?? null,
    revision: Number(result.revision ?? 1),
    source: result.source ?? null,
    winnerTeam: result.winnerTeam ?? null,
    winnerPlayerId: result.winnerPlayerId ?? null,
    winningPlayerIds: Array.isArray(result.winningPlayerIds) ? result.winningPlayerIds : [],
    submittedBy: result.submittedBy ?? null,
    confirmedBy: result.confirmedBy ?? null,
  };
}

export const getMatchDetail = onCall<MatchDetailInput>(callableOptions, async (request) => {
  const actor = await requireLeaguePlayer(request);
  const matchId = request.data.matchId?.trim();
  if (!matchId) throw new HttpsError("invalid-argument", "matchId is required.");

  const matchRef = db.collection(collections.matches).doc(matchId);
  const [matchSnapshot, gamesSnapshot, playersSnapshot] = await Promise.all([
    matchRef.get(),
    matchRef.collection("games").get(),
    db.collection(collections.players).get(),
  ]);
  if (!matchSnapshot.exists) throw new HttpsError("not-found", "Match not found.");

  const match = matchSnapshot.data() as MatchDocument;
  const participants = Array.isArray(match.participants) ? match.participants : [];
  const viewerIsParticipant = participants.some((participant) => participant.playerId === actor.playerId);
  const canSeePendingResultClaims = viewerIsParticipant || actor.role === "ADMIN";
  const players = playerMap(playersSnapshot);

  const gameRows = await Promise.all(gamesSnapshot.docs.map(async (gameSnapshot) => {
    const game = gameSnapshot.data() as GameDocument;
    const submissionsSnapshot = canSeePendingResultClaims
      ? await gameSnapshot.ref.collection("resultSubmissions").get()
      : null;
    const submissions = submissionsSnapshot?.docs.map((document) => {
      const data = document.data() as SubmissionDocument;
      const submittedBy = data.submittedBy ?? document.id;
      return {
        submissionId: document.id,
        submittedBy: publicPlayer(submittedBy, players.get(submittedBy)),
        outcome: data.outcome ?? null,
        status: data.status ?? "UNKNOWN",
        submittedAt: iso(data.submittedAt),
        updatedAt: iso(data.updatedAt),
      };
    }) ?? [];
    const viewerSubmission = submissions.find((submission) => submission.submittedBy.playerId === actor.playerId) ?? null;
    const confirmationRequests = viewerIsParticipant
      ? submissions.filter((submission) => (
        submission.submittedBy.playerId !== actor.playerId && submission.status === "PENDING_CONFIRMATION"
      ))
      : [];

    return {
      gameId: gameSnapshot.id,
      gameNumber: Number(game.gameNumber ?? 0),
      status: game.status ?? "UNKNOWN",
      startedAt: iso(game.startedAt),
      completedAt: iso(game.completedAt),
      players: (Array.isArray(game.players) ? game.players : []).map((gamePlayer) => ({
        ...publicPlayer(gamePlayer.playerId, players.get(gamePlayer.playerId)),
        team: gamePlayer.team,
        slot: gamePlayer.slot,
        color: gamePlayer.color,
        civilization: gamePlayer.civilization,
        civilizationSelection: gamePlayer.civilizationSelection,
        position: gamePlayer.position,
      })),
      result: canonicalResult(game.canonicalResult),
      resultDisputeOpen: Boolean(game.activeResultDisputeId),
      replay: {
        rawStatsState: game.rawStatsState ?? null,
        derivedStatsState: game.derivedStatsState ?? null,
        analysisState: game.replayAnalysisState ?? null,
        rawStatsId: game.activeRawStatsId ?? null,
        derivedStatsId: game.activeDerivedReplayStatsId ?? null,
        analysisId: game.activeReplayAnalysisId ?? null,
        analysisVersion: game.replayAnalysisVersion ?? null,
      },
      viewerSubmission,
      confirmationRequests,
    };
  }));

  gameRows.sort((left, right) => left.gameNumber - right.gameNumber || left.gameId.localeCompare(right.gameId));

  return {
    schemaVersion: "MATCH_DETAIL_V1",
    generatedAt: new Date().toISOString(),
    match: {
      matchId,
      seasonId: match.seasonId ?? null,
      eventId: match.eventId ?? null,
      challengeId: match.challengeId ?? null,
      sourceRivalryId: match.sourceRivalryId ?? null,
      matchNumber: match.matchNumber ?? null,
      format: match.format ?? null,
      teamSizes: match.teamSizes ?? null,
      status: match.status ?? "UNKNOWN",
      processingState: match.processingState ?? null,
      context: match.context ?? {},
      completedAt: iso(match.completedAt ?? match.firstCompletedAt),
      participants: participants.map((participant) => ({
        ...publicPlayer(participant.playerId, players.get(participant.playerId)),
        team: participant.team,
        slot: participant.slot,
      })),
      result: canonicalResult(match.canonicalResult),
    },
    viewer: {
      playerId: actor.playerId,
      isParticipant: viewerIsParticipant,
      canSubmitResult: viewerIsParticipant && !["COMPLETED", "CANCELLED", "DISPUTED"].includes(match.status ?? ""),
    },
    games: gameRows,
  };
});
