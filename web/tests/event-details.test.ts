import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {PreviewLeagueRepository} from '../src/data/PreviewLeagueRepository';
import {eventDesignPreview} from '../src/data/eventDesignPreview';
import {EventDialogWithStatistics} from '../src/ui/StatisticsExperience';
import {hasReleasedRoundoff} from '../src/ui/EventDetails';

test('Event details retain all pairings, personal navigation and an explicit release boundary',async()=>{
 const dom=new JSDOM('<div id="app"></div>',{url:'http://localhost/'});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=await import('react-dom/client');
 const root=createRoot(document.getElementById('app')!);
 const repo=new PreviewLeagueRepository();
 await repo.signIn();await repo.requestMembership('Reviewer','','K7M4Q9');await repo.enterSeason();
 const snapshot=await repo.load(),original=await repo.event('E001'),visited:string[]=[];
 let aggregateFetches=0;
 repo.statisticsExperience=async()=>{aggregateFetches++;throw new Error('Unexpected Event aggregate request');};
 const props={repository:repo,snapshot,preview:false,busy:false,openEvent:()=>{},openMatch:(id:string)=>visited.push(id),openPlayer:()=>{},act:async()=>true,enter:()=>{},navigate:()=>{},onUpdated:()=>{}};
 const click=async(selector:string)=>{const button=document.querySelector(selector) as HTMLButtonElement;assert.ok(button,selector);await act(async()=>button.click());};
 try{
  const preparing=eventDesignPreview(original,snapshot,'preparing');
  await act(async()=>root.render(React.createElement(EventDialogWithStatistics,{...props,data:preparing})));
  assert.equal(document.querySelector('.event-design-controls'),null,'live data cannot select synthetic states');
  await click('[role="tab"]:nth-child(2)');
  assert.equal(document.querySelectorAll('.event-pairing').length,4);
  assert.equal(document.querySelectorAll('.event-pairing.is-yours').length,1);
  assert.equal(document.querySelectorAll('.event-main-match').length,1);
  await click('.event-pairing.is-yours');assert.equal(visited.pop(),'E001-design-W1');
  await click('.event-main-match button');assert.equal(visited.pop(),'E001-design-M1');
  await click('[role="tab"]:nth-child(3)');
  assert.equal(document.querySelector('.event-points'),null,'completed play alone does not release points');
  assert.ok(document.querySelector('.event-roundoff-outline'));
  assert.equal(aggregateFetches,0,'opening Event details never eagerly loads cumulative Event statistics');

  const released=eventDesignPreview(original,snapshot,'released');
  await act(async()=>root.render(React.createElement(EventDialogWithStatistics,{...props,data:released})));
  assert.equal(document.querySelectorAll('.event-points tbody tr').length,8);
  assert.equal(document.querySelector('.event-points tr.is-yours td:last-child')?.textContent,'13');
  assert.equal(document.querySelectorAll('.event-showcase-grid article').length,5);
  assert.equal(document.querySelector('.event-roundoff-happenings'),null);
  assert.ok(document.querySelector('.event-showcase-value')?.textContent?.includes('2 wins'));
  assert.ok(!document.querySelector('.event-showcase')?.textContent?.includes('FROM THE EVENT'));
  await click('.event-showcase-sources button');assert.equal(visited.pop(),'E001-design-M1');
  assert.equal(hasReleasedRoundoff({...released,roundoff:{...released.roundoff!,revision:2}}),false);
  assert.equal(hasReleasedRoundoff({...released,event:{...released.event,resultsRelease:{state:'READY',revision:1}}}),false);
  await act(async()=>root.render(React.createElement(EventDialogWithStatistics,{...props,data:{...released,roundoff:{...released.roundoff!,showcase:undefined}}})));
  assert.ok(document.querySelector('.event-points'),'legacy released points remain readable');
  assert.match(document.querySelector('.event-showcase')!.textContent!,/not yet been included/);
  await act(async()=>root.render(React.createElement(EventDialogWithStatistics,{...props,data:{...released,roundoff:{...released.roundoff!,showcase:[]}}})));
  assert.match(document.querySelector('.event-showcase')!.textContent!,/No notable performances have qualified/);
  await act(async()=>root.render(React.createElement(EventDialogWithStatistics,{...props,data:{...released,roundoff:{...released.roundoff!,revision:2}}})));
  assert.equal(document.querySelector('.event-points'),null,'stale roundoff revisions stay closed');

  await click('[role="tab"]:nth-child(1)');
  const briefingTab=document.querySelector('[role="tab"]') as HTMLButtonElement;
  await act(async()=>briefingTab.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})));
  assert.equal(document.querySelector('[role="tab"][aria-selected=true]')?.textContent,'Battles5');
  assert.equal(document.activeElement,document.querySelector('[role="tab"]:nth-child(2)'));

  const observer={...preparing,viewer:{...preparing.viewer,playerId:'unrelated-player'}};
  await act(async()=>root.render(React.createElement(EventDialogWithStatistics,{...props,data:observer})));
  await click('[role="tab"]:nth-child(1)');
  assert.equal(document.querySelector('.event-personal-battles'),null,'an observer is never assigned another player’s duel');
  assert.equal(aggregateFetches,0);
 }finally{await act(async()=>root.unmount());dom.window.close();}
});

