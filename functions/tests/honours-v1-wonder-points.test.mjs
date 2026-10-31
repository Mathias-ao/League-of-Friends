import test from "node:test";
import assert from "node:assert/strict";
import {projectWonderTrophy,WONDER_POINT_UNITS} from "../src/engines/honoursV1Wonder.mjs";
import {projectCompetitiveTrophy} from "../src/engines/honoursV1Sandbox.mjs";

const start=1_800_000_000_000, day=86400000;
const season=games=>({seasonId:"s1",nowMs:start+14*day,games});
function game(id,atDay,opts={}) {
  return {
    gameId:id,battleId:opts.battleId??"b-"+id,seasonId:"s1",
    sourceState:"CURRENT_READY",resultState:"FINAL",
    sourceRevision:1,resultRevision:2,
    acceptedAtMs:start+atDay*day,format:opts.format??"1V1",
    roster:opts.roster??["Alice","Bruno"],winners:opts.winners??["Alice"],
    victoryRules:opts.victoryRules??"CONQUEST",
    ...opts,
  };
}
function construction(id,ownerPlayerId){
  return {buildingInstanceId:id,ownerPlayerId,complete:true,
    verifiedBy:"INDEPENDENT_CONSTRUCTION_REVIEW",sourceRevision:1};
}
function win(id,atDay,who="Alice",opts={}) {
  return game(id,atDay,{
    victoryRules:"WONDER",winners:[who],...opts,
    wonderVictory:{
      method:"WONDER_VICTORY",verifiedBy:"OFFICIAL_METHOD_REVIEW",
      winnerId:who,winningWonderId:"wonder-"+id,
      winningWonderOwnerPlayerId:who,winningWonderCompleted:true,
      sourceRevision:1,resultRevision:2,
      ...opts.wonderVictory,
    },
  });
}
const find=(p,id)=>p.standings.find(s=>s.playerId===id);

test("owner point schedule is 0.5 completed build, 2 own Wonder victory, 1 ally, 3 race win",()=>{
  assert.deepEqual(WONDER_POINT_UNITS,{
    COMPLETED_WONDER:1,OWN_WONDER_VICTORY:4,
    ALLIED_WONDER_VICTORY:2,WONDER_CHALLENGE_WIN:6,
  });
  const owner=win("win-1",1);
  const result=projectWonderTrophy(season([owner]));
  assert.equal(result.state,"CURRENT_HOLDER","first verified Wonder victory activates immediately");
  assert.equal(result.holder,"Alice");
  assert.equal(find(result,"Alice").wonderVictories,1);
  assert.equal(find(result,"Alice").wonderPoints,2.5);
  assert.equal(find(result,"Alice").pointUnits,5);
  assert.deepEqual(result.pointsSchedule,{builtWonder:0.5,ownWonderVictory:2,
    allyWonderVictory:1,wonderChallengeWin:3});
});

test("constructing Wonders alone earns half points but never activates trophy without own Wonder victory",()=>{
  const build=game("built",1,{
    wonderConstructions:[construction("W1","Alice"),construction("W1","Alice"),
      construction("W2","Alice"),{...construction("W3","Alice"),complete:false}],
  });
  const result=projectWonderTrophy(season([build]));
  assert.equal(result.holder,null);
  assert.equal(result.state,"UNCLAIMED_NO_WONDER_VICTORY");
  assert.equal(find(result,"Alice").completedWonders,2);
  assert.equal(find(result,"Alice").wonderPoints,1);
  assert.equal(find(result,"Alice").wonderVictories,0);
});

test("team Wonder victory gives 2 to builder plus 0.5 building and 1 to winning ally, no ally victory count",()=>{
  const team=win("team-w",1,"Alice",{format:"TEAM",
    roster:["Alice","Bruno","Clara","Dora"],winners:["Alice","Bruno"]});
  const r=projectWonderTrophy(season([team]));
  assert.equal(r.holder,"Alice");
  assert.equal(find(r,"Alice").wonderPoints,2.5);
  assert.equal(find(r,"Bruno").wonderPoints,1);
  assert.equal(find(r,"Bruno").wonderVictories,0);
  assert.equal(r.recordHolders.length,1);
});

