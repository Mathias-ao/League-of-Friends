import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildPilotReport,PLAN_VERSION} from '../../scripts/nov9-pilot-report.mjs';
import {POINT_UNITS} from '../lib/engines/seasonPoints.js';
const corpus=JSON.parse(readFileSync(new URL('./fixtures/recording-outcomes.json',import.meta.url)));
const originals=['1v1_1.aoe2record','aof-test-game-1.aoe2record','aof-test-game-2.aoe2record','aof-test-game-3.aoe2record'].map(name=>corpus.find(f=>f.filename===name));
function fixture(){
 const inspected=structuredClone(originals);
 const plan={modelVersion:PLAN_VERSION,inputKind:'REPOSITORY_FALLBACK',approvedTestPlayerIds:['test-a','test-b'],recordings:inspected.map((f,i)=>{
  const map='Recorded map '+f.matchFacts.rules.mapId.value;
  return {id:'recording-'+i,eventId:i<2?'event-one':'event-two',act:i===0||i===3?'MAIN':'WARMUP',filePath:'replay-fixtures/'+f.filename,
   bindings:[{replaySlot:1,playerId:'test-a'},{replaySlot:2,playerId:'test-b'}],
   gameConfig:{maps:{pool:[map],selectionMode:'ADMIN',recordingMapIds:{[map]:f.matchFacts.rules.mapId.value}},civilizations:{mode:'UNRESTRICTED',allowed:[],banned:[],customRuleCode:null},victory:{conquest:true,wonder:false,relic:false,customRuleCode:null},diplomacyEnabled:false,additionalSettings:{}}};
 })};
 return {plan,inspected};
}

test('fresh-source oracle uses actual terminal outcomes, declared acts and per-Game mappings; no fixed tied total',()=>{
 const {plan,inspected}=fixture(),report=buildPilotReport(plan,inspected);
 assert.equal(report.standings.state,'READY_FOR_COMPARISON');
 // Actual retained source resignations are 1,2,2,1. Keep the same fixed
 // A→slot1/B→slot2 bindings while scoring the explicitly announced acts.
 assert.deepEqual(report.standings.expectedFinal.map(r=>[r.playerId,r.leaguePoints,r.rank]),[['test-b',22,1],['test-a',14,2]]);
 // A different declared Event act changes rewards without rewriting any
 // original command, terminal winner, mapping or Event/act uniqueness.
 [plan.recordings[0].act,plan.recordings[1].act]=[plan.recordings[1].act,plan.recordings[0].act];
 const varied=buildPilotReport(plan,inspected);
 assert.notDeepEqual(varied.standings.expectedFinal,report.standings.expectedFinal);
 assert.ok(varied.standings.expectedFinal.every(r=>r.leaguePointUnits===r.leaguePoints*POINT_UNITS));
 assert.deepEqual(varied.games.map(g=>g.outcome.winningPlayerIds),report.games.map(g=>g.outcome.winningPlayerIds));
 assert.equal(report.gameSpecificBindingNotPermanentAlias,true);
 assert.equal(report.acceptance.state,'PENDING_OPPONENT_REVIEW');
 assert.equal(report.acceptance.browserAcceptance,'NOT_RUN');
 assert.ok(report.games.every(g=>g.opponentKind==='PENDING_SOURCE'));
 assert.match(report.evidenceLabel,/fallback bytes only/);
 assert.deepEqual(report.games[0].source.sourcePlayers,inspected[0].players);
 assert.deepEqual(report.games[0].standingsAfter.expected.map(r=>[r.playerId,r.gamesPlayed,r.wins,r.losses]),[['test-b',1,1,0],['test-a',1,0,1]]);
 assert.deepEqual(report.standings.expectedFinal.map(r=>[r.gamesPlayed,r.wins,r.losses]),[[4,2,2],[4,2,2]]);
 assert.deepEqual(report.games.at(-1).standingsAfter.expected,report.standings.expectedFinal);
});

test('different historical players are preserved independently for every Game',()=>{
 const {plan,inspected}=fixture();
 for(const [i,f]of inspected.entries())for(const player of f.players)player.name='Original '+i+' slot '+player.replaySlot;
 plan.inputKind='OWNER_NEW_RECORDINGS';
 const report=buildPilotReport(plan,inspected);
 assert.equal(report.inputKind,'OWNER_NEW_RECORDINGS');
 assert.equal(new Set(report.games.flatMap(g=>g.bindings.map(b=>b.sourceName))).size,8);
 assert.ok(report.games.every(g=>g.gameSpecificBindingNotPermanentAlias));
});

