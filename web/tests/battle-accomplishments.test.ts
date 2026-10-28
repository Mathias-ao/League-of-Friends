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
 const root=createRoot(document.getElementById('app')!);
 const paint=async(game:GameStatistics,data:MatchDetail)=>{await act(async()=>
   root.render(React.createElement(BattleAccomplishments,{game,data,preview:false})));
   return [...document.querySelectorAll('.battle-accomplishments li')];};
 const close=async()=>{await act(async()=>root.unmount());dom.window.close();};
 return {paint,close};
}

test('UI renders four source-current Battle cards when official winner is pending',async()=>{
 const ctx=await mounted();
 try{
  const {game,data}=sourceCase();
  const cards=await ctx.paint(game,data);
  assert.equal(cards.length,4,'single Game has at most four qualified cards');
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
