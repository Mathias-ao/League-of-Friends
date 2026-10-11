import {currentOfficialGameOutcome} from './recordingMatchFacts.js';
import {ACTIVE_NATIVE_SOURCE_VERSION,NATIVE_SHARED_DELIVERY,activeNativeStatisticsSource} from './activeNativeStatisticsSource.js';
import {bindingDigest,NATIVE_VALIDATION} from './nativeRecordingIntegration.js';
import {statisticsBindingKey} from './statisticsExperience.js';

export const NATIVE_PUBLICATION_VERSION='AOF_NATIVE_READY_PUBLICATION_V1_EXPERIMENTAL';
export const NATIVE_PUBLICATION_REVIEW='AOF_NATIVE_READY_PUBLICATION_REVIEW_V1';
const SHA=/^[0-9a-f]{64}$/;
const ID=/^[A-Za-z0-9_-]{1,200}$/;
type Bag=Record<string,any>;
const obj=(v:unknown):Bag|null=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Bag:null;
const positive=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0;
const fail=(message:string):never=>{throw new Error(message);};

/** Separate irreversible operational permission from native parsing and player reads.
 * Never allow production here, even when an operator sets these environment flags.
 */
export function assertNativePublicationAllowed(env:NodeJS.ProcessEnv,role:string,matchId:string,gameId:string,
  mode:'PUBLISH'|'ROLLBACK'){
  const project=env.GCLOUD_PROJECT||env.GOOGLE_CLOUD_PROJECT;
  if(role!=='ADMIN'||!ID.test(matchId)||!ID.test(gameId)||
     project!==env.AOF_NATIVE_REPLAY_PROJECT||
     !(project==='age-of-friends-staging'||!!env.FUNCTIONS_EMULATOR&&project?.startsWith('demo-'))||
     env.AOF_NATIVE_REPLAY_INTEGRATION!=='validate-v1'||
     env.AOF_NATIVE_REPLAY_GAME_ALLOWLIST?.split(',').map(s=>s.trim()).includes(matchId+'/'+gameId)!==true||
     !SHA.test(env.AOF_NATIVE_REPLAY_PROCESSOR_REVISION??'')||
     !env.REPLAY_WORKER_AUTH_TOKEN||
     env.AOF_ACTIVE_NATIVE_PLAYER_READS!=='1'||env.AOF_ACTIVE_NATIVE_SOCIAL_READS!=='1'||
     env.AOF_NATIVE_READY_PUBLICATION!=='reviewed-v1'||
     (mode==='ROLLBACK'&&env.AOF_NATIVE_READY_ROLLBACK!=='reviewed-v1'))
    fail('Native READY publication or rollback is not explicitly authorized in this nonproduction environment.');
  return env.AOF_NATIVE_REPLAY_PROCESSOR_REVISION!;
}

export interface NativePublicationAssessment {
  candidate:Bag;
  previousSourceId:string|null;
  officialOutcome:Bag;
  resultRevision:number;
  newStatisticsRevision:number;
}
/** Fail closed for already accepted recording-bound results: replacing their
 * source needs the separate canonical correction-dispute transaction.
 *
 * The old validation bindingToken authenticates its historical validation; a
 * new review token (in the service) binds the *current* official Game, its
 * updated League roster and the immutable candidate before publication.
 */
