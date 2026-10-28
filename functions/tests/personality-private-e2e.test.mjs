import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {bindingDigest} from '../lib/engines/nativeRecordingIntegration.js';
import {projectPrivatePersonalityHistory} from '../lib/integration/personalityHistory.js';
import {admitPersonalityContext,PERSONALITY_CONTEXT_PROOF_VERSION}
  from '../lib/engines/personalityV1/contextAdmission.js';
import {privatePersonalityE2EEnabled,privatePersonalityPolicy,PRIVATE_PERSONALITY_E2E_VERSION}
  from '../lib/engines/personalityV1/privateE2EPolicy.js';
import {validateSharedRecord} from '../lib/domain/socialV1Validation.js';
import {ready} from './support/private-history-fixture.mjs';
import {readMyPersonalityHistory} from '../lib/queries/getMyPersonalityHistory.js';

const hex=n=>createHash('sha256').update(String(n)).digest('hex');
const actor='p1';
const statistic=(slot=1)=>({
  replaySlot:slot,playerId:slot,
  economy:{resourceCommitment:{modelVersion:'AOF_RESOURCE_COMMITMENT_V1',
    resourcesCommitted:{total:1000},coverage:{unpricedRequestCommands:0}}},
  military:{modelVersion:'AOF_MILITARY_STATISTICS_V5',
    militarySpend:{resources:300,unpricedMilitaryCommandAmount:0},
    militaryUnitsTrained:{positiveQueueAmount:10,unknownAmountCommands:0},
    composition:{infantry:10,archers:0,cavalry:0},
    engagements:{engagementModelVersion:'AOF_ENGAGEMENT_STATISTICS_V4',
      raidEvidence:{initiatedEpisodes:[
        {modelVersion:'AOF_RAID_DETECTION_V3',attackerPlayerId:slot,victimPlayerId:2,
          startedAtMs:500000,sourceEventIds:['raid-one']},
        {modelVersion:'AOF_RAID_DETECTION_V3',attackerPlayerId:slot,victimPlayerId:2,
          startedAtMs:900000,sourceEventIds:['raid-two']}
      ]},engagementEvidence:{battles:[]}}
  },
  mapPresence:{modelVersion:'AOF_MAP_PRESENCE_V8',
    homeAnchor:{method:'initial_town_center'},
    buildingSectors:{classifiedPlacementCount:2,evidence:[
      {buildingId:80,sector:'home',sourceEventId:'home-placement'},
      {buildingId:80,sector:'forward',sourceEventId:'forward-placement'}
    ]},
    expansionZones:{status:'ok',count:1,eligibleRemoteBuildingCount:2,
      eligibleBuildingPlacementsInsideHomeRadius:2,zones:[{zoneId:'remote',
        buildings:[{sourceEventId:'remote-1'},{sourceEventId:'remote-2'}]}]}}
});
function game(battleId,gameId,ordinal){
  const hash=hex(battleId+'/'+gameId), roster=[
    {playerId:'p1',replaySlot:1,teamId:'1'},
    {playerId:'p2',replaySlot:2,teamId:'2'}];
  const source={contract:'AOF_SOCIAL_V1_SHARED_1',battleId,matchId:battleId,
    gameId,roster,sourceHash:hash,authorityRevision:hex('revision-'+hash),
    mappingDigest:hex('mapping-'+hash),statisticsRevision:1,
    outcome:{qualification:'OFFICIAL',resultRevision:1,winningPlayerIds:['p1']}};
  const statistics={scope:{observedUntilMs:2400000},
    matchFacts:{modelVersion:'AOF_RECORDING_MATCH_FACTS_V1',
      identityNamespace:'CANONICAL_REPLAY_PLAYER_ID',
      source:{replaySha256:hash,gameBuild:185872},
      game:{observedDurationMs:2400000,durationMeaning:'observed_recording_interval_not_proven_full_game'},
      map:{id:9},rules:{mapId:{status:'DECODED',value:9},
        startingAgeId:{status:'DECODED',value:0},startingResourcesId:{status:'DECODED',value:0}},
      players:[{playerId:1,replaySlot:1,civilization:{rawId:2}},
        {playerId:2,replaySlot:2,civilization:{rawId:4}}],
      diplomacy:{effectiveRuntimeStateQualified:false}},
    participants:[statistic(),{playerId:2,replaySlot:2}],
    sharedEpisodeDelivery:{version:'AOF_DIRECT_SHARED_EPISODES_V1_EXPERIMENTAL',
      sourceMode:'producer_unique_episodes',producerGroups:{battles:[],skirmishes:[],reinforcements:[]},
      playerRefs:[{replaySlot:1,playerId:1,groups:{battles:[]}}]}};
  return {source,statistics,match:{id:battleId,format:'ONE_V_ONE',opponentKind:'HUMAN',
      firstCompletedAt:{toMillis:()=>10000}},
    game:{id:gameId,matchId:battleId,gameNumber:ordinal,players:[
      {playerId:'p1',team:1},{playerId:'p2',team:2}]}};
}
const proof=x=>({version:PERSONALITY_CONTEXT_PROOF_VERSION,
  status:'REVIEWED_SOURCE_CLASSIFICATION',referenceId:'CONTROLLED_ONLY_NOT_GENUINE',
  sourceHash:x.source.sourceHash,gameBuild:185872,mapId:9,startingAgeId:0,startingResourcesId:0,
  mapFamily:'LAND',startFamily:'STANDARD',durationBucket:{
    id:'CONTROLLED_OBSERVED_INTERVAL',lowerObservedMs:0,upperObservedMsExclusive:3600000,
    meaning:'OBSERVED_RECORDING_INTERVAL_ONLY'}});
