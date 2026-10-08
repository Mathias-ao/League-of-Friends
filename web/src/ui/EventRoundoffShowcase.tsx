import {ArrowRight} from 'lucide-react';
import type {EventShowcaseItem} from '../domain/eventRoundoffShowcase';
import type {MatchRecord,PlayerRecord} from '../domain/league';

export function EventRoundoffShowcase({items,matches,players,openMatch}:{items?:EventShowcaseItem[];matches:MatchRecord[];players:PlayerRecord[];openMatch:(id:string)=>void}){
  const names=new Map([...players,...matches.flatMap(m=>m.participants)].map(p=>[p.playerId,p.steamName]));
  return <section className="event-showcase" aria-label="Notable performances">
    <div className="event-section-heading"><div><span className="eyebrow">DISTINCTIONS OF THE EVENT</span><h3>Notable performances</h3></div></div>
    {items?.length?<div className="event-showcase-grid">{items.slice(0,5).map(item=><article key={item.id}>
      <span className="eyebrow">{item.category}</span><h4>{item.title}</h4><strong className="event-showcase-value">{item.value}</strong>
      <p className="event-showcase-players">{item.playerIds.map(id=>names.get(id)??id).join(' · ')}</p><p>{item.detail}</p>
      <div className="event-showcase-sources">{[...new Set(item.sources.map(s=>s.matchId))].map(id=>{const match=matches.find(m=>m.matchId===id);return <button key={id} className="text-button" onClick={()=>openMatch(id)}>{item.sources.length===1?'View Battle':match?.scoringAct==='MAIN'?'Main Battle':`Warm-up · ${match?.participants.map(p=>p.steamName).join(' & ')??'View Battle'}`}<ArrowRight size={15}/></button>;})}</div>
    </article>)}</div>:<p className="event-roundoff-note">{items?'No notable performances have qualified from this Event’s available recordings.':'Notable performances have not yet been included in this Event record.'}</p>}
  </section>;
}
