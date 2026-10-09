import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {adminBindReplayParticipants} from '../lib/commands/admin/bindReplayParticipants.js';
import {normalizeReplayName} from '../lib/services/steamProfile.js';
import {memoryFirestore} from './support/memory-firestore.mjs';

const manifest=JSON.parse(readFileSync(new URL('./fixtures/replay-e2e-t90-manifest.json',import.meta.url),'utf8'));
const recordings=new Map(manifest.recordings.map(recording=>[recording.id,recording]));
const event=manifest.scenarios.eventRehearsal;
const longitudinal=manifest.scenarios.longitudinalIdentity;
const sourceToIdentity=new Map(longitudinal.identities.map(row=>[normalizeReplayName(row.sourceName),row.playerId]));
const adminUid='fixture-admin-uid';
const request=(data,uid=adminUid)=>({auth:{uid},data});

test('eight named fixtures define four 1v1s, three repeated-roster 2v2s, one 4v4 and 15 identities',()=>{
  assert.equal(manifest.schemaVersion,'AOF_REPLAY_E2E_FIXTURE_V1');
  assert.equal(manifest.evidenceStatus,'ROSTER_ONLY_AWAITING_ORIGINAL_RECORDINGS');
  assert.equal(recordings.size,8);
  assert.deepEqual(manifest.recordings.map(row=>row.format).sort(),
    ['ONE_V_ONE','ONE_V_ONE','ONE_V_ONE','ONE_V_ONE','TWO_V_TWO','TWO_V_TWO','TWO_V_TWO','FOUR_V_FOUR'].sort());
  const counts={ONE_V_ONE:2,TWO_V_TWO:4,FOUR_V_FOUR:8};
  for(const row of manifest.recordings){
    assert.equal(row.sourceNames.length,counts[row.format],row.id);
    assert.equal(new Set(row.sourceNames.map(normalizeReplayName)).size,row.sourceNames.length,row.id);
    assert.ok(row.sourceNames.some(name=>normalizeReplayName(name)==='t90official'),row.id);
    assert.equal(row.sourceSha256,null,'Hashes cannot be invented before extracting the original recording');
    assert.equal(row.gameGuid,null,'Game GUIDs cannot be invented before extracting the original recording');
  }
  assert.equal(manifest.recordings.reduce((n,row)=>n+row.sourceNames.length,0),28);
  const observed=new Set(manifest.recordings.flatMap(row=>row.sourceNames.map(normalizeReplayName)));
  assert.equal(observed.size,15);
  assert.equal(sourceToIdentity.size,15);
  assert.deepEqual([...observed].sort(),[...sourceToIdentity.keys()].sort());
  assert.equal(new Set(longitudinal.identities.map(row=>row.playerId)).size,15);
  const teamGames=manifest.recordings.filter(row=>row.format==='TWO_V_TWO');
  for(const row of teamGames.slice(1))assert.deepEqual(row.sourceNames,teamGames[0].sourceNames);
  assert.equal(normalizeReplayName('  NO  MAMES\u00a0'),'no mames');
  assert.equal(normalizeReplayName('VENÓN | BOTZANGA'),'venón | botzanga');
  assert.equal(normalizeReplayName('PUB | Fanjita'),'pub | fanjita');
});

test('longitudinal identity preserves the same T90 account across every recording',()=>{
  const t90=longitudinal.repeatedIdentity;
  assert.equal(t90.playerId,'SRC-T90');
  assert.equal(t90.expectedGameAppearances,8);
  const gamesWithT90=manifest.recordings.filter(row=>row.sourceNames.some(name=>sourceToIdentity.get(normalizeReplayName(name))===t90.playerId));
  assert.equal(gamesWithT90.length,8);
  assert.deepEqual(manifest.recordings.filter(row=>row.format==='TWO_V_TWO')[0].sourceNames.map(name=>sourceToIdentity.get(normalizeReplayName(name))),longitudinal.shared2v2Roster);
  assert.equal(longitudinal.allowSyntheticPlayerSwap,false);
  assert.equal(longitudinal.pointsMustNotMixWithEventRehearsal,true);
});

