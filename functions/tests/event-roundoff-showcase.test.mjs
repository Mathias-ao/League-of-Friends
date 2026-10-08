import test from 'node:test';
import assert from 'node:assert/strict';
import {selectEventShowcase} from '../lib/engines/eventRoundoffShowcase.js';
import {EXPERIENCE_VERSION} from '../lib/engines/statisticsExperience.js';

function fixture(){
  const participants=Array.from({length:8},(_,i)=>({playerId:`p${i}`,team:i<4?1:2}));
  const main={matchId:'M1',eventId:'E1',status:'COMPLETED',scoringAct:'MAIN',participants,result:{revision:2,winningPlayerIds:['p0','p1','p2','p3']}};
  const warmups=Array.from({length:4},(_,i)=>({matchId:`W${i}`,eventId:'E1',status:'COMPLETED',scoringAct:'WARMUP',participants:participants.slice(i*2,i*2+2),result:{revision:1,winningPlayerIds:[`p${i*2}`]}}));
  const game={version:EXPERIENCE_VERSION,matchId:'M1',gameId:'G1',eventId:'E1',contextKey:'4v4 standard',revision:3,sourceHash:'a'.repeat(64),eligible:true,exclusionReason:null,durationMs:3000000,evidenceTruncated:false,players:participants.map((p,i)=>({...p,values:{assistsOut:i===4?4:1,castle:1100000+i*10000,army20:4000+i*100,cooperation:i===5?3:0,tributeSent:600+i*20,raidsOut:i===6?5:1,imperial:2100000+i*10000},models:Object.fromEntries(['assistsOut','castle','army20','cooperation','tributeSent','raidsOut','imperial'].map(id=>[id,'QUALIFIED_TEST_V1']))}))};
  return {eventId:'E1',matches:[main,...warmups],games:[game]};
}
const statisticItems=input=>selectEventShowcase(input).filter(i=>i.catalogueId!=='unbeaten');
test('showcase chooses five ranked, diverse cards with exact evidence and grouped ties',()=>{
  const input=fixture(),items=selectEventShowcase(input);
  assert.deepEqual(items.map(i=>i.catalogueId),['unbeaten','assistsOut','castle','army20','cooperation']);
  assert.deepEqual(items[0].playerIds,['p0','p2']);
  assert.deepEqual(items[0].sources.map(s=>s.matchId),['M1','W0','W1']);
  assert.equal(items[1].sources[0].revision,3);assert.equal(items[1].sources[0].sourceHash,'a'.repeat(64));
  assert.ok(items.every(item=>!['record','achievement'].includes(item.catalogueId)),'an Event maximum never becomes a newly broken record or earned award');
  for(const p of input.games[0].players)assert.ok(items.filter(i=>i.playerIds.includes(p.playerId)).length<=2);
  input.games[0].players[5].values.assistsOut=4;
  const tied=selectEventShowcase(input).find(i=>i.catalogueId==='assistsOut');assert.deepEqual(tied.playerIds,['p4','p5']);
});
test('selection is stable under shuffled matches, Games and player order',()=>{
  const input=fixture();assert.deepEqual(selectEventShowcase(input),selectEventShowcase({...input,matches:[...input.matches].reverse(),games:input.games.map(g=>({...g,players:[...g.players].reverse()}))}));
});
test('victory requires one confirmed winning warm-up and one confirmed winning main Battle',()=>{
  for(const mutate of [i=>i.matches[0].status='DISPUTED',i=>i.matches[0].result.revision=0,i=>i.matches[0].result.winningPlayerIds=['outsider'],i=>i.matches.push({...i.matches[0],matchId:'M2'}),i=>i.matches[0].result.winningPlayerIds=['p1','p3'],i=>i.matches[0].scoringAct=undefined]){
    const input=fixture();mutate(input);assert.ok(!selectEventShowcase(input).some(s=>s.catalogueId==='unbeaten'));
  }
});
test('unqualified, stale, conflicting and out-of-Event evidence produces no statistic cards',()=>{
  for(const mutate of [i=>i.games[0].eligible=false,i=>i.games[0].exclusionReason='disputed',i=>i.games[0].eventId='other',i=>i.games[0].version='old',i=>i.games[0].sourceHash='preview',i=>i.games[0].revision=0,i=>i.games[0].evidenceTruncated=true,i=>i.games.push(structuredClone(i.games[0])),i=>i.matches[0].status='DISPUTED',i=>i.games[0].players[0].playerId='outsider',i=>i.games[0].players[0].team=2,i=>i.matches.push(structuredClone(i.matches[0]))]){
    const input=fixture();mutate(input);assert.deepEqual(statisticItems(input),[]);
  }
});
test('unknown, illustrative and mixed metric models cannot create a production leader',()=>{
  for(const model of ['unknown','ILLUSTRATIVE_V3','DIFFERENT_V2']){
    const input=fixture();input.games[0].players[0].models.army20=model;assert.ok(!selectEventShowcase(input).some(s=>s.catalogueId==='army20'));
  }
  const input=fixture();for(const p of input.games[0].players)p.models.army20='ILLUSTRATIVE_V3';assert.ok(selectEventShowcase({...input,illustrative:true}).some(s=>s.catalogueId==='army20'));
});
test('missing, uniform, negative and non-finite metrics are never substituted with zero',()=>{
  for(const value of [null,-1,NaN,Infinity]){const input=fixture();input.games[0].players[0].values.army20=value;assert.ok(!selectEventShowcase(input).some(s=>s.catalogueId==='army20'));}
  const input=fixture();for(const p of input.games[0].players){p.values.assistsOut=0;p.values.army20=5000;p.values.castle=1100000;}
  const items=selectEventShowcase(input);for(const id of ['assistsOut','army20','castle'])assert.ok(!items.some(s=>s.catalogueId===id));
});
test('checkpoints and age completion must be observed; team support needs allied opportunities',()=>{
  const input=fixture();input.games[0].durationMs=1199999;
  assert.ok(!selectEventShowcase(input).some(s=>s.catalogueId==='army20'||s.catalogueId==='imperial'));
  for(const p of input.games[0].players){p.team=Number(p.playerId.slice(1));input.matches[0].participants.find(q=>q.playerId===p.playerId).team=p.team;}
  assert.ok(!selectEventShowcase(input).some(s=>['assistsOut','cooperation','tributeSent'].includes(s.catalogueId)));
});
test('partial age coverage is named, and sparse evidence leaves an honest short list',()=>{
  const input=fixture();for(const p of input.games[0].players){for(const key of Object.keys(p.values))p.values[key]=null;}
  input.games[0].players[0].values.castle=1100000;input.games[0].players[1].values.castle=1200000;
  const items=selectEventShowcase(input);assert.equal(items.length,2);assert.match(items[1].detail,/2 measured players/);
  input.matches=[];assert.deepEqual(selectEventShowcase(input),[]);
});
