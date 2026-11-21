/**
 * #247 — direction-preserving Relationship evidence projection from the
 * SAME versioned #246/#247 source bridge. Never the legacy processRivalries
 * "allied without cooperation -> Hostility" or a substitute for #139.
 */
import {
  SOCIAL_SOURCE_EVIDENCE_VERSION,
  type SharedSocialSourceEvidence,type SourceQualifiedSocialDeed,
} from './socialEvidenceV1.js';

export const RELATIONSHIP_EVIDENCE_PROJECTION_VERSION='AOF_SOC_V1_RELATIONSHIPS_EVIDENCE_READ_1' as const;
export const RELATIONSHIP_V1_RULE_PROPOSAL=Object.freeze({
  version:'AOF_SOC_V1_RELATIONSHIPS_OWNER_PROPOSAL_1',status:'PROPOSED_UNAPPROVED',
  pointWeights:null,stageThresholds:null,sourceSignificanceBand:'ORDINARY',
  methods:{
    RIVALRY:{method:'AOF_SV1E_PAIR_RAID_ENGAGEMENT_CONTEST_1',
      meaning:'Actor-owned, source-targeted competitive raid + independent local encounter, not a win, hostility or reciprocal act.'},
    HOSTILITY:{method:'AOF_SV1E_SELECTIVE_ANTAGONISM_PENDING_1',
      meaning:'Unusually invasive/selective conduct needs independent time/target alternatives or historical effective rupture; ordinary opposition is not Hostility.'},
    BOND:{method:'AOF_SV1E_THREAT_LINKED_DIRECTED_HELP_1',
      meaning:'Actual original helper-to-recipient protective commitment under earlier third-party threat, not sharing a team or enemy.'},
  },
  weakening:{
    RIVALRY:'PENDING_INDEPENDENT_SETTLEMENT_DEED',
    HOSTILITY:'PENDING_ACTUAL_REPARATIVE_AID_TO_SAME_COUNTERPART',
    BOND:'PENDING_QUALIFIED_SERIOUS_BREACH_AFTER_GROUNDED_PRIOR_BOND',
  },
  reciprocity:'BOTH_DIRECTIONS_REQUIRE_SEPARATE_ORIGINAL_ACTOR_SOURCE_EVENTS_AT_STAGE_3_PLUS_UNDER_139',
} as const);
export type RelationshipEvidenceTrack='RIVALRY'|'HOSTILITY'|'BOND';
export type RelationshipDirection='OUTGOING'|'INCOMING';
export interface DirectionalEvidenceRead {
  direction:RelationshipDirection;
  actorPlayerId:string;
  counterpartPlayerId:string;
  sourceQualifiedBattles:number;
  sourceQualifiedEvents:number;
  sourceQualifiedGames:number;
  admittedDeeds:SourceQualifiedSocialDeed[];
  pendingDeeds:SourceQualifiedSocialDeed[];
  missingEvidence:string[];
}
export interface RelationshipTrackRead {
  track:RelationshipEvidenceTrack;
  status:'SOURCE_QUALIFIED'|'PENDING_SOURCE_METHOD';
  outbound:DirectionalEvidenceRead;
  inbound:DirectionalEvidenceRead;
  sharedChronicleContext:'FACTUAL_ONLY';
  independentReciprocityKnown:boolean;
  stageThreeGateOwner:'AOF_SOCIAL_V1_HISTORY_1';
  stageThreeEligibility:null;
  numericPoints:null;
  stage:null;
}
export interface RelationshipPairRead {
  pairPlayerIds:[string,string];
  otherPlayerId:string;
  factualCurrentSourceBattles:number;
  factualCurrentSourceGames:number;
  tracks:Record<RelationshipEvidenceTrack,RelationshipTrackRead>;
}
export interface RelationshipsEvidenceReadModel{
  version:typeof RELATIONSHIP_EVIDENCE_PROJECTION_VERSION;
  sourceVersion:typeof SOCIAL_SOURCE_EVIDENCE_VERSION;
  ruleProposalVersion:typeof RELATIONSHIP_V1_RULE_PROPOSAL.version;
  ruleStatus:'PROPOSED_UNAPPROVED';
  visibility:'OWNER_ONLY';
  ownerPlayerId:string;
  evidenceRevision:string;
  pairs:RelationshipPairRead[];
  weakeningQualified:false;
  officialWrites:false;
}
const tracks=['RIVALRY','HOSTILITY','BOND'] as const;
const key=(d:SourceQualifiedSocialDeed,kind:'BATTLE'|'GAME'|'EVENT')=>
  kind==='BATTLE'?d.battleId:
    kind==='EVENT'?d.eventId:d.battleId+'\u0000'+d.gameId;
const tally=(deeds:SourceQualifiedSocialDeed[],kind:'BATTLE'|'GAME'|'EVENT')=>
  new Set(deeds.map(d=>key(d,kind))).size;

