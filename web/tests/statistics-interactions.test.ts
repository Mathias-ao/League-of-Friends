import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {PreviewLeagueRepository} from '../src/data/PreviewLeagueRepository';
import {StatisticsPanel,BattleTimeline,SeasonStatisticsView} from '../src/ui/StatisticsDashboard';

test('category switching, aggregation, evidence, source navigation, timeline and asynchronous season loading',async()=>{
  const dom=new JSDOM('<div id="app"></div>',{url:'http://localhost/'});
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,localStorage:dom.window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
  dom.window.HTMLElement.prototype.scrollIntoView=()=>{};
  const {createRoot}=await import('react-dom/client');
  const root=createRoot(document.getElementById('app')!);
  const repo=new PreviewLeagueRepository();await repo.signIn();await repo.requestMembership('Tester','','K7M4Q9');
  const dataset=await repo.statisticsExperience({eventId:'preview-campaign'}),visited:string[]=[];
  const props={games:dataset.games,preview:true,viewerId:'sample-you',openMatch:(id:string)=>visited.push(id),openPlayer:()=>{}};
  const button=(label:string)=>[...document.querySelectorAll('button')].find(b=>b.textContent===label)!;
  const click=async(element:HTMLElement)=>{assert.ok(element);await act(async()=>element.click());};
  try{
    await act(async()=>root.render(React.createElement(StatisticsPanel,props)));
    await click(button('Economy'));
    assert.ok(document.querySelector('section[aria-label="Economy statistics"]'));
    const total=document.querySelector('.sx-table tbody td button')?.textContent;
    await click(button('Per Game'));
    assert.notEqual(document.querySelector('.sx-table tbody td button')?.textContent,total);
    await click(document.querySelector('.sx-table tbody td button')!);
    assert.match(document.querySelector('[aria-label="Statistic evidence"]')!.textContent!,/8 of 8 Games contribute/);
    await click(document.querySelector('.sx-inspector .sx-source-list button')!);assert.equal(visited[0],'preview-battle-1');
    await click(document.querySelector('[aria-label="Close evidence"]')!);assert.equal(document.querySelector('.sx-inspector'),null);
    await click(button('Execution'));assert.equal(document.querySelectorAll('.sx-table thead th').length,6);
    await act(async()=>root.render(React.createElement(BattleTimeline,{game:dataset.games[0]})));
    await click(document.querySelector('.sx-marker')!);assert.ok(document.querySelector('.sx-timeline-selection')?.textContent);
    await act(async()=>root.render(React.createElement(SeasonStatisticsView,{repository:repo,snapshot:await repo.load(),preview:true,openMatch:props.openMatch,openPlayer:props.openPlayer})));
    assert.ok(document.querySelector('.sx-tabs'));
    assert.equal(document.querySelector('[role="alert"]'),null);
  }finally{await act(async()=>root.unmount());dom.window.close();}
});
