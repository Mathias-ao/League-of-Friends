import {useEffect,useRef,useState} from 'react';
import {ArrowRight,BookOpen,Users,Crown,Check,Lock,Swords,Flag,Heart,Search,Shield,Upload,X} from 'lucide-react';
import {LeagueEvent,LeagueService,RelationshipPolicy,currentLeagueEvent,formatName,isBattleOpen,isLombardia,type EventDetail,type MatchDetail,type PlayerProfile} from '../domain/league';
import {plannedEvents,lombardia} from '../data/content';
import {civilizationById,civilizationName} from '../data/civilizations';
import {Avatar,DateLabel,Empty,Roster,Sigil} from './Primitives';
import type {ViewProps} from './App';

export function SeasonView(props:ViewProps&{onRules:()=>void}){
  const {snapshot:s,preview,busy,repository,openEvent,openMatch,openPlayer,act,enter,navigate,onRules}=props;
  const service=new LeagueService(repository);
  const now=Date.now();
  const next=currentLeagueEvent(s,now);
  const warmup=next&&s.matches.find(m=>m.eventId===next.eventId&&m.format==='ONE_V_ONE'&&m.participants.some(p=>p.playerId===s.viewer?.playerId));
  const main=next&&s.matches.find(m=>m.eventId===next.eventId&&m.format!=='ONE_V_ONE'&&m.participants.some(p=>p.playerId===s.viewer?.playerId));
  const mainBattleOpen=!!main&&isBattleOpen(main.status);
  const eventStarted=!!next?.startsAt&&Date.parse(next.startsAt)<=now;
  const eventPhase=mainBattleOpen?(eventStarted?'BATTLE IN PROGRESS':'BATTLE READY'):'NEXT EVENT';
  const viewerIsEmperor=!!s.viewer&&s.viewer.playerId===s.emperor?.playerId;
  const own=viewerIsEmperor?s.emperor:s.standings.find(p=>p.playerId===s.viewer?.playerId),target=service.nextTarget(s),points=own?.leaguePoints??0,targetPoints=target?.leaguePoints??0;
  const progress=targetPoints>0?Math.min(100,Math.max(0,points/targetPoints*100)):0;
  const rsvp=(value:'YES'|'NO')=>{if(!next)return;if(s.membership!=='ACTIVE'||value==='YES'&&!s.enteredSeason){enter();return;}void act(()=>service.rsvp(s,next.eventId,value),'Your event response has been saved.');};
  return <>
    <div className="section-heading season-heading"><div><span className="eyebrow">SEASON I</span><h1>{s.season?.name??'The Fiefdom of Bad Neighbors'}</h1></div><button className="text-button" onClick={onRules}><BookOpen size={16}/>Season rules</button></div>
    <section className="schedule-section"><div className="section-heading"><h2>Event schedule</h2><button className="text-button" onClick={()=>navigate('events')}>All events<ArrowRight size={15}/></button></div><div className="schedule">{s.events.map((e,i)=><button key={e.eventId} className={e.eventId===next?.eventId?'next':''} onClick={()=>openEvent(e.eventId)}><span className="eyebrow">{e.startsAt?new Date(e.startsAt).toLocaleDateString(undefined,{month:'short',day:'numeric'}):'DATE TBA'}</span><i/><strong>{e.title}</strong><small>{isLombardia(e)?'4v4':formatName(e.competitionStyle)}{e.eventId===next?.eventId?' · '+(mainBattleOpen&&e.eventId===next.eventId?(eventStarted?'LIVE':'READY'):'NEXT'):''}</small></button>)}{plannedEvents.map(e=><button key={e.id} onClick={()=>navigate('events')}><span className="eyebrow">{e.period}</span><i/><strong>{e.title}</strong><small>{e.format}</small></button>)}</div></section>
    {next?<section className="next-event panel">
      <div className="event-intro"><div className="event-title"><Sigil kind="flag" size={32}/><div><span className="eyebrow">{eventPhase}</span><h2>{next.title}</h2></div></div><div className="countdown"><strong>{mainBattleOpen&&eventStarted?'BATTLE IN PROGRESS':new LeagueEvent(next).countdown()}</strong></div></div>
      <div className="acts"><div className="act"><Sigil kind="duel"/><div><span className="eyebrow">ACT I · YOUR WARM-UP</span><h3>{warmup?<button className="text-button" onClick={()=>openMatch(warmup.matchId)}>{warmup.participants.filter(p=>p.playerId!==s.viewer?.playerId).map(p=>p.steamName).join(' · ')}<ArrowRight size={15}/></button>:'Opponent to be revealed'}</h3><p>1v1 · Approximately 30 minutes</p></div></div><div className="act"><Sigil/><div><span className="eyebrow">ACT II · MAIN EVENT</span><h3>{main?<button className="text-button" onClick={()=>openMatch(main.matchId)}>{formatName(main.format)} · View your match<ArrowRight size={15}/></button>:isLombardia(next)?'4v4 · Eight banners':formatName(next.competitionStyle)}</h3><p>{main?'Approved Game plan · Teams revealed':isLombardia(next)?'Lombardia · Standard Victory':'Final format follows the approved plan'}</p></div></div></div>
      <div className="event-footer"><span className="attendance"><Users size={16}/>{next.confirmedCount??0} / {next.maxParticipants??'—'} banners raised{next.viewer?.rsvp==='YES'&&<span className="confirmed"><Check size={14}/>{next.viewer.signupState==='WAITING_LIST'?'Waiting list':'You’re in'}</span>}{next.viewer?.rsvp==='NO'&&<span>You declined</span>}</span><div className="actions"><button className="text-button" onClick={()=>openEvent(next.eventId)}>Event details<ArrowRight size={15}/></button>{mainBattleOpen&&main?<button className="primary" onClick={()=>openMatch(main.matchId)}>Open current Battle<ArrowRight size={16}/></button>:new LeagueEvent(next).canRsvp()&&<><button className="text-button" disabled={busy||next.viewer?.rsvp==='NO'} onClick={()=>rsvp('NO')}>Decline</button><button className="primary" disabled={busy||next.viewer?.rsvp==='YES'} onClick={()=>rsvp('YES')}>{next.viewer?.rsvp==='YES'?'Banner raised':s.enteredSeason?'I’m in':'Enter season'}</button></>}</div></div>
    </section>:<section className="panel"><Empty title="The next muster is being prepared">Published events will appear here when announced.</Empty></section>}
    <section className="standings-section"><div className="section-heading"><h2>Season standing</h2><span className="eyebrow">{preview?'ILLUSTRATIVE STANDINGS':'THE THRONE · PLAYER LADDER'}</span></div><div className="panel standings">{s.emperor&&<section className="emperor-seat" aria-label={'Emperor '+s.emperor.steamName}><div className="emperor-office"><Crown size={24}/><span><span className="eyebrow">THE THRONE</span><strong>Emperor</strong></span></div><button className="emperor-identity" onClick={()=>openPlayer(s.emperor!.playerId)}><Avatar player={s.emperor}/><span><strong>{s.emperor.steamName}</strong><small>Fixed office · outside player ranking</small></span></button><div className="emperor-record"><span><small>W–L</small><strong>{s.emperor.wins!=null&&s.emperor.losses!=null?s.emperor.wins+'–'+s.emperor.losses:'—'}</strong></span><span><small>Points</small><strong>{s.emperor.leaguePoints??0}</strong></span></div></section>}<div className="player-ladder-label"><span className="eyebrow">PLAYER LADDER</span><span>Rank changes with league points</span></div><table><thead><tr><th scope="col" className="rank">#</th><th scope="col">Player</th><th scope="col" className="record">W–L</th><th scope="col" className="points">Points</th></tr></thead><tbody>{s.standings.map((p,i)=><tr key={p.playerId} className={p.playerId===s.viewer?.playerId?'you':''}><td className={'rank '+(i===0?'gold':'')}>{p.rank??i+1}</td><th scope="row"><button className="player-link" onClick={()=>openPlayer(p.playerId)}><Avatar player={p}/><span>{p.steamName}</span>{p.playerId===s.viewer?.playerId&&<small>YOU</small>}</button></th><td className="record">{p.wins!=null&&p.losses!=null?p.wins+'–'+p.losses:'—'}</td><td className="points">{p.leaguePoints??0}</td></tr>)}</tbody></table>
      {!s.standings.length&&<Empty title="The player ladder awaits">The first qualified player results will establish the standings.</Empty>}
      <div className="progression">{s.viewer&&s.enteredSeason?<><div><span className="eyebrow">YOUR SEASON</span><strong>{points} <small>LEAGUE POINTS</small></strong></div><div className="progress-target">{viewerIsEmperor?<><span className="eyebrow">IMPERIAL OFFICE</span><p>Your place is fixed above the ladder. Your matches still count as competitive league results.</p></>:target?<><span className="eyebrow">NEXT TARGET · {target.steamName}</span><div className="target-line"><span style={{width:progress+'%'}}/></div><p>{Math.max(0,targetPoints-points)} points to draw level</p></>:<p>{s.standings[0]?.playerId===s.viewer.playerId?'You lead the player ladder.':'Your first qualified result begins your climb.'}</p>}</div></>:<><div><span className="eyebrow">YOUR SEASON</span><p>Raise your banner. Take your place.</p></div><button className="text-button gold" onClick={enter}>Enter Season I<ArrowRight size={16}/></button></>}</div>
    </div></section>
  </>;
}
export function EventsView({snapshot,openEvent}:ViewProps){
  return <section className="section"><div className="section-heading"><div><span className="eyebrow">SEASON I</span><h1>The campaign</h1></div><span className="muted">One season. Many battlefields.</span></div><div className="event-list">
    {snapshot.events.map((e,i)=><article key={e.eventId} className="panel event-list-card"><span className="event-number">{String(i+1).padStart(2,'0')}</span><Sigil kind="flag" size={32}/><div><span className="eyebrow">{e.status.replaceAll('_',' ')}</span><h2>{e.title}</h2><p>{isLombardia(e)?lombardia.display.formatLine:formatName(e.competitionStyle)}</p><p className="muted"><DateLabel value={e.startsAt}/></p></div><button className="primary" onClick={()=>openEvent(e.eventId)}>View event<ArrowRight size={16}/></button></article>)}
    {plannedEvents.map((e,i)=><article className="panel event-list-card planned" key={e.id}><span className="event-number">{String(i+2).padStart(2,'0')}</span><Sigil kind={i?'ffa':'team'} size={32}/><div><span className="eyebrow">{e.period} · PLANNED</span><h2>{e.title}</h2><p>{e.format}</p><p className="muted">{e.description}</p></div><span className="quiet-badge">Details to come</span></article>)}
  </div><p className="footnote">Later event details are provisional. Final dates and rules will be announced with each event.</p></section>;
}
export function BattlesView({snapshot,openMatch}:ViewProps){
  const [query,setQuery]=useState(''),[filter,setFilter]=useState('all');
  const matches=snapshot.matches.filter(m=>(filter==='all'||(filter==='mine'?m.participants.some(p=>p.playerId===snapshot.viewer?.playerId):filter==='completed'?m.status==='COMPLETED':['READY','ACTIVE','AWAITING_CONFIRMATION'].includes(m.status)))&&(m.matchId+' '+m.format+' '+m.participants.map(p=>p.steamName).join(' ')).toLowerCase().includes(query.toLowerCase())).sort((a,b)=>(a.completedAt??'9999').localeCompare(b.completedAt??'9999'));
  return <section className="section"><div className="section-heading"><div><span className="eyebrow">THE BATTLE ARCHIVE</span><h1>Every encounter leaves a mark</h1></div></div><div className="filter-bar"><label className="search"><Search size={18}/><input aria-label="Search battles" placeholder="Search player or battle…" value={query} onChange={e=>setQuery(e.target.value)}/></label><select aria-label="Filter battles" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All battles</option><option value="mine">My battles</option><option value="upcoming">Upcoming & underway</option><option value="completed">Completed</option></select></div><div className="panel">
    {!matches.length?<Empty title={query||filter!=='all'?'No matching battles':'The battlefield is quiet'} icon="duel">{query||filter!=='all'?'Try another player or change the filter.':'Your approved warm-up and main-event matches will appear here after check-in and match-plan approval.'}</Empty>:matches.map(m=><button className="battle-row" key={m.matchId} onClick={()=>openMatch(m.matchId)}><Sigil kind={m.format==='ONE_V_ONE'?'duel':'team'}/><span><span className="eyebrow">{formatName(m.format)} · {m.status.replaceAll('_',' ')}</span><strong>{m.participants.map(p=>p.steamName).join(' · ')}</strong><small>{m.matchId}{m.completedAt&&<> · <DateLabel value={m.completedAt}/></>}</small></span><ArrowRight size={18}/></button>)}
  </div></section>;
}
export function PlayersView({snapshot,openPlayer}:ViewProps){
  const [query,setQuery]=useState('');const players=snapshot.players.filter(p=>p.steamName.toLowerCase().includes(query.toLowerCase()));
  return <section className="section"><div className="section-heading"><div><span className="eyebrow">THE LEAGUE ROSTER</span><h1>The people behind the banners</h1></div><label className="search"><Search size={18}/><input aria-label="Search players" placeholder="Find a player…" value={query} onChange={e=>setQuery(e.target.value)}/></label></div><div className="player-grid">
    {players.map((p,i)=><button className={'portrait-card banner-'+i%4} key={p.playerId} onClick={()=>openPlayer(p.playerId)}><div className="portrait-door"><Shield size={72} strokeWidth={.6}/><Avatar player={p} large/><span className="door-line"/></div><div className="portrait-caption"><span className="eyebrow">LEAGUE MEMBER</span><h2>{p.steamName}</h2><span className="profile-hint">Open profile<ArrowRight size={14}/></span></div></button>)}
  </div>{!players.length&&<Empty title="No players found">Try another name.</Empty>}<p className="footnote">Portraits begin as a newcomer identity. Earned military identities will follow validated match evidence.</p></section>;
}
export function WarRoomView(){
  return <section className="section war-room"><div className="war-heading"><span className="eyebrow">SOME THINGS ARE PERSONAL</span><Lock size={34} strokeWidth={1}/><h1>The War Room</h1><p>The doors remain closed.</p><span className="quiet-badge">PROGRESSION AWAITING VALIDATED STATISTICS</span></div><div className="war-intro"><h2>Respect. Rivalry. Retribution.</h2><p>Reach the third stage of Rivalry or Enemy with another player to unlock your War Room. Friendships and rivalries can grow side by side.</p></div><div className="relationship-grid">
    {RelationshipPolicy.tracks.map((t,i)=>{const Icon=i===0?Swords:i===1?Flag:Heart;return <article className={'relationship-track track-'+i} key={t.name}><Icon size={26} strokeWidth={1.2}/><span className="eyebrow">{t.axis}</span><h2>{t.name}</h2><p>{t.description}</p><ol>{t.stages.map((stage,j)=><li key={stage} className={j===2&&i<2?'unlock-stage':''}><span>{String(j+1).padStart(2,'0')}</span>{stage}{j===2&&i<2&&<Lock size={13}/>}</li>)}</ol></article>;})}
  </div><div className="war-footer"><Shield size={20}/><p>Challenges have separate season and all-time standings. War Room Points never count as League Points.</p></div></section>;
}
export function StatisticsView(){
  const [scope,setScope]=useState('season'),[category,setCategory]=useState('Economy');
  const groups:Record<string,{label:string;description:string}[]>={
    Economy:[{label:'Economy & tribute',description:'Qualified economy and support measures will appear here.'},{label:'Age progression',description:'Observed age timings will be distinguished from estimates.'}],
    Military:[{label:'Military production',description:'Completed units need evidence beyond a queue request.'},{label:'Fights & raids',description:'Combat and raid estimates are awaiting validation.'}],
    'Map Presence':[{label:'Map activity',description:'Spatial activity will carry its evidence and coverage.'},{label:'Pressure & support',description:'Directed interaction measures are still being qualified.'}],
    Execution:[{label:'Player commands',description:'Command counts exist in the extraction foundation; the player-facing contract is pending.'},{label:'Research requests',description:'Research requests do not prove an age was reached.'}]
  };
  const categories=Object.keys(groups);
  return <section className="section"><div className="section-heading"><div><span className="eyebrow">BEHIND THE BATTLES</span><h1>League statistics</h1></div><select aria-label="Statistics scope" value={scope} onChange={e=>setScope(e.target.value)}><option value="season">This season</option><option value="recent">Recent games</option><option value="lifetime">Lifetime</option></select></div><div className="stats-note"><Shield size={21}/><div><strong>Every statistic needs a battle behind it.</strong><p>Replay statistics are being qualified. Unavailable values stay empty; they are never treated as zero.</p></div></div><div className="category-tabs" role="tablist" aria-label="Statistics categories">
    {categories.map((c,i)=><button key={c} id={'category-'+i} role="tab" aria-selected={category===c} aria-controls="statistics-panel" tabIndex={category===c?0:-1} className={category===c?'active':''} onClick={()=>setCategory(c)} onKeyDown={e=>{let index=i;if(e.key==='ArrowRight')index=(i+1)%categories.length;else if(e.key==='ArrowLeft')index=(i+categories.length-1)%categories.length;else if(e.key==='Home')index=0;else if(e.key==='End')index=categories.length-1;else return;e.preventDefault();setCategory(categories[index]);document.getElementById('category-'+index)?.focus();}}>{c}</button>)}
    </div><div id="statistics-panel" role="tabpanel" aria-labelledby={'category-'+categories.indexOf(category)} className="stat-grid">{groups[category].map(m=><article className="panel stat-card" key={m.label}><span className="eyebrow">{scope==='season'?'THIS SEASON':scope==='recent'?'RECENT GAMES':'LIFETIME'}</span><h2>{m.label}</h2><strong className="stat-unavailable">—</strong><span className="quiet-badge">Awaiting qualified data</span><p>{m.description}</p></article>)}</div><div className="section-heading"><h2>Achievements, awards & trophies</h2></div><div className="panel"><Empty title="Distinctions must be earned">Definitions and earning rules are pending reliable statistics. Selected achievements will appear on profiles; full collections remain private.</Empty></div></section>;
}
export function EventDialog(props:ViewProps&{data:EventDetail;onUpdated:()=>void}){
  const {data,snapshot,busy,repository,act,enter,onUpdated,openMatch}=props;
  const event=new LeagueEvent({...data.event,viewer:data.viewer});
  const official=data.matches.filter(match=>match.status!=='PROPOSED');
  const viewerMatches=official.filter(match=>match.participants.some(player=>player.playerId===data.viewer.playerId));
  const warmup=viewerMatches.find(match=>match.format==='ONE_V_ONE')??official.find(match=>match.format==='ONE_V_ONE')??null;
  const main=viewerMatches.find(match=>match.format!=='ONE_V_ONE')??official.find(match=>match.format!=='ONE_V_ONE')??null;
  const extras=official.filter(match=>match.matchId!==warmup?.matchId&&match.matchId!==main?.matchId);
  const checkedInCount=(data.signup.confirmed??[]).filter(player=>player.attendanceStatus==='CHECKED_IN').length;
  const respond=async(value:'YES'|'NO')=>{
    if(snapshot.membership!=='ACTIVE'||value==='YES'&&!snapshot.enteredSeason){enter();return;}
    const fresh={...snapshot,events:[...snapshot.events.filter(e=>e.eventId!==event.id),{...data.event,viewer:data.viewer}]};
    if(await act(()=>new LeagueService(repository).rsvp(fresh,event.id,value),'Your event response has been saved.'))onUpdated();
  };
  const checkIn=async()=>{
    if(await act(()=>repository.checkIn(event.id),'You are checked in. Your banner is now eligible for the approved Match plan.'))onUpdated();
  };
  const checkInMessage=data.viewer.attendanceStatus==='CHECKED_IN'
    ?(main?'Checked in · your Battle is ready.':'Checked in · the muster is forming.')
    :data.viewer.rsvp==='YES'&&data.viewer.signupState==='CONFIRMED'
      ?event.canCheckIn()?'Check-in is open. Confirm your attendance before the Match plan is formed.':data.event.checkInOpensAt?'Your banner is raised. Check-in opens at the time below.':'Your banner is raised. Check-in time is still to be announced.'
      :data.viewer.signupState==='WAITING_LIST'?'Your banner is on the waiting list.':'Answer the call before event day.';
  return <><div className="detail-meta"><span className="quiet-badge">{data.event.status.replaceAll('_',' ')}</span><span><DateLabel value={data.event.startsAt}/></span></div><p>{data.event.description??''}</p>
    <div className="detail-acts">
      {warmup?<button className="detail-act-link" onClick={()=>openMatch(warmup.matchId)}><Sigil kind="duel"/><span className="eyebrow">ACT I · WARM-UP</span><h3>{formatName(warmup.format)} · Open Battle</h3><p>{warmup.participants.map(player=>player.steamName).join(' · ')}</p><ArrowRight size={17}/></button>:<div><Sigil kind="duel"/><span className="eyebrow">ACT I · WARM-UP</span><h3>1v1 · 30 minutes</h3><p>Pairings follow the approved match plan.</p></div>}
      {main?<button className="detail-act-link main-event-link" onClick={()=>openMatch(main.matchId)}><Sigil/><span className="eyebrow">ACT II · MAIN EVENT</span><h3>{formatName(main.format)} · {main.draftRequired?'Enter civilization draft':'Open Battle'}</h3><p>{main.draftRequired?'Teams are approved. Enter the muster and choose civilizations.':'The approved Battle is ready.'}</p><ArrowRight size={17}/></button>:<div><Sigil/><span className="eyebrow">ACT II · MAIN EVENT</span><h3>{isLombardia(data.event)?'4v4 · Lombardia':formatName(data.event.competitionStyle)}</h3><p>{data.viewer.attendanceStatus==='CHECKED_IN'?'Muster forming · teams appear when the Match plan is approved.':'The final Game shape follows attendance and check-in.'}</p></div>}
    </div>
    <div className="section-heading"><h3>The muster</h3><span className="muted">{data.signup.confirmedCount} confirmed · {checkedInCount} checked in · {data.signup.waitingListCount} waiting</span></div>
    {data.signup.rosterVisible?<Roster players={data.signup.confirmed??[]}/>:<p className="muted">The roster will be revealed by the event organizer.</p>}
    <div className={'participation-status '+(data.viewer.attendanceStatus==='CHECKED_IN'?'checked-in':'')}><Check size={17}/>{checkInMessage}</div>
    <div className="actions">{event.canRsvp()&&<><button className="primary" disabled={busy||data.viewer.rsvp==='YES'} onClick={()=>void respond('YES')}>{snapshot.enteredSeason?'I’m in':'Enter season first'}</button><button className="text-button" disabled={busy||data.viewer.rsvp==='NO'} onClick={()=>void respond('NO')}>Decline</button></>}
      {event.canCheckIn()&&<button className="primary check-in-action" disabled={busy} onClick={()=>void checkIn()}>Check in now<ArrowRight size={16}/></button>}
      {data.viewer.attendanceStatus==='CHECKED_IN'&&main&&<button className="primary" onClick={()=>openMatch(main.matchId)}>{main.draftRequired?'Enter civilization draft':'Enter Battle'}<ArrowRight size={16}/></button>}
      {snapshot.viewer?.role==='ADMIN'&&data.event.competitionStyle==='ONE_V_ONE'&&!official.length&&checkedInCount>=2&&<button className="primary" disabled={busy} onClick={async()=>{if(await act(()=>repository.formEventMatches(event.id),'The checked-in roster has been formed into an approved Battle.'))onUpdated();}}>Form warm-up battle<ArrowRight size={16}/></button>}
      {data.viewer.attendanceStatus!=='CHECKED_IN'&&!event.canCheckIn()&&data.viewer.rsvp==='YES'&&data.viewer.signupState==='CONFIRMED'&&<span className="muted">{data.event.checkInOpensAt?<>Check-in opens <DateLabel value={data.event.checkInOpensAt}/></>:'Check-in time to be announced'}</span>}
    </div>
    {extras.length>0&&<><hr/><h3>Other Battles</h3>{extras.map(match=><button className="battle-row" key={match.matchId} onClick={()=>openMatch(match.matchId)}><Sigil kind="duel"/><span><strong>{formatName(match.format)} · {match.matchId}</strong><small>{match.participants.map(player=>player.steamName).join(' · ')}</small></span><ArrowRight size={17}/></button>)}</>}
  </>;
}

