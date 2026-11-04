import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const here=dirname(fileURLToPath(import.meta.url));
const raw=JSON.parse(await readFile(resolve(here,'fixtures/recording-outcomes.json'),'utf8'));
/**
 * Test-only identities. A winning observed slot remains a winner; in this
 * controlled demonstration its assigned AoF member changes between originals.
 * Never claim these are four Battles played by two real league members.
 */
const pilot=[
  {event:1,act:'WARMUP',file:'1v1_1.aoe2record',guid:'848628a5-934d-e64b-8d79-59c60040918a',
    hash:'f00fdda9c14584c3b7f132fe48bf0543d2a0aa7108d9c781e4e4cf72ad70d181',
    names:{a:'T90Official',b:'Mr Greed'},winner:'a',mapId:9,build:180059},
  {event:1,act:'MAIN',file:'aof-test-game-1.aoe2record',guid:'546545a3-c0dd-764d-a466-2d33226a7926',
    hash:'df9fe94378c08d58e4d60b3f161c5f2f862d72f333472aad4cfdfa119730ed80',
    names:{a:'NOC | Target331',b:'T90Official'},winner:'b',mapId:140,build:185872},
  {event:2,act:'WARMUP',file:'aof-test-game-2.aoe2record',guid:'4e7bcea6-e296-564d-a814-837eedba4a87',
    hash:'f7eee7367005051dab146f0cec2734c344aa467844290323062f465c29e4b815',
    names:{a:'NOC | Target331',b:'T90Official'},winner:'b',mapId:140,build:185872},
  {event:2,act:'MAIN',file:'aof-test-game-3.aoe2record',guid:'b1e73ad5-49df-de43-a196-e36e4589d0e7',
    hash:'c0c32f6e04a4b678abfc48b76f02894b900b1b9141ca7285f6c8103c1b11f5da',
    names:{a:'T90Official',b:'Mununez'},winner:'a',mapId:9,build:185872},
];
test('Nov9 genuine original replay manifest: four bytes/hashes/GUIDs are independent and winners match real source slots',async()=>{
  const guids=new Set(),files=new Set();
  for(const item of pilot){
    const file=resolve(here,'../../replay-fixtures',item.file);
    const bytes=await readFile(file);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),item.hash,item.file);
    const evidence=raw.find(row=>row.filename===item.file);
    assert.ok(evidence,item.file+' has original decoder evidence');
    assert.equal(evidence.sourceHash,item.hash);
    const facts=evidence.matchFacts;
    assert.equal(facts.game.guid,item.guid);
    assert.equal(facts.headerFieldCandidates['de.build'],item.build);
    assert.equal(facts.rules.mapId.value,item.mapId);
    assert.equal(facts.players.length,2);
    assert.equal(evidence.players.length,2);
    assert.equal(facts.game.bodyParseComplete,true);
    const resigns=facts.result.resignationEvidence;
    assert.equal(resigns.length,1);
    assert.equal(resigns[0].disconnected,false);
    assert.equal(resigns[0].commandLayout,'de_legacy_resign_v1');
    assert.ok(facts.result.postgameEvidence.some(e=>e.timestampMs===facts.game.observedDurationMs
      &&e.decoded.world_time===facts.game.observedDurationMs));
    const map=Object.entries(item.names).map(([testPlayerId,sourceName])=>{
      const source=evidence.players.find(p=>p.name===sourceName);
      assert.ok(source,item.file+' original slot '+sourceName+' exists');
      return {testPlayerId,slot:source.replaySlot};
    });
    assert.equal(new Set(map.map(m=>m.slot)).size,2);
    const loser=map.find(m=>m.slot===resigns[0].replaySlot);
    assert.ok(loser);
    const winner=map.find(m=>m.slot!==resigns[0].replaySlot);
    assert.equal(winner.testPlayerId,item.winner,'Never reverse a verified real replay result');
    assert.ok(!guids.has(item.guid),'a different POV is the SAME Game, never a second Battle');
    assert.ok(!files.has(item.file));
    guids.add(item.guid);files.add(item.file);
  }
  assert.equal(guids.size,4);
  const outcomes=pilot.reduce((scores,item)=>{
    scores[item.winner]+=(item.act==='WARMUP'?3:10);
    scores[item.winner==='a'?'b':'a']+=(item.act==='WARMUP'?1:4);
    return scores;
  },{a:0,b:0});
  assert.deepEqual(outcomes,{a:18,b:18});
});
