import test from "node:test";
import assert from "node:assert/strict";
import {
  HONOURS_TEST_VERSION,DRAFT_TEST_RULES,canonicalCurrentGames,
  projectCompetitiveTrophy,evaluateUnbroken,evaluateThreeSchools,
  evaluateFFASoleWinner,evaluateBoomer,evaluateExplorer,evaluateGold,
  evaluateAggression,evaluateDefensive,planHonourChronicleCandidates,
  projectTenHonours
} from "../src/engines/honoursV1Sandbox.mjs";

import {
  honourChronicleEmulatorEnabled,emulateHonourChronicleResponse
} from "../src/engines/honoursV1ChronicleSandbox.mjs";

const day=86400000;
const season0=1_800_000_000_000;
function game(id,battleId,acceptedDay,more={}) {
  const roster=more.roster??["Alice","Bruno"];
  const winners=more.winners??["Alice"];
  return {
    gameId:id,battleId,seasonId:"season-1",format:"1V1",
    roster,winners,outcomeType:"TEAM_WIN",
    sourceState:"CURRENT_READY",sourceRevision:1,resultRevision:1,
    resultState:"FINAL",acceptedAtMs:season0+acceptedDay*day,
    patchModel:"DE_185872",startClass:"STANDARD",gameSpeed:"NORMAL",
    victoryRules:"CONQUEST",measurements:{},...more
  };
}
const season=(games,extra={})=>({
  seasonId:"season-1",seasonStartedAtMs:season0,
  nowMs:season0+12*day,games,careerHistoryComplete:true,...extra
});
const fc=(ms,extra={})=>({
  sourceQualified:true,model:"AOF_OPENING_STATISTICS_V6",
  projectedCastleAgeMs:ms,...extra
});
const baseline=()=>{
  const a=game("ga","ba",2,{measurements:{Alice:{fastCastle:fc(15*60000+12000)}}});
  const b=game("gb","bb",3,{roster:["Bruno","Clara"],winners:["Clara"]});
  const c=game("gc","bc",4,{roster:["Clara","Dora"],winners:["Dora"]});
  const d=game("gd","bd",5,{roster:["Alice","Dora"]});
  const e=game("ge","be",6,{roster:["Alice","Bruno"]});
  return [a,b,c,d,e];
};
const wonder=(time, winner)=>({method:"WONDER_VICTORY",
  verifiedBy:"OFFICIAL_METHOD_REVIEW",resultRevision:1,sourceRevision:1,
  winnerId:winner,winningWonderId:"W-"+winner,
  winningWonderOwnerPlayerId:winner,winningWonderCompleted:true,
  gameEndAtMs:time // retained for negative test only; never a qualifying threshold
});
const source=(more={})=>({sourceQualified:true,modelState:"SOURCE_VALIDATED",
  sourceClockComplete:true,windowMs:30*60000,...more});
const at=(e,p,key,value)=>({...e,measurements:{...e.measurements,[p]:{...e.measurements?.[p],[key]:value}}});

test("all ten candidate honour outputs are present and test-only, with no grant write",()=>{
  const p=projectTenHonours(season(baseline()),"Alice");
  assert.equal(p.schemaVersion,HONOURS_TEST_VERSION);
  assert.equal(p.anyGrantWritten,false);
  assert.deepEqual(Object.keys(p.trophies),["FAST_CASTLE","WONDER"]);
  assert.deepEqual(Object.keys(p.epithets),["UNBROKEN","THREE_SCHOOLS"]);
  assert.deepEqual(Object.keys(p.distinctions),["FFA_SOLO_WIN","BOOMER","EXPLORER","GOLD","AGGRESSION","DEFENSIVE"]);
  assert.equal(p.trophies.FAST_CASTLE.holder,"Alice");
  assert.equal(p.trophies.WONDER.holder,null);
});

