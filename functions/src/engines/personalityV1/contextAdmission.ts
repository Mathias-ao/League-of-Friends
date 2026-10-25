import {createHash} from 'node:crypto';
import type {SourceSnapshot} from '../../domain/socialV1.js';
import type {GameContext,Format,MapFamily,StartFamily} from './personalityV1.js';

/**
 * PERS-CONTEXT #155. Pure, source-bound context admission; no collector, config
 * registry, published score, numerical defaults or live wiring.
 *
 * The server-only INT-B contextAdmission hook accepts this input unchanged.
 * A decoded label/ID is NOT a reviewed equivalence class: missing source-owned
 * map/start/clock classifications leave a PENDING result.
 */
export const PERSONALITY_CONTEXT_ADAPTER_VERSION = 'AOF_PERSONALITY_CONTEXT_ADMISSION_V1' as const;
export const PERSONALITY_CONTEXT_PROOF_VERSION = 'AOF_PERSONALITY_CONTEXT_PROOF_V1' as const;
const SHA=/^[a-f0-9]{64}$/;
type Bag=Record<string,any>;
const obj=(v:unknown):Bag => v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Bag:{};
const safe=(v:unknown):v is number=>Number.isSafeInteger(v)&&typeof v==='number'&&v>=0;
const name=(v:unknown):v is string=>typeof v==='string'&&v.trim().length>0;
const hash=(v:unknown):string=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const isOneOf=<T extends string>(v:unknown,allowed:readonly T[]):v is T=>allowed.includes(v as T);

export type ContextSourceInput={
  source:SourceSnapshot;
  statistics:Bag;
  match:Bag;
  game:Bag;
};

/**
 * Separately reviewed exact-source evidence, never sourced from a client.
 * Source-fingerprint binding stops replay correction or same raw ID on another
 * game build from inheriting an unreviewed map or start classification.
 * The ranges/buckets here are an optional future owner-reviewed decision, NOT
 * numerical calibration and NOT independently inferred from a duration alone.
 */
export type ReviewedContextProof={
  version:typeof PERSONALITY_CONTEXT_PROOF_VERSION;
  status:'REVIEWED_SOURCE_CLASSIFICATION';
  referenceId:string;
  sourceHash:string;
  gameBuild:number;
  mapId:number;
  startingAgeId:number;
  startingResourcesId:number;
  mapFamily:MapFamily;
  startFamily:StartFamily;
  durationBucket:{
    id:string;
    lowerObservedMs:number;
    upperObservedMsExclusive:number;
    meaning:'OBSERVED_RECORDING_INTERVAL_ONLY';
  };
};
export type AdmissionField<T>={
  value:T|null;
  status:'SOURCE_VERIFIED'|'REVIEWED_CLASSIFICATION'|'PENDING';
  reason:string|null;
};
export type PersonalityContextAdmission={
  version:typeof PERSONALITY_CONTEXT_ADAPTER_VERSION;
  status:'ADMITTED'|'PENDING';
  context:GameContext|null;
  provenanceDigest:string;
  fields:{
    format:AdmissionField<Format>;
    mapId:AdmissionField<string>;
    mapFamily:AdmissionField<MapFamily>;
    startFamily:AdmissionField<StartFamily>;
    civilization:AdmissionField<string>;
    civilizationOpportunityKey:AdmissionField<string>;
    durationMs:AdmissionField<number>;
    observedUntilMs:AdmissionField<number>;
    durationFamily:AdmissionField<string>;
    dynamicDiplomacyQualified:AdmissionField<boolean>;
  };
  missing:string[];
};
const ok=<T>(value:T,source:'SOURCE_VERIFIED'|'REVIEWED_CLASSIFICATION'='SOURCE_VERIFIED'):AdmissionField<T>=>
  ({value,status:source,reason:null});
const pending=<T>(reason:string):AdmissionField<T>=>({value:null,status:'PENDING',reason});
const missingOf=(fields:PersonalityContextAdmission['fields'])=>
  Object.entries(fields).filter(([,f])=>f.status==='PENDING')
    .map(([k,f])=>k+':'+f.reason).sort();

