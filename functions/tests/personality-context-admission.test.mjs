import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {admitPersonalityContext,personalityContextForHistory,
  PERSONALITY_CONTEXT_ADAPTER_VERSION,PERSONALITY_CONTEXT_PROOF_VERSION}
  from '../lib/engines/personalityV1/contextAdmission.js';
import {projectPersonalityPreview,buildPersonalityBattles}
  from '../lib/engines/personalityV1/personalityV1.js';

const sha=n=>n.toString(16).padStart(64,'0');
const read=(name)=>JSON.parse(readFileSync(new URL('../../'+name,import.meta.url),'utf8'));
const duel=read('replay-tools/tests/goldens/upstream-duel-save66.6.json');
const ffa=read('replay-tools/tests/goldens/user-ffa-diplo-save68.9.json');
const two=read('replay-fixtures/townbell-analyses/2v2_townbell.json');
const four=read('replay-fixtures/townbell-analyses/4v4_townbell.json');
const corpus=read('replay-tools/tests/goldens/statistics-corpus-v1.json');
const original=(count=2,mode='ONE_V_ONE',attrs={})=>{
  const teams=mode==='TWO_V_TWO'?2:mode==='FOUR_V_FOUR'?4:1;
  const roster=Array.from({length:count},(_,i)=>({playerId:'owner-'+(i+1),replaySlot:i+1,teamId:null}));
  const players=roster.map((p,i)=>({playerId:p.playerId,team:Math.floor(i/teams)+1}));
  const ctx={source:{contract:'AOF_SOCIAL_V1_SHARED_1',matchId:'match1',battleId:'match1',
      gameId:'g1',roster,sourceHash:sha(100),authorityRevision:sha(200),
      mappingDigest:sha(300),statisticsRevision:1,outcome:{qualification:'OFFICIAL'}},
    match:{id:'match1',format:mode,opponentKind:'HUMAN'},
    game:{id:'g1',gameNumber:1,players,matchId:'match1'},
    statistics:{scope:{observedUntilMs:2400000},
      matchFacts:{
        modelVersion:'AOF_RECORDING_MATCH_FACTS_V1',identityNamespace:'CANONICAL_REPLAY_PLAYER_ID',
        source:{replaySha256:sha(100),gameBuild:180059},
        game:{observedDurationMs:2400000,durationMeaning:'observed_recording_interval_not_proven_full_game'},
        map:{id:149},rules:{
          mapId:{value:149,status:'DECODED'},
          startingAgeId:{value:0,status:'DECODED'},
          startingResourcesId:{value:0,status:'DECODED'}},
        players:roster.map(p=>({playerId:p.replaySlot,replaySlot:p.replaySlot,
          civilization:{rawId:p.replaySlot+1}})),
        diplomacy:{effectiveRuntimeStateQualified:false}},
      participants:roster.map(p=>({playerId:p.replaySlot,replaySlot:p.replaySlot,
        mapPresence:{homeAnchor:{method:'initial_town_center'}}}))}
  };
  return {...ctx,...attrs};
};
const proof=(x=original())=>({
  version:PERSONALITY_CONTEXT_PROOF_VERSION,status:'REVIEWED_SOURCE_CLASSIFICATION',
  referenceId:'synthetic-reviewed-exact-source-test',sourceHash:x.source.sourceHash,
  gameBuild:x.statistics.matchFacts.source.gameBuild,mapId:149,
  startingAgeId:0,startingResourcesId:0,mapFamily:'LAND',startFamily:'STANDARD',
  durationBucket:{id:'TEST_ONLY_OBSERVED_DURATION',lowerObservedMs:0,
    upperObservedMsExclusive:3600000,meaning:'OBSERVED_RECORDING_INTERVAL_ONLY'}
});
const admit=(x=original(),p=null,subject='owner-1')=>admitPersonalityContext(x,subject,p);

