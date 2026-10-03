import test from 'node:test';
import assert from 'node:assert/strict';
import {currentOfficialGameOutcome,validateRecordingMatchFacts} from '../lib/engines/recordingMatchFacts.js';

import {losingPlayerIds} from '../lib/engines/resultEngine.js';

const game=()=>({status:'COMPLETED',players:[{playerId:'a'},{playerId:'b'},{playerId:'c'}],
  canonicalResult:{revision:2,type:'TEAM_WIN',source:'PLAYER_CONFIRMED',winningPlayerIds:['a','c']}});
const facts=()=>({modelVersion:'AOF_RECORDING_MATCH_FACTS_V1',identityNamespace:'CANONICAL_REPLAY_PLAYER_ID',
  source:{replaySha256:'a'.repeat(64),canonicalManifestSha256:'b'.repeat(64),extractionRunId:'run'},
  game:{},map:{},rules:{},diplomacy:{},coverage:{},players:[{playerId:1},{playerId:2}],
  result:{qualification:'UNRESOLVED',winnerPlayerIds:null,loserPlayerIds:null},
  policy:{automaticResultSubmissionEnabled:false,rewardsEnabled:false,relationshipScoringEnabled:false,
    reputationScoringEnabled:false,rawFactsVisibleByDefault:false}});
const source={replaySha256:'a'.repeat(64),canonicalManifestSha256:'b'.repeat(64),extractionRunId:'run'};

test('current official result supplies winners and roster-based losers with its revision',()=>{
  const outcome=currentOfficialGameOutcome(game(),{status:'IN_PROGRESS'});
  assert.equal(outcome.qualification,'OFFICIAL');
  assert.deepEqual(outcome.winnerPlayerIds,['a','c']);
  assert.deepEqual(outcome.loserPlayerIds,['b']);
  assert.equal(outcome.resultRevision,2);
  assert.equal(outcome.replayOutcomeEstablished,false);
});
test('corrected results are read from current Game rather than an ingestion snapshot',()=>{
  const current=game();
  current.canonicalResult={revision:3,type:'PLAYER_WIN',source:'ADMIN_CORRECTED',winningPlayerIds:['b']};
  assert.deepEqual(currentOfficialGameOutcome(current).winnerPlayerIds,['b']);
  assert.equal(currentOfficialGameOutcome(current).resultRevision,3);
});
test('game and match disputes, pending results and void matches remain unresolved',()=>{
  for(const [g,m] of [[{...game(),activeResultDisputeId:'d'},{}],[game(),{activeResultDisputeId:'d'}],
    [{...game(),status:'IN_PROGRESS'},{}],[game(),{status:'VOID'}]]) {
    const outcome=currentOfficialGameOutcome(g,m);
    assert.equal(outcome.qualification,'UNRESOLVED');
    assert.equal(outcome.winnerPlayerIds,null);
    assert.equal(outcome.loserPlayerIds,null);
  }
});
test('unknown winner identities and incomplete official result do not manufacture losers',()=>{
  const g=game();g.canonicalResult.winningPlayerIds=['unknown'];
  assert.equal(currentOfficialGameOutcome(g).qualification,'UNRESOLVED');
  assert.equal(currentOfficialGameOutcome({status:'COMPLETED',players:g.players}).qualification,'UNRESOLVED');
});
test('recording context validates source and replay roster without mutating input',()=>{
  const f=facts(),before=structuredClone(f);
  assert.deepEqual(validateRecordingMatchFacts(f,source,[2,1]),f);
  assert.deepEqual(f,before);
});
test('mismatched hashes, extraction runs and replay roster are rejected before persistence',()=>{
  assert.throws(()=>validateRecordingMatchFacts(facts(),{...source,replaySha256:'c'.repeat(64)},[1,2]),/provenance/);
  assert.throws(()=>validateRecordingMatchFacts(facts(),{...source,extractionRunId:'other'},[1,2]),/provenance/);
  assert.throws(()=>validateRecordingMatchFacts(facts(),source,[1,3]),/roster/);
});
test('recorded resignations cannot arrive as a qualified replay win or activate scoring',()=>{
  const f=facts();f.result.winnerPlayerIds=[1];
  assert.throws(()=>validateRecordingMatchFacts(f,source,[1,2]),/without qualification/);
  const active=facts();active.policy.relationshipScoringEnabled=true;
  assert.throws(()=>validateRecordingMatchFacts(active,source,[1,2]),/activated/);
});

test('accepted team and individual outcomes retain the non-winning official roster',()=>{
  const players=[{playerId:'a',team:1},{playerId:'b',team:2},{playerId:'c',team:1}];
  assert.deepEqual(losingPlayerIds({type:'TEAM_WIN',winnerTeam:1,winnerPlayerId:null},players),['b']);
  assert.deepEqual(losingPlayerIds({type:'PLAYER_WIN',winnerTeam:null,winnerPlayerId:'b'},players),['a','c']);
});
test('stored loser identifiers inconsistent with the accepted winners remain unresolved',()=>{
  const g=game();g.canonicalResult.losingPlayerIds=['a'];
  assert.equal(currentOfficialGameOutcome(g).qualification,'UNRESOLVED');
});
