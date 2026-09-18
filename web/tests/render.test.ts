import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {SeasonView,EventsView,BattlesView,PlayersView,WarRoomView,StatisticsView,EventDialog,MatchDialog,ProfileDialog} from '../src/ui/Views';
import {PreviewLeagueRepository} from '../src/data/PreviewLeagueRepository';

test('all six sections and three detail surfaces render representative player data',async()=>{
  const repository=new PreviewLeagueRepository();await repository.signIn();await repository.requestMembership('D’Karius','','K7M4Q9');
  const snapshot=await repository.load();
  const props={repository,snapshot,preview:true,busy:false,openEvent:()=>{},openMatch:()=>{},openPlayer:()=>{},act:async()=>true,enter:()=>{},navigate:()=>{}};
  const nodes=[
    React.createElement(SeasonView,{...props,onRules:()=>{}}),
    React.createElement(EventsView,props),React.createElement(BattlesView,props),
    React.createElement(PlayersView,props),React.createElement(WarRoomView),React.createElement(StatisticsView)
  ];
  for(const node of nodes)assert.ok(renderToStaticMarkup(node).length>100);
  assert.match(renderToStaticMarkup(React.createElement(EventDialog,{...props,data:await repository.event('E001'),onUpdated:()=>{}})),/The muster/);
  assert.match(renderToStaticMarkup(React.createElement(MatchDialog,{...props,data:await repository.match('sample-duel'),onUpdated:()=>{}})),/Dispute result/);
  assert.match(renderToStaticMarkup(React.createElement(ProfileDialog,{...props,data:await repository.player('sample-you')})),/Selected achievements/);
});
