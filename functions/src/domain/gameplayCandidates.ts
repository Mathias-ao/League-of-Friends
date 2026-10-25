import type {SourceSnapshot} from './socialV1.js';
/** Read-only projection of an unchanged, schema-validated #158 episode. */
export interface MetricGradeEpisode {
  candidateId:string;independentContributionKey:string;
  gameScope:{battleId:string;gameId:string;gameGuid:string;authorityRevision:string};
  sourceRevision:Record<string,string>;sourceContextRevision:string;sourceMeasurementsRevision:string;
  actorReplayPlayerId:number;counterpartReplayPlayerId:number;sourceDeedIds:string[];sourceEventIds:string[];
  firstSourceMoment:{recordingAtMs:number;operationOrdinal:number|null;order:'ORDERED'|'PARTIAL'};
  window:{startMs:number;endMs:number};
  rawMeasurements:Array<{metricDefinitionId:string;rawValue:number;unit:'distinct_original_actor_commands';sourceEventIds:string[];measurementMeaning:'OBSERVED_REQUEST_NOT_EXECUTION'}>;
  originalMetricMethods:string[];originalSourceLayer:string;
  opportunity:{status:'UNQUALIFIED';sourceEventIds:string[];meaning:string;approvedDenominator:null};
  counterevidenceCandidates:Array<{kind:string;sourceEventIds:string[];coverage:'LIMITED'}>;
  priorDirectedEpisodeCandidateDeedIds:string[];priorOppositeDirectedEpisodeCandidateDeedIds:string[];
  coverage:{tier:'LIMITED';limitations:string[]};
  grade:{decision:'PENDING';bandId:null;ruleVersion:null;units:null;historicalEffect:null};
  trackHypotheses:Array<{system:string;track:string;decision:'PENDING';missingEvidence:string[];proposedOnly:true;noOfficialEligibility:true}>;
  explanation:string;
}
export interface BoundGameplayCandidate {
  candidate:MetricGradeEpisode;
  pendingProposalRefs:{claimIds:string[];inferenceIds:string[];decision:'PENDING';significanceBandId:null};
  binding:{version:'AOF_INT_C2A_SOURCE_BINDING_1';source:SourceSnapshot;actorPlayerId:string;counterpartPlayerId:string;
    producerVersion:'AOF_SOCIAL_METRIC_GRADE_CANDIDATES_1';producerGameScopeAuthenticated:false;sourceAuthorityVerified:true;
    priorContextBasis:'BEFORE_EACH_CONTRIBUTING_DEED_NOT_GROUP_START';
    processorRevision:string;modelMethodDigest:string;producerSchemaDigest:string;producerProjectionRevision:string;
    sourceMeasurementsRevision:string;sourceContextRevision:string;bindingRevision:string;historicalOrder:null};
  compatibility:{version:'AOF_INT_C2A_EPISODE_COMPATIBILITY_1';componentId:string;
    producerKey:string;relatedProducerKeys:string[];legacyContributionKeys:string[];legacyDescriptorIds:string[];
    sourceDeedIds:string[];sourceIncidentIds:string[];sourceEventIds:string[];
    legacyIncidentIds:string[];relation:'SOURCE_CONNECTED_PENDING';keySubstitutionAllowed:false};
}
