import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {BattleAccomplishments} from '../src/ui/BattleAccomplishments';
import type {GameStatistics} from '../src/domain/statistics';
import type {MatchDetail} from '../src/domain/league';

const HASH='a'.repeat(64);
function sourceCase(){
 const participants=[{playerId:'a',team:1,name:'Archer'},{playerId:'b',team:2,name:'Builder'}];
 const known={raidsOut:10,battlesFought:16,farmsPlaced:80,unitRequests:200,castles:3,
   goldControl:0,castle:null,imperial:null,tributeSent:10000,assistsOut:0,cooperation:0};
 const player=(p:typeof participants[number])=>({...p,civilization:null,opening:null,mainUnit:null,
   values:{...known},models:Object.fromEntries(Object.keys(known).map(k=>[k,'SOURCE_TEST_V1'])),
   unavailable:{},composition:null,responseTimes:[],byAge:{},details:[]});
 const game={version:'AOF_STATISTICS_EXPERIENCE_V3',matchId:'M1',gameId:'G1',
  seasonId:'S1',eventId:'E1',format:'ONE_V_ONE',contextKey:'ONE_V_ONE standard',
  orderAtMs:100,revision:3,sourceHash:HASH,eligible:false,
  exclusionReason:'Official Game result pending',affectsSeason:true,affectsLifetime:true,
  durationMs:2400000,players:participants.map(player),episodes:[],evidenceTruncated:false,warnings:[]} as unknown as GameStatistics;
 const data={match:{matchId:'M1',eventId:'E1',status:'ACTIVE',format:'ONE_V_ONE',participants},
  games:[{gameId:'G1',gameNumber:1,status:'READY',result:null,resultDisputeOpen:false,players:participants,
    replay:{statisticsState:'READY',statisticsId:HASH,statisticsRevision:3}}],
  viewer:{playerId:'a',isParticipant:true}} as unknown as MatchDetail;
 return {game,data};
}
async function mounted(){
 const dom=new JSDOM('<div id="app"></div>',{url:'http://localhost'});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,
  HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 dom.window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
 const root=createRoot(document.getElementById('app')!);
 const paint=async(game:GameStatistics,data:MatchDetail)=>{await act(async()=>
   root.render(React.createElement(BattleAccomplishments,{game,data,preview:false})));
   return [...document.querySelectorAll('.battle-accomplishments li')];};
 const close=async()=>{await act(async()=>root.unmount());dom.window.close();};
 const openEvidence=async(title='Raiding pressure')=>{
  const button=document.querySelector(`button[aria-label="View evidence for ${title}"]`) as HTMLButtonElement|null;
  assert.ok(button,`qualified ${title} card exists`);
  await act(async()=>button.click());
  const dialog=document.querySelector('dialog[open]');
  assert.ok(dialog,'evidence opens');return dialog;
 };
 return {paint,openEvidence,close};
}

test('UI renders four source-current Battle cards when official winner is pending',async()=>{
 const ctx=await mounted();
 try{
  const {game,data}=sourceCase();
  const cards=await ctx.paint(game,data);
  assert.equal(cards.length,4,'single Game has at most four qualified cards');
  assert.equal(document.querySelector('.battle-accomplishments')?.getAttribute('aria-label'),'Battle highlights · Game 1');
  assert.match(document.querySelector('.battle-accomplishments .eyebrow')?.textContent??'',/^BATTLE HIGHLIGHTS · GAME 1$/);
  assert.doesNotMatch(document.querySelector('.battle-accomplishments .eyebrow')?.textContent??'',/DISTINCTIONS/i);
  assert.match(cards[0].textContent??'',/Raiding pressure/);
  assert.ok(cards.every(c=>!/(Emperor defeated|unbeaten|The alliance supplied|Tribute requests)/i.test(c.textContent??'')));
  // Match result not necessary for true source-measurement cards.
  data.games[0].result={revision:4,winningPlayerIds:['b']};
  const qualified={...game,eligible:true,exclusionReason:null};
  assert.equal((await ctx.paint(qualified,data)).length,4);
  data.games[0].replay!.statisticsId='b'.repeat(64);
  assert.equal((await ctx.paint(qualified,data)).length,0,'an old accepted source cannot survive an active pointer correction');
 }finally{await ctx.close();}
});

