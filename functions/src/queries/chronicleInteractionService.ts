import {getStorage} from 'firebase-admin/storage';
import {HttpsError,onCall} from 'firebase-functions/v2/https';
import {requireAdmin,requireLeaguePlayer} from '../auth/authorization.js';
import {db} from '../config/firebase.js';
import {callableOptions} from '../config/runtime.js';
import {bindingDigest} from '../engines/nativeRecordingIntegration.js';
import {selectRareChronicleProposals,type CurrentChronicleBattle,type ReviewedTurningPoint,
  type ApprovedRareSelectionPolicy} from '../engines/chronicleRareSelector.js';
import {invitationSlotId,planInvitationOffer,transitionInvitation,type InvitationSlot,
  type JudgmentFamily,type Opportunity,type PolicyRef} from '../domain/socialV1.js';
import {collectMyCurrentBattleHistory} from './getMyPersonalityHistory.js';

/** A functional authenticated *emulator-only* interaction service. Original #165
 * metrics remain PENDING; no real method approval/publication is invented.
 * Production rejects all access. Reviewed envelopes here are seeded by a
 * trusted test-only fixture (never supplied by a player or generated from a
 * command/request scalar). No ordinary Relationship credits or public prose.
 */
export const CHRONICLE_INTERACTION_VERSION='AOF_CHRONICLE_INTERACTIONS_V1E';
export const CHRONICLE_COOLDOWN_ELIGIBLE_BATTLES=3;
const TEST_METHODS=['emulator-reviewed-assistance','emulator-reviewed-grievance',
  'emulator-reviewed-third-loss','emulator-reviewed-treachery'];
const FAMILY_ORDER:JudgmentFamily[]=['TREACHERY_VICTIM','SKILL_ACKNOWLEDGMENT','ASSISTANCE','SITUATED_GRIEVANCE'];
const TEST_POLICY:PolicyRef={policyVersion:'CHRON_V1E_TEST',configurationVersion:'three-eligible-battles',
  status:'APPROVED',approvalRef:'EMULATOR_ONLY_NOT_PRODUCTION_APPROVAL'};
const CHOICES:Record<JudgmentFamily,readonly string[]>={
  ASSISTANCE:['ACKNOWLEDGED_HELP','NOT_PERSONALLY_MEANINGFUL','UNDECIDED'],
  SITUATED_GRIEVANCE:['FELT_PERSONAL','FAIR_WARFARE','UNDECIDED'],
  SKILL_ACKNOWLEDGMENT:['ACKNOWLEDGED_SKILL','DO_NOT_ACKNOWLEDGE','UNDECIDED'],
  TREACHERY_VICTIM:['FELT_BETRAYED','FAIR_GAME','UNDECIDED'],
};
type Bag=Record<string,any>;
type Actor={playerId:string;authUid:string;role?:string};
type Input={db:any;bucket:any;actor:Actor;env:NodeJS.ProcessEnv};
const id=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,200}$/.test(v);
const fail=(message:string)=>new HttpsError('failed-precondition',message);
const stale=()=>new HttpsError('aborted','Chronicle source, authority, membership or invitation revision changed.');
const invalid=()=>new HttpsError('invalid-argument','Unexpected Chronicle interaction request.');
const requireFields=(r:Bag,fields:string[])=>{
  if(!r||typeof r!=='object'||Array.isArray(r)||Object.keys(r).some(k=>!fields.includes(k)))throw invalid();
};
export function assertChronicleInteractionEmulator(env:NodeJS.ProcessEnv){
  if(env.FUNCTIONS_EMULATOR!=='true'||!(env.GCLOUD_PROJECT||'').startsWith('demo-')||
     env.AOF_CHRONICLE_INTERACTIONS_V1E!=='emulator-only')
    throw fail('Chronicle invitation delivery is inactive outside a controlled emulator.');
}
const slotPath=(battleId:string,actorId:string)=>
  'matches/'+battleId+'/socialV1InvitationSlots/'+invitationSlotId(battleId,actorId);
