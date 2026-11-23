import type {PendingGrade} from '../../../functions/src/domain/gameplayPreview';
import {isolatedStagingProject} from './stagingProject';
import type {SourceSnapshot} from '../../../functions/src/domain/socialV1';
import type {BoundGameplayCandidate} from '../../../functions/src/domain/gameplayCandidates';
export interface PrivateGameplayPreview {
  version:'AOF_INT_C1_PRIVATE_PREVIEW_1';visibility:'OWNER_ONLY';ownerPlayerId:string;inputDigest:string;
  status:'PENDING';simulation:{status:'UNAPPROVED_TEST_ONLY';version:string;policyDigest:string};
  grades:PendingGrade[];sources:SourceSnapshot[];pendingSources:Array<{battleId:string;gameId:string|null;reason:string}>;
  coverage:{ownBattles:number;ownGames:number;currentSources:number};
  history:{publicationAllowed:false;officialWrites:false;projections:[];receipts:[]};
  effects:{officialWrites:false;receiptPublication:false;entitlementGrants:false};
}
export interface PrivateGameplayCandidates extends Omit<PrivateGameplayPreview,'version'|'grades'> {
  version:'AOF_INT_C2A_PRIVATE_PREVIEW_1';episodes:BoundGameplayCandidate[];
  legacyPending:{version:'AOF_INT_C1_PRIVATE_PREVIEW_1';claimIds:string[];inferenceIds:string[]};
}
export function gameplayCandidatesEnabled(env:Record<string,string|boolean|undefined>={}):boolean{
  return env.VITE_AOF_INT_C2A_PREVIEW==='source-compatible-v1'&&
    isolatedStagingProject(env);
}
export function gameplayPreviewEnabled(env:Record<string,string|boolean|undefined>={}):boolean{
  return env.VITE_AOF_INT_C1_PREVIEW==='wiring-test-v1'&&
    isolatedStagingProject(env);
}
