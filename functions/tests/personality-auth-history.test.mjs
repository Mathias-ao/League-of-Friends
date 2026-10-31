import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync,gunzipSync} from 'node:zlib';
import {ready} from './support/private-history-fixture.mjs';
import {bindingDigest,digest} from '../lib/engines/nativeRecordingIntegration.js';
import {statisticsBindingKey} from '../lib/engines/statisticsExperience.js';
import {NATIVE_PLAYER_UPLOAD} from '../lib/engines/nativePlayerUpload.js';
import {readMyPersonalityHistory} from '../lib/queries/getMyPersonalityHistory.js';
import {PERSONALITY_CONTEXT_PROOF_VERSION} from
  '../lib/engines/personalityV1/contextAdmission.js';

const policyEnv={AOF_PERSONALITY_PRIVATE_E2E:'source-proposed-v1'};
function richParticipant(slot){
  return {
    replaySlot:slot,playerId:slot,
    economy:{resourceCommitment:{modelVersion:'AOF_RESOURCE_COMMITMENT_V1',
      resourcesCommitted:{total:1000},coverage:{unpricedRequestCommands:0}}},
    military:{modelVersion:'AOF_MILITARY_STATISTICS_V5',
      militarySpend:{resources:300,unpricedMilitaryCommandAmount:0},
      militaryUnitsTrained:{positiveQueueAmount:10,unknownAmountCommands:0},
      composition:{infantry:10,archers:0,cavalry:0},
      engagements:{engagementModelVersion:'AOF_ENGAGEMENT_STATISTICS_V4',
        raidEvidence:{initiatedEpisodes:[{
          modelVersion:'AOF_RAID_DETECTION_V3',attackerPlayerId:slot,
          victimPlayerId:2,startedAtMs:100000,sourceEventIds:['source-raid-one']},{
          modelVersion:'AOF_RAID_DETECTION_V3',attackerPlayerId:slot,
          victimPlayerId:2,startedAtMs:200000,sourceEventIds:['source-raid-two']}]},
        engagementEvidence:{battles:[]}}},
    mapPresence:{modelVersion:'AOF_MAP_PRESENCE_V8',homeAnchor:{method:'initial_town_center'},
      buildingSectors:{classifiedPlacementCount:2,evidence:[
        {buildingId:82,sector:'home',sourceEventId:'home-castle'},
        {buildingId:82,sector:'forward',sourceEventId:'forward-castle'}]},
      expansionZones:{status:'ok',count:1,eligibleRemoteBuildingCount:2,
        eligibleBuildingPlacementsInsideHomeRadius:2,
        zones:[{zoneId:'remote-site',buildings:[{sourceEventId:'remote1'},{sourceEventId:'remote2'}]}]}}
  };
}
function originalStats(f){const s=f.rows.get(f.sourcePath);
  return JSON.parse(gunzipSync(f.objects.get(s.statistics.path)).toString('utf8'));}
