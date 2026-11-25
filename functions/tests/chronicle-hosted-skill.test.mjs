import test from 'node:test';
import assert from 'node:assert/strict';
import {bindingDigest} from '../lib/engines/nativeRecordingIntegration.js';
import {BATTLE_OCCURRENCE_VERSION,occurrenceSourceBinding,qualifyThreeBattleLosses}
  from '../lib/integration/battleOccurrence.js';
import {selectRareChronicleProposals} from '../lib/engines/chronicleRareSelector.js';
import {chronicleEligibleCooldown,chronicleInteractionMode,assertChronicleInteractionEmulator,reviewedChronicleMomentCurrent}
  from '../lib/queries/chronicleInteractionService.js';
import {HOSTED_SKILL_METHOD,HOSTED_SKILL_POLICY_VERSION,
  hostedSkillEnvironment,readHostedSkillPolicy,orderedHostedSkillBattles,currentSeasonChronicleBattles,qualifiedHostedSkillMoment}
  from '../lib/engines/chronicleHostedSkill.js';

const hex=n=>String(n.toString(16)).repeat(64).slice(0,64);
const t=n=>({toMillis:()=>n});
const eu={GCLOUD_PROJECT:'age-of-friends-staging-eu',FUNCTION_REGION:'europe-west1',
 AOF_CHRONICLE_PRIVATE_INTERACTIONS:'source-v1',AOF_BATTLE_OCCURRENCE_V1:'source-v1'};
const rawPolicy={version:HOSTED_SKILL_POLICY_VERSION,projectId:'age-of-friends-staging-eu',
 region:'europe-west1',status:'APPROVED',ownerApproved:true,approvalRef:'OWNER_CHRONICLE_V1',
 method:HOSTED_SKILL_METHOD,families:['SKILL_ACKNOWLEDGMENT'],
 rarity:'REVIEWED_TURNING_POINT',publicTestimony:false,relationshipEffects:false,
 officialWrites:false,automaticOffers:false};
const pinned={...eu,AOF_CHRONICLE_PRIVATE_POLICY_SHA256:bindingDigest(rawPolicy)};
const policy=()=>readHostedSkillPolicy(pinned,rawPolicy);
function make(battleId,{seed=1,win='A',warmup=false,interval=null,opponent='A'}={}){
 const players=[{playerId:opponent,team:1},{playerId:'B',team:2}],sourceHash=hex(seed+1);
 const eventId='event-'+battleId,seasonId='season';
 const event={seasonId,startsAt:t(100000),officialMatchIds:warmup?[]:[battleId],
  warmupMatchIds:warmup?[battleId]:[],approvedMatchPlanId:'plan',matchPlanStatus:'APPROVED'};
 const plan={status:'APPROVED',officialMatchIds:[battleId],matches:[{}]};
 const match={eventId,seasonId,status:'COMPLETED',opponentKind:'HUMAN',format:'ONE_V_ONE',
  participants:players,matchNumber:warmup?0:1,sourceMatchPlanId:warmup?null:'plan',
  scoringSnapshot:{rules:{act:warmup?'WARMUP':'MAIN'}},seriesRule:{maxGames:1,gamesRequiredToWin:1},canonicalResult:null};
 const game={gameNumber:1,status:'COMPLETED',players,activeReplayStatisticsId:sourceHash,
  canonicalResult:{revision:1,source:'PLAYER_CONFIRMED',type:'PLAYER_WIN',
   winningPlayerIds:[win],losingPlayerIds:[win==='B'?opponent:'B']}};
 const b={battleId,match,event,plan:warmup?null:plan,planId:warmup?null:'plan',
  games:[{gameId:'G1',game,source:{sourceHash,gameGuid:'guid-'+battleId,
    mappingDigest:'mapping-'+battleId,provenanceDigest:bindingDigest([sourceHash,battleId]),
    publicationAtMs:999999999}}],occurrence:null};
 if(interval)approve(b,interval[0],interval[1]);
 return b;
}
function approve(b,start,end){
 const binding=occurrenceSourceBinding(b);
 assert.ok(binding,'controlled Battle must be source-current and official');
 b.occurrence={version:BATTLE_OCCURRENCE_VERSION,battleId:b.battleId,status:'APPROVED',
  sourceBinding:binding,revision:(b.occurrence?.revision??0)+1,
  bounds:b.games.filter(g=>g.game.status==='COMPLETED').map((g,i)=>({
   gameId:g.gameId,notBeforeMs:start+2500*i,notAfterMs:end+2500*i})),
  precedes:[],proof:{kind:'MUTUAL_PARTICIPANTS',participants:['A','B']}};
 return b;
}
function trilogy(){
 const a=make('first',{seed:1,warmup:true,interval:[1000,1800]});
 const b=make('second',{seed:2,interval:[3000,3800]});
 const c=make('third',{seed:3,warmup:true,interval:[5000,5800]});
 return [a,b,c];
}
function reviewFor(proof,battle){
 return {incidentId:'review-skill-B',battleId:battle.battleId,respondentPlayerId:'B',
   counterpartPlayerId:'A',family:'SKILL_ACKNOWLEDGMENT',
   qualifierMethod:HOSTED_SKILL_METHOD,qualification:'ADMITTED',
   significance:'REVIEWED_TURNING_POINT',methodReview:'OWNER_REVIEWED_RARITY',
   reviewedSource:'THIRD_OFFICIAL_BATTLE_LOSS',approvalRef:'OWNER_CHRONICLE_V1',
   lossRevision:proof.revision,anchorSourceBinding:occurrenceSourceBinding(battle),
   witnessBattleIds:[...proof.witnessBattleIds],reviewedBy:'impartialReviewer',
   rarityReason:'An owner-reviewed genuinely exceptional three-meeting turning point'};
}
const candidateFor=(b,proof,review=reviewFor(proof,b))=>
 qualifiedHostedSkillMoment({battle:b,proof,review,reviewDocId:review?.incidentId??'none',
  policy:policy(),respondent:'B',sourceAuthority:hex(12)});