test('versioned pure hook: no fabricated map family, ordinary start or clock bucket',()=>{
  const x=original(),r=admit(x);
  assert.equal(r.version,PERSONALITY_CONTEXT_ADAPTER_VERSION);
  assert.equal(r.status,'PENDING');assert.equal(r.context,null);
  assert.equal(r.fields.format.value,'ONE_V_ONE');
  assert.equal(r.fields.mapId.value,'149');
  assert.equal(r.fields.civilization.value,'RAW_AOE2_CIV_2');
  assert.equal(r.fields.civilizationOpportunityKey.value,'BUILD_180059_CIV_2');
  assert.equal(r.fields.durationMs.value,2400000);
  assert.equal(r.fields.observedUntilMs.value,2400000);
  assert.equal(r.fields.mapFamily.value,null);
  assert.equal(r.fields.startFamily.value,null);
  assert.equal(r.fields.durationFamily.value,null);
  assert.equal(r.fields.dynamicDiplomacyQualified.value,false,'false is observed, not missing');
  assert.equal(personalityContextForHistory(x,'owner-1'),null);
  assert.equal(admit(x,proof(x)).status,'ADMITTED');
  assert.equal(personalityContextForHistory(x,'owner-1',proof(x)).startFamily,'STANDARD');
});
test('real 1v1/team/FFA recordings preserve raw observed clocks and settings only',()=>{
  // These are retained genuine recording-derived goldens and TownBell public
  // benchmark metadata. The league binding/proof objects above are SYNTHETIC;
  // benchmark map names and water ratios are NOT authoritative classifications.
  assert.equal(duel.playerCount,2);assert.equal(duel.source.gameBuild,158041);
  assert.equal(duel.durationMs,2220129);assert.equal(duel.map.width,120);
  assert.equal(duel.source.sha256,'dc1a630ea33b197703f70fab0386b476d02b5bdd43916ec012f971ef580d3985');
  assert.equal(two.meta.settings.rms_map_id,149);
  assert.equal(two.meta.settings.starting_age_id,0);
  assert.equal(two.meta.settings.starting_resources_id,0);
  assert.equal(two.meta.duration_ms,2003471);
  assert.equal(Object.keys(two.players).length,4);
  assert.equal(four.meta.settings.rms_map_id,17);
  assert.equal(four.meta.duration_ms,3295040);
  assert.equal(Object.keys(four.players).length,8);
  assert.equal(ffa.playerCount,8);
  assert.equal(ffa.durationMs,5703316);
  assert.equal(ffa.source.gameBuild,185872);
  assert.equal(ffa.source.sha256,'ab947d934bbd4fa4e2531f4f8a5014f9b923038a34aa7332d7260eb78fb3fab5');
  assert.equal(corpus.reports.find(r=>r.id==='user-ffa-diplo-save68.9').observedUntilMs,ffa.durationMs);
});
test('real team and duel metadata feed the source-field adapter without manufactured classification',()=>{
  // Synthetic current Match/SourceSnapshot envelopes exercise the *pure adapter*.
  // Numeric fields below come unchanged from genuine retained recording reports;
  // they are NOT historical league auth, source-authorized pole labels or rules.
  for(const [report,format,count] of [[two,'TWO_V_TWO',4],[four,'FOUR_V_FOUR',8]]){
    const x=original(count,format);
    x.statistics.matchFacts.source.gameBuild=report.meta.game_build;
    x.statistics.matchFacts.map.id=report.meta.settings.rms_map_id;
    x.statistics.matchFacts.rules.mapId.value=report.meta.settings.rms_map_id;
    x.statistics.matchFacts.rules.startingAgeId.value=report.meta.settings.starting_age_id;
    x.statistics.matchFacts.rules.startingResourcesId.value=report.meta.settings.starting_resources_id;
    x.statistics.scope.observedUntilMs=report.meta.duration_ms;
    x.statistics.matchFacts.game.observedDurationMs=report.meta.duration_ms;
    for(const p of x.statistics.matchFacts.players)delete p.civilization.rawId;
    const a=admit(x);
    assert.equal(a.fields.format.value,'TEAM');
    assert.equal(a.fields.mapId.value,String(report.meta.settings.rms_map_id));
    assert.equal(a.fields.durationMs.value,report.meta.duration_ms);
    assert.equal(a.fields.civilizationOpportunityKey.value,null);
    assert.equal(a.fields.mapFamily.value,null);
    assert.equal(a.status,'PENDING');
  }
  const x=original(2,'ONE_V_ONE');
  x.source.sourceHash=duel.source.sha256;
  x.statistics.matchFacts.source.replaySha256=duel.source.sha256;
  x.statistics.matchFacts.source.gameBuild=duel.source.gameBuild;
  x.statistics.scope.observedUntilMs=duel.durationMs;
  x.statistics.matchFacts.game.observedDurationMs=duel.durationMs;
  x.statistics.matchFacts.rules.mapId={value:null,status:'UNKNOWN'};
  for(const p of x.statistics.matchFacts.players)delete p.civilization.rawId;
  const d=admit(x);
  assert.equal(d.fields.format.value,'ONE_V_ONE');
  assert.equal(d.fields.observedUntilMs.value,duel.durationMs);
  assert.equal(d.fields.civilizationOpportunityKey.value,null);
  assert.equal(d.fields.mapId.value,null);
  assert.equal(d.context,null);
  const free=original(8,'FFA');
  free.source.sourceHash=ffa.source.sha256;
  free.statistics.matchFacts.source.replaySha256=ffa.source.sha256;
  free.statistics.matchFacts.source.gameBuild=ffa.source.gameBuild;
  free.statistics.scope.observedUntilMs=ffa.durationMs;
  free.statistics.matchFacts.game.observedDurationMs=ffa.durationMs;
  free.statistics.matchFacts.rules.mapId={status:'UNKNOWN',value:null};
  for(const p of free.statistics.matchFacts.players)delete p.civilization.rawId;
  const f=admit(free);
  assert.equal(f.fields.format.value,'FFA');
  assert.equal(f.fields.durationMs.value,ffa.durationMs);
  assert.equal(f.fields.dynamicDiplomacyQualified.value,false);
  assert.equal(f.fields.mapFamily.value,null);
  assert.equal(f.context,null);
});

