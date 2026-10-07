export const PLAYER_CHRONICLE_VERSION: "AOF_PLAYER_CHRONICLE_V1";

export interface PlayerChronicleProjectionInput {
  ownerPlayerId?: string;
  chapters?: unknown[];
  history?: unknown;
  names?: Record<string,string>;
}

export function projectPlayerChronicle(input?: PlayerChronicleProjectionInput): any;
