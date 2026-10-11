/**
 * HTTP/auth transport smoke against an actual LOCAL Firebase Functions emulator.
 * No source uploads, scored Games, external Firebase, worker or cloud mutation.
 * Tests real Auth emulator identity tokens and callable HTTP authorization.
 */
import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';

const project='demo-aof-e2e';
assert.equal(process.env.GCLOUD_PROJECT,project,'Only a fixed local demo project is permitted');
for(const key of ['FIRESTORE_EMULATOR_HOST','FIREBASE_AUTH_EMULATOR_HOST','FIREBASE_STORAGE_EMULATOR_HOST'])
  assert.match(process.env[key]??'',/^(127\.0\.0\.1|localhost):[0-9]+$/,key+' must use loopback');
assert.equal(process.env.FUNCTIONS_EMULATOR,'true','HTTP must use actual Functions emulator mode');
const app=initializeApp({projectId:project,name:'staging-native-http-smoke'});
const adminAuth=getAuth(app),db=getFirestore(app),region='europe-west1';
const endpoint=name=>'http://127.0.0.1:5001/'+project+'/'+region+'/'+name;
const commit='a'.repeat(40);
const login=async(email,password)=>{
  const response=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local-demo',
    {method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({email,password,returnSecureToken:true})});
  const json=await response.json();
  assert.equal(response.status,200,'Auth emulator login must succeed');
  assert.ok(json.idToken);
  return json.idToken;
};
async function callable(name,data,token){
  const response=await fetch(endpoint(name),{
    method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},
    body:JSON.stringify({data})});
  const json=await response.json();
  return {status:response.status,result:json.result,error:json.error};
}
const members=[
  {uid:'test-http-admin',playerId:'smoke-admin',role:'ADMIN',email:'http-admin@local.test',password:'nonsecret-emulator-only-123'},
  {uid:'test-http-player',playerId:'smoke-player',role:'PLAYER',email:'http-player@local.test',password:'nonsecret-emulator-only-456'}
];
try {
  for(const member of members){
    await adminAuth.createUser({uid:member.uid,email:member.email,password:member.password});
    await db.collection('authLinks').doc(member.uid).create({playerId:member.playerId});
    await db.collection('players').doc(member.playerId).create({
      playerId:member.playerId,role:member.role,membershipStatus:'ACTIVE',steamName:member.role,synthetic:true});
  }
  const tokens=await Promise.all(members.map(m=>login(m.email,m.password)));
  const adminHealth=await callable('backendHealth',{},tokens[0]);
  assert.equal(adminHealth.status,200);
  assert.equal(adminHealth.result?.ok,true);
  assert.equal(adminHealth.result?.role,'ADMIN');
  const playerHealth=await callable('backendHealth',{},tokens[1]);
  assert.equal(playerHealth.status,200);
  assert.equal(playerHealth.result?.role,'PLAYER');
  const input={matchId:'approved-smoke-match',gameId:'g1',expectedCommit:commit};
  const adminStatus=await callable('adminGetStagingE2eReadiness',input,tokens[0]);
  assert.equal(adminStatus.status,200,JSON.stringify(adminStatus.error));
  assert.equal(adminStatus.result?.project,project);
  assert.equal(adminStatus.result?.contract,'AOF_STAGING_E2E_PREFLIGHT_V1');
  assert.equal(adminStatus.result?.configReady,false,
    'Without real deployment/flag setup the readiness response must remain NO-GO');
  assert.ok(adminStatus.result?.blockers.includes('deployedCommitMatches'));
  assert.equal(adminStatus.result?.flags?.validationGameAllowlisted,false);
  assert.equal(adminStatus.result?.flags?.publicationGameAllowlisted,false);
  assert.equal(adminStatus.result?.rollbackReady,false);
  assert.ok(!JSON.stringify(adminStatus.result).includes('nonsecret-emulator-only'));
  const wrongRole=await callable('adminGetStagingE2eReadiness',input,tokens[1]);
  assert.equal(wrongRole.error?.status,'PERMISSION_DENIED');
  const noAuth=await callable('adminGetStagingE2eReadiness',input,null);
  assert.equal(noAuth.error?.status,'UNAUTHENTICATED');
  const unallowlisted=await callable('adminGetNativeReadyReview',{
    matchId:'approved-smoke-match',gameId:'g1',candidateId:'b'.repeat(64)},tokens[0]);
  assert.equal(unallowlisted.error?.status,'FAILED_PRECONDITION');
  const unpublishedPlayer=await callable('adminGetNativeReadyReview',{
    matchId:'approved-smoke-match',gameId:'g1',candidateId:'b'.repeat(64)},tokens[1]);
  assert.equal(unpublishedPlayer.error?.status,'PERMISSION_DENIED');
  console.log(JSON.stringify({status:'PASS',contract:'AOF_STAGING_E2E_HTTP_SMOKE_V1',
    project,adminAuthenticated:true,playerAuthenticated:true,
    stagingPreflightFailClosed:true,unauthorizedReaderDenied:true,
    mutationPerformed:false,cloudTest:false}));
}finally{
  await db.terminate();
  await deleteApp(app);
}
