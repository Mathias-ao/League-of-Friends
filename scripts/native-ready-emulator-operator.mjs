#!/usr/bin/env node
/**
 * Local MANUAL E2E operator helper for the already-existing reviewed native
 * callables. Requires the exact demo-aof-e2e Firestore/Storage/Auth emulators.
 * This does NOT bypass actual result workflows, seed canonicalResult, deploy,
 * change flags, or run against staged/production Firebase services.
 * Do not use as a browser-to-HTTPS or staging acceptance certificate.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,isAbsolute,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const PROJECT='demo-aof-e2e';
const SHA=/^[a-f0-9]{64}$/;
const ID=/^[A-Za-z0-9_-]{1,200}$/;
const localHost=/^(?:localhost|127\.0\.0\.1):[0-9]{2,5}$/;
const sha=b=>createHash('sha256').update(b).digest('hex');
const present=v=>typeof v==='string'&&v.trim().length>0;
function validEnv(env,operation,matchId,gameId){
  const errors=[];
  if(env.GCLOUD_PROJECT!==PROJECT||env.AOF_NATIVE_REPLAY_PROJECT!==PROJECT)
    errors.push('Only the explicitly selected demo-aof-e2e project is accepted');
  for(const key of ['FIRESTORE_EMULATOR_HOST','FIREBASE_STORAGE_EMULATOR_HOST','FIREBASE_AUTH_EMULATOR_HOST'])
    if(!localHost.test(env[key]??''))errors.push('Loopback '+key+' required');
  if(env.FUNCTIONS_EMULATOR!=='true')errors.push('Require Functions emulator mode');
  if(env.REPLAY_BUCKET!==PROJECT+'.appspot.com')errors.push('Require explicit demo Storage bucket');
  if(!SHA.test(env.AOF_NATIVE_REPLAY_PROCESSOR_REVISION??''))
    errors.push('Pin the actual worker source-code revision');
  const allow=(key)=>(env[key]??'').split(',').map(s=>s.trim()).includes(matchId+'/'+gameId);
  if(['validate','publish'].includes(operation)&&
     (env.AOF_NATIVE_REPLAY_INTEGRATION!=='validate-v1'||!allow('AOF_NATIVE_REPLAY_GAME_ALLOWLIST')))
    errors.push('Local native validation flag and exact Game allowlist missing');
  if(['publish','rollback'].includes(operation)&&!allow('AOF_NATIVE_READY_GAME_ALLOWLIST'))
    errors.push('Local reviewed READY exact Game allowlist missing');
  if(operation==='publish'&&(env.AOF_NATIVE_READY_PUBLICATION!=='reviewed-v1'||
     env.AOF_ACTIVE_NATIVE_PLAYER_READS!=='1'||env.AOF_ACTIVE_NATIVE_SOCIAL_READS!=='1'))
    errors.push('Local reviewed READY publication and both read flags must be explicitly opted in');
  if(operation==='rollback'&&env.AOF_NATIVE_READY_ROLLBACK!=='reviewed-v1')
    errors.push('Separately gated rollback flag missing');
  if(operation==='validate'){
    try {
      const u=new URL(env.REPLAY_WORKER_URL??'');
      if(u.protocol!=='http:'||!['localhost','127.0.0.1'].includes(u.hostname)||u.username||u.password)
        errors.push('Worker must be plain-HTTP loopback without credentials in URL');
    }catch{errors.push('Missing valid localhost REPLAY_WORKER_URL');}
    if(!present(env.REPLAY_WORKER_AUTH_TOKEN))errors.push('Authenticated local native worker token missing');
  }
  return errors;
}
function validManifest(m,operation){
  const errors=[];
  if(!m||typeof m!=='object'||Array.isArray(m))return ['Missing structured operator manifest'];
  for(const key of ['matchId','gameId','adminAuthUid'])
    if(!ID.test(m[key]??''))errors.push('Missing or invalid '+key);
  if(!['inspect','validate','publish','rollback'].includes(operation))
    errors.push('Unsupported explicit operation');
  if(['validate','publish','rollback'].includes(operation)&&!SHA.test(m.sourceSha256??''))
    errors.push('Expected original SHA-256 must be independently pinned');
  if(operation==='validate'&&(!isAbsolute(m.recordingPath??'')||
     !/\.aoe2record$/i.test(m.recordingPath??'')))
    errors.push('Original recording must use an absolute private .aoe2record path');
  if(['publish','rollback'].includes(operation)){
    if(!SHA.test(m.candidateId??'')||!SHA.test(m.statisticsSha256??''))
      errors.push('Pin candidateId and statistics artifact SHA-256 from reviewed native validation');
    if(!Number.isSafeInteger(m.expectedStatisticsRevision)||m.expectedStatisticsRevision<0||
       !Number.isSafeInteger(m.expectedResultRevision)||m.expectedResultRevision<1)
      errors.push('Exact expected statistics/official-result revisions are required');
    if(m.expectedActiveSourceHash!==null&&
       !SHA.test(m.expectedActiveSourceHash??''))
      errors.push('Explicit current source must be null or pinned SHA-256');
    if(!present(m.reason)||m.reason.trim().length<20||m.reason.length>1000)
      errors.push('Audited independent review reason must be 20–1000 characters');
  }
  return errors;
}
function selfTest(){
  const demo={GCLOUD_PROJECT:PROJECT,AOF_NATIVE_REPLAY_PROJECT:PROJECT,FUNCTIONS_EMULATOR:'true',
    FIRESTORE_EMULATOR_HOST:'127.0.0.1:8085',FIREBASE_STORAGE_EMULATOR_HOST:'127.0.0.1:9199',
    FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099',REPLAY_BUCKET:PROJECT+'.appspot.com',
    AOF_NATIVE_REPLAY_PROCESSOR_REVISION:'a'.repeat(64),
    AOF_NATIVE_REPLAY_INTEGRATION:'validate-v1',AOF_NATIVE_REPLAY_GAME_ALLOWLIST:'m/g',
    AOF_NATIVE_READY_GAME_ALLOWLIST:'m/g',AOF_NATIVE_READY_PUBLICATION:'reviewed-v1',
    AOF_ACTIVE_NATIVE_PLAYER_READS:'1',AOF_ACTIVE_NATIVE_SOCIAL_READS:'1',
    AOF_NATIVE_READY_ROLLBACK:'reviewed-v1',REPLAY_WORKER_URL:'http://127.0.0.1:8090',
    REPLAY_WORKER_AUTH_TOKEN:'test-only'};
  assert.deepEqual(validEnv(demo,'validate','m','g'),[]);
  assert.deepEqual(validEnv(demo,'publish','m','g'),[]);
  assert.deepEqual(validEnv(demo,'rollback','m','g'),[]);
  assert.ok(validEnv({...demo,GCLOUD_PROJECT:'league-of-friends-cc274'},'validate','m','g').length);
  assert.ok(validEnv({...demo,FIRESTORE_EMULATOR_HOST:'remote.example:8085'},'publish','m','g').length);
  assert.ok(validEnv({...demo,AOF_ACTIVE_NATIVE_SOCIAL_READS:'0'},'publish','m','g').length);
  assert.ok(validEnv({...demo,AOF_NATIVE_READY_ROLLBACK:'0'},'rollback','m','g').length);
  const m={matchId:'m',gameId:'g',adminAuthUid:'admin',sourceSha256:'b'.repeat(64),
    recordingPath:'/tmp/private.aoe2record',candidateId:'c'.repeat(64),
    statisticsSha256:'d'.repeat(64),expectedStatisticsRevision:0,
    expectedResultRevision:1,expectedActiveSourceHash:null,
    reason:'Independent controlled test result reviewed before publication.'};
  assert.deepEqual(validManifest(m,'validate'),[]);
  assert.deepEqual(validManifest(m,'publish'),[]);
  assert.ok(validManifest({...m,reason:'no'},'publish').length);
  assert.ok(validManifest({...m,sourceSha256:'no'},'validate').length);
  assert.ok(validManifest({...m,expectedActiveSourceHash:'bad'},'rollback').length);
  console.log('PASS: isolated-only native E2E operator refuses non-demo resources and unpinned actions');
}
async function execute(operation,path){
  const m=JSON.parse(readFileSync(resolve(path),'utf8'));
  const errors=[...validManifest(m,operation),...validEnv(process.env,operation,m.matchId,m.gameId)];
  if(errors.length)throw new Error('NO-GO: '+errors.join('; '));
  const {db}=await import('../functions/lib/config/firebase.js');
  const gameRef=db.collection('matches').doc(m.matchId).collection('games').doc(m.gameId);
  const actorLink=await db.collection('authLinks').doc(m.adminAuthUid).get();
  const admin=actorLink.exists?await db.collection('players').doc(actorLink.data().playerId).get():null;
  if(!actorLink.exists||!admin?.exists||admin.data()?.role!=='ADMIN'||
    admin.data()?.membershipStatus!=='ACTIVE')throw new Error('NO-GO: linked active administrator not found');
  if(!(await gameRef.get()).exists)throw new Error('NO-GO: reviewed Game does not exist');

  if(operation==='inspect'){
    const game=(await gameRef.get()).data();
    const candidates=await gameRef.collection('nativeReplayValidations').get();
    const found=candidates.docs.filter(d=>d.data().sourceHash===m.sourceSha256&&d.data().validatedBy===actorLink.data().playerId);
    const result={operation,gameStatus:game.status,officialRevision:game.canonicalResult?.revision??null,
      activeSourceHash:game.activeReplayStatisticsId??null,statisticsRevision:game.replayStatisticsRevision??0,
      candidates:found.map(d=>({candidateId:d.id,state:d.data().state,sourceHash:d.data().sourceHash,
        statisticsSha256:d.data().statistics?.sha256,readyBlockers:d.data().readyBlockers}))};
    console.log(JSON.stringify(result,null,2));return;
  }
  if(operation==='validate'){
    const original=readFileSync(m.recordingPath);
    if(!original.length||original.length>32*1024*1024||sha(original)!==m.sourceSha256)
      throw new Error('NO-GO: original recording bytes differ from independently pinned SHA');
    const {uploadReplay}=await import('../functions/lib/commands/statistics/uploadReplay.js');
    const result=await uploadReplay.run({data:{matchId:m.matchId,gameId:m.gameId,
      fileName:basename(m.recordingPath),replayBase64:original.toString('base64'),
      processingMode:'NATIVE_VALIDATION_V1'},auth:{uid:m.adminAuthUid}});
    if(result.state!=='VALIDATED_NOT_READY'||result.activated!==false||result.sourceHash!==m.sourceSha256)
      throw new Error('NO-GO: validation did not stop at an unpublished candidate');
    const candidate=(await gameRef.collection('nativeReplayValidations').doc(result.candidateId).get()).data();
    if(candidate?.state!=='VALIDATED_NOT_READY'||candidate.active!==false||
      candidate.originalRecording?.permanent!==true||
      candidate.originalRecording?.sourceDeletionAuthorized!==false)
      throw new Error('NO-GO: immutable candidate did not retain the source');
    console.log(JSON.stringify({operation,result:'VALIDATED_NOT_READY',candidateId:result.candidateId,
      sourceSha256:result.sourceHash,statisticsSha256:candidate.statistics.sha256,
      next:'Independently accept a test Game result using the official submission/confirmation process, then prepare exact PUBLISH input.'},null,2));
    return;
  }
  const game=(await gameRef.get()).data();
  // The operator MUST supply explicit expected revisions; do not infer that
  // the test's observed source/current winner authorizes publication.
  if((game.activeReplayStatisticsId??null)!==m.expectedActiveSourceHash||
     (game.replayStatisticsRevision??0)!==m.expectedStatisticsRevision||
     game.canonicalResult?.revision!==m.expectedResultRevision)
    throw new Error('NO-GO: reviewed active source or official Game result revision changed');
  const request={operation:operation==='publish'?'PUBLISH':'ROLLBACK',
    matchId:m.matchId,gameId:m.gameId,candidateId:m.candidateId,
    sourceHash:m.sourceSha256,expectedArtifactSha256:m.statisticsSha256,
    expectedActiveSourceHash:m.expectedActiveSourceHash,
    expectedStatisticsRevision:m.expectedStatisticsRevision,
    expectedResultRevision:m.expectedResultRevision,reason:m.reason};
  const {adminPublishNativeReady}=await import('../functions/lib/commands/statistics/publishNativeReady.js');
  const result=await adminPublishNativeReady.run({data:request,auth:{uid:m.adminAuthUid}});
  if(result.success!==true||result.state!==(operation==='publish'?'READY':'ROLLED_BACK'))
    throw new Error('NO-GO: reviewed native source mutation was not confirmed');
  console.log(JSON.stringify({operation,state:result.state,alreadyPublished:result.alreadyPublished??null,
    alreadyRolledBack:result.alreadyRolledBack??null,replayStatisticsRevision:result.replayStatisticsRevision,
    sourceSha256:result.sourceHash},null,2));
}
const called=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(called){
  if(process.argv[2]==='--self-test')selfTest();
  else if(!['inspect','validate','publish','rollback'].includes(process.argv[2])||
          !process.argv[3]){console.error('Usage: node scripts/native-ready-emulator-operator.mjs <inspect|validate|publish|rollback> /ABSOLUTE/PRIVATE/manifest.json');process.exitCode=2;}
  else execute(process.argv[2],process.argv[3]).catch(e=>{
    console.error(e instanceof Error?e.message:'Native operator rejected');
    process.exitCode=1;
  });
}
