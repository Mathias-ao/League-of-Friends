import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import {SOCIAL_V1_CONTRACT,assertRecordInvariants,assertPublicationAllowed}
  from '../lib/domain/socialV1.js';
import {PERSONALITY_AXES,projectPersonalityPreview,buildPersonalityBattles}
  from '../lib/engines/personalityV1/personalityV1.js';
import {toPrivateShared1Personality,PERSONALITY_SHARED_ADAPTER_VERSION}
  from '../lib/engines/personalityV1/shared1Adapter.js';

const schema=JSON.parse(readFileSync(new URL('../../contracts/social-v1/shared.schema.json',import.meta.url)));
const fx=JSON.parse(readFileSync(new URL('./fixtures/personality-shared1-conformance.json',import.meta.url)));
const validate=new Ajv2020({strict:false,strictNumbers:true,allErrors:true}).compile(schema);
const sourceHash=n=>n.toString(16).padStart(64,'0');
const context=(overrides={})=>({format:'ONE_V_ONE',mapFamily:'LAND',startFamily:'STANDARD',
  mapId:'9',durationFamily:'ORDINARY',civilization:'FRANKS',
  civilizationOpportunityKey:'LAND_STANDARD',observedUntilMs:2400000,durationMs:2400000,
  dynamicDiplomacyQualified:false,...overrides});
const key=c=>[c.format,c.mapFamily,c.startFamily,c.mapId,c.durationFamily,c.civilizationOpportunityKey].join('|');
const axes=Object.keys(PERSONALITY_AXES);
const calibration=()=>({configurationVersion:'FIXTURE_CANDIDATE_UNAPPROVED',status:'PROPOSED',
  minimumIndependentBattles:2,recentBattleCount:2,careerWeight:.5,aggregationMethod:'MEDIAN',
  strategicBuildingIds:[80],availableMilitaryFamilies:{LAND_STANDARD:['infantry','archers','cavalry']},
  anchors:{[key(context())]:Object.fromEntries(axes.map(axis=>[axis,{
    lower:0,upper:1,comparisonGroup:'FIXTURE_LAND_1V1'}]))},
  minimumIndependentCommandEpisodes:2,
});
const projected=(slot=1)=>({
  playerId:slot,replaySlot:slot,
  economy:{resourceCommitment:{modelVersion:'AOF_RESOURCE_COMMITMENT_V1',
    resourcesCommitted:{total:1000},coverage:{unpricedRequestCommands:0}}},
  military:{modelVersion:'AOF_MILITARY_STATISTICS_V5',
    militarySpend:{resources:300,unpricedMilitaryCommandAmount:0},
    militaryUnitsTrained:{positiveQueueAmount:10,unknownAmountCommands:0},
    composition:{infantry:10,archers:0,cavalry:0,siege:0,monks:0,warships:0,
      navalSupport:0,otherLandMilitary:0,specialMilitary:0},
    engagements:{engagementModelVersion:'AOF_ENGAGEMENT_STATISTICS_V4',
      raidEvidence:{initiatedEpisodes:[1,2].map(i=>({
        raidId:'raid-'+i,modelVersion:'AOF_RAID_DETECTION_V3',attackerPlayerId:slot,
        victimPlayerId:2,startedAtMs:100000*i,endedAtMs:100000*i+1000,
        sourceEventIds:['op-'+slot+'-'+i]}))},
      engagementEvidence:{battles:[]}}},
  mapPresence:{modelVersion:'AOF_MAP_PRESENCE_V8',
    homeAnchor:{method:'initial_town_center'},buildingSectors:{classifiedPlacementCount:2,
      evidence:[{buildingId:80,sector:'home',sourceEventId:'build-home'},
        {buildingId:80,sector:'forward',sourceEventId:'build-forward'}]},
    expansionZones:{status:'ok',count:1,eligibleRemoteBuildingCount:2,
      eligibleBuildingPlacementsInsideHomeRadius:2,
      zones:[{zoneId:'expansion-1',buildings:[{sourceEventId:'camp-1'},{sourceEventId:'camp-2'}]}]}}
});
const game=(match='match-one',number=1,extras={})=>({
  battleId:match,matchId:match,gameId:'game-'+number,gameNumber:number,playerId:'p1',
  replaySlot:1,sourceHash:sourceHash(number+100),sourceAuthority:sourceHash(number+200),
  mappingDigest:sourceHash(number+300),authorityRevision:1,sourceStatus:'READY',
  outcome:'OFFICIAL',admitted:true,episodeChronologyComplete:true,
  playedAtMs:number*10000,context:context(),statistics:projected(),...extras,
});
const project=(games=[game('match-one',1),game('match-two',2)],c=calibration())=>{
  const preview=projectPersonalityPreview('p1',games,c);
  return {preview,candidate:toPrivateShared1Personality(preview,c,fx.policyVersion)};
};
const assertCanonical=(candidate)=>{
  assert.equal(candidate.contract,SOCIAL_V1_CONTRACT);
  assert.equal(candidate.publication,'PRIVATE_PREVIEW_ONLY');
  for(const value of candidate.battleFeatures) {
    assert.ok(validate({contract:SOCIAL_V1_CONTRACT,recordType:'BattleFeature',value}),
      JSON.stringify(validate.errors));
    assertRecordInvariants('BattleFeature',value);
  }
  assert.ok(validate({contract:SOCIAL_V1_CONTRACT,recordType:'PersonalityProfile',value:candidate.personalityProfile}),
    JSON.stringify(validate.errors));
  assertRecordInvariants('PersonalityProfile',candidate.personalityProfile);
};

