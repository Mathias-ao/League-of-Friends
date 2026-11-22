import test from 'node:test';
import assert from 'node:assert/strict';
import {act} from 'react';
import {mountHostedSocial} from './render-hosted-social.mjs';
import {parseHostedSocialProgression,hostedSocialEnabled,HOSTED_SOCIAL_VERSION,
 type HostedSocialProgression,type PrivateSocialTrack} from '../src/domain/hostedSocialProgression';

function pending(unsupported=false):PrivateSocialTrack{return {readiness:'PENDING_SOURCE_METHOD',progression:'PENDING',
 reasonCodes:[unsupported?'NOT_YET_MEASURED':'NO_QUALIFYING_RECORDED_ACTIVITY'],sourceQualifiedBattles:0,
 sourceQualifiedGames:0,sourceQualifiedEvents:0,stage:null,upBank:null};}
const measured=():PrivateSocialTrack=>({readiness:'SOURCE_QUALIFIED',progression:'PRIVATE_PREVIEW',reasonCodes:[],
 sourceQualifiedBattles:1,sourceQualifiedGames:1,sourceQualifiedEvents:1,stage:0,upBank:1});
function dto(owner='owner'):HostedSocialProgression{return {version:HOSTED_SOCIAL_VERSION,ownerPlayerId:owner,revision:'a'.repeat(64),
 policyVersion:'AOF_SOC_V1A_SOURCE_BOUND_ORDINARY_GRADES_PROPOSED_1',approvalScope:'PRIVATE_NUMERICAL_PREVIEW',
 coverage:{complete:true,ownBattles:1,ownGames:1,currentSources:1,pendingSources:0},
 reputation:{GALLANTRY:{career:pending(),bySeason:{}},CRUELTY:{career:pending(true),bySeason:{}},
 CHIVALRY:{career:measured(),bySeason:{s1:measured()}}},relationships:[{otherPlayerId:'other',factualCurrentSourceBattles:1,
 factualCurrentSourceGames:1,tracks:{RIVALRY:{outgoing:measured(),incoming:pending()},
 HOSTILITY:{outgoing:pending(true),incoming:pending(true)},BOND:{outgoing:pending(),incoming:pending()}}}]};}

test('strict private DTO rejects wrong owner, public/proof fields, unsupported numbers or inconsistent coverage',()=>{
 assert.deepEqual(parseHostedSocialProgression(dto(),'owner'),dto());
 for(const change of [x=>x.ownerPlayerId='other',x=>(x as any).receipts=[],
  x=>(x.reputation.CHIVALRY.career as any).originalWitness='private',
  x=>x.reputation.CRUELTY.career=measured(),x=>x.relationships[0].tracks.HOSTILITY.outgoing=measured(),
  x=>x.coverage.complete=false,x=>x.reputation.GALLANTRY.career.stage=0,
  x=>x.relationships[0].otherPlayerId='owner',x=>x.relationships.push(structuredClone(x.relationships[0])),
  x=>(x.reputation as any).UNKNOWN={career:measured(),bySeason:{}}]){
  const x=dto();change(x);assert.throws(()=>parseHostedSocialProgression(x,'owner'));
 }
 const partial=dto();partial.coverage.complete=false;partial.coverage.pendingSources=1;
 assert.equal(parseHostedSocialProgression(partial,'owner').relationships[0].tracks.RIVALRY.outgoing.upBank,1,
  'independent complete pairs may remain available when another source is missing');
 const enabled={VITE_AOF_HOSTED_SOCIAL_PRIVATE:'v1a',VITE_FIREBASE_PROJECT_ID:'age-of-friends-staging'};
 assert.equal(hostedSocialEnabled(enabled),true);
 for(const change of [{VITE_AOF_HOSTED_SOCIAL_PRIVATE:undefined},{VITE_FIREBASE_PROJECT_ID:'production'},
  {VITE_USE_EMULATORS:'true'}])assert.equal(hostedSocialEnabled({...enabled,...change}),false);
});

test('incomplete empty shared history is qualified and remains refreshable',async()=>{
 const app=await mountHostedSocial();try{
  const x=dto();x.coverage.complete=false;x.coverage.pendingSources=1;x.relationships=[];
  await app.complete(0,x);assert.match(app.body(),/Shared history is incomplete/);
  assert.doesNotMatch(app.body(),/No current shared recorded Battles/);
  await app.click();assert.equal(app.calls.length,2);await app.complete(1,{...dto(),relationships:[]});
  assert.match(app.body(),/No current shared recorded Battles/);assert.doesNotMatch(app.body(),/Shared history is incomplete/);
 }finally{await app.close();}
});

