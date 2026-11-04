import test from 'node:test';
import assert from 'node:assert/strict';
import {EXPERIENCE_VERSION,METRICS,StatisticsExperience,projectStatistics} from '../lib/engines/statisticsExperience.js';

test('decoded tribute request metrics remain applicable in FFA diplomacy, unlike fixed-team cooperation',()=>{
  const ffa=game(21,{format:'FFA_DIPLO'});
  for(const p of ffa.players){p.team=null;p.values.tributeSent=2346;p.values.tributeReceived=1000;}
  const row=new StatisticsExperience([ffa]).aggregate('average').find(player=>player.playerId==='a');
  assert.equal(row.values.tributeSent.value,2346);
  assert.equal(row.values.tributeReceived.value,1000);
  assert.equal(row.values.cooperation.value,null);
});

test('Statistics labels describe commands and requests, never completed tribute or combat outcomes',()=>{
  const labels=Object.fromEntries(METRICS.map(metric=>[metric.id,metric.label]));
  assert.match(labels.tributeSent,/outgoing tribute amount requested/i);
  assert.match(labels.tributeReceived,/incoming tribute amount requested/i);
  assert.doesNotMatch(labels.tributeReceived,/\b(received|delivered|supplied)\b/i);
  assert.match(labels.unitRequests,/requests/i);
  assert.match(labels.assistsOut,/detected.*commands/i);
  assert.match(labels.skirmishes,/detected/i);
});

