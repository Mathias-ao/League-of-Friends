/**
 * #246/#247 — ONE versioned, read-only source-grade bridge for six social tracks.
 *
 * Inputs are *only* the output of bindSourceGrades() after INT-B independently
 * authenticated current READY artifacts and the worker's #158/#173 methods.
 * This projection does not authenticate Firebase state, infer new source
 * methods, calculate points, approve a policy, or publish historical Claims.
 * #139 remains the sole history/reciprocity/cap evaluator.
 */
import type {SourceSnapshot} from '../domain/socialV1.js';
import {bindingDigest} from '../engines/nativeRecordingIntegration.js';

export const SOCIAL_SOURCE_EVIDENCE_VERSION='AOF_SOC_V1_SHARED_SOURCE_EVIDENCE_1' as const;
export type SocialTrack='GALLANTRY'|'CRUELTY'|'CHIVALRY'|'RIVALRY'|'HOSTILITY'|'BOND';
export type SocialSystem='REPUTATION'|'RELATIONSHIP';
export type SocialEvidenceDecision='SOURCE_ADMITTED'|'PENDING';
export const SOCIAL_EVIDENCE_TRACKS=Object.freeze({
  GALLANTRY:{system:'REPUTATION',method:'AOF_SV1E_CHALLENGED_RETURN_PRESSURE_1'},
  CRUELTY:{system:'REPUTATION',method:'AOF_SV1E_PREENTRY_DISADVANTAGE_PRESSURE_PENDING_1'},
  CHIVALRY:{system:'REPUTATION',method:'AOF_SV1E_NOTEWORTHY_THREAT_PROTECTION_1'},
  RIVALRY:{system:'RELATIONSHIP',method:'AOF_SV1E_PAIR_RAID_ENGAGEMENT_CONTEST_1'},
  HOSTILITY:{system:'RELATIONSHIP',method:'AOF_SV1E_SELECTIVE_ANTAGONISM_PENDING_1'},
  BOND:{system:'RELATIONSHIP',method:'AOF_SV1E_THREAT_LINKED_DIRECTED_HELP_1'},
} as const satisfies Record<SocialTrack,{system:SocialSystem;method:string}>);

type Bag=Record<string,any>;
type BoundGrade={
  source:SourceSnapshot;
  sourceMethodRevision:string;
  cards:Bag[];
};
export interface SourceQualifiedSocialDeed {
  readonly track:SocialTrack;
  readonly system:SocialSystem;
  readonly decision:SocialEvidenceDecision;
  readonly reasonCodes:readonly string[];
  readonly missingEvidence:readonly string[];
  readonly methodVersion:string;
  readonly originalSourceCoverage:'LIMITED';
  readonly methodCoverage:'ADMITTED'|'PENDING';
  readonly gradeBandId:'ORDINARY'|null;
  readonly effect:'STRENGTHEN'|null;
  readonly actorPlayerId:string;
  readonly counterpartPlayerId:string;
  readonly battleId:string;
  readonly gameId:string;
  readonly gameGuid:string;
  readonly eventId:string;
  readonly seasonId:string;
  readonly sourceHash:string;
  readonly authorityRevision:string;
  readonly statisticsRevision:number;
  readonly sourceMethodRevision:string;
  readonly sourceContextRevision:string;
  readonly contributionKey:string;
  readonly componentId:string;
  readonly originalSourceEventIds:readonly string[];
  readonly originalPosition:{readonly recordingAtMs:number;readonly operationOrdinal:number|null;readonly order:'ORDERED'|'PARTIAL'};
  readonly historicalOrder:{readonly order:'ORDERED'|'UNKNOWN';readonly leagueOrderKey:string|null;readonly gameNumber:number};
  readonly corroboration:ReadonlyArray<{kind:string;sourceDetectorId:string;originalSourceEventIds:readonly string[]}>;
  readonly opportunity:{status:'UNCONFIGURED';approvedDenominator:null};
  readonly evidenceMeaning:'SOURCE_BOUND_INFERRED_COMMAND_COMMITMENT_NOT_OUTCOME';
  readonly claimId:string;
  readonly claimRevision:string;
}
export interface SharedSocialSourceEvidence {
  readonly version:typeof SOCIAL_SOURCE_EVIDENCE_VERSION;
  readonly visibility:'OWNER_ONLY';
  readonly sourcePolicy:'PROPOSED_EMULATOR_ONLY';
  readonly ownerPlayerId:string;
  readonly methodVersion:'AOF_SOC_V1E_BOUNDED_GRADE_METHODS_1';
  readonly sourceBinding:'INT_B_CURRENT_READY_AND_C2A_VALIDATED';
  readonly sourceRevisions:readonly string[];
  readonly deeds:readonly SourceQualifiedSocialDeed[];
  readonly evidenceRevision:string;
  readonly originalCoverage:'LIMITED';
  readonly officialWrites:false;
  readonly publicationAllowed:false;
  readonly gradeWeightsApproved:false;
  readonly unconfiguredWeakening:true;
}

