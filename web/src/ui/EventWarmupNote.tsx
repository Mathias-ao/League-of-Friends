import {useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ArrowRight,Check,Swords,X} from 'lucide-react';
import type {CountedWarmupNote,EventRecord,MatchRecord} from '../domain/league';
import {formatLeaguePoints} from '../domain/seasonPoints';

/** Personal receipt of the existing automatic best-warmup decision; no scoring writes. */
export function EventWarmupNote({note,event,matches,openMatch,className='event-warmup-marker'}:{note:CountedWarmupNote;event:EventRecord;matches:MatchRecord[];openMatch:(id:string)=>void;className?:string}){
 const [open,setOpen]=useState(false);
 const match=matches.find(row=>row.matchId===note.matchId);
 const opponent=match?.participants.filter(player=>player.playerId!==note.playerId).map(player=>player.steamName).join(' · ')||'your opponent';
 return <>
  <button type="button" className={`chronicle-bookmark bookmark-cloth-3 ${className}`} onClick={()=>setOpen(true)} aria-label={`Your counted warm-up: ${event.title} · open automatic selection note`} aria-haspopup="dialog" title="See which warm-up counts toward your Event points">
   <span className="bookmark-monogram" aria-hidden="true"><Swords size={17}/></span><span className="bookmark-player-name">Counted<br/>duel</span><strong>+{formatLeaguePoints(note.points)}</strong>
  </button>
  {open&&<WarmupParchment note={note} title={event.title} opponent={opponent} onClose={()=>setOpen(false)} openBattle={()=>{setOpen(false);openMatch(note.matchId);}}/>}
 </>;
}
function WarmupParchment({note,title,opponent,onClose,openBattle}:{note:CountedWarmupNote;title:string;opponent:string;onClose:()=>void;openBattle:()=>void}){
 const ref=useRef<HTMLDialogElement>(null),titleId=useId();
 useEffect(()=>{const dialog=ref.current!,previous=document.activeElement as HTMLElement|null;
  if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
  return ()=>{if(typeof dialog.close==='function'&&dialog.open)dialog.close();else dialog.removeAttribute('open');previous?.focus();};
 },[]);
 return createPortal(<dialog ref={ref} className="relationship-chronicle-dialog event-warmup-note-dialog" aria-labelledby={titleId} onCancel={event=>{event.preventDefault();event.stopPropagation();onClose();}} onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
  <button type="button" className="chronicle-close" aria-label="Close counted warm-up note" onClick={onClose}><X size={22}/></button>
  <div className="chronicle-scroll-stage"><article className="chronicle-parchment event-warmup-parchment">
   <header><span className="event-campaign-rubric">THE COUNTED DUEL</span><h2 id={titleId}>Your warm-up is entered</h2><p>{title}</p></header>
   <div className="event-warmup-receipt"><Check size={22} aria-hidden="true"/><strong>+{formatLeaguePoints(note.points)} Event points</strong><span>{note.win?'Victory':'Participation'} · against {opponent}</span></div>
   <p>AoF automatically selected this Battle as your best validated warm-up result. Only one warm-up counts toward your points for this Event and the Season leaderboard.</p>
   <p>Your other {note.otherWarmupCount===1?'warm-up remains':'warm-ups remain'} in the Battle record and can contribute to Event statistics and accomplishments. Equal results use a consistent tie-break. The counted Battle may change when further results or corrections are validated.</p>
   <button type="button" className="event-warmup-open-battle" onClick={openBattle}>Open the counted Battle<ArrowRight size={16}/></button>
  </article></div>
 </dialog>,document.body);
}
