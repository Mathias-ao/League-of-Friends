import test from "node:test";
import assert from "node:assert/strict";
import {computeMatchRewards} from "../lib/engines/rewardEngine.js";
import {normalizeOutcome,winningPlayerIds,assertIndependentConfirmation} from "../lib/engines/resultEngine.js";
import {seasonScoringSnapshot,rankSeasonStandings,maskUnavailableSeasonAwards} from "../lib/engines/seasonPoints.js";
import {verifiedFFAPlacements} from "../lib/engines/ffaPlacements.js";
import {rebuildCompetitionStatistics} from "../lib/engines/statisticsEngine.js";
import {currentOfficialGameOutcome} from "../lib/engines/recordingMatchFacts.js";

const roster=(count=5)=>Array.from({length:count},(_,i)=>({playerId:"p"+(i+1),slot:i+1,team:null}));
const binding=(count=5)=>({sourceStatisticsId:"source-a",replaySha256:"a".repeat(64),rosterIds:roster(count).map(p=>p.playerId),resultRevision:1,policy:"ELIMINATION_ORDER",winnerIds:["p1"]});
const evidence=(count=5)=>({modelVersion:"AOF_FFA_PLACEMENTS_V1",qualification:"VERIFIED",policy:"ELIMINATION_ORDER",sourceStatisticsId:"source-a",replaySha256:"a".repeat(64),resultRevision:1,ranks:roster(count).map((p,i)=>({playerId:p.playerId,rank:i+1}))});
function match({count=5,winners=["p1"],diplo=true,act="MAIN",emperor=null,format="FFA",placements=null,...overrides}={}) {
  return {participants:roster(count),format,
    canonicalResult:{type:winners.length>1?"COALITION_WIN":"PLAYER_WIN",winnerPlayerId:winners.length===1?winners[0]:null,winnerTeam:null,winnerPlayerIds:winners,winningPlayerIds:winners,revision:1},
    context:{affectsLeaguePoints:true,affectsGold:true,affectsWarRoomPoints:false},
    scoringSnapshot:seasonScoringSnapshot({act,diplomacyEnabled:diplo,placementPolicy:diplo?"NONE":"ELIMINATION_ORDER",emperorPlayerId:emperor}),
    placementEvidence:placements,placementSourceBinding:binding(count),
    goldRewardSnapshot:{matchCompletion:2,matchWin:3},...overrides};
}
const points=row=>Object.values(row.leaguePoints).reduce((a,b)=>a+b,0);
test("main participation and solo victory are 4/10; Gold stays independent",()=>{
  const rows=computeMatchRewards(match());assert.deepEqual(rows.map(points),[10,4,4,4,4]);
  assert.deepEqual(rows[0].gold,{matchCompletion:2,matchWin:3});
});
for(const count of [1,2,3,4,5,6,7])test(count+" diplomatic winners divide one six-point pool",()=>{
  const rows=computeMatchRewards(match({count:8,winners:roster(count).map(p=>p.playerId)}));
  assert.ok(Math.abs(rows.reduce((sum,row)=>sum+row.leaguePoints.matchWin,0)-6)<1e-9);
  assert.equal(rows[0].leaguePoints.matchWin,6/count);assert.equal(points(rows.at(-1)),4);
});
test("warm-up wins total 3 and never award Emperor bonuses",()=>{
  assert.deepEqual(computeMatchRewards(match({count:2,format:"ONE_V_ONE",act:"WARMUP",emperor:"p2"})).map(points),[3,1]);
});
test("each main winner gets Emperor bonus only when Emperor is an opposing loser",()=>{
  assert.deepEqual(computeMatchRewards(match({winners:["p1","p2"],emperor:"p3"})).map(points),[9,9,4,4,4]);
  assert.equal(computeMatchRewards(match({winners:["p1","p2"],emperor:"p2"}))[0].leaguePoints.emperor,0);
  assert.equal(computeMatchRewards(match({emperor:"absent"}))[0].leaguePoints.emperor,0);
});
for(const count of [2,3,4,5,8])test("podium thresholds with "+count+" starters",()=>{
  const rows=computeMatchRewards(match({count,diplo:false,placements:evidence(count)}));
  assert.equal(points(rows[0]),10);assert.equal(points(rows[1]),count>=3?6:4);
  if(count>=3)assert.equal(points(rows[2]),count>=5?5:4);
  assert.equal(rows[0].placementState,"VERIFIED");
});
test("missing finishing order remains pending rather than qualified zero",()=>{
  const rows=computeMatchRewards(match({diplo:false}));
  assert.deepEqual(rows.map(points),[10,4,4,4,4]);assert.ok(rows.every(row=>row.placementState==="PENDING"));
});
test("verified ties share occupied podium bonuses without inflation",()=>{
  const e=evidence();e.ranks=[{playerId:"p1",rank:1},{playerId:"p2",rank:2},{playerId:"p3",rank:2},{playerId:"p4",rank:4},{playerId:"p5",rank:5}];
  const rows=computeMatchRewards(match({diplo:false,placements:e}));
  assert.equal(rows[1].leaguePoints.placement,1.5);assert.equal(rows[2].leaguePoints.placement,1.5);
});
for(const [field,value] of [["qualification","UNRESOLVED"],["policy","OBJECTIVE_RANK"],["sourceStatisticsId","old"],["replaySha256","wrong"],["resultRevision",2]])test("reject stale placement "+field,()=>{
  const e={...evidence(),[field]:value};assert.equal(verifiedFFAPlacements(e,binding()),null);
  assert.equal(computeMatchRewards(match({diplo:false,placements:e}))[0].placementState,"PENDING");
});
test("invalid roster, order and first-place mismatch cannot establish placements",()=>{
  for(const ranks of [evidence().ranks.slice(1),evidence().ranks.map(row=>({...row,rank:1})),
    evidence().ranks.map(row=>({...row,rank:row.rank+1})),evidence().ranks.map(row=>({...row,playerId:row.playerId==="p1"?"stranger":row.playerId}))]) {
    assert.equal(verifiedFFAPlacements({...evidence(),ranks},binding()),null);
  }
});
test("diplomatic FFA ignores placement evidence",()=>{
  const rows=computeMatchRewards(match({placements:evidence()}));
  assert.equal(rows[1].leaguePoints.placement,0);assert.equal(rows[1].placementState,"NOT_APPLICABLE");
});
test("nondiplomatic coalition and malformed snapshots fail closed",()=>{
  assert.throws(()=>computeMatchRewards(match({diplo:false,winners:["p1","p2"]})),/one winner/);
  assert.throws(()=>computeMatchRewards(match({scoringSnapshot:{rules:{modelVersion:"UNKNOWN"}}})),/version/);
  assert.throws(()=>computeMatchRewards(match({winners:["p1","p1"]})),/roster/);
});
test("historical and War Room profiles keep their existing rewards",()=>{
  assert.deepEqual(computeMatchRewards(match({scoringSnapshot:{rules:{matchCompletionPoints:2,matchWinPoints:5}}})).map(points),[7,2,2,2,2]);
  const war=computeMatchRewards(match({context:{affectsWarRoomPoints:true},scoringSnapshot:{rules:{warRoomMatchCompletionPoints:2,warRoomMatchWinPoints:4}}}));
  assert.ok(war.every(row=>points(row)===0));assert.equal(war[0].warRoomPoints.matchWin,4);
});
test("joint winners require explicit diplomacy, unique members and a defeated opponent",()=>{
  const outcome=normalizeOutcome("FFA",roster(),{winnerPlayerIds:["p2","p1"]},{diplomacyEnabled:true});
  assert.deepEqual(outcome,{type:"COALITION_WIN",winnerTeam:null,winnerPlayerId:null,winnerPlayerIds:["p1","p2"]});
  for(const winners of [[],["p1","p1"],["stranger"],roster().map(p=>p.playerId)]) {
    assert.throws(()=>normalizeOutcome("FFA",roster(),{winnerPlayerIds:winners},{diplomacyEnabled:true}));
  }
  assert.throws(()=>normalizeOutcome("FFA",roster(),{winnerPlayerIds:["p1","p2"]},{diplomacyEnabled:false}),/diplomatic/);
  assert.equal(normalizeOutcome("FFA",roster(),{winnerPlayerIds:["p1"]}).type,"PLAYER_WIN");
  assert.throws(()=>normalizeOutcome("ONE_V_ONE",roster(),{winnerPlayerIds:["p1"]}),/only winnerTeam/);
});
test("winning coalition cannot confirm its own claim",()=>{
  const outcome=normalizeOutcome("FFA",roster(),{winnerPlayerIds:["p1","p2"]},{diplomacyEnabled:true});
  assert.throws(()=>assertIndependentConfirmation(roster(),"p1","p2",outcome),/nonwinner/);
  assert.doesNotThrow(()=>assertIndependentConfirmation(roster(),"p1","p3",outcome));
});
test("joint victory stays official and existing statistics count both winners",()=>{
  const m=match({winners:["p1","p2"]}),result={...m.canonicalResult,source:"PLAYER_CONFIRMED"};
  const official=currentOfficialGameOutcome({status:"COMPLETED",players:m.participants,canonicalResult:result},{status:"COMPLETED"});
  assert.equal(official.qualification,"OFFICIAL");assert.deepEqual(official.winnerPlayerIds,["p1","p2"]);
  assert.deepEqual(winningPlayerIds(result,m.participants),["p1","p2"]);
  const rebuilt=rebuildCompetitionStatistics([{matchId:"m1",seasonId:"s1",format:"FFA",participants:m.participants,canonicalResult:result,
    affectsLifetimeStats:true,affectsSeasonStats:true,orderAtMs:1}]);
  assert.equal(rebuilt.lifetime.find(p=>p.playerId==="p1").matchesWon,1);
  assert.equal(rebuilt.lifetime.find(p=>p.playerId==="p2").matchesWon,1);
});
test("standings use main wins, then warm-up wins, and share unresolved rank",()=>{
  const rows=rankSeasonStandings([
    {playerId:"a",steamName:"A",leaguePoints:20,mainEventWins:1,warmupWins:3},
    {playerId:"b",steamName:"B",leaguePoints:20,mainEventWins:2,warmupWins:0},
    {playerId:"c",steamName:"C",leaguePoints:20,mainEventWins:2,warmupWins:1},
    {playerId:"d",steamName:"D",leaguePoints:20,mainEventWins:2,warmupWins:1},
    {playerId:"e",steamName:"E",leaguePoints:19,mainEventWins:5},
  ]);
  assert.deepEqual(rows.map(row=>[row.playerId,row.rank]),[["c",1],["d",1],["b",3],["a",4],["e",5]]);
});
test("disputed and unreconciled awards are masked without deleting history",()=>{
  const rules=seasonScoringSnapshot({act:"MAIN",diplomacyEnabled:true,placementPolicy:"NONE",emperorPlayerId:null});
  const rows=[{playerId:"p1",steamName:"P1",leaguePoints:15,mainEventWins:1,warmupWins:1}];
  const ledger=[{playerId:"p1",matchId:"m1",component:"MATCH_COMPLETION",amount:4},{playerId:"p1",matchId:"m1",component:"MATCH_WIN",amount:6}];
  const states=[{matchId:"m1",status:"DISPUTED",scoringSnapshot:rules,canonicalResult:{revision:1},scoringResultRevision:1}];
  assert.equal(maskUnavailableSeasonAwards(rows,states,ledger)[0].leaguePoints,5);
  states[0].status="COMPLETED";states[0].canonicalResult.revision=2;
  assert.equal(maskUnavailableSeasonAwards(rows,states,ledger)[0].mainEventWins,0);
  states[0].scoringResultRevision=2;
  assert.equal(maskUnavailableSeasonAwards(rows,states,ledger)[0].leaguePoints,15);assert.equal(ledger.length,2);
});
