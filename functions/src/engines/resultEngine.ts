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
  winnerPlayerIds?: string[];
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
  rules: {diplomacyEnabled?:boolean|null} = {},
): GameOutcome {
  if (format === "FFA") {
    if(input.winnerTeam!=null)throw new ResultValidationError("INVALID_ARGUMENT","FFA cannot specify a winning team.");
    if(input.winnerPlayerIds!=null) {
      const ids=input.winnerPlayerIds;
      if(!Array.isArray(ids)||!ids.length||ids.some(id=>typeof id!=="string"||!participantById(participants,id)) ||
         new Set(ids).size!==ids.length||ids.length>=participants.length ||
         input.winnerPlayerId!=null && (ids.length!==1||ids[0]!==input.winnerPlayerId)) {
        throw new ResultValidationError("INVALID_ARGUMENT","FFA winners must be a unique, nonempty proper subset of the roster.");
      }
      if(ids.length>1) {
        if(rules.diplomacyEnabled!==true)throw new ResultValidationError("INVALID_ARGUMENT","Joint winners require announced diplomatic FFA.");
        return {type:"COALITION_WIN",winnerTeam:null,winnerPlayerId:null,winnerPlayerIds:[...ids].sort()};
      }
      return {type:"PLAYER_WIN",winnerTeam:null,winnerPlayerId:ids[0]};
    }
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

  if(input.winnerPlayerId!=null || input.winnerPlayerIds!=null)throw new ResultValidationError("INVALID_ARGUMENT","Team results must specify only winnerTeam.");
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
  if(outcome.type==="COALITION_WIN")return [...outcome.winnerPlayerIds];
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
  outcome?: GameOutcome,
): void {
  const submitter = assertMatchParticipant(participants, submittedBy);
  const confirmer = assertMatchParticipant(participants, confirmedBy);

  if (submittedBy === confirmedBy) {
    throw new ResultValidationError("FAILED_PRECONDITION", "A player cannot confirm their own result submission.");
  }

  if(outcome?.type==="COALITION_WIN" && outcome.winnerPlayerIds.includes(submittedBy) && outcome.winnerPlayerIds.includes(confirmedBy)) {
    throw new ResultValidationError("FAILED_PRECONDITION","A winning coalition must be confirmed by a nonwinner.");
  }
  if (submitter.team != null && confirmer.team === submitter.team) {
    throw new ResultValidationError(
      "FAILED_PRECONDITION",
      "A team result must be confirmed by a participant on the opposing side.",
    );
  }
}

/** Complement of accepted winners in the official roster; never replay resignations. */
export function losingPlayerIds(outcome: GameOutcome, participants: MatchParticipant[]): string[] {
  const winners = new Set(winningPlayerIds(outcome, participants));
  return participants.filter(participant => !winners.has(participant.playerId)).map(participant => participant.playerId);
}
