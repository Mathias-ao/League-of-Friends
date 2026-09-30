import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {PreviewLeagueRepository} from '../src/data/PreviewLeagueRepository';
import {SeasonStatisticsView} from '../src/ui/StatisticsDashboard';

test('Record Cabinet ignores Comparison and display mode, while Format selects the record class',async()=>{
  const dom=new JSDOM('<div id="app"></div>',{url:'http://localhost/#statistics'});
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,localStorage:dom.window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
  dom.window.HTMLElement.prototype.scrollIntoView=()=>{};
  const {createRoot}=await import('react-dom/client');
  const root=createRoot(document.getElementById('app')!);
  const repo=new PreviewLeagueRepository();
  await repo.signIn();await repo.requestMembership('Tester','','K7M4Q9');const snapshot=await repo.load();
  const change=async(element:Element,value:string)=>{await act(async()=>{const select=element as HTMLSelectElement;select.value=value;select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));await Promise.resolve();});};
  const click=async(element:Element|null)=>{assert.ok(element);await act(async()=>{(element as HTMLElement).click();await Promise.resolve();});};
  try{
    await act(async()=>{root.render(React.createElement(SeasonStatisticsView,{repository:repo,snapshot,preview:true,openMatch:()=>{},openPlayer:()=>{}}));await new Promise(resolve=>setTimeout(resolve,0));});
    const filters=[...document.querySelectorAll('.sx-quiet-filters select')];assert.equal(filters.length,2);
    const format=filters[0] as HTMLSelectElement,comparison=filters[1] as HTMLSelectElement;
    assert.ok(document.querySelector('.sx-league-records'));
    assert.match(document.querySelector('.sx-records-heading')?.textContent??'',/League Record Cabinet/);
    const leagueRecords=document.querySelector('.sx-record-plaque-grid')?.textContent??'';
    assert.doesNotMatch(leagueRecords,/Narrow scope/i);
    assert.match(leagueRecords,/Fastest Feudal/);

    assert.ok(comparison.options.length>1,'preview should expose more than one approved comparison context');
    await change(comparison,comparison.options[1].value);
    assert.equal(document.querySelector('.sx-record-plaque-grid')?.textContent??'',leagueRecords,'Comparison must not narrow League records');

    await click([...document.querySelectorAll('.sx-scope-switch button')].find(button=>button.textContent==='All-time')??null);
    assert.equal(document.querySelector('.sx-record-plaque-grid')?.textContent??'',leagueRecords,'Per Battle / All-time must not alter records');

    await change(format,'TWO_V_TWO');
    assert.ok(document.querySelector('.sx-format-records'));
    assert.match(document.querySelector('.sx-records-heading')?.textContent??'',/2v2 Records/);
    assert.ok(document.querySelector('.sx-record-benchmark'),'format records should show the absolute League benchmark');
    const updatedFilters=[...document.querySelectorAll('.sx-quiet-filters select')];
    assert.equal((updatedFilters[1] as HTMLSelectElement).value,'all','changing Format should reset only the ledger Comparison scope');
  }finally{await act(async()=>root.unmount());dom.window.close();}
});
