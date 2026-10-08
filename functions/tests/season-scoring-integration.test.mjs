import test from 'node:test';
import assert from 'node:assert/strict';
process.env.GCLOUD_PROJECT='season-scoring-test';
const {db}=await import('../lib/config/firebase.js');
const {processMatchRewards}=await import('../lib/commands/processing/processMatchRewards.js');
const {adminVerifyFfaPlacements}=await import('../lib/commands/results/verifyFfaPlacements.js');
const {adminScheduleScoringWarmup}=await import('../lib/commands/events/scheduleScoringWarmup.js');
const {adminApproveMatchPlan}=await import('../lib/commands/events/approveMatchPlan.js');
const {adminResolveCanonicalResultDispute}=await import('../lib/commands/results/adminResolveCanonicalResultDispute.js');
const {submitGameResult}=await import('../lib/commands/results/submitGameResult.js');
const {respondToGameResult}=await import('../lib/commands/results/respondToGameResult.js');
const {scoringSnapshot,lockSeasonScoring,POINT_UNITS}=await import('../lib/engines/seasonScoring.js');
const records=new Map();let auto=0;
const snapshot=path=>({id:path.split('/').at(-1),exists:records.has(path),data:()=>records.get(path),ref:reference(path)});
const reference=(path,collection=false,filters=[])=>({path,id:path.split('/').at(-1),isCollection:collection,filters,
 doc:id=>reference(path+'/'+(id??'auto-'+(++auto))),collection:id=>reference(path+'/'+id,true),
 where:(field,op,value)=>reference(path,true,[...filters,[field,op,value]]),get:async()=>collection?query(path,filters):snapshot(path)});
function query(path,filters=[]){const docs=[...records.keys()].filter(k=>k.startsWith(path+'/')&&k.split('/').length===path.split('/').length+1)
 .filter(k=>filters.every(([field,op,value])=>{assert.equal(op,'==');return records.get(k)[field]===value;})).map(snapshot);return {docs,size:docs.length,empty:docs.length===0};}
