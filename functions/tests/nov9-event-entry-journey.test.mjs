import test from 'node:test';
import assert from 'node:assert/strict';
import {Timestamp} from 'firebase-admin/firestore';
import {memoryFirestore} from './support/memory-firestore.mjs';
import {adminCreateEvent} from '../lib/commands/events/createEvent.js';
import {adminPublishEvent} from '../lib/commands/events/publishEvent.js';
import {setEventRsvp} from '../lib/commands/events/setRsvp.js';
import {checkInToEvent} from '../lib/commands/events/checkIn.js';
import {advanceEventWarmups} from '../lib/services/warmupLifecycle.js';
import {adminGenerateMatchPlan} from '../lib/commands/events/generateMatchPlan.js';
import {adminApproveMatchPlan} from '../lib/commands/events/approveMatchPlan.js';

const players=['alice','beren'];
const publicationMs=Date.parse('2026-11-04T10:00:00Z');
const minute=60000;
const request=(uid,data)=>({auth:{uid},data});
const operator=data=>request('operator',data);
const config={maps:{pool:['Arabia'],selectionMode:'ADMIN'},
  civilizations:{mode:'UNRESTRICTED',allowed:[],banned:[],customRuleCode:null},
  victory:{conquest:true,wonder:false,relic:false,customRuleCode:null},
  diplomacyEnabled:false,additionalSettings:{}};
const at=ms=>new Date(ms).toISOString();
const matchRows=db=>[...db].filter(([path])=>/^matches\/[^/]+$/.test(path));
const eventRows=db=>[...db].filter(([path])=>/^events\/[^/]+$/.test(path));

/**
 * Controlled command integration only: initial Season entry/account authority
 * is fixture data; Events, signups, attendance and Battles are command output.
 * This stops before play/upload/results and does not certify recordings,
 * browser behavior or the separate 18–18 controlled result regression.
 */
