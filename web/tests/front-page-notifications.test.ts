import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {frontPageNotices} from '../src/domain/frontPageNotices';
import {emptySnapshot,type LeagueSnapshot,type EventRecord,type MatchRecord} from '../src/domain/league';
import {FrontPageNotifications} from '../src/ui/FrontPageNotifications';
import {PreviewLeagueRepository} from '../src/data/PreviewLeagueRepository';
const now=Date.parse('2026-10-09T18:00:00Z');
const player={playerId:'you',steamName:'Your banner'};
const event:EventRecord={eventId:'e',seasonId:'s',title:'The campaign',status:'PUBLISHED',startsAt:'2026-10-10T18:00:00Z',checkInOpensAt:'2026-10-09T17:00:00Z',checkInClosesAt:'2026-10-09T19:00:00Z',viewer:{rsvp:'YES',signupState:'CONFIRMED',attendanceStatus:'NOT_CHECKED'}};
const warmup:MatchRecord={matchId:'w',eventId:'e',seasonId:'s',scoringAct:'WARMUP',warmupScoringPolicy:'AOF_BEST_WARMUP_V1',format:'ONE_V_ONE',status:'READY',playOpensAt:'2026-10-03T18:00:00Z',playClosesAt:'2026-10-10T23:59:59Z',participants:[player,{playerId:'opponent',steamName:'Opponent'}]};
const base=():LeagueSnapshot=>({...emptySnapshot(),membership:'ACTIVE',viewer:player,enteredSeason:true,season:{seasonId:'s',name:'Season I',status:'ACTIVE'},events:[structuredClone(event)],matches:[structuredClone(warmup)]});

test('personal dispatches follow access, attendance and play windows without treating a main duel as a warm-up',()=>{
 const snapshot=base();
 assert.deepEqual(frontPageNotices(snapshot,now).map(n=>n.kind),['checkin','warmup']);
 assert.equal(frontPageNotices({...snapshot,membership:'SIGNED_OUT'},now).length,0);
 assert.equal(frontPageNotices({...snapshot,viewer:null},now).length,0);
 assert.deepEqual(frontPageNotices({...snapshot,enteredSeason:false},now).map(n=>n.kind),['season']);
 snapshot.events[0].viewer!.attendanceStatus='CHECKED_IN';
 assert.deepEqual(frontPageNotices(snapshot,now).map(n=>n.kind),['warmup','muster']);
 snapshot.events[0].officialMatchIds=['main'];
 snapshot.matches.push({...warmup,matchId:'main',scoringAct:'MAIN',draftRequired:true});
 assert.deepEqual(frontPageNotices(snapshot,now).map(n=>n.kind),['battle','warmup']);
 snapshot.matches[0].participants=[{playerId:'other',steamName:'Other'}];
 assert.deepEqual(frontPageNotices(snapshot,now).map(n=>n.kind),['battle']);
 snapshot.matches[1].playOpensAt='2026-10-10T18:00:00Z';
 assert.equal(frontPageNotices(snapshot,now).length,0);
 snapshot.matches[1].status='AWAITING_CONFIRMATION';
 snapshot.matches[1].playClosesAt='2026-10-08T18:00:00Z';
 assert.equal(frontPageNotices(snapshot,now)[0].title,'A result awaits resolution','evidence review remains visible after the play deadline');
 snapshot.events[0].status='CANCELLED';
 assert.equal(frontPageNotices(snapshot,now).length,0);
});

test('expired calls and check-ins disappear; approved matches end the muster without a clock closure gate',()=>{
 const snapshot=base();snapshot.matches=[];
 assert.equal(frontPageNotices(snapshot,Date.parse(event.checkInClosesAt!)).length,0);
 snapshot.events[0].viewer={rsvp:'UNANSWERED',signupState:'NONE',attendanceStatus:'NOT_CHECKED'};
 snapshot.events[0].signupDeadlineAt='2026-10-09T17:00:00Z';
 assert.equal(frontPageNotices(snapshot,now).length,0);
 snapshot.events[0].signupDeadlineAt='2026-10-09T19:00:00Z';
 assert.equal(frontPageNotices(snapshot,now)[0].kind,'signup');
 snapshot.events[0].officialMatchIds=['approved'];snapshot.events[0].viewer=event.viewer;
 assert.equal(frontPageNotices(snapshot,now).length,0);
});

