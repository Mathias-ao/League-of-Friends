import test from "node:test";
import assert from "node:assert/strict";
import {
  HONOURS_STATISTICS_ADAPTER_TEST_VERSION,
  normalizeTrustedHonoursGame
} from "../src/engines/honoursV1StatisticsAdapter.mjs";
import {
  evaluateUnbroken,evaluateFFASoleWinner,projectCompetitiveTrophy
} from "../src/engines/honoursV1Sandbox.mjs";

const base=()=>{
  const participants=[{playerId:"Alice",team:1},{playerId:"Bruno",team:2}];
  return {
    statistics:{
      gameId:"g1",matchId:"b1",seasonId:"s1",eligible:true,
      revision:5,sourceHash:"sha-current",players:participants.map(x=>({
        playerId:x.playerId,
        values:{castle:x.playerId==="Alice"?900000:1000000},
        models:{castle:"AOF_OPENING_STATISTICS_V6"},unavailable:{},
      }))
    },
    match:{
      format:"ONE_V_ONE",seasonId:"s1",participants,
      gameConfigSnapshot:{victory:{wonder:false},diplomacyEnabled:false}
    },
    source:{
      matchId:"b1",gameId:"g1",nativeReady:true,activeSourceHash:"sha-current",
      activeStatisticsRevision:5,activeResultRevision:2,
      resultUndisputed:true,officialRecognitionAtMs:1800000000000,
    },
    canonicalResult:{type:"TEAM_WIN",winnerTeam:1,
      winnerPlayerId:null,revision:2,winningPlayerIds:["Alice"]},
    opportunityReview:{
      gameId:"g1",sourceHash:"sha-current",approval:"SOURCE_REVIEWED",
      startClass:"STANDARD",patchModel:"DE_185872",gameSpeed:"NORMAL"
    },
    metricReviews:{
      Alice:{fastCastle:{gameId:"g1",sourceHash:"sha-current",sourceRevision:5,
        proof:"SOURCE_QUALIFIED_RESEARCH_AND_CANCELLATION"}}
    }
  };
};
const season=(games)=>({seasonId:"s1",seasonStartedAtMs:1800000000000-10*86400000,
  nowMs:1800000000000+86400000,games,careerHistoryComplete:true});

test("AoF ONE_V_ONE official TEAM_WIN + current GameStatistics becomes guarded eligible FC and Game win",()=>{
  const a=normalizeTrustedHonoursGame(base());
  assert.equal(a.adapterVersion,HONOURS_STATISTICS_ADAPTER_TEST_VERSION);
  assert.equal(a.format,"1V1");
  assert.equal(a.gameId,"g1");
  assert.equal(a.battleId,"b1");
  assert.equal(a.sourceState,"CURRENT_READY");
  assert.equal(a.resultState,"FINAL");
  assert.deepEqual(a.winners,["Alice"]);
  assert.equal(a.measurements.Alice.fastCastle.projectedCastleAgeMs,900000);
  assert.equal(a.measurements.Bruno.fastCastle,undefined);
  assert.equal(evaluateUnbroken(season([a]),"Alice").wins,1);
});

test("Source hash, projection revision, current source and reviewed FC cancellation must all agree",()=>{
  const x=base();
  const stale=normalizeTrustedHonoursGame({...x,
    source:{...x.source,activeSourceHash:"sha-stale"}});
  assert.equal(stale.sourceState,"PENDING_EVIDENCE");
  assert.equal(stale.resultState,"PENDING");
  const invalidTime=normalizeTrustedHonoursGame({...x,
    metricReviews:{Alice:{fastCastle:{...x.metricReviews.Alice.fastCastle,
      sourceRevision:4}}}});
  assert.equal(invalidTime.measurements.Alice.fastCastle,undefined);
  const unreviewed=normalizeTrustedHonoursGame({...x,opportunityReview:null});
  assert.equal(unreviewed.startClass,null);
  assert.equal(projectCompetitiveTrophy(season([unreviewed]),"FAST_CASTLE").state,"PENDING_EVIDENCE");
});

