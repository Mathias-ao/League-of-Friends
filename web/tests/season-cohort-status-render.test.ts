import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {PreviewLeagueRepository} from '../src/data/PreviewLeagueRepository';
import {SeasonStatisticsView} from '../src/ui/StatisticsDashboard';
import type {GameStatistics,PlayerMeasurement,StatisticsDataset} from '../src/domain/statistics';

function player(id:string,execution:number,model='execution-v1'):PlayerMeasurement{
  return {playerId:id,name:id.toUpperCase(),team:null,civilization:'Franks',
    opening:null,mainUnit:null,values:{buildOrderExecution:execution,unitRequests:10},
    models:{buildOrderExecution:model,unitRequests:'queue-v1'},unavailable:{},
    composition:null,responseTimes:[],byAge:{},details:[]};
}
function game(id:string,players:PlayerMeasurement[]):GameStatistics{
  return {version:'test',matchId:id,gameId:'G1',seasonId:'S001',eventId:null,
    format:'ONE_V_ONE',contextKey:'ordinary',orderAtMs:1,revision:1,sourceHash:id,
    eligible:true,exclusionReason:null,affectsSeason:true,affectsLifetime:true,
    durationMs:1800000,players,episodes:[],evidenceTruncated:false,warnings:[]};
}
async function rendered(games:GameStatistics[],inspect:()=>Promise<void>){
  const dom=new JSDOM('<main id="app"></main>',{url:'http://localhost/#statistics'});
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,
    localStorage:dom.window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
  const {createRoot}=await import('react-dom/client');
  const root=createRoot(document.getElementById('app')!);
  const repo=new PreviewLeagueRepository();
  await repo.signIn();await repo.requestMembership('Tester','','K7M4Q9');
  const snapshot=await repo.load();
  repo.statisticsExperience=async()=>({version:'test',unavailableGames:0,games}) as StatisticsDataset;
  try{
    await act(async()=>{root.render(React.createElement(SeasonStatisticsView,{
      repository:repo,snapshot,preview:true,openMatch:()=>{},openPlayer:()=>{}
    }));await new Promise(resolve=>setTimeout(resolve,0));});
    await inspect();
  }finally{await act(async()=>root.unmount());dom.window.close();}
}
async function click(element:Element|null|undefined){
  assert.ok(element);
  await act(async()=>{(element as HTMLElement).click();await Promise.resolve();});
}
const valueButton=(name:string,metric:string)=>[...document.querySelectorAll<HTMLButtonElement>('.sx-season-table .sx-value-button')]
  .find(button=>button.getAttribute('aria-label')?.includes(name+', '+metric+':'));
const docket=()=>document.querySelector('[aria-label="Statistic evidence"]')?.textContent??'';

