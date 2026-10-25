import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {PrivateGameplayPreview} from '../src/ui/PrivateGameplayPreview';
import {gameplayPreviewEnabled} from '../src/domain/gameplayPreview';
import type {LeagueRepository} from '../src/domain/league';
test('Pending source-to-private UI is lazy and clears on owner/auth changes, stale response and failure',async()=>{
 const dom=new JSDOM('<div id="app"></div>',{url:'http://localhost/'});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
 const root=createRoot(document.getElementById('app')!);let auth=()=>{},calls=0;
 const value:any={version:'AOF_INT_C1_PRIVATE_PREVIEW_1',visibility:'OWNER_ONLY',ownerPlayerId:'owner',inputDigest:'a'.repeat(64),
  status:'PENDING',simulation:{status:'UNAPPROVED_TEST_ONLY'},grades:[{candidateId:'candidate',actorPlayerId:'owner',counterpartPlayerId:'other',
   contributionGroupId:'same-original',metricId:'DIRECTED_PRESSURE_REQUEST',raw:{value:2},grade:{status:'PENDING'},sourceAuthority:'b'.repeat(64),
   firstSourceMoment:{recordingAtMs:10000,order:'ORDERED'}}],pendingSources:[],coverage:{currentSources:2,ownBattles:1},
  history:{officialWrites:false,publicationAllowed:false,projections:[],receipts:[]},effects:{officialWrites:false,receiptPublication:false,entitlementGrants:false}};
 const repository={myGameplayPreview:async()=>{calls++;return value;},onAuthChange:(fn:()=>void)=>{auth=fn;return()=>{};}} as unknown as LeagueRepository;
 const render=async(ownerId='owner')=>act(async()=>root.render(React.createElement(PrivateGameplayPreview,{repository,ownerId})));
 const click=async()=>act(async()=>document.querySelector('button')!.click());
 try{
  await render();assert.equal(calls,0);await click();assert.ok(document.querySelector('[data-aof-gameplay-owner]'));
  assert.match(document.body.textContent!,/Contextual grade: Pending/);assert.match(document.body.textContent!,/1 source groups/);
  assert.equal(document.querySelector('input[type="range"]'),null);
  await render('other');assert.equal(document.querySelector('[data-aof-gameplay-owner]'),null);
  await click();assert.match(document.querySelector('[role="alert"]')!.textContent!,/identity or admission changed/);
  await render();await click();await act(async()=>auth());assert.equal(document.querySelector('[data-aof-gameplay-owner]'),null);
  let finish!:(value:any)=>void;repository.myGameplayPreview=()=>new Promise(resolve=>{finish=resolve;});
  await click();await render('other');await act(async()=>finish(value));assert.equal(document.querySelector('[data-aof-gameplay-owner]'),null);
  repository.myGameplayPreview=async()=>{throw new Error('Source changed');};await click();assert.match(document.querySelector('[role="alert"]')!.textContent!,/Source changed/);
 }finally{await act(async()=>root.unmount());dom.window.close();}
});
test('C1 UI is default-off and cannot select a production project',()=>{
 assert.equal(gameplayPreviewEnabled(),false);
 assert.equal(gameplayPreviewEnabled({VITE_AOF_INT_C1_PREVIEW:'wiring-test-v1',VITE_FIREBASE_PROJECT_ID:'league-of-friends-cc274'}),false);
 assert.equal(gameplayPreviewEnabled({VITE_AOF_INT_C1_PREVIEW:'wiring-test-v1',VITE_FIREBASE_PROJECT_ID:'demo-test',VITE_USE_EMULATORS:'true'}),true);
});
