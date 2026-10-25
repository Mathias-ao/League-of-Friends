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
  assert.equal(ffa.source.gameBuild,180059);
  assert.equal(ffa.source.sha256,'ab947d934bbd4fa4e2531f4f8a5014f9b923038a34aa7332d7260eb78fb3fab5');
  assert.equal(corpus.reports.find(r=>r.id==='user-ffa-diplo-save68.9').observedUntilMs,ffa.durationMs);
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