test('hosted access requires the exact EU project, Functions region and explicit default-off opt-in; demo stays separate',()=>{
 assert.equal(hostedSkillEnvironment({}),false);
 assert.equal(hostedSkillEnvironment(eu),true);
 assert.equal(chronicleInteractionMode(eu),'hosted');
 for(const changes of [
  {GCLOUD_PROJECT:'age-of-friends-prod'},{GCLOUD_PROJECT:'demo-aof'},
  {FUNCTION_REGION:'us-central1'},{FUNCTIONS_EMULATOR:'true'},
  {FIRESTORE_EMULATOR_HOST:'localhost:8080'}, {FIREBASE_AUTH_EMULATOR_HOST:'localhost:9099'},
  {AOF_CHRONICLE_PRIVATE_INTERACTIONS:'off'},
  {AOF_BATTLE_OCCURRENCE_V1:'off'},
  {GOOGLE_CLOUD_PROJECT:'age-of-friends-prod'}
 ]){
  const env={...eu,...changes};
  assert.equal(hostedSkillEnvironment(env),false,JSON.stringify(changes));
  assert.throws(()=>chronicleInteractionMode(env),/inactive/);
 }
 assert.equal(readHostedSkillPolicy(eu,rawPolicy),null,'policy pin is separately required');
 assert.ok(policy());
 assert.equal(readHostedSkillPolicy({...pinned,AOF_CHRONICLE_PRIVATE_POLICY_SHA256:hex(1)},rawPolicy),null);
 assert.equal(readHostedSkillPolicy(pinned,{...rawPolicy,families:['SITUATED_GRIEVANCE']}),null);
 assert.equal(readHostedSkillPolicy(pinned,{...rawPolicy,status:'PROPOSED'}),null);
 assert.throws(()=>assertChronicleInteractionEmulator(eu),/inactive/);
 const demo={GCLOUD_PROJECT:'demo-aof',FUNCTIONS_EMULATOR:'true',AOF_CHRONICLE_INTERACTIONS_V1E:'emulator-only'};
 assert.equal(chronicleInteractionMode(demo),'emulator');
 assert.equal(readHostedSkillPolicy({...pinned,...demo},rawPolicy),null);
});
test('third distinct complete current 1v1 Battle loss, same immutable opponent and strict warmup/MAIN order qualify once',()=>{
 const battles=trilogy(),proofs=qualifyThreeBattleLosses(battles,'B');
 assert.equal(proofs.length,1);assert.equal(proofs[0].anchorBattleId,'third');
 assert.deepEqual(proofs[0].witnessBattleIds,['first','second','third']);
 assert.deepEqual(orderedHostedSkillBattles([...battles].reverse(),'B'),['first','second','third']);
 const review=reviewFor(proofs[0],battles[2]);
 const c=candidateFor(battles[2],proofs[0],review);
 assert.equal(c.family,'SKILL_ACKNOWLEDGMENT');
 assert.equal(c.thirdLoss.anchorBattleId,'third');
 assert.equal(c.qualification,'ADMITTED');
 const proposals=selectRareChronicleProposals({battle:{
   battleId:'third',playerIds:['A','B'],currentGames:[{gameId:'G1',sourceAuthority:hex(12)}],
   evidenceComplete:true,chronologyQualified:true},candidates:[c],
   policy:policy().selection,existingSlots:[]});
 assert.equal(proposals.length,1);assert.equal(proposals[0].respondentPlayerId,'B');
 assert.equal(proposals[0].counterpartPlayerId,'A');
 assert.equal(proposals[0].family,'SKILL_ACKNOWLEDGMENT');
 const fourth=make('fourth',{seed:4,interval:[7000,7800]});
 assert.equal(qualifyThreeBattleLosses([...battles,fourth],'B')[0].anchorBattleId,'third',
   'fourth ordinary loss does not create a new invitation');
});
test('nearest negatives: one BO3 is one Battle, two losses, changed opponent, one win and duplicate original GUID',()=>{
 const [a,b,c]=trilogy();
 assert.deepEqual(qualifyThreeBattleLosses([a,b],'B'),[]);
 const win=make('won',{seed:5,win:'B',interval:[5000,5800]});
 assert.deepEqual(qualifyThreeBattleLosses([a,b,win],'B'),[]);
 const outsider=make('vs-C',{seed:6,opponent:'C',win:'C',interval:[5000,5800]});
 assert.deepEqual(qualifyThreeBattleLosses([a,b,outsider],'B'),[]);
 const duplicate=make('duplicate',{seed:7,interval:[7000,7800]});
 duplicate.games[0].source.gameGuid=a.games[0].source.gameGuid;
 assert.deepEqual(qualifyThreeBattleLosses([a,b,c,duplicate],'B'),[]);
 const bo3=make('bo3',{seed:8,warmup:true});
 bo3.match.seriesRule={maxGames:3,gamesRequiredToWin:2};
 const g2=structuredClone(bo3.games[0]);g2.gameId='G2';g2.game.gameNumber=2;
 g2.source={...g2.source,sourceHash:hex(22),gameGuid:'guid-game-two',
   mappingDigest:'mapping-game-two',provenanceDigest:bindingDigest('two')};
 g2.game.activeReplayStatisticsId=g2.source.sourceHash;
 const g3={gameId:'G3',game:{status:'NO_CONTEST',gameNumber:3,players:bo3.match.participants,
   resolutionReason:'Series decided by G2',activeReplayStatisticsId:null,canonicalResult:null},source:null};
 bo3.games=[bo3.games[0],g2,g3];
 bo3.match.canonicalResult={revision:1,sourceGameId:'G2',
   seriesGameRevisions:{G1:1,G2:1},winningPlayerIds:['A']};
 approve(bo3,1000,1800);
 assert.deepEqual(qualifyThreeBattleLosses([bo3,b],'B'),[],
   'two original Games in one BO3 still count as only one Battle');
});
test('unknown, overlapping, source-corrected or result-reversed historical witnesses fail closed',()=>{
 const [a,b,c]=trilogy();
 const unsigned=make('unplaced',{seed:8,warmup:true});
 assert.deepEqual(qualifyThreeBattleLosses([a,b,c,unsigned],'B'),[],
  'possibly earlier loss cannot be silently treated as non-loss');
 assert.equal(orderedHostedSkillBattles([a,b,c,unsigned],'B'),null);
 approve(b,1300,2200);
 assert.equal(orderedHostedSkillBattles([a,b,c],'B'),null,'overlapping bounds do not prove order');
 assert.deepEqual(qualifyThreeBattleLosses([a,b,c],'B'),[]);
 approve(b,3000,3800);
 const accepted=qualifyThreeBattleLosses([a,b,c],'B')[0];
 c.games[0].source.sourceHash=hex(51);
 assert.deepEqual(qualifyThreeBattleLosses([a,b,c],'B'),[],'withdrawn original revision');
 c.games[0].source.sourceHash=c.games[0].game.activeReplayStatisticsId;
 c.games[0].game.canonicalResult.revision++;
 assert.deepEqual(qualifyThreeBattleLosses([a,b,c],'B'),[],'changed result revision');
 approve(c,5000,5800);
 assert.notEqual(qualifyThreeBattleLosses([a,b,c],'B')[0].revision,accepted.revision,
   'newly reviewed occurrence changes rare evidence revision');
});
test('owner-reviewed rarity is independent of three losses; stale, routine or fake review never admits',()=>{
 const bs=trilogy(),proof=qualifyThreeBattleLosses(bs,'B')[0],third=bs[2];
 const good=reviewFor(proof,third);
 assert.ok(candidateFor(third,proof,good));
 assert.equal(candidateFor(third,proof,null),null);
 for(const changed of [
  {qualification:'PENDING'}, {significance:'ROUTINE'},
  {family:'ASSISTANCE'}, {reviewedSource:'EMULATOR_ONLY'},
  {methodReview:'EMULATOR_ONLY'}, {approvalRef:'other'},
  {respondentPlayerId:'A'}, {counterpartPlayerId:'C'},
  {lossRevision:hex(7)}, {anchorSourceBinding:hex(8)},
  {witnessBattleIds:['first','first','third']},
  {rarityReason:'It was just normal'}, {reviewedBy:'B'},
  {qualifierMethod:'emulator-reviewed-third-loss'},
 ]){
  assert.equal(candidateFor(third,proof,{...good,...changed}),null,JSON.stringify(changed));
 }
 const edited={...good,incidentId:'different-reviewed-incident'};
 assert.equal(qualifiedHostedSkillMoment({battle:third,proof,review:edited,
   reviewDocId:'review-skill-B',policy:policy(),respondent:'B',
   sourceAuthority:hex(12)}),null);
});
test('cooldown counts eligible independent Battles, never individual Games, and no arbitrary later anchor is selected',()=>{
 const ids=['first','second','third','ordinary4','ordinary5','ordinary6','eligible7'];
 assert.equal(chronicleEligibleCooldown(ids,'third',null),2);
 for(const id of ['ordinary4','ordinary5','ordinary6'])
  assert.throws(()=>chronicleEligibleCooldown(ids,id,'third'),/cooling down/);
 assert.equal(chronicleEligibleCooldown(ids,'eligible7','third'),6);
 assert.throws(()=>chronicleEligibleCooldown(ids,'third','eligible7'),/reordered/);
});

