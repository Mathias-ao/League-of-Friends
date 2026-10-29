import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {PreviewLeagueRepository} from '../src/data/PreviewLeagueRepository';
import {SeasonStatisticsView} from '../src/ui/StatisticsDashboard';
import type {GameStatistics,PlayerMeasurement,StatisticsDataset} from '../src/domain/statistics';

function measured(id:string,apm:number,response:number[],minutes:number):GameStatistics{
  const player:PlayerMeasurement={
    playerId:'runner',name:'Runner',team:null,civilization:'Franks',opening:null,mainUnit:null,
    values:{apm,response:response[Math.floor(response.length/2)]??null},
    models:{apm:'apm-v1',response:'raid-response-v1'},unavailable:{},composition:null,responseTimes:response,byAge:{},details:[]
  };
  return {version:'test',matchId:'Battle 1',gameId:id,seasonId:'S001',eventId:null,format:'ONE_V_ONE',
    contextKey:'ordinary map',orderAtMs:1,revision:1,sourceHash:id,eligible:true,exclusionReason:null,
    affectsSeason:true,affectsLifetime:true,durationMs:minutes*60_000,players:[player],
    episodes:[],evidenceTruncated:false,warnings:[]};
}
test('rendered Per Battle rows expose duration-weighted APM, pooled raid response and Game source proof',async()=>{
  const dom=new JSDOM('<main id="app"></main>',{url:'http://localhost/#statistics'});
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,
    localStorage:dom.window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
  const {createRoot}=await import('react-dom/client');
  const root=createRoot(document.getElementById('app')!);
  const repo=new PreviewLeagueRepository();await repo.signIn();await repo.requestMembership('Tester','','K7M4Q9');
  const snapshot=await repo.load();
  repo.statisticsExperience=async()=>({version:'test',unavailableGames:0,
    games:[measured('G1',120,[2,3,4],10),measured('G2',20,[100],100)]}) as StatisticsDataset;
  try{
    await act(async()=>{root.render(React.createElement(SeasonStatisticsView,{
      repository:repo,snapshot,preview:true,openMatch:()=>{},openPlayer:()=>{}
    }));await new Promise(resolve=>setTimeout(resolve,0));});
    const tab=[...document.querySelectorAll('button')].find(n=>n.textContent==='Execution');assert.ok(tab);
    await act(async()=>{(tab as HTMLElement).click();});
    const buttons=[...document.querySelectorAll<HTMLButtonElement>('.sx-season-table .sx-value-button')];
    const apm=buttons.find(n=>n.getAttribute('aria-label')?.includes('Runner, Raw APM:'));
    const response=buttons.find(n=>n.getAttribute('aria-label')?.includes('Runner, Raid Response:'));
    assert.match(apm?.textContent??'',/29\.1/,'player must see 29.1, not raw Game-average 70');
    assert.match(response?.textContent??'',/3\.5s/,'player must see median 3.5s, not 51.5s');
    assert.match(document.querySelector('.sx-toolbar-meta')?.textContent??'',/1 eligible Battles · 2 Games/);
    await act(async()=>{apm!.click();});
    const docket=document.querySelector('[aria-label="Statistic evidence"]');
    assert.match(docket?.textContent??'',/1\/1 eligible Battles · 2\/2 compatible Games/);
    assert.match(docket?.textContent??'',/Battle 1 \/ G1/);
    assert.match(docket?.textContent??'',/Battle 1 \/ G2/);
  }finally{await act(async()=>root.unmount());dom.window.close();}
});
