import test from 'node:test';
import assert from 'node:assert/strict';
import {processMatchRewards} from '../lib/commands/processing/processMatchRewards.js';
import {SYSTEM_RESULT_PROCESSING_ACTOR as system} from '../lib/services/resultProcessingActor.js';
import {memoryFirestore} from './support/memory-firestore.mjs';

/**
 * These are already-accepted historical War Room Battles, NOT new invitations.
 * The challenge action gate is independent of the result reward processor.
 */
function fixture({winner='a',revision=1,seasonStatus='ACTIVE',existingWarCredit=false,warEnabled=true}={}){
  const matchId='war-original';
  const match={status:'COMPLETED',seasonId:'s1',format:'ONE_V_ONE',
    participants:[{playerId:'a',slot:1,team:1},{playerId:'b',slot:2,team:2}],
    canonicalResult:{revision,winningPlayerIds:[winner]},
    context:{type:'WAR_ROOM',affectsLeaguePoints:true,affectsWarRoomPoints:warEnabled,affectsGold:true},
    scoringSnapshot:{rules:{matchCompletionPoints:1,matchWinPoints:2,
      warRoomMatchCompletionPoints:0,warRoomMatchWinPoints:3}},
    goldRewardSnapshot:{matchCompletion:1,matchWin:2},
    activeResultDisputeId:null};
  const docs=[
    ['matches/'+matchId,match],
    ['seasons/s1',{status:seasonStatus}],
    ['players/a',{goldBalance:0}],
    ['players/b',{goldBalance:0}],
    ['processingJobs/MATCH_RESULT_'+matchId+'_R'+revision,
      {status:'PENDING',resultRevision:revision,pendingSteps:['SCORING','GOLD'],completedSteps:[]}],
  ];
  if(existingWarCredit){
    docs.push(['warRoomPointLedger/old-award',{seasonId:'s1',matchId,
      playerId:'a',component:'MATCH_WIN',amount:3,sourceVersion:1}],
      ['seasons/s1/warRoomStandings/a',{playerId:'a',warRoomPoints:3}]);
  }
  const db=memoryFirestore(docs);
  return {db,matchId,process:()=>processMatchRewards({matchId,requestId:'system-'+revision},system)};
}
const warEntries=db=>[...db.entries()].filter(([path])=>path.startsWith('warRoomPointLedger/')).map(([,value])=>value);
const leagueEntries=db=>[...db.entries()].filter(([path])=>path.startsWith('leaguePointLedger/')).map(([,value])=>value);

test('legacy accepted War Room result cannot mint a new competitive point; ordinary result ledgers still settle',async()=>{
  const {db,process}=fixture();
  const outcome=await process();
  assert.equal(outcome.alreadyProcessed,false);
  assert.equal(outcome.warRoomPointDelta,0);
  assert.deepEqual(warEntries(db),[]);
  assert.equal(db.has('seasons/s1/warRoomStandings/a'),false);
  assert.equal(db.has('seasons/s1/warRoomStandings/b'),false);
  assert.equal(db.get('seasons/s1/standings/a').leaguePoints,3);
  assert.equal(db.get('seasons/s1/standings/b').leaguePoints,1);
  assert.equal(db.get('players/a').goldBalance,3);
  assert.equal(db.get('players/b').goldBalance,1);
  assert.equal(db.get('matches/war-original').canonicalResult.winningPlayerIds[0],'a');
  assert.equal((await process()).alreadyProcessed,true);
  assert.deepEqual(warEntries(db),[]);
  assert.equal(leagueEntries(db).length,3,'result replay does not duplicate ordinary League credits');
});

test('correcting a prior legacy winner debits its old War credit but never transfers it to the new winner',async()=>{
  const {db,process}=fixture({winner:'b',revision:2,existingWarCredit:true});
  const outcome=await process();
  assert.equal(outcome.warRoomPointDelta,-3);
  assert.equal(db.get('seasons/s1/warRoomStandings/a').warRoomPoints,0);
  assert.equal(db.has('seasons/s1/warRoomStandings/b'),false);
  assert.deepEqual(warEntries(db).map(entry=>[entry.playerId,entry.amount]),[['a',3],['a',-3]]);
  assert.equal(db.get('seasons/s1/standings/b').leaguePoints,3);
  assert.equal(db.get('seasons/s1/standings/a').leaguePoints,1);
  assert.equal(db.get('players/b').goldBalance,3);
  assert.equal(db.get('players/a').goldBalance,1);
  assert.equal((await process()).alreadyProcessed,true);
  assert.deepEqual(warEntries(db).map(entry=>entry.amount),[3,-3]);
});

test('an unchanged historical legacy point stays in its audit ledger pending formal challenge review',async()=>{
  const {db,process}=fixture({existingWarCredit:true});
  const outcome=await process();
  assert.equal(outcome.warRoomPointDelta,0);
  assert.deepEqual(warEntries(db).map(entry=>entry.amount),[3]);
  assert.equal(db.get('seasons/s1/warRoomStandings/a').warRoomPoints,3);
  assert.equal(db.has('seasons/s1/warRoomStandings/b'),false);
  assert.equal((await process()).alreadyProcessed,true);
});

test('closed-Season result correction does not unlock replacement War credit or block independent ledgers',async()=>{
  const {db,process}=fixture({winner:'b',revision:2,existingWarCredit:true,seasonStatus:'CLOSED'});
  const outcome=await process();
  assert.equal(outcome.warRoomPointDelta,-3);
  assert.equal(db.get('seasons/s1/warRoomStandings/a').warRoomPoints,0);
  assert.equal(db.has('seasons/s1/warRoomStandings/b'),false);
  assert.equal(db.get('players/b').goldBalance,3);
  assert.equal(db.get('seasons/s1/standings/b').leaguePoints,3);
});

test('ordinary scoring with War Room context disabled stays completely separate',async()=>{
  const {db,process}=fixture({warEnabled:false});
  const outcome=await process();
  assert.equal(outcome.warRoomPointDelta,0);
  assert.equal(warEntries(db).length,0);
  assert.equal(db.get('seasons/s1/standings/a').leaguePoints,3);
  assert.equal(db.get('players/a').goldBalance,3);
});
