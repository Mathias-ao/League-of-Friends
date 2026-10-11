import {HttpsError,onCall} from 'firebase-functions/v2/https';
import {requireAdmin} from '../auth/authorization.js';
import {db} from '../config/firebase.js';
import {callableOptions} from '../config/runtime.js';
import {currentOfficialGameOutcome} from '../engines/recordingMatchFacts.js';

const ID=/^[A-Za-z0-9_-]{1,200}$/;
const SHA=/^[a-f0-9]{64}$/;
const fail=(message:string)=>new HttpsError('failed-precondition',message);

/** Read-only, bounded and never production. A staging browser flag is NOT authority. */
export function assertNativeE2eReviewAllowed(env:NodeJS.ProcessEnv,role:string,matchId:string,gameId:string,candidateId:string){
  if(!ID.test(matchId??'')||!ID.test(gameId??'')||!SHA.test(candidateId??''))
    throw new HttpsError('invalid-argument','Pin a valid Game and native validation candidate ID.');
  const project=env.GCLOUD_PROJECT||env.GOOGLE_CLOUD_PROJECT;
  if(role!=='ADMIN'||!project||env.AOF_NATIVE_REPLAY_PROJECT!==project||
     !(project==='age-of-friends-staging'||(env.FUNCTIONS_EMULATOR==='true'&&project.startsWith('demo-'))))
    throw fail('Native review is for an authenticated staging or local-demo administrator only.');
  if(!(env.AOF_NATIVE_READY_GAME_ALLOWLIST??'').split(',').map(v=>v.trim()).includes(matchId+'/'+gameId)||
     env.AOF_NATIVE_READY_PUBLICATION!=='reviewed-v1')
    throw fail('Native review requires explicitly approved publication and an exact Game allowlist.');
  return project;
}

type Data=Record<string,any>;

/** Redacted metadata only: no original bytes, event payload or full statistics. */
export function nativeE2eReviewDto(match:Data,game:Data,candidate:Data,matchId:string,gameId:string,candidateId:string){
  if(candidate.matchId!==matchId||candidate.gameId!==gameId||
     !['VALIDATED_NOT_READY','PUBLISHED_READY','ROLLED_BACK'].includes(candidate.state)||
     !SHA.test(candidate.sourceHash??'')||!SHA.test(candidate.statistics?.sha256??'')||
     !Array.isArray(candidate.playerMapping)||candidate.playerMapping.length<2||candidate.playerMapping.length>8)
    throw fail('Candidate is incomplete or belongs to another Game.');
  const names=(candidate.playerMapping as Data[]).map(p=>{
    if(!ID.test(p.playerId??'')||!Number.isInteger(p.replaySlot)||p.replaySlot<1||p.replaySlot>8||
       typeof p.sourceName!=='string'||!p.sourceName.trim()||p.sourceName.length>100)
      throw fail('Candidate source player binding is invalid.');
    return {playerId:p.playerId,replaySlot:p.replaySlot,sourceName:p.sourceName};
  });
  const official=currentOfficialGameOutcome(game,match);
  const linked=game.recordingResultBinding||game.canonicalResult?.source==='RECORDING_VERIFIED';
  const eligible=candidate.state==='VALIDATED_NOT_READY'&&official.qualification==='OFFICIAL'&&
    !linked&&!game.activeResultDisputeId&&!match.activeResultDisputeId;
  return {
    contract:'AOF_NATIVE_E2E_REVIEW_V1',matchId,gameId,candidateId,
    candidateState:candidate.state,sourceHash:candidate.sourceHash,
    statisticsSha256:candidate.statistics.sha256,
    originalSha256:candidate.originalRecording?.sha256??null,
    originalBytes:Number(candidate.originalRecording?.bytes??0),
    recordedEventsSha256:candidate.recordedEvents?.sha256??null,
    sourcePlayers:names,matchFormat:match.format??null,
    gameStatus:game.status??null,matchStatus:match.status??null,
    expectedActiveSourceHash:game.activeReplayStatisticsId??null,
    expectedStatisticsRevision:Number(game.replayStatisticsRevision??0),
    expectedResultRevision:official.resultRevision??null,
    officialQualification:official.qualification,
    officialReason:official.reason??null,
    officialSource:official.source??null,
    officialOutcomeType:official.outcomeType??null,
    officialWinnerPlayerIds:official.winnerPlayerIds??null,
    candidatePublishEligible:eligible,
    nativeSourceIsActive:game.activeReplayStatisticsId===candidate.sourceHash&&
      candidate.state==='PUBLISHED_READY',
  };
}

export const adminGetNativeReadyReview=onCall<{matchId:string;gameId:string;candidateId:string}>(
  {...callableOptions,timeoutSeconds:30},async request=>{
    const actor=await requireAdmin(request);
    const {matchId,gameId,candidateId}=request.data??({} as any);
    assertNativeE2eReviewAllowed(process.env,actor.role,matchId,gameId,candidateId);
    const matchRef=db.collection('matches').doc(matchId),
      gameRef=matchRef.collection('games').doc(gameId);
    const [ms,gs,cs]=await Promise.all([
      matchRef.get(),gameRef.get(),gameRef.collection('nativeReplayValidations').doc(candidateId).get()
    ]);
    if(!ms.exists||!gs.exists||!cs.exists)throw new HttpsError('not-found','Reviewed Game or native candidate not found.');
    return nativeE2eReviewDto(ms.data()!,gs.data()!,cs.data()!,matchId,gameId,candidateId);
  });
