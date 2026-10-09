import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Timestamp} from 'firebase-admin/firestore';
import {memoryFirestore} from './support/memory-firestore.mjs';
import {deriveRecordingOutcome} from '../lib/engines/recordingOutcome.js';
import {resolveRecordingResult} from '../lib/services/recordingResult.js';
import {generateMatchPlan} from '../lib/engines/matchPlanner.js';
import {adminGenerateMatchPlan} from '../lib/commands/events/generateMatchPlan.js';
import {adminApproveMatchPlan} from '../lib/commands/events/approveMatchPlan.js';
import {challengeWarmupGuest,respondToWarmupGuest} from '../lib/commands/events/warmupChallenges.js';
import {advanceEventWarmups} from '../lib/services/warmupLifecycle.js';
import {processMatchRewards} from '../lib/commands/processing/processMatchRewards.js';
import {selectBestWarmups,reconcileBestWarmups} from '../lib/services/bestWarmup.js';
import {seasonScoringSnapshot,POINT_UNITS} from '../lib/engines/seasonPoints.js';
import {SYSTEM_RESULT_PROCESSING_ACTOR as system} from '../lib/services/resultProcessingActor.js';
import {adminReviewRecordingResult} from '../lib/commands/results/reviewRecordingResult.js';
import {currentOfficialGameOutcome} from '../lib/engines/recordingMatchFacts.js';
import {steamNameHistory,fetchSteamProfile,refreshSteamProfile} from '../lib/services/steamProfile.js';
import {publicPlayer} from '../lib/queries/querySupport.js';
import {StatisticsExperience} from '../lib/engines/statisticsExperience.js';
import {readEventFinalisation} from '../lib/services/eventFinalisation.js';
import {db as firestore} from '../lib/config/firebase.js';
import {finalizeRecordingSeries} from '../lib/triggers/recordingSeries.js';
import {adminMarkEventAttendance} from '../lib/commands/events/markAttendance.js';
import {adminReplaceWarmupOpponent} from '../lib/commands/events/warmupChallenges.js';
import {getPlayerSiteDirectory} from '../lib/queries/getPlayerSiteDirectory.js';
import {disputeCanonicalGameResult} from '../lib/commands/results/disputeCanonicalGameResult.js';
import {adminResolveCanonicalResultDispute} from '../lib/commands/results/adminResolveCanonicalResultDispute.js';
import {adminRejectUnresolvedEventMatch} from '../lib/commands/events/finaliseEvent.js';
import {readEventRoundoff} from '../lib/services/eventRoundoff.js';
import {collectStatistics,statisticsMetadata} from '../lib/services/statisticsExperienceProjection.js';
import {projectStatistics} from '../lib/engines/statisticsExperience.js';
import {augmentSeasonShowcase} from '../lib/engines/seasonShowcaseProjection.js';
import {runResultProcessingJob} from '../lib/triggers/processResultJob.js';
import {adminRetryResultProcessing} from '../lib/commands/processing/retryResultProcessing.js';

