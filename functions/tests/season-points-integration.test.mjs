import {getMatchDetail} from "../lib/queries/getMatchDetail.js";
import {processPowerRatings} from "../lib/commands/processing/processPowerRatings.js";
import test from "node:test";
import assert from "node:assert/strict";
import {memoryFirestore} from "./support/memory-firestore.mjs";
import {adminApproveMatchPlan} from "../lib/commands/events/approveMatchPlan.js";
import {adminCreateEventWarmups} from "../lib/commands/events/createEventWarmups.js";
import {submitGameResult} from "../lib/commands/results/submitGameResult.js";
import {respondToGameResult} from "../lib/commands/results/respondToGameResult.js";
import {disputeCanonicalGameResult} from "../lib/commands/results/disputeCanonicalGameResult.js";
import {adminResolveCanonicalResultDispute} from "../lib/commands/results/adminResolveCanonicalResultDispute.js";
import {processMatchRewards} from "../lib/commands/processing/processMatchRewards.js";
import {getLeagueBootstrap} from "../lib/queries/getLeagueBootstrap.js";
import {seasonScoringSnapshot} from "../lib/engines/seasonPoints.js";
import {SYSTEM_RESULT_PROCESSING_ACTOR as system} from "../lib/services/resultProcessingActor.js";
import {reconcileSeasonPointsOnGameSource,reconcileSeasonPointsOnPlacementSource} from "../lib/triggers/seasonPoints.js";
const request=(data,player="p5")=>({auth:{uid:player},data});
const config={maps:{pool:["Arabia"],selectionMode:"ADMIN"},civilizations:{mode:"UNRESTRICTED",allowed:[],banned:[],customRuleCode:null},victory:{conquest:true,wonder:false,relic:false,customRuleCode:null},diplomacyEnabled:true,additionalSettings:{}};
function fixture({diplo=true,count=5}={}) {
  const participants=Array.from({length:count},(_,i)=>({playerId:"p"+(i+1),slot:i+1,team:null}));
  const scoringSnapshot=seasonScoringSnapshot({act:"MAIN",diplomacyEnabled:diplo,placementPolicy:diplo?"NONE":"ELIMINATION_ORDER",emperorPlayerId:null});
  const entries=[["leagueState/singleton",{activeSeasonId:"s1",currentEmperorPlayerId:"p"+count}],["seasons/s1",{status:"ACTIVE"}],
    ["events/e1",{seasonId:"s1",status:"PUBLISHED",currentMatchPlanId:"plan1",gameConfig:{...config,diplomacyEnabled:diplo},scoringSnapshot,goldRewardSnapshot:{matchCompletion:1,matchWin:2}}],
    ["events/e1/matchPlans/plan1",{status:"PROPOSED",matches:[{format:"FFA",participants}]}]];
  for(const p of participants)entries.push(["players/"+p.playerId,{steamName:p.playerId,role:p.playerId==="p"+count?"ADMIN":"PLAYER",membershipStatus:"ACTIVE",goldBalance:0}],
    ["authLinks/"+p.playerId,{playerId:p.playerId}],["seasons/s1/participants/"+p.playerId,{status:"ENTERED"}]);
  return memoryFirestore(entries);
}
const process=()=>processMatchRewards({matchId:"plan1-M1",requestId:"system-run"},system);
const standing=(db,id)=>db.get("seasons/s1/standings/"+id)?.leaguePoints;
async function accept(winners=["p1","p2"]) {
  await adminApproveMatchPlan.run(request({requestId:"approve-main-1",eventId:"e1",planId:"plan1"}));
  await submitGameResult.run(request({matchId:"plan1-M1",gameId:"G1",winnerPlayerIds:winners},"p1"));
  await respondToGameResult.run(request({matchId:"plan1-M1",gameId:"G1",submissionId:"p1",response:"CONFIRM"},"p3"));
}
test("approved coalition pins Emperor and slots; accepted result scores once",async()=>{
  const db=fixture();await accept();const result=await process();
  assert.equal(result.leaguePointDelta,30);assert.equal(standing(db,"p1"),9);assert.equal(standing(db,"p2"),9);assert.equal(standing(db,"p5"),4);
  assert.equal(db.get("matches/plan1-M1").scoringSnapshot.rules.emperorPlayerId,"p5");
  assert.equal(db.get("events/e1/scoringSlots/MAIN_p1").matchId,"plan1-M1");
  assert.ok(db.get("processingJobs/MATCH_RESULT_plan1-M1_R1").pendingSteps.includes("POWER_RATING"));
  assert.equal((await process()).alreadyProcessed,true);assert.equal(standing(db,"p1"),9);
  assert.equal(db.get("seasons/s1/standings/p1").mainEventWins,1);assert.equal(db.get("players/p1").goldBalance,3);
});
test("coalition members cannot confirm together; no-diplo cannot accept joint winners",async()=>{
  const db=fixture();await adminApproveMatchPlan.run(request({requestId:"approve-main-1",eventId:"e1",planId:"plan1"}));
  await submitGameResult.run(request({matchId:"plan1-M1",gameId:"G1",winnerPlayerIds:["p1","p2"]},"p1"));
  await assert.rejects(respondToGameResult.run(request({matchId:"plan1-M1",gameId:"G1",submissionId:"p1",response:"CONFIRM"},"p2")),/nonwinner/);
  assert.equal(db.get("matches/plan1-M1").canonicalResult,null);
  fixture({diplo:false});await adminApproveMatchPlan.run(request({requestId:"approve-main-1",eventId:"e1",planId:"plan1"}));
  await assert.rejects(submitGameResult.run(request({matchId:"plan1-M1",gameId:"G1",winnerPlayerIds:["p1","p2"]},"p1")),/diplomatic/);
});
test("joint-to-solo correction reconciles victory, bounty, wins and Gold",async()=>{
  const db=fixture();await accept();await process();
  await disputeCanonicalGameResult.run(request({requestId:"dispute-result-1",matchId:"plan1-M1",gameId:"G1",category:"WRONG_RESULT",reason:"Solo winner"},"p2"));
  await assert.rejects(process(),/completed/);
  const before=await getLeagueBootstrap.run(request({},"p1"));assert.ok(before.leaderboard.every(row=>row.leaguePoints===0));
  await adminResolveCanonicalResultDispute.run(request({requestId:"correct-result-1",matchId:"plan1-M1",gameId:"G1",disputeId:"dispute-result-1",resolution:"CORRECT",reason:"Correct winner",winnerPlayerId:"p1"}));
  const pending=await getMatchDetail.run(request({matchId:"plan1-M1"},"p1"));
  assert.equal(pending.match.scoringState,"PENDING");assert.deepEqual(pending.match.scoringBreakdown,[]);
  await process();assert.equal(standing(db,"p1"),12);assert.equal(standing(db,"p2"),4);
  assert.equal(db.get("seasons/s1/standings/p2").mainEventWins,0);assert.equal(db.get("players/p2").goldBalance,1);
  assert.equal((await process()).alreadyProcessed,true);
});
test("correction to an Emperor victory removes every bounty",async()=>{
  const db=fixture();await accept();await process();
  await disputeCanonicalGameResult.run(request({requestId:"dispute-result-1",matchId:"plan1-M1",gameId:"G1",category:"WRONG_RESULT",reason:"Wrong winners"},"p2"));
  await adminResolveCanonicalResultDispute.run(request({requestId:"correct-result-1",matchId:"plan1-M1",gameId:"G1",disputeId:"dispute-result-1",resolution:"CORRECT",reason:"Emperor won",winnerPlayerIds:["p1","p5"]}));
  await process();assert.equal(standing(db,"p1"),7);assert.equal(standing(db,"p2"),4);assert.equal(standing(db,"p5"),7);
});
test("main slots reject another plan before writing duplicate Matches",async()=>{
  const db=fixture();await accept();
  db.set("events/e1",{...db.get("events/e1"),currentMatchPlanId:"plan2"});
  db.set("events/e1/matchPlans/plan2",{...db.get("events/e1/matchPlans/plan1"),status:"PROPOSED"});
  await assert.rejects(adminApproveMatchPlan.run(request({requestId:"approve-main-2",eventId:"e1",planId:"plan2"})),/already reserved/);
  assert.equal(db.has("matches/plan2-M1"),false);
});
test("week-before warm-ups own separate slots and award 3/1 once",async()=>{
  const db=fixture();const data={requestId:"create-warmup-1",eventId:"e1",pairs:[["p1","p2"]],gameConfig:config};
  await adminCreateEventWarmups.run(request(data));assert.equal(db.get("events/e1/scoringSlots/WARMUP_p1").matchId,"e1-W1");
  assert.equal(db.get("matches/e1-W1").gameConfigSnapshot.diplomacyEnabled,false);
  await assert.rejects(adminCreateEventWarmups.run(request({...data,requestId:"create-warmup-2"})),/already has/);
  await submitGameResult.run(request({matchId:"e1-W1",gameId:"G1",winnerTeam:1},"p1"));
  await respondToGameResult.run(request({matchId:"e1-W1",gameId:"G1",submissionId:"p1",response:"CONFIRM"},"p2"));
  await processMatchRewards({matchId:"e1-W1",requestId:"system-warmup"},system);
  assert.equal(standing(db,"p1"),3);assert.equal(standing(db,"p2"),1);
  assert.equal(db.get("seasons/s1/standings/p1").warmupWins,1);
  await accept();await process();assert.equal(standing(db,"p1"),12);
});
function source(db,id="source-a") {
  const game=db.get("matches/plan1-M1/games/G1");
  db.set("matches/plan1-M1/games/G1",{...game,activeReplayStatisticsId:id,replayStatisticsState:"READY"});
  const qualifiedFFAPlacements={modelVersion:"AOF_FFA_PLACEMENTS_V1",qualification:"VERIFIED",policy:"ELIMINATION_ORDER",sourceStatisticsId:id,replaySha256:id,resultRevision:1,
    ranks:Array.from({length:5},(_,i)=>({playerId:"p"+(i+1),rank:i+1}))};
  db.set("matches/plan1-M1/games/G1/replaySources/"+id,{state:"READY",matchId:"plan1-M1",gameId:"G1",sourceHash:id,
    playerMapping:Array.from({length:5},(_,i)=>({playerId:"p"+(i+1)})),qualifiedFFAPlacements});
}
test("late placements reconcile once, reverse on source change, and can return",async()=>{
  const db=fixture({diplo:false});await accept(["p1"]);await process();
  assert.equal(db.get("matches/plan1-M1").scoringState,"PLACEMENTS_PENDING");assert.equal(standing(db,"p2"),4);
  source(db);await process();assert.equal(standing(db,"p2"),6);assert.equal(standing(db,"p3"),5);
  assert.equal((await process()).alreadyProcessed,true);
  db.set("matches/plan1-M1/games/G1",{...db.get("matches/plan1-M1/games/G1"),activeReplayStatisticsId:"source-b"});
  await process();assert.equal(standing(db,"p2"),4);assert.equal(db.get("matches/plan1-M1").scoringState,"PLACEMENTS_PENDING");
  source(db);await process();assert.equal(standing(db,"p2"),6);
  assert.equal(db.get("seasons/s1/standings/p1").mainEventWins,1);
});
test("mapping mismatches never award placements",async()=>{
  const db=fixture({diplo:false});await accept(["p1"]);source(db);
  db.get("matches/plan1-M1/games/G1/replaySources/source-a").playerMapping[0].playerId="stranger";
  await process();assert.equal(standing(db,"p2"),4);assert.equal(db.get("matches/plan1-M1").scoringState,"PLACEMENTS_PENDING");
});
test("source triggers reconcile qualified placements and invalidate them safely",async()=>{
  const db=fixture({diplo:false});await accept(["p1"]);await process();source(db);
  await reconcileSeasonPointsOnGameSource.run({id:"source-event",params:{matchId:"plan1-M1",gameId:"G1"},data:{before:{data:()=>({})},after:{data:()=>db.get("matches/plan1-M1/games/G1")}}});
  assert.equal(standing(db,"p2"),6);
  const saved=db.get("matches/plan1-M1/games/G1/replaySources/source-a");
  db.set("matches/plan1-M1/games/G1/replaySources/source-a",{...saved,qualifiedFFAPlacements:null});
  await reconcileSeasonPointsOnPlacementSource.run({id:"placement-event",params:{matchId:"plan1-M1",gameId:"G1",sourceId:"source-a"},data:{before:{data:()=>saved},after:{data:()=>({...saved,qualifiedFFAPlacements:null})}}});
  assert.equal(standing(db,"p2"),4);
});