test("fast Castle: immature provisional, mature holder, two transfers mid-Season, tie no challenge",()=>{
  const [a,b,c,d,e]=baseline();
  const input=season([a,b,c,d,e]);
  assert.equal(projectCompetitiveTrophy({...input,nowMs:season0+6*day},"FAST_CASTLE").state,"PROVISIONAL_RECORD");
  let result=projectCompetitiveTrophy(input,"FAST_CASTLE");
  assert.equal(result.state,"CURRENT_HOLDER");
  assert.deepEqual(result.history.map(h=>h.playerId),["Alice"]);
  assert.equal(result.history[0].fromMs,season0+7*day);
  const bruno=game("gf","bf",8,{roster:["Bruno","Clara"],winners:["Bruno"],
    measurements:{Bruno:{fastCastle:fc(14*60000+58000)}}});
  result=projectCompetitiveTrophy(season([...baseline(),bruno]),"FAST_CASTLE");
  assert.equal(result.holder,"Bruno");
  assert.deepEqual(result.history.map(h=>h.playerId),["Alice","Bruno"]);
  assert.equal(result.history[0].toMs,season0+8*day);
  const clara=game("gg","bg",9,{roster:["Clara","Dora"],winners:["Clara"],
    measurements:{Clara:{fastCastle:fc(14*60000+46000)}}});
  result=projectCompetitiveTrophy(season([...baseline(),bruno,clara]),"FAST_CASTLE");
  assert.equal(result.holder,"Clara");
  assert.deepEqual(result.history.map(h=>h.playerId),["Alice","Bruno","Clara"]);
  const brunoTie=game("gh","bh",10,{roster:["Bruno","Dora"],winners:["Bruno"],
    measurements:{Bruno:{fastCastle:fc(14*60000+46000)}}});
  result=projectCompetitiveTrophy(season([...baseline(),bruno,clara,brunoTie]),"FAST_CASTLE");
  assert.equal(result.holder,"Clara");
  assert.deepEqual(result.recordHolders,["Bruno","Clara"]);
  assert.equal(result.history.length,3);
});

test("same champion improving their own record updates history but never transfers title to themselves",()=>{
  const first=baseline();
  const better=game("self-improve","b-self",8,{roster:["Alice","Dora"],
    measurements:{Alice:{fastCastle:fc(14*60000+58000)}}});
  const r=projectCompetitiveTrophy(season([...first,better]),"FAST_CASTLE");
  assert.equal(r.holder,"Alice");
  assert.equal(r.history.length,1,"historical holder succession has one legitimate possessor");
  assert.equal(r.history[0].fromMs,season0+7*day);
  assert.equal(r.history[0].toMs,null);
  assert.equal(r.history[0].improvements.length,1);
  assert.equal(r.history[0].improvements[0].valueMs,14*60000+58000);
});

test("corrected and withdrawn sources recalculate legitimate possession and erase invalid succession",()=>{
  const bruno=game("gf","bf",8,{roster:["Bruno","Clara"],
    measurements:{Bruno:{fastCastle:fc(898000)}}});
  const clara=game("gg","bg",9,{roster:["Clara","Dora"],
    measurements:{Clara:{fastCastle:fc(886000)}}});
  let got=projectCompetitiveTrophy(season([...baseline(),bruno,clara]),"FAST_CASTLE");
  assert.deepEqual(got.history.map(h=>h.playerId),["Alice","Bruno","Clara"]);
  got=projectCompetitiveTrophy(season([...baseline(),{...bruno,sourceState:"WITHDRAWN"},clara]),"FAST_CASTLE");
  assert.deepEqual(got.history.map(h=>h.playerId),["Alice","Clara"]);
  got=projectCompetitiveTrophy(season([...baseline(),
    {...bruno,sourceState:"WITHDRAWN"},
    {...clara,measurements:{Clara:{fastCastle:fc(886000,{sourceQualified:false})}}}]),"FAST_CASTLE");
  assert.equal(got.holder,"Alice");
  assert.deepEqual(got.history.map(h=>h.playerId),["Alice"]);
});

test("a first/no-incumbent exact maturity tie does not invent a winner",()=>{
  const [a,b,c,d,e]=baseline();
  const other=game("gb2","bb2",4,{roster:["Bruno","Clara"],
    measurements:{Bruno:{fastCastle:fc(15*60000+12000)}}});
  const s=season([a,b,c,d,e,other]);
  const r=projectCompetitiveTrophy(s,"FAST_CASTLE");
  assert.equal(r.state,"PENDING_TIE_POLICY");
  assert.equal(r.holder,null);
  assert.deepEqual(r.recordHolders,["Alice","Bruno"]);
});

