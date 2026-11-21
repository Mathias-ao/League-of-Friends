import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {App} from '../src/ui/App';
import {startSeasonStandingsRefresh,SEASON_REFRESH_DELAYS_MS} from '../src/ui/seasonStandingsRefresh';
import type {LeagueRepository,LeagueSnapshot} from '../src/domain/league';

function clock(){
  let id=0,now=0;const timers=new Map<number,{callback:()=>void;delay:number}>();
  return {timers,now:()=>now,setNow:(n:number)=>{now=n;},
    setTimer:(callback:()=>void,delay:number)=>{timers.set(++id,{callback,delay});return id;},
    clearTimer:(key:unknown)=>{timers.delete(key as number);},
    async tick(){const [key,value]=timers.entries().next().value??[];
      assert.ok(value,'Expected bounded refresh timer');timers.delete(key);now+=value.delay;value.callback();
      await Promise.resolve();await Promise.resolve();},
  };
}
test('external updates get a bounded foreground reconciliation window, never perpetual polling',async()=>{
  const c=clock();let backend=0,visibleValue=0,reads=0;
  const refresh=startSeasonStandingsRefresh({refresh:async()=>{reads++;visibleValue=backend;},
    visible:()=>true,available:()=>true,...c});
  backend=18;await c.tick();assert.equal(visibleValue,18);
  for(let i=1;i<SEASON_REFRESH_DELAYS_MS.length;i++)await c.tick();
  assert.equal(reads,5);assert.equal(c.timers.size,0);
  backend=24;c.setNow(200000);refresh.wake();await Promise.resolve();await Promise.resolve();
  assert.equal(visibleValue,24,'returning to the view reconciles external corrections');
  refresh.stop();assert.equal(c.timers.size,0);
});
test('hidden/busy views do not load, duplicate focus cannot overlap reads, and cleanup prevents rescheduling',async()=>{
  const c=clock();let visible=true,busy=true,reads=0,release:(()=>void)|null=null;
  const refresh=startSeasonStandingsRefresh({visible:()=>visible,available:()=>!busy,...c,
    refresh:()=>{reads++;return new Promise<void>(resolve=>{release=resolve;});}});
  await c.tick();assert.equal(reads,0);
  busy=false;await c.tick();assert.equal(reads,1);
  refresh.wake();refresh.wake();assert.equal(reads,1);
  refresh.stop();release!();await Promise.resolve();await Promise.resolve();assert.equal(c.timers.size,0);
  visible=false;refresh.wake();assert.equal(reads,1);
});

const snapshot=(id='a',points=0):LeagueSnapshot=>({membership:'ACTIVE',enteredSeason:true,hasLeagueHistory:true,
  viewer:{playerId:id,steamName:id,role:'PLAYER'},season:{seasonId:'s',name:'Test Season',status:'ACTIVE'},
  emperor:{playerId:'emperor',steamName:'Emperor',role:'ADMIN',leaguePoints:0,wins:0,losses:0},
  standings:[{playerId:'a',steamName:'Alice',leaguePoints:points,wins:points?1:0,losses:0,rank:1},
    {playerId:'b',steamName:'Bob',leaguePoints:points?4:0,wins:0,losses:points?1:0,rank:points?2:1}],
  players:[],events:[],matches:[]});
