/** Source compatibility only. No feature, Game or policy approval is implied. */
export const EU_STAGING_PROJECT='age-of-friends-staging-eu';
export function isolatedStagingProject(env:NodeJS.ProcessEnv,allowDemo=true):string|null {
  const projects=[env.GCLOUD_PROJECT,env.GOOGLE_CLOUD_PROJECT].filter(Boolean);
  const project=projects[0];
  if(!project||projects.some(value=>value!==project)||
    env.FUNCTION_REGION!==undefined&&env.FUNCTION_REGION!=='europe-west1')return null;
  if(allowDemo&&env.FUNCTIONS_EMULATOR==='true'&&/^demo-[a-z0-9-]+$/.test(project))return project;
  if(project!==EU_STAGING_PROJECT||env.FUNCTION_REGION!=='europe-west1'||
    env.FUNCTIONS_EMULATOR&&env.FUNCTIONS_EMULATOR!=='false'||
    [env.FIRESTORE_EMULATOR_HOST,env.FIREBASE_AUTH_EMULATOR_HOST,
      env.FIREBASE_STORAGE_EMULATOR_HOST,env.STORAGE_EMULATOR_HOST].some(Boolean))return null;
  return project;
}
