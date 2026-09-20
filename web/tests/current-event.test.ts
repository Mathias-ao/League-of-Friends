import test from 'node:test';
import assert from 'node:assert/strict';
import {currentLeagueEvent,isBattleOpen,type LeagueSnapshot} from '../src/domain/league';

const baseSnapshot=():LeagueSnapshot=>({
  membership:'ACTIVE',
  viewer:{playerId:'p1',steamName:'Player One'},
  season:{seasonId:'s1',name:'Season',status:'ACTIVE'},
  emperor:null,
  enteredSeason:true,
  hasLeagueHistory:false,
  standings:[],
  players:[],
  events:[
    {eventId:'e1',title:'Past scheduled event',status:'PUBLISHED',startsAt:'2026-09-20T10:00:00.000Z',competitionStyle:'BIG_TEAM'},
    {eventId:'e2',title:'Future event',status:'PUBLISHED',startsAt:'2026-09-27T10:00:00.000Z',competitionStyle:'TWO_V_TWO'}
  ],
  matches:[
    {matchId:'m1',eventId:'e1',format:'FOUR_V_FOUR',status:'READY',participants:[{playerId:'p1',steamName:'Player One'}]}
  ]
});

test('an unfinished approved Battle keeps its past-start Event current',()=>{
  const snapshot=baseSnapshot();
  assert.equal(isBattleOpen('READY'),true);
  assert.equal(currentLeagueEvent(snapshot,Date.parse('2026-09-20T18:00:00.000Z'))?.eventId,'e1');
});

test('after the Battle completes the next future published Event becomes current',()=>{
  const snapshot=baseSnapshot();
  snapshot.matches[0].status='COMPLETED';
  assert.equal(currentLeagueEvent(snapshot,Date.parse('2026-09-20T18:00:00.000Z'))?.eventId,'e2');
});
