import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {getStorage} from 'firebase-admin/storage';
import {memoryFirestore} from './support/memory-firestore.mjs';
import {uploadReplay} from '../lib/commands/statistics/uploadReplay.js';
import {adminBindReplayParticipants} from '../lib/commands/admin/bindReplayParticipants.js';

// Controlled worker/storage/league fixtures exercise the actual callables.
// These bytes are not a genuine recording and do not certify native parsing,
// the four owner-provided pilot sources, AUTO/READY, or browser acceptance.
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const bytes=Buffer.from('controlled identity-recovery worker fixture');
const sourceHash=hash(bytes),bundle=Buffer.from('controlled canonical evidence bundle');
const req=(data,uid='alice')=>({auth:{uid},data});
const upload=(gameId='G1',uid='alice')=>uploadReplay.run(req({matchId:'battle',gameId,
  fileName:'unchanged.aoe2record',replayBase64:bytes.toString('base64'),processingMode:'LEGACY'},uid));
const bindings=[{sourceName:'Original Red',playerId:'alice'},{sourceName:'Original Blue',playerId:'beren'}];
const bind=(gameId='G1',uid='operator',rows=bindings)=>adminBindReplayParticipants.run(req({
  matchId:'battle',gameId,bindings:rows,reason:'Verified recording names against the two approved original Game starters.'},uid));
function fixture(){
  return memoryFirestore([
    ...['alice','beren','operator','outsider'].flatMap(id=>[
      ['authLinks/'+id,{playerId:id}],['players/'+id,{membershipStatus:'ACTIVE',role:id==='operator'?'ADMIN':'PLAYER',
        steamIdentityVersion:'AOF_STEAM_IDENTITY_V1',steamName:'League alias '+id,
        steamPersonaName:'Current '+id,steamNameHistory:[]}],
    ]),
    ['matches/battle',{status:'READY',opponentKind:'HUMAN',format:'ONE_V_ONE'}],
    ...['G1','G2'].map(gameId=>['matches/battle/games/'+gameId,{status:'READY',players:[
      {playerId:'alice',team:1},{playerId:'beren',team:2}],replayStatisticsRevision:0}]),
  ]);
}
function worker(names=['Original Red','Original Blue'],slots=[1,2]){
  const source={replaySha256:sourceHash,canonicalManifestSha256:'c'.repeat(64),extractionRunId:'controlled-extraction'};
  return {sourceHash,sourceFileName:'unchanged.aoe2record',parserName:'CONTROLLED_TEST_WORKER',parserVersion:'test',
    adapterSchemaVersion:'test',canonicalSchemaVersion:'test',extractionRunId:source.extractionRunId,
    sourcePlayers:names.map((sourceName,i)=>({sourceName,replaySlot:slots[i]})),
    canonicalBundleBase64:bundle.toString('base64'),canonicalBundleSha256:hash(bundle),canonicalBundleBytes:bundle.length,
    statistics:{source,scope:{observedUntilMs:600000},participants:slots.map(replaySlot=>({playerId:replaySlot,replaySlot})),
      matchFacts:{modelVersion:'AOF_RECORDING_MATCH_FACTS_V1',identityNamespace:'CANONICAL_REPLAY_PLAYER_ID',source,
        players:slots.map(playerId=>({playerId})),game:{},map:{},rules:{},diplomacy:{},coverage:{},
        result:{qualification:'UNRESOLVED',winnerPlayerIds:null,loserPlayerIds:null},
        policy:{automaticResultSubmissionEnabled:false,rewardsEnabled:false,relationshipScoringEnabled:false,
          reputationScoringEnabled:false,rawFactsVisibleByDefault:false}}}};
}
function transport(t,getWorker){
  const payloads=[],objects=new Map();
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    assert.equal(url,'http://127.0.0.1:18765/process');
    const request=JSON.parse(options.body);payloads.push(request);
    return new Response(JSON.stringify(getWorker()),{status:200});
  });
  t.mock.method(getStorage(),'bucket',()=>({file:path=>({
    save:async value=>objects.set(path,Buffer.from(value)),download:async()=>[objects.get(path)],
    delete:async()=>objects.delete(path),
  })}));
  const previous={FUNCTIONS_EMULATOR:process.env.FUNCTIONS_EMULATOR,REPLAY_WORKER_URL:process.env.REPLAY_WORKER_URL,
    REPLAY_BUCKET:process.env.REPLAY_BUCKET};
  Object.assign(process.env,{FUNCTIONS_EMULATOR:'true',REPLAY_WORKER_URL:'http://127.0.0.1:18765',REPLAY_BUCKET:'demo-name-recovery.appspot.com'});
  t.after(()=>{for(const [key,value] of Object.entries(previous))if(value===undefined)delete process.env[key];else process.env[key]=value;});
  return {payloads,objects};
}

