import {buildDeclaredDiplomacyHistory} from './declaredDiplomacyHistory.js';
import {buildDiplomacyTimelineFromCanonicalEvidence} from './diplomacyEvidenceAdapter.js';

export const RECORDING_DIPLOMACY_REVIEW_VERSION='AOF_RECORDING_DIPLOMACY_REVIEW_V2';
type Row=Record<string,any>;
const record=(value:unknown):Row|null=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Row:null;
const stable=(v:any):any=>Array.isArray(v)?v.map(stable):record(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;

/** Advisory read model. No initial-header mapping, effective command promotion or scoring. */
export function projectRecordingDiplomacyReview(value:unknown):Row {
  const base={modelVersion:RECORDING_DIPLOMACY_REVIEW_VERSION,
    interpretationEnabled:false,effectiveCommandPromotionEnabled:false,absenceQualified:false,
    initialRawMappingQualified:false};
  const facts=record(value);
  if(!facts||facts.modelVersion!=='AOF_RECORDING_MATCH_FACTS_V1')return {...base,status:'UNAVAILABLE',reason:'recording_match_facts_missing',timeline:null};
  try{
    if(facts.identityNamespace!=='CANONICAL_REPLAY_PLAYER_ID'||!Array.isArray(facts.players))throw new Error('recording_player_identity_unavailable');
    const source=record(facts.source);
    if(!source||typeof source.replaySha256!=='string'||!source.replaySha256)throw new Error('recording_source_unavailable');
    const playerIds=facts.players.map((p:any)=>record(p)?.playerId);
    const diplomacy=record(facts.diplomacy);
    if(!diplomacy||!Array.isArray(diplomacy.normalizedInitialEdges)||!record(diplomacy.commandTimelines))throw new Error('diplomacy_contract_unavailable');
    const events=new Map<string,Row>();
    for(const [direction,rows] of Object.entries(diplomacy.commandTimelines)){
      if(!Array.isArray(rows))throw new Error('diplomacy_timeline_rows_invalid');
      for(const raw of rows){
        const row=record(raw);
        if(!row||typeof row.sourceEventId!=='string'||!row.sourceEventId)throw new Error('diplomacy_source_reference_missing');
        if(direction!==row.replaySlot+'->'+row.targetReplaySlot)throw new Error('diplomacy_direction_mismatch');
        const event={eventId:row.sourceEventId,eventType:'command.diplomacy_change',timestampMs:row.atMs,
          operationOrdinal:row.operationOrdinal,actorPlayerId:row.replaySlot,targetPlayerId:row.targetReplaySlot,
          payload:{diplomacy_mode:row.diplomacyMode,command_id:row.commandId}};
        const prior=events.get(event.eventId);
        if(prior&&JSON.stringify(stable(prior))!==JSON.stringify(stable(event)))throw new Error('conflicting_diplomacy_source_reference');
        events.set(event.eventId,event);
      }
    }
    const result=buildDiplomacyTimelineFromCanonicalEvidence({playerIds,durationMs:facts.game?.observedDurationMs,
      canonicalInitialDiplomacy:diplomacy.normalizedInitialEdges,events:[...events.values()] as any,
      canonicalSchemaVersion:source.canonicalSchemaVersion??'UNSPECIFIED_CANONICAL_VERSION'});
    const raw=record(diplomacy.initialRawByPlayer)??{};
    const unavailable=result.timeline.pairSegments.filter(s=>s.coverage==='UNAVAILABLE').length;
    return {...base,status:'REVIEW_AVAILABLE',source:{...source},observedDurationMeaning:'recording_interval_not_full_game',
      declaredHistory:buildDeclaredDiplomacyHistory(result.timeline,source as any),
      timeline:result.timeline,commandCount:result.diagnostics.diplomacyCommandEvents,
      normalizedInitialEdgeCount:result.diagnostics.canonicalInitialEdges,
      rawInitialVectorCount:Object.keys(raw).length,unknownPairSegmentCount:unavailable,
      knownPairSegmentCount:result.timeline.pairSegments.length-unavailable,
      headerVectorMeaning:'retained_raw_values_not_qualified_effective_stances',
      fixedTeamEvidenceMeaning:'locked_lobby_team_context_remains_a_separate_statistics_source',
      qualificationRequirement:'controlled_build_save_data_mod_fixture_with_engine_observations'};
  }catch(error){
    return {...base,status:'UNAVAILABLE',reason:error instanceof Error?error.message:'diplomacy_review_invalid',timeline:null};
  }
}
