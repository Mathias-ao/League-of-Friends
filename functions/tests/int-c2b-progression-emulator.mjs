/** Controlled league identities over hash-pinned genuine originals. One shared
 * recorder is kept consistent across formats; the two original 1v1 opponents
 * share an explicitly disclosed test alias. This is not real League history. */
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {getStorage} from 'firebase-admin/storage';
import {Timestamp} from 'firebase-admin/firestore';
import {db} from '../lib/config/firebase.js';
import {uploadReplay} from '../lib/commands/statistics/uploadReplay.js';
import {getMySocialProgression,readMySocialProgression} from '../lib/queries/getMySocialProgression.js';
import {disputeCanonicalGameResult} from '../lib/commands/results/disputeCanonicalGameResult.js';
import {adminResolveCanonicalResultDispute} from '../lib/commands/results/adminResolveCanonicalResultDispute.js';
import {digest} from '../lib/engines/nativeRecordingIntegration.js';
import {statisticsBindingKey} from '../lib/engines/statisticsExperience.js';
import {validateSharedRecord} from '../lib/domain/socialV1Validation.js';
const project='demo-aof-native-player';
assert.equal(process.env.GCLOUD_PROJECT,project);assert.equal(process.env.FUNCTIONS_EMULATOR,'true');
for(const k of ['FIRESTORE_EMULATOR_HOST','FIREBASE_STORAGE_EMULATOR_HOST'])assert.match(process.env[k]??'',/^127\.0\.0\.1:\d+$/);
assert.equal(process.env.REPLAY_BUCKET,project+'.appspot.com');assert.equal(new URL(process.env.REPLAY_WORKER_URL).hostname,'127.0.0.1');
const names=['1v1_t90-deak','1v1_t90-dobb','2v2_arabia','4v4_arabia','FFA_7'],fixtures=[];
const pins=['3f2ee71756017332182620ee9f273e249b3fe6bc61222637df26bb7a84d400ef','f4122159245f2374ba90989501869b0f0609f2741144d9723feb6cabba631763','b80aec98153eaacb92e14a7759e209d21218858f306551eb5c14b6c432b0ad05','ad3d7716d8e6a52f73997812a281f1e158bd181f482fdafe8d0c5e8617d6d2d7','d86ba4dfafdc430d9c125f75ca20e90dee41e27c5e207edbd5561058e41531b8'];
const corpus=resolve(process.env.AOF_NATIVE_CORPUS),owner='c2b-owner',other='c2b-opponent-alias',admin='c2b-admin',outsider='c2b-outsider';
for(let i=0;i<names.length;i++){
 const name=names[i],bytes=await readFile(resolve(corpus,name+'.aoe2record')),meta=JSON.parse(await readFile(resolve(corpus,name+'.json'),'utf8')).meta;
 assert.equal(meta.game_build,185872);assert.equal(digest(bytes),pins[i]);fixtures.push({name,bytes,meta,index:i});
}
const common=fixtures[0].meta.players.find(p=>p.number===1).name;
assert.ok(fixtures.slice(1,4).every(f=>f.meta.players.some(p=>p.name===common)),'Preserve original common recorder identity.');
const bucket=getStorage().bucket(process.env.REPLAY_BUCKET),eventId='c2b-event',seasonId='c2b-season';
// The source grouping is a controlled finite two-Game series, not a played BO3.
const battleIds=['c2b-z-series','c2b-b-team','c2b-a-team','c2b-ffa'];
for(const id of [owner,other,admin,outsider]){await db.doc('players/'+id).set({role:id===admin?'ADMIN':'PLAYER',membershipStatus:'ACTIVE',steamName:id,goldBalance:0});await db.doc('authLinks/'+id).set({playerId:id});}
await db.doc('seasons/'+seasonId).set({status:'ACTIVE'});
await db.doc('events/'+eventId).set({status:'ACTIVE',seasonId,startsAt:Timestamp.fromMillis(1700000000000),officialMatchIds:battleIds,warmupMatchIds:[],approvedMatchPlanId:'approved',matchPlanStatus:'APPROVED'});
await db.doc('events/'+eventId+'/matchPlans/approved').set({status:'APPROVED',officialMatchIds:battleIds,matches:battleIds.map(()=>({}))});
const config={maps:{pool:['Arabia']},civilizations:{mode:'UNRESTRICTED'},victory:{conquest:true,wonder:false,relic:false},diplomacyEnabled:false,additionalSettings:{}};
for(const f of fixtures){
 const i=f.index,battleIndex=i<2?0:i-1,matchId=battleIds[battleIndex],gameId=i===1?'g2':'g1',format=['ONE_V_ONE','ONE_V_ONE','TWO_V_TWO','FOUR_V_FOUR','FFA'][i];
 const teams=[...new Set(f.meta.players.map(p=>p.team_id))].sort();
 const roster=f.meta.players.map(p=>({playerId:p.name===common?owner:i<2?other:matchId+'-p'+p.number,team:i===4?p.number:teams.indexOf(p.team_id)+1}));
 Object.assign(f,{matchId,gameId,roster});
 for(const p of roster){if([owner,other].includes(p.playerId))continue;await db.doc('players/'+p.playerId).set({role:'PLAYER',membershipStatus:'ACTIVE',steamName:p.playerId,goldBalance:0});await db.doc('authLinks/'+p.playerId).set({playerId:p.playerId});}
 const mr=db.doc('matches/'+matchId);
 if(i!==1)await mr.create({status:'ACTIVE',format,opponentKind:'HUMAN',participants:roster,seriesRule:{maxGames:i===0?2:1,gamesRequiredToWin:i===0?2:1},seasonId,eventId,
  sourceMatchPlanId:'approved',matchNumber:battleIndex+1,context:{affectsSeasonStats:false,affectsLifetimeStats:false,affectsLeaguePoints:false,affectsGold:false},gameConfigSnapshot:config});
 await mr.collection('games').doc(gameId).create({status:'READY',gameNumber:i===1?2:1,players:roster,replayStatisticsRevision:0,activeReplayStatisticsId:null,
  replayParticipantBindings:f.meta.players.map((p,j)=>({playerId:roster[j].playerId,sourceNameNormalized:p.name.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US')}))});
}
Object.assign(process.env,{AOF_NATIVE_PLAYER_UPLOAD:'recorded-events-v1',AOF_NATIVE_REPLAY_PROJECT:project,AOF_ACTIVE_NATIVE_PLAYER_READS:'1',AOF_ACTIVE_NATIVE_SOCIAL_READS:'1',
 AOF_NATIVE_PLAYER_UPLOAD_GAME_ALLOWLIST:fixtures.map(f=>f.matchId+'/'+f.gameId).join(','),AOF_INT_V1_PRIVATE_READS:'source-v1',AOF_INT_V1_PRIVATE_HISTORY:'battle-v1',AOF_SOCIAL_E2E_PRIVATE_PROGRESS:'pilot-v1'});
assert.ok(!process.env.AOF_NATIVE_REPLAY_INTEGRATION&&!process.env.AOF_NATIVE_READY_PUBLICATION);
// Deliberately reverse arrival order, including Game 2 before Game 1.
for(const f of [...fixtures].reverse()){
 const uid=f.roster.find(p=>p.playerId===owner)?.playerId??f.roster[0].playerId;
 const receipt=await uploadReplay.run({auth:{uid},data:{matchId:f.matchId,gameId:f.gameId,fileName:f.name+'.aoe2record',replayBase64:f.bytes.toString('base64'),processingMode:'AUTO'}});assert.equal(receipt.state,'READY');
 const gr=db.doc('matches/'+f.matchId+'/games/'+f.gameId),g=(await gr.get()).data(),source=(await gr.collection('replaySources').doc(g.activeReplayStatisticsId).get()).data();
 assert.equal(source.originalRecording.permanent,true);assert.equal(source.originalRecording.sourceDeletionAuthorized,false);
 const directory=resolve('.replay-lab/native-player',f.name);await mkdir(directory,{recursive:true});
 for(const [field,file] of [['recordedEvents','events.jsonl.gz'],['statistics','statistics.direct.json.gz'],['originalRecording',null]]){
  const [bytes]=await bucket.file(source[field].path,{generation:source[field].generation}).download();assert.equal(digest(bytes),source[field].sha256);
  if(file)await writeFile(resolve(directory,file),bytes);else assert.equal(digest(bytes),digest(f.bytes));
 }
 await writeFile(resolve(directory,'manifest.json'),JSON.stringify({contract:'AOF_NATIVE_REPLAY_PACKAGE_V1_EXPERIMENTAL',source:{sha256:digest(f.bytes),bytes:f.bytes.length},
  recordedEvents:{...source.recordedEvents,path:'events.jsonl.gz'},statistics:{...source.statistics,path:'statistics.direct.json.gz'},retention:{sourceDeletionAuthorized:false,canonicalReplayProduced:false}}));
 console.log(JSON.stringify({phase:'genuine-upload-ready',fixture:f.name}));
}
const read=(id=owner)=>getMySocialProgression.run({auth:{uid:id},data:{}});
const first=await read();console.log(JSON.stringify({phase:'private-owner-history',cards:first.cards.length,projections:first.history.projections.length}));assert.equal(first.coverage.currentSources,4);assert.equal(first.coverage.ownBattles,3);
assert.ok(first.scheduleOrders.every(o=>o.status==='ORDERED'));assert.equal(first.scheduleOrders.find(o=>o.battleId===battleIds[0]).order.battle,1);
assert.equal(new Set(first.sources.map(s=>s.gameGuid)).size,4);
assert.ok(first.cards.some(c=>c.decision==='SOURCE_ADMITTED'),'Real original source admission required');
assert.ok(first.cards.some(c=>c.decision==='PENDING'),'Closest unchanged unsupported episodes must remain Pending');
assert.ok(first.history.projections.some(p=>p.upBank>0||p.currentStage>0),'Genuine private historical movement required');
for(const c of first.claims)validateSharedRecord('Claim',c);
assert.ok(first.claims.some(c=>c.decision==='QUALIFIED'&&c.significanceBandId==='ORDINARY'));
assert.ok(first.claims.every(c=>c.policy.status==='PROPOSED'&&c.policy.approvalRef===null));
assert.deepEqual(first.history.receipts,[]);assert.equal(first.history.publicationAllowed,false);assert.equal(first.history.officialWrites,false);
const rendered=spawnSync(process.execPath,['--import','tsx','tests/render-int-c2b-progression.mjs'],{cwd:resolve('web'),input:JSON.stringify(first),encoding:'utf8',timeout:30_000,maxBuffer:64*1024});
assert.equal(rendered.status,0,'Private source-to-UI rendering failed; private output withheld');
assert.equal(JSON.parse(rendered.stdout).authChangeClearsHistory,true);
assert.deepEqual(await read(),first,'Reprocessing never adds banks/stages');
const reverse=await read(other);assert.ok(reverse.cards.every(c=>c.actorPlayerId===other));assert.ok(reverse.claims.every(c=>c.subject.system==='REPUTATION'?c.subject.playerId===other:c.subject.fromPlayerId===other));
assert.equal((await read(outsider)).cards.length,0);await assert.rejects(getMySocialProgression.run({data:{}}),e=>e.code==='unauthenticated');
await assert.rejects(getMySocialProgression.run({auth:{uid:owner},data:{playerId:other}}),e=>e.code==='invalid-argument');
const allTrackCounts={};
// Read each genuine source actor independently: no copying another player's positive into the owner's history.
for(const id of fixtures[3].roster.map(p=>p.playerId)){
 const r=id===owner?first:await read(id);console.log(JSON.stringify({phase:'independent-private-actor',actorIndex:fixtures[3].roster.findIndex(p=>p.playerId===id)}));for(const c of r.cards.filter(c=>c.decision==='SOURCE_ADMITTED'))allTrackCounts[c.track]=(allTrackCounts[c.track]??0)+1;
 assert.ok(r.claims.every(c=>c.subject.system==='REPUTATION'?c.subject.playerId===id:c.subject.fromPlayerId===id));assert.deepEqual(r.history.receipts,[]);
}
for(const track of ['RIVALRY','BOND','CHIVALRY','GALLANTRY'])assert.ok(allTrackCounts[track]>0,'Authentic source-backed '+track+' required');
assert.equal(allTrackCounts.CRUELTY,undefined);assert.equal(allTrackCounts.HOSTILITY,undefined);
const ffa=await read(fixtures[4].roster[0].playerId);assert.ok(ffa.cards.every(c=>c.decision==='PENDING'));assert.equal(ffa.history.projections.length,0);assert.ok(ffa.cards.length>0||ffa.pendingSources.length===1,'Unqualified FFA method must remain explicitly Pending');
const f=fixtures[0],gr=db.doc('matches/'+f.matchId+'/games/'+f.gameId),game=(await gr.get()).data(),sr=gr.collection('replaySources').doc(game.activeReplayStatisticsId),source=(await sr.get()).data();
await sr.update({state:'WITHDRAWN'});const withdrawn=await read();assert.equal(withdrawn.coverage.currentSources,3);assert.ok(withdrawn.history.projections.every(p=>p.currentStage===null));
assert.ok(withdrawn.cards.every(c=>c.gameId!=='g1'||c.battleId!==f.matchId));await sr.set(source);
await disputeCanonicalGameResult.run({auth:{uid:owner},data:{requestId:'c2b-dispute',matchId:f.matchId,gameId:f.gameId,category:'WRONG_RESULT',reason:'Isolated emulator correction test.'}});
const disputed=await read();assert.ok(disputed.history.projections.every(p=>p.currentStage===null));
const winner=game.canonicalResult.winningPlayerIds.includes(owner)?other:owner;
await adminResolveCanonicalResultDispute.run({auth:{uid:admin},data:{requestId:'c2b-resolve',matchId:f.matchId,gameId:f.gameId,disputeId:'c2b-dispute',resolution:'CORRECT',reason:'Isolated authoritative result correction.',expectedSourceHash:game.activeReplayStatisticsId,winnerTeam:f.roster.find(p=>p.playerId===winner).team}});
const corrected=await read();assert.notEqual(corrected.inputDigest,first.inputDigest);assert.equal(corrected.cards.length,first.cards.length);
assert.deepEqual(corrected.history.projections,first.history.projections,'Result-only correction preserves conduct, recomputes source bindings');
assert.ok(corrected.cards.every(c=>corrected.sources.some(s=>s.authorityRevision===c.sourceAuthority)));
const correctedSource=(await sr.get()).data(),mapping=correctedSource.playerMapping.map((p,i,a)=>({...p,playerId:a[(i+1)%a.length].playerId})),current=(await gr.get()).data();
const key=statisticsBindingKey({sourceHash:source.sourceHash,roster:current.players,mapping,opponents:[]});
await sr.set({...correctedSource,playerMapping:mapping,experience:{...correctedSource.experience,bindingKey:key}});const remapped=await read();assert.notEqual(remapped.inputDigest,corrected.inputDigest);
assert.ok(remapped.cards.every(c=>c.actorPlayerId===owner));await sr.set(correctedSource);
const eventRef=db.doc('events/'+eventId),event=(await eventRef.get()).data();await eventRef.update({matchPlanStatus:'PROPOSED'});
const unordered=await read();assert.ok(unordered.history.projections.every(p=>p.currentStage===null));assert.ok(unordered.scheduleOrders.every(o=>o.order===null));await eventRef.set(event);
let once=false;const raced={file:(...args)=>({download:async()=>{const bytes=await bucket.file(...args).download();if(!once){once=true;await eventRef.update({startsAt:Timestamp.fromMillis(1700000001000)});}return bytes;}})};
await assert.rejects(readMySocialProgression({db,bucket:raced,actor:{playerId:owner,authUid:owner},env:process.env,request:{}}),e=>e.code==='aborted');await eventRef.set(event);
for(const forbidden of ['sourceName','replayBase64','native-replay-evidence','authUid'])assert.ok(!JSON.stringify(first).includes(forbidden));
const testedCommit=spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'});
assert.equal(testedCommit.status,0);assert.match(testedCommit.stdout.trim(),/^[a-f0-9]{40}$/);
const report={version:first.version,testedCommit:testedCommit.stdout.trim(),genuineRecordings:5,formats:4,authenticatedUsers:fixtures[3].roster.length+3,
 twoGameBattle:true,reverseUploadOrder:true,genuineSourceAdmittedByTrack:allTrackCounts,ownerStages:first.history.projections.map(p=>({subject:p.subject,stage:p.currentStage,upBank:p.upBank,downBank:p.downBank})),
 retryIdempotent:true,withdrawal:true,resultCorrection:true,playerRemapping:true,scheduleCorrection:true,concurrentScheduleFence:true,privateOnly:true,officialReceipts:0,privateSourceToUI:true,authChangeClearsHistory:true,
 pending:['CRUELTY','HOSTILITY','INDEPENDENT_WEAKENING','STRICT_TREACHERY'],controlledLeagueFixtureNotActualHistoricalLeagueSeries:true};
await mkdir('.replay-lab/social-e2e',{recursive:true});await writeFile('.replay-lab/social-e2e/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
