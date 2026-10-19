import {createHash} from 'node:crypto';
import {
  SOCIAL_V1_CONTRACT, battleIdForMatch, assertRecordInvariants,
  type BattleFeature, type PersonalityProfile, type Coverage, type PolicyRef, type Ref,
} from '../../domain/socialV1.js';
import {
  PERSONALITY_AXES, PERSONALITY_FEATURE_VERSION,
  type PersonalityAxis, type PersonalityCalibration, type PersonalityPreview, type BattleEvidence,
} from './personalityV1.js';

/**
 * Canonical SHARED_1 shape adapter, NOT an official-publication adapter.
 * PersonalityPreview and BattleEvidence are PRIVATE intermediate DTOs;
 * they contain original event IDs and unapproved candidate scores. Returned
 * SHARED_1 records remain inside a PRIVATE_PREVIEW_ONLY envelope.
 * There is no trusted publication/approval registry in this pure engine.
 */
export const PERSONALITY_SHARED_ADAPTER_VERSION = 'AOF_PERSONALITY_SHARED1_ADAPTER_V1';
const axes = Object.keys(PERSONALITY_AXES) as PersonalityAxis[];
const sha = (value: unknown): string => createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
const unique = (values:string[]):string[] => [...new Set(values)].sort();
const id = (value: unknown):value is string => typeof value === 'string' && value.length > 0;
const reasonId = (value: string):string => value.replace(/[^A-Za-z0-9_.:-]/g,'_');

export interface PrivateShared1PersonalityCandidate {
  readonly publication: 'PRIVATE_PREVIEW_ONLY';
  readonly contract: typeof SOCIAL_V1_CONTRACT;
  readonly adapterVersion: typeof PERSONALITY_SHARED_ADAPTER_VERSION;
  readonly battleFeatures: BattleFeature[];
  readonly personalityProfile: PersonalityProfile;
}
function coverage(tier:Coverage['tier'], reasonCodes:string[], limitations:string[]):Coverage {
  return {
    tier, ruleId:PERSONALITY_SHARED_ADAPTER_VERSION,
    missing:unique(reasonCodes.map(reasonId)),
    limitations:unique(limitations.map(reasonId)),
  };
}
function sourceRef(battle:BattleEvidence, axis:PersonalityAxis):Ref {
  const feature=battle.features[axis];
  return {
    // Projection lineage pointer only, not a verified engine SOURCE_EVENT claim.
    // Raw source events retain their private source-specific provenance.
    kind:'CONTEXT',
    id:JSON.stringify([battle.battleId,battle.playerId,axis,'source-lineage']),
    revision:battle.sourceRevision,
    digest:sha([battle.sourceRevision,battle.gameIds,axis,feature.evidenceIds,feature.modelVersions]),
  };
}
function measurementRef(battleFeature:BattleFeature):Ref {
  return {
    kind:'MEASUREMENT',
    id:JSON.stringify([battleFeature.battleId,battleFeature.playerId,battleFeature.featureId]),
    revision:battleFeature.featureVersion,
    digest:sha(battleFeature),
  };
}

