import {SOCIAL_V1_CONTRACT,type SourceSnapshot} from '../domain/socialV1.js';
import {validateSharedRecord} from '../domain/socialV1Validation.js';

export const INT_V1_EXPERIENCE='AOF_INT_V1_PRIVATE_SOURCE_1' as const;
export const PERSONALITY_AXES=['BOOMER_AGGRESSOR','CAUTIOUS_BOLD','GUERRILLA_FRONTLINE',
  'SPECIALIST_IMPROVISER','COMPACT_EXPANSIVE'] as const;
export const SOCIAL_TRACKS=['GALLANTRY','CRUELTY','CHIVALRY','RIVALRY','HOSTILITY','BOND'] as const;

/** First integration slice, deliberately not a longitudinal evaluator. Never
 * infer zero conduct, zero stages or Developing sample counts from one Game.
 * Later adapters must validate their canonical records at this same boundary. */
export function privateSourceExperience(ownerPlayerId:string,input:SourceSnapshot){
  const source=validateSharedRecord('SourceSnapshot',input);
  if(!source.roster.some(p=>p.playerId===ownerPlayerId))throw new Error('Owner is outside source roster');
  return {version:INT_V1_EXPERIENCE,contract:SOCIAL_V1_CONTRACT,visibility:'OWNER_ONLY' as const,
    ownerPlayerId,state:'CURRENT_SOURCE_VERIFIED' as const,source,
    scope:{kind:'SINGLE_GAME' as const,independentBattleCount:null,historicalCoverage:'NOT_COLLECTED' as const},
    personality:PERSONALITY_AXES.map(axis=>({axis,status:'PENDING' as const,value:null,
      reasonCodes:['PERSONALITY_ADAPTER_PENDING','OWNER_CALIBRATION_PENDING']})),
    tracks:SOCIAL_TRACKS.map(track=>({track,status:'PENDING' as const,currentStage:null,
      reasonCodes:['SOURCE_MEASUREMENT_ADMISSION_PENDING','HISTORICAL_INTEGRATION_PENDING','OWNER_RULES_PENDING']})),
    chronicle:{status:'PENDING' as const,reasonCodes:['FACTUAL_CHRONICLE_SEAM_PENDING']},
    recognition:{status:'PENDING' as const,reasonCodes:['APPROVED_CATALOGUE_AND_SOURCE_PREDICATES_PENDING']},
    effects:{officialWrites:false as const,receiptPublication:false as const,entitlementGrants:false as const}};
}
export type IntV1Experience=ReturnType<typeof privateSourceExperience>;
