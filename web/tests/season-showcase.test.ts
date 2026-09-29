import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {PreviewLeagueRepository} from '../src/data/PreviewLeagueRepository';
import {SeasonStatisticsView} from '../src/ui/StatisticsDashboard';

test('Season Statistics renders the showcase catalogue and exposes team-only eligibility',async()=>{
  const dom=new JSDOM('<div id="app"></div>',{url:'http://localhost/#statistics'});
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,localStorage:dom.window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
  dom.window.HTMLElement.prototype.scrollIntoView=()=>{};
  const {createRoot}=await import('react-dom/client');
  const root=createRoot(document.getElementById('app')!);
  const repo=new PreviewLeagueRepository();
  await repo.signIn();
  await repo.requestMembership('Tester','','K7M4Q9');
  const snapshot=await repo.load();
  const click=async(element:Element|null)=>{assert.ok(element);await act(async()=>{(element as HTMLElement).click();await Promise.resolve();});};
  const category=(label:string)=>[...document.querySelectorAll('.sx-tabs button')].find(button=>button.textContent===label)??null;
  const row=(label:string)=>[...document.querySelectorAll('.sx-season-table tbody tr')].find(tr=>tr.querySelector('.sx-metric-title')?.textContent===label)??null;
  try{
    await act(async()=>{root.render(React.createElement(SeasonStatisticsView,{repository:repo,snapshot,preview:true,openMatch:()=>{},openPlayer:()=>{}}));await new Promise(resolve=>setTimeout(resolve,0));});

    for(const label of ['Villagers @10 ≈','Commands in first 5 min','Longest Dark Age action gap','First Lumber Camp placement','First Mining Camp placement'])assert.ok(row(label),`Opening row missing: ${label}`);

    await click(category('Economy'));
    for(const label of ['House placements','Trade unit requests','Tribute sent','Tribute received'])assert.ok(row(label),`Economy row missing: ${label}`);
    const tradeRow=row('Trade unit requests');
    await click(tradeRow?.querySelector('td button')??null);
    const evidence=document.querySelector('[aria-label="Statistic evidence"]');
    assert.ok(evidence);
    assert.match(evidence.textContent??'',/Team eligibility requires a same-team ally/);
    assert.match(evidence.textContent??'',/Not eligible for this Season metric/);
    await click(document.querySelector('[aria-label="Close evidence"]'));

    await click(category('Military'));
    assert.ok(row('Military technologies requested'));

    await click(category('Map Presence'));
    assert.ok(row('Enemy-base command contact'));
    assert.ok(row('Expansion TC placements'));
  }finally{
    await act(async()=>root.unmount());
    dom.window.close();
  }
});
