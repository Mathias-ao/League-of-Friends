import {useState} from 'react';
import {projectSocialIncidents} from '../../../functions/src/engines/socialIncidentCore.js';
import {formatTime} from '../domain/statistics';
type Row=Record<string,any>;
const rows=(v:any):Row[]=>Array.isArray(v)?v:[];
const labels:Record<string,string>={INITIATING_DECLARATION_BREACH:'Initiating declaration breach',RESPONSE_AFTER_WITHDRAWAL:'Response to prior withdrawal',CONTESTED_WITHDRAWAL:'Contested initiation',WITHDRAWAL_WITH_UNRESOLVED_CONTEXT:'Context unavailable'};
const readable=(value:string)=>value.toLowerCase().replaceAll('_',' ');
export function SocialIncidentReview({review,statistics,mapping=[],officialOutcome,name}:{review?:any;statistics?:any;mapping?:any[];officialOutcome?:any;name:(id:any)=>string}){
  const [selected,setSelected]=useState('ALL');
  const data=review??projectSocialIncidents({statistics,playerMapping:mapping,officialOutcome});
  if(data.status!=='REVIEW_AVAILABLE')return <section className="br-social"><h3>Social incidents</h3><p>Social incident evidence is unavailable: {readable(data.reason??'recording facts missing')}.</p></section>;
  const incidents=rows(data.incidents).filter(i=>selected==='ALL'||i.pairPlayerIds.includes(Number(selected)));
  const decisions=rows(data.decisions).filter(d=>selected==='ALL'||d.pairPlayerIds.includes(Number(selected))||!d.pairPlayerIds.length);
  const counts=decisions.reduce<Row>((out,d)=>({...out,[d.status]:(out[d.status]??0)+1}),{});
  return <section className="br-social" aria-label="Social incident review"><h3>Social incidents</h3>
    <p className="sx-notice">Shadow evaluation of recorded conduct. Official reputation, relationships and rewards are unchanged. Targeted context orders are not verified attacks.</p>
    <label>Recording player <select value={selected} onChange={e=>setSelected(e.target.value)}><option value="ALL">All players</option>{rows(data.participants).map(p=><option key={p.playerId} value={p.playerId}>{name(p.playerId)}</option>)}</select></label>
    <p>{incidents.length} declaration withdrawals · {counts.MATCHED??0} matched decisions · {counts.UNAVAILABLE??0} unavailable decisions. Missing evidence does not mean peaceful conduct.</p>
    {incidents.length?<div className="br-table-wrap"><table><caption>Declared alliance withdrawals and associated command evidence</caption><thead><tr><th>Game time</th><th>Direction</th><th>Context</th><th>Associated evidence</th></tr></thead><tbody>{incidents.map(i=><tr key={i.incidentId}><td>{formatTime(i.moment.atMs)}</td><td>{name(i.actorPlayerId)} → {name(i.targetPlayerId)}</td><td>{labels[i.role]??readable(i.role)}</td><td>{rows(i.qualifiedOffenses).length} qualified offensive attempts; {rows(i.targetedOrderCandidates).length} unverified targeted orders<details><summary>Sources and decision</summary><p>Counterpart declaration: {i.counterpartDeclaration}. Effective state unqualified.</p><p>References: {rows(i.sourceEventIds).join(', ')}</p>{decisions.filter(d=>d.sourceEventIds.includes(i.anchorEventId)).map(d=><p key={d.decisionId}>{readable(d.family)}: {readable(d.status)}{d.reasons.length?` — ${d.reasons.map(readable).join('; ')}`:''}</p>)}</details></td></tr>)}</tbody></table></div>:<p>No declaration withdrawals observed. This does not establish absence of combat.</p>}
    <details><summary>Family eligibility and shadow contributions</summary><p>{rows(data.shadowContributions).length} bounded shadow contributions. Unmapped recording players earn no persistent contributions.</p><ul>{[...new Set(decisions.map(d=>`${d.family}: ${d.status}${d.reasons.length?' — '+d.reasons.join('; '):''}`))].map(line=><li key={line}>{readable(line)}</li>)}</ul></details>
    <details><summary>Pair exposure</summary><p>Co-presence is not local contact or an opportunity to help.</p><ul>{rows(data.exposure).filter(p=>selected==='ALL'||p.pairPlayerIds.includes(Number(selected))).map(p=><li key={p.pairPlayerIds.join(':')}>{p.pairPlayerIds.map(name).join(' ↔ ')}: {readable(p.context)}</li>)}</ul></details>
  </section>;
}