export function assessNativePublication(args:{
  matchId:string;gameId:string;candidateId:string;match:unknown;game:unknown;candidate:unknown;
  existingSource?:unknown;processorRevision:string;actorPlayerId:string;
}):NativePublicationAssessment {
  const {matchId,gameId,candidateId,processorRevision,actorPlayerId}=args;
  const match=obj(args.match),game=obj(args.game),candidate=obj(args.candidate);
  if(!ID.test(matchId)||!ID.test(gameId)||!SHA.test(candidateId)||
     !match||!game||!candidate||candidate.contract!==NATIVE_VALIDATION||
     candidate.state!=='VALIDATED_NOT_READY'||candidate.active!==false||
     candidate.leagueEffectsPermitted!==false||candidate.matchId!==matchId||
     candidate.gameId!==gameId||candidate.validatedBy!==actorPlayerId||
     candidate.processorRevision!==processorRevision||!SHA.test(candidate.bindingToken??'')||
     !SHA.test(candidate.sourceHash??'')||!SHA.test(candidate.artifactRevision??''))
    fail('The selected native validation candidate is not eligible for publication.');
  if(match.status!=='COMPLETED'||game.status!=='COMPLETED'||
     match.opponentKind==='AI'||game.aiOpponent||
     match.activeResultDisputeId||game.activeResultDisputeId||
     game.recordingResultBinding||game.canonicalResult?.source==='RECORDING_VERIFIED')
    fail('Accepted recording-bound, disputed, unfinished or AI Game results cannot change source here.');
  const official=currentOfficialGameOutcome(game,match);
  if(official.qualification!=='OFFICIAL'||
     !['PLAYER_CONFIRMED','ADMIN_RESOLVED','ADMIN_CORRECTED'].includes(official.source)||
     !positive(official.resultRevision))
    fail('An independently accepted and currently official Game result is required.');
  const newStatisticsRevision=(game.replayStatisticsRevision??0)+1;
  if(!Number.isSafeInteger(newStatisticsRevision)||newStatisticsRevision<1)
    fail('Invalid source revision.');
  const previousSourceId=game.activeReplayStatisticsId??null;
  if(previousSourceId!==null&&!SHA.test(previousSourceId))
    fail('Invalid previously active replay source.');
  if(previousSourceId===candidate.sourceHash||args.existingSource)
    fail('Publication cannot overwrite or convert an existing immutable replaySources document.');
  if(previousSourceId!==null&&!SHA.test(previousSourceId))
    fail('Invalid previous source.');
  const mapping=candidate.playerMapping;
  const roster=game.players;
  if(!Array.isArray(mapping)||!Array.isArray(roster)||roster.length<2||roster.length>8||
     mapping.length!==roster.length||
     new Set(roster.map((p:Bag)=>p?.playerId)).size!==roster.length||
     new Set(mapping.map((p:Bag)=>p?.playerId)).size!==roster.length||
     new Set(mapping.map((p:Bag)=>p?.replaySlot)).size!==roster.length||
     roster.some((p:Bag)=>typeof p?.playerId!=='string'||!p.playerId)||
     mapping.some((m:Bag)=>!roster.some((p:Bag)=>p.playerId===m.playerId)||
       !Number.isSafeInteger(m.replaySlot)||m.replaySlot<1||m.replaySlot>8||
       typeof m.sourceName!=='string'||!m.sourceName))
    fail('Validated native player mapping no longer covers the current Game roster.');
  const expectedKey=statisticsBindingKey({sourceHash:candidate.sourceHash,roster,mapping,opponents:[]});
  if(candidate.previewExperience?.bindingKey!==expectedKey||
     candidate.previewExperience?.version!=='AOF_STATISTICS_EXPERIENCE_V3')
    fail('The validated native statistics do not bind the current roster/team configuration.');
  const root='native-replay-evidence/'+matchId+'/'+gameId+'/'+candidate.sourceHash+'/';
  const source=obj(candidate.originalRecording),events=obj(candidate.recordedEvents),
    stats=obj(candidate.statistics),provenance=obj(candidate.provenance);
  if(!source||!events||!stats||!provenance||
     source.path!==root+'source.aoe2record'||source.sha256!==candidate.sourceHash||
     !positive(source.bytes)||source.bytes>32*1024*1024||
     source.permanent!==true||source.sourceDeletionAuthorized!==false||
     events.path!==root+candidate.artifactRevision+'/events.jsonl.gz'||
     stats.path!==root+candidate.artifactRevision+'/statistics.direct.json.gz'||
     events.datasetVersion!=='AOF_RECORDED_EVENTS_V1'||
     stats.projectionDeliveryVersion!==NATIVE_SHARED_DELIVERY||
     provenance.sourceIdentity!==candidate.sourceHash||
     provenance.projectionRevision!==stats.sha256||
     provenance.extractionRevision!==candidate.extraction?.revision||
     !SHA.test(events.sha256??'')||!SHA.test(stats.sha256??'')||
     !SHA.test(stats.uncompressedSha256??'')||
     typeof candidate.extraction?.revision!=='string'||!candidate.extraction.revision||
     [source,events,stats].some(v=>!positive(v.bytes)||!/^[0-9]+$/.test(String(v.generation??''))))
    fail('Immutable original, native event and compact statistics evidence are not bound.');
  return {candidate,previousSourceId,officialOutcome:official,
    resultRevision:official.resultRevision,newStatisticsRevision};
}

export function nativePublicationReviewToken(input:{
  candidateId:string;actorPlayerId:string;candidate:unknown;
  match:unknown;game:unknown;players:unknown[];admin:unknown;link:unknown;
  previousSource?:unknown;version?:string;
}):string {
  return bindingDigest([NATIVE_PUBLICATION_REVIEW,input.candidateId,input.actorPlayerId,
    input.candidate,input.match,input.game,input.players,input.admin,input.link,
    input.previousSource??null]);
}

export function assessNativeRollback(args:{
  matchId:string;gameId:string;match:unknown;game:unknown;source:unknown;
  journal:unknown;candidateId:string;sourceHash:string;
}):{previousSourceId:string|null;newRevision:number;resultRevision:number} {
  const {matchId,gameId,candidateId,sourceHash}=args;
  const match=obj(args.match),game=obj(args.game),source=obj(args.source),journal=obj(args.journal);
  if(!match||!game||!source||!journal||journal.version!==NATIVE_PUBLICATION_VERSION||
     journal.state!=='ACTIVE'||journal.candidateId!==candidateId||
     journal.sourceHash!==sourceHash||journal.matchId!==matchId||journal.gameId!==gameId||
     game.nativeReplayPublication?.candidateId!==candidateId||
     game.nativeReplayPublication?.sourceHash!==sourceHash||
     game.nativeReplayPublication?.revision!==journal.publishedRevision||
     game.replayStatisticsRevision!==journal.publishedRevision||
     !activeNativeStatisticsSource(matchId,gameId,match,game,sourceHash,source,true)||
     !positive(journal.resultRevision)||
     currentOfficialGameOutcome(game,match).resultRevision!==journal.resultRevision||
     bindingDigest(currentOfficialGameOutcome(game,match))!==journal.officialOutcomeToken)
    fail('Native publication is no longer an unchanged, rollback-eligible active revision.');
  const prev=journal.previousSourceId??null;
  if(prev!==null&&!SHA.test(prev))fail('Invalid previous source pointer.');
  if(!Number.isSafeInteger(game.replayStatisticsRevision+1))
    fail('Invalid rollback revision.');
  return {previousSourceId:prev,newRevision:game.replayStatisticsRevision+1,
    resultRevision:journal.resultRevision};
}
