/** Hosted, owner-private Chronicle V1: ONLY a source-current first third Battle loss.
 * This is not an award, subjective scorer, result authority or policy approver.
 * Absence of exact owner-pinned policy/rarity review yields no admissible method.
 */
import {bindingDigest} from '../engines/nativeRecordingIntegration.js';
import {canonicalOccurrenceGames,compareOccurrence,occurrenceSourceBinding,
  qualifyThreeBattleLosses,verifiedOccurrence,battleOccurrenceEvidenceEnabled,type OccurrenceBattle} from '../integration/battleOccurrence.js';
import type {ApprovedRareSelectionPolicy,ReviewedTurningPoint} from './chronicleRareSelector.js';

export const HOSTED_SKILL_METHOD='official-third-loss-skill-v1' as const;
export const HOSTED_SKILL_POLICY_VERSION='AOF_CHRONICLE_PRIVATE_SKILL_V1' as const;
export const HOSTED_SKILL_PROJECT='age-of-friends-staging-eu' as const;
type Bag=Record<string,any>;
const validId=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,200}$/.test(v);
const sha=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const same=(a:unknown,b:unknown)=>bindingDigest(a)===bindingDigest(b);
export type SkillLossProof=ReturnType<typeof qualifyThreeBattleLosses>[number];
export type HostedSkillPolicy={method:typeof HOSTED_SKILL_METHOD;approvalRef:string;
  revision:string;selection:ApprovedRareSelectionPolicy};

/** A client, accidental emulator, wrong cloud project or absent flag cannot
 * select the hosted path, even when emulator V1E remains deliberately enabled.
 * An explicit policy SHA is separately required by readHostedSkillPolicy.
 */
export function hostedSkillEnvironment(env:NodeJS.ProcessEnv):boolean{
 const project=env.GCLOUD_PROJECT||env.GOOGLE_CLOUD_PROJECT;
 return battleOccurrenceEvidenceEnabled(env)&&
   env.AOF_CHRONICLE_PRIVATE_INTERACTIONS==='source-v1'&&
   project===HOSTED_SKILL_PROJECT&&
   (!env.GCLOUD_PROJECT||env.GCLOUD_PROJECT===project)&&
   (!env.GOOGLE_CLOUD_PROJECT||env.GOOGLE_CLOUD_PROJECT===project)&&
   env.FUNCTION_REGION==='europe-west1'&&env.FUNCTIONS_EMULATOR!=='true'&&
   !env.FIRESTORE_EMULATOR_HOST&&!env.FIREBASE_AUTH_EMULATOR_HOST&&
   !env.FIREBASE_STORAGE_EMULATOR_HOST;
}
/** This immutable runtime-policy document is owner-approved and SHA-pinned by
 * separately authorized environment configuration, never by a callable body.
 * No qualifying document is provisioned by this source change.
 */