test("shared wins are unrated; solo diplomatic wins retain the existing rating calculation",async()=>{
  const db=fixture();await accept();
  const shared=await processPowerRatings({matchId:"plan1-M1",requestId:"system-rating"},system);
  assert.equal(shared.ratedMatches,0);
  assert.equal(db.get("matches/plan1-M1").powerRatingParticipation,"UNRATED_COALITION");
  assert.equal(db.get("players/p1").powerRatingGames,undefined);
  await disputeCanonicalGameResult.run(request({requestId:"dispute-rating-1",matchId:"plan1-M1",gameId:"G1",category:"WRONG_RESULT",reason:"Solo win"},"p2"));
  await adminResolveCanonicalResultDispute.run(request({requestId:"correct-rating-1",matchId:"plan1-M1",gameId:"G1",disputeId:"dispute-rating-1",resolution:"CORRECT",reason:"Solo win",winnerPlayerId:"p1"}));
  const solo=await processPowerRatings({matchId:"plan1-M1",requestId:"system-rating"},system);
  assert.equal(solo.ratedMatches,1);assert.equal(db.get("players/p1").powerRatingGames,1);
});
test("correcting a rated solo win to a coalition removes obsolete rating history",async()=>{
  const db=fixture();await accept(["p1"]);
  await processPowerRatings({matchId:"plan1-M1",requestId:"system-rating"},system);
  assert.equal(db.get("players/p1").powerRatingGames,1);
  await disputeCanonicalGameResult.run(request({requestId:"dispute-rating-1",matchId:"plan1-M1",gameId:"G1",category:"WRONG_RESULT",reason:"Shared win"},"p2"));
  await adminResolveCanonicalResultDispute.run(request({requestId:"correct-rating-1",matchId:"plan1-M1",gameId:"G1",disputeId:"dispute-rating-1",resolution:"CORRECT",reason:"Shared win",winnerPlayerIds:["p1","p2"]}));
  await processPowerRatings({matchId:"plan1-M1",requestId:"system-rating"},system);
  assert.equal(db.get("players/p1").powerRatingGames,0);assert.equal(db.get("players/p1").currentPowerRating,null);
  assert.equal(db.has("players/p1/ratingHistory/plan1-M1"),false);
});

