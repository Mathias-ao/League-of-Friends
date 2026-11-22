/** D1/D3 code/test specification. External runtime approval is separate.
 * The pinned #256 payload deliberately remains PROPOSED; never trust it as a
 * public approval or import the nine-rule emulator calibration. */
import {HttpsError} from 'firebase-functions/v2/https';
import {bindingDigest,digest} from '../engines/nativeRecordingIntegration.js';
import type {CalibratedSocialHistoryRules} from '../engines/socialV1History/history.js';

export const HOSTED_POLICY_VERSION='AOF_SOC_V1A_SOURCE_BOUND_ORDINARY_GRADES_PROPOSED_1';
export const HOSTED_POLICY_SHA256='e96e6ed6ccb846ec41f895c0dab90795cbf919cea0d823eb02371d18a8267c88';
// Exact canonical UTF-8 payload, including its terminating LF (3293 bytes).
const specification="{\"admittedMethodByRule\":{\"E2E_DARING_OFFENSE\":\"AOF_SV1E_CHALLENGED_RETURN_PRESSURE_1\",\"E2E_DIRECTED_HELP\":\"AOF_SV1E_THREAT_LINKED_DIRECTED_HELP_1\",\"E2E_NOTEWORTHY_DIRECTED_PROTECTION\":\"AOF_SV1E_NOTEWORTHY_THREAT_PROTECTION_1\",\"E2E_PAIR_CONTEST\":\"AOF_SV1E_PAIR_RAID_ENGAGEMENT_CONTEST_1\"},\"allowedBands\":[\"ORDINARY\"],\"allowedEffects\":[\"STRENGTHEN\"],\"allowedTracks\":[\"BOND\",\"CHIVALRY\",\"GALLANTRY\",\"RIVALRY\"],\"calibration\":{\"budgets\":{\"relationshipEvent\":{\"BOND\":{\"STRENGTHEN\":2,\"WEAKEN\":1},\"HOSTILITY\":{\"STRENGTHEN\":2,\"WEAKEN\":1},\"RIVALRY\":{\"STRENGTHEN\":2,\"WEAKEN\":1}},\"reputationBattle\":{\"CHIVALRY\":{\"STRENGTHEN\":2,\"WEAKEN\":1},\"CRUELTY\":{\"STRENGTHEN\":2,\"WEAKEN\":1},\"GALLANTRY\":{\"STRENGTHEN\":2,\"WEAKEN\":1}}},\"policy\":{\"approvalRef\":null,\"configurationVersion\":\"AOF_SOC_V1A_PRIVATE_ORDINARY_CALIBRATION_CANDIDATE_1\",\"policyVersion\":\"AOF_SOC_V1A_SOURCE_BOUND_ORDINARY_GRADES_PROPOSED_1\",\"status\":\"PROPOSED\"},\"rules\":{\"E2E_DARING_OFFENSE\":{\"bands\":{\"ORDINARY\":1},\"effect\":\"STRENGTHEN\",\"system\":\"REPUTATION\",\"track\":\"GALLANTRY\"},\"E2E_DIRECTED_HELP\":{\"bands\":{\"ORDINARY\":1},\"effect\":\"STRENGTHEN\",\"system\":\"RELATIONSHIP\",\"track\":\"BOND\"},\"E2E_NOTEWORTHY_DIRECTED_PROTECTION\":{\"bands\":{\"ORDINARY\":1},\"effect\":\"STRENGTHEN\",\"system\":\"REPUTATION\",\"track\":\"CHIVALRY\"},\"E2E_PAIR_CONTEST\":{\"bands\":{\"ORDINARY\":1},\"effect\":\"STRENGTHEN\",\"system\":\"RELATIONSHIP\",\"track\":\"RIVALRY\"}},\"stages\":{\"RELATIONSHIP\":{\"BOND\":{\"down\":[2,3,5,8],\"reciprocity\":{\"3\":2,\"4\":3},\"up\":[2,3,5,8]},\"HOSTILITY\":{\"down\":[2,3,5,8],\"reciprocity\":{\"3\":2,\"4\":3},\"up\":[2,3,5,8]},\"RIVALRY\":{\"down\":[2,3,5,8],\"reciprocity\":{\"3\":2,\"4\":3},\"up\":[2,3,5,8]}},\"REPUTATION\":{\"CHIVALRY\":{\"down\":[2,3,5,8],\"up\":[2,3,5,8]},\"CRUELTY\":{\"down\":[2,3,5,8],\"up\":[2,3,5,8]},\"GALLANTRY\":{\"down\":[2,3,5,8],\"up\":[2,3,5,8]}}},\"treachery\":{\"consumptionUnits\":2,\"maximumStage\":4},\"version\":\"AOF_SOC_V1A_PRIVATE_ORDINARY_CALIBRATION_CANDIDATE_1\"},\"candidateVersion\":\"AOF_SOC_V1A_PRIVATE_POLICY_CANDIDATE_1\",\"decisionReference\":\"AOF_SOC_V1A_SOURCE_BOUND_ORDINARY_GRADES_PROPOSED_1\",\"evaluatorVersion\":\"AOF_SOCIAL_V1_HISTORY_1\",\"publication\":{\"entitlementGrants\":false,\"officialWrites\":false,\"publicGrades\":false,\"publicStages\":false,\"publicTitles\":false,\"receiptPublication\":false,\"returnReceipts\":false},\"response\":{\"exclude\":[\"RAW_PROOF\",\"ARTIFACT_OR_STORAGE_REFS\",\"NOTES_OR_PERSPECTIVES\",\"COUNTERPART_PRIVATE_HISTORY\",\"RECEIPTS_OR_PUBLICATION_ENVELOPES\"],\"quietPairs\":\"FACTUAL_PAIR_WITH_PENDING_TRACKS\",\"scope\":\"OWNER_PROJECTIONS_ONLY\",\"unsupportedValues\":\"NULL_WITH_REASON\"},\"scope\":{\"owner\":\"SERVER_DERIVED_ACTIVE_LINKED_FIREBASE_PLAYER\",\"project\":\"age-of-friends-staging\",\"readOnly\":true,\"request\":\"EMPTY_OBJECT\",\"visibility\":\"OWNER_ONLY\"},\"sourceEvidenceVersion\":\"AOF_SOC_V1_SHARED_SOURCE_EVIDENCE_1\",\"sourceRequirements\":{\"currentReadyOriginal\":true,\"duplicatePovIsOneGame\":true,\"exactGuidHashGenerationModelRevisionRoster\":true,\"independentOriginalActor\":true,\"methodQualifiedOpportunity\":true,\"oneConnectedComponentCreditPerTrackDirection\":true,\"relationshipBudgetUnit\":\"ACTOR_COUNTERPART_EVENT\",\"reputationBudgetUnit\":\"CANONICAL_BATTLE\",\"sourceAndScheduleRevalidation\":true},\"status\":\"PROPOSED\",\"withheld\":{\"acknowledgmentSynthesis\":true,\"bands\":[\"SUBSTANTIAL\"],\"defenderMethod216\":true,\"tracks\":[\"CRUELTY\",\"HOSTILITY\"],\"treachery\":true,\"weakening\":true}}\n";
export const HOSTED_POLICY_SPEC=JSON.parse(specification) as Readonly<Record<string,any>>;
const freeze=(value:any):any=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
freeze(HOSTED_POLICY_SPEC);
if(digest(Buffer.from(specification))!==HOSTED_POLICY_SHA256)throw new Error('Hosted policy specification integrity');
export const HOSTED_POLICY_PATH='privatePilotApprovals/AOF_SOC_V1A_SOURCE_BOUND_ORDINARY_GRADES_1';
const unavailable=()=>new HttpsError('failed-precondition','Private social policy is not enabled or approved.');
export function assertHostedSocialEnabled(env:NodeJS.ProcessEnv){
  const projects=[env.GCLOUD_PROJECT,env.GOOGLE_CLOUD_PROJECT].filter(Boolean);
  if(env.AOF_HOSTED_SOCIAL_PRIVATE!=='v1a'||!projects.length||projects.some(p=>p!=='age-of-friends-staging'))throw unavailable();
}
/** Future operator-provisioned record only. This implementation creates none.
 * All fields and the exact payload hash are checked again before response. */
