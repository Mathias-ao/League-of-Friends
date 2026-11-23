import {HttpsError} from 'firebase-functions/v2/https';
import {bindingDigest} from '../nativeRecordingIntegration.js';
import {admitPersonalityContext,type ContextSourceInput,type ReviewedContextProof} from './contextAdmission.js';
import {personalityComparisonGroup,type PersonalityCalibration,type GameContext,type PersonalityAxis} from './personalityV1.js';
import type {PolicyRef} from '../../domain/socialV1.js';
import {PRACTICAL_POLICY as SPEC,PRACTICAL_POLICY_SHA256} from './practicalPolicyResource.js';

const SHA=/^[a-f0-9]{64}$/;
const text=(v:unknown):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=500;
const exact=(c:GameContext)=>[c.format,c.mapFamily,c.startFamily,c.mapId,c.durationFamily,c.civilizationOpportunityKey].map(x=>x??'UNKNOWN').join('|');
export const PRACTICAL_RUNTIME_PATH='privatePilotApprovals/AOF_PERSONALITY_V1_PRACTICAL_SOURCE_PROXIES_1';
/** Separately inspected CURRENT immutable artifact + source binding. This is
 * server-only runtime evidence, not client assertions or a bare build allowlist.
 * Missing reviewed opportunities keep the individual axis Developing. */
export type PracticalSourceReview={
  sourceFingerprint:string;referenceId:string;gameBuild:number;
  completeInterval:boolean;
  costCatalog?:{product:'AOE2_DE';version:string;sha256:string;referenceId:string;gameBuild:number};
  spatial?:ReviewedContextProof;
  strategicBuildings?:{gameBuild:number;ids:number[];referenceId:string;catalogSha256:string;catalogVersion:string;product:'AOE2_DE'};
  commandAttribution?:{referenceId:string;version:'AOF_RAID_V3_ENGAGEMENT_V4_ATTRIBUTION_1'};
  militaryFamilies?:{opportunityKey:string;families:string[];referenceId:string};
  expansionSites?:{referenceId:string;version:'AOF_MAP_PRESENCE_V8_DISTINCT_SITES_1';catalogSha256:string;catalogVersion:string;product:'AOE2_DE'};
};
export type PracticalSourceReviews=Readonly<Record<string,PracticalSourceReview>>;
const approvals=new WeakMap<PersonalityCalibration,PolicyRef>();
/** An APPROVED string on an arbitrary calibration cannot authorize the adapter. */
export const practicalPolicyApproval=(calibration:PersonalityCalibration|null):PolicyRef|null=>
  calibration?approvals.get(calibration)??null:null;
export const practicalSourceFingerprint=(input:ContextSourceInput)=>bindingDigest(input.source);

/** Existing evaluator configuration, not a second scorer. References are
 * separately reviewed exact-source evidence under the later D release. */
