/** Projection firewall around the unchanged source binder and sole #139 allocator.
 * External private-read approval is never a trusted PUBLIC history approval. */
import {bindingDigest} from '../engines/nativeRecordingIntegration.js';
import {evaluateHistory,type HistoricalChapter,
  type CalibratedSocialHistoryRules} from '../engines/socialV1History/history.js';
import type {Subject} from '../domain/socialV1.js';
import type {bindSourceGrades} from './privateProgression.js';
import {projectSharedSocialSourceEvidence} from './socialEvidenceV1.js';
import {projectReputationEvidence} from './reputationEvidenceV1.js';
import {projectRelationshipsEvidence} from './relationshipsEvidenceV1.js';
import {HOSTED_POLICY_VERSION,HOSTED_POLICY_SPEC} from './hostedSocialPolicy.js';
import {deriveScopedOccurrenceOrders} from './socialScheduleOrder.js';
import type {OccurrenceBattle} from './battleOccurrence.js';

type Bound=ReturnType<typeof bindSourceGrades>;
type Bag=Record<string,any>;
const rep=['GALLANTRY','CRUELTY','CHIVALRY'] as const,rel=['RIVALRY','HOSTILITY','BOND'] as const;
const subjectKey=(s:Subject)=>bindingDigest(s);
const relevant=(s:Subject,owner:string)=>s.system==='REPUTATION'?s.playerId===owner:
  s.fromPlayerId===owner||s.toPlayerId===owner;
export interface HostedTrack {
  readiness:'SOURCE_QUALIFIED'|'PENDING_SOURCE_METHOD';progression:'PRIVATE_PREVIEW'|'PENDING'|'UNAVAILABLE';
  reasonCodes:string[];sourceQualifiedBattles:number;sourceQualifiedGames:number;sourceQualifiedEvents:number;
  stage:number|null;upBank:number|null;
}
/** Unknown scope stays conservative; known source failures affect only windows
 * and subjects to which that source could actually contribute. */
export interface HostedPendingSource {
  seasonId:string|null;rosterPlayerIds:string[]|null;
  reason?:'SOURCE_PRODUCER_ATTESTATION_UNAVAILABLE'|'WORKER_TRANSPORT_UNAVAILABLE';
}
function publicEffectsBlocked(history:ReturnType<typeof evaluateHistory>){
  if(history.publicationAllowed||history.officialWrites||history.receipts.length)
    throw new Error('HOSTED_SOCIAL_PUBLIC_EFFECTS_FORBIDDEN');
  return history;
}
/** Fixed source alignment is an additional private-pilot opportunity gate;
 * uncertainty withholds a subject's numbers, never invents a contrary deed. */
