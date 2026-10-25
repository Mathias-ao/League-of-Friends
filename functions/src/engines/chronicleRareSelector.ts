/** #156 — pure, OFF-by-default rare Chronicle selection proposal.
 *
 * Input objects MUST be server-built after authentication, current READY
 * source/roster/GUID/eligibility checks and an independently reviewed method.
 * This module does not perform those checks, issue invitations, save slots,
 * expose candidates to players, bind testimony, or calculate social credit.
 *
 * No launch threshold, family weight, significance ranking or cooldown value
 * is approved here. Without an explicitly approved trusted policy and reviewed
 * source methods, the result is always empty.
 */
import {invitationSlotId,type JudgmentFamily,type InvitationSlot} from '../domain/socialV1.js';

export const RARE_CHRONICLE_SELECTOR='AOF_RARE_CHRONICLE_SELECTOR_PROPOSAL_1';
export const RARE_CHRONICLE_FAMILIES=[
  'ASSISTANCE','SITUATED_GRIEVANCE','SKILL_ACKNOWLEDGMENT','TREACHERY_VICTIM'
] as const satisfies readonly JudgmentFamily[];
export const STRICT_TREACHERY_GATES=[
  'MUTUAL_EFFECTIVE_ALLIANCE',
  'ORDERED_UNILATERAL_RUPTURE',
  'SUBSEQUENT_HOSTILE_PARTICIPATION',
  'QUALIFIED_KING_LOSS',
  'RESPONSIBLE_FORMER_ALLY',
  'INCIDENT_IDENTITY_AND_CHRONOLOGY'
] as const;

type Id=string;
type Digest=string;
type EvidenceGate=typeof STRICT_TREACHERY_GATES[number];
const isId=(x:unknown):x is string=>typeof x==='string'&&x.length>0&&x.length<=200&&!x.includes('/');
const isDigest=(x:unknown):x is string=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);

/** Trusted current-source/league-roster admission; not a client request DTO. */
export interface CurrentChronicleBattle{
  battleId:Id;
  playerIds:Id[];
  /** Each current eligible Game only, one per Game; duplicate POVs must be settled by the collector. */
  currentGames:ReadonlyArray<{gameId:Id;sourceAuthority:Digest}>;
  evidenceComplete:boolean;
  chronologyQualified:boolean;
}
/** Reviewed context admission, never a raw raid/defence/score count. */
export interface ReviewedTurningPoint {
  battleId:Id;gameId:Id;sourceAuthority:Digest;
  incidentId:Id;incidentRevision:Digest;
  respondentPlayerId:Id;counterpartPlayerId:Id;
  family:JudgmentFamily;
  qualifierMethod:Id;
  /** An independently admitted source-method decision; neither CANDIDATE nor LIMITED qualifies. */
  qualification:'ADMITTED'|'LIMITED'|'PENDING'|'REJECTED';
  /** Separately reviewed personally meaningful context, not raw grade intensity. */
  significance:'EXCEPTIONAL'|'REVIEWED_TURNING_POINT'|'ROUTINE'|'UNKNOWN';
  sourceEvidenceRefs:ReadonlyArray<Id>;
  /** Verified original incident grouping used to deduplicate correlated signals and POVs. */
  independentEpisodeKey:Id;
  /** Only independently source-qualified executed substantive help, never a support order alone. */
  substantiveAssistanceVerified?:boolean;
  /** Source qualified exceptional directed conduct/context, not ordinary raids or normal war. */
  situatedConductVerified?:boolean;
  /** Verified complete pair history through this third loss, across distinct Battles. */
  thirdLoss?:{historyComplete:boolean;anchorBattleId:Id;
    priorLossBattleIds:ReadonlyArray<Id>};
  /** Reviewed independently proven strict original victim-source gate references. */
  treachery?:{victimPlayerId:Id;responsiblePlayerId:Id;
    prerequisiteRefs:Partial<Record<EvidenceGate,ReadonlyArray<Id>>>};
}
export interface ApprovedRareSelectionPolicy{
  /** Trusted owner approval registry only, never caller-supplied or issue text. */
  approved:boolean;
  approvalRef:Id|null;
  /** Method IDs are approved AFTER concrete source review; empty in current production. */
  qualifiedMethods:ReadonlyArray<Id>;
  /** Owner-authorized preference order; an empty order means no invitation. */
  familyOrder:ReadonlyArray<JudgmentFamily>;
  /** Caller calculates from approved fatigue/cooldown history; no numeric rule here. */
  fatiguedPlayerIds:ReadonlyArray<Id>;
  blockedPairKeys:ReadonlyArray<Id>;
}
export type ProposedRareSelection={
  status:'PRIVATE_PROPOSAL_ONLY';
  version:typeof RARE_CHRONICLE_SELECTOR;
  battleId:Id;slotId:Digest;respondentPlayerId:Id;counterpartPlayerId:Id;
  incidentId:Id;incidentRevision:Digest;sourceAuthority:Digest;
  gameId:Id;qualifierMethod:Id;family:JudgmentFamily;independentEpisodeKey:Id;
};

