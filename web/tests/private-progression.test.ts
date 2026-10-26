import test from 'node:test';
import assert from 'node:assert/strict';
import {privateProgressionEnabled} from '../src/domain/privateProgression';
test('private simulation is visible only in an explicit demo emulator build',()=>{
 const env={VITE_AOF_SOCIAL_E2E_PROGRESS:'pilot-v1',VITE_USE_EMULATORS:'true',VITE_FIREBASE_PROJECT_ID:'demo-aof-native-player'};
 assert.equal(privateProgressionEnabled(),false);assert.equal(privateProgressionEnabled(env),true);
 for(const change of [{VITE_FIREBASE_PROJECT_ID:'age-of-friends-staging'},{VITE_FIREBASE_PROJECT_ID:'league-of-friends'},{VITE_USE_EMULATORS:'false'},{VITE_AOF_SOCIAL_E2E_PROGRESS:''}])assert.equal(privateProgressionEnabled({...env,...change}),false);
});
