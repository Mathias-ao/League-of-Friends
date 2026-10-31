import { HttpsError } from "firebase-functions/v2/https";

/**
 * WAR-V1 #220: no approved, persisted, correction-fenced stage-3
 * Relationship authorization reader exists yet.
 *
 * Deliberately not an environment flag or a client-selected switch. Before
 * replacing this guard, integration must prove directed stage-3 reciprocity,
 * original activation authority, pending/correction revocation and closed-
 * Season War Room ledger rebuilding (SOC-030–041).
 */
export function assertWarRoomMutationsApproved(): never {
  throw new HttpsError(
    "failed-precondition",
    "War Room invitations and responses are paused pending verified Relationship eligibility and historical correction support.",
  );
}
