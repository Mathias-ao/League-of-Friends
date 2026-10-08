import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {PreviewLeagueRepository} from '../src/data/PreviewLeagueRepository';
import {BattleDetails} from '../src/ui/BattleDetails';
import {BattleStatistics} from '../src/ui/BattleStatistics';

async function setup(){
 const dom=new JSDOM('<div id="app"></div>',{url:'http://localhost/'});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,File:dom.window.File,IS_REACT_ACT_ENVIRONMENT:true});
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 dom.window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
 const {createRoot}=await import('react-dom/client'),root=createRoot(document.getElementById('app')!);
 const repository=new PreviewLeagueRepository();await repository.signIn();await repository.requestMembership('Tester','','K7M4Q9');
 const snapshot=await repository.load(),data=await repository.match('sample-duel');data.viewer.isParticipant=true;
 const props={repository,snapshot,preview:true,busy:false,openEvent:()=>{},openMatch:()=>{},openPlayer:()=>{},enter:()=>{},navigate:()=>{},onUpdated:()=>{},act:async(action:()=>Promise<unknown>)=>{await action();return true;}};
 const click=async(label:string)=>{const button=[...document.querySelectorAll('button')].find(row=>row.textContent===label);assert.ok(button,label);await act(async()=>{button.focus();button.click();});return button;};
 return {dom,root,repository,data,props,click,close:async()=>{await act(async()=>root.unmount());dom.window.close();}};
}

test('Battle view is compact, opposing players gain recording readings, and statistics/timeline open in an overlay',async()=>{
 const ctx=await setup();const {data,props,root,click}=ctx;
 const game=data.games[0];game.replay={statisticsState:'READY',statisticsId:'a'.repeat(64)};
 try{
  await act(async()=>root.render(React.createElement(BattleDetails,{...props,data})));
  assert.equal(document.querySelectorAll('.battle-roster-side').length,2);
  assert.equal(document.querySelectorAll('.battle-player-reading').length,2);
  assert.equal(document.querySelector('.replay-conclusion'),null);
  assert.equal(document.querySelector('.battle-detail-tabs'),null);
  assert.equal(document.querySelector('.sx-highlights'),null,'empty highlights reserve no height');
  assert.equal(document.querySelector('.sx-timeline'),null,'timeline does not lengthen the Battle');
  assert.equal(document.querySelector('.br-review'),null,'record review is not a main section');
  assert.match(document.querySelector('.battle-command-actions')!.textContent!,/View Battle Orders.*Recording processed/);
  await click('Open Battle Ledger');
  const overlay=document.querySelector('dialog[open]')!;
  assert.match(overlay.getAttribute('aria-labelledby')!,/./);
  assert.ok(overlay.querySelector('.sx-timeline'));
  assert.equal(overlay.querySelectorAll('.sx-tabs button').length,5);
  for(const category of ['Opening','Economy','Military','Map Presence','Execution']){
   await click(category);assert.equal(overlay.querySelectorAll('tbody tr[data-metric]').length,8,category+' has eight selected metrics');
  }
  await click('Economy');assert.ok(overlay.querySelector('[aria-label="Economy statistics"]'));
  assert.ok(overlay.querySelector('[data-metric="farmsPlaced"]'),'new Season measurements appear directly');
  assert.equal(overlay.querySelector('[data-metric="combatApm"]'),null);
  assert.equal(overlay.querySelector('.br-review'),null,'raw recording review is absent from player statistics');
  await act(async()=>overlay.dispatchEvent(new ctx.dom.window.Event('cancel',{cancelable:true})));
  assert.equal(document.querySelector('dialog[open]'),null);
  assert.equal(document.activeElement?.textContent,'Open Battle Ledger');
 }finally{await ctx.close();}
});