const note=(v:unknown)=>typeof v==='string'&&v.length<=1000&&!/[\u0000-\u0008]/.test(v);
const currentToken=(v:any)=>bindingDigest(v??null);
const visibility=(slot:Bag)=>{
  const speaker=slot.judgment?
    {authorPlayerId:slot.respondentPlayerId,counterpartPlayerId:slot.selected.counterpartPlayerId,
      battleId:slot.battleId,gameId:slot.selected.gameId,
      family:slot.selected.family,choiceId:slot.judgment.choiceId,
      qualification:'PENDING' as const,visibility:'AUTHOR_ONLY' as const,
      presentation:'ATTRIBUTED_SPEAKER_NOT_OBJECTIVE_NARRATOR' as const}:null;
  return {slotId:slot.slotId,battleId:slot.battleId,respondentPlayerId:slot.respondentPlayerId,
    revision:slot.revision,state:slot.state,opportunityRevision:slot.currentOpportunityRevision,
    family:slot.selected.family,counterpartPlayerId:slot.selected.counterpartPlayerId,
    questionContext:'Optional perspective on a separately recorded Battle moment.',
    choices:CHOICES[slot.selected.family as JudgmentFamily],speaker,
    // Private notes and audit are never in the standard private invite list;
    // author can explicitly retrieve their own submission detail.
    correctionState:slot.correction?.state??null,
    effects:{relationshipDelta:null,officialWrites:false,negativeForSilence:false}};
};

/** Full current-source verification delegates to already authenticated INT-B
 * collection, including actual READY native artifacts, GUID claims and whole
 * league read fences. Reviewer records stay server-only. */
async function cohort(input:Input){
  const collected=await collectMyCurrentBattleHistory({...input,request:{},maxOwnGames:64});
  const items:Array<{battleId:string;battle:CurrentChronicleBattle;candidates:ReviewedTurningPoint[];
    match:Bag;orderMs:number;ref:any;reviewSnapshots:any[];sources:any[]}> = [];
  for(const b of collected.battles){
    const ref=input.db.doc('matches/'+b.battleId),snapshot=await ref.get(),match=snapshot.data();
    if(!match?.participants?.some((p:Bag)=>p.playerId===input.actor.playerId))continue;
    const orderMs=match.firstCompletedAt?.toMillis?.();
    if(!Number.isSafeInteger(orderMs)||orderMs<0)continue;
    const evidenceComplete=b.gameIds.length>0&&b.sources.length===b.gameIds.length&&
      b.sources.every(s=>s.source.roster.some(p=>p.playerId===input.actor.playerId));
    const battle:CurrentChronicleBattle={battleId:b.battleId,
      playerIds:match.participants.map((p:Bag)=>p.playerId),
      currentGames:b.sources.map(s=>({gameId:s.source.gameId,sourceAuthority:s.source.authorityRevision})),
      evidenceComplete,chronologyQualified:true};
    const reviews=await ref.collection('chronicleRareReviewedMoments').limit(30).get();
    if(reviews.size===30)throw new HttpsError('resource-exhausted','Too many candidate source reviews for one Battle.');
    // This collection has no exposed client write permission; emulator seed
    // must explicitly mark independent original-method review as test-only.
    const candidates=reviews.docs.map((d:any)=>d.data()).filter((c:Bag)=>c.methodReview==='EMULATOR_ONLY'&&
      c.reviewedSource==='ORIGINAL_VERIFIED_TEST_WITNESS'&&c.battleId===b.battleId) as ReviewedTurningPoint[];
    items.push({battleId:b.battleId,battle,match,orderMs,ref,reviewSnapshots:reviews.docs,
      candidates,sources:b.sources});
  }
  items.sort((a,b)=>a.orderMs-b.orderMs||a.battleId.localeCompare(b.battleId));
  await collected.revalidate();
  return {items,collected};
}
const testPolicy=():ApprovedRareSelectionPolicy=>({
  approved:true,approvalRef:TEST_POLICY.approvalRef,
  qualifiedMethods:TEST_METHODS,familyOrder:FAMILY_ORDER,
  fatiguedPlayerIds:[],blockedPairKeys:[],
});
const select=(item:Awaited<ReturnType<typeof cohort>>['items'][number],actorId:string)=>
 selectRareChronicleProposals({battle:item.battle,candidates:item.candidates,policy:testPolicy(),existingSlots:[]})
   .find(c=>c.respondentPlayerId===actorId)??null;

/** Read complete owner eligibility order, not number of Games, query order or
 * wall-clock cooldown. The three *next eligible Battles* are suppressed.
 * Sequence and per-player marker are protected by an optimistic transaction
 * revision fence below; a late earlier Battle causes re-evaluation. */
