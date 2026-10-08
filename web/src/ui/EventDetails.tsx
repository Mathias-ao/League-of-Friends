import {useEffect,useId,useState} from 'react';
import {ArrowRight,BookOpen,Check,Clock3,Flag,Shield,Swords,Users} from 'lucide-react';
import {LeagueEvent,LeagueService,formatName,isLombardia,isMainEventMatch,isWarmupMatch,type EventDetail,type MatchRecord} from '../domain/league';
import {formatLeaguePoints} from '../domain/seasonPoints';
import {eventDesignPreview,type EventDesignState} from '../data/eventDesignPreview';
import {lombardia} from '../data/content';
import {Avatar,DateLabel} from './Primitives';
import {CampaignBriefing} from './CampaignBriefing';
import {EventRoundoffShowcase} from './EventRoundoffShowcase';
import {useScheduleClock} from '../hooks/useScheduleClock';
import type {ViewProps} from './App';

type Tab='briefing'|'battles'|'roundoff';
const tabs:Array<{id:Tab;label:string}>=[{id:'briefing',label:'Briefing'},{id:'battles',label:'Battles'},{id:'roundoff',label:'Roundoff'}];
export function hasAvailableRoundoff(data:EventDetail){
  const revision=data.roundoff?.revision;
  const expected=data.event.resultsRelease?.revision;
  return typeof revision==='number'&&Number.isInteger(revision)&&revision>0&&(expected==null||expected===revision);
}
const battleStatus=(match:MatchRecord)=>match.status==='COMPLETED'?'Played':match.status==='READY'?'Ready':match.status==='ACTIVE'?'Underway':match.status==='DISPUTED'?'Under review':match.status==='AWAITING_CONFIRMATION'?'Awaiting result':match.status==='CANCELLED'?'Cancelled':'Scheduled';
export function EventDetails(props:ViewProps&{data:EventDetail;onUpdated:()=>void}){
  const {snapshot,repository,busy,act,enter,onUpdated,openMatch,preview}=props;
  const [tab,setTab]=useState<Tab>('briefing'),[designState,setDesignState]=useState<EventDesignState>('current');
  const tabId=useId();
  const [storyOpen,setStoryOpen]=useState(false);
  useEffect(()=>{setTab('briefing');setDesignState('current');setStoryOpen(false);},[props.data.event.eventId]);
  const data=preview?eventDesignPreview(props.data,snapshot,designState):props.data;
  const now=useScheduleClock([data.event.checkInOpensAt,data.event.checkInClosesAt,data.event.signupDeadlineAt,data.event.warmupOpensAt,data.event.startsAt]);
  const event=new LeagueEvent({...data.event,viewer:data.viewer});
  const official=data.matches.filter(match=>match.status!=='PROPOSED');
  const warmups=official.filter(isWarmupMatch),mains=official.filter(isMainEventMatch);
  const mine=(match:MatchRecord)=>match.participants.some(p=>p.playerId===data.viewer.playerId);
  const myWarmup=warmups.find(mine),myMain=mains.find(mine);
  const checkedIn=(data.signup.confirmed??[]).filter(p=>p.attendanceStatus==='CHECKED_IN').length;
  const available=hasAvailableRoundoff(data);
  const mainComplete=data.event.status==='COMPLETED';
  const suspended=data.event.status==='CANCELLED'||data.event.status==='POSTPONED';
  const inactive=['COMPLETED','CANCELLED','POSTPONED'].includes(data.event.status);
  const previewing=preview&&designState!=='current';
  const actionDisabled=busy||previewing;
  const respond=async(value:'YES'|'NO')=>{
    if(snapshot.membership!=='ACTIVE'||value==='YES'&&!snapshot.enteredSeason){enter();return;}
    const fresh={...snapshot,events:[...snapshot.events.filter(e=>e.eventId!==event.id),{...data.event,viewer:data.viewer}]};
    if(await act(()=>new LeagueService(repository).rsvp(fresh,event.id,value),'Your event response has been saved.'))onUpdated();
  };
  const checkIn=async()=>{if(await act(()=>repository.checkIn(event.id),'You are checked in.'))onUpdated();};
  const ownBattleAction=(match:MatchRecord)=>match.draftRequired&&match.status==='READY'?'Enter civilization draft':'Open your Battle';
  const phaseLabel=mainComplete?'Event completed':data.event.status==='CANCELLED'?'Event cancelled':data.event.status==='POSTPONED'?'Event postponed':data.event.status==='ACTIVE'?'Campaign underway':'The call to arms';
  const artwork=data.event.artworkUrl||(isLombardia(data.event)?'/artwork/event-lombardia.png':null);
  const warmupOpensAt=data.event.warmupOpensAt||(data.event.startsAt&&Number.isFinite(Date.parse(data.event.startsAt))?new Date(Date.parse(data.event.startsAt)-7*86400000).toISOString():null);
  const checkInClosed=!!data.event.checkInClosesAt&&Date.parse(data.event.checkInClosesAt)<=now;
  const checkInMessage=data.viewer.attendanceStatus==='CHECKED_IN'?(myWarmup||myMain?'Your approved Battles are ready to open below.':'The muster is forming. Your Battles will appear once the plan is approved.'):data.viewer.signupState==='WAITING_LIST'?'A place opens when a confirmed player withdraws.':data.viewer.rsvp==='YES'?(event.canCheckIn(now)?'Check-in is open for the main Event. Confirm your attendance before the deadline.':checkInClosed?'Main-event check-in has closed. Contact the organizer if you need assistance.':'Arrange your warm-up with your opponent during the play window. Main-event attendance is confirmed separately at check-in.'):'Confirm whether you will take the field.';
  const chooseTab=(next:Tab)=>setTab(next);
  const tabKey=(e:React.KeyboardEvent<HTMLButtonElement>,index:number)=>{
    let next=index;
    if(e.key==='ArrowRight')next=(index+1)%tabs.length;
    else if(e.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;
    else if(e.key==='Home')next=0;else if(e.key==='End')next=tabs.length-1;else return;
    e.preventDefault();setTab(tabs[next].id);document.getElementById(`${tabId}-${tabs[next].id}`)?.focus();
  };
  return <div className="event-details">
    {preview&&<div className="event-design-controls"><span>Illustrative Event states</span><label>Preview state<select value={designState} onChange={e=>{const state=e.target.value as EventDesignState;setDesignState(state);(repository as typeof repository&{setEventDesignState?:(id:string,state:EventDesignState)=>void}).setEventDesignState?.(data.event.eventId,state);setTab('briefing');}}><option value="current">Current preview data</option><option value="pairings">Warm-up pairings</option><option value="main">Main Battle ready</option><option value="preparing">Record being prepared</option><option value="released">Available roundoff</option></select></label></div>}
    <header className={'event-briefing-hero '+(artwork?'with-artwork':'')} style={artwork?{backgroundImage:`linear-gradient(90deg,rgba(22,14,10,.96),rgba(22,14,10,.57) 68%,rgba(22,14,10,.3)),url(${JSON.stringify(artwork)})`}:undefined}>
      <div><span className="event-phase"><Flag size={13}/>{phaseLabel}</span><h3>{isLombardia(data.event)?'The road to Milan':data.event.title}</h3><p>{data.event.description||(isLombardia(data.event)?lombardia.story.oneLine:'A new field of contest in the Season campaign.')}</p><button className="event-campaign-trigger" onClick={()=>setStoryOpen(true)} aria-haspopup="dialog"><BookOpen size={16}/>Read the campaign briefing<ArrowRight size={15}/></button></div>
      <div className="event-hero-facts"><span><Clock3 size={15}/><DateLabel value={data.event.startsAt}/></span><span><Swords size={15}/>{mains[0]?formatName(mains[0].format):isLombardia(data.event)?'4v4 · Lombardia':formatName(data.event.competitionStyle)}</span><span><Users size={15}/>{data.signup.confirmedCount} / {data.event.maxParticipants??'—'} banners raised</span></div>
    </header>
    <nav className="event-details-tabs" role="tablist" aria-label="Event details">
      {tabs.map((item,i)=><button key={item.id} id={`${tabId}-${item.id}`} role="tab" aria-selected={tab===item.id} aria-controls={`${tabId}-panel`} tabIndex={tab===item.id?0:-1} onClick={()=>chooseTab(item.id)} onKeyDown={e=>tabKey(e,i)}>{item.label}{item.id==='battles'&&<span>{official.length}</span>}</button>)}
    </nav>
    <div id={`${tabId}-panel`} role="tabpanel" aria-labelledby={`${tabId}-${tab}`} className="event-tab-panel">
    {tab==='briefing'&&<div className="event-briefing-layout"><div className="event-briefing-main">
      <div className="event-section-heading"><span className="eyebrow">THE ORDER OF THE EVENT</span><h3>From the first duel to the final record</h3></div>
      <div className="event-act-sequence">
        <button onClick={()=>chooseTab('battles')}><span className="event-act-index">I</span><div><span className="eyebrow">WARM-UP</span><strong>Your opening duel</strong><p>One 1v1 per player. Arrange it with your opponent in the days before the main Event.</p><small>{warmupOpensAt?<>Play window opens <DateLabel value={warmupOpensAt}/></>: 'Opens 5–7 days before the main Event'}</small></div><ArrowRight size={17}/></button>
        <button onClick={()=>myMain?openMatch(myMain.matchId):chooseTab('battles')}><span className="event-act-index">II</span><div><span className="eyebrow">MAIN EVENT</span><strong>{myMain?formatName(myMain.format):isLombardia(data.event)?'The Battle for Lombardia':'The main field of contest'}</strong><p>{mains.length?'The approved roster and every main Battle are listed together.':'The final Match plan follows the confirmed attendance.'}</p><small>{myMain?ownBattleAction(myMain):mains.length?`${mains.length} ${mains.length===1?'Battle':'Battles'} scheduled`:'Alliances and pairings to be revealed'}</small></div><ArrowRight size={17}/></button>
        <button onClick={()=>chooseTab('roundoff')}><span className="event-act-index"><BookOpen size={19}/></span><div><span className="eyebrow">THE ROUNDOFF</span><strong>{available?'What the Event left behind':'The Season will remember'}</strong><p>Points earned, notable performances and the consequences of this Event.</p><small>{available?'Available results and accomplishments':'Updates as Battle evidence is validated'}</small></div><ArrowRight size={17}/></button>
      </div>
      <div className="event-statistics-access"><Swords size={18}/><p>Battle statistics are available in each Battle’s details after its recording is processed. Points, statistics and eligible progression update as their required evidence is validated.</p></div>

      <section className="event-muster"><div className="event-section-heading"><h3>The muster</h3><span>{data.signup.confirmedCount} confirmed · {checkedIn} checked in{data.signup.waitingListCount>0&&` · ${data.signup.waitingListCount} waiting`}</span></div>{data.signup.rosterVisible?<div className="event-roster">{(data.signup.confirmed??[]).map(p=><div key={p.playerId}><Avatar player={p}/><strong>{p.steamName}</strong>{p.playerId===data.viewer.playerId&&<small>You</small>}{p.attendanceStatus==='CHECKED_IN'&&<Check size={13} aria-label="Checked in"/>}</div>)}{!data.signup.confirmed?.length&&<p>No banners have been raised yet.</p>}</div>:<p>The roster will be revealed by the Event organizer.</p>}</section>
    </div><aside className="event-player-orders" aria-label="Your Event participation"><span className="eyebrow">YOUR PLACE IN THE EVENT</span><h3>{suspended?phaseLabel:available?'The record is open':mainComplete?'The fighting is over':data.viewer.attendanceStatus==='CHECKED_IN'?'Your banner is present':data.viewer.signupState==='WAITING_LIST'?'On the waiting list':data.viewer.rsvp==='YES'?(event.canCheckIn(now)?'Time to check in':checkInClosed?'Check-in has closed':'Your banner is raised'):data.viewer.rsvp==='NO'?'You will not march':'Answer the call'}</h3>
      <p>{suspended?'Your existing Battle records remain available below.':available?'Open the roundoff to see available results and accomplishments.':mainComplete?'Validated results remain available while the Event conclusion is prepared.':checkInMessage}</p>
      {!inactive&&event.canRsvp(now)&&<div className="event-order-actions"><button className="primary" disabled={actionDisabled||data.viewer.rsvp==='YES'} onClick={()=>void respond('YES')}>{data.viewer.rsvp==='YES'?<><Check size={15}/>Banner raised</>:snapshot.enteredSeason?'Raise your banner':'Enter season first'}</button><button className="text-button" disabled={actionDisabled||data.viewer.rsvp==='NO'} onClick={()=>void respond('NO')}>{data.viewer.rsvp==='YES'?'Withdraw':'Decline'}</button></div>}
      {!inactive&&event.canCheckIn(now)&&<button className="primary" disabled={actionDisabled} onClick={()=>void checkIn()}>Check in now<ArrowRight size={15}/></button>}
      <dl className="event-key-dates"><div><dt>Main event</dt><dd><DateLabel value={data.event.startsAt}/></dd></div>{!inactive&&<><div><dt>Signup closes</dt><dd><DateLabel value={data.event.signupDeadlineAt}/></dd></div><div><dt>Main check-in opens</dt><dd><DateLabel value={data.event.checkInOpensAt}/></dd></div>{data.event.checkInClosesAt&&<div><dt>Check-in closes</dt><dd><DateLabel value={data.event.checkInClosesAt}/></dd></div>}</>}</dl>
      {(myWarmup||myMain)&&<div className="event-personal-battles">{myWarmup&&<button onClick={()=>openMatch(myWarmup.matchId)}><span>Your warm-up<strong>{myWarmup.participants.filter(p=>p.playerId!==data.viewer.playerId).map(p=>p.steamName).join(' · ')}</strong></span><ArrowRight size={15}/></button>}{myMain&&<button onClick={()=>openMatch(myMain.matchId)}><span>Your main Battle<strong>{ownBattleAction(myMain)}</strong></span><ArrowRight size={15}/></button>}</div>}
      {snapshot.viewer?.role==='ADMIN'&&data.event.competitionStyle==='ONE_V_ONE'&&!official.length&&checkedIn>=2&&!inactive&&<button className="primary" disabled={actionDisabled} onClick={async()=>{if(await act(()=>repository.formEventMatches(event.id),'The checked-in roster has been formed into an approved Battle.'))onUpdated();}}>Form Battle<ArrowRight size={15}/></button>}
    </aside></div>}
    {tab==='battles'&&<div className="event-battle-board"><section><div className="event-section-heading"><div><span className="eyebrow">ACT I · WARM-UP</span><h3>{warmups.length===4?'Four duels before the main field':'The opening duels'}</h3></div><span>{warmups.length} {warmups.length===1?'pairing':'pairings'}</span></div><p className="event-section-intro">Agree a time with your opponent within the play window, then return with the recording. Warm-ups do not require main-event check-in.</p><div className="event-warmup-window"><Clock3 size={16}/><span>{warmupOpensAt?<>Opens <DateLabel value={warmupOpensAt}/></>:<>Opens 5–7 days before the main Event</>} · Complete by the end of the main Event day (<DateLabel value={data.event.startsAt}/>)</span></div>{warmups.length?<div className="event-pairings">{warmups.map((match,i)=><button className={'event-pairing '+(mine(match)?'is-yours':'')} key={match.matchId} onClick={()=>openMatch(match.matchId)}><div className="event-battle-meta"><span>DUEL {String(i+1).padStart(2,'0')}</span><span>{mine(match)&&<b>Your duel · </b>}{match.playOpensAt&&Date.parse(match.playOpensAt)>now&&match.status==='READY'?'Opens soon':battleStatus(match)}</span></div><div className="event-duel-players">{match.participants.map((p,j)=><span key={p.playerId}>{j>0&&<i>vs</i>}<Avatar player={p}/><strong>{p.steamName}</strong></span>)}</div><span className="event-battle-link">Battle details<ArrowRight size={15}/></span></button>)}</div>:<div className="event-pending"><Swords size={22}/><div><strong>Pairings are being prepared</strong><p>Your warm-up will appear here once the pairings are announced.</p></div></div>}</section>
      <section className="event-main-field"><div className="event-section-heading"><div><span className="eyebrow">ACT II · MAIN EVENT</span><h3>{isLombardia(data.event)?'The Battle for Lombardia':'The main field'}</h3></div><span>{mains.length?`${mains.length} ${mains.length===1?'Battle':'Battles'}`:'Plan pending'}</span></div>{mains.length?mains.map((match,i)=><article className={'event-main-match '+(mine(match)?'is-yours':'')} key={match.matchId}><div className="event-battle-meta"><span>{formatName(match.format)}{mains.length>1&&` · BATTLE ${i+1}`}</span><span>{mine(match)&&<b>Your Battle · </b>}{match.playOpensAt&&Date.parse(match.playOpensAt)>now&&match.status==='READY'?'Opens soon':battleStatus(match)}</span></div><div className="event-alliance-board">{[...new Set(match.participants.map(p=>p.team??null))].map(team=><section key={String(team)}><span className="eyebrow">{team==null?'THE FIELD':isLombardia(data.event)&&match.format==='FOUR_V_FOUR'?`ALLIANCE ${team}`:`SIDE ${team}`}</span>{match.participants.filter(p=>(p.team??null)===team).map(p=><div key={p.playerId}><Avatar player={p}/><strong>{p.steamName}</strong>{p.playerId===data.viewer.playerId&&<small>You</small>}</div>)}</section>)}</div><button className="primary" onClick={()=>openMatch(match.matchId)}>{match.draftRequired&&match.status==='READY'?'Enter civilization draft':'Open Battle details'}<ArrowRight size={16}/></button></article>):<div className="event-pending"><Shield size={22}/><div><strong>The alliances are not yet formed</strong><p>The approved main plan will reflect the actual attendance.</p></div></div>}</section>
    </div>}
    {tab==='roundoff'&&<section className={'event-roundoff '+(available?'is-released':'')}><div className="event-section-heading"><div><span className="eyebrow">THE EVENT RECORD</span><h3>{available?'What this Event left behind':suspended?phaseLabel:'The record is still being written'}</h3></div>{available?<span className="event-release-badge"><Check size={13}/>Available</span>:null}</div>{available&&data.roundoff?<><p>Validated warm-up and main results are collected here. Further results may arrive while Battles remain unresolved.</p><div className="event-points-scroll"><table className="event-points"><caption>Points earned in this Event</caption><thead><tr><th scope="col">Player</th><th scope="col">Warm-up</th><th scope="col">Main</th><th scope="col">Placement</th><th scope="col">Emperor</th><th scope="col">Total</th></tr></thead><tbody>{data.roundoff.points.map(row=>{const p=official.flatMap(m=>m.participants).find(p=>p.playerId===row.playerId)??snapshot.players.find(p=>p.playerId===row.playerId);return <tr key={row.playerId} className={row.playerId===data.viewer.playerId?'is-yours':''}><th scope="row">{p?.steamName??row.playerId}</th><td>{formatLeaguePoints(row.warmup)}</td><td>{formatLeaguePoints(row.main)}</td><td>{formatLeaguePoints(row.placement)}</td><td>{formatLeaguePoints(row.emperor)}</td><td>{formatLeaguePoints(row.warmup+row.main+row.placement+row.emperor)}</td></tr>;})}</tbody></table></div><EventRoundoffShowcase items={data.roundoff.showcase} matches={official} players={snapshot.players} openMatch={openMatch}/></>:<><p>{suspended?'No roundoff is available for this Event.':data.event.resultsRelease?.state==='BLOCKED'?'Some Event results still need to be completed or resolved.':'The roundoff updates as Battle evidence and results are validated.'}</p><div className="event-roundoff-outline"><span><Swords size={19}/>Points earned</span><span><Flag size={19}/>Notable performances</span><span><BookOpen size={19}/>Lasting consequences</span></div><p className="event-roundoff-note">Processed Battle statistics remain available in Battle details. Standings, profiles and eligible progression update as their required evidence is validated.</p><button className="text-button" onClick={()=>chooseTab('battles')}>Open the Battle board<ArrowRight size={15}/></button></>}</section>}
    </div>
    {storyOpen&&<CampaignBriefing event={data.event} onClose={()=>setStoryOpen(false)}/>}
  </div>;
}