export function createPracticalPersonalityPolicy(owner:string,sources:readonly ContextSourceInput[],reviews:PracticalSourceReviews){
  const contexts=new Map<string,GameContext>();
  const quality:NonNullable<PersonalityCalibration['practical']>['sources']={};
  const anchors:PersonalityCalibration['anchors']={};
  for(const input of sources){
    const review=reviews[input.source.sourceHash];
    const matched=!!review&&review.sourceFingerprint===practicalSourceFingerprint(input)&&text(review.referenceId)&&
      Number.isSafeInteger(review.gameBuild)&&review.gameBuild>0;
    const base=admitPersonalityContext(input,owner,null);
    const admission=matched?admitPersonalityContext(input,owner,review.spatial??null):base;
    const c=admission.behaviorContext??base.behaviorContext;
    if(!c)continue;
    contexts.set(input.source.authorityRevision,c);
    const build=base.verifiedGameBuild;
    const sourceBound=matched&&build===review.gameBuild&&c.format==='ONE_V_ONE'&&review.completeInterval===true;
    const spatial=sourceBound&&c.mapFamily==='LAND'&&c.startFamily==='STANDARD'&&!!review.spatial&&
      admission.fields.mapFamily.status==='REVIEWED_CLASSIFICATION'&&admission.fields.startFamily.status==='REVIEWED_CLASSIFICATION';
    const catalog=sourceBound&&review.costCatalog?.product==='AOE2_DE'&&review.costCatalog.gameBuild===build&&
      text(review.costCatalog.version)&&review.costCatalog.version===input.statistics.entityCatalogVersion&&SHA.test(review.costCatalog.sha256)&&text(review.costCatalog.referenceId);
    const strategic=spatial&&review.strategicBuildings?.product==='AOE2_DE'&&SHA.test(review.strategicBuildings.catalogSha256)&&
      text(review.strategicBuildings.catalogVersion)&&review.strategicBuildings.catalogVersion===input.statistics.entityCatalogVersion&&review.strategicBuildings.gameBuild===build&&text(review.strategicBuildings.referenceId)&&
      Array.isArray(review.strategicBuildings.ids)&&review.strategicBuildings.ids.length>0&&
      review.strategicBuildings.ids.every(id=>Number.isSafeInteger(id)&&id>0)&&
      new Set(review.strategicBuildings.ids).size===review.strategicBuildings.ids.length;
    const family=spatial&&review.militaryFamilies?.opportunityKey===c.civilizationOpportunityKey&&
      text(review.militaryFamilies.referenceId)&&Array.isArray(review.militaryFamilies.families)&&
      review.militaryFamilies.families.length>=2&&review.militaryFamilies.families.every(text)&&
      new Set(review.militaryFamilies.families).size===review.militaryFamilies.families.length;
    const command=spatial&&review.commandAttribution?.version==='AOF_RAID_V3_ENGAGEMENT_V4_ATTRIBUTION_1'&&text(review.commandAttribution.referenceId);
    const expansion=spatial&&review.expansionSites?.product==='AOE2_DE'&&SHA.test(review.expansionSites.catalogSha256)&&
      text(review.expansionSites.catalogVersion)&&review.expansionSites.catalogVersion===input.statistics.entityCatalogVersion&&review.expansionSites.version==='AOF_MAP_PRESENCE_V8_DISTINCT_SITES_1'&&text(review.expansionSites.referenceId);
    quality[input.source.authorityRevision]={sourceHash:input.source.sourceHash,mappingDigest:input.source.mappingDigest,
      sourceBound,replaySlots:input.source.roster.map(p=>p.replaySlot),sourceReason:!matched?'CURRENT_SOURCE_REVIEW_UNAVAILABLE':build!==review.gameBuild?'EXACT_SOURCE_BUILD_UNVERIFIED':
        c.format!=='ONE_V_ONE'?'UNSUPPORTED_PERSONALITY_CONTEXT':!review.completeInterval?'COMPLETE_SOURCE_INTERVAL_UNVERIFIED':null,costCatalogVerified:!!catalog,spatialQualified:!!spatial,
      strategicBuildingIds:strategic?[...review.strategicBuildings!.ids]:[],
      militaryFamilies:family?[...review.militaryFamilies!.families]:[],
      commandAttributionVerified:!!command,expansionSitesVerified:!!expansion};
    // Natural anchors only. An anchor never substitutes for source opportunity;
    // each required Game independently passes the evaluator's quality checks.
    if(c.format==='ONE_V_ONE')anchors[exact(c)]=Object.fromEntries(Object.keys(SPEC.axes).map(axis=>[axis,
      {lower:0,upper:1,comparisonGroup:personalityComparisonGroup(c,axis as PersonalityAxis)}]));
  }
  const calibration:PersonalityCalibration={configurationVersion:SPEC.configurationVersion,status:'APPROVED',
    minimumIndependentBattles:2,recentBattleCount:3,careerWeight:.75,aggregationMethod:'MEDIAN',
    strategicBuildingIds:[],availableMilitaryFamilies:{},anchors,minimumIndependentCommandEpisodes:2,
    practical:{policySha256:PRACTICAL_POLICY_SHA256,sources:quality,minimumStrategicPlacements:4,minimumExpansionUnits:6}};
  const policy:PolicyRef={policyVersion:SPEC.policyVersion,configurationVersion:SPEC.configurationVersion,
    status:'APPROVED',approvalRef:SPEC.approvalRef};
  const freeze=(v:any):void=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}};
  freeze(calibration);approvals.set(calibration,Object.freeze(policy));
  return {calibration,context:(input:ContextSourceInput)=>contexts.get(input.source.authorityRevision)??null};
}

/** Fixed read-only resolver. This code provisions nothing. Policy approval is
 * real, but disabled/missing runtime D authorization never enables numbers. */
export async function loadPracticalPersonalityRuntime(db:any,env:NodeJS.ProcessEnv){
  if(env.AOF_PERSONALITY_PRIVATE_POLICY!=='practical-v1')return null;
  const projects=[env.GCLOUD_PROJECT,env.GOOGLE_CLOUD_PROJECT].filter(Boolean);
  const project=projects[0],emulator=env.FUNCTIONS_EMULATOR==='true'&&/^demo-[a-z0-9-]+$/.test(project??'');
  const unavailable=()=>new HttpsError('failed-precondition','Private Personality runtime authorization is unavailable.');
  if(!project||projects.some(p=>p!==project)||(!emulator&&project!=='age-of-friends-staging'))throw unavailable();
  const ref=db.doc(PRACTICAL_RUNTIME_PATH),snapshot=await ref.get(),record=snapshot.data();
  const expected={version:'AOF_PERSONALITY_PRIVATE_RUNTIME_1',status:'APPROVED',project,
    policyVersion:SPEC.policyVersion,configurationVersion:SPEC.configurationVersion,
    policySha256:PRACTICAL_POLICY_SHA256,policyApprovalRef:SPEC.approvalRef,
    visibility:'OWNER_ONLY',publicPublicationAllowed:false,officialWritesAllowed:false};
  const keys=[...Object.keys(expected),'runtimeApprovalRef','revision','sourceReviews'];
  if(!record||Object.keys(record).length!==keys.length||keys.some(k=>!Object.hasOwn(record,k))||
    Object.entries(expected).some(([k,v])=>bindingDigest(record[k])!==bindingDigest(v))||
    !Number.isSafeInteger(record.revision)||record.revision<1||!text(record.runtimeApprovalRef)||
    record.runtimeApprovalRef===SPEC.approvalRef||/(?:PLACEHOLDER|PENDING|TODO|CODE[_ -]?ONLY)/i.test(record.runtimeApprovalRef)||
    !record.sourceReviews||Array.isArray(record.sourceReviews)||typeof record.sourceReviews!=='object'||
    Object.keys(record.sourceReviews).length>64||Object.keys(record.sourceReviews).some(k=>!SHA.test(k)))throw unavailable();
  const token=(s:any)=>bindingDigest([s.data()??null,s.updateTime??null]),revision=token(snapshot);
  return {sourceReviews:record.sourceReviews as PracticalSourceReviews,revision,
    revalidate:async(tx:any)=>{if(token(await tx.get(ref))!==revision)
      throw new HttpsError('aborted','Private Personality runtime approval changed. Refresh.');}};
}
