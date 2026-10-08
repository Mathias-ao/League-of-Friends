import {createHash} from "node:crypto";
import test from 'node:test';
import assert from 'node:assert/strict';
import {Timestamp} from 'firebase-admin/firestore';
import {memoryFirestore} from './support/memory-firestore.mjs';
import {adminCreateEvent} from '../lib/commands/events/createEvent.js';
import {adminCreateEventWarmups} from '../lib/commands/events/createEventWarmups.js';
import {checkInToEvent} from '../lib/commands/events/checkIn.js';
import {getEventDetail} from '../lib/queries/getEventDetail.js';
import {getMatchDetail} from '../lib/queries/getMatchDetail.js';
import {submitGameResult} from '../lib/commands/results/submitGameResult.js';
import {uploadReplay} from '../lib/commands/statistics/uploadReplay.js';
import {seasonScoringSnapshot} from '../lib/engines/seasonPoints.js';
const day=86400000;
const config={maps:{pool:['Arabia'],selectionMode:'ADMIN'},civilizations:{mode:'UNRESTRICTED',allowed:[],banned:[],customRuleCode:null},victory:{conquest:true,wonder:false,relic:false,customRuleCode:null},diplomacyEnabled:false,additionalSettings:{}};
const request=(data,uid='admin')=>({auth:{uid},data});
function fixture(){return memoryFirestore([
 ['leagueState/singleton',{activeSeasonId:'s1'}],['seasons/s1',{status:'ACTIVE'}],
 ...['admin','p1','p2','waiting'].flatMap(id=>[[`authLinks/${id}`,{playerId:id}],[`players/${id}`,{steamName:id,membershipStatus:'ACTIVE',role:id==='admin'?'ADMIN':'PLAYER'}],[`seasons/s1/participants/${id}`,{status:'ENTERED'}]])
]);}
function event(now,overrides={}){return {seasonId:'s1',title:'Lombardia',status:'PUBLISHED',startsAt:Timestamp.fromMillis(now+10*day),gameConfig:config,scoringSnapshot:seasonScoringSnapshot({act:'MAIN',diplomacyEnabled:false,placementPolicy:'NONE',emperorPlayerId:null}),goldRewardSnapshot:{matchCompletion:1,matchWin:2},...overrides};}

test('Event creation defaults to a seven-day warm-up and a bounded main-event check-in',async()=>{
 const db=fixture(),now=Date.now(),start=now+10*day;
 const input={requestId:'create-event-default',title:'Lombardia',startsAt:new Date(start).toISOString(),signupDeadlineAt:new Date(start-7*day).toISOString(),competitionStyle:'BIG_TEAM',planningConfig:{prioritizeLargestTeams:true,preferredTeamSize:4,allowAsymmetricTeams:false,philosophy:'BALANCED',balanceWeight:1},gameConfig:config,goldRewardSnapshot:{matchCompletion:1,matchWin:2}};
 const created=await adminCreateEvent.run(request(input));const stored=db.get('events/'+created.eventId);
 assert.equal(stored.warmupOpensAt.toMillis(),start-7*day);
 assert.equal(stored.checkInOpensAt.toMillis(),start-30*60000);
 assert.equal(stored.checkInClosesAt.toMillis(),start);
 for(const days of [5,6,7]){
  const made=await adminCreateEvent.run(request({...input,requestId:'create-event-'+days,warmupOpensAt:new Date(start-days*day).toISOString()}));
  assert.equal(db.get('events/'+made.eventId).warmupOpensAt.toMillis(),start-days*day);
 }
 for(const days of [4,8])await assert.rejects(adminCreateEvent.run(request({...input,requestId:'reject-event-'+days,warmupOpensAt:new Date(start-days*day).toISOString()})),/five to seven/);
 await assert.rejects(adminCreateEvent.run(request({...input,checkInClosesAt:new Date(start+1).toISOString()})),/Check-in must close/);
 await assert.rejects(adminCreateEvent.run(request({...input,checkInOpensAt:new Date(start).toISOString()})),/Check-in must close/);
});

