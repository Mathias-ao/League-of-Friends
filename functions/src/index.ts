import { onCall } from "firebase-functions/v2/https";
import { requireLeaguePlayer } from "./auth/authorization.js";

export { requestLeagueMembership } from "./commands/players/requestMembership.js";
export { adminSetMembershipStatus } from "./commands/players/setMembershipStatus.js";
export { adminCreateSeason } from "./commands/seasons/createSeason.js";

export const backendHealth = onCall(async (request) => {
  const actor = await requireLeaguePlayer(request);

  return {
    ok: true,
    service: "league-of-friends-backend",
    playerId: actor.playerId,
    role: actor.role,
  };
});
