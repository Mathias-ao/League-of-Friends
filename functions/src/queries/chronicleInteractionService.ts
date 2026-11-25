import {getStorage} from 'firebase-admin/storage';
import {HttpsError,onCall} from 'firebase-functions/v2/https';
import {requireAdmin,requireLeaguePlayer} from '../auth/authorization.js';
import {db} from '../config/firebase.js';
import {collections,leagueStateDocumentId} from '../domain/collections.js';
import {callableOptions} from '../config/runtime.js';
import {bindingDigest} from '../engines/nativeRecordingIntegration.js';
import {battleGameManifest} from '../engines/battleGameManifest.js';
import {selectRareChronicleProposals,type CurrentChronicleBattle,type ReviewedTurningPoint,
  type ApprovedRareSelectionPolicy} from '../engines/chronicleRareSelector.js';
import {invitationSlotId,planInvitationOffer,transitionInvitation,type InvitationSlot,
  type JudgmentFamily,type Opportunity,type PolicyRef} from '../domain/socialV1.js';
import {collectMyCurrentBattleHistory} from './getMyPersonalityHistory.js';
import {deriveSocialScheduleOrders} from '../integration/socialScheduleOrder.js';
import {qualifyThreeBattleLosses,verifiedOccurrence} from '../integration/battleOccurrence.js';
import {HOSTED_SKILL_METHOD,HOSTED_SKILL_POLICY_VERSION,hostedSkillEnvironment,
  readHostedSkillPolicy,orderedHostedSkillBattles,currentSeasonChronicleBattles,qualifiedHostedSkillMoment,
  type HostedSkillPolicy} from '../engines/chronicleHostedSkill.js';

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
type ChronicleItem={battleId:string;battle:CurrentChronicleBattle;candidates:ReviewedTurningPoint[];
  match:Bag;orderTuple:[number,number]|null;scheduleRevisions:Array<{gameId:string;revision:string}>;
  occurrenceToken:string|null;hostedLossRevision:string|null;
  ref:any;reviewSnapshots:any[];sources:any[]};
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
type ChronicleMode='emulator'|'hosted';
/** The demo door is immutable; the separately gated EU lane never makes
 * non-demo or production projects eligible for emulator methods. */
export function chronicleInteractionMode(env:NodeJS.ProcessEnv):ChronicleMode{
 if(hostedSkillEnvironment(env))return 'hosted';
 assertChronicleInteractionEmulator(env);
 return 'emulator';
}
const hostedPolicyRef=(input:Input)=>input.db.doc('runtimePolicies/chroniclePrivateSkillV1');
const slotPath=(battleId:string,actorId:string)=>
  'matches/'+battleId+'/socialV1InvitationSlots/'+invitationSlotId(battleId,actorId);
const note=(v:unknown)=>typeof v==='string'&&v.length<=1000&&!/[\u0000-\u0008]/.test(v);
const currentToken=(v:any)=>bindingDigest(v??null);
/** The existing reviewed moment has no admitted factual excerpt or timestamp.
 * Expose only its already-fenced canonical Game identity. Neither a family
 * label, reviewer prose nor a command request supplies the missing account. */
export function chronicleInvitationContext(slot:Bag,currentGame:Bag|null){
  const gameNumber=currentGame&&currentGame.activeReplayStatisticsId===slot.selected.sourceHash&&
    Number.isSafeInteger(currentGame.gameNumber)&&
    currentGame.gameNumber>0?currentGame.gameNumber:null;
  return {version:'AOF_CHRONICLE_INVITATION_CONTEXT_V1' as const,
    status:gameNumber!==null?'CURRENT_GAME_ONLY' as const:'PENDING' as const,
    battleId:slot.battleId,gameId:slot.selected.gameId,
    opportunityRevision:slot.currentOpportunityRevision,gameNumber,
    incidentAccount:null,recordingAtMs:null,
    missing:['SOURCE_QUALIFIED_INCIDENT_ACCOUNT','SOURCE_QUALIFIED_INCIDENT_TIME']};
}
const visibility=(slot:Bag,currentGame:Bag|null=null)=>{
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
    context:chronicleInvitationContext(slot,currentGame),
    choices:CHOICES[slot.selected.family as JudgmentFamily],speaker,
    // Private notes and audit are never in the standard private invite list;
    // author can explicitly retrieve their own submission detail.
    correctionState:slot.correction?.state??null,
    effects:{relationshipDelta:null,officialWrites:false,negativeForSilence:false}};
};

