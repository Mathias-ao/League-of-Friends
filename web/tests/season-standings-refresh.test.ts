import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {App,BOOTSTRAP_ABORT_RETRY_DELAYS_MS} from '../src/ui/App';
import {startSeasonStandingsRefresh,SEASON_REFRESH_DELAYS_MS} from '../src/ui/seasonStandingsRefresh';
import {emptySnapshot,type LeagueRepository,type LeagueSnapshot} from '../src/domain/league';

function clock(){
  let id=0,now=0;const timers=new Map<number,{callback:()=>void;delay:number}>();
  return {timers,now:()=>now,setNow:(n:number)=>{now=n;},
    setTimer:(callback:()=>void,delay:number)=>{timers.set(++id,{callback,delay});return id;},
    clearTimer:(key:unknown)=>{timers.delete(key as number);},
    async tick(delay?:number){const [key,value]=[...timers.entries()].find(([,timer])=>delay===undefined||timer.delay===delay)??[];
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
async function mount(initial=snapshot(),initialError:unknown=null){
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/#season',pretendToBeVisual:true});
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,location:dom.window.location,history:dom.window.history,
    HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true,
    requestAnimationFrame:(fn:(time:number)=>void)=>{fn(0);return 1;},cancelAnimationFrame:()=>{},
    matchMedia:()=>({matches:true}),scrollTo:()=>{},
    addEventListener:dom.window.addEventListener.bind(dom.window),removeEventListener:dom.window.removeEventListener.bind(dom.window)});
  dom.window.HTMLElement.prototype.scrollIntoView=()=>{};
  dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
  const c=clock(),nativeTimer=globalThis.setTimeout,nativeClear=globalThis.clearTimeout;
  const owned=new Set<number>();
  globalThis.setTimeout=((callback:()=>void,ms:number,...args:unknown[])=>{
    if([...SEASON_REFRESH_DELAYS_MS,...BOOTSTRAP_ABORT_RETRY_DELAYS_MS].includes(ms as any)){const id=c.setTimer(callback,ms);owned.add(id);return id;}
    return nativeTimer(callback,ms,...args);
  }) as typeof setTimeout;
  globalThis.clearTimeout=((id:unknown)=>{if(owned.has(id as number)){c.clearTimer(id);return;}nativeClear(id as any);}) as typeof clearTimeout;
  let latest=initial,calls=0,auth=()=>{},held:Promise<LeagueSnapshot>|null=null,failure=initialError;
  const repository={mode:'live',load:async()=>{calls++;if(failure)throw failure;return held?held:structuredClone(latest);},player:async()=>null,enterSeason:async()=>{latest={...latest,enteredSeason:true};},
    onAuthChange:(fn:()=>void)=>{auth=fn;return()=>{};}} as unknown as LeagueRepository;
  const root=createRoot(document.getElementById('root')!);
  await act(async()=>{root.render(React.createElement(App,{repository}));await Promise.resolve();});
  return {c,dom,calls:()=>calls,set:(value:LeagueSnapshot)=>{latest=value;},auth:()=>auth(),
    fail:(error:unknown)=>{failure=error;},
    hold:(value:Promise<LeagueSnapshot>|null)=>{held=value;},
    async click(text:string){const button=[...document.querySelectorAll('button')].find(b=>b.textContent===text);
      assert.ok(button,'Missing '+text);await act(async()=>button!.click());},
    async openAccount(){const button=document.querySelector<HTMLButtonElement>('button.profile-button');
      assert.ok(button,'Missing account button');await act(async()=>button.click());},
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

const revisionAbort={code:'functions/aborted',message:'Season results changed during the read. Retry.'};
const noSignInGate=()=>assert.doesNotMatch(document.body.textContent!,/Sign in with Steam/);
const alicePoints=(points:number)=>assert.match(document.querySelector('tbody')!.textContent!,new RegExp(`AliceYOU1–0${points}`));

test('a scheduled revision abort retains the member interface and trustworthy standings, then automatically recovers',async()=>{
  const ui=await mount(snapshot('a',10));try{
    await ui.openAccount();assert.ok(document.querySelector('.account-heading'),'account dialog is open');
    ui.fail(revisionAbort);await act(async()=>{await ui.c.tick();});
    noSignInGate();alicePoints(10);assert.ok(document.querySelector('.account-heading'),'a read race must not close the dialog');
    assert.equal(ui.calls(),2);assert.equal(ui.c.timers.size,1);
    await ui.click('Refresh standings');assert.equal(ui.calls(),2,'manual refresh shares the pending recovery');
    ui.fail(null);ui.set(snapshot('a',18));
    await act(async()=>{await ui.c.tick(BOOTSTRAP_ABORT_RETRY_DELAYS_MS[0]);});
    noSignInGate();alicePoints(18);assert.equal(ui.calls(),3);
    assert.ok(ui.c.timers.size>0,'the existing async refresh window continues');
  }finally{await ui.close();}
});

test('persistent aborts exhaust both retry and refresh budgets without signing out; manual Retry still recovers',async()=>{
  const ui=await mount(snapshot('a',10));try{
    ui.fail(revisionAbort);
    for(const delay of SEASON_REFRESH_DELAYS_MS){
      await act(async()=>{await ui.c.tick(delay);});
      for(const retryDelay of BOOTSTRAP_ABORT_RETRY_DELAYS_MS)await act(async()=>{await ui.c.tick(retryDelay);});
      noSignInGate();alicePoints(10);
      assert.match(document.querySelector('[role="alert"]')!.textContent!,/Retry to load the latest standings/);
    }
    assert.equal(ui.calls(),1+SEASON_REFRESH_DELAYS_MS.length*(1+BOOTSTRAP_ABORT_RETRY_DELAYS_MS.length));
    assert.equal(ui.c.timers.size,0,'persistent races cannot create perpetual retries');
    ui.fail(null);ui.set(snapshot('a',26));await ui.click('Retry');
    noSignInGate();alicePoints(26);assert.equal(document.querySelector('[role="alert"]'),null);
  }finally{await ui.close();}
});

test('an initial bootstrap abort automatically retries without a false sign-in gate or private snapshot',async()=>{
  const ui=await mount(snapshot('a',10),revisionAbort);try{
    noSignInGate();assert.equal(document.querySelector('tbody'),null);
    ui.fail(null);await act(async()=>{await ui.c.tick(BOOTSTRAP_ABORT_RETRY_DELAYS_MS[0]);});
    noSignInGate();alicePoints(10);assert.equal(ui.calls(),2);
  }finally{await ui.close();}
});

test('initial abort retry exhaustion offers recovery without claiming the player is signed out',async()=>{
  const ui=await mount(snapshot('a',10),revisionAbort);try{
    for(const delay of BOOTSTRAP_ABORT_RETRY_DELAYS_MS)await act(async()=>{await ui.c.tick(delay);});
    assert.equal(ui.calls(),1+BOOTSTRAP_ABORT_RETRY_DELAYS_MS.length);assert.equal(ui.c.timers.size,0);
    noSignInGate();assert.equal(document.querySelector('tbody'),null);
    assert.match(document.querySelector('[role="dialog"]')!.textContent!,/The league is updating/);
    ui.fail(null);await ui.click('Retry');noSignInGate();alicePoints(10);
  }finally{await ui.close();}
});

test('account switching cancels a queued retry and hides the old member until the new bootstrap resolves',async()=>{
  const ui=await mount(snapshot('a',10));try{
    ui.fail(revisionAbort);await act(async()=>{await ui.c.tick();});
    let resolveNew!:(value:LeagueSnapshot)=>void;
    ui.fail(null);ui.hold(new Promise(resolve=>{resolveNew=resolve;}));
    await act(async()=>{ui.auth();await Promise.resolve();});
    assert.equal(ui.c.timers.size,0,'the old account retry is cancelled');
    assert.equal(document.querySelector('tbody'),null);assert.doesNotMatch(document.body.textContent!,/Alice/);
    await act(async()=>{resolveNew(snapshot('b',18));await Promise.resolve();});
    assert.match(document.querySelector('tbody')!.textContent!,/BobYOU/);assert.equal(ui.calls(),3);
    assert.equal([...ui.c.timers.values()].some(t=>BOOTSTRAP_ABORT_RETRY_DELAYS_MS.includes(t.delay as any)),false);
  }finally{await ui.close();}
});

test('an old account abort arriving after the new account loads cannot change its UI or schedule retries',async()=>{
  const ui=await mount(snapshot('a',10));try{
    let rejectOld!:(error:unknown)=>void;
    ui.hold(new Promise((_,reject)=>{rejectOld=reject;}));await act(async()=>{await ui.c.tick();});
    ui.hold(null);ui.set(snapshot('b',18));await act(async()=>{ui.auth();await Promise.resolve();});
    const timersBefore=ui.c.timers.size;
    await act(async()=>{rejectOld(revisionAbort);await Promise.resolve();});
    assert.match(document.querySelector('tbody')!.textContent!,/BobYOU/);noSignInGate();
    assert.equal(ui.c.timers.size,timersBefore);assert.equal(document.querySelector('[role="alert"]'),null);
    assert.equal(ui.calls(),3);
  }finally{await ui.close();}
});

test('logout cancels abort recovery and clears the private member interface',async()=>{
  const ui=await mount(snapshot('a',10));try{
    await ui.openAccount();ui.fail(revisionAbort);await act(async()=>{await ui.c.tick();});
    ui.fail(null);ui.set(emptySnapshot());await act(async()=>{ui.auth();await Promise.resolve();});
    assert.match(document.body.textContent!,/Sign in with Steam/);
    assert.equal(document.querySelector('tbody'),null);assert.equal(document.querySelector('.account-heading'),null);
    assert.doesNotMatch(document.body.textContent!,/Alice/);assert.equal(ui.c.timers.size,0);assert.equal(ui.calls(),3);
  }finally{await ui.close();}
});

test('a retried response arriving after logout cannot restore private standings',async()=>{
  const ui=await mount(snapshot('a',10));try{
    ui.fail(revisionAbort);await act(async()=>{await ui.c.tick();});
    let resolveOld!:(value:LeagueSnapshot)=>void;
    ui.fail(null);ui.hold(new Promise(resolve=>{resolveOld=resolve;}));
    await act(async()=>{await ui.c.tick(BOOTSTRAP_ABORT_RETRY_DELAYS_MS[0]);});
    ui.hold(null);ui.set(emptySnapshot());await act(async()=>{ui.auth();await Promise.resolve();});
    await act(async()=>{resolveOld(snapshot('a',99));await Promise.resolve();});
    assert.match(document.body.textContent!,/Sign in with Steam/);assert.doesNotMatch(document.body.textContent!,/Alice/);
    assert.equal(document.querySelector('tbody'),null);assert.equal(ui.c.timers.size,0);assert.equal(ui.calls(),4);
  }finally{await ui.close();}
});

test('a successful action supersedes a queued abort retry and renews the existing refresh window',async()=>{
  const ui=await mount({...snapshot('a',10),enteredSeason:false});try{
    ui.fail(revisionAbort);await act(async()=>{await ui.c.tick();});
    ui.fail(null);await ui.click('Enter Season I');noSignInGate();alicePoints(10);
    assert.equal(ui.calls(),3,'the action reload supersedes the queued retry');
    assert.equal([...ui.c.timers.values()].some(t=>BOOTSTRAP_ABORT_RETRY_DELAYS_MS.includes(t.delay as any)),false);
    assert.ok(ui.c.timers.size>0,'successful actions still renew asynchronous reconciliation');
    ui.set(snapshot('a',26));await act(async()=>{await ui.c.tick();});alicePoints(26);
  }finally{await ui.close();}
});

for(const membership of ['INACTIVE','SUSPENDED','PENDING','SIGNED_OUT'] as const){
  test(`a retry returning ${membership} revokes the old member snapshot and dialog`,async()=>{
    const ui=await mount(snapshot('a',10));try{
      await ui.openAccount();ui.fail(revisionAbort);await act(async()=>{await ui.c.tick();});
      ui.fail(null);ui.set({...emptySnapshot(),membership});
      await act(async()=>{await ui.c.tick(BOOTSTRAP_ABORT_RETRY_DELAYS_MS[0]);});
      assert.equal(document.querySelector('tbody'),null);assert.equal(document.querySelector('.account-heading'),null);
      assert.doesNotMatch(document.body.textContent!,/Alice/);assert.equal(ui.c.timers.size,0);assert.equal(ui.calls(),3);
      assert.match(document.body.textContent!,membership==='SIGNED_OUT'?/Sign in with Steam/:membership==='PENDING'?/Banner awaiting approval/:/The gate is closed/);
    }finally{await ui.close();}
  });
}

for(const code of ['functions/permission-denied','functions/unauthenticated']){
  test(`abort recovery fails closed immediately when the next read returns ${code}`,async()=>{
    const ui=await mount(snapshot('a',10));try{
      await ui.openAccount();ui.fail(revisionAbort);await act(async()=>{await ui.c.tick();});
      ui.fail(Object.assign(new Error('Access revoked'),{code}));
      await act(async()=>{await ui.c.tick(BOOTSTRAP_ABORT_RETRY_DELAYS_MS[0]);});
      assert.equal(ui.calls(),3);assert.equal(ui.c.timers.size,0);
      assert.equal(document.querySelector('tbody'),null);assert.equal(document.querySelector('.account-heading'),null);
      assert.doesNotMatch(document.body.textContent!,/Alice/);assert.match(document.body.textContent!,/Sign in with Steam/);
      assert.match(document.querySelector('[role="alert"]')!.textContent!,/Access revoked/);
    }finally{await ui.close();}
  });
}

test('unmount cancels a pending abort retry rather than loading again',async()=>{
  const ui=await mount();ui.fail(revisionAbort);await act(async()=>{await ui.c.tick();});
  await ui.close();assert.equal(ui.c.timers.size,0);assert.equal(ui.calls(),2);
});
