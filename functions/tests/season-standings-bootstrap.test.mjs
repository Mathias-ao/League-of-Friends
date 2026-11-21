import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {memoryFirestore} from './support/memory-firestore.mjs';
import {getLeagueBootstrap} from '../lib/queries/getLeagueBootstrap.js';
import {readSeasonCompetitionRecords} from '../lib/queries/seasonCompetitionRecord.js';
import {processMatchRewards} from '../lib/commands/processing/processMatchRewards.js';
import {seasonScoringSnapshot} from '../lib/engines/seasonPoints.js';
import {SYSTEM_RESULT_PROCESSING_ACTOR as system} from '../lib/services/resultProcessingActor.js';

// Controlled canonical/league authority fixtures. This is not a claim that the
// owner's new staging recordings or their real expected score were inspected.
const sha=value=>createHash('sha256').update(value).digest('hex');
const roster=[{playerId:'a',slot:1,team:1},{playerId:'b',slot:2,team:2}];
const result=(winner,revision=1)=>({revision,type:'TEAM_WIN',source:'PLAYER_CONFIRMED',
  winningPlayerIds:[winner],losingPlayerIds:[winner==='a'?'b':'a']});
function setup(){
  return memoryFirestore([
    ['leagueState/singleton',{activeSeasonId:'s',currentEmperorPlayerId:'emperor'}],
    ['seasons/s',{name:'Controlled Season',status:'ACTIVE'}],
    ...['a','b','emperor'].flatMap(id=>[
      ['players/'+id,{steamName:id,role:id==='emperor'?'ADMIN':'PLAYER',membershipStatus:'ACTIVE',goldBalance:0}],
      ['authLinks/'+id,{playerId:id}],
    ]),
  ]);
}
function addBattle(db,id,act,winner,{event='e1',revision=1,recording=false,stats=true}={}){
  const canonical={...result(winner,revision),sourceGameId:'G1'};
  if(recording)canonical.source='RECORDING_VERIFIED';
  const hash=sha('controlled original '+id),binding=recording?{sourceHash:hash}:undefined;
  db.set('events/'+event,{seasonId:'s',status:'COMPLETED'});
  db.set('matches/'+id,{seasonId:'s',eventId:event,status:'COMPLETED',format:'ONE_V_ONE',
    participants:roster,canonicalResult:canonical,context:{affectsSeasonStats:stats,affectsLeaguePoints:true,affectsGold:true},
    scoringSnapshot:seasonScoringSnapshot({act,diplomacyEnabled:false,placementPolicy:'NONE',emperorPlayerId:'emperor'}),
    goldRewardSnapshot:{matchCompletion:1,matchWin:2},activeResultDisputeId:null});
  db.set('matches/'+id+'/games/G1',{gameNumber:1,status:'COMPLETED',players:roster,canonicalResult:canonical,
    ...(recording?{activeReplayStatisticsId:hash,recordingResultBinding:binding,replayStatisticsState:'READY',replayStatisticsRevision:1}:{}),activeResultDisputeId:null});
  if(recording)db.set('matches/'+id+'/games/G1/replaySources/'+hash,
    {state:'READY',matchId:id,gameId:'G1',sourceHash:hash,replayStatisticsRevision:1,
      playerMapping:roster.map((p,i)=>({playerId:p.playerId,replaySlot:i+1})),privateArtifactField:'DO_NOT_PUBLISH'});
  db.set('processingJobs/MATCH_RESULT_'+id+'_R'+revision,
    {status:'PENDING',resultRevision:revision,pendingSteps:['SCORING','GOLD'],completedSteps:[]});
  for(const p of roster)db.set('events/'+event+'/scoringSlots/'+act+'_'+p.playerId,
    {matchId:id,seasonId:'s',playerId:p.playerId,act});
}
const score=id=>processMatchRewards({matchId:id,requestId:'controlled-'+id},system);
const read=(uid='a')=>getLeagueBootstrap.run({auth:{uid},data:{}});
const rows=value=>value.leaderboard.map(p=>[p.playerId,p.leaguePoints,p.wins,p.losses,p.rank]);