test('SHARED_1 canonical adapter fixture: five measured axes per independent Battle and typed profile',()=>{
  const {candidate}=project();
  assertCanonical(candidate);
  assert.equal(candidate.adapterVersion,PERSONALITY_SHARED_ADAPTER_VERSION);
  assert.equal(candidate.battleFeatures.length,fx.expected.featureCount);
  assert.deepEqual(candidate.personalityProfile.sliders.map(s=>s.axis),fx.expected.axes);
  assert.equal(new Set(candidate.battleFeatures.map(b=>b.battleId)).size,fx.expected.independentBattleCount);
  assert.equal(candidate.personalityProfile.policy.status,'PROPOSED');
  assert.equal(candidate.personalityProfile.policy.approvalRef,null);
  for(const [axis,fraction] of Object.entries(fx.expected.rawFractions)) {
    const feature=candidate.battleFeatures.find(b=>b.battleId==='match-one'&&b.featureId===axis);
    assert.ok(Math.abs(feature.numerator/feature.denominator-fraction)<1e-10,axis);
    assert.ok(Math.abs(feature.normalized-fx.expected.normalizedCandidate[axis])<1e-10,axis);
    assert.equal(feature.coverage.tier,'LIMITED');
    assert.equal(feature.sampleUnit,'INDEPENDENT_BATTLE');
    assert.equal(feature.matchId,feature.battleId);
    assert.equal(feature.evidenceRefs[0].kind,'CONTEXT');
    assert.match(feature.inputDigest,/^[0-9a-f]{64}$/);
    const profileAxis=candidate.personalityProfile.sliders.find(s=>s.axis===axis);
    assert.equal(profileAxis.independentBattles,2);
    assert.equal(profileAxis.featureRefs.length,2);
    assert.equal(profileAxis.status,'READY');
    assert.equal(profileAxis.coverage.tier,'LIMITED');
  }
  assert.ok(candidate.personalityProfile.sliders.find(s=>s.axis==='GUERRILLA_FRONTLINE')
    .coverage.limitations.includes(fx.expected.commandPostureCaveat));
  assert.throws(()=>assertPublicationAllowed(candidate.personalityProfile,[]),/Unapproved/);
});