test('complete veterans retain a visible scoped cohort lead despite newcomer and missing sibling',async()=>{
  const games=Array.from({length:5},(_,index)=>game('complete'+index,[player('a',90),player('b',70)]));
  games.push(game('newcomer',[player('c',150)]));
  const partial=game('missing-sibling',[player('a',120)]);
  partial.knownGameIds=['G1','G2'];partial.gameManifestComplete=false;
  games.push(partial);
  const pending=game('pending-result',[player('d',55)]);
  pending.knownGameIds=['G1','G2'];pending.gameManifestComplete=false;
  pending.eligible=false;pending.sourceMeasurementsEligible=true;
  pending.exclusionReason='Official Game result pending';
  games.push(pending);
  await rendered(games,async()=>{
    const a=valueButton('A','Build Order Execution'),b=valueButton('B','Build Order Execution');
    const c=valueButton('C','Build Order Execution'),d=valueButton('D','Build Order Execution');
    assert.ok(a&&b&&c&&d,'all independently measured players remain in the table');
    assert.match(a.textContent??'',/90/);
    assert.match(a.textContent??'',/5\/6 complete Battles/,'an incomplete sixth Battle is disclosed, not treated as a sixth complete Battle');
    assert.match(a.textContent??'',/Cohort leader/);
    assert.match(a.getAttribute('aria-label')??'',/Verified cohort leader.*2 qualified players/);
    assert.doesNotMatch(b.textContent??'',/Cohort leader/);
    assert.match(c.textContent??'',/Provisional.*1\/5 Battles/,'one-Battle newcomer is visible but cannot lead');
    assert.match(d.textContent??'',/Insufficient coverage/,'a pending incomplete Battle remains a visible observation, not a qualifying sample');
    assert.match(d.textContent??'',/0\/1 complete Battles/);
    assert.doesNotMatch(c.textContent??'',/Cohort leader/);
    await click(a);
    assert.match(docket(),/Verified cohort leader.*2 qualified players/);
    assert.match(docket(),/5\/6 complete Battles/);
    assert.match(docket(),/Absolute Season leader not declared/);
    await click(document.querySelector('[aria-label="Close evidence"]'));
    await click(c);
    assert.match(docket(),/Provisional.*1 of 5 complete comparable Battles/);
    await click(document.querySelector('[aria-label="Close evidence"]'));
    await click(d);
    assert.match(docket(),/Insufficient coverage.*0 of 5 complete comparable Battles/);
    assert.match(docket(),/Official result pending/);
  });
});

test('all-qualified tie does not mint a leader and model isolation does not silently claim one',async()=>{
  const tied=Array.from({length:5},(_,index)=>game('equal'+index,[player('a',90),player('b',90)]));
  await rendered(tied,async()=>{
    const a=valueButton('A','Build Order Execution');
    assert.ok(a);
    assert.equal(document.querySelectorAll('.sx-season-table .sx-lead-seal').length,0);
    assert.match(a.textContent??'',/Qualified tie/);
    await click(a);
    assert.match(docket(),/Qualified tie.*no distinct cohort leader/);
  });
  const split=Array.from({length:5},(_,index)=>game('split'+index,[player('a',90,'v1'),player('b',70,'v2')]));
  await rendered(split,async()=>{
    const a=valueButton('A','Build Order Execution');
    assert.ok(a);
    assert.equal(document.querySelectorAll('.sx-season-table .sx-lead-seal').length,0);
    assert.match(a.textContent??'',/No comparable peers/);
    await click(a);
    assert.match(docket(),/Insufficient coverage.*No compatible qualified peer group/);
  });
});

test('another fully qualified method cohort is not misreported as having no peers',async()=>{
  const old=Array.from({length:5},(_,index)=>game('old'+index,[player('a',90,'old'),player('b',70,'old')]));
  const next=Array.from({length:5},(_,index)=>game('new'+index,[player('c',60,'new'),player('d',50,'new')]));
  await rendered([...old,...next],async()=>{
    const a=valueButton('A','Build Order Execution'),c=valueButton('C','Build Order Execution');
    assert.ok(a&&c);
    assert.match(a.textContent??'',/Cohort leader/);
    assert.match(c.textContent??'',/Different model cohort/);
    assert.doesNotMatch(c.textContent??'',/No comparable peers/);
    await click(c);
    assert.match(docket(),/different measurement model.*cannot be ranked against/);
  });
});

test('All-time evidence calls Game sums Season-scoped, never Battle-summed or lifetime-wide',async()=>{
  const first=game('series',[player('a',90)]);
  const second=game('series',[player('a',90)]);
  second.gameId='G2';second.sourceHash='series:G2';
  await rendered([first,second],async()=>{
    await click([...document.querySelectorAll('button')].find(button=>button.textContent==='All-time'));
    await click([...document.querySelectorAll('button')].find(button=>button.textContent==='Military'));
    const value=valueButton('A','Military Units Queued');
    assert.ok(value);
    await click(value);
    assert.match(docket(),/Cumulative total of accepted compatible Game contributions in the selected Season/);
    assert.match(docket(),/1\/1 eligible Battles · 2\/2 compatible Games · 1\/1 complete Battles/);
  });
});