const corpus=JSON.parse(readFileSync(new URL('./fixtures/recording-outcomes.json',import.meta.url),'utf8'));
const config={maps:{pool:['Arabia'],selectionMode:'ADMIN'},civilizations:{mode:'UNRESTRICTED',allowed:[],banned:[],customRuleCode:null},victory:{conquest:true,wonder:false,relic:false,customRuleCode:null},diplomacyEnabled:false,additionalSettings:{}};
const req=(data,uid='admin')=>({auth:{uid},data});
function recording(f=corpus[0]) {
  const rawTeams=[...new Set(f.players.map(p=>p.teamId))].sort();
  const players=f.players.map(p=>({playerId:'p'+p.replaySlot,slot:p.replaySlot,team:rawTeams.indexOf(p.teamId)+1}));
  const source={state:'READY',sourceHash:f.sourceHash,matchFacts:structuredClone(f.matchFacts),matchId:'m',gameId:'G1',playerMapping:players.map(p=>({playerId:p.playerId,replaySlot:p.slot,sourceName:f.players.find(q=>q.replaySlot===p.slot).name}))};
  const map=f.matchFacts.rules.mapId.value===149?'African Clearing':f.matchFacts.rules.mapId.value===17?'Gold Rush':'Arabia';
  const gameConfigSnapshot={...config,maps:{pool:[map],selectionMode:'ADMIN',recordingMapIds:{[map]:f.matchFacts.rules.mapId.value}}};
  return {match:{status:'READY',format:players.length===2?'ONE_V_ONE':players.length===4?'TWO_V_TWO':players.length===6?'THREE_V_THREE':'FOUR_V_FOUR',participants:players,seriesRule:{maxGames:1,gamesRequiredToWin:1},gameConfigSnapshot},game:{status:'READY',players,activeReplayStatisticsId:f.sourceHash,replayStatisticsState:'READY',gameConfigSnapshot},source};
}
function seedRecording(value=recording()) {
  const {match,game,source}=value;
  const entries=[['matches/m',match],['matches/m/games/G1',game],['matches/m/games/G1/replaySources/'+source.sourceHash,source],['players/admin',{role:'ADMIN',membershipStatus:'ACTIVE'}],['authLinks/admin',{playerId:'admin'}]];
  for(const p of game.players)entries.push(['players/'+p.playerId,{steamName:p.playerId,role:'PLAYER',membershipStatus:'ACTIVE',goldBalance:0}],['authLinks/'+p.playerId,{playerId:p.playerId}]);
  return memoryFirestore(entries);
}
test('random mode ignores Elo, changes across draws and replays identically with the pinned seed',()=>{
  const players=Array.from({length:8},(_,i)=>({playerId:'p'+i,powerRating:1000+i*500})),planning={allowAsymmetricTeams:true,preferredTeamSize:4,prioritizeLargestTeams:true,pairingMode:'RANDOM'};
  const plan=generateMatchPlan('BIG_TEAM',players,planning,'a');
  assert.deepEqual(plan,generateMatchPlan('BIG_TEAM',[...players].reverse().map(p=>({...p,powerRating:5})),planning,'a'));
  const draws=new Set(Array.from({length:50},(_,i)=>JSON.stringify(generateMatchPlan('BIG_TEAM',players,planning,'seed'+i).matches[0].participants)));
  assert.ok(draws.size>30);
  const balanced=generateMatchPlan('BIG_TEAM',players,{...planning,pairingMode:'ELO_BALANCED'},'a').matches[0];
  assert.equal(balanced.balanceEstimate.teamOneWinProbability,0.5);
});
test('Emperor can force a reviewed draw with missing check-in; players cannot, and approval rechecks attendance',async()=>{
  const value=recording(),records=seedRecording(value),now=Date.now();
  records.set('events/e',{status:'ACTIVE',seasonId:'s',startsAt:Timestamp.fromMillis(now+60000),checkInClosesAt:Timestamp.fromMillis(now+60000),competitionStyle:'BIG_TEAM',planningConfig:{allowAsymmetricTeams:true,preferredTeamSize:4,prioritizeLargestTeams:true},gameConfig:config,scoringSnapshot:seasonScoringSnapshot({act:'MAIN',diplomacyEnabled:false,placementPolicy:'NONE',emperorPlayerId:null}),goldRewardSnapshot:{matchCompletion:0,matchWin:0}});
  records.set('leagueState/singleton',{activeSeasonId:'s'});
  for(const id of ['p1','p2','missing'])records.set('events/e/participants/'+id,{rsvp:'YES',signupState:'CONFIRMED',attendanceStatus:id==='missing'?'NOT_CHECKED':'CHECKED_IN'});
  await assert.rejects(adminGenerateMatchPlan.run(req({eventId:'e',requestId:'normal'})),/Wait for check-in/);
  await assert.rejects(adminGenerateMatchPlan.run(req({eventId:'e',requestId:'force-player',force:true,reason:'Two starters are present.'},'p1')),/administrator/i);
  records.set('events/e',{...records.get('events/e'),checkInClosesAt:Timestamp.fromMillis(now-1000)});
  await assert.rejects(adminGenerateMatchPlan.run(req({eventId:'e',requestId:'closed-but-missing'})),/Wait for check-in/);
  const plan=await adminGenerateMatchPlan.run(req({eventId:'e',requestId:'forced-draw',force:true,reason:'The missing player withdrew.'}));
  assert.deepEqual(plan.eligiblePlayerIds,['p1','p2']);assert.equal(records.get('events/e/matchPlans/'+plan.planId).forced,true);
  const result=await adminApproveMatchPlan.run(req({eventId:'e',planId:plan.planId,requestId:'approve-forced'}));assert.equal(result.officialMatchIds.length,1);
});
test('known DE duel and team outcomes qualify from normal resignations and terminal postgame, not ladder rank',()=>{
  for(const f of corpus) {
    const {match,game,source}=recording(f),result=deriveRecordingOutcome(match,game,source);
    assert.equal(result.state,'VERIFIED',f.filename+': '+result.reason);
    const resigned=new Set(source.matchFacts.result.resignationEvidence.map(r=>'p'+r.replaySlot));
    assert.ok(game.players.filter(p=>p.team===result.outcome.winnerTeam).every(p=>!resigned.has(p.playerId)));
  }
  assert.equal(deriveRecordingOutcome(...Object.values(recording(corpus[0]))).outcome.winnerTeam,2);
});
test('incomplete, disconnected, restored, unknown-rule, mismatched and fixed-FFA recordings require review',()=>{
  for(const change of [v=>v.source.matchFacts.game.bodyParseComplete=false,v=>v.source.matchFacts.result.resignationEvidence[0].disconnected=true,v=>v.source.matchFacts.result.postgameEvidence=[],v=>v.source.matchFacts.headerFieldCandidates['map.restore_time']=1,v=>v.source.matchFacts.game.recordingVersion.save_version=99,v=>v.source.playerMapping[1].playerId='p1',v=>v.source.matchFacts.players[1].lobbyTeamIdRaw=2,v=>v.match.format='FFA',v=>v.game.gameConfigSnapshot={...config,maps:{pool:['Unknown'],selectionMode:'ADMIN'}},v=>v.game.gameConfigSnapshot={...config,civilizations:{mode:'DRAFT'}}]) {
    const v=recording();change(v);assert.equal(deriveRecordingOutcome(v.match,v.game,v.source).state,'PENDING_ADMIN_REVIEW');
  }
});
test('upload outcome acceptance queues the existing revision pipeline once and prevents duplicate Game scoring',async()=>{
  const records=seedRecording();assert.equal((await resolveRecordingResult('m','G1')).state,'ACCEPTED');
  assert.equal(records.get('matches/m/games/G1').canonicalResult.source,'RECORDING_VERIFIED');
  assert.equal(currentOfficialGameOutcome(records.get('matches/m/games/G1'),records.get('matches/m')).qualification,'OFFICIAL');
  assert.ok(records.get('processingJobs/MATCH_RESULT_m_R1').pendingSteps.includes('SCORING'));
  assert.equal((await resolveRecordingResult('m','G1')).state,'RESULT_ALREADY_RESOLVED');
  assert.equal([...records.keys()].filter(k=>k.startsWith('processingJobs/')).length,1);
  const v=recording();records.set('matches/other',v.match);records.set('matches/other/games/G1',v.game);records.set('matches/other/games/G1/replaySources/'+v.source.sourceHash,{...v.source,matchId:'other'});
  assert.equal((await resolveRecordingResult('other','G1')).state,'PENDING_ADMIN_REVIEW');assert.equal(records.get('matches/other').canonicalResult,undefined);
});
test('late evidence needs source-bound Emperor review; stale hashes, players and unverified timing cannot bypass it',async()=>{
  const v=recording();v.source.timingQualification='ADMIN_REVIEW_REQUIRED';const records=seedRecording(v);
  assert.equal((await resolveRecordingResult('m','G1')).state,'PENDING_ADMIN_REVIEW');assert.equal(records.has('processingJobs/MATCH_RESULT_m_R1'),false);
  const input={matchId:'m',gameId:'G1',sourceHash:v.source.sourceHash,outcome:{winnerTeam:2},reason:'Verified the full recording and timely completion.',playedWithinWindow:true};
  await assert.rejects(adminReviewRecordingResult.run(req(input,'p1')),/administrator/i);
  await assert.rejects(adminReviewRecordingResult.run(req({...input,sourceHash:'f'.repeat(64)})),/recording changed/);
  await assert.rejects(adminReviewRecordingResult.run(req({...input,playedWithinWindow:false})),/Verify timely/);
  await adminReviewRecordingResult.run(req(input));assert.equal(records.get('matches/m').canonicalResult.source,'ADMIN_RESOLVED');
  const accepted=structuredClone(records.get('matches/m/games/G1/replaySources/'+v.source.sourceHash).outcomeQualification);
  await resolveRecordingResult('m','G1');assert.deepEqual(records.get('matches/m/games/G1/replaySources/'+v.source.sourceHash).outcomeQualification,accepted);
});
test('helper may accept an extra warmup without changing main signup or overwriting the first warmup slot',async()=>{
  const now=Date.now(),records=seedRecording();records.set('events/e',{seasonId:'s',status:'PUBLISHED',startsAt:Timestamp.fromMillis(now+86400000),warmupPolicy:{modelVersion:'AOF_WARMUP_LIFECYCLE_V1',scoringPolicy:'AOF_BEST_WARMUP_V1',gameConfig:config,guestAcceptanceDeadlineAt:Timestamp.fromMillis(now+86400000)},goldRewardSnapshot:{matchCompletion:0,matchWin:0}});
  for(const id of ['p1','p2','p3']){records.set('players/'+id,{role:'PLAYER',membershipStatus:'ACTIVE'});records.set('authLinks/'+id,{playerId:id});records.set('events/e/participants/'+id,{rsvp:'YES',signupState:'CONFIRMED'});records.set('seasons/s/participants/'+id,{status:'ENTERED'});}
  await advanceEventWarmups('e',now);const unpaired=records.get('events/e').warmupSchedule.unpairedPlayerId,helper=['p1','p2','p3'].find(id=>id!==unpaired),oldSlot=records.get('events/e/scoringSlots/WARMUP_'+helper).matchId;
  const invite=await challengeWarmupGuest.run(req({eventId:'e',guestPlayerId:helper},unpaired));
  const accepted=await respondToWarmupGuest.run(req({eventId:'e',challengeId:invite.challengeId,accept:true},helper));
  assert.equal(records.get('events/e/scoringSlots/WARMUP_'+helper).matchId,oldSlot);
  assert.equal(records.get('matches/'+accepted.matchId).warmupScoringPolicy,'AOF_BEST_WARMUP_V1');assert.equal(records.get('events/e/participants/'+helper).rsvp,'YES');
});
function addWarmup(records,id,players,winner) {
  const sourceHash=id==='w1'?'1'.repeat(64):'2'.repeat(64),participants=players.map((playerId,i)=>({playerId,team:i+1,slot:i+1}));
  const result={revision:1,type:'TEAM_WIN',winnerTeam:players.indexOf(winner)+1,winningPlayerIds:[winner],source:'ADMIN_RESOLVED',sourceGameId:'G1'};
  records.set('matches/'+id,{eventId:'e',seasonId:'s',status:'COMPLETED',format:'ONE_V_ONE',warmupScoringPolicy:'AOF_BEST_WARMUP_V1',participants,canonicalResult:result,scoringSnapshot:seasonScoringSnapshot({act:'WARMUP',diplomacyEnabled:false,placementPolicy:'NONE',emperorPlayerId:null}),goldRewardSnapshot:{matchCompletion:0,matchWin:0},context:{affectsLeaguePoints:true,affectsGold:false}});
  records.set('matches/'+id+'/games/G1',{status:'COMPLETED',players:participants,canonicalResult:result,activeReplayStatisticsId:sourceHash,replayStatisticsState:'READY'});
  records.set('matches/'+id+'/games/G1/replaySources/'+sourceHash,{state:'READY',sourceHash,matchId:id,gameId:'G1',playerMapping:participants.map(p=>({playerId:p.playerId,replaySlot:p.slot}))});
  records.set('processingJobs/MATCH_RESULT_'+id+'_R1',{status:'PENDING',matchId:id,resultRevision:1,pendingSteps:['SCORING','GOLD'],completedSteps:[]});
}
test('two warmups pay only the best result; retry, dispute, fallback and source withdrawal reconcile exactly once',async()=>{
  const records=seedRecording();records.set('events/e',{seasonId:'s',warmupPolicy:{scoringPolicy:'AOF_BEST_WARMUP_V1'},warmupMatchIds:['w1','w2']});
  for(const [id,matchId] of [['p1','w1'],['p2','w1'],['p3','w2']]) {records.set('players/'+id,{membershipStatus:'ACTIVE',goldBalance:0});records.set('events/e/scoringSlots/WARMUP_'+id,{playerId:id,matchId,seasonId:'s',act:'WARMUP'});}
  addWarmup(records,'w1',['p1','p2'],'p2');addWarmup(records,'w2',['p1','p3'],'p1');
  await processMatchRewards({matchId:'w1',requestId:'one'},system);await processMatchRewards({matchId:'w2',requestId:'two'},system);
  assert.equal(records.get('seasons/s/standings/p1').leaguePointUnits,3*POINT_UNITS);assert.equal(records.get('seasons/s/standings/p1').warmupsPlayed,1);assert.equal(records.get('seasons/s/standings/p1').warmupWins,1);
  const ledgerSize=[...records.keys()].filter(k=>k.startsWith('leaguePointLedger/')).length;await reconcileBestWarmups('e');assert.equal([...records.keys()].filter(k=>k.startsWith('leaguePointLedger/')).length,ledgerSize);
  records.set('matches/w2',{...records.get('matches/w2'),status:'DISPUTED',activeResultDisputeId:'d'});await reconcileBestWarmups('e');
  assert.equal(records.get('seasons/s/standings/p1').leaguePoints,1);assert.equal(records.get('seasons/s/standings/p1').warmupWins,0);assert.equal(records.get('seasons/s/standings/p3').leaguePoints,0);
  records.set('matches/w2',{...records.get('matches/w2'),status:'COMPLETED',activeResultDisputeId:null});await reconcileBestWarmups('e');assert.equal(records.get('seasons/s/standings/p1').leaguePoints,3);
  records.set('matches/w2/games/G1',{...records.get('matches/w2/games/G1'),activeReplayStatisticsId:'missing'});await reconcileBestWarmups('e');assert.equal(records.get('seasons/s/standings/p1').leaguePoints,1);
});
test('Steam refresh preserves league alias and verified name history; user names are not used as persona evidence',async t=>{
  const records=memoryFirestore([['authLinks/steam:76561198000000000',{playerId:'p'}],['players/p',{steamId64:'76561198000000000',steamName:'Banner',leagueAlias:'Banner',steamPersonaName:'Old name',steamNameHistory:['Older name']}]]);
  t.mock.method(globalThis,'fetch',async()=>({ok:true,text:async()=>'<profile><steamID64>76561198000000000</steamID64><steamID><![CDATA[New & name]]></steamID></profile>'}));
  await refreshSteamProfile('76561198000000000');const p=records.get('players/p');assert.equal(p.leagueAlias,'Banner');assert.equal(p.steamPersonaName,'New & name');assert.deepEqual(p.steamNameHistory,['Older name','Old name']);assert.equal(publicPlayer('p',p).steamName,'Banner (New & name)');
  assert.deepEqual(steamNameHistory(p,'Old name'),['Older name','New & name']);
  t.mock.method(globalThis,'fetch',async()=>({ok:true,text:async()=>'<profile><steamID64>76561198000000001</steamID64><steamID>Impersonator</steamID></profile>'}));assert.equal(await fetchSteamProfile('76561198000000000'),null);
});