export function readHostedSkillPolicy(env:NodeJS.ProcessEnv,raw:unknown):HostedSkillPolicy|null{
 if(!hostedSkillEnvironment(env)||!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const p=raw as Bag;
 if(!sha(env.AOF_CHRONICLE_PRIVATE_POLICY_SHA256)||
   bindingDigest(raw)!==env.AOF_CHRONICLE_PRIVATE_POLICY_SHA256||
   p.version!==HOSTED_SKILL_POLICY_VERSION||p.projectId!==HOSTED_SKILL_PROJECT||
   p.region!=='europe-west1'||p.status!=='APPROVED'||p.ownerApproved!==true||
   !validId(p.approvalRef)||p.method!==HOSTED_SKILL_METHOD||
   !same(p.families,['SKILL_ACKNOWLEDGMENT'])||
   p.rarity!=='REVIEWED_TURNING_POINT'||p.publicTestimony!==false||
   p.relationshipEffects!==false||p.officialWrites!==false||
   p.automaticOffers!==false)return null;
 return {method:HOSTED_SKILL_METHOD,approvalRef:p.approvalRef,
   revision:bindingDigest(raw),selection:{
     approved:true,approvalRef:p.approvalRef,
     qualifiedMethods:[HOSTED_SKILL_METHOD],familyOrder:['SKILL_ACKNOWLEDGMENT'],
     fatiguedPlayerIds:[],blockedPairKeys:[]
   }};
}
/** Fail closed if any involved human Battle has unproved actual chronology,
 * even when its upload and approved schedule happen to sort consistently.
 * Used for first-anchor and for the three eligible-Battle cooldown.
 */
export function currentSeasonChronicleBattles(battles:readonly OccurrenceBattle[],seasonId:string):OccurrenceBattle[]{
 return validId(seasonId)?battles.filter(b=>b.match?.seasonId===seasonId):[];
}
/** Order only reviewed eligible anchors. Unrelated unresolved later Battles
 * cannot veto a proved prefix; Worker 4 still provides the full proof graph. */
export function orderedHostedSkillBattles(battles:readonly OccurrenceBattle[],respondent:string,
 eligibleBattleIds?:readonly string[]):string[]|null{
 const own=battles.filter(b=>b.match?.status==='COMPLETED'&&
   b.match?.participants?.some((p:Bag)=>p.playerId===respondent)&&
   b.match?.opponentKind!=='AI'&&!b.match?.replacementMatchId);
 const relevant=eligibleBattleIds===undefined?own:
   own.filter(b=>eligibleBattleIds.includes(b.battleId));
 if(eligibleBattleIds!==undefined&&(!eligibleBattleIds.every(validId)||
    new Set(eligibleBattleIds).size!==eligibleBattleIds.length||
    relevant.length!==eligibleBattleIds.length))return null;
 if(relevant.length>256||new Set(relevant.map(b=>b.battleId)).size!==relevant.length)return null;
 if(relevant.some(b=>!canonicalOccurrenceGames(b)||!verifiedOccurrence(b)))return null;
 for(let i=0;i<relevant.length;i++)for(let j=i+1;j<relevant.length;j++){
   const c=compareOccurrence(relevant[i].battleId,relevant[j].battleId,[...battles]);
   if(c!=='BEFORE'&&c!=='AFTER')return null;
 }
 const ordered=[...relevant].sort((a,b)=>{
   const c=compareOccurrence(a.battleId,b.battleId,[...battles]);
   return c==='BEFORE'?-1:c==='AFTER'?1:0;
 });
 return ordered.map(b=>b.battleId);
}
/** Human rarity review is NOT the official-loss witness. Reconstruct every
 * qualification field from Worker 4's canonical source/result/occurrence proof.
 * Rarity review can admit meaning only for that exact first-third anchor/revision.
 */
export function qualifiedHostedSkillMoment(input:{
  battle:OccurrenceBattle;proof:SkillLossProof;review:unknown;
  reviewDocId:string;policy:HostedSkillPolicy;respondent:string;sourceAuthority:string;
}):ReviewedTurningPoint|null{
 const {battle,proof,review,reviewDocId,policy,respondent,sourceAuthority}=input;
 if(!review||typeof review!=='object'||Array.isArray(review))return null;
 const r=review as Bag,needed=canonicalOccurrenceGames(battle),binding=occurrenceSourceBinding(battle);
 if(!needed?.length||!binding||!verifiedOccurrence(battle)||
   proof.qualification!=='THIRD_LOSS_SOURCE_QUALIFIED'||
   proof.anchorBattleId!==battle.battleId||proof.respondentPlayerId!==respondent||
   proof.witnessBattleIds.length!==3||new Set(proof.witnessBattleIds).size!==3||
   !validId(proof.opponentPlayerId)||!sha(proof.revision)||
   !sha(sourceAuthority)||!validId(reviewDocId)||r.incidentId!==reviewDocId||
   r.battleId!==battle.battleId||r.respondentPlayerId!==respondent||
   r.counterpartPlayerId!==proof.opponentPlayerId||
   r.family!=='SKILL_ACKNOWLEDGMENT'||
   r.qualifierMethod!==HOSTED_SKILL_METHOD||
   r.qualification!=='ADMITTED'||r.significance!=='REVIEWED_TURNING_POINT'||
   r.methodReview!=='OWNER_REVIEWED_RARITY'||
   r.reviewedSource!=='THIRD_OFFICIAL_BATTLE_LOSS'||
   r.approvalRef!==policy.approvalRef||
   r.lossRevision!==proof.revision||r.anchorSourceBinding!==binding||
   !validId(r.reviewedBy)||r.reviewedBy===respondent||
   typeof r.rarityReason!=='string'||r.rarityReason.trim().length<24||
   !same(r.witnessBattleIds,proof.witnessBattleIds))return null;
 const anchor=needed[0];
 if(!sha(anchor.source?.sourceHash))return null;
 return {
   battleId:battle.battleId,gameId:anchor.gameId,
   sourceAuthority,
   incidentId:reviewDocId,
   incidentRevision:bindingDigest([policy.revision,proof.revision,r]),
   respondentPlayerId:respondent,counterpartPlayerId:proof.opponentPlayerId,
   family:'SKILL_ACKNOWLEDGMENT',qualifierMethod:HOSTED_SKILL_METHOD,
   qualification:'ADMITTED',significance:'REVIEWED_TURNING_POINT',
   sourceEvidenceRefs:[...proof.witnessBattleIds],
   historicalContext:{historyComplete:true,
     priorBattleIds:proof.witnessBattleIds.slice(0,2),
     sourceEvidenceRefs:[...proof.witnessBattleIds]},
   independentEpisodeKey:reviewDocId,
   thirdLoss:{historyComplete:true,anchorBattleId:battle.battleId,
     priorLossBattleIds:proof.witnessBattleIds.slice(0,2)}
 };
}