export function chronicleEligibleCooldown(eligibleBattleIds:readonly string[],targetId:string,lastOfferedBattleId:string|null){
 if(!id(targetId)||!Array.isArray(eligibleBattleIds)||!eligibleBattleIds.every(id)||
    new Set(eligibleBattleIds).size!==eligibleBattleIds.length)throw fail('Chronicle eligible-Battle sequence is ambiguous.');
 const current=eligibleBattleIds.indexOf(targetId),last=lastOfferedBattleId?eligibleBattleIds.indexOf(lastOfferedBattleId):-1;
 if(current<0||lastOfferedBattleId&&last<0||last>=current)
   throw fail('Chronicle eligibility history is incomplete or reordered.');
 if(last>=0&&current-last<=CHRONICLE_COOLDOWN_ELIGIBLE_BATTLES)
   throw fail('Chronicle invitations are cooling down across eligible Battles.');
 return current;
}
async function actorInTransaction(tx:any,input:Input){
 const [p,l]=await Promise.all([tx.get(input.db.doc('players/'+input.actor.playerId)),
   tx.get(input.db.doc('authLinks/'+input.actor.authUid))]);
 if(p.data()?.membershipStatus!=='ACTIVE'||l.data()?.playerId!==input.actor.playerId)
   throw new HttpsError('permission-denied','Active linked Chronicle respondent required.');
}
async function verifyCurrent(tx:any,input:Input,selected:Bag,sourceRows:any[]){
 const mr=input.db.doc('matches/'+selected.battleId);
 const ms=await tx.get(mr),match=ms.data();
 if(!match?.participants?.some((p:Bag)=>p.playerId===input.actor.playerId)||
    match.activeResultDisputeId||match.replacementMatchId||match.opponentKind==='AI')throw stale();
 const event=await tx.get(input.db.doc('events/'+match.eventId));
 const season=await tx.get(input.db.doc('seasons/'+match.seasonId));
 if(event.data()?.seasonId!==match.seasonId||!['ACTIVE','COMPLETED','POSTPONED','PUBLISHED'].includes(event.data()?.status)||
    !['UPCOMING','ACTIVE','COMPLETED','ARCHIVED'].includes(season.data()?.status)||
    [event.data()?.officialMatchIds,event.data()?.warmupMatchIds].filter((a:any)=>Array.isArray(a)&&a.includes(selected.battleId)).length!==1)
   throw stale();
 // All selected Battle Games, not just the selected Game: a new second Game,
 // withdrawal, remap, authoritative result or changed GUID must revoke eligibility.
 const gs=await tx.get(mr.collection('games').orderBy('__name__').limit(65));
 if(gs.size!==sourceRows.length||gs.size>64)throw stale();
 const byId=new Map(sourceRows.map(s=>[s.source.gameId,s]));
 for(const g of gs.docs){
   const expected=byId.get(g.id);
   if(!expected||currentToken(g.data())!==currentToken(expected.game)||
      !g.data()?.players?.some((p:Bag)=>p.playerId===input.actor.playerId))throw stale();
   const sourceId=g.data()?.activeReplayStatisticsId;
   if(sourceId!==expected.source.sourceHash||g.data()?.activeResultDisputeId)throw stale();
   const sourceSnap=await tx.get(g.ref.collection('replaySources').doc(sourceId));
   if(sourceSnap.data()?.state!=='READY'||currentToken(sourceSnap.data())!==currentToken(expected.sourceDoc))throw stale();
   const guid=sourceSnap.data()?.matchFacts?.game?.guid;
   if(!id(guid))throw stale();
   const claim=await tx.get(input.db.doc('recordingGameClaims/'+Buffer.from(guid).toString('hex')));
   if(claim.data()?.matchId!==selected.battleId||claim.data()?.gameId!==g.id||
      claim.data()?.sourceHash!==sourceId)throw stale();
 }
}
export async function offerMyChronicleInvitation(input:Input,r:Bag){
 assertChronicleInteractionEmulator(input.env);requireFields(r,['battleId']);
 if(!id(r.battleId))throw invalid();
 const current=await cohort(input),item=current.items.find(x=>x.battleId===r.battleId);
 if(!item)throw fail('No complete chronologically qualified Battle evidence.');
 const proposed=select(item,input.actor.playerId);
 if(!proposed)return {offered:false,reason:'NO_RARE_SOURCE_QUALIFIED_TURNING_POINT'};
 const eligible=current.items.filter(x=>select(x,input.actor.playerId)).map(x=>x.battleId);
 const markerRef=input.db.doc('players/'+input.actor.playerId+'/chronicleRareControls/v1');
 const slotRef=input.db.doc(slotPath(r.battleId,input.actor.playerId));
 const savedSources=await Promise.all(item.sources.map(async s=>({
   source:s.source,game:s.game,
   sourceDoc:(await input.db.doc('matches/'+r.battleId+'/games/'+s.source.gameId+
     '/replaySources/'+s.source.sourceHash).get()).data()
 })));
 await current.collected.revalidate(); // prevent drift between selected source and the transaction source snapshots
 const proposalDigest=bindingDigest([proposed,item.candidates,item.orderMs,eligible]);
 const plan=await input.db.runTransaction(async(tx:any)=>{
   await actorInTransaction(tx,input);
   const [existing,marker,review]=await Promise.all([tx.get(slotRef),tx.get(markerRef),
     tx.get(item.ref.collection('chronicleRareReviewedMoments').doc(proposed.incidentId))]);
   if(existing.exists)return {created:false,slot:existing.data()};
   if(!review.exists||currentToken(review.data())!==currentToken(item.reviewSnapshots.find(d=>d.id===proposed.incidentId)?.data()))
     throw stale();
   chronicleEligibleCooldown(eligible,r.battleId,marker.data()?.lastOfferedBattleId??null);
   await verifyCurrent(tx,input,{battleId:r.battleId},savedSources);
   if(currentToken((await tx.get(item.ref)).data())!==currentToken(item.match))throw stale();
   const opRevision=bindingDigest([proposalDigest,review.data(),TEST_POLICY]);
   const opportunity:Opportunity={slotId:proposed.slotId,opportunityRevision:opRevision,
     battleId:r.battleId,matchId:r.battleId,incidentId:proposed.incidentId,
     incidentRevision:proposed.incidentRevision,sourceAuthority:proposed.sourceAuthority,
     respondentPlayerId:input.actor.playerId,counterpartPlayerId:proposed.counterpartPlayerId,
     family:proposed.family,questionVersion:'CHRON_V1E_STRUCTURED_CHOICES_1',
     choiceIds:[...CHOICES[proposed.family]],selectorPolicy:TEST_POLICY,
     fatigueSnapshotDigest:bindingDigest([eligible,marker.data()??null]),state:'OFFERED'};
   const planned=planInvitationOffer(null,opportunity,0,[TEST_POLICY]);
   const slot={...planned.slot,selected:{...proposed,sourceHash:savedSources.find(s=>s.source.gameId===proposed.gameId)?.source.sourceHash,
       battleAuthorities:savedSources.map(s=>({gameId:s.source.gameId,authorityRevision:s.source.authorityRevision,
         gameDigest:currentToken(s.game),sourceDigest:currentToken(s.sourceDoc)}))
         .sort((a,b)=>a.gameId.localeCompare(b.gameId)),
       matchDigest:currentToken(item.match),
       reviewedDigest:currentToken(review.data()),proposalDigest,approvalRef:TEST_POLICY.approvalRef},
     createdAt:new Date(),testOnly:true};
   tx.create(slotRef,slot);
   tx.set(markerRef,{lastOfferedBattleId:r.battleId,
     lastEligibleIndex:eligible.indexOf(r.battleId),lastOfferRevision:opRevision}, {merge:true});
   tx.create(slotRef.collection('audit').doc('offered'),{kind:'OFFER',revision:1,at:new Date(),
     actorPlayerId:input.actor.playerId,sourceAuthority:proposed.sourceAuthority,offerDigest:opRevision});
   return {created:true,slot};
 });
 if(!plan.created)return {offered:false,reason:'BATTLE_SLOT_ALREADY_CONSUMED'};
 return {offered:true,invitation:visibility(plan.slot)};
}