test("incompatible special starts, foreign model, invalid research and missing clock cannot dethrone",()=>{
  const base=baseline();
  const challengers=[
    game("gn","bn",8,{startClass:"NOMAD",measurements:{Bruno:{fastCastle:fc(750000)}}}),
    game("gm","bm",8,{startClass:"MIGRATION",measurements:{Bruno:{fastCastle:fc(720000)}}}),
    game("gv","bv",8,{measurements:{Bruno:{fastCastle:fc(700000,{model:"UNQUALIFIED_MODEL"})}}}),
    game("gx","bx",8,{measurements:{Bruno:{fastCastle:fc(600000,{sourceQualified:false})}}}),
    game("gy","by",8,{measurements:{Bruno:{fastCastle:fc(null)}}})
  ];
  const r=projectCompetitiveTrophy(season([...base,...challengers]),"FAST_CASTLE");
  assert.equal(r.holder,"Alice");
  assert.deepEqual(r.recordHolders,["Alice"]);
});

test("qualified normal Castle research is distinct from Elite trophy performance",()=>{
  const slow=game("slow","b1",9,{
    measurements:{Alice:{fastCastle:fc(17*60000+45000)}}});
  const base=baseline().map(g=>({...g,measurements:{}}));
  const result=projectCompetitiveTrophy(season([...base,slow]),"FAST_CASTLE");
  assert.equal(result.state,"UNCLAIMED_PERFORMANCE");
  assert.equal(result.recordValueMs,17*60000+45000);
});

test("Wonder: first verified victory activates crown; equal win/points cannot dethrone",()=>{
  const w1=game("w1","bw1",2,{victoryRules:"WONDER",
    wonderVictory:wonder(55*60000,"Alice")});
  let r=projectCompetitiveTrophy(season([w1]),"WONDER");
  assert.equal(r.holder,"Alice","no clock or maturity gate after verified Wonder victory");
  assert.equal(r.wonderVictories,1);
  assert.equal(r.wonderPoints,2.5);
  const fake=game("w4","bw4",8,{victoryRules:"WONDER",
    roster:["Bruno","Dora"],winners:["Bruno"],wonderBuildRequested:true});
  r=projectCompetitiveTrophy(season([w1,fake]),"WONDER");
  assert.equal(r.holder,"Alice");
  const verified=game("w5","bw5",9,{victoryRules:"WONDER",
    roster:["Bruno","Dora"],winners:["Bruno"],wonderVictory:wonder(50*60000,"Bruno")});
  r=projectCompetitiveTrophy(season([w1,fake,verified]),"WONDER");
  assert.equal(r.holder,"Alice","faster win time cannot break same victory/points tie");
  assert.deepEqual(r.recordHolders,["Alice","Bruno"]);
  const bonus=game("w6","bw6",10,{winners:["Bruno"],
    roster:["Bruno","Dora"],wonderConstructions:[{
      buildingInstanceId:"extra-B",ownerPlayerId:"Bruno",complete:true,
      verifiedBy:"INDEPENDENT_CONSTRUCTION_REVIEW",sourceRevision:1,
    }]});
  r=projectCompetitiveTrophy(season([w1,fake,verified,bonus]),"WONDER");
  assert.equal(r.holder,"Bruno","0.5 verified construction point breaks victory tie");
  assert.deepEqual(r.history.map(h=>h.playerId),["Alice","Bruno"]);
  const wrong=game("w7","bw7",11,{victoryRules:"WONDER",
    roster:["Bruno","Dora"],winners:["Bruno"],
    wonderVictory:{...wonder(10*60000,"Bruno"),verifiedBy:"REPLAY_BUILD_REQUEST"}});
  assert.equal(projectCompetitiveTrophy(season([w1,fake,verified,bonus,wrong]),"WONDER").holder,"Bruno");
});

