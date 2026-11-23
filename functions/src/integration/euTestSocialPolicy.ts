/** EU authority only; #139's immutable internal PROPOSED rules are unchanged. */
import {HttpsError} from 'firebase-functions/v2/https';
import {loadEuTestAuthority,euTestSourceReview} from './euTestAuthority.js';
import {HOSTED_POLICY_SPEC} from './hostedSocialPolicy.js';
import type {CalibratedSocialHistoryRules} from '../engines/socialV1History/history.js';
export async function loadEuTestSocialPolicy(db:any,env:NodeJS.ProcessEnv){
  if(env.AOF_HOSTED_SOCIAL_PRIVATE!=='v1a')
    throw new HttpsError('failed-precondition','Private social policy is not enabled or approved.');
  const authority=await loadEuTestAuthority(db,env,'R');
  return {...authority,calibration:structuredClone(HOSTED_POLICY_SPEC.calibration) as CalibratedSocialHistoryRules,
    sourceQualified:(source:any,producerRevision:unknown,sourceAttestationRevision:unknown)=>
      !!euTestSourceReview(authority,source,producerRevision,sourceAttestationRevision)};
}
