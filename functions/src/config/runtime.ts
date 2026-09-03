import type { CallableOptions } from "firebase-functions/v2/https";

/**
 * Runtime options shared by every callable backend command.
 *
 * Keep Functions co-located with the Firestore database. League of Friends
 * targets europe-west1 (Belgium) for its Denmark-based player group.
 */
export const callableOptions: CallableOptions = {
  region: "europe-west1",
};
