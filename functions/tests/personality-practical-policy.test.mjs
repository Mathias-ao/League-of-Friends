import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PRACTICAL_POLICY as spec,PRACTICAL_POLICY_BYTES,PRACTICAL_POLICY_SHA256} from '../lib/engines/personalityV1/practicalPolicyResource.js';
import {createPracticalPersonalityPolicy,practicalPolicyApproval,loadPracticalPersonalityRuntime,PRACTICAL_RUNTIME_PATH} from '../lib/engines/personalityV1/practicalPolicy.js';
import {measurePersonalityGame,projectPersonalityPreview} from '../lib/engines/personalityV1/personalityV1.js';
import {projectPrivatePersonalityHistory} from '../lib/integration/personalityHistory.js';
import {projectLivePersonalityEvidence} from '../lib/engines/personalityV1/liveEvidence.js';
import {evaluatePlaystyleProfile} from '../lib/engines/playstyleEngine.js';
import {sourceItem,review,policy,battle,owner,runtimeRecord,hash} from './support/practical-personality-fixture.mjs';
import {ready} from './support/private-history-fixture.mjs';
import {readMyPersonalityHistory} from '../lib/queries/getMyPersonalityHistory.js';

const project=(items,p=policy(items))=>projectPrivatePersonalityHistory(owner,items.map(battle),hash('input'),p.context,p.calibration);
const axis=(candidate,id)=>candidate.personalityProfile.sliders.find(a=>a.axis===id);
const game=(item,p)=>({battleId:item.source.battleId,matchId:item.source.matchId,gameId:item.source.gameId,gameNumber:1,
 playerId:owner,replaySlot:1,sourceHash:item.source.sourceHash,sourceAuthority:item.source.authorityRevision,mappingDigest:item.source.mappingDigest,
 authorityRevision:1,sourceStatus:'READY',outcome:'PENDING',admitted:true,episodeChronologyComplete:true,playedAtMs:100,
 context:p.context(item),statistics:item.statistics.participants[0]});

test('canonical immutable policy bytes bind actual owner decision and all approved rules',()=>{
 assert.equal(createHash('sha256').update(PRACTICAL_POLICY_BYTES).digest('hex'),PRACTICAL_POLICY_SHA256);
 assert.equal(Buffer.byteLength(PRACTICAL_POLICY_BYTES),3562);assert.ok(PRACTICAL_POLICY_BYTES.endsWith('\n'));
 assert.match(spec.approvalRef,/7097019706$/);assert.equal(spec.status,'APPROVED');assert.equal(spec.runtimeAuthorization,'SEPARATE_D_REQUIRED');
 assert.equal(Object.keys(spec.axes).length,5);assert.equal(spec.axes.CAUTIOUS_BOLD.minimumClassifiedObservations,4);
 assert.equal(spec.axes.GUERRILLA_FRONTLINE.minimumIndependentEpisodes,2);assert.equal(spec.axes.COMPACT_EXPANSIVE.minimumCombinedUnits,6);
 assert.equal(spec.aggregation.careerWeight,.75);assert.equal(spec.aggregation.recentBattles,3);
 assert.equal(spec.presentation.minimumDistinctOriginalGames,3);assert.equal(spec.presentation.minimumCompleteCanonicalBattles,3);
 assert.equal(spec.presentation.minimumComparableBattlesPerAxis,2);assert.equal(spec.effects.publicPersonality,false);
 assert.throws(()=>{spec.aggregation.careerWeight=.5;},TypeError);
});

test('all five approved formulas qualify independently, including measured zeros and available unchosen families',()=>{
 const items=[1,2,3].map(sourceItem),p=policy(items),out=project(items,p);
 const values=Object.fromEntries(out.personalityProfile.sliders.map(a=>[a.axis,a.value]));
 assert.equal(values.BOOMER_AGGRESSOR,100*4/13);assert.equal(values.CAUTIOUS_BOLD,25);
 assert.equal(values.GUERRILLA_FRONTLINE,0);assert.equal(values.SPECIALIST_IMPROVISER,0);assert.equal(values.COMPACT_EXPANSIVE,100*(1/3));
 assert.equal(out.personalityProfile.policy.approvalRef,spec.approvalRef);
 assert.ok(Object.isFrozen(p.calibration));assert.equal(practicalPolicyApproval({...p.calibration}),null,'an APPROVED label is not trusted approval');
 items[0].statistics.participants[0].military.composition={infantry:2,archers:2,cavalry:0};
 const f=measurePersonalityGame(game(items[0],p),p.calibration).features.SPECIALIST_IMPROVISER;
 assert.equal(f.fraction,Math.log(2)/Math.log(3),'unchosen available alternative is in K');
});

