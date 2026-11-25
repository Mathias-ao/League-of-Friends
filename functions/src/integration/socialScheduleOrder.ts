import {bindingDigest} from '../engines/nativeRecordingIntegration.js';
import type {HistoricalChapter} from '../engines/socialV1History/history.js';
import {compareOccurrence,verifiedOccurrence,type OccurrenceBattle} from './battleOccurrence.js';

type Bag=Record<string,any>;
export const SOCIAL_SCHEDULE_ORDER_VERSION='AOF_SOCIAL_SCHEDULE_ORDER_1';
export const SOCIAL_OCCURRENCE_ORDER_VERSION='AOF_SOCIAL_OCCURRENCE_ORDER_1';
export interface ScheduleBattle {
 battleId:string;match:Bag;event:Bag|null;plan:Bag|null;planId:string|null;
 games:Array<{gameId:string;game:Bag}>;
}
export interface SocialScheduleOrder {
 version:typeof SOCIAL_SCHEDULE_ORDER_VERSION|typeof SOCIAL_OCCURRENCE_ORDER_VERSION;battleId:string;gameId:string;eventId:string;seasonId:string;
 status:'ORDERED'|'PENDING';order:HistoricalChapter['order'];revision:string;reasons:string[];
 basis:'APPROVED_EVENT_SCHEDULE_AND_PLAN_GAME_NUMBER'|'SOURCE_VERIFIED_ACTUAL_BATTLE_PARTIAL_ORDER';
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

/** #139's positional adapter over a proven partial order. Scope is explicit:
 * only independently admitted, subject-relevant Battles are compared. A
 * qualified unrelated but unordered Battle does not silently veto a different
 * player/track/directed-pair. The caller still owns missing-source uncertainty.
 *
 * Never mix the legacy normative MAIN schedule with actual occurrence ranks.
 * A wholly MAIN-only, non-occurrence cohort retains unchanged v1 semantics.
 * Every actual-occurrence dependency must have current approved Game evidence.
 */
export function deriveScopedOccurrenceOrders(
 all:OccurrenceBattle[],scopeBattleIds:readonly string[],
):SocialScheduleOrder[]{
 const required=[...new Set(scopeBattleIds)];
 const byId=new Map(all.map(b=>[b.battleId,b]));
 if(byId.size!==all.length)throw new Error('DUPLICATE_BATTLE_OCCURRENCE_SCOPE');
 if(required.some(id=>!byId.has(id)))throw new Error('OCCURRENCE_DEPENDENCY_OUTSIDE_COMPLETE_COHORT');
 const selected=required.map(id=>byId.get(id)!);
 if(!selected.length)return [];
 const legacy=selected.every(b=>b.match.scoringSnapshot?.rules?.act!=='WARMUP'&&!b.occurrence);
 if(legacy)return deriveSocialScheduleOrders(selected);
 const proof=new Map(selected.map(b=>[b.battleId,verifiedOccurrence(b)]));
 const pending=new Set<string>(selected.filter(b=>!proof.get(b.battleId)).map(b=>b.battleId));
 let conflict=false;
 for(let i=0;i<selected.length;i++)for(let j=0;j<i;j++){
  const a=selected[i],b=selected[j],result=compareOccurrence(a.battleId,b.battleId,all);
  if(result==='UNKNOWN'){pending.add(a.battleId);pending.add(b.battleId);}
  if(result==='CONFLICT'){conflict=true;pending.add(a.battleId);pending.add(b.battleId);}
 }
 // A partial but consequentially ambiguous chain may never be converted into
 // an arbitrary total order. Keep all dependent subjects Pending.
 const complete=!pending.size;
 const ordered=complete?[...selected].sort((a,b)=>
  compareOccurrence(a.battleId,b.battleId,all)==='BEFORE'?-1:1):[];
 const ranks=new Map(ordered.map((b,i)=>[b.battleId,i+1]));
 const witness=complete?bindingDigest(ordered.map(b=>[b.battleId,proof.get(b.battleId)])):null;
 return selected.flatMap(b=>b.games
  .filter(g=>g.game.status!=='NO_CONTEST'&&g.game.status!=='REMAKE')
  .map(g=>{
   const v=proof.get(b.battleId),reason=complete?[]:
     [conflict?'OCCURRENCE_PRECEDENCE_CONFLICT':
       !v?'OCCURRENCE_SOURCE_OR_APPROVAL_PENDING':'OCCURRENCE_PEER_ORDER_PENDING'];
   const revision=bindingDigest([SOCIAL_OCCURRENCE_ORDER_VERSION,b.battleId,g.gameId,
     v??null,witness,reason,selected.map(s=>s.battleId).sort()]);
   return {version:SOCIAL_OCCURRENCE_ORDER_VERSION,battleId:b.battleId,gameId:g.gameId,
    eventId:b.match.eventId,seasonId:b.match.seasonId,status:complete?'ORDERED' as const:'PENDING' as const,
    reasons:reason,revision,basis:'SOURCE_VERIFIED_ACTUAL_BATTLE_PARTIAL_ORDER' as const,
    order:complete?{event:ranks.get(b.battleId)!,battle:1,game:g.game.gameNumber,
      key:'actual-'+bindingDigest([b.battleId,v!.binding,v!.revision,witness])}:null};
  }));
}
