import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PERSONALITY_FEATURE_VERSION,PERSONALITY_AXES,
  measurePersonalityGame,buildPersonalityBattles,projectPersonalityPreview,personalityComparisonGroup}
  from '../lib/engines/personalityV1/personalityV1.js';

const hex = n => n.toString(16).padStart(64,'0');
const axisNames=Object.keys(PERSONALITY_AXES);
const baseContext=()=>({format:'ONE_V_ONE',mapFamily:'LAND',startFamily:'STANDARD',mapId:'9',
  durationFamily:'ORDINARY',civilization:'FRANKS',civilizationOpportunityKey:'LAND_STANDARD',
  observedUntilMs:2400000,durationMs:2400000,dynamicDiplomacyQualified:false});
const baseStats=()=>({
  playerId:1,replaySlot:1,
  economy:{resourceCommitment:{modelVersion:'AOF_RESOURCE_COMMITMENT_V1',
    resourcesCommitted:{total:1000},coverage:{unpricedRequestCommands:0}}},
  military:{modelVersion:'AOF_MILITARY_STATISTICS_V5',
    militarySpend:{resources:300,unpricedMilitaryCommandAmount:0},
    militaryUnitsTrained:{positiveQueueAmount:10,unknownAmountCommands:0},
    composition:{infantry:10,archers:0,cavalry:0,siege:0,monks:0,warships:0,navalSupport:0,otherLandMilitary:0,specialMilitary:0},
    engagements:{engagementModelVersion:'AOF_ENGAGEMENT_STATISTICS_V4',
      raidEvidence:{initiatedEpisodes:[
        {raidId:'r1',modelVersion:'AOF_RAID_DETECTION_V3',attackerPlayerId:1,victimPlayerId:2,startedAtMs:900000,sourceEventIds:['raid1']},
        {raidId:'r2',modelVersion:'AOF_RAID_DETECTION_V3',attackerPlayerId:1,victimPlayerId:2,startedAtMs:1200000,sourceEventIds:['raid2']}
      ]},
      engagementEvidence:{battles:[]}}},
  mapPresence:{modelVersion:'AOF_MAP_PRESENCE_V8',homeAnchor:{method:'initial_town_center'},
    buildingSectors:{classifiedPlacementCount:2,evidence:[
      {buildingId:80,sector:'home',sourceEventId:'h'},
      {buildingId:80,sector:'forward',sourceEventId:'f'}]},
    expansionZones:{status:'ok',count:1,eligibleRemoteBuildingCount:2,
      eligibleBuildingPlacementsInsideHomeRadius:2,
      zones:[{zoneId:'expansion-1',buildings:[
        {sourceEventId:'camp1'},{sourceEventId:'camp2'}]}]}}
});
const game=(i=1,mod={})=>{
  const original={
    battleId:'battle-'+i,matchId:'battle-'+i,gameId:'game-'+i,gameNumber:1,playerId:'playerA',
    replaySlot:1,sourceHash:hex(i+100),sourceAuthority:hex(i+200),mappingDigest:hex(i+300),
    authorityRevision:1,sourceStatus:'READY',outcome:'OFFICIAL',admitted:true,episodeChronologyComplete:true,
    playedAtMs:i*10000,context:baseContext(),statistics:baseStats(),
  };
  return {...original,...mod};
};
const key=c=>[c.format,c.mapFamily,c.startFamily,c.mapId,c.durationFamily,c.civilizationOpportunityKey].join('|');
const config=(context=baseContext())=>({
  configurationVersion:'PERSONALITY_CANDIDATE_TEST_ONLY',status:'PROPOSED',
  minimumIndependentBattles:2,recentBattleCount:2,careerWeight:.5,aggregationMethod:'MEDIAN',
  strategicBuildingIds:[80],availableMilitaryFamilies:{LAND_STANDARD:['infantry','archers','cavalry']},
  anchors:{[key(context)]:Object.fromEntries(axisNames.map(a=>[a,{lower:0,upper:1,comparisonGroup:'standard-land'}]))},
  minimumIndependentCommandEpisodes:2
});
const slider=(p,a)=>p.sliders.find(x=>x.axis===a);
const tweak=(g,f)=>{
  const x=structuredClone(g);f(x.statistics,x.context);return x;
};