function DraftTeamBoard({data,draft,currentPlayerId}:{data:MatchDetail;draft:NonNullable<MatchDetail['games'][number]['draft']>;currentPlayerId:string|null}){
  const teams=new Map<number|null,typeof draft.turns>();
  for(const turn of draft.turns){
    const list=teams.get(turn.team)??[];
    list.push(turn);
    teams.set(turn.team,list);
  }
  const entries=[...teams.entries()].sort(([left],[right])=>left==null?1:right==null?-1:left-right);
  const teamGame=entries.some(([team])=>team!=null);
  const playerName=(playerId:string)=>data.match.participants.find(player=>player.playerId===playerId)?.steamName??playerId;
  const teamColumn=(team:number|null,turns:typeof draft.turns)=><section className="draft-team" key={String(team)}>
    <div className="draft-team-heading"><span className="eyebrow">{team==null?'FREE FOR ALL':'TEAM '+team}</span><strong>{turns.length} {turns.length===1?'banner':'banners'}</strong></div>
    <div className="draft-team-roster">{turns.sort((a,b)=>a.slot-b.slot).map(turn=><div key={turn.playerId} className={'draft-player '+(turn.status==='COMPLETED'?'done ':'')+(currentPlayerId===turn.playerId?'current':'')}>
      <span className="draft-pick-order">PICK {String(turn.index+1).padStart(2,'0')}</span><strong>{playerName(turn.playerId)}</strong><small>{turn.civilization?civilizationName(turn.civilization):'Awaiting civilization'}</small>
    </div>)}</div>
  </section>;
  if(!teamGame)return <div className="draft-ffa-board">{entries.flatMap(([team,turns])=>turns.map(turn=><div key={turn.playerId} className={'draft-player '+(turn.status==='COMPLETED'?'done ':'')+(currentPlayerId===turn.playerId?'current':'')}><span className="draft-pick-order">PICK {String(turn.index+1).padStart(2,'0')}</span><strong>{playerName(turn.playerId)}</strong><small>{turn.civilization?civilizationName(turn.civilization):'Awaiting civilization'}</small></div>))}</div>;
  if(entries.length===2)return <div className="draft-team-board two-teams">{teamColumn(entries[0][0],entries[0][1])}<div className="draft-versus" aria-hidden="true">VS</div>{teamColumn(entries[1][0],entries[1][1])}</div>;
  return <div className="draft-team-board">{entries.map(([team,turns])=>teamColumn(team,turns))}</div>;
}

