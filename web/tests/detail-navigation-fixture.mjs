import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import assert from 'node:assert/strict';
import {PreviewLeagueRepository} from '../src/data/PreviewLeagueRepository.ts';
import {App} from '../src/ui/App.tsx';
import {DetailDialog} from '../src/ui/DetailDialog.tsx';
import {detailRequests} from '../src/ui/detailNavigation.ts';

/** Controlled latency/identity fixture, never a hosted/source-method witness. */
export async function navigationFixture({app=true,kind='event',split=true,scale=5,Component=App,privateReads=false,summaryStatus}={}){
 const backend=new PreviewLeagueRepository();await backend.signIn();await backend.requestMembership('Navigator','','K7M4Q9');await backend.enterSeason();
 let snapshot=await backend.load(),uid='firebase-owner';
 const eventId=snapshot.events[0].eventId,matchId=snapshot.matches[0].matchId,owner=snapshot.viewer.playerId;
 const event=await backend.event(eventId),match=await backend.match(matchId),profile=await backend.player(owner);
 snapshot={...snapshot,matches:Array.from({length:scale},(_,i)=>i===0?snapshot.matches[0]:{
  ...snapshot.matches[0],matchId:'scaled-battle-'+i,eventId:i%2?eventId:'older-event',seasonId:i%2?'S001':'S000'})};
 if(summaryStatus)snapshot={...snapshot,matches:snapshot.matches.map(match=>({...match,status:summaryStatus,result:null,completedAt:null}))};
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/#'+({event:'events',match:'battles',player:'players'}[kind]),pretendToBeVisual:true});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,location:dom.window.location,history:dom.window.history,
  HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true,requestAnimationFrame:fn=>{fn(0);return 1;},
  cancelAnimationFrame:()=>{},matchMedia:()=>({matches:true}),scrollTo:()=>{},
  ResizeObserver:class {observe(){}unobserve(){}disconnect(){}},
  MutationObserver:dom.window.MutationObserver,
  addEventListener:dom.window.addEventListener.bind(dom.window),removeEventListener:dom.window.removeEventListener.bind(dom.window)});
 dom.window.HTMLElement.prototype.scrollIntoView=()=>{};
 dom.window.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const calls=[],listeners=new Set();let loads=0;
 const read=(kind,id)=>new Promise((resolve,reject)=>calls.push({kind,id,resolve,reject}));
 const repository=Object.create(backend);
 Object.defineProperty(repository,'mode',{value:'live'});
 Object.assign(repository,{load:async()=>{loads++;return structuredClone(snapshot);},currentAuthUid:()=>uid,
  onAuthChange:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},
  event:id=>read('full-event',id),match:id=>read('match',id),player:id=>read('player',id),
  statisticsExperience:scope=>read('statistics',scope.matchId),
  canReadMyPersonalityHistory:()=>privateReads,myPersonalityHistory:()=>read('personality',owner),
  canReadMyHostedSocialProgression:()=>privateReads,myHostedSocialProgression:()=>read('social',owner)});
 if(split){repository.eventEssential=id=>read('essential',id);repository.eventRoundoff=id=>read('roundoff',id);}
 let selection={type:kind,id:kind==='event'?eventId:kind==='match'?matchId:owner,request:1};
 const requests=detailRequests(),root=createRoot(document.getElementById('root'));
 const render=async()=>act(async()=>root.render(app?React.createElement(Component,{repository}):
  React.createElement(DetailDialog,{key:selection.type+':'+selection.id,repository,snapshot,preview:false,busy:false,
   selection,requests,authUid:'firebase-owner',onClose:()=>root.render(null),act:async()=>true,enter:()=>{},navigate:()=>{},
   openEvent:id=>{selection={type:'event',id,request:selection.request+1};void render();},
   openMatch:id=>{selection={type:'match',id,request:selection.request+1};void render();},
   openPlayer:id=>{selection={type:'player',id,request:selection.request+1};void render();}})));
 await render();
 const click=async selector=>{const button=document.querySelector(selector);assert.ok(button,selector);await act(async()=>button.click());};
 return {root,repository,calls,event,match,profile,eventId,matchId,owner,dom,loads:()=>loads,
  snapshot:()=>snapshot,body:()=>document.body.textContent,render,
  async open(){await click(kind==='event'?'.event-list-card button':kind==='match'?'.battle-row':'.portrait-card');},click,
  async select(type,id=selection.id){selection={type,id,request:selection.request+1};await render();},
  async complete(kind,value,index=0){const call=calls.filter(c=>c.kind===kind)[index];assert.ok(call,kind+' request');await act(async()=>call.resolve(value));},
  async fail(kind,error=new Error('Controlled offline failure'),index=0){const call=calls.filter(c=>c.kind===kind)[index];assert.ok(call,kind+' request');await act(async()=>call.reject(error));},
  async change(update){snapshot=update(structuredClone(snapshot));await render();},
  async auth(nextUid,notify=true){await act(async()=>{uid=nextUid;if(notify)for(const fn of [...listeners])fn();});},
  async close(){await act(async()=>root.unmount());requests.clear();dom.window.close();}};
}
