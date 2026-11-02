import test from 'node:test';
import assert from 'node:assert/strict';
import {EXPERIENCE_VERSION,StatisticsExperience} from '../lib/engines/statisticsExperience.js';
import {projectPlayerChronicle} from '../lib/engines/playerChronicleCore.js';

/**
 * One controlled historical input family, projected independently. This tests
 * correction/revision behavior; it does not pretend to be a decoded original
 * replay or a live source-to-browser acceptance run.
 */
const names={a:'Aldric',b:'Beren'};
const leagueHistory={modelVersion:'AOF_SOCIAL_HISTORY_V1',
  pairs:[{playerIds:['a','b'],tracks:{},exposure:{gameIds:[],battleIds:[],contexts:[],lastOrder:null}}],
  contributions:[],profiles:[]};
const roster=[{playerId:1,leaguePlayerId:'a',name:'Aldric'},
  {playerId:2,leaguePlayerId:'b',name:'Beren'}];
const source=(battle,revision)=>'source-'+battle+'-R'+revision;
const player=(id,castle)=>({
  playerId:id,name:names[id],team:1,civilization:'Franks',opening:null,mainUnit:null,
  values:{castle},models:{castle:'projected-castle-v1'},unavailable:{},composition:null,
  responseTimes:[],byAge:{},details:[],
});
function game(battle,revision,castle,{eligible=true}={}){
  return {version:EXPERIENCE_VERSION,matchId:'battle-'+battle,gameId:'G1',
    seasonId:'s1',eventId:'e1',format:'ONE_V_ONE',contextKey:'approved-settings',
    orderAtMs:battle*1000,revision,sourceHash:source(battle,revision),
    eligible,affectsSeason:true,affectsLifetime:true,exclusionReason:eligible?null:'SOURCE_WITHDRAWN',
    durationMs:1800000,players:[player('a',castle),player('b',720000)],
    episodes:[],evidenceTruncated:false,warnings:[],
  };
}
const beat=(battle)=>({
  id:'assist-'+battle,kind:'SUPPORT_PARTICIPATION',actorPlayerId:1,targetPlayerId:2,
  moment:{atMs:10000,operationOrdinal:100},
  sourceEventIds:['original-assist-'+battle],supportKind:'DEFENSIVE_PARTICIPATION',
});
function chapter(battle,revision,{accepted=true,hasBeat=true}={}){
  return {accepted,battleId:'battle-'+battle,gameIdentity:'battle-'+battle+'/G1',
    order:battle,chronologyQualified:true,sourceRevision:source(battle,revision),
    playedAtMs:1700000000000+battle*60000,eventId:'e1',seasonId:'s1',
    battleOutcome:{qualification:'OFFICIAL',resultRevision:1,winningPlayerIds:['a']},
    review:{status:'REVIEW_AVAILABLE',participants:roster,
      exposure:[{pairPlayerIds:[1,2],context:'LOCKED_TEAMMATES'}],
      chronicle:hasBeat?[beat(battle)]:[]},
  };
}
function scenes(chapters){
  return projectPlayerChronicle({ownerPlayerId:'a',chapters,history:leagueHistory,names})
    .pages.find(page=>page.counterpartPlayerId==='b')?.entries??[];
}
const castleRecord=(games)=>new StatisticsExperience(games).records()
  .filter(row=>row.metricId==='castle');
const baseGames=[game(1,1,540000),game(2,1,600000),game(3,1,660000)];
const baseChapters=[chapter(1,1),chapter(2,1),chapter(3,1)];

test('one early source correction revises a Game record and later historical callbacks without duplicating Battles',()=>{
  const beforeRecord=castleRecord(baseGames);
  const beforeScenes=scenes(baseChapters);
  assert.deepEqual(beforeRecord.map(row=>[row.matchId,row.gameId,row.value]),[['battle-1','G1',540000]]);
  assert.equal(beforeScenes.length,3);
  assert.equal(beforeScenes[2].narrativeContext.priorDirectedFamilyCounts['SUPPORT|a|b'],2);

  // Deliver the corrected source before a stale retry: canonical revision,
  // not upload arrival order, must decide the current Game measurement.
  const corrected=game(1,2,800000);
  const correctedChapter=chapter(1,2,{hasBeat:false});
  const currentGames=[corrected,...baseGames];
  const currentChapters=[correctedChapter,...baseChapters.slice(1)];
  const afterRecord=castleRecord(currentGames);
  const afterScenes=scenes(currentChapters);
  assert.equal(new StatisticsExperience(currentGames).games.length,3);
  assert.deepEqual(afterRecord.map(row=>[row.matchId,row.gameId,row.value]),[['battle-2','G1',600000]]);
  assert.equal(afterScenes.length,3);
  assert.deepEqual(afterScenes.map(row=>row.sceneId),beforeScenes.map(row=>row.sceneId),
    'three real Battles remain three stable pair histories');
  assert.equal(afterScenes[0].storyTier,'ORDINARY_LEDGER',
    'correcting the source deed removes its exceptional interpretation, not the encounter');
  assert.deepEqual(afterScenes[0].sourceBeatIds,[]);
  assert.notEqual(afterScenes[0].sceneRevision,beforeScenes[0].sceneRevision);
  assert.equal(afterScenes[2].narrativeContext.priorDirectedFamilyCounts['SUPPORT|a|b'],1);
  assert.notEqual(afterScenes[2].sceneRevision,beforeScenes[2].sceneRevision,
    'later callbacks depending on the earlier deed must refresh');
  assert.deepEqual(afterScenes[1].sourceBeatIds,beforeScenes[1].sourceBeatIds,
    'an unrelated Battle keeps its original factual deed');
  assert.deepEqual(scenes([...currentChapters].reverse()),afterScenes,
    'scheduler order wins over read/upload ordering');
});

test('withdrawal removes only the unsupported current Game and pair encounter, not the other two',()=>{
  const corrected=game(1,2,800000);
  const withdrawn=game(1,3,500000,{eligible:false});
  const current=new StatisticsExperience([...baseGames,corrected,withdrawn]);
  assert.deepEqual(current.games.map(g=>g.matchId),['battle-2','battle-3']);
  assert.deepEqual(castleRecord([...baseGames,corrected,withdrawn]).map(r=>r.matchId),['battle-2'],
    'withdrawn older timing cannot reclaim the fastest-record plaque');
  const after=scenes([chapter(1,3,{accepted:false,hasBeat:false}),...baseChapters.slice(1)]);
  assert.deepEqual(after.map(row=>row.battleId),['battle-2','battle-3']);
  assert.equal(new Set(after.map(row=>row.sceneId)).size,2);
  assert.equal(after[1].narrativeContext.priorDirectedFamilyCounts['SUPPORT|a|b'],1);
});