test('byte hash, expected hash and expected GUID mismatches refuse a report',()=>{
 for(const alter of [
  ({inspected})=>inspected[0].matchFacts.source.replaySha256='f'.repeat(64),
  ({plan})=>plan.recordings[0].expectedSourceHash='e'.repeat(64),
  ({plan})=>plan.recordings[0].expectedGameGuid='another-source-guid',
 ]){const f=fixture();alter(f);assert.throws(()=>buildPilotReport(f.plan,f.inspected),/mismatch/);}
});

test('duplicate original GUIDs and duplicate byte snapshots cannot become four Games',()=>{
 for(const mutate of [f=>f.inspected[1].matchFacts.game.guid=f.inspected[0].matchFacts.game.guid,f=>{f.inspected[1].sourceHash=f.inspected[0].sourceHash;f.inspected[1].matchFacts.source.replaySha256=f.inspected[0].sourceHash;}]){
  const f=fixture();mutate(f);assert.throws(()=>buildPilotReport(f.plan,f.inspected),/distinct source Game GUIDs and byte hashes/);
 }
});

test('foreign or duplicated player IDs, duplicated source slots and unknown source slots are refused',()=>{
 for(const mutate of [
  p=>p.recordings[0].bindings[0].playerId='unapproved',
  p=>p.recordings[0].bindings[1].playerId='test-a',
  p=>p.recordings[0].bindings[1].replaySlot=1,
  p=>p.recordings[0].bindings[1].replaySlot=9,
 ]){const {plan,inspected}=fixture();mutate(plan);assert.throws(()=>buildPilotReport(plan,inspected),/slots|IDs/);}
});

test('unknown terminal winner and source-rule mismatch remain Pending without invented completion points or final ranks',()=>{
 for(const mutate of [
  f=>{f.inspected[0].matchFacts.result.resignationEvidence=[];f.inspected[0].matchFacts.game.resignationCommandCount=0;},
  f=>f.plan.recordings[0].gameConfig.maps.recordingMapIds={'Wrong map':999},
  f=>f.inspected[0].matchFacts.game.bodyParseComplete=false,
  f=>f.inspected[0].matchFacts.diplomacy.commandTimelines={originalCommands:[{sourceEventId:'original-diplomacy',sourceActionName:'DIPLOMACY',operationOrdinal:10}]},
 ]){
  const f=fixture();mutate(f);const report=buildPilotReport(f.plan,f.inspected);
  assert.equal(report.games[0].outcome.state,'PENDING_ADMIN_REVIEW');
  assert.equal(report.games[0].outcome.winningPlayerIds,null);
  assert.equal(report.games[0].expectedSeasonPoints,null);
  assert.equal(report.standings.state,'PENDING_RESULTS');assert.equal(report.standings.expectedFinal,null);
  assert.deepEqual(report.standings.pendingRecordingIds,['recording-0']);
  assert.equal(report.games[0].standingsAfter.expected,null);
  assert.ok(report.games[0].standingsAfter.verifiedGameSubtotal.every(r=>r.gamesPlayed===0));
  assert.equal(report.games[1].standingsAfter.expected,null,'a later accepted result cannot hide the earlier Pending Game');
  assert.ok(report.games[1].standingsAfter.verifiedGameSubtotal.every(r=>r.gamesPlayed===1));
 }
});

test('explicit source evidence of a nonhuman starter refuses human-duel acceptance',()=>{
 const {plan,inspected}=fixture();inspected[0].players[0].isHuman=false;
 assert.throws(()=>buildPilotReport(plan,inspected),/nonhuman source starter/);
});

test('a second warm-up in one Event is rejected rather than incorrectly added to Season points',()=>{
 const {plan,inspected}=fixture();plan.recordings[1].act=plan.recordings[0].act;
 assert.throws(()=>buildPilotReport(plan,inspected),/Only one BO1 recording/);
});

test('an optional Emperor is a noncompeting operator, never a substituted historical starter',()=>{
 const {plan,inspected}=fixture(),baseline=buildPilotReport(plan,inspected);
 for(const row of plan.recordings)row.emperorPlayerId='separate-operator';
 const report=buildPilotReport(plan,inspected);
 assert.deepEqual(report.standings.expectedFinal,baseline.standings.expectedFinal);
 assert.ok(report.games.every(g=>g.scoringSnapshot.rules.emperorPlayerId==='separate-operator'));
 plan.recordings[0].emperorPlayerId='test-a';
 assert.throws(()=>buildPilotReport(plan,inspected),/noncompeting operator/);
});