export async function loadHostedSocialPolicy(db:any,env:NodeJS.ProcessEnv){
  assertHostedSocialEnabled(env);
  const ref=db.doc(HOSTED_POLICY_PATH),snapshot=await ref.get(),record=snapshot.data();
  const expected={schemaVersion:'AOF_SOC_V1A_PRIVATE_APPROVAL_1',status:'APPROVED',
    configurationResource:HOSTED_POLICY_SPEC.candidateVersion,configurationSha256:HOSTED_POLICY_SHA256,
    policyVersion:HOSTED_POLICY_VERSION,configurationVersion:HOSTED_POLICY_SPEC.calibration.version,
    project:'age-of-friends-staging',purpose:'OWNER_PRIVATE_NUMERICAL_PILOT',visibility:'OWNER_ONLY',
    authorizedScopes:['OWNER_PRIVATE_READ','PRIVATE_NUMERICAL_PREVIEW'],publicPublicationAllowed:false,
    officialWritesAllowed:false,entitlementGrantsAllowed:false};
  const keys=[...Object.keys(expected),'approvalRef','approvalRevision'];
  if(!record||Object.keys(record).length!==keys.length||keys.some(k=>!Object.hasOwn(record,k))||
    Object.entries(expected).some(([k,v])=>bindingDigest(record[k])!==bindingDigest(v))||
    !Number.isSafeInteger(record.approvalRevision)||record.approvalRevision<1||
    typeof record.approvalRef!=='string'||!record.approvalRef.trim()||record.approvalRef.length>500||
    /(?:7076511256|7076540849|CODE[ _-]?ONLY|PLACEHOLDER|PENDING|TODO)/i.test(record.approvalRef))throw unavailable();
  const token=(s:any)=>bindingDigest([s.data()??null,s.updateTime??null]);
  const revision=token(snapshot);
  return {version:HOSTED_POLICY_VERSION,revision,
    calibration:structuredClone(HOSTED_POLICY_SPEC.calibration) as CalibratedSocialHistoryRules,
    revalidate:async(tx:any)=>{if(token(await tx.get(ref))!==revision)
      throw new HttpsError('aborted','Private social approval changed. Refresh.');}};
}
/** Six structural method rows for the unchanged binder, only four numeric rules
 * for #139. Empty unsupported bands admit NO C/H numerical effect. */
export function hostedBinderCalibration(calibration:CalibratedSocialHistoryRules):CalibratedSocialHistoryRules{
  return {...structuredClone(calibration),rules:{...structuredClone(calibration.rules),
    E2E_PREEXISTING_VULNERABILITY_PRESSURE:{system:'REPUTATION',track:'CRUELTY',effect:'STRENGTHEN',bands:{}},
    E2E_DISTINCT_RUPTURE_ANTAGONISM:{system:'RELATIONSHIP',track:'HOSTILITY',effect:'STRENGTHEN',bands:{}}}};
}
