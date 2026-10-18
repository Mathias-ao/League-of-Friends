/** Join actual demo handler/worker records to the real authenticated dataset.
 * No private input, raw logs, identity or source hash is returned or persisted.
 */
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const check=(condition,message)=>{if(!condition)throw Error(message);};
const numeric=value=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.values(value).every(v=>typeof v==='number'?Number.isFinite(v)&&v>=0:numeric(v));
export async function diagnosticRenderWitness({receipt,dataset,expected,records,workerLogPath,root}){
  const id=receipt.diagnosticTraceId;
  check(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id??'')&&id.length===36,'Invalid receipt trace UUID');
  const functions=records.filter(r=>r.diagnosticTraceId===id);
  check(functions.length===1&&functions[0].status==='READY'&&functions[0].workerInvoked===true&&functions[0].route==='/process-native-v1','Functions UUID did not join one fresh successful attempt');
  check(numeric(functions[0].timings)&&numeric(functions[0].validationTimings),'Functions timing fields are not numeric-only');
  let workers=[];
  // Worker logging follows response flush; tolerate its bounded local flush lag.
  for(let attempt=0;attempt<50;attempt++){
    const bytes=await readFile(workerLogPath);check(bytes.length<=8*1024*1024,'Worker log bound exceeded');
    workers=bytes.toString('utf8').split('\n').flatMap(line=>{try{const r=JSON.parse(line);return r.diagnosticTraceId===id?[r]:[];}catch{return [];}});
    if(workers.length)break;await new Promise(resolve=>setTimeout(resolve,20));
  }
  check(workers.length===1&&workers[0].status==='SUCCEEDED'&&workers[0].route==='/process-native-v1'&&numeric(workers[0].timings),'Worker UUID/numeric log did not match');
  for(const record of [...functions,...workers]){
    const text=JSON.stringify(record).toLowerCase();
    for(const forbidden of ['sourcehash','replaybase64','filename','playerid','matchid','gameid','authorization','bearer'])check(!text.includes(forbidden),'Private field in diagnostic log');
  }
  const rendered=await new Promise((accept,reject)=>{
    const child=spawn(process.execPath,['--import','./tests/register-assets.mjs','--import','tsx','tests/upload-diagnostic-render-witness.mjs'],
      {cwd:resolve(root,'web'),stdio:['pipe','pipe','pipe']});
    const chunks=[];let size=0;const timer=setTimeout(()=>{child.kill();reject(Error('Render witness timeout'));},20_000);
    child.stdout.on('data',chunk=>{size+=chunk.length;if(size>16_384){child.kill();return;}chunks.push(chunk);});
    // Never print child diagnostics: private input may be mentioned by React.
    child.stderr.resume();child.once('error',()=>{clearTimeout(timer);reject(Error('Render witness unavailable'));});
    child.once('exit',code=>{clearTimeout(timer);if(code!==0)return reject(Error('Render witness failed; private input omitted'));
      try{accept(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{reject(Error('Invalid sanitized witness output'));}});
    child.stdin.end(JSON.stringify({receipt,dataset,expected}));
  });
  check(rendered.diagnosticTraceId===id&&rendered.sourceRevisionRendered===true,'Rendered witness UUID/source mismatch');
  return {...rendered,functionsNumericLogJoined:true,authenticatedWorkerLogJoined:true,diagnosticLogPrivacyChecked:true};
}
