import test from 'node:test';
import assert from 'node:assert/strict';
import {Timestamp} from 'firebase-admin/firestore';
import {memoryFirestore} from './support/memory-firestore.mjs';
import {endOfEventDay} from '../lib/engines/eventCalendar.js';
import {advanceEventWarmups,drawWarmups,writeWarmup} from '../lib/services/warmupLifecycle.js';
import {challengeWarmupGuest,respondToWarmupGuest,adminReplaceWarmupOpponent,adminResolveUnpairedWarmup} from '../lib/commands/events/warmupChallenges.js';
import {adminVerifyAIWarmup,disputeAIWarmup,adminRejectAIWarmup} from '../lib/commands/events/verifyAIWarmup.js';
import {reconcileAIWarmupParticipation} from '../lib/services/aiWarmupParticipation.js';
import {adminGenerateMatchPlan} from '../lib/commands/events/generateMatchPlan.js';
import {adminApproveMatchPlan} from '../lib/commands/events/approveMatchPlan.js';
import {adminFinaliseEvent,adminResolveUnplayedEventMatch} from '../lib/commands/events/finaliseEvent.js';
import {produceFFAPlacements} from '../lib/engines/ffaPlacementProducer.js';
import {placementBonus} from '../lib/engines/ffaPlacements.js';
import {seasonScoringSnapshot,POINT_UNITS} from '../lib/engines/seasonPoints.js';
import {projectStatistics,StatisticsExperience} from '../lib/engines/statisticsExperience.js';
import {statisticsMetadata} from '../lib/services/statisticsExperienceProjection.js';
import {setEventRsvp} from '../lib/commands/events/setRsvp.js';
import {submitGameResult} from '../lib/commands/results/submitGameResult.js';
import {respondToGameResult} from '../lib/commands/results/respondToGameResult.js';
import {adminResolveGameResult} from '../lib/commands/results/adminResolveGameResult.js';
const day=86400000;
const config={maps:{pool:['Arabia'],selectionMode:'ADMIN'},civilizations:{mode:'UNRESTRICTED',allowed:[],banned:[],customRuleCode:null},victory:{conquest:true,wonder:false,relic:false,customRuleCode:null},diplomacyEnabled:false,additionalSettings:{}};
const req=(data,uid='admin')=>({auth:{uid},data});
function fixture(count=3){const now=Date.now(),ids=Array.from({length:count},(_,i)=>'p'+i),entries=[['leagueState/singleton',{activeSeasonId:'s',currentEmperorPlayerId:'admin'}],['seasons/s',{status:'ACTIVE'}]];
 for(const id of ['admin',...ids,'guest','other'])entries.push(['authLinks/'+id,{playerId:id}],['players/'+id,{steamName:id,membershipStatus:'ACTIVE',role:id==='admin'?'ADMIN':'PLAYER'}],['seasons/s/participants/'+id,{status:'ENTERED'}]);
 for(const id of ids)entries.push(['events/e/participants/'+id,{rsvp:'YES',signupState:'CONFIRMED',attendanceStatus:'CHECKED_IN'}]);
 entries.push(['events/e',{seasonId:'s',status:'PUBLISHED',startsAt:Timestamp.fromMillis(now+3*day),timezone:'Europe/Copenhagen',warmupPolicy:{modelVersion:'AOF_WARMUP_LIFECYCLE_V1',scoringPolicy:'AOF_BEST_WARMUP_V1',gameConfig:config,aiDifficulty:'Hard',guestAcceptanceDeadlineAt:Timestamp.fromMillis(now+day)},gameConfig:config,scoringSnapshot:seasonScoringSnapshot({act:'MAIN',diplomacyEnabled:false,placementPolicy:'NONE',emperorPlayerId:null}),goldRewardSnapshot:{matchCompletion:1,matchWin:2},competitionStyle:'BIG_TEAM',planningConfig:{allowAsymmetricTeams:true,preferredTeamSize:4,prioritizeLargestTeams:true}}]);
 return {db:memoryFirestore(entries),now,ids};}

test('calendar midnight follows local Event day across Danish DST transitions',()=>{
 assert.equal(new Date(endOfEventDay(Date.parse('2026-03-29T12:00:00Z'))).toISOString(),'2026-03-29T22:00:00.000Z');
 assert.equal(new Date(endOfEventDay(Date.parse('2026-10-25T12:00:00Z'))).toISOString(),'2026-10-25T23:00:00.000Z');
 assert.equal(new Date(endOfEventDay(Date.parse('2026-10-08T22:30:00Z'))).toISOString(),'2026-10-09T22:00:00.000Z');
 assert.throws(()=>endOfEventDay(Date.now(),'Invalid/Zone'));
});