test('two Events with Event-owned best warmup ledgers retain the earned 26/10 points and four Battle records',async()=>{
  const db=setup();
  for(const event of ['e1','e2']){
    addBattle(db,event+'m','MAIN','b',{event});await score(event+'m');
    addBattle(db,event+'w','WARMUP','b',{event,recording:true});
    db.set('events/'+event,{...db.get('events/'+event),warmupMatchIds:[event+'w'],warmupPolicy:{scoringPolicy:'AOF_BEST_WARMUP_V1'}});
    db.set('matches/'+event+'w',{...db.get('matches/'+event+'w'),warmupScoringPolicy:'AOF_BEST_WARMUP_V1'});
    await score(event+'w');
  }
  assert.deepEqual(rows(await read()),[['b',26,4,0,1],['a',10,0,4,2]]);
  const ledger=()=>[...db.entries()].filter(([path])=>path.startsWith('leaguePointLedger/')).map(([,data])=>data);
  assert.ok(ledger().some(row=>row.eventWarmup&&row.matchId===null&&row.sourceMatchId==='e1w'));
  for(const id of ['a','b'])assert.equal(ledger().filter(row=>row.playerId===id).reduce((sum,row)=>sum+row.amountUnits,0),db.get('seasons/s/standings/'+id).leaguePointUnits);
  const before=JSON.stringify(ledger());for(const id of ['e1m','e1w','e2m','e2w'])await score(id);
  assert.equal(JSON.stringify(ledger()),before);
});

test('a correction between the standings Match read and the W–L transaction aborts instead of mixing revisions',async()=>{
  const db=setup();addBattle(db,'main','MAIN','a');
  const {db:firestore}=await import('../lib/config/firebase.js');
  const snapshots=(await firestore.collection('matches').get()).docs.map(doc=>{
    const data=structuredClone(doc.data());return {...doc,data:()=>data};
  });
  db.set('matches/main',{...db.get('matches/main'),activeResultDisputeId:'new-dispute'});
  await assert.rejects(readSeasonCompetitionRecords(snapshots),e=>e.code==='aborted');
});

test('four eligible warmup/main Battles expose unchanged points, tie ranking and canonical Season W–L',async()=>{
  const db=setup();
  const fixtures=[['w1','WARMUP','a','e1'],['m1','MAIN','b','e1'],['w2','WARMUP','b','e2'],['m2','MAIN','a','e2']];
  for(const [id,act,winner,event]of fixtures){addBattle(db,id,act,winner,{event});await score(id);}
  const view=await read();
  assert.deepEqual(rows(view),[['a',18,2,2,1],['b',18,2,2,1]]);
  assert.equal(view.emperor.playerId,'emperor');assert.equal(view.emperor.rank,undefined);
  assert.deepEqual([view.emperor.wins,view.emperor.losses],[0,0]);
  const before=[...db.entries()];await read();
  assert.deepEqual([...db.entries()],before,'bootstrap must not write/reconcile points');
  for(const [id]of fixtures)assert.equal((await score(id)).alreadyProcessed,true);
  assert.deepEqual(rows(await read()),rows(view));
});

test('canonical records are independent of selected warmup point slots and pending reward jobs',async()=>{
  const db=setup();addBattle(db,'first','WARMUP','a');await score('first');
  addBattle(db,'second','WARMUP','b');
  // Only the first Battle has earned points; both canonical statistical
  // Battles count. This avoids deriving W–L from selected scoring counters.
  const view=await read();
  assert.deepEqual(rows(view),[['a',3,1,1,1],['b',1,1,1,2]]);
  db.set('matches/second',{...db.get('matches/second'),context:{affectsSeasonStats:false}});
  assert.deepEqual(rows(await read()),[['a',3,1,0,1],['b',1,0,1,2]]);
});

