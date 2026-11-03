import test from 'node:test';
import assert from 'node:assert/strict';
import {memoryFirestore} from './support/memory-firestore.mjs';
import {processMatchRewards} from '../lib/commands/processing/processMatchRewards.js';
import {seasonScoringSnapshot,rankSeasonStandings} from '../lib/engines/seasonPoints.js';
import {SYSTEM_RESULT_PROCESSING_ACTOR as system} from '../lib/services/resultProcessingActor.js';

const fixtures=[
  {matchId:'e1-W1',eventId:'e1',act:'WARMUP',winner:'a'},
  {matchId:'e1-M1',eventId:'e1',act:'MAIN',winner:'b'},
  {matchId:'e2-W1',eventId:'e2',act:'WARMUP',winner:'b'},
  {matchId:'e2-M1',eventId:'e2',act:'MAIN',winner:'a'},
];
const participants=[{playerId:'a',slot:1,team:1},{playerId:'b',slot:2,team:2}];
function setup(){
  const entries=[
    ['seasons/s1',{status:'ACTIVE'}],
    ['players/a',{membershipStatus:'ACTIVE',goldBalance:0}],
    ['players/b',{membershipStatus:'ACTIVE',goldBalance:0}],
    ['events/e1',{seasonId:'s1',status:'ACTIVE'}],
    ['events/e2',{seasonId:'s1',status:'ACTIVE'}],
  ];
  for(const item of fixtures){
    const rules=seasonScoringSnapshot({act:item.act,diplomacyEnabled:false,
      placementPolicy:'NONE',emperorPlayerId:'operator'});
    entries.push(
      ['matches/'+item.matchId,{
        seasonId:'s1',eventId:item.eventId,status:'COMPLETED',format:'ONE_V_ONE',participants,
        canonicalResult:{revision:1,sourceGameId:'G1',winningPlayerIds:[item.winner]},
        context:{type:'SEASON_EVENT',affectsLeaguePoints:true,affectsWarRoomPoints:false,affectsGold:true},
        scoringSnapshot:rules,goldRewardSnapshot:{matchCompletion:1,matchWin:2},activeResultDisputeId:null,
      }],
      ['processingJobs/MATCH_RESULT_'+item.matchId+'_R1',{
        status:'PENDING',resultRevision:1,pendingSteps:['SCORING','GOLD'],completedSteps:[],
      }],
    );
    for(const p of participants){
      entries.push(['events/'+item.eventId+'/scoringSlots/'+item.act+'_'+p.playerId,{
        matchId:item.matchId,seasonId:'s1',playerId:p.playerId,act:item.act,
      }]);
    }
  }
  return memoryFirestore(entries);
}
const score=(db,id)=>db.get('seasons/s1/standings/'+id)?.leaguePoints??0;
const rank=(db)=>rankSeasonStandings(['a','b'].map(id=>({playerId:id,steamName:id,
  leaguePoints:score(db,id),
  leaguePointUnits:db.get('seasons/s1/standings/'+id)?.leaguePointUnits,
  mainEventWins:db.get('seasons/s1/standings/'+id)?.mainEventWins??0,
  warmupWins:db.get('seasons/s1/standings/'+id)?.warmupWins??0,
})));
const process=(matchId)=>processMatchRewards({matchId,requestId:'system-'+matchId},system);

test('Nov 9 POC: four distinct 1v1 warmup/main Battles update two Event standings independently',async()=>{
 const db=setup(),expected=[[3,1],[7,11],[8,14],[18,18]];
 for(let i=0;i<fixtures.length;i++){
   const outcome=await process(fixtures[i].matchId);
   assert.equal(outcome.warRoomPointDelta,0);
   assert.deepEqual([score(db,'a'),score(db,'b')],expected[i],fixtures[i].matchId);
   assert.equal((await process(fixtures[i].matchId)).alreadyProcessed,true,'no repeated reward');
 }
 const rows=rank(db);
 assert.deepEqual(rows.map(row=>[row.playerId,row.rank]),[['a',1],['b',1]]);
 assert.equal(rows[0].mainEventWins,1);
 assert.equal(rows[1].warmupWins,1);
 assert.equal([...db.entries()].filter(([path])=>path.startsWith('warRoomPointLedger/')).length,0);
 assert.equal(db.get('players/a').goldBalance,8,'Gold is independent of League Points');
 assert.equal(db.get('players/b').goldBalance,8);
 const before=rank(db);
 assert.deepEqual(rank(db),before,'rank is deterministic without a fabricated win-by-score');
});

test('Nov 9 POC: correcting one earlier MAIN outcome changes only its dependent points and tie-breaks',async()=>{
 const db=setup();
 for(const item of fixtures)await process(item.matchId);
 const oldMatch=db.get('matches/e1-M1');
 db.set('matches/e1-M1',{...oldMatch,canonicalResult:{...oldMatch.canonicalResult,
   revision:2,winningPlayerIds:['a']},processingState:'PENDING'});
 db.set('processingJobs/MATCH_RESULT_e1-M1_R2',
   {status:'PENDING',resultRevision:2,pendingSteps:['SCORING','GOLD'],completedSteps:[]});
 const result=await process('e1-M1');
 assert.equal(result.warRoomPointDelta,0);
 assert.deepEqual([score(db,'a'),score(db,'b')],[24,12]);
 assert.deepEqual(rank(db).map(row=>[row.playerId,row.rank,row.mainEventWins,row.warmupWins]),
   [['a',1,2,1],['b',2,0,1]]);
 assert.equal((await process('e1-M1')).alreadyProcessed,true);
 assert.deepEqual([score(db,'a'),score(db,'b')],[24,12],'no repeat credit after correction');
 assert.equal(db.get('seasons/s1/standings/a').mainEventsPlayed,2);
 assert.equal(db.get('seasons/s1/standings/b').warmupsPlayed,2);
});
