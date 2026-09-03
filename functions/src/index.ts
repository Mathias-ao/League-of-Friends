import { onCall } from "firebase-functions/v2/https";
import { requireLeaguePlayer } from "./auth/authorization.js";
import { callableOptions } from "./config/runtime.js";

export { bootstrapEmulatorAdmin } from "./dev/bootstrapEmulatorAdmin.js";
export { requestLeagueMembership } from "./commands/players/requestMembership.js";
export { adminSetMembershipStatus } from "./commands/players/setMembershipStatus.js";
export { adminCreateSeason } from "./commands/seasons/createSeason.js";
export { adminActivateSeason } from "./commands/seasons/activateSeason.js";
export { adminCreateEvent } from "./commands/events/createEvent.js";
export { adminPublishEvent } from "./commands/events/publishEvent.js";
export { setEventRsvp } from "./commands/events/setRsvp.js";
export { checkInToEvent } from "./commands/events/checkIn.js";

export const backendHealth = onCall(callableOptions, async (request) => {
  const actor = await requireLeaguePlayer(request);

  return {
    ok: true,
    service: "league-of-friends-backend",
    playerId: actor.playerId,
    role: actor.role,
  };
});
