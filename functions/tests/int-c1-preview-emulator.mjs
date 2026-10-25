/** Runs on genuine hash-pinned ordinary AUTO uploads in the existing demo-only
 * acceptance harness. No cloud setup and no synthetic measurement producer. */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {getMyGameplayPreview,readMyGameplayPreview,getMyGameplayCandidates,readMyGameplayCandidates} from '../lib/queries/getMyGameplayPreview.js';
export async function intC1SourceAcceptance({db,bucket,actor,matchId,gameId,name}){
 assert.equal(process.env.GCLOUD_PROJECT,'demo-aof-native-player');assert.equal(process.env.FUNCTIONS_EMULATOR,'true');
 const c2a=process.env.AOF_INT_C2A_ACCEPTANCE==='1',endpoint=c2a?getMyGameplayCandidates:getMyGameplayPreview,readDirect=c2a?readMyGameplayCandidates:readMyGameplayPreview;
 const records=r=>c2a?r.episodes:r.grades,claims=r=>c2a?r.legacyPending.claimIds:r.claims;
 const flags={AOF_INT_V1_PRIVATE_READS:'source-v1',AOF_INT_V1_PRIVATE_HISTORY:'battle-v1',AOF_INT_C1_PRIVATE_PREVIEW:'wiring-test-v1',...(c2a?{AOF_INT_C2A_PRIVATE_PREVIEW:'source-compatible-v1'}:{})};
 const saved=Object.fromEntries(Object.keys(flags).map(k=>[k,process.env[k]]));Object.assign(process.env,flags);
 try{
  const read=()=>endpoint.run({auth:{uid:actor.authUid},data:{}}),first=await read();
  assert.equal(first.coverage.currentSources,1);assert.ok(records(first).length>0,'Genuine supported directional episodes required');
  assert.ok(claims(first).length>0);assert.equal(first.ownerPlayerId,actor.playerId);
  assert.equal(first.sources[0].battleId,matchId);assert.equal(first.sources[0].gameId,gameId);
  if(c2a){for(const e of first.episodes){assert.equal(e.binding.actorPlayerId,actor.playerId);assert.equal(e.binding.source.authorityRevision,first.sources[0].authorityRevision);
   assert.equal(e.binding.historicalOrder,null);assert.equal(e.binding.producerGameScopeAuthenticated,false);assert.equal(e.binding.sourceAuthorityVerified,true);
   assert.equal(e.candidate.grade.decision,'PENDING');assert.equal(e.candidate.grade.bandId,null);assert.equal(e.candidate.coverage.tier,'LIMITED');
   assert.equal(e.compatibility.keySubstitutionAllowed,false);assert.ok(e.compatibility.legacyContributionKeys.length);}
   if(name==='1v1_t90-deak'){const old=await getMyGameplayPreview.run({auth:{uid:actor.authUid},data:{}});
    assert.equal(old.version,'AOF_INT_C1_PRIVATE_PREVIEW_1');assert.deepEqual(old.claims.map(c=>c.claimId),first.legacyPending.claimIds);}
  }else{for(const g of first.grades){assert.equal(g.actorPlayerId,actor.playerId);assert.equal(g.sourceAuthority,first.sources[0].authorityRevision);
   assert.equal(g.grade.status,'PENDING');assert.equal(g.grade.bandId,null);assert.equal(g.raw.opportunity,null);assert.equal(g.coverage,'LIMITED');}
   assert.ok(first.claims.every(c=>c.decision==='PENDING'&&c.significanceBandId===null&&c.reciprocity.independentActorRefs.length===0));}
  assert.deepEqual(first.history.projections,[]);assert.deepEqual(first.history.receipts,[]);assert.equal(first.effects.officialWrites,false);
  assert.deepEqual(await read(),first);
  await assert.rejects(endpoint.run({data:{}}),e=>e.code==='unauthenticated');
  await assert.rejects(endpoint.run({auth:{uid:actor.authUid},data:{playerId:'forged'}}),e=>e.code==='invalid-argument');
  const gr=db.doc('matches/'+matchId+'/games/'+gameId),game=(await gr.get()).data();
  const sr=gr.collection('replaySources').doc(game.activeReplayStatisticsId),source=(await sr.get()).data();
  await sr.update({state:'WITHDRAWN'});const withdrawn=await read();assert.equal(records(withdrawn).length,0);assert.equal(claims(withdrawn).length,0);
  await sr.set(source); // isolated emulator fault injection restore only
  // Final whole-set authority fence runs AFTER the real source/worker chain.
  const event=db.doc('events/'+first.sources[0].eventId),savedEvent=(await event.get()).data();let once=false;
  const raced={file:(...args)=>({download:async()=>{const bytes=await bucket.file(...args).download();
   if(!once&&args[0]===source.recordedEvents.path){once=true;await event.update({status:'CANCELLED'});}return bytes;}})};
  await assert.rejects(readDirect({db,bucket:raced,actor,env:process.env,request:{}}));await event.set(savedEvent);
  for(const field of ['sourceName','native-replay-evidence','privateNote','replayBase64','authUid'])assert.ok(!JSON.stringify(first).includes(field));
  const rendered=spawnSync(process.execPath,['--import','tsx','tests/render-int-c1-preview.mjs'],{cwd:resolve('web'),
   input:JSON.stringify(first),encoding:'utf8',timeout:30_000,maxBuffer:64*1024});
  assert.equal(rendered.status,0,'C1 original source-to-private-UI witness failed; payload/stderr withheld');
  assert.deepEqual(JSON.parse(rendered.stdout),{sourceRevisionRendered:true,pendingOnly:true,jsdomOnly:true});
  console.log(JSON.stringify({intC1Fixture:name,previewVersion:first.version,authenticRetainedEvents:true,actorBoundEpisodes:records(first).length,
   pendingClaims:claims(first).length,sourceGroups:new Set(records(first).map(g=>c2a?g.compatibility.componentId:g.contributionGroupId)).size,
   authenticatedSourceToUI:true,currentAuthorityFenced:true,officialWrites:false}));
 }finally{for(const [k,v] of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
}