test('SHARED_1 private adapter ignores caller-asserted APPROVED and denies official publication',()=>{
  const config=calibration();config.status='APPROVED';
  const {candidate}=project(undefined,config);
  assertCanonical(candidate);
  assert.equal(candidate.personalityProfile.policy.status,'PROPOSED');
  assert.throws(()=>assertPublicationAllowed(candidate.personalityProfile,[
    {policyVersion:fx.policyVersion,configurationVersion:config.configurationVersion,
      status:'APPROVED',approvalRef:'fake-reference'}]),/Unapproved/);
});

test('unknown calibration or missing opportunities retain null Developing, including SHARED_1 normalized values',()=>{
  const preview=projectPersonalityPreview('p1',[game()],null);
  const candidate=toPrivateShared1Personality(preview,null,fx.policyVersion);
  assertCanonical(candidate);
  assert.ok(candidate.battleFeatures.every(b=>b.normalized===null));
  assert.ok(candidate.personalityProfile.sliders.every(s=>s.status==='DEVELOPING'&&s.value===null));
  assert.ok(candidate.personalityProfile.sliders.every(s=>s.contextKey==='PERSONALITY_CONTEXT_NOT_COMPARABLE'));
  const bad=structuredClone(preview);bad.sliders[0].status='DEVELOPING';bad.sliders[0].value=50;
  assert.throws(()=>toPrivateShared1Personality(bad,null,fx.policyVersion),/DEVELOPING_MUST_BE_NULL/);
  const tampered=structuredClone(candidate.battleFeatures[0]);tampered.battleId='game-one';
  assert.throws(()=>assertRecordInvariants('BattleFeature',tampered),/Battle\/Match identity mismatch/);
  assert.equal(validate({contract:SOCIAL_V1_CONTRACT,recordType:'BattleFeature',value:{...candidate.battleFeatures[0],denominator:0}}),false);
});

test('context-limited comparisons are explicit, not fabricated neutral score',()=>{
  const c=calibration(), different=context({format:'TEAM',mapId:'10'});
  c.anchors[key(different)]=Object.fromEntries(axes.map(axis=>[axis,{
    lower:0,upper:1,comparisonGroup:'DIFFERENT_TEAM_CONTEXT'}]));
  const {candidate}=project([game(),game('match-two',2,{context:different})],c);
  assertCanonical(candidate);
  assert.ok(candidate.personalityProfile.sliders.every(s=>
    s.status==='CONTEXT_LIMITED'&&s.value===null&&s.coverage.tier==='LIMITED'));
  assert.notEqual(candidate.personalityProfile.sliders[0].contextKey,key(context()));
});

test('two Games of one league Battle, repeated POV, same Game ID in distinct Battles',()=>{
  const a=game('battleA',1), b=game('battleA',2),
    other=game('battleB',3,{gameId:'game-1'});
  const {candidate}=project([a,a,structuredClone(a),b,other]);
  assertCanonical(candidate);
  assert.equal(candidate.battleFeatures.length,10);
  assert.equal(candidate.battleFeatures.filter(f=>f.battleId==='battleA').length,5);
  assert.equal(candidate.personalityProfile.sliders[0].independentBattles,2);
  assert.equal(candidate.battleFeatures.find(f=>f.battleId==='battleA').coverage
    .limitations.includes('MULTI_GAME_BATTLE_AGGREGATED_ONCE'),true);
  // Same Game ID legitimately occurs under a different Match/Battle.
  assert.deepEqual(new Set([a,b,other].map(g=>g.gameId)).size,2);
  assert.notEqual(candidate.battleFeatures.find(f=>f.battleId==='battleA').inputDigest,
    candidate.battleFeatures.find(f=>f.battleId==='battleB').inputDigest);
});

test('one conflicting source revision, multiple POV hashes or reused recording never silently admit evidence',()=>{
  const a=game('battleA',1);
  assert.throws(()=>buildPersonalityBattles([a,{...a,sourceHash:sourceHash(778)}],calibration()),
    /CONFLICTING_AUTHORITY_REVISION/);
  const different={...game('battleB',2),sourceHash:a.sourceHash};
  assert.throws(()=>buildPersonalityBattles([a,different],calibration()),
    /DUPLICATE_RECORDING_CROSS_BATTLES/);
  assert.throws(()=>buildPersonalityBattles([{...a,matchId:'game-1'}],calibration()),
    /BATTLE_IDENTITY_INVALID/);
  assert.throws(()=>toPrivateShared1Personality({...project().preview,battles:[
    {...project().preview.battles[0],battleId:'match/invalid'}]},calibration(),fx.policyVersion));
});