export function fixedHostedOpportunity(bound:Bound,statistics:Bag,subject:Subject,format:string,claimId:string,witnesses:Bag[]=[]):boolean {
  if(!['ONE_V_ONE','TWO_V_TWO','THREE_V_THREE','FOUR_V_FOUR'].includes(format)||
    statistics.matchFacts?.rules?.lockTeams?.status!=='DECODED'||statistics.matchFacts.rules.lockTeams.value!==true)return false;
  const card=bound.cards.find(c=>c.claimId===claimId&&c.decision==='SOURCE_ADMITTED');
  if(!card)return false;
  const actor=bound.source.roster.find(p=>p.playerId===card.actorPlayerId),other=bound.source.roster.find(p=>p.playerId===card.counterpartPlayerId);
  const facts=statistics.matchFacts.players;
  if(!Array.isArray(facts)||facts.length!==bound.source.roster.length||
    new Set(facts.map((p:Bag)=>p.replaySlot)).size!==facts.length)return false;
  const original=(slot:number|undefined)=>facts.find((p:Bag)=>p.replaySlot===slot)?.lobbyTeamIdRaw;
  const a=original(actor?.replaySlot),b=original(other?.replaySlot);
  if(bound.source.roster.some(p=>!p.teamId||!Number.isSafeInteger(original(p.replaySlot))||original(p.replaySlot)<1)||
    !actor?.teamId||!other?.teamId||!Number.isSafeInteger(a)||!Number.isSafeInteger(b))return false;
  if(bound.source.roster.some(p=>bound.source.roster.some(q=>
    (p.teamId===q.teamId)!==(original(p.replaySlot)===original(q.replaySlot)))))return false;
  // No caller-roster relabel can turn original opponents into helpers or vice versa.
  const helper=subject.track==='BOND'||subject.track==='CHIVALRY';
  if(!helper)return a!==b&&actor.teamId!==other.teamId;
  if(a!==b||actor.teamId!==other.teamId)return false;
  // Source method already qualified the original chronology. The narrower
  // hosted policy additionally requires a fixed opposing third-party threat.
  const byId=new Map(witnesses.map(w=>[w.sourceEventId,w]));
  return card.corroboration.some((proof:Bag)=>proof.kind==='PREENTRY_RECIPIENT_THREAT'&&
    proof.originalSourceEventIds.length>=(subject.track==='CHIVALRY'?2:1)&&
    proof.originalSourceEventIds.every((id:string)=>{const w=byId.get(id);
      return w&&w.actorReplaySlot!==actor.replaySlot&&w.actorReplaySlot!==other.replaySlot&&
        Number.isSafeInteger(original(w.actorReplaySlot))&&original(w.actorReplaySlot)!==b;}));
}
export function projectHostedSocialProgression(input:{owner:string;inputs:Bound[];chapters:HistoricalChapter[];
  calibration:CalibratedSocialHistoryRules;pendingSources:HostedPendingSource[];coverage:Bag;inputRevision:string;policyRevision:string;
  opportunity:(bound:Bound,subject:Subject,claimId:string)=>boolean;
  occurrenceBattles?:OccurrenceBattle[]}){
  const {owner,inputs,chapters,calibration}=input;
  if(calibration.policy.status!=='PROPOSED'||calibration.policy.approvalRef!==null||
    bindingDigest(calibration)!==bindingDigest(HOSTED_POLICY_SPEC.calibration))throw new Error('HOSTED_SOCIAL_PRIVATE_CALIBRATION_REQUIRED');
  const evidence=projectSharedSocialSourceEvidence(owner,inputs);
  const reputation=projectReputationEvidence(evidence),relationships=projectRelationshipsEvidence(evidence);
  const admitted=new Set(evidence.deeds.filter(d=>d.decision==='SOURCE_ADMITTED').map(d=>d.claimId));
  const withheldSubjects=new Map<string,Set<string>>();
  const effects=inputs.flatMap(bound=>bound.effects.filter(effect=>{
    const c=effect.claim;if(c.decision!=='QUALIFIED')return false;
    const rule=calibration.rules[c.ruleId],method=HOSTED_POLICY_SPEC.admittedMethodByRule[c.ruleId];
    const card=bound.cards.find(ca=>ca.claimId===c.claimId);
    if(!rule||!method||card?.methodVersion!==method||rule.system!==c.subject.system||rule.track!==c.subject.track||
      c.effect!=='STRENGTHEN'||c.significanceBandId!=='ORDINARY'||rule.bands.ORDINARY!==1||
      bindingDigest(c.policy)!==bindingDigest(calibration.policy))throw new Error('HOSTED_SOCIAL_WITHHELD_RULE_OR_METHOD');
    if(!relevant(c.subject,owner)||!admitted.has(c.claimId))return false;
    if(!input.opportunity(bound,c.subject,c.claimId)){
      const key=subjectKey(c.subject),seasons=withheldSubjects.get(key)??new Set<string>();
      seasons.add(bound.source.seasonId);withheldSubjects.set(key,seasons);return false;
    }
    return true;
  }));
  const effectIds=new Set(effects.map(e=>e.claim.claimId));
  const actorWitnesses=inputs.flatMap(b=>b.actorWitnesses).filter(w=>effectIds.has(w.claimId));
  // #139 is the sole allocator. Run it independently for each factual
  // Reputation subject or unordered directed pair+track dependency. An
  // unrelated unorderable Battle must not veto a different subject's proof,
  // whereas BOTH directions and the whole Event cap remain one pair scope.
  const group=(s:Subject)=>s.system==='REPUTATION'?
    bindingDigest(['REP',s.track,s.playerId]):
    bindingDigest(['PAIR',s.track,[s.fromPlayerId,s.toPlayerId].sort()]);
  const cache=new Map<string,ReturnType<typeof evaluateHistory>>();
  const evaluateFor=(subject:Subject,seasonId?:string)=>{
    const cacheKey=group(subject)+'|'+(seasonId??'ALL');
    const cached=cache.get(cacheKey);if(cached)return cached;
    const selected=effects.filter(e=>group(e.claim.subject)===group(subject));
    const eligible=selected.filter(e=>!seasonId||chapters.some(c=>
      c.seasonId===seasonId&&c.battleId===e.battleId&&c.gameId===e.gameId));
    const ids=[...new Set(eligible.map(e=>e.battleId))];
    const relevantChapters=chapters.filter(c=>ids.includes(c.battleId)&&(!seasonId||c.seasonId===seasonId));
    const resolved=input.occurrenceBattles?
      deriveScopedOccurrenceOrders(input.occurrenceBattles,ids):[];
    const order=new Map(resolved.map(r=>[r.battleId+'\\u0000'+r.gameId,r]));
    const actualChapters=relevantChapters.map(c=>{
      const row=order.get(c.battleId+'\\u0000'+c.gameId);
      return {...c,order:row?row.order:c.order};
    });
    const allocated=eligible.map(e=>{
      const row=order.get(e.battleId+'\\u0000'+e.gameId);
      if(!row)return e;
      return {...e,claim:{...e.claim,historicalPosition:{...e.claim.historicalPosition,
        leagueOrderKey:row.order?.key??null,
        order:row.status==='ORDERED'?'ORDERED' as const:'UNKNOWN' as const}}};
    });
    const qualified=new Set(allocated.map(e=>e.claim.claimId));
    const history=publicEffectsBlocked(evaluateHistory({chapters:actualChapters,effects:allocated,
      actorWitnesses:actorWitnesses.filter(w=>qualified.has(w.claimId)),calibration,
      trustedApprovals:[],treachery:[],acknowledgments:[]}));
    cache.set(cacheKey,history);return history;
  };
  const find=(history:ReturnType<typeof evaluateHistory>,subject:Subject)=>
    history.projections.find(p=>subjectKey(p.subject)===subjectKey(subject));
  const summary=(subject:Subject,deeds:typeof evidence.deeds,history:ReturnType<typeof evaluateHistory>,seasonId?:string):HostedTrack=>{
    const accepted=deeds.filter(d=>d.decision==='SOURCE_ADMITTED'),unsupported=['CRUELTY','HOSTILITY'].includes(subject.track);
    const affectedSeasons=withheldSubjects.get(subjectKey(subject));
    const affectedSources=input.pendingSources.filter(s=>
      (!seasonId||s.seasonId===null||s.seasonId===seasonId)&&(!s.rosterPlayerIds||
        (subject.system==='REPUTATION'?s.rosterPlayerIds.includes(subject.playerId):
          s.rosterPlayerIds.includes(subject.fromPlayerId)&&s.rosterPlayerIds.includes(subject.toPlayerId))));
    const incomplete=(!seasonId?!!affectedSeasons:affectedSeasons?.has(seasonId))||affectedSources.length>0;
    const p=find(history,subject);
    const row:HostedTrack={readiness:accepted.length?'SOURCE_QUALIFIED':'PENDING_SOURCE_METHOD',progression:'PENDING',reasonCodes:[],
      sourceQualifiedBattles:new Set(accepted.map(d=>d.battleId)).size,
      sourceQualifiedGames:new Set(accepted.map(d=>d.battleId+'\u0000'+d.gameId)).size,
      sourceQualifiedEvents:new Set(accepted.map(d=>d.eventId)).size,stage:null,upBank:null};
    if(unsupported){row.reasonCodes=['NOT_YET_MEASURED'];return row;}
    if(incomplete){
      const unavailable=affectedSources.flatMap(s=>s.reason?[s.reason]:[]);
      row.reasonCodes=unavailable.length?[...new Set(unavailable)]:['SOURCE_EVIDENCE_INCOMPLETE'];
      if(unavailable.length)row.progression='UNAVAILABLE';return row;
    }
    if(p?.status==='PENDING'){row.reasonCodes=['HISTORICAL_ORDER_PENDING'];return row;}
    if(!accepted.length||!p||p.currentStage===null){
      row.reasonCodes=[deeds.length?'SOURCE_EVIDENCE_INCOMPLETE':'NO_QUALIFYING_RECORDED_ACTIVITY'];return row;
    }
    row.progression='PRIVATE_PREVIEW';row.stage=p.currentStage;row.upBank=p.upBank;
    // #139 has retained a VERIFIED stage and enough bank at the next boundary:
    // report its reciprocity hold, never advance a stage in this adapter.
    if(subject.system==='RELATIONSHIP'&&p.currentStage>=2&&p.currentStage<4&&
      p.upBank>=calibration.stages.RELATIONSHIP[subject.track].up[p.currentStage])
      row.reasonCodes=['INDEPENDENT_ACTIVITY_REQUIRED'];
    return row;
  };
  const seasonIds=[...new Set(chapters.map(c=>c.seasonId))].sort();
  const repDto=Object.fromEntries(rep.map(track=>{
    const subject:Subject={system:'REPUTATION',track,playerId:owner};
    const deeds=evidence.deeds.filter(d=>d.system==='REPUTATION'&&d.track===track&&d.actorPlayerId===owner);
    // Reuse merged readiness projection; counts never become a numerical award.
    if(reputation.tracks[track].career.sourceQualifiedBattles!==new Set(deeds.filter(d=>d.decision==='SOURCE_ADMITTED').map(d=>d.battleId)).size)
      throw new Error('HOSTED_SOCIAL_REPUTATION_COUNT_MISMATCH');
    return [track,{career:summary(subject,deeds,evaluateFor(subject)),bySeason:Object.fromEntries(seasonIds.map(season=>
      [season,summary(subject,deeds.filter(d=>d.seasonId===season),evaluateFor(subject,season),season)]))}];
  }));
  const pairDto=relationships.pairs.map(pair=>({otherPlayerId:pair.otherPlayerId,
    factualCurrentSourceBattles:pair.factualCurrentSourceBattles,factualCurrentSourceGames:pair.factualCurrentSourceGames,
    tracks:Object.fromEntries(rel.map(track=>[track,Object.fromEntries(['outgoing','incoming'].map(direction=>{
      const from=direction==='outgoing'?owner:pair.otherPlayerId,to=direction==='outgoing'?pair.otherPlayerId:owner;
      const subject:Subject={system:'RELATIONSHIP',track,fromPlayerId:from,toPlayerId:to};
      return [direction,summary(subject,evidence.deeds.filter(d=>d.system==='RELATIONSHIP'&&d.track===track&&
        d.actorPlayerId===from&&d.counterpartPlayerId===to),evaluateFor(subject))];
    }))]))}));
  const response={version:'AOF_SOC_V1A_HOSTED_OWNER_READ_1' as const,ownerPlayerId:owner,
    revision:bindingDigest([input.inputRevision,input.policyRevision,evidence.evidenceRevision,[...cache].map(([k,v])=>[k,v.projectionRevision]).sort(),input.pendingSources]),
    policyVersion:HOSTED_POLICY_VERSION,approvalScope:'PRIVATE_NUMERICAL_PREVIEW' as const,
    coverage:{complete:input.pendingSources.length===0,ownBattles:input.coverage.ownBattles,ownGames:input.coverage.ownGames,
      currentSources:input.coverage.currentSources,pendingSources:input.coverage.pendingSources},
    reputation:repDto,relationships:pairDto};
  if(Buffer.byteLength(JSON.stringify(response))>512*1024)throw new Error('HOSTED_SOCIAL_RESPONSE_BUDGET');
  return response;
}
