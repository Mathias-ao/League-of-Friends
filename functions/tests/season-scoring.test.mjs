import test from 'node:test';
import assert from 'node:assert/strict';
import {computeMatchRewards} from '../lib/engines/rewardEngine.js';
import {scoringSnapshot, rankSeasonStandings, lockSeasonScoring, POINT_UNITS} from '../lib/engines/seasonScoring.js';
import {normalizeOutcome, winningPlayerIds} from '../lib/engines/resultEngine.js';
const roster=n=>Array.from({length:n},(_,i)=>({playerId:String(i+1),slot:i+1,team:i<n/2?1:2}));
const config=(diplo=false,objective=false)=>({diplomacyEnabled:diplo,victory:{conquest:true,wonder:objective,relic:false,customRuleCode:null}});
const match=(n=4,diplo=false,format='FFA',act='MAIN_EVENT',winners=['1'])=>({format,participants:roster(n),
 canonicalResult:{type:format==='FFA'?(winners.length>1?'COALITION_WIN':'PLAYER_WIN'):'TEAM_WIN',winnerTeam:format==='FFA'?null:1,winnerPlayerId:format==='FFA'&&winners.length===1?winners[0]:null,coalitionPlayerIds:format==='FFA'&&winners.length>1?winners:undefined,winningPlayerIds:winners,revision:1},
 context:{affectsLeaguePoints:true},scoringSnapshot:scoringSnapshot(),
 seasonScoring:lockSeasonScoring({act,format,gameConfig:config(diplo),emperorPlayerId:'4',placementRule:'VERIFIED_ELIMINATION'})});