function enrich(raw,sourceHash,guid){
  raw.source.replaySha256=sourceHash;
  raw.matchFacts.source.replaySha256=sourceHash;
  // The immutable native detail reader requires the original statistics,
  // recording facts AND pair social-scope source hashes to agree.
  raw.pairSocialEvidence.gameScope.replaySha256=sourceHash;
  raw.matchFacts.source.gameBuild=185872;
  raw.matchFacts.game={...raw.matchFacts.game,guid,observedDurationMs:2400000,
    durationMeaning:'observed_recording_interval_not_proven_full_game'};
  raw.matchFacts.map={id:9};
  raw.matchFacts.rules={...raw.matchFacts.rules,
    mapId:{status:'DECODED',value:9},startingAgeId:{status:'DECODED',value:0},
    startingResourcesId:{status:'DECODED',value:0}};
  raw.matchFacts.diplomacy={...raw.matchFacts.diplomacy,effectiveRuntimeStateQualified:false};
  raw.matchFacts.players=raw.matchFacts.players.map(p=>({
    ...p,civilization:{rawId:p.replaySlot===1?2:4}}));
  raw.scope={observedUntilMs:2400000};
  raw.participants[0]=richParticipant(1);
  const delivery=raw.sharedEpisodeDelivery;
  delivery.sourceMode='producer_unique_episodes';
  // Existing verified producer-unique envelope, hydrated player source arrays.
  return raw;
}
function proof(hash){
  return {version:PERSONALITY_CONTEXT_PROOF_VERSION,status:'REVIEWED_SOURCE_CLASSIFICATION',
    referenceId:'CONTROLLED_AUTH_EMULATOR_EVIDENCE_ONLY',sourceHash:hash,
    gameBuild:185872,mapId:9,startingAgeId:0,startingResourcesId:0,
    mapFamily:'LAND',startFamily:'STANDARD',
    durationBucket:{id:'TEST_OBSERVED_30_TO_60',lowerObservedMs:1800000,
      upperObservedMsExclusive:3600000,meaning:'OBSERVED_RECORDING_INTERVAL_ONLY'}};
}
function writeFixture(f,matchId,gameId,hash,raw,source,game,match){
  const prefix='native-replay-evidence/'+matchId+'/'+gameId+'/'+hash+'/';
  const plain=Buffer.from(JSON.stringify(raw)),packed=gzipSync(plain);
  const s=structuredClone(source);
  s.matchId=matchId;s.gameId=gameId;s.sourceHash=hash;s.matchFacts=raw.matchFacts;
  s.originalRecording={...s.originalRecording,
    path:prefix+'source.aoe2record',sha256:hash};
  s.recordedEvents={...s.recordedEvents,path:prefix+s.artifactRevision+'/events.jsonl.gz'};
  s.statistics={...s.statistics,path:prefix+s.artifactRevision+'/statistics.direct.json.gz',
    sha256:digest(packed),bytes:packed.length,
    uncompressedSha256:digest(plain),uncompressedBytes:plain.length};
  const g=structuredClone(game);
  g.activeReplayStatisticsId=hash;g.replayStatisticsRevision=s.replayStatisticsRevision;g.replayStatisticsState='READY';
  g.gameNumber=1;
  s.experience.bindingKey=statisticsBindingKey({sourceHash:hash,roster:g.players,
    mapping:s.playerMapping,opponents:[]});
  f.rows.set('matches/'+matchId,match);
  f.rows.set('matches/'+matchId+'/games/'+gameId,g);
  f.rows.set('matches/'+matchId+'/games/'+gameId+'/replaySources/'+hash,s);
  f.rows.set('recordingGameClaims/'+Buffer.from(raw.matchFacts.game.guid).toString('hex'),
    {matchId,gameId,sourceHash:hash});
  f.objects.set(s.statistics.path,packed);
  // This is a controlled simulated new original, not a genuine recorded Game.
  f.objects.set(s.originalRecording.path,Buffer.from('test-original-'+hash));
  f.objects.set(s.recordedEvents.path,f.objects.get(source.recordedEvents.path));
}
function taxonomy(hashes){
  return {sourceProofs:Object.fromEntries(hashes.map(h=>[h,proof(h)])),
    strategicBuildingsByBuild:{185872:[82]},
    militaryFamiliesByExactCiv:{BUILD_185872_CIV_2:['infantry','archers','cavalry']}};
}