test('UI fails closed for stale READY pointer, non-READY or disputed source/result',async()=>{
 const ctx=await mounted();
 try{
  const {game,data}=sourceCase(),record=data.games[0];
  assert.ok((await ctx.paint(game,data)).length);
  record.replay!.statisticsId='b'.repeat(64);
  assert.equal((await ctx.paint(game,data)).length,0);
  record.replay!.statisticsId=HASH;record.replay!.statisticsRevision=4;
  assert.equal((await ctx.paint(game,data)).length,0);
  record.replay!.statisticsRevision=3;record.replay!.statisticsState='PENDING';
  assert.equal((await ctx.paint(game,data)).length,0);
  record.replay!.statisticsState='READY';record.resultDisputeOpen=true;
  assert.equal((await ctx.paint(game,data)).length,0);
  record.resultDisputeOpen=false;record.status='DISPUTED';
  assert.equal((await ctx.paint(game,data)).length,0);
  record.status='READY';
  assert.equal((await ctx.paint({...game,exclusionReason:'Result disputed'},data)).length,0);
  assert.equal((await ctx.paint({...game,exclusionReason:'Unqualified source'},data)).length,0);
  assert.equal((await ctx.paint({...game,eligible:false,exclusionReason:null},data)).length,0);
  assert.equal((await ctx.paint({...game,evidenceTruncated:true},data)).length,0);
 }finally{await ctx.close();}
});

test('UI shows corrected Game source independently, withdraws stale or insufficient cards',async()=>{
 const ctx=await mounted();
 try{
  const {game,data}=sourceCase();
  assert.equal((await ctx.paint(game,data)).length,4);
  const revised={...game,revision:4,sourceHash:'c'.repeat(64),
    players:game.players.map(p=>({...p,values:{...p.values,raidsOut:0,battlesFought:0,
      farmsPlaced:0,unitRequests:0,castles:0,tributeSent:6000}}))};
  assert.equal((await ctx.paint(revised,data)).length,0,'corrected source not matched by old pointer');
  data.games[0].replay!.statisticsId=revised.sourceHash;
  data.games[0].replay!.statisticsRevision=4;
  assert.equal((await ctx.paint(revised,data)).length,0,'no metric card or tribute card can be invented');
 }finally{await ctx.close();}
});

test('one canonical multi-Game Battle presents highlights for each selected Game, without mixing Game facts',async()=>{
 const ctx=await mounted();
 try{
  const {game,data}=sourceCase();
  const first=await ctx.paint(game,data);
  assert.equal(first.length,4);
  assert.match(first.map(x=>x.textContent).join(' '),/Raiding pressure/);
  // One parent Battle, two independently sourced Games. Game 2 has no raids,
  // but its other qualified measurements must still be shown.
  const hash2='b'.repeat(64);
  data.games.push({...data.games[0],gameId:'G2',gameNumber:2,
    replay:{statisticsState:'READY',statisticsId:hash2,statisticsRevision:1}});
  const game2={...game,gameId:'G2',revision:1,sourceHash:hash2,
    players:game.players.map(p=>({...p,values:{...p.values,raidsOut:0}}))};
  const second=await ctx.paint(game2,data);
  assert.equal(second.length,4);
  assert.ok(second.every(c=>!(/Raiding pressure/.test(c.textContent??''))),
    'Game 2 does not inherit Game 1 raid episodes');
  assert.equal(document.querySelector('.battle-accomplishments')?.getAttribute('aria-label'),'Battle highlights · Game 2');
  assert.match(document.querySelector('.battle-accomplishments .eyebrow')?.textContent??'',/^BATTLE HIGHLIGHTS · GAME 2$/);
  const back=await ctx.paint(game,data);
  assert.equal(back.length,4);
  assert.match(back.map(x=>x.textContent).join(' '),/Raiding pressure/);
  assert.match(document.querySelector('.battle-accomplishments .eyebrow')?.textContent??'',/GAME 1/);
 }finally{await ctx.close();}
});


test('opened evidence belongs to the selected Game and never returns when switching back',async()=>{
 const ctx=await mounted();
 try{
  const {game,data}=sourceCase();
  await ctx.paint(game,data);
  const dialog=await ctx.openEvidence();
  assert.match(dialog.textContent??'',/10 detected raids/);
  assert.match(dialog.textContent??'',/Game 1 · Recording revision 3/);
  const hash2='b'.repeat(64);
  data.games.push({...data.games[0],gameId:'G2',gameNumber:2,
    replay:{statisticsState:'READY',statisticsId:hash2,statisticsRevision:1}});
  const game2={...game,gameId:'G2',revision:1,sourceHash:hash2,
    players:game.players.map(p=>({...p,values:{...p.values,raidsOut:0}}))};
  assert.equal((await ctx.paint(game2,data)).length,4,'unrelated Game 2 cards remain');
  assert.equal(!!document.querySelector('dialog'),false,'Game 1 evidence is removed, not relabelled Game 2');
  await ctx.paint(game,data);
  assert.equal(!!document.querySelector('dialog'),false,'returning to Game 1 requires a fresh evidence action');
  assert.match((await ctx.openEvidence()).textContent??'',/Game 1 · Recording revision 3/);
 }finally{await ctx.close();}
});

