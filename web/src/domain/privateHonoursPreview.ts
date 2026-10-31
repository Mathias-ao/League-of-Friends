export interface HonourSourceRef {
  battleId:string;gameId:string;seasonId:string;sourceHash:string;statisticsRevision:number;authorityRevision:string;resultRevision:number|null;
}
export interface PrivateHonoursPreview {
  version:'AOF_HONOURS_PRIVATE_SOURCE_PREVIEW_1';visibility:'OWNER_ONLY';ownerPlayerId:string;
  inputDigest:string;mode:'READ_ONLY_TESTING';coverage:{currentSources:number;ownBattles:number;completeSourceBattles:number};
  sources:HonourSourceRef[];pendingSources:Array<{battleId:string;gameId:string|null;reason:string}>;
  honours:Array<{key:string;kind:'TROPHY'|'EPITHET'|'DISTINCTION';label:string;status:'SOURCE_CANDIDATE'|'PENDING';
    reason:string;independentBattles:number|null;evidence:HonourSourceRef[]}>;
  effects:{officialWrites:false;receiptPublication:false;entitlementGrants:false};
}
export function privateHonoursPreviewEnabled(env:Record<string,string|boolean|undefined>={}):boolean{
  return env.VITE_AOF_HONOURS_PRIVATE_PREVIEW==='source-v1'&&env.VITE_USE_EMULATORS==='true'&&
    typeof env.VITE_FIREBASE_PROJECT_ID==='string'&&env.VITE_FIREBASE_PROJECT_ID.startsWith('demo-');
}
