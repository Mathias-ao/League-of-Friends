import type {SourceSnapshot} from '../../../functions/src/domain/socialV1';

/** Private integration DTO. Canonical source declaration is reused, never copied.
 * No stage/value is implied by an unavailable specialist handoff. */
export interface IntV1PrivateExperience {
  version:'AOF_INT_V1_PRIVATE_SOURCE_1';contract:'AOF_SOCIAL_V1_SHARED_1';visibility:'OWNER_ONLY';
  ownerPlayerId:string;state:'CURRENT_SOURCE_VERIFIED';source:SourceSnapshot;
  scope:{kind:'SINGLE_GAME';independentBattleCount:null;historicalCoverage:'NOT_COLLECTED'};
  personality:Array<{axis:string;status:'PENDING';value:null;reasonCodes:string[]}>;
  tracks:Array<{track:string;status:'PENDING';currentStage:null;reasonCodes:string[]}>;
  chronicle:{status:'PENDING';reasonCodes:string[]};recognition:{status:'PENDING';reasonCodes:string[]};
  effects:{officialWrites:false;receiptPublication:false;entitlementGrants:false};
}