test("Unbroken: four verified 1v1/team Games, FFA loss ignored, next normal loss revokes",()=>{
  const wins=["g1","g2","g3","g4"].map((id,i)=>
    game(id,"b"+i,i+1,{winners:["Alice"]}));
  const ffaLoss=game("ffa","bf",5,{format:"FFA",
    roster:["Alice","Bruno","Clara"],winners:["Bruno"],outcomeType:"PLAYER_WIN"});
  let r=evaluateUnbroken(season([...wins,ffaLoss]),"Alice");
  assert.equal(r.state,"ACTIVE");
  assert.equal(r.wins,4);
  assert.equal(evaluateUnbroken(season([...wins,ffaLoss,
    game("loss","bl",6,{winners:["Bruno"]})]),"Alice").state,"INACTIVE_LOST");
  const unresolved=game("pending","bp",6,{resultState:"PENDING"});
  assert.equal(evaluateUnbroken(season([...wins,unresolved]),"Alice").state,"PENDING_OFFICIAL_RESULTS");
  assert.equal(evaluateUnbroken(season(wins.slice(0,3)),"Alice").state,"NOT_YET_QUALIFIED");
});

test("Master only active Elite Drush+Flush, Scouts/Archers, FC boom",()=>{
  const e=(code,more={})=>({playerId:"Alice",tier:"ELITE",qualified:true,
    sourceCurrent:true,code,...more});
  assert.equal(evaluateThreeSchools({eliteQualifications:[e("DISCIPLINED_DRUSH_WITH_FLUSH"),
    e("SCOUT_RUSH"),e("FAST_CASTLE_BOOM")]},"Alice").state,"QUALIFIED");
  assert.equal(evaluateThreeSchools({eliteQualifications:[e("DISCIPLINED_DRUSH"),
    e("ARCHER_RUSH"),e("FAST_CASTLE_BOOM")]},"Alice").state,"PENDING_ELITE_QUALIFICATION");
  assert.equal(evaluateThreeSchools({eliteQualifications:[e("DISCIPLINED_DRUSH_WITH_FLUSH"),
    e("SCOUT_RUSH",{sourceCurrent:false}),e("FAST_CASTLE_BOOM")]},"Alice").state,"PENDING_ELITE_QUALIFICATION");
});

test("FFA medal: sole official victor counts one independent Battle, coalition never counts",()=>{
  const win=game("ffa1","bffa1",1,{format:"FFA",roster:["Alice","Bruno","Clara"],
    outcomeType:"PLAYER_WIN",winners:["Alice"]});
  const sameBattle=game("ffa2","bffa1",2,{format:"FFA",roster:["Alice","Bruno","Clara"],
    outcomeType:"PLAYER_WIN",winners:["Alice"]});
  const next=game("ffa3","bffa2",3,{format:"FFA",roster:["Alice","Dora","Clara"],
    outcomeType:"PLAYER_WIN",winners:["Alice"]});
  const coalition=game("ffa4","bffa3",4,{format:"FFA",roster:["Alice","Dora","Clara"],
    outcomeType:"COALITION_WIN",winners:["Alice","Dora"]});
  assert.equal(evaluateFFASoleWinner(season([win,sameBattle,coalition]),"Alice").grade,"I");
  const r=evaluateFFASoleWinner(season([win,sameBattle,next,coalition]),"Alice");
  assert.equal(r.grade,"II");
  assert.equal(r.distinctBattles,2);
  assert.equal(r.claim,"SOLE_OFFICIAL_FFA_WINNER_NOT_UNAIDED");
});

test("FFA same medal upgrades across Seasons and corrections remove invalid Battle victories",()=>{
  const a=game("g1","b1",2,{format:"FFA",roster:["Alice","Bruno","Clara"],
    winners:["Alice"],outcomeType:"PLAYER_WIN",seasonId:"season-1"});
  const b=game("g2","b2",3,{format:"FFA",roster:["Alice","Bruno","Dora"],
    winners:["Alice"],outcomeType:"PLAYER_WIN",seasonId:"season-2"});
  const c=game("g3","b3",4,{format:"FFA",roster:["Alice","Bruno","Clara"],
    winners:["Alice"],outcomeType:"PLAYER_WIN",seasonId:"season-3"});
  const input=season([a],{careerGames:[a,b,c],careerHistoryComplete:true});
  let result=evaluateFFASoleWinner(input,"Alice");
  assert.equal(result.distinctBattles,3);
  assert.equal(result.grade,"II","one lifetime medal, upgraded across Seasons");
  result=evaluateFFASoleWinner({...input,careerGames:[a,b,{...c,sourceState:"WITHDRAWN"}]},"Alice");
  assert.equal(result.distinctBattles,2);
  result=evaluateFFASoleWinner({...input,careerHistoryComplete:false},"Alice");
  assert.equal(result.state,"PENDING_CAREER_HISTORY");
  assert.equal(result.grade,null,"incomplete historic archive cannot finalize medal grade");
});

