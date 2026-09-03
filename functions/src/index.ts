import { onCall } from "firebase-functions/v2/https";
import { requireLeaguePlayer } from "./auth/authorization.js";
import { callableOptions } from "./config/runtime.js";

export { bootstrapEmulatorAdmin } from "./dev/bootstrapEmulatorAdmin.js";
export { requestLeagueMembership } from "./commands/players/requestMembership.js";
export { adminSetMembershipStatus } from "./commands/players/setMembershipStatus.js";
export { adminSetPowerRatingConfig } from "./commands/admin/setPowerRatingConfig.js";
export { adminSetReplayAnalysisConfig } from "./commands/admin/setReplayAnalysisConfig.js";
export { adminCreateSeason } from "./commands/seasons/createSeason.js";
export { adminActivateSeason } from "./commands/seasons/activateSeason.js";
export { adminCreateEvent } from "./commands/events/createEvent.js";
export { adminPublishEvent } from "./commands/events/publishEvent.js";
export { setEventRsvp } from "./commands/events/setRsvp.js";
export { checkInToEvent } from "./commands/events/checkIn.js";
export { adminGenerateMatchPlan } from "./commands/events/generateMatchPlan.js";
export { adminApproveMatchPlan } from "./commands/events/approveMatchPlan.js";
export { submitGameResult } from "./commands/results/submitGameResult.js";
export { respondToGameResult } from "./commands/results/respondToGameResult.js";
export { adminResolveGameResult } from "./commands/results/adminResolveGameResult.js";
export { disputeCanonicalGameResult } from "./commands/results/disputeCanonicalGameResult.js";
export { adminResolveCanonicalResultDispute } from "./commands/results/adminResolveCanonicalResultDispute.js";
export { adminIngestReplayStats } from "./commands/statistics/ingestReplayStats.js";
export { adminProcessReplayDerivedStats } from "./commands/statistics/processReplayDerivedStats.js";
export { adminProcessReplayAnalysis } from "./commands/statistics/processReplayAnalysis.js";
export { adminRebuildReplayPlayerStatistics } from "./commands/statistics/rebuildReplayPlayerStatistics.js";
export { adminProcessMatchRewards } from "./commands/processing/processMatchRewards.js";
export { adminProcessPowerRatings } from "./commands/processing/processPowerRatings.js";
export { adminProcessStatistics } from "./commands/processing/processStatistics.js";

export const backendHealth = onCall(callableOptions, async (request) => {
  const actor = await requireLeaguePlayer(request);

  return {
    ok: true,
    service: "league-of-friends-backend",
    playerId: actor.playerId,
    role: actor.role,
  };
});
