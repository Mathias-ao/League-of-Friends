import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {PreviewLeagueRepository} from '../src/data/PreviewLeagueRepository';
import {SeasonStatisticsExperience,seasonMetricsFor} from '../src/domain/seasonStatistics';
import {SeasonStatisticsView} from '../src/ui/StatisticsDashboard';

const expected={
  Opening:['Feudal Age','Castle Age','Imperial Age','Build Order Execution','Villagers @10','First Military Unit','Dark Age TC Idle','Walls Before Feudal','Loom Timing','Houses Before Feudal','Dark Age Action Gap','First Mining Camp','First Lumber Camp','Wall Style','Commands @5','Scout Coverage @5'],
  Economy:['Villagers Trained','Villagers @20','Town Centers','2nd TC Timing','Economy Buildings','Resources Committed','Horse Collar Timing','Farms Placed','Farms Before Castle','Boars Lured','Eco : Military @20','Economy Techs','Houses Built','Market Sales','Market Purchases','Trade Units Trained','Tribute Sent','Tribute Received'],
  Military:['Military Units Trained','Military Unit Commitment','Military Buildings @ Castle','Battles Fought','Battle Time','Great Battles','Raids Initiated','Raids Received','Reinforcements Sent','Cooperative Attacks','Defensive Assists','Castles','First Castle','Military Techs','Blacksmith Techs @30','Army Commitment @10','Army Commitment @15','Army Commitment @20'],
  'Map Presence':['Command Map Coverage','Enemy-Side Presence','Enemy Base Contact','Forward Buildings','Forward Eco','Expansion Zones','Wall Tiles','Towers','Gold Control','Relics Touched','First Relic Touch'],
  Execution:['APM','First Command','Longest Inactivity','Raid Response','Garrisons During Raids','Economy Actions in Battles','Town Bell','Back to Work'],
} as const;

test('Season catalogue is the approved royal-archive ledger',()=>{
  for(const [category,labels] of Object.entries(expected))assert.deepEqual(seasonMetricsFor(category as keyof typeof expected).map(metric=>metric.label),labels);
});

test('Season Statistics renders tactical families, records, quiet controls and team eligibility',async()=>{
  const dom=new JSDOM('<div id="app"></div>',{url:'http://localhost/#statistics'});
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,localStorage:dom.window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
  dom.window.HTMLElement.prototype.scrollIntoView=()=>{};
  const {createRoot}=await import('react-dom/client');
  const root=createRoot(document.getElementById('app')!);
  const repo=new PreviewLeagueRepository();await repo.signIn();await repo.requestMembership('Tester','','K7M4Q9');const snapshot=await repo.load();
  const click=async(element:Element|null)=>{assert.ok(element);await act(async()=>{(element as HTMLElement).click();await Promise.resolve();});};
  const category=(label:string)=>[...document.querySelectorAll('.sx-tabs button')].find(button=>button.textContent===label)??null;
  const visibleLabels=()=>[...document.querySelectorAll('.sx-season-table .sx-metric-title')].map(node=>node.textContent?.replace('',''));
  const row=(label:string)=>[...document.querySelectorAll('.sx-season-table tbody tr')].find(tr=>tr.querySelector('.sx-metric-title')?.textContent?.startsWith(label))??null;
  try{
    await act(async()=>{root.render(React.createElement(SeasonStatisticsView,{repository:repo,snapshot,preview:true,openMatch:()=>{},openPlayer:()=>{}}));await new Promise(resolve=>setTimeout(resolve,0));});

    assert.ok(document.querySelector('.sx-archive-records'));
    assert.equal(document.querySelector('.sx-scope-switch button[aria-pressed="true"]')?.textContent,'Per Battle');
    assert.match(document.querySelector('.sx-record-plaque-grid')?.textContent??'',/Fastest Feudal/);
    assert.match(document.querySelector('.sx-season-table')?.textContent??'',/Age Progression/);

    for(const [group,labels] of Object.entries(expected)){
      await click(category(group));
      const visible=[...document.querySelectorAll('.sx-season-table .sx-metric-title')].map(node=>node.textContent?.replace(/\s+/g,' ').trim());
      assert.deepEqual(visible,[...labels],`${group} should contain only the approved rows`);
    }

    await click(category('Opening'));
    assert.match(row('First Military Unit')?.textContent??'',/(Scout Cavalry|Archer|Spearman|Militia)/);
    assert.match(row('Wall Style')?.textContent??'',/(Open|Partially Walled|Fully Walled)/);

    await click(category('Economy'));
    const tradeRow=row('Trade Units Trained');await click(tradeRow?.querySelector('td button')??null);
    const evidence=document.querySelector('[aria-label="Statistic evidence"]');assert.ok(evidence);
    assert.match(evidence.textContent??'',/Team eligibility requires a same-team ally/);
    assert.match(evidence.textContent??'',/Not eligible for this Season metric/);
    await click(document.querySelector('[aria-label="Close evidence"]'));

    await click(category('Map Presence'));
    assert.ok(row('Expansion Zones'));
    assert.equal(row('First Aggression'),null);
    assert.match(document.querySelector('.sx-record-plaque-grid')?.textContent??'',/Widest Reach/);

    const method=document.querySelector('.sx-method-eligibility');assert.ok(method);
    assert.match(method.textContent??'',/Method & eligibility/);
  }finally{await act(async()=>root.unmount());dom.window.close();}
});

test('All-time mode totals additive rows but keeps point-in-time measurements normalized',async()=>{
  const repo=new PreviewLeagueRepository();await repo.signIn();await repo.requestMembership('Tester','','K7M4Q9');
  const dataset=await repo.statisticsExperience({seasonId:'S001'}),engine=new SeasonStatisticsExperience(dataset.games);
  const perBattle=engine.aggregate('perBattle').find(row=>row.playerId==='sample-you')!,allTime=engine.aggregate('allTime').find(row=>row.playerId==='sample-you')!;
  const eligible=engine.games.filter(game=>game.players.some(player=>player.playerId==='sample-you'));
  const rawVillagers=eligible.map(game=>game.players.find(player=>player.playerId==='sample-you')!.values.villagerRequests!).filter(value=>value!=null);
  assert.equal(perBattle.values.villagerRequests.value,rawVillagers.reduce((sum,value)=>sum+value,0)/rawVillagers.length);
  assert.equal(allTime.values.villagerRequests.value,rawVillagers.reduce((sum,value)=>sum+value,0));
  assert.equal(allTime.values.villagers20.value,perBattle.values.villagers20.value,'point-in-time Villagers @20 should not be summed');
  const rawGreat=eligible.map(game=>game.players.find(player=>player.playerId==='sample-you')!.values.greatBattles??0);
  assert.equal(perBattle.values.greatBattles.value,rawGreat.reduce((sum,value)=>sum+value,0));
});