test("Boomer: one-game 30 minute four-part requirement, not spliced from other Games",()=>{
  const evidence=source({additionalTCSites:2,villagerQueueEstimate:78,
    uniqueHouseSites:11,expansionZoneClusters:3,distinctSitesVerified:true,
    civilization:"Franks"});
  const g=at(game("boom","bb",3),"Alice","boomer",evidence);
  assert.equal(evaluateBoomer(season([g]),"Alice").state,"QUALIFIED");
  const fail=at(g,"Alice","boomer",{...evidence,expansionZoneClusters:2});
  assert.equal(evaluateBoomer(season([fail]),"Alice").state,"NOT_YET_QUALIFIED");
  const huns=at(g,"Alice","boomer",{...evidence,civilization:"Huns"});
  assert.equal(evaluateBoomer(season([huns]),"Alice").state,"PENDING_EVIDENCE","Huns need a fair alternate branch; not an impossible failed House count");
  const early=at(g,"Alice","boomer",{...evidence,windowMs:20*60000});
  assert.notEqual(evaluateBoomer(season([early]),"Alice").state,"QUALIFIED");
});

test("Explorer: existing command-route proxy cannot earn 90% despite inflated percent",()=>{
  const e=source({modelVersion:"AOF_MAP_PRESENCE_V6",
    modelValidatedAgainstFog:false,coverageLowerBoundPercent:99,confidence:1});
  const g=at(game("explorer","be",3),"Alice","explorer",e);
  assert.equal(evaluateExplorer(season([g]),"Alice").state,"PENDING_EVIDENCE","Existing command-route proxy is missing required validation");
  const proper=at(g,"Alice","explorer",{...e,
    modelVersion:"AOF_ESTIMATED_EXPLORATION_V1",
    modelValidatedAgainstFog:true,coverageLowerBoundPercent:91,confidence:0.9});
  assert.equal(evaluateExplorer(season([proper]),"Alice").state,"QUALIFIED");
  const uncertain=at(proper,"Alice","explorer",{...proper.measurements.Alice.explorer,
    coverageLowerBoundPercent:86});
  assert.notEqual(evaluateExplorer(season([uncertain]),"Alice").state,"QUALIFIED");
});

test("Gold: gold-queue commitment + infrastructure influence, not received trade",()=>{
  const e=source({goldDenominatedQueueCommitment:2600,
    goldInfrastructureInfluencePercent:68,goldOpportunitiesComparable:true});
  const g=at(game("gold","bg",3),"Alice","gold",e);
  assert.equal(evaluateGold(season([g]),"Alice").state,"QUALIFIED");
  const tradeOnly=at(g,"Alice","gold",{...e,goldDenominatedQueueCommitment:10,tradeUnitsQueued:300});
  assert.notEqual(evaluateGold(season([tradeOnly]),"Alice").state,"QUALIFIED");
});

test("Aggression and Defence: strong source alone remains pending private Chronicle testimony",()=>{
  const a=at(game("battle","bb",3),"Alice","aggression",source({
    gameId:"battle",battleId:"bb",episodeId:"attack-1",sourceRevision:"S1",
    windowMs:35*60000,directedPressureEpisodes:6,engagementEpisodes:3,
    battleParticipationSharePercent:55,opponentIds:["Bruno"]}));
  const d=at(a,"Alice","defensive",source({
    gameId:"battle",battleId:"bb",episodeId:"defense-1",sourceRevision:"S1",
    windowMs:35*60000,incomingThreatLevel:4,qualifiedResponseOrders:2,
    directionVerified:true,witnessIds:["Bruno"]}));
  let input=season([d],{eligibleBattleOrder:["bb"]});
  let r=projectTenHonours(input,"Alice");
  assert.equal(r.distinctions.AGGRESSION.state,"PENDING_CHRONICLE");
  assert.equal(r.distinctions.DEFENSIVE.state,"PENDING_CHRONICLE");
  assert.equal(r.plannedChronicleCandidates.length,1,"one respondent per Battle");
  assert.equal(r.plannedChronicleCandidates[0].kind,"DEFENCE","specific support prioritized");
  assert.equal(r.plannedChronicleCandidates[0].offered,false);
  assert.equal(r.plannedChronicleCandidates[0].visibility,"AUTHOR_ONLY");
  assert.equal(r.plannedChronicleCandidates[0].grantEffect,false);

  const answer=(kind,episodeId)=>({kind,battleId:"bb",gameId:"battle",
    episodeId,sourceRevision:"S1",respondentPlayerId:"Bruno",
    state:"SUBMITTED",choice:"ACKNOWLEDGED",visibility:"AUTHOR_ONLY",verifiedRespondent:true});
  input={...input,chroniclePerspectives:[answer("AGGRESSION","attack-1"),
    answer("DEFENCE","defense-1")]};
  r=projectTenHonours(input,"Alice");
  assert.equal(r.distinctions.AGGRESSION.state,"QUALIFIED");
  assert.equal(r.distinctions.DEFENSIVE.state,"QUALIFIED");
  input={...input,chroniclePerspectives:[{...answer("AGGRESSION","attack-1"),sourceRevision:"OLD"}]};
  assert.equal(evaluateAggression(input,"Alice").state,"PENDING_CHRONICLE");
  assert.equal(evaluateDefensive(input,"Alice").state,"PENDING_CHRONICLE");
});