test('real authenticated bounded INT-B code path projects five private axes from two controlled source-qualified Battles',async()=>{
  const f=await ready();
  const original=f.rows.get(f.sourcePath),first=f.rows.get('matches/m/games/g');
  const match=f.rows.get('matches/m');
  const source1=f.sourceHash,source2=digest('second distinct controlled original');
  const raw1=enrich(originalStats(f),source1,'synthetic-native-game-guid');
  const raw2=enrich(structuredClone(raw1),source2,'controlled-original-two-guid');
  writeFixture(f,'m','g',source1,raw1,original,first,match);
  writeFixture(f,'m2','g2',source2,raw2,original,first,
    {...match,firstCompletedAt:{toMillis:()=>2000}});
  f.rows.get('events/e').officialMatchIds.push('m2');
  const env={...f.input.env,...policyEnv};
  const options={...f.input,env,personalityTaxonomy:taxonomy([source1,source2])};
  const result=await readMyPersonalityHistory(options);
  assert.equal(result.ownerPlayerId,'p1');
  assert.equal(result.coverage.ownBattles,2);
  assert.equal(result.coverage.currentSources,2);
  assert.equal(result.coverage.measuredIndependentBattles,2);
  assert.equal(result.personality.calibration,'PROPOSED');
  assert.equal(result.personality.battleFeatures.length,10);
  assert.ok(result.personality.personalityProfile.sliders.every(x=>
    x.status==='READY'&&typeof x.value==='number'&&x.independentBattles===2));
  const score=Object.fromEntries(result.personality.personalityProfile.sliders.map(x=>[x.axis,x.value]));
  assert.equal(score.BOOMER_AGGRESSOR,30);
  assert.equal(score.CAUTIOUS_BOLD,50);
  assert.equal(score.GUERRILLA_FRONTLINE,0);
  assert.equal(score.SPECIALIST_IMPROVISER,0);
  assert.equal(score.COMPACT_EXPANSIVE,33.33);
  assert.equal(result.effects.officialWrites,false);
  assert.deepEqual(result,(await readMyPersonalityHistory(options)));
  // Withdrawal of one authentic-authority simulation -> one Battle insufficient.
  f.rows.get('matches/m2/games/g2/replaySources/'+source2).state='WITHDRAWN';
  const corrected=await readMyPersonalityHistory(options);
  assert.equal(corrected.coverage.currentSources,1);
  assert.ok(corrected.personality.personalityProfile.sliders.every(x=>x.value===null));
  assert.notEqual(result.inputDigest,corrected.inputDigest);
  // No caller control over taxonomy/owner outside server-only input.
  await assert.rejects(readMyPersonalityHistory({...options,request:{personalityTaxonomy:taxonomy([])}}),
    e=>e.code==='invalid-argument');
  const prod={...options,env:{...env,FUNCTIONS_EMULATOR:undefined}};
  await assert.rejects(readMyPersonalityHistory(prod),e=>e.code==='failed-precondition');
});


