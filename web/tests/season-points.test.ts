import test from "node:test";
import assert from "node:assert/strict";
import {formatLeaguePoints} from "../src/domain/seasonPoints";
test("whole and shared victory points render cleanly without changing stored precision",()=>{
  assert.equal(formatLeaguePoints(10),"10");assert.equal(formatLeaguePoints(5.5),"5.5");
  assert.equal(formatLeaguePoints(4+6/7),"≈4.86");assert.equal(formatLeaguePoints(1e-12),"0");
});

import {isWarmupMatch,isMainEventMatch,LeagueService} from "../src/domain/league";
test("an explicitly designated main 1v1 stays in Act II",()=>{
  const match={format:"ONE_V_ONE",scoringAct:"MAIN",matchId:"m",status:"READY",participants:[]};
  assert.equal(isWarmupMatch(match),false);assert.equal(isMainEventMatch(match),true);
});
test("the next target skips players sharing your season rank",()=>{
  const service=new LeagueService({} as never);
  const snapshot={viewer:{playerId:"b"},standings:[{playerId:"leader",rank:1},{playerId:"a",rank:2},{playerId:"b",rank:2}]} as never;
  assert.equal(service.nextTarget(snapshot)?.playerId,"leader");
});