test('late corrections, withdrawal, dispute, rebind and source revision change the canonical fingerprint',()=>{
  const a=game('battleA',1),second=game('battleB',2);
  const before=project([a,second]).candidate;
  const correction={...a,authorityRevision:2,sourceHash:sourceHash(990),
    sourceAuthority:sourceHash(991),statistics:{...projected(),
      military:{...projected().military,militarySpend:{resources:750,unpricedMilitaryCommandAmount:0}}}};
  const after=project([a,correction,second]).candidate;
  assertCanonical(after);
  assert.notEqual(before.personalityProfile.projectionRevision,after.personalityProfile.projectionRevision);
  assert.equal(after.battleFeatures.find(f=>f.battleId==='battleA'&&f.featureId==='BOOMER_AGGRESSOR').numerator,.75);
  const withdrawn=project([a,{...correction,authorityRevision:3,sourceStatus:'WITHDRAWN'},second]).candidate;
  assert.ok(withdrawn.personalityProfile.sliders.every(s=>s.status==='DEVELOPING'&&s.value===null));
  assert.ok(withdrawn.battleFeatures.filter(f=>f.battleId==='battleA').every(f=>f.normalized===null));
  const disputed=project([a,{...correction,authorityRevision:3,outcome:'DISPUTED'},second]).candidate;
  assert.equal(disputed.personalityProfile.sliders[0].status,'DEVELOPING');
  const remapped=project([a,{...correction,authorityRevision:3,replaySlot:2,
    statistics:projected(2),mappingDigest:sourceHash(993)},second]).candidate;
  assertCanonical(remapped);
  assert.notEqual(remapped.personalityProfile.projectionRevision,after.personalityProfile.projectionRevision);
  assert.equal(remapped.personalityProfile.sliders[0].independentBattles,2);
});

test('same-Game replacement does not create new independent Battle; stale candidate input rejected',()=>{
  const a=game('battleA',1),corrected={...a,authorityRevision:2,sourceHash:sourceHash(988)};
  const p=projectPersonalityPreview('p1',[a,corrected,game('battleB',2)],calibration());
  assert.equal(p.battles.length,2);
  assert.throws(()=>toPrivateShared1Personality(p,{...calibration(),
    configurationVersion:'OTHER_TEST_CONFIG'},fx.policyVersion),/PRIVATE_PREVIEW_INPUT_INVALID/);
});

test('authentic measurements from retained source goldens are not synthetic Personality labels',()=>{
  for(const c of fx.authenticSourceChecks){
    assert.equal(c.authLeaguePlayerMapping,false);
    assert.equal(c.personalityPoleCalibrated,false);
    const doc=readFileSync(new URL('../../'+c.source,import.meta.url),'utf8');
    if(c.positiveQueueByReplaySlot){
      const j=JSON.parse(doc);
      assert.equal(j.playerCount,c.players);
      assert.equal(j.source.sha256,c.sourceHash);
      const bySlot=j.fundamentals.positiveQueueAmountsByPlayerAndRawUnit;
      const observed=Object.fromEntries(Object.entries(bySlot).map(([slot,units])=>
        [slot,Object.values(units).reduce((a,n)=>a+n,0)]));
      assert.deepEqual(observed,c.positiveQueueByReplaySlot);
    }else {
      assert.ok(doc.includes(c.caseId));
      assert.ok(doc.includes(c.sourceCommands.toLocaleString('en-US')));
    }
  }
  // The real goldens contain raw queue observations, NOT a verified current
  // Match/player authority record; no synthetic official winner is fabricated.
  assert.equal(fx.classification,'SYNTHETIC_CONTRACT_TEST_INPUTS_ONLY');
});
