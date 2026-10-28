/** Emulator-only, source-revision-bound subjective Chronicle responses.
 * Never read as a social Claim, narrator fact, player grant or public judgment. */
export interface PrivateChronicleInvitation {
  slotId:string;battleId:string;respondentPlayerId:string;revision:number;
  state:'OFFERED'|'DEFERRED'|'DECLINED'|'SUBMITTED'|'WITHDRAWN';
  opportunityRevision:string;family:string;counterpartPlayerId:string;
  questionContext:string;choices:string[];sourceCurrent:boolean;
  speaker:null|{authorPlayerId:string;choiceId:string;qualification:'PENDING';presentation:'ATTRIBUTED_SPEAKER_NOT_OBJECTIVE_NARRATOR'};
  effects:{relationshipDelta:null;officialWrites:false;negativeForSilence:false};
}
export interface PrivateChronicleInvitations {
  version:'AOF_CHRONICLE_INTERACTIONS_V1E';visibility:'OWNER_ONLY';ownerPlayerId:string;
  invitations:PrivateChronicleInvitation[];officialEffects:[];narratorAuthority:'FACTUAL_SOURCE_ONLY';testOnly:true;
}
export interface ChronicleInvitationAction {
  battleId:string;requestId:string;expectedRevision:number;opportunityRevision:string;
  action:'SUBMIT'|'DEFER'|'DECLINE';
  choiceId?:string;confirmed?:true;privateNote?:string;
}
export function privateChronicleInteractionsEnabled(env:Record<string,string|boolean|undefined>={}) {
  return env.VITE_AOF_CHRONICLE_INTERACTIONS_V1E==='emulator-only'&&
    env.VITE_USE_EMULATORS==='true'&&typeof env.VITE_FIREBASE_PROJECT_ID==='string'&&
    env.VITE_FIREBASE_PROJECT_ID.startsWith('demo-');
}
