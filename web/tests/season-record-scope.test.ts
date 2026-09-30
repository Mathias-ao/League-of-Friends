import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {PreviewLeagueRepository} from '../src/data/PreviewLeagueRepository';
import {SeasonStatisticsView} from '../src/ui/StatisticsDashboard';
import {syncStatisticsRuntimePolish} from '../src/statistics-runtime-fixes';

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
    assert.equal(document.querySelector('.sx-record-plaque-grid')?.textContent??'',leagueRecords,'Per Battle / All-time must not alter ordinary Battle records');

    // Aggregate Season records are compared against the all-settings All-time ledger.
    // The record cabinet intentionally ignores Comparison, so reset the ledger here
    // before asserting that holder/value/tie semantics match the visible totals.
    await change(comparison,'all');
    await click([...document.querySelectorAll('.sx-tabs button')].find(button=>button.textContent==='Military')??null);
    const playerNames=[...document.querySelectorAll('.sx-season-table thead .sx-player-name')].map(node=>node.textContent?.trim()??'');
    const rowFor=(label:string)=>[...document.querySelectorAll<HTMLTableRowElement>('.sx-season-table tbody tr')].find(row=>row.querySelector('.sx-metric-title')?.textContent?.trim().startsWith(label));
    const recordFor=(label:string)=>[...document.querySelectorAll<HTMLButtonElement>('button.sx-record-plaque')].find(card=>card.querySelector('strong')?.textContent?.trim()===label);
    for(const [recordLabel,rowLabel] of [['Most Battles','Battles Fought'],['Most Castles','Castles']] as const){
      const row=rowFor(rowLabel);assert.ok(row);
      const totals=[...row.querySelectorAll('td')].map((cell,index)=>({value:Number(cell.querySelector('.sx-value-main')?.textContent),name:playerNames[index]})).filter(item=>Number.isFinite(item.value));
      const maximum=Math.max(...totals.map(item=>item.value));
      const expectedHolders=totals.filter(item=>item.value===maximum).map(item=>item.name);
      const card=recordFor(recordLabel);assert.ok(card);
      assert.equal(Number(card.querySelector('b')?.textContent),maximum,`${recordLabel} must match the All-time ledger maximum`);
      const holderText=card.querySelector('em')?.textContent??'';
      assert.ok(expectedHolders.some(name=>holderText.startsWith(name)),`${recordLabel} must belong to an actual Season-total leader`);
      if(expectedHolders.length===1)assert.doesNotMatch(holderText,/tied/i,`${recordLabel} must not report a false tie`);
      else assert.match(holderText,new RegExp(`${expectedHolders.length} tied`,'i'));
    }

    await click([...document.querySelectorAll('.sx-tabs button')].find(button=>button.textContent==='Opening')??null);
    const info=document.querySelector<HTMLElement>('.sx-metric-info-trigger');assert.ok(info);
    await act(async()=>{info.dispatchEvent(new dom.window.MouseEvent('mouseover',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,520));});
    syncStatisticsRuntimePolish();
    assert.ok(document.body.querySelector('.sx-archive-tooltip-portal'),'metric tooltip should be mirrored outside the clipping ledger');

    await change(format,'TWO_V_TWO');
    assert.ok(document.querySelector('.sx-format-records'));
    assert.match(document.querySelector('.sx-records-heading')?.textContent??'',/2v2 Records/);
    assert.ok(document.querySelector('.sx-record-benchmark'),'format records should show the absolute League benchmark');
    const updatedFilters=[...document.querySelectorAll('.sx-quiet-filters select')];
    assert.equal((updatedFilters[1] as HTMLSelectElement).value,'all','changing Format should reset only the ledger Comparison scope');
  }finally{await act(async()=>root.unmount());dom.window.close();}
});
