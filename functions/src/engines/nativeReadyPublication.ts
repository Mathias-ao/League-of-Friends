import {HttpsError} from 'firebase-functions/v2/https';
import {activeNativeStatisticsSource,ACTIVE_NATIVE_SOURCE_VERSION,NATIVE_SHARED_DELIVERY}
  from './activeNativeStatisticsSource.js';
import {NATIVE_VALIDATION,bindingDigest} from './nativeRecordingIntegration.js';
import {currentOfficialGameOutcome} from './recordingMatchFacts.js';
import {nativeStatisticsExperienceInput} from './nativeStatisticsReadAdapter.js';
import {nativeSocialInput} from './nativeSocialInput.js';
import {projectStatistics,statisticsBindingKey} from './statisticsExperience.js';
import {augmentSeasonShowcase} from './seasonShowcaseProjection.js';
import {statisticsMetadata} from '../services/statisticsExperienceProjection.js';

type Bag=Record<string,any>;
const SHA=/^[0-9a-f]{64}$/;
const ID=/^[A-Za-z0-9_-]{1,200}$/;
const fail=(message:string)=>new HttpsError('failed-precondition',message);
export const NATIVE_PUBLICATION_VERSION='AOF_NATIVE_READY_PUBLICATION_V1_EXPERIMENTAL';

/** Configured staging/demo ONLY. Rollback deliberately has an independent flag,
 * so disabling publication never prevents a controlled emergency reversal. */
export function assertNativePublicationAllowed(
  env:NodeJS.ProcessEnv,actorRole:string,matchId:string,gameId:string,
  action:'review'|'publish'|'rollback',
):string {
  const project=env.GCLOUD_PROJECT||env.GOOGLE_CLOUD_PROJECT;
  if(actorRole!=='ADMIN'||!ID.test(matchId)||!ID.test(gameId)||
     project!==env.AOF_NATIVE_REPLAY_PROJECT||
     !(project==='age-of-friends-staging'||Boolean(env.FUNCTIONS_EMULATOR)&&project?.startsWith('demo-'))||
     !(env.AOF_NATIVE_REPLAY_GAME_ALLOWLIST??'').split(',').map(s=>s.trim()).includes(matchId+'/'+gameId)||
     !SHA.test(env.AOF_NATIVE_REPLAY_PROCESSOR_REVISION??''))
    throw fail('Native publication is not permitted for this administrator, project, Game or processor.');
  if(action==='review'){
    if(env.AOF_NATIVE_READY_REVIEW!=='inspect-v1')
      throw fail('Native READY review is not enabled.');
  }else if(action==='publish'){
    if(env.AOF_NATIVE_READY_PUBLICATION!=='reviewed-v1'||
       env.AOF_ACTIVE_NATIVE_PLAYER_READS!=='1'||
       env.AOF_ACTIVE_NATIVE_SOCIAL_READS!=='1')
      throw fail('Reviewed native publication and both qualified reader flags must be explicitly enabled.');
  }else if(env.AOF_NATIVE_READY_ROLLBACK!=='revert-v1')
    throw fail('Native rollback requires independent operator authorization.');
  return env.AOF_NATIVE_REPLAY_PROCESSOR_REVISION!;
}

export function officialNativeGame(match:Bag,game:Bag):Bag {
  if(match?.status!=='COMPLETED'||game?.status!=='COMPLETED'||
     match.opponentKind==='AI'||game.aiOpponent||
     match.activeResultDisputeId||game.activeResultDisputeId||
     game.recordingResultBinding||!game.canonicalResult||
     !['PLAYER_CONFIRMED','ADMIN_RESOLVED','ADMIN_CORRECTED'].includes(game.canonicalResult.source))
    throw fail('Only a completed, undisputed and independently accepted Game can publish native evidence.');
  const official=currentOfficialGameOutcome(game,match);
  if(official.qualification!=='OFFICIAL')throw fail('The currently accepted official result is not qualified.');
  return official;
}

/** The original candidate authority binding reflects the state at extraction.
 * Official results often change later. They must be explicitly reviewed, never
 * silently promoted from the original candidate binding or replay winner. */
