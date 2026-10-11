import test from 'node:test';
import assert from 'node:assert/strict';
import {assertNativeE2eReviewAllowed,nativeE2eReviewDto} from '../lib/queries/adminGetNativeReadyReview.js';

const matchId='m',gameId='g',candidateId='c'.repeat(64),sourceHash='d'.repeat(64),
  statisticsSha256='e'.repeat(64);
const env={GCLOUD_PROJECT:'age-of-friends-staging',AOF_NATIVE_REPLAY_PROJECT:'age-of-friends-staging',
  AOF_NATIVE_READY_PUBLICATION:'reviewed-v1',AOF_NATIVE_READY_GAME_ALLOWLIST:'m/g'};
test('read-only review requires exact staging/demo project, role and Game allowlist',()=>{
  assert.equal(assertNativeE2eReviewAllowed(env,'ADMIN',matchId,gameId,candidateId),'age-of-friends-staging');
  for(const patch of [{GCLOUD_PROJECT:'league-of-friends-cc274'},
    {AOF_NATIVE_REPLAY_PROJECT:'another'}, {AOF_NATIVE_READY_PUBLICATION:'0'},
    {AOF_NATIVE_READY_GAME_ALLOWLIST:'other/g'}]){
    assert.throws(()=>assertNativeE2eReviewAllowed({...env,...patch},'ADMIN',matchId,gameId,candidateId));
  }
  assert.equal(assertNativeE2eReviewAllowed({...env,AOF_NATIVE_READY_PUBLICATION:'0',
    AOF_NATIVE_READY_ROLLBACK:'reviewed-v1'},'ADMIN',matchId,gameId,candidateId),
    'age-of-friends-staging','Recovery review stays available after publication is disabled');
  assert.throws(()=>assertNativeE2eReviewAllowed({...env,
    AOF_NATIVE_READY_PUBLICATION:'0',AOF_NATIVE_READY_ROLLBACK:'0'},
    'ADMIN',matchId,gameId,candidateId));
  assert.throws(()=>assertNativeE2eReviewAllowed(env,'PLAYER',matchId,gameId,candidateId));
  assert.throws(()=>assertNativeE2eReviewAllowed(env,'ADMIN','../../m',gameId,candidateId));
  assert.throws(()=>assertNativeE2eReviewAllowed(env,'ADMIN',matchId,gameId,'invalid'));
  assert.throws(()=>assertNativeE2eReviewAllowed({...env,GCLOUD_PROJECT:'demo-other',
    AOF_NATIVE_REPLAY_PROJECT:'demo-other'},'ADMIN',matchId,gameId,candidateId));
  assert.equal(assertNativeE2eReviewAllowed({...env,GCLOUD_PROJECT:'demo-aof-e2e',
    AOF_NATIVE_REPLAY_PROJECT:'demo-aof-e2e',FUNCTIONS_EMULATOR:'true'},'ADMIN',
    matchId,gameId,candidateId),'demo-aof-e2e');
});
const candidate={matchId,gameId,state:'VALIDATED_NOT_READY',sourceHash,
  statistics:{sha256:statisticsSha256},originalRecording:{sha256:sourceHash,bytes:1234},
  recordedEvents:{sha256:'f'.repeat(64)},
  playerMapping:[{playerId:'p1',replaySlot:1,sourceName:'source-1'},
    {playerId:'p2',replaySlot:2,sourceName:'source-2'}]};
const match={status:'COMPLETED',format:'ONE_V_ONE'};
const game={status:'COMPLETED',players:[{playerId:'p1'},{playerId:'p2'}],
  activeReplayStatisticsId:null,replayStatisticsRevision:0,
  canonicalResult:{revision:1,source:'PLAYER_CONFIRMED',type:'PLAYER_WIN',
    winningPlayerIds:['p1'],losingPlayerIds:['p2']}};
test('bounded review binds independent official result without accepting source inference',()=>{
  const review=nativeE2eReviewDto(match,game,candidate,matchId,gameId,candidateId);
  assert.equal(review.candidatePublishEligible,true);
  assert.equal(review.expectedResultRevision,1);
  assert.equal(review.expectedActiveSourceHash,null);
  assert.deepEqual(review.officialWinnerPlayerIds,['p1']);
  assert.equal(review.sourcePlayers.length,2);
  assert.equal('previewExperience' in review,false);
  assert.equal('matchFacts' in review,false);
  assert.equal('recordedEvents' in review,false);
  assert.equal(nativeE2eReviewDto(match,{...game,activeResultDisputeId:'open'},
    candidate,matchId,gameId,candidateId).candidatePublishEligible,false);
  assert.equal(nativeE2eReviewDto(match,{...game,canonicalResult:null},
    candidate,matchId,gameId,candidateId).candidatePublishEligible,false);
  assert.equal(nativeE2eReviewDto(match,{...game,recordingResultBinding:{sourceHash}},
    candidate,matchId,gameId,candidateId).candidatePublishEligible,false);
  assert.equal(nativeE2eReviewDto(match,{...game,activeReplayStatisticsId:sourceHash},
    {...candidate,state:'PUBLISHED_READY'},matchId,gameId,candidateId).nativeSourceIsActive,true);
  assert.throws(()=>nativeE2eReviewDto(match,game,{...candidate,sourceHash:'bad'},matchId,gameId,candidateId));
  assert.throws(()=>nativeE2eReviewDto(match,game,{...candidate,matchId:'other'},matchId,gameId,candidateId));
  assert.throws(()=>nativeE2eReviewDto(match,game,{...candidate,playerMapping:Array(9).fill(candidate.playerMapping[0])},matchId,gameId,candidateId));
});