const taxonomy=(sources)=>{
  const sourceProofs=Object.fromEntries(sources.map(x=>[x.source.sourceHash,proof(x)]));
  return {sourceProofs,strategicBuildingsByBuild:{185872:[80]},
    militaryFamiliesByExactCiv:{BUILD_185872_CIV_2:['infantry','archers','cavalry']}};
};
const grouped=(sources)=>[...new Set(sources.map(s=>s.source.battleId))].map(battleId=>({
  battleId,gameIds:sources.filter(s=>s.source.battleId===battleId).map(s=>s.source.gameId),
  sources:sources.filter(s=>s.source.battleId===battleId)}));
const project=(sources,tax=taxonomy(sources))=>{
  const p=privatePersonalityPolicy(actor,sources,tax);
  return {policy:p,view:projectPrivatePersonalityHistory(actor,grouped(sources),
    bindingDigest([sources.map(s=>s.source),p.calibration]),p.context,p.calibration)};
};
const axes=['BOOMER_AGGRESSOR','CAUTIOUS_BOLD','GUERRILLA_FRONTLINE',
  'SPECIALIST_IMPROVISER','COMPACT_EXPANSIVE'];

test('two distinct controlled source-admitted Battles provide 5 numeric private proposed axes',()=>{
  const a=game('battle-A','g1',1),b=game('battle-B','g1',1);
  const {view,policy}=project([a,b]);
  assert.equal(policy.calibration.minimumIndependentBattles,2);
  assert.equal(policy.calibration.status,'PROPOSED');
  assert.equal(view.publication,'PRIVATE_PREVIEW_ONLY');
  assert.equal(view.calibration,'PROPOSED');
  assert.equal(view.contextAdmission,'SOURCE_QUALIFIED');
  assert.equal(view.personalityProfile.policy.status,'PROPOSED');
  assert.equal(view.battleFeatures.length,10);
  assert.deepEqual(view.personalityProfile.sliders.map(x=>x.axis),axes);
  for(const slider of view.personalityProfile.sliders){
    assert.equal(slider.status,'READY',slider.axis);
    assert.equal(slider.independentBattles,2,slider.axis);
    assert.equal(typeof slider.value,'number',slider.axis);
    assert.ok(slider.value>=0&&slider.value<=100);
  }
  const amounts=Object.fromEntries(view.personalityProfile.sliders.map(x=>[x.axis,x.value]));
  assert.equal(amounts.BOOMER_AGGRESSOR,30);
  assert.equal(amounts.CAUTIOUS_BOLD,50);
  assert.equal(amounts.GUERRILLA_FRONTLINE,0);
  assert.equal(amounts.SPECIALIST_IMPROVISER,0);
  assert.equal(amounts.COMPACT_EXPANSIVE,33.33);
  view.battleFeatures.forEach(f=>validateSharedRecord('BattleFeature',f));
  validateSharedRecord('PersonalityProfile',view.personalityProfile);
  assert.deepEqual(project([a,b]).view,view);
});
test('two Games in one Battle, duplicated POV and retry are only one independent Battle',()=>{
  const a=game('battle-A','g1',1),sibling=game('battle-A','g2',2);
  const {view}=project([a,sibling]);
  assert.equal(view.battleFeatures.length,5);
  assert.ok(view.personalityProfile.sliders.every(s=>s.status==='DEVELOPING'&&
    s.value===null&&s.independentBattles===1));
  const next=game('battle-B','g1',1);
  const qualified=project([a,sibling,next]).view;
  assert.equal(qualified.battleFeatures.length,10);
  assert.ok(qualified.personalityProfile.sliders.every(s=>s.status==='READY'&&
    s.independentBattles===2));
});
test('corrected source, missing sibling and missing opportunity remove evidence, not create midpoint',()=>{
  const a=game('battle-A','g1',1),b=game('battle-B','g1',1);
  const approved=taxonomy([a,b]),initial=project([a,b],approved).view;
  const changed=game('battle-A','g1-revision',1);
  const correction=project([changed,b],approved).view;
  assert.ok(correction.personalityProfile.sliders.every(s=>s.status==='DEVELOPING'&&s.value===null));
  assert.notEqual(correction.personalityProfile.projectionRevision,initial.personalityProfile.projectionRevision);
  const missingCivilization=game('battle-B','g1',1);
  delete missingCivilization.statistics.matchFacts.players[0].civilization.rawId;
  assert.ok(project([a,missingCivilization],approved).view.personalityProfile.sliders.every(s=>s.value===null));
  const missingSector=game('battle-B','g1',1);
  delete missingSector.statistics.participants[0].mapPresence.buildingSectors;
  const partial=project([a,missingSector],approved).view;
  assert.equal(partial.personalityProfile.sliders.find(s=>s.axis==='CAUTIOUS_BOLD').value,null);
  assert.equal(partial.personalityProfile.sliders.find(s=>s.axis==='BOOMER_AGGRESSOR').status,'READY');
  const newGame=game('battle-A','g2',2);
  const incomplete=grouped([a,b]);incomplete[0].gameIds.push(newGame.source.gameId);
  const policy=privatePersonalityPolicy(actor,[a,b],approved);
  const result=projectPrivatePersonalityHistory(actor,incomplete,'incomplete',policy.context,policy.calibration);
  assert.ok(result.personalityProfile.sliders.every(x=>x.value===null));
});
test('forged reviewed proof, wrong patch, map, start and subject aliases fail closed',()=>{
  const a=game('battle-A','g1',1),b=game('battle-B','g1',1);
  const known=taxonomy([a,b]);
  const forged=structuredClone(known);
  forged.sourceProofs[a.source.sourceHash].sourceHash=hex('unrelated');
  assert.equal(privatePersonalityPolicy(actor,[a,b],forged).diagnostics.acceptedGameSources,1);
  for(const mutation of [
    x=>x.statistics.matchFacts.source.gameBuild=180059,
    x=>x.statistics.matchFacts.map.id=17,
    x=>x.statistics.matchFacts.rules.startingAgeId.value=1,
    x=>x.source.roster[0].playerId='outsider',
    x=>x.source.outcome.qualification='UNRESOLVED'
  ]){
    const changed=game('battle-A','g1',1);mutation(changed);
    const response=project([changed,b],known).view;
    assert.ok(response.personalityProfile.sliders.every(x=>x.value===null));
  }
  // An invalid source civilization remains unqualified. A genuine DIFFERENT
  // civilization is not a cross-Game comparison failure (covered separately).
  const invalidCivilization=game('battle-B','g1',1);
  invalidCivilization.statistics.matchFacts.players[0].civilization.rawId=0;
  const out=project([a,invalidCivilization],known).view;
  assert.ok(out.personalityProfile.sliders.every(x=>x.value===null));
  assert.equal(admitPersonalityContext(a,'not-the-owner',proof(a)).context,null);
});
test('unreviewed military taxonomy and compact chronology leave only their axes Developing',()=>{
  const a=game('battle-A','g1',1),b=game('battle-B','g1',1);
  const noFamily=taxonomy([a,b]);noFamily.militaryFamiliesByExactCiv={};
  const d=project([a,b],noFamily).view;
  assert.equal(d.personalityProfile.sliders.find(s=>s.axis==='SPECIALIST_IMPROVISER').value,null);
  const noChronology=game('battle-B','g1',1);
  delete noChronology.statistics.sharedEpisodeDelivery;
  const result=project([a,noChronology]).view;
  assert.equal(result.personalityProfile.sliders.find(s=>s.axis==='GUERRILLA_FRONTLINE').value,null);
});
test('production and normal private history cannot activate provisional numerical policy',async()=>{
  assert.equal(privatePersonalityE2EEnabled({FUNCTIONS_EMULATOR:'true',
    GCLOUD_PROJECT:'demo-example',AOF_PERSONALITY_PRIVATE_E2E:'source-proposed-v1'}),true);
  assert.equal(privatePersonalityE2EEnabled({FUNCTIONS_EMULATOR:'true',
    GCLOUD_PROJECT:'league-of-friends-production',AOF_PERSONALITY_PRIVATE_E2E:'source-proposed-v1'}),false);
  assert.equal(privatePersonalityE2EEnabled({GCLOUD_PROJECT:'demo-example',
    AOF_PERSONALITY_PRIVATE_E2E:'source-proposed-v1'}),false);
  const fixture=await ready();
  const defaultRead=await fixture.read();
  assert.ok(defaultRead.personality.personalityProfile.sliders.every(x=>x.value===null));
  const enabled={...fixture.input,env:{...fixture.input.env,AOF_PERSONALITY_PRIVATE_E2E:'source-proposed-v1'}};
  const pending=await readMyPersonalityHistory(enabled);
  assert.ok(pending.personality.personalityProfile.sliders.every(x=>x.value===null));
  assert.equal(pending.personality.calibration,'PROPOSED');
  await assert.rejects(readMyPersonalityHistory({...fixture.input,personalityTaxonomy:taxonomy([])}),
    e=>e.code==='failed-precondition');
  await assert.rejects(readMyPersonalityHistory({...enabled,request:{calibration:'forged'}}),
    e=>e.code==='invalid-argument');
});

