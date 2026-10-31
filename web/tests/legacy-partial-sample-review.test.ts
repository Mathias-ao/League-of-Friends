import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {StatisticsExperience,type GameStatistics} from '../src/domain/statistics';
import {StatisticsPanel} from '../src/ui/StatisticsDashboardLegacy';

function source(index:number,value:number|null=9):GameStatistics{
  return {version:'controlled-review',matchId:'battle-'+index,gameId:'G1',seasonId:'s',eventId:null,
    format:'ONE_V_ONE',contextKey:index%2?'ordinary-A':'ordinary-B',orderAtMs:index+1,revision:1,
    sourceHash:'source-'+index,eligible:true,exclusionReason:null,affectsSeason:true,affectsLifetime:true,
    durationMs:1800000,players:['a','b'].map(playerId=>({playerId,name:playerId,team:null,civilization:null,
      opening:null,mainUnit:null,values:{forward:playerId==='a'?value:7},models:{forward:'same-method'},
      unavailable:{},composition:null,responseTimes:[],byAge:{},details:[]})),episodes:[],evidenceTruncated:false,warnings:[]};
}

test('independent review: five valid legacy samples survive a sixth same-method missing observation',()=>{
  const valid=Array.from({length:5},(_,index)=>source(index));
  const partial=source(5,null);
  const engine=new StatisticsExperience([...valid,partial]);
  const value=engine.aggregate('average')[0].values.forward;
  assert.equal(value.value,9);assert.equal(value.samples,5);assert.equal(value.eligibleGames,6);
  assert.deepEqual(engine.leaders('forward','average',5),['a']);
  assert.deepEqual(new StatisticsExperience([...valid.slice(0,4),partial]).leaders('forward','average',5),[],
    'the missing observation never supplies the fifth valid sample');
});

test('independent review: one unavailable source cannot globally hide an otherwise qualified legacy comparison',()=>{
  const valid=Array.from({length:5},(_,index)=>source(index));
  Object.assign(globalThis,{localStorage:{getItem:()=> 'Map Presence'}});
  const props={games:valid,preview:false,openMatch:()=>{},openPlayer:()=>{}};
  const accepted=renderToStaticMarkup(React.createElement(StatisticsPanel,props));
  const incomplete=renderToStaticMarkup(React.createElement(StatisticsPanel,{...props,unavailableGames:1}));
  assert.match(accepted,/sx-leading/);
  assert.match(incomplete,/sx-leading/);
  assert.match(incomplete,/Qualified lead/);
  assert.doesNotMatch(incomplete,/>Season lead</);
});
