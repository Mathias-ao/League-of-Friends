/** Genuine unchanged replay bytes, controlled authenticated league authority.
 * The same original recorder has TWO approved independent Battles. No source
 * field, context proof, taxonomy, calibration or axis value is injected.
 * The existing INT-B stage separately proves these two originals in ONE Battle
 * remain Developing. This stage is a fresh isolated demo emulator instance.
 */
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {Timestamp} from 'firebase-admin/firestore';
import {getStorage} from 'firebase-admin/storage';
import {db} from '../lib/config/firebase.js';
import {uploadReplay} from '../lib/commands/statistics/uploadReplay.js';
import {getMyPersonalityHistory} from '../lib/queries/getMyPersonalityHistory.js';
import {loadMyCurrentSocialSource} from '../lib/queries/getMySocialExperience.js';
import {digest} from '../lib/engines/nativeRecordingIntegration.js';
import {PRIVATE_PERSONALITY_E2E_VERSION,PRIVATE_SOURCE_TAXONOMY}
  from '../lib/engines/personalityV1/privateE2EPolicy.js';
import {admitPersonalityContext} from '../lib/engines/personalityV1/contextAdmission.js';

const project='demo-aof-native-player';
assert.equal(process.env.GCLOUD_PROJECT,project);assert.equal(process.env.FUNCTIONS_EMULATOR,'true');
for(const key of ['FIRESTORE_EMULATOR_HOST','FIREBASE_STORAGE_EMULATOR_HOST'])assert.match(process.env[key]??'',/^127\.0\.0\.1:\d+$/);
assert.equal(process.env.REPLAY_BUCKET,project+'.appspot.com');assert.equal(new URL(process.env.REPLAY_WORKER_URL).hostname,'127.0.0.1');
assert.equal(Object.keys(PRIVATE_SOURCE_TAXONOMY.militaryFamiliesByExactCiv).length,0,
  'This acceptance must not silently admit a civilization-family opportunity taxonomy.');
const specs=[
  {name:'1v1_t90-dobb',hash:'f4122159245f2374ba90989501869b0f0609f2741144d9723feb6cabba631763',mapId:188,civ:5,slot:2},
  {name:'1v1_t90-deak',hash:'3f2ee71756017332182620ee9f273e249b3fe6bc61222637df26bb7a84d400ef',mapId:9,civ:39,slot:1},
];
const corpus=resolve(process.env.AOF_NATIVE_CORPUS),fixtures=[];
for(const [i,spec] of specs.entries()){
  const bytes=await readFile(resolve(corpus,spec.name+'.aoe2record'));assert.equal(digest(bytes),spec.hash);
  const meta=JSON.parse(await readFile(resolve(corpus,spec.name+'.json'),'utf8')).meta;
  const originalOwner=meta.players.find(p=>p.profile_id===197930);
  assert.equal(originalOwner?.name,'T90Official');assert.equal(originalOwner.number,spec.slot);
  assert.equal(originalOwner.civilization_id,spec.civ);assert.equal(meta.settings.rms_map_id,spec.mapId);
  assert.equal(meta.game_build,185872);assert.equal(meta.players.length,2);
  assert.ok(PRIVATE_SOURCE_TAXONOMY.sourceProofs[spec.hash],'Existing exact-source review is required.');
  fixtures.push({...spec,bytes,meta,matchId:'pers-original-battle-'+(i+1),gameId:'g1',opponent:'pers-original-opponent-'+(i+1)});
}
assert.ok(fixtures[0].meta.played_at_unix<fixtures[1].meta.played_at_unix);
const owner='pers-original-owner',uid='pers-original-owner-uid',outsider='pers-original-outsider';
const req=(authUid,data={})=>({auth:{uid:authUid},data});
const ids=[owner,outsider,...fixtures.map(f=>f.opponent)];
for(const id of ids){
  await db.doc('players/'+id).create({role:'PLAYER',membershipStatus:'ACTIVE',steamName:id,goldBalance:0});
  await db.doc('authLinks/'+(id===owner?uid:id)).create({playerId:id});
}
const seasonId='pers-original-season',eventId='pers-original-event',planId='pers-original-plan';
await db.doc('seasons/'+seasonId).create({status:'ACTIVE'});
await db.doc('events/'+eventId).create({status:'ACTIVE',seasonId,
  startsAt:Timestamp.fromMillis(1700000000000),approvedMatchPlanId:planId,matchPlanStatus:'APPROVED',
  officialMatchIds:fixtures.map(f=>f.matchId),warmupMatchIds:[]});
await db.doc('events/'+eventId+'/matchPlans/'+planId).create({status:'APPROVED',
  officialMatchIds:fixtures.map(f=>f.matchId),matches:fixtures.map(()=>({}))});