test('Sol #203 authenticated reader: two current READY unresolved Games with no completion use only approved Event/plan chronology',async()=>{
  const f=await ready();
  const original=f.rows.get(f.sourcePath),first=f.rows.get('matches/m/games/g');
  const base=f.rows.get('matches/m');
  const sha1=f.sourceHash,sha2=digest('schedule-no-completion-second-source');
  const raw1=enrich(originalStats(f),sha1,'schedule-no-completion-guid-one');
  const raw2=enrich(structuredClone(raw1),sha2,'schedule-no-completion-guid-two');
  const m1={...base,status:'ACTIVE',firstCompletedAt:null,sourceMatchPlanId:'approved-schedule',matchNumber:1};
  const m2={...base,status:'ACTIVE',firstCompletedAt:null,sourceMatchPlanId:'approved-schedule',matchNumber:2};
  // Controlled ordinary-upload authority, not an admin-only publication with
  // its accepted result removed. Pending native admission requires both the
  // ordinary origin and a READY/AWAITING_CONFIRMATION Game.
  const ordinary={...original,ordinaryUploadVersion:NATIVE_PLAYER_UPLOAD,
    resultQualification:'UNRESOLVED',experience:{...original.experience,
      eligible:false,exclusionReason:'Official Game result pending'}};
  delete ordinary.officialOutcomeAtIngestion;
  delete ordinary.publication;
  const pendingGame={...first,status:'READY',canonicalResult:null};
  writeFixture(f,'m','g',sha1,raw1,ordinary,pendingGame,m1);
  writeFixture(f,'m2','g2',sha2,raw2,ordinary,pendingGame,m2);
  const startsAt={toMillis:()=>1000000};
  Object.assign(f.rows.get('events/e'),{
    startsAt,approvedMatchPlanId:'approved-schedule',
    matchPlanStatus:'APPROVED',officialMatchIds:['m','m2'],warmupMatchIds:[]
  });
  f.rows.set('events/e/matchPlans/approved-schedule',{
    status:'APPROVED',officialMatchIds:['m','m2'],matches:[{},{}]
  });
  const options={...f.input,env:{...f.input.env,...policyEnv},
    personalityTaxonomy:taxonomy([sha1,sha2])};
  const accepted=await readMyPersonalityHistory(options);
  assert.deepEqual(accepted.sources.map(s=>s.outcome.qualification),['UNRESOLVED','UNRESOLVED']);
  assert.ok(accepted.sources.every(s=>s.outcome.resultRevision===null&&s.outcome.winningPlayerIds===null));
  assert.equal(accepted.coverage.measuredIndependentBattles,2);
  assert.deepEqual(Object.fromEntries(accepted.personality.personalityProfile.sliders
    .map(x=>[x.axis,x.value])),{
      BOOMER_AGGRESSOR:30,CAUTIOUS_BOLD:50,GUERRILLA_FRONTLINE:0,
      SPECIALIST_IMPROVISER:0,COMPACT_EXPANSIVE:33.33});
  assert.ok(accepted.personality.personalityProfile.sliders.every(x=>x.status==='READY'&&x.independentBattles===2));
  assert.equal(accepted.effects.officialWrites,false);
  // Source publication authority remains independent of the approved schedule.
  const second=f.rows.get('matches/m2/games/g2/replaySources/'+sha2);
  for(const mutate of [
    ()=>{delete second.ordinaryUploadVersion;},
    ()=>{f.rows.get('matches/m2/games/g2').status='COMPLETED';},
    ()=>{second.state='WITHDRAWN';}
  ]){
    mutate();
    const rejected=await readMyPersonalityHistory(options);
    assert.equal(rejected.coverage.currentSources,1);
    assert.ok(rejected.pending.some(x=>x.battleId==='m2'&&x.reason==='CURRENT_NATIVE_SOURCE_PENDING'));
    assert.ok(rejected.personality.personalityProfile.sliders.every(x=>x.status==='DEVELOPING'&&x.value===null));
    second.ordinaryUploadVersion=NATIVE_PLAYER_UPLOAD;
    second.state='READY';
    f.rows.get('matches/m2/games/g2').status='READY';
  }
  // Removing every completion timestamp must not change an approved schedule projection.
  m1.firstCompletedAt=undefined;m2.firstCompletedAt=undefined;
  const still=await readMyPersonalityHistory(options);
  assert.deepEqual(still.personality.personalityProfile.sliders.map(x=>x.value),
    accepted.personality.personalityProfile.sliders.map(x=>x.value));
  // The approved plan is an independently fenced proof, not decoration.
  f.rows.get('events/e/matchPlans/approved-schedule').status='PROPOSED';
  const notOrdered=await readMyPersonalityHistory(options);
  assert.ok(notOrdered.personality.personalityProfile.sliders.every(x=>x.value===null));
  assert.notEqual(notOrdered.inputDigest,accepted.inputDigest);
  // Restoring plan but removing schedule likewise cannot borrow upload order.
  f.rows.get('events/e/matchPlans/approved-schedule').status='APPROVED';
  delete f.rows.get('events/e').startsAt;
  const noEvent=await readMyPersonalityHistory(options);
  assert.ok(noEvent.personality.personalityProfile.sliders.every(x=>x.value===null));
  f.rows.get('events/e').startsAt=startsAt;
  assert.deepEqual((await readMyPersonalityHistory(options)).personality.personalityProfile.sliders,
    still.personality.personalityProfile.sliders);
  // Rebind the current source roster, retaining the old synthetic source:
  // complete authentication must fail; never silently credit the prior owner.
  f.rows.get('matches/m2/games/g2').players[0].playerId='not-the-owner';
  const rebinding=await readMyPersonalityHistory(options);
  assert.ok(rebinding.personality.personalityProfile.sliders.every(x=>x.value===null));
  assert.ok(rebinding.pending.some(x=>x.reason==='NOT_A_GAME_PARTICIPANT'));
});