/** Ordinary respondent operations, never direct Firestore client writes.
 * requestId is the immutable document key; exact retries do not append again.
 * Separate binding judgments are private until independently qualified.
 */
export async function actOnMyChronicleInvitation(input:Input,r:Bag){
 assertChronicleInteractionEmulator(input.env);
 requireFields(r,['battleId','requestId','expectedRevision','opportunityRevision',
   'action','choiceId','privateNote','confirmed','reason']);
 if(!id(r.battleId)||!id(r.requestId)||!Number.isSafeInteger(r.expectedRevision)||
    !/^[a-f0-9]{64}$/.test(r.opportunityRevision??'')||
    !['SUBMIT','DEFER','DECLINE','CORRECTION_REQUEST','CORRECT','REFRESH'].includes(r.action))
   throw invalid();
 if(r.privateNote!==undefined&&!note(r.privateNote))throw invalid();
 if(r.action==='CORRECTION_REQUEST'&&
   (typeof r.reason!=='string'||r.reason.trim().length<12||r.reason.length>500))throw invalid();
 if(r.action!=='CORRECTION_REQUEST'&&r.reason!==undefined)throw invalid();
 if(['SUBMIT','CORRECT'].includes(r.action)&&
    (r.confirmed!==true||!id(r.choiceId)))throw invalid();
 if(!['SUBMIT','CORRECT'].includes(r.action)&&
    (r.choiceId!==undefined||r.privateNote!==undefined||r.confirmed!==undefined))throw invalid();
 const ref=input.db.doc(slotPath(r.battleId,input.actor.playerId));
 // Collect/verify all current READY sources before the transaction except for
 // REFRESH, which must remain possible specifically when a source vanished.
 let selectedItem:Awaited<ReturnType<typeof cohort>>['items'][number]|undefined;
 let verifiedSources:any[]=[];
 if(r.action!=='REFRESH'){
   const current=await cohort(input);
   selectedItem=current.items.find(x=>x.battleId===r.battleId);
   if(!selectedItem||!selectedItem.battle.evidenceComplete)throw stale();
   verifiedSources=await Promise.all(selectedItem.sources.map(async s=>({
     source:s.source,game:s.game,
     sourceDoc:(await input.db.doc('matches/'+r.battleId+'/games/'+s.source.gameId+
       '/replaySources/'+s.source.sourceHash).get()).data()
   })));
   await current.collected.revalidate();
 }
 return input.db.runTransaction(async(tx:any)=>{
   await actorInTransaction(tx,input);
   const prior=await tx.get(ref);
   if(!prior.exists)throw new HttpsError('not-found','No invitation was issued for this Battle/respondent.');
   const slot=prior.data();
   if(slot.respondentPlayerId!==input.actor.playerId||slot.battleId!==r.battleId||
      slot.slotId!==invitationSlotId(r.battleId,input.actor.playerId))throw stale();
   const auditRef=ref.collection('audit').doc(r.requestId);
   const previous=await tx.get(auditRef);
   if(previous.exists){
     if(previous.data()?.requestDigest!==bindingDigest(r))throw new HttpsError('already-exists','Conflicting Chronicle retry.');
     return {success:true,revision:previous.data().resultRevision,
       state:previous.data().resultState,idempotent:true};
   }
   if(r.expectedRevision!==slot.revision||r.opportunityRevision!==slot.currentOpportunityRevision)
      throw stale();
   if(r.action==='REFRESH'){
     const mr=input.db.doc('matches/'+r.battleId);
     const gr=mr.collection('games').doc(slot.selected.gameId);
     const [m,g]=await Promise.all([tx.get(mr),tx.get(gr)]);
     const sourceId=g.data()?.activeReplayStatisticsId;
     let active=sourceId===slot.selected.sourceHash&&
       m.data()?.activeResultDisputeId==null&&g.data()?.activeResultDisputeId==null&&
       m.data()?.participants?.some((p:Bag)=>p.playerId===input.actor.playerId);
     if(active){
       const reviewed=await tx.get(mr.collection('chronicleRareReviewedMoments').doc(slot.selected.incidentId));
       active=currentToken(reviewed.data())===slot.selected.reviewedDigest;
     }
     if(active){
       const sr=await tx.get(gr.collection('replaySources').doc(sourceId));
       active=sr.data()?.state==='READY'&&
         currentToken(m.data())===slot.selected.matchDigest;
       // A stale sibling Game must also invalidate the historical offer.
       if(active)for(const bound of slot.selected.battleAuthorities??[]){
         const sibling=mr.collection('games').doc(bound.gameId);
         const gs=await tx.get(sibling);
         if(currentToken(gs.data())!==bound.gameDigest){active=false;break;}
         const ss=await tx.get(sibling.collection('replaySources').doc(gs.data()?.activeReplayStatisticsId));
         if(ss.data()?.state!=='READY'||currentToken(ss.data())!==bound.sourceDigest){active=false;break;}
       }
     }
     if(active)return {success:true,revision:slot.revision,state:slot.state,idempotent:true};
     const changed=transitionInvitation(slot,slot.revision,r.opportunityRevision,'WITHDRAWN');
     tx.set(ref,{...slot,...changed,withdrawnAt:new Date()});
     tx.create(auditRef,{kind:'SOURCE_WITHDRAWN',requestDigest:bindingDigest(r),
       actorPlayerId:input.actor.playerId,at:new Date(),resultRevision:changed.revision,
       resultState:changed.state});
     return {success:true,revision:changed.revision,state:'WITHDRAWN',idempotent:false};
   }
   if(slot.state==='WITHDRAWN')throw stale();
   // Submission is bound to *every* Game/POV authority admitted at offer time.
   // A sibling Game correction with unchanged selected Game is still stale.
   const currentBinding=verifiedSources.map(s=>({gameId:s.source.gameId,
     authorityRevision:s.source.authorityRevision,
     gameDigest:currentToken(s.game),sourceDigest:currentToken(s.sourceDoc)}))
     .sort((a,b)=>a.gameId.localeCompare(b.gameId));
   if(currentToken(currentBinding)!==currentToken(slot.selected.battleAuthorities)||
      currentToken(selectedItem?.match)!==slot.selected.matchDigest)throw stale();
   await verifyCurrent(tx,input,{battleId:r.battleId},verifiedSources);
   const reviewed=await tx.get(input.db.doc('matches/'+r.battleId+
     '/chronicleRareReviewedMoments/'+slot.selected.incidentId));
   if(currentToken(reviewed.data())!==slot.selected.reviewedDigest||
      reviewed.data()?.incidentRevision!==slot.selected.incidentRevision||
      reviewed.data()?.sourceAuthority!==slot.selected.sourceAuthority||
      reviewed.data()?.methodReview!=='EMULATOR_ONLY'||
      reviewed.data()?.reviewedSource!=='ORIGINAL_VERIFIED_TEST_WITNESS')throw stale();
   if(r.action==='CORRECTION_REQUEST'){
     if(slot.state!=='SUBMITTED'||slot.correction?.state==='REQUESTED'||slot.correction?.state==='REOPENED')throw fail('No correction may be requested.');
     const changed={...slot,revision:slot.revision+1,correction:{state:'REQUESTED',
       requestedBy:input.actor.playerId,requestId:r.requestId,privateReason:r.reason.trim()}};
     tx.set(ref,changed);
     tx.create(auditRef,{kind:'CORRECTION_REQUEST',actorPlayerId:input.actor.playerId,
       requestDigest:bindingDigest(r),resultRevision:changed.revision,resultState:changed.state,
       at:new Date()});
     return {success:true,revision:changed.revision,state:changed.state,idempotent:false};
   }
   if(r.action==='CORRECT'&&(slot.state!=='SUBMITTED'||slot.correction?.state!=='REOPENED'))
      throw fail('A reviewer must reopen the original binding statement.');
   if(r.action==='SUBMIT'&&slot.state!=='OFFERED'&&slot.state!=='DEFERRED')
      throw fail('Binding testimony was already submitted or declined.');
   let changed:Bag;
   if(r.action==='SUBMIT'||r.action==='CORRECT'){
     if(!CHOICES[slot.selected.family as JudgmentFamily].includes(r.choiceId)||
        r.choiceId==='UNDECIDED')throw invalid();
     const nextJudgmentVersion=(slot.judgment?.version??0)+1;
     const judgmentRef=ref.collection('judgments').doc('v'+nextJudgmentVersion);
     changed=r.action==='SUBMIT'?
       {...slot,...transitionInvitation(slot,slot.revision,r.opportunityRevision,'SUBMITTED')}:
       {...slot,revision:slot.revision+1};
     changed.judgment={version:nextJudgmentVersion,choiceId:r.choiceId,
       authorPlayerId:input.actor.playerId,incidentId:slot.selected.incidentId,
       incidentRevision:slot.selected.incidentRevision,
       sourceAuthority:slot.selected.sourceAuthority,status:'PENDING',
       correction:r.action==='CORRECT'?'AUTHOR_REBOUND':'NONE'};
     if(r.action==='CORRECT')changed.correction={state:'RESOLVED',requestedBy:input.actor.playerId};
     tx.create(judgmentRef,{...changed.judgment,privateNote:r.privateNote??'',
       at:new Date(),explicitBindingConfirmation:true,requestId:r.requestId,
       provenance:{battleId:r.battleId,gameId:slot.selected.gameId,
         sourceHash:slot.selected.sourceHash},visibility:'AUTHOR_AND_IMPARTIAL_REVIEWER'});
   }else{
     changed={...slot,...transitionInvitation(slot,slot.revision,r.opportunityRevision,
       r.action==='DEFER'?'DEFERRED':'DECLINED')};
   }
   tx.set(ref,changed);
   tx.create(auditRef,{kind:r.action,actorPlayerId:input.actor.playerId,at:new Date(),
     requestDigest:bindingDigest(r),resultRevision:changed.revision,resultState:changed.state,
     bindingVersion:changed.judgment?.version??null});
   return {success:true,revision:changed.revision,state:changed.state,idempotent:false};
 });
}

