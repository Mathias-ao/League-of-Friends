import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {PreviewLeagueRepository} from '../src/data/PreviewLeagueRepository';
import {StatisticsPanel,BattleTimeline} from '../src/ui/StatisticsDashboard';
import {StatisticsExperience} from '../src/domain/statistics';

test('preview measurements are identical in Battle, Event and Season scopes',async()=>{
  const repo=new PreviewLeagueRepository();await repo.signIn();await repo.requestMembership('Tester','','K7M4Q9');
  const season=await repo.statisticsExperience({seasonId:'S001'});
  const event=await repo.statisticsExperience({eventId:'preview-campaign'});
  const battle=await repo.statisticsExperience({matchId:'preview-battle-1'});
  assert.equal(event.games.length,8);assert.deepEqual(battle.games[0],event.games[0]);assert.deepEqual(battle.games[0],season.games.find(g=>g.matchId==='preview-battle-1'));
  for(const g of event.games)for(const p of g.players){
    assert.equal(p.values.raidsOut,g.episodes.filter(e=>e.kind==='raid'&&e.actors.includes(p.playerId)).length);
    assert.equal(p.values.raidsIn,g.episodes.filter(e=>e.kind==='raid'&&e.targets.includes(p.playerId)).length);
    assert.ok(Math.abs(Object.values(p.composition!).reduce((a,b)=>a+b,0)-p.values.unitRequests!)<1e-8);
  }
  assert.ok(new StatisticsExperience(event.games).highlights(4).length<=4);
  const props={games:event.games,preview:true,viewerId:'sample-you',openMatch:()=>{},openPlayer:()=>{}};
  const seasonMarkup=renderToStaticMarkup(React.createElement(StatisticsPanel,props));
  for(const label of ['Opening','Economy','Military','Map Presence','Execution','Per Game','Military queue composition','record book'])assert.ok(seasonMarkup.includes(label),label);
  const battleMarkup=renderToStaticMarkup(React.createElement(StatisticsPanel,{...props,games:battle.games,battle:true}));
  for(const label of ['Battle scorecard','Full statistics','Battle timeline','Resources committed'])assert.ok(battleMarkup.includes(label),label);
  assert.ok(renderToStaticMarkup(React.createElement(BattleTimeline,{game:battle.games[0]})).includes('Choose an episode'));
});
