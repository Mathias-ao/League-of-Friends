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
 let data=view(),auth=()=>{},fail=false;const calls:any[]=[];
 const repository={myChronicleInvitations:async()=>data,actOnChronicleInvitation:async(input:any)=>{
   calls.push(input);if(fail)throw new Error('Battle source changed; review its current revision.');
   data={...data,invitations:data.invitations.map(x=>({...x,state:input.action==='SUBMIT'?'SUBMITTED':input.action==='DEFER'?'DEFERRED':'DECLINED',revision:x.revision+1}))} as PrivateChronicleInvitations;
   return {success:true,revision:2,state:input.action,idempotent:false};},
  onAuthChange:(cb:()=>void)=>{auth=cb;return()=>{};}} as unknown as LeagueRepository;
 const root=createRoot(document.getElementById('root')!);
 const render=async(id='owner')=>act(async()=>root.render(React.createElement(PrivateChronicleInteractions,{repository,ownerId:id,counterpartNames:{other:'Beren'}})));
 const click=async(part:string)=>act(async()=>{const btn=[...document.querySelectorAll('button')].find(x=>x.textContent?.includes(part));assert.ok(btn,part);btn.click();});
 return {repository,render,click,set:(v:PrivateChronicleInvitations)=>{data=v;},fail:()=>{fail=true;},calls,auth:()=>auth(),close:async()=>{await act(async()=>root.unmount());dom.window.close();}};
}
test('emulator-only Vite gate excludes production and ordinary browser',()=>{
 assert.equal(privateChronicleInteractionsEnabled(),false);
 assert.equal(privateChronicleInteractionsEnabled({VITE_AOF_CHRONICLE_INTERACTIONS_V1E:'emulator-only',VITE_USE_EMULATORS:'true',VITE_FIREBASE_PROJECT_ID:'demo-aof'}),true);
 assert.equal(privateChronicleInteractionsEnabled({VITE_AOF_CHRONICLE_INTERACTIONS_V1E:'emulator-only',VITE_USE_EMULATORS:'true',VITE_FIREBASE_PROJECT_ID:'age-of-friends-staging'}),false);
});
test('a choice is a private draft until a separate confirmation; revision CAS is preserved',async()=>{
 const c=await setup();try{
  await c.render();await c.click('Review my invitations');
  assert.match(document.body.textContent!,/optional and uncommon/);assert.match(document.body.textContent!,/never counts against you/);
  assert.match(document.body.textContent!,/Your encounter with Beren/);
  assert.doesNotMatch(document.body.textContent!,/ACKNOWLEDGED_HELP|ASSISTANCE|Optional perspective on a source-bounded/);
  await c.click('It mattered to me');assert.equal(c.calls.length,0);
  assert.ok(document.querySelector('[aria-label="Review your private perspective"]'));
  await c.click('Change my choice');assert.equal(c.calls.length,0);assert.equal(document.querySelector('[aria-label="Review your private perspective"]'),null);
  await c.click('It mattered to me');await c.click('Save my private perspective');
  assert.equal(c.calls.length,1);assert.equal(c.calls[0].action,'SUBMIT');assert.equal(c.calls[0].battleId,'battle-1');
  assert.equal(c.calls[0].expectedRevision,1);assert.equal(c.calls[0].opportunityRevision,'a'.repeat(64));
  assert.equal(c.calls[0].choiceId,'ACKNOWLEDGED_HELP');assert.equal(c.calls[0].confirmed,true);
  assert.equal('policy' in c.calls[0],false);assert.equal('playerId' in c.calls[0],false);
  assert.match(document.body.textContent!,/saved privately/);
  assert.equal(document.querySelector('[aria-label="Review your private perspective"]'),null);
 }finally{await c.close();}
});
test('new source/opportunity revision requires a fresh selection, not a stale confirmation',async()=>{
 const c=await setup();try{
  await c.render();await c.click('Review my invitations');await c.click('It mattered to me');
  const newer=view();newer.invitations[0].revision=3;newer.invitations[0].opportunityRevision='c'.repeat(64);c.set(newer);
  await c.click('Refresh my invitations');assert.equal(document.querySelector('[aria-label="Review your private perspective"]'),null);assert.equal(c.calls.length,0);
  await c.click('It mattered to me');await c.click('Save my private perspective');
  assert.equal(c.calls[0].expectedRevision,3);assert.equal(c.calls[0].opportunityRevision,'c'.repeat(64));
 }finally{await c.close();}
});
test('source withdrawal and account changes clear a private draft; earlier reflection is expressly stale',async()=>{
 const c=await setup();try{
  await c.render();await c.click('Review my invitations');await c.click('It mattered to me');
  await act(async()=>c.auth());assert.equal(document.querySelector('[data-aof-chronicle-invitations-owner]'),null);assert.equal(c.calls.length,0);
  await c.click('Review my invitations');await c.click('It mattered to me');await c.render('other');
  assert.equal(document.querySelector('[data-aof-chronicle-invitations-owner]'),null);
  const v=view();v.invitations[0].sourceCurrent=false;v.invitations[0].speaker={authorPlayerId:'owner',choiceId:'ACKNOWLEDGED_HELP',qualification:'PENDING',presentation:'ATTRIBUTED_SPEAKER_NOT_OBJECTIVE_NARRATOR'};c.set(v);
  await c.render('owner');await c.click('Review my invitations');assert.match(document.body.textContent!,/source has changed/);
  assert.match(document.body.textContent!,/Earlier private reflection/);assert.match(document.body.textContent!,/not used in current interpretation/);
  assert.equal(document.querySelector('[aria-label="Review your private perspective"]'),null);assert.equal(document.querySelectorAll('button').length,2);
 }finally{await c.close();}
});
test('all existing families have non-leading words without adding a choice or submitting on selection',async()=>{
 for(const [family,ids,label] of [
  ['SITUATED_GRIEVANCE',['FELT_PERSONAL','FAIR_WARFARE'],'It felt personal to me'],
  ['SKILL_ACKNOWLEDGMENT',['ACKNOWLEDGED_SKILL','DO_NOT_ACKNOWLEDGE'],'Stronger in these meetings'],
  ['TREACHERY_VICTIM',['FELT_BETRAYED','FAIR_GAME'],'I regarded it as betrayal'],
 ] as const){
  const c=await setup();try{const v=view();v.invitations[0].family=family;v.invitations[0].choices=[...ids,'UNDECIDED'];c.set(v);
   await c.render();await c.click('Review my invitations');assert.doesNotMatch(document.body.textContent!,new RegExp(family));
   await c.click(label);assert.equal(c.calls.length,0);await c.click('Save my private perspective');assert.equal(c.calls[0].choiceId,ids[0]);
  }finally{await c.close();}
 }
});
test('unknown future family/choice does not invent copy or confirmation but defer/decline remain harmless',async()=>{
 for(const unknownFamily of [false,true]){const c=await setup();try{
  const v=view();if(unknownFamily)v.invitations[0].family='UNKNOWN_FUTURE';else v.invitations[0].choices.push('NEW_UNREVIEWED_CHOICE');c.set(v);
  await c.render();await c.click('Review my invitations');assert.match(document.body.textContent!,/presentation is not available/);
  assert.equal(document.querySelector('[aria-label="Review your private perspective"]'),null);
  await c.click(unknownFamily?'Decline without penalty':'Not now');assert.equal(c.calls.length,1);
  assert.equal(c.calls[0].action,unknownFamily?'DECLINE':'DEFER');assert.equal('confirmed' in c.calls[0],false);assert.equal('choiceId' in c.calls[0],false);
 }finally{await c.close();}}
});
test('correction rejection clears the confirmed private draft and foreign speaker is never rendered',async()=>{
 const c=await setup();try{
  await c.render();await c.click('Review my invitations');await c.click('It mattered to me');c.fail();await c.click('Save my private perspective');
  assert.equal(document.querySelector('[data-aof-chronicle-invitations-owner]'),null);assert.match(document.body.textContent!,/source changed/);
  const v=view();v.invitations[0].speaker={authorPlayerId:'other',choiceId:'FELT_PERSONAL',qualification:'PENDING',presentation:'ATTRIBUTED_SPEAKER_NOT_OBJECTIVE_NARRATOR'};c.set(v);
  await c.click('Review my invitations');assert.equal(document.querySelector('[data-aof-chronicle-invitations-owner]'),null);
 }finally{await c.close();}
});
