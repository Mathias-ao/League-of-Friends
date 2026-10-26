import {bindingDigest} from '../engines/nativeRecordingIntegration.js';
import type {HistoricalChapter} from '../engines/socialV1History/history.js';

type Bag=Record<string,any>;
export const SOCIAL_SCHEDULE_ORDER_VERSION='AOF_SOCIAL_SCHEDULE_ORDER_1';
export interface ScheduleBattle {
 battleId:string;match:Bag;event:Bag|null;plan:Bag|null;planId:string|null;
 games:Array<{gameId:string;game:Bag}>;
}
export interface SocialScheduleOrder {
 version:typeof SOCIAL_SCHEDULE_ORDER_VERSION;battleId:string;gameId:string;eventId:string;seasonId:string;
 status:'ORDERED'|'PENDING';order:HistoricalChapter['order'];revision:string;reasons:string[];
 basis:'APPROVED_EVENT_SCHEDULE_AND_PLAN_GAME_NUMBER';
}
export function scheduleTimestampMillis(value:any):number|null{
 try{const n=value?.toMillis?.();return Number.isSafeInteger(n)&&n>0?n:null;}catch{return null;}
}
const validIds=(xs:unknown):xs is string[]=>Array.isArray(xs)&&xs.length>0&&xs.every(x=>typeof x==='string'&&x.length>0)&&new Set(xs).size===xs.length;
/** Canonical league chapter sequence, not a claim about actual wall-clock play.
 * Only server-read approved MAIN plan slots have an authoritative Battle ordinal.
 * Warmup windows overlap main and legacy matchNumber=0 is not an order witness.
 * Never use document IDs, arrival/upload/completion time or array order alone.
 */
export function deriveSocialScheduleOrders(battles:ScheduleBattle[]):SocialScheduleOrder[]{
 const starts=new Map<number,Set<string>>();
 for(const b of battles){const n=scheduleTimestampMillis(b.event?.startsAt);if(n!==null){const ids=starts.get(n)??new Set<string>();ids.add(b.match.eventId);starts.set(n,ids);}}
 return battles.flatMap(b=>{
  const {match:m,event:e,plan:p}=b,start=scheduleTimestampMillis(e?.startsAt),issues:string[]=[];
  if(!e||start===null)issues.push('EVENT_SCHEDULE_MISSING');
  if(!m.eventId||!m.seasonId||e?.seasonId!==m.seasonId)issues.push('SCHEDULE_SCOPE_MISMATCH');
  if(start!==null&&starts.get(start)!.size!==1)issues.push('EVENT_SCHEDULE_TIE');
  if(e?.warmupMatchIds?.includes(b.battleId)||m.scoringSnapshot?.rules?.act==='WARMUP')issues.push('WARMUP_TOTAL_ORDER_NOT_ESTABLISHED');
  if(!b.planId||m.sourceMatchPlanId!==b.planId||e?.approvedMatchPlanId!==b.planId||e?.matchPlanStatus!=='APPROVED'||p?.status!=='APPROVED')issues.push('APPROVED_PLAN_REQUIRED');
  if(!validIds(e?.officialMatchIds)||!validIds(p?.officialMatchIds)||
   bindingDigest(e?.officialMatchIds??null)!==bindingDigest(p?.officialMatchIds??null)||!Array.isArray(p?.matches)||p.matches.length!==p.officialMatchIds.length||
   !Number.isSafeInteger(m.matchNumber)||m.matchNumber<1||p?.officialMatchIds?.[m.matchNumber-1]!==b.battleId)issues.push('APPROVED_BATTLE_SLOT_MISMATCH');
  const numbers=b.games.map(g=>g.game.gameNumber).sort((a,b)=>a-b);
  if(!numbers.length||numbers.some((n,i)=>!Number.isSafeInteger(n)||n!==i+1)||new Set(b.games.map(g=>g.gameId)).size!==b.games.length)issues.push('EXPLICIT_CONTIGUOUS_GAME_NUMBERS_REQUIRED');
  const evidence={version:SOCIAL_SCHEDULE_ORDER_VERSION,eventId:m.eventId,seasonId:m.seasonId,eventStartsAtMs:start,
   approvedMatchPlanId:e?.approvedMatchPlanId??null,matchPlanStatus:e?.matchPlanStatus??null,
   eventMatchIds:e?.officialMatchIds??null,warmupMatchIds:e?.warmupMatchIds??null,
   planId:b.planId,planStatus:p?.status??null,planMatchIds:p?.officialMatchIds??null,planSlotCount:p?.matches?.length??null,
   sourceMatchPlanId:m.sourceMatchPlanId??null,matchNumber:m.matchNumber??null,
   gameNumbers:b.games.map(g=>[g.gameId,g.game.gameNumber??null]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))),
   eventSchedulePeers:start===null?[]:[...starts.get(start)!].sort()};
  return b.games.map(g=>{
   const revision=bindingDigest([evidence,b.battleId,g.gameId]),reasons=[...new Set(issues)].sort();
   return {version:SOCIAL_SCHEDULE_ORDER_VERSION,battleId:b.battleId,gameId:g.gameId,eventId:m.eventId,seasonId:m.seasonId,
    status:reasons.length?'PENDING' as const:'ORDERED' as const,reasons,revision,
    basis:'APPROVED_EVENT_SCHEDULE_AND_PLAN_GAME_NUMBER' as const,
    order:reasons.length?null:{event:start!,battle:m.matchNumber,game:g.game.gameNumber,key:'chapter-'+revision}};
  });
 });
}
