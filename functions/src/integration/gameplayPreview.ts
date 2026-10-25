import type {PendingGrade} from '../domain/gameplayPreview.js';
import {readFileSync} from 'node:fs';
import type {SourceSnapshot,Claim,Inference} from '../domain/socialV1.js';
import {validateSharedRecord} from '../domain/socialV1Validation.js';
import {bindingDigest} from '../engines/nativeRecordingIntegration.js';
import {evaluateHistory,type CalibratedSocialHistoryRules,type AdmittedEffect,type HistoricalChapter} from '../engines/socialV1History/history.js';

export const C1_VERSION='AOF_INT_C1_PRIVATE_PREVIEW_1';
export const GRADE_ENVELOPE='AOF_INT_C1_PENDING_GRADE_ENVELOPE_1';
// Explicit existing-test fixture, not owner rules, grade methods or product defaults.
const test=JSON.parse(readFileSync(new URL('./intC1WiringTest.json',import.meta.url),'utf8'));
export const C1_TEST_POLICY_DIGEST=bindingDigest(test);
const fail=()=>{throw new Error('Invalid source-bound C1 worker preview');};
const same=(a:unknown,b:unknown)=>bindingDigest(a)===bindingDigest(b);
const safeId=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=500;
const metricFacets:Record<string,string>={DIRECTED_PRESSURE_REQUEST:'ECONOMY_PRESSURE',DIRECTED_TARGET_COMMAND:'TARGETED_COMMAND',
  DEFENSIVE_PARTICIPATION_REQUEST:'DEFENSIVE_PARTICIPATION',REINFORCEMENT_REQUEST:'REINFORCEMENT_COMMANDS'};
export function validateC1Worker(raw:any,source:SourceSnapshot,statistics:any,processorRevision:string){
  if(raw?.version!=='AOF_INT_C1_WORKER_PREVIEW_1'||raw.authorityRevision!==source.authorityRevision||
    !/^[a-f0-9]{64}$/.test(processorRevision)||raw.processorRevision!==processorRevision||
    raw.sourceHash!==source.sourceHash||raw.testPolicyDigest!==C1_TEST_POLICY_DIGEST||raw.contextVersion!=='AOF_SOCIAL_V1_CONTEXT_V2'||
    !/^[a-f0-9]{64}$/.test(raw.sourceContextRevision)||raw.officialWrites!==false||raw.publicationAllowed!==false||
    raw.gradeMethodsInstalled!==false||!Array.isArray(raw.actorWitnesses)||raw.actorWitnesses.length||
    !Array.isArray(raw.grades)||raw.grades.length>1000||!Array.isArray(raw.effects)||raw.effects.length>10000||!Array.isArray(raw.inferences))fail();
  const required=['version','candidateId','sourceAuthority','sourceContextRevision','sourceDeedId','incidentId','contributionGroupId',
    'actorPlayerId','counterpartPlayerId','actorReplaySlot','counterpartReplaySlot','metricId','measurementMethodVersion','raw','window',
    'firstSourceMoment','sourceEventIds','meaning','coverage','grade','counterevidenceRefs','missing'].sort();
  const grades:PendingGrade[]=raw.grades;
  const candidateIds=new Set<string>();
  for(const g of grades){
    if(!same(Object.keys(g).sort(),required)||g.version!==GRADE_ENVELOPE||g.sourceAuthority!==source.authorityRevision||
      g.sourceContextRevision!==raw.sourceContextRevision||candidateIds.has(g.candidateId)||
      ![g.candidateId,g.sourceDeedId,g.incidentId,g.contributionGroupId].every(safeId)||
      g.actorPlayerId!==source.roster.find(p=>p.replaySlot===g.actorReplaySlot)?.playerId||
      g.counterpartPlayerId!==source.roster.find(p=>p.replaySlot===g.counterpartReplaySlot)?.playerId||g.actorPlayerId===g.counterpartPlayerId||
      g.measurementMethodVersion!=='AOF_SOCIAL_SOURCE_EPISODE_COMMANDS_1'||!metricFacets[g.metricId]||
      g.coverage!=='LIMITED'||g.meaning!=='OBSERVED_COMMANDS_AND_INFERRED_PAIR_ATTRIBUTION'||
      !same(Object.keys(g.raw).sort(),['opportunity','unit','value'])||g.raw.opportunity!==null||g.raw.unit!=='RECORDED_COMMAND_REQUESTS'||
      !Number.isSafeInteger(g.raw.value)||g.raw.value<1||
      !same(g.grade,{status:'PENDING',methodVersion:null,ruleVersion:null,bandId:null,
        reasonCodes:['GRADE_METHOD_AND_OWNER_MATRIX_PENDING','COMMAND_EXECUTION_NOT_PROVEN']})||
      !Array.isArray(g.sourceEventIds)||g.sourceEventIds.length!==g.raw.value||new Set(g.sourceEventIds).size!==g.sourceEventIds.length||
      !Array.isArray(g.counterevidenceRefs)||g.counterevidenceRefs.length||!Array.isArray(g.missing)||g.missing.some(x=>!safeId(x))||
      !Number.isSafeInteger(g.window.startMs)||!Number.isSafeInteger(g.window.endMs)||g.window.startMs<0||g.window.endMs<g.window.startMs||
      !Number.isSafeInteger(g.firstSourceMoment.recordingAtMs)||g.firstSourceMoment.recordingAtMs<g.window.startMs||g.firstSourceMoment.recordingAtMs>g.window.endMs||
      !['ORDERED','PARTIAL'].includes(g.firstSourceMoment.order)||
      (g.firstSourceMoment.order==='ORDERED'?!Number.isSafeInteger(g.firstSourceMoment.operationOrdinal):g.firstSourceMoment.operationOrdinal!==null))fail();
    const deed=statistics.pairSocialEvidence?.deeds?.find((d:any)=>d.deedId===g.sourceDeedId);
    if(!deed?.facets?.some((f:any)=>f.kind===metricFacets[g.metricId]&&f.fromPlayerId===g.actorReplaySlot&&
      f.toPlayerId===g.counterpartReplaySlot&&same([...f.sourceEventIds].sort(),[...g.sourceEventIds].sort())))fail();
    candidateIds.add(g.candidateId);
  }
  const inferences:Inference[]=raw.inferences.map((i:any)=>validateSharedRecord('Inference',i));
  for(const inf of inferences)if(inf.decision!=='PENDING'||inf.significanceBandId!==null||inf.coverage.tier!=='LIMITED'||
    !same(inf.policy,test.qualifier.policy)||!source.roster.some(p=>p.playerId===inf.action.actorPlayerId)||
    !source.roster.some(p=>p.playerId===inf.action.counterpartPlayerId)||!inf.reasonCodes.includes('GRADE_METHOD_AND_OWNER_MATRIX_PENDING'))fail();
  const effects:AdmittedEffect[]=raw.effects;
  const claims=new Set<string>();
  for(const effect of effects){
    const c=validateSharedRecord('Claim',effect.claim),i=inferences.find(i=>c.supportRefs.some(r=>r.kind==='INFERENCE'&&r.id===i.inferenceId));
    if(claims.has(c.claimId)||effect.battleId!==source.battleId||effect.gameId!==source.gameId||effect.eventId!==source.eventId||
      effect.sourceAuthority!==source.authorityRevision||c.decision!=='PENDING'||c.significanceBandId!==null||
      !same(c.policy,test.qualifier.policy)||c.reciprocity.decision!=='INELIGIBLE'||c.reciprocity.independentActorRefs.length||!i||
      !grades.some(g=>g.incidentId===c.incidentId&&g.contributionGroupId===c.contributionKey&&g.actorPlayerId===i.action.actorPlayerId&&g.counterpartPlayerId===i.action.counterpartPlayerId)||
      (c.subject.system==='REPUTATION'?c.subject.playerId!==i.action.actorPlayerId:
        c.subject.fromPlayerId!==i.action.actorPlayerId||c.subject.toPlayerId!==i.action.counterpartPlayerId))fail();
    claims.add(c.claimId);
  }
  return {grades,inferences,effects};
}

