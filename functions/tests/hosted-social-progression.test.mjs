import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bindingDigest} from '../lib/engines/nativeRecordingIntegration.js';
import {bindSourceGrades} from '../lib/integration/privateProgression.js';
import {HOSTED_POLICY_SPEC,HOSTED_POLICY_VERSION,HOSTED_POLICY_PATH,HOSTED_POLICY_SHA256,
  hostedBinderCalibration,loadHostedSocialPolicy} from '../lib/integration/hostedSocialPolicy.js';
import {projectHostedSocialProgression,fixedHostedOpportunity} from '../lib/integration/hostedSocialProgression.js';
import {readMyHostedSocialProgression,getMyHostedSocialProgression} from '../lib/queries/getMyHostedSocialProgression.js';
import {ready} from './support/private-history-fixture.mjs';
import {collectMyCurrentBattleHistory} from '../lib/queries/getMyPersonalityHistory.js';
import {controlledHostedApproval} from './support/hosted-social-approval-fixture.mjs';

// Approved-looking records below are isolated test authority, NEVER runtime approval.
const approval=controlledHostedApproval;
const env={GCLOUD_PROJECT:'age-of-friends-staging',AOF_HOSTED_SOCIAL_PRIVATE:'v1a'};
const cal=()=>structuredClone(HOSTED_POLICY_SPEC.calibration);
function raw(){
  const f=JSON.parse(readFileSync(new URL('./fixtures/int-c2a-synthetic.json',import.meta.url)));
  const output={version:'AOF_SOCIAL_E2E_WORKER_1',inputModel:'AOF_DIRECT_SHARED_EPISODES_V1_EXPERIMENTAL',
    compatibility:f.output,gradeWitnesses:f.output.sourceWitnesses,
    admission:JSON.parse(readFileSync(new URL('./fixtures/int-c2b-admission-synthetic.json',import.meta.url)))};
  return {f,output};
}
function bound(index=1,{battle='b'+index,event='e'+index,season='s1'}={}){
  const {f,output}=raw(),order={event:index,battle:index,game:1,key:'order-'+index};
  const r=bindSourceGrades(output,f.input.snapshot,f.input.statistics,output.compatibility.legacy.processorRevision,
    {order},1,hostedBinderCalibration(cal()));
  const change={battleId:battle,matchId:battle,gameId:'g'+index,gameGuid:'guid-'+index,eventId:event,seasonId:season,
    sourceHash:bindingDigest(['source',index]),authorityRevision:bindingDigest(['authority',index])};
  const ids=new Map(r.cards.map(c=>[c.claimId,'test-'+index+'-'+c.claimId]));
  Object.assign(r.source,change);
  for(const c of r.cards){Object.assign(c,{battleId:battle,gameId:change.gameId,sourceAuthority:change.authorityRevision,
    claimId:ids.get(c.claimId),claimRevision:bindingDigest([c.claimRevision,index]),
    historicalOrder:{order:'ORDERED',leagueOrderKey:order.key,gameNumber:1}});
    c.identity.contributionKey='test-credit-'+index+'-'+c.identity.contributionKey;}
  for(const e of r.effects){Object.assign(e,{battleId:battle,gameId:change.gameId,eventId:event,sourceAuthority:change.authorityRevision});
    e.claim.claimId=ids.get(e.claim.claimId);e.claim.claimRevision=bindingDigest([e.claim.claimRevision,index]);
    e.claim.historicalPosition.leagueOrderKey=order.key;e.claim.historicalPosition.gameNumber=1;
    e.claim.contributionKey='test-credit-'+index+'-'+e.claim.contributionKey;
  }
  for(const w of r.actorWitnesses){w.claimId=ids.get(w.claimId);w.battleId=battle;}
  return {r,chapter:{...r.source,revision:r.source.statisticsRevision,state:'READY',sourceAuthority:r.source.authorityRevision,order}};
}
const ownerOf=r=>{const s=r.effects.find(e=>e.claim.decision==='QUALIFIED').claim.subject;return s.system==='REPUTATION'?s.playerId:s.fromPlayerId;};
function project(rows,extra={}){
  return projectHostedSocialProgression({owner:rows[0].r.effects.some(e=>e.claim.decision==='QUALIFIED')?
    ownerOf(rows[0].r):rows[0].r.source.roster[0].playerId,inputs:rows.map(x=>x.r),chapters:rows.map(x=>x.chapter),
    calibration:cal(),pendingSources:[],coverage:{ownBattles:new Set(rows.map(x=>x.r.source.battleId)).size,ownGames:rows.length,
      currentSources:rows.length,pendingSources:0},inputRevision:'current',policyRevision:'test-only',opportunity:()=>true,...extra});
}