test('unprocessed Games never borrow another Game’s statistics; recording selection and drop submit to that Game',async()=>{
 const ctx=await setup();const {data,props,root,repository}=ctx;
 const first=data.games[0];data.match.status='ACTIVE';first.replay={statisticsState:'READY',statisticsId:'a'.repeat(64)};
 data.games.push({...first,gameId:'G2',gameNumber:2,status:'READY',result:null,replay:undefined});
 const submitted:Array<[string,string,string]>=[];
 repository.uploadReplay=async(matchId,gameId,file)=>{submitted.push([matchId,gameId,file.name]);return {} as any;};
 let updates=0;
 try{
  await act(async()=>root.render(React.createElement(BattleDetails,{...props,data,onUpdated:()=>{updates++;}})));
  const select=document.querySelector('.battle-game-picker select') as HTMLSelectElement;
  await act(async()=>{select.value='G2';select.dispatchEvent(new ctx.dom.window.Event('change',{bubbles:true}));});
  assert.equal(document.querySelector('.battle-player-reading'),null);
  assert.equal(document.querySelector('.battle-accomplishments'),null);
  const command=document.querySelector('.battle-command-actions')!;
  assert.deepEqual([...command.querySelectorAll('button')].map(row=>row.textContent),['Open Battle Orders','Upload recording']);
  const input=document.querySelector('input[type=file]')!;
  Object.defineProperty(input,'files',{configurable:true,value:[new ctx.dom.window.File(['record'],'chosen.aoe2record')]});
  await act(async()=>input.dispatchEvent(new ctx.dom.window.Event('change',{bubbles:true})));
  assert.deepEqual(submitted[0],['sample-duel','G2','chosen.aoe2record']);
  const panel=document.querySelector('.game-panel')!,drop=new ctx.dom.window.Event('drop',{bubbles:true,cancelable:true});
  Object.defineProperty(drop,'dataTransfer',{value:{files:[new ctx.dom.window.File(['record'],'dropped.aoe2record')]}});
  await act(async()=>panel.dispatchEvent(drop));
  assert.deepEqual(submitted[1],['sample-duel','G2','dropped.aoe2record']);assert.equal(updates,2);
  const invalid=new ctx.dom.window.Event('drop',{bubbles:true,cancelable:true});Object.defineProperty(invalid,'dataTransfer',{value:{files:[new ctx.dom.window.File(['x'],'wrong.txt')]}});
  await act(async()=>panel.dispatchEvent(invalid));assert.equal(submitted.length,2);assert.match(panel.querySelector('[role=alert]')!.textContent!,/non-empty .aoe2record/);
  await ctx.click('Open Battle Ledger');assert.equal(document.querySelector('dialog[open] .sx-timeline'),null);assert.match(document.querySelector('dialog[open]')!.textContent!,/no processed recording/);
 }finally{await ctx.close();}
});

test('disputes use their own focus-contained window and keep failed submissions open for correction',async()=>{
 const ctx=await setup();const {data,props,root,click,repository}=ctx;
 let attempts=0,updates=0;repository.dispute=async()=>{if(++attempts===1)throw new Error('Correction service unavailable.');};
 try{
  await act(async()=>root.render(React.createElement(BattleDetails,{...props,data,onUpdated:()=>{updates++;}})));
  await click('Dispute result');
  const overlay=document.querySelector('dialog[open]')!;
  assert.ok(overlay.querySelector('.dispute-form'));assert.equal(document.querySelector('.game-panel>.dispute-form'),null);
  const reason=overlay.querySelector('textarea')!;
  const setter=Object.getOwnPropertyDescriptor(ctx.dom.window.HTMLTextAreaElement.prototype,'value')!.set!;
  await act(async()=>{setter.call(reason,'The wrong player was recorded as the winner.');reason.dispatchEvent(new ctx.dom.window.Event('input',{bubbles:true}));});
  await act(async()=>overlay.querySelector('form')!.dispatchEvent(new ctx.dom.window.Event('submit',{bubbles:true,cancelable:true})));
  assert.match(overlay.querySelector('[role=alert]')!.textContent!,/Correction service unavailable/);
  assert.equal(document.querySelectorAll('dialog[open]').length,1);assert.equal(updates,0);
  await act(async()=>overlay.querySelector('form')!.dispatchEvent(new ctx.dom.window.Event('submit',{bubbles:true,cancelable:true})));
  assert.equal(document.querySelector('dialog[open]'),null);assert.equal(updates,1);assert.equal(document.activeElement?.textContent,'Dispute result');
 }finally{await ctx.close();}
});

