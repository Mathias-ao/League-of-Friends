import test from 'node:test';
import assert from 'node:assert/strict';
import {chronicleEligibleCooldown,assertChronicleInteractionEmulator,
 CHRONICLE_COOLDOWN_ELIGIBLE_BATTLES} from '../lib/queries/chronicleInteractionService.js';
test('owner-approved provisional cooldown is three independently eligible Battles, not Games, clock time or quota',()=>{
 assert.equal(CHRONICLE_COOLDOWN_ELIGIBLE_BATTLES,3);
 const ids=['b1','b2','b3','b4','b5'];
 assert.equal(chronicleEligibleCooldown(ids,'b1',null),0);
 for(const id of ['b2','b3','b4'])
  assert.throws(()=>chronicleEligibleCooldown(ids,id,'b1'),/cooling down/);
 assert.equal(chronicleEligibleCooldown(ids,'b5','b1'),4,'exactly three eligible intervening Battles');
 assert.throws(()=>chronicleEligibleCooldown(ids,'b4','b5'),/reordered/);
 assert.throws(()=>chronicleEligibleCooldown(['b2','b3'],'b3','b1'),/incomplete/);
 assert.throws(()=>chronicleEligibleCooldown(['b1','b1'],'b1',null),/ambiguous/);
 assert.throws(()=>chronicleEligibleCooldown(ids,'unreviewed',null),/incomplete/);
});
test('all new Chronicle interactions are hard disabled in production and non-demo emulator projects',()=>{
 for(const env of [
  {},{GCLOUD_PROJECT:'age-of-friends-prod',FUNCTIONS_EMULATOR:'true',AOF_CHRONICLE_INTERACTIONS_V1E:'emulator-only'},
  {GCLOUD_PROJECT:'demo-aof',FUNCTIONS_EMULATOR:'false',AOF_CHRONICLE_INTERACTIONS_V1E:'emulator-only'},
  {GCLOUD_PROJECT:'demo-aof',FUNCTIONS_EMULATOR:'true'}
 ])assert.throws(()=>assertChronicleInteractionEmulator(env),/inactive/);
 assert.doesNotThrow(()=>assertChronicleInteractionEmulator({
  GCLOUD_PROJECT:'demo-aof',FUNCTIONS_EMULATOR:'true',AOF_CHRONICLE_INTERACTIONS_V1E:'emulator-only'}));
});
