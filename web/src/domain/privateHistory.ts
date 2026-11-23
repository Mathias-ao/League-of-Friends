import type {SourceSnapshot,BattleFeature,PersonalityProfile} from '../../../functions/src/domain/socialV1';
export interface LivePersonalityEvidence {
  version:'AOF_PERSONALITY_LIVE_EVIDENCE_V1';
  requiredGames:3;eligibleGames:number;gameUnlock:'LOCKED'|'UNLOCKED';
  requiredQualifiedBattles:3;qualifiedBattles:number;
  status:'PENDING_BATTLES'|'DEVELOPING'|'CALIBRATION_PENDING'|'READY';
  calibration:'NOT_APPROVED'|'APPROVED';
  axes:Array<{axis:'BOOMER_AGGRESSOR'|'CAUTIOUS_BOLD'|'GUERRILLA_FRONTLINE'|
    'SPECIALIST_IMPROVISER'|'COMPACT_EXPANSIVE';status:'DEVELOPING'|'CALIBRATION_PENDING'|'READY';
    value:number|null;measuredBattles:number;comparableBattles?:number;reasons:string[]}>;
}
export interface PrivatePersonalityHistory {
  version:'AOF_INT_B_PRIVATE_HISTORY_1';contract:'AOF_SOCIAL_V1_SHARED_1';visibility:'OWNER_ONLY';ownerPlayerId:string;
  inputDigest:string;status:'CURRENT_INPUTS'|'PENDING_INPUTS';
  coverage:{completeEnumeration:true;scannedLeagueBattles:number;ownBattles:number;ownGames:number;currentSources:number;measuredIndependentBattles:number};
  sources:SourceSnapshot[];pending:Array<{battleId:string;gameId:string|null;reason:string}>;
  /** Source-current, owner-only live counts, never the emulator's proposed calibration. */
  livePersonality?:LivePersonalityEvidence;
  personality:{publication:'PRIVATE_PREVIEW_ONLY';battleFeatures:BattleFeature[];personalityProfile:PersonalityProfile;
    unlock:{version:'AOF_PERSONALITY_THREE_GAME_UNLOCK_V1';requiredGames:3;eligibleGames:number;
      status:'LOCKED'|'UNLOCKED';reason:'THREE_SOURCE_QUALIFIED_GAMES_REQUIRED'|null};
    contextAdmission:'PENDING'|'SOURCE_QUALIFIED';calibration:'UNCONFIGURED'|'PROPOSED'|'APPROVED'};
  numericalPolicy?:{policyVersion:string;configurationVersion:string;sha256:string;approvalRef:string;
    runtime:'AUTHORIZED'|'DISABLED';runtimeRevision:string|null};
  social:{status:'PENDING';reason:string};effects:{officialWrites:false;receiptPublication:false;entitlementGrants:false};
}
export function privateHistoryEnabled(env:Record<string,string|boolean|undefined>={}):boolean{
  return env.VITE_AOF_INT_V1_PRIVATE_HISTORY==='battle-v1'&&
    (env.VITE_FIREBASE_PROJECT_ID==='age-of-friends-staging'||env.VITE_USE_EMULATORS==='true'&&
      typeof env.VITE_FIREBASE_PROJECT_ID==='string'&&env.VITE_FIREBASE_PROJECT_ID.startsWith('demo-'));
}
