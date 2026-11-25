/** Sol #278 reproductions against actual hosted callable/collector/transaction code.
 * Controlled immutable native-source bytes, official decision envelopes and
 * source-bound rarity reviews are fixtures, not natural hosted gameplay.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync,gunzipSync} from 'node:zlib';
import {getStorage} from 'firebase-admin/storage';
import {db} from '../lib/config/firebase.js';
import {fixture} from './support/native-ready-fixture.mjs';
import {memoryFirestore} from './support/memory-firestore.mjs';
import {bindingDigest,digest} from '../lib/engines/nativeRecordingIntegration.js';
import {statisticsBindingKey} from '../lib/engines/statisticsExperience.js';
import {occurrenceSourceBinding,qualifyThreeBattleLosses,BATTLE_OCCURRENCE_VERSION,
  sourceBoundReadyReceiptMillis} from '../lib/integration/battleOccurrence.js';
import {HOSTED_SKILL_METHOD,HOSTED_SKILL_POLICY_VERSION} from '../lib/engines/chronicleHostedSkill.js';
import {offerChronicleInvitation,actOnChronicleInvitation,
 getMyChronicleInvitations} from '../lib/queries/chronicleInteractionService.js';

const policy={version:HOSTED_SKILL_POLICY_VERSION,projectId:'age-of-friends-staging-eu',
  region:'europe-west1',status:'APPROVED',ownerApproved:true,approvalRef:'approved-skill-v1',
  method:HOSTED_SKILL_METHOD,families:['SKILL_ACKNOWLEDGMENT'],
  rarity:'REVIEWED_TURNING_POINT',publicTestimony:false,relationshipEffects:false,
  officialWrites:false,automaticOffers:false};
const inputEnv={GCLOUD_PROJECT:'age-of-friends-staging-eu',GOOGLE_CLOUD_PROJECT:'age-of-friends-staging-eu',
  FUNCTION_REGION:'europe-west1',AOF_CHRONICLE_PRIVATE_INTERACTIONS:'source-v1',
  AOF_BATTLE_OCCURRENCE_V1:'source-v1',AOF_CHRONICLE_PRIVATE_POLICY_SHA256:bindingDigest(policy),
  AOF_INT_V1_PRIVATE_READS:'source-v1',AOF_INT_V1_PRIVATE_HISTORY:'battle-v1',
  AOF_ACTIVE_NATIVE_PLAYER_READS:'1',AOF_ACTIVE_NATIVE_SOCIAL_READS:'1'};
const plainClone=v=>Array.isArray(v)?v.map(plainClone):v&&typeof v==='object'?
  (typeof v.toMillis==='function'||v instanceof Date)?v:
    Object.fromEntries(Object.entries(v).map(([k,x])=>[k,plainClone(x)])):v;
const auth=(uid,data)=>({auth:{uid},data});

async function setup(){
 const initial=fixture();await initial.run();
 const base=initial.rows.get(initial.sourcePath);
 assert.equal(base.state,'READY');
 const baseGame=initial.rows.get('matches/m/games/g');
 const originalStatistics=JSON.parse(gunzipSync(initial.objects.get(base.statistics.path)));
 const originalEvents=initial.objects.get(base.recordedEvents.path);
 const records=new Map(),objects=new Map();
 for(const playerId of ['p1','p2','p3','admin'])
   records.set('players/'+playerId,{membershipStatus:'ACTIVE',role:playerId==='admin'?'ADMIN':'PLAYER'});
 records.set('authLinks/owner',{playerId:'p2'});
 records.set('authLinks/other',{playerId:'p1'});
 records.set('authLinks/admin-uid',{playerId:'admin'});
 records.set('leagueState/singleton',{activeSeasonId:'s'});
 records.set('seasons/s',{status:'ACTIVE'});
 records.set('seasons/new-season',{status:'ACTIVE'});
 records.set('runtimePolicies/chroniclePrivateSkillV1',plainClone(policy));
 const ids=Array.from({length:7},(_,i)=>'b'+(i+1));
 const event={status:'ACTIVE',seasonId:'s',officialMatchIds:[],warmupMatchIds:ids};
 records.set('events/e',event);
 const battles=[];
 for(let i=1;i<=7;i++){
  const battleId='b'+i,opponent=i<=4?'p1':'p3';
  const roster=[{playerId:opponent,team:1},{playerId:'p2',team:2}];
  const win=i===4?'p2':opponent;
  const match={status:'COMPLETED',format:'ONE_V_ONE',opponentKind:'HUMAN',
    participants:roster,seasonId:'s',eventId:'e',matchNumber:0,
    scoringSnapshot:{rules:{act:'WARMUP'}},seriesRule:{maxGames:1,gamesRequiredToWin:1}};
  const original=Buffer.from('controlled immutable native original '+battleId);
  const sourceHash=digest(original),guid='controlled-hosted-original-guid-'+battleId;
  const raw=plainClone(originalStatistics);
  raw.source.replaySha256=sourceHash;
  raw.matchFacts.source.replaySha256=sourceHash;
  raw.matchFacts.game.guid=guid;
  raw.pairSocialEvidence.gameScope.replaySha256=sourceHash;
  const statsPlain=Buffer.from(JSON.stringify(raw)),statsBytes=gzipSync(statsPlain);
  const prefix='native-replay-evidence/'+battleId+'/g/'+sourceHash+'/';
  const source=plainClone(base);
  Object.assign(source,{matchId:battleId,gameId:'g',sourceHash,matchFacts:raw.matchFacts});
  source.playerMapping=base.playerMapping.map(p=>({...p,playerId:p.playerId==='p1'?opponent:p.playerId}));
  source.originalRecording={...source.originalRecording,path:prefix+'source.aoe2record',
    sha256:sourceHash,bytes:original.length};
  source.recordedEvents={...source.recordedEvents,path:prefix+source.artifactRevision+'/events.jsonl.gz'};
  source.statistics={...source.statistics,path:prefix+source.artifactRevision+'/statistics.direct.json.gz',
    sha256:digest(statsBytes),bytes:statsBytes.length,
    uncompressedSha256:digest(statsPlain),uncompressedBytes:statsPlain.length};
  if(source.provenance)source.provenance={...source.provenance,
    sourceIdentity:sourceHash,projectionRevision:source.statistics.sha256};
  source.experience={...source.experience,bindingKey:statisticsBindingKey({
    sourceHash,roster,mapping:source.playerMapping,opponents:[]})};
  objects.set(source.originalRecording.path,original);
  objects.set(source.recordedEvents.path,originalEvents);
  objects.set(source.statistics.path,statsBytes);
  const game={...plainClone(baseGame),gameNumber:1,status:'COMPLETED',players:roster,
    activeReplayStatisticsId:sourceHash,
    canonicalResult:{revision:1,type:'PLAYER_WIN',source:'PLAYER_CONFIRMED',
      winningPlayerIds:[win],losingPlayerIds:[win==='p2'?opponent:'p2']}};
  records.set('matches/'+battleId,match);
  records.set('matches/'+battleId+'/games/g',game);
  records.set('matches/'+battleId+'/games/g/replaySources/'+sourceHash,source);
  records.set('recordingGameClaims/'+Buffer.from(guid).toString('hex'),
    {matchId:battleId,gameId:'g',sourceHash});
  const sourceForOccurrence={sourceHash,gameGuid:guid,
    mappingDigest:bindingDigest(source.playerMapping),
    provenanceDigest:bindingDigest([sourceHash,game.replayStatisticsRevision,[
      {kind:'STATISTICS',digest:source.statistics.sha256,generation:String(source.statistics.generation)},
      {kind:'RECORDED_EVENTS',digest:source.recordedEvents.sha256,generation:String(source.recordedEvents.generation)},
      {kind:'ORIGINAL',digest:source.originalRecording.sha256,generation:String(source.originalRecording.generation)}],
      source.processorRevision]),
    publicationAtMs:sourceBoundReadyReceiptMillis(source,battleId,'g',sourceHash)};
  const occurrenceBattle={battleId,match,event,planId:null,plan:null,
    games:[{gameId:'g',game,source:sourceForOccurrence}],occurrence:null};
  const sourceBinding=occurrenceSourceBinding(occurrenceBattle);
  assert.ok(sourceBinding,'test source must satisfy actual canonical official Battle contract '+battleId);
  const start=i*1000,end=start+500;
  occurrenceBattle.occurrence={version:BATTLE_OCCURRENCE_VERSION,battleId,status:'APPROVED',
    sourceBinding,revision:1,bounds:[{gameId:'g',notBeforeMs:start,notAfterMs:end}],
    precedes:[],proof:{kind:'ADMIN_REVIEWED',reviewedBy:'admin',reason:'Controlled independent occurrence evidence'}};
  records.set('matches/'+battleId+'/occurrence/current',occurrenceBattle.occurrence);
  battles.push(occurrenceBattle);
 }
 const proofs=qualifyThreeBattleLosses(battles,'p2');
 assert.deepEqual(proofs.map(p=>p.anchorBattleId),['b3','b7']);
 for(const proof of proofs){
  const b=battles.find(x=>x.battleId===proof.anchorBattleId),incidentId='review-'+b.battleId;
  records.set('matches/'+b.battleId+'/chronicleRareReviewedMoments/'+incidentId,{
    incidentId,battleId:b.battleId,respondentPlayerId:'p2',
    counterpartPlayerId:proof.opponentPlayerId,family:'SKILL_ACKNOWLEDGMENT',
    qualifierMethod:HOSTED_SKILL_METHOD,qualification:'ADMITTED',
    significance:'REVIEWED_TURNING_POINT',methodReview:'OWNER_REVIEWED_RARITY',
    reviewedSource:'THIRD_OFFICIAL_BATTLE_LOSS',approvalRef:policy.approvalRef,
    lossRevision:proof.revision,anchorSourceBinding:occurrenceSourceBinding(b),
    witnessBattleIds:[...proof.witnessBattleIds],reviewedBy:'admin',
    rarityReason:'Independent controlled three-Battle turning point reviewed for rarity'});
 }
 const rows=memoryFirestore([...records]);
 const baseCollection=db.collection.bind(db);
 let race=null;
 const counts=new Map();
 const doc=path=>{
  const pieces=path.split('/'),ref=baseCollection(pieces.slice(0,-1).join('/')).doc(pieces.at(-1));
  const normal=ref.get;
  ref.get=async()=>{
   if(path==='runtimePolicies/chroniclePrivateSkillV1'||path==='leagueState/singleton'){
    const count=(counts.get(path)??0)+1;counts.set(path,count);
    if(race?.path===path&&race.count===count){
     race.fire(rows);race=null;
    }
   }
   return normal();
  };
  return ref;
 };
 Object.defineProperty(db,'doc',{configurable:true,value:doc});
 const storage=getStorage();
 const bucket={file:(path,options)=>({download:async()=>{
   assert.equal(String(options?.generation),'7');
   const bytes=objects.get(path);assert.ok(bytes,'Missing immutable fixture artifact '+path);
   return [bytes];
 }})};
 storage.bucket=()=>bucket;
 const prior=Object.fromEntries(Object.keys(inputEnv).map(k=>[k,process.env[k]]));
 for(const [key,value] of Object.entries(inputEnv))process.env[key]=value;
 delete process.env.FUNCTIONS_EMULATOR;
 delete process.env.FIRESTORE_EMULATOR_HOST;
 delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
 delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;
 delete process.env.STORAGE_EMULATOR_HOST;
 const trigger=(path,count,fire)=>{counts.clear();race={path,count,fire}};
 const offer=()=>offerChronicleInvitation.run(auth('owner',{}));
 const submit=inv=>actOnChronicleInvitation.run(auth('owner',{
   battleId:inv.battleId,requestId:'confirm-'+inv.battleId,
   expectedRevision:inv.revision,opportunityRevision:inv.opportunityRevision,
   action:'SUBMIT',choiceId:'ACKNOWLEDGED_SKILL',confirmed:true}));
 return {rows,ids,proofs,offer,submit,trigger,prior,
  slot:id=>'matches/'+id+'/socialV1InvitationSlots/'+id+'_p2',
  restore:()=>{for(const [k,v] of Object.entries(prior))if(v===undefined)delete process.env[k];else process.env[k]=v;}};
}

test('SERVICE RED: after b3, routine b4/b5/b6 advance eligible fatigue and b7 is offerable',async()=>{
 const f=await setup();
 try{
  const first=await f.offer();assert.equal(first.offered,true);
  assert.equal(first.invitation.battleId,'b3');
  const second=await f.offer();
  assert.equal(second.offered,true,'fourth eligible Battle b7 must pass after three routine Battles');
  assert.equal(second.invitation.battleId,'b7');
 }finally{f.restore();}
});
test('SERVICE RED: policy revoked after approval before guard capture aborts offer and marker',async()=>{
 const f=await setup();
 try{
  f.trigger('runtimePolicies/chroniclePrivateSkillV1',2,rows=>{
    rows.set('runtimePolicies/chroniclePrivateSkillV1',{...policy,status:'REVOKED'});
  });
  await assert.rejects(f.offer());
  assert.equal([...f.rows.keys()].some(k=>k.includes('socialV1InvitationSlots')),false);
  assert.equal(f.rows.has('players/p2/chronicleRareControls/v1'),false);
 }finally{f.restore();}
});
test('SERVICE RED: policy revoked between response qualification and capture aborts confirmation',async()=>{
 const f=await setup();
 try{
  const offer=await f.offer();assert.equal(offer.offered,true);
  f.trigger('runtimePolicies/chroniclePrivateSkillV1',2,rows=>{
    rows.set('runtimePolicies/chroniclePrivateSkillV1',{...policy,status:'REVOKED'});
  });
  await assert.rejects(f.submit(offer.invitation));
  assert.equal((await getMyChronicleInvitations.run(auth('owner',{}))).invitations.length>=0,true);
 }finally{f.restore();}
});
test('SERVICE RED: active Season changes between guard reads and aborts old-Season offer',async()=>{
 const f=await setup();
 try{
  f.trigger('leagueState/singleton',3,rows=>{
    rows.set('leagueState/singleton',{activeSeasonId:'new-season'});
  });
  await assert.rejects(f.offer());
  assert.equal(f.rows.has('players/p2/chronicleRareControls/v1'),false);
 }finally{f.restore();}
});
test('SERVICE RED: active Season changes between response guard reads and aborts confirmation',async()=>{
 const f=await setup();
 try{
  const offer=await f.offer();assert.equal(offer.offered,true);
  f.trigger('leagueState/singleton',3,rows=>{
    rows.set('leagueState/singleton',{activeSeasonId:'new-season'});
  });
  await assert.rejects(f.submit(offer.invitation));
 }finally{f.restore();}
});