test('flags open parchment before check-in, restore focus, and close when attendance resolves',async()=>{
 const dom=new JSDOM('<div id="app"></div>',{url:'http://localhost'});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=await import('react-dom/client');const root=createRoot(document.getElementById('app')!);
 const repository=new PreviewLeagueRepository();let checkins=0,fetches=0;
 repository.checkIn=async()=>{checkins++;};repository.event=async()=>{fetches++;throw new Error('Unnecessary request');};
 const snapshot=base();snapshot.events[0].checkInOpensAt='2020-01-01T00:00:00Z';snapshot.events[0].checkInClosesAt='2099-01-01T00:00:00Z';
 const props={snapshot,repository,busy:false,openEvent:()=>{},openMatch:()=>{},enter:()=>{},act:async(action:()=>Promise<void>)=>{await action();return true;}};
 try{
  await act(async()=>root.render(React.createElement(FrontPageNotifications,props)));
  const trigger=document.querySelector('[aria-label^="Answer muster"]') as HTMLButtonElement;trigger.focus();
  await act(async()=>trigger.click());
  assert.ok(document.querySelector('dialog[open]'));
  assert.equal(checkins,0,'opening a dispatch cannot perform check-in');
  await act(async()=>document.querySelector<HTMLButtonElement>('[aria-label="Close campaign note"]')!.click());
  assert.equal(document.activeElement,trigger);
  await act(async()=>trigger.click());
  await act(async()=>document.querySelector<HTMLButtonElement>('.event-warmup-open-battle')!.click());
  assert.equal(checkins,1);assert.equal(document.querySelector('dialog'),null);
  assert.equal(fetches,0,'ordinary dispatches do not fetch Event details');
  await act(async()=>trigger.click());
  const resolved={...snapshot,events:[{...snapshot.events[0],viewer:{...snapshot.events[0].viewer!,attendanceStatus:'CHECKED_IN'}}]};
  await act(async()=>root.render(React.createElement(FrontPageNotifications,{...props,snapshot:resolved})));
  assert.equal(document.querySelector('dialog'),null,'resolved actions close their note');
  await act(async()=>root.render(React.createElement(FrontPageNotifications,{...props,snapshot:{...resolved,membership:'SIGNED_OUT',viewer:null}})));
  assert.equal(document.querySelector('.frontpage-notifications'),null);
 }finally{await act(async()=>root.unmount());dom.window.close();}
});

test('only authenticated multiple-warm-up receipts become flags; stale requests cannot leak across accounts',async()=>{
 const dom=new JSDOM('<div id="app"></div>',{url:'http://localhost'});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=await import('react-dom/client');const root=createRoot(document.getElementById('app')!);
 const repository=new PreviewLeagueRepository(),snapshot=base();snapshot.matches.push({...warmup,matchId:'extra'});
 // Live directory omits the scoring policy; the authenticated Event receipt is authoritative.
 snapshot.matches=snapshot.matches.map(({warmupScoringPolicy,...match})=>match);
 let finish:(value:any)=>void=()=>{};
 repository.event=()=>new Promise(resolve=>{finish=resolve;});
 const props={snapshot,repository,busy:false,openEvent:()=>{},openMatch:()=>{},enter:()=>{},act:async()=>true};
 const detail={event,matches:snapshot.matches,viewer:{playerId:'you'},roundoff:{viewerWarmupSelection:{playerId:'you',matchId:'extra',points:3,win:true,otherWarmupCount:1,resultRevision:1,sourceHash:'validated'}}};
 try{
  await act(async()=>root.render(React.createElement(FrontPageNotifications,props)));
  await act(async()=>finish(detail));
  assert.ok(document.querySelector('.frontpage-counted-flag'));
  await act(async()=>document.querySelector<HTMLButtonElement>('.frontpage-counted-flag')!.click());
  assert.match(document.querySelector('dialog')!.textContent!,/Only one warm-up counts/);
  await act(async()=>document.querySelector<HTMLButtonElement>('[aria-label="Close counted warm-up note"]')!.click());
  await act(async()=>root.render(React.createElement(FrontPageNotifications,{...props,snapshot:{...snapshot}})));
  const previousFinish=finish;
  await act(async()=>root.render(React.createElement(FrontPageNotifications,{...props,snapshot:{...snapshot,viewer:{playerId:'stranger',steamName:'Another banner'}}})));
  await act(async()=>previousFinish(detail));
  assert.equal(document.querySelector('.frontpage-counted-flag'),null);
 }finally{await act(async()=>root.unmount());dom.window.close();}
});