/** Owner-only list. Unknown or withdrawn sources never leak another author's
 * notes, or publish subjective responses as the Chronicle narrator's facts. */
export async function readMyChronicleInvitations(input:Input,r:Bag){
 assertChronicleInteractionEmulator(input.env);requireFields(r,[]);
 const checks=await Promise.all([input.db.doc('players/'+input.actor.playerId).get(),
   input.db.doc('authLinks/'+input.actor.authUid).get()]);
 if(checks[0].data()?.membershipStatus!=='ACTIVE'||
    checks[1].data()?.playerId!==input.actor.playerId)
   throw new HttpsError('permission-denied','Active owner account required.');
 const docs=[];let after:any=null;
 do{
   let q=input.db.collection('matches').orderBy('__name__').limit(64);
   if(after)q=q.startAfter(after);
   const page=await q.get();
   docs.push(...page.docs);
   if(docs.length>256)throw new HttpsError('resource-exhausted','Owner invitation history exceeds bounded read.');
   if(page.size<64)break;
   after=page.docs.at(-1);
 }while(true);
 const invitations:any[]=[];
 for(const m of docs){
   const slot=(await m.ref.collection('socialV1InvitationSlots')
     .doc(invitationSlotId(m.id,input.actor.playerId)).get());
   if(!slot.exists)continue;
   const data=slot.data();
   if(data?.respondentPlayerId!==input.actor.playerId||data?.battleId!==m.id)throw stale();
   const gr=m.ref.collection('games').doc(data.selected.gameId);
   const game=await gr.get();
   const sourceId=game.data()?.activeReplayStatisticsId;
   const source=sourceId===data.selected.sourceHash?
     await gr.collection('replaySources').doc(sourceId).get():null;
   let current=source?.data()?.state==='READY'&&
     !game.data()?.activeResultDisputeId&&!m.data()?.activeResultDisputeId&&
     currentToken(m.data())===data.selected.matchDigest;
   if(current){
     const reviewer=await m.ref.collection('chronicleRareReviewedMoments').doc(data.selected.incidentId).get();
     current=currentToken(reviewer.data())===data.selected.reviewedDigest;
   }
   if(current)for(const bound of data.selected.battleAuthorities??[]){
     const g=await m.ref.collection('games').doc(bound.gameId).get();
     if(currentToken(g.data())!==bound.gameDigest){current=false;break;}
     const sr=await g.ref.collection('replaySources').doc(g.data()?.activeReplayStatisticsId).get();
     if(sr.data()?.state!=='READY'||currentToken(sr.data())!==bound.sourceDigest){current=false;break;}
   }
   invitations.push({...visibility(data),sourceCurrent:!!current});
 }
 return {version:CHRONICLE_INTERACTION_VERSION,visibility:'OWNER_ONLY',
   ownerPlayerId:input.actor.playerId,invitations,officialEffects:[],
   narratorAuthority:'FACTUAL_SOURCE_ONLY',testOnly:true};
}

