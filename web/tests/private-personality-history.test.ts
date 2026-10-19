import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import {PrivatePersonalityHistory} from '../src/ui/PrivatePersonalityHistory';
import {privateHistoryEnabled,type PrivatePersonalityHistory as History} from '../src/domain/privateHistory';
import type {LeagueRepository} from '../src/domain/league';
const base=JSON.parse(readFileSync(new URL('../../contracts/social-v1/fixtures/conformance.json',import.meta.url),'utf8')).bases.PersonalityProfile;
function history():History{return {version:'AOF_INT_B_PRIVATE_HISTORY_1',contract:'AOF_SOCIAL_V1_SHARED_1',visibility:'OWNER_ONLY',ownerPlayerId:base.playerId,inputDigest:'a'.repeat(64),status:'CURRENT_INPUTS',
 coverage:{completeEnumeration:true,scannedLeagueBattles:1,ownBattles:1,ownGames:2,currentSources:2,measuredIndependentBattles:0},sources:[],pending:[],
 personality:{publication:'PRIVATE_PREVIEW_ONLY',battleFeatures:[],personalityProfile:{...structuredClone(base),sliders:base.sliders.map((s:any)=>({...s,status:'DEVELOPING',value:null}))},contextAdmission:'PENDING',calibration:'UNCONFIGURED'},
 social:{status:'PENDING',reason:'pending'},effects:{officialWrites:false,receiptPublication:false,entitlementGrants:false}};}
async function setup(){
 const dom=new JSDOM('<div id="app"></div>',{url:'http://localhost/'});Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
 const root=createRoot(document.getElementById('app')!);const value=history();let auth=()=>{},calls=0;
 const repository={myPersonalityHistory:async()=>{calls++;return value;},onAuthChange:(fn:()=>void)=>{auth=fn;return()=>{};}} as unknown as LeagueRepository;
 const render=async(ownerId=value.ownerPlayerId)=>act(async()=>root.render(React.createElement(PrivatePersonalityHistory,{repository,ownerId})));
 const click=async(text:string)=>act(async()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent===text);assert.ok(b);b.click();});
 return {value,repository,render,click,calls:()=>calls,auth:()=>auth(),close:async()=>{await act(async()=>root.unmount());dom.window.close();}};
}

test('private Personality is on-demand, five Developing values and one Battle across Games without fabricated slider',async()=>{
 const c=await setup();try{
  await c.render();assert.equal(c.calls(),0);await c.click('Inspect my Personality history');
  assert.ok(document.querySelector('[data-aof-history-owner]'));assert.equal(document.querySelectorAll('li').length,5);
  assert.match(document.body.textContent!,/2 current recordings across 1 Battle/);assert.match(document.body.textContent!,/Developing/);
  assert.equal(document.querySelector('input[type="range"]'),null);assert.match(document.body.textContent!,/Reputation and Relationships: Pending/);
  await c.click('Close Personality history');assert.equal(document.querySelector('[data-aof-history-owner]'),null);
 }finally{await c.close();}
});
test('owner switch, auth change, stale request and failures clear private output',async()=>{
 const c=await setup();try{
  await c.render();await c.click('Inspect my Personality history');await c.render('other-owner');assert.equal(document.querySelector('[data-aof-history-owner]'),null);
  await c.click('Inspect my Personality history');assert.match(document.querySelector('[role="alert"]')!.textContent!,/identity changed/);
  await c.render();await c.click('Inspect my Personality history');await act(async()=>c.auth());assert.equal(document.querySelector('[data-aof-history-owner]'),null);
  let finish!:(v:History)=>void;c.repository.myPersonalityHistory=()=>new Promise(resolve=>{finish=resolve;});
  await c.click('Inspect my Personality history');await c.render('other-owner');await act(async()=>finish(c.value));assert.equal(document.querySelector('[data-aof-history-owner]'),null);
  c.repository.myPersonalityHistory=async()=>{throw new Error('Source changed');};await c.click('Inspect my Personality history');
  assert.match(document.querySelector('[role="alert"]')!.textContent!,/Source changed/);
 }finally{await c.close();}
});
test('UI rollout is default-off and rejects production even with an explicit flag',()=>{
 assert.equal(privateHistoryEnabled(),false);
 assert.equal(privateHistoryEnabled({VITE_AOF_INT_V1_PRIVATE_HISTORY:'battle-v1',VITE_FIREBASE_PROJECT_ID:'league-of-friends-cc274'}),false);
 assert.equal(privateHistoryEnabled({VITE_AOF_INT_V1_PRIVATE_HISTORY:'battle-v1',VITE_FIREBASE_PROJECT_ID:'demo-test',VITE_USE_EMULATORS:'true'}),true);
});
