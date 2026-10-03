import {createHash} from 'node:crypto';
import type {DiplomacyTimeline,DiplomacyStance,ReplayMoment} from './diplomacyTimeline.js';

export const DECLARED_DIPLOMACY_HISTORY_VERSION='AOF_DECLARED_DIPLOMACY_HISTORY_V1';
type Source={replaySha256:string;canonicalManifestSha256?:string;extractionRunId?:string};
type Declaration={stance:DiplomacyStance;originEventId:string|null};
type PairState='RECIPROCAL_ALLY_DECLARATIONS'|'RECIPROCAL_ENEMY_DECLARATIONS'|'RECIPROCAL_NEUTRAL_DECLARATIONS'|'ASYMMETRIC_DECLARATIONS'|'INCOMPLETE_DECLARATIONS';
const moment=(atMs:number,operationOrdinal:number):ReplayMoment=>({atMs,operationOrdinal});
const key=(a:number,b:number)=>a+'->'+b;
const pairKey=(a:number,b:number)=>[a,b].sort((x,y)=>x-y).join(':');
const pairState=(a:DiplomacyStance,b:DiplomacyStance):PairState=>{
  if(a==='UNKNOWN'||b==='UNKNOWN')return 'INCOMPLETE_DECLARATIONS';
  if(a===b)return a==='ALLY'?'RECIPROCAL_ALLY_DECLARATIONS':a==='ENEMY'?'RECIPROCAL_ENEMY_DECLARATIONS':'RECIPROCAL_NEUTRAL_DECLARATIONS';
  return 'ASYMMETRIC_DECLARATIONS';
};
export function buildDeclaredDiplomacyHistory(timeline:DiplomacyTimeline,source:Source){
  if(!source.replaySha256)throw new Error('Declared history requires a recording source.');
  const revision=JSON.stringify([DECLARED_DIPLOMACY_HISTORY_VERSION,source.replaySha256,source.canonicalManifestSha256??null,source.extractionRunId??null]);
  const id=(kind:string,parts:unknown[])=>kind+'-'+createHash('sha256').update(JSON.stringify([revision,...parts])).digest('hex');
  const current=new Map<string,Declaration>();
  const pairStarts=new Map<string,ReplayMoment>();
  const pairIntervals:{intervalId:string;pairPlayerIds:number[];start:ReplayMoment;end:ReplayMoment;state:PairState;
    firstToSecond:DiplomacyStance;secondToFirst:DiplomacyStance;sourceEventIds:string[];engineStateEstablished:false}[]=[];
  const directedEpisodes:{episodeId:string;fromPlayerId:number;toPlayerId:number;start:ReplayMoment;end:ReplayMoment;
    declaredStance:DiplomacyStance;sourceEventIds:string[];sourceReferenceMeaning:string;newSocialDeed:false}[]=[];
  const active=new Map<string,typeof directedEpisodes[number]>();
  const turningPoints:{beatId:string;sourceEventId:string;moment:ReplayMoment;fromPlayerId:number;toPlayerId:number;
    previousDeclaration:DiplomacyStance;declarationAfter:DiplomacyStance;pairBefore:PairState;pairAfter:PairState;
    recordedStanceReversal:boolean;allyDeclarationWithdrawn:boolean;previousReciprocalAllyDeclarations:boolean;
    reciprocalAllyDeclarationsEstablished:boolean;sourceEventIds:string[];newSocialDeed:false;treacheryEstablished:false}[]=[];
  const counters={orders:timeline.changes.length,allyOrders:0,enemyOrders:0,neutralOrders:0,unknownOrders:0,
    directedEdgesObserved:0,recordedStanceReversals:0,repeatedRequests:0,reciprocalAllyDeclarationEstablishments:0,
    allyDeclarationWithdrawals:0};
  const start=moment(0,-1),end=moment(timeline.durationMs,Number.MAX_SAFE_INTEGER);
  for(const a of timeline.playerIds)for(const b of timeline.playerIds){
    if(a===b)continue;
    current.set(key(a,b),{stance:'UNKNOWN',originEventId:null});
    const episode={episodeId:id('declaration',[a,b,'initial-unknown']),fromPlayerId:a,toPlayerId:b,
      start:{...start},end:{...end},declaredStance:'UNKNOWN' as DiplomacyStance,sourceEventIds:[] as string[],
      sourceReferenceMeaning:'orders throughout the declaration interval; later repeats are not evidence at its start',newSocialDeed:false as const};
    active.set(key(a,b),episode);directedEpisodes.push(episode);
    pairStarts.set(pairKey(a,b),{...start});
  }
  const snapshot=(a:number,b:number)=>{
    const players=[a,b].sort((x,y)=>x-y),first=current.get(key(players[0],players[1]))!,second=current.get(key(players[1],players[0]))!;
    return {players,firstToSecond:first.stance,secondToFirst:second.stance,state:pairState(first.stance,second.stance),
      sourceEventIds:[first.originEventId,second.originEventId].filter((x):x is string=>x!==null).sort()};
  };
  const closePair=(a:number,b:number,boundary:ReplayMoment)=>{
    const s=snapshot(a,b),begin=pairStarts.get(pairKey(a,b))!;
    pairIntervals.push({intervalId:id('declared-pair',[s.players,begin,boundary,s.sourceEventIds]),pairPlayerIds:s.players,
      start:{...begin},end:{...boundary},state:s.state,firstToSecond:s.firstToSecond,secondToFirst:s.secondToFirst,
      sourceEventIds:s.sourceEventIds,engineStateEstablished:false});
    pairStarts.set(pairKey(a,b),{...boundary});
  };
  const seen=new Set<string>();
  for(const change of timeline.changes){
    const a=change.fromPlayerId,b=change.toPlayerId,k=key(a,b),at=moment(change.atMs,change.operationOrdinal);
    if(change.effectQualification!=='COMMAND_ONLY')throw new Error('Declared history accepts command-only evidence.');
    const prior=current.get(k)!;
    if(!prior)throw new Error('Declared history command roster mismatch.');
    seen.add(k);
    const next=change.commandedStance;
    if(next==='ALLY')counters.allyOrders++;else if(next==='ENEMY')counters.enemyOrders++;
    else if(next==='NEUTRAL')counters.neutralOrders++;else counters.unknownOrders++;
    const before=snapshot(a,b);
    if(prior.stance===next){
      active.get(k)!.sourceEventIds.push(change.eventId);
      if(next!=='UNKNOWN')counters.repeatedRequests++;
      continue;
    }
    closePair(a,b,at);
    active.get(k)!.end={...at};
    const episode={episodeId:id('declaration',[a,b,change.eventId]),fromPlayerId:a,toPlayerId:b,start:{...at},end:{...end},
      declaredStance:next,sourceEventIds:[change.eventId],
      sourceReferenceMeaning:'orders throughout the declaration interval; later repeats are not evidence at its start',newSocialDeed:false as const};
    active.set(k,episode);directedEpisodes.push(episode);
    current.set(k,{stance:next,originEventId:change.eventId});
    const after=snapshot(a,b),reversal=prior.stance!=='UNKNOWN'&&next!=='UNKNOWN';
    const withdrawn=prior.stance==='ALLY'&&next!=='ALLY'&&next!=='UNKNOWN';
    const reciprocal=after.state==='RECIPROCAL_ALLY_DECLARATIONS'&&before.state!==after.state;
    if(reversal)counters.recordedStanceReversals++;
    if(withdrawn)counters.allyDeclarationWithdrawals++;
    if(reciprocal)counters.reciprocalAllyDeclarationEstablishments++;
    turningPoints.push({beatId:id('diplomacy-beat',[change.eventId]),sourceEventId:change.eventId,moment:at,
      fromPlayerId:a,toPlayerId:b,previousDeclaration:prior.stance,declarationAfter:next,pairBefore:before.state,pairAfter:after.state,
      recordedStanceReversal:reversal,allyDeclarationWithdrawn:withdrawn,previousReciprocalAllyDeclarations:before.state==='RECIPROCAL_ALLY_DECLARATIONS',
      reciprocalAllyDeclarationsEstablished:reciprocal,sourceEventIds:[...new Set([...before.sourceEventIds,change.eventId])].sort(),
      newSocialDeed:false,treacheryEstablished:false});
  }
  for(let i=0;i<timeline.playerIds.length;i++)for(let j=i+1;j<timeline.playerIds.length;j++)closePair(timeline.playerIds[i],timeline.playerIds[j],end);
  counters.directedEdgesObserved=seen.size;
  return {modelVersion:DECLARED_DIPLOMACY_HISTORY_VERSION,source:{...source},identityNamespace:'CANONICAL_REPLAY_PLAYER_ID',
    claimLayer:'OBSERVED_COMMAND_HISTORY',durationMeaning:'observed_recording_interval_not_proven_full_game',
    counters,directedEpisodes:directedEpisodes.sort((a,b)=>a.fromPlayerId-b.fromPlayerId||a.toPlayerId-b.toPlayerId||a.start.atMs-b.start.atMs||a.start.operationOrdinal-b.start.operationOrdinal),
    pairIntervals:pairIntervals.sort((a,b)=>a.pairPlayerIds[0]-b.pairPlayerIds[0]||a.pairPlayerIds[1]-b.pairPlayerIds[1]||a.start.atMs-b.start.atMs||a.start.operationOrdinal-b.start.operationOrdinal),
    turningPoints,policy:{engineStateEstablished:false,relationshipScoringEnabled:false,reputationScoringEnabled:false,
      treacheryEstablished:false,absenceQualified:false,commandsAreNotAdditionalDeeds:true}};
}
