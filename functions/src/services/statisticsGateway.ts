import {GoogleAuth} from 'google-auth-library';
import {HttpsError,type CallableRequest,type FunctionsErrorCode} from 'firebase-functions/v2/https';
import {requireLeaguePlayer} from '../auth/authorization.js';
import {EXPERIENCE_VERSION,type StatisticsScope,type StatisticsDataset} from '../engines/statisticsExperience.js';

const APPLICATION_MS=50_000,UPSTREAM_MS=45_000;
// Gen2 callable responses are non-streaming: use the provider's 32 MiB ceiling,
// including the callable envelope. Reject oversize responses; never truncate data.
export const STATISTICS_GATEWAY_MAX_BYTES=32*1024*1024;
const unavailable=()=>new HttpsError('unavailable','Statistics could not be loaded.');
const timeout=()=>new HttpsError('deadline-exceeded','Statistics loading timed out.');
const invalid=()=>new HttpsError('invalid-argument','Choose exactly one Season, Event, or Battle.');

/** Server-only dependencies for local tests; the callable payload cannot set them. */
interface Dependencies {
  env?:NodeJS.ProcessEnv;
  authorize?:typeof requireLeaguePlayer;
  getIdToken?:(audience:string)=>Promise<string>;
  fetcher?:typeof fetch;
  now?:()=>number;
}

function scopeFrom(data:unknown):StatisticsScope {
  if(!data||typeof data!=='object'||Array.isArray(data))throw invalid();
  const envelope=data as Record<string,unknown>;
  if(Object.keys(envelope).length!==2||envelope.operation!=='STATISTICS_READ_V1'||
    !Object.hasOwn(envelope,'scope'))throw invalid();
  const raw=envelope.scope;
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length!==1)throw invalid();
  const [key]=Object.keys(raw),value=(raw as Record<string,unknown>)[key];
  if(!['seasonId','eventId','matchId'].includes(key)||typeof value!=='string'||
    !value.trim()||value.length>200||value.includes('/'))throw invalid();
  return {[key]:value.trim()};
}

function targetFrom(env:NodeJS.ProcessEnv):string {
  const projects=[env.GCLOUD_PROJECT,env.GOOGLE_CLOUD_PROJECT].filter(Boolean);
  // FUNCTIONS_EMULATOR cannot turn a cloud workload into a test environment.
  if(env.AOF_STATISTICS_GATEWAY!=='staging-v1'||!projects.length||
    projects.some(project=>project!=='age-of-friends-staging')||env.FUNCTIONS_EMULATOR==='true')
    throw new HttpsError('failed-precondition','Statistics gateway is disabled.');
  const target=env.AOF_STATISTICS_GATEWAY_TARGET_URI;
  try {
    const url=new URL(target??'');
    if(url.protocol!=='https:'||url.origin!==target||url.port||url.username||url.password||
      !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.run\.app$/.test(url.hostname))throw new Error();
  } catch { throw new HttpsError('failed-precondition','Statistics gateway is not configured.'); }
  return target!;
}

const statuses:Record<string,FunctionsErrorCode>={
  CANCELLED:'cancelled',UNKNOWN:'unknown',INVALID_ARGUMENT:'invalid-argument',
  DEADLINE_EXCEEDED:'deadline-exceeded',NOT_FOUND:'not-found',ALREADY_EXISTS:'already-exists',
  PERMISSION_DENIED:'permission-denied',RESOURCE_EXHAUSTED:'resource-exhausted',
  FAILED_PRECONDITION:'failed-precondition',ABORTED:'aborted',OUT_OF_RANGE:'out-of-range',
  UNIMPLEMENTED:'unimplemented',INTERNAL:'internal',UNAVAILABLE:'unavailable',UNAUTHENTICATED:'unauthenticated',
};

function decode(body:string,ok:boolean):StatisticsDataset {
  let envelope:any;
  try {envelope=JSON.parse(body);} catch {throw unavailable();}
  if(!envelope||typeof envelope!=='object'||Array.isArray(envelope))throw unavailable();
  if(Object.keys(envelope).length===1&&Object.hasOwn(envelope,'error')) {
    const status=envelope.error?.status;
    const code=typeof status==='string'&&Object.hasOwn(statuses,status)?statuses[status]:undefined;
    if(!code)throw unavailable();
    // Upstream messages/details may contain private source/storage/IAM data.
    throw new HttpsError(code,code==='aborted'?
      'Statistics inputs changed during loading; retry for a coherent revision.':'Statistics could not be loaded.');
  }
  if(!ok||Object.keys(envelope).length!==1||!Object.hasOwn(envelope,'result'))throw unavailable();
  const result=envelope.result;
  if(!result||typeof result!=='object'||Array.isArray(result)||Object.keys(result).length!==3||
    result.version!==EXPERIENCE_VERSION||!Array.isArray(result.games)||
    !Number.isSafeInteger(result.unavailableGames)||result.unavailableGames<0)throw unavailable();
  // Keep all existing Game DTOs intact; source qualification belongs to the
  // unchanged target reader. Only its public top-level contract is accepted.
  return {version:result.version,games:result.games,unavailableGames:result.unavailableGames};
}