function CivilizationDraftCard({civilization,selected,selectedBy,canPick,viewerCanPick,busy,onPick}:{civilization:string;selected:boolean;selectedBy:string;canPick:boolean;viewerCanPick:boolean;busy:boolean;onPick:()=>Promise<void>}){
  const civ=civilizationById(civilization);
  const detailId='civ-'+civilization.toLowerCase().replace(/[^a-z0-9]+/g,'-');
  return <article className={'draft-civ '+(selected?'claimed ':'')+(canPick?'available':'')} tabIndex={0} aria-describedby={detailId}>
    <div className="draft-civ-title"><strong>{civ?.name??civilizationName(civilization)}</strong><span>{civ?.identity??'Civilization profile pending'}</span></div>
    <div id={detailId} className="draft-civ-detail" role="tooltip">
      <span className="eyebrow">{civ?.typeLabel??'Civilization'}</span>
      {civ?.bonuses?.length?<><strong>Civilization bonuses</strong><ul>{civ.bonuses.map(bonus=><li key={bonus}>{bonus}</li>)}</ul></>:null}
      {civ?.teamBonus&&<p><strong>Team bonus</strong><span>{civ.teamBonus}</span></p>}
      {civ?.uniqueUnits?.length?<p><strong>Unique {civ.uniqueUnits.length===1?'unit':'units'}</strong><span>{civ.uniqueUnits.map(unit=>unit.name+(unit.role?' · '+unit.role:'')).join(' · ')}</span></p>:null}
    </div>
    <button className="draft-civ-action" disabled={!canPick||busy} onClick={()=>void onPick()}>
      {selected?'Claimed by '+selectedBy:canPick?'Choose this civilization':viewerCanPick?'Unavailable to you':'Available'}
    </button>
  </article>;
}

