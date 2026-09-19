import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireLeaguePlayer } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import { callableOptions } from "../../config/runtime.js";
import { collections } from "../../domain/collections.js";
import type { GameConfiguration, MatchParticipant } from "../../domain/types.js";
import {
  CivilizationDraftValidationError,
  createCivilizationDraft,
  type PriorCivilizationDraftSelection,
} from "../../engines/civilizationDraftEngine.js";

interface EnsureCivilizationDraftInput {
  matchId: string;
  gameId: string;
}

interface MatchForDraft {
  participants?: MatchParticipant[];
  status?: string;
  gameConfigSnapshot?: GameConfiguration;
}

interface GameForDraft {
  gameNumber?: number;
  status?: string;
  gameConfigSnapshot?: GameConfiguration;
}

interface ExistingDraft {
  status?: string;
  gameNumber?: number;
  selections?: Array<{
    playerId?: string;
    team?: number | null;
    civilization?: string;
  }>;
}

function rethrowDraftValidation(error: unknown): never {
  if (error instanceof CivilizationDraftValidationError) {
    throw new HttpsError("failed-precondition", error.message);
  }
  throw error;
}

export const ensureCivilizationDraft = onCall<EnsureCivilizationDraftInput>(
  callableOptions,
  async (request) => {
    const actor = await requireLeaguePlayer(request);
    const matchId = request.data.matchId?.trim();
    const gameId = request.data.gameId?.trim();

    if (!matchId || !gameId) {
      throw new HttpsError("invalid-argument", "matchId and gameId are required.");
    }

    const matchRef = db.collection(collections.matches).doc(matchId);
    const gameRef = matchRef.collection("games").doc(gameId);
    const draftRef = matchRef.collection("civilizationDrafts").doc(gameId);

    const [matchSnapshot, gameSnapshot, existingDraftSnapshot, gamesSnapshot, draftsSnapshot] = await Promise.all([
      matchRef.get(),
      gameRef.get(),
      draftRef.get(),
      matchRef.collection("games").get(),
      matchRef.collection("civilizationDrafts").get(),
    ]);

    if (!matchSnapshot.exists) throw new HttpsError("not-found", "Match not found.");
    if (!gameSnapshot.exists) throw new HttpsError("not-found", "Game not found.");

    const match = matchSnapshot.data() as MatchForDraft;
    const game = gameSnapshot.data() as GameForDraft;
    const participants = Array.isArray(match.participants) ? match.participants : [];
    const viewerIsParticipant = participants.some((participant) => participant.playerId === actor.playerId);

    if (!viewerIsParticipant && actor.role !== "ADMIN") {
      throw new HttpsError("permission-denied", "Only Match participants or administrators may open its civilization draft.");
    }

    if (existingDraftSnapshot.exists) {
      const existing = existingDraftSnapshot.data() as ExistingDraft;
      return {
        success: true,
        matchId,
        gameId,
        status: existing.status ?? "ACTIVE",
        alreadyExists: true,
      };
    }

    const gameNumber = Number(game.gameNumber ?? 0);
    if (!Number.isInteger(gameNumber) || gameNumber < 1) {
      throw new HttpsError("failed-precondition", "Game numbering is incomplete.");
    }
    if (["COMPLETED", "REMAKE", "NO_CONTEST", "DISPUTED"].includes(game.status ?? "")) {
      throw new HttpsError("failed-precondition", "This Game cannot open a new civilization draft.");
    }

    const earlierGames = gamesSnapshot.docs
      .map((document) => document.data() as GameForDraft)
      .filter((candidate) => Number(candidate.gameNumber ?? 0) < gameNumber);
    if (earlierGames.some((candidate) => candidate.status !== "COMPLETED")) {
      throw new HttpsError(
        "failed-precondition",
        "Earlier Games in this Match must be completed before the next civilization draft opens.",
      );
    }

    const priorSelections: PriorCivilizationDraftSelection[] = [];
    for (const document of draftsSnapshot.docs) {
      const draft = document.data() as ExistingDraft;
      const priorGameNumber = Number(draft.gameNumber ?? 0);
      if (draft.status !== "COMPLETED" || priorGameNumber >= gameNumber) continue;
      for (const selection of draft.selections ?? []) {
        if (!selection.playerId || !selection.civilization) continue;
        priorSelections.push({
          gameNumber: priorGameNumber,
          playerId: selection.playerId,
          team: selection.team ?? null,
          civilization: selection.civilization,
        });
      }
    }

    const gameConfig = game.gameConfigSnapshot ?? match.gameConfigSnapshot;
    if (!gameConfig) {
      throw new HttpsError("failed-precondition", "Game competition configuration is missing.");
    }

    let draftState;
    try {
      draftState = createCivilizationDraft({
        matchId,
        gameId,
        gameNumber,
        participants,
        civilizationConfiguration: gameConfig.civilizations,
        priorSelections,
      });
    } catch (error) {
      rethrowDraftValidation(error);
    }

    const transactionResult = await db.runTransaction(async (transaction) => {
      const [freshMatch, freshGame, freshDraft] = await Promise.all([
        transaction.get(matchRef),
        transaction.get(gameRef),
        transaction.get(draftRef),
      ]);

      if (!freshMatch.exists) throw new HttpsError("not-found", "Match not found.");
      if (!freshGame.exists) throw new HttpsError("not-found", "Game not found.");
      if (freshDraft.exists) {
        const existing = freshDraft.data() as ExistingDraft;
        return {
          status: existing.status ?? "ACTIVE",
          alreadyExists: true,
        };
      }

      const freshParticipants = Array.isArray(freshMatch.data()?.participants)
        ? freshMatch.data()!.participants as MatchParticipant[]
        : [];
      const stillParticipant = freshParticipants.some((participant) => participant.playerId === actor.playerId);
      if (!stillParticipant && actor.role !== "ADMIN") {
        throw new HttpsError("permission-denied", "Match participation changed before the draft opened.");
      }

      const now = Timestamp.now();
      transaction.create(draftRef, {
        matchId,
        gameId,
        ...draftState,
        createdBy: actor.playerId,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
      transaction.update(gameRef, {
        civilizationDraftId: gameId,
        civilizationDraftStatus: draftState.status,
        updatedAt: now,
      });

      return {
        status: draftState.status,
        alreadyExists: false,
      };
    });

    return {
      success: true,
      matchId,
      gameId,
      ...transactionResult,
    };
  },
);