test('current Season history excludes earlier Seasons and preserves eligible warmups',()=>{
 const [a,b,c]=trilogy();
 const prior=make('prior-season',{seed:17,interval:[100,800]});
 prior.match.seasonId='previous';prior.event.seasonId='previous';
 const current=currentSeasonChronicleBattles([prior,a,b,c],'season');
 assert.deepEqual(current.map(x=>x.battleId),['first','second','third']);
 assert.equal(qualifyThreeBattleLosses(current,'B')[0].anchorBattleId,'third');
 assert.deepEqual(qualifyThreeBattleLosses(currentSeasonChronicleBattles([prior,a,b],'season'),'B'),[]);
 assert.deepEqual(currentSeasonChronicleBattles([prior,a,b],'not valid!'),[]);
});
test('an unrelated unresolved later Battle does not veto a proven first-third candidate',()=>{
 const trio=trilogy(),unrelated=make('unrelated-later',{seed:20,opponent:'C',win:'C'});
 assert.equal(qualifyThreeBattleLosses([...trio,unrelated],'B')[0].anchorBattleId,'third');
 assert.deepEqual(orderedHostedSkillBattles([...trio,unrelated],'B',['third']),['third']);
 assert.equal(orderedHostedSkillBattles([...trio,unrelated],'B'),null);
});
test('hosted response accepts source-bound rarity review without invented derived review fields',()=>{
 const bs=trilogy(),proof=qualifyThreeBattleLosses(bs,'B')[0];
 const review=reviewFor(proof,bs[2]),moment=candidateFor(bs[2],proof,review);
 assert.ok(moment);
 const selected={reviewedDigest:bindingDigest(review),incidentRevision:moment.incidentRevision,
   sourceAuthority:moment.sourceAuthority,hostedLossRevision:proof.revision};
 assert.equal(Object.hasOwn(review,'incidentRevision'),false);
 assert.equal(Object.hasOwn(review,'sourceAuthority'),false);
 assert.equal(reviewedChronicleMomentCurrent('hosted',review,selected,policy()),true);
 assert.equal(reviewedChronicleMomentCurrent('hosted',{...review,lossRevision:hex(9)},selected,policy()),false);
 assert.equal(reviewedChronicleMomentCurrent('hosted',review,selected,
   {...policy(),approvalRef:'different'}),false);
 assert.equal(reviewedChronicleMomentCurrent('emulator',review,selected,policy()),false);
});