test('attendance exceptions are Emperor-only, remove unresolved no-shows and freeze after main approval',async()=>{
  const records=seedRecording(),now=Date.now();
  records.set('events/e',{status:'ACTIVE',seasonId:'s',startsAt:Timestamp.fromMillis(now+60000),checkInClosesAt:Timestamp.fromMillis(now+60000),competitionStyle:'BIG_TEAM',planningConfig:{allowAsymmetricTeams:true,preferredTeamSize:4,prioritizeLargestTeams:true},gameConfig:config,scoringSnapshot:seasonScoringSnapshot({act:'MAIN',diplomacyEnabled:false,placementPolicy:'NONE',emperorPlayerId:null}),goldRewardSnapshot:{matchCompletion:0,matchWin:0}});
  records.set('leagueState/singleton',{activeSeasonId:'s'});
  for(const id of ['p1','p2','missing']){records.set('events/e/participants/'+id,{rsvp:'YES',signupState:'CONFIRMED',attendanceStatus:id==='p1'?'CHECKED_IN':'NOT_CHECKED'});records.set('seasons/s/participants/'+id,{status:'ENTERED'});}
  const input={eventId:'e',playerId:'p2',status:'LATE_ADDED',reason:'Player is present and verified by the Emperor.'};
  await assert.rejects(adminMarkEventAttendance.run(req(input,'p1')),/administrator/i);
  await adminMarkEventAttendance.run(req(input));await adminMarkEventAttendance.run(req({...input,playerId:'missing',status:'NO_SHOW'}));
  const plan=await adminGenerateMatchPlan.run(req({eventId:'e',requestId:'all-resolved'}));assert.deepEqual(plan.eligiblePlayerIds,['p1','p2']);
  await adminApproveMatchPlan.run(req({eventId:'e',requestId:'approve-attendance',planId:plan.planId}));
  await assert.rejects(adminMarkEventAttendance.run(req(input)),/before approving/);
});

