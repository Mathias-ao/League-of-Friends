import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {currentEventAssignments,eventParticipation,publishedGameRules,type PlaqueEvent} from '../src/domain/eventPlaque';
import {emptySnapshot,type MatchRecord} from '../src/domain/league';
import {PreviewLeagueRepository} from '../src/data/PreviewLeagueRepository';
import {SeasonView} from '../src/ui/Views';

const player={playerId:'you',steamName:'Your banner'};
const event:PlaqueEvent={eventId:'e',title:'Lombardia custom',status:'PUBLISHED',startsAt:'2099-10-09T18:00:00Z',competitionStyle:'FFA',warmupEnabled:true,viewer:{rsvp:'YES',signupState:'CONFIRMED',attendanceStatus:'NOT_CHECKED'}};
const match=(matchId:string,status='READY',scoringAct='WARMUP'):MatchRecord=>({matchId,eventId:'e',format:'ONE_V_ONE',status,scoringAct,participants:[player,{playerId:matchId,steamName:matchId}]});
const config={maps:{pool:['Arena'],selectionMode:'ADMIN' as const},victory:{conquest:true,wonder:false,relic:false,customRuleCode:null},civilizations:{mode:'RANDOM' as const,allowed:[],banned:[],customRuleCode:null},diplomacyEnabled:false,additionalSettings:{}};

test('all current assignments remain visible; replaced, cancelled and other-player assignments do not',()=>{
  const matches=[{...match('old'),replacementMatchId:'new'},match('cancelled','CANCELLED'),match('void','VOID'),match('proposal','PROPOSED'),match('new'),match('guest'),match('done','COMPLETED'),match('main','READY','MAIN'),{...match('other'),participants:[]}];
  const current=currentEventAssignments(event,matches,'you');
  assert.deepEqual(current.warmups.map(m=>m.matchId),['new','guest','done']);
  assert.deepEqual(current.mains.map(m=>m.matchId),['main'],'explicit MAIN 1v1 is never a warm-up');
  assert.equal(currentEventAssignments({...event,warmupEnabled:false},matches,'you').warmups.length,0);
  assert.equal(currentEventAssignments({...event,warmupEnabled:undefined},matches,'you').warmups.length,3,'legacy Events retain their warm-ups');
});

test('participation requires a confirmed place and published rules do not infer rules from title',()=>{
  assert.equal(eventParticipation(event).kind,'confirmed');
  assert.equal(eventParticipation({...event,viewer:{...event.viewer!,signupState:'WAITING_LIST'}}).kind,'waiting');
  assert.equal(eventParticipation({...event,viewer:{...event.viewer!,signupState:'NONE'}}).kind,'unanswered');
  assert.equal(eventParticipation({...event,viewer:{...event.viewer!,rsvp:'NO'}}).kind,'declined');
  assert.equal(publishedGameRules(config),'Arena · Conquest · RANDOM civilizations');
  assert.doesNotMatch(publishedGameRules(undefined),/Standard Victory|30 minutes/);
});

test('plaque actions target every current assignment and keep warm-ups independent of main check-in',async()=>{
  const dom=new JSDOM('<main id="app"></main>',{url:'http://localhost'});
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
  const {createRoot}=await import('react-dom/client');const root=createRoot(document.getElementById('app')!);
  const repository=new PreviewLeagueRepository(),opened:string[]=[];
  const snapshot={...emptySnapshot(),membership:'ACTIVE' as const,viewer:player,enteredSeason:true,season:{seasonId:'s',name:'Season I',status:'ACTIVE'},events:[{...event,gameConfig:config,warmupGameConfig:config}],matches:[{...match('stale'),replacementMatchId:'new'},match('new'),match('guest'),match('completed','COMPLETED'),match('main','READY','MAIN')]};
  const props={snapshot,repository,preview:true,busy:false,openEvent:(id:string)=>opened.push(id),openMatch:(id:string)=>opened.push(id),openPlayer:()=>{},act:async()=>true,enter:()=>{},navigate:()=>{},onRules:()=>{}};
  try{
    await act(async()=>root.render(React.createElement(SeasonView,props)));
    const plaque=()=>document.querySelector('.next-event')!;
    assert.doesNotMatch(plaque().textContent??'',/stale|Approximately 30 minutes|Standard Victory|4v4/);
    assert.match(plaque().textContent??'',/Main event · Not checked in/);
    assert.match(plaque().textContent??'',/Completed/);
    assert.match(plaque().textContent??'',/Arena · Conquest/);
    for(const label of ['new','guest','completed']){
      const button=[...plaque().querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.startsWith(label));assert.ok(button);
      await act(async()=>button.click());
    }
    await act(async()=>[...plaque().querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.startsWith('Open current Battle'))!.click());
    await act(async()=>[...plaque().querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.startsWith('Event details'))!.click());
    assert.deepEqual(opened,['new','guest','completed','main','e']);
    const waiting={...snapshot,events:[{...snapshot.events[0],warmupEnabled:false,viewer:{...event.viewer!,signupState:'WAITING_LIST'}}]};
    await act(async()=>root.render(React.createElement(SeasonView,{...props,snapshot:waiting})));
    assert.doesNotMatch(plaque().textContent??'',/WARM-UP|You’re in/);
    assert.equal(plaque().querySelector('.confirmed'),null);
    assert.match(plaque().textContent??'',/Waiting list/);
    assert.ok(plaque().querySelector('.main-only'));
  }finally{await act(async()=>root.unmount());dom.window.close();}
});