test('opened evidence is revoked by current-source corrections, even while other cards remain',async()=>{
 for(const change of ['hash','revision','hash and revision'] as const){
  const ctx=await mounted();
  try{
   const {game,data}=sourceCase();await ctx.paint(game,data);await ctx.openEvidence();
   const revised={...game,sourceHash:change==='revision'?game.sourceHash:'c'.repeat(64),
     revision:change==='hash'?game.revision:game.revision+1,
     players:game.players.map(p=>({...p,values:{...p.values,raidsOut:0}}))};
   data.games[0].replay!.statisticsId=revised.sourceHash;
   data.games[0].replay!.statisticsRevision=revised.revision;
   assert.equal((await ctx.paint(revised,data)).length,4,change);
   assert.equal(!!document.querySelector('dialog'),false,change+' invalidates old evidence');
   const next=await ctx.openEvidence('Battle-hardened');
   assert.match(next.textContent??'',new RegExp('Recording revision '+revised.revision));
   assert.doesNotMatch(next.textContent??'',/10 detected raids/);
  }finally{await ctx.close();}
 }
});

test('opened evidence cannot survive source withdrawal, dispute or lost eligibility and return',async()=>{
 const changes=[
  (game:GameStatistics,data:MatchDetail)=>{data.games[0].replay!.statisticsState='PENDING';},
  (game:GameStatistics,data:MatchDetail)=>{data.games[0].replay!.statisticsId='f'.repeat(64);},
  (game:GameStatistics,data:MatchDetail)=>{data.games[0].replay!.statisticsRevision=99;},
  (game:GameStatistics,data:MatchDetail)=>{data.games[0].resultDisputeOpen=true;},
  (game:GameStatistics,data:MatchDetail)=>{data.games[0].status='DISPUTED';},
  (game:GameStatistics,data:MatchDetail)=>{game.evidenceTruncated=true;},
  (game:GameStatistics,data:MatchDetail)=>{game.exclusionReason='Unqualified source';},
 ];
 for(const change of changes){
  const ctx=await mounted();
  try{
   const {game,data}=sourceCase();await ctx.paint(game,data);await ctx.openEvidence();
   const lost=structuredClone({game,data});change(lost.game,lost.data);
   assert.equal((await ctx.paint(lost.game,lost.data)).length,0);
   assert.equal(!!document.querySelector('dialog'),false);
   assert.equal((await ctx.paint(game,data)).length,4);
   assert.equal(!!document.querySelector('dialog'),false,'restored source does not resurrect an opened claim');
  }finally{await ctx.close();}
 }
});

test('opened evidence is scoped to the current viewer and participation context',async()=>{
 for(const viewer of [{playerId:'b',isParticipant:true},{playerId:'a',isParticipant:false},{playerId:'',isParticipant:false}]){
  const ctx=await mounted();
  try{
   const {game,data}=sourceCase();await ctx.paint(game,data);await ctx.openEvidence();
   assert.equal((await ctx.paint(game,{...data,viewer})).length,4,'qualified public measurements remain');
   assert.equal(!!document.querySelector('dialog'),false,'prior viewer action does not carry into the next auth context');
   await ctx.paint(game,data);
   assert.equal(!!document.querySelector('dialog'),false,'returning viewer must open evidence again');
  }finally{await ctx.close();}
 }
});


test('opened evidence resets when result qualification or its selected measurement changes',async()=>{
 const ctx=await mounted();
 try{
  const {game,data}=sourceCase();await ctx.paint(game,data);await ctx.openEvidence();
  data.games[0].result={revision:4,winningPlayerIds:['b']};
  const qualified={...game,eligible:true,exclusionReason:null};
  assert.equal((await ctx.paint(qualified,data)).length,4,'confirmed result preserves measured cards');
  assert.equal(!!document.querySelector('dialog'),false,'new qualification requires a fresh evidence action');
  await ctx.openEvidence();
  const missingRaid={...qualified,players:qualified.players.map(p=>({...p,values:{...p.values,raidsOut:0}}))};
  assert.equal((await ctx.paint(missingRaid,data)).length,4,'unrelated cards remain when an item is withdrawn');
  assert.equal(!!document.querySelector('dialog'),false,'a withdrawn selected item cannot retain its opened evidence');
  await ctx.paint(qualified,data);
  assert.equal(!!document.querySelector('dialog'),false,'restoring an item does not reopen it');
 }finally{await ctx.close();}
});
