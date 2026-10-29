import {admitPersonalityContext, PERSONALITY_CONTEXT_PROOF_VERSION,
  type ContextSourceInput,type ReviewedContextProof} from './contextAdmission.js';
import {PERSONALITY_AXES,personalityComparisonGroup,type GameContext,type PersonalityAxis,
  type PersonalityCalibration} from './personalityV1.js';

/**
 * PERS-V1E #170 — *private* provisional policy. No publication authority:
 * the source-scoped proof registry is server-owned, immutable, versioned and
 * limited to hash-pinned sources whose map/start evidence has been reviewed.
 * Never derive reviewed evidence from the expected map name, decoded numeric
 * map/starting-age ID alone, source-provided display labels or draft civ.
 */
export const PRIVATE_PERSONALITY_E2E_VERSION='AOF_PERSONALITY_PRIVATE_E2E_V3';
export const PRIVATE_PERSONALITY_CONTEXT_REGISTRY_VERSION='AOF_PERSONALITY_SOURCE_REVIEW_V1';
const axes=Object.keys(PERSONALITY_AXES) as PersonalityAxis[];
const identity=(c:GameContext)=>[
  c.format,c.mapFamily,c.startFamily,c.mapId,c.durationFamily,c.civilizationOpportunityKey]
  .map(x=>x??'UNKNOWN').join('|');

/** Strict fixed classification: registry key is the *original recording SHA*,
 * never a bare map ID, patch, generated fixture label or untrusted input. */
export type ReviewedSourceRegistry=Readonly<Record<string,Readonly<ReviewedContextProof>>>;

/**
 * Independently inspected *original* build-185872 TownBell reports from pinned
 * corpus commit 2d04ec6adbe871d156c108a4351448efeb08f4e6:
 * deak = Arabia/map 9, measured water share 0.0016, unmodded source.
 * dobb = Glade/map 188, measured water share 0, unmodded source.
 * Both decode dark-age/resources 0. The actual START is still qualified by
 * our exact-source initial-TC witness in #159; metadata labels alone never
 * establish STANDARD. Map and civilization remain *factual metadata* but do
 * not split comparable STANDARD-start longitudinal Personality samples.
 * These genuine files still need independent eligible Battle authority and
 * measured per-axis opportunity to support a genuine READY score.
 *
 * These are source-specific emulator-only reference assertions, not blanket
 * map ID equivalence for other replays or approved production policy.
 */
export const VERIFIED_PRIVATE_SOURCE_CONTEXTS:ReviewedSourceRegistry=Object.freeze({
  '3f2ee71756017332182620ee9f273e249b3fe6bc61222637df26bb7a84d400ef':Object.freeze({
    version:PERSONALITY_CONTEXT_PROOF_VERSION,status:'REVIEWED_SOURCE_CLASSIFICATION',
    referenceId:'CORPUS_2d04ec6_1v1_t90_deak_MAP_TERRAIN_V1',
    sourceHash:'3f2ee71756017332182620ee9f273e249b3fe6bc61222637df26bb7a84d400ef',
    gameBuild:185872,mapId:9,startingAgeId:0,startingResourcesId:0,
    mapFamily:'LAND',startFamily:'STANDARD',
    durationBucket:{id:'PROPOSED_OBSERVED_30_TO_60_MIN',lowerObservedMs:1800000,
      upperObservedMsExclusive:3600000,meaning:'OBSERVED_RECORDING_INTERVAL_ONLY' as const},
  }),
  'f4122159245f2374ba90989501869b0f0609f2741144d9723feb6cabba631763':Object.freeze({
    version:PERSONALITY_CONTEXT_PROOF_VERSION,status:'REVIEWED_SOURCE_CLASSIFICATION',
    referenceId:'CORPUS_2d04ec6_1v1_t90_dobb_MAP_TERRAIN_V1',
    sourceHash:'f4122159245f2374ba90989501869b0f0609f2741144d9723feb6cabba631763',
    gameBuild:185872,mapId:188,startingAgeId:0,startingResourcesId:0,
    mapFamily:'LAND',startFamily:'STANDARD',
    durationBucket:{id:'PROPOSED_OBSERVED_30_TO_60_MIN',lowerObservedMs:1800000,
      upperObservedMsExclusive:3600000,meaning:'OBSERVED_RECORDING_INTERVAL_ONLY' as const},
  }),
});

/**
 * Exact-patch/civilization military-family opportunity MUST be reviewed
 * separately from observed queue selection. Never synthesize it by looking at
 * the families a given player queued.
 */
export type PrivateTaxonomy={
  sourceProofs:ReviewedSourceRegistry;
  strategicBuildingsByBuild:Readonly<Record<string,readonly number[]>>;
  militaryFamiliesByExactCiv:Readonly<Record<string,readonly string[]>>;
};
/** Provisional but unpopulated opportunity taxonomies; never assume 53 civs
 * share a military-family option. */
export const PRIVATE_SOURCE_TAXONOMY:PrivateTaxonomy=Object.freeze({
  sourceProofs:VERIFIED_PRIVATE_SOURCE_CONTEXTS,
  // Pinned aoe2de-185872-v2 entity catalogue: military-production and
  // fortification BUILD identifiers (not proof of successful construction).
  strategicBuildingsByBuild:Object.freeze({'185872':Object.freeze([12,49,79,82,87,101])}),
  militaryFamiliesByExactCiv:Object.freeze({}),
});

