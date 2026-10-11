#!/usr/bin/env node
/**
 * Non-mutating manual E2E gate. Checks a human/operator attestation manifest;
 * DOES NOT test cloud connectivity, identity, Firebase configuration or results.
 * Never accepts production and never changes Firebase flags or data.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

export const VERSION='AOF_MANUAL_E2E_PREPARATION_V1';
export const COMMON_GATES=[
  'commitReviewedAndCIConfirmed',
  'correctProjectAndClientVerified',
  'separateAdministratorAndParticipantAccountsVerified',
  'syntheticTestDataIsolated',
  'replayProvenanceAndIdentityMappingIndependentlyReviewed',
  'officialResultAuthorityAndExpectedOutcomeRecorded',
  'matchPlayWindowAndAllowedSettingsReviewed',
  'firebaseAuthFunctionsFirestoreStorageAndWorkerChecked',
  'browserCanReachCorrectLiveBackendNotPreview',
  'preTestBackupVerified',
  'negativeAccessAndRevisionChecksPrepared',
  'rollbackOrCompensatingProcedureReviewed',
  'evidenceCaptureAndStopCriteriaReady',
];
export const NATIVE_GATES=[
  'nativeGameAllowlistAndWorkerRevisionPinned',
  'nativeAdminUploadInvocationReady',
  'nativeValidationCandidateReviewMethodReady',
  'independentAcceptedResultBeforePublication',
  'publicationAndReadFlagsExplicitlyScoped',
  'manualPublishAndRollbackInvocationReady',
  'nativeViewerBrowserCheckpointPlanReady',
];
export const STAGING_GATES=[
  'specificStagingDeploymentSeparatelyAuthorized',
  'exactDeployedCommitAndRulesVerified',
  'stagingIdentityRedirectAndSecretConfigurationVerified',
  'stagingDataBaselineAndRollbackVerified',
];
const SHA=/^[0-9a-f]{40}$/;
const isObject=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function gateNames(m){
  return [...COMMON_GATES,...(m.mode==='native-assisted'?NATIVE_GATES:[]),
    ...(m.environment==='staging'?STAGING_GATES:[])];
}
export function exampleManifest(environment='emulator',mode='legacy-browser'){
  const obj={schemaVersion:VERSION,environment,
    projectId:environment==='emulator'?'demo-aof-e2e':'age-of-friends-staging',
    mode,commitSha:'FILL_CURRENT_REVIEWED_40_CHAR_COMMIT',
    gates:{}};
  for(const gate of gateNames(obj))obj.gates[gate]=false;
  return obj;
}
export function evaluateManifest(m){
  const errors=[];
  if(!isObject(m))return {ok:false,errors:['Manifest must be a JSON object'],gates:[],passed:0};
  if(m.schemaVersion!==VERSION)errors.push('Unexpected schema version');
  if(!['emulator','staging'].includes(m.environment))errors.push('Only emulator or separately authorized staging is supported');
  if(!['legacy-browser','native-assisted'].includes(m.mode))errors.push('Unknown test mode');
  if(m.environment==='emulator'&&(!/^demo-[a-z0-9-]+$/.test(m.projectId??'')||m.projectId!=='demo-aof-e2e'))
    errors.push('Local browser acceptance must use the dedicated demo-aof-e2e project');
  if(m.environment==='staging'&&m.projectId!=='age-of-friends-staging')
    errors.push('Only age-of-friends-staging is an allowed cloud acceptance project');
  if(m.projectId==='league-of-friends-cc274'||m.projectId==='league-of-freinds')
    errors.push('Production/default project IDs are never allowed');
  if(!SHA.test(m.commitSha??''))errors.push('Use a reviewed exact 40-character Git commit');
  if(!isObject(m.gates))errors.push('Missing operator-attested gates');
  const names=gateNames(m);
  const incomplete=names.filter(name=>m.gates?.[name]!==true);
  if(m.environment==='staging'&&m.mode==='native-assisted'){
    if(m.gates?.specificNativeStagingFlagApproval!==true)
      incomplete.push('specificNativeStagingFlagApproval');
  }
  if(m.gates&&Object.keys(m.gates).some(name=>!names.includes(name)&&name!=='specificNativeStagingFlagApproval'))
    errors.push('Unknown/obsolete readiness-gate field; review the current template');
  return {ok:errors.length===0&&incomplete.length===0,
    errors,incomplete,passed:names.length-incomplete.filter(x=>names.includes(x)).length,
    required:names.length+(m.environment==='staging'&&m.mode==='native-assisted'?1:0),
    environment:m.environment,mode:m.mode,projectId:m.projectId,commitSha:m.commitSha,
    declarationOnly:true};
}
function selfTest(){
  for(const env of ['emulator','staging'])for(const mode of ['legacy-browser','native-assisted']){
    const m=exampleManifest(env,mode);
    m.commitSha='a'.repeat(40);
    const r=evaluateManifest(m);
    assert.equal(r.ok,false);
    assert.ok(r.incomplete.length>=COMMON_GATES.length);
    for(const k of Object.keys(m.gates))m.gates[k]=true;
    if(env==='staging'&&mode==='native-assisted')m.gates.specificNativeStagingFlagApproval=true;
    assert.equal(evaluateManifest(m).ok,true);
    m.projectId='league-of-friends-cc274';
    assert.equal(evaluateManifest(m).ok,false);
  }
  assert.equal(evaluateManifest(null).ok,false);
  console.log('PASS: offline manual E2E gate evaluator, project refusal and authorization requirements');
}
const invoked=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
  const arg=process.argv[2];
  if(arg==='--self-test')selfTest();
  else if(arg==='--template'){
    console.log(JSON.stringify(exampleManifest(process.argv[3]??'emulator',process.argv[4]??'legacy-browser'),null,2));
  }else if(arg){
    let m;
    try{m=JSON.parse(readFileSync(resolve(arg),'utf8'));}
    catch(e){console.error('NO-GO: unable to read the private operator readiness manifest');process.exit(2);}
    const result=evaluateManifest(m);
    // Prints only expected metadata, named gate statuses, never secrets or raw manifest.
    console.log(JSON.stringify(result,null,2));
    if(!result.ok)process.exitCode=1;
  }else{
    console.error('Usage: node scripts/manual-e2e-preflight.mjs --template [emulator|staging] [legacy-browser|native-assisted]');
    console.error('   or: node scripts/manual-e2e-preflight.mjs /absolute/path/to/private-readiness.json');
    console.error('   or: node scripts/manual-e2e-preflight.mjs --self-test');
    process.exitCode=2;
  }
}
