import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {ProfileDialogWithIdentity} from '../src/ui/StatisticsExperience';
import {emptySnapshot} from '../src/domain/league';
import type {LeagueRepository} from '../src/domain/league';
import {PrivateHonoursPreview} from '../src/ui/PrivateHonoursPreview';
import {privateHonoursPreviewEnabled,type PrivateHonoursPreview as Preview} from '../src/domain/privateHonoursPreview';
const keys=['FAST_CASTLE','WONDER','UNBROKEN','THREE_SCHOOLS','FFA_SOLO_WIN','BOOMER','EXPLORER','GOLD','AGGRESSION','DEFENSIVE'];
function preview():Preview{return {version:'AOF_HONOURS_PRIVATE_SOURCE_PREVIEW_1',visibility:'OWNER_ONLY',ownerPlayerId:'p1',inputDigest:'a'.repeat(64),mode:'READ_ONLY_TESTING',
  coverage:{currentSources:1,ownBattles:1,completeSourceBattles:1},sources:[],pendingSources:[],
  honours:keys.map((key,i)=>({key,kind:i<2?'TROPHY':i<4?'EPITHET':'DISTINCTION',label:key==='WONDER'?'Wonder':key,
    status:'PENDING',reason:key==='WONDER'?'A BUILD request or ordinary winner does not prove completed Wonder or Wonder victory.':'Qualification remains Pending.',independentBattles:null,evidence:[]})),
  effects:{officialWrites:false,receiptPublication:false,entitlementGrants:false}};}
async function setup(){
  const dom=new JSDOM('<div id="app"></div>',{url:'http://localhost/'});
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
  const root=createRoot(document.getElementById('app')!),value=preview();let calls=0,auth=()=>{};
  const repository={myHonoursPreview:async()=>{calls++;return value;},onAuthChange:(fn:()=>void)=>{auth=fn;return()=>{};}} as unknown as LeagueRepository;
  const render=async(ownerId='p1')=>act(async()=>root.render(React.createElement(PrivateHonoursPreview,{repository,ownerId})));
  const click=async(text:string)=>act(async()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent===text);assert.ok(b);b.click();});
  return {root,value,repository,render,click,calls:()=>calls,auth:()=>auth(),close:async()=>{await act(async()=>root.unmount());dom.window.close();}};
}
test('ten honours are read on demand, source limitations remain visible and no possession is asserted',async()=>{
  const c=await setup();try{
    await c.render();assert.equal(c.calls(),0);await c.click('Inspect my honours preview');
    assert.equal(document.querySelectorAll('li').length,10);assert.match(document.body.textContent!,/grants no honour or current trophy possession/);
    assert.match(document.body.textContent!,/BUILD request or ordinary winner does not prove/);
    assert.equal(document.querySelector('[data-aof-honours-owner]')?.getAttribute('data-aof-honours-owner'),'p1');
    await c.click('Close honours preview');assert.equal(document.querySelector('[data-aof-honours-owner]'),null);
  }finally{await c.close();}
});
test('a source candidate names exact current Game evidence without converting it to an honour',async()=>{
  const c=await setup();try{
    const e={battleId:'b1',gameId:'g1',seasonId:'s',sourceHash:'b'.repeat(64),statisticsRevision:2,authorityRevision:'c'.repeat(64),resultRevision:3};
    c.value.sources=[e];Object.assign(c.value.honours[4],{status:'SOURCE_CANDIDATE',independentBattles:1,evidence:[e],
      reason:'Sole official FFA winner observed. This does not prove never allied or unaided play.'});
    await c.render();await c.click('Inspect my honours preview');
    assert.match(document.body.textContent!,/Source candidate/);assert.match(document.body.textContent!,/1 independent Battle/);
    assert.match(document.body.textContent!,/Game g1 · statistics revision 2 · result revision 3/);
    assert.match(document.body.textContent!,/does not prove never allied or unaided/);
    await c.click('Close honours preview');c.value.sources=[];await c.click('Inspect my honours preview');
    assert.equal(document.querySelector('[data-aof-honours-owner]'),null);assert.match(document.querySelector('[role="alert"]')!.textContent!,/identity changed/);
  }finally{await c.close();}
});
test('auth and owner changes clear private output and discard a stale in-flight response',async()=>{
  const c=await setup();try{
    await c.render();await c.click('Inspect my honours preview');await act(async()=>c.auth());
    assert.equal(document.querySelector('[data-aof-honours-owner]'),null);
    let finish!:(v:Preview)=>void;c.repository.myHonoursPreview=()=>new Promise(resolve=>{finish=resolve;});
    await c.click('Inspect my honours preview');await c.render('p2');await act(async()=>finish(c.value));
    assert.equal(document.querySelector('[data-aof-honours-owner]'),null);
    c.repository.myHonoursPreview=async()=>c.value;await c.click('Inspect my honours preview');
    assert.match(document.querySelector('[role="alert"]')!.textContent!,/identity changed/);
  }finally{await c.close();}
});
test('honours UI is default-off and exact-project only, including when a production flag is accidentally supplied',()=>{
  assert.equal(privateHonoursPreviewEnabled(),false);
  assert.equal(privateHonoursPreviewEnabled({VITE_AOF_HONOURS_PRIVATE_PREVIEW:'source-v1',VITE_FIREBASE_PROJECT_ID:'league-of-friends-cc274',VITE_USE_EMULATORS:'true'}),false);
  assert.equal(privateHonoursPreviewEnabled({VITE_AOF_HONOURS_PRIVATE_PREVIEW:'source-v1',VITE_FIREBASE_PROJECT_ID:'age-of-friends-staging'}),false);
  assert.equal(privateHonoursPreviewEnabled({VITE_AOF_HONOURS_PRIVATE_PREVIEW:'source-v1',VITE_FIREBASE_PROJECT_ID:'demo-honours',VITE_USE_EMULATORS:'true'}),true);
});

