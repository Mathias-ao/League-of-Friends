import {currentOfficialGameOutcome} from './recordingMatchFacts.js';
import {statisticsBindingKey} from './statisticsExperience.js';

/**
 * Read-side contract ONLY. There is deliberately no producer of this marker:
 * validation candidates are NOT READY and cannot become player-facing sources.
 * A separate correction-safe atomic activation implementation and release
 * approval are required before any native source can satisfy this contract.
 */
export const ACTIVE_NATIVE_SOURCE_VERSION='AOF_ACTIVE_NATIVE_STATISTICS_V1';
export const NATIVE_SHARED_DELIVERY='AOF_DIRECT_SHARED_EPISODES_V1_EXPERIMENTAL';
const SHA=/^[0-9a-f]{64}$/;
type Bag=Record<string,any>;
const object=(v:unknown):Bag|null=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Bag:null;
const id=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,200}$/.test(v);

/** Never infer publication from a validation candidate, Storage object, or flag. */
export function activeNativeStatisticsSource(
  matchId:string,gameId:string,match:unknown,game:unknown,sourceId:string,source:unknown,
  enabled:boolean,
):{source:Bag;artifact:Bag;eventsSha256:string;extractionRunId:string}|null {
  const m=object(match),g=object(game),s=object(source);
  if(!enabled||!id(matchId)||!id(gameId)||!SHA.test(sourceId)||
     !m||!g||!s||s.nativePublicationVersion!==ACTIVE_NATIVE_SOURCE_VERSION||
     s.state!=='READY'||s.matchId!==matchId||s.gameId!==gameId||
     g.activeReplayStatisticsId!==sourceId||g.replayStatisticsState!=='READY'||
     s.sourceHash!==sourceId||m.status!=='COMPLETED'||g.status!=='COMPLETED'||
     m.opponentKind==='AI'||g.aiOpponent||
     !!m.activeResultDisputeId||!!g.activeResultDisputeId||
     !Number.isSafeInteger(g.replayStatisticsRevision)||g.replayStatisticsRevision<1||
     s.replayStatisticsRevision!==g.replayStatisticsRevision) return null;
  const official=currentOfficialGameOutcome(g,m);
  if(official.qualification!=='OFFICIAL')return null;
  const stats=object(s.statistics),events=object(s.recordedEvents);
  const original=object(s.originalRecording),extraction=object(s.extraction);
  if(!stats||!events||!original||!extraction||
     !SHA.test(events.sha256)||events.datasetVersion!=='AOF_RECORDED_EVENTS_V1'||
     !SHA.test(s.processorRevision)||!SHA.test(s.nativeValidationCandidateId)||
     stats.projectionDeliveryVersion!==NATIVE_SHARED_DELIVERY||
     !SHA.test(stats.sha256)||!SHA.test(stats.uncompressedSha256)||
     !Number.isSafeInteger(stats.bytes)||!Number.isSafeInteger(stats.uncompressedBytes)||
     stats.bytes<1||stats.uncompressedBytes<1||
     !/^[0-9]+$/.test(String(stats.generation??''))||
     typeof extraction.revision!=='string'||!extraction.revision||
     original.permanent!==true||original.sourceDeletionAuthorized!==false||
     !/^[0-9]+$/.test(String(original.generation??'')))return null;
  const prefix='native-replay-evidence/'+matchId+'/'+gameId+'/'+sourceId+'/';
  if(original.path!==prefix+'source.aoe2record'||
     typeof s.artifactRevision!=='string'||!SHA.test(s.artifactRevision)||
     stats.path!==prefix+s.artifactRevision+'/statistics.direct.json.gz'||
     events.path!==prefix+s.artifactRevision+'/events.jsonl.gz')return null;
  const roster=Array.isArray(g.players)?g.players:[],mapping=Array.isArray(s.playerMapping)?s.playerMapping:[];
  const rosterIds=roster.map((p:unknown)=>object(p)?.playerId);
  const mapIds=mapping.map((p:unknown)=>object(p)?.playerId);
  const slots=mapping.map((p:unknown)=>object(p)?.replaySlot);
  if(rosterIds.length<2||rosterIds.length>8||mapping.length!==rosterIds.length||
     rosterIds.some((v:unknown)=>typeof v!=='string'||!v)||
     mapIds.some((v:unknown)=>typeof v!=='string'||!v)||
     slots.some((v:unknown)=>!Number.isSafeInteger(v)||Number(v)<1||Number(v)>8)||
     new Set(rosterIds).size!==rosterIds.length||
     new Set(mapIds).size!==mapIds.length||
     new Set(slots).size!==slots.length||
     mapIds.some((v:unknown)=>!rosterIds.includes(v)))return null;
  const key=statisticsBindingKey({sourceHash:sourceId,roster,mapping,opponents:[]});
  if(s.experience?.bindingKey!==key||
     s.experience?.version!=='AOF_STATISTICS_EXPERIENCE_V3')return null;
  return {source:s,artifact:stats,eventsSha256:events.sha256,extractionRunId:extraction.revision};
}