test('a helper outside the Season can reach invitations and accept without automatic enrollment',async()=>{
  const records=seedRecording(),now=Date.now();records.set('leagueState/singleton',{activeSeasonId:'s'});records.set('seasons/s',{status:'ACTIVE'});
  records.set('events/e',{seasonId:'s',status:'PUBLISHED',startsAt:Timestamp.fromMillis(now+86400000),warmupPolicy:{modelVersion:'AOF_WARMUP_LIFECYCLE_V1',scoringPolicy:'AOF_BEST_WARMUP_V1',gameConfig:config,guestAcceptanceDeadlineAt:Timestamp.fromMillis(now+86400000)},goldRewardSnapshot:{matchCompletion:0,matchWin:0}});
  records.set('events/e/participants/p1',{rsvp:'YES',signupState:'CONFIRMED'});records.set('seasons/s/participants/p1',{status:'ENTERED'});
  // Remove the unrelated corpus Battle so browsing access comes from this invitation.
  for(const key of [...records.keys()])if(key.startsWith('matches/'))records.delete(key);
  await advanceEventWarmups('e',now);const invite=await challengeWarmupGuest.run(req({eventId:'e',guestPlayerId:'p2'},'p1'));
  const directory=await getPlayerSiteDirectory.run(req({},'p2'));assert.equal(directory.enteredSeason,false);assert.equal(directory.hasLeagueHistory,true);assert.equal(directory.events.length,1);
  await respondToWarmupGuest.run(req({eventId:'e',challengeId:invite.challengeId,accept:true},'p2'));
  assert.equal(records.has('seasons/s/participants/p2'),false);assert.equal(records.has('events/e/participants/p2'),false);
});

