import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {JSDOM} from 'jsdom';
import {EventLifecycle,AIWarmupReview,LateWarmupReview} from '../src/ui/EventLifecycle';
import {EventDetails} from '../src/ui/EventDetails';
const base:any={data:{event:{eventId:'e',status:'PUBLISHED'},viewer:{playerId:'p',role:'PLAYER'},matches:[],warmup:{configured:true,map:'Arabia',aiDifficulty:'Hard',guestAcceptanceDeadlineAt:'2026-10-20T18:00:00Z',schedule:{status:'GUEST_PENDING',unpairedPlayerId:'p'},isGuest:false,eligibleGuests:[{playerId:'guest',steamName:'Guest'}],challenges:[]}},repository:{challengeGuest:async()=>{},respondGuest:async()=>{}},busy:false,preview:false,act:async()=>true,onUpdated:()=>{}};
test('unpaired players see announced fallback and eligible guest options, without admin controls',()=>{
 const html=renderToStaticMarkup(React.createElement(EventLifecycle,base));assert.match(html,/Challenge guest/);assert.match(html,/Hard/);assert.match(html,/Guest/);assert.doesNotMatch(html,/Finalise Event|Configure automatic/);
});
test('guest invitations expose acceptance without implying main-event registration',()=>{
 const data={...base.data,viewer:{playerId:'guest',role:'PLAYER'},warmup:{...base.data.warmup,isGuest:true,challenges:[{challengeId:'p_guest',challengerPlayerId:'p',guestPlayerId:'guest',status:'PENDING',deadlineAt:'2026-10-20T18:00:00Z'}]}};
 const html=renderToStaticMarkup(React.createElement(EventLifecycle,{...base,data}));assert.match(html,/Accept warm-up/);assert.match(html,/Main-event signup remains separate/);assert.doesNotMatch(html,/Choose your guest/);
});
test('Emperor closure is disabled until blockers resolve, and preview cannot mutate state',()=>{
 const data={...base.data,viewer:{playerId:'admin',role:'ADMIN'},finalisation:{canFinalise:false,revision:0,blockers:[{kind:'DISPUTE',message:'Resolve the result dispute.'}]}};
 const dom=new JSDOM(renderToStaticMarkup(React.createElement(EventLifecycle,{...base,data,repository:{finaliseEvent:async()=>{}}})));
 const button=[...dom.window.document.querySelectorAll('button')].find(b=>b.textContent==='Finalise Event');assert.ok(button);assert.equal(button.disabled,true);assert.match(dom.window.document.body.textContent!,/Resolve the result dispute/);
 assert.equal(renderToStaticMarkup(React.createElement(EventLifecycle,{...base,data,preview:true})), '');
});
test('AI review requires explicit settings/deadline verification and does not show a victory reward',()=>{
 const data:any={match:{matchId:'ai',status:'READY',opponentKind:'AI',aiOpponent:{difficulty:'Hard'}},viewer:{isParticipant:true},games:[{gameId:'G1',replay:{statisticsId:'a'.repeat(64)}}]};
 const dom=new JSDOM(renderToStaticMarkup(React.createElement(AIWarmupReview,{data,gameId:'G1',repository:{verifyAIWarmup:async()=>{}} as any,admin:true,onUpdated:()=>{}})));
 assert.match(dom.window.document.body.textContent!,/One participation point/);assert.match(dom.window.document.body.textContent!,/No victory bonus/);assert.equal(dom.window.document.querySelector('button')!.disabled,true);
});

test('late result review names the claimed winners and requires recording-backed timing verification',()=>{
 const data:any={match:{matchId:'w'},games:[{gameId:'G1',players:[{playerId:'p',steamName:'Halvar',team:1}],replay:{statisticsId:'a'.repeat(64)},timingReviewRequests:[{submissionId:'p',submittedBy:{steamName:'Halvar'},outcome:{type:'WIN',winnerTeam:1}}]}]};
 const dom=new JSDOM(renderToStaticMarkup(React.createElement(LateWarmupReview,{data,gameId:'G1',repository:{reviewLateWarmup:async()=>{}} as any,onUpdated:()=>{}})));
 assert.match(dom.window.document.body.textContent!,/Claim by Halvar: Halvar/);assert.doesNotMatch(dom.window.document.body.textContent!,/winnerTeam/);assert.equal(dom.window.document.querySelector('button')!.disabled,true);
});

test('main teams can be formed after check-in despite existing warm-ups; earlier formation stays disabled',()=>{
 const now=Date.now();
 const data:any={...base.data,event:{eventId:'e',title:'Test Event',status:'ACTIVE',competitionStyle:'BIG_TEAM',startsAt:new Date(now-1000).toISOString(),checkInClosesAt:new Date(now-1000).toISOString()},viewer:{playerId:'admin',role:'ADMIN',rsvp:'YES',signupState:'CONFIRMED',attendanceStatus:'CHECKED_IN'},signup:{confirmedCount:2,waitingListCount:0,rosterVisible:true,confirmed:[{playerId:'p',steamName:'P',attendanceStatus:'CHECKED_IN'},{playerId:'q',steamName:'Q',attendanceStatus:'CHECKED_IN'}]},matches:[{matchId:'w',status:'READY',scoringAct:'WARMUP',format:'ONE_V_ONE',participants:[]}]};
 const props:any={...base,data,snapshot:{viewer:{playerId:'admin',role:'ADMIN'},membership:'ACTIVE',enteredSeason:true,events:[]},enter:()=>{},openMatch:()=>{}};
 const button=(d:any)=>[...new JSDOM(renderToStaticMarkup(React.createElement(EventDetails,{...props,data:d}))).window.document.querySelectorAll('button')].find(b=>b.textContent==='Form main Battles');
 assert.equal(button(data)?.disabled,false);
 assert.equal(button({...data,event:{...data.event,checkInClosesAt:new Date(now+60000).toISOString()}})?.disabled,true);
});