test('1v1/team/FFA mode requires current league topology and source-bound complete roster',()=>{
  const v1=original(2,'ONE_V_ONE'),v2=original(4,'TWO_V_TWO'),v4=original(8,'FOUR_V_FOUR'),
    free=original(8,'FFA');
  for(const [x,want] of [[v1,'ONE_V_ONE'],[v2,'TEAM'],[v4,'TEAM'],[free,'FFA']]){
    const r=admit(x);assert.equal(r.fields.format.value,want);
    assert.equal(r.status,'PENDING','unreviewed geometry and starts stay Pending');
  }
  const fakeTeam=structuredClone(v2);fakeTeam.game.players[0].team=2;
  assert.equal(admit(fakeTeam).fields.format.value,null);
  const badRoster=structuredClone(v2);badRoster.source.roster[1].playerId='owner-1';
  assert.equal(admit(badRoster).fields.format.value,null);
  const duplicateGameRoster=structuredClone(v2);duplicateGameRoster.game.players[1].playerId='owner-1';
  assert.equal(admit(duplicateGameRoster).fields.format.value,null);
  const invalidOrdinal=structuredClone(v2);invalidOrdinal.game.gameNumber=0;
  assert.equal(admit(invalidOrdinal).status,'PENDING');
  const wrong=original(8,'ONE_V_ONE');
  assert.equal(admit(wrong).fields.format.value,null);
  const fakeResult=structuredClone(free);fakeResult.source.outcome.qualification='UNRESOLVED';
  assert.equal(admit(fakeResult).fields.format.value,null);
});
test('FFA diplomacy uncertainty remains explicit false and never proves combat/alliances',()=>{
  const x=original(8,'FFA'),p=proof(x);
  const result=admit(x,p);
  assert.equal(result.context.dynamicDiplomacyQualified,false);
  assert.equal(result.fields.dynamicDiplomacyQualified.status,'SOURCE_VERIFIED');
  assert.ok(result.context);
  assert.ok(!JSON.stringify(result).includes('confirmed_combat'));
  const unknown=structuredClone(x);delete unknown.statistics.matchFacts.diplomacy.effectiveRuntimeStateQualified;
  assert.equal(admit(unknown,p).fields.dynamicDiplomacyQualified.value,null);
  assert.equal(admit(unknown,p).status,'PENDING');
});
test('reviewed classification must bind exact source, build, map ID, start and recorded interval',()=>{
  const x=original(),p=proof(x);
  for(const change of [
    q=>{q.sourceHash=sha(999);},q=>{q.gameBuild=185872;},
    q=>{q.mapId=17;},q=>{q.startingAgeId=1;},
    q=>{q.startingResourcesId=1;},
    q=>{q.durationBucket.upperObservedMsExclusive=1000;},
    q=>{q.durationBucket.meaning='FULL_GAME_CONFIRMED';},
    q=>{q.referenceId='';}
  ]){
    const broken=structuredClone(p);change(broken);
    assert.equal(admit(x,broken).status,'PENDING');
  }
  const incomplete=structuredClone(x);
  delete incomplete.statistics.participants[0].mapPresence.homeAnchor;
  assert.equal(admit(incomplete,proof(incomplete)).fields.startFamily.value,null);
});
test('no raw ID means no inferred map identity, and no build means no inferred civ opportunity',()=>{
  const x=original();
  x.statistics.matchFacts.rules.mapId.status='UNKNOWN';
  assert.equal(admit(x).fields.mapId.value,null);
  const y=original();
  y.statistics.matchFacts.map.id=17;
  assert.equal(admit(y).fields.mapId.value,null);
  const z=original();
  z.statistics.matchFacts.source.gameBuild=null;
  assert.equal(admit(z).fields.civilizationOpportunityKey.value,null);
  assert.equal(admit(z).fields.civilization.value,null);
  const owner=original();
  assert.equal(admit(owner,null,'unknown-player').fields.civilization.value,null);
  const conflict=original();conflict.statistics.matchFacts.headerFieldCandidates={'de.rms_map_id':17};
  assert.equal(admit(conflict,proof(conflict)).fields.mapId.value,null);
  const patchConflict=original();patchConflict.statistics.matchFacts.headerFieldCandidates={'de.build':185872};
  assert.equal(admit(patchConflict).fields.civilizationOpportunityKey.value,null);
  const startConflict=original();startConflict.statistics.matchFacts.headerFieldCandidates={'de.starting_age_id':1};
  assert.equal(admit(startConflict,proof(startConflict)).fields.startFamily.value,null);
  const noCiv=original();delete noCiv.statistics.matchFacts.players[0].civilization.rawId;
  assert.equal(admit(noCiv).fields.civilizationOpportunityKey.value,null);
  const upgraded=original();upgraded.statistics.matchFacts.modelVersion='AOF_RECORDING_MATCH_FACTS_V2';
  assert.equal(admit(upgraded,proof(upgraded)).status,'PENDING');
});
test('observed duration is not whole-game completion, null clocks never become observed zero',()=>{
  const x=original();
  x.statistics.scope.observedUntilMs=null;
  assert.equal(admit(x,proof(x)).fields.durationMs.value,null);
  const y=original();
  y.statistics.matchFacts.game.observedDurationMs=0;
  assert.equal(admit(y,proof(y)).fields.observedUntilMs.value,null);
  const truncated=original();
  truncated.statistics.scope.observedUntilMs=900000;
  assert.equal(admit(truncated,proof(truncated)).context,null);
  const metadata=original();
  metadata.statistics.matchFacts.game.durationMeaning='confirmed_whole_game';
  assert.equal(admit(metadata,proof(metadata)).fields.durationMs.value,null);
});
test('source correction, map update, roster remap and Game source disagreement invalidate proof',()=>{
  const x=original(),p=proof(x);
  const originalDigest=admit(x,p).provenanceDigest;
  const replacement=structuredClone(x);replacement.source.sourceHash=sha(666);
  replacement.source.authorityRevision=sha(667);
  replacement.statistics.matchFacts.source.replaySha256=sha(666);
  assert.equal(admit(replacement,p).status,'PENDING');
  assert.notEqual(admit(replacement,p).provenanceDigest,originalDigest);
  const remap=structuredClone(x);
  remap.source.roster[0].replaySlot=2;remap.source.roster[1].replaySlot=1;
  remap.source.mappingDigest=sha(668);
  assert.equal(admit(remap,p).fields.civilization.value,'RAW_AOE2_CIV_3');
  assert.notEqual(admit(remap,p).provenanceDigest,originalDigest);
  const mismatch=structuredClone(x);mismatch.statistics.matchFacts.source.replaySha256=sha(777);
  assert.equal(admit(mismatch,p).status,'PENDING');
  const dispute=structuredClone(x);dispute.source.outcome.qualification='UNRESOLVED';
  assert.equal(admit(dispute,p).status,'PENDING');
  const missing=structuredClone(x);delete missing.statistics.matchFacts;
  assert.equal(admit(missing,p).status,'PENDING');
  // Regression for incomplete/older source artifacts: absent, null or malformed
  // facts.players must not throw or borrow a reviewed source proof.
  for(const value of [undefined,null,{},'invalid',[]]){
    const absent=structuredClone(x);
    if(value===undefined)delete absent.statistics.matchFacts.players;
    else absent.statistics.matchFacts.players=value;
    let result;
    assert.doesNotThrow(()=>{result=admit(absent,p);});
    assert.equal(result.status,'PENDING');
    assert.equal(result.context,null);
    assert.equal(result.fields.format.value,null);
    assert.equal(result.fields.civilization.value,null);
    assert.equal(result.fields.civilizationOpportunityKey.value,null);
    assert.equal(result.fields.mapFamily.value,null);
    assert.equal(result.fields.startFamily.value,null);
    assert.equal(result.fields.durationFamily.value,null);
    assert.equal(result.fields.durationMs.value,null);
    assert.ok(result.missing.length>0);
    assert.equal(personalityContextForHistory(absent,'owner-1',p),null);
  }
  const corruptedPlayer=structuredClone(x);
  corruptedPlayer.statistics.matchFacts.players[0]=null;
  assert.doesNotThrow(()=>admit(corruptedPlayer,p));
  assert.equal(admit(corruptedPlayer,p).status,'PENDING');
});
test('same Game ID in two Matches, duplicate POVs and multiple Games remain source-owned identities',()=>{
  const a=original();
  const b=structuredClone(a);b.source.matchId=b.source.battleId=b.match.id=b.game.matchId='match2';
  assert.equal(admit(a).status,'PENDING');assert.equal(admit(b).status,'PENDING');
  assert.notEqual(admit(a).provenanceDigest,admit(b).provenanceDigest);
  const pov=structuredClone(a);pov.source.sourceHash=sha(610);
  pov.source.authorityRevision=sha(611);
  pov.statistics.matchFacts.source.replaySha256=pov.source.sourceHash;
  assert.notEqual(admit(a).provenanceDigest,admit(pov).provenanceDigest);
  const p=proof(a),c=admit(a,p).context;
  const base=(battleId,gameId,gameNumber,sourceHash,revision)=>({
    battleId,matchId:battleId,gameId,gameNumber,playerId:'owner-1',replaySlot:1,
    sourceHash,sourceAuthority:sha(revision+400),mappingDigest:sha(revision+500),
    authorityRevision:revision,sourceStatus:'READY',outcome:'OFFICIAL',admitted:true,
    episodeChronologyComplete:false,playedAtMs:10000,
    context:c,statistics:{playerId:1,replaySlot:1}});
  const originalOne=base('match1','g1',1,sha(1),1),additional=base('match1','g2',2,sha(2),1),
    distinct=base('match2','g1',1,sha(3),1);
  const battles=buildPersonalityBattles([originalOne,structuredClone(originalOne),additional,distinct],null);
  assert.equal(battles.length,2);
  assert.equal(battles.find(b=>b.battleId==='match1').gameIds.length,2);
  const corrected={...originalOne,sourceHash:sha(4),authorityRevision:2};
  const correctedBattles=buildPersonalityBattles([originalOne,corrected,additional,distinct],null);
  assert.notEqual(battles[0].sourceRevision,correctedBattles[0].sourceRevision);
  assert.equal(projectPersonalityPreview('owner-1',[originalOne,additional,distinct],null)
    .sliders.every(s=>s.value===null&&s.status==='DEVELOPING'),true);
  assert.throws(()=>buildPersonalityBattles([originalOne,{...originalOne,sourceHash:sha(8)}],null),
    /CONFLICTING_AUTHORITY_REVISION/);
});

