/** CONTROLLED in-memory authority/producer assertions. No actual owner
 * approval, immutable producer attestation, cloud records or hosted E2E proof. */
import {EU_TEST_D2,EU_TEST_R} from '../../lib/integration/euTestPolicyResource.js';
import {bindingDigest} from '../../lib/engines/nativeRecordingIntegration.js';
export {EU_TEST_D2,EU_TEST_R};
export const euEnv=base=>({...base,GCLOUD_PROJECT:'age-of-friends-staging-eu',GOOGLE_CLOUD_PROJECT:'age-of-friends-staging-eu',
  AOF_NATIVE_REPLAY_PROJECT:'age-of-friends-staging-eu',FUNCTION_REGION:'europe-west1',FUNCTIONS_EMULATOR:'false',
  AOF_EU_TEST_PROGRESSION:'v1',AOF_PERSONALITY_PRIVATE_POLICY:'practical-v1',AOF_HOSTED_SOCIAL_PRIVATE:'v1a',
  AOF_NATIVE_REPLAY_PROCESSOR_REVISION:base?.AOF_NATIVE_REPLAY_PROCESSOR_REVISION??'c'.repeat(64)});
export function authorityRecords(resource,env,sourceReviews={}){
 const common={resourceId:resource.spec.id,resourceSha256:resource.sha256,status:'APPROVED',project:resource.spec.project,
  region:resource.spec.region,purpose:resource.spec.purpose,visibility:'OWNER_ONLY',
  publicPublicationAllowed:false,officialWritesAllowed:false,entitlementGrantsAllowed:false};
 const policy={...common,version:'AOF_EU_TEST_POLICY_APPROVAL_1',
  approvalRef:'https://github.com/Mathias-ao/League-of-Friends/issues/269#issuecomment-999000001',revision:1};
 const runtime={...common,version:'AOF_EU_TEST_RUNTIME_APPROVAL_1',policyApprovalRef:policy.approvalRef,policyRevision:1,
  processorRevision:env.AOF_NATIVE_REPLAY_PROCESSOR_REVISION,
  runtimeApprovalRef:'https://github.com/Mathias-ao/League-of-Friends/issues/264#issuecomment-999000002',revision:1,sourceReviews};
 return {policy,runtime};
}
export function installAuthority(rows,resource,env,sourceReviews={}){
 const records=authorityRecords(resource,env,sourceReviews);
 rows.set(resource.policyPath,records.policy);rows.set(resource.runtimePath,records.runtime);return records;
}
export function attest(source,env,review={}){
 const sourceFingerprint=bindingDigest(source);
 return {...review,sourceFingerprint,producer:{processorRevision:env.AOF_NATIVE_REPLAY_PROCESSOR_REVISION,
   imageSha256:'a'.repeat(64),referenceId:'CONTROLLED_PRODUCER_ATTESTATION',gameBuild:review.gameBuild,
   selectedCatalogSha256:review.costCatalog?.sha256,selectedCatalogVersion:review.costCatalog?.version,
   catalogSelection:'NO_OVERRIDE',catalogSelectionRef:'CONTROLLED_EXACT_BUILD_CATALOG_SELECTION'},
  positiveRequestCoverage:{status:'COMPLETE_OBSERVED_POSITIVE_REQUEST_COVERAGE',sourceFingerprint,
   catalogSha256:review.costCatalog?.sha256,referenceId:'CONTROLLED_OBSERVED_REQUEST_REVIEW'}};
}