test("Official FFA PLAYER_WIN is sole winner; coalition remains excluded from solo medal",()=>{
  const x=base();
  const ffa={...x,
    match:{...x.match,format:"FFA",participants:[
      {playerId:"Alice",team:null},{playerId:"Bruno",team:null},{playerId:"Clara",team:null}
    ],gameConfigSnapshot:{diplomacyEnabled:true,victory:{wonder:false}}},
    statistics:{...x.statistics,players:[
      ...x.statistics.players,{playerId:"Clara",values:{castle:null},models:{},unavailable:{}}
    ]},
    canonicalResult:{type:"PLAYER_WIN",winnerTeam:null,winnerPlayerId:"Alice",
      revision:2,winningPlayerIds:["Alice"]}
  };
  const win=normalizeTrustedHonoursGame(ffa);
  assert.equal(win.format,"FFA");
  assert.equal(evaluateFFASoleWinner(season([win]),"Alice").grade,"I");
  const coalition=normalizeTrustedHonoursGame({...ffa,
    canonicalResult:{type:"COALITION_WIN",winnerTeam:null,winnerPlayerId:null,
      winnerPlayerIds:["Alice","Clara"],revision:2,winningPlayerIds:["Alice","Clara"]}});
  assert.equal(evaluateFFASoleWinner(season([coalition]),"Alice").grade,null);
  assert.equal(evaluateFFASoleWinner(season([coalition]),"Alice").state,"NOT_YET_QUALIFIED");
});

test("Wonder result requires exact official winner+result revision and independent method review",()=>{
  const x=base();
  const w={...x,match:{...x.match,
    gameConfigSnapshot:{...x.match.gameConfigSnapshot,victory:{wonder:true}}}};
  const none=normalizeTrustedHonoursGame(w);
  assert.equal(none.wonderVictory,null);
  const approved={method:"WONDER_VICTORY",verifiedBy:"OFFICIAL_METHOD_REVIEW",
    gameId:"g1",sourceHash:"sha-current",resultRevision:2,
    winnerId:"Alice",completeTimerWitness:true,gameEndAtMs:52*60000};
  const yes=normalizeTrustedHonoursGame({...w,wonderMethodReview:approved});
  assert.equal(yes.victoryRules,"WONDER");
  assert.equal(yes.wonderVictory.gameEndAtMs,52*60000);
  assert.equal(normalizeTrustedHonoursGame({...w,wonderMethodReview:
    {...approved,winnerId:"Bruno"}}).wonderVictory,null);
  assert.equal(normalizeTrustedHonoursGame({...w,wonderMethodReview:
    {...approved,resultRevision:1}}).wonderVictory,null);
  assert.equal(normalizeTrustedHonoursGame({...w,wonderMethodReview:
    {...approved,verifiedBy:"CLAIMED_IN_CHAT"}}).wonderVictory,null);
});

test("Only source-reviewed per-metric facts are admitted, not arbitrary player-provided stats",()=>{
  const x=base();
  const metric={sourceHash:"sha-current",gameId:"g1",sourceRevision:5,
    proof:"SOURCE_REVIEWED_METRIC",evidence:{windowMs:1800000,
      goldDenominatedQueueCommitment:2700,goldInfrastructureInfluencePercent:70}};
  const a=normalizeTrustedHonoursGame({...x,metricReviews:{
    Alice:{...x.metricReviews.Alice,gold:metric}}});
  assert.equal(a.measurements.Alice.gold.sourceQualified,true);
  assert.equal(a.measurements.Alice.gold.modelState,"SOURCE_VALIDATED");
  const b=normalizeTrustedHonoursGame({...x,metricReviews:{
    Alice:{...x.metricReviews.Alice,gold:{...metric,sourceHash:"old"}}}});
  assert.equal(b.measurements.Alice.gold,undefined);
  const c=normalizeTrustedHonoursGame({...x,metricReviews:{
    Alice:{...x.metricReviews.Alice,gold:{...metric,proof:"PLAYER_REPORT"}}}});
  assert.equal(c.measurements.Alice.gold,undefined);
});

test("Unknown official result, disputed revision and conflicting canonical identities fail closed",()=>{
  const x=base();
  assert.equal(normalizeTrustedHonoursGame({...x,source:{
    ...x.source,resultUndisputed:false}}).resultState,"PENDING");
  assert.equal(normalizeTrustedHonoursGame({...x,source:{
    ...x.source,activeResultRevision:3}}).resultState,"PENDING");
  assert.throws(()=>normalizeTrustedHonoursGame({...x,match:{
    ...x.match,seasonId:"other"}}),/Incomplete authoritative/);
  assert.throws(()=>normalizeTrustedHonoursGame({...x,match:{
    ...x.match,format:"EXPERIMENTAL_UNKNOWN"}}),/Unsupported canonical/);
  assert.equal(normalizeTrustedHonoursGame({...x,canonicalResult:{
    type:"TEAM_WIN",winnerTeam:1,revision:2,winningPlayerIds:["Bruno"]
  }}).resultState,"PENDING");
});