/** A reviewer signs the source-bound loss proof, not a selector-generated
 * incidentRevision/sourceAuthority. The selector revalidates those separately. */
export function reviewedChronicleMomentCurrent(mode:ChronicleMode,raw:unknown,
  selected:Bag,policy:HostedSkillPolicy|null=null):boolean{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return false;
 const review=raw as Bag;
 if(currentToken(review)!==selected.reviewedDigest)return false;
 return mode==='hosted'?
   review.methodReview==='OWNER_REVIEWED_RARITY'&&
   review.reviewedSource==='THIRD_OFFICIAL_BATTLE_LOSS'&&
   review.lossRevision===selected.hostedLossRevision&&
   review.approvalRef===policy?.approvalRef:
   review.incidentRevision===selected.incidentRevision&&
   review.sourceAuthority===selected.sourceAuthority&&
   review.methodReview==='EMULATOR_ONLY'&&
   review.reviewedSource==='ORIGINAL_VERIFIED_TEST_WITNESS';
}
/** Full current-source verification delegates to already authenticated INT-B
 * collection, including actual READY native artifacts, GUID claims and whole
 * league read fences. Reviewer records stay server-only. */
async function cohort(input:Input,mode:ChronicleMode='emulator'){
 const policySnap=mode==='hosted'?await hostedPolicyRef(input).get():null;
 const hostedPolicy=mode==='hosted'?readHostedSkillPolicy(input.env,policySnap?.data()):null;
 if(mode==='hosted'&&!hostedPolicy)throw fail('Approved and SHA-pinned private Chronicle skill policy is unavailable.');

  const collected=await collectMyCurrentBattleHistory({...input,request:{},maxOwnGames:64,includeScheduleOrder:true});
  const activeSeasonRef=mode==='hosted'?input.db.collection(collections.leagueState).doc(leagueStateDocumentId):null;
  const activeSeasonSnap=activeSeasonRef?await activeSeasonRef.get():null;
  const currentSeasonId=activeSeasonSnap?.data()?.activeSeasonId;
  if(mode==='hosted'&&!id(currentSeasonId))
    throw fail('The current Chronicle Season authority is unavailable.');
  const seasonBattles=mode==='hosted'?
    currentSeasonChronicleBattles(collected.occurrenceBattles,currentSeasonId):[];
  const seasonBattleIds=new Set(seasonBattles.map(b=>b.battleId));
  const hostedPending=mode==='hosted'?
    collected.pending.filter(p=>seasonBattleIds.has(p.battleId)):[];
  const hostedLosses=mode==='hosted'?qualifyThreeBattleLosses(seasonBattles,input.actor.playerId):[];
  const items:ChronicleItem[]=[];
  for(const b of collected.battles){
    if(mode==='hosted'&&!seasonBattleIds.has(b.battleId))continue;
    const ref=input.db.doc('matches/'+b.battleId),snapshot=await ref.get(),match=snapshot.data();
    if(!match?.participants?.some((p:Bag)=>p.playerId===input.actor.playerId))continue;
    const orderRows=collected.scheduleOrders.filter(o=>o.battleId===b.battleId);
    const ordered=orderRows.length===b.gameIds.length&&orderRows.length>0&&
      orderRows.every(o=>o.status==='ORDERED'&&o.order!==null)&&
      new Set(orderRows.map(o=>o.gameId)).size===b.gameIds.length;
    const orderTuple:[number,number]|null=ordered?
      [orderRows[0].order!.event,orderRows[0].order!.battle]:null;
    const scheduleRevisions:Array<{gameId:string;revision:string}>=orderRows.map(o=>({gameId:o.gameId,revision:o.revision}))
      .sort((a,b)=>a.gameId.localeCompare(b.gameId));
    const occurrence=mode==='hosted'?collected.occurrenceBattles.find(x=>x.battleId===b.battleId):null;
    const proven=occurrence?verifiedOccurrence(occurrence):null;
    const evidenceComplete=b.gameManifestComplete!==false&&b.gameIds.length>0&&b.sources.length===b.gameIds.length&&
      b.sources.every(s=>s.source.roster.some(p=>p.playerId===input.actor.playerId));
    const battle:CurrentChronicleBattle={battleId:b.battleId,
      playerIds:match.participants.map((p:Bag)=>p.playerId),
      currentGames:b.sources.map(s=>({gameId:s.source.gameId,sourceAuthority:s.source.authorityRevision})),
      evidenceComplete,chronologyQualified:mode==='hosted'?!!proven:ordered};
    const reviews=await ref.collection('chronicleRareReviewedMoments').limit(30).get();
    if(reviews.size===30)throw new HttpsError('resource-exhausted','Too many candidate source reviews for one Battle.');
    // This collection has no exposed client write permission; emulator seed
    // must explicitly mark independent original-method review as test-only.
    let candidates:ReviewedTurningPoint[];
    let hostedLossRevision:string|null=null;
    if(mode==='hosted'){
      const proof=hostedLosses.find(p=>p.anchorBattleId===b.battleId);
      hostedLossRevision=proof?.revision??null;
      const admitted=proof&&occurrence&&hostedPolicy?
        reviews.docs.map((d:any)=>qualifiedHostedSkillMoment({
          battle:occurrence,proof,review:d.data(),reviewDocId:d.id,
          respondent:input.actor.playerId,policy:hostedPolicy,
          sourceAuthority:b.sources[0]?.source?.authorityRevision??''
        })).filter((c:ReviewedTurningPoint|null):c is ReviewedTurningPoint=>c!==null):[];
      // Two independently signed claims for one turning point cannot become
      // competing private invitations; wait for one non-ambiguous review.
      candidates=admitted.length===1?admitted:[];
    }else candidates=reviews.docs.map((d:any)=>d.data()).filter((c:Bag)=>c.methodReview==='EMULATOR_ONLY'&&
      c.reviewedSource==='ORIGINAL_VERIFIED_TEST_WITNESS'&&c.battleId===b.battleId) as ReviewedTurningPoint[];
    items.push({battleId:b.battleId,battle,match,
      orderTuple:mode==='hosted'?null:orderTuple,
      scheduleRevisions,occurrenceToken:occurrence?currentToken(occurrence.occurrence):null,
      hostedLossRevision,ref,reviewSnapshots:reviews.docs,
      candidates,sources:b.sources});
  }
  const hostedCandidateIds:string[]=mode==='hosted'?
    items.filter(x=>!!select(x,input.actor.playerId,mode,hostedPolicy)).map(x=>x.battleId):[];
  const hostedEligible:string[]|null=mode==='hosted'?
    orderedHostedSkillBattles(seasonBattles,input.actor.playerId,hostedCandidateIds):null;
  if(mode==='hosted'&&hostedEligible)for(const item of items){
    const index=hostedEligible.indexOf(item.battleId);
    item.orderTuple=index>=0?[0,index]:null;
  }
  items.sort((a,b)=>!a.orderTuple||!b.orderTuple?
    (a.orderTuple?-1:b.orderTuple?1:a.battleId.localeCompare(b.battleId)):
    a.orderTuple[0]-b.orderTuple[0]||a.orderTuple[1]-b.orderTuple[1]);
  await collected.revalidate();
  return {items,collected,mode,hostedPolicy,hostedEligible,hostedPending,policySnap,
    activeSeasonRef,activeSeasonToken:currentToken(activeSeasonSnap?.data()??null)};
}
const testPolicy=():ApprovedRareSelectionPolicy=>({
  approved:true,approvalRef:TEST_POLICY.approvalRef,
  qualifiedMethods:TEST_METHODS,familyOrder:FAMILY_ORDER,
  fatiguedPlayerIds:[],blockedPairKeys:[],
});
const select=(item:ChronicleItem,actorId:string,
 mode:ChronicleMode='emulator',hostedPolicy:HostedSkillPolicy|null=null)=>
 !item.battle.chronologyQualified?null:selectRareChronicleProposals({battle:item.battle,candidates:item.candidates,
   policy:mode==='hosted'?hostedPolicy?.selection??null:testPolicy(),existingSlots:[]})
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
function sameApprovedSchedule(battleId:string,match:Bag,event:Bag|null,plan:Bag|null,
  planId:string|null,games:Array<{gameId:string;game:Bag}>,expected:unknown):boolean{
  if(!Array.isArray(expected)||!expected.length)return false;
  try{
    const manifest=battleGameManifest(match,games.map(g=>({...g.game,gameId:g.gameId,
      gameNumber:g.game.gameNumber,status:g.game.status})));
    if(!manifest.gameManifestComplete)return false;
    const requiredGames=games.filter(g=>manifest.knownGameIds.includes(g.gameId));
    const rows=deriveSocialScheduleOrders([{battleId,match,event,plan,planId,games:requiredGames}]);
    const revisions=rows.map(o=>({gameId:o.gameId,revision:o.revision}))
      .sort((a,b)=>a.gameId.localeCompare(b.gameId));
    return rows.length===expected.length&&rows.every(o=>o.status==='ORDERED')&&
      currentToken(revisions)===currentToken(expected);
  }catch{return false;}
}
/** Prevent an inserted Battle, altered earlier loss, occurrence review, stale
 * sibling Game or active GUID remap between eligibility and the slot CAS.
 * Includes absent sidecars and other source-current owner Battles. The base
 * collector also performs native immutable artifact revalidation before this
 * guarded write transaction; nothing is trusted from client-supplied history.
 */
