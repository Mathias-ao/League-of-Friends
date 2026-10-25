/** Private Pending transport only; no grading method or SHARED_1 amendment. */
export interface PendingGrade {
  version:'AOF_INT_C1_PENDING_GRADE_ENVELOPE_1';candidateId:string;sourceAuthority:string;sourceContextRevision:string;
  sourceDeedId:string;incidentId:string;contributionGroupId:string;actorPlayerId:string;counterpartPlayerId:string;
  actorReplaySlot:number;counterpartReplaySlot:number;metricId:string;measurementMethodVersion:string;
  raw:{value:number;unit:'RECORDED_COMMAND_REQUESTS';opportunity:null};window:{startMs:number;endMs:number};
  firstSourceMoment:{recordingAtMs:number;operationOrdinal:number|null;order:'ORDERED'|'PARTIAL'};
  sourceEventIds:string[];meaning:'OBSERVED_COMMANDS_AND_INFERRED_PAIR_ATTRIBUTION';coverage:'LIMITED';
  grade:{status:'PENDING';methodVersion:null;ruleVersion:null;bandId:null;reasonCodes:string[]};counterevidenceRefs:[];missing:string[];
}
