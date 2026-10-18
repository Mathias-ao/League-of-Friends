import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import {PrivateSocialExperience} from '../src/ui/PrivateSocialExperience';
import type {IntV1PrivateExperience} from '../src/domain/intV1Experience';
import type {LeagueRepository} from '../src/domain/league';
function dto():IntV1PrivateExperience{
 const source=JSON.parse(readFileSync(new URL('../../contracts/social-v1/fixtures/conformance.json',import.meta.url),'utf8')).bases.SourceSnapshot;
 return {version:'AOF_INT_V1_PRIVATE_SOURCE_1',contract:'AOF_SOCIAL_V1_SHARED_1',visibility:'OWNER_ONLY',
  ownerPlayerId:source.roster[0].playerId,state:'CURRENT_SOURCE_VERIFIED',source,
  scope:{kind:'SINGLE_GAME',independentBattleCount:null,historicalCoverage:'NOT_COLLECTED'},
  personality:['BOOMER_AGGRESSOR','CAUTIOUS_BOLD','GUERRILLA_FRONTLINE','SPECIALIST_IMPROVISER','COMPACT_EXPANSIVE'].map(axis=>({axis,status:'PENDING',value:null,reasonCodes:[]})),
  tracks:['GALLANTRY','CRUELTY','CHIVALRY','RIVALRY','HOSTILITY','BOND'].map(track=>({track,status:'PENDING',currentStage:null,reasonCodes:[]})),
  chronicle:{status:'PENDING',reasonCodes:[]},recognition:{status:'PENDING',reasonCodes:[]},
  effects:{officialWrites:false,receiptPublication:false,entitlementGrants:false}};
}
async function setup(){
 const dom=new JSDOM('<div id="app"></div>',{url:'http://localhost/'});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
 const root=createRoot(document.getElementById('app')!);let auth=()=>{};
 const value=dto();let calls=0;
 const repository={mySocialExperience:async()=>{calls++;return value;},onAuthChange:(fn:()=>void)=>{auth=fn;return()=>{auth=()=>{};};}} as unknown as LeagueRepository;
 const props={repository,matchId:value.source.matchId,gameId:value.source.gameId,viewerId:value.ownerPlayerId,
  sourceHash:value.source.sourceHash,revision:value.source.statisticsRevision};
 const render=async(overrides:Partial<typeof props>={})=>act(async()=>root.render(React.createElement(PrivateSocialExperience,{...props,...overrides})));
 const click=async(text:string)=>act(async()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent===text);assert.ok(b);b.click();});
 return {value,repository,props,render,click,auth:()=>auth(),calls:()=>calls,close:async()=>{await act(async()=>root.unmount());dom.window.close();}};
}

test('private view fetches on request only, binds source/revision and displays all missing axes/tracks honestly',async()=>{
 const c=await setup();try{
  await c.render();assert.equal(c.calls(),0);
  await c.click('Inspect my recording history');assert.equal(c.calls(),1);
  const view=document.querySelector('[data-aof-private-owner]')!;assert.equal(view.getAttribute('data-aof-source'),c.value.source.sourceHash);
  assert.equal(view.querySelectorAll('li').length,11);
  assert.match(view.textContent!,/No social credit has been issued/);
  assert.ok(!view.querySelector('input[type="range"]'),'no fabricated slider position');
  assert.ok(!view.textContent!.includes('Stage 0'));
  await c.click('Close private history');assert.equal(document.querySelector('[data-aof-private-owner]'),null);
 }finally{await c.close();}
});

test('pending official result remains source-verified, explicit and separate from social movement',async()=>{
 const c=await setup();try{
  c.value.source.outcome={qualification:'UNRESOLVED',resultRevision:null,winningPlayerIds:null};
  await c.render();await c.click('Inspect my recording history');
  assert.match(document.body.textContent!,/Official Game result pending; recording statistics remain available/);
  assert.equal(document.querySelectorAll('li').length,11);
 }finally{await c.close();}
});

test('source/owner correction, auth change and read error erase previous private output; late response is ignored',async()=>{
 const c=await setup();try{
  await c.render();await c.click('Inspect my recording history');assert.ok(document.querySelector('[data-aof-private-owner]'));
  await c.render({revision:c.props.revision+1});assert.equal(document.querySelector('[data-aof-private-owner]'),null);
  await c.click('Inspect my recording history');assert.match(document.querySelector('[role="alert"]')!.textContent!,/Recording changed/);
  await c.render();await c.click('Inspect my recording history');
  await act(async()=>c.auth());assert.equal(document.querySelector('[data-aof-private-owner]'),null);
  let finish!:(v:IntV1PrivateExperience)=>void;
  c.repository.mySocialExperience=()=>new Promise(resolve=>{finish=resolve;});
  await c.click('Inspect my recording history');await c.render({viewerId:'other-owner'});
  await act(async()=>finish(c.value));assert.equal(document.querySelector('[data-aof-private-owner]'),null);
  c.repository.mySocialExperience=async()=>{throw new Error('Authority withdrawn');};
  await c.click('Inspect my recording history');assert.match(document.querySelector('[role="alert"]')!.textContent!,/Authority withdrawn/);
  assert.equal(document.querySelector('[data-aof-private-owner]'),null);
 }finally{await c.close();}
});
