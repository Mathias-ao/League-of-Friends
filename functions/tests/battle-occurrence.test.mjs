import test from 'node:test';
import assert from 'node:assert/strict';
import {bindingDigest} from '../lib/engines/nativeRecordingIntegration.js';
import {BATTLE_OCCURRENCE_VERSION,occurrenceSourceBinding,verifiedOccurrence,
 compareOccurrence,qualifyThreeBattleLosses,sourceBoundReadyReceiptMillis} from '../lib/integration/battleOccurrence.js';
import {deriveScopedOccurrenceOrders,deriveSocialScheduleOrders} from '../lib/integration/socialScheduleOrder.js';
import {ready} from './support/private-history-fixture.mjs';
import {collectMyCurrentBattleHistory} from '../lib/queries/getMyPersonalityHistory.js';

const sha=n=>String(n.toString(16)).repeat(64).slice(0,64);
const t=n=>({toMillis:()=>n});
const make=(battleId,opts={})=>{
 const warmup=opts.warmup??false,eventId=opts.event??'ev',seasonId=opts.season??'season',
  g=opts.game??'G1',win=opts.win??'A',sourceHash=sha((opts.seed??1)+1);
 const players=[{playerId:'A',team:1},{playerId:'B',team:2}];
 const mainPlan={status:'APPROVED',officialMatchIds:[battleId],matches:[{}]};
 const event={seasonId,startsAt:t(100000),officialMatchIds:warmup?[]:[battleId],
  warmupMatchIds:warmup?[battleId]:[],approvedMatchPlanId:'plan',
  matchPlanStatus:'APPROVED'};
 const match={eventId,seasonId,status:'COMPLETED',opponentKind:'HUMAN',
  format:'ONE_V_ONE',participants:players,matchNumber:warmup?0:1,
  sourceMatchPlanId:warmup?null:'plan',scoringSnapshot:{rules:{act:warmup?'WARMUP':'MAIN'}},
  seriesRule:{maxGames:1,gamesRequiredToWin:1},canonicalResult:null};
 const game={gameNumber:1,status:'COMPLETED',players,
  activeReplayStatisticsId:sourceHash,canonicalResult:{
   revision:1,source:'PLAYER_CONFIRMED',type:'PLAYER_WIN',
   winningPlayerIds:[win],losingPlayerIds:[win==='A'?'B':'A']}};
 const b={battleId,match,event,plan:warmup?null:mainPlan,planId:warmup?null:'plan',
  games:[{gameId:g,game,source:{sourceHash,gameGuid:'guid-'+battleId,
   mappingDigest:'mapping-'+battleId,provenanceDigest:bindingDigest(['source',battleId]),publicationAtMs:100000000}}],occurrence:null};
 if(opts.interval)approve(b,opts.interval[0],opts.interval[1]);
 return b;
};
const approve=(b,begin,end,precedes=[])=>{
 const binding=occurrenceSourceBinding(b);
 assert.ok(binding,'fixture must qualify as original current official Battle');
 const bounds=b.games.filter(g=>g.game.status!=='NO_CONTEST').map((g,i)=>({
  gameId:g.gameId,notBeforeMs:begin+i*120,notAfterMs:end+i*120}));
 b.occurrence={version:BATTLE_OCCURRENCE_VERSION,battleId:b.battleId,
  status:'APPROVED',sourceBinding:binding,revision:1,bounds,precedes,
  proof:{kind:'MUTUAL_PARTICIPANTS',participants:['A','B']}};
 return b;
};
test('one READY server receipt extractor covers ordinary AUTO and reviewed native publication only',()=>{
 const base={state:'READY',matchId:'m',gameId:'g',sourceHash:'a'.repeat(64)};
 const normal={...base,ordinaryUploadVersion:'AOF_NATIVE_PLAYER_UPLOAD_V1',
  uploadedAt:t(9000),publication:{publishedAt:t(20000)}};
 assert.equal(sourceBoundReadyReceiptMillis(normal,'m','g','a'.repeat(64)),9000);
 const reviewed={...base,publication:{version:'AOF_NATIVE_READY_PUBLICATION_1',
  publicationId:'trusted-publication',publishedAt:t(7000)}};
 assert.equal(sourceBoundReadyReceiptMillis(reviewed,'m','g','a'.repeat(64)),7000);
 assert.equal(sourceBoundReadyReceiptMillis({...base,publishedAt:t(1000)},'m','g','a'.repeat(64)),null);
 assert.equal(sourceBoundReadyReceiptMillis({...normal,sourceHash:'b'.repeat(64)},'m','g','a'.repeat(64)),null);
 assert.equal(sourceBoundReadyReceiptMillis({...base,ordinaryUploadVersion:'AOF_NATIVE_PLAYER_UPLOAD_V1',
  uploadedAt:null},'m','g','a'.repeat(64)),null);
});
test('warmup before MAIN, late guest after MAIN and cross-Event are proven by play, not registration',()=>{
 const a=make('z-late-registration',{warmup:true,seed:1,interval:[1000,2000]});
 const b=make('a-main',{seed:2,interval:[4000,5000]});
 const c=make('b-guest',{event:'later',warmup:true,seed:3,interval:[8000,9000]});
 const rows=deriveScopedOccurrenceOrders([c,b,a],['a-main','z-late-registration','b-guest']);
 assert.ok(rows.every(x=>x.status==='ORDERED'));
 assert.equal(rows.find(x=>x.battleId==='z-late-registration').order.event,1);
 assert.equal(rows.find(x=>x.battleId==='a-main').order.event,2);
 assert.equal(rows.find(x=>x.battleId==='b-guest').order.event,3);
 a.match.createdAt=t(999999999);a.match.completedAt=t(55);a.games[0].game.uploadedAt=t(1);
 assert.deepEqual(deriveScopedOccurrenceOrders([a,b,c],['z-late-registration','a-main','b-guest'])
  .map(x=>[x.battleId,x.order.event]).sort((x,y)=>x[0].localeCompare(y[0])),
  rows.map(x=>[x.battleId,x.order.event]).sort((x,y)=>x[0].localeCompare(y[0])));
});
test('missing, uncertain, conflicting or equal actual order remains Pending; unrelated source is independent',()=>{
 const a=make('A',{warmup:true,seed:1,interval:[1000,3000]});
 const b=make('B',{seed:2,interval:[2000,4000]});
 const c=make('C',{warmup:true,seed:3,interval:[5000,6000]});
 assert.ok(deriveScopedOccurrenceOrders([a,b,c],['A','B']).every(x=>x.status==='PENDING'));
 assert.ok(deriveScopedOccurrenceOrders([a,b,c],['A','C']).every(x=>x.status==='ORDERED'));
 b.occurrence=null;
 assert.ok(deriveScopedOccurrenceOrders([a,b,c],['A','B']).every(x=>x.order===null));
 assert.ok(deriveScopedOccurrenceOrders([a,b,c],['A','C']).every(x=>x.order!==null));
 approve(b,7000,8000,[{battleId:'A',sourceBinding:verifiedOccurrence(a).binding,
  revision:verifiedOccurrence(a).revision}]);
 assert.equal(compareOccurrence('A','B',[a,b,c]),'CONFLICT');
 assert.ok(deriveScopedOccurrenceOrders([a,b,c],['A','B']).every(x=>x.order===null));
 a.occurrence.revision++;
 assert.equal(compareOccurrence('A','B',[a,b,c]),'BEFORE',
  'a reviewed edge never survives the target approval revision');
});
test('contradictory later unrelated peers cannot veto a proven earlier Battle pair',()=>{
 const a=make('A',{warmup:true,seed:20,interval:[1000,2000]});
 const b=make('B',{seed:21,interval:[3000,4000]});
 const c=make('C',{warmup:true,seed:22,interval:[6000,7000]});
 const d=make('D',{seed:23,interval:[9000,10000]});
 approve(d,9000,10000,[{battleId:'C',
   sourceBinding:verifiedOccurrence(c).binding,revision:verifiedOccurrence(c).revision}]);
 assert.equal(compareOccurrence('C','D',[a,b,c,d]),'CONFLICT');
 assert.equal(compareOccurrence('A','B',[a,b,c,d]),'BEFORE',
  'contradiction in later unrelated history does not contaminate A vs B');
 assert.ok(deriveScopedOccurrenceOrders([a,b,c,d],['A','B']).every(o=>o.status==='ORDERED'));
});
test('first-third loss survives void and replaced peers and two unordered later defeats',()=>{
 const a=make('first',{warmup:true,seed:30,interval:[1000,2000]});
 const b=make('second',{seed:31,interval:[3000,4000]});
 const c=make('third',{warmup:true,seed:32,interval:[5000,6000]});
 const later1=make('later-one',{seed:33,interval:[7500,9500]});
 const later2=make('later-two',{warmup:true,seed:34,interval:[8000,9900]});
 const voided=make('voided',{seed:35});
 voided.match.status='VOID';
 const replaced=make('replaced',{warmup:true,seed:36});
 replaced.match.replacementMatchId='replacement-battle';
 const cohort=[a,b,c,later1,later2,voided,replaced];
 assert.equal(compareOccurrence('later-one','later-two',cohort),'UNKNOWN');
 const qualified=qualifyThreeBattleLosses(cohort,'B');
 assert.equal(qualified.length,1);
 assert.equal(qualified[0].anchorBattleId,'third');
 const unplaced=make('possible-earlier',{warmup:true,seed:37});
 assert.equal(qualifyThreeBattleLosses([...cohort,unplaced],'B').length,0,
  'possibly earlier same-opponent unresolved loss cannot be silently skipped');
});
test('correcting a material intermediary precedence witness retracts a third-loss chain',()=>{
 const a=make('first',{warmup:true,seed:40,interval:[1000,3000]});
 const b=make('second',{seed:41,interval:[2000,4000]});
 const c=make('third',{warmup:true,seed:42,interval:[3500,5500]});
 approve(a,1000,3000,[{battleId:'second',
   sourceBinding:verifiedOccurrence(b).binding,revision:verifiedOccurrence(b).revision}]);
 approve(b,2000,4000,[{battleId:'third',
   sourceBinding:verifiedOccurrence(c).binding,revision:verifiedOccurrence(c).revision}]);
 assert.equal(qualifyThreeBattleLosses([a,b,c],'B').length,1);
 c.occurrence.revision++;
 assert.equal(qualifyThreeBattleLosses([a,b,c],'B').length,0,
  'updating target approval revision invalidates the intermediary edge');
});
test('warmup is eligible before a MAIN plan exists; absent other-class list is not a missing play witness',()=>{
 const early=make('warmup-before-plan',{warmup:true,seed:9});
 delete early.event.officialMatchIds;
 delete early.event.approvedMatchPlanId;
 delete early.event.matchPlanStatus;
 approve(early,1000,2000);
 assert.ok(verifiedOccurrence(early));
 const main=make('main-without-warmups',{seed:10});
 delete main.event.warmupMatchIds;
 approve(main,5000,6000);
 assert.ok(verifiedOccurrence(main));
 const rows=deriveScopedOccurrenceOrders([main,early],['warmup-before-plan','main-without-warmups']);
 assert.ok(rows.every(r=>r.status==='ORDERED'));
});
test('source revision, corrected result, replacement and raw headers never authorize a stale order',()=>{
 const a=make('warmup',{warmup:true,seed:4,interval:[1000,2000]});
 assert.ok(verifiedOccurrence(a));
 a.games[0].game.recordingHeader={de:{timestamp:10}};
 a.games[0].game.canonicalResult.revision++;
 assert.equal(verifiedOccurrence(a),null);
 approve(a,1000,2000);
 a.games[0].source.publicationAtMs++;
 assert.equal(verifiedOccurrence(a),null,'receipt correction retracts approval even with unchanged replay SHA');
 approve(a,1000,2000);
 a.match.replacementMatchId='other';
 assert.equal(verifiedOccurrence(a),null);
 a.match.replacementMatchId=null;
 a.games[0].source=null;
 assert.equal(verifiedOccurrence(a),null);
});
test('MAIN-only legacy schedule path stays unchanged when no occurrence evidence exists',()=>{
 const a=make('only-main',{seed:6});
 const rows=deriveScopedOccurrenceOrders([a],['only-main']);
 const baseline=deriveSocialScheduleOrders([{...a,games:a.games.map(g=>({gameId:g.gameId,game:g.game}))}]);
 assert.equal(rows[0].order.event,baseline[0].order.event);
 assert.equal(rows[0].basis,'APPROVED_EVENT_SCHEDULE_AND_PLAN_GAME_NUMBER');
});
test('source current three distinct official losses by canonical opponent qualify only first third',()=>{
 const a=make('first',{warmup:true,seed:1,interval:[1000,2000]});
 const b=make('second',{seed:2,interval:[3000,4000]});
 const c=make('third',{warmup:true,seed:3,interval:[5000,6000]});
 const d=make('fourth',{seed:4,interval:[7000,8000]});
 let q=qualifyThreeBattleLosses([d,c,a,b],'B');
 assert.equal(q.length,1);assert.equal(q[0].anchorBattleId,'third');
 assert.deepEqual(q[0].witnessBattleIds,['first','second','third']);
 const rev=q[0].revision;
 c.occurrence.revision++;
 q=qualifyThreeBattleLosses([d,c,a,b],'B');
 assert.equal(q.length,1);
 assert.notEqual(q[0].revision,rev,'re-reviewing the third historical placement changes proof revision');
 assert.equal(qualifyThreeBattleLosses([a,b],'B').length,0);
 b.games[0].game.canonicalResult.winningPlayerIds=['B'];
 b.games[0].game.canonicalResult.losingPlayerIds=['A'];
 approve(b,3000,4000);
 assert.equal(qualifyThreeBattleLosses([a,b,c],'B').length,0);
});
test('a missing possibly earlier loss prevents third-loss claims; unrelated player history does not',()=>{
 const a=make('first',{warmup:true,seed:1,interval:[1000,2000]});
 const b=make('second',{seed:2,interval:[3000,4000]});
 const c=make('third',{warmup:true,seed:3,interval:[5000,6000]});
 const unsure=make('unplaced',{warmup:true,seed:4});
 assert.equal(qualifyThreeBattleLosses([a,b,c,unsure],'B').length,0);
 assert.equal(qualifyThreeBattleLosses([a,b,c],'B').length,1);
 const different=make('different',{warmup:true,seed:5});
 different.match.participants=[{playerId:'B',team:1},{playerId:'C',team:2}];
 different.games[0].game.players=[{playerId:'B',team:1},{playerId:'C',team:2}];
 assert.equal(qualifyThreeBattleLosses([a,b,c,different],'B').length,1);
 // Official source-verified win with no placement cannot be a previous loss.
 const nonLoss=make('won-unplaced',{warmup:true,seed:7,win:'B'});
 assert.equal(qualifyThreeBattleLosses([a,b,c,nonLoss],'B').length,1);
 assert.equal(qualifyThreeBattleLosses([a,b,c,a],'B').length,0,
  'same canonical Battle cannot count as independent evidence');
 const duplicate=make('dup-guid',{warmup:true,seed:8,interval:[9000,10000]});
 duplicate.games[0].source.gameGuid=a.games[0].source.gameGuid;
 assert.equal(qualifyThreeBattleLosses([a,b,c,duplicate],'B').length,0,
  'one native original cannot count as two Battle losses');
});
test('three completed Games in one verified BO3 still count as only one Battle',()=>{
 const a=make('bo3',{warmup:true,seed:1,interval:[1000,2000]});
 a.match.seriesRule={maxGames:3,gamesRequiredToWin:2};
 const g1=a.games[0];
 const g2=structuredClone(g1);
 g2.gameId='G2';g2.game.gameNumber=2;g2.source={...g1.source,
  sourceHash:sha(7),gameGuid:'guid-game-two',mappingDigest:'mapping-game-two',provenanceDigest:bindingDigest(['source','game-two'])};
 g2.game.activeReplayStatisticsId=g2.source.sourceHash;
 const g3={gameId:'G3',game:{status:'NO_CONTEST',gameNumber:3,players:g1.game.players,
  resolutionReason:'Series decided by G2',activeReplayStatisticsId:null,canonicalResult:null},source:null};
 a.games=[g1,g2,g3];
 a.match.canonicalResult={revision:1,sourceGameId:'G2',seriesGameRevisions:{G1:1,G2:1},winningPlayerIds:['A']};
 a.occurrence=null;
 const bind=occurrenceSourceBinding(a);
 assert.ok(bind);
 a.occurrence={version:BATTLE_OCCURRENCE_VERSION,battleId:a.battleId,status:'APPROVED',
  sourceBinding:bind,revision:1,bounds:[
   {gameId:'G1',notBeforeMs:1000,notAfterMs:2000},
   {gameId:'G2',notBeforeMs:3000,notAfterMs:4000}],
  precedes:[],proof:{kind:'ADMIN_REVIEWED'}};
 assert.ok(verifiedOccurrence(a));
 assert.equal(qualifyThreeBattleLosses([a],'B').length,0);
 assert.equal(deriveScopedOccurrenceOrders([a],['bo3']).length,2);
 a.games[1].game.activeReplayStatisticsId=sha(8);
 assert.equal(verifiedOccurrence(a),null);
});
test('the authenticated real READY loader and writer canonicalize the same producer/artifact proof',async()=>{
 const f=await ready(),current=await collectMyCurrentBattleHistory({...f.input,includeScheduleOrder:true});
 assert.equal(current.loaded.length,1);
 const loaded=current.loaded[0];
 const row=current.occurrenceBattles[0].games[0];
 const source=f.rows.get('matches/m/games/g/replaySources/'+loaded.source.sourceHash);
 const game=f.rows.get('matches/m/games/g');
 assert.equal(loaded.producerRevision,source.processorRevision);
 assert.equal(row.source.provenanceDigest,bindingDigest([
  loaded.source.sourceHash,loaded.source.statisticsRevision,loaded.source.artifactRefs,loaded.producerRevision]));
 assert.equal(row.source.provenanceDigest,bindingDigest([source.sourceHash,game.replayStatisticsRevision,
  [{kind:'STATISTICS',digest:source.statistics.sha256,generation:String(source.statistics.generation)},
   {kind:'RECORDED_EVENTS',digest:source.recordedEvents.sha256,generation:String(source.recordedEvents.generation)},
   {kind:'ORIGINAL',digest:source.originalRecording.sha256,generation:String(source.originalRecording.generation)}],
  source.processorRevision]));
});
test('collector fences both existing and absent occurrence records after current source read',async()=>{
 const f=await ready(),input={...f.input,includeScheduleOrder:true};
 const current=await collectMyCurrentBattleHistory(input);
 assert.equal(current.occurrenceBattles.length,1);
 f.rows.set('matches/m/occurrence/current',{status:'APPROVED',version:BATTLE_OCCURRENCE_VERSION,
  sourceBinding:'old'});
 await assert.rejects(current.revalidate(),e=>e.code==='aborted');
 const g=await ready(),newHistory=await collectMyCurrentBattleHistory({...g.input,includeScheduleOrder:true});
 g.onFinal(()=>g.rows.set('matches/m/occurrence/current',{status:'PENDING',revision:1}));
 await assert.rejects(newHistory.revalidate(),e=>e.code==='aborted');
});