test('immutable four-rule spec stays internally PROPOSED; diagnostic rows cannot score C/H',()=>{
  assert.equal(HOSTED_POLICY_SPEC.status,'PROPOSED');assert.equal(HOSTED_POLICY_SPEC.calibration.policy.approvalRef,null);
  assert.equal(Object.keys(cal().rules).length,4);assert.ok(Object.isFrozen(HOSTED_POLICY_SPEC.calibration.rules));
  const binder=hostedBinderCalibration(cal());assert.equal(Object.keys(binder.rules).length,6);
  assert.deepEqual(binder.rules.E2E_DISTINCT_RUPTURE_ANTAGONISM.bands,{});
  assert.deepEqual(binder.rules.E2E_PREEXISTING_VULNERABILITY_PRESSURE.bands,{});
  assert.deepEqual(Object.values(cal().rules).map(r=>r.bands),Array(4).fill({ORDINARY:1}));
});

test('external approval is mandatory/default-off and hash/scope/version/revocation are fenced',async()=>{
  const f=await ready();const input={...f.input,env:{...f.input.env,...env}};
  await assert.rejects(loadHostedSocialPolicy(f.db,input.env),e=>e.code==='failed-precondition');
  f.rows.set(HOSTED_POLICY_PATH,approval());const loaded=await loadHostedSocialPolicy(f.db,input.env);
  assert.equal(loaded.calibration.policy.status,'PROPOSED');
  for(const changed of [{configurationSha256:'f'.repeat(64)},{authorizedScopes:['PUBLIC']},{status:'PROPOSED'},
    {approvalRef:''},{approvalRef:'PLACEHOLDER'},{approvalRef:'https://github.com/Mathias-ao/League-of-Friends/issues/246#issuecomment-7076540849'},
    {approvalRevision:0},{approvalRevision:1.5},{schemaVersion:'other'},{visibility:'PUBLIC'},
    {publicPublicationAllowed:true},{officialWritesAllowed:true},{entitlementGrantsAllowed:true},
    {project:'production'},{configurationResource:'other'},{policyVersion:'other'},{extra:true}]){
    f.rows.set(HOSTED_POLICY_PATH,{...approval(),...changed});
    await assert.rejects(loadHostedSocialPolicy(f.db,input.env),e=>e.code==='failed-precondition');
  }
  f.rows.set(HOSTED_POLICY_PATH,approval());
  for(const change of [{AOF_HOSTED_SOCIAL_PRIVATE:undefined},{GCLOUD_PROJECT:'production'},
    {GCLOUD_PROJECT:'demo-any',FUNCTIONS_EMULATOR:'true'},{GOOGLE_CLOUD_PROJECT:'production'}])
    await assert.rejects(loadHostedSocialPolicy(f.db,{...input.env,...change}),e=>e.code==='failed-precondition');
  f.rows.set(HOSTED_POLICY_PATH,{...approval(),status:'REVOKED'});
  await assert.rejects(f.db.runTransaction(tx=>loaded.revalidate(tx)),e=>e.code==='aborted');
});

test('source-bound ordinary movement uses #139, remains directed and emits only private DTO',()=>{
  const row=bound(),x=project([row]),other=x.relationships.find(p=>p.otherPlayerId!==x.ownerPlayerId);
  assert.equal(x.version,'AOF_SOC_V1A_HOSTED_OWNER_READ_1');assert.equal(x.coverage.complete,true);
  assert.equal(other.tracks.RIVALRY.outgoing.stage,0);assert.equal(other.tracks.RIVALRY.outgoing.upBank,1);
  assert.equal(other.tracks.RIVALRY.incoming.stage,null);assert.equal(other.tracks.HOSTILITY.outgoing.upBank,null);
  assert.equal(x.reputation.CRUELTY.career.stage,null);
  for(const forbidden of ['receipts','claims','cards','artifactRefs','sourceHash','sourceMethodRevision','originalWitness','publicationAllowed','approvalRef'])
    assert.ok(!JSON.stringify(x).includes('"'+forbidden+'"'),forbidden);
  assert.deepEqual(project([row]),x,'repeating a read cannot accumulate credits');
});

