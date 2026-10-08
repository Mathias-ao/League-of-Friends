import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {JSDOM} from 'jsdom';
import {EventLifecycle,AIWarmupReview,LateWarmupReview} from '../src/ui/EventLifecycle';
import {EventDetails} from '../src/ui/EventDetails';
import {MainPairingControls,EmperorBattleControls} from '../src/ui/EmperorControls';
const base:any={data:{event:{eventId:'e',status:'PUBLISHED'},viewer:{playerId:'p',role:'PLAYER'},matches:[],warmup:{configured:true,map:'Arabia',aiDifficulty:'Hard',guestAcceptanceDeadlineAt:'2026-10-20T18:00:00Z',schedule:{status:'GUEST_PENDING',unpairedPlayerId:'p'},isGuest:false,eligibleGuests:[{playerId:'guest',steamName:'Guest'}],challenges:[]}},repository:{challengeGuest:async()=>{},respondGuest:async()=>{}},busy:false,preview:false,act:async()=>true,onUpdated:()=>{}};
test('unpaired players see the best warmup policy and eligible guest options, without admin controls',()=>{
 const html=renderToStaticMarkup(React.createElement(EventLifecycle,base));assert.match(html,/Challenge guest/);assert.match(html,/best warm-up/);assert.doesNotMatch(html,/AI fallback/);assert.match(html,/Guest/);assert.doesNotMatch(html,/Finalise Event|Configure automatic/);
});
test('guest invitations expose acceptance without implying main-event registration',()=>{
 const data={...base.data,viewer:{playerId:'guest',role:'PLAYER'},warmup:{...base.data.warmup,isGuest:true,challenges:[{challengeId:'p_guest',challengerPlayerId:'p',guestPlayerId:'guest',status:'PENDING',deadlineAt:'2026-10-20T18:00:00Z'}]}};
 const html=renderToStaticMarkup(React.createElement(EventLifecycle,{...base,data}));assert.match(html,/Accept warm-up/);assert.match(html,/Main-event signup remains separate/);assert.doesNotMatch(html,/Choose your guest/);
});
test('Emperor closure is disabled until blockers resolve, and preview cannot mutate state',()=>{
 const data={...base.data,viewer:{playerId:'admin',role:'ADMIN'},finalisation:{canFinalise:false,revision:0,blockers:[{kind:'DISPUTE',message:'Resolve the result dispute.'}]}};
 const dom=new JSDOM(renderToStaticMarkup(React.createElement(EventLifecycle,{...base,data,showClosure:true,repository:{finaliseEvent:async()=>{}}})));
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

test('main teams can be formed once everyone checks in; missing check-in requires an Emperor force draw',()=>{
 const now=Date.now();
 const data:any={...base.data,event:{eventId:'e',title:'Test Event',status:'ACTIVE',competitionStyle:'BIG_TEAM',startsAt:new Date(now-1000).toISOString(),checkInClosesAt:new Date(now-1000).toISOString()},viewer:{playerId:'admin',role:'ADMIN',rsvp:'YES',signupState:'CONFIRMED',attendanceStatus:'CHECKED_IN'},signup:{confirmedCount:2,waitingListCount:0,rosterVisible:true,confirmed:[{playerId:'p',steamName:'P',attendanceStatus:'CHECKED_IN'},{playerId:'q',steamName:'Q',attendanceStatus:'CHECKED_IN'}]},matches:[{matchId:'w',status:'READY',scoringAct:'WARMUP',format:'ONE_V_ONE',participants:[]}]};
 const props:any={...base,data,snapshot:{viewer:{playerId:'admin',role:'ADMIN'},membership:'ACTIVE',enteredSeason:true,events:[]},enter:()=>{},openMatch:()=>{}};
 const button=(d:any)=>[...new JSDOM(renderToStaticMarkup(React.createElement(EventDetails,{...props,data:d}))).window.document.querySelectorAll('button')].find(b=>b.textContent==='Draw main Battles');
 assert.equal(button(data)?.disabled,false);
 assert.equal(button({...data,event:{...data.event,checkInClosesAt:new Date(now+60000).toISOString()}})?.disabled,false);
 assert.equal(button({...data,signup:{...data.signup,confirmedCount:3},event:{...data.event,checkInClosesAt:new Date(now+60000).toISOString()}})?.disabled,true);
});

test('missing check-in still requires explicit Emperor force after the window closes; force needs a reason',()=>{
 const now=Date.now(),data:any={...base.data,viewer:{role:'ADMIN'},event:{eventId:'e',checkInClosesAt:new Date(now-1000).toISOString()},signup:{confirmedCount:3,confirmed:[{playerId:'p',steamName:'P',attendanceStatus:'CHECKED_IN'},{playerId:'q',steamName:'Q',attendanceStatus:'CHECKED_IN'},{playerId:'r',steamName:'R',attendanceStatus:'NOT_CHECKED'}]}};
 const props:any={data,repository:{formEventMatches:async()=>{}},busy:false,act:async()=>true,onUpdated:()=>{}};
 const dom=new JSDOM(renderToStaticMarkup(React.createElement(MainPairingControls,props))),buttons=[...dom.window.document.querySelectorAll('button')];
 assert.equal(buttons.find(b=>b.textContent==='Draw main Battles')?.disabled,true);assert.equal(buttons.find(b=>b.textContent==='Force draw for checked-in players')?.disabled,true);
 assert.equal(renderToStaticMarkup(React.createElement(MainPairingControls,{...props,data:{...data,viewer:{role:'PLAYER'}}})), '');
});

test('Emperor sees the proposed sides before approval; recording acceptance starts disabled until reviewed',()=>{
 const data:any={...base.data,viewer:{role:'ADMIN'},event:{eventId:'e'},signup:{confirmedCount:2,confirmed:[{playerId:'p',steamName:'P',attendanceStatus:'CHECKED_IN'},{playerId:'q',steamName:'Q',attendanceStatus:'CHECKED_IN'}]},pairingPlan:{planId:'plan',status:'PROPOSED',pairingMode:'RANDOM',sittingOutPlayerIds:[],matches:[{format:'ONE_V_ONE',participants:[{playerId:'p',steamName:'P',team:1},{playerId:'q',steamName:'Q',team:2}]}]}};
 const html=renderToStaticMarkup(React.createElement(MainPairingControls,{data,repository:{formEventMatches:async()=>{},approveEventPairing:async()=>{}} as any,busy:false,act:async()=>true,onUpdated:()=>{}}));assert.match(html,/P · side 1/);assert.match(html,/Q · side 2/);assert.match(html,/Approve this draw/);
 const battle:any={match:{matchId:'m',format:'ONE_V_ONE',participants:[]},games:[{gameId:'G1',players:[{playerId:'p',steamName:'P',team:1},{playerId:'q',steamName:'Q',team:2}],replay:{statisticsId:'a'.repeat(64)},outcomeQualification:{state:'PENDING_ADMIN_REVIEW',reason:'This version needs review.'}}]};
 const dom=new JSDOM(renderToStaticMarkup(React.createElement(EmperorBattleControls,{data:battle,gameId:'G1',repository:{reviewRecordingResult:async()=>{}} as any,onUpdated:()=>{}})));
 assert.match(dom.window.document.body.textContent!,/This version needs review/);assert.equal([...dom.window.document.querySelectorAll('button')].find(b=>b.textContent==='Accept reviewed recording result')?.disabled,true);
});

test('Event closure controls appear only in Roundoff',()=>{
 const data:any={...base.data,viewer:{role:'ADMIN'},finalisation:{canFinalise:true,revision:0,blockers:[]}},props:any={...base,data,repository:{finaliseEvent:async()=>{}}};
 assert.doesNotMatch(renderToStaticMarkup(React.createElement(EventLifecycle,props)),/Finalise Event/);
 assert.match(renderToStaticMarkup(React.createElement(EventLifecycle,{...props,showClosure:true})),/Finalise Event/);
});
