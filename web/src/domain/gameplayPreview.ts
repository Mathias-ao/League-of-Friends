import type {PendingGrade} from '../../../functions/src/domain/gameplayPreview';
import type {SourceSnapshot} from '../../../functions/src/domain/socialV1';
export interface PrivateGameplayPreview {
  version:'AOF_INT_C1_PRIVATE_PREVIEW_1';visibility:'OWNER_ONLY';ownerPlayerId:string;inputDigest:string;
  status:'PENDING';simulation:{status:'UNAPPROVED_TEST_ONLY';version:string;policyDigest:string};
  grades:PendingGrade[];sources:SourceSnapshot[];pendingSources:Array<{battleId:string;gameId:string;reason:string}>;
  coverage:{ownBattles:number;ownGames:number;currentSources:number};
  history:{publicationAllowed:false;officialWrites:false;projections:[];receipts:[]};
  effects:{officialWrites:false;receiptPublication:false;entitlementGrants:false};
}
export function gameplayPreviewEnabled(env:Record<string,string|boolean|undefined>={}):boolean{
  return env.VITE_AOF_INT_C1_PREVIEW==='wiring-test-v1'&&
    (env.VITE_FIREBASE_PROJECT_ID==='age-of-friends-staging'||env.VITE_USE_EMULATORS==='true'&&
      typeof env.VITE_FIREBASE_PROJECT_ID==='string'&&env.VITE_FIREBASE_PROJECT_ID.startsWith('demo-'));
}
