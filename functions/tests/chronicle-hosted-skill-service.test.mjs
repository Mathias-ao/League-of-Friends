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
 getMyChronicleInvitations,adminReviewChronicleCorrection} from '../lib/queries/chronicleInteractionService.js';

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

async function setup({earlySecond=false}={}){
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
  const battleId='b'+i,opponent=i<=3?'p1':i===4&&!earlySecond?'p1':'p3';
  const roster=[{playerId:opponent,team:1},{playerId:'p2',team:2}];
  const win=i===4&&!earlySecond?'p2':opponent;
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
 assert.deepEqual(proofs.map(p=>p.anchorBattleId),['b3',earlySecond?'b6':'b7']);
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
 let race=null,injections=0;
 const counts=new Map();
 const wrap=(path,ref)=>{
  const normal=ref.get;
  ref.get=async()=>{
   // This injected Battle read must occur AFTER cohort chose the Season,
   // not during the earlier complete native-original source collection.
   const afterSeason=path!=='matches/b1'||(counts.get('leagueState/singleton')??0)>0;
   if(afterSeason&&(path==='runtimePolicies/chroniclePrivateSkillV1'||
      path==='leagueState/singleton'||race?.path===path)){
    const count=(counts.get(path)??0)+1;counts.set(path,count);
    if(race?.path===path&&race.count===count){
     race.fire(rows);race=null;injections++;
    }
   }
   return normal();
  };
  return ref;
 };
 // Actual service reads the Season through db.collection(...).doc(...),
 // whereas policy is reached through db.doc(...). Trap both surfaces.
 const collection=path=>{
  const parent=baseCollection(path),originalDoc=parent.doc;
  parent.doc=id=>wrap(path+'/'+id,originalDoc(id));
  return parent;
 };
 Object.defineProperty(db,'collection',{configurable:true,value:collection});
 const doc=path=>{
  const pieces=path.split('/');
  return collection(pieces.slice(0,-1).join('/')).doc(pieces.at(-1));
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
  injected:()=>injections,
  slot:id=>'matches/'+id+'/socialV1InvitationSlots/'+id+'_p2',
  restore:()=>{for(const [k,v] of Object.entries(prior))if(v===undefined)delete process.env[k];else process.env[k]=v;}};
}

