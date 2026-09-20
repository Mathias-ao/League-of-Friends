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


test('completed draft recovery is visible only to administrators',async()=>{
  const repository=new PreviewLeagueRepository();await repository.signIn();await repository.requestMembership('D’Karius','','K7M4Q9');
  const snapshot=await repository.load();
  const players=[
    {playerId:'p1',steamName:'Player One',team:1,slot:1,civilization:'FRANKS'},
    {playerId:'p2',steamName:'Player Two',team:2,slot:2,civilization:'BRITONS'}
  ];
  const detail:any={
    match:{matchId:'draft-match',format:'ONE_V_ONE',status:'READY',participants:players},
    viewer:{playerId:'p1',isParticipant:true},
    games:[{
      gameId:'G1',gameNumber:1,status:'READY',players,draftRequired:true,result:null,resultDisputeOpen:false,
      draft:{
        draftId:'G1',ruleVersion:'AOF_CIV_DRAFT_V1',status:'COMPLETED',revision:1,stateVersion:3,gameNumber:1,
        turnOrder:'TEAM_INTERLEAVED',reusePolicy:'RESET_EACH_GAME',uniqueWithinGame:true,
        pool:['FRANKS','BRITONS'],available:[],viewerAvailable:[],currentTurnIndex:null,viewerCanPick:false,
        turns:[
          {index:0,playerId:'p1',team:1,slot:1,status:'COMPLETED',civilization:'FRANKS'},
          {index:1,playerId:'p2',team:2,slot:2,status:'COMPLETED',civilization:'BRITONS'}
        ],
        selections:[
          {turnIndex:0,playerId:'p1',team:1,civilization:'FRANKS'},
          {turnIndex:1,playerId:'p2',team:2,civilization:'BRITONS'}
        ]
      }
    }]
  };
  const baseProps={repository,preview:true,busy:false,openEvent:()=>{},openMatch:()=>{},openPlayer:()=>{},act:async()=>true,enter:()=>{},navigate:()=>{},onUpdated:()=>{}};
  const adminSnapshot={...snapshot,viewer:{...snapshot.viewer!,role:'ADMIN' as const}};
  const playerSnapshot={...snapshot,viewer:{...snapshot.viewer!,role:'PLAYER' as const}};
  const adminMarkup=renderToStaticMarkup(React.createElement(MatchDialog,{...baseProps,snapshot:adminSnapshot,data:detail}));
  const playerMarkup=renderToStaticMarkup(React.createElement(MatchDialog,{...baseProps,snapshot:playerSnapshot,data:detail}));
  assert.ok(adminMarkup.includes('Reset / reroll draft'));
  assert.ok(!playerMarkup.includes('Reset / reroll draft'));
});