export async function readMyChronicleSubmission(input:Input,r:Bag){
 assertChronicleInteractionEmulator(input.env);requireFields(r,['battleId']);
 if(!id(r.battleId))throw invalid();
 const [p,l,s]=await Promise.all([input.db.doc('players/'+input.actor.playerId).get(),
   input.db.doc('authLinks/'+input.actor.authUid).get(),
   input.db.doc(slotPath(r.battleId,input.actor.playerId)).get()]);
 if(p.data()?.membershipStatus!=='ACTIVE'||l.data()?.playerId!==input.actor.playerId)
   throw new HttpsError('permission-denied','Active author required.');
 if(!s.exists)throw new HttpsError('not-found','No private submission for this respondent.');
 const slot=s.data();
 if(slot?.respondentPlayerId!==input.actor.playerId)throw new HttpsError('permission-denied','Submission is not yours.');
 const v=slot.judgment?.version;
 const judgment=v?await s.ref.collection('judgments').doc('v'+v).get():null;
 return {authorPlayerId:input.actor.playerId,battleId:r.battleId,privateSubmission:
   judgment?.data()??null,correctionState:slot.correction?.state??null,
   publication:'NONE_PENDING_INDEPENDENT_QUALIFICATION',speakerNotNarrator:true};
}

/** Impartial admin correction review only; author cannot approve their own
 * judgment. No choice is changed in this function and the audit is append-only. */