Object.defineProperty(db,'collection',{value:path=>reference(path,true)});
Object.defineProperty(db,'runTransaction',{value:async callback=>{
 let wrote=false;const writes=[];const creates=new Set();
 const result=await callback({get:async ref=>{assert.equal(wrote,false,'Firestore reads must precede writes');return ref.isCollection?query(ref.path,ref.filters):snapshot(ref.path);},
 create:(ref,data)=>{assert.equal(records.has(ref.path)||creates.has(ref.path),false,'create targets a unique new entry');creates.add(ref.path);wrote=true;writes.push(()=>records.set(ref.path,data));},
 set:(ref,data,opt)=>{wrote=true;writes.push(()=>records.set(ref.path,opt?.merge?{...records.get(ref.path),...data}:data));},
 update:(ref,data)=>{assert.equal(records.has(ref.path),true);wrote=true;writes.push(()=>records.set(ref.path,{...records.get(ref.path),...data}));}});
 writes.forEach(f=>f());return result;
}});
const actor={authUid:'SYSTEM',playerId:null,source:'SYSTEM'};
const request=(data,uid='account')=>({auth:{uid,token:{}},data,rawRequest:{}});
const participants=Array.from({length:5},(_,i)=>({playerId:String(i+1),slot:i+1,team:null}));
const gameConfig={maps:{pool:[],selectionMode:'ADMIN'},civilizations:{mode:'UNRESTRICTED',allowed:[],banned:[],customRuleCode:null},victory:{conquest:true,wonder:false,relic:false,customRuleCode:null},diplomacyEnabled:false,additionalSettings:{}};
function job(id,rev){records.set(`processingJobs/MATCH_RESULT_${id}_R${rev}`,{status:'PENDING',resultRevision:rev,pendingSteps:['SCORING','GOLD'],completedSteps:[]});}
function reset(diplo=false){records.clear();auto=0;
 records.set('authLinks/account',{playerId:'admin'});records.set('players/admin',{role:'ADMIN',membershipStatus:'ACTIVE'});
 for(const p of participants){records.set('players/'+p.playerId,{role:'PLAYER',membershipStatus:'ACTIVE',goldBalance:0});records.set('seasons/s/participants/'+p.playerId,{status:'ENTERED'});records.set('authLinks/account-'+p.playerId,{playerId:p.playerId});}
 records.set('leagueState/singleton',{currentEmperorPlayerId:'5'});
 records.set('events/e',{seasonId:'s',status:'PUBLISHED',gameConfig:{...gameConfig,diplomacyEnabled:diplo},scoringSnapshot:scoringSnapshot(),goldRewardSnapshot:{matchCompletion:0,matchWin:0},placementRule:'VERIFIED_ELIMINATION',currentMatchPlanId:'plan'});
 const result={type:'PLAYER_WIN',winnerTeam:null,winnerPlayerId:'1',winningPlayerIds:['1'],losingPlayerIds:['2','3','4','5'],revision:1,source:'PLAYER_CONFIRMED',sourceGameId:'G1'};
 const lock=lockSeasonScoring({act:'MAIN_EVENT',format:'FFA',gameConfig:{...gameConfig,diplomacyEnabled:diplo},emperorPlayerId:'5',placementRule:'VERIFIED_ELIMINATION'});
 records.set('matches/m',{seasonId:'s',eventId:'e',format:'FFA',status:'COMPLETED',participants,canonicalResult:result,seriesRule:{maxGames:1,gamesRequiredToWin:1},gameConfigSnapshot:gameConfig,context:{affectsLeaguePoints:true},scoringSnapshot:scoringSnapshot(),seasonScoring:lock});
 records.set('matches/m/games/G1',{gameNumber:1,status:'COMPLETED',canonicalResult:result,players:participants});
 for(const p of participants)records.set('events/e/scoringSlots/MAIN_EVENT_'+p.playerId,{playerId:p.playerId,matchId:'m',act:'MAIN_EVENT'});
 job('m',1);
}
const points=id=>records.get('seasons/s/standings/'+id)?.leaguePoints;
const awardMatch=()=>processMatchRewards({matchId:'m',requestId:'ignored-system'},actor);
test('transactional awards are idempotent; verified placements reconcile only their deltas',async()=>{
 reset();await awardMatch();assert.equal(points('1'),12);assert.equal(points('2'),4);
 const size=records.size;await awardMatch();assert.equal(records.size,size);
 await adminVerifyFfaPlacements.run(request({requestId:'verify-0001',matchId:'m',expectedResultRevision:1,finishingOrder:['1','2','3','4','5'],evidence:'Reviewed complete elimination order in replay'}));
 await awardMatch();assert.equal(points('1'),12);assert.equal(points('2'),6);assert.equal(points('3'),5);
 assert.equal(records.get('seasons/s/standings/1').mainEventWins,1);assert.equal(records.get('seasons/s/standings/1').mainEventsPlayed,1);
 assert.equal(records.get('matches/m').seasonScoringSummary.placementStatus,'VERIFIED');
 await assert.rejects(adminVerifyFfaPlacements.run(request({requestId:'verify-0002',matchId:'m',expectedResultRevision:1,finishingOrder:['1','2','3','4','5'],evidence:'stale'})),e=>e.code==='aborted');
 const ledger=[...records.entries()].filter(([k])=>k.startsWith('leaguePointLedger/')).map(([,v])=>v);
 assert.equal(ledger.filter(e=>e.sourceVersion===2).every(e=>e.component==='FFA_PLACEMENT'),true);
});
test('placement correction and winner correction reverse previous bonuses and rebuild win counters',async()=>{
 reset();await adminVerifyFfaPlacements.run(request({requestId:'verify-0001',matchId:'m',expectedResultRevision:1,finishingOrder:['1','2','3','4','5'],evidence:'reviewed'}));await awardMatch();
 await adminVerifyFfaPlacements.run(request({requestId:'verify-0002',matchId:'m',expectedResultRevision:2,finishingOrder:['1','3','2','4','5'],evidence:'corrected order'}));await awardMatch();assert.equal(points('2'),5);assert.equal(points('3'),6);
 records.get('matches/m').activeResultDisputeId='d';records.get('matches/m').status='DISPUTED';
 records.get('matches/m/games/G1').activeResultDisputeId='d';records.get('matches/m/games/G1').status='DISPUTED';
 records.set('matches/m/games/G1/resultDisputes/d',{status:'OPEN',resultRevision:3});
 await adminResolveCanonicalResultDispute.run(request({requestId:'correct-0001',matchId:'m',gameId:'G1',disputeId:'d',resolution:'CORRECT',winnerPlayerId:'5',reason:'Verified corrected winner'}));
 await awardMatch();assert.equal(points('1'),4);assert.equal(points('2'),4);assert.equal(points('3'),4);assert.equal(points('5'),10);
 assert.equal(records.get('seasons/s/standings/1').mainEventWins,0);assert.equal(records.get('seasons/s/standings/5').mainEventWins,1);
 assert.equal(records.get('matches/m').seasonScoringSummary.placementStatus,'PENDING');
});
test('shared FFA correction rescales original awards without resetting event opportunities',async()=>{
 reset(true);await awardMatch();
 const m=records.get('matches/m');m.canonicalResult={...m.canonicalResult,type:'COALITION_WIN',coalitionPlayerIds:['1','2'],winnerPlayerId:null,winningPlayerIds:['1','2'],revision:2};job('m',2);
 await awardMatch();assert.equal(points('1'),9);assert.equal(points('2'),9);assert.equal(points('5'),4);
 assert.equal(records.get('seasons/s/standings/1').leaguePointUnits,9*POINT_UNITS);
 assert.equal(records.get('events/e/scoringSlots/MAIN_EVENT_1').matchId,'m');
});
test('second Match in one act, missing slots and open disputes cannot award points',async()=>{
 reset();records.get('events/e/scoringSlots/MAIN_EVENT_1').matchId='another';await assert.rejects(awardMatch(),/designated/);assert.equal(points('1'),undefined);
 reset();records.get('matches/m').activeResultDisputeId='d';await assert.rejects(awardMatch(),/dispute/);
});
test('match-plan approval locks Emperor, reserves opportunities and opts diplomatic FFA out of ratings',async()=>{
 reset(true);for(const p of participants)records.delete('events/e/scoringSlots/MAIN_EVENT_'+p.playerId);
 records.set('events/e/matchPlans/plan',{status:'PROPOSED',matches:[{format:'FFA',participants}]});
 await adminApproveMatchPlan.run(request({requestId:'approve-0001',eventId:'e',planId:'plan'}));
 const m=records.get('matches/plan-M1');assert.equal(m.seasonScoring.emperorPlayerId,'5');assert.equal(m.context.affectsPowerRating,false);
 records.get('leagueState/singleton').currentEmperorPlayerId='1';assert.equal(m.seasonScoring.emperorPlayerId,'5');
 records.get('events/e').currentMatchPlanId='other';records.set('events/e/matchPlans/other',{status:'PROPOSED',matches:[{format:'FFA',participants}]});
 await assert.rejects(adminApproveMatchPlan.run(request({requestId:'approve-0002',eventId:'e',planId:'other'})),/designated/);
});
test('warm-up scheduling reserves a separate act and refuses duplicate opportunities',async()=>{
 reset();const roster=[{playerId:'1',slot:1,team:1},{playerId:'2',slot:2,team:2}];
 const r=await adminScheduleScoringWarmup.run(request({requestId:'warmup-0001',eventId:'e',format:'ONE_V_ONE',participants:roster}));
 assert.equal(records.get('matches/'+r.matchId).seasonScoring.act,'WARMUP');assert.equal(records.get('events/e/scoringSlots/MAIN_EVENT_1').matchId,'m');
 await assert.rejects(adminScheduleScoringWarmup.run(request({requestId:'warmup-0002',eventId:'e',format:'ONE_V_ONE',participants:roster})),/designated/);
});
test('player coalition submission and confirmation persist an explicit accepted group',async()=>{
 reset(true);const m=records.get('matches/m');m.status='READY';m.canonicalResult=null;
 const g=records.get('matches/m/games/G1');g.status='READY';g.canonicalResult=null;
 await submitGameResult.run(request({matchId:'m',gameId:'G1',coalitionPlayerIds:['2','1']},'account-1'));
 await respondToGameResult.run(request({matchId:'m',gameId:'G1',submissionId:'1',response:'CONFIRM'},'account-3'));
 assert.deepEqual(records.get('matches/m').canonicalResult.winningPlayerIds,['1','2']);
 assert.equal(records.get('matches/m').canonicalResult.type,'COALITION_WIN');await awardMatch();assert.equal(points('1'),9);assert.equal(points('2'),9);
});
test('placement verification requires an administrator; client evidence cannot qualify it',async()=>{
 reset();await assert.rejects(adminVerifyFfaPlacements.run(request({matchId:'m'},'account-1')),e=>e.code==='permission-denied');
});