function BattleOrdersTeam({team,players,teamGame}:{team:number|null;players:MatchDetail['games'][number]['players'];teamGame:boolean}){
  return <article className="battle-orders-side">
    <div className="battle-orders-side-heading">
      <span className="eyebrow">{teamGame&&team!=null?'TEAM '+team:'BATTLEFIELD'}</span>
      <strong>{players.length} {players.length===1?'player':'players'}</strong>
    </div>
    <div className="battle-orders-player-list">{players.sort((a,b)=>(a.slot??0)-(b.slot??0)).map(player=>{
      const civ=civilizationById(player.civilization);
      return <div className="battle-orders-player" key={player.playerId}>
        <Avatar player={player}/>
        <div className="battle-orders-player-identity">
          <strong>{player.steamName}</strong>
          <span className="battle-orders-civ">{player.civilization?(civ?.name??civilizationName(player.civilization)):'Player choice'}</span>
          <span className="battle-orders-civ-strength">{player.civilization?(civ?.identity??'Civilization profile pending'):'Choose in Age of Empires II: DE'}</span>
        </div>
      </div>;
    })}</div>
    {teamGame&&<div className="battle-orders-team-bonuses">
      <span className="eyebrow">TEAM BONUSES</span>
      {players.map(player=>{
        const civ=civilizationById(player.civilization);
        return civ?.teamBonus?<div className="battle-orders-team-bonus" key={player.playerId}>
          <strong>{civ.name}</strong><span>{civ.teamBonus}</span>
        </div>:null;
      })}
    </div>}
  </article>;
}