test('preview phase Battles resolve through the repository and preserve their displayed status',async()=>{
 const repo=new PreviewLeagueRepository();await repo.signIn();await repo.requestMembership('Reviewer','','K7M4Q9');
 const snapshot=await repo.load(),original=await repo.event('E001');
 for(const event of snapshot.events){const detail=await repo.event(event.eventId);assert.equal(detail.signup.confirmedCount,detail.signup.confirmed?.length,'preview muster counts match the visible roster');}
 for(const state of ['pairings','main','preparing','released'] as const){
  repo.setEventDesignState('E001',state);
  const detail=eventDesignPreview(original,snapshot,state);
  for(const match of detail.matches){const opened=await repo.match(match.matchId);assert.equal(opened.match.status,match.status);assert.equal(opened.match.participants.length,match.participants.length);}
  if(state==='released')for(const item of detail.roundoff!.showcase!){for(const source of item.sources){if(!source.gameId)continue;const dataset=await repo.statisticsExperience({matchId:source.matchId});assert.equal(dataset.games.length,1);assert.equal(dataset.games[0].sourceHash,source.sourceHash);assert.equal(dataset.games[0].revision,source.revision);assert.ok(dataset.games[0].players.some(p=>item.playerIds.includes(p.playerId)));}}
 }
 repo.setEventDesignState('E001','current');
 await assert.rejects(repo.match('E001-design-M1'),/Battle not found/);
});

test('participation actions continue through the existing service and refresh the Event',async()=>{
 const dom=new JSDOM('<div id="app"></div>',{url:'http://localhost/'});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=await import('react-dom/client');const root=createRoot(document.getElementById('app')!);
 const repo=new PreviewLeagueRepository();await repo.signIn();await repo.requestMembership('Reviewer','','K7M4Q9');await repo.enterSeason();
 let updates=0;const snapshot=await repo.load();
 const props={repository:repo,snapshot,preview:true,busy:false,openEvent:()=>{},openMatch:()=>{},openPlayer:()=>{},act:async(action:()=>Promise<unknown>)=>{await action();return true;},enter:()=>{},navigate:()=>{},onUpdated:()=>{updates++;}};
 try{
  await act(async()=>root.render(React.createElement(EventDialogWithStatistics,{...props,data:await repo.event('E001')})));
  await act(async()=>{(document.querySelector('.event-order-actions .primary') as HTMLButtonElement).click();});
  assert.equal((await repo.event('E001')).viewer.rsvp,'YES');assert.equal(updates,1);
  await act(async()=>root.render(React.createElement(EventDialogWithStatistics,{...props,snapshot:await repo.load(),data:await repo.event('E001')})));
  await act(async()=>{(document.querySelector('.event-order-actions .text-button') as HTMLButtonElement).click();});
  assert.equal((await repo.event('E001')).viewer.rsvp,'NO');assert.equal(updates,2);
 }finally{await act(async()=>root.unmount());dom.window.close();}
});
