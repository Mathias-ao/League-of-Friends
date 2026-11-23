import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {digest,bindingDigest} from '../lib/engines/nativeRecordingIntegration.js';
import {loadEuTestAuthority,euTestSourceFingerprint} from '../lib/integration/euTestAuthority.js';
import {loadPracticalPersonalityRuntime} from '../lib/engines/personalityV1/practicalPolicy.js';
import {loadEuTestSocialPolicy} from '../lib/integration/euTestSocialPolicy.js';
import {PRACTICAL_POLICY_SHA256} from '../lib/engines/personalityV1/practicalPolicyResource.js';
import {HOSTED_POLICY_SPEC,HOSTED_POLICY_SHA256} from '../lib/integration/hostedSocialPolicy.js';
import {projectPrivatePersonalityHistory} from '../lib/integration/personalityHistory.js';
import {sourceItem,review,battle,owner,hash} from './support/practical-personality-fixture.mjs';
import {ready} from './support/private-history-fixture.mjs';
import {collectMyCurrentBattleHistory,readMyPersonalityHistory} from '../lib/queries/getMyPersonalityHistory.js';
import {readMyHostedSocialProgression} from '../lib/queries/getMyHostedSocialProgression.js';
import {euEnv,EU_TEST_D2,EU_TEST_R,installAuthority,attest} from './support/eu-test-authority-fixture.mjs';

test('new unsigned canonical EU contracts pin unchanged historical semantics without inheriting approval',()=>{
 for(const [resource,sha,bytes] of [[EU_TEST_D2,PRACTICAL_POLICY_SHA256,1045],[EU_TEST_R,HOSTED_POLICY_SHA256,977]]){
  assert.equal(createHash('sha256').update(resource.bytes).digest('hex'),resource.sha256);
  assert.equal(Buffer.byteLength(resource.bytes),bytes);assert.ok(resource.bytes.endsWith('\n'));
  assert.equal(resource.spec.semantics.sha256,sha);assert.notEqual(resource.sha256,sha);
  assert.equal(resource.spec.status,'PROPOSED');assert.equal(resource.spec.project,'age-of-friends-staging-eu');
  assert.equal(resource.spec.ownerApproval,'SEPARATE_EXACT_EU_RESOURCE_APPROVAL_REQUIRED');
  assert.ok(Object.values(resource.spec.effects).every(v=>v===false));
  assert.throws(()=>{resource.spec.project='production';},TypeError);
 }
});

test('EU authority requires two separate exact records, new decision, exact SHA/scope and producer pin',async()=>{
 for(const resource of [EU_TEST_D2,EU_TEST_R]){
  const f=await ready(),env=euEnv(f.input.env),kind=resource===EU_TEST_D2?'D2':'R';
  await assert.rejects(loadEuTestAuthority(f.db,env,kind),/authorization is unavailable/);
  installAuthority(f.rows,resource,env);const authority=await loadEuTestAuthority(f.db,env,kind);
  assert.equal(authority.resource.sha256,resource.sha256);
  for(const patch of [{AOF_EU_TEST_PROGRESSION:''},{AOF_EU_TEST_PROGRESSION:'APPROVED'},
   {GCLOUD_PROJECT:'age-of-friends-staging'},{GCLOUD_PROJECT:'production'},
   {GCLOUD_PROJECT:'age-of-friends-staging-eu-extra'},{GOOGLE_CLOUD_PROJECT:'other'},
   {FUNCTION_REGION:'us-central1'},{FUNCTION_REGION:undefined},{FUNCTIONS_EMULATOR:'true'},
   {FIRESTORE_EMULATOR_HOST:'localhost:8080'},{AOF_NATIVE_REPLAY_PROCESSOR_REVISION:'label'}])
   await assert.rejects(loadEuTestAuthority(f.db,{...env,...patch},kind));
  for(const [which,patch] of [['policy',{status:'PROPOSED'}],['policy',{resourceSha256:resource.spec.semantics.sha256}],
   ['policy',{project:'age-of-friends-staging'}],['policy',{resourceId:'lookalike'}],['policy',{publicPublicationAllowed:true}],
   ['policy',{approvalRef:resource.spec.semantics.historicalDecisionRef}],['policy',{approvalRef:'APPROVED'}],
   ['runtime',{policyRevision:2}],['runtime',{runtimeApprovalRef:authority.approvalRef}],
   ['runtime',{processorRevision:'b'.repeat(64)}],['runtime',{sourceReviews:[]}],['runtime',{extra:'untrusted'}]]){
   const records=installAuthority(f.rows,resource,env);Object.assign(records[which],patch);
   await assert.rejects(loadEuTestAuthority(f.db,env,kind),/authorization is unavailable/);
  }
  installAuthority(f.rows,resource,env);f.rows.delete(resource.runtimePath);
  await assert.rejects(loadEuTestAuthority(f.db,env,kind));
  installAuthority(f.rows,resource,env);const loaded=await loadEuTestAuthority(f.db,env,kind);
  f.rows.get(resource.policyPath).revision++;
  await assert.rejects(f.db.runTransaction(loaded.revalidate),e=>e.code==='aborted');
 }
});

