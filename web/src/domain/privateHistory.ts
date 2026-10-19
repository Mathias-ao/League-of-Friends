import type {SourceSnapshot,BattleFeature,PersonalityProfile} from '../../../functions/src/domain/socialV1';
export interface PrivatePersonalityHistory {
  version:'AOF_INT_B_PRIVATE_HISTORY_1';contract:'AOF_SOCIAL_V1_SHARED_1';visibility:'OWNER_ONLY';ownerPlayerId:string;
  inputDigest:string;status:'CURRENT_INPUTS'|'PENDING_INPUTS';
  coverage:{completeEnumeration:true;scannedLeagueBattles:number;ownBattles:number;ownGames:number;currentSources:number;measuredIndependentBattles:0};
  sources:SourceSnapshot[];pending:Array<{battleId:string;gameId:string;reason:string}>;
  personality:{publication:'PRIVATE_PREVIEW_ONLY';battleFeatures:BattleFeature[];personalityProfile:PersonalityProfile;
    contextAdmission:'PENDING';calibration:'UNCONFIGURED'};
  social:{status:'PENDING';reason:string};effects:{officialWrites:false;receiptPublication:false;entitlementGrants:false};
}
export function privateHistoryEnabled(env:Record<string,string|boolean|undefined>={}):boolean{
  return env.VITE_AOF_INT_V1_PRIVATE_HISTORY==='battle-v1'&&
    (env.VITE_FIREBASE_PROJECT_ID==='age-of-friends-staging'||env.VITE_USE_EMULATORS==='true'&&
      typeof env.VITE_FIREBASE_PROJECT_ID==='string'&&env.VITE_FIREBASE_PROJECT_ID.startsWith('demo-'));
}
