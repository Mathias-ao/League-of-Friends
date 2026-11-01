import test from "node:test";
import assert from "node:assert/strict";
import { Timestamp } from "firebase-admin/firestore";
import { memoryFirestore } from "./support/memory-firestore.mjs";
import { getWarRoom } from "../lib/queries/getWarRoom.js";
import { createWarRoomChallenge } from "../lib/commands/challenges/createWarRoomChallenge.js";
import { respondToWarRoomChallenge } from "../lib/commands/challenges/respondToWarRoomChallenge.js";

const seasonId = "S1";
const challengeId = "WAR_S1_A_B";
const as = uid => ({auth:{uid},data:{}});
const players = [
  ["authLinks/uid-a",{playerId:"A"}],
  ["authLinks/uid-b",{playerId:"B"}],
  ["authLinks/uid-c",{playerId:"C"}],
  ["players/A",{membershipStatus:"ACTIVE",role:"PLAYER",steamName:"Alice"}],
  ["players/B",{membershipStatus:"ACTIVE",role:"PLAYER",steamName:"Bob"}],
  ["players/C",{membershipStatus:"ACTIVE",role:"PLAYER",steamName:"Cara"}],
];
const openData = [
  ...players,
  ["leagueState/singleton",{activeSeasonId:seasonId}],
  ["seasons/S1",{name:"Season One",warRoom:{status:"OPEN"}}],
  ["seasons/S1/rivalries/A_B",{pairId:"A_B",playerOneId:"A",playerTwoId:"B",status:"QUALIFIED",rivalryScore:100}],
  ["seasons/S1/warRoomStandings/A",{warRoomPoints:99}],
  ["challenges/"+challengeId,{seasonId,pairId:"A_B",challengerPlayerId:"A",challengedPlayerId:"B",
    status:"PENDING",challengeRevision:1,createdAt:Timestamp.fromMillis(1000)}],
  ["challenges/WAR_S1_A_C",{seasonId,pairId:"A_C",challengerPlayerId:"A",challengedPlayerId:"C",
    status:"DECLINED",challengeRevision:1,createdAt:Timestamp.fromMillis(2000)}],
  ["challenges/WAR_S0_A_B",{seasonId:"S0",challengerPlayerId:"A",challengedPlayerId:"B",status:"COMPLETED"}],
];

test("War Room history is participant-private; legacy qualification and standings never unlock",async()=>{
  memoryFirestore(openData);
  const a=await getWarRoom.run(as("uid-a"));
  assert.equal(a.schemaVersion,"WAR_ROOM_V1");
  assert.equal(a.status,"PENDING_SOURCE");
  assert.deepEqual(a.viewer.qualifiedRivals,[]);
  assert.equal(a.viewer.canChallenge,false);
  assert.equal(a.qualification.status,"PENDING_SOURCE");
  assert.equal(a.qualification.canRespond,false);
  assert.equal(a.standingsStatus,"PENDING_REVIEW");
  assert.deepEqual(a.leaderboard,[]);
  assert.deepEqual(a.rivalries,[]);
  assert.deepEqual(a.viewerChallenges.map(x=>x.challengeId),["WAR_S1_A_C",challengeId]);
  assert.ok(a.viewerChallenges.every(x=>x.canRespond===false&&x.eligibilityReview==="PENDING_SOURCE"));
  const b=await getWarRoom.run(as("uid-b"));
  assert.deepEqual(b.viewerChallenges.map(x=>x.challengeId),[challengeId]);
  const outsider=await getWarRoom.run(as("uid-c"));
  assert.deepEqual(outsider.viewerChallenges.map(x=>x.challengeId),["WAR_S1_A_C"]);
  await assert.rejects(getWarRoom.run({data:{}}),e=>e.code==="unauthenticated");
  await assert.rejects(getWarRoom.run(as("unlinked")),e=>e.code==="permission-denied");
});

test("Neither old QUALIFIED row nor OPEN season enables create/accept/decline; no Game or ledger write",async()=>{
  const db=memoryFirestore(openData),before=new Map(db);
  await assert.rejects(createWarRoomChallenge.run({auth:{uid:"uid-a"},
    data:{requestId:"create-1",challengedPlayerId:"B"}}),e=>e.code==="failed-precondition");
  for(const response of ["ACCEPT","DECLINE"]){
    await assert.rejects(respondToWarRoomChallenge.run({auth:{uid:"uid-b"},
      data:{challengeId,response}}),e=>e.code==="failed-precondition");
  }
  assert.deepEqual([...db.entries()],[...before.entries()]);
  await assert.rejects(createWarRoomChallenge.run({data:{requestId:"no-auth",challengedPlayerId:"B"}}),e=>e.code==="unauthenticated");
  await assert.rejects(respondToWarRoomChallenge.run({auth:{uid:"uid-c"},
    data:{challengeId,response:"ACCEPT"}}),e=>e.code==="failed-precondition");
  // This is a global safety stop, not a stand-in for the later respondent ACL.
  assert.equal(db.has("matches/"+challengeId+"-R1-M1"),false);
  assert.equal([...db.keys()].some(k=>k.startsWith("warRoomPointLedger/")),false);
});

