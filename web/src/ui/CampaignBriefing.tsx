import {useEffect,useId,useRef} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';
import {lombardia} from '../data/content';
import {isLombardia,type EventRecord} from '../domain/league';

export function CampaignBriefing({event,onClose}:{event:EventRecord;onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null),titleId=useId();
 useEffect(()=>{
  const dialog=ref.current!,previous=document.activeElement as HTMLElement|null;
  if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
  return ()=>{if(typeof dialog.close==='function'&&dialog.open)dialog.close();else dialog.removeAttribute('open');previous?.focus();};
 },[]);
 return createPortal(<dialog ref={ref} className="relationship-chronicle-dialog event-campaign-dialog" aria-labelledby={titleId} onCancel={e=>{e.preventDefault();e.stopPropagation();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
  <button className="chronicle-close" aria-label="Close campaign briefing" onClick={onClose}><X size={22}/></button>
  <div className="chronicle-scroll-stage"><article className="chronicle-parchment event-campaign-parchment">
   <header><span className="event-campaign-rubric">THE CAMPAIGN BRIEFING</span><h2 id={titleId}>{event.title}</h2><p>{isLombardia(event)?lombardia.story.oneLine:'The field and its purpose'}</p></header>
   <div className="event-campaign-prose">{(isLombardia(event)?lombardia.story.brief:[event.description||'The organizer has not yet issued a campaign briefing.']).map((p,i)=><p key={i}>{p}</p>)}</div>
   <footer>Raise your banner. Write the next page on the battlefield.</footer>
  </article></div>
 </dialog>,document.body);
}
