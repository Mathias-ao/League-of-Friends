/** Two authentic originals, one isolated controlled two-Game Battle. The shared
 * recorder is mapped consistently; distinct opponents use an explicit fixture
 * alias account. This is NOT a claim of a real historical League series. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {getStorage} from 'firebase-admin/storage';
import {db} from '../lib/config/firebase.js';
import {uploadReplay} from '../lib/commands/statistics/uploadReplay.js';
import {getMyPersonalityHistory,readMyPersonalityHistory} from '../lib/queries/getMyPersonalityHistory.js';
import {getMyPrivateChronicle} from '../lib/queries/getMyPrivateChronicle.js';
import {getMyGameplayPreview,readMyGameplayPreview,getMyGameplayCandidates,readMyGameplayCandidates} from '../lib/queries/getMyGameplayPreview.js';
import {disputeCanonicalGameResult} from '../lib/commands/results/disputeCanonicalGameResult.js';
import {adminResolveCanonicalResultDispute} from '../lib/commands/results/adminResolveCanonicalResultDispute.js';
import {bindingDigest,digest} from '../lib/engines/nativeRecordingIntegration.js';
import {statisticsBindingKey} from '../lib/engines/statisticsExperience.js';
import {validateSharedRecord} from '../lib/domain/socialV1Validation.js';

const project='demo-aof-native-player';
assert.equal(process.env.GCLOUD_PROJECT,project);assert.equal(process.env.FUNCTIONS_EMULATOR,'true');
for(const key of ['FIRESTORE_EMULATOR_HOST','FIREBASE_STORAGE_EMULATOR_HOST'])assert.match(process.env[key]??'',/^127\.0\.0\.1:\d+$/);
assert.equal(process.env.REPLAY_BUCKET,project+'.appspot.com');assert.equal(new URL(process.env.REPLAY_WORKER_URL).hostname,'127.0.0.1');
const specifications=[['1v1_t90-deak','3f2ee71756017332182620ee9f273e249b3fe6bc61222637df26bb7a84d400ef'],
 ['1v1_t90-dobb','f4122159245f2374ba90989501869b0f0609f2741144d9723feb6cabba631763']];
const corpus=resolve(process.env.AOF_NATIVE_CORPUS),fixtures=[];
for(const [name,sha256] of specifications){
 const bytes=await readFile(resolve(corpus,name+'.aoe2record'));assert.equal(digest(bytes),sha256);
 const meta=JSON.parse(await readFile(resolve(corpus,name+'.json'),'utf8')).meta;
 assert.equal(meta.game_build,185872);assert.equal(meta.players.length,2);fixtures.push({name,bytes,meta});
}
const common=fixtures[0].meta.players.map(p=>p.name).filter(n=>fixtures[1].meta.players.some(p=>p.name===n));
assert.equal(common.length,1,'Keep the actual shared recorder identity; never substitute another source actor.');
const owner='intb-owner',other='intb-opponent-alias',uid='intb-owner-uid',admin='intb-admin',outsider='intb-outsider';
for(const [id,authUid,role] of [[owner,uid,'PLAYER'],[other,'intb-other-uid','PLAYER'],[admin,admin,'ADMIN'],[outsider,outsider,'PLAYER']]){
 await db.doc('players/'+id).set({role,membershipStatus:'ACTIVE',steamName:id,goldBalance:0});await db.doc('authLinks/'+authUid).set({playerId:id});
}
const matchId='intb-controlled-series',mr=db.doc('matches/'+matchId),roster=[{playerId:owner,team:1},{playerId:other,team:2}];
await db.doc('seasons/intb-season').set({status:'ACTIVE'});
await db.doc('events/intb-event').set({status:'ACTIVE',seasonId:'intb-season',officialMatchIds:[matchId],warmupMatchIds:[]});
await mr.create({status:'ACTIVE',format:'ONE_V_ONE',opponentKind:'HUMAN',participants:roster,seriesRule:{maxGames:3,gamesRequiredToWin:2},
 seasonId:'intb-season',eventId:'intb-event',context:{affectsSeasonStats:false,affectsLifetimeStats:false,affectsLeaguePoints:false,affectsGold:false},
 gameConfigSnapshot:{maps:{pool:['Arabia']},civilizations:{mode:'UNRESTRICTED'},victory:{conquest:true,wonder:false,relic:false},diplomacyEnabled:false,additionalSettings:{}}});
Object.assign(process.env,{AOF_NATIVE_PLAYER_UPLOAD:'recorded-events-v1',AOF_NATIVE_REPLAY_PROJECT:project,
 AOF_ACTIVE_NATIVE_PLAYER_READS:'1',AOF_ACTIVE_NATIVE_SOCIAL_READS:'1',AOF_NATIVE_PLAYER_UPLOAD_GAME_ALLOWLIST:matchId+'/g1,'+matchId+'/g2',
 AOF_INT_V1_PRIVATE_READS:'source-v1',AOF_INT_V1_PRIVATE_HISTORY:'battle-v1',AOF_INT_C1_PRIVATE_PREVIEW:'wiring-test-v1',AOF_INT_C2A_PRIVATE_PREVIEW:'source-compatible-v1'});
assert.ok(!process.env.AOF_NATIVE_REPLAY_INTEGRATION&&!process.env.AOF_NATIVE_READY_PUBLICATION);
const bucket=getStorage().bucket(process.env.REPLAY_BUCKET),actor={playerId:owner,authUid:uid};
const ownRead=()=>getMyPersonalityHistory.run({auth:{uid},data:{}});
const bookRead=()=>getMyPrivateChronicle.run({auth:{uid},data:{}});
const gameplayRead=()=>getMyGameplayCandidates.run({auth:{uid},data:{}});
for(let i=0;i<fixtures.length;i++){
 const f=fixtures[i],gameId='g'+(i+1),game=mr.collection('games').doc(gameId);
 await game.create({status:'READY',gameNumber:i+1,players:roster,replayStatisticsRevision:0,activeReplayStatisticsId:null,
  replayParticipantBindings:f.meta.players.map(p=>({playerId:p.name===common[0]?owner:other,
   sourceNameNormalized:p.name.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US')}))});
}
for(let i=0;i<fixtures.length;i++){
 const f=fixtures[i];const receipt=await uploadReplay.run({auth:{uid},data:{matchId,gameId:'g'+(i+1),fileName:f.name+'.aoe2record',replayBase64:f.bytes.toString('base64'),processingMode:'AUTO'}});
 assert.equal(receipt.state,'READY');
}
const initial=await ownRead();assert.equal(initial.coverage.ownBattles,1);assert.equal(initial.coverage.ownGames,2);assert.equal(initial.coverage.currentSources,2);
assert.equal(initial.personality.battleFeatures.length,5);
for(const feature of initial.personality.battleFeatures){validateSharedRecord('BattleFeature',feature);assert.equal(feature.evidenceRefs.length,2);assert.equal(feature.numerator,null);}
assert.ok(initial.personality.personalityProfile.sliders.every(s=>s.status==='DEVELOPING'&&s.value===null));
assert.equal(new Set(initial.sources.map(s=>s.gameGuid)).size,2);assert.equal(new Set(initial.sources.map(s=>s.sourceHash)).size,2);
assert.deepEqual(await ownRead(),initial);
const initialGameplay=await gameplayRead();assert.equal(initialGameplay.coverage.currentSources,2);
assert.equal(initialGameplay.coverage.ownBattles,1);assert.ok(initialGameplay.episodes.length>0&&initialGameplay.legacyPending.claimIds.length>0);
assert.equal(new Set(initialGameplay.sources.map(s=>s.gameGuid)).size,2);
assert.ok(initialGameplay.episodes.every(g=>g.binding.actorPlayerId===owner&&g.candidate.grade.decision==='PENDING'));
assert.deepEqual(await gameplayRead(),initialGameplay);assert.deepEqual(initialGameplay.history.projections,[]);assert.deepEqual(initialGameplay.history.receipts,[]);
const legacyGameplay=await getMyGameplayPreview.run({auth:{uid},data:{}});assert.equal(legacyGameplay.version,'AOF_INT_C1_PRIVATE_PREVIEW_1');assert.deepEqual(legacyGameplay.claims.map(c=>c.claimId),initialGameplay.legacyPending.claimIds);
const otherGameplay=await getMyGameplayCandidates.run({auth:{uid:'intb-other-uid'},data:{}});
assert.ok(otherGameplay.episodes.every(g=>g.binding.actorPlayerId===other));
assert.ok(otherGameplay.episodes.every(e=>e.candidate.actorReplayPlayerId===e.binding.source.roster.find(p=>p.playerId===other).replaySlot));
assert.equal((await getMyGameplayCandidates.run({auth:{uid:outsider},data:{}})).episodes.length,0);
const oldBook=await bookRead(),oldEntry=oldBook.chronicle.pages.find(p=>p.counterpartPlayerId===other)?.entries[0];assert.ok(oldEntry?.sceneId);
const otherRead=await getMyPersonalityHistory.run({auth:{uid:'intb-other-uid'},data:{}});assert.equal(otherRead.ownerPlayerId,other);
assert.equal((await getMyPersonalityHistory.run({auth:{uid:outsider},data:{}})).sources.length,0);
assert.equal((await getMyPrivateChronicle.run({auth:{uid:outsider},data:{}})).chronicle.pages.length,0);
await assert.rejects(getMyPersonalityHistory.run({data:{}}),e=>e.code==='unauthenticated');
await assert.rejects(getMyPrivateChronicle.run({auth:{uid},data:{playerId:other}}),e=>e.code==='invalid-argument');
// Genuine existing dispute/admin correction path, not a new evaluator or direct score write.
const gr=mr.collection('games').doc('g1'),game=(await gr.get()).data();assert.ok(game.canonicalResult);
await disputeCanonicalGameResult.run({auth:{uid},data:{requestId:'intb-dispute',matchId,gameId:'g1',category:'WRONG_RESULT',reason:'Controlled integration correction test.'}});
const disputed=await ownRead();assert.equal(disputed.coverage.currentSources,0);
assert.equal((await gameplayRead()).legacyPending.claimIds.length,0);
const winner=game.canonicalResult.winningPlayerIds.includes(owner)?other:owner;
await adminResolveCanonicalResultDispute.run({auth:{uid:admin},data:{requestId:'intb-resolve',matchId,gameId:'g1',disputeId:'intb-dispute',
 resolution:'CORRECT',reason:'Controlled test only: authoritative revision replacement.',expectedSourceHash:game.activeReplayStatisticsId,winnerTeam:roster.find(p=>p.playerId===winner).team}});
const corrected=await ownRead();assert.notEqual(corrected.inputDigest,initial.inputDigest);assert.equal(corrected.coverage.currentSources,2);
assert.equal(corrected.personality.battleFeatures.length,5);
const correctedGameplay=await gameplayRead();assert.notEqual(correctedGameplay.inputDigest,initialGameplay.inputDigest);
assert.equal(correctedGameplay.coverage.currentSources,2);assert.deepEqual(correctedGameplay.history.receipts,[]);
assert.ok(correctedGameplay.episodes.every(g=>correctedGameplay.sources.some(s=>s.authorityRevision===g.binding.source.authorityRevision)));
const correctedBook=await bookRead(),newEntry=correctedBook.chronicle.pages.find(p=>p.counterpartPlayerId===other)?.entries[0];
assert.equal(newEntry?.sceneId,oldEntry.sceneId,'Source/result correction never remints pair×Battle identity');
const sr=gr.collection('replaySources').doc(game.activeReplayStatisticsId),source=(await sr.get()).data();
await sr.update({state:'WITHDRAWN'});const withdrawn=await ownRead();assert.equal(withdrawn.coverage.currentSources,1);assert.equal(withdrawn.pending.length,1);
const withdrawnGameplay=await gameplayRead();assert.equal(withdrawnGameplay.coverage.currentSources,1);
assert.ok(withdrawnGameplay.episodes.every(g=>g.binding.source.authorityRevision!==correctedGameplay.sources.find(s=>s.gameId==='g1').authorityRevision));
await sr.set(source); // isolated fault-injection fixture restore, not a production reactivation API
const mapping=source.playerMapping.map((p,i,a)=>({...p,playerId:a[(i+1)%a.length].playerId}));
const current=(await gr.get()).data(),key=statisticsBindingKey({sourceHash:source.sourceHash,roster:current.players,mapping,opponents:[]});
await sr.set({...source,playerMapping:mapping,experience:{...source.experience,bindingKey:key}});
const remapped=await ownRead();assert.notEqual(remapped.inputDigest,corrected.inputDigest);assert.equal(remapped.personality.battleFeatures.length,5);
const remappedGameplay=await gameplayRead();assert.notEqual(remappedGameplay.inputDigest,correctedGameplay.inputDigest);
assert.ok(remappedGameplay.episodes.every(g=>g.candidate.actorReplayPlayerId===g.binding.source.roster.find(p=>p.playerId===owner).replaySlot));await sr.set(source);
const eventRef=db.doc('events/intb-event'),event=(await eventRef.get()).data();
for(const change of [()=>eventRef.update({status:'CANCELLED'}),()=>db.doc('authLinks/'+uid).update({playerId:other}),
 ()=>mr.collection('games').doc('inserted').set({gameNumber:3,status:'READY',players:roster})]){
 let once=false;
 const raced={file:(...args)=>({download:async()=>{const bytes=await bucket.file(...args).download();if(!once){once=true;await change();}return bytes;}})};
 await assert.rejects(readMyPersonalityHistory({db,bucket:raced,actor,env:process.env,request:{}}));
 await eventRef.set(event);await db.doc('authLinks/'+uid).set({playerId:owner});await mr.collection('games').doc('inserted').delete();
}
const final=await ownRead(),book=await bookRead();
// Mutation AFTER worker derivation must invalidate the complete C1 history too.
const {callVerifiedWorker}=await import('../lib/services/nativeRecordingValidation.js');let changedDuringWorker=false;
await assert.rejects(readMyGameplayCandidates({db,bucket,actor,env:process.env,request:{},derive:async payload=>{
 const value=await callVerifiedWorker(process.env.REPLAY_WORKER_URL,'/social-grade-candidates-preview-v1',payload);
 if(!changedDuringWorker){changedDuringWorker=true;await eventRef.update({status:'CANCELLED'});}return value;
}}));await eventRef.set(event);
const rendered=spawnSync(process.execPath,['--import','tsx','tests/render-int-b-history.mjs'],{cwd:resolve('web'),
 input:JSON.stringify({history:final,book,oldEntryId:oldEntry.entryId,counterpartId:other}),encoding:'utf8',timeout:30_000,maxBuffer:64*1024});
assert.equal(rendered.status,0,'INT-B source-to-UI witness failed; private payload/stderr withheld');
assert.deepEqual(JSON.parse(rendered.stdout),{privatePersonalityRendered:true,legacySeenPreserved:true,stableSceneRendered:true,jsdomOnly:true});
for(const value of [final,book])for(const field of ['sourceName','native-replay-evidence','privateNote','relationshipMarks','auditRef'])assert.ok(!JSON.stringify(value).includes(field));
assert.equal(final.effects.officialWrites,false);assert.equal((await db.collection('leaguePointLedger').get()).size,0);
assert.equal((await db.collection('goldLedger').get()).size,0);
console.log(JSON.stringify({contract:'AOF_INT_B_AUTHENTIC_EMULATOR_1',authenticOriginals:2,distinctGameGuids:true,controlledOpponentAlias:true,
 currentSources:2,independentBattleIdentity:1,canonicalPendingFeatures:5,developingSliders:5,
 existingDisputeAndAdminCorrection:true,withdrawalRemapAndSetFences:true,twoAccountPrivacy:true,legacySeenMigration:true,
 jsdomOnly:true,numericalCalibrationApproved:false,sixTrackCredits:false,cloudOperations:false}));