test('warm-ups can be paired early, but result and recording submission wait for the opening date',async()=>{
 const db=fixture(),now=Date.now();db.set('events/e1',event(now));
 await adminCreateEventWarmups.run(request({requestId:'pair-early',eventId:'e1',pairs:[['p1','p2']],gameConfig:config}));
 const match=db.get('matches/e1-W1');assert.equal(match.playOpensAt.toMillis(),now+3*day);assert.equal(match.playClosesAt.toMillis(),now+10*day);
 const detail=await getEventDetail.run(request({eventId:'e1'},'p1'));
 assert.equal(detail.matches[0].playOpensAt,new Date(now+3*day).toISOString());
 const battle=await getMatchDetail.run(request({matchId:'e1-W1'},'p1'));assert.equal(battle.viewer.canSubmitResult,false);
 assert.equal(battle.match.playOpensAt,detail.matches[0].playOpensAt);
 await assert.rejects(submitGameResult.run(request({matchId:'e1-W1',gameId:'G1',winnerTeam:1},'p1')),/Battle opens/);
 await assert.rejects(uploadReplay.run(request({matchId:'e1-W1',gameId:'G1',fileName:'duel.aoe2record',replayBase64:Buffer.from('scheduled test recording').toString('base64')},'p1')),/Battle opens/);
 assert.equal(db.has('matches/e1-W1/games/G1/resultSubmissions/p1'),false);
 // Removing pinned fields simulates a warm-up created by the previous version.
 const {playOpensAt,playClosesAt,...legacy}=match;db.set('matches/e1-W1',legacy);
 assert.equal((await getMatchDetail.run(request({matchId:'e1-W1'},'p1'))).match.playOpensAt,detail.matches[0].playOpensAt);
 await assert.rejects(submitGameResult.run(request({matchId:'e1-W1',gameId:'G1',winnerTeam:1},'p1')),/Battle opens/);
 await assert.rejects(uploadReplay.run(request({matchId:'e1-W1',gameId:'G1',fileName:'duel.aoe2record',replayBase64:Buffer.from('legacy scheduled recording').toString('base64')},'p1')),/Battle opens/);
 db.set('events/e1',event(now,{startsAt:Timestamp.fromMillis(now+3*day)}));
 await submitGameResult.run(request({matchId:'e1-W1',gameId:'G1',winnerTeam:1},'p1'));
 assert.equal(db.get('matches/e1-W1/games/G1/resultSubmissions/p1').status,'PENDING_CONFIRMATION');
 assert.equal(db.has('events/e1/participants/p1'),false,'warm-up play does not require main-event check-in');
});

test('late recordings/results are permitted after the play target; pair creation requires a main date',async()=>{
 const db=fixture(),now=Date.now();db.set('events/e1',event(now,{startsAt:Timestamp.fromMillis(now-1000)}));
 await assert.rejects(adminCreateEventWarmups.run(request({requestId:'pair-late',eventId:'e1',pairs:[['p1','p2']],gameConfig:config})),/before the main Event/);
 db.set('events/e1',event(now,{startsAt:null}));
 await assert.rejects(adminCreateEventWarmups.run(request({requestId:'pair-no-date',eventId:'e1',pairs:[['p1','p2']],gameConfig:config})),/main Event date/);
 db.set('events/e1',event(now,{startsAt:Timestamp.fromMillis(now+3*day)}));
 await adminCreateEventWarmups.run(request({requestId:'pair-open',eventId:'e1',pairs:[['p1','p2']],gameConfig:config}));
 const match=db.get('matches/e1-W1');db.set('matches/e1-W1',{...match,playClosesAt:Timestamp.fromMillis(now-1000)});
 await submitGameResult.run(request({matchId:'e1-W1',gameId:'G1',winnerTeam:1},'p1'));
 assert.equal(db.get('matches/e1-W1/games/G1/resultSubmissions/p1').status,'PENDING_CONFIRMATION');
 const bytes=Buffer.from('previously analyzed late recording'),hash=createHash('sha256').update(bytes).digest('hex');
 db.set('matches/e1-W1/games/G1/replaySources/'+hash,{state:'READY',playerMapping:[],resultQualification:'UNRESOLVED'});
 const upload=await uploadReplay.run(request({matchId:'e1-W1',gameId:'G1',fileName:'late.aoe2record',replayBase64:bytes.toString('base64')},'p1'));
 assert.equal(upload.alreadyProcessed,true,'the play target does not hide or reject an existing processed recording');
});