test('compact recording actions preserve unresolved replacement and Emperor-only disputed replacement',async()=>{
 const ctx=await setup();const {data,props,root}=ctx;
 const game=data.games[0];game.replay={statisticsState:'READY',statisticsId:'a'.repeat(64)};
 const player={...props,snapshot:{...props.snapshot,viewer:{...props.snapshot.viewer!,role:'PLAYER' as const}}};
 try{
  game.result=null;game.status='AWAITING_CONFIRMATION';
  await act(async()=>root.render(React.createElement(BattleDetails,{...player,data})));
  assert.match(document.querySelector('.battle-recording-action')!.textContent!,/Replace unresolved recording/);
  game.result={revision:1,winningPlayerIds:[data.match.participants[1].playerId]};game.status='COMPLETED';game.resultDisputeOpen=true;
  await act(async()=>root.render(React.createElement(BattleDetails,{...player,data})));
  assert.equal(document.querySelector('.battle-upload-button'),null,'participants cannot replace an official disputed result');
  assert.equal(document.querySelector('.battle-accomplishments'),null,'current dispute immediately suppresses old qualified cards');
  const admin={...props,snapshot:{...props.snapshot,viewer:{...props.snapshot.viewer!,role:'ADMIN' as const}}};
  await act(async()=>root.render(React.createElement(BattleDetails,{...admin,data})));
  assert.match(document.querySelector('.battle-recording-action')!.textContent!,/Replace disputed recording/);
  assert.match(document.querySelector('.game-panel')!.textContent!,/Emperor.*Battle controls/);
 }finally{await ctx.close();}
});


test('Battle Ledger reads single-Game Season values, preserves unknowns and zeroes, and adapts allied metrics',async()=>{
 const ctx=await setup();const {root,repository}=ctx;
 const dataset=await repository.statisticsExperience({matchId:'sample-duel'}),game=dataset.games[0];
 const player=game.players[0];player.values.farmsPlaced=0;delete player.values.villagers20;player.unavailable.villagers20='Recording stopped before 20:00.';
 player.values.total=12345;player.values.apm=NaN;
 try{
  await act(async()=>root.render(React.createElement(BattleStatistics,{game,preview:false,provisional:true,openPlayer:()=>{}})));
  assert.match(document.querySelector('.sx-notice')!.textContent!,/Provisional/);
  await ctx.click('Economy');
  const cells=(id:string)=>[...document.querySelectorAll(`[data-metric="${id}"] td button`)];
  const names=[...document.querySelectorAll('thead th button')].map(button=>button.textContent);
  const index=names.indexOf(player.name);
  assert.equal(cells('total')[index].textContent,'12345','uses the selected Game value without aggregation');
  assert.equal(cells('farmsPlaced')[index].textContent,'0','observed zero is preserved');
  assert.equal(cells('villagers20')[index].textContent,'—','absent value stays unavailable');
  await act(async()=>{(cells('villagers20')[index] as HTMLButtonElement).focus();(cells('villagers20')[index] as HTMLButtonElement).click();});
  assert.match(document.querySelector('[aria-label="Statistic evidence"]')!.textContent!,/Recording stopped before 20:00/);
  assert.equal(document.activeElement,document.querySelector('[aria-label="Statistic evidence"]'));
  await ctx.click('Military');
  assert.equal(document.querySelector('[data-metric="cooperation"]'),null,'duels do not present team-only rows');
  await ctx.click('Execution');assert.equal(cells('apm')[index].textContent,'—','nonfinite values stay unavailable');
  game.players[1].team=game.players[0].team;player.values.assistsOut=3;
  await act(async()=>root.render(React.createElement(BattleStatistics,{game,preview:false,provisional:false,openPlayer:()=>{}})));
  await ctx.click('Military');assert.equal(document.querySelectorAll('tbody tr[data-metric]').length,8);
  assert.ok(document.querySelector('[data-metric="cooperation"]'));assert.ok(document.querySelector('[data-metric="assistsOut"]'));
  assert.equal(document.querySelector('[data-metric="castles"]'),null);
 }finally{await ctx.close();}
});
