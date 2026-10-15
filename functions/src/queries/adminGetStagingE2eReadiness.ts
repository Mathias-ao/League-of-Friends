import {HttpsError,onCall} from 'firebase-functions/v2/https';
import {defineSecret} from 'firebase-functions/params';
import {requireAdmin} from '../auth/authorization.js';
import {callableOptions} from '../config/runtime.js';

const ID=/^[A-Za-z0-9_-]{1,200}$/;
const REV=/^[a-f0-9]{64}$/;
const SHA=/^[a-f0-9]{40}$/;
const projectStaging='age-of-friends-staging';
const replayWorkerAuthToken=defineSecret('REPLAY_WORKER_AUTH_TOKEN');

/** Read-only staging/demo preflight. This never tests external connectivity,
 * checks account fixtures, or authorizes a flag by returning a green result. */
export function stagedNativeEnvironmentStatus(env:NodeJS.ProcessEnv,matchId:string,gameId:string,expectedCommit:string){
  if(!ID.test(matchId??'')||!ID.test(gameId??'')||!SHA.test(expectedCommit??''))
    throw new HttpsError('invalid-argument','Provide the reviewed exact Match/Game and 40-character expected commit.');
  const project=env.GCLOUD_PROJECT||env.GOOGLE_CLOUD_PROJECT||'';
  const isolated=project===projectStaging||
    (env.FUNCTIONS_EMULATOR==='true'&&project.startsWith('demo-'));
  if(!isolated)throw new HttpsError('failed-precondition','This is not an approved staging or emulator project.');
  const allow=(key:string)=>(env[key]??'').split(',').map(v=>v.trim()).includes(matchId+'/'+gameId);
  const flags:Record<string,boolean>={
    nativeValidation:env.AOF_NATIVE_REPLAY_INTEGRATION==='validate-v1',
    nativePublish:env.AOF_NATIVE_READY_PUBLICATION==='reviewed-v1',
    nativePlayerReads:env.AOF_ACTIVE_NATIVE_PLAYER_READS==='1',
    nativeSocialReads:env.AOF_ACTIVE_NATIVE_SOCIAL_READS==='1',
    nativeEmergencyRollback:env.AOF_NATIVE_READY_ROLLBACK==='reviewed-v1',
    validationGameAllowlisted:allow('AOF_NATIVE_REPLAY_GAME_ALLOWLIST'),
    publicationGameAllowlisted:allow('AOF_NATIVE_READY_GAME_ALLOWLIST'),
    workerProcessorPinned:REV.test(env.AOF_NATIVE_REPLAY_PROCESSOR_REVISION??''),
    workerAuthenticated:!!env.REPLAY_WORKER_AUTH_TOKEN,
    projectExplicit:env.AOF_NATIVE_REPLAY_PROJECT===project,
    deployedCommitMatches:env.AOF_DEPLOY_GIT_SHA===expectedCommit,
  };
  let secureWorker=false;
  try {
    const worker=new URL(env.REPLAY_WORKER_URL??'');
    secureWorker=project===projectStaging?
      worker.protocol==='https:'&&!worker.username&&!worker.password&&
      !['localhost','127.0.0.1'].includes(worker.hostname):
      ['http:','https:'].includes(worker.protocol)&&
      ['localhost','127.0.0.1'].includes(worker.hostname)&&
      !worker.username&&!worker.password;
  }catch{/* Missing/invalid URL is a no-go; never show the URL. */}
  flags.workerTransportConfigured=secureWorker;
  const bucket=env.REPLAY_BUCKET??'';
  flags.stagingBucketExplicit=project===projectStaging?
    (bucket===project+'.appspot.com'||bucket===project+'.firebasestorage.app'):
    bucket===project+'.appspot.com';
  // Validation-only can be tested before READY publication/read/rollback is approved.
  // This read-only status is NOT an authorization token: the callable still enforces
  // ADMIN, exact Game, processor pin and current project/worker configuration.
  const validationChecks=[
    'nativeValidation','validationGameAllowlisted','workerProcessorPinned',
    'workerAuthenticated','projectExplicit','deployedCommitMatches',
    'workerTransportConfigured','stagingBucketExplicit',
  ];
  const validationBlockers=validationChecks.filter(key=>!flags[key]);
  const blockers=Object.entries(flags).filter(([,enabled])=>!enabled).map(([key])=>key);
  return {
    contract:'AOF_STAGING_E2E_PREFLIGHT_V1' as const,
    project,matchId,gameId,expectedCommit,
    flags,blockers,configReady:blockers.length===0,
    validationReady:validationBlockers.length===0,validationBlockers,
    rollbackReady:flags.nativeEmergencyRollback&&flags.publicationGameAllowlisted&&
      flags.workerProcessorPinned&&flags.projectExplicit,
    caveat:'Read-only environment values only; backup, Auth, actual worker HTTPS, browser, deployment and scoped authorization must be separately verified.',
  };
}

export const adminGetStagingE2eReadiness=onCall<{matchId:string;gameId:string;expectedCommit:string}>(
  {...callableOptions,timeoutSeconds:30,secrets:[replayWorkerAuthToken]},async request=>{
    const actor=await requireAdmin(request);
    if(actor.role!=='ADMIN')throw new HttpsError('permission-denied','Administrator required.');
    const {matchId,gameId,expectedCommit}=request.data??({} as any);
    return stagedNativeEnvironmentStatus(process.env,matchId,gameId,expectedCommit);
  });