async function mount(initial=snapshot()){
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/#season',pretendToBeVisual:true});
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,location:dom.window.location,history:dom.window.history,
    HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true,
    requestAnimationFrame:(fn:(time:number)=>void)=>{fn(0);return 1;},cancelAnimationFrame:()=>{},
    matchMedia:()=>({matches:true}),scrollTo:()=>{},
    addEventListener:dom.window.addEventListener.bind(dom.window),removeEventListener:dom.window.removeEventListener.bind(dom.window)});
  dom.window.HTMLElement.prototype.scrollIntoView=()=>{};
  const c=clock(),nativeTimer=globalThis.setTimeout,nativeClear=globalThis.clearTimeout;
  const owned=new Set<number>();
  globalThis.setTimeout=((callback:()=>void,ms:number,...args:unknown[])=>{
    if(SEASON_REFRESH_DELAYS_MS.includes(ms as any)){const id=c.setTimer(callback,ms);owned.add(id);return id;}
    return nativeTimer(callback,ms,...args);
  }) as typeof setTimeout;
  globalThis.clearTimeout=((id:unknown)=>{if(owned.has(id as number)){c.clearTimer(id);return;}nativeClear(id as any);}) as typeof clearTimeout;
  let latest=initial,calls=0,auth=()=>{},held:Promise<LeagueSnapshot>|null=null;
  const repository={mode:'live',load:async()=>{calls++;return held?held:structuredClone(latest);},player:async()=>null,enterSeason:async()=>{latest={...latest,enteredSeason:true};},
    onAuthChange:(fn:()=>void)=>{auth=fn;return()=>{};}} as unknown as LeagueRepository;
  const root=createRoot(document.getElementById('root')!);
  await act(async()=>{root.render(React.createElement(App,{repository}));await Promise.resolve();});
  return {c,dom,calls:()=>calls,set:(value:LeagueSnapshot)=>{latest=value;},auth:()=>auth(),
    hold:(value:Promise<LeagueSnapshot>|null)=>{held=value;},
    async click(text:string){const button=[...document.querySelectorAll('button')].find(b=>b.textContent===text);
      assert.ok(button,'Missing '+text);await act(async()=>button!.click());},
    async close(){await act(async()=>root.unmount());dom.window.close();globalThis.setTimeout=nativeTimer;globalThis.clearTimeout=nativeClear;}};
}
test('actual Season App renders an external async result update and manual refresh without browser reload',async()=>{
  const ui=await mount();try{
    assert.match(document.querySelector('tbody')!.textContent!,/0–0/);
    ui.set(snapshot('a',10));await act(async()=>{await ui.c.tick();});
    assert.match(document.querySelector('tbody')!.textContent!,/1–0/);
    assert.match(document.querySelector('tbody')!.textContent!,/AliceYOU1–010/);
    ui.set(snapshot('a',18));await ui.click('Refresh standings');
    assert.match(document.querySelector('tbody')!.textContent!,/AliceYOU1–018/);
    assert.equal(ui.calls(),3);
    const timersBefore=ui.c.timers.size;assert.ok(timersBefore>0);
  }finally{await ui.close();}
});
test('an old in-flight standings refresh cannot restore another account after Auth changes',async()=>{
  const ui=await mount();try{
    let resolveOld!:(value:LeagueSnapshot)=>void;
    ui.hold(new Promise(resolve=>{resolveOld=resolve;}));
    await act(async()=>{await ui.c.tick();});
    ui.hold(null);ui.set(snapshot('b',18));
    await act(async()=>{ui.auth();await Promise.resolve();});
    await act(async()=>{resolveOld(snapshot('a',99));await Promise.resolve();});
    assert.match(document.querySelector('tbody')!.textContent!,/BobYOU/);
    assert.doesNotMatch(document.querySelector('tbody')!.textContent!,/99/);
    assert.equal(ui.calls(),3);
  }finally{await ui.close();}
});

test('a successful action restarts a bounded async reconciliation window after the initial one expires',async()=>{
  const ui=await mount({...snapshot(),enteredSeason:false});try{
    for(let i=0;i<SEASON_REFRESH_DELAYS_MS.length;i++)await act(async()=>{await ui.c.tick();});
    assert.equal(ui.c.timers.size,0,'initial window is exhausted');
    await ui.click('Enter Season I');
    assert.ok(ui.c.timers.size>0,'successful action must allow its later asynchronous projection to reconcile');
    ui.set(snapshot('a',26));await act(async()=>{await ui.c.tick();});
    assert.match(document.querySelector('tbody')!.textContent!,/AliceYOU1–026/);
    for(let i=1;i<SEASON_REFRESH_DELAYS_MS.length;i++)await act(async()=>{await ui.c.tick();});
    assert.equal(ui.c.timers.size,0,'action restarts a bounded window, not perpetual polling');
  }finally{await ui.close();}
});
