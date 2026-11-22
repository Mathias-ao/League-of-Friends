/** Synthetic authority for isolated tests ONLY. Not a runtime approval, seed,
 * owner signature or usable reference. No cloud test imports this fixture. */
import {HOSTED_POLICY_SHA256,HOSTED_POLICY_SPEC,HOSTED_POLICY_VERSION} from '../../lib/integration/hostedSocialPolicy.js';
export function controlledHostedApproval(){return {
 schemaVersion:'AOF_SOC_V1A_PRIVATE_APPROVAL_1',status:'APPROVED',
 approvalRef:'https://github.com/Mathias-ao/League-of-Friends/issues/246#issuecomment-1',
 approvalRevision:1,configurationResource:HOSTED_POLICY_SPEC.candidateVersion,
 configurationSha256:HOSTED_POLICY_SHA256,policyVersion:HOSTED_POLICY_VERSION,
 configurationVersion:HOSTED_POLICY_SPEC.calibration.version,project:'age-of-friends-staging',
 purpose:'OWNER_PRIVATE_NUMERICAL_PILOT',visibility:'OWNER_ONLY',
 authorizedScopes:['OWNER_PRIVATE_READ','PRIVATE_NUMERICAL_PREVIEW'],
 publicPublicationAllowed:false,officialWritesAllowed:false,entitlementGrantsAllowed:false,
};}
