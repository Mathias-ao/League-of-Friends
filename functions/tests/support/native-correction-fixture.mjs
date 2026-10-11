import {gzipSync,gunzipSync} from 'node:zlib';
import {readFileSync} from 'node:fs';
import {fixture,env,actor} from './native-ready-fixture.mjs';
import {digest,bindingDigest,NATIVE_PACKAGE} from '../../lib/engines/nativeRecordingIntegration.js';
import {guidKey} from '../../lib/services/nativeReadyCorrection.js';

export const correctionEnv={...env,AOF_NATIVE_READY_CORRECTION:'reviewed-v1'};
export {actor};
export function correctionFixture({sameGuid=false}={}){
  const t=fixture(),c=t.candidate;
  // Reuse the replay-driven legacy result corpus for the old accepted recording.
  const old=JSON.parse(readFileSync(new URL('../fixtures/recording-outcomes.json',import.meta.url)))[0];
  t.oldHash=old.sourceHash;t.oldSourcePath='matches/m/games/g/replaySources/'+old.sourceHash;
  t.oldGuid=old.matchFacts.game.guid;
  const previous={state:'READY',matchId:'m',gameId:'g',sourceHash:t.oldHash,
    matchFacts:structuredClone(old.matchFacts),playerMapping:c.playerMapping,
    statistics:{path:'legacy/immutable.json.gz',sha256:'2'.repeat(64)}};
  t.rows.set(t.oldSourcePath,previous);
  const result={source:'RECORDING_VERIFIED',type:'TEAM_WIN',winnerTeam:1,winnerPlayerId:null,
    winningPlayerIds:['p1'],losingPlayerIds:['p2'],revision:1};
  Object.assign(t.game,{status:'DISPUTED',activeResultDisputeId:'dispute',canonicalResult:result,
    recordingResultBinding:{sourceHash:t.oldHash,resolverVersion:'AOF_RECORDING_OUTCOME_V1'},
    activeReplayStatisticsId:t.oldHash,replayStatisticsState:'READY',replayStatisticsRevision:7});
  Object.assign(t.match,{status:'DISPUTED',activeResultDisputeId:'dispute',seriesRule:{maxGames:1,gamesRequiredToWin:1},
    participants:t.game.players,canonicalResult:{...result,sourceGameId:'g'},processingState:'BLOCKED'});
  t.rows.get('players/p1').steamName='Alice';t.rows.get('players/p2').steamName='Bob';
  t.disputePath='matches/m/games/g/resultDisputes/dispute';
  t.rows.set(t.disputePath,{status:'OPEN',category:'WRONG_REPLAY',resultRevision:1,
    canonicalResultSnapshot:structuredClone(result),openedBy:'p1'});
  t.rows.set('processingJobs/MATCH_RESULT_m_R1',{matchId:'m',gameId:'g',resultRevision:1,
    status:'BLOCKED',blockedByDisputeId:'dispute',pendingSteps:['SCORING','GOLD']});
  const raw=JSON.parse(gunzipSync(t.objects.get(c.statistics.path)));
  if(sameGuid)raw.matchFacts.game.guid=t.oldGuid;
  const header={datasetVersion:'AOF_RECORDED_EVENTS_V1',schemaVersion:'1.0.0',retentionVersion:'AOF_RECORDED_EVENTS_RETENTION_V1',
    layer:'decoded_observations',source:{sha256:t.sourceHash,bytes:c.originalRecording.bytes},
    extraction:{...c.extraction,extractorCodeSha256:'a'.repeat(64),decoderCodeSha256:'b'.repeat(64)},
    context:{participants:c.playerMapping.map(p=>({playerId:p.replaySlot,name:p.sourceName}))}};
  const footer={operationCount:1,initialObjectCount:0,tileCount:0,observedUntilMs:100,
    operationCounts:{SYNC:1},decodeStatusCounts:{complete:1},framing:'complete'};
  c.extraction=header.extraction;c.completeness=footer;
  const plain=Buffer.from([['header',header],['sync',0,100,'complete',[]],['end',footer]].map(r=>JSON.stringify(r)+'\n').join(''));
  const events=gzipSync(plain);
  Object.assign(c.recordedEvents,{sha256:digest(events),bytes:events.length,uncompressedSha256:digest(plain),uncompressedBytes:plain.length});
  t.objects.set(c.recordedEvents.path,events);
  for(const provenance of [raw.source,raw.matchFacts.source,raw.pairSocialEvidence.gameScope])provenance.recordedEventsSha256=c.recordedEvents.sha256;
  c.matchFacts=raw.matchFacts;
  t.raw=raw;
  t.repack=()=>{const plain=Buffer.from(JSON.stringify(raw)),bytes=gzipSync(plain);
    Object.assign(c.statistics,{sha256:digest(bytes),bytes:bytes.length,uncompressedSha256:digest(plain),uncompressedBytes:plain.length});
    c.provenance.projectionRevision=c.statistics.sha256;t.request.expectedArtifactSha256=c.statistics.sha256;
    const events=t.objects.get(c.recordedEvents.path);
    c.artifactRevision=bindingDigest([NATIVE_PACKAGE,c.recordedEvents.sha256,c.statistics.sha256]);
    const prefix='native-replay-evidence/m/g/'+t.sourceHash+'/'+c.artifactRevision;
    c.recordedEvents.path=prefix+'/events.jsonl.gz';c.statistics.path=prefix+'/statistics.direct.json.gz';
    t.objects.set(c.recordedEvents.path,events);
    t.objects.set(c.statistics.path,bytes);};
  t.repack();
  t.oldClaimPath='recordingGameClaims/'+guidKey(t.oldGuid);
  t.newClaimPath='recordingGameClaims/'+guidKey(c.matchFacts.game.guid);
  t.rows.set(t.oldClaimPath,{matchId:'m',gameId:'g',sourceHash:t.oldHash});
  Object.assign(t.request,{operation:'CORRECT_REBIND_V1',expectedActiveSourceHash:t.oldHash,expectedStatisticsRevision:7,
    correction:{disputeId:'dispute',resolution:'CORRECT',outcome:{type:'TEAM_WIN',winnerTeam:2,winnerPlayerId:null}},
    reason:'Reviewed the replacement recording and corrected official winner in the open dispute.'});
  t.bind=()=>{c.bindingToken=bindingDigest({game:t.game,match:t.match,
    players:t.game.players.map(p=>t.rows.get('players/'+p.playerId)),
    admin:t.rows.get('players/admin'),link:t.rows.get('authLinks/uid')});};
  t.bind();
  const run=t.run;t.run=(extra={})=>run({env:correctionEnv,...extra});
  return t;
}
