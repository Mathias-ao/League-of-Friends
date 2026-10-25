import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import {PrivateGameplayPreview} from '../src/ui/PrivateGameplayPreview';
import {gameplayCandidatesEnabled} from '../src/domain/gameplayPreview';
import type {LeagueRepository} from '../src/domain/league';
const f=JSON.parse(readFileSync(new URL('../../functions/tests/fixtures/int-c2a-synthetic.json',import.meta.url),'utf8'));
test('C2A private source explanations are lazy, Pending, and clear on auth/mode/owner changes',async()=>{
 const dom=new JSDOM('<div id="app"></div>',{url:'http://localhost/'});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
 const root=createRoot(document.getElementById('app')!);let auth=()=>{},calls=0;
 const value:any={version:'AOF_INT_C2A_PRIVATE_PREVIEW_1',ownerPlayerId:'p1',visibility:'OWNER_ONLY',status:'PENDING',inputDigest:'a'.repeat(64),
  simulation:{status:'UNAPPROVED_TEST_ONLY'},coverage:{currentSources:1,ownBattles:1},pendingSources:[],
  history:{publicationAllowed:false,officialWrites:false,receipts:[],projections:[]},effects:{officialWrites:false,receiptPublication:false,entitlementGrants:false},
  episodes:[{candidate:structuredClone(f.output.producer.candidateEpisodeGroups[0]),
   binding:{actorPlayerId:'p1',counterpartPlayerId:'p2',source:f.input.snapshot,bindingRevision:'b'.repeat(64),sourceAuthorityVerified:true,producerGameScopeAuthenticated:false},
   compatibility:{producerKey:'different-w4-key',legacyContributionKeys:['legacy-key'],componentId:'compat-key',sourceIncidentIds:['original-X'],keySubstitutionAllowed:false}}]};
 const repository={myGameplayCandidates:async()=>{calls++;return value;},myGameplayPreview:async()=>value,onAuthChange:(fn:()=>void)=>{auth=fn;return()=>{};}} as unknown as LeagueRepository;
 const render=async(ownerId='p1',sourceCandidates=true)=>act(async()=>root.render(React.createElement(PrivateGameplayPreview,{repository,ownerId,sourceCandidates})));
 const click=async()=>act(async()=>document.querySelector('button')!.click());
 try{
  await render();assert.equal(calls,0);await click();assert.ok(document.querySelector('[data-aof-gameplay-owner]'));
  assert.match(document.body.textContent!,/LIMITED/);assert.match(document.body.textContent!,/Contextual grade: Pending/);
  assert.match(document.body.textContent!,/Keys are linked, never substituted/);assert.match(document.body.textContent!,/STOP\/CANCEL does not prove/);
  assert.equal(document.querySelector('input[type="range"]'),null);
  await act(async()=>auth());assert.equal(document.querySelector('[data-aof-gameplay-owner]'),null);
  await click();await render('p2');assert.equal(document.querySelector('[data-aof-gameplay-owner]'),null);
  await render();await click();await render('p1',false);assert.equal(document.querySelector('[data-aof-gameplay-owner]'),null);
  let finish!:(v:any)=>void;repository.myGameplayCandidates=()=>new Promise(resolve=>{finish=resolve;});await render();await click();
  await render('p2');await act(async()=>finish(value));assert.equal(document.querySelector('[data-aof-gameplay-owner]'),null);
 }finally{await act(async()=>root.unmount());dom.window.close();}
});
test('source-compatible client mode is separately default-OFF and denies production',()=>{
 assert.equal(gameplayCandidatesEnabled(),false);
 assert.equal(gameplayCandidatesEnabled({VITE_AOF_INT_C2A_PREVIEW:'source-compatible-v1',VITE_FIREBASE_PROJECT_ID:'league-of-friends-cc274'}),false);
 assert.equal(gameplayCandidatesEnabled({VITE_AOF_INT_C2A_PREVIEW:'source-compatible-v1',VITE_FIREBASE_PROJECT_ID:'demo-test',VITE_USE_EMULATORS:'true'}),true);
});
