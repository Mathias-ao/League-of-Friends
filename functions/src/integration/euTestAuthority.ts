/** Read-only EU test authorization. These are trusted, separately provisioned
 * owner assertions, not signatures verified against GitHub by this reader. */
import {HttpsError} from 'firebase-functions/v2/https';
import {isolatedStagingProject} from '../config/stagingProject.js';
import {bindingDigest} from '../engines/nativeRecordingIntegration.js';
import {EU_TEST_D2,EU_TEST_R} from './euTestPolicyResource.js';

export const EU_TEST_FLAG='AOF_EU_TEST_PROGRESSION';
const sha=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const ref=(v:unknown):v is string=>typeof v==='string'&&v.trim()===v&&v.length>0&&v.length<=500;
const unavailable=()=>new HttpsError('failed-precondition','EU test policy or runtime authorization is unavailable.');
const exact=(record:any,expected:Record<string,unknown>,extra:string[])=>!!record&&typeof record==='object'&&!Array.isArray(record)&&
  Object.keys(record).length===Object.keys(expected).length+extra.length&&extra.every(k=>Object.hasOwn(record,k))&&
  Object.entries(expected).every(([k,v])=>bindingDigest(record[k])===bindingDigest(v));
const revision=(v:any)=>Number.isSafeInteger(v)&&v>=1;
export function assertEuTestEnabled(env:NodeJS.ProcessEnv){
  if(env[EU_TEST_FLAG]!=='v1'||!isolatedStagingProject(env,false)||!sha(env.AOF_NATIVE_REPLAY_PROCESSOR_REVISION))throw unavailable();
}
export async function loadEuTestAuthority(db:any,env:NodeJS.ProcessEnv,kind:'D2'|'R'){
  assertEuTestEnabled(env);
  const resource=kind==='D2'?EU_TEST_D2:EU_TEST_R;
  const common={resourceId:resource.spec.id,resourceSha256:resource.sha256,status:'APPROVED',
    project:resource.spec.project,region:resource.spec.region,purpose:resource.spec.purpose,visibility:'OWNER_ONLY',
    publicPublicationAllowed:false,officialWritesAllowed:false,entitlementGrantsAllowed:false};
  const policyRef=db.doc(resource.policyPath),runtimeRef=db.doc(resource.runtimePath);
  const [policySnap,runtimeSnap]=await Promise.all([policyRef.get(),runtimeRef.get()]);
  const policy=policySnap.data(),runtime=runtimeSnap.data();
  // The actual NEW owner decision must be recorded on #269; old D2/R approval
  // URLs, copied APPROVED records and the work-order URL itself are insufficient.
  if(!exact(policy,{...common,version:'AOF_EU_TEST_POLICY_APPROVAL_1'},['approvalRef','revision'])||
    !revision(policy.revision)||typeof policy.approvalRef!=='string'||
    !/^https:\/\/github\.com\/Mathias-ao\/League-of-Friends\/issues\/269#issuecomment-[1-9][0-9]*$/.test(policy.approvalRef))throw unavailable();
  if(!exact(runtime,{...common,version:'AOF_EU_TEST_RUNTIME_APPROVAL_1',policyApprovalRef:policy.approvalRef,
    policyRevision:policy.revision,processorRevision:env.AOF_NATIVE_REPLAY_PROCESSOR_REVISION},
    ['runtimeApprovalRef','revision','sourceReviews'])||!revision(runtime.revision)||
    typeof runtime.runtimeApprovalRef!=='string'||runtime.runtimeApprovalRef===policy.approvalRef||
    !/^https:\/\/github\.com\/Mathias-ao\/League-of-Friends\/issues\/(?:264|269)#issuecomment-[1-9][0-9]*$/.test(runtime.runtimeApprovalRef)||
    !runtime.sourceReviews||typeof runtime.sourceReviews!=='object'||Array.isArray(runtime.sourceReviews)||
    Object.keys(runtime.sourceReviews).length>64||Object.keys(runtime.sourceReviews).some(k=>!sha(k)))throw unavailable();
  const token=(s:any)=>bindingDigest([s.data()??null,s.updateTime??null]);
  const policyToken=token(policySnap),runtimeToken=token(runtimeSnap);
  return {resource,approvalRef:policy.approvalRef as string,sourceReviews:structuredClone(runtime.sourceReviews) as Record<string,any>,
    revision:bindingDigest([policyToken,runtimeToken]),processorRevision:runtime.processorRevision as string,
    revalidate:async(tx:any)=>{
      if(token(await tx.get(policyRef))!==policyToken||token(await tx.get(runtimeRef))!==runtimeToken)
        throw new HttpsError('aborted','EU test policy or runtime approval changed. Refresh.');
    }};
}
/** Binds the private attestation to all current source artifacts, roster,
 * correction, schedule and producer. Missing proof never fabricates evidence. */
export function euTestSourceFingerprint(source:any,sourceAttestationRevision:unknown):string|null{
  if(!sha(sourceAttestationRevision))return null;
  const {authorityRevision:_ownerReadRevision,...evidence}=source;
  return bindingDigest([evidence,sourceAttestationRevision]);
}
export function euTestSourceReview(authority:Awaited<ReturnType<typeof loadEuTestAuthority>>,source:any,
  producerRevision:unknown,sourceAttestationRevision:unknown){
  const review=authority.sourceReviews[source.sourceHash];
  const fingerprint=euTestSourceFingerprint(source,sourceAttestationRevision);
  return !!fingerprint&&producerRevision===authority.processorRevision&&review&&review.sourceFingerprint===fingerprint&&
    review.producer?.processorRevision===authority.processorRevision&&sha(review.producer?.imageSha256)&&
    ref(review.producer?.referenceId)?review:null;
}
export function euTestCostReviewQualified(review:any,statistics:any){
  const p=review?.producer,c=review?.costCatalog,a=review?.positiveRequestCoverage;
  return !!c&&p?.selectedCatalogSha256===c.sha256&&p?.selectedCatalogVersion===c.version&&
    c.version===statistics.entityCatalogVersion&&p?.gameBuild===c.gameBuild&&
    ['NO_OVERRIDE','EXACT_REVIEWED_OVERRIDE'].includes(p?.catalogSelection)&&ref(p?.catalogSelectionRef)&&
    a?.status==='COMPLETE_OBSERVED_POSITIVE_REQUEST_COVERAGE'&&a?.sourceFingerprint===review.sourceFingerprint&&
    a?.catalogSha256===c.sha256&&ref(a?.referenceId);
}
