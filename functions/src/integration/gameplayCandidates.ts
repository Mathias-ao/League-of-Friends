import {readFileSync} from 'node:fs';
import {Ajv2020} from 'ajv/dist/2020.js';
import type {SourceSnapshot} from '../domain/socialV1.js';
import type {PendingGrade} from '../domain/gameplayPreview.js';
import type {BoundGameplayCandidate,MetricGradeEpisode} from '../domain/gameplayCandidates.js';
import {bindingDigest,digest} from '../engines/nativeRecordingIntegration.js';
import {validateC1Worker} from './gameplayPreview.js';

export const C2A_VERSION='AOF_INT_C2A_PRIVATE_PREVIEW_1';
const PRODUCER='AOF_SOCIAL_METRIC_GRADE_CANDIDATES_1';
const schema=readFileSync(new URL('./metricGradeCandidates.schema.json',import.meta.url));
export const C2A_SCHEMA_DIGEST=digest(schema);
const validate=new Ajv2020({strict:false,strictNumbers:true}).compile<Bag>(JSON.parse(schema.toString('utf8')));
function fail():never {throw new Error('Invalid source-compatible C2A preview');}
const same=(a:unknown,b:unknown)=>bindingDigest(a)===bindingDigest(b);
const sorted=(xs:string[])=>[...new Set(xs)].sort();
const id=(x:unknown)=>typeof x==='string'&&x.length>0&&x.length<=500;
const metricKinds:Record<string,string>={AOF_ORIGINAL_TARGET_REQUEST_COUNT_V1:'DIRECTED_TARGET_COMMAND',
 AOF_ORIGINAL_ECONOMIC_PRESSURE_REQUEST_COUNT_V1:'DIRECTED_PRESSURE_REQUEST',
 AOF_ORIGINAL_DEFENSE_REQUEST_COUNT_V1:'DEFENSIVE_PARTICIPATION_REQUEST',
 AOF_ORIGINAL_REINFORCEMENT_REQUEST_COUNT_V1:'REINFORCEMENT_REQUEST'};
type Bag=Record<string,any>;
type Node={side:'C1'|'W4';key:string;actor:number;target:number;deeds:string[];events:string[];incidents:string[];grades:PendingGrade[]};
/** Two different key spaces linked by original membership, never renamed. */
export function reconcileCandidateIdentities(source:SourceSnapshot,statistics:Bag,grades:PendingGrade[],groups:MetricGradeEpisode[]){
 const deeds:Bag[]=statistics.pairSocialEvidence?.deeds??[];
 if(deeds.length>10000||new Set(deeds.map(d=>d.deedId)).size!==deeds.length)fail();
 const byDeed=new Map<string,Bag>(deeds.map(d=>[d.deedId,d]));
 // Verify the versioned C1 key using its accepted global overlap algorithm.
 const parent=deeds.map((_,i)=>i),seen=new Map<string,number>();
 const root=(p:number[],i:number):number=>{while(p[i]!==i){p[i]=p[p[i]];i=p[i];}return i;};
 const join=(p:number[],a:number,b:number)=>{a=root(p,a);b=root(p,b);p[Math.max(a,b)]=Math.min(a,b);};
 deeds.forEach((d,i)=>{for(const [kind,refs] of [['E',d.sourceEventIds],['I',d.incidentIds??[]]] as Array<[string,string[]]>)
  for(const ref of refs){const k=kind+':'+ref;if(seen.has(k))join(parent,i,seen.get(k)!);else seen.set(k,i);}});
 const members=new Map<number,string[]>();deeds.forEach((d,i)=>{const r=root(parent,i);members.set(r,[...(members.get(r)??[]),d.deedId]);});
 const expected=new Map(deeds.map((d,i)=>[d.deedId,'group-'+bindingDigest([source.gameGuid,source.sourceHash,sorted(members.get(root(parent,i))!)])]));
 const nodes:Node[]=[],legacy=new Map<string,Node>();
 for(const g of grades){
  if(expected.get(g.sourceDeedId)!==g.contributionGroupId||
    g.incidentId!=='incident-'+bindingDigest([source.gameGuid,source.sourceHash,g.sourceDeedId]))fail();
  const key=JSON.stringify([g.contributionGroupId,g.actorReplaySlot,g.counterpartReplaySlot]);
  let n=legacy.get(key);if(!n){n={side:'C1',key:g.contributionGroupId,actor:g.actorReplaySlot,target:g.counterpartReplaySlot,deeds:[],events:[],incidents:[],grades:[]};legacy.set(key,n);nodes.push(n);}
  n.grades.push(g);n.deeds.push(g.sourceDeedId);n.events.push(...g.sourceEventIds);
 }
 for(const g of groups)nodes.push({side:'W4',key:g.independentContributionKey,actor:g.actorReplayPlayerId,target:g.counterpartReplayPlayerId,
  deeds:g.sourceDeedIds,events:g.sourceEventIds,incidents:[],grades:[]});
 for(const n of nodes){n.deeds=sorted(n.deeds);n.events=sorted(n.events);n.incidents=sorted(n.deeds.flatMap(d=>{const row=byDeed.get(d);if(!row)fail();return row.incidentIds??[];}));}
 const p=nodes.map((_,i)=>i),refs=new Map<string,number>();
 nodes.forEach((n,i)=>{for(const [kind,values] of [['D',n.deeds],['E',n.events],['I',n.incidents]] as Array<[string,string[]]>)
  for(const ref of values){const k=JSON.stringify([n.actor,n.target,kind,ref]);if(refs.has(k))join(p,i,refs.get(k)!);else refs.set(k,i);}});
 return groups.map(g=>{
  const ni=nodes.findIndex(n=>n.side==='W4'&&n.key===g.independentContributionKey);
  const component=nodes.filter((_,i)=>root(p,i)===root(p,ni)),old=component.filter(n=>n.side==='C1');
  if(!old.length)fail(); // no unrelated source/identity fallback
  const result={version:'AOF_INT_C2A_EPISODE_COMPATIBILITY_1' as const,
   producerKey:g.independentContributionKey,relatedProducerKeys:sorted(component.filter(n=>n.side==='W4').map(n=>n.key)),
   legacyContributionKeys:sorted(old.map(n=>n.key)),legacyDescriptorIds:sorted(old.flatMap(n=>n.grades.map(g=>g.candidateId))),
   sourceDeedIds:sorted(component.flatMap(n=>n.deeds)),sourceIncidentIds:sorted(component.flatMap(n=>n.incidents)),
   sourceEventIds:sorted(component.flatMap(n=>n.events)),legacyIncidentIds:sorted(old.flatMap(n=>n.grades.map(g=>g.incidentId))),
   relation:'SOURCE_CONNECTED_PENDING' as const,keySubstitutionAllowed:false as const};
  const {producerKey,...membership}=result;
  return {...result,componentId:'compat-'+bindingDigest([source.battleId,source.gameId,source.gameGuid,source.sourceHash,
   g.actorReplayPlayerId,g.counterpartReplayPlayerId,membership])};
 });
}

