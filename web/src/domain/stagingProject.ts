/** Exact EU hosted identity, or an explicitly isolated demo; never an activation. */
export function isolatedStagingProject(env:Record<string,string|boolean|undefined>,allowDemo=true):boolean {
  const project=env.VITE_FIREBASE_PROJECT_ID;
  if(allowDemo&&env.VITE_USE_EMULATORS==='true'&&typeof project==='string'&&/^demo-[a-z0-9-]+$/.test(project))return true;
  return project==='age-of-friends-staging-eu'&&env.VITE_FIREBASE_REGION==='europe-west1'&&
    (env.VITE_USE_EMULATORS===undefined||env.VITE_USE_EMULATORS==='false');
}