test("Closed season retains only the viewer's original challenge history, not a new permission",async()=>{
  memoryFirestore(openData.map(([path,value])=>path==="seasons/S1"
    ?[path,{name:"Season One",warRoom:{status:"CLOSED"}}]:[path,value]));
  const result=await getWarRoom.run(as("uid-b"));
  assert.equal(result.status,"CLOSED");
  assert.equal(result.viewerChallenges.length,1);
  assert.equal(result.viewerChallenges[0].challengeId,challengeId);
  assert.equal(result.viewer.canChallenge,false);
});

test("A later invitation retains the archived completed Battle, once per revision and only for its pair",async()=>{
  const current={seasonId,pairId:"A_B",challengerPlayerId:"A",challengedPlayerId:"B",
    status:"DECLINED",challengeRevision:2,createdAt:Timestamp.fromMillis(3000)};
  const archived={...current,status:"COMPLETED",challengeRevision:1,matchId:"M-original",
    createdAt:Timestamp.fromMillis(1000),completedAt:Timestamp.fromMillis(2000),
    archivedAt:Timestamp.fromMillis(3000),winningPlayerIds:["A"]};
  const initial=openData.filter(([path])=>path!=="challenges/"+challengeId).concat([
    ["challenges/"+challengeId,current],
    ["challenges/"+challengeId+"/history/R1",archived],
    // Current revision must not be repeated as an archived record.
    ["challenges/"+challengeId+"/history/R2",current],
    // Never accept a duplicate alias, foreign pair/Season, or spoofed revision.
    ["challenges/"+challengeId+"/history/duplicate-R1",archived],
    ["challenges/"+challengeId+"/history/R3",{...archived,challengeRevision:3}],
    ["challenges/"+challengeId+"/history/R4",{...archived,challengeRevision:4,challengedPlayerId:"C"}],
    ["challenges/"+challengeId+"/history/R5",{...archived,challengeRevision:5,seasonId:"OTHER"}],
  ]);
  const db=memoryFirestore(initial),before=[...db.entries()];
  for(const uid of ["uid-a","uid-b"]){
    const result=await getWarRoom.run(as(uid));
    const rows=result.viewerChallenges.filter(x=>x.challengeId===challengeId);
    assert.deepEqual(rows.map(x=>x.challengeRevision),[2,1]);
    assert.deepEqual(rows.map(x=>x.challengeEntryId),[challengeId+":R2",challengeId+":R1"]);
    assert.deepEqual(rows.map(x=>x.historyState),["CURRENT","ARCHIVED"]);
    assert.equal(rows[1].matchId,"M-original");
    assert.equal(rows[1].status,"COMPLETED");
    assert.equal(rows[1].currentChallengeStatus,"DECLINED");
    assert.equal(rows[1].currentChallengeRevision,2);
    assert.equal(rows[1].archivedAt,"1970-01-01T00:00:03.000Z");
    assert.ok(rows.every(x=>x.eligibilityReview==="PENDING_SOURCE"&&!x.canRespond));
    assert.deepEqual(result.leaderboard,[]);
  }
  const outsider=await getWarRoom.run(as("uid-c"));
  assert.equal(outsider.viewerChallenges.some(x=>x.challengeId===challengeId),false);
  assert.deepEqual([...db.entries()],before,"History reads cannot restore points or mutate source records");
  for(const override of [{seasonId:"OTHER"},{challengedPlayerId:"C"},{challengerPlayerId:"C"},
    {challengeRevision:1.5},{challengeRevision:2}]){
    memoryFirestore(initial.map(([path,value])=>path==="challenges/"+challengeId+"/history/R1"
      ?[path,{...value,...override}]:[path,value]));
    for(const uid of ["uid-a","uid-b"]){
      const result=await getWarRoom.run(as(uid));
      assert.equal(result.viewerChallenges.some(x=>x.matchId==="M-original"),false,
        "Foreign or malformed archived authorization is withheld independently of current pair access");
    }
  }
});