const pairKey=(a:string,b:string)=>JSON.stringify([a,b].sort());
const arrUnique=(xs:readonly string[])=>xs.length===new Set(xs).size;
const validRefs=(v:ReadonlyArray<string>)=>Array.isArray(v)&&v.length>0&&v.every(isId)&&arrUnique(v);

function qualified(c:ReviewedTurningPoint,b:CurrentChronicleBattle,policy:ApprovedRareSelectionPolicy,
  games:Map<string,string>,players:Set<string>):boolean{
  if(c.battleId!==b.battleId||!isId(c.gameId)||games.get(c.gameId)!==c.sourceAuthority||
     !isDigest(c.sourceAuthority)||!isId(c.respondentPlayerId)||!isId(c.counterpartPlayerId)||
     c.respondentPlayerId===c.counterpartPlayerId||
     !players.has(c.respondentPlayerId)||!players.has(c.counterpartPlayerId)||
     !isId(c.incidentId)||!isDigest(c.incidentRevision)||!isId(c.independentEpisodeKey)||
     !isId(c.qualifierMethod)||!policy.qualifiedMethods.includes(c.qualifierMethod)||
     !RARE_CHRONICLE_FAMILIES.includes(c.family)||!policy.familyOrder.includes(c.family)||
     c.qualification!=='ADMITTED'||!validRefs(c.sourceEvidenceRefs)||
     !['EXCEPTIONAL','REVIEWED_TURNING_POINT'].includes(c.significance))return false;
  if(c.family==='ASSISTANCE')return c.substantiveAssistanceVerified===true;
  if(c.family==='SITUATED_GRIEVANCE')return c.situatedConductVerified===true;
  if(c.family==='SKILL_ACKNOWLEDGMENT'){
    const p=c.thirdLoss;
    return !!p&&p.historyComplete===true&&p.anchorBattleId===b.battleId&&
      Array.isArray(p.priorLossBattleIds)&&p.priorLossBattleIds.length===2&&
      p.priorLossBattleIds.every(isId)&&
      new Set([...p.priorLossBattleIds,b.battleId]).size===3;
  }
  if(c.family==='TREACHERY_VICTIM'){
    const proof=c.treachery;
    return !!proof&&proof.victimPlayerId===c.respondentPlayerId&&
      proof.responsiblePlayerId===c.counterpartPlayerId&&
      STRICT_TREACHERY_GATES.every(k=>validRefs(proof.prerequisiteRefs[k]??[]));
  }
  return false;
}

/** Return *proposals for human/policy review only*. Never offer/submit.
 * Same respondent/Battle always gets at most one. A preexisting slot, including
 * declined/withdrawn, consumes that Battle forever. Correlated facts are not
 * separate evidence opportunities. Routine 1v1 has no exceptional methods.
 */
