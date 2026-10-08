import {type Transaction,type DocumentReference} from 'firebase-admin/firestore';
import {db} from '../config/firebase.js';
import {eventFinalisationBlockers} from '../engines/eventFinalisation.js';
import {selectBestWarmups,BEST_WARMUP_POLICY} from './bestWarmup.js';
import {currentOfficialGameOutcome} from '../engines/recordingMatchFacts.js';
export async function readEventFinalisation(ref:DocumentReference,event:any,tx?:Transaction) {
  const read=(r:any):Promise<any>=>tx?tx.get(r):r.get();
  const [matches,jobs,challenges]=await Promise.all([read(db.collection('matches').where('eventId','==',ref.id)),read(db.collection('processingJobs')),read(ref.collection('warmupChallenges'))]);
  const games=[],warmupCandidates=[];
  for(const match of matches.docs)for(const game of (await read(match.ref.collection('games'))).docs){
    const source=game.data().activeReplayStatisticsId?(await read(game.ref.collection('replaySources').doc(game.data().activeReplayStatisticsId))).data():null;
    games.push({matchId:match.id,...game.data(),activeSourceState:source?.state??null,recordingEvidenceReady:source?.state==='READY'&&source.sourceHash===game.data().recordingResultBinding?.sourceHash&&source.matchId===match.id&&source.gameId===game.id&&currentOfficialGameOutcome(game.data(),match.data()).qualification==='OFFICIAL'});
    const m=match.data(),g=game.data();
    if(m.warmupScoringPolicy===BEST_WARMUP_POLICY&&m.status==='COMPLETED'&&!m.activeResultDisputeId&&m.scoringResultRevision===m.canonicalResult?.revision&&m.canonicalResult?.sourceGameId===game.id&&source?.state==='READY'&&g.replayStatisticsState==='READY'&&source.sourceHash===g.activeReplayStatisticsId&&source.matchId===match.id&&source.gameId===game.id&&currentOfficialGameOutcome(g,m).qualification==='OFFICIAL')warmupCandidates.push({matchId:match.id,playerIds:m.participants.map((p:any)=>p.playerId),winnerIds:m.canonicalResult.winningPlayerIds,revision:m.canonicalResult.revision,sourceHash:source.sourceHash});
  }
  const blockers=eventFinalisationBlockers(event,matches.docs.map((m:any)=>({matchId:m.id,...m.data()})),games,jobs.docs.map((j:any)=>j.data()),challenges.docs.map((c:any)=>c.data()),Date.now());
  if(event.warmupPolicy?.scoringPolicy===BEST_WARMUP_POLICY) {
    const selected=await read(ref.collection('warmupSelections')),expected=selectBestWarmups(warmupCandidates);
    const actual=new Map(selected.docs.filter((d:any)=>d.data().selected).map((d:any)=>[d.id,d.data().selected]));
    if(JSON.stringify([...expected].sort())!==JSON.stringify([...actual].sort()))blockers.push({kind:'WARMUP_POINTS',message:'Best warm-up results are still being reconciled. Retry pending result processing.'});
  }
  return {canFinalise:!blockers.length,blockers,notices:matches.docs.filter((m:any)=>m.data().scoringState==='PLACEMENTS_PENDING').map((m:any)=>({matchId:m.id,message:'FFA placement evidence is pending. Closure awards no unverified placement points; later qualified evidence can still reconcile them.'})),finalisedAt:event.finalisedAt?.toDate().toISOString()??null,revision:event.finalisationRevision??0};
}