test('main check-in is authenticated, confirmed-only, bounded, idempotent and visible in the muster',async()=>{
 const db=fixture(),now=Date.now();
 db.set('events/e1',event(now,{checkInOpensAt:Timestamp.fromMillis(now+60000),checkInClosesAt:Timestamp.fromMillis(now+120000)}));
 db.set('events/e1/participants/p1',{rsvp:'YES',signupState:'CONFIRMED',attendanceStatus:'NOT_CHECKED'});
 db.set('events/e1/participants/waiting',{rsvp:'YES',signupState:'WAITING_LIST',attendanceStatus:'NOT_CHECKED'});
 await assert.rejects(checkInToEvent.run({data:{eventId:'e1'}}),e=>e.code==='unauthenticated');
 await assert.rejects(checkInToEvent.run(request({eventId:'e1'},'p2')),/RSVP YES/);
 await assert.rejects(checkInToEvent.run(request({eventId:'e1'},'waiting')),/confirmed participants/);
 await assert.rejects(checkInToEvent.run(request({eventId:'e1'},'p1')),/not opened/);
 assert.equal(db.get('events/e1/participants/p1').attendanceStatus,'NOT_CHECKED');
 db.set('events/e1',{...db.get('events/e1'),checkInOpensAt:Timestamp.fromMillis(now-1000)});
 await checkInToEvent.run(request({eventId:'e1',playerId:'p2'},'p1'));
 const saved=db.get('events/e1/participants/p1');assert.equal(saved.attendanceStatus,'CHECKED_IN');
 assert.equal(db.has('events/e1/participants/p2'),false,'spoofed identity is ignored');
 await checkInToEvent.run(request({eventId:'e1'},'p1'));assert.equal(db.get('events/e1/participants/p1').checkedInAt,saved.checkedInAt);
 const detail=await getEventDetail.run(request({eventId:'e1'},'p1'));
 assert.equal(detail.viewer.attendanceStatus,'CHECKED_IN');assert.equal(detail.signup.confirmed[0].attendanceStatus,'CHECKED_IN');
 db.set('events/e1/participants/p2',{rsvp:'YES',signupState:'CONFIRMED',attendanceStatus:'NOT_CHECKED'});
 db.set('events/e1',{...db.get('events/e1'),checkInClosesAt:Timestamp.fromMillis(now-1000)});
 await assert.rejects(checkInToEvent.run(request({eventId:'e1'},'p2')),/closed/);
 db.set('events/e1',{...db.get('events/e1'),checkInOpensAt:null});
 await assert.rejects(checkInToEvent.run(request({eventId:'e1'},'p2')),/not set/);
});

test('legacy Events opening check-in at kickoff receive the same usable window in reads and writes',async()=>{
 const db=fixture(),now=Date.now(),start=now+10*60000;
 db.set('events/e1',event(now,{startsAt:Timestamp.fromMillis(start),checkInOpensAt:Timestamp.fromMillis(start),checkInClosesAt:null}));
 db.set('events/e1/participants/p1',{rsvp:'YES',signupState:'CONFIRMED',attendanceStatus:'NOT_CHECKED'});
 const detail=await getEventDetail.run(request({eventId:'e1'},'p1'));
 assert.equal(detail.event.checkInOpensAt,new Date(start-30*60000).toISOString());
 assert.equal(detail.event.checkInClosesAt,new Date(start).toISOString());
 await checkInToEvent.run(request({eventId:'e1'},'p1'));
 assert.equal(db.get('events/e1/participants/p1').attendanceStatus,'CHECKED_IN');
});
