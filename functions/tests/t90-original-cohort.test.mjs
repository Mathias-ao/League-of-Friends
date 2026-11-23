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
import {qualifyPersonalityGameUnlock}
  from '../lib/engines/personalityV1/gameUnlock.js';
import {projectLivePersonalityEvidence}
  from '../lib/engines/personalityV1/liveEvidence.js';
import {evaluateHistory} from '../lib/engines/socialV1History/history.js';
import {createPracticalPersonalityPolicy} from '../lib/engines/personalityV1/practicalPolicy.js';
import {projectPrivatePersonalityHistory} from '../lib/integration/personalityHistory.js';
import {sourceItem,review as controlledReview,owner as controlledOwner} from './support/practical-personality-fixture.mjs';

const sha=value=>createHash('sha256').update(String(value)).digest('hex');
const report=process.env.AOF_T90_SOURCE_REPORT;
const axes=Object.keys(PERSONALITY_AXES);
const exact=c=>[c.format,c.mapFamily,c.startFamily,c.mapId,c.durationFamily,
  c.civilizationOpportunityKey].join('|');

test('approved policy uses genuine original-byte A measurements; absent spatial/episode/family reviews stay Developing',{
  skip:!report?'AOF_T90_SOURCE_REPORT from the genuine parser required':false,
},()=>{
  const original=JSON.parse(readFileSync(report,'utf8'));
  const records=JSON.parse(readFileSync(new URL('./fixtures/recording-outcomes.json',import.meta.url),'utf8'));
  const catalogBytes=readFileSync(new URL('../../replay-tools/entity-catalog/aoe2de-185872-v2.json',import.meta.url));
  const catalog=JSON.parse(catalogBytes.toString('utf8'));
  assert.equal(catalog.referenceGameBuild,185872);
  // The existing generator rehashes/parses all original bytes and selects the
  // build185872 catalogue without an override. These reviewed BASE request
  // costs do not claim actual civ-adjusted spending. League identities and
  // source envelopes here remain isolated TEST wrappers, not staged owners.
  const items=original.games.map((g,i)=>{
    const recorded=records.find(r=>r.sourceHash===g.sourceHash),header=recorded.matchFacts.headerFieldCandidates;
    assert.equal(header['de.build'],185872);assert.equal(header['de.mod'],'');assert.equal(header['de.rms_mod_id'],null);
    assert.equal(recorded.matchFacts.game.bodyParseComplete,true);
    const item=sourceItem(i+1);
    item.source.sourceHash=g.sourceHash;item.source.gameGuid=g.gameGuid;
    item.source.roster=recorded.players.map(p=>({playerId:p.replaySlot===g.t90ReplaySlot?controlledOwner:'TEST_OPPONENT_'+i,
      replaySlot:p.replaySlot,teamId:String(p.teamId)}));
    item.game.players=item.source.roster.map(p=>({playerId:p.playerId,team:Number(p.teamId)}));
    item.match.firstCompletedAt={toMillis:()=>g.recordedAtMs};
    item.statistics={entityCatalogVersion:catalog.schemaVersion,scope:{observedUntilMs:g.observedUntilMs},
      participants:[g.statistics],matchFacts:{
        // Controlled canonical metadata envelope, not an asserted current native
        // artifact. Source measurements/IDs/build/clock above come from originals;
        // native header retention/admission is tested separately by the genuine
        // authenticated two-original emulator (no fabricated retained digest).
        modelVersion:'AOF_RECORDING_MATCH_FACTS_V1',identityNamespace:'CANONICAL_REPLAY_PLAYER_ID',
        source:{...recorded.matchFacts.source,gameBuild:header['de.build']},
        game:{observedDurationMs:g.observedDurationMs,durationMeaning:'observed_recording_interval_not_proven_full_game'},
        map:{id:g.mapId},rules:{mapId:{status:'DECODED',value:g.mapId},
          startingAgeId:{status:'DECODED',value:header['de.starting_age_id']},
          startingResourcesId:{status:'DECODED',value:header['de.starting_resources_id']}},
        players:recorded.players.map(p=>({playerId:p.replaySlot,replaySlot:p.replaySlot,civilization:{rawId:p.civilizationId}}))}};
    return item;
  });
  const reviews=Object.fromEntries(items.map(item=>{
    const r=controlledReview(item);
    r.referenceId='TEST_AUTHORITY_ORIGINAL_BYTE_CATALOG_APPLICABILITY';
    r.costCatalog={product:'AOE2_DE',gameBuild:185872,version:catalog.schemaVersion,
      sha256:createHash('sha256').update(catalogBytes).digest('hex'),referenceId:'PINNED_185872_CATALOG_NO_MOD_BASE_REQUEST_COSTS'};
    // These exact originals have NO independently reviewed spatial or family
    // opportunity in the hosted registry. Never borrow demo LAND/standard IDs.
    delete r.spatial;delete r.strategicBuildings;delete r.commandAttribution;delete r.militaryFamilies;delete r.expansionSites;
    return [item.source.sourceHash,r];
  }));
  const policy=createPracticalPersonalityPolicy(controlledOwner,items,reviews);
  const battles=items.map(item=>({battleId:item.source.battleId,gameIds:['g1'],gameManifestComplete:true,sources:[item]}));
  const result=projectPrivatePersonalityHistory(controlledOwner,battles,sha('TEST_CURRENT_INPUT'),policy.context,policy.calibration);
  const a=result.personalityProfile.sliders.find(s=>s.axis==='BOOMER_AGGRESSOR');
  const fractions=original.games.map(g=>g.statistics.military.militarySpend.resources/g.statistics.economy.resourceCommitment.resourcesCommitted.total).sort((a,b)=>a-b);
  assert.equal(a.independentBattles,3,JSON.stringify({axis:a,features:result.battleFeatures.map(f=>({axis:f.featureId,missing:f.coverage.missing}))}));assert.equal(a.value,100*fractions[1]);assert.equal(a.status,'READY');
  assert.equal(a.value,100*(19100/40225));
  assert.ok(result.personalityProfile.sliders.filter(s=>s.axis!=='BOOMER_AGGRESSOR').every(s=>s.value===null));
  for(const missing of ['CAUTIOUS_BOLD','COMPACT_EXPANSIVE','GUERRILLA_FRONTLINE','SPECIALIST_IMPROVISER'])
    assert.notEqual(result.personalityProfile.sliders.find(s=>s.axis===missing).status,'READY');
  const unreviewed=createPracticalPersonalityPolicy(controlledOwner,items,{});
  const negative=projectPrivatePersonalityHistory(controlledOwner,battles,sha('TEST_CURRENT_INPUT'),unreviewed.context,unreviewed.calibration);
  assert.ok(negative.personalityProfile.sliders.every(s=>s.value===null),'same genuine bytes without applicable review cannot mint scores');
});

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
  // Genuine original SHA/GUID/slots, but all league Player/Match source
  // wrappers below remain explicit TEST ONLY and are NOT authenticated AoF.
  const testSourceSnapshots=games.map((g,i)=>({
    contract:'AOF_SOCIAL_V1_SHARED_1',authorityRevision:g.sourceAuthority,
    battleId:g.battleId,matchId:g.matchId,gameId:g.gameId,
    eventId:'TEST_EVENT',seasonId:'TEST_SEASON',
    gameGuid:source.games[i].gameGuid,sourceHash:g.sourceHash,
    statisticsRevision:1,mappingDigest:g.mappingDigest,
    eventAdmissionDigest:sha('test event '+i),artifactRefs:[],
    outcome:{qualification:'UNRESOLVED',resultRevision:null,winningPlayerIds:null},
    roster:[{playerId:testPlayer,replaySlot:g.replaySlot,teamId:'test-a'},
      {playerId:'TEST_OPPONENT_'+i,replaySlot:g.replaySlot===1?2:1,teamId:'test-b'}],
  }));
  assert.equal(qualifyPersonalityGameUnlock(testPlayer,testSourceSnapshots.slice(0,2)).status,'LOCKED');
  const threeGameMilestone=qualifyPersonalityGameUnlock(testPlayer,testSourceSnapshots);
  assert.equal(threeGameMilestone.status,'UNLOCKED');
  assert.equal(threeGameMilestone.eligibleGames,3);
  assert.equal(qualifyPersonalityGameUnlock(testPlayer,testSourceSnapshots.slice(1)).status,'LOCKED');
  assert.throws(()=>qualifyPersonalityGameUnlock(testPlayer,
    [...testSourceSnapshots,testSourceSnapshots[0]]),/DUPLICATE_GUID_SOURCE_OR_GAME/);
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
  // The original replay bytes prove actual Game feature numerators and
  // denominators. Canonical league Battle/owner bindings remain synthetic
  // test-only wrappers, not the historical T90 player's league membership.
  const originalBattles=games.map((g,i)=>({
    battleId:g.battleId,gameIds:[g.gameId],gameManifestComplete:true,
    sources:[{source:testSourceSnapshots[i]}],
  }));
  const sourceFeatures=games.flatMap((g,i)=>axes.map(axis=>{
    const observed=gameMeasurements[i].features[axis];
    return {playerId:testPlayer,battleId:g.battleId,matchId:g.battleId,
      featureId:axis,featureVersion:'AOF_PERSONALITY_FEATURES_V1',
      sampleUnit:'INDEPENDENT_BATTLE',numerator:observed.numerator,
      denominator:observed.denominator,
      coverage:{missing:observed.reason?[observed.reason]:[]}};
  }));
  const ownerOnlyModel=projectLivePersonalityEvidence(
    testPlayer,originalBattles,threeGameMilestone,sourceFeatures,{
      playerId:testPlayer,policy:{status:'PROPOSED',approvalRef:null},
      sliders:career.sliders,
    },false);
  assert.equal(ownerOnlyModel.qualifiedBattles,3);
  assert.equal(ownerOnlyModel.eligibleGames,3);
  assert.equal(ownerOnlyModel.calibration,'NOT_APPROVED');
  assert.deepEqual(Object.fromEntries(ownerOnlyModel.axes.map(x=>[x.axis,x.measuredBattles])),{
    BOOMER_AGGRESSOR:3,CAUTIOUS_BOLD:3,GUERRILLA_FRONTLINE:0,
    SPECIALIST_IMPROVISER:0,COMPACT_EXPANSIVE:3
  });
  assert.ok(ownerOnlyModel.axes.every(x=>x.value===null));
  assert.ok(ownerOnlyModel.axes.filter(x=>x.measuredBattles>0).every(x=>
    x.status==='CALIBRATION_PENDING'));
  assert.ok(ownerOnlyModel.axes.find(x=>x.axis==='SPECIALIST_IMPROVISER')
    .reasons.includes('CLASSIFIED_FAMILY_OPPORTUNITY_UNAVAILABLE'));
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