test('source/build/catalog applicability is independent from unpriced==0 and unrelated spatial/family axes',()=>{
 const item=sourceItem(),r=review(item);delete r.costCatalog;
 const p=createPracticalPersonalityPolicy(owner,[item],{[item.source.sourceHash]:r});
 let f=measurePersonalityGame(game(item,p),p.calibration).features;
 assert.equal(f.BOOMER_AGGRESSOR.fraction,null);assert.equal(f.BOOMER_AGGRESSOR.reason,'EXACT_SOURCE_COST_CATALOG_UNVERIFIED');
 assert.equal(f.CAUTIOUS_BOLD.fraction,.25);assert.equal(f.COMPACT_EXPANSIVE.fraction,1/3);
 item.statistics.matchFacts.source.gameBuild=188329;
 const old=review(item);old.gameBuild=188329;old.spatial.gameBuild=188329;old.costCatalog.gameBuild=185872;
 const newer=createPracticalPersonalityPolicy(owner,[item],{[item.source.sourceHash]:old});
 f=measurePersonalityGame(game(item,newer),newer.calibration).features;
 assert.equal(f.BOOMER_AGGRESSOR.fraction,null,'known IDs/zero unpriced with old-build catalogue cannot qualify');
 assert.equal(f.CAUTIOUS_BOLD.fraction,null,'same raw strategic ID is not proof for another build');
});

test('B4/E6 floors apply before each required Game mean; duplicate evidence and absent opportunities fail closed',()=>{
 const a=sourceItem(1),b=sourceItem(2);b.source.battleId=b.source.matchId=a.source.battleId;b.source.gameId='g2';b.game.gameNumber=2;
 const p=policy([a,b]);let f=measurePersonalityGame(game(a,p),p.calibration).features;
 assert.equal(f.CAUTIOUS_BOLD.denominator,4);assert.equal(f.COMPACT_EXPANSIVE.denominator,6);
 const stats=b.statistics.participants[0];stats.mapPresence.buildingSectors.evidence.pop();stats.mapPresence.buildingSectors.classifiedPlacementCount=3;
 stats.mapPresence.expansionZones.eligibleBuildingPlacementsInsideHomeRadius=3;
 const series={battleId:a.source.battleId,gameIds:['g1','g2'],gameManifestComplete:true,sources:[a,b]};
 const result=projectPrivatePersonalityHistory(owner,[series],hash('series'),p.context,p.calibration);
 assert.equal(result.battleFeatures.find(x=>x.featureId==='CAUTIOUS_BOLD').numerator,null);
 assert.equal(result.battleFeatures.find(x=>x.featureId==='COMPACT_EXPANSIVE').numerator,null);
 assert.equal(result.battleFeatures.find(x=>x.featureId==='BOOMER_AGGRESSOR').denominator,1);
 const zones=a.statistics.participants[0].mapPresence.expansionZones;zones.zones[1].zoneId=zones.zones[0].zoneId;
 assert.equal(measurePersonalityGame(game(a,p),p.calibration).features.COMPACT_EXPANSIVE.fraction,null);
 const missing=review(a);delete missing.militaryFamilies;delete missing.commandAttribution;
 const absent=createPracticalPersonalityPolicy(owner,[a],{[a.source.sourceHash]:missing});f=measurePersonalityGame(game(a,absent),absent.calibration).features;
 assert.equal(f.SPECIALIST_IMPROVISER.fraction,null);assert.equal(f.GUERRILLA_FRONTLINE.fraction,null);
});

test('command attribution rejects source overlap, self-target, reversed clock and missing hydrated chronology',()=>{
 for(const mutate of [
  s=>{s.military.engagements.raidEvidence.initiatedEpisodes[1].sourceEventIds=['raid-1'];},
  s=>{s.military.engagements.raidEvidence.initiatedEpisodes[1].victimPlayerId=1;},
  s=>{s.military.engagements.raidEvidence.initiatedEpisodes[1].endedAtMs=1;},
 ]){const item=sourceItem(),p=policy([item]);mutate(item.statistics.participants[0]);
  assert.equal(measurePersonalityGame(game(item,p),p.calibration).features.GUERRILLA_FRONTLINE.fraction,null);}
 const item=sourceItem(),p=policy([item]),g=game(item,p);g.episodeChronologyComplete=false;
 assert.equal(measurePersonalityGame(g,p.calibration).features.GUERRILLA_FRONTLINE.fraction,null);
});

test('full precision stays in the sole evaluator; legacy omitted and false outputs are identical',()=>{
 const rules={ruleVersion:'PRECISION_TEST',sliders:[{sliderId:'x',leftLabel:'L',rightLabel:'R',minimumAvailableComponents:1,requireAllComponents:true,
  components:[{metricId:'x',weight:1,direction:'RIGHT'}]}]},metrics=[{metricId:'x',value:100*4/13,samples:3,sourceVersion:'TEST'}];
 const call=options=>evaluatePlaystyleProfile(owner,'CAREER',metrics,rules,options);
 assert.deepEqual(call(),call({preservePrecision:false}));assert.equal(call().sliders[0].value,30.77);
 assert.equal(call({preservePrecision:true}).sliders[0].value,100*4/13);
 assert.equal(call({preservePrecision:true}).sliders[0].components[0].directedValue,100*4/13);
 const items=[1,2,3,4,5].map(sourceItem);items.forEach((x,i)=>{x.statistics.participants[0].military.militarySpend.resources=[1,2,4,8,12][i];});
 const candidate=project(items);assert.equal(axis(candidate,'BOOMER_AGGRESSOR').value,.75*(100*4/13)+.25*(100*8/13));
});

