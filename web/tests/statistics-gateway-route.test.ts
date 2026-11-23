import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

// Exercise the repository's actual method with an intercepted callable boundary.
// Skip construction (Firebase setup is unrelated); substitute only Vite's env.
const source=readFileSync(new URL('../src/data/FirebaseLeagueRepository.ts',import.meta.url),'utf8')
  .replace(/^import .*;\n/gm,'').replace(/export class FirebaseLeagueRepository/,'class FirebaseLeagueRepository')
  .replaceAll('import.meta.env','gatewayEnvironment');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
const create=(env:Record<string,string|undefined>)=>{
  const Repository=new Function('gatewayEnvironment',compiled+';return FirebaseLeagueRepository;')(env);
  const calls:Array<{name:string;data:unknown}>=[];
  const repository=Object.create(Repository.prototype);
  repository.call=(name:string,data:unknown)=>{calls.push({name,data});return Promise.resolve({games:[]});};
  return {repository,calls};
};
const enabled={VITE_AOF_STATISTICS_GATEWAY:'staging-v1',VITE_FIREBASE_PROJECT_ID:'age-of-friends-staging-eu'};

test('explicit staging gateway flag routes each unchanged scope through the closed bootstrap operation',async()=>{
  for(const scope of [{seasonId:'s'},{eventId:'e'},{matchId:'m'}]){
    const {repository,calls}=create(enabled);assert.deepEqual(await repository.statisticsExperience(scope),{games:[]});
    assert.deepEqual(calls,[{name:'getLeagueBootstrap',data:{operation:'STATISTICS_READ_V1',scope}}]);
  }
});

test('default, production, preview and emulator keep the direct Statistics callable',async()=>{
  for(const env of [{},{...enabled,VITE_AOF_STATISTICS_GATEWAY:undefined},
    {...enabled,VITE_AOF_STATISTICS_GATEWAY:'true'},
    {...enabled,VITE_FIREBASE_PROJECT_ID:'age-of-friends-staging'},
    {...enabled,VITE_FIREBASE_PROJECT_ID:'age-of-friends-staging-eu-extra'},
    {...enabled,VITE_FIREBASE_PROJECT_ID:'production-fixture'},
    {...enabled,VITE_FIREBASE_PROJECT_ID:'preview-fixture'},
    {...enabled,VITE_USE_EMULATORS:'true'},
    {...enabled,VITE_FIREBASE_PROJECT_ID:'demo-fixture',VITE_USE_EMULATORS:'true'}]){
    const {repository,calls}=create(env);const scope={seasonId:'s'};await repository.statisticsExperience(scope);
    assert.deepEqual(calls,[{name:'getStatisticsExperience',data:scope}]);
  }
});
