import test from 'node:test';
import assert from 'node:assert/strict';
import {SeasonStatisticsExperience,seasonMetric,recordStartCohort} from '../src/domain/seasonStatistics';
import type {GameStatistics,PlayerMeasurement} from '../src/domain/statistics';

function game(matchId:string,gameId='G1',contextKey='standard',revision=1):GameStatistics{
  const player=(id:string):PlayerMeasurement=>({
    playerId:id,name:id.toUpperCase(),team:null,civilization:'Franks',opening:null,mainUnit:null,
    values:{unitRequests:10,apm:60,scouting:50,castle:900000,greatBattles:1,buildOrderExecution:70},
    models:{unitRequests:'v1',apm:'v1',scouting:'v1',castle:'v1',greatBattles:'v1',buildOrderExecution:'v1'},
    unavailable:{},composition:null,responseTimes:[],byAge:{},details:[],
  });
  return {version:'test',matchId,gameId,seasonId:'s1',eventId:null,format:'ONE_V_ONE',contextKey,
    orderAtMs:Number(matchId.replace(/\D/g,''))*1000||1000,revision,sourceHash:matchId+':'+gameId+':'+revision,
    eligible:true,exclusionReason:null,affectsSeason:true,affectsLifetime:true,durationMs:2400000,
    players:[player('a'),player('b')],episodes:[],evidenceTruncated:false,warnings:[]};
}
function amount(g:GameStatistics,player:string,metric:string,value:number|null,model?:string){
  const p=g.players.find(p=>p.playerId===player)!;p.values[metric]=value;if(model)p.models[metric]=model;
}
test('Per Battle uses two independent observations for a 3-Game plus 1-Game series',()=>{
  const games=[game('battle1','G1'),game('battle1','G2'),game('battle1','G3'),game('battle2')];
  games.slice(0,3).forEach(g=>{amount(g,'a','apm',10);amount(g,'a','unitRequests',10);amount(g,'a','scouting',50);});
  amount(games[3],'a','apm',30);amount(games[3],'a','unitRequests',30);amount(games[3],'a','scouting',90);
  const engine=new SeasonStatisticsExperience(games),row=engine.aggregate().find(r=>r.playerId==='a')!;
  assert.equal(row.games,4);assert.equal(row.battles,2);assert.equal(engine.battleCount,2);
  assert.equal(row.values.apm.value,20); // Battle means: 10 and 30; not raw Game mean 15
  assert.equal(row.values.unitRequests.value,20); // (mean(10,10,10) + 30)/2; not 40 or 30
  assert.equal(row.values.scouting.value,70); // mean of Battle rates, not sum
  assert.equal(row.values.apm.samples,2);assert.equal(row.values.apm.eligibleBattles,2);
  assert.equal(engine.aggregate('allTime').find(r=>r.playerId==='a')!.values.unitRequests.value,60);
  assert.equal(engine.aggregate('allTime').find(r=>r.playerId==='a')!.values.scouting.value,70);
  assert.equal(new SeasonStatisticsExperience([game('battle3'),game('battle4')]).aggregate()[0].values.apm.samples,2);
});
test('Age timing takes a within-Battle median, then a median across Battles',()=>{
  const games=[game('battle1','G1'),game('battle1','G2'),game('battle1','G3'),game('battle2')];
  [600000,700000,1000000,900000].forEach((n,i)=>amount(games[i],'a','castle',n));
  assert.equal(new SeasonStatisticsExperience(games).aggregate()[0].values.castle.value,800000);
  assert.equal(seasonMetric('castle').aggregation,'median');
});
test('Mixed versions are partitioned; compatible observations remain usable but incomplete',()=>{
  const games=[game('battle1'),game('battle2'),game('battle3')];
  amount(games[0],'a','apm',20,'old');amount(games[1],'a','apm',30,'old');amount(games[2],'a','apm',100,'new');
  const engine=new SeasonStatisticsExperience(games),sample=engine.aggregate()[0].values.apm;
  assert.equal(sample.value,25);assert.equal(sample.samples,2);assert.equal(sample.eligibleBattles,3);
  assert.equal(sample.selectedModel,'old');assert.deepEqual(sample.excludedModels,['new']);
  assert.deepEqual(engine.leaders('apm',3),[]); // only two complete Battles use the comparable model
});
test('five fully comparable method Battles survive a separate method version, not a partial Game in those Battles',()=>{
  const games=Array.from({length:6},(_,i)=>game('battle'+(i+1)));
  for(const g of games){amount(g,'a','buildOrderExecution',90);amount(g,'b','buildOrderExecution',70);}
  amount(games[5],'a','buildOrderExecution',10,'v2');
  const engine=new SeasonStatisticsExperience(games),row=engine.aggregate().find(r=>r.playerId==='a')!;
  assert.equal(row.values.buildOrderExecution.samples,5);
  assert.equal(row.values.buildOrderExecution.eligibleBattles,6);
  assert.deepEqual(engine.leaders('buildOrderExecution',5),['a']);
  const partial=game('battle1','G2');
  amount(partial,'a','buildOrderExecution',null);
  assert.deepEqual(new SeasonStatisticsExperience([...games,partial]).leaders('buildOrderExecution',5),[],
    'a partially observed Game inside one of the selected Battles cannot establish a fully qualified lead');
});
test('five complete old-method Battles survive six incomplete new-method Battles',()=>{
  const complete=Array.from({length:5},(_,i)=>game('complete'+i));
  const partial=Array.from({length:6},(_,i)=>[game('partial'+i,'G1'),game('partial'+i,'G2')]).flat();
  for(const g of complete)for(const id of ['a','b'])amount(g,id,'buildOrderExecution',id==='a'?90:70,'old');
  for(const g of partial)for(const id of ['a','b'])amount(g,id,'buildOrderExecution',g.gameId==='G2'?null:id==='a'?90:70,'new');
  for(const games of [complete,[...complete,...partial]]){
    const engine=new SeasonStatisticsExperience(games),sample=engine.aggregate()[0].values.buildOrderExecution;
    assert.equal(sample.selectedModel,'old');assert.equal(sample.completeBattles,5);assert.equal(sample.samples,5);
    assert.equal(sample.value,90);assert.deepEqual(engine.leaders('buildOrderExecution'),['a']);
  }
  const reduced=complete.slice(0,4),engine=new SeasonStatisticsExperience([...reduced,...partial]);
  assert.equal(engine.aggregate()[0].values.buildOrderExecution.completeBattles,4);
  assert.deepEqual(engine.leaders('buildOrderExecution'),[],'partial new-method Battles cannot supply a fifth complete observation');
  assert.deepEqual(engine.aggregate()[0].values.buildOrderExecution.excludedModels,['new']);
  assert.equal(engine.games.filter(g=>g.matchId.startsWith('partial')).length,12,'excluded partial source remains inspectable');
});
test('a numerically unusable majority cannot displace complete duration-backed APM evidence',()=>{
  const complete=game('duration1');amount(complete,'a','apm',120,'old');
  const unusable=Array.from({length:6},(_,i)=>game('duration'+(i+2)));
  for(const g of unusable){g.durationMs=0;amount(g,'a','apm',999,'new');}
  const sample=new SeasonStatisticsExperience([complete,...unusable]).aggregate()[0].values.apm;
  assert.equal(sample.selectedModel,'old');assert.equal(sample.completeBattles,1);assert.equal(sample.value,120);
  assert.deepEqual(sample.excludedModels,['new']);
});
test('a shared five-Battle method cohort survives one player having a larger separate complete method',()=>{
  const shared=Array.from({length:5},(_,i)=>game('shared'+i));
  const separate=Array.from({length:6},(_,i)=>game('separate'+i));
  for(const g of shared)for(const id of ['a','b'])amount(g,id,'buildOrderExecution',id==='a'?90:70,'old');
  for(const g of separate){g.players=g.players.filter(p=>p.playerId==='a');amount(g,'a','buildOrderExecution',10,'new');}
  const engine=new SeasonStatisticsExperience([...shared,...separate]);
  assert.deepEqual(engine.leaderComparison('buildOrderExecution'),{ids:['a'],qualifiedPlayers:2,model:'old'});
  const a=engine.aggregate()[0].values.buildOrderExecution;
  assert.equal(a.selectedModel,'old');assert.equal(a.value,90);assert.equal(a.completeBattles,5);
  amount(shared[4],'b','buildOrderExecution',null);
  assert.deepEqual(new SeasonStatisticsExperience([...shared,...separate]).leaders('buildOrderExecution'),[],
    'a shared cohort needs five complete observations for each peer');
});
test('withdrawn known sibling prevents a false complete Battle; another partial Battle cannot veto five good ones',()=>{
  const games=Array.from({length:6},(_,i)=>game('battle'+(i+1)));
  for(const g of games){amount(g,'a','buildOrderExecution',90);amount(g,'b','buildOrderExecution',70);}
  const withdrawn=game('battle6','G2');withdrawn.eligible=false;
  const reduced=new SeasonStatisticsExperience([...games,withdrawn]),a=reduced.aggregate()[0].values.buildOrderExecution;
  assert.equal(a.completeBattles,5);assert.equal(a.partialBattles,1);
  assert.equal(a.samples,5);assert.equal(a.value,90);
  assert.deepEqual(reduced.leaders('buildOrderExecution',5),['a']);
  const earlier=game('battle1','G2');earlier.eligible=false;earlier.players=[]; // source withdrawn before roster mapping
  const insufficient=new SeasonStatisticsExperience([...games,withdrawn,earlier]);
  assert.equal(insufficient.aggregate()[0].values.buildOrderExecution.completeBattles,4);
  assert.deepEqual(insufficient.leaders('buildOrderExecution',5),[]);
  assert.equal(insufficient.aggregate('allTime')[0].values.buildOrderExecution.value,90);
});
test('scope filtering does not lose withdrawn siblings or resurrect revised out-of-season Games',()=>{
  const first=game('battle1','G1'),withdrawn=game('battle1','G2');
  withdrawn.eligible=false;withdrawn.affectsSeason=false;withdrawn.players=[];
  const e=new SeasonStatisticsExperience([first],[first,withdrawn]);
  assert.equal(e.games.length,1);
  assert.equal(e.aggregate()[0].values.buildOrderExecution.completeBattles,0);
  const revised=game('battle1','G1','standard',2);revised.affectsSeason=false;
  const corrected=new SeasonStatisticsExperience([first],[first,withdrawn,revised]);
  assert.equal(corrected.games.length,0,'new revision outside Season may not revive the old accepted Game');
});
test('explicit authoritative missing sibling manifest prevents invented completeness',()=>{
  const source=game('battle1') as GameStatistics&{knownGameIds?:string[]};
  source.knownGameIds=['G1','G2'];
  const e=new SeasonStatisticsExperience([source]);
  assert.equal(e.aggregate()[0].values.buildOrderExecution.completeBattles,0);
  assert.equal(e.aggregate()[0].values.buildOrderExecution.partialBattles,1);
});
test('within-Battle APM uses observed duration, raid response pools qualified episode evidence',()=>{
  const short=game('battle1','G1'),long=game('battle1','G2');
  short.durationMs=10*60_000;long.durationMs=100*60_000;
  amount(short,'a','apm',120);amount(long,'a','apm',20);
  amount(short,'a','response',3);amount(long,'a','response',100);
  short.players[0].responseTimes=[2,3,4];long.players[0].responseTimes=[100];
  short.players[0].models.response='response-model';long.players[0].models.response='response-model';
  const values=new SeasonStatisticsExperience([short,long]).aggregate()[0].values;
  assert.ok(Math.abs(values.apm.value!-29.09090909090909)<1e-8);
  assert.equal(values.response.value,3.5);
  assert.equal(values.response.samples,1);
  assert.equal(values.response.completeBattles,1);
  const missingDuration=game('battle1','G2','standard',2);missingDuration.durationMs=0;
  amount(missingDuration,'a','apm',20);
  const partial=new SeasonStatisticsExperience([short,missingDuration]).aggregate()[0].values.apm;
  assert.equal(partial.value,null);assert.equal(partial.completeBattles,0);
});
test('Five distinct fully measured Battles qualify peers despite newcomer and ordinary contexts',()=>{
  const games=Array.from({length:5},(_,i)=>game('battle'+(i+1),'G1',i%2?'other-ordinary-map':'standard'));
  for(const g of games){amount(g,'a','buildOrderExecution',90);amount(g,'b','buildOrderExecution',70);}
  const newcomer=game('battle6');newcomer.players=[{...newcomer.players[0],playerId:'c',name:'C'}];
  const engine=new SeasonStatisticsExperience([...games,newcomer]);
  assert.deepEqual(engine.leaders('buildOrderExecution',5),['a']);
  assert.deepEqual(engine.leaderComparison('buildOrderExecution',5),{ids:['a'],qualifiedPlayers:2,model:'v1'});
  amount(games[4],'a','buildOrderExecution',null);
  assert.deepEqual(new SeasonStatisticsExperience([...games,newcomer]).leaders('buildOrderExecution',5),[]);
});
test('Correction replaces superseded Game; POV duplicate does not add a Battle or alter totals',()=>{
  const first=game('battle1'),latest=game('battle1','G1','standard',2),duplicate=game('battle2');
  latest.sourceHash='new-valid-source';amount(latest,'a','unitRequests',30);
  duplicate.sourceHash=latest.sourceHash;
  const engine=new SeasonStatisticsExperience([first,latest,duplicate]);
  assert.equal(engine.games.length,1);assert.equal(engine.battleCount,1);
  assert.equal(engine.aggregate()[0].values.unitRequests.value,30);
  latest.eligible=false;
  assert.equal(new SeasonStatisticsExperience([first,latest]).games.length,0);
});
test('a withdrawn duplicate POV cannot suppress the one source-qualified Game',()=>{
  const invalid=game('battle0','G1'),valid=game('battle1','G1');
  invalid.eligible=false;invalid.sourceHash='identical-original';valid.sourceHash=invalid.sourceHash;
  amount(valid,'a','unitRequests',42);
  const e=new SeasonStatisticsExperience([invalid,valid]);
  assert.equal(e.games.length,1);
  assert.equal(e.knownGames.length,1);
  assert.equal(e.games[0].matchId,'battle1');
  assert.equal(e.aggregate()[0].values.unitRequests.value,42);
});
test('Missing Game measurement does not become zero or complete a leadership sample',()=>{
  const first=game('battle1','G1'),missing=game('battle1','G2');
  amount(missing,'a','unitRequests',null);
  const sample=new SeasonStatisticsExperience([first,missing]).aggregate()[0].values.unitRequests;
  assert.equal(sample.value,10);assert.equal(sample.samples,1);
  assert.equal(sample.eligibleGames,2);assert.equal(sample.observedGames,1);assert.equal(sample.completeBattles,0);
});

