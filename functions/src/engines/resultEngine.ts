import { HttpsError } from "firebase-functions/v2/https";
import type { GameOutcome, MatchFormat, MatchParticipant } from "../domain/types.js";

export interface SubmittedOutcomeInput {
  winnerTeam?: number | null;
  winnerPlayerId?: string | null;
}

function participantById(participants: MatchParticipant[], playerId: string): MatchParticipant | undefined {
  return participants.find((participant) => participant.playerId === playerId);
}

export function assertMatchParticipant(participants: MatchParticipant[], playerId: string): MatchParticipant {
  const participant = participantById(participants, playerId);
  if (!participant) {
    throw new HttpsError("permission-denied", "Only Match participants can perform this action.");
  }
  return participant;
}

export function normalizeOutcome(
  format: MatchFormat,
  participants: MatchParticipant[],
  input: SubmittedOutcomeInput,
): GameOutcome {
  if (format === "FFA") {
    const winnerPlayerId = input.winnerPlayerId?.trim();
    if (!winnerPlayerId || !participantById(participants, winnerPlayerId)) {
      throw new HttpsError("invalid-argument", "FFA results require a winning Match participant.");
    }

    return {
      type: "PLAYER_WIN",
      winnerTeam: null,
      winnerPlayerId,
    };
  }

  if (!Number.isInteger(input.winnerTeam)) {
    throw new HttpsError("invalid-argument", "Team results require winnerTeam.");
  }

  const winnerTeam = input.winnerTeam as number;
  if (!participants.some((participant) => participant.team === winnerTeam)) {
    throw new HttpsError("invalid-argument", "winnerTeam does not exist in this Match.");
  }

  return {
    type: "TEAM_WIN",
    winnerTeam,
    winnerPlayerId: null,
  };
}

export function winningPlayerIds(outcome: GameOutcome, participants: MatchParticipant[]): string[] {
  if (outcome.type === "PLAYER_WIN") {
    return [outcome.winnerPlayerId];
  }

  return participants
    .filter((participant) => participant.team === outcome.winnerTeam)
    .map((participant) => participant.playerId);
}

export function assertIndependentConfirmation(
  participants: MatchParticipant[],
  submittedBy: string,
  confirmedBy: string,
): void {
  const submitter = assertMatchParticipant(participants, submittedBy);
  const confirmer = assertMatchParticipant(participants, confirmedBy);

  if (submittedBy === confirmedBy) {
    throw new HttpsError("failed-precondition", "A player cannot confirm their own result submission.");
  }

  if (submitter.team != null && confirmer.team === submitter.team) {
    throw new HttpsError(
      "failed-precondition",
      "A team result must be confirmed by a participant on the opposing side.",
    );
  }
}