test('all five axes derive truthful ratios from reviewed projection-field shapes',()=>{
  const c=config(),f=measurePersonalityGame(game(),c).features;
  assert.deepEqual(axisNames.sort(),Object.keys(f).sort());
  assert.equal(f.BOOMER_AGGRESSOR.fraction,.3);
  assert.equal(f.CAUTIOUS_BOLD.fraction,.5);
  assert.equal(f.GUERRILLA_FRONTLINE.fraction,0);
  assert.equal(f.SPECIALIST_IMPROVISER.fraction,0);
  assert.equal(f.COMPACT_EXPANSIVE.fraction,1/3);
  assert.equal(f.GUERRILLA_FRONTLINE.semantic,'COMMAND_POSTURE');
  assert.equal(f.CAUTIOUS_BOLD.evidenceIds.length,2);
});
test('qualified zero, absent opportunity and missing calibration are not a neutral 50',()=>{
  const no=projectPersonalityPreview('playerA',[game()],null);
  assert.equal(no.policyStatus,'UNCONFIGURED');
  assert.equal(no.sliders.length,5);
  for(const s of no.sliders){assert.equal(s.value,null);assert.equal(s.status,'DEVELOPING');}
  const c=config(),withoutMoney=tweak(game(),p=>{p.economy.resourceCommitment.coverage.unpricedRequestCommands=1;});
  const p=projectPersonalityPreview('playerA',[withoutMoney,game(2)],c);
  assert.equal(slider(p,'BOOMER_AGGRESSOR').value,null);
  assert.equal(slider(p,'BOOMER_AGGRESSOR').independentBattles,1);
  assert.equal(measurePersonalityGame(game(),c).features.SPECIALIST_IMPROVISER.fraction,0);
});
test('two independent Battles produce proposed private preview with no official publication',()=>{
  const p=projectPersonalityPreview('playerA',[game(),game(2)],config());
  assert.equal(p.publication,'PRIVATE_PREVIEW_ONLY');
  assert.equal(p.policyStatus,'PROPOSED');
  assert.equal(p.battles.length,2);
  for(const axis of axisNames)assert.equal(slider(p,axis).status,'READY');
  assert.equal(slider(p,'CAUTIOUS_BOLD').value,50);
  assert.equal(slider(p,'GUERRILLA_FRONTLINE').value,0);
  assert.match(p.projectionRevision,/^[0-9a-f]{64}$/);
});
test('no duplicated POVs, retries or minor revision changes give an extra Battle',()=>{
  const x=game(),dupe=structuredClone(x);
  const b=buildPersonalityBattles([x,x,dupe],config());
  assert.equal(b.length,1);
  const corrected=tweak(game(),p=>{p.military.militarySpend.resources=700;});
  corrected.authorityRevision=2;corrected.sourceHash=hex(999);
  const latest=projectPersonalityPreview('playerA',[x,corrected,game(2)],config());
  assert.equal(latest.battles.length,2);
  assert.equal(slider(latest,'BOOMER_AGGRESSOR').value,50);
  assert.notEqual(latest.projectionRevision,projectPersonalityPreview('playerA',[x,game(2)],config()).projectionRevision);
  assert.throws(()=>buildPersonalityBattles([x,{...x,sourceHash:hex(998)}],config()),/CONFLICTING_AUTHORITY/);
});
test('late source withdrawal, result dispute and slot rebind remove previous input',()=>{
  const x=game(),later={...x,authorityRevision:2,sourceStatus:'WITHDRAWN'};
  const p=projectPersonalityPreview('playerA',[x,later,game(2)],config());
  assert.equal(slider(p,'COMPACT_EXPANSIVE').value,null);
  assert.equal(slider(p,'COMPACT_EXPANSIVE').independentBattles,1);
  const disputed=measurePersonalityGame({...game(),outcome:'DISPUTED'},config());
  assert.equal(disputed.features.BOOMER_AGGRESSOR.fraction,null);
  const moved=measurePersonalityGame({...game(),statistics:{...baseStats(),replaySlot:2}},config());
  assert.equal(moved.eligible,false);
  assert.throws(()=>measurePersonalityGame({...game(),matchId:'another'},config()),/UNTRUSTED_BATTLE/);
});
test('multi-Game league Battle remains one independent opportunity, and incomplete Game withholds it',()=>{
  const x=game(),second={...game(),gameId:'second',gameNumber:2,
    sourceHash:hex(777),sourceAuthority:hex(778)};
  const b=buildPersonalityBattles([x,second,game(2)],config());
  assert.equal(b.length,2);assert.equal(b[0].gameIds.length,2);
  const incomplete=tweak(second,p=>{p.mapPresence.expansionZones.status='no_starting_town_center_anchor';});
  const p=projectPersonalityPreview('playerA',[x,incomplete,game(2)],config());
  assert.equal(slider(p,'COMPACT_EXPANSIVE').value,null);
  assert.equal(slider(p,'BOOMER_AGGRESSOR').independentBattles,2);
  assert.throws(()=>buildPersonalityBattles([x,{...second,gameNumber:1}],config()),/DUPLICATE_GAME_NUMBER/);
});
test('incompatible contexts and anomalous starts remain context limited or Developing',()=>{
  const different=game(2,{context:{...baseContext(),format:'TEAM',mapId:'11'}});
  const c=config();c.anchors[key(different.context)]=Object.fromEntries(axisNames.map(a=>[
    a,{lower:0,upper:1,comparisonGroup:'team'}]));
  const p=projectPersonalityPreview('playerA',[game(),different],c);
  for(const s of p.sliders){assert.equal(s.status,'CONTEXT_LIMITED');assert.equal(s.value,null);}
  const nomad=game(2,{context:{...baseContext(),startFamily:'NOMAD'}});
  const n=projectPersonalityPreview('playerA',[game(),nomad],config());
  assert.equal(slider(n,'BOOMER_AGGRESSOR').independentBattles,1);
  assert.equal(slider(n,'BOOMER_AGGRESSOR').status,'DEVELOPING');
});
test('short Game duration uses distinct context and missing complete cost coverage is not observed zero',()=>{
  const short=game(2,{context:{...baseContext(),durationMs:360000,observedUntilMs:360000,
    durationFamily:'SHORT'}});
  const x=measurePersonalityGame(short,config());
  assert.equal(x.eligible,true);
  const preview=projectPersonalityPreview('playerA',[game(),short],config());
  assert.equal(slider(preview,'BOOMER_AGGRESSOR').value,null);
  const cost=tweak(game(),p=>{p.military.militarySpend.unpricedMilitaryCommandAmount=1;});
  assert.equal(measurePersonalityGame(cost,config()).features.BOOMER_AGGRESSOR.fraction,null);
});
test('FFA dynamic diplomacy uncertainty blocks command posture but not automatic economic axes',()=>{
  const f=game(2,{context:{...baseContext(),format:'FFA',dynamicDiplomacyQualified:false}});
  const features=measurePersonalityGame(f,config()).features;
  assert.equal(features.GUERRILLA_FRONTLINE.fraction,null);
  assert.equal(features.COMPACT_EXPANSIVE.fraction,1/3);
  const qualified={...f,context:{...f.context,dynamicDiplomacyQualified:true}};
  assert.equal(measurePersonalityGame(qualified,config()).features.GUERRILLA_FRONTLINE.fraction,0);
});
test('Guerrilla/Frontline requires attributed military commands; overlapping detector sources never stack',()=>{
  const c=config();
  const empty=tweak(game(),p=>{p.military.engagements.raidEvidence.initiatedEpisodes=[{
    attackerPlayerId:1,victimPlayerId:2,sourceEventIds:[],startedAtMs:10}];});
  assert.equal(measurePersonalityGame(empty,c).features.GUERRILLA_FRONTLINE.fraction,null);
  const frontal=tweak(game(),p=>{p.military.engagements.engagementEvidence.battles=[
    {baseOwnerPlayerId:null,startedAtMs:100000,endedAtMs:120000,contributionSourceEventIdsByPlayer:{1:['b1']},unitClassEvidenceByPlayer:{1:{militaryClassInstances:2}}},
    {baseOwnerPlayerId:null,startedAtMs:100000,endedAtMs:120000,contributionSourceEventIdsByPlayer:{1:['b2']},unitClassEvidenceByPlayer:{1:{militaryClassInstances:2}}}
  ];p.military.engagements.raidEvidence.initiatedEpisodes=[];});
  assert.equal(measurePersonalityGame(frontal,c).features.GUERRILLA_FRONTLINE.fraction,1);
  const overlap=tweak(game(),p=>{p.military.engagements.engagementEvidence.battles=[
    {baseOwnerPlayerId:null,startedAtMs:100000,endedAtMs:120000,contributionSourceEventIdsByPlayer:{1:['raid1']},unitClassEvidenceByPlayer:{1:{militaryClassInstances:2}}}
  ];});
  assert.equal(measurePersonalityGame(overlap,c).features.GUERRILLA_FRONTLINE.fraction,null);
  assert.equal(measurePersonalityGame({...game(),episodeChronologyComplete:false},c)
    .features.GUERRILLA_FRONTLINE.fraction,null);
});
test('Specialist family opportunity, unknown queues and diversifying positive requests',()=>{
  const c=config(),broad=tweak(game(),p=>{p.military.composition.infantry=5;p.military.composition.archers=5;});
  const f=measurePersonalityGame(broad,c).features.SPECIALIST_IMPROVISER;
  assert.ok(f.fraction>0.6 && f.fraction<0.7);
  const unknown=tweak(game(),p=>{p.military.militaryUnitsTrained.unknownAmountCommands=1;});
  assert.equal(measurePersonalityGame(unknown,c).features.SPECIALIST_IMPROVISER.fraction,null);
  const oneFamily={...c,availableMilitaryFamilies:{LAND_STANDARD:['infantry']}};
  assert.equal(measurePersonalityGame(game(),oneFamily).features.SPECIALIST_IMPROVISER.fraction,null);
});
test('truncated map sector and expansion-zone evidence never becomes observed zero',()=>{
  const c=config();
  const sectors=tweak(game(),p=>{p.mapPresence.buildingSectors.classifiedPlacementCount=10;});
  assert.equal(measurePersonalityGame(sectors,c).features.CAUTIOUS_BOLD.fraction,null);
  const zones=tweak(game(),p=>{p.mapPresence.expansionZones.eligibleRemoteBuildingCount=10;});
  assert.equal(measurePersonalityGame(zones,c).features.COMPACT_EXPANSIVE.fraction,null);
});
test('repeated BUILD clicks cannot fabricate remote sites; missing initial TC blocks positional claims',()=>{
  const x=tweak(game(),p=>{p.mapPresence.expansionZones.eligibleRemoteBuildingCount=100;});
  assert.equal(measurePersonalityGame(x,config()).features.COMPACT_EXPANSIVE.fraction,null);
  const noAnchor=tweak(game(),p=>{p.mapPresence.homeAnchor.method=null;});
  assert.equal(measurePersonalityGame(noAnchor,config()).features.COMPACT_EXPANSIVE.fraction,null);
  assert.equal(measurePersonalityGame(noAnchor,config()).features.CAUTIOUS_BOLD.fraction,null);
});
test('outlier Battle is bounded by explicitly chosen median aggregation',()=>{
  const extreme=tweak(game(3),p=>{p.military.militarySpend.resources=1000;});
  const normal=game(),next=game(2);
  const c=config();
  c.recentBattleCount=3;
  c.careerWeight=1;
  c.aggregationMethod='MEDIAN';
  const robust=projectPersonalityPreview('playerA',[normal,next,extreme],c);
  assert.equal(slider(robust,'BOOMER_AGGRESSOR').value,30);
  c.aggregationMethod='MEAN';
  const nonrobust=projectPersonalityPreview('playerA',[normal,next,extreme],c);
  assert.ok(slider(nonrobust,'BOOMER_AGGRESSOR').value>30);
});
test('duplicate same recording across separate league Battles cannot manufacture longitudinal samples',()=>{
  const duplicated={...game(2),sourceHash:game().sourceHash};
  assert.throws(()=>buildPersonalityBattles([game(),duplicated],config()),
    /DUPLICATE_RECORDING_CROSS_BATTLES/);
});
test('out-of-recording inferred command episode is not counted as military posture',()=>{
  const invalid=tweak(game(),p=>{
    p.military.engagements.raidEvidence.initiatedEpisodes=[{modelVersion:'AOF_RAID_DETECTION_V3',attackerPlayerId:1,victimPlayerId:2,
      startedAtMs:3000000,sourceEventIds:['future']}];
  });
  assert.equal(measurePersonalityGame(invalid,config()).features.GUERRILLA_FRONTLINE.fraction,null);
});
test('correcting Battle chronology or context changes projection revision even when fractions match',()=>{
  const c=config(),base=projectPersonalityPreview('playerA',[game(),game(2)],c);
  const later={...game(),authorityRevision:2,playedAtMs:99999};
  const revised=projectPersonalityPreview('playerA',[game(),later,game(2)],c);
  assert.notEqual(base.projectionRevision,revised.projectionRevision);
  const alternative={...game(),authorityRevision:2,context:{...baseContext(),mapId:'different-map'}};
  const different=projectPersonalityPreview('playerA',[game(),alternative,game(2)],c);
  assert.notEqual(base.projectionRevision,different.projectionRevision);
});
test('upstream formula changes invalidate rather than silently recalibrate historical personality',()=>{
  const c=config();
  const changed=tweak(game(),p=>{p.mapPresence.modelVersion='AOF_MAP_PRESENCE_V9';});
  const f=measurePersonalityGame(changed,c).features;
  assert.equal(f.CAUTIOUS_BOLD.fraction,null);
  assert.equal(f.COMPACT_EXPANSIVE.fraction,null);
  assert.equal(f.BOOMER_AGGRESSOR.fraction,.3);
  const changedMilitary=tweak(game(),p=>{p.military.modelVersion='AOF_MILITARY_STATISTICS_V6';});
  assert.equal(measurePersonalityGame(changedMilitary,c).features.BOOMER_AGGRESSOR.fraction,null);
  assert.equal(measurePersonalityGame(changedMilitary,c).features.SPECIALIST_IMPROVISER.fraction,null);
});
test('context calibration must be explicit, frozen, in-range; invalid unapproved constants rejected',()=>{
  const c=config();c.anchors[key(baseContext())].CAUTIOUS_BOLD={lower:.2,upper:.8,comparisonGroup:'test'};
  assert.equal(slider(projectPersonalityPreview('playerA',[game(),game(2)],c),'CAUTIOUS_BOLD').value,50);
  c.anchors[key(baseContext())].CAUTIOUS_BOLD={lower:.9,upper:.2,comparisonGroup:'test'};
  assert.throws(()=>projectPersonalityPreview('playerA',[game()],c),/CALIBRATION_ANCHOR_INVALID/);
});
test('saved authentic corpus identifies independent 1v1 and FFA; formats are calibration cases, not fabricated scores',()=>{
  const path=new URL('../../replay-tools/tests/goldens/statistics-corpus-v1.json',import.meta.url);
  const corpus=JSON.parse(readFileSync(path,'utf8'));
  const ids=corpus.reports.map(r=>r.id);
  assert.ok(ids.some(x=>x.includes('duel')));
  assert.ok(ids.some(x=>x.includes('ffa')));
  assert.ok(corpus.reports.every(r=>r.sourceSha256.length===64));
  // Metadata-only corpus lacks league Battle ID, authoritative mapping and eligible result.
  // It is forbidden to manufacture the missing fields to assert a REAL personality score.
  assert.equal(PERSONALITY_FEATURE_VERSION,'AOF_PERSONALITY_FEATURES_V1');
});