export function selectRareChronicleProposals({
 battle,candidates,policy,existingSlots=[]
}:{
 battle:CurrentChronicleBattle;
 candidates:ReadonlyArray<ReviewedTurningPoint>;
 policy:ApprovedRareSelectionPolicy|null;
 existingSlots:ReadonlyArray<InvitationSlot>;
}):ProposedRareSelection[]{
 if(!policy?.approved||!isId(policy.approvalRef)||!policy.qualifiedMethods.length||
    !policy.familyOrder.length)return [];
 if(!isId(battle.battleId)||!battle.evidenceComplete||!battle.chronologyQualified||
    !Array.isArray(battle.playerIds)||!battle.playerIds.every(isId)||
    !arrUnique(battle.playerIds)||!Array.isArray(battle.currentGames)||
    !battle.currentGames.length||battle.currentGames.some(g=>!isId(g.gameId)||!isDigest(g.sourceAuthority))||
    !arrUnique(battle.currentGames.map(g=>g.gameId))||
    !arrUnique(policy.familyOrder)||
    policy.familyOrder.some(f=>!RARE_CHRONICLE_FAMILIES.includes(f))||
    !arrUnique(policy.qualifiedMethods))return [];
 const players=new Set(battle.playerIds),games=new Map(battle.currentGames.map(g=>[g.gameId,g.sourceAuthority]));
 const consumed=new Set<string>();
 for(const slot of existingSlots){
   if(slot.battleId===battle.battleId){
     if(slot.slotId!==invitationSlotId(battle.battleId,slot.respondentPlayerId))return [];
     consumed.add(slot.respondentPlayerId);
   }
 }
 const fatigue=new Set(policy.fatiguedPlayerIds),blockedPairs=new Set(policy.blockedPairKeys);
 const rank=(c:ReviewedTurningPoint)=>policy.familyOrder.indexOf(c.family);
 const eligible=candidates.filter(c=>qualified(c,battle,policy,games,players)&&
   !consumed.has(c.respondentPlayerId)&&!fatigue.has(c.respondentPlayerId)&&
   !blockedPairs.has(pairKey(c.respondentPlayerId,c.counterpartPlayerId)));
 // Stable rank independent of Game/upload/POV input order; never score recency
 // or infer player emotion from an unapproved numeric intensity.
 // Conflicting POV interpretations of the same independently reviewed
 // episode must pend, not pick an arbitrary first source.
 const conflictingEpisodes=new Set<string>();
 const signatures=new Map<string,string>();
 const episodeKey=(c:ReviewedTurningPoint)=>JSON.stringify([c.respondentPlayerId,c.independentEpisodeKey]);
 for(const c of eligible){
   const key=episodeKey(c);
   const signature=JSON.stringify([c.counterpartPlayerId,c.family,c.incidentId]);
   if(signatures.has(key)&&signatures.get(key)!==signature)conflictingEpisodes.add(key);
   else signatures.set(key,signature);
 }
 eligible.sort((a,b)=>rank(a)-rank(b)||
   (a.significance==='EXCEPTIONAL'?0:1)-(b.significance==='EXCEPTIONAL'?0:1)||
   a.incidentId.localeCompare(b.incidentId)||a.gameId.localeCompare(b.gameId)||
   a.qualifierMethod.localeCompare(b.qualifierMethod)||
   a.counterpartPlayerId.localeCompare(b.counterpartPlayerId));
 const chosen=new Map<string,ReviewedTurningPoint>(),seenEpisode=new Set<string>();
 for(const c of eligible){
   const episode=episodeKey(c);
   if(conflictingEpisodes.has(episode)||seenEpisode.has(episode))continue;
   seenEpisode.add(episode);
   if(!chosen.has(c.respondentPlayerId))chosen.set(c.respondentPlayerId,c);
 }
 return [...chosen.values()].sort((a,b)=>a.respondentPlayerId.localeCompare(b.respondentPlayerId))
   .map(c=>({version:RARE_CHRONICLE_SELECTOR,status:'PRIVATE_PROPOSAL_ONLY',battleId:battle.battleId,
     slotId:invitationSlotId(battle.battleId,c.respondentPlayerId),
     respondentPlayerId:c.respondentPlayerId,counterpartPlayerId:c.counterpartPlayerId,
     incidentId:c.incidentId,incidentRevision:c.incidentRevision,sourceAuthority:c.sourceAuthority,
     gameId:c.gameId,qualifierMethod:c.qualifierMethod,family:c.family,
     independentEpisodeKey:c.independentEpisodeKey}));
}
