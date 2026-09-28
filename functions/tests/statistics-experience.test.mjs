import test from 'node:test';
import assert from 'node:assert/strict';
import {EXPERIENCE_VERSION,METRICS,StatisticsExperience,projectStatistics} from '../lib/engines/statisticsExperience.js';

export function game(index=0,patch={}){
  const players=['a','b','c'].map((id,i)=>({playerId:id,name:id.toUpperCase(),team:i===0?1:2,civilization:'FRANKS',opening:'Scout Rush',mainUnit:'Scout Cavalry',values:Object.fromEntries(METRICS.map(m=>[m.id,m.id==='response'?10:m.unit==='ms'?600000+i*10000:2+i])),models:Object.fromEntries(METRICS.map(m=>[m.id,'model-1'])),unavailable:{},composition:{cavalry:100},responseTimes:[10],byAge:{},details:[]}));
  return {version:EXPERIENCE_VERSION,matchId:'match-'+index,gameId:'G1',seasonId:'s',eventId:'e',format:'TWO_V_TWO',contextKey:'same-settings',orderAtMs:index+1,revision:1,sourceHash:'hash-'+index,eligible:true,exclusionReason:null,affectsSeason:true,affectsLifetime:true,durationMs:1800000,players,episodes:[],evidenceTruncated:false,warnings:[],...patch};
}
test('duplicate source, retried delivery and corrected revisions never double count',()=>{
  const original=game(),duplicate=game(1,{sourceHash:original.sourceHash}),correction=game(0,{revision:2});
  correction.players[0].values.raidsOut=19;
  const engine=new StatisticsExperience([original,original,correction,duplicate]);
  assert.equal(engine.games.length,1);assert.equal(engine.aggregate()[0].values.raidsOut.value,19);
  assert.equal(new StatisticsExperience([original,{...correction,eligible:false}]).games.length,0);
});
test('missing values remain unavailable; volume uses available sample denominator',()=>{
  const first=game(),second=game(1);second.players[0].values.raidsOut=null;
  const engine=new StatisticsExperience([first,second]);
  assert.deepEqual(engine.aggregate('average')[0].values.raidsOut,{value:2,samples:1,eligibleGames:2,models:['model-1']});
  assert.deepEqual(engine.leaders('raidsOut'),[]);
});
test('leader ties share stars, while all-equal, unknown and mixed models get none',()=>{
  const g=game();g.players[1].values.raidsOut=4;
  assert.deepEqual(new StatisticsExperience([g]).leaders('raidsOut'),['b','c']);
  g.players[0].values.raidsOut=4;assert.deepEqual(new StatisticsExperience([g]).leaders('raidsOut'),[]);
  g.players[0].values.raidsOut=2;g.players[0].models.raidsOut='other';assert.deepEqual(new StatisticsExperience([g]).leaders('raidsOut'),[]);
  for(const p of g.players)p.models.raidsOut='unknown';assert.deepEqual(new StatisticsExperience([g]).leaders('raidsOut'),[]);
});
test('typical-performance stars require five comparable Games, unlike Battle stars',()=>{
  assert.deepEqual(new StatisticsExperience([game()]).leaders('castle'),[]);
  assert.deepEqual(new StatisticsExperience([game()]).leaders('castle','total',1),['a']);
  const games=Array.from({length:5},(_,i)=>game(i));assert.deepEqual(new StatisticsExperience(games).leaders('castle'),['a']);
  games[4].contextKey='different start';assert.deepEqual(new StatisticsExperience(games).leaders('castle'),[]);
});
test('response latency pools episodes, timings use medians and opportunity counts stay totals',()=>{
  const games=[game(),game(1)];games[0].players[0].responseTimes=[2,4,6];games[1].players[0].responseTimes=[100];
  games[1].players[0].values.castle=1200000;
  const row=new StatisticsExperience(games).aggregate('average')[0];
  assert.equal(row.values.response.value,5);assert.equal(row.values.castle.value,900000);assert.equal(row.values.received.value,4);
});
test('army composition gives each Game equal weight and rejects empty compositions',()=>{
  const games=[game(),game(1),game(2)];games[0].players[0].composition={cavalry:1};games[1].players[0].composition={archers:999};games[2].players[0].composition={cavalry:0};
  const row=new StatisticsExperience(games).aggregate()[0];assert.equal(row.composition.cavalry,50);assert.equal(row.composition.archers,50);
});
test('record ties retain provenance, versions separate records, non-reaching rivals do not erase age records',()=>{
  const g=game();g.players[1].values.castle=g.players[0].values.castle;g.players[2].values.castle=null;
  const records=new StatisticsExperience([g,game(1,{contextKey:'other'})]).records().filter(r=>r.metricId==='castle');
  assert.deepEqual(records.map(r=>r.playerId),['a','b','a']);assert.equal(records[0].matchId,g.matchId);assert.equal(records[0].model,'model-1');
});
test('personal bests use only requested player and compatible prior samples',()=>{
  const games=Array.from({length:4},(_,i)=>game(i));games[3].players[0].values.raidsOut=10;
  assert.equal(new StatisticsExperience(games).personalBests('a').find(r=>r.metricId==='raidsOut').value,10);
  assert.deepEqual(new StatisticsExperience(games).personalBests('b'),[]);
  games[3].players[0].models.raidsOut='model-2';assert.deepEqual(new StatisticsExperience(games).personalBests('a'),[]);
});
test('lead change requires an established lead and identifies the source Game',()=>{
  const first=game(),second=game(1);second.players[0].values.raidsOut=20;
  const changes=new StatisticsExperience([first,second]).leadershipChanges();assert.ok(changes.some(h=>h.playerId==='a'&&h.matchId===second.matchId));
  assert.deepEqual(new StatisticsExperience([first]).leadershipChanges(),[]);
});
test('highlights cap results, preserve joint holders and leave ordinary play quiet',()=>{
  const g=game();for(const p of g.players)for(const id of ['raidsOut','assistsOut','forward'])p.values[id]=2;assert.deepEqual(new StatisticsExperience([g]).highlights(),[]);
  g.players[1].values.raidsOut=10;g.players[2].values.raidsOut=10;
  g.players[0].values.raidsOut=0;
  // A tied majority is routine relative to the median and must not invent drama.
  assert.deepEqual(new StatisticsExperience([g]).highlights(),[]);
  g.players.push({...structuredClone(g.players[0]),playerId:'d',name:'D'});
  const h=new StatisticsExperience([g]).highlights(1);assert.equal(h.length,1);assert.match(h[0].title,/B & C · joint/);
});
test('canonical projection maps directed evidence, null applicability, costs and recording bounds',()=>{
  const metadata={...game(),roster:[{playerId:'a'},{playerId:'b'}],mapping:[{replaySlot:1,playerId:'a'},{replaySlot:2,playerId:'b'}]};
  const participant=(slot)=>({replaySlot:slot,playerId:slot,buildOrder:{label:'Scout Rush'},opening:{ageUp:{feudal:{ageUpAtMs:999999}}},economy:{resourceCommitment:{resourcesCommitted:{total:50},coverage:{unpricedRequestCommands:1}}},military:{militaryUnitsTrained:{count:10},composition:{cavalry:8,dominantUnit:{name:'Scout Cavalry'}},engagements:{raidsInitiated:1,defensiveAssistsGiven:0,allyInteractionApplicability:{status:'not_applicable'},raidEvidence:{initiatedEpisodes:[{raidId:'r',attackerPlayerId:1,victimPlayerId:2,startedAtMs:10,endedAtMs:20}]}}},mapPresence:{wallTiles:{totalWallTiles:7}},execution:{raidResponse:{evidence:[{responseTimeMs:5000}]}}});
  const raw={scope:{observedUntilMs:10000},participants:[participant(1),participant(2)]};
  const projected=projectStatistics(raw,metadata),a=projected.players[0];
  assert.equal(a.values.total,null);assert.equal(a.values.feudal,null);assert.equal(a.values.assistsOut,null);assert.equal(a.values.walls,7);
  assert.equal(a.opening,'Scout Rush');assert.equal(a.composition.unknown,2);assert.deepEqual(a.responseTimes,[5]);
  assert.equal(projected.episodes.length,1);assert.deepEqual(projected.episodes[0].actors,['a']);assert.deepEqual(projected.episodes[0].targets,['b']);
  assert.throws(()=>projectStatistics(raw,{...metadata,mapping:[{replaySlot:1,playerId:'a'}]}),/mapping/);
});