test('canonical Battle/Event caps survive multi-Game input and independent reciprocity is not manufactured',()=>{
  const rows=Array.from({length:8},(_,i)=>bound(i+1,{battle:'same-battle',event:'same-event'}));
  const x=project(rows),p=x.relationships[0].tracks.RIVALRY;
  assert.equal(p.outgoing.stage,1);assert.equal(p.outgoing.upBank,0);
  assert.equal(p.outgoing.sourceQualifiedBattles,1);assert.equal(p.outgoing.sourceQualifiedGames,8);
  assert.equal(p.outgoing.sourceQualifiedEvents,1);assert.equal(p.incoming.stage,null);
  const independent=Array.from({length:8},(_,i)=>bound(i+1));
  const d=project(independent).relationships[0].tracks.RIVALRY;
  assert.equal(d.outgoing.stage,2,'one-way progression must not invent reverse actor contributions');
  assert.equal(d.outgoing.upBank,3);assert.equal(d.incoming.stage,null);
});

test('unknown historical order, partial sources and withheld opportunity do not show stale numbers',()=>{
  const row=bound(),old=project([row]);assert.equal(old.relationships[0].tracks.RIVALRY.outgoing.upBank,1);
  const missing=project([row],{pendingSources:[{seasonId:null,rosterPlayerIds:null}]});assert.equal(missing.relationships[0].tracks.RIVALRY.outgoing.upBank,null);
  const opportunity=project([row],{opportunity:()=>false});assert.equal(opportunity.relationships[0].tracks.RIVALRY.outgoing.stage,null);
  row.chapter.order=null;row.r.effects.forEach(e=>{e.claim.historicalPosition.order='UNKNOWN';e.claim.historicalPosition.leagueOrderKey=null;});
  const unordered=project([row]);assert.equal(unordered.relationships[0].tracks.RIVALRY.outgoing.stage,null);
  assert.ok(unordered.relationships[0].tracks.RIVALRY.outgoing.reasonCodes.includes('HISTORICAL_ORDER_PENDING'));
});

test('Career and Season use the same allocator with separate filtered windows, never two grant paths',()=>{
  const rows=[bound(1,{season:'s1'}),bound(2,{season:'s2'})];
  // Synthetic post-binding subject conformance only, NOT a source-method
  // positive. Genuine 4v4 acceptance independently proves Gallantry admission.
  for(const {r} of rows){const owner=ownerOf(r);
    r.cards=r.cards.filter(c=>c.track==='RIVALRY').map(c=>({...c,track:'GALLANTRY',
      methodVersion:HOSTED_POLICY_SPEC.admittedMethodByRule.E2E_DARING_OFFENSE}));
    r.effects=r.effects.filter(e=>e.claim.subject.track==='RIVALRY').map(e=>({...e,claim:{...e.claim,
      subject:{system:'REPUTATION',track:'GALLANTRY',playerId:owner},ruleId:'E2E_DARING_OFFENSE'}}));
    r.actorWitnesses=[];
  }
  const p=project(rows).reputation.GALLANTRY;
  assert.equal(p.career.stage,1);assert.equal(p.career.upBank,0);assert.equal(p.career.sourceQualifiedBattles,2);
  for(const season of ['s1','s2']){assert.equal(p.bySeason[season].stage,0);assert.equal(p.bySeason[season].upBank,1);}
});

test('corrected zero-deed sources keep factual quiet pairs and independent Pending tracks',()=>{
  const row=bound();row.r.cards=[];row.r.effects=[];row.r.actorWitnesses=[];
  const x=project([row]);assert.equal(x.relationships.length,1);assert.equal(x.relationships[0].factualCurrentSourceBattles,1);
  for(const t of ['RIVALRY','HOSTILITY','BOND'])for(const d of ['outgoing','incoming']){
    assert.equal(x.relationships[0].tracks[t][d].stage,null);assert.equal(x.relationships[0].tracks[t][d].upBank,null);
  }
});

test('a withheld opportunity in one Season preserves an independent complete Season',()=>{
  const rows=[bound(1,{season:'s1'}),bound(2,{season:'s2'})];
  // Post-binding projection probe, not a genuine source-method positive.
  for(const {r} of rows){const owner=ownerOf(r);
    r.cards=r.cards.filter(c=>c.track==='RIVALRY').map(c=>({...c,track:'GALLANTRY',
      methodVersion:HOSTED_POLICY_SPEC.admittedMethodByRule.E2E_DARING_OFFENSE}));
    r.effects=r.effects.filter(e=>e.claim.subject.track==='RIVALRY').map(e=>({...e,claim:{...e.claim,
      subject:{system:'REPUTATION',track:'GALLANTRY',playerId:owner},ruleId:'E2E_DARING_OFFENSE'}}));
    r.actorWitnesses=[];
  }
  const p=project(rows,{opportunity:b=>b.source.seasonId==='s1'}).reputation.GALLANTRY;
  assert.equal(p.career.stage,null);assert.equal(p.bySeason.s2.stage,null);
  assert.equal(p.bySeason.s1.stage,0);assert.equal(p.bySeason.s1.upBank,1);
  const pending=project(rows,{pendingSources:[{seasonId:'s2',rosterPlayerIds:rows[0].r.source.roster.map(p=>p.playerId)}]}).reputation.GALLANTRY;
  assert.equal(pending.career.stage,null);assert.equal(pending.bySeason.s2.stage,null);
  assert.equal(pending.bySeason.s1.upBank,1);
});