const total=r=>Object.values(r.leaguePoints).reduce((a,b)=>a+b,0);
test('team main rewards everyone 4, winners 6 and bounded Emperor bounty; warm-up pays 1/2 only',()=>{
 const m=match(4,false,'TWO_V_TWO','MAIN_EVENT',['1','2']);const r=computeMatchRewards(m);
 assert.deepEqual(r.map(total),[12,12,4,4]);assert.equal(r[0].seasonCounters.mainEventWins,1);
 m.seasonScoring.emperorPlayerId='1';assert.deepEqual(computeMatchRewards(m).map(total),[10,10,4,4]);
 m.seasonScoring.act='WARMUP';assert.deepEqual(computeMatchRewards(m).map(total),[3,3,1,1]);
});
test('diplomatic FFA splits one victory pool among official winners, independent of temporary alliances',()=>{
 for(let count=1;count<=7;count++){
  const m=match(8,true,'FFA','MAIN_EVENT',roster(count).map(p=>p.playerId));m.seasonScoring.emperorPlayerId=null;
  const r=computeMatchRewards(m);assert.equal(r.reduce((s,p)=>s+Math.round(p.leaguePoints.matchWin*POINT_UNITS),0),6*POINT_UNITS);
  assert.equal(r.every(p=>p.placementStatus==='NOT_APPLICABLE'),true);
  assert.equal(total(r.at(-1)),4);
 }
});
test('non-diplo placements remain pending; verified second/third are exclusive with starter thresholds',()=>{
 for(const n of [2,3,4,5,8]){
  const m=match(n);m.seasonScoring.emperorPlayerId=null;
  assert.equal(computeMatchRewards(m)[0].placementStatus,'PENDING');
  m.canonicalResult.ffaPlacements={qualification:'VERIFIED',rule:'VERIFIED_ELIMINATION',finishingOrder:roster(n).map(p=>p.playerId),evidence:'Reviewed replay end and elimination log',verifiedBy:'admin'};
  const r=computeMatchRewards(m);assert.equal(total(r[0]),10);assert.equal(total(r[1]),n>=3?6:4);
  if(n>=3)assert.equal(total(r[2]),n>=5?5:4);
  assert.equal(r.every(p=>p.placementStatus==='VERIFIED'),true);
 }
});
test('malformed, duplicate, inconsistent or untrusted ranking evidence fails closed',()=>{
 for(const order of [['1','2','2','4'],['2','1','3','4'],['1','2'],['1','2','3','unknown']]){
  const m=match();m.canonicalResult.ffaPlacements={qualification:'VERIFIED',rule:'VERIFIED_ELIMINATION',finishingOrder:order,evidence:'observed',verifiedBy:'admin'};
  assert.throws(()=>computeMatchRewards(m));
 }
 const m=match();delete m.seasonScoring;assert.throws(()=>computeMatchRewards(m),/locked/);
 const bad=match();bad.canonicalResult.winningPlayerIds=['1','1'];assert.throws(()=>computeMatchRewards(bad),/unique/);
 const unknown=match();unknown.scoringSnapshot.rules.seasonScoringVersion='UNKNOWN';assert.throws(()=>computeMatchRewards(unknown),/Unsupported/);
});
test('coalition results are explicit, stable, diplomatic only and leave a nonwinning side',()=>{
 const players=roster(4);const outcome=normalizeOutcome('FFA',players,{coalitionPlayerIds:['2','1']},{diplomacyEnabled:true});
 assert.deepEqual(winningPlayerIds(outcome,players),['1','2']);
 for(const ids of [['1','1'],['1'],['1','2','3','4'],['1','missing']])assert.throws(()=>normalizeOutcome('FFA',players,{coalitionPlayerIds:ids},{diplomacyEnabled:true}));
 assert.throws(()=>normalizeOutcome('FFA',players,{coalitionPlayerIds:['1','2']},{diplomacyEnabled:false}));
 assert.throws(()=>normalizeOutcome('TWO_V_TWO',players,{coalitionPlayerIds:['1','2']},{diplomacyEnabled:true}));
});
test('objective FFA must announce a ranking method; survival cannot silently substitute',()=>{
 assert.throws(()=>lockSeasonScoring({act:'MAIN_EVENT',format:'FFA',gameConfig:config(false,true),emperorPlayerId:null,placementRule:'VERIFIED_ELIMINATION'}));
 assert.throws(()=>lockSeasonScoring({act:'MAIN_EVENT',format:'FFA',gameConfig:config(false,true),emperorPlayerId:null,placementRule:'VERIFIED_OBJECTIVE'}));
 assert.equal(lockSeasonScoring({act:'MAIN_EVENT',format:'FFA',gameConfig:config(false,true),emperorPlayerId:null,placementRule:'VERIFIED_OBJECTIVE',placementDescription:'Verified cumulative hill control time'}).placementRule,'VERIFIED_OBJECTIVE');
});
test('ties use main wins then warm-up wins and otherwise share ranks; rating cannot break them',()=>{
 const r=rankSeasonStandings([{playerId:'a',leaguePoints:10,mainEventWins:1,warmupWins:1,currentPowerRating:100},
 {playerId:'b',leaguePoints:10,mainEventWins:1,warmupWins:1,currentPowerRating:3000},
 {playerId:'c',leaguePoints:10,mainEventWins:1,warmupWins:0},{playerId:'d',leaguePoints:10,mainEventWins:0,warmupWins:8}]);
 assert.deepEqual(r.map(s=>[s.playerId,s.rank]),[['a',1],['b',1],['c',3],['d',4]]);
});
test('legacy scoring and disabled contexts preserve their existing semantics; special deeds add no points',()=>{
 const m=match();delete m.seasonScoring;m.scoringSnapshot={rules:{matchCompletionPoints:2,matchWinPoints:5,achievementPoints:999,wonderVictoryPoints:999,kingSnipePoints:999,streakPoints:999}};
 assert.deepEqual(computeMatchRewards(m).map(total),[7,2,2,2]);
 m.context.affectsLeaguePoints=false;assert.deepEqual(computeMatchRewards(m).map(total),[0,0,0,0]);
});

test('series aggregate the accepted decisive side, reject unresolved order and ignore remakes',async()=>{
 const {resolveSeriesResult}=await import('../lib/engines/seriesResult.js');
 const players=roster(2),rule={maxGames:3,gamesRequiredToWin:2};
 const g=(num,team)=>({gameId:'G'+num,gameNumber:num,status:'COMPLETED',canonicalResult:{type:'TEAM_WIN',winnerTeam:team,winnerPlayerId:null,winningPlayerIds:[String(team)],revision:1}});
 const games=[g(1,1),g(2,2),g(3,1)];
 const r=resolveSeriesResult(games,rule,players);assert.equal(r.result.winnerTeam,1);assert.equal(r.sourceGameId,'G3');
 assert.throws(()=>resolveSeriesResult(games.slice(0,2),rule,players),/no verified/);
 assert.throws(()=>resolveSeriesResult([{...g(1,1),status:'DISPUTED'},g(2,1)],rule,players),/unresolved/);
 assert.throws(()=>resolveSeriesResult([g(1,1),g(1,1)],rule,players),/duplicate/);
 assert.equal(resolveSeriesResult([{gameId:'remake',gameNumber:1,status:'REMAKE'},g(1,1),g(2,1)],rule,players).sourceGameId,'G2');
});
