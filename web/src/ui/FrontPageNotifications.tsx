import {useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ArrowRight,Check,Flag,Shield,Swords,X} from 'lucide-react';
import {frontPageNotices,type FrontPageNotice} from '../domain/frontPageNotices';
import {canBrowseLeague,isWarmupMatch,type EventDetail,type LeagueSnapshot} from '../domain/league';
import {useScheduleClock} from '../hooks/useScheduleClock';
import {EventWarmupNote} from './EventWarmupNote';
import type {ViewProps} from './App';

export function FrontPageNotifications(props:Pick<ViewProps,'snapshot'|'repository'|'busy'|'openEvent'|'openMatch'|'enter'|'act'>){
 const {snapshot,repository,busy,openEvent,openMatch,enter,act}=props;
 const now=useScheduleClock([...snapshot.events.flatMap(e=>[e.signupDeadlineAt,e.checkInOpensAt,e.checkInClosesAt,e.warmupOpensAt]),...snapshot.matches.flatMap(m=>[m.playOpensAt,m.playClosesAt])]);
 const notices=frontPageNotices(snapshot,now);
 const [selected,setSelected]=useState<string|null>(null);
 const [receipts,setReceipts]=useState<{snapshot:LeagueSnapshot;events:EventDetail[]}|null>(null);
 useEffect(()=>{
  let current=true;
  if(!canBrowseLeague(snapshot)||!snapshot.viewer)return;
  const playerId=snapshot.viewer.playerId;
  // Only fetch Events where this player actually has multiple eligible warm-ups.
  const candidates=snapshot.events.filter(event=>!['CANCELLED','POSTPONED'].includes(event.status)&&(!event.seasonId||event.seasonId===snapshot.season?.seasonId)&&snapshot.matches.filter(match=>match.eventId===event.eventId&&match.warmupScoringPolicy==='AOF_BEST_WARMUP_V1'&&isWarmupMatch(match)&&!['CANCELLED','VOID','PROPOSED'].includes(match.status)&&match.participants.some(p=>p.playerId===playerId)).length>1);
  void Promise.allSettled(candidates.map(event=>repository.event(event.eventId))).then(results=>{
   if(!current)return;
   const events=results.flatMap(result=>result.status==='fulfilled'&&result.value.viewer.playerId===playerId&&result.value.roundoff?.viewerWarmupSelection?.playerId===playerId?[result.value]:[]);
   setReceipts({snapshot,events});
  });
  return ()=>{current=false;};
 },[repository,snapshot]);
 const personalReceipts=receipts?.snapshot===snapshot?receipts.events:[];
 if(snapshot.membership!=='ACTIVE'||!snapshot.viewer)return null;
 const chosen=notices.find(note=>note.id===selected);
 const run=(note:FrontPageNotice)=>{
  setSelected(null);
  if(note.kind==='season')enter();
  else if(note.kind==='checkin')void act(()=>repository.checkIn(note.eventId!),'You are checked in. The muster will use your banner.');
  else if(note.matchId)openMatch(note.matchId);
  else if(note.eventId)openEvent(note.eventId);
 };
 return <div className="frontpage-notifications" aria-label="Your campaign notices">
  {notices.slice(0,2).map(note=><NoticeFlag key={note.id} note={note} onClick={()=>setSelected(note.id)}/>)}
  {personalReceipts.slice(0,1).map(data=><EventWarmupNote key={data.event.eventId} note={data.roundoff!.viewerWarmupSelection!} event={data.event} matches={data.matches} openMatch={openMatch} className="frontpage-counted-flag"/>)}
  {(notices.length>2||personalReceipts.length>1)&&<button type="button" className="chronicle-bookmark bookmark-cloth-7 frontpage-notice-flag" aria-label="Open all campaign notices" aria-haspopup="dialog" onClick={()=>setSelected('all')}><span className="bookmark-monogram" aria-hidden="true">+{Math.max(0,notices.length-2)+Math.max(0,personalReceipts.length-1)}</span><span className="bookmark-player-name">More<br/>dispatches</span></button>}
  {(chosen||selected==='all')&&<NoticeParchment title={chosen?.title??'Your campaign dispatches'} onClose={()=>setSelected(null)}>
   {chosen?<><p className="frontpage-note-context">{chosen.context}</p><p>{chosen.body}</p><Deadline note={chosen}/><button className="event-warmup-open-battle" disabled={busy} onClick={()=>run(chosen)}>{chosen.action}<ArrowRight size={16}/></button></>:<div className="frontpage-dispatch-list">{notices.map(note=><section key={note.id}><h3>{note.title}</h3><p className="frontpage-note-context">{note.context}</p><p>{note.body}</p><Deadline note={note}/><button className="event-warmup-open-battle" disabled={busy} onClick={()=>run(note)}>{note.action}<ArrowRight size={16}/></button></section>)}{personalReceipts.map(data=><section key={data.event.eventId}><h3>Your counted duel</h3><p>{data.event.title} · +{data.roundoff!.viewerWarmupSelection!.points} Event points</p><p>Your best validated warm-up earns points. Both warm-ups contribute to statistical accomplishments.</p><button className="event-warmup-open-battle" disabled={busy} onClick={()=>{setSelected(null);openEvent(data.event.eventId);}}>Open the selection note in the Event<ArrowRight size={16}/></button></section>)}</div>}
  </NoticeParchment>}
 </div>;
}
function NoticeFlag({note,onClick}:{note:FrontPageNotice;onClick:()=>void}){
 const Icon=note.kind==='checkin'?Check:note.kind==='warmup'||note.kind==='battle'?Swords:note.kind==='season'?Shield:Flag;
 const cloth=note.kind==='checkin'||note.kind==='battle'?0:note.kind==='warmup'?4:3;
 return <button type="button" className={`chronicle-bookmark bookmark-cloth-${cloth} frontpage-notice-flag`} aria-label={`${note.label}: ${note.context}`} title={`${note.label} · ${note.context}`} aria-haspopup="dialog" onClick={onClick}><span className="bookmark-monogram" aria-hidden="true"><Icon size={17}/></span><span className="bookmark-player-name">{note.label}</span></button>;
}
function Deadline({note}:{note:FrontPageNotice}){
 return note.deadline&&Number.isFinite(Date.parse(note.deadline))?<p className="frontpage-note-deadline">Deadline: <time dateTime={note.deadline}>{new Date(note.deadline).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})}</time> · your local time</p>:null;
}
function NoticeParchment({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}){
 const ref=useRef<HTMLDialogElement>(null),titleId=useId();
 useEffect(()=>{const dialog=ref.current!,previous=document.activeElement as HTMLElement|null;
  if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
  return ()=>{if(typeof dialog.close==='function'&&dialog.open)dialog.close();else dialog.removeAttribute('open');previous?.focus();};
 },[]);
 return createPortal(<dialog ref={ref} className="relationship-chronicle-dialog event-warmup-note-dialog frontpage-note-dialog" aria-labelledby={titleId} onCancel={event=>{event.preventDefault();event.stopPropagation();onClose();}} onClick={event=>{if(event.currentTarget===event.target)onClose();}}>
  <button type="button" className="chronicle-close" aria-label="Close campaign note" onClick={onClose}><X size={22}/></button><div className="chronicle-scroll-stage"><article className="chronicle-parchment event-warmup-parchment"><header><span className="event-campaign-rubric">A DISPATCH FOR YOUR BANNER</span><h2 id={titleId}>{title}</h2></header>{children}</article></div>
 </dialog>,document.body);
}
