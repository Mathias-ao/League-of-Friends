import test from 'node:test';
import assert from 'node:assert/strict';
import {ready} from './support/private-history-fixture.mjs';
import {readMyGameplayPreview,getMyGameplayPreview} from '../lib/queries/getMyGameplayPreview.js';
import {C1_TEST_POLICY_DIGEST,validateC1Worker} from '../lib/integration/gameplayPreview.js';
import {loadMyCurrentSocialSource} from '../lib/queries/getMySocialExperience.js';

const worker=s=>({version:'AOF_INT_C1_WORKER_PREVIEW_1',processorRevision:'c'.repeat(64),authorityRevision:s.authorityRevision,sourceHash:s.sourceHash,
 testPolicyDigest:C1_TEST_POLICY_DIGEST,contextVersion:'AOF_SOCIAL_V1_CONTEXT_V2',sourceContextRevision:'a'.repeat(64),
 grades:[],inferences:[],effects:[],actorWitnesses:[],officialWrites:false,publicationAllowed:false,gradeMethodsInstalled:false});
async function setup(){const f=await ready();f.rows.get(f.sourcePath).recordedEvents.uncompressedBytes=100;
 const input={...f.input,env:{...f.input.env,AOF_INT_C1_PRIVATE_PREVIEW:'wiring-test-v1'},derive:async p=>worker(p.snapshot)};
 return {...f,input,read:()=>readMyGameplayPreview(input)};}
test('default-off authenticated owner-only C1 does not persist or invent any projection',async()=>{
 const f=await setup(),before=JSON.stringify([...f.rows]),r=await f.read();
 assert.equal(r.ownerPlayerId,'p1');assert.equal(r.status,'PENDING');assert.deepEqual(r.history.projections,[]);
 assert.deepEqual(r.history.receipts,[]);assert.deepEqual(r.claims,[]);assert.equal(r.effects.officialWrites,false);
 assert.equal(r.simulation.status,'UNAPPROVED_TEST_ONLY');assert.deepEqual(await f.read(),r);assert.equal(JSON.stringify([...f.rows]),before);
 await assert.rejects(getMyGameplayPreview.run({data:{}}),e=>e.code==='unauthenticated');
 await assert.rejects(readMyGameplayPreview({...f.input,env:{...f.input.env,AOF_INT_C1_PRIVATE_PREVIEW:undefined}}),e=>e.code==='failed-precondition');
 await assert.rejects(readMyGameplayPreview({...f.input,env:{...f.input.env,GCLOUD_PROJECT:'league-of-friends-cc274'}}));
 for(const key of ['playerId','grade','calibration','sourceHash','cursor'])await assert.rejects(readMyGameplayPreview({...f.input,request:{[key]:'forged'}}),e=>e.code==='invalid-argument');
 const r2=await readMyGameplayPreview({...f.input,actor:{playerId:'p2',authUid:'other'}});assert.equal(r2.ownerPlayerId,'p2');
 for(const key of ['sourceName','native-replay-evidence','privateNote','replayBase64','authUid'])assert.ok(!JSON.stringify(r2).includes(key));
});
test('retained event generation/hash, worker response, and source/access changes fail closed',async()=>{
 const f=await setup(),source=(await loadMyCurrentSocialSource({...f.input,request:{matchId:'m',gameId:'g'}})).source;
 for(const patch of [{authorityRevision:'f'.repeat(64)},{processorRevision:'f'.repeat(64)},{gradeMethodsInstalled:true},{testPolicyDigest:'f'.repeat(64)},
  {officialWrites:true},{actorWitnesses:[{}]},{effects:[{}]},{grades:[{actorPlayerId:'forged'}]}])assert.throws(()=>validateC1Worker({...worker(source),...patch},source,{},'c'.repeat(64)));
 await assert.rejects(readMyGameplayPreview({...f.input,derive:async p=>({...worker(p.snapshot),officialWrites:true})}),e=>e.code==='data-loss');
 const meta=f.rows.get(f.sourcePath).recordedEvents,bytes=f.objects.get(meta.path);f.objects.set(meta.path,Buffer.from('corrupt'));
 await assert.rejects(f.read,e=>e.code==='data-loss');f.objects.set(meta.path,bytes);
 for(const change of [g=>g.rows.get('authLinks/owner').playerId='p2',g=>g.rows.get(g.sourcePath).state='WITHDRAWN',
  g=>g.rows.set('matches/m/games/new',{gameNumber:2,players:[{playerId:'p1'}]})]){
  const g=await setup();await assert.rejects(readMyGameplayPreview({...g.input,derive:async p=>{change(g);return worker(p.snapshot);}}));
 }
});
test('C1 complete-or-error Game budget never silently truncates or exposes historical inactive sources',async()=>{
 const f=await setup();for(let n=2;n<=9;n++)f.rows.set('matches/m/games/g'+n,{gameNumber:n,players:[{playerId:'p1'}]});
 await assert.rejects(f.read,e=>e.code==='resource-exhausted');
 const g=await setup();g.rows.get(g.sourcePath).state='WITHDRAWN';const r=await g.read();
 assert.equal(r.coverage.currentSources,0);assert.equal(r.pendingSources.length,1);assert.equal(r.grades.length,0);
});