test('SERVICE: after b3, routine b4/b5/b6 advance eligible fatigue and b7 is offerable',async()=>{
 const f=await setup();
 try{
  const first=await f.offer();assert.equal(first.offered,true);
  assert.equal(first.invitation.battleId,'b3');
  const second=await f.offer();
  assert.equal(second.offered,true,'fourth eligible Battle b7 must pass after three routine Battles');
  assert.equal(second.invitation.battleId,'b7');
 }finally{f.restore();}
});
test('SERVICE: policy revoked after approval before guard capture aborts offer and marker',async()=>{
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
test('SERVICE: policy revoked between response qualification and capture aborts confirmation',async()=>{
 const f=await setup();
 try{
  const offer=await f.offer();assert.equal(offer.offered,true);
  f.trigger('runtimePolicies/chroniclePrivateSkillV1',2,rows=>{
    rows.set('runtimePolicies/chroniclePrivateSkillV1',{...policy,status:'REVOKED'});
  });
  await assert.rejects(f.submit(offer.invitation));
  const slot=[...f.rows.entries()].find(([key])=>
    key.startsWith('matches/b3/socialV1InvitationSlots/')&&key.split('/').length===4);
  assert.ok(slot);assert.equal(slot[1].state,'OFFERED','rejected response never consumes a private statement');
 }finally{f.restore();}
});
test('SERVICE: active Season changes between guard reads and aborts old-Season offer',async()=>{
 const f=await setup();
 try{
  f.trigger('leagueState/singleton',3,rows=>{
    rows.set('leagueState/singleton',{activeSeasonId:'new-season'});
  });
  await assert.rejects(f.offer());
  assert.equal(f.injected(),1,'the Season pointer must actually switch mid-service call');
  assert.equal(f.rows.has('players/p2/chronicleRareControls/v1'),false);
 }finally{f.restore();}
});
test('SERVICE: active Season changes between response guard reads and aborts confirmation',async()=>{
 const f=await setup();
 try{
  const offer=await f.offer();assert.equal(offer.offered,true);
  f.trigger('leagueState/singleton',3,rows=>{
    rows.set('leagueState/singleton',{activeSeasonId:'new-season'});
  });
  await assert.rejects(f.submit(offer.invitation));
  assert.equal(f.injected(),1,'the active Season must actually switch during confirmation');
  const slot=[...f.rows.entries()].find(([key])=>
    key.startsWith('matches/b3/socialV1InvitationSlots/')&&key.split('/').length===4);
  assert.ok(slot);assert.equal(slot[1].state,'OFFERED');
 }finally{f.restore();}
});

test('SERVICE: third eligible Battle after prior offer cannot pass rarity even when independently reviewed',async()=>{
 const f=await setup({earlySecond:true});
 try{
  const first=await f.offer();assert.equal(first.offered,true);
  assert.equal(first.invitation.battleId,'b3');
  const second=await f.offer();
  assert.equal(second.offered,false,'b6 is only third independent Battle after b3');
  assert.equal(f.rows.get('players/p2/chronicleRareControls/v1').lastOfferedBattleId,'b3');
 }finally{f.restore();}
});
test('SERVICE: incomplete historical occurrence and unresolved prior-Season fatigue do not create new slots',async()=>{
 const f=await setup();
 try{
  f.rows.delete('matches/b4/occurrence/current');
  const uncertain=await f.offer();
  assert.equal(uncertain.offered,false);
  assert.equal(f.rows.has('players/p2/chronicleRareControls/v1'),false);
 }finally{f.restore();}
 const g=await setup();
 try{
  g.rows.set('players/p2/chronicleRareControls/v1',{lastOfferedBattleId:'old-season-battle'});
  const stopped=await g.offer();
  assert.equal(stopped.offered,false);
  assert.equal(stopped.reason,'COOLDOWN_HISTORY_CHANGED');
  assert.equal([...g.rows.keys()].some(k=>k.includes('socialV1InvitationSlots')),false);
 }finally{g.restore();}
});
test('SERVICE: replaced still-APPROVED policy cannot supplant the original policy pin',async()=>{
 const f=await setup();
 try{
  f.trigger('runtimePolicies/chroniclePrivateSkillV1',2,rows=>{
   rows.set('runtimePolicies/chroniclePrivateSkillV1',{...policy,approvalRef:'new-approval'});
  });
  await assert.rejects(f.offer());
  assert.equal(f.rows.has('players/p2/chronicleRareControls/v1'),false);
 }finally{f.restore();}
});
test('SERVICE: unchanged policy and Season allow explicit owner submission, private reading and impartial correction',async()=>{
 const f=await setup();
 try{
  const offer=await f.offer();assert.equal(offer.offered,true);
  await assert.rejects(actOnChronicleInvitation.run(auth('owner',{
    battleId:'b3',requestId:'no-confirm',expectedRevision:1,
    opportunityRevision:offer.invitation.opportunityRevision,
    action:'SUBMIT',choiceId:'ACKNOWLEDGED_SKILL'})));
  const saved=await f.submit(offer.invitation);
  assert.equal(saved.state,'SUBMITTED');assert.equal(saved.revision,2);
  const owner=await getMyChronicleInvitations.run(auth('owner',{}));
  assert.equal(owner.invitations.length,1);assert.equal(owner.invitations[0].speaker.authorPlayerId,'p2');
  assert.equal((await getMyChronicleInvitations.run(auth('other',{}))).invitations.length,0);
  assert.deepEqual(owner.officialEffects,[]);
  const requested=await actOnChronicleInvitation.run(auth('owner',{
    battleId:'b3',requestId:'request-correction',expectedRevision:2,
    opportunityRevision:offer.invitation.opportunityRevision,action:'CORRECTION_REQUEST',
    reason:'I want to correct my earlier private answer.'}));
  assert.equal(requested.revision,3);
  const review=await adminReviewChronicleCorrection.run(auth('admin-uid',{
    battleId:'b3',respondentPlayerId:'p2',requestId:'admin-correction',
    expectedRevision:3,decision:'APPROVE',reason:'Author private correction approved.'}));
  assert.equal(review.revision,4);
  const rebound=await actOnChronicleInvitation.run(auth('owner',{
    battleId:'b3',requestId:'confirmed-correction',expectedRevision:4,
    opportunityRevision:offer.invitation.opportunityRevision,
    action:'CORRECT',choiceId:'DO_NOT_ACKNOWLEDGE',confirmed:true}));
  assert.equal(rebound.state,'SUBMITTED');assert.equal(rebound.revision,5);
  const subsequent=await f.offer();
  assert.equal(subsequent.offered,true,'a distinct b7 rarity may offer after three eligible Battles');
  assert.equal(subsequent.invitation.battleId,'b7');
  const sameAgain=await f.offer();
  assert.equal(sameAgain.offered,false,'consumed b3 and b7 slots never reopen');
  const originalSlot=[...f.rows.entries()].find(([key])=>
    key.startsWith('matches/b3/socialV1InvitationSlots/')&&key.split('/').length===4);
  assert.equal(originalSlot?.[1].state,'SUBMITTED');
 }finally{f.restore();}
});

test('SERVICE: policy revoked during cohort Battle iteration cannot become a replacement baseline',async()=>{
 const f=await setup();
 try{
  f.trigger('matches/b1',1,rows=>{
   rows.set('runtimePolicies/chroniclePrivateSkillV1',{...policy,status:'REVOKED'});
  });
  await assert.rejects(f.offer());
  assert.equal(f.injected(),1,'mutation must happen after policy approval, before guard capture');
  assert.equal(f.rows.has('players/p2/chronicleRareControls/v1'),false);
 }finally{f.restore();}
});
test('SERVICE: active Season changes during cohort Battle iteration cannot replace original pointer',async()=>{
 const f=await setup();
 try{
  f.trigger('matches/b1',1,rows=>{
   rows.set('leagueState/singleton',{activeSeasonId:'new-season'});
  });
  await assert.rejects(f.offer());
  assert.equal(f.injected(),1,'mutation must happen after Season selection, before guard capture');
  assert.equal(f.rows.has('players/p2/chronicleRareControls/v1'),false);
 }finally{f.restore();}
});