test('a completed series awards Match points once, and rerunning its finalizer adds nothing',async()=>{
 const {adminFinalizeMatchSeries}=await import('../lib/commands/results/finalizeMatchSeries.js');
 reset();const m=records.get('matches/m');m.status='ACTIVE';m.canonicalResult=null;m.format='ONE_V_ONE';m.participants=[{playerId:'1',team:1,slot:1},{playerId:'5',team:2,slot:2}];m.seriesRule={maxGames:3,gamesRequiredToWin:2};
 m.seasonScoring.placementRule=null;
 for(let i=1;i<=2;i++)records.set('matches/m/games/G'+i,{gameNumber:i,status:'COMPLETED',canonicalResult:{type:'TEAM_WIN',winnerTeam:1,winnerPlayerId:null,winningPlayerIds:['1'],revision:1}});
 await adminFinalizeMatchSeries.run(request({requestId:'series-0001',matchId:'m',expectedResultRevision:0,reason:'Both accepted Games won by side one'}));
 await awardMatch();assert.equal(points('1'),12);assert.equal(points('5'),4);assert.equal(records.get('seasons/s/standings/1').mainEventWins,1);
 const again=await adminFinalizeMatchSeries.run(request({requestId:'series-0002',matchId:'m',expectedResultRevision:1,reason:'Retry'}));assert.equal(again.alreadyFinalized,true);
 await awardMatch();assert.equal(points('1'),12);
});
test('actual starter confirmation removes no-shows before result acceptance and keeps their opportunity reserved',async()=>{
 const {adminConfirmMatchStarters}=await import('../lib/commands/events/confirmMatchStarters.js');
 reset();const m=records.get('matches/m');m.status='READY';m.canonicalResult=null;const g=records.get('matches/m/games/G1');g.status='READY';g.canonicalResult=null;
 await adminConfirmMatchStarters.run(request({requestId:'starters-001',matchId:'m',starterPlayerIds:['1','2','3'],reason:'Players four and five did not attend'}));
 assert.equal(records.get('matches/m').participants.length,3);assert.equal(records.get('matches/m/games/G1').players.length,3);
 assert.equal(records.get('events/e/scoringSlots/MAIN_EVENT_5').matchId,'m');
 await submitGameResult.run(request({matchId:'m',gameId:'G1',winnerPlayerId:'1'},'account-1'));
 await respondToGameResult.run(request({matchId:'m',gameId:'G1',submissionId:'1',response:'CONFIRM'},'account-2'));
 await awardMatch();assert.equal(points('1'),10);assert.equal(points('5'),undefined);
 assert.equal(records.get('matches/m').seasonScoringSummary.placementStatus,'PENDING');
});

