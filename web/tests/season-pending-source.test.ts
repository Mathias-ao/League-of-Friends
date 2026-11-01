import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {SeasonStatisticsExperience} from '../src/domain/seasonStatistics';
import {PreviewLeagueRepository} from '../src/data/PreviewLeagueRepository';
import {SeasonStatisticsView} from '../src/ui/StatisticsDashboard';
import {syncStatisticsRuntimePolish} from '../src/statistics-runtime-fixes';
import type {GameStatistics} from '../src/domain/statistics';

function pending():GameStatistics{
  return{version:'controlled',matchId:'Pending Battle',gameId:'G1',seasonId:'s',eventId:null,
    format:'ONE_V_ONE',contextKey:'ordinary',orderAtMs:0,revision:1,sourceHash:'a'.repeat(64),
    eligible:false,exclusionReason:'Official Game result pending',sourceMeasurementsEligible:true,
    knownGameIds:['G1'],gameManifestComplete:true,affectsSeason:true,affectsLifetime:true,durationMs:1800000,
    players:[{playerId:'runner',name:'Runner',team:null,civilization:'Franks',opening:null,mainUnit:null,
      values:{apm:42},models:{apm:'controlled-execution-v1'},unavailable:{},composition:null,responseTimes:[],byAge:{},details:[]}],
    episodes:[],evidenceTruncated:false,warnings:[]};
}
test('controlled pending source measurements enter Season aggregation while record eligibility stays unchanged',()=>{
  const game=pending(),engine=new SeasonStatisticsExperience([game]);
  assert.equal(engine.aggregate()[0].values.apm.value,42);assert.deepEqual(engine.records(),[]);
  game.gameManifestComplete=false;
  assert.equal(new SeasonStatisticsExperience([game]).aggregate()[0].values.apm.completeBattles,0);
  game.sourceMeasurementsEligible=false;
  assert.deepEqual(new SeasonStatisticsExperience([game]).aggregate(),[]);
  game.sourceMeasurementsEligible=true;game.exclusionReason='Result disputed';
  assert.deepEqual(new SeasonStatisticsExperience([game]).aggregate(),[]);
});
test('accepted source projection takes precedence over its pending duplicate in either input or chronology order',()=>{
  for(const acceptedFirst of [false,true])for(const pendingEarlier of [false,true]){
    const waiting=pending();waiting.matchId='pending-duplicate';waiting.orderAtMs=pendingEarlier?0:2000;
    const accepted={...pending(),matchId:'accepted-source',orderAtMs:1000,eligible:true,
      exclusionReason:null,sourceMeasurementsEligible:false};
    const engine=new SeasonStatisticsExperience(acceptedFirst?[accepted,waiting]:[waiting,accepted]);
    assert.equal(engine.games.length,1,'one original source never becomes two historical samples');
    assert.equal(engine.games[0].matchId,'accepted-source');
    assert.equal(engine.aggregate()[0].values.apm.samples,1);
    assert.equal(engine.records().find(record=>record.metricId==='apm')?.matchId,'accepted-source',
      'a measurement-only duplicate must not hide a legitimately eligible record');
  }
});
test('controlled Season UI shows pending measurement, current source and honest chronology without claiming its record',async()=>{
  const dom=new JSDOM('<main id="app"></main>',{url:'http://localhost/#statistics'});
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,
    localStorage:dom.window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
  localStorage.setItem('aof-statistics-category','Execution');
  const {createRoot}=await import('react-dom/client'),root=createRoot(document.getElementById('app')!);
  const repo=new PreviewLeagueRepository();await repo.signIn();await repo.requestMembership('Tester','','K7M4Q9');
  const snapshot=await repo.load(),game=pending();
  repo.statisticsExperience=async()=>({version:'controlled',games:[game],unavailableGames:0});
  const render=async()=>act(async()=>{root.render(React.createElement(SeasonStatisticsView,{
    repository:repo,snapshot,preview:false,openMatch:()=>{},openPlayer:()=>{}
  }));await new Promise(resolve=>setTimeout(resolve,0));});
  try{
    await render();
    const metric=[...document.querySelectorAll<HTMLButtonElement>('.sx-season-table .sx-value-button')]
      .find(button=>button.getAttribute('aria-label')?.includes('Runner, Raw APM: 42'));
    assert.ok(metric,'42 APM must not disappear while the official result is pending');
    assert.match(document.querySelector('.sx-toolbar-meta')?.textContent??'',/1 official result pending/);
    assert.equal(document.querySelectorAll('button.sx-record-plaque').length,0,'pending measurement cannot claim a provisional record');
    syncStatisticsRuntimePolish();
    assert.equal(document.querySelectorAll('.sx-value-best').length,0,'pending measurement cannot become the private best presentation');
    await act(async()=>metric.click());
    const docket=document.querySelector('[aria-label="Statistic evidence"]');
    assert.match(docket?.textContent??'',/Official result pending · Included in Battle summary/);
    assert.match(docket?.textContent??'',/Battle date pending/);assert.doesNotMatch(docket?.textContent??'',/1970/);
  }finally{await act(async()=>root.unmount());dom.window.close();}
});
