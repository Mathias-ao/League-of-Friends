/** Authenticated wrapper owns authority; #167 owns grade methods; #139 alone
 * owns allocation. This adapter never supplies calibration or trusted approvals. */
import {readFileSync} from 'node:fs';
import {Ajv2020} from 'ajv/dist/2020.js';
import type {SourceSnapshot,Claim,Inference,Ref,Subject} from '../domain/socialV1.js';
import {validateSharedRecord} from '../domain/socialV1Validation.js';
import {bindingDigest} from '../engines/nativeRecordingIntegration.js';
import {validateC2AWorker} from './gameplayCandidates.js';
import type {SocialScheduleOrder} from './socialScheduleOrder.js';
import {evaluateHistory,type CalibratedSocialHistoryRules,type AdmittedEffect,type HistoricalChapter,type ActorConductWitness} from '../engines/socialV1History/history.js';
type Bag=Record<string,any>;
export const PRIVATE_PROGRESSION_VERSION='AOF_SOCIAL_E2E_PRIVATE_PROGRESSION_1';
export const CREDIT_VERSION='AOF_SOCIAL_E2E_CREDIT_IDENTITY_1';
const ADAPTER='AOF_SOCIAL_E2E_CLAIM_ADAPTER_1';
const METHODS='AOF_SOC_V1E_BOUNDED_GRADE_METHODS_1';
const schema=JSON.parse(readFileSync(new URL('./sourceGradeMethods.schema.json',import.meta.url),'utf8'));
const validate=new Ajv2020({strict:false,strictNumbers:true}).compile<Bag>(schema);
function fail():never{throw new Error('Source-grade integration binding mismatch');}
const same=(a:unknown,b:unknown)=>bindingDigest(a)===bindingDigest(b);
const known:Record<string,[string,string,string,string]>={
 RIVALRY:['RELATIONSHIP','AOF_SV1E_PAIR_RAID_ENGAGEMENT_CONTEST_1','PAIR_CONTEST','E2E_PAIR_CONTEST'],
 BOND:['RELATIONSHIP','AOF_SV1E_THREAT_LINKED_DIRECTED_HELP_1','DIRECTED_HELP','E2E_DIRECTED_HELP'],
 CHIVALRY:['REPUTATION','AOF_SV1E_NOTEWORTHY_THREAT_PROTECTION_1','NOTEWORTHY_DIRECTED_PROTECTION','E2E_NOTEWORTHY_DIRECTED_PROTECTION'],
 GALLANTRY:['REPUTATION','AOF_SV1E_CHALLENGED_RETURN_PRESSURE_1','DARING_OFFENSE','E2E_DARING_OFFENSE'],
 CRUELTY:['REPUTATION','AOF_SV1E_PREENTRY_DISADVANTAGE_PRESSURE_PENDING_1','PREEXISTING_VULNERABILITY_PRESSURE','E2E_PREEXISTING_VULNERABILITY_PRESSURE'],
 HOSTILITY:['RELATIONSHIP','AOF_SV1E_SELECTIVE_ANTAGONISM_PENDING_1','DISTINCT_RUPTURE_ANTAGONISM','E2E_DISTINCT_RUPTURE_ANTAGONISM']};