test('starter corrections preserve reservations and never award no-show points',async()=>{
  const {adminConfirmMatchStarters}=await import('../lib/commands/events/confirmMatchStarters.js');
  const db=fixture({diplo:false});await adminApproveMatchPlan.run(request({requestId:'approve-starters-1',eventId:'e1',planId:'plan1'}));
  await adminConfirmMatchStarters.run(request({requestId:'confirm-starters-1',matchId:'plan1-M1',starterPlayerIds:['p1','p2','p3'],reason:'Two planned players did not attend'}));
  assert.equal(db.get('events/e1/scoringSlots/MAIN_p5').matchId,'plan1-M1');assert.equal(db.get('matches/plan1-M1/games/G1').players.length,3);
  await submitGameResult.run(request({matchId:'plan1-M1',gameId:'G1',winnerPlayerId:'p1'},'p1'));
  await respondToGameResult.run(request({matchId:'plan1-M1',gameId:'G1',submissionId:'p1',response:'CONFIRM'},'p2'));
  await process();assert.equal(standing(db,'p1'),10);assert.equal(standing(db,'p5'),undefined);assert.equal(db.get('matches/plan1-M1').scoringState,'PLACEMENTS_PENDING');
  await assert.rejects(adminConfirmMatchStarters.run(request({requestId:'confirm-starters-2',matchId:'plan1-M1',starterPlayerIds:['p1','p2'],reason:'Too late'})),/before play/);
});
test('fractional coalition corrections retain exact units and mask disputed balances',async()=>{
  const {POINT_UNITS}=await import('../lib/engines/seasonPoints.js');
  const db=fixture({count:8});await adminApproveMatchPlan.run(request({requestId:'approve-fractions-1',eventId:'e1',planId:'plan1'},'p8'));
  let count=7;
  await submitGameResult.run(request({matchId:'plan1-M1',gameId:'G1',winnerPlayerIds:Array.from({length:count},(_,i)=>'p'+(i+1))},'p1'));
  await respondToGameResult.run(request({matchId:'plan1-M1',gameId:'G1',submissionId:'p1',response:'CONFIRM'},'p8'));
  await process();
  for(let revision=2;revision<=20;revision++){
    count=[1,3,5,7][revision%4];
    await disputeCanonicalGameResult.run(request({requestId:'fraction-dispute-'+revision,matchId:'plan1-M1',gameId:'G1',category:'WRONG_RESULT',reason:'Synthetic correction regression'},'p8'));
    const masked=await getLeagueBootstrap.run(request({},'p1'));assert.equal(masked.leaderboard.find(p=>p.playerId==='p1').leaguePoints,0);
    await adminResolveCanonicalResultDispute.run(request({requestId:'fraction-correct-'+revision,matchId:'plan1-M1',gameId:'G1',disputeId:'fraction-dispute-'+revision,resolution:'CORRECT',reason:'Synthetic correction regression',winnerPlayerIds:Array.from({length:count},(_,i)=>'p'+(i+1))},'p8'));
    await process();const row=db.get('seasons/s1/standings/p1');
    assert.equal(row.leaguePointUnits,6*POINT_UNITS+6*POINT_UNITS/count);assert.equal(row.leaguePoints,row.leaguePointUnits/POINT_UNITS);
    const winUnits=[...db.entries()].filter(([path,e])=>path.startsWith('leaguePointLedger/')&&e.component==='MATCH_WIN').reduce((sum,[,e])=>sum+e.amountUnits,0);
    assert.equal(winUnits,6*POINT_UNITS);assert.equal((await process()).alreadyProcessed,true);
  }
});
async function seriesFixture(){
  const db=fixture();const plan=db.get('events/e1/matchPlans/plan1');plan.matches=[{format:'ONE_V_ONE',participants:[{playerId:'p1',team:1,slot:1},{playerId:'p5',team:2,slot:2}]}];
  await adminApproveMatchPlan.run(request({requestId:'approve-series-1',eventId:'e1',planId:'plan1'}));
  db.get('matches/plan1-M1').seriesRule={maxGames:3,gamesRequiredToWin:2};
  db.set('matches/plan1-M1/games/G2',{...db.get('matches/plan1-M1/games/G1'),gameNumber:2});
  for(const gameId of ['G1','G2']){
    await submitGameResult.run(request({matchId:'plan1-M1',gameId,winnerTeam:1},'p1'));
    await respondToGameResult.run(request({matchId:'plan1-M1',gameId,submissionId:'p1',response:'CONFIRM'},'p5'));
  }
  return db;
}
test('accepted series finalize once and corrected Games reconcile a single Match award',async()=>{
  const {adminFinalizeMatchSeries}=await import('../lib/commands/results/finalizeMatchSeries.js');
  const db=await seriesFixture();
  const finalize=(requestId,expectedResultRevision)=>adminFinalizeMatchSeries.run(request({requestId,matchId:'plan1-M1',expectedResultRevision,reason:'Accepted series review'}));
  await finalize('series-final-1',0);await process();assert.equal(standing(db,'p1'),12);assert.equal(standing(db,'p5'),4);
  assert.equal((await finalize('series-repeat-1',1)).alreadyFinalized,true);assert.equal((await process()).alreadyProcessed,true);
  await disputeCanonicalGameResult.run(request({requestId:'series-dispute-1',matchId:'plan1-M1',gameId:'G1',category:'WRONG_RESULT',reason:'Correct Game one'},'p5'));
  await adminResolveCanonicalResultDispute.run(request({requestId:'series-correct-1',matchId:'plan1-M1',gameId:'G1',disputeId:'series-dispute-1',resolution:'CORRECT',reason:'Correct Game one',winnerTeam:2}));
  assert.equal(db.get('matches/plan1-M1').activeResultDisputeId,null);
  await assert.rejects(finalize('series-pending-1',1),/no verified/);
  db.set('matches/plan1-M1/games/G3',{...db.get('matches/plan1-M1/games/G2'),gameNumber:3,status:'READY',canonicalResult:null});
  await submitGameResult.run(request({matchId:'plan1-M1',gameId:'G3',winnerTeam:2},'p5'));
  await respondToGameResult.run(request({matchId:'plan1-M1',gameId:'G3',submissionId:'p5',response:'CONFIRM'},'p1'));
  await finalize('series-final-2',1);await process();assert.equal(standing(db,'p1'),4);assert.equal(standing(db,'p5'),10);assert.equal(db.get('seasons/s1/standings/p1').mainEventWins,0);
});
