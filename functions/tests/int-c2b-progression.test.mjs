import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bindingDigest} from '../lib/engines/nativeRecordingIntegration.js';
import {bindSourceGrades,simulatePrivateProgression} from '../lib/integration/privateProgression.js';
import {assertPrivateProgressionEnabled,getMySocialProgression} from '../lib/queries/getMySocialProgression.js';
import {createSocialE2EPilotCalibration} from '../lib/engines/socialV1History/e2ePilotCalibration.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/int-c2a-synthetic.json',import.meta.url)));
fixture.output={version:'AOF_SOCIAL_E2E_WORKER_1',inputModel:'AOF_DIRECT_SHARED_EPISODES_V1_EXPERIMENTAL',compatibility:fixture.output,
 gradeWitnesses:fixture.output.sourceWitnesses,admission:JSON.parse(readFileSync(new URL('./fixtures/int-c2b-admission-synthetic.json',import.meta.url)))};
const copy=()=>structuredClone(fixture),cal=createSocialE2EPilotCalibration();
const order={event:1000,battle:2,game:2,key:'approved-schedule'};
const bind=(f=copy(),schedule={order})=>bindSourceGrades(f.output,f.input.snapshot,f.input.statistics,f.output.compatibility.legacy.processorRevision,schedule,2,cal);
const chapter=(f=fixture,ord=order)=>({...f.input.snapshot,state:'READY',revision:1,sourceAuthority:f.input.snapshot.authorityRevision,order:ord});
function seal(f){const d=f.output.admission;d.projectionRevision=bindingDigest([d.version,d.policy,d.producerProjectionRevision,d.episodes]);}
test('synthetic adapter conformance links namespaces, uses only own original actor witnesses, preserves raw LIMITED',()=>{
 const f=copy(),before=JSON.stringify(f),r=bind(f),claim=r.effects.find(e=>e.claim.decision==='QUALIFIED').claim;
 assert.equal(JSON.stringify(f),before);assert.equal(claim.subject.system,'RELATIONSHIP');assert.equal(claim.historicalPosition.gameNumber,2);
 assert.equal(r.cards[0].sourceCoverage,'LIMITED');assert.equal(r.cards[0].methodCoverage,'ADMITTED');
 assert.notEqual(claim.contributionKey,r.cards[0].identity.producerKey);assert.ok(claim.contributionKey.startsWith('e2e-credit-'));
 assert.equal(r.cards[0].identity.keySubstitutionAllowed,false);assert.ok(r.cards[0].identity.legacyContributionKeys.length);
 assert.equal(r.actorWitnesses.length,1);assert.equal(r.actorWitnesses[0].actorPlayerId,claim.subject.fromPlayerId);
 assert.equal(r.actorWitnesses[0].ref.kind,'SOURCE_EVENT');assert.deepEqual(claim.reciprocity.independentActorRefs,[r.actorWitnesses[0].ref]);
 const result=simulatePrivateProgression(claim.subject.fromPlayerId,[r],[chapter()],cal,[],'input');
 assert.equal(result.history.projections.length,1);assert.equal(result.history.projections[0].upBank,1);
 assert.deepEqual(result.history.receipts,[]);assert.equal(result.history.publicationAllowed,false);
 assert.equal(result.pendingMethods.includes('INDEPENDENT_WEAKENING'),true);
});
test('unapproved bands, altered methods, premature source admission, wrong target/provenance and STOP fail closed',()=>{
 for(const mutate of [
  f=>f.output.admission.gameScope.gameId='other',f=>f.output.admission.sourceRevision.replaySha256='f'.repeat(64),
  f=>f.output.admission.episodes[0].counterpartReplayPlayerId=3,
  f=>f.output.admission.episodes[0].sourceIndependentContributionKey='alias',f=>f.output.admission.policy.approvalRef='approved',
  f=>f.output.admission.episodes[0].perTrackGrades[0].methodVersion='guessed-method',
  f=>f.output.admission.episodes[0].perTrackGrades[0].gradeBandId='SUBSTANTIAL',
  f=>f.output.admission.episodes[0].perTrackGrades[0].sourceCoverage='ADMITTED',
  f=>f.output.admission.episodes[0].perTrackGrades[0].sourceEventIds=['cmd1'],
  f=>f.output.admission.episodes[0].perTrackGrades[0].corroboration[0].sourceEventIds=['invented-event'],
  f=>f.output.gradeWitnesses[0].actorReplaySlot=2,f=>f.output.gradeWitnesses[0].action='STOP',
  f=>f.output.compatibility.producer.gameScopeAuthenticated=true,f=>f.output.admission.officialWrites=true,
  f=>f.output.admission.receipts.push({}),f=>f.output.admission.episodes.push(structuredClone(f.output.admission.episodes[0]))]){
  const f=copy();mutate(f);seal(f);assert.throws(()=>bind(f));
 }
 assert.throws(()=>bindSourceGrades(fixture.output,fixture.input.snapshot,fixture.input.statistics,fixture.output.compatibility.legacy.processorRevision,{order},0,cal));
});
test('correlated facets cannot double credits; unknown schedule and incomplete current input never show earned stage',()=>{
 const r=bind(),claim=r.effects.find(e=>e.claim.decision==='QUALIFIED').claim,owner=claim.subject.fromPlayerId;
 r.effects.push({...r.effects[0],claim:{...claim,claimId:'duplicate-metric',claimRevision:'e'.repeat(64)}});
 const one=simulatePrivateProgression(owner,[r],[chapter()],cal,[],'input');assert.equal(one.history.projections[0].upBank,1);
 assert.equal(simulatePrivateProgression(owner,[r],[chapter()],cal,[{reason:'WITHDRAWN_SOURCE'}],'new').history.projections[0].currentStage,null);
 const pending=bind(copy(),{order:null});assert.equal(pending.effects[0].claim.historicalPosition.gameNumber,2);
 const p=simulatePrivateProgression(owner,[pending],[chapter(fixture,null)],cal,[],'new');assert.ok(p.history.projections.every(p=>p.currentStage===null));
 const outsider=simulatePrivateProgression('outsider',[r],[chapter()],cal,[],'x');assert.deepEqual(outsider.claims,[]);assert.deepEqual(outsider.cards,[]);assert.deepEqual(outsider.history.projections,[]);assert.deepEqual(outsider.history.consumption,[]);
});
test('all-off and staging/production guard cannot be bypassed with pilot flags; callable requires actual auth',async()=>{
 const env={FUNCTIONS_EMULATOR:'true',GCLOUD_PROJECT:'demo-aof-native-player',REPLAY_WORKER_URL:'http://127.0.0.1:18765',AOF_SOCIAL_E2E_PRIVATE_PROGRESS:'pilot-v1'};
 assertPrivateProgressionEnabled(env);
 for(const change of [{AOF_SOCIAL_E2E_PRIVATE_PROGRESS:undefined},{GCLOUD_PROJECT:'age-of-friends-staging'},{GCLOUD_PROJECT:'league-of-friends-cc274'},{FUNCTIONS_EMULATOR:undefined},{REPLAY_WORKER_URL:'https://external-worker.invalid'}])assert.throws(()=>assertPrivateProgressionEnabled({...env,...change}));
 await assert.rejects(getMySocialProgression.run({data:{}}),e=>e.code==='unauthenticated');
});
