import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {isolatedStagingProject} from '../src/domain/stagingProject';
import {privateHistoryEnabled} from '../src/domain/privateHistory';
import {hostedSocialEnabled} from '../src/domain/hostedSocialProgression';
import {gameplayCandidatesEnabled,gameplayPreviewEnabled} from '../src/domain/gameplayPreview';
import {stagingE2eUiEnabled} from '../src/ui/StagingE2eControls';
import {exampleManifest,evaluateManifest} from '../../scripts/manual-e2e-preflight.mjs';
import {validateObserverConfig} from '../../scripts/upload-staging-observer.mjs';

const enabled={VITE_FIREBASE_PROJECT_ID:'age-of-friends-staging-eu',VITE_FIREBASE_REGION:'europe-west1',
  VITE_USE_EMULATORS:'false',VITE_AOF_INT_V1_PRIVATE_HISTORY:'battle-v1',
  VITE_AOF_INT_V1_PRIVATE_READS:'source-v1',VITE_AOF_HOSTED_SOCIAL_PRIVATE:'v1a',
  VITE_AOF_INT_C2A_PREVIEW:'source-compatible-v1',VITE_AOF_INT_C1_PREVIEW:'wiring-test-v1',VITE_AOF_STAGING_E2E:'true'};
const gates=[isolatedStagingProject,privateHistoryEnabled,hostedSocialEnabled,gameplayCandidatesEnabled,gameplayPreviewEnabled,stagingE2eUiEnabled];
test('actual web gates require exact EU identity, region and explicit opt-in',()=>{
  for(const gate of gates){
    assert.equal(gate(enabled),true);
    assert.equal(gate({}),false);
    for(const patch of [{VITE_FIREBASE_PROJECT_ID:'age-of-friends-staging'},
      {VITE_FIREBASE_PROJECT_ID:'league-of-friends-cc274'},{VITE_FIREBASE_PROJECT_ID:'age-of-friends-staging-eu.evil'},
      {VITE_FIREBASE_REGION:'us-central1'},{VITE_FIREBASE_REGION:undefined},{VITE_USE_EMULATORS:'true'}])
      assert.equal(gate({...enabled,...patch}),false);
  }
  assert.equal(privateHistoryEnabled({...enabled,VITE_AOF_INT_V1_PRIVATE_HISTORY:undefined}),false);
  assert.equal(hostedSocialEnabled({...enabled,VITE_AOF_HOSTED_SOCIAL_PRIVATE:undefined}),false);
});

// Execute actual repository methods; replace only Vite configuration and SDK I/O.
const source=readFileSync(new URL('../src/data/FirebaseLeagueRepository.ts',import.meta.url),'utf8')
  .replace(/^import .*;\n/gm,'').replace('export class FirebaseLeagueRepository','class FirebaseLeagueRepository')
  .replaceAll('import.meta.env','gatewayEnvironment');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
function repository(env:Record<string,string|undefined>){
  const calls:Array<{name:string;data:unknown}>=[];
  const callable=(_unknown:unknown,name:string)=>(data:unknown)=>{calls.push({name,data});return Promise.resolve({data:{}});};
  const Constructor=new Function('gatewayEnvironment','isolatedStagingProject','privateHistoryEnabled','hostedSocialEnabled',
    'gameplayPreviewEnabled','gameplayCandidatesEnabled','httpsCallable',compiled+';return FirebaseLeagueRepository;')
    (env,isolatedStagingProject,privateHistoryEnabled,hostedSocialEnabled,gameplayPreviewEnabled,gameplayCandidatesEnabled,callable);
  const value=Object.create(Constructor.prototype);
  value.call=(name:string,data:unknown)=>{calls.push({name,data});return Promise.resolve({});};
  return {value,calls};
}
test('actual private repository invocation refuses old/disabled/emulator configurations before SDK I/O',async()=>{
  for(const env of [{},{...enabled,VITE_FIREBASE_PROJECT_ID:'age-of-friends-staging'},
    {...enabled,VITE_USE_EMULATORS:'true'},{...enabled,VITE_FIREBASE_REGION:'us-central1'}]){
    const {value,calls}=repository(env);
    for(const invoke of [()=>value.myPersonalityHistory(),()=>value.myHostedSocialProgression(),
      ()=>value.mySocialExperience({matchId:'m',gameId:'g'}),()=>value.myGameplayPreview(),()=>value.myGameplayCandidates(),
      ()=>value.stagingNativeStatus('m','g','a'.repeat(40))])
      await assert.rejects(async()=>invoke());
    assert.deepEqual(calls,[]);
  }
  const {value,calls}=repository(enabled);
  await value.myPersonalityHistory();await value.myHostedSocialProgression();
  await value.mySocialExperience({matchId:'m',gameId:'g'});await value.stagingNativeStatus('m','g','a'.repeat(40));
  assert.deepEqual(calls.map(c=>c.name),['getMyPersonalityHistory','getMyHostedSocialProgression','getMySocialExperience','adminGetStagingE2eReadiness']);
  assert.deepEqual(calls[1].data,{},'no browser owner/policy override');
});

test('offline tools refuse archived staging/production/lookalikes and never attest activation automatically',()=>{
  const manifest=exampleManifest('staging','native-assisted');
  assert.equal(manifest.projectId,'age-of-friends-staging-eu');assert.equal(evaluateManifest(manifest).ok,false);
  manifest.commitSha='a'.repeat(40);
  for(const key of Object.keys(manifest.gates))manifest.gates[key]=true;
  assert.equal(evaluateManifest(manifest).ok,false,'native activation remains a separate explicit gate');
  manifest.gates.specificNativeStagingFlagApproval=true;
  assert.equal(evaluateManifest(manifest).ok,true);
  assert.equal(manifest.gates.disposableStagingDataLossAccepted,true);
  const observer={origin:'https://age-of-friends-staging-eu.web.app',project:manifest.projectId,
    mode:'compact',sourceSha256:'a'.repeat(64),revision:1,matchId:'m',gameId:'g'};
  assert.doesNotThrow(()=>validateObserverConfig(observer));
  for(const project of ['age-of-friends-staging','league-of-friends-cc274','age-of-friends-staging-eu-extra']){
    assert.equal(evaluateManifest({...manifest,projectId:project}).ok,false);
    assert.throws(()=>validateObserverConfig({...observer,project,origin:'https://'+project+'.web.app'}));
  }
  for(const origin of ['https://age-of-friends-staging.web.app','https://age-of-friends-staging-eu.web.app.evil',
    'http://age-of-friends-staging-eu.web.app','https://user@age-of-friends-staging-eu.web.app','http://localhost:5173'])
    assert.throws(()=>validateObserverConfig({...observer,origin}));
});
