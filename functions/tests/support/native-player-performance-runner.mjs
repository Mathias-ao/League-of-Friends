/** Repeat the existing authentic native acceptance inside emulators:exec.
 * Starts only a loopback Python worker and resets only a fixed demo Firestore.
 * Never deploys, configures cloud resources, or changes an external flag.
 */
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,open,readFile,copyFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const project='demo-aof-native-player';
assert.equal(process.env.GCLOUD_PROJECT,project);
assert.equal(process.env.FUNCTIONS_EMULATOR,'true');
for(const key of ['FIRESTORE_EMULATOR_HOST','FIREBASE_STORAGE_EMULATOR_HOST'])
  assert.match(process.env[key]??'',/^127\.0\.0\.1:\d+$/);
assert.ok(process.env.AOF_NATIVE_CORPUS,'Use the pinned authentic corpus prepared by native-player-upload.yml.');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const output=resolve(process.env.AOF_NATIVE_PERF_OUT??resolve(root,'.replay-lab/performance-143'));
const trials=Number(process.env.AOF_NATIVE_PERF_TRIALS??3);
assert.ok(Number.isInteger(trials)&&trials>=1&&trials<=20);
const series=process.env.AOF_NATIVE_PERF_SERIES??'serial';
assert.match(series,/^[a-z0-9-]{1,40}$/);
const python=process.env.AOF_BENCH_PYTHON??'python';
await mkdir(output,{recursive:true});
const env={...process.env,FUNCTIONS_EMULATOR:'true',REPLAY_BUCKET:project+'.appspot.com',
  REPLAY_WORKER_URL:'http://127.0.0.1:18765',AOF_REPLAY_WORKER_PORT:'18765',AOF_REPLAY_WORKER_BIND:'127.0.0.1',
  REPLAY_WORKER_AUTH_TOKEN:'ephemeral-local-native-player-test',AOF_REPLAY_WORKER_AUTH_TOKEN:'ephemeral-local-native-player-test',
  AOF_EXPERIMENTAL_NATIVE_REPLAY_ENDPOINT:'1',AOF_REPLAY_WORKER_PERF_TRACE:'1'};
env.AOF_NATIVE_REPLAY_PROCESSOR_REVISION=execFileSync(python,['-c',
  'import sys;sys.path.insert(0,"replay-tools");from native_worker_transport import native_processor_revision;print(native_processor_revision())'],
{cwd:root,encoding:'utf8'}).trim();
const workerLog=await open(resolve(output,series+'-worker.log'),'w');
const worker=spawn(python,['replay-tools/upload_worker.py'],{cwd:root,env,stdio:['ignore',workerLog.fd,workerLog.fd]});
async function runNode(logPath){
  const log=await open(logPath,'w');
  try{await new Promise((accept,reject)=>{
    const child=spawn(process.execPath,['functions/tests/native-player-upload-emulator.mjs'],{cwd:root,env,stdio:['ignore',log.fd,log.fd]});
    child.once('error',reject);child.once('exit',code=>code===0?accept():reject(new Error('Local acceptance failed; see '+logPath)));
  });}finally{await log.close();}
}
try{
  let healthy=false;
  for(let attempt=0;attempt<100;attempt++){
    if(worker.exitCode!==null)throw new Error('Local worker exited before readiness.');
    try{healthy=(await fetch(env.REPLAY_WORKER_URL+'/health',{signal:AbortSignal.timeout(1000)})).ok;}catch{}
    if(healthy)break;
    await new Promise(accept=>setTimeout(accept,100));
  }
  assert.ok(healthy,'Local worker did not become healthy.');
  for(let trial=1;trial<=trials;trial++){
    const reset=await fetch('http://'+env.FIRESTORE_EMULATOR_HOST+'/emulator/v1/projects/'+project+'/databases/(default)/documents',
      {method:'DELETE',signal:AbortSignal.timeout(30_000)});
    assert.ok(reset.ok,'Failed to reset isolated demo Firestore.');
    const name=series+'-'+trial;
    await runNode(resolve(output,name+'.log'));
    const destination=resolve(output,name+'.json');
    await copyFile(resolve(root,'.replay-lab/native-player/report.json'),destination);
    const report=JSON.parse(await readFile(destination,'utf8'));
    console.log(JSON.stringify({trial:name,fixtures:report.fixtures.map(f=>({fixture:f.fixture,serverReadyMs:f.serverReceivedToReadyAndResolutionMs}))}));
  }
}finally{
  worker.kill();
  await new Promise(accept=>worker.exitCode!==null||worker.signalCode!==null?accept():worker.once('exit',accept));
  await workerLog.close();
}
