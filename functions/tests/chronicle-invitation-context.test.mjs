import test from 'node:test';
import assert from 'node:assert/strict';
import {ready} from './support/private-history-fixture.mjs';
import {bindingDigest} from '../lib/engines/nativeRecordingIntegration.js';
import {deriveSocialScheduleOrders} from '../lib/integration/socialScheduleOrder.js';
import {invitationSlotId} from '../lib/domain/socialV1.js';
import {chronicleInvitationContext,readMyChronicleInvitations}
  from '../lib/queries/chronicleInteractionService.js';

const env={AOF_CHRONICLE_INTERACTIONS_V1E:'emulator-only'};
async function fixture(){
  const f=await ready(),match=f.rows.get('matches/m'),game=f.rows.get('matches/m/games/g');
  const event=f.rows.get('events/e'),planId='approved-context-plan';
  Object.assign(match,{sourceMatchPlanId:planId,matchNumber:1});
  Object.assign(event,{startsAt:{toMillis:()=>1000},approvedMatchPlanId:planId,matchPlanStatus:'APPROVED'});
  const plan={status:'APPROVED',officialMatchIds:['m'],matches:[{}]};
  f.rows.set('events/e/matchPlans/'+planId,plan);
  const scheduleRevisions=deriveSocialScheduleOrders([{battleId:'m',match,event,planId,plan,
    games:[{gameId:'g',game}]}]).map(o=>({gameId:o.gameId,revision:o.revision}));
  const review={incidentId:'controlled-moment',privateReviewerText:'DO-NOT-EXPOSE',
    // Deliberate untrusted fields are not an admitted account or timestamp.
    account:'rescued the ally',recordingAtMs:12345};
  f.rows.set('matches/m/chronicleRareReviewedMoments/controlled-moment',review);
  const slotId=invitationSlotId('m','p1'),slot={slotId,battleId:'m',respondentPlayerId:'p1',
    revision:1,state:'OFFERED',currentOpportunityRevision:'a'.repeat(64),selected:{
      family:'ASSISTANCE',counterpartPlayerId:'p2',gameId:'g',sourceHash:f.sourceHash,
      incidentId:'controlled-moment',reviewedDigest:bindingDigest(review),
      matchDigest:bindingDigest((await f.db.doc('matches/m').get()).data()),scheduleRevisions,battleAuthorities:[{
        gameId:'g',gameDigest:bindingDigest((await f.db.doc('matches/m/games/g').get()).data()),
        sourceDigest:bindingDigest((await f.db.doc(f.sourcePath).get()).data())}]}};
  f.rows.set('matches/m/socialV1InvitationSlots/'+slotId,slot);
  const input={...f.input,env:{...f.input.env,...env}};
  return {...f,input,slot,game};
}
test('authenticated current invitation exposes only its exact canonical Game; incident account and time stay Pending',async()=>{
  const f=await fixture(),result=await readMyChronicleInvitations(f.input,{}),i=result.invitations[0];
  assert.equal(i.sourceCurrent,true);
  assert.deepEqual(i.context,{version:'AOF_CHRONICLE_INVITATION_CONTEXT_V1',status:'CURRENT_GAME_ONLY',
    battleId:'m',gameId:'g',opportunityRevision:'a'.repeat(64),gameNumber:1,
    incidentAccount:null,recordingAtMs:null,
    missing:['SOURCE_QUALIFIED_INCIDENT_ACCOUNT','SOURCE_QUALIFIED_INCIDENT_TIME']});
  assert.doesNotMatch(JSON.stringify(result),/DO-NOT-EXPOSE|rescued the ally|12345|privateReviewerText|native-replay-evidence/);
  assert.equal((await readMyChronicleInvitations({...f.input,actor:{playerId:'p2',authUid:'other'}},{})).invitations.length,0);
  await assert.rejects(readMyChronicleInvitations({...f.input,actor:{playerId:'p1',authUid:'other'}},{}),
    e=>e.code==='permission-denied');
  await assert.rejects(readMyChronicleInvitations(f.input,{gameId:'another'}),e=>e.code==='invalid-argument');
});
test('withdrawn or revised source, changed Game ordinal and changed opportunity never retain a current context',async()=>{
  for(const change of ['withdraw','ordinal','review']){
    const f=await fixture();
    if(change==='withdraw')f.rows.get(f.sourcePath).state='WITHDRAWN';
    if(change==='ordinal')f.game.gameNumber=2;
    if(change==='review')f.rows.get('matches/m/chronicleRareReviewedMoments/controlled-moment').recordingAtMs=99;
    const i=(await readMyChronicleInvitations(f.input,{})).invitations[0];
    assert.equal(i.sourceCurrent,false,change);
    assert.equal(i.context.status,'PENDING',change);assert.equal(i.context.gameNumber,null);
    assert.equal(i.context.incidentAccount,null);assert.equal(i.context.recordingAtMs,null);
  }
});
test('context builder cannot borrow a different active source or invent a missing Game ordinal',()=>{
  const slot={battleId:'m',selected:{gameId:'g',sourceHash:'a'.repeat(64)},currentOpportunityRevision:'b'.repeat(64)};
  for(const game of [null,{gameNumber:1,activeReplayStatisticsId:'c'.repeat(64)},
    {gameNumber:0,activeReplayStatisticsId:'a'.repeat(64)},
    {gameNumber:1.5,activeReplayStatisticsId:'a'.repeat(64)}]){
    const c=chronicleInvitationContext(slot,game);assert.equal(c.status,'PENDING');assert.equal(c.gameNumber,null);
  }
});
