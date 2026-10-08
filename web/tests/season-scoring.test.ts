import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {formatLeaguePoints,isWarmupMatch,isMainEventMatch,LeagueService,type MatchRecord} from '../src/domain/league';
import {MatchDialog,SeasonView} from '../src/ui/Views';
import {PreviewLeagueRepository} from '../src/data/PreviewLeagueRepository';

test('explicit scoring acts distinguish a main-event duel and team warm-up; old fixtures retain format fallback',()=>{
 const m:any={format:'ONE_V_ONE',seasonScoring:{act:'MAIN_EVENT'}};
 assert.equal(isMainEventMatch(m),true);assert.equal(isWarmupMatch(m),false);
 m.format='TWO_V_TWO';m.seasonScoring.act='WARMUP';assert.equal(isWarmupMatch(m),true);
 delete m.seasonScoring;assert.equal(isMainEventMatch(m),true);
});
test('fractional points have concise honest display; exact half-points stay exact',()=>{
 assert.equal(formatLeaguePoints(5.5),'5.5');assert.equal(formatLeaguePoints(10),'10');assert.equal(formatLeaguePoints(4+6/7),'≈4.86');
});
test('Battle scoring view exposes pending placement bonuses and hides stale corrected rewards',async()=>{
 const repository=new PreviewLeagueRepository();await repository.signIn();const snapshot=await repository.load();
 const props={snapshot,repository,preview:true,busy:false,openEvent:()=>{},openMatch:()=>{},openPlayer:()=>{},act:async()=>true,enter:()=>{},navigate:()=>{},onUpdated:()=>{}};
 const data:any={match:{matchId:'ffa',format:'FFA',status:'COMPLETED',participants:[{playerId:'p',steamName:'Player'}],result:{revision:2},
  seasonScoring:{act:'MAIN_EVENT',diplomacyEnabled:false},seasonScoringSummary:{resultRevision:2,placementStatus:'PENDING',rewards:[{playerId:'p',matchCompletion:4,matchWin:6,emperorBounty:2}]}},games:[],viewer:{isParticipant:true}};
 const markup=renderToStaticMarkup(React.createElement(MatchDialog,{...props,data}));assert.match(markup,/Player: 12/);assert.match(markup,/pending a verified finishing order/);
 data.match.result.revision=3;const corrected=renderToStaticMarkup(React.createElement(MatchDialog,{...props,data}));assert.doesNotMatch(corrected,/Player: 12/);assert.match(corrected,/Points are updating/);
});
test('next-target selection skips peers sharing the same rank',async()=>{
 const repository=new PreviewLeagueRepository();const s=await repository.load();s.viewer={playerId:'c',steamName:'C'};
 s.standings=[{playerId:'a',steamName:'A',rank:1,leaguePoints:15},{playerId:'b',steamName:'B',rank:2,leaguePoints:10},{playerId:'c',steamName:'C',rank:2,leaguePoints:10}];
 assert.equal(new LeagueService(repository).nextTarget(s)?.playerId,'a');
});