export function bindSourceGrades(raw:Bag,source:SourceSnapshot,statistics:Bag,processorRevision:string,schedule:SocialScheduleOrder|undefined,gameNumber:number,calibration:CalibratedSocialHistoryRules){
 if(!same(Object.keys(raw).sort(),['admission','compatibility','gradeWitnesses','inputModel','version'])||raw.version!=='AOF_SOCIAL_E2E_WORKER_1'||
  raw.inputModel!=='AOF_DIRECT_SHARED_EPISODES_V1_EXPERIMENTAL'||!Array.isArray(raw.gradeWitnesses)||raw.gradeWitnesses.length>20000)fail();
 if(!Number.isSafeInteger(gameNumber)||gameNumber<1)fail();
 const bound=validateC2AWorker(raw.compatibility,source,statistics,processorRevision),doc=raw.admission,producer=raw.compatibility.producer;
 if(!validate(doc)||doc.version!==METHODS||doc.producerProjectionRevision!==producer.projectionRevision||
  !same(doc.gameScope,producer.gameScope)||!same(doc.sourceRevision,producer.sourceRevision)||doc.sourceContextRevision!==producer.sourceContextRevision||
  doc.sourceMeasurementsRevision!==producer.sourceMeasurementsRevision||doc.originalProducerVersion!==producer.version||
  doc.policy.minOriginalCommands!==2||doc.policy.maxPreentryMs!==90000||doc.episodes.length!==bound.episodes.length||
  doc.projectionRevision!==bindingDigest([METHODS,doc.policy,doc.producerProjectionRevision,doc.episodes])||
  calibration.policy.status!=='PROPOSED'||calibration.policy.approvalRef!==null)fail();
 for(const [track,spec] of Object.entries(known)){const r=doc.sourceMethodRegistry[track];
  if(!r||!same([r.methodVersion,r.familyId,r.ruleId],[spec[1],spec[2],spec[3]])||r.sourceMethodVersion!=='AOF_SOCIAL_SOURCE_EPISODE_COMMANDS_1')fail();}
 const witnesses=new Map<string,Bag>();
 for(const w of raw.gradeWitnesses){
  if(!same(Object.keys(w).sort(),['action','actorReplaySlot','atMs','operationOrdinal','sourceEventId'])||typeof w.sourceEventId!=='string'||
   witnesses.has(w.sourceEventId)||!source.roster.some(p=>p.replaySlot===w.actorReplaySlot)||!Number.isSafeInteger(w.atMs)||w.atMs<0||w.atMs>statistics.scope.observedUntilMs||
   w.operationOrdinal!==null&&(!Number.isSafeInteger(w.operationOrdinal)||w.operationOrdinal<0)||w.action!==null&&typeof w.action!=='string')fail();
  witnesses.set(w.sourceEventId,w);
 }
 // Same verified original event may appear in both proof envelopes, never disagree.
 for(const w of raw.compatibility.sourceWitnesses)if(witnesses.has(w.sourceEventId)&&!same(w,witnesses.get(w.sourceEventId)))fail();
 const effects:AdmittedEffect[]=[],inferences:Inference[]=[],actorWitnesses:ActorConductWitness[]=[],cards:Bag[]=[];
 const seen=new Set<string>();
 for(const e of doc.episodes){
  const b=bound.episodes.find(b=>b.candidate.candidateId===e.sourceCandidateId);if(!b||seen.has(e.sourceCandidateId))fail();seen.add(e.sourceCandidateId);
  const c=b.candidate;
  if(e.sourceIndependentContributionKey!==c.independentContributionKey||!same(e.gameScope,producer.gameScope)||
   !same(e.sourceRevision,producer.sourceRevision)||e.sourceContextRevision!==producer.sourceContextRevision||e.sourceMeasurementsRevision!==producer.sourceMeasurementsRevision||
   e.actorReplayPlayerId!==c.actorReplayPlayerId||e.counterpartReplayPlayerId!==c.counterpartReplayPlayerId||
   !same(e.sourceDeedIds,c.sourceDeedIds)||!same(e.sourceEventIds,c.sourceEventIds)||!same(e.sourcePosition,c.firstSourceMoment))fail();
  // New, explicit credit namespace over the accepted #165 transitive component.
  // Legacy and producer keys remain provenance, never silently aliased.
  const contributionKey='e2e-credit-'+bindingDigest([CREDIT_VERSION,source.battleId,source.gameId,source.gameGuid,source.sourceHash,
   b.compatibility.componentId,b.binding.actorPlayerId,b.binding.counterpartPlayerId]);
  const incidentId='e2e-incident-'+bindingDigest([CREDIT_VERSION,contributionKey]);
  const incidentRevision=bindingDigest([source,b.binding.bindingRevision,doc.projectionRevision,schedule??null]);
  const trackSet=new Set<string>();
  for(const g of e.perTrackGrades){
   const spec=known[g.track];if(!spec||trackSet.has(g.track)||!same([g.system,g.methodVersion,g.familyId,g.pilotRuleId],spec)||
    g.sourceMethodVersion!=='AOF_SOCIAL_SOURCE_EPISODE_COMMANDS_1'||g.actorReplayPlayerId!==e.actorReplayPlayerId||g.counterpartReplayPlayerId!==e.counterpartReplayPlayerId||
    g.independentContributionKey!==e.sourceIndependentContributionKey||g.sourceEventIds.some((id:string)=>!c.sourceEventIds.includes(id))||
    !same(g.originalPosition,c.firstSourceMoment))fail();trackSet.add(g.track);
   const own=g.sourceEventIds.map((id:string)=>{const w=witnesses.get(id);if(!w||w.actorReplaySlot!==e.actorReplayPlayerId)fail();return w!;});
   for(const proof of g.corroboration)for(const id of proof.sourceEventIds)if(!witnesses.has(id))fail();
   const admitted=g.decision==='SOURCE_ADMITTED';
   if(admitted&&(g.track==='CRUELTY'||g.track==='HOSTILITY'||own.length<2||new Set(g.sourceEventIds).size!==own.length||
    own.some((w:Bag)=>w.operationOrdinal===null||w.action===null||['STOP','DE_STOP','CANCEL','DE_CANCEL'].includes(w.action))||!g.corroboration.length||
    g.gradeBandId!=='ORDINARY'||g.methodCoverage!=='ADMITTED'||g.sourceCoverage!=='LIMITED'||g.missingEvidence.length||
    c.firstSourceMoment.order!=='ORDERED'))fail();
   const rule=calibration.rules[g.pilotRuleId];if(!rule||rule.system!==g.system||rule.track!==g.track||rule.effect!=='STRENGTHEN'||!(g.gradeBandId===null||g.gradeBandId in rule.bands))fail();
   const sourceRef:Ref=own.length?{kind:'SOURCE_EVENT',id:own[0].sourceEventId,revision:source.authorityRevision,
    digest:bindingDigest([source.artifactRefs,own[0]])}:{kind:'SOURCE_DEED',id:c.sourceDeedIds[0],revision:source.authorityRevision,digest:bindingDigest([source.artifactRefs,c.sourceDeedIds])};
   const methodRef:Ref={kind:'CONTEXT',id:g.methodVersion,revision:doc.projectionRevision,digest:bindingDigest([doc.policy,g])};
   const inf:Inference={inferenceId:bindingDigest([ADAPTER,incidentRevision,c.candidateId,g]),incidentRevision,modelVersion:ADAPTER,
    policy:calibration.policy,familyId:g.familyId,basis:'BOUNDED_INFERENCE',decision:admitted?'QUALIFIED':'PENDING',
    action:{actorPlayerId:b.binding.actorPlayerId,counterpartPlayerId:b.binding.counterpartPlayerId},supportRefs:[sourceRef,methodRef],
    contextBeforeRefs:[],counterevidenceRefs:[],priorHistoryDigest:null,significanceBandId:admitted?g.gradeBandId:null,
    coverage:{tier:admitted?'ADMITTED':'LIMITED',ruleId:g.methodVersion,missing:g.missingEvidence,
     limitations:['ORIGINAL_OBSERVATIONS_REMAIN_LIMITED','BOUNDED_INFERRED_COMMITMENT_NOT_EXECUTED_RESULT','PRIVATE_PROPOSED_SIMULATION_ONLY']},reasonCodes:g.reasonCodes};
   validateSharedRecord('Inference',inf);inferences.push(inf);
   const subject:Subject=g.system==='REPUTATION'?{system:'REPUTATION',track:g.track,playerId:b.binding.actorPlayerId}:
    {system:'RELATIONSHIP',track:g.track,fromPlayerId:b.binding.actorPlayerId,toPlayerId:b.binding.counterpartPlayerId};
   const claimId='e2e-claim-'+bindingDigest([contributionKey,c.candidateId,subject,g.pilotRuleId]);
   const claim:Claim={claimId,claimRevision:bindingDigest([claimId,inf]),incidentId,incidentRevision,subject,effect:rule.effect,
    basis:'BOUNDED_INFERENCE',ruleId:g.pilotRuleId,policy:calibration.policy,decision:inf.decision,
    supportRefs:[sourceRef,methodRef,{kind:'INFERENCE',id:inf.inferenceId,revision:incidentRevision,digest:bindingDigest(inf)}],
    significanceBandId:inf.significanceBandId,contributionKey,
    historicalPosition:{leagueOrderKey:schedule?.order?.key??null,gameNumber,
     recordingAtMs:c.firstSourceMoment.recordingAtMs,operationOrdinal:c.firstSourceMoment.operationOrdinal,
     order:schedule?.order?'ORDERED':'UNKNOWN'},
    reciprocity:{decision:admitted&&g.system==='RELATIONSHIP'?'ELIGIBLE':'INELIGIBLE',ruleId:'OWN_ORIGINAL_QUALIFIED_ACTOR_ONLY',
     independentActorRefs:admitted&&g.system==='RELATIONSHIP'?[sourceRef]:[]}};
   validateSharedRecord('Claim',claim);
   effects.push({claim,battleId:source.battleId,gameId:source.gameId,eventId:source.eventId,sourceAuthority:source.authorityRevision});
   if(admitted&&g.system==='RELATIONSHIP')actorWitnesses.push({claimId,incidentId,battleId:source.battleId,
    actorPlayerId:b.binding.actorPlayerId,qualification:'QUALIFIED',ref:sourceRef});
   cards.push({battleId:source.battleId,gameId:source.gameId,sourceAuthority:source.authorityRevision,
    actorPlayerId:b.binding.actorPlayerId,counterpartPlayerId:b.binding.counterpartPlayerId,track:g.track,
    decision:g.decision,gradeBandId:g.gradeBandId,sourceCoverage:g.sourceCoverage,methodCoverage:g.methodCoverage,
    methodVersion:g.methodVersion,meaning:g.materialMeaning,missingEvidence:g.missingEvidence,reasonCodes:g.reasonCodes,
    originalPosition:g.originalPosition,originalEventCount:g.sourceEventIds.length,originalWitness:sourceRef,
    corroboration:g.corroboration.map((p:Bag)=>({kind:p.kind,sourceDetectorId:p.sourceDetectorId,originalEventCount:p.sourceEventIds.length})),
    identity:{version:CREDIT_VERSION,contributionKey,componentId:b.compatibility.componentId,producerKey:b.compatibility.producerKey,
     legacyContributionKeys:b.compatibility.legacyContributionKeys,sourceDeedIds:b.compatibility.sourceDeedIds,sourceIncidentIds:b.compatibility.sourceIncidentIds,
     keySubstitutionAllowed:false},claimId,claimRevision:claim.claimRevision});
  }
  if(trackSet.size!==6||!same([...e.eligibleSourceMethods].sort(),e.perTrackGrades.filter((g:Bag)=>g.decision==='SOURCE_ADMITTED').map((g:Bag)=>g.methodVersion).sort()))fail();
 }
 if(doc.sourceAdmittedCount!==cards.filter(c=>c.decision==='SOURCE_ADMITTED').length)fail();
 return {effects,inferences,actorWitnesses,cards,source,sourceMethodRevision:doc.projectionRevision};
}
export function simulatePrivateProgression(owner:string,inputs:ReturnType<typeof bindSourceGrades>[],chapters:HistoricalChapter[],calibration:CalibratedSocialHistoryRules,pending:Bag[],inputDigest:string){
 if(calibration.policy.status!=='PROPOSED'||calibration.policy.approvalRef!==null)fail();
 const effects=inputs.flatMap(i=>i.effects),history=evaluateHistory({chapters,effects,actorWitnesses:inputs.flatMap(i=>i.actorWitnesses),calibration,trustedApprovals:[]});
 if(history.publicationAllowed||history.officialWrites||history.receipts.length)fail();
 const owned=(s:Subject)=>s.system==='REPUTATION'?s.playerId===owner:s.fromPlayerId===owner;
 const claims=effects.map(e=>e.claim).filter(c=>owned(c.subject));
 const incidents=new Set(claims.map(c=>c.incidentId)),claimIds=new Set(claims.map(c=>c.claimId));
 return {version:PRIVATE_PROGRESSION_VERSION,visibility:'OWNER_ONLY' as const,ownerPlayerId:owner,inputDigest,
  simulation:{status:'PRIVATE_PROPOSED_SIMULATION_ONLY' as const,policy:calibration.policy,calibrationVersion:calibration.version},
  cards:inputs.flatMap(i=>i.cards.filter(c=>c.actorPlayerId===owner)),claims,
  history:{...history,projections:history.projections.filter(p=>owned(p.subject)).map(p=>pending.length?{...p,status:'PENDING' as const,currentStage:null,pendingReasons:[...p.pendingReasons,'INCOMPLETE_CURRENT_SOURCE_HISTORY']}:p),
   consumption:history.consumption.filter(c=>incidents.has(c.incidentId)),audit:history.audit.filter(a=>a.claimId?claimIds.has(a.claimId):a.incidentId?incidents.has(a.incidentId):false)},
  pendingSources:pending,pendingMethods:['CRUELTY','HOSTILITY','INDEPENDENT_WEAKENING','STRICT_EXCEPTIONAL_TREACHERY'],
  effects:{officialWrites:false as const,receiptPublication:false as const,entitlementGrants:false as const}};
}