function BattleOrdersDialog({data,game,onClose}:{data:MatchDetail;game:MatchDetail['games'][number];onClose:()=>void}){
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const dialog=ref.current;
    if(!dialog)return;
    dialog.showModal();
    const previous=document.activeElement as HTMLElement|null;
    return ()=>{if(dialog.open)dialog.close();previous?.focus();};
  },[]);
  const teamMap=new Map<number|null,typeof game.players>();
  for(const player of game.players){const list=teamMap.get(player.team??null)??[];list.push(player);teamMap.set(player.team??null,list);}
  const teams=[...teamMap.entries()].sort(([a],[b])=>a==null?1:b==null?-1:a-b);
  const teamGame=teams.some(([team])=>team!=null);
  const twoTeams=teamGame&&teams.length===2;
  return <dialog ref={ref} className="battle-orders-dialog" aria-labelledby="battle-orders-title" onCancel={onClose} onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
    <div className="battle-orders-parchment parchment-surface parchment-surface--briefing">
      <button className="battle-orders-close" aria-label="Close Battle Orders" onClick={onClose}><X size={24}/></button>
      <header className="battle-orders-heading">
        <span className="eyebrow">BATTLE ORDERS · GAME {game.gameNumber}</span>
        <h2 id="battle-orders-title">{game.draftRequired?'The hosts are ready':'Warm-up battle ready'}</h2>
        <p>{game.draftRequired?'Draft complete. Form the lobby in Age of Empires II: DE exactly as ordered below.':'No Age of Friends civilization draft. Choose civilizations in Age of Empires II: DE and play the Game.'}</p>
      </header>
      <div className={'battle-orders-confrontation '+(twoTeams?'two-teams':'multi-team')}>
        {twoTeams?<><BattleOrdersTeam team={teams[0][0]} players={teams[0][1]} teamGame={teamGame}/><div className="battle-orders-versus" aria-label="versus"><span>VS</span></div><BattleOrdersTeam team={teams[1][0]} players={teams[1][1]} teamGame={teamGame}/></>:teams.map(([team,players])=><BattleOrdersTeam key={String(team)} team={team} players={players} teamGame={teamGame}/>)}
      </div>
      <footer className="battle-orders-footer">
        <span className="battle-orders-rule"/>
        <strong>Battle orders confirmed</strong>
        <p>Proceed to AoE2:DE.</p>
      </footer>
    </div>
  </dialog>;
}