test('a winning coalition cannot confirm its own submission together',async()=>{
 reset(true);records.get('matches/m').status='READY';records.get('matches/m').canonicalResult=null;records.get('matches/m/games/G1').status='READY';records.get('matches/m/games/G1').canonicalResult=null;
 await submitGameResult.run(request({matchId:'m',gameId:'G1',coalitionPlayerIds:['1','2']},'account-1'));
 await assert.rejects(respondToGameResult.run(request({matchId:'m',gameId:'G1',submissionId:'1',response:'CONFIRM'},'account-2')),/outside the winning coalition/);
});
test('many fractional coalition corrections keep exact balances and leave no zero-unit ledger dust',async()=>{
 reset(true);const m=records.get('matches/m');m.seasonScoring.emperorPlayerId=null;
 for(let revision=1;revision<=30;revision++){
  const count=revision%3+1;const winners=participants.slice(0,count).map(p=>p.playerId);
  m.canonicalResult={...m.canonicalResult,type:count===1?'PLAYER_WIN':'COALITION_WIN',winnerPlayerId:count===1?'1':null,coalitionPlayerIds:count>1?winners:undefined,winningPlayerIds:winners,revision};
  records.set('matches/m',m);job('m',revision);await awardMatch();Object.assign(m,records.get('matches/m'));
  assert.equal(points('1'),4+6/count);assert.equal(records.get('seasons/s/standings/1').leaguePointUnits,(4+6/count)*POINT_UNITS);
 }
 assert.equal([...records.entries()].filter(([k])=>k.startsWith('leaguePointLedger/')).every(([,v])=>v.amountUnits!==0),true);
});