test('EU D2 uses the unchanged five-axis evaluator; A needs exact producer selection and positive coverage',async()=>{
 const f=await ready(),env=euEnv(f.input.env),items=[1,2,3].map(sourceItem);
 items.forEach(i=>{i.producerRevision=env.AOF_NATIVE_REPLAY_PROCESSOR_REVISION;i.sourceAttestationRevision=hash('native-'+i.source.sourceHash);});
 const reviews=()=>Object.fromEntries(items.map(i=>[i.source.sourceHash,attest(i.source,env,review(i),i.sourceAttestationRevision)]));
 const project=async(sourceReviews)=>{
  installAuthority(f.rows,EU_TEST_D2,env,sourceReviews);
  const runtime=await loadPracticalPersonalityRuntime(f.db,env),p=runtime.createPolicy(owner,items);
  const out=projectPrivatePersonalityHistory(owner,items.map(battle),hash('EU_CONTROLLED'),p.context,p.calibration);
  assert.equal(out.personalityProfile.policy.policyVersion,EU_TEST_D2.spec.id);
  return Object.fromEntries(out.personalityProfile.sliders.map(a=>[a.axis,a.value]));
 };
 const positive=await project(reviews());
 assert.deepEqual(positive,{BOOMER_AGGRESSOR:100*4/13,CAUTIOUS_BOLD:25,GUERRILLA_FRONTLINE:0,
  SPECIALIST_IMPROVISER:0,COMPACT_EXPANSIVE:100*(1/3)});
 for(const mutate of [r=>delete r.producer,r=>delete r.costCatalog,r=>delete r.positiveRequestCoverage,
  r=>r.positiveRequestCoverage.status='APPROVED',r=>r.producer.selectedCatalogSha256=hash('wrong'),
  r=>r.producer.catalogSelection='GUESSED',r=>r.producer.gameBuild=188329]){
  const rows=reviews();Object.values(rows).forEach(mutate);const values=await project(rows);
  assert.equal(values.BOOMER_AGGRESSOR,null);
  if(Object.values(rows).every(r=>r.producer))assert.equal(values.CAUTIOUS_BOLD,25,'missing A does not suppress B');
 }
 const missing=reviews();Object.values(missing).forEach(r=>{delete r.spatial;delete r.commandAttribution;delete r.militaryFamilies;delete r.expansionSites;});
 const partial=await project(missing);assert.equal(partial.BOOMER_AGGRESSOR,100*4/13);
 for(const axis of ['CAUTIOUS_BOLD','GUERRILLA_FRONTLINE','SPECIALIST_IMPROVISER','COMPACT_EXPANSIVE'])assert.equal(partial[axis],null);
 const stale=reviews();Object.values(stale).forEach(r=>r.sourceFingerprint=hash('stale'));
 assert.ok(Object.values(await project(stale)).every(v=>v===null));
});

test('EU R authority preserves all six method boundaries and internal PROPOSED projection firewall',async()=>{
 const f=await ready(),env=euEnv(f.input.env);installAuthority(f.rows,EU_TEST_R,env);
 const loaded=await loadEuTestSocialPolicy(f.db,env);
 assert.deepEqual(loaded.calibration,HOSTED_POLICY_SPEC.calibration);
 assert.equal(loaded.calibration.policy.status,'PROPOSED');assert.equal(loaded.calibration.policy.approvalRef,null);
 assert.equal(Object.keys(loaded.calibration.rules).length,4);
});