// Controlled adapter envelopes shaped exactly like the two unchanged native
// originals used by personality-original-battles-emulator.mjs. The genuine
// AUTO/callable witness is separate; these are nearest field-level negatives.
function nativeHeaderShape(){
  const x=original(),facts=x.statistics.matchFacts,events=sha(401);
  delete facts.source.gameBuild;facts.source.recordedEventsSha256=events;
  x.source.artifactRefs=[{kind:'RECORDED_EVENTS',digest:events,generation:'7'}];
  facts.headerSource={recordedEventsSha256:events,section:'header.recordingHeader'};
  facts.coverage={headerCandidates:'AVAILABLE'};
  facts.headerFieldCandidates={'de.build':185872,'de.rms_map_id':9,'scenario.map_id':0,
    'de.starting_age_id':0,'de.starting_resources_id':0};
  facts.map={mapId:9};facts.rules.mapId={value:9,status:'DECODED',
    sourcePath:'canonical.match.settings.mapId',meaning:'parser_reported_header_field'};
  const p={...proof(),gameBuild:185872,mapId:9};
  return {x,p};
}
test('current native retained header admits build and DE map while preserving literal legacy scenario zero',()=>{
  const {x,p}=nativeHeaderShape(),r=admit(x,p);
  assert.equal(r.status,'ADMITTED');assert.equal(r.fields.mapId.value,'9');
  assert.equal(r.fields.civilizationOpportunityKey.value,'BUILD_185872_CIV_2');
  assert.equal(x.statistics.matchFacts.headerFieldCandidates['scenario.map_id'],0,'never rewrite retained facts');
  assert.equal(x.statistics.matchFacts.source.gameBuild,undefined,'never manufacture source fields');
  x.statistics.matchFacts.source.gameBuild=null;
  assert.equal(admit(x,p).status,'ADMITTED','explicit null is absent build, not a conflicting value');
  x.source.outcome={qualification:'UNRESOLVED',resultRevision:null,winningPlayerIds:null};
  assert.equal(admit(x,p).status,'ADMITTED','behavior has no invented result requirement');
});
test('legacy map zero needs exact decoded DE/canonical evidence and retained header provenance',()=>{
  for(const change of [
    f=>{f.headerFieldCandidates['scenario.map_id']=17;},
    f=>{f.headerFieldCandidates['scenario.map_id']='0';},
    f=>{f.headerFieldCandidates['de.rms_map_id']=17;},
    f=>{f.headerFieldCandidates['de.rms_map_id']=0;},
    f=>{delete f.headerFieldCandidates['de.rms_map_id'];},
    f=>{f.headerFieldCandidates['de.rms_map_id']='9';},
    f=>{f.map.mapId=17;},f=>{f.map.id=17;},
    f=>{f.rules.mapId.value='9';},f=>{f.rules.mapId.value=0;},f=>{f.rules.mapId.status='UNKNOWN';},
    f=>{delete f.rules.mapId.sourcePath;},f=>{f.rules.mapId.meaning='display_label';},
    f=>{delete f.headerSource;},f=>{f.headerSource.section='untrusted';},
    f=>{f.coverage.headerCandidates='UNAVAILABLE';},
    f=>{f.headerSource.recordedEventsSha256=sha(402);},
    f=>{f.source.recordedEventsSha256=sha(402);},
  ]){
    const {x,p}=nativeHeaderShape();change(x.statistics.matchFacts);
    const r=admit(x,p);assert.equal(r.context,null);assert.equal(r.fields.mapId.value,null);
  }
  const {x,p}=nativeHeaderShape();x.source.artifactRefs[0].digest=sha(403);
  assert.equal(admit(x,p).fields.mapId.value,null);
  for(const refs of [undefined,null,{},[],[null],['invalid']]){
    const {x,p}=nativeHeaderShape();x.source.artifactRefs=refs;
    let r;assert.doesNotThrow(()=>{r=admit(x,p);});assert.equal(r.context,null);
  }
});
test('header build fallback refuses missing provenance, malformed build and explicit canonical conflicts',()=>{
  for(const change of [
    f=>{delete f.headerSource;},f=>{delete f.coverage.headerCandidates;},
    f=>{f.headerSource.recordedEventsSha256=sha(402);},
    f=>{f.source.recordedEventsSha256=sha(402);},
    f=>{delete f.headerFieldCandidates['de.build'];},
    ...[0,-1,1.5,Number.MAX_SAFE_INTEGER+1,'185872',null,{},true].map(value=>f=>{f.headerFieldCandidates['de.build']=value;}),
    ...[0,-1,1.5,'185872',{},true,180059].map(value=>f=>{f.source.gameBuild=value;}),
  ]){
    const {x,p}=nativeHeaderShape();change(x.statistics.matchFacts);
    const r=admit(x,p);assert.equal(r.context,null);assert.equal(r.fields.civilizationOpportunityKey.value,null);
  }
  const noEvents=nativeHeaderShape();noEvents.x.source.artifactRefs=[];
  assert.equal(admit(noEvents.x,noEvents.p).fields.civilizationOpportunityKey.value,null);
  const explicit=nativeHeaderShape();explicit.x.statistics.matchFacts.source.gameBuild=185872;
  assert.equal(admit(explicit.x,explicit.p).status,'ADMITTED');
  explicit.x.statistics.matchFacts.headerFieldCandidates['de.build']=180059;
  assert.equal(admit(explicit.x,explicit.p).fields.civilizationOpportunityKey.value,null);
  const unsupported=nativeHeaderShape();unsupported.p.gameBuild=185873;
  assert.equal(admit(unsupported.x,unsupported.p).behaviorContext,null,'an unreviewed build cannot borrow the pinned source proof');
});

