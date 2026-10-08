import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {PreviewLeagueRepository} from '../src/data/PreviewLeagueRepository';
import {SeasonStatisticsView} from '../src/ui/StatisticsDashboard';
import {SeasonStatisticsExperience,seasonMetric} from '../src/domain/seasonStatistics';
import {syncStatisticsRuntimePolish} from '../src/statistics-runtime-fixes';

test('Record Cabinet keeps single-Battle records while ledger shows best Battle beneath aggregate results',async()=>{
  const dom=new JSDOM('<div id="app"></div>',{url:'http://localhost/#statistics'});
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,localStorage:dom.window.localStorage,MutationObserver:dom.window.MutationObserver,IS_REACT_ACT_ENVIRONMENT:true});
  dom.window.HTMLElement.prototype.scrollIntoView=()=>{};
  const {createRoot}=await import('react-dom/client');
  const root=createRoot(document.getElementById('app')!);
  const repo=new PreviewLeagueRepository();
  await repo.signIn();await repo.requestMembership('Tester','','K7M4Q9');const snapshot=await repo.load();
  const dataset=await repo.statisticsExperience({seasonId:snapshot.season?.seasonId??'unavailable'});
  const recordEngine=new SeasonStatisticsExperience(dataset.games.filter(game=>game.affectsSeason));
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
    assert.equal(document.querySelector('.sx-record-plaque-grid')?.textContent??'',leagueRecords,'Per Battle / All-time must not alter single-Battle records');

    await change(comparison,'all');
    await click([...document.querySelectorAll('.sx-tabs button')].find(button=>button.textContent==='Military')??null);
    syncStatisticsRuntimePolish();
    const recordFor=(label:string)=>[...document.querySelectorAll<HTMLButtonElement>('button.sx-record-plaque')].find(card=>card.querySelector('strong')?.textContent?.trim()===label);
    for(const [recordLabel,metricId] of [['Most Detected Battles','battlesFought'],['Most Castle Placements','castles']] as const){
      const metric=seasonMetric(metricId),candidates=recordEngine.records().filter(record=>record.metricId===metricId);
      assert.ok(candidates.length,`${recordLabel} should have qualified single-Battle candidates`);
      const extreme=(metric.record==='min'?Math.min:Math.max)(...candidates.map(record=>record.value));
      const holders=[...new Map(candidates.filter(record=>record.value===extreme).map(record=>[record.playerId,record.name] as const)).values()];
      const card=recordFor(recordLabel);assert.ok(card);
      assert.equal(Number(card.querySelector('b')?.textContent),extreme,`${recordLabel} must remain a single-Battle record, not a Season total`);
      const holderText=card.querySelector('em')?.textContent??'';
      assert.ok(holders.some(name=>holderText.startsWith(name)),`${recordLabel} must belong to a single-Battle record holder`);
      if(holders.length===1)assert.doesNotMatch(holderText,/tied/i,`${recordLabel} must not report a false tie`);
      else assert.match(holderText,new RegExp(`${holders.length} tied`,'i'));
      assert.match(card.querySelector('.sx-record-source')?.textContent??'',/Source Battle/i,'single-Battle records retain their source Battle');
    }

    const bestNotes=[...document.querySelectorAll<HTMLElement>('.sx-season-table .sx-value-best')];
    assert.ok(bestNotes.length>0,'qualified numeric table results should expose their best Battle underneath');
    assert.ok(bestNotes.every(note=>/^\(best .+\)$/.test(note.textContent??'')),'best-Battle values should be secondary parenthetical text');

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