test('replacing a helper’s extra warmup preserves their first slot and prevents replacing the same Battle twice',async()=>{
  const records=seedRecording(),now=Date.now();records.set('events/e',{status:'ACTIVE',seasonId:'s',startsAt:Timestamp.fromMillis(now+86400000),warmupPolicy:{scoringPolicy:'AOF_BEST_WARMUP_V1',gameConfig:config},warmupMatchIds:['extra'],goldRewardSnapshot:{matchCompletion:0,matchWin:0}});
  records.set('players/guest',{membershipStatus:'ACTIVE'});records.set('matches/extra',{status:'READY',eventId:'e',seasonId:'s',format:'ONE_V_ONE',participants:[{playerId:'p1',team:1,slot:1},{playerId:'p2',team:2,slot:2}],scoringSnapshot:seasonScoringSnapshot({act:'WARMUP',diplomacyEnabled:false,placementPolicy:'NONE',emperorPlayerId:null})});
  records.set('matches/extra/games/G1',{status:'READY'});records.set('events/e/scoringSlots/WARMUP_p1',{matchId:'original'});records.set('events/e/scoringSlots/WARMUP_p2',{matchId:'extra'});
  const input={matchId:'extra',withdrawnPlayerId:'p2',replacementPlayerId:'guest',reason:'Original opponent withdrew before playing.'};
  await adminReplaceWarmupOpponent.run(req(input));assert.equal(records.get('events/e/scoringSlots/WARMUP_p1').matchId,'original');
  await assert.rejects(adminReplaceWarmupOpponent.run(req(input)),/unreplaced/);
});