async function captureHostedHistoryGuard(input:Input,current:Awaited<ReturnType<typeof cohort>>){
 const matchQuery=input.db.collection('matches').orderBy('__name__').limit(257);
 const matchRows=await matchQuery.get();
 if(matchRows.size>256)throw fail('Complete Chronicle Battle history exceeds the read bound.');
 const queries:Array<{ref:any;token:string}>=[{
   ref:matchQuery,token:currentToken(matchRows.docs.map((d:any)=>[d.id,d.data()]))}];
 const refs=new Map<string,{ref:any;token:string}>();
 const add=async(ref:any)=>{
   if(refs.has(ref.path))return;
   const snap=await ref.get();refs.set(ref.path,{ref,token:currentToken(snap.data()??null)});
 };
 if(current.activeSeasonRef){
   const fresh=await current.activeSeasonRef.get();
   if(currentToken(fresh.data()??null)!==current.activeSeasonToken)throw stale();
   await add(current.activeSeasonRef);
 }
 for(const b of current.collected.occurrenceBattles){
   const mr=input.db.doc('matches/'+b.battleId);
   await add(mr);await add(mr.collection('occurrence').doc('current'));
   await add(input.db.doc('events/'+b.match.eventId));
   await add(input.db.doc('seasons/'+b.match.seasonId));
   if(b.planId)await add(input.db.doc('events/'+b.match.eventId+'/matchPlans/'+b.planId));
   const reviewQuery=mr.collection('chronicleRareReviewedMoments').orderBy('__name__').limit(30);
   const reviewed=await reviewQuery.get();
   if(reviewed.size===30)throw fail('Too many Chronicle rarity reviews in one Battle.');
   queries.push({ref:reviewQuery,
     token:currentToken(reviewed.docs.map((d:any)=>[d.id,d.data()]))});
   const q=mr.collection('games').orderBy('__name__').limit(65);
   const games=await q.get();
   queries.push({ref:q,token:currentToken(games.docs.map((d:any)=>[d.id,d.data()]))});
   for(const g of games.docs){
     const hash=g.data()?.activeReplayStatisticsId;
     if(typeof hash!=='string'||!/^[a-f0-9]{64}$/.test(hash))continue;
     const sr=g.ref.collection('replaySources').doc(hash);
     await add(sr);
     const src=(await sr.get()).data();
     const guid=src?.matchFacts?.game?.guid;
     if(id(guid))await add(input.db.doc('recordingGameClaims/'+Buffer.from(guid).toString('hex')));
   }
 }
 await add(hostedPolicyRef(input));
 return {queries,refs:[...refs.values()]};
}
async function verifyHostedHistoryGuard(tx:any,guard:Awaited<ReturnType<typeof captureHostedHistoryGuard>>){
 for(const q of guard.queries){
   const snap=await tx.get(q.ref);
   if(currentToken(snap.docs.map((d:any)=>[d.id,d.data()]))!==q.token)throw stale();
 }
 for(const d of guard.refs)if(currentToken((await tx.get(d.ref)).data()??null)!==d.token)throw stale();
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
 const manifest=battleGameManifest(match,gs.docs.map((g:any)=>({...g.data(),gameId:g.id})));
 if(!manifest.gameManifestComplete||manifest.knownGameIds.length!==sourceRows.length||gs.size>64)throw stale();
  const planId=event.data()?.approvedMatchPlanId;
  const plan=typeof planId==='string'&&planId?
    await tx.get(input.db.doc('events/'+match.eventId+'/matchPlans/'+planId)):null;
  if(selected.hosted===true){
    const occurrence=await tx.get(mr.collection('occurrence').doc('current'));
    if(!selected.occurrenceToken||currentToken(occurrence.data())!==selected.occurrenceToken)
      throw stale();
  }else if(!sameApprovedSchedule(selected.battleId,match,event.data()??null,
      plan?.data()??null,planId??null,
      gs.docs.map((g:any)=>({gameId:g.id,game:g.data()})),selected.scheduleRevisions))throw stale();
  const byId=new Map(sourceRows.map(s=>[s.source.gameId,s]));
 for(const g of gs.docs){
   if(manifest.unusedGameIds.includes(g.id))continue;
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
 const mode=chronicleInteractionMode(input.env);
 requireFields(r,mode==='hosted'?[]:['battleId']);
 if(mode==='emulator'&&!id(r.battleId))throw invalid();
 const current=await cohort(input,mode);
 const markerRef=input.db.doc('players/'+input.actor.playerId+'/chronicleRareControls/v1');
 const markerBefore=mode==='hosted'?await markerRef.get():null;
 let item:typeof current.items[number]|undefined;
 let eligible:string[];
 if(mode==='hosted'){
   if(current.hostedPending.length||!current.hostedEligible)
     return {offered:false,reason:'SOURCE_CURRENT_TOTAL_ORDER_PENDING'};
   // Keep the existing cooldown contract: count only independently
   // eligible invitation-Battles, not ordinary Battles or sibling Games.
   eligible=current.hostedEligible.filter(battleId=>{
     const candidate=current.items.find(x=>x.battleId===battleId);
     return !!candidate&&!!select(candidate,input.actor.playerId,mode,current.hostedPolicy);
   });
   const last=markerBefore?.data()?.lastOfferedBattleId??null;
   if(last!==null&&!eligible.includes(last))
     return {offered:false,reason:'COOLDOWN_HISTORY_CHANGED'};
   // The client selects NO Battle. The first admissible third-loss turning
   // point after the durable consumed-slot/cooldown fence is server chosen.
   const candidates=current.items.filter(x=>!!select(x,input.actor.playerId,mode,current.hostedPolicy))
     .sort((a,b)=>eligible.indexOf(a.battleId)-eligible.indexOf(b.battleId));
   item=candidates.find(x=>{
     const pos=eligible.indexOf(x.battleId),prev=last?eligible.indexOf(last):-1;
     return pos>=0&&(prev<0||pos-prev>CHRONICLE_COOLDOWN_ELIGIBLE_BATTLES);
   });
   if(!item)return {offered:false,reason:'NO_RARE_SOURCE_QUALIFIED_TURNING_POINT'};
 }else{
   item=current.items.find(x=>x.battleId===r.battleId);
   if(!item||!item.battle.chronologyQualified||!item.battle.evidenceComplete||
        current.collected.pending.length||current.items.some(x=>!x.battle.chronologyQualified))
      throw fail('A complete approved Event/MatchPlan/Game history is required for rare Chronicle offers.');
   eligible=current.items.filter(x=>!!select(x,input.actor.playerId)).map(x=>x.battleId);
 }
 if(!item.battle.chronologyQualified||!item.battle.evidenceComplete)throw stale();
 const proposed=select(item,input.actor.playerId,mode,current.hostedPolicy);
 if(!proposed)return {offered:false,reason:'NO_RARE_SOURCE_QUALIFIED_TURNING_POINT'};
 const targetId=item.battleId;
 const slotRef=input.db.doc(slotPath(targetId,input.actor.playerId));
 const appliedPolicy:PolicyRef=mode==='hosted'?
   {policyVersion:HOSTED_SKILL_POLICY_VERSION,configurationVersion:current.hostedPolicy!.revision,
     status:'APPROVED',approvalRef:current.hostedPolicy!.approvalRef}:TEST_POLICY;
 const savedSources=await Promise.all(item.sources.map(async s=>({
   source:s.source,game:s.game,
   sourceDoc:(await input.db.doc('matches/'+targetId+'/games/'+s.source.gameId+
     '/replaySources/'+s.source.sourceHash).get()).data()
 })));
 await current.collected.revalidate(); // prevent drift between selected source and the transaction source snapshots
 const hostedGuard=mode==='hosted'?await captureHostedHistoryGuard(input,current):null;
 await current.collected.revalidate();
 const proposalDigest=bindingDigest([proposed,item.candidates,item.orderTuple,item.scheduleRevisions,
   eligible,mode,current.hostedPolicy?.revision??null,item.hostedLossRevision]);
 const plan=await input.db.runTransaction(async(tx:any)=>{
   await actorInTransaction(tx,input);
   const [existing,marker,review]=await Promise.all([tx.get(slotRef),tx.get(markerRef),
     tx.get(item.ref.collection('chronicleRareReviewedMoments').doc(proposed.incidentId))]);
   if(existing.exists)return {created:false,slot:existing.data()};
   if(!review.exists||currentToken(review.data())!==currentToken(item.reviewSnapshots.find(d=>d.id===proposed.incidentId)?.data()))
     throw stale();
   if(mode==='hosted'){
     if(currentToken(marker.data()??null)!==currentToken(markerBefore?.data()??null))throw stale();
     await verifyHostedHistoryGuard(tx,hostedGuard!);
   }
   chronicleEligibleCooldown(eligible,targetId,marker.data()?.lastOfferedBattleId??null);
   await verifyCurrent(tx,input,{battleId:targetId,scheduleRevisions:item.scheduleRevisions,
     hosted:mode==='hosted',occurrenceToken:item.occurrenceToken},savedSources);
   if(currentToken((await tx.get(item.ref)).data())!==currentToken(item.match))throw stale();
   const opRevision=bindingDigest([proposalDigest,review.data(),appliedPolicy]);
   const opportunity:Opportunity={slotId:proposed.slotId,opportunityRevision:opRevision,
     battleId:targetId,matchId:targetId,incidentId:proposed.incidentId,
     incidentRevision:proposed.incidentRevision,sourceAuthority:proposed.sourceAuthority,
     respondentPlayerId:input.actor.playerId,counterpartPlayerId:proposed.counterpartPlayerId,
     family:proposed.family,questionVersion:'CHRON_V1E_STRUCTURED_CHOICES_1',
     choiceIds:[...CHOICES[proposed.family]],selectorPolicy:appliedPolicy,
     fatigueSnapshotDigest:bindingDigest([eligible,marker.data()??null]),state:'OFFERED'};
   const planned=planInvitationOffer(null,opportunity,0,[appliedPolicy]);
   const slot={...planned.slot,selected:{...proposed,sourceHash:savedSources.find(s=>s.source.gameId===proposed.gameId)?.source.sourceHash,
       battleAuthorities:savedSources.map(s=>({gameId:s.source.gameId,authorityRevision:s.source.authorityRevision,
         gameDigest:currentToken(s.game),sourceDigest:currentToken(s.sourceDoc)}))
         .sort((a,b)=>a.gameId.localeCompare(b.gameId)),
       matchDigest:currentToken(item.match),scheduleRevisions:item.scheduleRevisions,
       occurrenceToken:item.occurrenceToken,hostedLossRevision:item.hostedLossRevision,
       policyRevision:current.hostedPolicy?.revision??null,deliveryMode:mode,
       reviewedDigest:currentToken(review.data()),proposalDigest,approvalRef:appliedPolicy.approvalRef},
     createdAt:new Date(),testOnly:mode==='emulator'};
   tx.create(slotRef,slot);
   tx.set(markerRef,{lastOfferedBattleId:targetId,
     lastEligibleIndex:eligible.indexOf(targetId),lastOfferRevision:opRevision}, {merge:true});
   tx.create(slotRef.collection('audit').doc('offered'),{kind:'OFFER',revision:1,at:new Date(),
     actorPlayerId:input.actor.playerId,sourceAuthority:proposed.sourceAuthority,offerDigest:opRevision});
   return {created:true,slot};
 });
 if(!plan.created)return {offered:false,reason:'BATTLE_SLOT_ALREADY_CONSUMED'};
 return {offered:true,invitation:visibility(plan.slot,
   savedSources.find(s=>s.source.gameId===plan.slot.selected.gameId)?.game??null)};
}

/** Ordinary respondent operations, never direct Firestore client writes.
 * requestId is the immutable document key; exact retries do not append again.
 * Separate binding judgments are private until independently qualified.
 */
export async function actOnMyChronicleInvitation(input:Input,r:Bag){
 const mode=chronicleInteractionMode(input.env);
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
 let current:Awaited<ReturnType<typeof cohort>>|null=null;
 let hostedGuard:Awaited<ReturnType<typeof captureHostedHistoryGuard>>|null=null;
 if(r.action!=='REFRESH'||mode==='hosted'){
   current=await cohort(input,mode);
   selectedItem=current.items.find(x=>x.battleId===r.battleId);
   if(r.action!=='REFRESH'&&(!selectedItem||!selectedItem.battle.evidenceComplete||
     !selectedItem.battle.chronologyQualified))throw stale();
   if(selectedItem&&selectedItem.battle.evidenceComplete&&selectedItem.battle.chronologyQualified){
     verifiedSources=await Promise.all(selectedItem.sources.map(async s=>({
       source:s.source,game:s.game,
       sourceDoc:(await input.db.doc('matches/'+r.battleId+'/games/'+s.source.gameId+
         '/replaySources/'+s.source.sourceHash).get()).data()
     })));
   }
   if(mode==='hosted'&&selectedItem&&selectedItem.hostedLossRevision){
     hostedGuard=await captureHostedHistoryGuard(input,current);
   }
   await current.collected.revalidate();
 }
 return input.db.runTransaction(async(tx:any)=>{
   await actorInTransaction(tx,input);
   const prior=await tx.get(ref);
   if(!prior.exists)throw new HttpsError('not-found','No invitation was issued for this Battle/respondent.');
   const slot=prior.data();
   if(slot.respondentPlayerId!==input.actor.playerId||slot.battleId!==r.battleId||
      slot.slotId!==invitationSlotId(r.battleId,input.actor.playerId))throw stale();
   if(mode==='hosted'?(slot.testOnly!==false||slot.selected?.deliveryMode!=='hosted'||
     slot.selected?.family!=='SKILL_ACKNOWLEDGMENT'):
     (slot.testOnly===false||slot.selected?.deliveryMode==='hosted'))throw stale();
   if(mode==='hosted'&&current&&
     (slot.selected.policyRevision!==current.hostedPolicy?.revision||
      (r.action!=='REFRESH'&&(!current.hostedEligible||current.hostedPending.length))))
      throw stale();
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
     if(active&&mode==='hosted'){
       active=selectedItem?.hostedLossRevision===slot.selected.hostedLossRevision&&
         !!selectedItem?.candidates.some(c=>c.incidentId===slot.selected.incidentId&&
           c.incidentRevision===slot.selected.incidentRevision&&
           c.sourceAuthority===slot.selected.sourceAuthority)&&
         selectedItem.occurrenceToken===slot.selected.occurrenceToken;
       if(active&&hostedGuard)await verifyHostedHistoryGuard(tx,hostedGuard);
       else active=false;
     }else if(active){
       const match=m.data(),event=await tx.get(input.db.doc('events/'+match.eventId));
       const planId=event.data()?.approvedMatchPlanId;
       const plan=typeof planId==='string'&&planId?
         await tx.get(input.db.doc('events/'+match.eventId+'/matchPlans/'+planId)):null;
       const games=await tx.get(mr.collection('games').orderBy('__name__').limit(65));
       active=sameApprovedSchedule(r.battleId,match,event.data()??null,plan?.data()??null,
         planId??null,games.docs.map((g:any)=>({gameId:g.id,game:g.data()})),slot.selected.scheduleRevisions);
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
   if(mode==='hosted'){
     if(!hostedGuard||selectedItem?.hostedLossRevision!==slot.selected.hostedLossRevision||
        selectedItem?.occurrenceToken!==slot.selected.occurrenceToken||
        !selectedItem?.candidates.some(c=>c.incidentId===slot.selected.incidentId&&
          c.incidentRevision===slot.selected.incidentRevision&&
          c.sourceAuthority===slot.selected.sourceAuthority))throw stale();
     await verifyHostedHistoryGuard(tx,hostedGuard);
   }
   await verifyCurrent(tx,input,{battleId:r.battleId,
     scheduleRevisions:slot.selected.scheduleRevisions,hosted:mode==='hosted',
     occurrenceToken:slot.selected.occurrenceToken},verifiedSources);
   const reviewed=await tx.get(input.db.doc('matches/'+r.battleId+
     '/chronicleRareReviewedMoments/'+slot.selected.incidentId));
   if(!reviewedChronicleMomentCurrent(mode,reviewed.data(),slot.selected,current?.hostedPolicy))throw stale();
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
 const mode=chronicleInteractionMode(input.env);requireFields(r,[]);
 const hostedCurrent=mode==='hosted'?await cohort(input,mode):null;
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
   // Demo-only slots never leak into the hosted feature, or vice versa.
   if(mode==='hosted'?(data.testOnly!==false||data.selected?.deliveryMode!=='hosted'||
      data.selected.family!=='SKILL_ACKNOWLEDGMENT'):(data.testOnly===false||data.selected?.deliveryMode==='hosted'))continue;
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
   if(current&&mode==='hosted'){
     const battle=hostedCurrent?.items.find(x=>x.battleId===m.id);
     current=!!hostedCurrent?.hostedEligible&&!hostedCurrent.hostedPending.length&&
       !!battle&&!!battle.battle.chronologyQualified&&battle.battle.evidenceComplete&&
       battle.hostedLossRevision===data.selected.hostedLossRevision&&
       battle.occurrenceToken===data.selected.occurrenceToken&&
       hostedCurrent?.hostedPolicy?.revision===data.selected.policyRevision&&
       battle.candidates.some(c=>c.incidentId===data.selected.incidentId&&
         c.incidentRevision===data.selected.incidentRevision&&
         c.sourceAuthority===data.selected.sourceAuthority);
   }else if(current){
     const match=m.data(),event=await input.db.doc('events/'+match.eventId).get();
     const planId=event.data()?.approvedMatchPlanId;
     const plan=typeof planId==='string'&&planId?
       await input.db.doc('events/'+match.eventId+'/matchPlans/'+planId).get():null;
     const games=await m.ref.collection('games').orderBy('__name__').limit(65).get();
     current=sameApprovedSchedule(m.id,match,event.data()??null,plan?.data()??null,
       planId??null,games.docs.map((g:any)=>({gameId:g.id,game:g.data()})),data.selected.scheduleRevisions);
   }
    invitations.push({...visibility(data,current?game.data():null),sourceCurrent:!!current});
 }
 return {version:CHRONICLE_INTERACTION_VERSION,visibility:'OWNER_ONLY',
   ownerPlayerId:input.actor.playerId,invitations,officialEffects:[],
   narratorAuthority:'FACTUAL_SOURCE_ONLY',testOnly:mode==='emulator'};
}

export async function readMyChronicleSubmission(input:Input,r:Bag){
 const mode=chronicleInteractionMode(input.env);requireFields(r,['battleId']);
 if(!id(r.battleId))throw invalid();
 const [p,l,s]=await Promise.all([input.db.doc('players/'+input.actor.playerId).get(),
   input.db.doc('authLinks/'+input.actor.authUid).get(),
   input.db.doc(slotPath(r.battleId,input.actor.playerId)).get()]);
 if(p.data()?.membershipStatus!=='ACTIVE'||l.data()?.playerId!==input.actor.playerId)
   throw new HttpsError('permission-denied','Active author required.');
 if(!s.exists)throw new HttpsError('not-found','No private submission for this respondent.');
 const slot=s.data();
 if(slot?.respondentPlayerId!==input.actor.playerId)throw new HttpsError('permission-denied','Submission is not yours.');
 if(mode==='hosted'?(slot.testOnly!==false||slot.selected?.deliveryMode!=='hosted'||
     slot.selected.family!=='SKILL_ACKNOWLEDGMENT'):(slot.testOnly===false||slot.selected?.deliveryMode==='hosted'))throw stale();
 const v=slot.judgment?.version;
 const judgment=v?await s.ref.collection('judgments').doc('v'+v).get():null;
 return {authorPlayerId:input.actor.playerId,battleId:r.battleId,privateSubmission:
   judgment?.data()??null,correctionState:slot.correction?.state??null,
   publication:'NONE_PENDING_INDEPENDENT_QUALIFICATION',speakerNotNarrator:true};
}

/** Impartial admin correction review only; author cannot approve their own
 * judgment. No choice is changed in this function and the audit is append-only. */
export async function reviewChronicleCorrection(input:Input,r:Bag){
 const mode=chronicleInteractionMode(input.env);
 requireFields(r,['battleId','respondentPlayerId','requestId','expectedRevision','decision','reason']);
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
   if(mode==='hosted'?(slot.testOnly!==false||slot.selected?.deliveryMode!=='hosted'||
     slot.selected.family!=='SKILL_ACKNOWLEDGMENT'):(slot.testOnly===false||slot.selected?.deliveryMode==='hosted'))throw stale();
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
