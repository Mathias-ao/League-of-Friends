import test from 'node:test';
import assert from 'node:assert/strict';
import {db} from '../lib/config/firebase.js';
import {projectStatistics} from '../lib/engines/statisticsExperience.js';
import {collectStatistics,rebuildStatisticsReadModels,statisticsMetadata} from '../lib/services/statisticsExperienceProjection.js';
import {getStatisticsExperience} from '../lib/queries/getStatisticsExperience.js';

test('authenticated reads and persisted totals follow active source, dispute, correction, opt-outs and deletion',async()=>{
  const records=new Map([
    ['authLinks/account',{playerId:'a'}],['players/a',{steamName:'A',membershipStatus:'ACTIVE',role:'PLAYER'}],['players/b',{steamName:'B',membershipStatus:'ACTIVE'}],['seasons/s',{status:'ACTIVE'}],
    ['matches/m',{seasonId:'s',eventId:'e',status:'COMPLETED',format:'ONE_V_ONE',context:{affectsSeasonStats:true,affectsLifetimeStats:true}}],
    ['matches/m/games/g',{status:'COMPLETED',canonicalResult:{revision:1},players:[{playerId:'a',team:1},{playerId:'b',team:2}],activeReplayStatisticsId:'source',replayStatisticsRevision:1}]
  ]);
  const snapshot=path=>({id:path.split('/').at(-1),exists:records.has(path),data:()=>records.get(path),ref:reference(path)});
  const query=(path,filters=[])=>({docs:[...records.keys()].filter(k=>k.startsWith(path+'/')&&k.split('/').length===path.split('/').length+1&&filters.every(([key,value])=>records.get(k)[key]===value)).map(snapshot)});
  function reference(path,isCollection=false,filters=[]){return {path,isCollection,filters,id:path.split('/').at(-1),doc:id=>reference(path+'/'+id),collection:id=>reference(path+'/'+id,true),where:(key,op,value)=>{assert.equal(op,'==');return reference(path,true,[...filters,[key,value]]);},get:async()=>isCollection?query(path,filters):snapshot(path)};}
  Object.defineProperty(db,'collection',{configurable:true,value:path=>reference(path,true)});
  Object.defineProperty(db,'runTransaction',{configurable:true,value:async callback=>{
    let wrote=false;const writes=[];
    await callback({get:async ref=>{assert.equal(wrote,false,'all transaction reads precede writes');return ref.isCollection?query(ref.path,ref.filters):snapshot(ref.path);},set:(ref,data)=>{wrote=true;writes.push(()=>records.set(ref.path,data));}});
    writes.forEach(w=>w());
  }});
  const match=records.get('matches/m'),g=records.get('matches/m/games/g');
  const source={state:'READY',sourceHash:'sha',playerMapping:[{replaySlot:1,playerId:'a'},{replaySlot:2,playerId:'b'}]};
  source.experience=projectStatistics({scope:{observedUntilMs:1},participants:[1,2].map(id=>({playerId:id,replaySlot:id,economy:{resourceCommitment:{modelVersion:'cost-v1',resourcesCommitted:{total:100*id}}}}))},statisticsMetadata('m','g',match,g,source));
  records.set('matches/m/games/g/replaySources/source',source);
  const request=data=>({data,auth:{uid:'account',token:{}},rawRequest:{}});
  await assert.rejects(getStatisticsExperience.run({data:{seasonId:'s'}}),e=>e.code==='unauthenticated');
  await assert.rejects(getStatisticsExperience.run(request({seasonId:'s',matchId:'m'})),e=>e.code==='invalid-argument');
  await assert.rejects(getStatisticsExperience.run(request({matchId:'m/games/g'})),e=>e.code==='invalid-argument');
  assert.equal((await getStatisticsExperience.run(request({seasonId:'other'}))).games.length,0);
  assert.equal((await getStatisticsExperience.run(request({seasonId:'s'}))).games[0].eligible,true);
  await rebuildStatisticsReadModels();await rebuildStatisticsReadModels();
  const lifetime=()=>records.get('players/a/statistics/experienceLifetime');
  const season=()=>records.get('seasons/s/statisticsExperience/a');
  assert.equal(lifetime().games,1);assert.equal(lifetime().values.total.value,100);assert.equal(season().games,1);
  g.activeResultDisputeId='dispute';
  assert.equal((await collectStatistics({matchId:'m'})).games[0].eligible,false);
  await rebuildStatisticsReadModels();assert.equal(lifetime().games,0);assert.equal(season().games,0);
  delete g.activeResultDisputeId;
  const correction=structuredClone(source);correction.sourceHash='replacement';correction.experience.players[0].values.total=350;
  records.set('matches/m/games/g/replaySources/new',correction);g.activeReplayStatisticsId='new';g.replayStatisticsRevision=2;
  await rebuildStatisticsReadModels();assert.equal(lifetime().values.total.value,350);
  match.context.affectsSeasonStats=false;await rebuildStatisticsReadModels();assert.equal(season().games,0);assert.equal(lifetime().games,1);
  match.context.affectsLifetimeStats=false;await rebuildStatisticsReadModels();assert.equal(lifetime().games,0);
  match.context.affectsLifetimeStats=true;await rebuildStatisticsReadModels();assert.equal(lifetime().games,1);
  records.delete('matches/m/games/g');await rebuildStatisticsReadModels();assert.equal(lifetime().games,0);assert.deepEqual(lifetime().values,{});
  records.get('players/a').membershipStatus='SUSPENDED';
  await assert.rejects(getStatisticsExperience.run(request({seasonId:'s'})),e=>e.code==='permission-denied');
});
