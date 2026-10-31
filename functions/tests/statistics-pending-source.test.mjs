import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {fixture} from './support/native-ready-fixture.mjs';
import {db} from '../lib/config/firebase.js';
import {getStatisticsExperience} from '../lib/queries/getStatisticsExperience.js';
import {collectStatistics} from '../lib/services/statisticsExperienceProjection.js';
import {StatisticsExperience} from '../lib/engines/statisticsExperience.js';
import {selectEventShowcase} from '../lib/engines/eventRoundoffShowcase.js';

async function controlledPending(){
  const f=fixture(),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
  // This is a digest-pinned synthetic publication fixture, not a real recording.
  const raw=JSON.parse(gunzipSync(f.objects.get(f.candidate.statistics.path)));
  raw.scope={observedUntilMs:1800000};
  for(const player of raw.participants)player.execution={modelVersion:'controlled-execution-v1',apm:42};
  const plain=Buffer.from(JSON.stringify(raw)),bytes=gzipSync(plain);
  f.objects.set(f.candidate.statistics.path,bytes);
  Object.assign(f.candidate.statistics,{sha256:sha(bytes),bytes:bytes.length,uncompressedSha256:sha(plain),uncompressedBytes:plain.length});
  f.candidate.provenance.projectionRevision=sha(bytes);f.request.expectedArtifactSha256=sha(bytes);
  await f.run();
  const game=f.rows.get('matches/m/games/g'),match=f.rows.get('matches/m'),source=f.rows.get(f.sourcePath);
  Object.assign(match,{status:'ACTIVE',seasonId:'s',eventId:'e'});
  game.status='AWAITING_CONFIRMATION';delete game.canonicalResult;
  source.ordinaryUploadVersion='AOF_NATIVE_PLAYER_UPLOAD_V1';
  f.rows.set('authLinks/owner',{playerId:'p1'});
  let onRead=null;
  function wrap(reference){return{...reference,
    get:async()=>{const out=await reference.get();
      if(out.ref)out.ref=wrap(out.ref);
      if(out.docs)out.docs=out.docs.map(snapshot=>({...snapshot,ref:wrap(snapshot.ref)}));
      onRead?.(reference.path);return out;},
    ...(reference.collection?{collection:name=>wrap(reference.collection(name))}:{}),
    ...(reference.doc?{doc:name=>wrap(reference.doc(name))}:{}),
  };}
  Object.defineProperty(db,'collection',{configurable:true,value:name=>wrap(f.db.collection(name))});
  return{...f,game,match,source,onRead:callback=>onRead=callback};
}
const request=()=>({data:{matchId:'m'},auth:{uid:'owner',token:{}},rawRequest:{}});

test('controlled authenticated pending READY source exposes measurements without outcome, record, PB, victory or grant eligibility',async()=>{
  const previous=process.env.AOF_ACTIVE_NATIVE_PLAYER_READS;process.env.AOF_ACTIVE_NATIVE_PLAYER_READS='1';
  try{
    const f=await controlledPending(),before=JSON.stringify([...f.rows]);
    await assert.rejects(getStatisticsExperience.run({data:{matchId:'m'}}),error=>error.code==='unauthenticated');
    const dataset=await getStatisticsExperience.run(request()),game=dataset.games[0];
    assert.equal(game.players[0].values.apm,42);assert.equal(game.sourceMeasurementsEligible,true);
    assert.equal(game.eligible,false);assert.equal(game.exclusionReason,'Official Game result pending');
    assert.equal(game.orderAtMs,0,'no invented completion date');
    const legacy=new StatisticsExperience(dataset.games);
    assert.deepEqual(legacy.records(),[]);assert.deepEqual(legacy.personalBests('p1'),[]);
    assert.deepEqual(selectEventShowcase({eventId:'e',games:dataset.games,matches:[{
      matchId:'m',eventId:'e',status:'ACTIVE',format:'ONE_V_ONE',acceptedGameIds:['g'],participants:f.match.participants,result:null,
    }]}),[]);
    assert.equal(f.game.canonicalResult,undefined);assert.equal('grants' in dataset,false);
    assert.equal(JSON.stringify([...f.rows]),before,'authenticated statistics read has no effects');
    f.rows.get('players/p1').membershipStatus='SUSPENDED';
    await assert.rejects(getStatisticsExperience.run(request()),error=>error.code==='permission-denied');
  }finally{if(previous===undefined)delete process.env.AOF_ACTIVE_NATIVE_PLAYER_READS;else process.env.AOF_ACTIVE_NATIVE_PLAYER_READS=previous;}
});

test('controlled source admission rejects pending candidates, disputes, withdrawal, stale identities and malformed outcomes',async()=>{
  const previous=process.env.AOF_ACTIVE_NATIVE_PLAYER_READS;process.env.AOF_ACTIVE_NATIVE_PLAYER_READS='1';
  try{
    for(const mutate of [
      f=>{delete f.source.ordinaryUploadVersion;},
      f=>{f.source.state='VALIDATED_NOT_READY';},
      f=>{f.source.state='WITHDRAWN';},
      f=>{f.game.activeResultDisputeId='disputed';},
      f=>{f.match.activeResultDisputeId='disputed';},
      f=>{f.game.replayStatisticsRevision++;},
      f=>{f.game.replayStatisticsState='PENDING';},
      f=>{f.source.playerMapping[0].playerId='other';},
      f=>{f.game.canonicalResult={revision:1,winningPlayerIds:['forged']};},
    ]){
      const f=await controlledPending();f.source.experience.sourceMeasurementsEligible=true;mutate(f);
      assert.equal((await collectStatistics({matchId:'m'})).games.length,0);
    }
    const f=await controlledPending();process.env.AOF_ACTIVE_NATIVE_PLAYER_READS='0';
    assert.equal((await collectStatistics({matchId:'m'})).games.length,0);
  }finally{if(previous===undefined)delete process.env.AOF_ACTIVE_NATIVE_PLAYER_READS;else process.env.AOF_ACTIVE_NATIVE_PLAYER_READS=previous;}
});

test('controlled legacy cached flag is overwritten rather than promoting unqualified pending measurements',async()=>{
  const f=await controlledPending();
  delete f.source.nativePublicationVersion;delete f.source.recordedEvents;delete f.source.statistics;delete f.source.ordinaryUploadVersion;
  f.source.experience.sourceMeasurementsEligible=true;
  const game=(await collectStatistics({matchId:'m'})).games[0];
  assert.equal(game.eligible,false);assert.equal(game.sourceMeasurementsEligible,false);
});

test('controlled pending admission aborts when source qualification changes after its first read',async()=>{
  const previous=process.env.AOF_ACTIVE_NATIVE_PLAYER_READS;process.env.AOF_ACTIVE_NATIVE_PLAYER_READS='1';
  try{
    for(const mutate of [
      f=>{delete f.source.ordinaryUploadVersion;},
      f=>{f.source.replayStatisticsRevision++;},
      f=>{f.game.replayStatisticsState='PENDING';},
    ]){
      const f=await controlledPending();let reads=0;
      f.onRead(path=>{if(path==='matches/m'&&++reads===2)mutate(f);});
      await assert.rejects(collectStatistics({matchId:'m'}),error=>error.code==='aborted');
    }
  }finally{if(previous===undefined)delete process.env.AOF_ACTIVE_NATIVE_PLAYER_READS;else process.env.AOF_ACTIVE_NATIVE_PLAYER_READS=previous;}
});
