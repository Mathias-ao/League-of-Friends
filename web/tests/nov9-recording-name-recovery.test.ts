import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {PreviewLeagueRepository} from '../src/data/PreviewLeagueRepository';
import {BattleDetails} from '../src/ui/BattleDetails';
import {EmperorBattleControls} from '../src/ui/EmperorControls';

async function setup(){
  const dom=new JSDOM('<div id="app"></div>',{url:'http://localhost/'});
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,
    File:dom.window.File,IS_REACT_ACT_ENVIRONMENT:true});
  const {createRoot}=await import('react-dom/client'),root=createRoot(document.getElementById('app')!);
  const repository=new PreviewLeagueRepository();await repository.signIn();await repository.requestMembership('Tester','','K7M4Q9');
  const snapshot=await repository.load(),data=await repository.match('sample-duel');
  data.match.status='ACTIVE';data.viewer.isParticipant=true;
  data.games[0]={...data.games[0],status:'READY',result:null,replay:undefined};
  const props={repository,snapshot,preview:true,busy:false,openEvent:()=>{},openMatch:()=>{},openPlayer:()=>{},enter:()=>{},navigate:()=>{},onUpdated:()=>{},act:async(action:()=>Promise<unknown>)=>{await action();return true;}};
  return {dom,root,repository,data,props,close:async()=>{await act(async()=>root.unmount());dom.window.close();}};
}

test('unknown-name upload gives the Emperor recovery route and retains the same original for retry; other errors retain their own meaning',async()=>{
  const ctx=await setup();const {data,root,repository,props}=ctx;
  let attempts=0;const files:File[]=[];
  repository.uploadReplay=async(_matchId,_gameId,file)=>{
    files.push(file);if(++attempts===1)throw new Error("Replay identity 'Original Red' cannot be bound uniquely to this Game.");
    if(attempts===3)throw new Error('Replay worker is unavailable.');return {} as any;
  };
  try{
    await act(async()=>root.render(React.createElement(BattleDetails,{...props,data})));
    const input=document.querySelector('input[type=file]') as HTMLInputElement;
    const original=new ctx.dom.window.File(['unchanged source'],'original.aoe2record');
    Object.defineProperty(input,'files',{configurable:true,value:[original]});
    await act(async()=>input.dispatchEvent(new ctx.dom.window.Event('change',{bubbles:true})));
    const alert=document.querySelector('[role=alert]')!.textContent!;
    assert.match(alert,/Original Red/);assert.match(alert,/Emperor.*Battle controls → Resolve recording names/);
    assert.match(alert,/same original recording again/);
    assert.match(document.querySelector('.battle-recording-action')!.textContent!,/original.aoe2record/);
    await act(async()=>input.dispatchEvent(new ctx.dom.window.Event('change',{bubbles:true})));
    assert.equal(files[1],files[0],'retry submits the unchanged File instead of renaming or altering source');
    assert.equal(document.querySelector('[role=alert]'),null);
    await act(async()=>input.dispatchEvent(new ctx.dom.window.Event('change',{bubbles:true})));
    assert.equal(document.querySelector('[role=alert]')!.textContent,'Replay worker is unavailable.');
  }finally{await ctx.close();}
});

test('Emperor identity review explains Game-only binding and submits exact approved names plus an audit reason',async()=>{
  const ctx=await setup();const {data,root,repository}=ctx;const calls:any[]=[];
  repository.bindReplayParticipants=async(...args)=>{calls.push(args);};
  try{
    await act(async()=>root.render(React.createElement(EmperorBattleControls,{data,gameId:data.games[0].gameId,repository,onUpdated:()=>{}})));
    const fieldset=[...document.querySelectorAll('fieldset')].find(row=>row.textContent?.includes('Resolve recording names'))!;
    assert.match(fieldset.textContent!,/applies only to this Game/);
    assert.match(fieldset.textContent!,/does not add a reusable Steam name or change Steam name history/);
    assert.match(fieldset.textContent!,/same original recording again/);
    const reason=document.querySelector('textarea')!;
    const inputSetter=Object.getOwnPropertyDescriptor(ctx.dom.window.HTMLInputElement.prototype,'value')!.set!;
    const reasonSetter=Object.getOwnPropertyDescriptor(ctx.dom.window.HTMLTextAreaElement.prototype,'value')!.set!;
    const names=['Original Red','Original Blue'];
    await act(async()=>{
      reasonSetter.call(reason,'Verified both original recording identities against the approved starters.');
      reason.dispatchEvent(new ctx.dom.window.Event('input',{bubbles:true}));
      [...fieldset.querySelectorAll('input')].forEach((input,i)=>{
        inputSetter.call(input,names[i]);input.dispatchEvent(new ctx.dom.window.Event('input',{bubbles:true}));
      });
    });
    const button=[...document.querySelectorAll('button')].find(row=>row.textContent==='Record verified identity bindings')!;
    assert.equal(button.disabled,false);
    await act(async()=>button.click());
    assert.deepEqual(calls,[[data.match.matchId,data.games[0].gameId,data.games[0].players.map((player,i)=>({playerId:player.playerId,sourceName:names[i]})),reason.value]]);
  }finally{await ctx.close();}
});