test('reviewed STANDARD-start source contexts compare across ordinary map, civ and observed interval',()=>{
  const a=game('battle-A','g1',1),b=game('battle-B','g1',1);
  b.statistics.matchFacts.map.id=140;
  b.statistics.matchFacts.rules.mapId.value=140;
  b.statistics.matchFacts.players[0].civilization.rawId=3;
  b.statistics.scope.observedUntilMs=960000;
  b.statistics.matchFacts.game.observedDurationMs=960000;
  const tax=taxonomy([a,b]);
  tax.sourceProofs[b.source.sourceHash].mapId=140;
  tax.sourceProofs[b.source.sourceHash].durationBucket={
    id:'TEST_REVIEWED_UNDER_30',lowerObservedMs:0,upperObservedMsExclusive:1800000,
    meaning:'OBSERVED_RECORDING_INTERVAL_ONLY'};
  tax.militaryFamiliesByExactCiv.BUILD_185872_CIV_3=['infantry','archers','cavalry'];
  const {view,policy}=project([a,b],tax);
  assert.equal(policy.diagnostics.acceptedGameSources,2);
  assert.equal(new Set(Object.keys(policy.calibration.anchors)).size,2);
  assert.equal(new Set(Object.values(policy.calibration.anchors)
    .map(x=>x.BOOMER_AGGRESSOR.comparisonGroup)).size,1);
  for(const axis of axes){
    const slider=view.personalityProfile.sliders.find(x=>x.axis===axis);
    assert.equal(slider.status,'READY',axis);
    assert.equal(slider.independentBattles,2,axis);
  }
  assert.equal(view.publication,'PRIVATE_PREVIEW_ONLY');
  // The exact civilization family can be withheld independently of every
  // other source-admitted axis; no fabricated civ opportunity is assumed.
  delete tax.militaryFamiliesByExactCiv.BUILD_185872_CIV_3;
  const incomplete=project([a,b],tax).view;
  assert.equal(incomplete.personalityProfile.sliders
    .find(x=>x.axis==='SPECIALIST_IMPROVISER').value,null);
  assert.equal(incomplete.personalityProfile.sliders
    .find(x=>x.axis==='BOOMER_AGGRESSOR').status,'READY');
});
