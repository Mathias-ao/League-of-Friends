import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {PreviewLeagueRepository} from '../src/data/PreviewLeagueRepository';
import {EventDetails} from '../src/ui/EventDetails';
import {MatchDialog} from '../src/ui/Views';

async function setup(){
 const dom=new JSDOM('<div id="app"></div>',{url:'http://localhost/'});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=await import('react-dom/client');const root=createRoot(document.getElementById('app')!);
 const repository=new PreviewLeagueRepository();await repository.signIn();await repository.requestMembership('Reviewer','','K7M4Q9');await repository.enterSeason();
 const props={repository,snapshot:await repository.load(),preview:false,busy:false,openEvent:()=>{},openMatch:()=>{},openPlayer:()=>{},navigate:()=>{},enter:()=>{},act:async(action:()=>Promise<unknown>)=>{await action();return true;},onUpdated:()=>{}};
 const close=async()=>{await act(async()=>root.unmount());dom.window.close();};
 return {dom,root,repository,props,close};
}

test('hero campaign briefing opens as Chronicle parchment and Escape restores the trigger',async()=>{
 const {dom,root,repository,props,close}=await setup();
 let propagatedCancel=0;const cancel=()=>propagatedCancel++;document.addEventListener('cancel',cancel);
 try{
  await act(async()=>root.render(React.createElement(EventDetails,{...props,data:await repository.event('E001')})));
  assert.equal(document.querySelector('.event-story'),null,'the story is no longer below the Event content');
  const trigger=document.querySelector('.event-briefing-hero .event-campaign-trigger') as HTMLButtonElement;assert.ok(trigger);trigger.focus();
  await act(async()=>trigger.click());
  const dialog=document.querySelector('.event-campaign-dialog') as HTMLDialogElement;
  assert.ok(dialog.open);assert.ok(dialog.querySelector('.chronicle-parchment'));
  assert.equal(dialog.parentElement,document.body,'the popup is outside the parent Event dialog');
  assert.ok(dialog.querySelectorAll('.event-campaign-prose p').length>=4);
  await act(async()=>dialog.dispatchEvent(new dom.window.Event('cancel',{bubbles:true,cancelable:true})));
  assert.equal(document.querySelector('.event-campaign-dialog'),null);
  assert.equal(propagatedCancel,0,'Escape does not cancel the underlying Event');
  assert.equal(document.activeElement,trigger);
  await act(async()=>trigger.click());
  await act(async()=>{(document.querySelector('[aria-label="Close campaign briefing"]') as HTMLButtonElement).click();});
  assert.equal(document.querySelector('.event-campaign-dialog'),null);
 }finally{document.removeEventListener('cancel',cancel);await close();}
});

test('check-in saves through the repository, refreshes the viewer and updates the muster',async()=>{
 const {root,repository,props,close}=await setup();let updates=0;
 await repository.rsvp('E001','YES');
 const refreshedProps={...props,snapshot:await repository.load(),preview:true,onUpdated:()=>{updates++;}};
 try{
  await act(async()=>root.render(React.createElement(EventDetails,{...refreshedProps,data:await repository.event('E001')})));
  const checkIn=[...document.querySelectorAll('button')].find(b=>b.textContent?.includes('Check in now'))!;assert.ok(checkIn);
  await act(async()=>checkIn.click());
  assert.equal(updates,1);const detail=await repository.event('E001');assert.equal(detail.viewer.attendanceStatus,'CHECKED_IN');
  await act(async()=>root.render(React.createElement(EventDetails,{...refreshedProps,data:detail})));
  assert.match(document.querySelector('.event-player-orders')?.textContent??'',/Your banner is present/);
  assert.match(document.querySelector('.event-muster .event-section-heading')?.textContent??'',/1 checked in/);
  assert.ok(![...document.querySelectorAll('button')].some(b=>b.textContent?.includes('Check in now')));
 }finally{await close();}
});

test('a mounted Event follows its check-in boundaries and a failed request leaves attendance unchanged',async()=>{
 const {dom,root,repository,props,close}=await setup();const clock=Date.now,base=clock();let updates=0,error='';
 await repository.rsvp('E001','YES');const detail=await repository.event('E001');
 const scheduled={...detail,event:{...detail.event,checkInOpensAt:new Date(base+60000).toISOString(),checkInClosesAt:new Date(base+120000).toISOString()}};
 const checkIn=()=>[...document.querySelectorAll('button')].find(b=>b.textContent?.includes('Check in now'));
 repository.checkIn=async()=>{throw new Error('Check-in has closed.');};
 const scheduledProps={...props,onUpdated:()=>{updates++;},act:async(action:()=>Promise<unknown>)=>{try{await action();return true;}catch(e){error=(e as Error).message;return false;}}};
 try{
  await act(async()=>root.render(React.createElement(EventDetails,{...scheduledProps,data:scheduled})));
  assert.equal(checkIn(),undefined);
  Date.now=()=>base+60000;
  await act(async()=>document.dispatchEvent(new dom.window.Event('visibilitychange')));
  assert.ok(checkIn(),'check-in opens without closing and reopening the Event');
  await act(async()=>checkIn()!.click());
  assert.equal(error,'Check-in has closed.');assert.equal(updates,0);
  assert.equal((await repository.event('E001')).viewer.attendanceStatus,'NOT_CHECKED');
  Date.now=()=>base+120000;
  await act(async()=>document.dispatchEvent(new dom.window.Event('visibilitychange')));
  assert.equal(checkIn(),undefined,'check-in closes at its exact boundary');
  assert.match(document.querySelector('.event-player-orders')?.textContent??'',/Check-in has closed/);
 }finally{Date.now=clock;await close();}
});

test('scheduled warm-ups keep details readable while play orders and uploads await opening',async()=>{
 const {root,repository,props,close}=await setup();const clock=Date.now,base=clock();
 const original=await repository.match('sample-duel');
 const detail={...original,match:{...original.match,status:'READY',scoringAct:'WARMUP',playOpensAt:new Date(base+60000).toISOString(),playClosesAt:new Date(base+7*86400000).toISOString()},games:original.games.map(game=>({...game,status:'READY',result:null}))};
 try{
  await act(async()=>root.render(React.createElement(MatchDialog,{...props,data:detail})));
  assert.match(document.querySelector('.battle-orders-issued')?.textContent??'',/play window has not opened/);
  assert.equal((document.querySelector('.battle-orders-issued .primary') as HTMLButtonElement).disabled,true);
  assert.equal((document.querySelector('input[type=file]') as HTMLInputElement).disabled,true);
  Date.now=()=>base+60000;
  await act(async()=>window.dispatchEvent(new window.Event('focus')));
  assert.equal((document.querySelector('.battle-orders-issued .primary') as HTMLButtonElement).disabled,false);
  assert.equal((document.querySelector('input[type=file]') as HTMLInputElement).disabled,false);
 }finally{Date.now=clock;await close();}
});