export function game(index=0,patch={}){
  const players=['a','b','c'].map((id,i)=>({playerId:id,name:id.toUpperCase(),team:i===0?1:2,civilization:'FRANKS',opening:'Scout Rush',mainUnit:'Scout Cavalry',values:Object.fromEntries(METRICS.map(m=>[m.id,m.id==='response'?10:m.unit==='ms'?600000+i*10000:2+i])),models:Object.fromEntries(METRICS.map(m=>[m.id,'model-1'])),unavailable:{},composition:{cavalry:100},responseTimes:[10],byAge:{},details:[]}));
  return {startOpportunity:{status:'VERIFIED_SOURCE',startMode:'STANDARD',startingAge:'DARK',startingTownCenters:1,resourceMode:'STANDARD',gameSpeed:'NORMAL',environment:'LAND',patch:'P1',evidenceVersion:'source-V1'},version:EXPERIENCE_VERSION,matchId:'match-'+index,gameId:'G1',seasonId:'s',eventId:'e',format:'TWO_V_TWO',contextKey:'same-settings',orderAtMs:index+1,revision:1,sourceHash:'hash-'+index,eligible:true,exclusionReason:null,affectsSeason:true,affectsLifetime:true,durationMs:1800000,players,episodes:[],evidenceTruncated:false,warnings:[],...patch};
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
  assert.deepEqual(engine.aggregate('average')[0].values.raidsOut,{value:2,samples:1,eligibleGames:2,models:['model-1'],contributingGameKeys:[JSON.stringify(['match-0','G1'])]});
  assert.deepEqual(engine.leaders('raidsOut'),['c'],'complete comparable peers must not vanish because a third player is incomplete');
});
test('leader ties share stars, while all-equal, unknown and mixed models get none',()=>{
  const g=game();g.players[1].values.raidsOut=4;
  assert.deepEqual(new StatisticsExperience([g]).leaders('raidsOut'),['b','c']);
  g.players[0].values.raidsOut=4;assert.deepEqual(new StatisticsExperience([g]).leaders('raidsOut'),[]);
  g.players[0].values.raidsOut=2;g.players[0].models.raidsOut='other';assert.deepEqual(new StatisticsExperience([g]).leaders('raidsOut'),[]);
  for(const p of g.players)p.models.raidsOut='unknown';assert.deepEqual(new StatisticsExperience([g]).leaders('raidsOut'),[]);
});
test('typical-performance stars require five measured Games, but not identical ordinary context keys',()=>{
  assert.deepEqual(new StatisticsExperience([game()]).leaders('castle'),[]);
  assert.deepEqual(new StatisticsExperience([game()]).leaders('castle','total',1),['a']);
  const games=Array.from({length:5},(_,i)=>game(i));assert.deepEqual(new StatisticsExperience(games).leaders('castle'),['a']);
  games[4].contextKey='other ordinary map';assert.deepEqual(new StatisticsExperience(games).leaders('castle'),['a']);
});
test('legacy compatible method slices remain visible without numerical version mixing',()=>{
  const games=[game(),game(1),game(2)];
  games[0].players[0].values.raidsOut=20;games[1].players[0].values.raidsOut=30;games[2].players[0].values.raidsOut=100;
  games[2].players[0].models.raidsOut='model-2';
  const sample=new StatisticsExperience(games).aggregate('average').find(row=>row.playerId==='a').values.raidsOut;
  assert.equal(sample.value,25);assert.equal(sample.samples,2);assert.equal(sample.eligibleGames,3);
  assert.deepEqual(sample.models,['model-1']);
  assert.deepEqual(new StatisticsExperience(games).leaders('raidsOut','average',2),['a'],'the complete two-Game compatible slice is admitted and its value 25 leads the peers');
});
test('five compatible legacy Games retain qualified peers despite an excluded-model sixth',()=>{
  const games=Array.from({length:6},(_,i)=>game(i));
  for(const g of games){g.players=g.players.filter(p=>p.playerId!=='c');for(const p of g.players){p.values.forward=p.playerId==='a'?9:7;p.models.forward=g===games[5]?'v2':'v1';}}
  for(const input of [games.slice(0,5),games]){
    const engine=new StatisticsExperience(input),a=engine.aggregate('average')[0].values.forward;
    assert.equal(a.value,9);assert.equal(a.samples,5);assert.deepEqual(a.models,['v1']);
    assert.deepEqual(engine.leaders('forward','average',5),['a']);
  }
  assert.equal(new StatisticsExperience(games).aggregate('average')[0].values.forward.eligibleGames,6);
  assert.deepEqual(new StatisticsExperience(games.slice(1)).leaders('forward','average',5),[],
    'four compatible Games plus one excluded version do not meet the five-Game minimum');
  games[4].players[0].values.forward=null;
  assert.deepEqual(new StatisticsExperience(games).leaders('forward','average',5),[],
    'missing own-model source cannot count as the fifth measured Game');
  assert.deepEqual(new StatisticsExperience(games).leaders('forward','average',4),['a'],
    'four valid observations can compare when the explicit minimum is four; null does not erase them');
});
test('shared legacy model keeps displayed values and qualified leaders aligned despite a larger individual method',()=>{
  const shared=Array.from({length:5},(_,i)=>game(i)),separate=Array.from({length:6},(_,i)=>game(i+5));
  for(const g of shared){g.players=g.players.filter(p=>p.playerId!=='c');for(const p of g.players){p.values.forward=p.playerId==='a'?9:7;p.models.forward='old';}}
  for(const g of separate){g.players=g.players.filter(p=>p.playerId==='a');g.players[0].values.forward=1;g.players[0].models.forward='new';}
  const engine=new StatisticsExperience([...shared,...separate]),a=engine.aggregate('average')[0].values.forward;
  assert.equal(a.value,9);assert.equal(a.samples,5);assert.equal(a.eligibleGames,11);
  assert.deepEqual(a.models,['old']);assert.deepEqual(a.excludedModels,['new']);
  assert.deepEqual(a.contributingGameKeys,shared.map(g=>JSON.stringify([g.matchId,g.gameId])));
  assert.deepEqual(engine.leaders('forward','average',5),['a']);
  shared[4].players[0].values.forward=null;
  assert.deepEqual(new StatisticsExperience([...shared,...separate]).leaders('forward','average',5),[],
    'a missing own-model observation cannot establish a fifth complete shared sample');
  const missing=game(20);missing.players=[missing.players[0]];missing.players[0].values.forward=null;missing.players[0].models.forward='old';
  shared[4].players[0].values.forward=9;
  const partial=new StatisticsExperience([...shared,...separate,missing]);
  assert.deepEqual(partial.leaders('forward','average',5),['a'],
    'five measured Game observations retain a scoped comparison beside a sixth missing observation');
  const sample=partial.aggregate('average')[0].values.forward;
  assert.equal(sample.samples,5);assert.equal(sample.eligibleGames,12);
  assert.deepEqual(sample.contributingGameKeys,shared.map(g=>JSON.stringify([g.matchId,g.gameId])));
  shared[4].players[0].values.forward=null;
  assert.deepEqual(new StatisticsExperience([...shared,...separate,missing]).leaders('forward','average',5),[],
    'four measured Games plus two nulls never fulfil the minimum of five');
});
test('shared legacy age model uses its verified start cohort for both the displayed value and leadership',()=>{
  const standard=Array.from({length:5},(_,i)=>game(i)),nomad=Array.from({length:6},(_,i)=>game(i+5));
  for(const g of standard){g.players=g.players.filter(p=>p.playerId!=='c');for(const p of g.players){p.values.castle=p.playerId==='a'?600000:800000;p.models.castle='old';}}
  for(const g of nomad){g.startOpportunity={...g.startOpportunity,startMode:'NOMAD',startingTownCenters:0};g.players=g.players.filter(p=>p.playerId==='a');g.players[0].values.castle=200000;g.players[0].models.castle='new';}
  const engine=new StatisticsExperience([...standard,...nomad]),a=engine.aggregate()[0].values.castle;
  assert.equal(a.value,600000);assert.deepEqual(a.models,['old']);assert.deepEqual(a.excludedModels,['new']);
  assert.deepEqual(a.contributingGameKeys,standard.map(g=>JSON.stringify([g.matchId,g.gameId])));
  for(const g of nomad)g.players[0].models.castle='old';
  const sameMethod=new StatisticsExperience([...standard,...nomad]).aggregate()[0].values.castle;
  assert.equal(sameMethod.value,600000);assert.equal(sameMethod.samples,5);assert.equal(sameMethod.eligibleGames,11);
  assert.deepEqual(sameMethod.contributingGameKeys,standard.map(g=>JSON.stringify([g.matchId,g.gameId])));
  assert.deepEqual(new StatisticsExperience([...standard,...nomad]).leaders('castle'),['a']);
  assert.deepEqual(engine.leaders('castle'),['a']);
  standard[4].startOpportunity=null;
  assert.deepEqual(new StatisticsExperience([...standard,...nomad]).leaders('castle'),[],
    'four verified standard observations cannot borrow the unrelated sixth Nomad method');
});
test('Castle leader is not inferred from Nomad, Migration or unverified start despite same model',()=>{
  const games=Array.from({length:5},(_,i)=>game(i));
  for(const g of games){g.players[0].values.castle=600000;g.players[1].values.castle=800000;}
  assert.deepEqual(new StatisticsExperience(games).leaders('castle'),['a']);
  games[4].startOpportunity={...games[4].startOpportunity,startMode:'NOMAD',startingTownCenters:0};
  assert.deepEqual(new StatisticsExperience(games).leaders('castle'),[]);
  games[4].startOpportunity=null;
  assert.deepEqual(new StatisticsExperience(games).leaders('castle'),[]);
  // A non-age metric with admissible observations remains unaffected.
  assert.deepEqual(new StatisticsExperience(games).aggregate('average')[0].values.raidsOut.value,2);
});
test('five source-qualified standard Games survive separate sixth special-start Game',()=>{
  const games=Array.from({length:6},(_,i)=>game(i));
  for(const g of games){g.players[0].values.castle=600000;g.players[1].values.castle=800000;}
  games[5].startOpportunity={...games[5].startOpportunity,startMode:'NOMAD',startingTownCenters:0};
  games[5].players[0].values.castle=200000;
  const engine=new StatisticsExperience(games);
  assert.deepEqual(engine.leaders('castle'),['a'],'special start cannot outrank or erase the five comparable standard Games');
  const original=games[4];original.startOpportunity=null;
  assert.deepEqual(new StatisticsExperience(games).leaders('castle'),[],'four standard Games fail the five-Game qualification');
});
test('legacy qualified peers survive a newcomer, absent unrelated metric and ordinary context changes',()=>{
  const games=Array.from({length:5},(_,i)=>game(i,{contextKey:i%2?'ordinary-map-A':'ordinary-map-B'}));
  for(const g of games){g.players=g.players.filter(p=>p.playerId!=='c');g.players[0].values.castle=600000;g.players[1].values.castle=700000;}
  const newcomer=game(5);newcomer.players=[newcomer.players[2]];newcomer.players[0].values.castle=400000;
  assert.deepEqual(new StatisticsExperience([...games,newcomer]).leaders('castle'),['a']);
  games[4].players[0].values.castle=null;
  assert.deepEqual(new StatisticsExperience([...games,newcomer]).leaders('castle'),[]);
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
  assert.deepEqual(records.map(r=>r.playerId),['a','b'],'V1 Castle ties do not split into separate map cohorts');
  assert.equal(records[0].matchId,g.matchId);assert.equal(records[0].model,'model-1');
});
test('legacy V1 Castle record and personal best compare accepted Game times across maps and starts',()=>{
  const ordinary=Array.from({length:3},(_,i)=>game(i,{contextKey:'Arabia'}));
  const special=game(3,{contextKey:'Nomad',startOpportunity:null});
  for(const g of ordinary){g.players[0].values.castle=700000;g.players[1].values.castle=900000;g.players[2].values.castle=950000;}
  special.players[0].values.castle=500000;special.players[1].values.castle=500000;special.players[2].values.castle=950000;
  const engine=new StatisticsExperience([...ordinary,special]);
  const records=engine.records().filter(record=>record.metricId==='castle');
  assert.deepEqual(new Set(records.map(record=>record.playerId)),new Set(['a','b']),
    'identical fastest times on special-start Games tie across the entire Season');
  assert.ok(records.every(record=>record.value===500000&&record.contextKey==='Nomad'));
  assert.equal(engine.personalBests('a').find(record=>record.metricId==='castle')?.value,500000,
    'older personal-best presentation must not hold a separate Arabia-only Fast Castle best');
  const correction={...special,revision:2,sourceHash:'updated-source-hash',
    players:structuredClone(special.players)};
  correction.players[0].values.castle=800000;correction.players[1].values.castle=800000;
  const corrected=new StatisticsExperience([...ordinary,special,correction]);
  const holders=corrected.records().filter(record=>record.metricId==='castle');
  assert.deepEqual(holders.map(record=>record.playerId),['a'],'source correction restores the faster Arabia time');
  assert.equal(holders[0].value,700000);
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
  const participant=(slot)=>({replaySlot:slot,playerId:slot,buildOrder:{label:'Scout Rush'},opening:{ageUp:{feudal:{ageUpAtMs:999999}}},economy:{resourceCommitment:{resourcesCommitted:{total:50},coverage:{unpricedRequestCommands:1}}},military:{militaryUnitsTrained:{count:10},composition:{infantry:0,archers:0,cavalry:8,siege:0,monks:0,warships:0,navalSupport:0,otherLandMilitary:0,specialMilitary:0,dominantUnit:{name:'Scout Cavalry'}},engagements:{raidsInitiated:1,defensiveAssistsGiven:0,allyInteractionApplicability:{status:'not_applicable'},raidEvidence:{initiatedEpisodes:[{raidId:'r',attackerPlayerId:1,victimPlayerId:2,startedAtMs:10,endedAtMs:20}]}}},mapPresence:{wallTiles:{totalWallTiles:7}},execution:{raidResponse:{evidence:[{responseTimeMs:5000}]}}});
  const raw={scope:{observedUntilMs:10000},participants:[participant(1),participant(2)]};
  const projected=projectStatistics(raw,metadata),a=projected.players[0];
  assert.equal(a.values.total,null);assert.equal(a.values.feudal,null);assert.equal(a.values.assistsOut,null);assert.equal(a.values.walls,7);
  assert.equal(a.opening,'Scout Rush');assert.equal(a.composition.unknown,2);assert.deepEqual(a.responseTimes,[5]);
  assert.equal(projected.episodes.length,1);assert.deepEqual(projected.episodes[0].actors,['a']);assert.deepEqual(projected.episodes[0].targets,['b']);
  assert.throws(()=>projectStatistics(raw,{...metadata,mapping:[{replaySlot:1,playerId:'a'}]}),/mapping/);
});

test('scoring-selection masks cannot hide extra-warmup statistics, records or leaders',()=>{
 const first=game(0),extra=game(1,{countedEventPlayerIds:[]});
 extra.players[0].values.raidsOut=50;
 const engine=new StatisticsExperience([first,extra]),row=engine.aggregate().find(player=>player.playerId==='a');
 assert.equal(row.games,2);assert.equal(row.values.raidsOut.value,52);assert.equal(row.values.raidsOut.samples,2);
 assert.deepEqual(engine.leaders('raidsOut'),['a']);assert.equal(engine.records().find(record=>record.metricId==='raidsOut').matchId,'match-1');
 const corrected={...extra,revision:2,eligible:false};assert.equal(new StatisticsExperience([first,extra,corrected]).aggregate().find(player=>player.playerId==='a').values.raidsOut.value,2);
});
