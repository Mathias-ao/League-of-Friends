import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin } from "../../auth/authorization.js";
import { db } from "../../config/firebase.js";
import { callableOptions } from "../../config/runtime.js";
import { collections } from "../../domain/collections.js";
import type { GameConfiguration, GamePlayer, MatchParticipant } from "../../domain/types.js";
import {
  CivilizationDraftValidationError,
  createCivilizationDraft,
  type CivilizationDraftState,
  type PriorCivilizationDraftSelection,
} from "../../engines/civilizationDraftEngine.js";
import { writeAdminAudit } from "../../services/audit.js";
import { reserveIdempotencyKey } from "../../services/idempotency.js";

interface AdminResetCivilizationDraftInput {
  requestId: string;
  matchId: string;
  gameId: string;
  reason: string;
  rerollOrder?: boolean;
}

interface MatchForDraft {
  participants?: MatchParticipant[];
  gameConfigSnapshot?: GameConfiguration;
}

interface GameForDraft {
  gameNumber?: number;
  status?: string;
  players?: GamePlayer[];
  gameConfigSnapshot?: GameConfiguration;
}

interface DraftForReset extends CivilizationDraftState {
  matchId?: string;
  gameId?: string;
}

function rethrowDraftValidation(error: unknown): never {
  if (error instanceof CivilizationDraftValidationError) {
    throw new HttpsError("failed-precondition", error.message);
  }
  throw error;
}

function preserveOrder(next: CivilizationDraftState, previous: CivilizationDraftState): CivilizationDraftState {
  const nextByPlayer = new Map(next.turns.map((turn) => [turn.playerId, turn]));
  if (
    previous.turns.length !== next.turns.length
    || previous.turns.some((turn) => !nextByPlayer.has(turn.playerId))
  ) {
    return next;
  }

  const turns = previous.turns.map((turn, index) => {
    const candidate = nextByPlayer.get(turn.playerId)!;
    return {
      ...candidate,
      index,
      status: "PENDING" as const,
      civilization: null,
    };
  });

  return {
    ...next,
    turns,
    currentTurnIndex: 0,
  };
}