test("Chronicle invitations honor three independently eligible Battles cooldown and no double offer",()=>{
  const input={eligibleBattleOrder:["b1","b2","b3","b4","b5"],
    chronicleOfferHistory:[{respondentPlayerId:"Bruno",battleId:"b1"}]};
  const c=b=>({testOnly:true,offered:false,grantEffect:false,visibility:"AUTHOR_ONLY",
    sourceRevision:"S1",respondentPlayerId:"Bruno",episodeId:"a",
    kind:"DEFENCE",battleId:b,gameId:"g-"+b});
  assert.deepEqual(planHonourChronicleCandidates(input,[c("b2"),c("b3"),c("b4")]),[]);
  assert.deepEqual(planHonourChronicleCandidates(input,[c("b5"),c("b5")]).map(x=>x.battleId),["b5"]);
  assert.deepEqual(planHonourChronicleCandidates({eligibleBattleOrder:[]},[c("b5")]),[]);
  assert.deepEqual(planHonourChronicleCandidates({
    eligibleBattleOrder:["b1","b2","b3","b4","b5"],chronicleOfferHistory:[]
  },[c("b1"),c("b2"),c("b5")]).map(x=>x.battleId),
    ["b1","b5"],"same-batch planned offers must also reserve the cooldown");
  assert.deepEqual(planHonourChronicleCandidates({eligibleBattleOrder:["b1"]},
    [{...c("b1"),testOnly:false}]),[]);
});

test("missing or mismatched trusted source Game/POV is not counted twice",()=>{
  const g=game("dup","b1",3);
  assert.equal(canonicalCurrentGames([g,g],"season-1").length,1);
  assert.throws(()=>canonicalCurrentGames([g,{...g,resultRevision:2}],"season-1"),/Conflicting canonical/);
  assert.equal(evaluateUnbroken(season([g,g]),"Alice").wins,1);
});

test("draft gates are explicitly provisional and cannot change production grants",()=>{
  assert.equal(DRAFT_TEST_RULES.unbrokenWins,4);
  assert.equal(DRAFT_TEST_RULES.explorer.lowerBoundPercent,90);
  assert.equal(DRAFT_TEST_RULES.fastCastleMaximumMs,930000);
  const e=projectTenHonours(season([]),"Alice");
  assert.equal(e.anyGrantWritten,false);
  assert.equal(e.trophies.FAST_CASTLE.holder,null);
  assert.equal(e.distinctions.EXPLORER.state,"PENDING_EVIDENCE");
});

