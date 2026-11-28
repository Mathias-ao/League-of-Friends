import type {GameConfiguration} from '../../../functions/src/domain/types';
import {formatName,isWarmupMatch,isMainEventMatch,type EventRecord,type MatchRecord} from './league';

/** Optional publication fields preserve Events announced before optional warm-ups. */
export type PlaqueEvent=EventRecord&{
  warmupEnabled?:boolean;signupOpensAt?:string|null;warmupClosesAt?:string|null;
  gameConfig?:GameConfiguration|null;warmupGameConfig?:GameConfiguration|null;
};

export function currentEventAssignments(event:PlaqueEvent,matches:MatchRecord[],playerId?:string){
  const current=matches.filter(match=>match.eventId===event.eventId&&
    !!playerId&&match.participants.some(player=>player.playerId===playerId)&&
    !['CANCELLED','VOID','SUPERSEDED','PROPOSED'].includes(match.status)&&
    !(match as MatchRecord&{replacementMatchId?:string|null}).replacementMatchId);
  return {
    warmups:event.warmupEnabled===false?[]:current.filter(isWarmupMatch),
    mains:current.filter(isMainEventMatch)
  };
}

export function eventParticipation(event:EventRecord){
  if(event.viewer?.rsvp==='NO')return {kind:'declined',label:'You declined'};
  if(event.viewer?.rsvp==='YES'&&event.viewer.signupState==='WAITING_LIST')return {kind:'waiting',label:'Waiting list'};
  if(event.viewer?.rsvp==='YES'&&event.viewer.signupState==='CONFIRMED')return {kind:'confirmed',label:'You’re in'};
  return {kind:'unanswered',label:'No confirmed place'};
}

export function mainAttendance(event:EventRecord){
  switch(event.viewer?.attendanceStatus){
    case 'CHECKED_IN':return 'Main event · Checked in';
    case 'LATE_ADDED':return 'Main event · Added to attendance';
    case 'NO_SHOW':return 'Main event · Marked absent';
    default:return 'Main event · Not checked in';
  }
}

export function publishedGameRules(config?:GameConfiguration|null){
  if(!config)return 'Rules follow the announced Event details';
  const map=config.maps.pool.length?config.maps.pool.join(' / '):'Unrestricted maps';
  const victory=[config.victory.conquest&&'Conquest',config.victory.wonder&&'Wonder',config.victory.relic&&'Relics',config.victory.customRuleCode].filter(Boolean).join(' / ')||'Victory rules not announced';
  return `${map} · ${victory} · ${formatName(config.civilizations.mode)} civilizations`;
}

export function assignmentStatus(match:MatchRecord){
  if(match.status==='COMPLETED')return 'Completed';
  if(match.status==='AWAITING_CONFIRMATION')return 'Result awaiting confirmation';
  return `Outstanding · ${formatName(match.status)}`;
}

export function publishedEventTime(value:string|null|undefined,timeZone?:string){
  if(!value||!Number.isFinite(Date.parse(value)))return 'To be announced';
  return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short',...(timeZone?{timeZone}:{})}).format(new Date(value));
}
