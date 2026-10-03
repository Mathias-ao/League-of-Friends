import {useState} from 'react';
import {formatTime} from '../domain/statistics';
import {reviewRelationshipEvidence,RELATIONSHIP_REVIEW_VERSION,type Track} from '../domain/relationshipQualificationReview';

export function RelationshipQualificationReview({incidents,annotations,declaredHistory,name,sampled,available,sourceRevision}:{
 incidents:any[];annotations:any[];declaredHistory:any;name:(id:any)=>string;sampled:boolean;available:boolean;sourceRevision?:string;
}){
 const [selectedPair,setSelectedPair]=useState('ALL'),[selectedTrack,setSelectedTrack]=useState('ALL');
 const rows=reviewRelationshipEvidence({incidents,annotations,declaredHistory});
 const pairs=[...new Map(rows.map(row=>[row.pair.join(':'),row.pair])).entries()].sort(([a],[b])=>a.localeCompare(b));
 const currentPair=selectedPair==='ALL'||pairs.some(([key])=>key===selectedPair)?selectedPair:'ALL';
 const visible=rows.filter(row=>(currentPair==='ALL'||row.pair.join(':')===currentPair)&&(selectedTrack==='ALL'||row.track===selectedTrack));
 const direction=(ids:number[]|null)=>ids?ids.map(name).join(' → '):'Pair context; no directed contribution assigned';
 const tracks:Track[]=['Rivalry','Hostility','Bond'];
 return <section aria-label="Relationship qualification review">
  <h3>Relationship qualification review</h3>
  <p>Inspect what each episode can support before it shapes a lasting relationship. <strong>No points or levels are awarded.</strong> Evidence qualification and league interpretation are separate decisions.</p>
  <p>{sampled?'This review uses abbreviated real-recording samples. It cannot establish total contributions, recurrence or missing cooperation.':'This review reads the current retained Game evidence. It is not a complete league Battle history.'}</p>
  <div className="sx-table-scroll"><table className="sx-table"><caption>What the three tracks still require</caption><thead><tr><th>Track</th><th>Evidence to inspect</th><th>Remaining qualification</th></tr></thead><tbody>
   <tr><th>Rivalry</th><td>Direct contest and independent return pressure</td><td>Ordered league history and configured progression; overlap cannot prove returned attacks</td></tr>
   <tr><th>Hostility</th><td>Directed pressure; qualified decisive losses or alliance rupture</td><td>Victim-impact and recurrence rules; king loss and Treachery need independent outcomes</td></tr>
   <tr><th>Bond</th><td>Helper → recipient support and exact allies sharing a target</td><td>Configured assistance rules; received copies cannot prove reciprocal help</td></tr>
  </tbody></table></div>
  <p>Gallantry, Cruelty and Chivalry are separate Reputation tracks. Score, APM and targeting alone do not qualify cruelty, distress or betrayal. Missing help never establishes intentional abandonment.</p>
  <div className="br-facts">
   <label>Review pair <select value={currentPair} onChange={e=>setSelectedPair(e.target.value)}><option value="ALL">All recorded pairs</option>{pairs.map(([key,p])=><option key={key} value={key}>{p.map(name).join(' & ')}</option>)}</select></label>
   <label>Relationship track <select value={selectedTrack} onChange={e=>setSelectedTrack(e.target.value)}><option value="ALL">All three tracks</option>{tracks.map(t=><option key={t}>{t}</option>)}</select></label>
  </div>
  {!available&&<p>Versioned social evidence is unavailable. No relationship qualification can be inferred from ordinary totals.</p>}
  {visible.length?<ol className="br-episodes">{visible.map(row=><li key={row.id}>
   <strong>{row.track} · {row.pair.map(name).join(' & ')}</strong> · {row.atMs===null?'Time unavailable':formatTime(row.atMs)}
   <details><summary>{row.title} · {row.interpretationStatus==='UNAVAILABLE'?'Interpretation blocked':'Rules not configured'}</summary>
    <dl className="br-facts"><div><dt>Action direction</dt><dd>{direction(row.actionDirection)}</dd></div><div><dt>Possible contribution direction</dt><dd>{direction(row.contributionDirection)}<small>Preview only; no contribution emitted</small></dd></div>
     <div><dt>Evidence prerequisite</dt><dd>{row.evidenceStatus==='QUALIFIED'?'Supported positive command evidence':'Required evidence unavailable'}</dd></div>
     <div><dt>Relationship decision</dt><dd>{row.interpretationStatus==='UNAVAILABLE'?'Blocked by missing prerequisites':'Policy unconfigured; candidate evidence only'}</dd></div></dl>
    <h4>What the record supports</h4><ul>{row.established.map((text,i)=><li key={i}>{text}</li>)}</ul>
    <h4>What prevents a relationship award</h4><ul>{row.missing.map((text,i)=><li key={i}>{text}</li>)}</ul>
    <details><summary>Trace this decision to the record</summary><p className="br-source">{row.recordIds.join(', ')}</p><p className="br-source">{row.sourceIds.join(', ')}</p><p>{sampled?'Source references are abbreviated; the linked audit retains the full evidence.':'Source references come from this retained evidence revision.'}</p></details>
   </details>
  </li>)}</ol>:<p>No reviewable rows for this selection. Empty output does not mean zero Rivalry, Hostility or Bond, and it does not qualify absence of interaction.</p>}
  <p>These are review rows, not additional deeds. Different facets may describe the same deed; their counts must not be added.</p>
  <details><summary>Review version and limitations</summary><p className="br-source">{RELATIONSHIP_REVIEW_VERSION} · source revision {sourceRevision??'Unavailable'}</p><p>This presentation applies the documented evidence checklist. It does not run the future relationship scorer, create a pair chapter, confirm attacks or persist decisions. Lasting progression still needs approved league identities, ordered Games/Battles, distinct deeds, corrections and explicit rule configuration.</p></details>
 </section>;
}