export const adminResetCivilizationDraft = onCall<AdminResetCivilizationDraftInput>(
  callableOptions,
  async (request) => {
    const actor = await requireAdmin(request);
    const requestId = request.data.requestId?.trim();
    const matchId = request.data.matchId?.trim();
    const gameId = request.data.gameId?.trim();
    const reason = request.data.reason?.trim();
    const rerollOrder = request.data.rerollOrder === true;

    if (!requestId || !matchId || !gameId) {
      throw new HttpsError("invalid-argument", "requestId, matchId, and gameId are required.");
    }
    if (!reason || reason.length > 1000) {
      throw new HttpsError("invalid-argument", "A reset reason of 1–1000 characters is required.");
    }

    const matchRef = db.collection(collections.matches).doc(matchId);
    const gameRef = matchRef.collection("games").doc(gameId);
    const draftRef = matchRef.collection("civilizationDrafts").doc(gameId);

    const [matchSnapshot, gameSnapshot, draftSnapshot, draftsSnapshot] = await Promise.all([
      matchRef.get(),
      gameRef.get(),
      draftRef.get(),
      matchRef.collection("civilizationDrafts").get(),
    ]);

    if (!matchSnapshot.exists) throw new HttpsError("not-found", "Match not found.");
    if (!gameSnapshot.exists) throw new HttpsError("not-found", "Game not found.");
    if (!draftSnapshot.exists) throw new HttpsError("not-found", "Civilization draft not found.");

    const match = matchSnapshot.data() as MatchForDraft;
    const game = gameSnapshot.data() as GameForDraft;
    const previous = draftSnapshot.data() as DraftForReset;
    const participants = Array.isArray(match.participants) ? match.participants : [];
    const gameNumber = Number(game.gameNumber ?? 0);

    if (!Number.isInteger(gameNumber) || gameNumber < 1) {
      throw new HttpsError("failed-precondition", "Game numbering is incomplete.");
    }
    if (game.status === "COMPLETED") {
      throw new HttpsError("failed-precondition", "A completed Game's civilization draft cannot be reset.");
    }

    const priorSelections: PriorCivilizationDraftSelection[] = [];
    for (const document of draftsSnapshot.docs) {
      if (document.id === gameId) continue;
      const draft = document.data() as DraftForReset;
      const priorGameNumber = Number(draft.gameNumber ?? 0);
      if (draft.status !== "COMPLETED" || priorGameNumber >= gameNumber) continue;
      for (const selection of draft.selections ?? []) {
        priorSelections.push({
          gameNumber: priorGameNumber,
          playerId: selection.playerId,
          team: selection.team,
          civilization: selection.civilization,
        });
      }
    }

    const gameConfig = game.gameConfigSnapshot ?? match.gameConfigSnapshot;
    if (!gameConfig) {
      throw new HttpsError("failed-precondition", "Game competition configuration is missing.");
    }

    let nextState: CivilizationDraftState;
    try {
      nextState = createCivilizationDraft({
        matchId,
        gameId,
        gameNumber,
        participants,
        civilizationConfiguration: gameConfig.civilizations,
        priorSelections,
        revision: Number(previous.revision ?? 1) + 1,
      });
      if (!rerollOrder) nextState = preserveOrder(nextState, previous);
    } catch (error) {
      rethrowDraftValidation(error);
    }

    await db.runTransaction(async (transaction) => {
      const [freshGame, freshDraft] = await Promise.all([
        transaction.get(gameRef),
        transaction.get(draftRef),
      ]);
      if (!freshGame.exists || !freshDraft.exists) {
        throw new HttpsError("not-found", "Game or civilization draft no longer exists.");
      }

      const freshGameData = freshGame.data() as GameForDraft;
      const freshDraftData = freshDraft.data() as DraftForReset;
      if (freshGameData.status === "COMPLETED") {
        throw new HttpsError("failed-precondition", "A completed Game's civilization draft cannot be reset.");
      }
      if (Number(freshDraftData.revision ?? 1) !== Number(previous.revision ?? 1)) {
        throw new HttpsError("aborted", "The civilization draft changed before the reset could be applied.");
      }

      await reserveIdempotencyKey(
        transaction,
        requestId,
        "adminResetCivilizationDraft",
        actor.authUid,
      );

      const now = Timestamp.now();
      transaction.set(draftRef, {
        matchId,
        gameId,
        ...nextState,
        createdBy: freshDraftData.createdBy ?? actor.playerId,
        createdAt: freshDraftData.createdAt ?? now,
        completedAt: null,
        resetBy: actor.playerId,
        resetReason: reason,
        resetAt: now,
        updatedAt: now,
      }, { merge: false });

      const players = Array.isArray(freshGameData.players) ? freshGameData.players : [];
      transaction.update(gameRef, {
        civilizationDraftId: gameId,
        civilizationDraftStatus: "ACTIVE",
        players: players.map((player) => ({
          ...player,
          civilization: null,
          civilizationSelection: "UNKNOWN" as const,
        })),
        updatedAt: now,
      });

      writeAdminAudit(transaction, {
        actorUid: actor.authUid,
        actorPlayerId: actor.playerId,
        action: "CIVILIZATION_DRAFT_RESET",
        targetType: "GAME",
        targetId: `${matchId}/${gameId}`,
        reason,
        before: {
          revision: previous.revision,
          status: previous.status,
          selections: previous.selections,
        },
        after: {
          revision: nextState.revision,
          status: nextState.status,
          rerollOrder,
        },
      });
    });

    return {
      success: true,
      matchId,
      gameId,
      status: "ACTIVE",
      revision: nextState.revision,
      rerollOrder,
    };
  },
);
