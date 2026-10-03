import test from 'node:test';
import assert from 'node:assert/strict';
import {projectRecordingDiplomacyReview} from '../lib/engines/recordingDiplomacyReview.js';
const facts=()=>({modelVersion:'AOF_RECORDING_MATCH_FACTS_V1',identityNamespace:'CANONICAL_REPLAY_PLAYER_ID',
  source:{replaySha256:'source',canonicalSchemaVersion:'1.1.0'},players:[{playerId:1},{playerId:2}],
  game:{observedDurationMs:5000},diplomacy:{initialRawByPlayer:{'1':[0,1,4],'2':[0,4,1]},
  normalizedInitialEdges:[],commandTimelines:{'1->2':[{sourceEventId:'one',replaySlot:1,targetReplaySlot:2,
    atMs:1000,operationOrdinal:10,diplomacyMode:0,commandId:0}]}}});
test('raw header vectors, same group and commanded mode never invent an effective alliance',()=>{
  const input=facts();input.players.forEach(p=>p.lobbyTeamIdRaw=1);const before=structuredClone(input);
  const result=projectRecordingDiplomacyReview(input);
  assert.equal(result.status,'REVIEW_AVAILABLE');assert.equal(result.commandCount,1);
  assert.equal(result.rawInitialVectorCount,2);assert.equal(result.normalizedInitialEdgeCount,0);
  assert.equal(result.knownPairSegmentCount,0);assert.equal(result.timeline.pairSegments[0].state,'UNKNOWN');
  assert.equal(result.timeline.changes[0].commandedStance,'ALLY');
  assert.equal(result.timeline.changes[0].effectiveStateChanged,false);
  assert.equal(result.interpretationEnabled,false);assert.equal(result.absenceQualified,false);
  assert.deepEqual(input,before);
});
test('duplicated and reordered retained command rows rebuild identically; conflicting provenance fails closed',()=>{
  const input=facts();const expected=projectRecordingDiplomacyReview(input);
  input.diplomacy.commandTimelines['1->2'].push(structuredClone(input.diplomacy.commandTimelines['1->2'][0]));
  input.diplomacy.commandTimelines['1->2'].reverse();
  assert.deepEqual(projectRecordingDiplomacyReview(input),expected);
  input.diplomacy.commandTimelines['1->2'][1].diplomacyMode=3;
  assert.equal(projectRecordingDiplomacyReview(input).status,'UNAVAILABLE');
});
test('normalized initial certainty expires at an unverified order; opposite edge stays known',()=>{
  const input=facts();input.diplomacy.normalizedInitialEdges=[
    {fromPlayerId:1,toPlayerId:2,stance:'enemy'},{fromPlayerId:2,toPlayerId:1,stance:'enemy'}];
  const result=projectRecordingDiplomacyReview(input);
  assert.equal(result.timeline.pairSegments.length,2);
  assert.equal(result.timeline.pairSegments[0].state,'MUTUAL_HOSTILITY');
  assert.equal(result.timeline.pairSegments[1].state,'UNKNOWN');
  assert.equal(result.timeline.changes[0].previousEffectiveStance,'ENEMY');
  assert.equal(result.timeline.changes[0].effectiveStanceAfter,'UNKNOWN');
  assert.equal(result.timeline.pairSegments[1].playerTwoToPlayerOne,'ENEMY');
});
test('malformed chronology/direction and legacy missing context do not suppress statistics or fabricate review',()=>{
  assert.equal(projectRecordingDiplomacyReview(undefined).status,'UNAVAILABLE');
  const input=facts();input.diplomacy.commandTimelines['1->2'][0].operationOrdinal=null;
  assert.equal(projectRecordingDiplomacyReview(input).status,'UNAVAILABLE');
  const wrong=facts();wrong.diplomacy.commandTimelines['1->2'][0].targetReplaySlot=1;
  assert.equal(projectRecordingDiplomacyReview(wrong).reason,'diplomacy_direction_mismatch');
});