export function validateC2AWorker(raw:Bag,source:SourceSnapshot,statistics:Bag,processorRevision:string){
 if(!same(Object.keys(raw).sort(),['legacy','priorContexts','producer','sourceWitnesses','version'])||raw.version!=='AOF_INT_C2A_WORKER_PREVIEW_1')fail();
 const legacy=validateC1Worker(raw.legacy,source,statistics,processorRevision),doc=raw.producer;
 if(!doc||typeof doc!=='object'||!Array.isArray(raw.sourceWitnesses)||raw.sourceWitnesses.length>20000||
  !Array.isArray(doc.candidateEpisodeGroups)||doc.candidateEpisodeGroups.length>1000||
  !Array.isArray(doc.neutralPlacementContexts)||doc.neutralPlacementContexts.length>4000||
  !Array.isArray(doc.neutralTributeRequestContexts)||doc.neutralTributeRequestContexts.length>20000||!validate(doc))fail();
 const scope={battleId:source.battleId,gameId:source.gameId,gameGuid:source.gameGuid,authorityRevision:source.authorityRevision};
 const rev=Object.fromEntries(['replaySha256','recordedEventsSha256','recordedEventsVersion','parserVersion'].map(k=>[k,statistics.source[k]]));
 if(!same(doc.gameScope,scope)||!same(doc.sourceRevision,rev)||doc.sourceContextRevision!==raw.legacy.sourceContextRevision||
  !/^[a-f0-9]{64}$/.test(doc.sourceMeasurementsRevision)||
  doc.projectionRevision!==bindingDigest([PRODUCER,scope,rev,doc.sourceContextRevision,doc.sourceMeasurementsRevision,
   doc.candidateEpisodeGroups,doc.neutralPlacementContexts,doc.neutralTributeRequestContexts,doc.mode]))fail();
 const witnesses=new Map<string,Bag>();
 for(const w of raw.sourceWitnesses){
  if(!same(Object.keys(w).sort(),['action','actorReplaySlot','atMs','operationOrdinal','sourceEventId'])||!id(w.sourceEventId)||
   witnesses.has(w.sourceEventId)||!source.roster.some(p=>p.replaySlot===w.actorReplaySlot)||!Number.isSafeInteger(w.atMs)||w.atMs<0||
   w.atMs>statistics.scope.observedUntilMs||w.operationOrdinal!==null&&(!Number.isSafeInteger(w.operationOrdinal)||w.operationOrdinal<0)||
   w.action!==null&&typeof w.action!=='string')fail();witnesses.set(w.sourceEventId,w);
 }
 const original=(refs:string[],actor:number)=>refs.map(r=>{const w=witnesses.get(r);if(!w||w.actorReplaySlot!==actor)fail();return w;});
 const byDeed=new Map<string,Bag>((statistics.pairSocialEvidence?.deeds??[]).map((d:Bag)=>[d.deedId,d]));
 if(!Array.isArray(raw.priorContexts)||raw.priorContexts.length!==legacy.grades.length)fail();
 const contexts=new Map<string,Bag>();
 for(const c of raw.priorContexts){
  const grade=legacy.grades.find(g=>g.candidateId===c.descriptorId),deed=byDeed.get(c.sourceDeedId);
  if(!same(Object.keys(c).sort(),['actorReplaySlot','counterpartReplaySlot','descriptorId','priorOppositeDeeds','priorSameDeeds','sourceDeedId','sourceEventIds','windowEndExclusiveMs','windowStartMs'])||
   !grade||!deed||contexts.has(c.descriptorId)||grade.sourceDeedId!==c.sourceDeedId||grade.actorReplaySlot!==c.actorReplaySlot||
   grade.counterpartReplaySlot!==c.counterpartReplaySlot||!Number.isSafeInteger(c.windowStartMs)||c.windowStartMs<0||
   c.windowStartMs>c.windowEndExclusiveMs||c.windowEndExclusiveMs!==deed.startedAt.atMs||
   ![c.sourceEventIds,c.priorSameDeeds,c.priorOppositeDeeds].every(a=>Array.isArray(a)&&a.every(id)&&new Set(a).size===a.length))fail();
  for(const w of original(c.sourceEventIds,c.actorReplaySlot))if(w.atMs<c.windowStartMs||w.atMs>=c.windowEndExclusiveMs)fail();
  for(const [prior,actor,target] of [[c.priorSameDeeds,c.actorReplaySlot,c.counterpartReplaySlot],
   [c.priorOppositeDeeds,c.counterpartReplaySlot,c.actorReplaySlot]] as Array<[string[],number,number]>)
   for(const d of prior){const row=byDeed.get(d);if(!row||row.endedAt.atMs>=c.windowEndExclusiveMs||row.endedAt.atMs<c.windowStartMs||
    !row.facets.some((f:Bag)=>f.fromPlayerId===actor&&f.toPlayerId===target))fail();}
  contexts.set(c.descriptorId,c);
 }
 const keys=new Set<string>(),groups:MetricGradeEpisode[]=doc.candidateEpisodeGroups;
 for(const g of groups){
  if(keys.has(g.independentContributionKey)||!same(g.gameScope,scope)||!same(g.sourceRevision,rev)||
    g.sourceContextRevision!==doc.sourceContextRevision||g.sourceMeasurementsRevision!==doc.sourceMeasurementsRevision||
    !same(g.originalMetricMethods,['AOF_SOCIAL_SOURCE_EPISODE_COMMANDS_1'])||
    g.independentContributionKey!=='metric-episode-'+bindingDigest([PRODUCER,source.battleId,source.gameId,rev,
     doc.sourceContextRevision,g.actorReplayPlayerId,g.counterpartReplayPlayerId,g.sourceDeedIds,g.sourceEventIds])||
    g.candidateId!==g.independentContributionKey||g.actorReplayPlayerId===g.counterpartReplayPlayerId||!g.rawMeasurements.length)fail();
  const related=legacy.grades.filter(p=>p.actorReplaySlot===g.actorReplayPlayerId&&p.counterpartReplaySlot===g.counterpartReplayPlayerId&&g.sourceDeedIds.includes(p.sourceDeedId));
  const metricIds=new Set<string>();
  for(const m of g.rawMeasurements){const kind=metricKinds[m.metricDefinitionId];
   const expected=sorted(related.filter(p=>p.metricId===kind).flatMap(p=>p.sourceEventIds));
   if(!kind||metricIds.has(m.metricDefinitionId)||!same(m.sourceEventIds,expected)||m.rawValue!==expected.length||!expected.length)fail();
   metricIds.add(m.metricDefinitionId);
  }
  if(!same(sorted(g.rawMeasurements.flatMap(m=>m.sourceEventIds)),g.sourceEventIds)||
   !same(sorted(related.map(p=>p.sourceDeedId)),g.sourceDeedIds))fail();
  const rows=original(g.sourceEventIds,g.actorReplayPlayerId).sort((a,b)=>a.atMs-b.atMs||(a.operationOrdinal??-1)-(b.operationOrdinal??-1)||(a.sourceEventId<b.sourceEventId?-1:a.sourceEventId===b.sourceEventId?0:1));
  const ordered=rows.every(w=>w.operationOrdinal!==null)&&new Set(rows.map(w=>JSON.stringify([w.atMs,w.operationOrdinal]))).size===rows.length;
  if(!rows.length||!same(g.window,{startMs:rows[0].atMs,endMs:Math.max(...rows.map(w=>w.atMs))})||
   !same(g.firstSourceMoment,{recordingAtMs:rows[0].atMs,operationOrdinal:ordered?rows[0].operationOrdinal:null,order:ordered?'ORDERED':'PARTIAL'}))fail();
  const prior=related.map(p=>contexts.get(p.candidateId)!);
  // The accepted producer unions per-deed prior context. Later contributing
  // deeds may have context after the earliest linked action; never relabel it
  // pre-episode opportunity or a historical league fact.
  if(!same(sorted(prior.flatMap(c=>c.sourceEventIds)),g.opportunity.sourceEventIds)||
   !same(sorted(prior.flatMap(c=>c.priorSameDeeds)),g.priorDirectedEpisodeCandidateDeedIds)||
   !same(sorted(prior.flatMap(c=>c.priorOppositeDeeds)),g.priorOppositeDirectedEpisodeCandidateDeedIds))fail();
  for(const c of g.counterevidenceCandidates)for(const w of original(c.sourceEventIds,g.actorReplayPlayerId))
   if(!['STOP','DE_STOP','CANCEL','DE_CANCEL'].includes(w.action)||w.atMs<g.window.startMs||w.atMs>g.window.endMs||g.sourceEventIds.includes(w.sourceEventId))fail();
  keys.add(g.independentContributionKey);
 }
 // Every legacy directional descriptor must remain represented; no silent prefix.
 if(legacy.grades.some(p=>!groups.some(g=>g.actorReplayPlayerId===p.actorReplaySlot&&g.counterpartReplayPlayerId===p.counterpartReplaySlot&&g.sourceDeedIds.includes(p.sourceDeedId)&&g.rawMeasurements.some(m=>metricKinds[m.metricDefinitionId]===p.metricId&&p.sourceEventIds.every(r=>m.sourceEventIds.includes(r))))))fail();
 const compatibility=reconcileCandidateIdentities(source,statistics,legacy.grades,groups);
 const episodes:BoundGameplayCandidate[]=groups.map((candidate,i)=>{
  const actor=source.roster.find(p=>p.replaySlot===candidate.actorReplayPlayerId),target=source.roster.find(p=>p.replaySlot===candidate.counterpartReplayPlayerId);
  if(!actor||!target)fail();
  const binding:Omit<BoundGameplayCandidate['binding'],'bindingRevision'>={version:'AOF_INT_C2A_SOURCE_BINDING_1' as const,source,actorPlayerId:actor.playerId,counterpartPlayerId:target.playerId,
   producerVersion:PRODUCER,producerGameScopeAuthenticated:false as const,sourceAuthorityVerified:true as const,processorRevision,producerSchemaDigest:C2A_SCHEMA_DIGEST,
   producerProjectionRevision:doc.projectionRevision,sourceMeasurementsRevision:doc.sourceMeasurementsRevision,
   sourceContextRevision:doc.sourceContextRevision,historicalOrder:null,priorContextBasis:'BEFORE_EACH_CONTRIBUTING_DEED_NOT_GROUP_START',
   modelMethodDigest:bindingDigest(['AOF_SOCIAL_V1_CONTEXT_V2',candidate.originalMetricMethods,PRODUCER,C2A_SCHEMA_DIGEST,doc.sourceContextRevision,doc.sourceMeasurementsRevision,doc.projectionRevision])};
  const inferences=legacy.inferences.filter(inf=>inf.action.actorPlayerId===actor.playerId&&inf.action.counterpartPlayerId===target.playerId);
  const claims=legacy.effects.filter(e=>compatibility[i].legacyIncidentIds.includes(e.claim.incidentId)&&
   compatibility[i].legacyContributionKeys.includes(e.claim.contributionKey)&&
   e.claim.supportRefs.some(r=>r.kind==='INFERENCE'&&inferences.some(inf=>inf.inferenceId===r.id)));
  const pendingProposalRefs={decision:'PENDING' as const,significanceBandId:null,claimIds:sorted(claims.map(e=>e.claim.claimId)),
   inferenceIds:sorted(claims.flatMap(e=>e.claim.supportRefs.filter(r=>r.kind==='INFERENCE').map(r=>r.id)))};
  return {candidate,compatibility:compatibility[i],pendingProposalRefs,
   binding:{...binding,bindingRevision:bindingDigest([binding,candidate,compatibility[i],pendingProposalRefs])}};
 });
 return {legacy,episodes};
}
