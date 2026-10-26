import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {PrivateChronicleInteractions} from '../src/ui/PrivateChronicleInteractions';
import {privateChronicleInteractionsEnabled,type PrivateChronicleInvitations} from '../src/domain/privateChronicleInteractions';
import type {LeagueRepository} from '../src/domain/league';
const invite={slotId:'slot-a',battleId:'battle-1',respondentPlayerId:'owner',revision:1,state:'OFFERED',
 opportunityRevision:'a'.repeat(64),family:'ASSISTANCE',counterpartPlayerId:'other',
 questionContext:'Optional perspective on a source-bounded Battle moment.',
 choices:['ACKNOWLEDGED_HELP','NOT_PERSONALLY_MEANINGFUL','UNDECIDED'],sourceCurrent:true,
 speaker:null,effects:{relationshipDelta:null,officialWrites:false,negativeForSilence:false}};
function view(){return {version:'AOF_CHRONICLE_INTERACTIONS_V1E',visibility:'OWNER_ONLY',
 ownerPlayerId:'owner',invitations:[structuredClone(invite)],officialEffects:[],
 narratorAuthority:'FACTUAL_SOURCE_ONLY',testOnly:true} as PrivateChronicleInvitations;}
async function setup(){
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
 let data=view(),auth=()=>{},calls=[];
 const repository={myChronicleInvitations:async()=>data,actOnChronicleInvitation:async(input:any)=>{
   calls.push(input);data={...data,invitations:data.invitations.map(x=>({...x,state:input.action==='SUBMIT'?'SUBMITTED':input.action==='DEFER'?'DEFERRED':'DECLINED',revision:x.revision+1}))} as PrivateChronicleInvitations;
   return {success:true,revision:2,state:input.action,idempotent:false};},
  onAuthChange:(cb:()=>void)=>{auth=cb;return()=>{};}} as unknown as LeagueRepository;
 const root=createRoot(document.getElementById('root')!);
 const render=async(id='owner')=>act(async()=>root.render(React.createElement(PrivateChronicleInteractions,{repository,ownerId:id})));
 const click=async(part:string)=>act(async()=>{const btn=[...document.querySelectorAll('button')].find(x=>x.textContent?.includes(part));assert.ok(btn,part);btn.click();});
 return {repository,render,click,set:(v:PrivateChronicleInvitations)=>{data=v;},calls,auth:()=>auth(),close:async()=>{await act(async()=>root.unmount());dom.window.close();}};
}
test('emulator-only Vite gate excludes production and ordinary browser',()=>{
 assert.equal(privateChronicleInteractionsEnabled(),false);
 assert.equal(privateChronicleInteractionsEnabled({VITE_AOF_CHRONICLE_INTERACTIONS_V1E:'emulator-only',VITE_USE_EMULATORS:'true',VITE_FIREBASE_PROJECT_ID:'demo-aof'}),true);
 assert.equal(privateChronicleInteractionsEnabled({VITE_AOF_CHRONICLE_INTERACTIONS_V1E:'emulator-only',VITE_USE_EMULATORS:'true',VITE_FIREBASE_PROJECT_ID:'age-of-friends-staging'}),false);
});
test('author-only rare response uses revision-bound CAS and never shows social awards',async()=>{
 const c=await setup();try{
  await c.render();assert.equal(document.querySelector('[data-aof-chronicle-invitations-owner]'),null);
  await c.click('Review my invitations');
  assert.match(document.body.textContent!,/optional and uncommon/);
  assert.match(document.body.textContent!,/never counts against you/);
  await c.click('ACKNOWLEDGED HELP');
  assert.equal(c.calls.length,1);
  assert.equal(c.calls[0].action,'SUBMIT');assert.equal(c.calls[0].battleId,'battle-1');assert.equal(c.calls[0].expectedRevision,1);
  assert.equal(c.calls[0].choiceId,'ACKNOWLEDGED_HELP');assert.equal(c.calls[0].confirmed,true);
  assert.match(document.body.textContent!,/SUBMITTED/);
  assert.equal(document.querySelectorAll('button').length,2);
 }finally{await c.close();}
});
test('stale source disables response and account switch clears author data',async()=>{
 const c=await setup();try{
  const v=view();v.invitations[0].sourceCurrent=false;c.set(v);
  await c.render();await c.click('Review my invitations');
  assert.equal(document.querySelectorAll('button').length,2);
  assert.match(document.body.textContent!,/Source changed/);
  await c.render('other');assert.equal(document.querySelector('[data-aof-chronicle-invitations-owner]'),null);
  await c.render('owner');await c.click('Review my invitations');
  await act(async()=>c.auth());assert.equal(document.querySelector('[data-aof-chronicle-invitations-owner]'),null);
 }finally{await c.close();}
});