function requireFact(ok:unknown,code:string):asserts ok {
  if(!ok)throw new Error('SOCIAL_EVIDENCE_'+code);
}
const validId=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=512;
const validHash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const unique=(refs:unknown):refs is string[]=>
  Array.isArray(refs)&&refs.every(validId)&&new Set(refs).size===refs.length;
const sorted=(xs:string[])=>[...xs].sort((a,b)=>a.localeCompare(b));

/** An explicit snapshot of accepted source evidence, never a source admission. */
export function projectSharedSocialSourceEvidence(
  ownerPlayerId:string,inputs:readonly BoundGrade[],
):SharedSocialSourceEvidence{
  if(!validId(ownerPlayerId)||!Array.isArray(inputs)||inputs.length>64)
    throw new Error('SOCIAL_EVIDENCE_INPUT_BUDGET_OR_OWNER');
  const games=new Map<string,string>(),guids=new Map<string,string>(),hashes=new Map<string,string>();
  const tracks=Object.keys(SOCIAL_EVIDENCE_TRACKS) as SocialTrack[];
  const admittedOverlap=new Map<string,Set<string>>();
  const deeds:SourceQualifiedSocialDeed[]=[];
  for(const bound of inputs){
    const s=bound.source;
    requireFact(s&&validId(s.battleId)&&s.matchId===s.battleId&&validId(s.gameId)&&
      validId(s.gameGuid)&&validId(s.eventId)&&validId(s.seasonId)&&
      validHash(s.sourceHash)&&validId(s.authorityRevision)&&
      Number.isSafeInteger(s.statisticsRevision)&&s.statisticsRevision>=0&&
      validHash(bound.sourceMethodRevision)&&
      Array.isArray(s.roster)&&s.roster.length>=2&&s.roster.length<=8&&
      new Set(s.roster.map((p:{playerId:string;replaySlot:number})=>p.playerId)).size===s.roster.length&&
      s.roster.every((p:{playerId:string;replaySlot:number})=>validId(p.playerId)&&Number.isSafeInteger(p.replaySlot)),
      'SOURCE_SNAPSHOT_NOT_BOUND');
    const gameKey=s.battleId+'\u0000'+s.gameId,identity=bindingDigest([s,bound.sourceMethodRevision,bound.cards]);
    if(games.has(gameKey)){
      requireFact(games.get(gameKey)===identity,'CONFLICTING_CURRENT_GAME_SOURCE');
      continue; // identical current source / duplicate input, never another Game
    }
    requireFact(!guids.has(s.gameGuid)||guids.get(s.gameGuid)===gameKey,
      'DUPLICATE_GAME_GUID_ACROSS_BATTLES');
    requireFact(!hashes.has(s.sourceHash)||hashes.get(s.sourceHash)===gameKey,
      'DUPLICATE_RECORDING_SOURCE_ACROSS_GAMES');
    games.set(gameKey,identity);guids.set(s.gameGuid,gameKey);hashes.set(s.sourceHash,gameKey);
    requireFact(Array.isArray(bound.cards)&&bound.cards.length<=20000,'CARD_BUDGET');
    const seenCards=new Map<string,string>();
    const roster=new Set(s.roster.map((p:{playerId:string;replaySlot:number})=>p.playerId));
    for(const card of bound.cards){
      const track=card?.track as SocialTrack,meta=SOCIAL_EVIDENCE_TRACKS[track];
      requireFact(!!meta&&tracks.includes(track),'UNKNOWN_TRACK');
      requireFact(card.battleId===s.battleId&&card.gameId===s.gameId&&
        card.sourceAuthority===s.authorityRevision&&
        roster.has(card.actorPlayerId)&&roster.has(card.counterpartPlayerId)&&
        card.actorPlayerId!==card.counterpartPlayerId&&
        card.methodVersion===meta.method&&validHash(card.sourceContextRevision)&&
        card.sourceCoverage==='LIMITED'&&
        unique(card.originalSourceEventIds)&&
        Number.isSafeInteger(card.originalEventCount)&&
        card.originalEventCount===card.originalSourceEventIds.length&&
        typeof card.identity==='object'&&validId(card.identity.contributionKey)&&
        validId(card.identity.componentId)&&card.identity.keySubstitutionAllowed===false&&
        validId(card.claimId)&&validHash(card.claimRevision)&&
        card.originalPosition&&Number.isSafeInteger(card.originalPosition.recordingAtMs)&&
        card.originalPosition.recordingAtMs>=0&&
        ['ORDERED','PARTIAL'].includes(card.originalPosition.order)&&
        (card.originalPosition.operationOrdinal===null||
        Number.isSafeInteger(card.originalPosition.operationOrdinal))&&
        card.historicalOrder&&['ORDERED','UNKNOWN'].includes(card.historicalOrder.order)&&
        Number.isSafeInteger(card.historicalOrder.gameNumber)&&
        card.historicalOrder.gameNumber>=1&&
        (card.historicalOrder.leagueOrderKey===null||validId(card.historicalOrder.leagueOrderKey))&&
        Array.isArray(card.missingEvidence)&&card.missingEvidence.every(validId)&&
        Array.isArray(card.reasonCodes)&&card.reasonCodes.every(validId)&&
        Array.isArray(card.corroboration)&&card.corroboration.every((c:Bag)=>
          validId(c.kind)&&validId(c.sourceDetectorId)&&unique(c.originalSourceEventIds)),
        'UNBOUND_CARD_OR_UNVERIFIED_SOURCE_REFS');
      const admitted=card.decision==='SOURCE_ADMITTED';
      requireFact(admitted||card.decision==='PENDING','UNRECOGNIZED_METHOD_DECISION');
      requireFact(admitted?
        track!=='CRUELTY'&&track!=='HOSTILITY'&&
        card.methodCoverage==='ADMITTED'&&card.gradeBandId==='ORDINARY'&&
        card.originalSourceEventIds.length>=2&&
        card.originalPosition.order==='ORDERED'&&card.corroboration.length>0&&
        card.missingEvidence.length===0:
        card.methodCoverage==='PENDING'&&card.gradeBandId===null,
        'UNAPPROVED_OR_UNSOURCED_TRACK_GRADE');
      const key=[gameKey,card.identity.contributionKey,track].join('\u0000');
      const fingerprint=bindingDigest(card);
      if(seenCards.has(key)){
        requireFact(seenCards.get(key)===fingerprint,'CONFLICTING_DUPLICATE_CARD');
        continue;
      }
      seenCards.set(key,fingerprint);
      if(admitted){
        const sameDirection=[gameKey,card.actorPlayerId,card.counterpartPlayerId,track].join('\u0000');
        const seen=admittedOverlap.get(sameDirection)??new Set<string>();
        requireFact(!card.originalSourceEventIds.some((id:string)=>seen.has(id)),
          'CORRELATED_ORIGINAL_SOURCE_CREDIT');
        card.originalSourceEventIds.forEach((id:string)=>seen.add(id));
        admittedOverlap.set(sameDirection,seen);
      }
      deeds.push({
        track,system:meta.system,decision:card.decision,
        reasonCodes:sorted(card.reasonCodes),missingEvidence:sorted(card.missingEvidence),
        methodVersion:meta.method,originalSourceCoverage:'LIMITED',
        methodCoverage:admitted?'ADMITTED':'PENDING',
        gradeBandId:admitted?'ORDINARY':null,effect:admitted?'STRENGTHEN':null,
        actorPlayerId:card.actorPlayerId,counterpartPlayerId:card.counterpartPlayerId,
        battleId:s.battleId,gameId:s.gameId,gameGuid:s.gameGuid!,
        eventId:s.eventId,seasonId:s.seasonId,sourceHash:s.sourceHash,
        authorityRevision:s.authorityRevision,statisticsRevision:s.statisticsRevision,
        sourceMethodRevision:bound.sourceMethodRevision,
        sourceContextRevision:card.sourceContextRevision,
        contributionKey:card.identity.contributionKey,componentId:card.identity.componentId,
        originalSourceEventIds:sorted(card.originalSourceEventIds),
        originalPosition:{recordingAtMs:card.originalPosition.recordingAtMs,
          operationOrdinal:card.originalPosition.operationOrdinal,
          order:card.originalPosition.order},
        historicalOrder:{order:card.historicalOrder.order,
          leagueOrderKey:card.historicalOrder.leagueOrderKey,
          gameNumber:card.historicalOrder.gameNumber},
        corroboration:card.corroboration.map((c:Bag)=>({
          kind:c.kind,sourceDetectorId:c.sourceDetectorId,
          originalSourceEventIds:sorted(c.originalSourceEventIds)})),
        opportunity:{status:'UNCONFIGURED',approvedDenominator:null},
        evidenceMeaning:'SOURCE_BOUND_INFERRED_COMMAND_COMMITMENT_NOT_OUTCOME',
        claimId:card.claimId,claimRevision:card.claimRevision,
      });
    }
  }
  const ordered=deeds.sort((a,b)=>
    a.battleId.localeCompare(b.battleId)||a.gameId.localeCompare(b.gameId)||
    a.actorPlayerId.localeCompare(b.actorPlayerId)||
    a.counterpartPlayerId.localeCompare(b.counterpartPlayerId)||
    a.track.localeCompare(b.track)||a.contributionKey.localeCompare(b.contributionKey));
  return {version:SOCIAL_SOURCE_EVIDENCE_VERSION,visibility:'OWNER_ONLY',
    sourcePolicy:'PROPOSED_EMULATOR_ONLY',ownerPlayerId,
    methodVersion:'AOF_SOC_V1E_BOUNDED_GRADE_METHODS_1',
    sourceBinding:'INT_B_CURRENT_READY_AND_C2A_VALIDATED',
    sourceRevisions:sorted([...games.keys()].map(k=>games.get(k)!)),
    deeds:ordered,evidenceRevision:bindingDigest([SOCIAL_SOURCE_EVIDENCE_VERSION,ordered]),
    originalCoverage:'LIMITED',officialWrites:false,publicationAllowed:false,
    gradeWeightsApproved:false,unconfiguredWeakening:true};
}
