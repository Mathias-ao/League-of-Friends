export interface ResultProcessingActor {
  authUid: string;
  playerId: string | null;
  source: "ADMIN" | "SYSTEM";
}

export const SYSTEM_RESULT_PROCESSING_ACTOR: ResultProcessingActor = {
  authUid: "SYSTEM_RESULT_PIPELINE",
  playerId: null,
  source: "SYSTEM",
};

export function adminResultProcessingActor(actor: {
  authUid: string;
  playerId: string;
}): ResultProcessingActor {
  return {
    authUid: actor.authUid,
    playerId: actor.playerId,
    source: "ADMIN",
  };
}
