import test from 'node:test';
import assert from 'node:assert/strict';
import {SeasonStatisticsExperience,seasonMetric} from '../src/domain/seasonStatistics';
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
  assert.equal(row.values.apm.value,20); // NOT (10+10+10+30)/4 = 15
  assert.equal(row.values.unitRequests.value,30); // (3*10 + 30)/2
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
  assert.deepEqual(engine.leaders('apm',2),[]); // partial player cannot win a lead
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
test('Missing Game measurement does not become zero or complete a leadership sample',()=>{
  const first=game('battle1','G1'),missing=game('battle1','G2');
  amount(missing,'a','unitRequests',null);
  const sample=new SeasonStatisticsExperience([first,missing]).aggregate()[0].values.unitRequests;
  assert.equal(sample.value,10);assert.equal(sample.samples,1);
  assert.equal(sample.eligibleGames,2);assert.equal(sample.observedGames,1);assert.equal(sample.completeBattles,0);
});
