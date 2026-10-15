import test from 'node:test';
import assert from 'node:assert/strict';
import {callNativeWorker} from '../lib/services/nativeRecordingValidation.js';

test('private native Cloud Run uses both IAM identity and the separate application bearer',async()=>{
  const beforeToken=process.env.REPLAY_WORKER_AUTH_TOKEN;
  const beforeEmulator=process.env.FUNCTIONS_EMULATOR;
  try{
    process.env.REPLAY_WORKER_AUTH_TOKEN='test-app-secret';
    delete process.env.FUNCTIONS_EMULATOR;
    const audience='https://staging-worker.example.invalid';
    let calls=0;
    const result=await callNativeWorker(audience+'/', 'game.aoe2record', 'YQ==', {
      getIdToken:async value=>{assert.equal(value,audience);return 'test-cloud-run-id-token';},
      fetcher:async (url,options)=>{
        calls++;
        assert.equal(url,audience+'/process-native-v1');
        assert.equal(options.method,'POST');
        assert.equal(options.redirect,'error');
        assert.equal(options.headers.authorization,'Bearer test-app-secret');
        assert.equal(options.headers['X-Serverless-Authorization'],'Bearer test-cloud-run-id-token');
        assert.equal(options.headers['content-type'],'application/json');
        assert.deepEqual(JSON.parse(options.body),{fileName:'game.aoe2record',replayBase64:'YQ=='});
        return new Response('{"state":"VERIFIED_UNPUBLISHED"}',{status:200});
      },
    });
    assert.deepEqual(result,{state:'VERIFIED_UNPUBLISHED'});
    assert.equal(calls,1);

    await assert.rejects(callNativeWorker(audience,'game.aoe2record','YQ==',{
      getIdToken:async()=>'',fetcher:async()=>assert.fail('Never send without IAM token'),
    }),/identity token/);
    await assert.rejects(callNativeWorker(audience,'game.aoe2record','YQ==',{
      getIdToken:async()=> 'identity',
      fetcher:async()=>new Response('{"error":"forbidden"}',{status:403}),
    }),/Native worker rejected the recording/);

    delete process.env.REPLAY_WORKER_AUTH_TOKEN;
    await assert.rejects(callNativeWorker(audience,'game.aoe2record','YQ==',{
      getIdToken:async()=>assert.fail('No IAM fetch without app secret'),
      fetcher:async()=>assert.fail('No request without app secret'),
    }),/Native worker requires authenticated HTTPS/);
  }finally{
    if(beforeToken===undefined)delete process.env.REPLAY_WORKER_AUTH_TOKEN;
    else process.env.REPLAY_WORKER_AUTH_TOKEN=beforeToken;
    if(beforeEmulator===undefined)delete process.env.FUNCTIONS_EMULATOR;
    else process.env.FUNCTIONS_EMULATOR=beforeEmulator;
  }
});

test('native emulator remains loopback-only with app bearer and never requests IAM',async()=>{
  const beforeToken=process.env.REPLAY_WORKER_AUTH_TOKEN;
  const beforeEmulator=process.env.FUNCTIONS_EMULATOR;
  try{
    process.env.REPLAY_WORKER_AUTH_TOKEN='emulator-secret';
    process.env.FUNCTIONS_EMULATOR='true';
    let called=false;
    const result=await callNativeWorker('http://127.0.0.1:8090/','game.aoe2record','YQ==',{
      getIdToken:async()=>assert.fail('Emulator must not request IAM'),
      fetcher:async (url,options)=>{
        called=true;
        assert.equal(url,'http://127.0.0.1:8090/process-native-v1');
        assert.equal(options.headers.authorization,'Bearer emulator-secret');
        assert.equal(options.headers['X-Serverless-Authorization'],undefined);
        return new Response('{"state":"VERIFIED_UNPUBLISHED"}',{status:200});
      },
    });
    assert.equal(called,true);
    assert.equal(result.state,'VERIFIED_UNPUBLISHED');
  }finally{
    if(beforeToken===undefined)delete process.env.REPLAY_WORKER_AUTH_TOKEN;
    else process.env.REPLAY_WORKER_AUTH_TOKEN=beforeToken;
    if(beforeEmulator===undefined)delete process.env.FUNCTIONS_EMULATOR;
    else process.env.FUNCTIONS_EMULATOR=beforeEmulator;
  }
});
