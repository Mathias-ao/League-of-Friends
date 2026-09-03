import type { GameOutcome, MatchFormat, MatchParticipant } from "../domain/types.js";

export type ResultValidationCode = "INVALID_ARGUMENT" | "PERMISSION_DENIED" | "FAILED_PRECONDITION";

export class ResultValidationError extends Error {
  constructor(
    public readonly code: ResultValidationCode,
    message: string,
  ) {
    super(message);
    this.name = "ResultValidationError";
  }
}

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
    throw new ResultValidationError("PERMISSION_DENIED", "Only Match participants can perform this action.");
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
      throw new ResultValidationError("INVALID_ARGUMENT", "FFA results require a winning Match participant.");
    }

    return {
      type: "PLAYER_WIN",
      winnerTeam: null,
      winnerPlayerId,
    };
  }

  if (!Number.isInteger(input.winnerTeam)) {
    throw new ResultValidationError("INVALID_ARGUMENT", "Team results require winnerTeam.");
  }

  const winnerTeam = input.winnerTeam as number;
  if (!participants.some((participant) => participant.team === winnerTeam)) {
    throw new ResultValidationError("INVALID_ARGUMENT", "winnerTeam does not exist in this Match.");
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
    throw new ResultValidationError("FAILED_PRECONDITION", "A player cannot confirm their own result submission.");
  }

  if (submitter.team != null && confirmer.team === submitter.team) {
    throw new ResultValidationError(
      "FAILED_PRECONDITION",
      "A team result must be confirmed by a participant on the opposing side.",
    );
  }
}