test('mounted owner consumes independent directed progression while unsupported tracks stay Pending/null',async()=>{
 const app=await mountHostedSocial();try{
  assert.equal(app.calls.length,1,'initial unchanged Firebase callback must not cancel the read');
  await app.complete(0,dto());assert.match(app.body(),/Private pilot · source-supported conduct/);
  assert.match(app.body(),/Preview stage 0 · Bank 1/);assert.match(app.body(),/Not yet measured/);
  assert.match(app.body(),/Your activity → this player/);assert.match(app.body(),/This player’s activity → you/);
  assert.match(app.body(),/Developing — no qualifying recorded activity/);assert.doesNotMatch(app.body(),/1 pts/);
 }finally{await app.close();}
});

test('identical bootstrap snapshots cannot starve an in-flight private read during standings reconciliation',async()=>{
 const app=await mountHostedSocial();try{
  await app.render();await app.render();assert.equal(app.calls.length,1);
  await app.complete(0,dto());assert.match(app.body(),/Preview stage 0 · Bank 1/);
  await app.render();assert.equal(app.calls.length,1);assert.match(app.body(),/Preview stage 0 · Bank 1/);
 }finally{await app.close();}
});

test('default-off, signed-out and other-owner profiles never request private progression',async()=>{
 for(const options of [{enabled:false},{uid:null}]){const app=await mountHostedSocial(options);try{
  assert.equal(app.calls.length,0);assert.doesNotMatch(app.body(),/Preview stage/);
 }finally{await app.close();}}
 const app=await mountHostedSocial();try{
  await app.render('other','owner');await app.complete(0,dto());
  assert.equal(app.calls.length,1);assert.doesNotMatch(app.body(),/Private pilot · source-supported conduct/);
 }finally{await app.close();}
});

test('logout and membership revocation immediately clear a private read, including delayed responses',async()=>{
 const app=await mountHostedSocial();try{
  await app.complete(0,dto());await app.focus();assert.equal(app.calls.length,2);
  assert.doesNotMatch(app.body(),/Preview stage/,'foreground refresh hides the old revision before loading');
  await app.auth(null);await app.complete(1,dto());assert.doesNotMatch(app.body(),/Preview stage/);
  assert.equal(app.calls.length,2);
 }finally{await app.close();}
 const revoked=await mountHostedSocial();try{
  await revoked.complete(0,dto());await revoked.render('owner','owner','SUSPENDED');
  assert.doesNotMatch(revoked.body(),/Private pilot · source-supported conduct/);
 }finally{await revoked.close();}
});

test('account replacement/wrong-owner/late resolution cannot restore another player’s progression',async()=>{
 const app=await mountHostedSocial();try{
  await app.auth('firebase-other');await app.render('other','other');
  await app.complete(0,dto());assert.doesNotMatch(app.body(),/Preview stage/);
  await app.complete(1,dto('owner'));assert.doesNotMatch(app.body(),/Preview stage/);
  await app.click();await app.complete(2,{...dto('other'),relationships:[]});
  assert.match(app.body(),/Preview stage 0 · Bank 1/);assert.match(app.body(),/No current shared recorded Battles/);
 }finally{await app.close();}
});

test('withdrawal/correction/quiet pairs retract old values without disappearing from factual history',async()=>{
 const app=await mountHostedSocial();try{
  await app.complete(0,dto());await app.click();
  const corrected=dto();corrected.revision='b'.repeat(64);corrected.reputation.CHIVALRY={career:pending(),bySeason:{s1:pending()}};
  corrected.relationships[0].tracks.RIVALRY.outgoing=pending();
  await app.complete(1,corrected);assert.doesNotMatch(app.body(),/Preview stage/);assert.match(app.body(),/1 factual Battles · 1 Games/);
  await app.click();await app.fail(2);assert.doesNotMatch(app.body(),/1 factual Battles/);assert.match(app.body(),/Unavailable — refresh/);
  await app.click();await app.complete(3,dto());assert.match(app.body(),/Preview stage/);
 }finally{await app.close();}
});

test('aborted reads recover automatically; persistent aborts exhaust a bounded retry and remain actionable',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const app=await mountHostedSocial();try{
  await app.fail(0,{code:'functions/aborted'});await act(async()=>{t.mock.timers.tick(1000);});
  assert.equal(app.calls.length,2);await app.complete(1,dto());assert.match(app.body(),/Preview stage/);
  await app.click();await app.fail(2,{code:'functions/aborted'});
  await act(async()=>{t.mock.timers.tick(1000);});await app.fail(3,{code:'functions/aborted'});
  await act(async()=>{t.mock.timers.tick(2000);});await app.fail(4,{code:'functions/aborted'});
  assert.match(app.body(),/Unavailable — refresh/);assert.doesNotMatch(app.body(),/Preview stage/);
  await act(async()=>{t.mock.timers.tick(60000);});assert.equal(app.calls.length,5);
 }finally{await app.close();t.mock.timers.reset();}
});