/** AOF_STATS_FIXED_GATEWAY_STAGING_V1. One fixed callable, no retries or local collector.
 * Firebase already verified Authorization on the outer callable. The target's
 * original requireLeaguePlayer verifies that same bearer again. OIDC authenticates
 * only the existing workload to IAM, with the exact configured URI as audience.
 * App Check is forwarded only when verified by the outer callable; this does not
 * introduce enforcement, a provider, or token consumption. Cancellation bounds
 * gateway waiting; it does not prove upstream processing has stopped.
 */
export async function readStatisticsGateway(request:CallableRequest<unknown>,enteredAt=performance.now(),deps:Dependencies={}):Promise<StatisticsDataset> {
  const now=deps.now??(()=>performance.now());
  const controller=new AbortController();
  const remaining=APPLICATION_MS-(now()-enteredAt);
  let applicationTimer:ReturnType<typeof setTimeout>|undefined;
  let upstreamTimer:ReturnType<typeof setTimeout>|undefined;
  let reader:ReadableStreamDefaultReader<Uint8Array>|undefined;
  let onAbort:()=>void=()=>{};
  const check=()=>{if(controller.signal.aborted||now()-enteredAt>=APPLICATION_MS)throw timeout();};
  try {
    if(remaining<=0)throw timeout();
    const expired=new Promise<never>((_,reject)=>{
      onAbort=()=>reject(timeout());
      controller.signal.addEventListener('abort',onAbort,{once:true});
      applicationTimer=setTimeout(()=>controller.abort(),remaining);
    });
    const work=async()=>{
      const scope=scopeFrom(request.data);
      const target=targetFrom(deps.env??process.env);
      await (deps.authorize??requireLeaguePlayer)(request);
      check();
      const bearer=request.rawRequest.get('Authorization');
      if(!bearer||!/^Bearer [^\s]+$/i.test(bearer))throw new HttpsError('unauthenticated','Authentication is required.');
      const identity=await (deps.getIdToken?deps.getIdToken(target):
        new GoogleAuth().getIdTokenClient(target).then(client=>client.idTokenProvider.fetchIdToken(target)));
      check();
      if(!identity||/[\r\n]/.test(identity))throw unavailable();
      const headers:Record<string,string>={
        'Content-Type':'application/json',Authorization:bearer,'X-Serverless-Authorization':'Bearer '+identity,
      };
      const appCheck=request.app&&request.rawRequest.get('X-Firebase-AppCheck');
      if(appCheck)headers['X-Firebase-AppCheck']=appCheck;
      upstreamTimer=setTimeout(()=>controller.abort(),Math.min(UPSTREAM_MS,APPLICATION_MS-(now()-enteredAt)));
      const response=await (deps.fetcher??fetch)(target,{method:'POST',redirect:'error',headers,
        body:JSON.stringify({data:scope}),signal:controller.signal});
      check();
      reader=response.body?.getReader();
      if(!response.headers.get('content-type')?.match(/^application\/json(?:\s*;|$)/i)||!reader)throw unavailable();
      const chunks:Buffer[]=[];let total=0;
      while(true){
        const part=await reader.read();check();
        if(part.done)break;
        total+=part.value.byteLength;
        if(total>STATISTICS_GATEWAY_MAX_BYTES)throw new HttpsError('resource-exhausted','Statistics response exceeds the transport limit.');
        chunks.push(Buffer.from(part.value));
      }
      const result=decode(Buffer.concat(chunks).toString('utf8'),response.ok);
      check();
      return result;
    };
    return await Promise.race([work(),expired]);
  } catch(error) {
    if(controller.signal.aborted)throw timeout();
    if(error instanceof HttpsError)throw error;
    throw unavailable();
  } finally {
    clearTimeout(applicationTimer);clearTimeout(upstreamTimer);
    controller.signal.removeEventListener('abort',onAbort);
    controller.abort();
    // A stalled body must not extend the application deadline during cleanup.
    void reader?.cancel().catch(()=>{});
  }
}
