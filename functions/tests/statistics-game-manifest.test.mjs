import test from 'node:test';
import assert from 'node:assert/strict';
import {db} from '../lib/config/firebase.js';
import {projectStatistics} from '../lib/engines/statisticsExperience.js';
import {augmentSeasonShowcase} from '../lib/engines/seasonShowcaseProjection.js';
import {collectStatistics,statisticsMetadata,statisticsGameManifest} from '../lib/services/statisticsExperienceProjection.js';

function fixture(){
  const players=[{playerId:'a',team:1},{playerId:'b',team:2}];
  const result={type:'PLAYER_WIN',source:'PLAYER_CONFIRMED',revision:1,winningPlayerIds:['a'],losingPlayerIds:['b']};
  const match={seasonId:'s',status:'COMPLETED',format:'ONE_V_ONE',participants:players,
    seriesRule:{maxGames:3,gamesRequiredToWin:2},canonicalResult:{...result,sourceGameId:'second',seriesGameRevisions:{first:1,second:1}}};
  const games=[{gameId:'first',gameNumber:1,status:'COMPLETED',canonicalResult:{...result},players,activeReplayStatisticsId:'source',replayStatisticsRevision:1},
    {gameId:'second',gameNumber:2,status:'COMPLETED',canonicalResult:{...result},players,activeReplayStatisticsId:'source',replayStatisticsRevision:1},
    {gameId:'terminal',gameNumber:3,status:'NO_CONTEST',resolutionReason:'Series decided by second',players}];
  return {match,games};
}

test('controlled finalized BO3 manifest distinguishes truly unused terminal Game from missing or withdrawn source',()=>{
  const {match,games}=fixture();
  assert.deepEqual(statisticsGameManifest(match,games),{knownGameIds:['first','second'],unusedGameIds:['terminal'],gameManifestComplete:true});
  delete games[1].activeReplayStatisticsId;
  assert.deepEqual(statisticsGameManifest(match,games).knownGameIds,['first','second'],
    'source withdrawal never removes the required Game identity');
  games[2].resolutionReason='unrelated cancellation';
  assert.deepEqual(statisticsGameManifest(match,games).knownGameIds,['first','second','terminal']);
  assert.deepEqual(statisticsGameManifest(match,games).unusedGameIds,[],
    'a NO_CONTEST label alone is not legitimate terminal proof');
});

test('controlled unresolved or corrected series cannot certify terminal omission or invent absent required Game IDs',()=>{
  const {match,games}=fixture();
  match.canonicalResult.seriesGameRevisions.second=2;
  const corrected=statisticsGameManifest(match,games);
  assert.deepEqual(corrected.knownGameIds,['first','second','terminal']);assert.deepEqual(corrected.unusedGameIds,[]);
  match.status='ACTIVE';delete match.canonicalResult;
  const unknown=statisticsGameManifest(match,[games[0]]);
  assert.deepEqual(unknown.knownGameIds,['first']);assert.equal(unknown.gameManifestComplete,false);
  games[1].canonicalResult={...games[1].canonicalResult,winningPlayerIds:['b'],losingPlayerIds:['a']};
  assert.equal(statisticsGameManifest(match,games.slice(0,2)).gameManifestComplete,false,
    'one win each requires a third authoritative numbered slot');
});

test('controlled unused exclusion rejects stale recording-result binding and recorded terminal Game',()=>{
  const {match,games}=fixture();
  games[1].canonicalResult.source='RECORDING_VERIFIED';
  games[1].recordingResultBinding={sourceHash:'withdrawn-source'};
  assert.deepEqual(statisticsGameManifest(match,games).unusedGameIds,[]);
  games[1].recordingResultBinding.sourceHash='source';
  games[2].activeReplayStatisticsId='unexpected-source';
  assert.deepEqual(statisticsGameManifest(match,games).unusedGameIds,[]);
});

test('controlled statistics transport carries fenced expected siblings and rejects concurrent correction',async()=>{
  const {match,games}=fixture(),records=new Map([['matches/m',match],['players/a',{steamName:'A'}],['players/b',{steamName:'B'}]]);
  for(const game of games)records.set('matches/m/games/'+game.gameId,game);
  for(const game of games.slice(0,2)){
    const source={state:'READY',sourceHash:'sha-'+game.gameId,playerMapping:[{replaySlot:1,playerId:'a'},{replaySlot:2,playerId:'b'}]};
    const raw={scope:{observedUntilMs:1800000},participants:[1,2].map(replaySlot=>({playerId:replaySlot,replaySlot}))};
    const metadata=statisticsMetadata('m',game.gameId,match,game,source);
    source.experience=augmentSeasonShowcase(raw,projectStatistics(raw,metadata),metadata);
    records.set('matches/m/games/'+game.gameId+'/replaySources/source',source);
  }
  let onRead=null;
  const snapshot=path=>{const value=structuredClone(records.get(path));return{id:path.split('/').at(-1),exists:records.has(path),data:()=>value,ref:reference(path)};};
  function reference(path,collection=false){return{path,id:path.split('/').at(-1),doc:id=>reference(path+'/'+id),collection:id=>reference(path+'/'+id,true),get:async()=>{
    const value=collection?{docs:[...records.keys()].filter(key=>key.startsWith(path+'/')&&key.split('/').length===path.split('/').length+1).map(snapshot)}:snapshot(path);
    onRead?.(path);return value;
  }};}
  Object.defineProperty(db,'collection',{configurable:true,value:path=>reference(path,true)});
  const first=await collectStatistics({matchId:'m'});
  assert.equal(first.games.length,2);
  for(const game of first.games){assert.deepEqual(game.knownGameIds,['first','second']);assert.deepEqual(game.unusedGameIds,['terminal']);assert.equal(game.gameManifestComplete,true);}
  games[1].activeReplayStatisticsId=null;
  const withdrawn=await collectStatistics({matchId:'m'});
  assert.equal(withdrawn.games.length,1);assert.equal(withdrawn.unavailableGames,1);
  assert.deepEqual(withdrawn.games[0].knownGameIds,['first','second']);
  games[1].activeReplayStatisticsId='source';
  const secondSource=records.get('matches/m/games/second/replaySources/source');
  secondSource.state='WITHDRAWN';
  const revoked=await collectStatistics({matchId:'m'});
  assert.equal(revoked.games.length,1);assert.deepEqual(revoked.games[0].knownGameIds,['first','second']);
  secondSource.state='READY';
  onRead=path=>{if(path.endsWith('/replaySources/source')){match.canonicalResult.seriesGameRevisions.second=2;onRead=null;}};
  await assert.rejects(collectStatistics({matchId:'m'}),error=>error.code==='aborted');
  match.canonicalResult.seriesGameRevisions.second=1;
  onRead=path=>{if(path.endsWith('/replaySources/source')){games[2].resolutionReason='corrected cancellation';onRead=null;}};
  await assert.rejects(collectStatistics({matchId:'m'}),error=>error.code==='aborted');
  const corrected=await collectStatistics({matchId:'m'});
  assert.deepEqual(corrected.games[0].knownGameIds,['first','second','terminal']);assert.deepEqual(corrected.games[0].unusedGameIds,[]);
});