/** Shape-only conversion; no caller-provided APPROVED/publish path exists. */
export function toPrivateShared1Personality(
  preview:PersonalityPreview, calibration:PersonalityCalibration|null, policyVersion:string,
):PrivateShared1PersonalityCandidate {
  if(!id(policyVersion) || !id(preview.playerId) ||
     preview.featureVersion!==PERSONALITY_FEATURE_VERSION ||
     preview.publication!=='PRIVATE_PREVIEW_ONLY' ||
     preview.configurationVersion!==(calibration?.configurationVersion??null) ||
     preview.policyStatus!==(calibration?.status??'UNCONFIGURED')) {
    throw new Error('PERSONALITY_SHARED1_PRIVATE_PREVIEW_INPUT_INVALID');
  }
  if(preview.sliders.length!==axes.length ||
     new Set(preview.sliders.map(s=>s.axis)).size!==axes.length ||
     axes.some(axis=>!preview.sliders.some(s=>s.axis===axis))) {
    throw new Error('PERSONALITY_SHARED1_FIVE_AXES_REQUIRED');
  }
  // Never trust an external APPROVED label. Only Sol's registry can authorize.
  const policy:PolicyRef={
    policyVersion, configurationVersion:calibration?.configurationVersion??'PERSONALITY_UNCONFIGURED_V1',
    status:'PROPOSED', approvalRef:null,
  };
  const battleFeatures:BattleFeature[]=[];
  const seenBattles=new Set<string>();
  const byAxis=new Map<PersonalityAxis,Array<{record:BattleFeature; ref:Ref}>>(axes.map(a=>[a,[]]));
  for(const battle of preview.battles){
    if(battle.playerId!==preview.playerId ||
       battle.battleId!==battleIdForMatch(battle.battleId) ||
       !id(battle.contextKey) || !/^[a-f0-9]{64}$/.test(battle.sourceRevision) ||
       seenBattles.has(battle.battleId) || !battle.gameIds.length ||
       new Set(battle.gameIds).size!==battle.gameIds.length) {
      throw new Error('PERSONALITY_SHARED1_BATTLE_OR_SOURCE_IDENTITY_INVALID');
    }
    seenBattles.add(battle.battleId);
    for(const axis of axes){
      const feature=battle.features[axis];
      if(!feature || feature.axis!==axis || !id(feature.semantic) ||
         (feature.fraction!==null && (!Number.isFinite(feature.fraction) ||
           feature.fraction<0 || feature.fraction>1))) {
        throw new Error('PERSONALITY_SHARED1_FEATURE_SHAPE_INVALID');
      }
      const anchor=calibration?.anchors[battle.contextKey]?.[axis];
      const hasFraction=feature.fraction!==null && feature.denominator!==null &&
        feature.numerator!==null;
      const normalized=hasFraction && anchor ?
        100*Math.max(0,Math.min(1,(feature.fraction!-anchor.lower)/(anchor.upper-anchor.lower))) : null;
      if(normalized!==null && !Number.isFinite(normalized))throw new Error('PERSONALITY_SHARED1_ANCHOR_INVALID');
      const reasons=feature.reason?[feature.reason]:[];
      if(!anchor)reasons.push('CONTEXT_NORMALIZATION_ANCHOR_UNAVAILABLE');
      const limited:string[]=['PRIVATE_CALIBRATION_NOT_AUTHORIZED'];
      if(axis==='GUERRILLA_FRONTLINE')limited.push('INFERRED_MILITARY_COMMAND_POSTURE_NOT_CONFIRMED_COMBAT');
      if(battle.gameIds.length>1)limited.push('MULTI_GAME_BATTLE_AGGREGATED_ONCE');
      const bf:BattleFeature={
        playerId:battle.playerId, battleId:battle.battleId, matchId:battle.battleId,
        inputDigest:battle.sourceRevision,featureVersion:PERSONALITY_FEATURE_VERSION,
        contextKey:battle.contextKey,featureId:axis,
        numerator:hasFraction?feature.numerator:null,
        denominator:hasFraction?feature.denominator:null,
        normalized,coverage:coverage(normalized===null?'INSUFFICIENT':'LIMITED',reasons,limited),
        evidenceRefs:[sourceRef(battle,axis)],sampleUnit:'INDEPENDENT_BATTLE',
      };
      assertRecordInvariants('BattleFeature',bf);
      battleFeatures.push(bf);
      byAxis.get(axis)!.push({record:bf,ref:measurementRef(bf)});
    }
  }
  const sliders:PersonalityProfile['sliders']=axes.map(axis=>{
    const v=preview.sliders.find(x=>x.axis===axis)!;
    if((v.status!=='READY' && v.value!==null) ||
       (v.status==='READY' && (v.value===null || !Number.isFinite(v.value) || v.value<0 || v.value>100))) {
      throw new Error('PERSONALITY_SHARED1_DEVELOPING_MUST_BE_NULL');
    }
    const refs=byAxis.get(axis)!.filter(item=>item.record.normalized!==null).map(x=>x.ref);
    // Required nonempty context ID, sentinel is explicitly NOT a comparable group.
    const contextKey=v.contextKey??'PERSONALITY_CONTEXT_NOT_COMPARABLE';
    const gaps=unique([...v.reasons,...(v.contextKey?[]:['NO_COMPARABLE_CONTEXT'])]);
    const limits:string[]=['PRIVATE_PREVIEW_UNAPPROVED_RULES'];
    if(axis==='GUERRILLA_FRONTLINE')limits.push('MILITARY_COMMAND_POSTURE_INFERENCE_ONLY');
    if(v.status==='CONTEXT_LIMITED')limits.push('INCOMPATIBLE_CONTEXT_GROUPS');
    return {
      axis,status:v.status,value:v.value,independentBattles:v.independentBattles,
      contextKey,coverage:coverage(v.status==='DEVELOPING'?'INSUFFICIENT':'LIMITED',gaps,limits),
      featureRefs:refs,
    };
  });
  const personalityProfile:PersonalityProfile={
    playerId:preview.playerId, projectionRevision:sha([
      PERSONALITY_SHARED_ADAPTER_VERSION,preview.projectionRevision,policy,battleFeatures,sliders,
    ]),policy,sliders,
  };
  assertRecordInvariants('PersonalityProfile',personalityProfile);
  return {publication:'PRIVATE_PREVIEW_ONLY',contract:SOCIAL_V1_CONTRACT,
    adapterVersion:PERSONALITY_SHARED_ADAPTER_VERSION,battleFeatures,personalityProfile};
}