export function projectRelationshipsEvidence(evidence:SharedSocialSourceEvidence):RelationshipsEvidenceReadModel{
  if(evidence?.version!==SOCIAL_SOURCE_EVIDENCE_VERSION||
     evidence.visibility!=='OWNER_ONLY'||evidence.sourcePolicy!=='PROPOSED_EMULATOR_ONLY'||
     evidence.officialWrites!==false||evidence.publicationAllowed!==false||
     evidence.gradeWeightsApproved!==false||evidence.unconfiguredWeakening!==true)
    throw new Error('RELATIONSHIPS_EVIDENCE_SHARED_SOURCE_REQUIRED');
  const owner=evidence.ownerPlayerId;
  const directed=evidence.deeds.filter(d=>d.system==='RELATIONSHIP'&&
     (d.actorPlayerId===owner||d.counterpartPlayerId===owner));
  // Current authenticated roster co-participation remains factual even when
  // there are zero source-admitted social method cards (quiet Games or
  // source corrections). It cannot become a directed social deed itself.
  const factual=evidence.factualPairs??[];
  if(!Array.isArray(factual)||factual.some(p=>
    !p||typeof p.otherPlayerId!=='string'||!p.otherPlayerId||
    p.otherPlayerId===owner||!Array.isArray(p.battleIds)||
    !Array.isArray(p.gameKeys)||!Array.isArray(p.eventIds)))
    throw new Error('RELATIONSHIPS_EVIDENCE_FACTUAL_PAIRS_INVALID');
  const factualByOther=new Map(factual.map(p=>[p.otherPlayerId,p]));
  if(factualByOther.size!==factual.length)
    throw new Error('RELATIONSHIPS_EVIDENCE_DUPLICATE_FACTUAL_PAIR');
  const others=[...new Set([...factualByOther.keys(),
    ...directed.map(d=>d.actorPlayerId===owner?d.counterpartPlayerId:d.actorPlayerId)])]
    .sort((a,b)=>a.localeCompare(b));
  const pairs:RelationshipPairRead[]=others.map(other=>{
    const perTrack={} as Record<RelationshipEvidenceTrack,RelationshipTrackRead>;
    for(const track of tracks){
      const relevant=directed.filter(d=>d.track===track&&
        ((d.actorPlayerId===owner&&d.counterpartPlayerId===other)||
         (d.actorPlayerId===other&&d.counterpartPlayerId===owner)));
      if(relevant.some(d=>d.methodVersion!==RELATIONSHIP_V1_RULE_PROPOSAL.methods[track].method))
        throw new Error('RELATIONSHIPS_EVIDENCE_TRACK_METHOD_MISMATCH');
      if(track==='HOSTILITY'&&relevant.some(d=>d.decision==='SOURCE_ADMITTED'))
        throw new Error('RELATIONSHIPS_EVIDENCE_HOSTILITY_UNAPPROVED');
      const direction=(kind:RelationshipDirection):DirectionalEvidenceRead=>{
        const actor=kind==='OUTGOING'?owner:other;
        const counterpart=kind==='OUTGOING'?other:owner;
        const own=relevant.filter(d=>d.actorPlayerId===actor&&d.counterpartPlayerId===counterpart);
        const admitted=own.filter(d=>d.decision==='SOURCE_ADMITTED');
        const pending=own.filter(d=>d.decision==='PENDING');
        const missing=new Set(pending.flatMap(d=>d.missingEvidence));
        if(!admitted.length)missing.add(own.length?'NO_ADMITTED_SOURCE_METHOD':'NO_ORIGINAL_DIRECTIONAL_DEED');
        missing.add('NUMERIC_STAGE_AND_WEAKENING_NOT_OWNER_APPROVED');
        return {direction:kind,actorPlayerId:actor,counterpartPlayerId:counterpart,
          sourceQualifiedBattles:tally(admitted,'BATTLE'),
          sourceQualifiedEvents:tally(admitted,'EVENT'),
          sourceQualifiedGames:tally(admitted,'GAME'),
          admittedDeeds:admitted,pendingDeeds:pending,
          missingEvidence:[...missing].sort()};
      };
      const outbound=direction('OUTGOING'),inbound=direction('INCOMING');
      perTrack[track]={track,status:outbound.admittedDeeds.length||inbound.admittedDeeds.length?
        'SOURCE_QUALIFIED':'PENDING_SOURCE_METHOD',outbound,inbound,
        sharedChronicleContext:'FACTUAL_ONLY',
        independentReciprocityKnown:outbound.sourceQualifiedEvents>0&&inbound.sourceQualifiedEvents>0,
        stageThreeGateOwner:'AOF_SOCIAL_V1_HISTORY_1',stageThreeEligibility:null,
        numericPoints:null,stage:null};
    }
    const current=factualByOther.get(other);
    return {otherPlayerId:other,pairPlayerIds:[owner,other].sort() as [string,string],
      factualCurrentSourceBattles:current?.battleIds.length??0,
      factualCurrentSourceGames:current?.gameKeys.length??0,
      tracks:perTrack};
  });
  return {version:RELATIONSHIP_EVIDENCE_PROJECTION_VERSION,
    sourceVersion:SOCIAL_SOURCE_EVIDENCE_VERSION,
    ruleProposalVersion:RELATIONSHIP_V1_RULE_PROPOSAL.version,
    ruleStatus:'PROPOSED_UNAPPROVED',visibility:'OWNER_ONLY',ownerPlayerId:owner,
    evidenceRevision:evidence.evidenceRevision,pairs,weakeningQualified:false,officialWrites:false};
}
