import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ready} from './support/private-history-fixture.mjs';
import {collectMyCurrentBattleHistory} from '../lib/queries/getMyPersonalityHistory.js';
import {getMyHonoursPreview,readMyHonoursPreview,assertPrivateHonoursPreviewEnabled} from '../lib/queries/getMyHonoursPreview.js';
import {projectPrivateHonoursPreview,HONOUR_TEST_BASELINE} from '../lib/integration/privateHonoursPreview.js';

const enabled=input=>({...input,env:{...input.env,AOF_HONOURS_PRIVATE_PREVIEW:'source-v1'}});
const base=JSON.parse(readFileSync(new URL('../../contracts/social-v1/fixtures/conformance.json',import.meta.url))).bases.SourceSnapshot;
function controlledFFA(){
  // Controlled contract fixtures: not an original FFA recording or entitlement.
  const source={...structuredClone(base),battleId:'battle1',matchId:'battle1',gameId:'game1',seasonId:'season1',
    gameGuid:'controlled-ffa',roster:[{playerId:'p1',replaySlot:1,teamId:null},{playerId:'p2',replaySlot:2,teamId:null},
      {playerId:'p3',replaySlot:3,teamId:null}],outcome:{qualification:'OFFICIAL',resultRevision:2,winningPlayerIds:['p1']}};
  const loaded={source,match:{format:'FFA'},game:{activeReplayStatisticsId:source.sourceHash,
    replayStatisticsRevision:source.statisticsRevision,canonicalResult:{type:'PLAYER_WIN',revision:2,winningPlayerIds:['p1']}}};
  return {battles:[{battleId:'battle1',gameIds:['game1'],sources:[loaded]}],loaded:[loaded],pending:[],
    inputDigest:'b'.repeat(64),coverage:{ownBattles:1}};
}
test('frozen ten concepts expose a sole official FFA candidate, never a grant or unaided-play claim',()=>{
  const input=controlledFFA(),p=projectPrivateHonoursPreview('p1',input);
  assert.equal(HONOUR_TEST_BASELINE.length,10);assert.equal(p.honours.length,10);
  const ffa=p.honours.find(h=>h.key==='FFA_SOLO_WIN');
  assert.equal(ffa.status,'SOURCE_CANDIDATE');assert.equal(ffa.independentBattles,1);
  assert.deepEqual(ffa.evidence,[p.sources[0]]);assert.equal(ffa.evidence[0].resultRevision,2);
  assert.match(ffa.reason,/does not prove never allied or unaided/);
  assert.equal(p.honours.filter(h=>h.status==='PENDING').length,9);
  assert.deepEqual(p.effects,{officialWrites:false,receiptPublication:false,entitlementGrants:false});
  assert.equal(p.honours.find(h=>h.key==='WONDER').status,'PENDING');
  assert.match(p.honours.find(h=>h.key==='WONDER').reason,/ordinary winner proves neither/);
});
test('FFA candidate requires the exact current sole official Game result and complete enumerated Battle',()=>{
  for(const change of [
    c=>c.loaded[0].source.outcome={qualification:'UNRESOLVED',resultRevision:null,winningPlayerIds:null},
    c=>c.loaded[0].game.canonicalResult.type='COALITION_WIN',
    c=>c.loaded[0].game.canonicalResult.revision=3,
    c=>c.loaded[0].game.canonicalResult.winningPlayerIds=['p2'],
    c=>c.loaded[0].match.format='ONE_V_ONE',
    c=>c.battles[0].gameIds.push('missing-game'),
    c=>c.pending.push({battleId:'battle1',gameId:'game1',reason:'CURRENT_NATIVE_SOURCE_PENDING'}),
  ]){const c=controlledFFA();change(c);const ffa=projectPrivateHonoursPreview('p1',c).honours.find(h=>h.key==='FFA_SOLO_WIN');
    assert.equal(ffa.status,'PENDING');assert.equal(ffa.independentBattles,0);assert.deepEqual(ffa.evidence,[]);}
  for(const change of [c=>c.loaded[0].game.activeReplayStatisticsId='f'.repeat(64),
    c=>c.loaded[0].game.replayStatisticsRevision++,c=>c.loaded.push(c.loaded[0])]){
    const c=controlledFFA();change(c);assert.throws(()=>projectPrivateHonoursPreview('p1',c));
  }
  assert.throws(()=>projectPrivateHonoursPreview('outsider',controlledFFA()));
});
test('several qualifying Games in one Battle remain one candidate Battle; correction rebuilds from current inputs',()=>{
  const c=controlledFFA(),second=structuredClone(c.loaded[0]);second.source.gameId='game2';second.source.gameGuid='controlled-ffa-2';
  c.loaded.push(second);c.battles[0].gameIds.push('game2');
  const first=projectPrivateHonoursPreview('p1',c);assert.equal(first.honours[4].independentBattles,1);
  c.loaded.splice(0);c.pending.push({battleId:'battle1',gameId:'game1',reason:'CURRENT_NATIVE_SOURCE_PENDING'});
  c.inputDigest='c'.repeat(64);const corrected=projectPrivateHonoursPreview('p1',c);
  assert.equal(corrected.honours[4].status,'PENDING');assert.deepEqual(corrected.honours[4].evidence,[]);
  assert.notEqual(corrected.inputDigest,first.inputDigest);
});
test('authenticated native intake is read-only and source-bound; known unsupported honours stay Pending',async()=>{
  const f=await ready(),input=enabled(f.input),before=JSON.stringify([...f.rows]);
  const p=await readMyHonoursPreview(input);
  assert.equal(p.ownerPlayerId,'p1');assert.equal(p.sources.length,1);assert.equal(p.sources[0].sourceHash,f.sourceHash);
  assert.equal(p.honours.length,10);assert.ok(p.honours.every(h=>h.status==='PENDING'));
  assert.equal(JSON.stringify([...f.rows]),before);
  f.rows.get('matches/m/games/g').canonicalResult.revision++;
  const revised=await readMyHonoursPreview(input);assert.notEqual(revised.inputDigest,p.inputDigest);
  assert.equal(revised.sources[0].resultRevision,p.sources[0].resultRevision+1);
  f.rows.get(f.sourcePath).state='WITHDRAWN';
  const withdrawn=await readMyHonoursPreview(input);assert.equal(withdrawn.sources.length,0);assert.equal(withdrawn.pendingSources.length,1);
  assert.ok(withdrawn.honours.every(h=>h.status==='PENDING'&&h.evidence.length===0));
});
test('default-off demo-emulator guard, authentication and no-target request prevent private evidence injection',async()=>{
  const f=await ready();
  assert.throws(()=>assertPrivateHonoursPreviewEnabled(f.input.env),e=>e.code==='failed-precondition');
  for(const env of [{...enabled(f.input).env,FUNCTIONS_EMULATOR:'false'},
    {...enabled(f.input).env,GCLOUD_PROJECT:'league-of-friends-cc274'},
    {...enabled(f.input).env,GCLOUD_PROJECT:'age-of-friends-staging'}])
    await assert.rejects(readMyHonoursPreview({...f.input,env}),e=>e.code==='failed-precondition');
  await assert.rejects(getMyHonoursPreview.run({data:{}}),e=>e.code==='unauthenticated');
  for(const key of ['playerId','source','rules','wonderMethodReview'])
    await assert.rejects(readMyHonoursPreview({...enabled(f.input),request:{[key]:'forged'}}),e=>e.code==='invalid-argument');
  await assert.rejects(readMyHonoursPreview({...enabled(f.input),actor:{playerId:'p2',authUid:'owner'}}),e=>e.code==='permission-denied');
});
test('native whole-set source, result and auth corrections during reads reject stale output',async()=>{
  for(const change of [
    f=>f.rows.get('matches/m/games/g').activeReplayStatisticsId='f'.repeat(64),
    f=>f.rows.get('matches/m/games/g').canonicalResult.revision++,
    f=>f.rows.get('authLinks/owner').playerId='p2',
    f=>f.rows.get(f.sourcePath).state='WITHDRAWN',
  ]){const f=await ready();let once=false;f.onDownload(()=>{if(!once){once=true;change(f);}});
    await assert.rejects(readMyHonoursPreview(enabled(f.input)));}
  const f=await ready(),current=await collectMyCurrentBattleHistory(f.input);
  f.rows.get('matches/m/games/g').replayStatisticsRevision++;
  await assert.rejects(current.revalidate());
});
