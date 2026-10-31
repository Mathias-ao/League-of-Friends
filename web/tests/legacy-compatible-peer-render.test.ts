import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {METRICS,type GameStatistics} from '../src/domain/statistics';
import {StatisticsPanel} from '../src/ui/StatisticsDashboardLegacy';

function game(index:number,model:string,playerIds=['a','b']):GameStatistics{
  return {version:'controlled',matchId:'battle'+index,gameId:'G1',seasonId:'s',eventId:null,
    format:'ONE_V_ONE',contextKey:'standard',orderAtMs:index+1,revision:1,sourceHash:'hash'+index,
    eligible:true,exclusionReason:null,affectsSeason:true,affectsLifetime:true,durationMs:1800000,
    players:playerIds.map(id=>({playerId:id,name:id.toUpperCase(),team:null,civilization:null,
      opening:null,mainUnit:null,values:{...Object.fromEntries(METRICS.map(metric=>[metric.id,null])),forward:model==='new'?1:id==='a'?9:7},
      models:{forward:model},unavailable:{},composition:null,responseTimes:[],byAge:{},details:[]})),
    episodes:[],evidenceTruncated:false,warnings:[]};
}

test('legacy display and source docket use the shared qualified method beside its leader',async()=>{
  const dom=new JSDOM('<div id="app"></div>',{url:'http://localhost/'});
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,
    localStorage:dom.window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
  dom.window.HTMLElement.prototype.scrollIntoView=()=>{};
  localStorage.setItem('aof-statistics-category','Map Presence');
  const {createRoot}=await import('react-dom/client'),root=createRoot(document.getElementById('app')!);
  const shared=Array.from({length:5},(_,i)=>game(i,'old')),
    separate=Array.from({length:6},(_,i)=>game(i+5,'new',['a'])),visited:string[]=[];
  const props={preview:true,openMatch:(id:string)=>visited.push(id),openPlayer:()=>{}};
  const row=()=>[...document.querySelectorAll('.sx-season-table tbody tr')].find(element=>
    element.querySelector('th')?.textContent?.startsWith('Forward placements'))!;
  try{
    await act(async()=>root.render(React.createElement(StatisticsPanel,{...props,games:[...shared,...separate]})));
    const leader=row().querySelector<HTMLButtonElement>('.sx-leading button');assert.ok(leader);
    assert.equal(leader.querySelector('.sx-value-main')?.textContent,'9');
    assert.match(leader.textContent??'',/5\/11 Games.*Compatible model only/);
    await act(async()=>leader.click());
    const docket=document.querySelector('.sx-inspector')!;
    assert.match(docket.textContent??'',/5 of 11 Games contribute\. Source model: old\. Excluded incompatible methods: new\./);
    const excluded=[...docket.querySelectorAll<HTMLButtonElement>('.sx-source-list button')].filter(button=>
      button.textContent?.includes('Excluded: incompatible method'));
    assert.equal(excluded.length,6,'excluded observations remain individually inspectable');
    await act(async()=>excluded[0].click());assert.equal(visited[0],'battle5');
    shared[4].players[0].values.forward=null;
    await act(async()=>root.render(React.createElement(StatisticsPanel,{...props,games:[...shared,...separate]})));
    assert.equal(row().querySelector('.sx-leading'),null,'four old-method observations cannot earn a shared lead');
  }finally{await act(async()=>root.unmount());dom.window.close();}
});

test('same-method age sources distinguish five contributing Standard Games from six excluded opportunities',async()=>{
  const dom=new JSDOM('<div id="app"></div>',{url:'http://localhost/'});
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,
    localStorage:dom.window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
  dom.window.HTMLElement.prototype.scrollIntoView=()=>{};
  localStorage.setItem('aof-statistics-category','Opening');
  const {createRoot}=await import('react-dom/client'),root=createRoot(document.getElementById('app')!);
  const standard=Array.from({length:5},(_,i)=>game(i,'old')),
    unrelated=Array.from({length:6},(_,i)=>game(i+5,'old',['a']));
  const start={status:'VERIFIED_SOURCE',startMode:'STANDARD',startingAge:'DARK',startingTownCenters:1,
    resourceMode:'STANDARD',gameSpeed:'NORMAL',environment:'LAND',patch:'P1',evidenceVersion:'start-v1'};
  for(const g of standard)for(const p of g.players){p.values.castle=p.playerId==='a'?600000:800000;p.models.castle='old';}
  for(const g of unrelated)for(const p of g.players){p.values.castle=200000;p.models.castle='old';}
  for(const g of standard)Object.assign(g,{startOpportunity:{...start}});
  const props={preview:true,openMatch:()=>{},openPlayer:()=>{}};
  const row=()=>[...document.querySelectorAll('.sx-season-table tbody tr')].find(element=>
    element.querySelector('th')?.textContent?.startsWith('Castle'))!;
  try{
    for(const opportunity of ['Nomad','Unknown']){
      for(const g of unrelated)Object.assign(g,{startOpportunity:opportunity==='Nomad'?{...start,startMode:'NOMAD',startingTownCenters:0}:null});
      await act(async()=>root.render(React.createElement(StatisticsPanel,{...props,games:[...standard,...unrelated]})));
      const leader=row().querySelector<HTMLButtonElement>('.sx-leading button');assert.ok(leader);
      assert.equal(leader.querySelector('.sx-value-main')?.textContent,'10:00');
      await act(async()=>leader.click());
      const docket=document.querySelector('.sx-inspector')!;
      assert.match(docket.textContent??'',/5 of 11 Games contribute\. Source model: old\./);
      const sources=[...docket.querySelectorAll<HTMLButtonElement>('.sx-source-list button')];
      assert.equal(sources.length,11,'every source stays available');
      assert.equal(sources.filter(button=>button.textContent?.includes('Accepted · Included in selected summary')).length,5);
      const excluded=sources.filter(button=>button.textContent?.includes('Accepted · Excluded: comparison opportunity'));
      assert.equal(excluded.length,6,opportunity+' is an opportunity exclusion, not an incompatible model');
      assert.equal(sources.filter(button=>button.textContent?.includes('incompatible method')).length,0);
      assert.ok(excluded.every(button=>Number(button.textContent?.match(/battle(\d+)/)?.[1])>=5));
    }
  }finally{await act(async()=>root.unmount());dom.window.close();}
});