/** No implicit equivalence or publication is conferred by reviewed classifiers. */
export function admitPersonalityContext(input:ContextSourceInput, subjectPlayerId:string,
    reviewed:ReviewedContextProof|null=null):PersonalityContextAdmission {
  const {source,statistics,match,game}=input;
  const facts=obj(statistics.matchFacts),rules=obj(facts.rules),factGame=obj(facts.game);
  const factSource=obj(facts.source),factMap=obj(facts.map);
  const members=Array.isArray(source.roster)?source.roster:[];
  const ids=members.map((r:Bag)=>r.playerId),slots=members.map((r:Bag)=>r.replaySlot);
  const gameMembers=Array.isArray(game.players)?game.players:[];
  const trust=source.contract==='AOF_SOCIAL_V1_SHARED_1'&&SHA.test(source.sourceHash)&&
    SHA.test(source.authorityRevision)&&SHA.test(source.mappingDigest)&&
    source.matchId===source.battleId&&name(source.matchId)&&
    source.outcome?.qualification==='OFFICIAL'&&name(source.gameId)&&
    (game.id===undefined||game.id===source.gameId)&&
    (game.matchId===undefined||game.matchId===source.matchId)&&
    (match.id===undefined||match.id===source.matchId)&&
    safe(source.statisticsRevision)&&source.statisticsRevision>0&&
    members.length>=2&&members.length<=8&&
    ids.every(name)&&new Set(ids).size===ids.length&&
    slots.every((x:unknown)=>safe(x)&&x>=1&&x<=8)&&new Set(slots).size===slots.length&&
    gameMembers.length===members.length&&
    gameMembers.every((p:Bag)=>ids.includes(p.playerId))&&
    obj(facts).modelVersion==='AOF_RECORDING_MATCH_FACTS_V1'&&
    facts.identityNamespace==='CANONICAL_REPLAY_PLAYER_ID'&&
    factSource.replaySha256===source.sourceHash&&
    Array.isArray(facts.players)&&facts.players.length===members.length&&
    members.every((r:Bag)=>facts.players.some((p:Bag)=>p.playerId===r.replaySlot&&p.replaySlot===r.replaySlot));
  const format:AdmissionField<Format>=pending('MODE_NOT_ADMITTED');
  if(trust&&match.opponentKind==='HUMAN'){
    const ff=match.format;
    const counts={TWO_V_TWO:2,THREE_V_THREE:3,FOUR_V_FOUR:4} as const;
    if(ff==='ONE_V_ONE'&&members.length===2)Object.assign(format,ok('ONE_V_ONE'));
    else if(ff==='FFA'&&members.length>=3)Object.assign(format,ok('FFA'));
    else if(Object.prototype.hasOwnProperty.call(counts,ff)&&
      members.length===2*counts[ff as keyof typeof counts]){
      const teamNums=gameMembers.map((p:Bag)=>p.team);
      const teams=[...new Set(teamNums)];
      const size=counts[ff as keyof typeof counts];
      if(teams.length===2&&teams.every(t=>safe(t)&&teamNums.filter(x=>x===t).length===size))
        Object.assign(format,ok('TEAM'));
    }
  }
  const rawMapId=obj(rules.mapId);
  const sourceMapId=rawMapId.status==='DECODED'&&safe(rawMapId.value)&&
    (factMap.id===null||factMap.id===undefined||factMap.id===rawMapId.value)
      ?rawMapId.value:null;
  const mapId:AdmissionField<string>=trust&&sourceMapId!==null?ok(String(sourceMapId)):pending('MAP_ID_NOT_SOURCE_QUALIFIED');
  const replayBuild=safe(factSource.gameBuild)&&factSource.gameBuild>0?factSource.gameBuild:null;
  const civEntries=trust&&replayBuild!==null&&
    facts.players.every((p:Bag)=>safe(obj(p.civilization).rawId)&&p.civilization.rawId>0);
  const civRoster=members.length?facts.players.filter((p:Bag)=>
    members.some((r:Bag)=>r.replaySlot===p.replaySlot)):[];
  const civ= civEntries&&civRoster.length===members.length?civRoster.map((p:Bag)=>
    [p.replaySlot,p.civilization.rawId]):null;
  // GameContext is participant-specific. Return the compatible raw civ for
  // the selected server-resolved subject ONLY. Sol must pass a subjectSlot.
  const boundSubject=members.find((p:Bag)=>p.playerId===subjectPlayerId);
  const subjectSlot=boundSubject?.replaySlot;
  const target=civ?.find((x:number[])=>x[0]===subjectSlot);
  const civilization:AdmissionField<string>=target?ok('RAW_AOE2_CIV_'+target[1]):pending('PARTICIPANT_CIV_SOURCE_BINDING_MISSING');
  const civilizationOpportunityKey:AdmissionField<string>=target&&replayBuild!==null?
    ok('BUILD_'+replayBuild+'_CIV_'+target[1]):pending('CIV_OPPORTUNITY_REQUIRES_PATCH_EXACT_ID');
  const observed=obj(statistics.scope).observedUntilMs;
  const recorded=factGame.observedDurationMs;
  const clockValid=trust&&safe(observed)&&safe(recorded)&&recorded>0&&
    observed>=recorded&&factGame.durationMeaning==='observed_recording_interval_not_proven_full_game';
  const durationMs:AdmissionField<number>=clockValid?ok(recorded):pending('RECORDED_DURATION_NOT_VERIFIED');
  const observedUntilMs:AdmissionField<number>=clockValid?ok(observed):pending('OBSERVATION_CLOCK_NOT_VERIFIED');
  const ageRule=obj(rules.startingAgeId),resourceRule=obj(rules.startingResourcesId);
  const age=ageRule.status==='DECODED'&&safe(ageRule.value)?ageRule.value:null;
  const resources=resourceRule.status==='DECODED'&&safe(resourceRule.value)?resourceRule.value:null;
  const reviewedSource=trust&&reviewed?.version===PERSONALITY_CONTEXT_PROOF_VERSION&&
    reviewed.status==='REVIEWED_SOURCE_CLASSIFICATION'&&name(reviewed.referenceId)&&
    reviewed.sourceHash===source.sourceHash&&reviewed.gameBuild===replayBuild&&
    reviewed.mapId===sourceMapId&&reviewed.startingAgeId===age&&
    reviewed.startingResourcesId===resources;
  const mapFamily:AdmissionField<MapFamily>=reviewedSource&&
    isOneOf(reviewed!.mapFamily,['LAND','WATER','HYBRID'] as const)?
    ok(reviewed!.mapFamily,'REVIEWED_CLASSIFICATION'):pending('MAP_FAMILY_UNREVIEWED_FOR_EXACT_SOURCE');
  const startFamily:AdmissionField<StartFamily>=reviewedSource&&
    isOneOf(reviewed!.startFamily,['STANDARD','NOMAD','CUSTOM'] as const)&&
    // "STANDARD" requires actual starting-TC evidence, not age=0 or map label.
    (reviewed!.startFamily!=='STANDARD'||obj(statistics.participants?.find((p:Bag)=>p.replaySlot===subjectSlot)?.mapPresence?.homeAnchor).method==='initial_town_center')?
    ok(reviewed!.startFamily,'REVIEWED_CLASSIFICATION'):pending('START_FAMILY_UNREVIEWED_OR_INITIAL_TOWN_CENTER_UNPROVEN');
  const bucket=reviewed?.durationBucket;
  const durationFamily:AdmissionField<string>=reviewedSource&&clockValid&&
    bucket?.meaning==='OBSERVED_RECORDING_INTERVAL_ONLY'&&
    name(bucket.id)&&safe(bucket.lowerObservedMs)&&safe(bucket.upperObservedMsExclusive)&&
    bucket.lowerObservedMs<bucket.upperObservedMsExclusive&&
    recorded>=bucket.lowerObservedMs&&recorded<bucket.upperObservedMsExclusive?
      ok(bucket.id,'REVIEWED_CLASSIFICATION'):pending('DURATION_BUCKET_UNREVIEWED_OR_INTERVAL_MISMATCH');
  const dynamicDiplomacyQualified:AdmissionField<boolean>=trust?
    ok(obj(facts.diplomacy).effectiveRuntimeStateQualified===true):
    pending('EFFECTIVE_DIPLOMACY_NOT_SOURCE_QUALIFIED');
  const fields={format,mapId,mapFamily,startFamily,civilization,civilizationOpportunityKey,
    durationMs,observedUntilMs,durationFamily,dynamicDiplomacyQualified};
  const missing=missingOf(fields);
  const context=missing.length===0?{
    format:format.value!,mapFamily:mapFamily.value!,startFamily:startFamily.value!,
    mapId:mapId.value!,civilization:civilization.value!,
    civilizationOpportunityKey:civilizationOpportunityKey.value!,
    observedUntilMs:observedUntilMs.value!,durationMs:durationMs.value!,
    dynamicDiplomacyQualified:dynamicDiplomacyQualified.value!,
  }:null;
  return {
    version:PERSONALITY_CONTEXT_ADAPTER_VERSION,
    status:context?'ADMITTED':'PENDING',context,
    provenanceDigest:hash([PERSONALITY_CONTEXT_ADAPTER_VERSION,source.authorityRevision,
      source.mappingDigest,source.sourceHash,source.statisticsRevision,source.matchId,
      source.gameId,match.format,game.players,subjectPlayerId,subjectSlot,
      facts.source,facts.game,facts.map,facts.rules,facts.players,facts.diplomacy,
      statistics.scope,reviewed??null]),
    fields,missing,
  };
}

/** Optional server-only pure hook; defaults to Pending absent a reviewed exact-source proof. */
export function personalityContextForHistory(input:ContextSourceInput,subjectPlayerId:string,
  proof:ReviewedContextProof|null=null):GameContext|null {
  return admitPersonalityContext(input,subjectPlayerId,proof).context;
}