/** Strict non-production gate. No override via client data or request. */
export function privatePersonalityE2EEnabled(env:NodeJS.ProcessEnv):boolean{
  return env.FUNCTIONS_EMULATOR==='true' &&
    /^demo-[a-z0-9-]+$/.test(env.GCLOUD_PROJECT??env.GOOGLE_CLOUD_PROJECT??'') &&
    env.AOF_PERSONALITY_PRIVATE_E2E==='source-proposed-v1';
}
export type ProvisionalPrivatePolicy={
  context:(input:ContextSourceInput)=>GameContext|null;
  calibration:PersonalityCalibration;
  diagnostics:{policy:string;acceptedGameSources:number;rejectedGameSources:number;
    reasons:ReadonlyArray<string>};
};
/** Internal-only testable factory; only the server-owned registry is supplied
 * from the production callable. The authenticated owner identity must come
 * from requireLeaguePlayer(), never the request.
 *
 * A two-Game Battle is NOT counted twice: #137's existing Battle reducer
 * remains sole authority for sufficiency and correction replacement.
 */
export function privatePersonalityPolicy(ownerPlayerId:string,
  sources:ReadonlyArray<ContextSourceInput>,taxonomy:PrivateTaxonomy=PRIVATE_SOURCE_TAXONOMY):ProvisionalPrivatePolicy {
  if(!ownerPlayerId)throw new Error('PERSONALITY_OWNER_NOT_AUTHENTICATED');
  const bySource=new Map<string,GameContext>();
  const measurableBySource=new Map<string,GameContext>();
  const verifiedBuilds=new Map<string,number>();
  const reasons:string[]=[];let rejected=0;
  for(const input of sources){
    const hash=input.source.sourceHash;
    // Do not accept arbitrary proof objects smuggled via statistics or Game;
    // the only candidate comes from an exact source-hash-indexed server registry.
    const candidate=taxonomy.sourceProofs[hash]??null;
    const reviewed=candidate?.version===PERSONALITY_CONTEXT_PROOF_VERSION &&
      candidate.status==='REVIEWED_SOURCE_CLASSIFICATION' && candidate.sourceHash===hash ?
      candidate:null;
    const result=admitPersonalityContext(input,ownerPlayerId,reviewed);
    if(result.behaviorContext)measurableBySource.set(result.provenanceDigest,result.behaviorContext);
    if(result.context)bySource.set(result.provenanceDigest,result.context);
    else {rejected++;reasons.push(...result.missing);}
    // The source's authenticated build is independently verified by the
    // context adapter. Classifying strategic BUILD IDs does not require a
    // player's civilization to be independently decoded.
    if(reviewed&&result.behaviorContext&&reviewed.mapId===Number(result.behaviorContext.mapId)&&
      result.behaviorContext.startFamily&&result.behaviorContext.mapFamily)
      verifiedBuilds.set(result.provenanceDigest,reviewed.gameBuild);
  }
  const getContext=(input:ContextSourceInput):GameContext|null=>{
    const hash=input.source.sourceHash;
    const reviewed=taxonomy.sourceProofs[hash]??null;
    const admitted=admitPersonalityContext(input,ownerPlayerId,
      reviewed?.version===PERSONALITY_CONTEXT_PROOF_VERSION&&reviewed.sourceHash===hash?
      reviewed:null);
    return measurableBySource.has(admitted.provenanceDigest)?admitted.behaviorContext:null;
  };
  const anchors:PersonalityCalibration['anchors']={};
  const availableMilitaryFamilies:Record<string,string[]>={};
  const strategicBuildingIds=new Set<number>();
  for(const [sourceDigest,context] of measurableBySource){
    const reviewedSpatial=!!context.startFamily&&!!context.mapFamily&&!!context.mapId;
    const contextKey=identity(context);
    // Boomer/Aggressor has a genuinely source-verifiable denominator even
    // when exact map/start is unknown. All other comparison anchors require
    // their reviewed start/map opportunity (and axis-local model coverage).
    // These 0..1 bounds remain PROPOSED private E2E, never final league poles.
    anchors[contextKey]=Object.fromEntries(axes.filter(a=>
      a==='BOOMER_AGGRESSOR'||reviewedSpatial).map(a=>[
      a,{lower:0,upper:1,comparisonGroup:personalityComparisonGroup(context,a)}]));
    if(!reviewedSpatial)continue;
    const build=verifiedBuilds.get(sourceDigest)?.toString() ??
      context.civilizationOpportunityKey?.match(/^BUILD_([0-9]+)_CIV_[0-9]+$/)?.[1];
    if(build){
      for(const id of taxonomy.strategicBuildingsByBuild[build]??[]){
        if(Number.isSafeInteger(id)&&id>=0)strategicBuildingIds.add(id);
      }
    }
    const families=context.civilizationOpportunityKey ?
      (taxonomy.militaryFamiliesByExactCiv[context.civilizationOpportunityKey]??[]) : [];
    if(context.civilizationOpportunityKey&&families.length>1&&
      families.every(f=>typeof f==='string'&&f.length))
      availableMilitaryFamilies[context.civilizationOpportunityKey]=[...new Set(families)];
  }
  const calibration:PersonalityCalibration={
    configurationVersion:PRIVATE_PERSONALITY_E2E_VERSION,
    status:'PROPOSED',
    minimumIndependentBattles:2,
    recentBattleCount:2,
    careerWeight:0.5,
    aggregationMethod:'MEDIAN',
    strategicBuildingIds:[...strategicBuildingIds].sort((a,b)=>a-b),
    availableMilitaryFamilies,
    anchors,
    minimumIndependentCommandEpisodes:2,
  };
  return {context:getContext,calibration,diagnostics:{
    policy:PRIVATE_PERSONALITY_E2E_VERSION,
    acceptedGameSources:bySource.size,rejectedGameSources:rejected,
    reasons:[...new Set(reasons)].sort(),
  }};
}