function ReplayConclusion({data,game,repository,onUpdated}:{data:MatchDetail;game:MatchDetail['games'][number];repository:ViewProps['repository'];onUpdated:()=>void}){
  const [file,setFile]=useState<File|null>(null);
  const [processing,setProcessing]=useState(false);
  const [statistics,setStatistics]=useState<any>(null);
  const [error,setError]=useState('');
  const ready=game.replay?.statisticsState==='READY'&&!!game.replay.statisticsId;
  const playerName=(playerId:string)=>data.match.participants.find(player=>player.playerId===playerId)?.steamName??playerId;
  const buildOrderLabel=(value:any)=>{
    const candidate=value?.classification?.label??value?.classification??value?.label??value?.buildOrder;
    return typeof candidate==='string'?candidate:'N/A';
  };
  const load=async()=>{
    setError('');
    try{setStatistics(await repository.replayStatistics(data.match.matchId,game.gameId));}
    catch(e){setError(e instanceof Error?e.message:'Battle Statistics could not be loaded.');}
  };
  const analyze=async()=>{
    if(!file)return;
    setProcessing(true);setError('');
    try{
      await repository.uploadReplay(data.match.matchId,game.gameId,file);
      setStatistics(await repository.replayStatistics(data.match.matchId,game.gameId));
      onUpdated();
    }catch(e){setError(e instanceof Error?e.message:'Replay processing failed.');}
    finally{setProcessing(false);}
  };
  const participantStats=Array.isArray(statistics?.statistics?.participants)?statistics.statistics.participants:[];
  return <section className={'replay-conclusion '+(ready||statistics?'ready':'')}>
    <div className="replay-conclusion-heading"><Upload size={24}/><div><span className="eyebrow">BATTLE CONCLUSION</span><strong>{ready||statistics?'Battle recording analyzed':'Submit the recording of this Game'}</strong><p>{ready||statistics?'Canonical evidence and Battle Statistics are retained for this Game.':'Choose one .aoe2record. Age of Friends will decode it and calculate Battle Statistics.'}</p></div></div>
    {!ready&&!statistics&&data.viewer.isParticipant&&<div className="replay-upload-form">
      <label className="replay-file-picker">Choose .aoe2record<input type="file" accept=".aoe2record,.mgz" disabled={processing} onChange={event=>setFile(event.target.files?.[0]??null)}/></label>
      {file&&<div className="replay-file-selected"><strong>{file.name}</strong><span>{(file.size/1024/1024).toFixed(2)} MB</span></div>}
      <button className="primary" disabled={!file||processing} onClick={()=>void analyze()}>{processing?'Analyzing battle…':'Analyze battle'}</button>
      {processing&&<p className="muted">Reading recording · building canonical evidence · calculating statistics…</p>}
    </div>}
    {(ready||statistics)&&!statistics&&<button className="primary" onClick={()=>void load()}>View Battle Statistics<ArrowRight size={16}/></button>}
    {statistics&&<>
      <div className="replay-qualified"><Check size={17}/><span>Recording verified · {statistics.playerMapping?.length??0} players bound to league identities</span></div>
      <div className="replay-identity-map">{(statistics.playerMapping??[]).map((mapping:any)=><div key={mapping.replaySlot}><span>{mapping.sourceName}</span><ArrowRight size={14}/><strong>{playerName(mapping.playerId)}</strong></div>)}</div>
      <div className="replay-stat-players">{participantStats.map((participant:any)=>{
        const mapping=(statistics.playerMapping??[]).find((item:any)=>item.replaySlot===participant.replaySlot);
        const name=mapping?playerName(mapping.playerId):participant.displayName??('Replay slot '+participant.replaySlot);
        return <article key={participant.replaySlot} className="replay-stat-player"><span className="eyebrow">{participant.displayName??'REPLAY PLAYER'}</span><h4>{name}</h4><div className="replay-stat-grid">
          <div><strong>{buildOrderLabel(participant.buildOrder)}</strong><span>Build order</span></div>
          <div><strong>{participant.observedCommands?.count??'—'}</strong><span>Observed commands</span></div>
          <div><strong>{participant.combat?.raidsInitiated??'—'}</strong><span>Raids initiated</span></div>
          <div><strong>{participant.mapPresence?.commandCoveragePercent!=null?participant.mapPresence.commandCoveragePercent+'%':'—'}</strong><span>Command map coverage</span></div>
        </div></article>;
      })}</div>
      <p className="muted">Official result: unresolved. Replay processing does not invent or change the winner.</p>
    </>}
    {error&&<div className="alert" role="alert">{error}</div>}
  </section>;
}