test("Wonder challenge victory gives +3 points ON TOP of own Wonder victory and verified winning Wonder construction",()=>{
  const challenge=win("race-final",1,"Alice",{
    wonderChallenge:{gameId:"race-final",challengeId:"challenge-1",
      status:"OFFICIALLY_COMPLETED",review:"VERIFIED_WONDER_RACE_RESULT",
      winnerId:"Alice",sourceRevision:1,resultRevision:2},
  });
  const r=projectWonderTrophy(season([challenge]));
  assert.equal(find(r,"Alice").wonderVictories,1);
  assert.equal(find(r,"Alice").challengeVictories,1);
  assert.equal(find(r,"Alice").wonderPoints,5.5,"0.5 built + 2 victory + 3 challenge");
  const forged=win("forged",2,"Bruno",{
    wonderChallenge:{gameId:"forged",challengeId:"not-reviewed",
      status:"OFFICIALLY_COMPLETED",review:"CLAIMED_BY_PLAYER",
      winnerId:"Bruno",sourceRevision:1,resultRevision:2},
    roster:["Alice","Bruno"],
  });
  const r2=projectWonderTrophy(season([challenge,forged]));
  assert.equal(find(r2,"Bruno").challengeVictories,0);
  assert.equal(find(r2,"Bruno").wonderPoints,2.5);
});

test("Wonder victory count ranks first; 2 wins beat 1 race win even if race earned more points",()=>{
  const a1=win("a1",1,"Alice"),a2=win("a2",3,"Alice");
  const b1=win("b1",2,"Bruno",{
    wonderChallenge:{gameId:"b1",challengeId:"r",status:"OFFICIALLY_COMPLETED",
      review:"VERIFIED_WONDER_RACE_RESULT",winnerId:"Bruno",sourceRevision:1,resultRevision:2},
  });
  const r=projectWonderTrophy(season([a1,b1,a2]));
  assert.equal(find(r,"Bruno").wonderPoints,5.5);
  assert.equal(find(r,"Alice").wonderPoints,5);
  assert.equal(r.holder,"Alice");
  assert.equal(r.standings[0].wonderVictories,2);
  assert.equal(r.primaryRank,"WONDER_VICTORIES_DESC");
  assert.equal(r.tieBreak,"WONDER_POINTS_DESC");
});

test("one victory each, points resolve tie; on exact equality incumbent remains; later +0.5 building takes trophy",()=>{
  const a=win("a",1,"Alice");
  const b=win("b",2,"Bruno");
  let r=projectWonderTrophy(season([a,b]));
  assert.equal(r.holder,"Alice","Bruno's equal victories and points do not transfer");
  assert.deepEqual(r.recordHolders,["Alice","Bruno"]);
  const extra=game("bonus-wonder",3,{
    winners:["Bruno"],wonderConstructions:[construction("B2","Bruno")],
  });
  r=projectWonderTrophy(season([a,b,extra]));
  assert.equal(r.holder,"Bruno","one verified 0.5 point Wonder construction breaks victory tie");
  assert.equal(find(r,"Bruno").wonderVictories,1);
  assert.equal(find(r,"Bruno").wonderPoints,3);
  assert.deepEqual(r.history.map(h=>h.playerId),["Alice","Bruno"]);
});

test("exact first-arrival tie with no incumbent stays pending rather than alphabetical or upload-order grant",()=>{
  const a=win("a",1,"Alice");
  const b=win("b",1,"Bruno");
  const r=projectWonderTrophy(season([a,b]));
  assert.equal(r.holder,null);
  assert.equal(r.state,"PENDING_TIE_POLICY");
  assert.deepEqual(r.recordHolders,["Alice","Bruno"]);
  assert.equal(r.history.length,0);
});

test("verified Wonder victories never use fastest win duration, 20min, 90min, or Wonder clock",()=>{
  const slow=win("slow",1,"Alice",{wonderVictory:{gameEndAtMs:120*60000}});
  const fast=win("fast",2,"Bruno",{wonderVictory:{gameEndAtMs:10*60000}});
  const r=projectWonderTrophy(season([slow,fast]));
  assert.equal(r.holder,"Alice","fast clock cannot defeat existing equal Wonder victory & points");
  assert.equal(r.timeEligibility,false);
  assert.equal(find(r,"Alice").wonderVictories,1);
  assert.equal(find(r,"Bruno").wonderVictories,1);
  const noTime=win("no-time",3,"Alice");
  assert.equal(projectWonderTrophy(season([slow,fast,noTime])).holder,"Alice");
  assert.equal(find(projectWonderTrophy(season([noTime])),"Alice").wonderPoints,2.5);
});

