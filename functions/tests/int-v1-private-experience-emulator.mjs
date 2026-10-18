/** Runs inside ordinary native four-format acceptance using actual retained
 * original recordings. Fault injection is confined to the fixed demo project. */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {getMySocialExperience,readMySocialExperience} from '../lib/queries/getMySocialExperience.js';
import {validateSharedRecord} from '../lib/domain/socialV1Validation.js';
import {statisticsBindingKey} from '../lib/engines/statisticsExperience.js';

export async function intV1SourceAcceptance({db,bucket,actor,matchId,gameId,name}){
 assert.equal(process.env.GCLOUD_PROJECT,'demo-aof-native-player');
 assert.equal(process.env.FUNCTIONS_EMULATOR,'true');
 for(const key of ['FIRESTORE_EMULATOR_HOST','FIREBASE_STORAGE_EMULATOR_HOST'])
  assert.match(process.env[key]??'',/^127\.0\.0\.1:\d+$/);
 const env={...process.env,AOF_INT_V1_PRIVATE_READS:'source-v1'};
 const input={db,bucket,actor,env,request:{matchId,gameId}};
 const read=()=>readMySocialExperience(input);
 const mr=db.doc('matches/'+matchId),gr=mr.collection('games').doc(gameId);
 const game=(await gr.get()).data(),match=(await mr.get()).data();
 const sr=gr.collection('replaySources').doc(game.activeReplayStatisticsId),source=(await sr.get()).data();
 const er=db.doc('events/'+match.eventId),event=(await er.get()).data();
 const link=db.doc('authLinks/'+actor.authUid),linkData=(await link.get()).data();
 const claimRef=db.doc('recordingGameClaims/'+Buffer.from(source.matchFacts.game.guid).toString('hex'));
 const claim=(await claimRef.get()).data();
 const before=JSON.stringify({game,match,source,event,claim});
 await assert.rejects(readMySocialExperience({...input,env:{...env,AOF_INT_V1_PRIVATE_READS:undefined}}));
 const first=await read();validateSharedRecord('SourceSnapshot',first.source);
 assert.equal(first.source.sourceHash,source.sourceHash);assert.equal(first.source.gameGuid,source.matchFacts.game.guid);
 assert.equal(first.source.battleId,matchId);assert.equal(first.source.matchId,matchId);
 assert.deepEqual(first.source.roster.map(p=>p.playerId).sort(),game.players.map(p=>p.playerId).sort());
 assert.equal(first.source.outcome.qualification,game.canonicalResult?'OFFICIAL':'UNRESOLVED');
 assert.ok(first.personality.length===5&&first.personality.every(p=>p.status==='PENDING'&&p.value===null));
 assert.ok(first.tracks.length===6&&first.tracks.every(p=>p.status==='PENDING'&&p.currentStage===null));
 assert.equal(first.scope.independentBattleCount,null);assert.equal(first.effects.officialWrites,false);
 assert.deepEqual(await read(),first);
 await assert.rejects(getMySocialExperience.run({data:input.request}),e=>e.code==='unauthenticated');
 const previous=process.env.AOF_INT_V1_PRIVATE_READS;
 try{
  process.env.AOF_INT_V1_PRIVATE_READS='source-v1';
  assert.deepEqual(await getMySocialExperience.run({auth:{uid:actor.authUid},data:input.request}),first);
  await assert.rejects(getMySocialExperience.run({auth:{uid:'operator'},data:input.request}),e=>e.code==='permission-denied');
  await assert.rejects(getMySocialExperience.run({auth:{uid:'unknown'},data:input.request}));
 }finally{if(previous===undefined)delete process.env.AOF_INT_V1_PRIVATE_READS;else process.env.AOF_INT_V1_PRIVATE_READS=previous;}
 for(const secret of ['sourceName','native-replay-evidence','privateNote','auditRef','replayBase64'])assert.ok(!JSON.stringify(first).includes(secret));
 assert.equal(JSON.stringify({game:(await gr.get()).data(),match:(await mr.get()).data(),source:(await sr.get()).data(),event:(await er.get()).data(),claim:(await claimRef.get()).data()}),before);
 // New result revision, where official, changes authority but issues no social effects.
 if(game.canonicalResult){
  await gr.set({...game,canonicalResult:{...game.canonicalResult,revision:game.canonicalResult.revision+1}});
  const corrected=await read();assert.notEqual(corrected.source.authorityRevision,first.source.authorityRevision);
  assert.equal(corrected.source.outcome.resultRevision,game.canonicalResult.revision+1);await gr.set(game);
 }
 // Corrected POV binding must replace, never append, the historical input.
 const mapping=source.playerMapping.map((p,i,a)=>({...p,playerId:a[(i+1)%a.length].playerId}));
 const bindingKey=statisticsBindingKey({sourceHash:source.sourceHash,roster:game.players,mapping,opponents:[]});
 await sr.set({...source,playerMapping:mapping,experience:{...source.experience,bindingKey}});
 const remapped=await read();assert.notEqual(remapped.source.mappingDigest,first.source.mappingDigest);
 assert.notEqual(remapped.source.authorityRevision,first.source.authorityRevision);await sr.set(source);
 for(const state of ['WITHDRAWN','SUPERSEDED','VALIDATED_NOT_READY']){
  await sr.update({state});await assert.rejects(read);await sr.set(source);
 }
 await gr.update({activeReplayStatisticsId:null,replayStatisticsState:'UNAVAILABLE'});
 await assert.rejects(read);assert.ok((await sr.get()).exists);await gr.set(game);
 await claimRef.update({sourceHash:'f'.repeat(64)});await assert.rejects(read);await claimRef.set(claim);
 // A fabricated current READY copy in a different Game cannot steal the GUID.
 const other=mr.collection('games').doc('int-unclaimed-copy');
 await other.set({...game,gameNumber:2});
 await other.collection('replaySources').doc(source.sourceHash).set({...source,gameId:'int-unclaimed-copy'});
 await assert.rejects(readMySocialExperience({...input,request:{matchId,gameId:'int-unclaimed-copy'}}));
 await other.collection('replaySources').doc(source.sourceHash).delete();await other.delete();
 // Real immutable-generation download followed by race; final source/event/access
 // fence must refuse. Restore each isolated fixture before the next condition.
 for(const change of [()=>er.update({status:'CANCELLED'}),()=>link.set({playerId:'revoked'}),
  ()=>gr.update({replayStatisticsRevision:game.replayStatisticsRevision+1}),
  ()=>claimRef.update({sourceHash:'f'.repeat(64)})]){
  let changed=false;
  const racedBucket={file:(...args)=>({download:async()=>{
    const bytes=await bucket.file(...args).download();if(!changed){changed=true;await change();}return bytes;
  }})};
  await assert.rejects(readMySocialExperience({...input,bucket:racedBucket}));
  await er.set(event);await link.set(linkData);await gr.set(game);await claimRef.set(claim);
 }
 assert.deepEqual(await read(),first);
 const rendered=spawnSync(process.execPath,['--import','tsx','tests/render-int-v1-experience.mjs'],{
  cwd:resolve('web'),input:JSON.stringify(first),encoding:'utf8',timeout:30_000,maxBuffer:64*1024});
 assert.equal(rendered.status,0,'Private real-source UI witness failed (payload/stderr withheld)');
 assert.deepEqual(JSON.parse(rendered.stdout),{sourceRevisionRendered:true,allFiveAxesAndSixTracksPending:true,jsdomOnly:true});
 console.log(JSON.stringify({intV1Fixture:name,authenticatedCurrentSource:true,shared1Validated:true,
  correctionAndPrivacy:true,syntheticProgression:false,officialWrites:false}));
}
