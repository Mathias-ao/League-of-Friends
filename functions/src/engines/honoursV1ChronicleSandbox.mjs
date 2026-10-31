/**
 * AOF Honours Chronicle - test-only reply simulator.
 *
 * Existing CHRON-V1E is production-disabled and remains the eventual
 * authenticated/persisted invitation authority. This pure test adapter
 * does NOT store or transmit a response, create a social score, assert
 * objective combat outcomes, or grant a Distinction.
 */
export const HONOUR_CHRONICLE_TEST_VERSION="AOF_HONOUR_CHRONICLE_TEST_V1";
const CHOICES=new Set(["ACKNOWLEDGED","NOT_PERSONALLY_MEANINGFUL","UNSURE","DECLINE"]);
export function honourChronicleEmulatorEnabled(env={}) {
  return env.FUNCTIONS_EMULATOR==="true"&&
    typeof env.GCLOUD_PROJECT==="string"&&env.GCLOUD_PROJECT.startsWith("demo-")&&
    env.AOF_HONOUR_CHRONICLE_V1==="emulator-only";
}
export function emulateHonourChronicleResponse({candidate,actor,action,env}) {
  if(!honourChronicleEmulatorEnabled(env))throw new Error("Honour Chronicle is emulator-only.");
  if(candidate?.testOnly!==true||candidate.offered!==false||
     candidate.grantEffect!==false||candidate.visibility!=="AUTHOR_ONLY"||
     !["AGGRESSION","DEFENCE"].includes(candidate.kind)||
     !candidate.battleId||!candidate.gameId||!candidate.episodeId||
     !candidate.sourceRevision||!candidate.respondentPlayerId)
    throw new Error("Source-qualified offer proposal required.");
  if(!actor?.authenticated||actor.playerId!==candidate.respondentPlayerId)
    throw new Error("Chronicle response requires the exact authenticated respondent.");
  if(!action||action.expectedSourceRevision!==candidate.sourceRevision)
    throw new Error("Stale honour source revision.");
  if(action.choice==="DECLINE"||action.choice==="UNSURE"||action.choice==="NOT_PERSONALLY_MEANINGFUL")
    return {state:action.choice==="DECLINE"?"DECLINED":"SUBMITTED_NO_ACKNOWLEDGMENT",
      visibility:"AUTHOR_ONLY",testOnly:true,officialEffects:[],
      sourceRevision:candidate.sourceRevision,invitationSent:false};
  if(!CHOICES.has(action.choice))throw new Error("Unknown non-leading Chronicle choice.");
  if(action.choice!=="ACKNOWLEDGED")throw new Error("Invalid Chronicle acknowledgement.");
  return {
    kind:candidate.kind,battleId:candidate.battleId,gameId:candidate.gameId,
    episodeId:candidate.episodeId,sourceRevision:candidate.sourceRevision,
    respondentPlayerId:actor.playerId,state:"SUBMITTED",choice:"ACKNOWLEDGED",
    visibility:"AUTHOR_ONLY",verifiedRespondent:true,testOnly:true,
    officialEffects:[],invitationSent:false,
    meaning:"AUTHOR_PERSPECTIVE_ONLY_NO_EXECUTED_EFFECT_INFERENCE",
  };
}