test('EU honours UI opt-in requires exact hosted project/region, with demo support and nearest negatives',()=>{
  const env={VITE_AOF_HONOURS_PRIVATE_PREVIEW:'source-v1',VITE_FIREBASE_PROJECT_ID:'age-of-friends-staging-eu',VITE_FIREBASE_REGION:'europe-west1'};
  assert.equal(privateHonoursPreviewEnabled(env),true);
  assert.equal(privateHonoursPreviewEnabled({...env,VITE_USE_EMULATORS:'false'}),true);
  for(const patch of [
    {VITE_AOF_HONOURS_PRIVATE_PREVIEW:undefined},{VITE_AOF_HONOURS_PRIVATE_PREVIEW:'true'},{VITE_AOF_HONOURS_PRIVATE_PREVIEW:'source-v2'},
    ...['age-of-friends-staging','league-of-friends-cc274','age-of-friends-staging-eu-extra','demo-'].map(VITE_FIREBASE_PROJECT_ID=>({VITE_FIREBASE_PROJECT_ID})),
    {VITE_FIREBASE_REGION:undefined},{VITE_FIREBASE_REGION:'us-central1'},{VITE_USE_EMULATORS:'true'},{VITE_USE_EMULATORS:'yes'},
  ])assert.equal(privateHonoursPreviewEnabled({...env,...patch}),false);
});
test('transport errors offer retry and grant/publication payloads never render',async()=>{
  const c=await setup();try{
    c.repository.myHonoursPreview=async()=>{throw Error('Transport failed');};
    await c.render();await c.click('Inspect my honours preview');
    assert.match(document.querySelector('[role="alert"]')!.textContent!,/unavailable.*Transport failed.*retry/);
    c.repository.myHonoursPreview=async()=>c.value;await c.click('Inspect my honours preview');
    assert.equal(document.querySelectorAll('li').length,10);
    await c.click('Close honours preview');
    for(const key of ['officialWrites','receiptPublication','entitlementGrants'] as const){
      Object.assign(c.value.effects,{[key]:true});
      await c.click('Inspect my honours preview');assert.equal(document.querySelector('[data-aof-honours-owner]'),null);
      Object.assign(c.value.effects,{[key]:false});
    }
  }finally{await c.close();}
});
test('account change before observer delivery discards pending owner data; signed-out click performs no read',async()=>{
  const c=await setup();try{
    let uid:string|null='owner-uid',finish!:(v:Preview)=>void;
    c.repository.currentAuthUid=()=>uid;c.repository.myHonoursPreview=()=>new Promise(resolve=>{finish=resolve;});
    await c.render();await c.click('Inspect my honours preview');uid='other-uid';
    await act(async()=>finish(c.value));assert.equal(document.querySelector('[data-aof-honours-owner]'),null);
    let calls=0;c.repository.myHonoursPreview=async()=>{calls++;return c.value;};uid=null;
    await c.click('Inspect my honours preview');assert.equal(calls,0);
  }finally{await c.close();}
});

test('actual live profile mounts on-demand honours only for the active signed-in owner with the opt-in capability',async()=>{
  const c=await setup();let uid:string|null='owner-uid',enabled=true;
  Object.assign(c.repository,{mode:'live',currentAuthUid:()=>uid,canReadMyHonoursPreview:()=>enabled});
  const renderProfile=async(playerId='p1',viewerId:string|null='p1',membership='ACTIVE')=>{
    const snapshot={...emptySnapshot(),membership,viewer:viewerId?{playerId:viewerId,steamName:'Permanent'}:null};
    const data={player:{playerId,steamName:'Permanent'},lifetime:{competition:null},activeSeason:null,achievements:[],opponents:[],teammates:[]};
    await act(async()=>c.root.render(React.createElement(ProfileDialogWithIdentity,{repository:c.repository,snapshot,data,preview:false} as any)));
  };
  try{
    await renderProfile();assert.equal(c.calls(),0);await c.click('Inspect my honours preview');
    assert.equal(document.querySelectorAll('[data-aof-honours-owner] li').length,10);assert.equal(c.calls(),1);
    await renderProfile('p2');assert.equal(document.querySelector('[aria-label="Your private honours testing"]'),null);
    await renderProfile('p1',null,'SIGNED_OUT');assert.equal(document.querySelector('[data-aof-honours-owner]'),null);
    for(const status of ['INACTIVE','UNLINKED','SUSPENDED','PENDING']){
      await renderProfile('p1','p1',status);assert.equal(document.querySelector('[aria-label="Your private honours testing"]'),null);
    }
    uid=null;await renderProfile();assert.equal(document.querySelector('[aria-label="Your private honours testing"]'),null);
    uid='owner-uid';enabled=false;await renderProfile();assert.equal(document.querySelector('[aria-label="Your private honours testing"]'),null);
    assert.equal(c.calls(),1,'no automatic or foreign-profile read');
  }finally{await c.close();}
});
