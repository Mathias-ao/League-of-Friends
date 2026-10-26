import type {Claim,SourceSnapshot,PolicyRef} from '../../../functions/src/domain/socialV1';
import type {HistoricalResult} from '../../../functions/src/engines/socialV1History/history';
export interface PrivateProgression {
 version:'AOF_SOCIAL_E2E_PRIVATE_PROGRESSION_1';visibility:'OWNER_ONLY';ownerPlayerId:string;inputDigest:string;
 simulation:{status:'PRIVATE_PROPOSED_SIMULATION_ONLY';policy:PolicyRef;calibrationVersion:string};
 sources:SourceSnapshot[];claims:Claim[];history:HistoricalResult;
 cards:Array<{claimId:string;claimRevision:string;battleId:string;gameId:string;sourceAuthority:string;actorPlayerId:string;counterpartPlayerId:string;
  track:string;decision:'SOURCE_ADMITTED'|'PENDING';gradeBandId:string|null;originalEventCount:number;methodVersion:string;meaning:string|null;
  missingEvidence:string[];identity:{componentId:string}}>;
 pendingSources:Array<{battleId:string;gameId:string;reason:string}>;pendingMethods:string[];
 coverage:{currentSources:number;ownBattles:number};
 effects:{officialWrites:false;receiptPublication:false;entitlementGrants:false};
}
export function privateProgressionEnabled(env:Record<string,string|boolean|undefined>={}){
 return env.VITE_AOF_SOCIAL_E2E_PROGRESS==='pilot-v1'&&env.VITE_USE_EMULATORS==='true'&&
  typeof env.VITE_FIREBASE_PROJECT_ID==='string'&&env.VITE_FIREBASE_PROJECT_ID.startsWith('demo-');
}
