import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveSocialScheduleOrders} from '../lib/integration/socialScheduleOrder.js';
import {collectMyCurrentBattleHistory} from '../lib/queries/getMyPersonalityHistory.js';
import {ready} from './support/private-history-fixture.mjs';
const ts=n=>({toMillis:()=>n});
const fixture=(battleId='battle',eventId='event',start=1000)=>({battleId,match:{eventId,seasonId:'season',sourceMatchPlanId:'plan',matchNumber:1},
 event:{seasonId:'season',startsAt:ts(start),approvedMatchPlanId:'plan',matchPlanStatus:'APPROVED',officialMatchIds:[battleId],warmupMatchIds:[]},
 planId:'plan',plan:{status:'APPROVED',officialMatchIds:[battleId],matches:[{}]},
 games:[{gameId:'game-2',game:{gameNumber:2}},{gameId:'game-1',game:{gameNumber:1}}]});

test('approved Event/Battle/Game order is explicit, stable and independent of upload/completion/ID sorting',()=>{
 const a=fixture('z-first','event-z',1000),b=fixture('a-second','event-a',2000),rows=deriveSocialScheduleOrders([b,a]);
 assert.ok(rows.every(r=>r.status==='ORDERED'));assert.equal(rows.find(r=>r.battleId===a.battleId).order.event,1000);
 assert.equal(rows.find(r=>r.gameId==='game-2').order.game,2);assert.equal(rows.find(r=>r.gameId==='game-1').order.game,1);
 const before=deriveSocialScheduleOrders([a]);Object.assign(a.match,{createdAt:ts(99999),firstCompletedAt:ts(999999),uploadedAt:ts(10)});
 a.games[0].game.replay={uploadedAt:ts(9999999)};assert.deepEqual(deriveSocialScheduleOrders([a]),before);
 a.event.startsAt=ts(3000);assert.notEqual(deriveSocialScheduleOrders([a])[0].revision,before[0].revision);
});
test('tied Events, unapproved/mismatched slots, warmups, missing/gapped Game sequence remain Pending',()=>{
 const a=fixture(),b=fixture('other','other-event',1000);assert.ok(deriveSocialScheduleOrders([a,b]).every(r=>r.order===null));
 for(const mutate of [f=>delete f.event.startsAt,f=>f.plan.status='PROPOSED',f=>f.event.approvedMatchPlanId='other',
  f=>f.plan.officialMatchIds=['other'],f=>f.match.matchNumber=2,f=>f.event.warmupMatchIds.push(f.battleId),
  f=>delete f.games[0].game.gameNumber,f=>f.games[0].game.gameNumber=3,f=>f.games[0].game.gameNumber=1]){
  const f=fixture();mutate(f);const r=deriveSocialScheduleOrders([f]);assert.ok(r.every(x=>x.status==='PENDING'&&x.order===null));
 }
});

test('approved parallel plan slots use server matchNumber, never caller order or ID naming',()=>{
 const f=fixture('z'),g=fixture('a');f.event.officialMatchIds=g.event.officialMatchIds=['z','a'];
 f.plan.officialMatchIds=g.plan.officialMatchIds=['z','a'];f.plan.matches=g.plan.matches=[{},{}];g.match.matchNumber=2;
 const r=deriveSocialScheduleOrders([g,f]);assert.equal(r.find(x=>x.battleId==='z').order.battle,1);assert.equal(r.find(x=>x.battleId==='a').order.battle,2);
});
async function scheduled(){const f=await ready();Object.assign(f.rows.get('matches/m'),{sourceMatchPlanId:'p',matchNumber:1});
 Object.assign(f.rows.get('events/e'),{startsAt:ts(1000),approvedMatchPlanId:'p',matchPlanStatus:'APPROVED'});
 f.rows.set('events/e/matchPlans/p',{status:'APPROVED',officialMatchIds:['m'],matches:[{}]});return f;}
test('authenticated collector fences plan and schedule edits after work; missing schedule stays Pending',async()=>{
 const f=await scheduled(),input={...f.input,includeScheduleOrder:true},r=await collectMyCurrentBattleHistory(input);
 assert.equal(r.scheduleOrders[0].status,'ORDERED');assert.equal(r.scheduleOrders[0].battleId,'m');
 f.rows.get('events/e/matchPlans/p').status='REVOKED';await assert.rejects(r.revalidate,e=>e.code==='aborted');
 const p=await scheduled(),read=await collectMyCurrentBattleHistory({...p.input,includeScheduleOrder:true});
 p.rows.get('events/e').startsAt=ts(2000);await assert.rejects(read.revalidate,e=>e.code==='aborted');
 const g=await ready(),pending=await collectMyCurrentBattleHistory({...g.input,includeScheduleOrder:true});assert.equal(pending.scheduleOrders[0].status,'PENDING');
 const legacy=await collectMyCurrentBattleHistory(g.input);assert.deepEqual(legacy.scheduleOrders,[]);
 await assert.rejects(collectMyCurrentBattleHistory({...input,actor:{playerId:'p2',authUid:'owner'}}),e=>e.code==='permission-denied');
});