test('disputed, void, pending and withdrawn recording-bound evidence cannot inflate W–L',async()=>{
  const db=setup();addBattle(db,'recorded','MAIN','a',{recording:true});await score('recorded');
  assert.deepEqual(rows(await read()),[['a',10,1,0,1],['b',4,0,1,2]]);
  const match=db.get('matches/recorded'),game=db.get('matches/recorded/games/G1');
  for(const status of ['VOID','DISPUTED','AWAITING_CONFIRMATION']){
    db.set('matches/recorded',{...match,status});
    assert.ok((await read()).leaderboard.every(p=>p.wins===0&&p.losses===0&&p.leaguePoints===0));
  }
  db.set('matches/recorded',match);
  const sourcePath='matches/recorded/games/G1/replaySources/'+game.activeReplayStatisticsId;
  const source=db.get(sourcePath);db.set(sourcePath,{...source,state:'WITHDRAWN'});
  assert.ok((await read()).leaderboard.every(p=>p.wins===0&&p.losses===0));
  db.set(sourcePath,source);db.set('matches/recorded/games/G1',{...game,activeReplayStatisticsId:sha('wrong source')});
  assert.ok((await read()).leaderboard.every(p=>p.wins===0&&p.losses===0));
  db.set('matches/recorded/games/G1',game);
  for(const change of [{replayStatisticsState:'UNAVAILABLE'},{replayStatisticsRevision:2}]){
    db.set('matches/recorded/games/G1',{...game,...change});
    assert.ok((await read()).leaderboard.every(p=>p.wins===0&&p.losses===0));
  }
  db.set('matches/recorded/games/G1',game);
  db.set(sourcePath,{...source,playerMapping:[]});
  assert.ok((await read()).leaderboard.every(p=>p.wins===0&&p.losses===0));db.set(sourcePath,source);
  assert.doesNotMatch(JSON.stringify(await read()),/DO_NOT_PUBLISH/);
});

test('correction uses current canonical winners once; unreconciled awards stay masked while W–L updates',async()=>{
  const db=setup();addBattle(db,'main','MAIN','a');await score('main');
  addBattle(db,'main','MAIN','b',{revision:2});
  const pending=await read();
  assert.ok(pending.leaderboard.every(p=>p.leaguePoints===0));
  assert.deepEqual(pending.leaderboard.map(p=>[p.playerId,p.wins,p.losses]),[['a',0,1],['b',1,0]]);
  await score('main');
  assert.deepEqual(rows(await read()),[['b',10,1,0,1],['a',4,0,1,2]]);
  assert.equal((await score('main')).alreadyProcessed,true);
  const game=db.get('matches/main/games/G1');
  db.set('matches/main/games/G1',{...game,canonicalResult:result('a',1)});
  assert.ok((await read()).leaderboard.every(p=>p.wins===0&&p.losses===0),'mismatched Game revision is not current Battle authority');
});

test('BO3 counts one Battle, ignores legitimate unused terminal Game and rejects incomplete/stale series',async()=>{
  const db=setup();addBattle(db,'series','MAIN','a');await score('series');
  const match=db.get('matches/series');
  const canonical={...match.canonicalResult,sourceGameId:'G2',seriesGameRevisions:{G1:1,G2:1}};
  db.set('matches/series',{...match,seriesRule:{maxGames:3,gamesRequiredToWin:2},canonicalResult:canonical});
  db.set('matches/series/games/G2',{gameNumber:2,status:'COMPLETED',players:roster,canonicalResult:result('a')});
  db.set('matches/series/games/G3',{gameNumber:3,status:'NO_CONTEST',players:roster,
    canonicalResult:null,activeReplayStatisticsId:null,resolutionReason:'Series decided by G2'});
  assert.deepEqual(rows(await read()),[['a',10,1,0,1],['b',4,0,1,2]]);
  const g2=db.get('matches/series/games/G2');db.delete('matches/series/games/G2');
  assert.ok((await read()).leaderboard.every(p=>p.wins===0&&p.losses===0));
  db.set('matches/series/games/G2',{...g2,canonicalResult:result('a',2)});
  assert.ok((await read()).leaderboard.every(p=>p.wins===0&&p.losses===0));
});

test('absent standings stay absent, unbound legitimate manual results need no replay, and access stays authenticated',async()=>{
  const db=setup();addBattle(db,'manual','MAIN','a');
  assert.deepEqual((await read()).leaderboard,[],'do not fabricate point balances from canonical results');
  await score('manual');
  assert.equal((await read()).leaderboard.find(p=>p.playerId==='a').wins,1);
  await assert.rejects(getLeagueBootstrap.run({data:{}}),e=>e.code==='unauthenticated');
  await assert.rejects(read('unlinked'),e=>e.code==='permission-denied');
  db.set('players/a',{...db.get('players/a'),membershipStatus:'INACTIVE'});
  await assert.rejects(read(),e=>e.code==='failed-precondition');
});