test('accepted recording corrections rebind the current source and release a wrong-Battle GUID only after correction',async()=>{
  const records=seedRecording();await resolveRecordingResult('m','G1');
  const original=recording();records.set('matches/other',original.match);records.set('matches/other/games/G1',original.game);records.set('matches/other/games/G1/replaySources/'+original.source.sourceHash,{...original.source,matchId:'other'});
  assert.equal((await resolveRecordingResult('other','G1')).state,'PENDING_ADMIN_REVIEW');
  const dispute=await disputeCanonicalGameResult.run(req({requestId:'wrong-recording',matchId:'m',gameId:'G1',category:'WRONG_REPLAY',reason:'Wrong recording attached to this Battle.'},'p1'));
  const replacement=recording(corpus.find(f=>f.filename==='aof-test-game-3.aoe2record'));
  records.set('matches/m/games/G1/replaySources/'+replacement.source.sourceHash,replacement.source);records.set('matches/m/games/G1',{...records.get('matches/m/games/G1'),activeReplayStatisticsId:replacement.source.sourceHash});
  const input={requestId:'correct-recording',matchId:'m',gameId:'G1',disputeId:dispute.disputeId,resolution:'UPHOLD',expectedSourceHash:replacement.source.sourceHash,reason:'Reviewed the correct recording and its winner.',winnerTeam:2};
  await assert.rejects(adminResolveCanonicalResultDispute.run(req(input)),/replaced/);
  await assert.rejects(adminResolveCanonicalResultDispute.run(req({...input,resolution:'CORRECT',expectedSourceHash:'f'.repeat(64)})),/changed during review/);
  await adminResolveCanonicalResultDispute.run(req({...input,resolution:'CORRECT'}));
  assert.equal(records.get('matches/m/games/G1').recordingResultBinding.sourceHash,replacement.source.sourceHash);assert.equal(currentOfficialGameOutcome(records.get('matches/m/games/G1'),records.get('matches/m')).qualification,'OFFICIAL');
  assert.equal((await resolveRecordingResult('other','G1')).state,'ACCEPTED');
  assert.ok([...records.values()].some(v=>v.replacedClaim?.matchId==='m'));
});

test('recording-only series conclude after the decisive Game, skip unused Games and permit early Game dispute resolution',async()=>{
  const v=recording(),records=seedRecording(v);records.set('matches/m',{...v.match,seriesRule:{maxGames:3,gamesRequiredToWin:2}});records.set('matches/m/games/G1',{...v.game,gameNumber:1});
  await resolveRecordingResult('m','G1');
  const d=await disputeCanonicalGameResult.run(req({requestId:'early-review',matchId:'m',gameId:'G1',category:'OTHER',reason:'Please confirm this first Game result.'},'p1'));
  await adminResolveCanonicalResultDispute.run(req({requestId:'early-uphold',matchId:'m',gameId:'G1',disputeId:d.disputeId,resolution:'UPHOLD',expectedSourceHash:v.source.sourceHash,reason:'Verified this first Game recording.'}));assert.equal(records.get('matches/m').status,'ACTIVE');assert.equal(records.get('matches/m').canonicalResult,undefined);
  const g1=records.get('matches/m/games/G1');records.set('matches/m/games/G2',{...g1,gameNumber:2,activeResultDisputeId:null});records.set('matches/m/games/G3',{status:'READY',gameNumber:3,players:v.game.players});
  const event={id:'series-game',params:{matchId:'m',gameId:'G2'},data:{before:{data:()=>({status:'READY'})},after:{data:()=>records.get('matches/m/games/G2')}}};
  await finalizeRecordingSeries.run(event);assert.equal(records.get('matches/m').canonicalResult.source,'RECORDING_VERIFIED');assert.deepEqual(records.get('matches/m').canonicalResult.seriesGameRevisions,{G1:1,G2:1});assert.equal(records.get('matches/m/games/G3').status,'NO_CONTEST');
  await finalizeRecordingSeries.run(event);assert.equal([...records.keys()].filter(k=>k.startsWith('processingJobs/')).length,1);
});