test('Sol 6060246964: an A→B path through a material X↔Y↔Z cycle is not historical proof',()=>{
 const X=make('X',{warmup:true,seed:61,interval:[100,200]});
 const Z=make('Z',{warmup:true,seed:62,interval:[150,350]});
 const Y=make('Y',{warmup:true,seed:63,interval:[300,400]});
 const A=make('A',{warmup:true,seed:64,interval:[100,900]});
 const B=make('B',{warmup:true,seed:65,interval:[100,900]});
 // Same revised source and approval witnesses as Sol's exact graph.
 const edge=(from,to)=>({battleId:to.battleId,
   sourceBinding:verifiedOccurrence(to).binding,revision:verifiedOccurrence(to).revision});
 Z.occurrence.precedes=[edge(Z,X)];
 Y.occurrence.precedes=[edge(Y,Z)];
 X.occurrence.precedes=[edge(X,B)];
 A.occurrence.precedes=[edge(A,Y)];
 const cohort=[X,Z,Y,A,B];
 assert.equal(compareOccurrence('X','Y',cohort),'CONFLICT');
 assert.equal(compareOccurrence('A','B',[X,Y,A,B]),'UNKNOWN');
 assert.notEqual(compareOccurrence('A','B',cohort),'BEFORE',
  'a cycle-contaminated dependency path must not establish A before B');
 assert.ok(deriveScopedOccurrenceOrders(cohort,['A','B']).every(row=>row.status==='PENDING'),
  'dependent social progression withholds ambiguous chronology');
 const F=make('first-loss',{warmup:true,seed:66,interval:[10,90]});
 // X/Z/Y are chronology peers, but not respondent B losses: this checks
 // the first-third anchored chain F < A ? B without adding extraneous losses.
 for(const peer of [X,Z,Y]){
  peer.match.participants=[{playerId:'C',team:1},{playerId:'D',team:2}];
  peer.games[0].game.players=[{playerId:'C',team:1},{playerId:'D',team:2}];
  peer.games[0].game.canonicalResult.winningPlayerIds=['C'];
  peer.games[0].game.canonicalResult.losingPlayerIds=['D'];
  approve(peer,peer.occurrence.bounds[0].notBeforeMs,peer.occurrence.bounds[0].notAfterMs);
 }
 // Regenerate the edges with the updated canonical peer source revisions.
 Z.occurrence.precedes=[edge(Z,X)];Y.occurrence.precedes=[edge(Y,Z)];
 X.occurrence.precedes=[edge(X,B)];A.occurrence.precedes=[edge(A,Y)];
 assert.equal(qualifyThreeBattleLosses([F,A,B,X,Y,Z],'B').length,0,
  'a first-third loss may not use a corrupted intermediary order');
});