test('automatic pairing is retry-safe and reserves one scoring warm-up per confirmed member',async()=>{
 const {db,now,ids}=fixture(5);
 await advanceEventWarmups('e',now);
 const first=db.get('events/e').warmupSchedule;
 assert.equal(first.pairs.length,2);
 assert.ok(ids.includes(first.unpairedPlayerId));
 // Verify the Firestore-compatible stored pairing format.
 assert.deepEqual(   first.pairs,   drawWarmups(ids,first.seed).pairs.map(playerIds=>({     playerIds   })) );
 assert.equal(db.get('events/e').warmupMatchIds.length,2);
 await advanceEventWarmups('e',now+1000);
 assert.equal(db.get('events/e').warmupSchedule,first);
 assert.equal(db.get('events/e').warmupMatchIds.length,2);
 assert.deepEqual(drawWarmups([...ids].reverse(),first.seed),drawWarmups(ids,first.seed));
 for(const pair of first.pairs)   for(const id of pair.playerIds)     assert.ok(db.get('events/e/scoringSlots/WARMUP_'+id));});
test('guest acceptance reserves both slots, does not sign up/check in the guest, and expires competing invitations',async()=>{
 const {db,now}=fixture();await advanceEventWarmups('e',now);const unpaired=db.get('events/e').warmupSchedule.unpairedPlayerId;
 const first=await challengeWarmupGuest.run(req({eventId:'e',guestPlayerId:'guest'},unpaired));
 await challengeWarmupGuest.run(req({eventId:'e',guestPlayerId:'other'},unpaired));
 await assert.rejects(respondToWarmupGuest.run(req({eventId:'e',challengeId:first.challengeId,accept:true},'other')),/belongs/);
 const result=await respondToWarmupGuest.run(req({eventId:'e',challengeId:first.challengeId,accept:true},'guest'));
 assert.equal(db.has('events/e/participants/guest'),false);assert.equal(db.get('events/e/warmupGuests/guest').matchId,result.matchId);
 assert.equal(db.get('events/e/scoringSlots/WARMUP_guest').matchId,result.matchId);
 assert.equal(db.get('events/e/warmupChallenges/'+unpaired+'_other').status,'EXPIRED');
 assert.equal((await respondToWarmupGuest.run(req({eventId:'e',challengeId:first.challengeId,accept:true},'guest'))).alreadyAccepted,true);
});
test('eligibility is rechecked at acceptance when a guest becomes inactive',async()=>{
 const {db,now}=fixture();await advanceEventWarmups('e',now);const id=db.get('events/e').warmupSchedule.unpairedPlayerId;
 const invite=await challengeWarmupGuest.run(req({eventId:'e',guestPlayerId:'guest'},id));
 db.set('players/guest',{...db.get('players/guest'),membershipStatus:'INACTIVE'});
 await assert.rejects(respondToWarmupGuest.run(req({eventId:'e',challengeId:invite.challengeId,accept:true},'guest')),/membership is not active/);
 assert.equal(db.has('events/e/scoringSlots/WARMUP_guest'),false);
});
test('expired invitations require human resolution and never create an AI fallback',async()=>{
 const {db,now}=fixture();await advanceEventWarmups('e',now);const id=db.get('events/e').warmupSchedule.unpairedPlayerId;
 await challengeWarmupGuest.run(req({eventId:'e',guestPlayerId:'guest'},id));
 await advanceEventWarmups('e',now+day+1);await advanceEventWarmups('e',now+day+2);
 assert.equal(db.has('matches/e-AI-W'),false);assert.equal(db.get('events/e').warmupSchedule.status,'ADMIN_REVIEW');
 assert.equal(db.get('events/e/warmupChallenges/'+id+'_guest').status,'EXPIRED');
});
test('AI participation is reviewed, awards exactly one point, reverses on dispute and requires re-verification after source replacement',async()=>{
 const {db,now}=fixture(1);
 // Historical AI Battles remain reviewable, but the scheduler creates no new ones.
 await import('../lib/config/firebase.js').then(async ({db:firestore})=>firestore.runTransaction(async tx=>{const ref=firestore.collection('events').doc('e');writeWarmup(tx,ref,db.get('events/e'),['p0'],'e-AI-W',Timestamp.fromMillis(now),true);}));
 const sourceHash='a'.repeat(64),playerId=db.get('matches/e-AI-W').participants[0].playerId;
 db.set('matches/e-AI-W/games/G1',{...db.get('matches/e-AI-W/games/G1'),activeReplayStatisticsId:sourceHash});
 db.set('matches/e-AI-W/games/G1/replaySources/'+sourceHash,{state:'READY',sourceHash,matchId:'e-AI-W',gameId:'G1',opponentMapping:[{replaySlot:2,opponentId:'AI_OPPONENT'}],playerMapping:[{replaySlot:1,playerId}]});
 const data={matchId:'e-AI-W',sourceHash,settingsVerified:true,playedWithinWindow:true,reason:'Observed full replay and verified announced Hard AI settings.'};
 await assert.rejects(adminVerifyAIWarmup.run(req(data,playerId)),/administrator/i);
 await adminVerifyAIWarmup.run(req(data));await adminVerifyAIWarmup.run(req(data));
 assert.equal(db.get('seasons/s/standings/'+playerId).leaguePointUnits,POINT_UNITS);
 assert.equal(db.has('processingJobs/MATCH_RESULT_e-AI-W_R1'),false);assert.equal(db.get('players/'+playerId).goldBalance,undefined);
 await disputeAIWarmup.run(req({matchId:'e-AI-W',reason:'The wrong recording was attached.'},playerId));
 assert.equal(db.get('seasons/s/standings/'+playerId).leaguePoints,0);
 await adminVerifyAIWarmup.run(req(data));assert.equal(db.get('seasons/s/standings/'+playerId).leaguePoints,1);
 await adminRejectAIWarmup.run(req({matchId:'e-AI-W',reason:'Evidence review shows the announced settings were not used.'}));
 assert.equal(db.get('seasons/s/standings/'+playerId).leaguePoints,0);
 assert.equal(db.get('matches/e-AI-W').status,'VOID');
 await assert.rejects(adminVerifyAIWarmup.run(req(data)),/active, mapped/);
 // Independently test replacement while a verified award is active.
 db.set('matches/e-AI-W',{...db.get('matches/e-AI-W'),status:'COMPLETED',aiParticipation:{state:'ADMIN_VERIFIED',sourceHash}});
 await reconcileAIWarmupParticipation('e-AI-W');
 db.set('matches/e-AI-W/games/G1',{...db.get('matches/e-AI-W/games/G1'),activeReplayStatisticsId:'b'.repeat(64)});
 await reconcileAIWarmupParticipation('e-AI-W');assert.equal(db.get('seasons/s/standings/'+playerId).leaguePoints,0);
});