test("Chronicle acknowledgement round trip is restricted to exact source and authenticated recipient in demo emulator",()=>{
  const env={FUNCTIONS_EMULATOR:"true",GCLOUD_PROJECT:"demo-aof",
    AOF_HONOUR_CHRONICLE_V1:"emulator-only"};
  assert.equal(honourChronicleEmulatorEnabled(env),true);
  for(const wrong of [
    {},{...env,GCLOUD_PROJECT:"age-of-friends-prod"},
    {...env,FUNCTIONS_EMULATOR:"false"},
    {...env,AOF_HONOUR_CHRONICLE_V1:"live"}
  ])assert.equal(honourChronicleEmulatorEnabled(wrong),false);

  const e=at(game("g-private","b-private",3),"Alice","aggression",source({
    gameId:"g-private",battleId:"b-private",episodeId:"attack",sourceRevision:"S1",
    windowMs:35*60000,directedPressureEpisodes:6,engagementEpisodes:4,
    battleParticipationSharePercent:65,opponentIds:["Bruno"]}));
  const input=season([e],{eligibleBattleOrder:["b-private"]});
  const projected=projectTenHonours(input,"Alice");
  const candidate=projected.plannedChronicleCandidates[0];
  assert.equal(candidate.respondentPlayerId,"Bruno");
  assert.equal(projected.distinctions.AGGRESSION.state,"PENDING_CHRONICLE");
  const person={playerId:"Bruno",authenticated:true};
  const action={choice:"ACKNOWLEDGED",expectedSourceRevision:"S1"};
  assert.throws(()=>emulateHonourChronicleResponse({candidate,actor:person,action,env:{}}),
    /emulator-only/);
  assert.throws(()=>emulateHonourChronicleResponse({candidate,
    actor:{playerId:"Alice",authenticated:true},action,env}),/exact authenticated/);
  assert.throws(()=>emulateHonourChronicleResponse({candidate,actor:person,
    action:{...action,expectedSourceRevision:"OLD"},env}),/Stale/);
  const response=emulateHonourChronicleResponse({candidate,actor:person,action,env});
  assert.equal(response.state,"SUBMITTED");
  assert.equal(response.visibility,"AUTHOR_ONLY");
  assert.equal(response.invitationSent,false);
  assert.deepEqual(response.officialEffects,[]);
  assert.equal(projectTenHonours({...input,chroniclePerspectives:[response]},"Alice")
    .distinctions.AGGRESSION.state,"QUALIFIED");
  for(const choice of ["DECLINE","UNSURE","NOT_PERSONALLY_MEANINGFUL"]){
    const response=emulateHonourChronicleResponse({candidate,actor:person,
      action:{choice,expectedSourceRevision:"S1"},env});
    assert.equal(projectTenHonours({...input,chroniclePerspectives:[response]},"Alice")
      .distinctions.AGGRESSION.state,"PENDING_CHRONICLE");
  }
});

test("optional Chronicle statements never substitute for Wonder method, fog model, trade income, or actual rescue",()=>{
  const env={FUNCTIONS_EMULATOR:"true",GCLOUD_PROJECT:"demo-aof",
    AOF_HONOUR_CHRONICLE_V1:"emulator-only"};
  const g=game("no-proof","b",4,{victoryRules:"WONDER",wonderBuildRequested:true,
    measurements:{Alice:{
      explorer:source({modelVersion:"AOF_MAP_PRESENCE_V6",modelValidatedAgainstFog:false,
        coverageLowerBoundPercent:99,confidence:1}),
      defensive:source({gameId:"no-proof",battleId:"b",episodeId:"def-1",
        sourceRevision:"S1",windowMs:35*60000,qualifiedResponseOrders:2,
        incomingThreatLevel:3,directionVerified:true,witnessIds:["Bruno"]})
    }}});
  const c=projectTenHonours(season([g],{eligibleBattleOrder:["b"]}),"Alice");
  assert.equal(c.trophies.WONDER.holder,null);
  assert.notEqual(c.distinctions.EXPLORER.state,"QUALIFIED");
  const candidate=c.plannedChronicleCandidates[0];
  const response=emulateHonourChronicleResponse({candidate,
    actor:{playerId:"Bruno",authenticated:true},
    action:{choice:"ACKNOWLEDGED",expectedSourceRevision:"S1"},env});
  const after=projectTenHonours(season([g],{eligibleBattleOrder:["b"],
    chroniclePerspectives:[response]}),"Alice");
  assert.equal(after.distinctions.DEFENSIVE.state,"QUALIFIED");
  assert.equal(after.trophies.WONDER.holder,null);
  assert.notEqual(after.distinctions.EXPLORER.state,"QUALIFIED");
  assert.equal(response.meaning,"AUTHOR_PERSPECTIVE_ONLY_NO_EXECUTED_EFFECT_INFERENCE");
});