export function validateNativePublicationCandidate(
  matchId:string,gameId:string,candidateId:string,candidate:Bag,processorRevision:string,
):void {
  const path='native-replay-evidence/'+matchId+'/'+gameId+'/'+candidate?.sourceHash+'/';
  const artifact=path+candidate?.artifactRevision+'/';
  if(!SHA.test(candidateId)||candidate?.contract!==NATIVE_VALIDATION||
     candidate?.state!=='VALIDATED_NOT_READY'||candidate.active!==false||
     candidate.leagueEffectsPermitted!==false||
     candidate.matchId!==matchId||candidate.gameId!==gameId||
     !SHA.test(candidate.sourceHash??'')||!SHA.test(candidate.artifactRevision??'')||
     !SHA.test(candidate.bindingToken??'')||
     candidate.processorRevision!==processorRevision||
     !candidate.validatedBy||candidate.originalRecording?.path!==path+'source.aoe2record'||
     candidate.originalRecording?.permanent!==true||
     candidate.originalRecording?.sourceDeletionAuthorized!==false||
     candidate.statistics?.path!==artifact+'statistics.direct.json.gz'||
     candidate.statistics?.projectionDeliveryVersion!==NATIVE_SHARED_DELIVERY||
     candidate.recordedEvents?.path!==artifact+'events.jsonl.gz'||
     candidate.recordedEvents?.datasetVersion!=='AOF_RECORDED_EVENTS_V1'||
     !SHA.test(candidate.recordedEvents?.sha256??'')||
     !SHA.test(candidate.statistics?.sha256??'')||
     !SHA.test(candidate.statistics?.uncompressedSha256??'')||
     !SHA.test(candidate.originalRecording?.sha256??'')||
     candidate.originalRecording.sha256!==candidate.sourceHash||
     !['originalRecording','recordedEvents','statistics'].every(key=>
       /^[0-9]+$/.test(String(candidate[key]?.generation??''))&&
       Number.isSafeInteger(candidate[key]?.bytes)&&candidate[key].bytes>0)||
     candidate.provenance?.sourceIdentity!==candidate.sourceHash||
     candidate.provenance?.projectionRevision!==candidate.statistics.sha256||
     candidate.provenance?.extractionRevision!==candidate.extraction?.revision||
     !Array.isArray(candidate.playerMapping)||
     candidate.matchFacts?.source?.replaySha256!==candidate.sourceHash)
    throw fail('Native validation candidate or immutable source retention is incomplete.');
}

/** Rebuild the presentation from the freshly verified compact source using the
 * CURRENT result/roster; never reuse validation-time eligibility or scores. */
export function buildNativePublishedSource(input:{
  matchId:string;gameId:string;match:Bag;game:Bag;candidateId:string;
  candidate:Bag;statistics:Bag;nextRevision:number;actorPlayerId:string;
}):Bag {
  const {matchId,gameId,match,game,candidateId,candidate,statistics,nextRevision}=input;
  const official=officialNativeGame(match,game);
  const roster=Array.isArray(game.players)?game.players:[];
  const mapping=candidate.playerMapping;
  if(roster.length<2||roster.length>8||!Array.isArray(mapping)||mapping.length!==roster.length||
     new Set(roster.map((p:Bag)=>p?.playerId)).size!==roster.length||
     new Set(mapping.map((p:Bag)=>p?.playerId)).size!==roster.length||
     new Set(mapping.map((p:Bag)=>p?.replaySlot)).size!==roster.length||
     mapping.some((p:Bag)=>!roster.some((r:Bag)=>r.playerId===p.playerId)||
       !Number.isSafeInteger(p.replaySlot)||p.replaySlot<1||p.replaySlot>8))
    throw fail('Current Game roster no longer maps uniquely to the validated native recording.');
  try {
    nativeSocialInput(statistics,mapping);
  }catch{throw fail('Native social evidence or league identity is incomplete.');}
  if(bindingDigest(statistics.matchFacts)!==bindingDigest(candidate.matchFacts))
    throw fail('Native match facts differ from the originally validated candidate.');
  const source={sourceHash:candidate.sourceHash,playerMapping:mapping,opponentMapping:[]};
  const metadata=statisticsMetadata(matchId,gameId,match,
    {...game,replayStatisticsRevision:nextRevision},source);
  if(!metadata.eligible)throw fail('The current official result cannot be used for published native statistics.');
  let experience:Bag;
  try{
    const input=nativeStatisticsExperienceInput(statistics);
    experience=augmentSeasonShowcase(input,projectStatistics(input,metadata),metadata);
  }catch{throw fail('Native statistics cannot be projected for the current approved Game.');}
  if(experience.bindingKey!==statisticsBindingKey(metadata)||
     experience.players.length!==roster.length||
     experience.players.some((p:Bag)=>!roster.some((r:Bag)=>r.playerId===p.playerId))||
     !experience.seasonShowcaseVersion)
    throw fail('Native publication statistics presentation is incomplete.');
  const published:Bag={
    nativePublicationVersion:ACTIVE_NATIVE_SOURCE_VERSION,
    publicationContract:NATIVE_PUBLICATION_VERSION,
    state:'READY',matchId,gameId,sourceHash:candidate.sourceHash,
    nativeValidationCandidateId:candidateId,processorRevision:candidate.processorRevision,
    replayStatisticsRevision:nextRevision,artifactRevision:candidate.artifactRevision,
    originalRecording:candidate.originalRecording,recordedEvents:candidate.recordedEvents,
    statistics:candidate.statistics,extraction:candidate.extraction,
    playerMapping:mapping,opponentMapping:[],
    matchFacts:candidate.matchFacts,experience,
    sourceFileName:null,sourceBytes:candidate.originalRecording.bytes,
    resultQualification:'OFFICIAL',
    officialOutcomeAtPublication:{...official,historicalSnapshotOnly:true},
    validatedBy:candidate.validatedBy,publishedBy:input.actorPlayerId,
  };
  const proposedGame={...game,activeReplayStatisticsId:candidate.sourceHash,
    replayStatisticsState:'READY',replayStatisticsRevision:nextRevision};
  if(!activeNativeStatisticsSource(matchId,gameId,match,proposedGame,candidate.sourceHash,published,true))
    throw fail('Native publication does not satisfy the complete active-player read contract.');
  if(Buffer.byteLength(JSON.stringify(published),'utf8')>900_000)
    throw fail('Native published source exceeds a conservative Firestore document limit.');
  return published;
}