async function measuredNativeFixture(){
 const f=await ready(),env=euEnv(f.input.env),input={...f.input,env},source=f.rows.get(f.sourcePath);
 const raw=JSON.parse(gunzipSync(f.objects.get(source.statistics.path))),sample=sourceItem();
 // Upgrade only the explicitly synthetic native fixture. All hashes and exact
 // source reviews below are recomputed; these are not genuine recording facts.
 Object.assign(raw,{entityCatalogVersion:sample.statistics.entityCatalogVersion,scope:sample.statistics.scope});
 Object.assign(raw.participants[0],sample.statistics.participants[0]);
 Object.assign(raw.participants[1],structuredClone(sample.statistics.participants[0]),{playerId:2,replaySlot:2});
 raw.matchFacts={...raw.matchFacts,...sample.statistics.matchFacts,
  source:{...raw.matchFacts.source,gameBuild:185872},
  game:{...sample.statistics.matchFacts.game,guid:source.matchFacts.game.guid}};
 source.matchFacts=structuredClone(raw.matchFacts);
 const plain=Buffer.from(JSON.stringify(raw)),bytes=gzipSync(plain);f.objects.set(source.statistics.path,bytes);
 Object.assign(source.statistics,{sha256:digest(bytes),bytes:bytes.length,uncompressedBytes:plain.length,uncompressedSha256:digest(plain)});
 Object.assign(source.recordedEvents,{uncompressedBytes:source.recordedEvents.bytes,uncompressedSha256:source.recordedEvents.sha256});
 return {f,env,input};
}

test('actual EU Personality consumer measures qualified controlled native evidence and keeps presentation locked',async()=>{
 const {f,env,input}=await measuredNativeFixture();
 const current=await collectMyCurrentBattleHistory({...input,includeScheduleOrder:true}),item=current.loaded[0];
 assert.ok(item);installAuthority(f.rows,EU_TEST_D2,env,{[item.source.sourceHash]:attest(item.source,env,review(item),item.sourceAttestationRevision)});
 const history=await readMyPersonalityHistory(input);
 assert.equal(history.numericalPolicy.runtime,'AUTHORIZED');assert.equal(history.numericalPolicy.sha256,EU_TEST_D2.sha256);
 const feature=history.personality.battleFeatures.find(f=>f.featureId==='BOOMER_AGGRESSOR');
 assert.equal(feature.numerator,4/13);
 assert.equal(history.livePersonality.gameUnlock,'LOCKED');
 assert.ok(history.livePersonality.axes.every(a=>a.value===null),'one Game is not three independent Battles');
 f.rows.get(f.sourcePath).processorRevision='b'.repeat(64);
 const corrected=await readMyPersonalityHistory(input);
 assert.ok(corrected.personality.battleFeatures.every(f=>f.numerator===null),'producer correction invalidates exact attestation');
});

test('two linked participants share ONE unchanged D2/R source attestation while correction and access remain fenced',async()=>{
 const {f,env,input}=await measuredNativeFixture();
 const other={...input,actor:{playerId:'p2',authUid:'other'}};
 const a=(await collectMyCurrentBattleHistory(input)).loaded[0],b=(await collectMyCurrentBattleHistory(other)).loaded[0];
 assert.equal(a.source.sourceHash,b.source.sourceHash);
 assert.notEqual(a.source.authorityRevision,b.source.authorityRevision,'owner-specific privacy tokens remain distinct');
 assert.equal(a.sourceAttestationRevision,b.sourceAttestationRevision);
 assert.equal(euTestSourceFingerprint(a.source,a.sourceAttestationRevision),euTestSourceFingerprint(b.source,b.sourceAttestationRevision));
 const d2=installAuthority(f.rows,EU_TEST_D2,env,{[a.source.sourceHash]:attest(a.source,env,review(a),a.sourceAttestationRevision)});
 const r=installAuthority(f.rows,EU_TEST_R,env,{[a.source.sourceHash]:attest(a.source,env,{},a.sourceAttestationRevision)});
 const unchanged=bindingDigest([d2,r]);let derived=0;
 const social=who=>readMyHostedSocialProgression({...who,derive:async()=>{derived++;throw Error('CONTROLLED_TRANSPORT');}});
 for(const who of [input,other]){
  const h=await readMyPersonalityHistory(who);
  assert.equal(h.personality.battleFeatures.find(x=>x.featureId==='BOOMER_AGGRESSOR').numerator,4/13);
  const out=await social(who);
  assert.deepEqual(out.relationships[0].tracks.RIVALRY.outgoing.reasonCodes,['WORKER_TRANSPORT_UNAVAILABLE']);
 }
 assert.equal(derived,2,'the same source attestation authorizes derivation for both linked owners');
 assert.equal(bindingDigest([d2,r]),unchanged,'no per-owner policy/runtime replacement');
 f.rows.get('authLinks/other').playerId='p1';
 await assert.rejects(readMyPersonalityHistory(other),e=>e.code==='permission-denied');
 await assert.rejects(social(other),e=>e.code==='permission-denied');
 assert.equal((await readMyPersonalityHistory(input)).personality.battleFeatures.find(x=>x.featureId==='BOOMER_AGGRESSOR').numerator,4/13);
 f.rows.get('authLinks/other').playerId='p2';
 f.rows.get('matches/m/games/g').replayStatisticsRevision++;
 f.rows.get(f.sourcePath).replayStatisticsRevision++;
 const callsBefore=derived;
 for(const who of [input,other]){
  assert.ok((await readMyPersonalityHistory(who)).personality.battleFeatures.every(x=>x.numerator===null));
  assert.deepEqual((await social(who)).relationships[0].tracks.RIVALRY.outgoing.reasonCodes,['SOURCE_PRODUCER_ATTESTATION_UNAVAILABLE']);
 }
 assert.equal(derived,callsBefore,'corrected evidence cannot inherit the old shared review');
 assert.equal(bindingDigest([d2,r]),unchanged);
});

