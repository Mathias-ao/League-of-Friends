import {canBrowseLeague,isBattleOpen,isWarmupMatch,LeagueEvent,type LeagueSnapshot} from './league';

export interface FrontPageNotice {
 id:string;kind:'season'|'signup'|'checkin'|'warmup'|'battle'|'muster';
 label:string;title:string;body:string;context:string;action:string;
 eventId?:string;matchId?:string;deadline?:string|null;priority:number;
}
/** Actionable personal notices derived from the same evidence as the Event screens. */
export function frontPageNotices(snapshot:LeagueSnapshot,now=Date.now()):FrontPageNotice[]{
 if(snapshot.membership!=='ACTIVE'||!snapshot.viewer)return [];
 if(!snapshot.enteredSeason&&snapshot.season?.status==='ACTIVE')return [{id:`season:${snapshot.season.seasonId}`,kind:'season',label:'Raise a banner',title:'Your place in the campaign',body:'Enter the current Season to sign up for Events and earn league points.',context:snapshot.season.name,action:'Enter the Season',priority:0}];
 if(!canBrowseLeague(snapshot))return [];
 const notices:FrontPageNotice[]=[];
 for(const event of snapshot.events){
  if(!['ACTIVE','PUBLISHED'].includes(event.status)||event.seasonId&&event.seasonId!==snapshot.season?.seasonId)continue;
  const base={eventId:event.eventId,context:event.title};
  const model=new LeagueEvent(event);
  if(snapshot.enteredSeason&&model.canCheckIn(now))notices.push({...base,id:`checkin:${event.eventId}`,kind:'checkin',label:'Answer muster',title:'Your banner is awaited',body:'Confirm your attendance for the main Event. Your warm-up and main-event check-in are separate.',action:'Check in',deadline:event.checkInClosesAt,priority:1});
  const mine=snapshot.matches.filter(match=>match.eventId===event.eventId&&match.participants.some(player=>player.playerId===snapshot.viewer!.playerId)&&isBattleOpen(match.status));
  let mainReady=false;
  for(const match of mine){
   const warmup=isWarmupMatch(match);
   const opens=match.playOpensAt||(warmup?event.warmupOpensAt:null);
   const pending=match.status==='AWAITING_CONFIRMATION';
   if(!pending&&(opens&&Date.parse(opens)>now||match.playClosesAt&&Date.parse(match.playClosesAt)<now))continue;
   if(!warmup)mainReady=true;
   notices.push({...base,id:`battle:${match.matchId}`,matchId:match.matchId,kind:warmup?'warmup':'battle',label:pending?'Battle report':warmup?'Warm-up duel':'Battle orders',title:pending?'A result awaits resolution':warmup?'Your duel is ready':'Your Battle Orders await',body:pending?'Open the Battle to review the submitted result and recording evidence.':warmup?'Arrange your duel with your opponent and upload the recording after play. Every eligible warm-up contributes to statistics; only your best validated warm-up earns Event points.':match.draftRequired?'Open your assigned Battle for civilisation drafting and Battle Orders.':'Open your assigned Battle to read the orders and arrange play.',action:pending?'Review the Battle':warmup?'Open your warm-up':'Open Battle Orders',deadline:match.playClosesAt,priority:pending?2:warmup?3:2});
  }
  if(snapshot.enteredSeason&&event.viewer?.rsvp==='UNANSWERED'&&model.canRsvp(now))notices.push({...base,id:`signup:${event.eventId}`,kind:'signup',label:'Answer the call',title:'A call to arms',body:'An Event is open for signup. Read the campaign briefing and declare whether you will take the field.',action:'Open the Event',deadline:event.signupDeadlineAt,priority:4});
  if(event.viewer?.attendanceStatus==='CHECKED_IN'&&!mainReady&&!event.officialMatchIds?.length)notices.push({...base,id:`muster:${event.eventId}`,kind:'muster',label:'Muster forming',title:'Your attendance is confirmed',body:'The Emperor is resolving attendance and preparing the main-event pairings. Your Battle Orders will appear once the matches are approved.',action:'Open the muster',priority:6});
 }
 return notices.sort((a,b)=>a.priority-b.priority||(Date.parse(a.deadline??'')||Infinity)-(Date.parse(b.deadline??'')||Infinity)||a.id.localeCompare(b.id));
}