test('ordinary map, civilization and observed-duration differences do not divide Personality',()=>{
  // Distinct original-context metadata is retained, like the T90 cohort
  // (185872, map 140/140/9, civ 3/5/1, observed 16/33/40 minutes).
  // This test supplies synthetic *eligible statistics* and explicit per-civ
  // opportunity; it does not assert those original Games are already admitted.
  const contexts=[
    {...baseContext(),mapId:'140',civilization:'RAW_AOE2_CIV_3',
      civilizationOpportunityKey:'BUILD_185872_CIV_3',durationFamily:'OBSERVED_0_TO_30',
      durationMs:963949,observedUntilMs:963949},
    {...baseContext(),mapId:'140',civilization:'RAW_AOE2_CIV_5',
      civilizationOpportunityKey:'BUILD_185872_CIV_5',durationFamily:'OBSERVED_30_TO_60',
      durationMs:1976299,observedUntilMs:1976299},
    {...baseContext(),mapId:'9',civilization:'RAW_AOE2_CIV_1',
      civilizationOpportunityKey:'BUILD_185872_CIV_1',durationFamily:'OBSERVED_30_TO_60',
      durationMs:2412551,observedUntilMs:2412551},
  ];
  const c=config();
  for(const context of contexts){
    c.anchors[key(context)]=Object.fromEntries(axisNames.map(axis=>[axis,{
      lower:0,upper:1,comparisonGroup:personalityComparisonGroup(context)}]));
    c.availableMilitaryFamilies[context.civilizationOpportunityKey]=['infantry','archers','cavalry'];
  }
  const games=contexts.map((context,i)=>game(i+1,{context}));
  // Synthetic command episodes must fit within the shortest observed interval.
  games[0].statistics.military.engagements.raidEvidence.initiatedEpisodes[1].startedAtMs=900100;
  const result=projectPersonalityPreview('playerA',games,c);
  assert.equal(new Set(games.map(g=>key(g.context))).size,3);
  assert.equal(new Set(games.map(g=>personalityComparisonGroup(g.context))).size,1);
  assert.equal(result.battles.length,3);
  for(const axis of axisNames){
    assert.equal(slider(result,axis).status,'READY',axis);
    assert.equal(slider(result,axis).independentBattles,3,axis);
  }
  assert.equal(slider(result,'BOOMER_AGGRESSOR').value,30);
  assert.equal(slider(result,'CAUTIOUS_BOLD').value,50);
  assert.equal(slider(result,'COMPACT_EXPANSIVE').value,33.33);
  // Missing one civilization-specific opportunity affects its own axis,
  // not source-backed economic, spatial and command components.
  delete c.availableMilitaryFamilies.BUILD_185872_CIV_5;
  const developing=projectPersonalityPreview('playerA',games.slice(0,2),c);
  assert.equal(slider(developing,'SPECIALIST_IMPROVISER').value,null);
  assert.equal(slider(developing,'BOOMER_AGGRESSOR').status,'READY');
  assert.equal(slider(developing,'GUERRILLA_FRONTLINE').status,'READY');
});
test('two differently classified Games in one Battle remain one opportunity after normalization',()=>{
  const first=game(),second={...game(),gameId:'other-game',gameNumber:2,
    sourceHash:hex(701),sourceAuthority:hex(702),mappingDigest:hex(703),
    context:{...baseContext(),mapId:'140',civilization:'OTHER_CIV',
      civilizationOpportunityKey:'OTHER_CIV_OPPORTUNITY',durationFamily:'DIFFERENT'}};
  const c=config();
  c.availableMilitaryFamilies.OTHER_CIV_OPPORTUNITY=['infantry','archers','cavalry'];
  c.anchors[key(second.context)]=Object.fromEntries(axisNames.map(axis=>[axis,{
    lower:0,upper:1,comparisonGroup:personalityComparisonGroup(second.context)}]));
  const projected=projectPersonalityPreview('playerA',[first,second,game(2)],c);
  assert.equal(projected.battles.length,2);
  assert.deepEqual(projected.battles[0].gameIds,['game-1','other-game']);
  for(const axis of axisNames)assert.equal(slider(projected,axis).status,'READY',axis);
  // Never average raw fractions whose context-specific calibration bounds differ.
  c.anchors[key(second.context)].BOOMER_AGGRESSOR={lower:.1,upper:.9,
    comparisonGroup:personalityComparisonGroup(second.context)};
  const mismatch=projectPersonalityPreview('playerA',[first,second,game(2)],c);
  assert.equal(slider(mismatch,'BOOMER_AGGRESSOR').value,null);
  assert.equal(slider(mismatch,'CAUTIOUS_BOLD').status,'READY');
});
test('special Nomad or Migration-like starts are separate, but do not erase ordinary-sample progress',()=>{
  const a=game(),b=game(2),c=config();
  const special=game(3,{context:{...baseContext(),mapId:'migration-scenario',
    startFamily:'CUSTOM',civilization:'WATER_CIV'}});
  const nomad=game(4,{context:{...baseContext(),mapId:'nomad-scenario',
    startFamily:'NOMAD'}});
  for(const item of [special,nomad]){
    c.anchors[key(item.context)]=Object.fromEntries(axisNames.map(axis=>[axis,{
      lower:0,upper:1,comparisonGroup:personalityComparisonGroup(item.context)}]));
  }
  const ordinaryGroup=personalityComparisonGroup(a.context);
  assert.notEqual(ordinaryGroup,personalityComparisonGroup(special.context));
  assert.notEqual(ordinaryGroup,personalityComparisonGroup(nomad.context));
  const out=projectPersonalityPreview('playerA',[a,b,special,nomad],c);
  for(const axis of axisNames){
    assert.equal(slider(out,axis).status,'READY',axis);
    assert.equal(slider(out,axis).independentBattles,2,axis);
    assert.ok(slider(out,axis).reasons.includes('OTHER_START_OR_MODE_CONTEXT_NOT_AGGREGATED'));
    assert.equal(slider(out,axis).contextKey,ordinaryGroup);
  }
  const insufficient=projectPersonalityPreview('playerA',[a,special,nomad],c);
  for(const axis of axisNames){
    assert.equal(slider(insufficient,axis).value,null,axis);
    assert.equal(slider(insufficient,axis).status,'CONTEXT_LIMITED',axis);
  }
});