test('FFA diplomacy tribute requests remain visible without being declared delivered aid',()=>{
  const team=game('battle7'),ffa=game('battle8');
  team.format='TWO_V_TWO';team.players[0].team=1;team.players[1].team=1;
  ffa.format='FFA_DIPLO';ffa.players.forEach(p=>{p.team=null;});
  amount(team,'a','tributeSent',2346,'request-model');
  amount(ffa,'a','tributeSent',1000,'request-model');
  const engine=new SeasonStatisticsExperience([team,ffa]);
  const sample=engine.aggregate().find(row=>row.playerId==='a')!.values.tributeSent;
  assert.equal(sample.value,1673);assert.equal(sample.eligibleBattles,2);assert.equal(sample.eligibleGames,2);
  assert.equal(engine.aggregate('allTime').find(row=>row.playerId==='a')!.values.tributeSent.value,3346);
  assert.match(seasonMetric('tributeSent').label,/requested/i);
  assert.match(seasonMetric('tributeReceived').hint,/receipt not independently verified/i);
  assert.equal(seasonMetric('tradeUnits').eligibility,'team','team-only trade remains separate');
});
test('Normal civilization/map variation does not erase observations; special-start best stays only provisional',()=>{
  const standard=game('battle9','G1','ordinary map A');
  const ordinary=game('battle10','G1','ordinary map B');
  const special=game('battle11','G1','Nomad');
  ordinary.players[0].civilization='Mongols';special.players[0].civilization='Malians';
  amount(standard,'a','castle',850000);amount(ordinary,'a','castle',830000);amount(special,'a','castle',600000);
  const engine=new SeasonStatisticsExperience([standard,ordinary,special]);
  const observations=engine.records().filter(record=>record.metricId==='castle'&&record.playerId==='a');
  assert.equal(observations.length,3,'different contexts retain all evidence; no same-map/civ gate');
  assert.equal(engine.aggregate().find(row=>row.playerId==='a')!.values.castle.samples,3);
  // No start-equivalence field exists in GameStatistics, so UI must call these provisional
  // observations rather than publishing the nominal 600000 as a certified League FC record.
});