test("building request, unreviewed victory method and stale winner source cannot earn any point",()=>{
  const raw=game("raw",1,{wonderBuildRequested:true,
    wonderConstructions:[{...construction("W1","Alice"),verifiedBy:"BUILD_REQUEST"}]});
  const g=win("claimed",2,"Alice",{wonderVictory:{verifiedBy:"CLAIMED_IN_CHAT"}});
  const stale=win("stale",3,"Bruno",{wonderVictory:{sourceRevision:44}});
  const score=projectWonderTrophy(season([raw,g,stale]));
  assert.equal(score.holder,null);
  assert.equal(score.standings.length,0);
  const wrongBuilder=win("bad-owner",4,"Alice",{wonderVictory:{winningWonderOwnerPlayerId:"Bruno"}});
  assert.equal(projectWonderTrophy(season([wrongBuilder])).holder,null);
});

test("same winning Wonder object is counted once even when also in completed constructions",()=>{
  const g=win("known-wonder",1,"Alice",{
    wonderConstructions:[construction("wonder-known-wonder","Alice"),
      construction("wonder-known-wonder","Alice")],
  });
  const r=projectWonderTrophy(season([g]));
  assert.equal(find(r,"Alice").completedWonders,1);
  assert.equal(find(r,"Alice").wonderPoints,2.5);
});

test("FFA ally points require source-verified effective alliance, not roster/diplomacy guess",()=>{
  const ffa=win("ffa",1,"Alice",{format:"FFA",
    roster:["Alice","Bruno","Clara"],winners:["Alice","Bruno"],
    wonderVictory:{qualifiedAllyPlayerIds:["Bruno"]}});
  const plain=projectWonderTrophy(season([ffa]));
  assert.equal(find(plain,"Bruno"),undefined);
  const review=win("ffa",1,"Alice",{format:"FFA",
    roster:["Alice","Bruno","Clara"],winners:["Alice","Bruno"],
    wonderVictory:{qualifiedAllyPlayerIds:["Bruno"],
      ffaAllianceReview:"SOURCE_VERIFIED_EFFECTIVE_ALLIANCE"}});
  const qualified=projectWonderTrophy(season([review]));
  assert.equal(find(qualified,"Bruno").wonderPoints,1);
  assert.equal(find(qualified,"Bruno").wonderVictories,0);
});

test("corrected and withdrawn Wonder win restores legitimate holder and recalculates points/succession",()=>{
  const a=win("a",1,"Alice");
  const b=win("b",2,"Bruno");
  const b2=win("b2",3,"Bruno");
  let r=projectWonderTrophy(season([a,b,b2]));
  assert.equal(r.holder,"Bruno");
  assert.deepEqual(r.history.map(x=>x.playerId),["Alice","Bruno"]);
  r=projectWonderTrophy(season([a,b,{...b2,sourceState:"WITHDRAWN"}]));
  assert.equal(r.holder,"Alice");
  assert.equal(find(r,"Bruno").wonderVictories,1);
  assert.deepEqual(r.history.map(x=>x.playerId),["Alice"]);
  r=projectWonderTrophy(season([a,{...b,sourceState:"WITHDRAWN"},
    {...b2,sourceState:"WITHDRAWN"}]));
  assert.equal(r.holder,"Alice");
  assert.equal(find(r,"Bruno"),undefined);
  assert.throws(()=>projectWonderTrophy(season([a,{...a,resultRevision:3}])),
    /Conflicting canonical Wonder Game/);
});

test("Wonder points count canonical Games once, independent of other Games in Battle, with corrections",()=>{
  const a=win("a",1,"Alice",{battleId:"battle-one"});
  const b=win("b",2,"Alice",{battleId:"battle-one"});
  const r=projectWonderTrophy(season([a,a,b]));
  assert.equal(find(r,"Alice").wonderVictories,2,
    "Two genuine Wonder wins in distinct Games count twice even within one Battle");
  assert.equal(find(r,"Alice").wonderPoints,5);
});

test("ordinary Wonder building points may occur on Nomad and without Wonder victory rules; no start/time requirement",()=>{
  const standard=game("nomad",1,{startClass:"NOMAD",format:"FFA",
    roster:["Alice","Bruno","Clara"],winners:["Bruno"],
    wonderConstructions:[construction("nomad-wonder","Alice")]});
  const score=projectWonderTrophy(season([standard]));
  assert.equal(find(score,"Alice").wonderPoints,0.5);
  assert.equal(score.holder,null);
});

test("self-improvement in Wonder points updates incumbent, never creates false trophy transfer",()=>{
  const a=win("a",1,"Alice");
  const improved=game("house",2,{wonderConstructions:[construction("extra","Alice")]});
  const r=projectWonderTrophy(season([a,improved]));
  assert.equal(r.holder,"Alice");
  assert.equal(r.history.length,1);
  assert.equal(r.history[0].improvements.length,1);
});
