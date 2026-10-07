import test from "node:test";
import assert from "node:assert/strict";
import {formatLeaguePoints} from "../src/domain/seasonPoints";
test("whole and shared victory points render cleanly without changing stored precision",()=>{
  assert.equal(formatLeaguePoints(10),"10");assert.equal(formatLeaguePoints(5.5),"5.5");
  assert.equal(formatLeaguePoints(4+6/7),"4.86");assert.equal(formatLeaguePoints(1e-12),"0");
});