test('actual EU private reads separate unavailable authority from current insufficient evidence and fence changes',async()=>{
 const f=await ready(),env=euEnv(f.input.env),input={...f.input,env};
 await assert.rejects(readMyPersonalityHistory(input),e=>e.code==='failed-precondition');
 installAuthority(f.rows,EU_TEST_D2,env);
 const history=await readMyPersonalityHistory(input);
 assert.equal(history.numericalPolicy.runtime,'AUTHORIZED');assert.equal(history.numericalPolicy.sha256,EU_TEST_D2.sha256);
 assert.equal(history.coverage.currentSources,1);assert.ok(history.livePersonality.axes.every(a=>a.value===null));
 const meta=f.rows.get(f.sourcePath).recordedEvents;meta.uncompressedBytes=meta.bytes;meta.uncompressedSha256=meta.sha256;
 const records=installAuthority(f.rows,EU_TEST_R,env);
 const current=await collectMyCurrentBattleHistory({...input,includeScheduleOrder:true});
 const item=current.loaded[0];records.runtime.sourceReviews[item.source.sourceHash]=attest(item.source,env,{},item.sourceAttestationRevision);
 let calls=0;const socialInput={...input,derive:async()=>{calls++;throw Error('CONTROLLED_TRANSPORT_FAILURE');}};
 const out=await readMyHostedSocialProgression(socialInput);
 assert.equal(calls,1);assert.equal(out.coverage.complete,false);assert.equal(out.relationships[0].tracks.RIVALRY.outgoing.stage,null);
 assert.equal(out.policyVersion,EU_TEST_R.spec.id);
 assert.equal(out.relationships[0].tracks.RIVALRY.outgoing.progression,'UNAVAILABLE');
 assert.deepEqual(out.relationships[0].tracks.RIVALRY.outgoing.reasonCodes,['WORKER_TRANSPORT_UNAVAILABLE']);
 delete records.runtime.sourceReviews[item.source.sourceHash];calls=0;
 const missing=await readMyHostedSocialProgression(socialInput);assert.equal(missing.coverage.complete,false);assert.equal(calls,0);
 assert.deepEqual(missing.relationships[0].tracks.RIVALRY.outgoing.reasonCodes,['SOURCE_PRODUCER_ATTESTATION_UNAVAILABLE']);
 records.runtime.sourceReviews[item.source.sourceHash]=attest(item.source,env,{},item.sourceAttestationRevision);
 await assert.rejects(readMyHostedSocialProgression({...input,derive:async()=>{records.policy.revision++;throw Error('CONTROLLED');}}),e=>e.code==='aborted');
 installAuthority(f.rows,EU_TEST_R,env,{[item.source.sourceHash]:attest(item.source,env,{},item.sourceAttestationRevision)});
 await assert.rejects(readMyHostedSocialProgression({...input,derive:async()=>{f.rows.get(f.sourcePath).state='WITHDRAWN';throw Error('CONTROLLED');}}),e=>e.code==='aborted');
 const withdrawn=await readMyHostedSocialProgression(socialInput);assert.equal(withdrawn.coverage.currentSources,0);assert.deepEqual(withdrawn.relationships,[]);
 for(const mutate of [f=>f.rows.get('players/p1').membershipStatus='SUSPENDED',f=>f.rows.get('authLinks/owner').playerId='p2']){
  const fresh=await ready();installAuthority(fresh.rows,EU_TEST_R,env);mutate(fresh);
  await assert.rejects(readMyHostedSocialProgression({...fresh.input,env}),e=>e.code==='permission-denied');
 }
});
