/** True-original, *private* T90 cross-map/civ Personality and Reputation test.
 * The source producer is replay-tools/t90_original_cohort.py. This deliberately
 * supplies isolated test Battle wrappers, NEVER real league authority or scores.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PERSONALITY_AXES,measurePersonalityGame,projectPersonalityPreview,
  buildPersonalityBattles,personalityComparisonGroup}
  from '../lib/engines/personalityV1/personalityV1.js';
import {createSocialE2EPilotCalibration}
  from '../lib/engines/socialV1History/e2ePilotCalibration.js';
import {evaluateHistory} from '../lib/engines/socialV1History/history.js';

const sha=value=>createHash('sha256').update(String(value)).digest('hex');
const report=process.env.AOF_T90_SOURCE_REPORT;
const axes=Object.keys(PERSONALITY_AXES);
const exact=c=>[c.format,c.mapFamily,c.startFamily,c.mapId,c.durationFamily,
  c.civilizationOpportunityKey].join('|');

test('genuine pinned T90 Games exercise five Personality axes and private Reputation history',{
  skip:!report?'AOF_T90_SOURCE_REPORT from the genuine parser required':false
},()=>{
  const source=JSON.parse(readFileSync(report,'utf8'));
  assert.equal(source.version,'AOF_T90_GENUINE_PRIVATE_COHORT_V1');
  assert.equal(source.testOnly,true);
  assert.equal(source.authenticatedLeagueHistory,false);
  assert.equal(source.exactSourceProofsForMapFamilyNotReviewed,true);
  assert.equal(source.officialWrites,false);
  assert.equal(source.games.length,3);
  assert.deepEqual(source.games.map(g=>g.t90ReplaySlot),[1,1,2]);
  assert.deepEqual(source.games.map(g=>g.civilizationId),[3,5,1]);
  assert.deepEqual(source.games.map(g=>g.mapId),[140,140,9]);
  assert.equal(new Set(source.games.map(g=>g.sourceHash)).size,3);
  assert.equal(new Set(source.games.map(g=>g.gameGuid)).size,3);
  const testPlayer='TEST_ONLY_REPLAY_T90';
  const calibration={
    configurationVersion:'T90_SOURCE_ONLY_PROVISIONAL_NOT_OFFICIAL_V1',
    status:'PROPOSED',minimumIndependentBattles:2,recentBattleCount:2,
    careerWeight:0.5,aggregationMethod:'MEDIAN',
    strategicBuildingIds:[12,49,79,82,87,101],
    // No invention of actual BUILD_185872_CIV_(3|5|1) family opportunities.
    availableMilitaryFamilies:{},anchors:{},minimumIndependentCommandEpisodes:2,
  };
  const games=source.games.map((g,i)=>{
    // Only this *isolated test* wrapper sets the admission/official-result fields.
    // The source-hash-indexed authentic server context proofs for these Games
    // have NOT been reviewed, and are NOT added to the private source registry.
    const home=g.statistics?.mapPresence?.homeAnchor?.method;
    const context={
      format:'ONE_V_ONE',
      // Required typed test fixture placeholder, NOT a genuine reviewed map-family
      // classification; no official outcome or live projection can use it.
      mapFamily:'LAND',
      startFamily:home==='initial_town_center'?'STANDARD':'CUSTOM',
      mapId:String(g.mapId),
      durationFamily:g.observedDurationMs<1800000?'OBSERVED_UNDER_30':
        g.observedDurationMs<3600000?'OBSERVED_30_TO_60':'OBSERVED_OVER_60',
      civilization:'RAW_AOE2_CIV_'+g.civilizationId,
      civilizationOpportunityKey:'BUILD_'+g.build+'_CIV_'+g.civilizationId,
      durationMs:g.observedDurationMs,observedUntilMs:g.observedUntilMs,
      dynamicDiplomacyQualified:false,
    };
    calibration.anchors[exact(context)]=Object.fromEntries(axes.map(axis=>[axis,{
      lower:0,upper:1,comparisonGroup:personalityComparisonGroup(context,axis)}]));
    return {
      battleId:'TEST-T90-BATTLE-'+(i+1),matchId:'TEST-T90-BATTLE-'+(i+1),
      gameId:'G1',gameNumber:1,playerId:testPlayer,
      replaySlot:g.t90ReplaySlot,sourceHash:g.sourceHash,
      sourceAuthority:sha('TEST_SOURCE_AUTHORITY_'+g.sourceHash),
      mappingDigest:sha('TEST_MAPPING_'+g.sourceHash),
      // No authoritative Age of Friends winner is fabricated by this fixture.
      authorityRevision:1,sourceStatus:'READY',outcome:'PENDING',admitted:true,
      episodeChronologyComplete:g.episodeChronologyComplete,
      playedAtMs:g.recordedAtMs,context,statistics:g.statistics
    };
  });
  const gameMeasurements=games.map((g,i)=>({
    original:source.games[i].label,sourceHash:g.sourceHash,gameGuid:source.games[i].gameGuid,
    slot:g.replaySlot,start:g.context.startFamily,civ:g.context.civilization,
    map:g.context.mapId,
    features:measurePersonalityGame(g,calibration).features,
    reputation:source.games[i].sourceGrades,
  }));
  const factualExpected=[
    {BOOMER_AGGRESSOR:[2159,7909],CAUTIOUS_BOLD:[2,4],COMPACT_EXPANSIVE:[2,6],rivalry:0},
    {BOOMER_AGGRESSOR:[18003,32538],CAUTIOUS_BOLD:[2,6],COMPACT_EXPANSIVE:[8,17],rivalry:1},
    {BOOMER_AGGRESSOR:[19100,40225],CAUTIOUS_BOLD:[0,12],COMPACT_EXPANSIVE:[7,13],rivalry:1},
  ];
  gameMeasurements.forEach((measurement,i)=>{
    const expected=factualExpected[i];
    for(const axis of ['BOOMER_AGGRESSOR','CAUTIOUS_BOLD','COMPACT_EXPANSIVE']){
      const [n,d]=expected[axis];
      assert.equal(measurement.features[axis].numerator,n,measurement.original+':'+axis);
      assert.equal(measurement.features[axis].denominator,d,measurement.original+':'+axis);
      assert.equal(measurement.features[axis].fraction,n/d,measurement.original+':'+axis);
    }
    assert.equal(measurement.features.GUERRILLA_FRONTLINE.fraction,null);
    assert.equal(measurement.features.GUERRILLA_FRONTLINE.reason,
      'INSUFFICIENT_ATTRIBUTABLE_COMMAND_EPISODES');
    assert.equal(measurement.features.SPECIALIST_IMPROVISER.fraction,null);
    assert.equal(measurement.features.SPECIALIST_IMPROVISER.reason,
      'CLASSIFIED_FAMILY_OPPORTUNITY_UNAVAILABLE');
    assert.equal(measurement.reputation.RIVALRY.sourceAdmitted,expected.rivalry);
    for(const track of ['GALLANTRY','CRUELTY','CHIVALRY']){
      assert.equal(measurement.reputation[track].sourceAdmitted,0,measurement.original+':'+track);
    }
  });
  const career=projectPersonalityPreview(testPlayer,games,calibration);
  // These expected numerics are conditional on isolated test Battle IDs,
  // source-unreviewed LAND test label and PROPOSED anchors — not live scores.
  const projected=Object.fromEntries(career.sliders.map(x=>[x.axis,x.value]));
  assert.equal(projected.BOOMER_AGGRESSOR,49.44);
  assert.equal(projected.CAUTIOUS_BOLD,25);
  assert.equal(projected.COMPACT_EXPANSIVE,48.76);
  assert.equal(projected.GUERRILLA_FRONTLINE,null);
  assert.equal(projected.SPECIALIST_IMPROVISER,null);
  assert.equal(career.publication,'PRIVATE_PREVIEW_ONLY');
  assert.equal(career.policyStatus,'PROPOSED');
  assert.equal(career.battles.length,3);
  assert.equal(career.sliders.length,5);
  // Exact ordinary map/civ/duration source metadata remains distinct.
  assert.equal(new Set(games.map(g=>exact(g.context))).size,3);
  if(games.every(g=>g.context.startFamily==='STANDARD'))
    assert.equal(new Set(games.map(g=>personalityComparisonGroup(g.context))).size,1);
  for(const slider of career.sliders){
    assert.ok(slider.value===null || (slider.value>=0 && slider.value<=100),slider.axis);
    const qualifying=gameMeasurements.filter(x=>x.features[slider.axis].fraction!==null);
    assert.ok(slider.independentBattles<=qualifying.length,slider.axis);
  }
  // Source absence must affect only Specialist, not unconnected dimensions.
  assert.equal(career.sliders.find(s=>s.axis==='SPECIALIST_IMPROVISER').value,null);
  const forged={...games[0],battleId:'TEST-FORGED-DUPLICATE',matchId:'TEST-FORGED-DUPLICATE'};
  assert.throws(()=>buildPersonalityBattles([...games,forged],calibration),
    /DUPLICATE_RECORDING_CROSS_BATTLES/);
  const withdrawn={...games[0],authorityRevision:2,sourceStatus:'WITHDRAWN'};
  const corrected=projectPersonalityPreview(testPlayer,[...games,withdrawn],calibration);
  assert.notEqual(corrected.projectionRevision,career.projectionRevision);
  assert.equal(corrected.battles[0].features.BOOMER_AGGRESSOR.fraction,null);
  const proposed=createSocialE2EPilotCalibration();
  assert.equal(proposed.policy.status,'PROPOSED');
  const chapters=games.map((g,i)=>({
    battleId:g.battleId,matchId:g.battleId,gameId:g.gameId,
    gameGuid:source.games[i].gameGuid,eventId:'TEST-EVENT-'+(i+1),
    seasonId:'TEST-ONLY',sourceAuthority:g.sourceAuthority,state:'READY',revision:1,
    order:{event:i+1,battle:i+1,game:1,key:'TEST-EVENT-'+(i+1)}
  }));
  const effects=[];
  const reputationTracks=new Set(['GALLANTRY','CRUELTY','CHIVALRY']);
  source.games.forEach((item,i)=>{
    const chapter=chapters[i];
    for(const episode of item.sourceAdmittedEpisodesForTestOnly){
      if(!reputationTracks.has(episode.track))continue;
      const id='TEST_'+i+'_'+episode.track+'_'+episode.sourceCandidateId;
      const ref={kind:'SOURCE_DEED',id:episode.sourceCandidateId,
        revision:'TEST_ORIGINAL_ONLY',digest:sha(item.sourceHash+episode.sourceCandidateId)};
      effects.push({
        battleId:chapter.battleId,gameId:chapter.gameId,eventId:chapter.eventId,
        sourceAuthority:chapter.sourceAuthority,
        claim:{
          claimId:id,claimRevision:sha(id),incidentId:episode.sourceCandidateId,
          incidentRevision:sha(id+'_source'),
          subject:{system:'REPUTATION',track:episode.track,playerId:testPlayer},
          effect:'STRENGTHEN',basis:'BOUNDED_INFERENCE',
          ruleId:episode.ruleId,policy:proposed.policy,decision:'QUALIFIED',
          supportRefs:[ref],significanceBandId:episode.gradeBandId,
          contributionKey:episode.sourceIndependentContributionKey,
          historicalPosition:{leagueOrderKey:chapter.order.key,gameNumber:1,
            recordingAtMs:episode.sourcePosition.recordingAtMs,
            operationOrdinal:episode.sourcePosition.operationOrdinal,order:'ORDERED'},
          reciprocity:{decision:'INELIGIBLE',ruleId:'TEST_ONLY',independentActorRefs:[]}
        }
      });
    }
  });
  // Effects above are derived from source-admitted *methods* but are still
  // synthetic claims. The real canonical qualification bridge is not asserted.
  const history=evaluateHistory({chapters,effects,calibration:proposed,trustedApprovals:[]});
  assert.equal(history.publicationAllowed,false);
  assert.deepEqual(history.receipts,[]);
  const final={
    version:'T90_SOURCE_TEST_RESULT_V1',testOnly:true,
    resultAuthority:'SOURCE_STATISTICS_PLUS_EXPLICIT_TEST_WRAPPERS',
    noOfficialLeagueIdentity:true,sourceMapFamilyReview:'UNREVIEWED_TEST_PLACEHOLDER',
    canonicalClaimsQualified:false,liveAwardsGranted:false,
    gameMeasurements,
    preview:{sliders:career.sliders,independentGames:games.length},
    reputation:{qualifiedSourceMethodCandidates:effects.length,
      proposedSimulatedProjections:history.projections,officialReceipts:history.receipts}
  };
  console.log('T90_AUTHENTIC_PERSONALITY_REPUTATION_REPORT '+JSON.stringify(final));
});
