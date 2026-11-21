/**
 * #246 — source-ready but NUMERICALLY UNCONFIGURED Reputation projection.
 * Consumes the SINGLE #246/#247 shared source contract, never raw raid/APM/
 * queue/build statistics. Historical points/stages belong solely to #139
 * after a separately signed policy; this module does not score any deed.
 */
import {
  SOCIAL_SOURCE_EVIDENCE_VERSION,
  type SharedSocialSourceEvidence,type SourceQualifiedSocialDeed,
} from './socialEvidenceV1.js';

export const REPUTATION_EVIDENCE_PROJECTION_VERSION='AOF_SOC_V1_REPUTATION_EVIDENCE_READ_1' as const;
export const REPUTATION_V1_RULE_PROPOSAL=Object.freeze({
  version:'AOF_SOC_V1_REPUTATION_OWNER_PROPOSAL_1',
  status:'PROPOSED_UNAPPROVED',numericWeights:null,stageThresholds:null,
  sourceSignificanceBand:'ORDINARY',
  methods:{
    GALLANTRY:{method:'AOF_SV1E_CHALLENGED_RETURN_PRESSURE_1',
      meaning:'Original actor-owned offense after an independently earlier opponent challenge; not proven courtesy, victory or damage.'},
    CRUELTY:{method:'AOF_SV1E_PREENTRY_DISADVANTAGE_PRESSURE_PENDING_1',
      meaning:'Oppressive directed tactic needs an independently approved source method; an ordinary raid, tower request or later loss is insufficient.'},
    CHIVALRY:{method:'AOF_SV1E_NOTEWORTHY_THREAT_PROTECTION_1',
      meaning:'Original helper-owned protective participation toward a recipient under separately prior third-party pressure; not a completed rescue.'},
  },
  weakening:{
    GALLANTRY:'PENDING_INDEPENDENT_POSITIVE_WITHDRAWAL',
    CRUELTY:'PENDING_INDEPENDENT_MATERIAL_RESTITUTION',
    CHIVALRY:'PENDING_INDEPENDENT_PROMISE_AND_SERIOUS_BREACH',
  },
} as const);
export type ReputationEvidenceTrack='GALLANTRY'|'CRUELTY'|'CHIVALRY';
export type ReputationEvidenceReadiness='SOURCE_QUALIFIED'|'PENDING_SOURCE_METHOD';
export interface ReputationTrackEvidence {
  track:ReputationEvidenceTrack;
  readiness:ReputationEvidenceReadiness;
  currentGrade:'ORDINARY'|null;
  career:{sourceQualifiedBattles:number;sourceQualifiedGames:number;distinctOriginalContributions:number};
  bySeason:Record<string,{sourceQualifiedBattles:number;sourceQualifiedGames:number;distinctOriginalContributions:number}>;
  pendingReasons:string[];
  eligibleDeeds:SourceQualifiedSocialDeed[];
  withheldDeeds:SourceQualifiedSocialDeed[];
  careerPoints:null;
  seasonPoints:null;
  stage:null;
}
export interface ReputationEvidenceReadModel {
  version:typeof REPUTATION_EVIDENCE_PROJECTION_VERSION;
  sourceVersion:typeof SOCIAL_SOURCE_EVIDENCE_VERSION;
  ruleProposalVersion:typeof REPUTATION_V1_RULE_PROPOSAL.version;
  ruleStatus:'PROPOSED_UNAPPROVED';
  visibility:'OWNER_ONLY';
  playerId:string;
  evidenceRevision:string;
  tracks:Record<ReputationEvidenceTrack,ReputationTrackEvidence>;
  careerPoints:null;
  officialWrites:false;
}
const names=['GALLANTRY','CRUELTY','CHIVALRY'] as const;
const tally=(deeds:readonly SourceQualifiedSocialDeed[])=>({
  sourceQualifiedBattles:new Set(deeds.map(d=>d.battleId)).size,
  sourceQualifiedGames:new Set(deeds.map(d=>d.battleId+'\u0000'+d.gameId)).size,
  distinctOriginalContributions:new Set(deeds.map(d=>[d.battleId,d.gameId,d.contributionKey].join('\u0000'))).size,
});

/** Compares independent canonical Battles, not per-Game totals or raw orders. */
export function projectReputationEvidence(evidence:SharedSocialSourceEvidence):ReputationEvidenceReadModel{
  if(evidence?.version!==SOCIAL_SOURCE_EVIDENCE_VERSION||
     evidence.visibility!=='OWNER_ONLY'||evidence.sourcePolicy!=='PROPOSED_EMULATOR_ONLY'||
     evidence.officialWrites!==false||evidence.publicationAllowed!==false||
     evidence.gradeWeightsApproved!==false||evidence.unconfiguredWeakening!==true)
    throw new Error('REPUTATION_EVIDENCE_SHARED_SOURCE_REQUIRED');
  const tracks={} as Record<ReputationEvidenceTrack,ReputationTrackEvidence>;
  for(const track of names){
    const specific=evidence.deeds.filter(d=>d.system==='REPUTATION'&&
      d.track===track&&d.actorPlayerId===evidence.ownerPlayerId);
    if(specific.some(d=>d.methodVersion!==REPUTATION_V1_RULE_PROPOSAL.methods[track].method))
      throw new Error('REPUTATION_EVIDENCE_TRACK_METHOD_MISMATCH');
    const eligible=specific.filter(d=>d.decision==='SOURCE_ADMITTED');
    const withheld=specific.filter(d=>d.decision==='PENDING');
    if(track==='CRUELTY'&&eligible.length)throw new Error('REPUTATION_EVIDENCE_CRUELTY_UNAPPROVED');
    const bySeason:ReputationTrackEvidence['bySeason']={};
    for(const season of [...new Set(specific.map(d=>d.seasonId))].sort()){
      bySeason[season]=tally(eligible.filter(d=>d.seasonId===season));
    }
    const missing=new Set(withheld.flatMap(d=>d.missingEvidence));
    missing.add('NUMERICAL_GRADING_AND_WEAKENING_NOT_OWNER_APPROVED');
    if(!eligible.length)missing.add(specific.length?'NO_ADMITTED_SOURCE_METHOD':'NO_VERIFIED_TRACK_EPISODE');
    if(track==='CRUELTY')missing.add('OPPRESSIVE_TACTIC_SOURCE_METHOD_PENDING');
    tracks[track]={track,readiness:eligible.length?'SOURCE_QUALIFIED':'PENDING_SOURCE_METHOD',
      currentGrade:eligible.length?'ORDINARY':null,career:tally(eligible),bySeason,
      pendingReasons:[...missing].sort(),eligibleDeeds:eligible,
      withheldDeeds:withheld,careerPoints:null,seasonPoints:null,stage:null};
  }
  return {version:REPUTATION_EVIDENCE_PROJECTION_VERSION,
    sourceVersion:SOCIAL_SOURCE_EVIDENCE_VERSION,
    ruleProposalVersion:REPUTATION_V1_RULE_PROPOSAL.version,
    ruleStatus:'PROPOSED_UNAPPROVED',visibility:'OWNER_ONLY',
    playerId:evidence.ownerPlayerId,evidenceRevision:evidence.evidenceRevision,
    tracks,careerPoints:null,officialWrites:false};
}
