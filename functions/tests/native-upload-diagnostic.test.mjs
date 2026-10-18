import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeUploadDiagnosticEnabled,nativeUploadDiagnosticTraceId,nativeUploadDiagnosticTimings,callNativeWorker,callVerifiedWorker} from '../lib/services/nativeRecordingValidation.js';

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const enabled={AOF_REPLAY_UPLOAD_PERF_TRACE:'1',GCLOUD_PROJECT:'demo-aof-native-player',FUNCTIONS_EMULATOR:'true'};
test('diagnostic UUIDs are per-attempt, scoped and off by default',async()=>{
  const ids=await Promise.all(Array.from({length:100},async()=>nativeUploadDiagnosticTraceId(enabled)));
  assert.equal(new Set(ids).size,100);assert.ok(ids.every(id=>UUID.test(id)));
  for(const env of [{},{...enabled,AOF_REPLAY_UPLOAD_PERF_TRACE:''},{...enabled,FUNCTIONS_EMULATOR:''},
    {...enabled,GCLOUD_PROJECT:'production-project'},{...enabled,GCLOUD_PROJECT:'age-of-friends-staging',AOF_REPLAY_UPLOAD_PERF_TRACE:'0'}]){
    assert.equal(nativeUploadDiagnosticEnabled(env),false);assert.equal(nativeUploadDiagnosticTraceId(env),undefined);
  }
  assert.ok(UUID.test(nativeUploadDiagnosticTraceId({AOF_REPLAY_UPLOAD_PERF_TRACE:'1',GCLOUD_PROJECT:'age-of-friends-staging'})));
});
test('numeric log allowlist excludes identities, payloads and malformed numeric values',()=>{
  const result=nativeUploadDiagnosticTimings({sourceHash:'secret',playerId:'private',replayBase64:'private',nativeHandlerTotalMs:42,
    mappingMs:NaN,workerStages:{statisticsAndSocialProjectionMs:12,sourceHash:'secret',privateValueMs:1,
      statisticsSubsteps:{skirmishDetectionMs:7,chat:'private'}},readModelCreationMs:-1,validationPublicationMs:Infinity});
  assert.deepEqual(result,{nativeHandlerTotalMs:42,workerStages:{statisticsAndSocialProjectionMs:12,statisticsSubsteps:{skirmishDetectionMs:7}}});
});
test('internal authenticated native transport forwards only an enabled valid UUID; no legacy retry',async()=>{
  const saved={...process.env};
  try{
    Object.assign(process.env,enabled,{REPLAY_WORKER_AUTH_TOKEN:'private-bearer'});
    const id=nativeUploadDiagnosticTraceId(process.env);let calls=0;
    const transport={diagnosticTraceId:id,fetcher:async(url,options)=>{calls++;
      assert.equal(url,'http://127.0.0.1:8090/process-native-v1');
      assert.equal(options.headers['X-AoF-Upload-Trace-Id'],id);
      assert.equal(options.headers.authorization,'Bearer private-bearer');
      assert.deepEqual(JSON.parse(options.body),{fileName:'private.aoe2record',replayBase64:'YQ=='});
      return new Response('{"state":"VERIFIED_UNPUBLISHED"}');}};
    assert.equal((await callNativeWorker('http://127.0.0.1:8090','private.aoe2record','YQ==',transport)).state,'VERIFIED_UNPUBLISHED');
    assert.equal(calls,1);
    for(const value of ['bad','a'.repeat(64),id.toUpperCase(),id+'\n'])await assert.rejects(callNativeWorker('http://127.0.0.1:8090','x.aoe2record','YQ==',{...transport,diagnosticTraceId:value}),/diagnostic trace/);
    assert.equal(calls,1);
    await assert.rejects(callVerifiedWorker('http://127.0.0.1:8090','/social-evidence-v1a',{},transport),/diagnostic trace/);
    delete process.env.AOF_REPLAY_UPLOAD_PERF_TRACE;
    await assert.rejects(callNativeWorker('http://127.0.0.1:8090','x.aoe2record','YQ==',transport),/diagnostic trace/);
    await callNativeWorker('http://127.0.0.1:8090','x.aoe2record','YQ==',{fetcher:async(_url,options)=>{
      assert.equal(options.headers['X-AoF-Upload-Trace-Id'],undefined);return new Response('{}');}});
    Object.assign(process.env,enabled);
    await assert.rejects(callNativeWorker('http://127.0.0.1:8090','x.aoe2record','YQ==',{...transport,fetcher:async()=>{calls++;return new Response('{}',{status:400});}}),/legacy was not invoked/);
    assert.equal(calls,2);
  }finally{for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];Object.assign(process.env,saved);}
});