export async function reviewChronicleCorrection(input:Input,r:Bag){
 assertChronicleInteractionEmulator(input.env);
 requireFields(r,['battleId','respondentPlayerId','requestId','expectedRevision','decision']);
 if(input.actor.role!=='ADMIN'||!id(r.battleId)||!id(r.respondentPlayerId)||!id(r.requestId)||
    typeof r.reason!=='string'||r.reason.trim().length<12||r.reason.length>500||
    !Number.isSafeInteger(r.expectedRevision)||!['APPROVE','REJECT'].includes(r.decision))
   throw new HttpsError('permission-denied','Impartial authenticated administrator required.');
 if(input.actor.playerId===r.respondentPlayerId)throw new HttpsError('permission-denied','Author cannot adjudicate own statement.');
 const ref=input.db.doc(slotPath(r.battleId,r.respondentPlayerId));
 return input.db.runTransaction(async(tx:any)=>{
   await actorInTransaction(tx,input);
   const snap=await tx.get(ref),slot=snap.data();
   if(!snap.exists||slot?.respondentPlayerId!==r.respondentPlayerId||
      slot.revision!==r.expectedRevision||slot.correction?.state!=='REQUESTED')throw stale();
   const audit=ref.collection('audit').doc(r.requestId),prior=await tx.get(audit);
   if(prior.exists)throw new HttpsError('already-exists','Correction review already recorded.');
   const next={...slot,revision:slot.revision+1,
     correction:{...slot.correction,state:r.decision==='APPROVE'?'REOPENED':'REJECTED',
       reviewerPlayerId:input.actor.playerId,privateReviewReason:r.reason.trim()}};
   tx.set(ref,next);
   tx.create(audit,{kind:'IMPARTIAL_CORRECTION_REVIEW',decision:r.decision,
     actorPlayerId:input.actor.playerId,at:new Date(),resultRevision:next.revision,
     requestDigest:bindingDigest(r)});
   return {success:true,revision:next.revision,correctionState:next.correction.state};
 });
}