for(const [i,f] of fixtures.entries()){
  // Each actual opponent remains a distinct fixture identity. Team sides and
  // participant bindings preserve the original source slots despite POV swap.
  const roster=f.meta.players.map(p=>({playerId:p.profile_id===197930?owner:f.opponent,team:p.number}));
  await db.doc('matches/'+f.matchId).create({status:'ACTIVE',format:'ONE_V_ONE',opponentKind:'HUMAN',participants:roster,
    seriesRule:{maxGames:1,gamesRequiredToWin:1},eventId,seasonId,sourceMatchPlanId:planId,matchNumber:i+1,
    context:{affectsSeasonStats:false,affectsLifetimeStats:false,affectsLeaguePoints:false,affectsGold:false},
    gameConfigSnapshot:{maps:{pool:[f.meta.settings.map_name]},civilizations:{mode:'UNRESTRICTED'},
      victory:{conquest:true,wonder:false,relic:false},diplomacyEnabled:false,additionalSettings:{}}});
  await db.doc('matches/'+f.matchId+'/games/'+f.gameId).create({status:'READY',gameNumber:1,players:roster,
    replayStatisticsRevision:0,activeReplayStatisticsId:null,replayParticipantBindings:f.meta.players.map((p,j)=>({
      playerId:roster[j].playerId,sourceNameNormalized:p.name.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US')}))});
}
Object.assign(process.env,{AOF_NATIVE_PLAYER_UPLOAD:'recorded-events-v1',AOF_NATIVE_REPLAY_PROJECT:project,
  AOF_ACTIVE_NATIVE_PLAYER_READS:'1',AOF_ACTIVE_NATIVE_SOCIAL_READS:'1',
  AOF_NATIVE_PLAYER_UPLOAD_GAME_ALLOWLIST:fixtures.map(f=>f.matchId+'/'+f.gameId).join(','),
  AOF_INT_V1_PRIVATE_READS:'source-v1',AOF_INT_V1_PRIVATE_HISTORY:'battle-v1',AOF_PERSONALITY_PRIVATE_E2E:'source-proposed-v1'});
assert.ok(!process.env.AOF_NATIVE_REPLAY_INTEGRATION&&!process.env.AOF_NATIVE_READY_PUBLICATION);
// Reverse upload order must not become longitudinal order.
for(const f of [...fixtures].reverse()){
  const receipt=await uploadReplay.run(req(uid,{matchId:f.matchId,gameId:f.gameId,fileName:f.name+'.aoe2record',
    replayBase64:f.bytes.toString('base64'),processingMode:'AUTO'}));
  assert.equal(receipt.state,'READY');assert.equal(receipt.sourceHash,f.hash);
}
const read=()=>getMyPersonalityHistory.run(req(uid));
const initial=await read();
assert.equal(initial.ownerPlayerId,owner);assert.equal(initial.coverage.ownBattles,2);
assert.deepEqual(initial.effects,{officialWrites:false,receiptPublication:false,entitlementGrants:false});
if(initial.coverage.measuredIndependentBattles!==2){
  const bucket=getStorage().bucket(process.env.REPLAY_BUCKET),diagnostics=[];
  for(const f of fixtures){
    const loaded=await loadMyCurrentSocialSource({db,bucket,actor:{playerId:owner,authUid:uid},
      request:{matchId:f.matchId,gameId:f.gameId},env:process.env});
    const admission=admitPersonalityContext(loaded,owner,PRIVATE_SOURCE_TAXONOMY.sourceProofs[f.hash]);
    diagnostics.push({sourceHash:f.hash,admission,sourceFields:loaded.statistics.matchFacts.source,
      observedScope:loaded.statistics.scope});
  }
  console.log(JSON.stringify({diagnostic:'AOF_PERSONALITY_ORIGINAL_ACCEPTANCE_PENDING',coverage:initial.coverage,
    featureCoverage:initial.personality.battleFeatures.map(f=>({battleId:f.battleId,axis:f.featureId,coverage:f.coverage})),diagnostics}));
}
assert.equal(initial.coverage.currentSources,2);assert.equal(initial.coverage.measuredIndependentBattles,2);
assert.equal(new Set(initial.sources.map(s=>s.gameGuid)).size,2);assert.deepEqual(initial.pending,[]);
assert.equal(initial.personality.calibration,'PROPOSED');assert.equal(initial.personality.personalityProfile.policy.status,'PROPOSED');
assert.equal(initial.personality.personalityProfile.policy.approvalRef,null);
const sliders=initial.personality.personalityProfile.sliders;
const supported=sliders.filter(s=>s.status==='READY');
assert.ok(supported.some(s=>s.axis==='BOOMER_AGGRESSOR'),'Original full-cost measurements must support their own source-qualified axis.');
for(const s of supported){assert.equal(s.independentBattles,2);assert.ok(Number.isFinite(s.value)&&s.value>=0&&s.value<=100);}
const specialist=sliders.find(s=>s.axis==='SPECIALIST_IMPROVISER');
assert.equal(specialist.value,null);assert.notEqual(specialist.status,'READY');
for(const s of sliders.filter(s=>s.status!=='READY'))assert.equal(s.value,null,'Unsupported opportunity must remain unmeasured.');
const bucket=getStorage().bucket(process.env.REPLAY_BUCKET),actor={playerId:owner,authUid:uid};
const facts=[];
for(const f of fixtures){
  const loaded=await loadMyCurrentSocialSource({db,bucket,actor,request:{matchId:f.matchId,gameId:f.gameId},env:process.env});
  const original=loaded.statistics.matchFacts,slot=loaded.source.roster.find(p=>p.playerId===owner).replaySlot;
  assert.equal(slot,f.slot);assert.equal(original.rules.mapId.value,f.mapId);
  assert.equal(original.players.find(p=>p.replaySlot===slot).civilization.rawId,f.civ);
  assert.equal(loaded.source.sourceHash,f.hash);
  const claim=(await db.doc('recordingGameClaims/'+Buffer.from(loaded.source.gameGuid).toString('hex')).get()).data();
  assert.deepEqual([claim.matchId,claim.gameId,claim.sourceHash],[f.matchId,f.gameId,f.hash]);
  facts.push({fixture:f.name,sourceHash:f.hash,gameGuid:loaded.source.gameGuid,replaySlot:slot,
    mapId:f.mapId,civilizationId:f.civ,outcome:loaded.source.outcome,authorityRevision:loaded.source.authorityRevision});
}
// Glade has source-qualified Personality context but no admitted announced-map
// outcome binding. Let the real resolver preserve its natural Pending result.
const pending=initial.sources.find(s=>s.sourceHash===fixtures[0].hash);
assert.equal(pending.outcome.qualification,'UNRESOLVED');assert.equal(pending.outcome.resultRevision,null);
assert.equal(pending.outcome.winningPlayerIds,null);
assert.equal((await db.doc('matches/'+fixtures[0].matchId+'/games/g1').get()).data().canonicalResult,undefined);
assert.deepEqual(await read(),initial,'Repeated reads cannot mint additional independent Battles.');
await assert.rejects(getMyPersonalityHistory.run({data:{}}),e=>e.code==='unauthenticated');
await assert.rejects(getMyPersonalityHistory.run(req(uid,{playerId:outsider})),e=>e.code==='invalid-argument');
await assert.rejects(getMyPersonalityHistory.run(req(outsider,{playerId:owner})),e=>e.code==='invalid-argument');
const foreign=await getMyPersonalityHistory.run(req(outsider));
assert.equal(foreign.coverage.currentSources,0);assert.ok(foreign.personality.personalityProfile.sliders.every(s=>s.value===null));
const one=await getMyPersonalityHistory.run(req(fixtures[0].opponent));
assert.equal(one.coverage.ownBattles,1);assert.ok(one.personality.personalityProfile.sliders.every(s=>s.value===null));
// Controlled correction fault injection around an unchanged genuine original.
const sourceRef=db.doc('matches/'+fixtures[0].matchId+'/games/g1/replaySources/'+fixtures[0].hash);
const originalSource=(await sourceRef.get()).data();await sourceRef.update({state:'WITHDRAWN'});
const withdrawn=await read();assert.equal(withdrawn.coverage.currentSources,1);
assert.ok(withdrawn.personality.personalityProfile.sliders.every(s=>s.value===null));
assert.notEqual(withdrawn.inputDigest,initial.inputDigest);await sourceRef.set(originalSource);
assert.deepEqual(await read(),initial);
const render=spawnSync(process.execPath,['--import','tsx','tests/render-personality-original-battles.mjs'],{
  cwd:resolve('web'),input:JSON.stringify(initial),encoding:'utf8',timeout:30_000,maxBuffer:64*1024});
assert.equal(render.status,0,'Original-source Personality JSDOM witness failed; private input withheld');
const dom=JSON.parse(render.stdout);assert.deepEqual(dom.renderedAxes,supported.map(s=>s.axis));
const tested=spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'});assert.equal(tested.status,0);
const report={version:'AOF_PERSONALITY_AUTHENTIC_DISTINCT_BATTLES_1',testedCommit:tested.stdout.trim(),
  fixtureCommit:'2d04ec6adbe871d156c108a4351448efeb08f4e6',processorRevision:process.env.AOF_NATIVE_REPLAY_PROCESSOR_REVISION,
  genuineRecorderProfileId:197930,controlledLeagueAuthority:true,independentBattles:2,
  existingPolicy:PRIVATE_PERSONALITY_E2E_VERSION,sourceFacts:facts,
  axes:sliders.map(s=>({axis:s.axis,status:s.status,value:s.value,independentBattles:s.independentBattles,coverage:s.coverage})),
  naturalUnresolvedResultContributes:true,noSyntheticStatisticsOrValues:true,withdrawalClearsNumbers:true,
  unauthorizedReaderDenied:true,oneBattleNegative:'SEPARATE_EXISTING_INT_B_TWO_ORIGINALS_ONE_BATTLE_STAGE',
  dom,realBrowser:false,productionPolicyApproved:false,personalityReadEffects:initial.effects};
await mkdir('.replay-lab/social-e2e',{recursive:true});
await writeFile('.replay-lab/social-e2e/personality-original-battles-report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