test('unavailable owner-B derivation preserves owner-A, while affected or unknown pairs stay Pending',()=>{
  const a=bound(1),b=bound(2),owner=ownerOf(a.r),other=a.r.source.roster.find(p=>p.playerId!==owner).playerId;
  b.r.source.roster=b.r.source.roster.map(p=>({...p,playerId:p.playerId===owner?owner:'unrelated-B'}));
  b.r.cards=[];b.r.effects=[];b.r.actorWitnesses=[];
  const extra={pendingSources:[{seasonId:b.r.source.seasonId,rosterPlayerIds:b.r.source.roster.map(p=>p.playerId)}],
    coverage:{ownBattles:2,ownGames:2,currentSources:2,pendingSources:1}};
  const x=project([a,b],extra);assert.equal(x.coverage.complete,false);
  const pairA=x.relationships.find(p=>p.otherPlayerId===other),pairB=x.relationships.find(p=>p.otherPlayerId==='unrelated-B');
  assert.equal(pairA.tracks.RIVALRY.outgoing.upBank,1);assert.equal(pairA.tracks.RIVALRY.incoming.stage,null);
  assert.equal(pairB.factualCurrentSourceGames,1);assert.equal(pairB.tracks.RIVALRY.outgoing.stage,null);
  for(const rosterPlayerIds of [null,[owner,other]]){
    const affected=project([a,b],{...extra,pendingSources:[{seasonId:'s1',rosterPlayerIds}]});
    assert.equal(affected.relationships.find(p=>p.otherPlayerId===other).tracks.RIVALRY.outgoing.stage,null);
  }
});

test('forbidden qualified rules, policy, bands or effect cannot silently become private movement',()=>{
  for(const mutate of [c=>c.ruleId='E2E_DISTINCT_RUPTURE_ANTAGONISM',c=>c.effect='WEAKEN',
    c=>c.significanceBandId='SUBSTANTIAL',c=>c.policy={...c.policy,status:'APPROVED',approvalRef:'fake'}]){
    const row=bound();mutate(row.r.effects.find(e=>e.claim.decision==='QUALIFIED').claim);
    assert.throws(()=>project([row]),/HOSTED_SOCIAL_WITHHELD/);
  }
});

test('fixed hosted opportunity rejects unknown/unlocked/FFA or roster-relabeled teams',()=>{
  const row=bound(),c=row.r.effects.find(e=>e.claim.decision==='QUALIFIED').claim;
  row.r.source.roster.forEach((p,i)=>p.teamId=String(i+1));
  const facts={matchFacts:{rules:{lockTeams:{status:'DECODED',value:true}},players:row.r.source.roster.map((p,i)=>({replaySlot:p.replaySlot,lobbyTeamIdRaw:i+1}))}};
  assert.equal(fixedHostedOpportunity(row.r,facts,c.subject,'ONE_V_ONE',c.claimId),true);
  assert.equal(fixedHostedOpportunity(row.r,facts,c.subject,'FFA',c.claimId),false);
  facts.matchFacts.rules.lockTeams.value=false;assert.equal(fixedHostedOpportunity(row.r,facts,c.subject,'ONE_V_ONE',c.claimId),false);
  facts.matchFacts.rules.lockTeams.value=true;row.r.source.roster.forEach(p=>p.teamId='same');
  assert.equal(fixedHostedOpportunity(row.r,facts,c.subject,'ONE_V_ONE',c.claimId),false);
});