const envInput=(actor:Actor)=>({db,actor,env:process.env,
 bucket:getStorage().bucket(process.env.REPLAY_BUCKET||
   (process.env.GCLOUD_PROJECT||'')+'.appspot.com')});
export const offerChronicleInvitation=onCall({...callableOptions,timeoutSeconds:120,memory:'1GiB'},
 async request=>offerMyChronicleInvitation(envInput(await requireLeaguePlayer(request)),request.data));
export const actOnChronicleInvitation=onCall({...callableOptions,timeoutSeconds:120,memory:'1GiB'},
 async request=>actOnMyChronicleInvitation(envInput(await requireLeaguePlayer(request)),request.data));
export const getMyChronicleInvitations=onCall({...callableOptions,timeoutSeconds:120,memory:'1GiB'},
 async request=>readMyChronicleInvitations(envInput(await requireLeaguePlayer(request)),request.data));
export const getMyChronicleSubmission=onCall({...callableOptions,timeoutSeconds:120,memory:'1GiB'},
 async request=>readMyChronicleSubmission(envInput(await requireLeaguePlayer(request)),request.data));
export const adminReviewChronicleCorrection=onCall({...callableOptions,timeoutSeconds:120,memory:'1GiB'},
 async request=>reviewChronicleCorrection(envInput(await requireAdmin(request)),request.data));
