import {HttpsError} from 'firebase-functions/v2/https';

/** Separate ordinary-upload rollout; never grants the admin validation/publisher role. */
export const NATIVE_PLAYER_UPLOAD='AOF_NATIVE_PLAYER_UPLOAD_V1';
export function assertNativePlayerUploadAllowed(env:NodeJS.ProcessEnv,matchId:string,gameId:string):string {
  const project=env.GCLOUD_PROJECT||env.GOOGLE_CLOUD_PROJECT;
  if(env.AOF_NATIVE_PLAYER_UPLOAD!=='recorded-events-v1'||
     !project||project!==env.AOF_NATIVE_REPLAY_PROJECT||
     !(project==='age-of-friends-staging'||env.FUNCTIONS_EMULATOR==='true'&&project.startsWith('demo-'))||
     !(env.AOF_NATIVE_PLAYER_UPLOAD_GAME_ALLOWLIST??'').split(',').map(s=>s.trim()).includes(matchId+'/'+gameId)||
     env.AOF_ACTIVE_NATIVE_PLAYER_READS!=='1'||env.AOF_ACTIVE_NATIVE_SOCIAL_READS!=='1'||!env.REPLAY_WORKER_AUTH_TOKEN||
     !/^[a-f0-9]{64}$/.test(env.AOF_NATIVE_REPLAY_PROCESSOR_REVISION??''))
    throw new HttpsError('failed-precondition','Ordinary native upload requires its explicit project, Game, processor and reader rollout gates.');
  return env.AOF_NATIVE_REPLAY_PROCESSOR_REVISION!;
}