test('Nov 9 entry journey: real create/publish/RSVP/check-in yields two Events and four independent BO1 Battles',async t=>{
  let clock=publicationMs;
  t.mock.method(Date,'now',()=>clock);
  const initial=[
    ['leagueState/singleton',{activeSeasonId:'s',currentEmperorPlayerId:'operator'}],
    ['seasons/s',{status:'ACTIVE',startsAt:Timestamp.fromDate(new Date('2026-11-01T00:00:00Z')),
      endsAt:Timestamp.fromDate(new Date('2026-11-30T23:59:59Z'))}],
  ];
  for(const id of ['operator',...players])initial.push(
    ['authLinks/'+id,{playerId:id}],
    ['players/'+id,{steamName:id,membershipStatus:'ACTIVE',role:id==='operator'?'ADMIN':'PLAYER'}],
    ['seasons/s/participants/'+id,{status:'ENTERED'}],
  );
  const db=memoryFirestore(initial),events=[],battles=[],scheduled=[];
  assert.equal(eventRows(db).length,0);
  for(const [index,startsAt] of ['2026-11-09T18:00:00Z','2026-11-09T19:00:00Z'].entries()){
    clock=publicationMs;
    const start=Date.parse(startsAt);
    const create={requestId:`entry-create-${index}`,title:`Controlled entry Event ${index+1}`,
      startsAt,timezone:'Europe/Copenhagen',signupDeadlineAt:at(start-45*minute),
      checkInOpensAt:at(start-30*minute),checkInClosesAt:startsAt,
      minParticipants:2,maxParticipants:2,competitionStyle:'ONE_V_ONE',
      planningConfig:{pairingMode:'RANDOM',prioritizeLargestTeams:false,
        preferredTeamSize:2,allowAsymmetricTeams:false,philosophy:'BALANCED',balanceWeight:0},
      gameConfig:config,goldRewardSnapshot:{matchCompletion:1,matchWin:2},
      warmupPolicy:{gameConfig:config}};
    if(index===0){
      await assert.rejects(adminCreateEvent.run({data:create}),error=>error.code==='unauthenticated');
      await assert.rejects(adminCreateEvent.run(request('alice',create)),error=>error.code==='permission-denied');
      assert.equal(eventRows(db).length,0);
    }
    const created=await adminCreateEvent.run(operator(create));
    const eventId=created.eventId,ref='events/'+eventId;
    events.push(eventId);
    assert.equal(created.status,'DRAFT');
    assert.equal(db.get(ref).status,'DRAFT');
    await assert.rejects(adminCreateEvent.run(operator(create)),error=>error.code==='already-exists');
    assert.equal(eventRows(db).length,index+1,'a retried create cannot create a second Event');
    await assert.rejects(setEventRsvp.run(request('alice',{eventId,rsvp:'YES'})),
      error=>error.code==='failed-precondition');
    assert.equal(db.has(ref+'/participants/alice'),false,'a draft Event cannot receive a signup');

    const published=await adminPublishEvent.run(operator({requestId:`entry-publish-${index}`,eventId}));
    assert.equal(published.status,'PUBLISHED');
    assert.equal(db.get(ref).publishedAt.toMillis(),publicationMs);
    assert.ok(db.get(ref).warmupOpensAt.toMillis()<publicationMs,'Nov 4 publication is after this Nov 9 Event’s T-7 opening');
    assert.equal(db.get(ref).warmupPolicy.scoringPolicy,'AOF_BEST_WARMUP_V1');
    assert.deepEqual(await advanceEventWarmups(eventId,clock),{changed:false});
    assert.equal(db.get(ref).warmupSchedule,undefined,'zero signups cannot seal a late-published draw');
    assert.equal(matchRows(db).length,index);
    await assert.rejects(checkInToEvent.run(request('beren',{eventId})),
      error=>error.code==='failed-precondition');

    const alice=await setEventRsvp.run(request('alice',{eventId,rsvp:'YES',playerId:'beren'}));
    assert.equal(alice.playerId,'alice','signup identity comes from authentication');
    assert.equal(alice.signupState,'CONFIRMED');
    assert.equal(db.has(ref+'/participants/beren'),false);
    assert.equal(db.get(ref+'/participants/alice').attendanceStatus,'NOT_CHECKED');
    assert.deepEqual(await advanceEventWarmups(eventId,clock),{changed:false});
    assert.equal(db.get(ref).warmupSchedule,undefined,'one signup cannot seal the draw either');
    const beren=await setEventRsvp.run(request('beren',{eventId,rsvp:'YES'}));
    assert.equal(beren.signupState,'CONFIRMED');
    assert.deepEqual(await advanceEventWarmups(eventId,clock),{changed:true});
    const warmup=db.get(ref).warmupMatchIds[0];
    assert.equal(db.get(ref).warmupMatchIds.length,1);
    assert.equal(db.get(ref).warmupSchedule.status,'PAIRED');
    assert.deepEqual([...db.get(ref).warmupSchedule.rosterIds].sort(),players);
    assert.deepEqual(await advanceEventWarmups(eventId,clock),{changed:false});
    assert.equal(db.get(ref).warmupMatchIds.length,1,'scheduler retries do not create another warmup');
    assert.equal(db.has(ref+'/participants/operator'),false,'the operator does not compete');
    await assert.rejects(checkInToEvent.run(request('alice',{eventId})),
      error=>error.code==='failed-precondition'&&/not opened/.test(error.message));
    scheduled.push({eventId,ref,start,warmup,index});
  }
  assert.equal(matchRows(db).length,2,'both Nov 4 publications have exactly one automatic warmup');
  for(const {eventId,ref,start,warmup,index} of scheduled){
    clock=start-20*minute;
    await assert.rejects(checkInToEvent.run({data:{eventId}}),error=>error.code==='unauthenticated');
    await checkInToEvent.run(request('alice',{eventId,playerId:'beren'}));
    assert.equal(db.get(ref+'/participants/alice').attendanceStatus,'CHECKED_IN');
    assert.equal(db.get(ref+'/participants/beren').attendanceStatus,'NOT_CHECKED');
    await assert.rejects(adminGenerateMatchPlan.run(operator({requestId:`entry-plan-too-early-${index}`,eventId})),
      error=>error.code==='failed-precondition');
    await checkInToEvent.run(request('beren',{eventId}));
    const checkedInAt=db.get(ref+'/participants/beren').checkedInAt.toMillis();
    await checkInToEvent.run(request('beren',{eventId}));
    assert.equal(db.get(ref+'/participants/beren').checkedInAt.toMillis(),checkedInAt);
    await assert.rejects(adminGenerateMatchPlan.run(request('alice',{
      requestId:`entry-plan-not-admin-${index}`,eventId})),error=>error.code==='permission-denied');

    // All attendance is resolved, so the normal unforced draw is allowed
    // before check-in closes; neither a fabricated closure nor override is used.
    const plan=await adminGenerateMatchPlan.run(operator({requestId:`entry-plan-${index}`,eventId,pairingMode:'RANDOM'}));
    assert.deepEqual([...plan.eligiblePlayerIds].sort(),players);
    assert.equal(db.get(ref+'/matchPlans/'+plan.planId).forced,false);
    const approve={requestId:`entry-approve-${index}`,eventId,planId:plan.planId};
    const approved=await adminApproveMatchPlan.run(operator(approve));
    assert.equal(approved.officialMatchIds.length,1);
    const repeated=await adminApproveMatchPlan.run(operator(approve));
    assert.equal(repeated.alreadyApproved,true);
    assert.deepEqual(repeated.officialMatchIds,approved.officialMatchIds);
    const main=approved.officialMatchIds[0];
    for(const [act,matchId] of [['WARMUP',warmup],['MAIN',main]]){
      const match=db.get('matches/'+matchId),game=db.get('matches/'+matchId+'/games/G1');
      assert.equal(match.eventId,eventId);
      assert.equal(match.format,'ONE_V_ONE');
      assert.equal(match.status,'READY');
      assert.deepEqual(match.seriesRule,{maxGames:1,gamesRequiredToWin:1});
      assert.deepEqual(match.participants.map(p=>p.playerId).sort(),players);
      assert.equal(match.scoringSnapshot.rules.act,act);
      for(const playerId of players)assert.equal(db.get(ref+'/scoringSlots/'+act+'_'+playerId).matchId,matchId);
      assert.equal(game.canonicalResult,null);
      assert.equal(game.activeReplayStatisticsId,undefined,'recording admission is a later owner test');
      battles.push(matchId);
    }
    assert.equal([...db.keys()].filter(path=>path.startsWith(ref+'/scoringSlots/')).length,4,
      'each ordinary player has exactly one designated slot per act in this Event');
    assert.equal(db.get(ref).warmupMatchIds.length,1);
    assert.equal(db.get(ref).officialMatchIds.length,1);
  }
  assert.equal(new Set(events).size,2);
  assert.equal(new Set(battles).size,4);
  assert.equal(matchRows(db).length,4);
  assert.equal([...db.keys()].some(path=>/^(leaguePointLedger|goldLedger|warRoomPointLedger)\//.test(path)),false,
    'entry and planning do not fabricate result rewards');
});