test('late main signup remains separate from the fixed warm-up draw',async()=>{
 const {db,now}=fixture(2);await advanceEventWarmups('e',now);
 const draw=db.get('events/e').warmupSchedule;
 await setEventRsvp.run(req({eventId:'e',rsvp:'YES'},'guest'));
 assert.equal(db.get('events/e/participants/guest').signupState,'CONFIRMED');
 assert.equal(db.get('events/e').warmupSchedule,draw);
 assert.equal(db.has('events/e/scoringSlots/WARMUP_guest'),false);
});

test('late result claims require recording-bound timing review; independent confirmation cannot bypass it',async()=>{
 const {db,now}=fixture(2);await advanceEventWarmups('e',now);
 const id=db.get('events/e').warmupMatchIds[0],match=db.get('matches/'+id),[winner,loser]=match.participants.map(p=>p.playerId),hash='c'.repeat(64);
 db.set('matches/'+id,{...match,playClosesAt:Timestamp.fromMillis(now-1)});
 await submitGameResult.run(req({matchId:id,gameId:'G1',type:'WIN',winnerTeam:1},winner));
 assert.equal(db.get('matches/'+id+'/games/G1/resultSubmissions/'+winner).status,'PENDING_ADMIN_REVIEW');
 await assert.rejects(respondToGameResult.run(req({matchId:id,gameId:'G1',submissionId:winner,response:'CONFIRM'},loser)),/no longer awaiting/);
 const data={requestId:'timing-review',matchId:id,gameId:'G1',submissionId:winner,reason:'Verified the recording and timely play completion.',sourceHash:hash,playedWithinWindow:true};
 await assert.rejects(adminResolveGameResult.run(req(data)),/active recording/);
 db.set('matches/'+id+'/games/G1',{...db.get('matches/'+id+'/games/G1'),activeReplayStatisticsId:hash});
 db.set('matches/'+id+'/games/G1/replaySources/'+hash,{state:'READY',sourceHash:hash,matchId:id,gameId:'G1'});
 await adminResolveGameResult.run(req(data));assert.equal(db.get('matches/'+id).status,'COMPLETED');
 const next=fixture(2);await advanceEventWarmups('e',next.now);const nextId=next.db.get('events/e').warmupMatchIds[0],nextMatch=next.db.get('matches/'+nextId),claimant=nextMatch.participants[0].playerId;
 next.db.set('matches/'+nextId,{...nextMatch,playClosesAt:Timestamp.fromMillis(next.now-1)});
 await submitGameResult.run(req({matchId:nextId,gameId:'G1',type:'WIN',winnerTeam:1},claimant));
 await adminResolveGameResult.run(req({requestId:'reject-timing',matchId:nextId,gameId:'G1',submissionId:claimant,reason:'The Game was completed after the play deadline.',rejectTimingEvidence:true}));
 assert.equal(next.db.get('matches/'+nextId).status,'VOID');assert.equal(next.db.has('seasons/s/standings/'+claimant),false);
});