test('native header provenance changes revision the pure admission receipt without changing source identity',()=>{
  const {x,p}=nativeHeaderShape(),before=admit(x,p);
  assert.equal(admit(structuredClone(x),p).provenanceDigest,before.provenanceDigest);
  for(const change of [
    y=>{delete y.statistics.matchFacts.headerSource;},
    y=>{y.statistics.matchFacts.headerSource.recordedEventsSha256=sha(402);},
    y=>{y.statistics.matchFacts.coverage.headerCandidates='UNAVAILABLE';},
    y=>{y.source.artifactRefs[0].digest=sha(402);},
  ]){
    const corrected=structuredClone(x);change(corrected);const after=admit(corrected,p);
    assert.equal(corrected.source.sourceHash,x.source.sourceHash);
    assert.equal(after.context,null);assert.notEqual(after.provenanceDigest,before.provenanceDigest);
  }
});

test('legacy explicit canonical build keeps unavailable header compatibility but rejects a contradictory header',()=>{
  for(const value of [undefined,null]){
    const x=original(),p=proof(x);x.statistics.matchFacts.headerFieldCandidates={'de.build':value};
    assert.equal(admit(x,p).status,'ADMITTED');
    assert.equal(admit(x,p).fields.civilizationOpportunityKey.value,'BUILD_180059_CIV_2');
  }
  for(const value of [0,-1,1.5,'180059',185872]){
    const x=original(),p=proof(x);x.statistics.matchFacts.headerFieldCandidates={'de.build':value};
    assert.equal(admit(x,p).context,null);
    assert.equal(admit(x,p).fields.civilizationOpportunityKey.value,null);
  }
});