test('eight-account Event rehearsal has exactly four disjoint, explicitly synthetic warmup bindings',()=>{
  const all=event.warmups.flatMap(w=>w.bindings.map(b=>b.playerId));
  assert.equal(event.environment,'DEDICATED_DISPOSABLE_STAGING_ONLY');
  assert.deepEqual([...all].sort(),[...event.playerIds].sort());
  assert.equal(new Set(all).size,8);
  for(const warmup of event.warmups){
    const replay=recordings.get(warmup.recordingId);
    assert.ok(replay && replay.format==='ONE_V_ONE');
    assert.deepEqual(warmup.bindings.map(b=>normalizeReplayName(b.sourceName)).sort(),replay.sourceNames.map(normalizeReplayName).sort());
  }
  const t90Bindings=event.warmups.map(w=>w.bindings.find(b=>normalizeReplayName(b.sourceName)==='t90official').playerId);
  assert.deepEqual(t90Bindings,['TEST-01','TEST-03','TEST-05','TEST-07']);
  assert.equal(event.main.strategy,'TEAM_ALIGNED_AFTER_APPROVAL');
  assert.equal(event.main.bindings,null,'Main bindings must await the original recorded teams and approved Event topology');
  assert.equal(event.main.fixedBinding.playerId,'TEST-01');
  assert.equal(event.expectedIfAllQualified.totalBaseLeaguePoints,72);
});

test('the real Emperor callable stores isolated per-Game identity bindings with audit records',async()=>{
  const initial=[
    ['authLinks/'+adminUid,{playerId:'emperor'}],
    ['players/emperor',{role:'ADMIN',membershipStatus:'ACTIVE'}],
    ['authLinks/fixture-player-uid',{playerId:'TEST-01'}],
  ];
  for(const id of event.playerIds)initial.push(['players/'+id,{
    role:'PLAYER',membershipStatus:'ACTIVE',steamName:id,
    leagueAlias:id==='TEST-01'?'T90Official':id,
    steamPersonaName:'Unrelated actual Steam persona',
    steamIdentityVersion:'AOF_STEAM_IDENTITY_V1',
  }]);
  event.warmups.forEach((warmup,index)=>{
    const matchId='FIXTURE-W'+(index+1);
    const participants=warmup.bindings.map((b,i)=>({playerId:b.playerId,slot:i+1,team:i+1}));
    initial.push(['matches/'+matchId,{status:'READY',participants}]);
    initial.push(['matches/'+matchId+'/games/G1',{status:'READY',players:participants}]);
  });
  const records=memoryFirestore(initial);
  const t90Targets=[];
  for(let i=0;i<event.warmups.length;i++){
    const matchId='FIXTURE-W'+(i+1),warmup=event.warmups[i];
    const data={matchId,gameId:'G1',bindings:warmup.bindings,reason:'Synthetic historical replay mapping for isolated staging E2E tests.'};
    const result=await adminBindReplayParticipants.run(request(data));
    assert.equal(result.success,true);
    const game=records.get('matches/'+matchId+'/games/G1');
    assert.deepEqual(game.replayParticipantBindings,warmup.bindings.map(b=>({
      sourceNameNormalized:normalizeReplayName(b.sourceName),playerId:b.playerId,
    })));
    t90Targets.push(game.replayParticipantBindings.find(b=>b.sourceNameNormalized==='t90official').playerId);
    assert.ok([...records.keys()].some(key=>key.startsWith('adminAudit')||key.startsWith('audit')));
  }
  assert.equal(new Set(t90Targets).size,4,'Synthetic fixture mappings are Game-local, not verified Steam identity history');
  assert.equal(records.get('players/TEST-01').leagueAlias,'T90Official','The binding must not rewrite a display alias');
  await assert.rejects(adminBindReplayParticipants.run(request({
    matchId:'FIXTURE-W1',gameId:'G1',bindings:event.warmups[0].bindings,
    reason:'This player must not have administrator rights.',
  },'fixture-player-uid')),error=>error.code==='permission-denied');
  await assert.rejects(adminBindReplayParticipants.run(request({
    matchId:'FIXTURE-W1',gameId:'G1',
    bindings:[{sourceName:'Same',playerId:'TEST-01'},{sourceName:' same ',playerId:'TEST-02'}],
    reason:'Names that normalize identically are not unique.',
  })),/Names and starters must be unique/);
  await assert.rejects(adminBindReplayParticipants.run(request({
    matchId:'FIXTURE-W1',gameId:'G1',
    bindings:[{sourceName:'T90Official',playerId:'TEST-01'},{sourceName:'Dobbs351',playerId:'TEST-07'}],
    reason:'This replay participant is not an approved starter.',
  })),/Bind exactly the approved Game starters/);
});
