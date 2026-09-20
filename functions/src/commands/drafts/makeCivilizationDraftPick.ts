import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireLeaguePlayer } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import { callableOptions } from "../../config/runtime.js";
import { collections } from "../../domain/collections.js";
import type { GamePlayer, MatchParticipant } from "../../domain/types.js";
import {
  applyCivilizationDraftPick,
  CivilizationDraftValidationError,
  type CivilizationDraftState,
} from "../../engines/civilizationDraftEngine.js";

interface MakeCivilizationDraftPickInput {
  matchId: string;
  gameId: string;
  civilization: string;
}

interface MatchForDraft {
  participants?: MatchParticipant[];
  status?: string;
}

interface GameForDraft {
  status?: string;
  players?: GamePlayer[];
}

function rethrowDraftValidation(error: unknown): never {
  if (error instanceof CivilizationDraftValidationError) {
    throw new HttpsError("failed-precondition", error.message);
  }
  throw error;
}

export const makeCivilizationDraftPick = onCall<MakeCivilizationDraftPickInput>(
  callableOptions,
  async (request) => {
    const actor = await requireLeaguePlayer(request);
    const matchId = request.data.matchId?.trim();
    const gameId = request.data.gameId?.trim();
    const civilization = request.data.civilization?.trim();

    if (!matchId || !gameId || !civilization) {
      throw new HttpsError("invalid-argument", "matchId, gameId, and civilization are required.");
    }

    const matchRef = db.collection(collections.matches).doc(matchId);
    const gameRef = matchRef.collection("games").doc(gameId);
    const draftRef = matchRef.collection("civilizationDrafts").doc(gameId);

    const result = await db.runTransaction(async (transaction) => {
      const [matchSnapshot, gameSnapshot, draftSnapshot] = await Promise.all([
        transaction.get(matchRef),
        transaction.get(gameRef),
        transaction.get(draftRef),
      ]);

      if (!matchSnapshot.exists) throw new HttpsError("not-found", "Match not found.");
      if (!gameSnapshot.exists) throw new HttpsError("not-found", "Game not found.");
      if (!draftSnapshot.exists) throw new HttpsError("failed-precondition", "The civilization draft has not opened.");

      const match = matchSnapshot.data() as MatchForDraft;
      const game = gameSnapshot.data() as GameForDraft;
      const participants = Array.isArray(match.participants) ? match.participants : [];
      const participant = participants.find((candidate) => candidate.playerId === actor.playerId);

      if (!participant) {
        throw new HttpsError("permission-denied", "Only Match participants may choose a civilization.");
      }
      if (["COMPLETED", "CANCELLED", "DISPUTED"].includes(match.status ?? "")) {
        throw new HttpsError("failed-precondition", "This Match is no longer accepting civilization picks.");
      }
      if (["COMPLETED", "REMAKE", "NO_CONTEST", "DISPUTED"].includes(game.status ?? "")) {
        throw new HttpsError("failed-precondition", "This Game is no longer accepting civilization picks.");
      }

      const state = draftSnapshot.data() as CivilizationDraftState;
      const existingSelection = state.selections?.find((selection) => selection.playerId === actor.playerId);
      if (existingSelection) {
        if (existingSelection.civilization === civilization) {
          return {
            status: state.status,
            civilization,
            alreadySelected: true,
            currentTurnIndex: state.currentTurnIndex,
          };
        }
        throw new HttpsError("failed-precondition", "This player has already completed their civilization pick.");
      }

      let nextState: CivilizationDraftState;
      try {
        nextState = applyCivilizationDraftPick(state, actor.playerId, civilization);
      } catch (error) {
        rethrowDraftValidation(error);
      }

      const now = Timestamp.now();
      const completedTurn = nextState.selections[nextState.selections.length - 1];
      const actionRef = draftRef.collection("actions")
        .doc(`R${nextState.revision}-T${completedTurn.turnIndex + 1}`);

      transaction.create(actionRef, {
        ruleVersion: nextState.ruleVersion,
        revision: nextState.revision,
        stateVersion: nextState.stateVersion,
        turnIndex: completedTurn.turnIndex,
        playerId: completedTurn.playerId,
        team: completedTurn.team,
        civilization: completedTurn.civilization,
        action: "PICK",
        selectedAt: now,
      });

      transaction.update(draftRef, {
        ...nextState,
        updatedAt: now,
        ...(nextState.status === "COMPLETED" ? { completedAt: now } : {}),
      });

      if (nextState.status === "COMPLETED") {
        const players = Array.isArray(game.players) ? game.players : [];
        const assignments = new Map(
          nextState.selections.map((selection) => [selection.playerId, selection.civilization]),
        );

        if (players.length !== participants.length || players.some((player) => !assignments.has(player.playerId))) {
          throw new HttpsError("internal", "Draft completion could not map every civilization back to the Game roster.");
        }

        transaction.update(gameRef, {
          civilizationDraftStatus: "COMPLETED",
          players: players.map((player) => ({
            ...player,
            civilization: assignments.get(player.playerId) ?? null,
            civilizationSelection: "CHOSEN" as const,
          })),
          updatedAt: now,
        });
      } else {
        transaction.update(gameRef, {
          civilizationDraftStatus: "ACTIVE",
          updatedAt: now,
        });
      }

      return {
        status: nextState.status,
        civilization,
        alreadySelected: false,
        currentTurnIndex: nextState.currentTurnIndex,
      };
    });

    return {
      success: true,
      matchId,
      gameId,
      playerId: actor.playerId,
      ...result,
    };
  },
);