test('live Roundoff and Event statistics count each best warmup once, while closure waits for reconciliation',async()=>{
  const records=seedRecording(),event={seasonId:'s',status:'ACTIVE',startsAt:Timestamp.fromMillis(Date.now()-1000),warmupPolicy:{scoringPolicy:'AOF_BEST_WARMUP_V1'},warmupSchedule:{status:'COMPLETE'},warmupMatchIds:['w1','w2']};records.set('events/e',event);
  for(const [id,matchId] of [['p1','w1'],['p2','w1'],['p3','w2']]){records.set('players/'+id,{membershipStatus:'ACTIVE',goldBalance:0});records.set('events/e/scoringSlots/WARMUP_'+id,{playerId:id,matchId,seasonId:'s',act:'WARMUP'});}
  addWarmup(records,'w1',['p1','p2'],'p2');addWarmup(records,'w2',['p1','p3'],'p1');
  await processMatchRewards({matchId:'w1',requestId:'r1'},system);await processMatchRewards({matchId:'w2',requestId:'r2'},system);
  for(const id of ['w1','w2']) {
    const m=records.get('matches/'+id),g=records.get('matches/'+id+'/games/G1'),source=records.get('matches/'+id+'/games/G1/replaySources/'+g.activeReplayStatisticsId);
    const raw={scope:{observedUntilMs:100},participants:source.playerMapping.map(p=>({replaySlot:p.replaySlot,playerId:p.replaySlot,economy:{resourceCommitment:{modelVersion:'cost-v1',resourcesCommitted:{total:id==='w1'?100:300}}}}))},metadata=statisticsMetadata(id,'G1',m,g,source);source.experience=augmentSeasonShowcase(raw,projectStatistics(raw,metadata),metadata);
    records.set('processingJobs/MATCH_RESULT_'+id+'_R1',{matchId:id,resultRevision:1,status:'COMPLETED',pendingSteps:[]});
  }
  const scoped=await collectStatistics({eventId:'e'}),row=new StatisticsExperience(scoped.games).aggregate().find(p=>p.playerId==='p1');assert.equal(row.games,1);assert.equal(row.values.total.value,300);
  assert.equal(new StatisticsExperience((await collectStatistics({seasonId:'s'})).games).aggregate().find(p=>p.playerId==='p1').games,2);
  const roundoff=await readEventRoundoff('e');assert.equal(roundoff.points.find(p=>p.playerId==='p1').warmup,3);assert.ok(roundoff.revision>0);
  records.set('matches/main',{eventId:'e',status:'CANCELLED',resolutionReason:'Main Battle explicitly cancelled.',scoringSnapshot:{rules:{act:'MAIN'}}});
  assert.equal((await readEventFinalisation(firestore.collection('events').doc('e'),event)).canFinalise,true);
  records.delete('events/e/warmupSelections/p1');assert.ok((await readEventFinalisation(firestore.collection('events').doc('e'),event)).blockers.some(b=>b.kind==='WARMUP_POINTS'));
});

test('invalid unaccepted evidence can be rejected without deleting artifacts; accepted results and missing evidence block bypasses',async()=>{
  const v=recording();v.match.eventId='e';const records=seedRecording(v);records.set('events/e',{status:'ACTIVE',startsAt:Timestamp.fromMillis(Date.now()-1000)});
  await assert.rejects(adminRejectUnresolvedEventMatch.run(req({matchId:'m',reason:'Wrong Game uploaded to this Battle.'},'p1')),/administrator/i);
  await adminRejectUnresolvedEventMatch.run(req({matchId:'m',reason:'Wrong Game uploaded to this Battle.'}));assert.equal(records.get('matches/m').status,'VOID');assert.ok(records.has('matches/m/games/G1/replaySources/'+v.source.sourceHash));
  const next=seedRecording(v);next.set('events/e',{status:'ACTIVE',startsAt:Timestamp.fromMillis(Date.now()-1000)});await resolveRecordingResult('m','G1');
  await assert.rejects(adminRejectUnresolvedEventMatch.run(req({matchId:'m',reason:'Reject an already accepted result.'})),/without any accepted/);
  next.set('matches/m',{...next.get('matches/m'),scoringSnapshot:{rules:{act:'MAIN'}}});next.set('processingJobs/MATCH_RESULT_m_R1',{matchId:'m',resultRevision:1,status:'COMPLETED',pendingSteps:[]});next.delete('matches/m/games/G1/replaySources/'+v.source.sourceHash);
  const gate=await readEventFinalisation(firestore.collection('events').doc('e'),next.get('events/e'));assert.ok(gate.blockers.some(b=>b.kind==='RECORDING'));
});

