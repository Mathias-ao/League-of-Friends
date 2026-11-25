import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {battleOccurrenceEnabled,type BattleOccurrenceRead} from '../src/domain/battleOccurrence';
import {BattleOccurrenceConfirm} from '../src/ui/BattleOccurrenceConfirm';
import type {LeagueRepository} from '../src/domain/league';

const allowed={VITE_AOF_BATTLE_OCCURRENCE_V1:'source-v1',
 VITE_FIREBASE_PROJECT_ID:'age-of-friends-staging-eu',VITE_FIREBASE_REGION:'europe-west1',
 VITE_USE_EMULATORS:'false'};
const read:BattleOccurrenceRead={version:'AOF_CANONICAL_BATTLE_OCCURRENCE_1',battleId:'b1',
 expectedSourceBinding:'a'.repeat(64),gameIds:['G1'],
 games:[{gameId:'G1',receiptUpperBoundAtMs:Date.now()-1000}],status:'PENDING',revision:null};
test('Battle confirmation UI only mounts in separate exact EU default-OFF scope',()=>{
 assert.equal(battleOccurrenceEnabled(allowed),true);
 for(const env of [
  {...allowed,VITE_AOF_BATTLE_OCCURRENCE_V1:undefined},
  {...allowed,VITE_FIREBASE_PROJECT_ID:'age-of-friends-staging'},
  {...allowed,VITE_FIREBASE_REGION:'us-central1'},
  {...allowed,VITE_USE_EMULATORS:'true'}
 ])assert.equal(battleOccurrenceEnabled(env),false);
});
test('read is owner-private; a late response cannot restore evidence after AuthUID changes',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,
  HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
 const root=createRoot(document.getElementById('root')!);
 let uid:string|null='first',onAuth=()=>{},finish:(value:BattleOccurrenceRead)=>void=()=>{},reads=0;
 const repository={mode:'live',currentAuthUid:()=>uid,onAuthChange:(cb:()=>void)=>{onAuth=cb;return()=>{};},
  canConfirmBattleOccurrence:()=>true,
  getMyBattleOccurrence:async()=>{reads++;return new Promise<BattleOccurrenceRead>(resolve=>{finish=resolve;});},
  confirmBattleOccurrence:async()=>{throw Error('No form submission was requested.');}} as unknown as LeagueRepository;
 await act(async()=>{root.render(React.createElement(BattleOccurrenceConfirm,{repository,battleId:'b1'}));});
 assert.equal(reads,1);
 await act(async()=>{uid=null;onAuth();finish(read);});
 assert.equal(document.body.textContent?.includes(read.expectedSourceBinding),false);
 assert.equal(document.body.textContent?.includes('Confirm this play window'),false);
 await act(async()=>{root.unmount();});
});
test('a trusted receipt is shown as an upper bound, never an inferred play time',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,
  HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
 const root=createRoot(document.getElementById('root')!);
 const repo={mode:'live',currentAuthUid:()=> 'owner',onAuthChange:()=>()=>{},
  canConfirmBattleOccurrence:()=>true,getMyBattleOccurrence:async()=>read} as unknown as LeagueRepository;
 await act(async()=>{root.render(React.createElement(BattleOccurrenceConfirm,{repository:repo,battleId:'b1'}));});
 assert.match(document.body.textContent??'',/upper bound only/);
 assert.match(document.body.textContent??'',/both opposing players/);
 assert.equal(document.body.textContent?.includes(read.expectedSourceBinding),false);
 await act(async()=>{root.unmount();});
});