test('hosted helper opportunity requires an independently authored fixed opposing threat, not allied contact',()=>{
  const row=bound(),card=row.r.cards.find(c=>c.decision==='SOURCE_ADMITTED');
  row.r.source.roster=[{playerId:'a',replaySlot:1,teamId:'1'},{playerId:'b',replaySlot:2,teamId:'1'},
    {playerId:'c',replaySlot:3,teamId:'2'},{playerId:'d',replaySlot:4,teamId:'2'}];
  card.actorPlayerId='a';card.counterpartPlayerId='b';
  card.corroboration=[{kind:'PREENTRY_RECIPIENT_THREAT',originalSourceEventIds:['c1','c2']}];
  const subject={system:'REPUTATION',track:'CHIVALRY',playerId:'a'};
  const stats={matchFacts:{rules:{lockTeams:{status:'DECODED',value:true}},
    players:row.r.source.roster.map(p=>({replaySlot:p.replaySlot,lobbyTeamIdRaw:Number(p.teamId)}))}};
  const proof=[{sourceEventId:'c1',actorReplaySlot:3},{sourceEventId:'c2',actorReplaySlot:3}];
  const read=w=>fixedHostedOpportunity(row.r,stats,subject,'TWO_V_TWO',card.claimId,w);
  assert.equal(read(proof),true);assert.equal(read([]),false);
  assert.equal(read(proof.map(w=>({...w,actorReplaySlot:1}))),false);
  assert.equal(read(proof.map(w=>({...w,actorReplaySlot:2}))),false);
  row.r.source.roster[2].teamId='1';stats.matchFacts.players[2].lobbyTeamIdRaw=1;
  assert.equal(read(proof),false,'another fixed ally is not an opposing third-party threat');
});

async function hostedReady(){
  const f=await ready();
  // Existing publication fixture uses a tiny synthetic events buffer, not a
  // replay. Supply its test-only artifact-size metadata before the read begins.
  const meta=f.rows.get(f.sourcePath).recordedEvents;
  meta.uncompressedBytes=meta.bytes;meta.uncompressedSha256=meta.sha256;
  return f;
}
test('real source collector preserves quiet pairs on worker unavailability, rejects owner overrides and revoked access',async()=>{
  const f=await hostedReady();f.rows.set(HOSTED_POLICY_PATH,approval());
  const input={...f.input,env:{...f.input.env,...env},derive:async()=>{throw Error('worker unavailable');}};
  const x=await readMyHostedSocialProgression(input);assert.equal(x.coverage.complete,false);
  assert.equal(x.relationships[0].otherPlayerId,'p2');assert.equal(x.relationships[0].tracks.RIVALRY.outgoing.stage,null);
  await assert.rejects(readMyHostedSocialProgression({...input,request:{playerId:'p2'}}),e=>e.code==='invalid-argument');
  f.rows.get('players/p1').membershipStatus='SUSPENDED';
  await assert.rejects(readMyHostedSocialProgression(input),e=>e.code==='permission-denied');
  await assert.rejects(getMyHostedSocialProgression.run({data:{}}),e=>e.code==='unauthenticated');
});

test('withdrawn collector source reports incomplete shared history without invoking the worker',async()=>{
  const f=await hostedReady();f.rows.set(HOSTED_POLICY_PATH,approval());f.rows.get(f.sourcePath).state='WITHDRAWN';
  const x=await readMyHostedSocialProgression({...f.input,env:{...f.input.env,...env},derive:async()=>{throw Error('must not run');}});
  assert.equal(x.coverage.complete,false);assert.equal(x.coverage.currentSources,0);assert.deepEqual(x.relationships,[]);
  assert.equal(x.coverage.pendingSources,1);
});

test('source or external approval changed during derivation aborts instead of returning cached private values',async()=>{
  for(const change of [f=>f.rows.set(HOSTED_POLICY_PATH,{...approval(),status:'REVOKED'}),
    f=>f.rows.get(f.sourcePath).state='WITHDRAWN',f=>f.rows.get('authLinks/owner').playerId='p2']){
    const f=await hostedReady();f.rows.set(HOSTED_POLICY_PATH,approval());
    await assert.rejects(readMyHostedSocialProgression({...f.input,env:{...f.input.env,...env},
      derive:async()=>{change(f);throw Error('worker unavailable');}}),e=>['aborted','permission-denied'].includes(e.code));
  }
});

test('optional approval hook joins the existing source transaction, propagates failure, and preserves no-argument callers',async()=>{
  const f=await hostedReady();f.rows.set(HOSTED_POLICY_PATH,approval());
  const current=await collectMyCurrentBattleHistory(f.input);
  let transaction;
  const original=f.db.runTransaction;
  f.db.runTransaction=fn=>original(tx=>{transaction=tx;return fn(tx);});
  let calls=0;
  await current.revalidate(async tx=>{assert.equal(tx,transaction);assert.equal(typeof tx.set,'undefined');
    assert.equal((await tx.get(f.db.doc(HOSTED_POLICY_PATH))).data().approvalRevision,1);calls++;});
  assert.equal(calls,1);await current.revalidate();assert.equal(calls,1,'existing callers do not acquire a policy dependency');
  await assert.rejects(current.revalidate(async()=>{throw Object.assign(new Error('Changed'),{code:'aborted'});}),e=>e.code==='aborted');
});
