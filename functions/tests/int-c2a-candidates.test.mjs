import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bindingDigest} from '../lib/engines/nativeRecordingIntegration.js';
import {validateC2AWorker,reconcileCandidateIdentities} from '../lib/integration/gameplayCandidates.js';
import {ready} from './support/private-history-fixture.mjs';
import {readMyGameplayCandidates,getMyGameplayCandidates,readMyGameplayPreview} from '../lib/queries/getMyGameplayPreview.js';
import {C1_TEST_POLICY_DIGEST} from '../lib/integration/gameplayPreview.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/int-c2a-synthetic.json',import.meta.url)));
const copy=()=>structuredClone(fixture);
const seal=d=>d.projectionRevision=bindingDigest([d.version,d.gameScope,d.sourceRevision,d.sourceContextRevision,
 d.sourceMeasurementsRevision,d.candidateEpisodeGroups,d.neutralPlacementContexts,d.neutralTributeRequestContexts,d.mode]);
const run=f=>validateC2AWorker(f.output,f.input.snapshot,f.input.statistics,f.output.legacy.processorRevision);

test('Python candidate DTO binds separately without mutating producer or replacing C1 keys',()=>{
 const f=copy(),before=JSON.stringify(f),r=run(f),e=r.episodes[0];
 assert.equal(JSON.stringify(f),before);assert.equal(f.output.producer.gameScopeAuthenticated,false);
 assert.equal(e.binding.sourceAuthorityVerified,true);assert.equal(e.binding.producerGameScopeAuthenticated,false);
 assert.equal(e.binding.historicalOrder,null);assert.equal(e.candidate.grade.bandId,null);assert.equal(e.candidate.coverage.tier,'LIMITED');
 assert.notEqual(e.compatibility.producerKey,e.compatibility.legacyContributionKeys[0]);
 assert.equal(e.compatibility.keySubstitutionAllowed,false);assert.deepEqual(e.candidate,f.output.producer.candidateEpisodeGroups[0]);
 assert.equal(e.binding.priorContextBasis,'BEFORE_EACH_CONTRIBUTING_DEED_NOT_GROUP_START');
 assert.ok(e.pendingProposalRefs.claimIds.length);assert.equal(e.pendingProposalRefs.significanceBandId,null);
 assert.ok(r.legacy.effects.every(e=>e.claim.decision==='PENDING'&&e.claim.significanceBandId===null));assert.deepEqual(run(copy()),r);
});

test('forged source, scope, actor, metric, overlap key, grade, policy, and past-only context fail closed',()=>{
 const mutations=[
  f=>f.output.producer.gameScope.gameId='other',f=>f.output.producer.gameScope.gameGuid='other-guid',
  f=>f.output.producer.gameScope.authorityRevision='other-source-authority',
  f=>f.output.producer.sourceRevision.replaySha256='f'.repeat(64),f=>f.output.producer.sourceRevision.parserVersion='unreviewed',f=>f.output.producer.gameScopeAuthenticated=true,
  f=>f.output.producer.gradePolicyStatus='APPROVED',f=>f.output.legacy.testPolicyDigest='f'.repeat(64),
  f=>f.output.legacy.processorRevision='f'.repeat(64),
  f=>f.output.producer.candidateEpisodeGroups[0].actorReplayPlayerId=2,
  f=>f.output.producer.candidateEpisodeGroups[0].counterpartReplayPlayerId=3,
  f=>f.output.producer.candidateEpisodeGroups[0].rawMeasurements[0].metricDefinitionId='UNKNOWN',
  f=>f.output.producer.candidateEpisodeGroups[0].grade.bandId='UNAPPROVED',
  f=>f.output.producer.candidateEpisodeGroups[0].coverage.tier='ADMITTED',
  f=>f.output.producer.candidateEpisodeGroups[0].independentContributionKey='alias',
  f=>f.output.producer.candidateEpisodeGroups.push(structuredClone(f.output.producer.candidateEpisodeGroups[0])),
  f=>f.output.legacy.grades[0].contributionGroupId='group-forged',
  f=>f.output.producer.candidateEpisodeGroups[0].opportunity.sourceEventIds.push(f.output.sourceWitnesses[0].sourceEventId),
  f=>f.output.producer.candidateEpisodeGroups[0].priorDirectedEpisodeCandidateDeedIds.push('deed-X'),
  f=>f.output.sourceWitnesses[0].actorReplaySlot=2,
  f=>f.output.sourceWitnesses[0].atMs=999999,f=>f.output.priorContexts[0].windowEndExclusiveMs=20000,
  f=>f.output.priorContexts[0].actorReplaySlot=2,
 ];
 for(const mutate of mutations){const f=copy();mutate(f);seal(f.output.producer);
  assert.throws(()=>validateC2AWorker(f.output,f.input.snapshot,f.input.statistics,fixture.output.legacy.processorRevision));}
});

