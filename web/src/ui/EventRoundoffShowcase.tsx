import {ArrowRight} from 'lucide-react';
import {useId,type CSSProperties} from 'react';
import type {EventShowcaseItem} from '../domain/eventRoundoffShowcase';
import type {MatchRecord,PlayerRecord} from '../domain/league';
import {AccomplishmentEmblem} from './AccomplishmentEmblem';

const tiers={SPECIAL:'Special distinction',EXTRAORDINARY:'Extraordinary',EXCEPTIONAL:'Exceptional',NOTABLE:'Notable'};
export function EventRoundoffShowcase({items,matches,players,openMatch}:{items?:EventShowcaseItem[];matches:MatchRecord[];players:PlayerRecord[];openMatch:(id:string)=>void}){
  const names=new Map([...players,...matches.flatMap(m=>m.participants)].map(p=>[p.playerId,p.steamName]));
  const prefix=useId(),selected=[...(items??[])].sort((a,b)=>a.rank-b.rank||a.id.localeCompare(b.id)).slice(0,5);
  return <section className="event-showcase" aria-label="Event accomplishments">
    <div className="event-section-heading"><div><span className="eyebrow">DISTINCTIONS OF THE EVENT</span><h3>Accomplishments</h3></div></div>
    {selected.length?<ol className="event-showcase-grid" style={{'--showcase-count':selected.length} as CSSProperties}>{selected.map((item,i)=>{
      const playerNames=item.playerIds.map(id=>names.get(id)??id).join(' · '),heading=`${prefix}-${i}`;
      const sources=[...new Map(item.sources.map(s=>[s.matchId,s])).values()];
      return <li key={item.id}><article aria-labelledby={heading} data-tier={item.tier}>
        <div className="event-accomplishment-summary"><AccomplishmentEmblem kind={item.emblem}/><div>
          <h4 id={heading}>{item.title}</h4><strong className="event-showcase-value">{item.value}</strong>
          <p className="event-showcase-players" title={playerNames}>{playerNames}</p><span className="event-showcase-tier">{tiers[item.tier]}</span>
        </div></div>
        <details className="event-accomplishment-evidence"><summary>View evidence<span className="sr-only"> for {item.title}</span></summary><div>
          <p>{item.detail}</p><div className="event-showcase-sources">{sources.map(s=>{const match=matches.find(m=>m.matchId===s.matchId);return <button key={s.matchId} className="text-button" onClick={()=>openMatch(s.matchId)}>{s.role==='HISTORY'?'Previous record':s.act==='MAIN'||match?.scoringAct==='MAIN'?'Main Battle':s.act==='WARMUP'||match?.scoringAct==='WARMUP'?`Warm-up · ${match?.participants.map(p=>p.steamName).join(' & ')??'View Battle'}`:'View Battle'}<ArrowRight size={13}/></button>;})}</div>
        </div></details>
      </article></li>;
    })}</ol>:<p className="event-roundoff-note">{items?'No accomplishments have qualified from this Event’s available recordings.':'Accomplishments have not yet been included in this Event record.'}</p>}
  </section>;
}