test('raw measurement count cannot authorize incompatible groups; current correction and incomplete series retract only affected values',()=>{
 const items=[1,2,3].map(sourceItem),p=policy(items),out=project(items,p),unlock={status:'UNLOCKED',eligibleGames:3};
 const prof=structuredClone(out.personalityProfile);prof.sliders.find(x=>x.axis==='CAUTIOUS_BOLD').independentBattles=1;
 prof.sliders.find(x=>x.axis==='CAUTIOUS_BOLD').coverage.missing=['INCOMPATIBLE_CONTEXT_COMPARISON_GROUPS'];
 const live=projectLivePersonalityEvidence(owner,items.map(battle),unlock,out.battleFeatures,prof,true);
 assert.equal(live.axes.find(x=>x.axis==='CAUTIOUS_BOLD').value,null);assert.equal(live.axes.find(x=>x.axis==='CAUTIOUS_BOLD').comparableBattles,1);
 assert.ok(live.axes.find(x=>x.axis==='CAUTIOUS_BOLD').reasons.includes('INCOMPATIBLE_CONTEXT_COMPARISON_GROUPS'));
 assert.equal(live.axes.find(x=>x.axis==='BOOMER_AGGRESSOR').value,100*4/13);
 items[0].source.mappingDigest=hash('corrected');const revised=project(items,p);
 assert.equal(axis(revised,'BOOMER_AGGRESSOR').independentBattles,2);assert.notEqual(revised.personalityProfile.projectionRevision,out.personalityProfile.projectionRevision);
 const b=items.map(battle);b[0].gameIds.push('missing-sibling');
 const missing=projectLivePersonalityEvidence(owner,b,unlock,out.battleFeatures,out.personalityProfile,true);
 assert.equal(missing.qualifiedBattles,2);assert.ok(missing.axes.every(x=>x.value===null));
});

test('fixed runtime resolver defaults closed, rejects owner-policy ref as deployment approval, and detects revocation',async()=>{
 const f=await ready(),env={...f.input.env,AOF_PERSONALITY_PRIVATE_POLICY:'practical-v1'};
 assert.equal(await loadPracticalPersonalityRuntime(f.db,f.input.env),null);
 await assert.rejects(loadPracticalPersonalityRuntime(f.db,env),/runtime authorization/);
 const rec=runtimeRecord(env.GCLOUD_PROJECT);f.rows.set(PRACTICAL_RUNTIME_PATH,rec);
 const loaded=await loadPracticalPersonalityRuntime(f.db,env);assert.ok(loaded);
 rec.runtimeApprovalRef=spec.approvalRef;await assert.rejects(loadPracticalPersonalityRuntime(f.db,env),/runtime authorization/);
 await assert.rejects(f.db.runTransaction(loaded.revalidate),/approval changed/);
 f.rows.set(PRACTICAL_RUNTIME_PATH,runtimeRecord(env.GCLOUD_PROJECT));
 await assert.rejects(loadPracticalPersonalityRuntime(f.db,{...env,FUNCTIONS_EMULATOR:'false',GCLOUD_PROJECT:'production'}),/runtime authorization/);
});

test('actual private history preserves disabled truthful counts and fences runtime changes and membership loss',async()=>{
 const f=await ready(),plain=await f.read();assert.equal(plain.numericalPolicy.runtime,'DISABLED');assert.equal(plain.coverage.currentSources,1);
 for(const mutation of [f=>{f.rows.get(PRACTICAL_RUNTIME_PATH).revision++;},f=>{f.rows.get('players/p1').membershipStatus='SUSPENDED';}]){
  const f=await ready(),input={...f.input,env:{...f.input.env,AOF_PERSONALITY_PRIVATE_POLICY:'practical-v1'}};
  f.rows.set(PRACTICAL_RUNTIME_PATH,runtimeRecord(input.env.GCLOUD_PROJECT));
  const original=f.db.doc;let injected=false;
  f.db.doc=path=>{const ref=original(path);return path!==PRACTICAL_RUNTIME_PATH?ref:{...ref,get:async()=>{
   const snap=await ref.get();if(!injected){injected=true;mutation(f);}return snap;}};};
  await assert.rejects(readMyPersonalityHistory(input),/approval changed|Active linked membership/);
 }
 const nonmember=await ready();nonmember.rows.get('authLinks/owner').playerId='p2';await assert.rejects(nonmember.read(),/Active linked membership/);
 await assert.rejects(readMyPersonalityHistory({...f.input,request:{playerId:'p2'}}),/accepts no player/);
});