test('verified same-start age records compare across ordinary map and civilization, never Nomad or unknown',()=>{
  const a=game('record1','G1','Arabia'),b=game('record2','G1','Acropolis'),nomad=game('record3','G1','Nomad'),unknown=game('record4');
  const verified={status:'VERIFIED_SOURCE',startMode:'STANDARD',startingAge:'DARK',startingTownCenters:1,
    resourceMode:'STANDARD',gameSpeed:'NORMAL',environment:'LAND',patch:'P1',evidenceVersion:'record-start-V1'} as const;
  for(const g of [a,b])Object.assign(g,{startOpportunity:{...verified}});
  Object.assign(nomad,{startOpportunity:{...verified,startMode:'NOMAD',startingTownCenters:0}});
  a.players[0].civilization='Franks';b.players[0].civilization='Mongols';
  amount(a,'a','castle',850000);amount(b,'a','castle',820000);amount(nomad,'a','castle',590000);amount(unknown,'a','castle',550000);
  assert.equal(recordStartCohort(a),recordStartCohort(b));
  assert.notEqual(recordStartCohort(a),recordStartCohort(nomad));
  assert.equal(recordStartCohort(unknown),null);
  const records=new SeasonStatisticsExperience([a,b,nomad,unknown]).records().filter(r=>r.metricId==='castle'&&r.playerId==='a');
  assert.equal(records.filter(r=>r.startCohort===recordStartCohort(a)).length,2);
  assert.equal(records.filter(r=>r.startCohort===recordStartCohort(nomad)).length,1);
  assert.equal(records.filter(r=>r.startCohort===null).length,1);
  const amended=game('record2','G1','Acropolis',2);Object.assign(amended,{startOpportunity:{...verified}});
  amount(amended,'a','castle',810000);
  const corrected=new SeasonStatisticsExperience([a,b,nomad,unknown,amended]).records().filter(r=>r.metricId==='castle'&&r.playerId==='a');
  assert.equal(corrected.find(r=>r.matchId==='record2')?.value,810000);
  amended.eligible=false;
  assert.ok(!new SeasonStatisticsExperience([a,b,nomad,unknown,amended]).records().some(r=>r.matchId==='record2'));
});