test('accepted recording drives the full existing job; retry recovers a paused step without duplicating points or Gold',async()=>{
  const v=recording();Object.assign(v.match,{eventId:'e',seasonId:'s',context:{affectsLeaguePoints:true,affectsGold:true,affectsPowerRating:true,affectsSeasonStats:true,affectsLifetimeStats:true},scoringSnapshot:seasonScoringSnapshot({act:'MAIN',diplomacyEnabled:false,placementPolicy:'NONE',emperorPlayerId:null}),goldRewardSnapshot:{matchCompletion:1,matchWin:2}});
  const records=seedRecording(v);records.set('events/e',{seasonId:'s',status:'ACTIVE'});records.set('seasons/s',{status:'ACTIVE'});
  for(const p of v.match.participants)records.set('events/e/scoringSlots/MAIN_'+p.playerId,{playerId:p.playerId,act:'MAIN',seasonId:'s',matchId:'m'});
  await resolveRecordingResult('m','G1');await runResultProcessingJob(firestore.collection('processingJobs').doc('MATCH_RESULT_m_R1'),'full-recording-job');
  const job=records.get('processingJobs/MATCH_RESULT_m_R1');assert.equal(job.status,'COMPLETED');assert.deepEqual(job.pendingSteps,[]);assert.equal(records.get('matches/m').processingState,'COMPLETE');assert.equal(records.get('seasons/s/standings/p2').leaguePoints,10);assert.equal(records.get('players/p2').goldBalance,3);
  const ledgerSize=[...records.keys()].filter(k=>k.startsWith('leaguePointLedger/')||k.startsWith('goldLedger/')).length;
  records.set('processingJobs/MATCH_RESULT_m_R1',{...job,status:'PENDING',pendingSteps:['STATISTICS'],completedSteps:job.completedSteps.filter(s=>s!=='STATISTICS'),automation:{status:'PAUSED',leaseExpiresAt:null,lastError:'Temporary statistics issue.'}});records.set('matches/m',{...records.get('matches/m'),processingState:'PENDING'});
  await assert.rejects(adminRetryResultProcessing.run(req({matchId:'m',reason:'Retry recovered statistics inputs.'},'p1')),/administrator/i);
  assert.equal((await adminRetryResultProcessing.run(req({matchId:'m',reason:'Retry recovered statistics inputs.'}))).success,true);assert.equal(records.get('matches/m').processingState,'COMPLETE');assert.equal([...records.keys()].filter(k=>k.startsWith('leaguePointLedger/')||k.startsWith('goldLedger/')).length,ledgerSize);
});

test('Emperor can open an audited correction review without having played; unrelated players cannot',async()=>{
  const records=seedRecording();await resolveRecordingResult('m','G1');records.set('players/outsider',{role:'PLAYER',membershipStatus:'ACTIVE'});records.set('authLinks/outsider',{playerId:'outsider'});
  const input={requestId:'admin-review',matchId:'m',gameId:'G1',category:'OTHER',reason:'Emperor spotted an incorrect recording attribution.'};
  await assert.rejects(disputeCanonicalGameResult.run(req(input,'outsider')),/participant/i);
  await disputeCanonicalGameResult.run(req(input));assert.equal(records.get('matches/m').status,'DISPUTED');assert.ok([...records.values()].some(v=>v.action==='RESULT_CORRECTION_REVIEW_OPENED'));
});

test('personal counted-warmup receipt is viewer scoped and follows reconciled awards, disputes and source withdrawal',async()=>{
 const records=seedRecording();records.set('events/e',{seasonId:'s',status:'ACTIVE',warmupPolicy:{scoringPolicy:'AOF_BEST_WARMUP_V1'},warmupMatchIds:['w1','w2']});
 for(const [id,matchId] of [['p1','w1'],['p2','w1'],['p3','w2']]){records.set('players/'+id,{membershipStatus:'ACTIVE',goldBalance:0});records.set('events/e/scoringSlots/WARMUP_'+id,{playerId:id,matchId,seasonId:'s',act:'WARMUP'});}
 addWarmup(records,'w1',['p1','p2'],'p2');addWarmup(records,'w2',['p1','p3'],'p1');
 await processMatchRewards({matchId:'w1',requestId:'receipt1'},system);await processMatchRewards({matchId:'w2',requestId:'receipt2'},system);
 assert.equal((await readEventRoundoff('e')).viewerWarmupSelection,null);
 assert.equal((await readEventRoundoff('e','unrelated')).viewerWarmupSelection,null);
 assert.equal((await readEventRoundoff('e','p2')).viewerWarmupSelection,null,'one warm-up needs no selection notice');
 const selected=(await readEventRoundoff('e','p1')).viewerWarmupSelection;
 assert.equal(selected.matchId,'w2');assert.equal(selected.points,3);assert.equal(selected.playerId,'p1');assert.equal(selected.otherWarmupCount,1);
 const stored=records.get('events/e/warmupSelections/p1');records.set('events/e/warmupSelections/p1',{...stored,selected:{...stored.selected,sourceHash:'stale'}});
 assert.equal((await readEventRoundoff('e','p1')).viewerWarmupSelection,null,'stale source cannot produce a receipt');records.set('events/e/warmupSelections/p1',stored);
 records.set('matches/w2',{...records.get('matches/w2'),status:'DISPUTED',activeResultDisputeId:'review'});
 assert.equal((await readEventRoundoff('e','p1')).viewerWarmupSelection,null,'dispute withdraws the old notice before reconciliation');
 await reconcileBestWarmups('e');const fallback=(await readEventRoundoff('e','p1')).viewerWarmupSelection;
 assert.equal(fallback.matchId,'w1');assert.equal(fallback.points,1);assert.equal(fallback.win,false);
 records.set('matches/w1/games/G1',{...records.get('matches/w1/games/G1'),activeReplayStatisticsId:'missing'});
 assert.equal((await readEventRoundoff('e','p1')).viewerWarmupSelection,null);
});