test('AI Battle measurements retain the human, exclude synthetic league identity and human records, and bind review to source',()=>{
 const metadata={matchId:'ai',gameId:'G1',seasonId:'s',eventId:'e',format:'AI_WARMUP',contextKey:'ai',orderAtMs:1,revision:1,sourceHash:'hash',eligible:true,exclusionReason:null,affectsSeason:false,affectsLifetime:false,roster:[{playerId:'p'}],mapping:[{replaySlot:1,playerId:'p'}],opponents:[{replaySlot:2,opponentId:'AI_OPPONENT'}]};
 const raw={scope:{observedUntilMs:1000},participants:[{replaySlot:1,playerId:1,execution:{apm:12}},{replaySlot:2,playerId:2,execution:{apm:99}}]};
 const projected=projectStatistics(raw,metadata);assert.deepEqual(projected.players.map(p=>p.playerId),['p']);assert.equal(projected.players[0].values.apm,12);
 assert.deepEqual(new StatisticsExperience([projected]).records(),[]);
 const match={opponentKind:'AI',status:'COMPLETED',aiParticipation:{state:'ADMIN_VERIFIED',sourceHash:'old'},context:{affectsSeasonStats:false,affectsLifetimeStats:false}};
 assert.equal(statisticsMetadata('ai','G1',match,{status:'COMPLETED',activeReplayStatisticsId:'new',players:[{playerId:'p'}]},{sourceHash:'new',playerMapping:metadata.mapping,opponentMapping:metadata.opponents}).eligible,false);
});
test('standings determine smaller teams despite contradictory ratings; attendance changes invalidate approval',async()=>{
 const {db,now,ids}=fixture(7);const event=db.get('events/e');db.set('events/e',{...event,startsAt:Timestamp.fromMillis(now-1000),checkInClosesAt:Timestamp.fromMillis(now-1000)});
 for(const [i,id] of ids.entries()){db.set('seasons/s/standings/'+id,{playerId:id,leaguePointUnits:(7-i)*POINT_UNITS,leaguePoints:7-i});db.set('players/'+id,{...db.get('players/'+id),currentPowerRating:1000+i*300});}
 const made=await adminGenerateMatchPlan.run(req({eventId:'e',requestId:'standings-plan'})),plan=db.get('events/e/matchPlans/'+made.planId),match=plan.matches[0];
 const small=match.participants.filter(p=>p.team===2).map(p=>p.playerId).sort();assert.deepEqual(small,['p0','p1','p2']);assert.equal(match.balanceEstimate,undefined);
 db.set('events/e/participants/p6',{rsvp:'NO',signupState:'NONE',attendanceStatus:'NOT_CHECKED'});
 await assert.rejects(adminApproveMatchPlan.run(req({eventId:'e',planId:made.planId,requestId:'reject-stale-plan'})),/Attendance changed/);
 assert.equal(db.has('matches/'+made.planId+'-M1'),false);
});
test('unplayed cancellation preserves reservations; replacement transfers the survivor slot with an audit',async()=>{
 const {db,now}=fixture(2);await advanceEventWarmups('e',now);const id=db.get('events/e').warmupMatchIds[0],match=db.get('matches/'+id),[survivor,withdrawn]=match.participants.map(p=>p.playerId);
 const replacement=await adminReplaceWarmupOpponent.run(req({matchId:id,withdrawnPlayerId:withdrawn,replacementPlayerId:'guest',reason:'Original opponent withdrew before play.'}));
 assert.equal(db.get('matches/'+id).status,'CANCELLED');assert.equal(db.get('events/e/scoringSlots/WARMUP_'+survivor).matchId,replacement.matchId);assert.equal(db.get('events/e/scoringSlots/WARMUP_'+withdrawn).matchId,id);
 await adminResolveUnplayedEventMatch.run(req({matchId:replacement.matchId,reason:'Neither player can complete the replacement.'}));
 assert.equal(db.get('events/e/scoringSlots/WARMUP_guest').matchId,replacement.matchId);assert.equal(db.has('seasons/s/standings/guest'),false);
});
test('Event closure waits for resolved Games and current processing, then closes idempotently without publishing evidence',async()=>{
 const {db,now}=fixture(2);const event=db.get('events/e');db.set('events/e',{...event,startsAt:Timestamp.fromMillis(now-1000),warmupPolicy:null});
 db.set('matches/main',{eventId:'e',seasonId:'s',status:'COMPLETED',scoringSnapshot:event.scoringSnapshot,canonicalResult:{revision:2}});
 db.set('matches/main/games/G1',{status:'COMPLETED'});
 db.set('processingJobs/MATCH_RESULT_main_R2',{matchId:'main',resultRevision:2,status:'PENDING',pendingSteps:['STATISTICS']});
 await assert.rejects(adminFinaliseEvent.run(req({eventId:'e',expectedRevision:0})),/checklist/);
 db.set('processingJobs/MATCH_RESULT_main_R2',{matchId:'main',resultRevision:2,status:'COMPLETED',pendingSteps:[]});
 await adminFinaliseEvent.run(req({eventId:'e',expectedRevision:0}));assert.equal(db.get('events/e').status,'COMPLETED');assert.equal(db.get('events/e').resultsRelease,undefined);
 assert.equal((await adminFinaliseEvent.run(req({eventId:'e',expectedRevision:0}))).alreadyFinalised,true);
});
test('withdrawing the unpaired player creates an explicit resolution without AI or points',async()=>{
 const {db,now}=fixture(1);await advanceEventWarmups('e',now);db.set('events/e/participants/p0',{rsvp:'NO',signupState:'NONE'});
 await advanceEventWarmups('e',now+day+1);assert.equal(db.get('events/e').warmupSchedule.status,'ADMIN_REVIEW');assert.equal(db.has('matches/e-AI-W'),false);
 await adminResolveUnpairedWarmup.run(req({eventId:'e',reason:'Player withdrew; warm-up remains unplayed.'}));assert.equal(db.get('events/e').warmupSchedule.status,'RESOLVED_UNPLAYED');
});
test('FFA producer refuses commands/unregistered adapters; qualified ties share occupied positions',()=>{
 const hash='a'.repeat(64),binding={policy:'ELIMINATION_ORDER',sourceStatisticsId:hash,replaySha256:hash,resultRevision:1,rosterIds:['p1','p2','p3','p4','p5'],winnerIds:['p1'],replayPlayerMapping:[1,2,3,4,5].map(n=>({replayPlayerId:n,playerId:'p'+n}))};
 const facts={source:{replaySha256:hash},players:[1,2,3,4,5].map(playerId=>({playerId})),game:{observedDurationMs:10000},result:{eliminationOutcomeEvidence:{adapterVersion:'CONTROLLED_TEST_ONLY',sourceHash:hash,coverage:'COMPLETE',diplomacyEnabled:false,restoredGame:false,eliminations:[2,3,4,5].map((n,i)=>({replayPlayerId:n,sourceEventId:'outcome-'+n,operationOrdinal:i,atMs:i<2?9000:7000-i*1000,outcome:'ELIMINATED'}))}}};
 assert.equal(produceFFAPlacements(facts,binding).state,'PENDING');
 const result=produceFFAPlacements(facts,binding,['CONTROLLED_TEST_ONLY']);assert.equal(result.state,'VERIFIED');assert.equal(placementBonus(result.qualifiedFFAPlacements,'p2'),1.5);assert.equal(placementBonus(result.qualifiedFFAPlacements,'p3'),1.5);
 const missing=structuredClone(facts);missing.result.eliminationOutcomeEvidence.eliminations.pop();assert.equal(produceFFAPlacements(missing,binding,['CONTROLLED_TEST_ONLY']).state,'PENDING');
 const wrong=structuredClone(facts);wrong.result.eliminationOutcomeEvidence.eliminations[0].replayPlayerId=1;assert.equal(produceFFAPlacements(wrong,binding,['CONTROLLED_TEST_ONLY']).state,'PENDING');
});