export function projectC1History(owner:string,sources:Array<{source:SourceSnapshot;preview:ReturnType<typeof validateC1Worker>}>,inputDigest:string){
  const owned=(c:Claim)=>c.subject.system==='REPUTATION'?c.subject.playerId===owner:c.subject.fromPlayerId===owner;
  const effects=sources.flatMap(s=>s.preview.effects.filter(e=>owned(e.claim)));
  const chapters:HistoricalChapter[]=sources.map(s=>({battleId:s.source.battleId,matchId:s.source.matchId,gameId:s.source.gameId,
    gameGuid:s.source.gameGuid,eventId:s.source.eventId,seasonId:s.source.seasonId,sourceAuthority:s.source.authorityRevision,
    revision:s.source.statisticsRevision,state:'READY',order:null}));
  // Existing #139 is the ONLY allocator/evaluator. No inferred league chronology,
  // approved registry or witnesses are supplied by this wiring-only preview.
  const history=evaluateHistory({chapters,effects,actorWitnesses:[],calibration:test.history as CalibratedSocialHistoryRules,trustedApprovals:[]});
  if(history.publicationAllowed||history.officialWrites||history.receipts.length||history.projections.length||history.consumption.length)fail();
  return {version:C1_VERSION,visibility:'OWNER_ONLY' as const,ownerPlayerId:owner,inputDigest,
    simulation:{status:'UNAPPROVED_TEST_ONLY' as const,version:test.version,policyDigest:C1_TEST_POLICY_DIGEST},
    grades:sources.flatMap(s=>s.preview.grades.filter(g=>g.actorPlayerId===owner)),
    inferences:sources.flatMap(s=>s.preview.inferences.filter(i=>i.action.actorPlayerId===owner)),claims:effects.map(e=>e.claim),
    history:{version:history.version,inputDigest:history.inputDigest,projectionRevision:history.projectionRevision,
      publicationAllowed:false as const,officialWrites:false as const,projections:[],receipts:[],audit:history.audit},
    status:'PENDING' as const,reasonCodes:['GRADE_METHOD_AND_OWNER_MATRIX_PENDING','LEAGUE_ORDER_NOT_ADMITTED'],
    effects:{officialWrites:false as const,receiptPublication:false as const,entitlementGrants:false as const}};
}
