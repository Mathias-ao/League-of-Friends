import {setGlobalOptions} from "firebase-functions/v2";
import type {CallableOptions} from "firebase-functions/v2/https";

/** Deployment-time source identity; not an IAM grant or a credential. */
export const EU_FUNCTIONS_PROJECT = "age-of-friends-staging-eu";
export const EU_FUNCTIONS_SERVICE_ACCOUNT =
  "aof-functions-eu@age-of-friends-staging-eu.iam.gserviceaccount.com";

/**
 * Firebase CLI evaluates the Functions entry point during discovery, when
 * FUNCTION_REGION is not necessarily populated. A supplied region must still
 * agree with our sole EU Functions region.
 *
 * Do not rely on the project's default Compute Engine identity: it has Editor
 * permissions in the EU staging project. Keep non-EU and emulator behavior
 * unchanged. The release preflight must additionally inspect every selected
 * endpoint's generated serviceAccountEmail before deployment.
 */
export function euFunctionsRuntimeIdentity(env: NodeJS.ProcessEnv): string | null {
  const projects = [env.GCLOUD_PROJECT, env.GOOGLE_CLOUD_PROJECT, env.GCP_PROJECT]
    .filter((project): project is string => Boolean(project));
  if (!projects.includes(EU_FUNCTIONS_PROJECT)) return null;
  if (projects.some(project => project !== EU_FUNCTIONS_PROJECT))
    throw new Error("Conflicting Firebase project identities in EU Functions discovery.");
  if (env.FUNCTIONS_EMULATOR === "true" ||
      [env.FIRESTORE_EMULATOR_HOST, env.FIREBASE_AUTH_EMULATOR_HOST,
       env.FIREBASE_STORAGE_EMULATOR_HOST, env.STORAGE_EMULATOR_HOST].some(Boolean))
    return null;
  if (env.FUNCTIONS_EMULATOR && env.FUNCTIONS_EMULATOR !== "false")
    throw new Error("Unrecognized emulator mode in EU Functions discovery.");
  if (env.FUNCTION_REGION && env.FUNCTION_REGION !== "europe-west1")
    throw new Error("Unexpected region in EU Functions discovery.");
  return EU_FUNCTIONS_SERVICE_ACCOUNT;
}

// Imported by the Functions entry point before its re-exported definitions are
// evaluated. Applies to callable, HTTP, Firestore, and scheduled v2 Functions,
// including handlers which do not import callableOptions themselves.
const account = euFunctionsRuntimeIdentity(process.env);
if (account) setGlobalOptions({serviceAccount: account});

/** Existing per-callable region remains unchanged for every project. */
export const callableOptions: CallableOptions = {
  region: "europe-west1",
};
