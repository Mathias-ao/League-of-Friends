export interface EventBlocker {kind:string;matchId?:string;message:string;}
/** Administrative closure never establishes a winner or publishes statistics. */
export function eventFinalisationBlockers(event:any,matches:any[],games:any[],jobs:any[],challenges:any[],nowMs:number):EventBlocker[] {
  const blockers:EventBlocker[]=[];
  if(!['ACTIVE','PUBLISHED','COMPLETED'].includes(event.status))blockers.push({kind:'EVENT_STATE',message:'The Event is not open for completion.'});
  if(!event.startsAt||event.startsAt.toMillis()>nowMs)blockers.push({kind:'NOT_STARTED',message:'The main Event has not started.'});
  if(event.warmupPolicy&&!event.warmupSchedule)blockers.push({kind:'PAIRINGS',message:'Warm-up pairings have not been generated.'});
  if(['GUEST_PENDING','ADMIN_REVIEW'].includes(event.warmupSchedule?.status))blockers.push({kind:'WARMUP',message:'Resolve the unpaired warm-up player.'});
  if(challenges.some(c=>c.status==='PENDING'))blockers.push({kind:'CHALLENGES',message:'Resolve outstanding guest invitations.'});
  if(!matches.some(m=>m.scoringSnapshot?.rules?.act==='MAIN'))blockers.push({kind:'MAIN_MISSING',message:'Create or explicitly resolve the main Event plan.'});
  for(const match of matches) {
    const id=match.matchId,terminal=['CANCELLED','VOID'].includes(match.status);
    if(terminal){if(!match.resolutionReason)blockers.push({kind:'REASON',matchId:id,message:'Record why this Battle was cancelled or voided.'});continue;}
    if(match.status!=='COMPLETED')blockers.push({kind:'MATCH',matchId:id,message:'This Battle is not resolved.'});
    if(match.activeResultDisputeId)blockers.push({kind:'DISPUTE',matchId:id,message:'Resolve the result dispute.'});
    const rows=games.filter(g=>g.matchId===id);
    if(!rows.length)blockers.push({kind:'GAMES',matchId:id,message:'This Battle has no Games.'});
    for(const game of rows)if(!['COMPLETED','CANCELLED','VOID','REMAKE','NO_CONTEST'].includes(game.status)||game.activeResultDisputeId)blockers.push({kind:'GAME',matchId:id,message:'A Game remains unresolved or disputed.'});
    if(rows.some(g=>g.status==='COMPLETED'&&g.recordingResultBinding&&!g.recordingEvidenceReady))blockers.push({kind:'RECORDING',matchId:id,message:'An accepted recording is unavailable or changed. Resolve it through the recording correction controls.'});
    if(match.status==='COMPLETED'&&match.opponentKind!=='AI') {
      if(!match.canonicalResult)blockers.push({kind:'RESULT',matchId:id,message:'The official result is missing.'});
      const job=jobs.find(j=>j.matchId===id&&j.resultRevision===(match.canonicalResult?.revision??1));
      if(!job||job.status!=='COMPLETED'||job.pendingSteps?.length)blockers.push({kind:'PROCESSING',matchId:id,message:job?.lastError?'Result processing failed; retry it.':'Required result processing is not complete.'});
    }
    if(match.opponentKind==='AI'&&(match.aiParticipation?.state!=='ADMIN_VERIFIED'||rows.some(g=>g.activeReplayStatisticsId!==match.aiParticipation.sourceHash||g.activeSourceState!=='READY')))blockers.push({kind:'AI_REVIEW',matchId:id,message:'Verify AI warm-up participation and settings.'});
    if(match.opponentKind==='AI'&&match.status==='COMPLETED'&&(match.scoringState!=='READY'||match.scoringResultRevision!==match.canonicalResult?.revision))blockers.push({kind:'PROCESSING',matchId:id,message:'AI participation accounting is not complete.'});
  }
  return blockers;
}