test('a corrected series is re-finalized from current Games and reconciles one Match award',async()=>{
 const {adminFinalizeMatchSeries}=await import('../lib/commands/results/finalizeMatchSeries.js');
 reset();const m=records.get('matches/m');m.status='ACTIVE';m.canonicalResult=null;m.format='ONE_V_ONE';m.participants=[{playerId:'1',team:1,slot:1},{playerId:'5',team:2,slot:2}];m.seriesRule={maxGames:3,gamesRequiredToWin:2};m.seasonScoring.placementRule=null;
 const result=team=>({type:'TEAM_WIN',winnerTeam:team,winnerPlayerId:null,winningPlayerIds:[team===1?'1':'5'],revision:1});
 for(let i=1;i<=2;i++)records.set('matches/m/games/G'+i,{gameNumber:i,status:'COMPLETED',canonicalResult:result(1)});
 await adminFinalizeMatchSeries.run(request({requestId:'series-0001',matchId:'m',expectedResultRevision:0,reason:'Accepted series result'}));await awardMatch();assert.equal(points('1'),12);
 records.get('matches/m').status='DISPUTED';records.get('matches/m').activeResultDisputeId='d';records.get('matches/m/games/G1').status='DISPUTED';records.get('matches/m/games/G1').activeResultDisputeId='d';records.set('matches/m/games/G1/resultDisputes/d',{status:'OPEN',resultRevision:1});
 await adminResolveCanonicalResultDispute.run(request({requestId:'series-correct-001',matchId:'m',gameId:'G1',disputeId:'d',resolution:'CORRECT',winnerTeam:2,reason:'Corrected Game one winner'}));
 assert.equal(records.get('matches/m').status,'ACTIVE');
 await assert.rejects(adminFinalizeMatchSeries.run(request({requestId:'series-pending-001',matchId:'m',expectedResultRevision:1,reason:'Winner not resolved yet'})),/no verified/);
 records.set('matches/m/games/G3',{gameNumber:3,status:'COMPLETED',canonicalResult:result(2)});
 await adminFinalizeMatchSeries.run(request({requestId:'series-final-002',matchId:'m',expectedResultRevision:1,reason:'Corrected accepted series now won by side two'}));await awardMatch();
 assert.equal(points('1'),4);assert.equal(points('5'),10);assert.equal(records.get('seasons/s/standings/1').mainEventWins,0);
});