test('unknown recording names fail; audited per-Game bindings let the exact same source retry without learning Steam aliases',async t=>{
  const db=fixture(),before=db.get('players/alice'),io=transport(t,()=>worker());
  await assert.rejects(upload(),/Replay identity 'Original Red' cannot be bound uniquely/);
  assert.equal(db.get('matches/battle/games/G1').activeReplayStatisticsId,undefined);
  assert.equal(io.objects.size,0,'identity failure occurs before evidence persistence');
  await bind();
  const audit=[...db.values()].find(row=>row.action==='REPLAY_IDENTITIES_BOUND');
  assert.equal(audit.actorUid,'operator');assert.equal(audit.targetId,'battle/G1');
  assert.equal(audit.reason,'Verified recording names against the two approved original Game starters.');
  assert.deepEqual(audit.before,[]);assert.deepEqual(audit.after,db.get('matches/battle/games/G1').replayParticipantBindings);
  const accepted=await upload();
  assert.equal(accepted.sourceHash,sourceHash);
  assert.deepEqual(accepted.playerMapping.map(p=>[p.replaySlot,p.sourceName,p.playerId]),[[1,'Original Red','alice'],[2,'Original Blue','beren']]);
  assert.deepEqual(io.payloads[0],io.payloads[1],'retry uses the identical filename and recording bytes');
  assert.equal(db.get('matches/battle/games/G1').activeReplayStatisticsId,sourceHash);
  assert.deepEqual(db.get('players/alice'),before,'manual source name is not a reusable verified Steam alias');
  await assert.rejects(upload('G2'),/cannot be bound uniquely/,'binding is confined to its canonical Game');
  await assert.rejects(bind(),/before its first recording/,'late identity rewrite cannot rebind an accepted source');
});

test('current verified Steam persona and verified name history automatically resolve unique names',async t=>{
  const db=fixture();db.set('players/beren',{...db.get('players/beren'),steamNameHistory:['Prior Beren']});
  transport(t,()=>worker(['  CURRENT ALICE  ','Prior Beren']));
  const result=await upload();
  assert.deepEqual(result.playerMapping.map(row=>row.playerId),['alice','beren']);
  assert.equal([...db.values()].filter(row=>row.action==='REPLAY_IDENTITIES_BOUND').length,0);
  assert.equal(db.get('matches/battle/games/G1').replayParticipantBindings,undefined);
});

test('ambiguous verified names are never guessed; a foreign player and duplicate source slots remain rejected',async t=>{
  const db=fixture();db.set('players/alice',{...db.get('players/alice'),steamNameHistory:['Shared Name']});
  db.set('players/beren',{...db.get('players/beren'),steamNameHistory:['Shared Name']});
  let result=worker(['Shared Name','Current beren']);transport(t,()=>result);
  await assert.rejects(upload(),/cannot be bound uniquely/);
  result=worker(['Foreign player','Current beren']);
  await assert.rejects(upload(),/cannot be bound uniquely/);
  result=worker(['Current alice','Current beren'],[1,1]);
  await assert.rejects(upload(),/match facts roster differs/);
  assert.equal(db.get('matches/battle/games/G1').activeReplayStatisticsId,undefined);
  await assert.rejects(bind('G1','operator',[bindings[0],{sourceName:'Foreign player',playerId:'outsider'}]),/approved Game starters/);
  await assert.rejects(bind('G1','operator',[bindings[0],{...bindings[1],sourceName:' original red '}]),/Names and starters must be unique/);
});

test('participants and outsiders cannot bind names; outsider upload and closed or accepted Game binding are denied',async t=>{
  const db=fixture();transport(t,()=>worker());
  await assert.rejects(bind('G1','alice'),error=>error.code==='permission-denied');
  await assert.rejects(bind('G1','outsider'),error=>error.code==='permission-denied');
  await assert.rejects(upload('G1','outsider'),error=>error.code==='permission-denied');
  await assert.rejects(adminBindReplayParticipants.run({data:{matchId:'battle',gameId:'G1',bindings,reason:'unauthorized binding'}}),error=>error.code==='unauthenticated');
  db.set('matches/battle/games/G1',{...db.get('matches/battle/games/G1'),canonicalResult:{revision:1}});
  await assert.rejects(bind(),/before its first recording/);
  db.set('matches/battle/games/G1',{status:'READY',players:[{playerId:'alice'},{playerId:'beren'}]});
  db.set('matches/battle',{...db.get('matches/battle'),status:'COMPLETED'});
  await assert.rejects(bind(),/before its first recording/);
  assert.equal([...db.values()].filter(row=>row.action==='REPLAY_IDENTITIES_BOUND').length,0);
});