test('compatibility transitive event/deed/incident linkage keeps reverse actors and Games independent',()=>{
 const s=copy().input.snapshot;
 const ds=[{deedId:'a',sourceEventIds:['ea'],incidentIds:['i']},{deedId:'b',sourceEventIds:['eb'],incidentIds:['i']},
  {deedId:'c',sourceEventIds:['ec'],incidentIds:['j']}];
 const group=ids=>'group-'+bindingDigest([s.gameGuid,s.sourceHash,ids]);
 const grade=(d,actor=1,target=2)=>({sourceDeedId:d.deedId,sourceEventIds:d.sourceEventIds,actorReplaySlot:actor,counterpartReplaySlot:target,
  contributionGroupId:group(d.deedId==='c'?['c']:['a','b']),candidateId:d.deedId+actor,
  incidentId:'incident-'+bindingDigest([s.gameGuid,s.sourceHash,d.deedId])});
 const groups=[{independentContributionKey:'w1',actorReplayPlayerId:1,counterpartReplayPlayerId:2,sourceDeedIds:['a'],sourceEventIds:['ea']},
  {independentContributionKey:'w2',actorReplayPlayerId:1,counterpartReplayPlayerId:2,sourceDeedIds:['b'],sourceEventIds:['eb']},
  {independentContributionKey:'reverse',actorReplayPlayerId:2,counterpartReplayPlayerId:1,sourceDeedIds:['a'],sourceEventIds:['ea']},
  {independentContributionKey:'independent',actorReplayPlayerId:1,counterpartReplayPlayerId:2,sourceDeedIds:['c'],sourceEventIds:['ec']}];
 const stats={pairSocialEvidence:{deeds:ds}},grades=[...ds.map(d=>grade(d)),grade(ds[0],2,1)];
 const r=reconcileCandidateIdentities(s,stats,grades,groups);
 assert.equal(r[0].componentId,r[1].componentId);assert.notEqual(r[0].componentId,r[2].componentId);assert.notEqual(r[0].componentId,r[3].componentId);
 assert.deepEqual(r[0].relatedProducerKeys,['w1','w2']);assert.deepEqual(r[0].sourceIncidentIds,['i']);
 assert.notEqual(reconcileCandidateIdentities({...s,gameId:'other'},stats,grades,groups)[0].componentId,r[0].componentId);
 assert.notEqual(reconcileCandidateIdentities({...s,battleId:'other'},stats,grades,groups)[0].componentId,r[0].componentId);
});

async function setup(){const f=await ready();f.rows.get(f.sourcePath).recordedEvents.uncompressedBytes=100;
 const derive=async p=>{
  const legacy={version:'AOF_INT_C1_WORKER_PREVIEW_1',processorRevision:'c'.repeat(64),authorityRevision:p.snapshot.authorityRevision,sourceHash:p.snapshot.sourceHash,
   testPolicyDigest:C1_TEST_POLICY_DIGEST,contextVersion:'AOF_SOCIAL_V1_CONTEXT_V2',sourceContextRevision:'a'.repeat(64),
   grades:[],inferences:[],effects:[],actorWitnesses:[],officialWrites:false,publicationAllowed:false,gradeMethodsInstalled:false};
  const producer=structuredClone(fixture.output.producer);Object.assign(producer,{gameScope:Object.fromEntries(['battleId','gameId','gameGuid','authorityRevision'].map(k=>[k,p.snapshot[k]])),
   sourceRevision:Object.fromEntries(['replaySha256','recordedEventsSha256','recordedEventsVersion','parserVersion'].map(k=>[k,p.statistics.source[k]])),
   sourceContextRevision:legacy.sourceContextRevision,candidateEpisodeGroups:[],neutralPlacementContexts:[],neutralTributeRequestContexts:[]});seal(producer);
  return {version:'AOF_INT_C2A_WORKER_PREVIEW_1',legacy,producer,sourceWitnesses:[],priorContexts:[]};
 };
 const input={...f.input,env:{...f.input.env,AOF_INT_C1_PRIVATE_PREVIEW:'wiring-test-v1',AOF_INT_C2A_PRIVATE_PREVIEW:'source-compatible-v1'},derive};
 return {...f,input,read:()=>readMyGameplayCandidates(input)};
}
test('distinct endpoint is default OFF, private, fenced after RPC, and leaves old consumer unchanged',async()=>{
 const f=await setup(),r=await f.read();assert.equal(r.version,'AOF_INT_C2A_PRIVATE_PREVIEW_1');assert.equal(r.ownerPlayerId,'p1');
 assert.deepEqual(r.episodes,[]);assert.deepEqual(r.history.projections,[]);assert.deepEqual(r.history.receipts,[]);assert.equal(r.grades,undefined);
 assert.deepEqual(await f.read(),r);await assert.rejects(getMyGameplayCandidates.run({data:{}}),e=>e.code==='unauthenticated');
 for(const key of ['playerId','sourceHash','grade','policy','order'])await assert.rejects(readMyGameplayCandidates({...f.input,request:{[key]:'forged'}}));
 await assert.rejects(readMyGameplayCandidates({...f.input,env:{...f.input.env,AOF_INT_C2A_PRIVATE_PREVIEW:undefined}}));
 await assert.rejects(readMyGameplayCandidates({...f.input,env:{...f.input.env,GCLOUD_PROJECT:'league-of-friends-cc274'}}));
 const old=await readMyGameplayPreview({...f.input,derive:async p=>(await f.input.derive(p)).legacy});assert.equal(old.version,'AOF_INT_C1_PRIVATE_PREVIEW_1');assert.deepEqual(old.grades,[]);
 for(const change of [g=>g.rows.get('authLinks/owner').playerId='p2',g=>g.rows.get(g.sourcePath).state='WITHDRAWN',
  g=>g.rows.get('matches/m/games/g').canonicalResult.revision++]){
  const g=await setup();await assert.rejects(readMyGameplayCandidates({...g.input,derive:async p=>{const value=await g.input.derive(p);change(g);return value;}}));
 }
});
