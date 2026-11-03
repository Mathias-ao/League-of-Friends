import test from 'node:test';
import assert from 'node:assert/strict';
import {Timestamp} from 'firebase-admin/firestore';
import {memoryFirestore} from './support/memory-firestore.mjs';
import {seasonScoringSnapshot} from '../lib/engines/seasonPoints.js';
import {adminCreateEventWarmups} from '../lib/commands/events/createEventWarmups.js';
import {adminGenerateMatchPlan} from '../lib/commands/events/generateMatchPlan.js';
import {adminApproveMatchPlan} from '../lib/commands/events/approveMatchPlan.js';
import {adminBindReplayParticipants} from '../lib/commands/admin/bindReplayParticipants.js';

const day=86400000;
const req=(data,uid='operator')=>({auth:{uid},data});
const players=['alice','beren'];
const config={maps:{pool:['Arabia'],selectionMode:'ADMIN'},
  civilizations:{mode:'UNRESTRICTED',allowed:[],banned:[],customRuleCode:null},
  victory:{conquest:true,wonder:false,relic:false,customRuleCode:null},
  diplomacyEnabled:false,additionalSettings:{}};
const scoring=seasonScoringSnapshot({act:'MAIN',diplomacyEnabled:false,
  placementPolicy:'NONE',emperorPlayerId:'operator'});
function fixture(){
 const now=Date.now(),entries=[
   ['leagueState/singleton',{activeSeasonId:'s',currentEmperorPlayerId:'operator'}],
   ['seasons/s',{status:'ACTIVE'}],
 ];
 for(const id of ['operator',...players]){
   entries.push(['authLinks/'+id,{playerId:id}],
     ['players/'+id,{steamName:id,membershipStatus:'ACTIVE',role:id==='operator'?'ADMIN':'PLAYER'}],
     ['seasons/s/participants/'+id,{status:'ENTERED'}]);
 }
 for(const [index,eventId] of ['event-one','event-two'].entries()){
   entries.push(['events/'+eventId,{
     seasonId:'s',status:'PUBLISHED',startsAt:Timestamp.fromMillis(now+(index+3)*day),
     timezone:'Europe/Copenhagen',gameConfig:config,scoringSnapshot:scoring,
     goldRewardSnapshot:{matchCompletion:1,matchWin:2},
     competitionStyle:'ONE_V_ONE',minParticipants:2,
     planningConfig:{pairingMode:'RANDOM',prioritizeLargestTeams:false,
       preferredTeamSize:2,allowAsymmetricTeams:false,philosophy:'BALANCED',balanceWeight:0},
   }]);
   for(const id of players)entries.push(['events/'+eventId+'/participants/'+id,{
     rsvp:'YES',signupState:'CONFIRMED',attendanceStatus:'CHECKED_IN',
   }]);
 }
 return memoryFirestore(entries);
}
test('Nov 9 two-Event pilot: normal admin commands produce four separate 1v1 Battles and audited name bindings',async()=>{
 const db=fixture(),claimed=[];
 for(const eventId of ['event-one','event-two']){
   const warmups=await adminCreateEventWarmups.run(req({
     requestId:'warmup-'+eventId,eventId,pairs:[players],gameConfig:config,
   }));
   assert.equal(warmups.matchIds.length,1);
   const planned=await adminGenerateMatchPlan.run(req({
     requestId:'plan-'+eventId,eventId,pairingMode:'RANDOM',
   }));
   const approved=await adminApproveMatchPlan.run(req({
     requestId:'approve-'+eventId,eventId,planId:planned.planId,
   }));
   assert.equal(approved.officialMatchIds.length,1);
   const [w,m]=[warmups.matchIds[0],approved.officialMatchIds[0]];
   for(const [act,id] of [['WARMUP',w],['MAIN',m]]){
     const match=db.get('matches/'+id);
     assert.equal(match.status,'READY');
     assert.equal(match.format,'ONE_V_ONE');
     assert.equal(match.scoringSnapshot.rules.act,act);
     assert.equal(match.participants.length,2);
     assert.deepEqual(match.participants.map(p=>p.playerId).sort(),players);
     assert.equal(match.seriesRule.maxGames,1);
     assert.equal(db.get('events/'+eventId+'/scoringSlots/'+act+'_alice').matchId,id);
     assert.equal(db.get('events/'+eventId+'/scoringSlots/'+act+'_beren').matchId,id);
     const observedNames=act==='WARMUP'?['Original Red','Original Blue']:['Original Fox','Original Bear'];
     const binding=observedNames.map((sourceName,i)=>({sourceName,playerId:players[i]}));
     await adminBindReplayParticipants.run(req({matchId:id,gameId:'G1',bindings:binding,
       reason:'Test-only identity binding from two independently verified original Game slots.'}));
     const game=db.get('matches/'+id+'/games/G1');
     assert.deepEqual(game.replayParticipantBindings.map(x=>x.playerId),players);
     assert.equal(game.activeReplayStatisticsId,undefined);
     claimed.push(id);
     await assert.rejects(adminBindReplayParticipants.run(req({
       matchId:id,gameId:'G1',bindings:[binding[0],{sourceName:'Fake third participant',playerId:'operator'}],
       reason:'Attempt to attach an unapproved source player.'})),/approved Game starters/);
     await assert.rejects(adminBindReplayParticipants.run(req({
       matchId:id,gameId:'G1',bindings:[binding[0],{sourceName:'original red',playerId:'beren'}],
       reason:'Attempt to bind duplicate normalized source names.'})),/Names and starters must be unique|approved Game starters/);
   }
 }
 assert.equal(new Set(claimed).size,4);
 assert.equal(db.get('events/event-one').officialMatchIds.length,1);
 assert.equal(db.get('events/event-two').officialMatchIds.length,1);
 assert.equal(db.get('events/event-one').warmupMatchIds.length,1);
 assert.equal(db.get('events/event-two').warmupMatchIds.length,1);
 const original=db.get('matches/'+claimed[0]+'/games/G1');
 db.set('matches/'+claimed[0]+'/games/G1',{...original,activeReplayStatisticsId:'f'.repeat(64)});
 await assert.rejects(adminBindReplayParticipants.run(req({
   matchId:claimed[0],gameId:'G1',bindings:[
     {sourceName:'Different Red',playerId:'alice'},{sourceName:'Different Blue',playerId:'beren'}],
   reason:'Attempt to rewrite a Game identity after recording acceptance.'})),/before its first recording/);
});