export function MatchDialog({data,snapshot,busy,repository,act,onUpdated}:ViewProps&{data:MatchDetail;onUpdated:()=>void}){
  const [dispute,setDispute]=useState<string|null>(null),[reason,setReason]=useState(''),[category,setCategory]=useState('WRONG_RESULT');
  const [resetDraft,setResetDraft]=useState<string|null>(null),[resetReason,setResetReason]=useState(''),[rerollDraft,setRerollDraft]=useState(false);
  const [battleOrdersGameId,setBattleOrdersGameId]=useState<string|null>(null);
  const completedAtMount=useRef(new Set(data.games.filter(game=>game.draft?.status==='COMPLETED').map(game=>game.gameId)));
  const announcedCompletions=useRef(new Set<string>());
  const playerName=(playerId:string)=>data.match.participants.find(player=>player.playerId===playerId)?.steamName??playerId;
  const reuseLabel=(value:string)=>({
    RESET_EACH_GAME:'Pool resets each Game',
    PLAYER_UNIQUE_IN_MATCH:'Players cannot repeat a civilization in this Match',
    TEAM_UNIQUE_IN_MATCH:'Teams cannot reuse a civilization in this Match',
    MATCH_UNIQUE:'A civilization can appear only once in this Match'
  } as Record<string,string>)[value]??value.replaceAll('_',' ');
  const liveDraftIds=data.viewer.isParticipant?data.games.filter(game=>game.draft?.status==='ACTIVE').map(game=>game.gameId):[];
  const liveDraftKey=liveDraftIds.join('|');
  const completedDraftKey=data.games.filter(game=>game.draft?.status==='COMPLETED').map(game=>game.gameId+':'+game.draft!.revision+':'+game.draft!.stateVersion).join('|');
  useEffect(()=>{
    if(!liveDraftKey)return;
    const stops=liveDraftIds.map(gameId=>repository.watchCivilizationDraft(data.match.matchId,gameId,onUpdated));
    return ()=>stops.forEach(stop=>stop());
  },[repository,data.match.matchId,liveDraftKey]);
  useEffect(()=>{
    for(const game of data.games){
      if(game.draft?.status!=='COMPLETED')continue;
      if(completedAtMount.current.has(game.gameId)||announcedCompletions.current.has(game.gameId))continue;
      announcedCompletions.current.add(game.gameId);
      setBattleOrdersGameId(game.gameId);
      break;
    }
  },[completedDraftKey]);
  const battleOrdersGame=data.games.find(game=>game.gameId===battleOrdersGameId&&(!game.draftRequired||game.draft?.status==='COMPLETED'))??null;
  return <><div className="detail-meta"><span className="eyebrow">{formatName(data.match.format)} · {data.match.matchId}</span><span className="quiet-badge">{data.match.status.replaceAll('_',' ')}</span></div>
    {data.games.map(game=>{
      const draft=game.draft??null;
      const currentTurn=draft?.currentTurnIndex!=null?draft.turns[draft.currentTurnIndex]??null:null;
      const draftPanel=game.draftRequired?<section className={'civilization-draft '+(draft?.status==='COMPLETED'?'draft-complete':'')}>
        <div className="draft-heading"><div><span className="eyebrow">{draft?.status==='COMPLETED'?'DRAFT RECORD':'CIVILIZATION MUSTER'}</span><h4>{draft?.status==='COMPLETED'?'Civilizations locked':currentTurn?playerName(currentTurn.playerId)+' chooses next':'Awaiting the draft'}</h4></div>{draft&&<span className="quiet-badge">{draft.selections.length} / {draft.turns.length} CHOSEN</span>}</div>
        {!draft?<div className="draft-unopened"><p>The Match requires a civilization draft before this Game can begin.</p>{data.viewer.isParticipant&&<button className="primary" disabled={busy} onClick={async()=>{if(await act(()=>repository.ensureCivilizationDraft(data.match.matchId,game.gameId),'The civilization muster has opened.'))onUpdated();}}>Open civilization draft</button>}</div>:<>
          <div className="draft-rule-line"><span>{draft.uniqueWithinGame?'No duplicate civilizations in this Game':'Duplicates permitted in this Game'}</span><span>{reuseLabel(draft.reusePolicy)}</span></div>
          <DraftTeamBoard data={data} draft={draft} currentPlayerId={currentTurn?.playerId??null}/>
          {draft.status==='ACTIVE'&&<div className="draft-pool" aria-label="Civilization pool">{draft.pool.map(civilization=>{
            const selections=draft.selections.filter(selection=>selection.civilization===civilization);
            const selected=selections.length>0;
            const availableToViewer=draft.viewerAvailable.includes(civilization);
            const canPick=draft.viewerCanPick&&availableToViewer&&!busy;
            return <CivilizationDraftCard key={civilization} civilization={civilization} selected={selected} selectedBy={selections.map(selection=>playerName(selection.playerId)).join(', ')} canPick={canPick} viewerCanPick={draft.viewerCanPick} busy={busy} onPick={async()=>{if(await act(()=>repository.pickCivilization(data.match.matchId,game.gameId,civilization),civilizationName(civilization)+' marches beneath your banner.'))onUpdated();}}/>;
          })}</div>}
          {draft.status==='ACTIVE'&&<p className={draft.viewerCanPick?'draft-call':'muted'}>{draft.viewerCanPick?'Your turn. Choose one civilization; the choice is final unless an administrator resets the draft.':currentTurn?'Waiting for '+playerName(currentTurn.playerId)+'.':'Waiting for the next turn.'}</p>}
          {draft.status==='COMPLETED'&&<p className="draft-call">The draft record is locked. Battle Orders contain the authoritative teams and civilizations for this Game.</p>}
          {snapshot.viewer?.role==='ADMIN'&&game.status!=='COMPLETED'&&draft.status!=='COMPLETED'&&<div className="draft-admin">
            <button className="text-button small" onClick={()=>{setResetDraft(resetDraft===game.gameId?null:game.gameId);setResetReason('');setRerollDraft(false);}}>{resetDraft===game.gameId?'Cancel reset':'Reset draft'}</button>
            {resetDraft===game.gameId&&<form className="form draft-reset-form" onSubmit={async e=>{e.preventDefault();if(await act(()=>repository.resetCivilizationDraft(data.match.matchId,game.gameId,resetReason.trim(),rerollDraft),'The civilization muster has been reset.')){setResetDraft(null);setResetReason('');setRerollDraft(false);onUpdated();}}}>
              <label>Reason<textarea required maxLength={1000} value={resetReason} onChange={e=>setResetReason(e.target.value)} placeholder="Why is this draft being reset?"/></label>
              <label className="draft-reset-check"><input type="checkbox" checked={rerollDraft} onChange={e=>setRerollDraft(e.target.checked)}/>Reroll the draft order</label>
              <button className="primary" disabled={busy||!resetReason.trim()}>Confirm reset</button>
            </form>}
          </div>}
        </>}
      </section>:null;
      return <article className="game-panel" key={game.gameId}><div className="section-heading"><h3>Game {game.gameNumber}</h3>{data.viewer.isParticipant&&game.result&&!game.resultDisputeOpen&&game.status==='COMPLETED'&&<button className="text-button small" onClick={()=>setDispute(dispute===game.gameId?null:game.gameId)}>Dispute result</button>}</div>
        {!game.draftRequired&&<div className="battle-orders-issued"><div><span className="eyebrow">WARM-UP BATTLE ORDERS</span><strong>The battlefield is ready.</strong><p>No civilization draft. Choose civilizations in AoE2:DE, play the Game, then return with the recording.</p></div><div className="battle-orders-issued-actions"><button className="primary" onClick={()=>setBattleOrdersGameId(game.gameId)}>Open Battle Orders<ArrowRight size={16}/></button></div></div>}
        {draft?.status==='COMPLETED'&&<>
          <div className="battle-orders-issued">
            <div><span className="eyebrow">BATTLE ORDERS ISSUED</span><strong>The hosts are ready.</strong><p>Teams and civilizations are locked for this Game.</p></div>
            <div className="battle-orders-issued-actions">
              <button className="primary" onClick={()=>setBattleOrdersGameId(game.gameId)}>Open Battle Orders<ArrowRight size={16}/></button>
              {snapshot.viewer?.role==='ADMIN'&&game.status!=='COMPLETED'&&<button className="text-button small admin-recovery-button" onClick={()=>{setResetDraft(resetDraft===game.gameId?null:game.gameId);setResetReason('');setRerollDraft(false);}}>{resetDraft===game.gameId?'Cancel recovery':'Reset / reroll draft'}</button>}
            </div>
          </div>
          {snapshot.viewer?.role==='ADMIN'&&game.status!=='COMPLETED'&&resetDraft===game.gameId&&<form className="form battle-orders-admin-recovery" onSubmit={async e=>{e.preventDefault();if(await act(()=>repository.resetCivilizationDraft(data.match.matchId,game.gameId,resetReason.trim(),rerollDraft),'The civilization muster has been reset.')){setResetDraft(null);setResetReason('');setRerollDraft(false);setBattleOrdersGameId(null);onUpdated();}}}>
            <div className="battle-orders-admin-heading"><span className="eyebrow">ADMIN ONLY · DRAFT RECOVERY</span><strong>Reset the completed draft</strong><p>All civilization picks will be cleared. Keep the existing pick order, or explicitly reroll it.</p></div>
            <label>Reason<textarea required maxLength={1000} value={resetReason} onChange={e=>setResetReason(e.target.value)} placeholder="Why is this draft being reset?"/></label>
            <label className="draft-reset-check"><input type="checkbox" checked={rerollDraft} onChange={e=>setRerollDraft(e.target.checked)}/>Reroll the draft order</label>
            <button className="primary" disabled={busy||!resetReason.trim()}>{rerollDraft?'Reset and reroll draft':'Reset draft with same order'}</button>
          </form>}
        </>}
        {draft?.status==='COMPLETED'?<details className="draft-record-details"><summary><span><strong>View draft record</strong><small>Pick order, draft rules and administrator recovery</small></span><span className="quiet-badge">{draft.selections.length} / {draft.turns.length} CHOSEN</span></summary>{draftPanel}</details>:draftPanel}
        {draft?.status!=='COMPLETED'&&<div className="game-players">{game.players.map(player=><div key={player.playerId}><Avatar player={player}/><span><strong>{player.steamName}</strong><small>{player.civilization?civilizationName(player.civilization):'Civilization not yet selected'}{player.team!=null?' · Team '+player.team:''}</small></span>{!game.resultDisputeOpen&&game.result?.winningPlayerIds.includes(player.playerId)&&<span className="gold">Winner</span>}</div>)}</div>}<p className={game.resultDisputeOpen?'disputed':'muted'}>{game.resultDisputeOpen?'Result under correction review.':game.result?'Final result · Revision '+game.result.revision:draft?.status==='COMPLETED'?'Battle awaiting a qualified result.':'Awaiting a qualified result.'}</p>
        {dispute===game.gameId&&<form className="form dispute-form" onSubmit={async e=>{e.preventDefault();if(await act(()=>repository.dispute(data.match.matchId,game.gameId,category,reason.trim()),'Dispute submitted for review.')){setDispute(null);onUpdated();}}}><label>What needs correcting?<select value={category} onChange={e=>setCategory(e.target.value)}><option value="WRONG_RESULT">Wrong result</option><option value="WRONG_REPLAY">Wrong replay</option><option value="PLAYER_MISMATCH">Player mismatch</option><option value="OTHER">Other</option></select></label><label>Reason<textarea required maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label><button className="primary" disabled={busy||!reason.trim()}>Submit dispute</button></form>}
        <ReplayConclusion data={data} game={game} repository={repository} onUpdated={onUpdated}/>
      </article>;
    })}
    {!data.games.length&&<Empty title="The Game plan is not ready">Your Games will appear after the match plan is approved.</Empty>}
    {battleOrdersGame&&<BattleOrdersDialog data={data} game={battleOrdersGame} onClose={()=>setBattleOrdersGameId(null)}/>}
  </>;
}
export function ProfileDialog({data,snapshot,preview}:ViewProps&{data:PlayerProfile}){
  const [scope,setScope]=useState('season'),own=data.player.playerId===snapshot.viewer?.playerId;
  const stats=scope==='season'?data.activeSeason?.competition:data.lifetime.competition;
  const values:[string,string|number|null|undefined][]=[['Played',stats?.matchesPlayed],['Won',stats?.matchesWon],['Lost',stats?.matchesLost],['Win rate',stats&&stats.matchesPlayed>0?Math.round(stats.matchesWon/stats.matchesPlayed*100)+'%':null]];
  return <><div className="profile-overview"><div className="profile-portrait"><Avatar player={data.player} large/><span className="eyebrow">NEWCOMER</span></div><div><span className="eyebrow">PERSISTENT LEAGUE IDENTITY</span><h3>{data.player.steamName}</h3><p>Your banner outlives a single season.</p><span className="quiet-badge">Military identity awaiting qualified evidence</span></div></div>
    <div className="section-heading"><h3>Battle record{preview?' · Sample':''}</h3><select aria-label="Player record scope" value={scope} onChange={e=>setScope(e.target.value)}><option value="season">This season</option><option value="lifetime">Lifetime</option></select></div><div className="profile-record">{values.map(([label,value])=><div key={label}><strong>{value??'—'}</strong><span>{label}</span></div>)}</div>
    <h3>Selected achievements</h3>{data.achievements.length?<div className="achievements">{data.achievements.slice(0,3).map(a=><div key={a.awardId}><Shield size={22}/><strong>{a.name}</strong><p>{a.description}</p></div>)}</div>:<p className="muted">No achievements are showcased. Achievement rules are awaiting validated statistics.</p>}{own&&<p className="footnote">Your full collection and personal progression belong only to you.</p>}<hr/><h3>Shared history</h3><div className="history-columns"><section><span className="eyebrow">ACROSS THE BATTLEFIELD</span>{data.opponents.length?data.opponents.map(r=><p key={r.player.playerId}>{r.player.steamName}<span>{r.matchesTogether} encounters</span></p>):<p className="muted">No recorded opponents yet.</p>}</section><section><span className="eyebrow">UNDER ONE BANNER</span>{data.teammates.length?data.teammates.map(r=><p key={r.player.playerId}>{r.player.steamName}<span>{r.matchesTogether} together</span></p>):<p className="muted">No recorded teammates yet.</p>}</section></div><p className="footnote">Rivalry, Enemy and Friend progression will be drawn from validated battle evidence.</p>
  </>;
}
