import {useEffect,useState} from 'react';
import type {LeagueRepository,ReplayPlayerMapping,PlayerRecord} from '../domain/league';
import {formatTime} from '../domain/statistics';
import {recordingReviewExamples} from '../data/recordingReviewExamples';

type Row=Record<string,any>;
const object=(v:any):Row=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const list=(v:any):Row[]=>Array.isArray(v)?v.filter(x=>x&&typeof x==='object'):[];
const labels:Record<string,string>={DIRECTED_PRESSURE:'Directed pressure',LOCAL_CONTEST:'Local contest',ALLIED_SUPPORT:'Allied support',SHARED_OFFENSIVE_PARTICIPATION:'Shared offensive participation'};
const shown=(v:any)=>v===null||v===undefined?'Unavailable':typeof v==='boolean'?v?'Yes':'No':typeof v==='number'?String(Math.round(v*1000)/1000):typeof v==='string'?v:'Retained';
export function BattleRecordContent({statistics,mapping=[],players=[],officialOutcome,diplomacyReview,audit}:{statistics?:any;mapping?:ReplayPlayerMapping[];players?:PlayerRecord[];officialOutcome?:any;diplomacyReview?:any;audit?:Row}){
  const raw=object(statistics),facts=object(raw.matchFacts),ledger=object(raw.pairSocialEvidence);
  const example=!!audit;
  const context=example?object(audit.recordingMatchFacts):facts;
  const rules=example?object(context.ruleValues):Object.fromEntries(Object.entries(object(facts.rules)).map(([k,v])=>[k,object(v).value]));
  const source=example?object(audit.source):object(raw.source);
  const name=(id:any)=>{const p=list(facts.players).find(p=>p.playerId===id);const slot=p?.replaySlot??id;const m=mapping.find(m=>m.replaySlot===slot);return m?players.find(p=>p.playerId===m.playerId)?.steamName??m.sourceName:`Recording player ${id}`;};
  const rebuild=object(audit?.teamLockRebuildComparison);
  const alignment=object(diplomacyReview??audit?.diplomacyReview);
  const official=object(officialOutcome);
  const officialName=(id:string)=>players.find(p=>p.playerId===id)?.steamName??id;
  const incidents:Row[]=example?Object.entries(object(audit.ledgerSamples)).flatMap(([family,values])=>list(values).map(row=>({...row,family}))):list(ledger.incidents);
  const counts:Row=example?object(audit.incidentCounts):incidents.reduce<Row>((result:Row,row)=>({...result,[row.family]:(result[row.family]??0)+1}),{});
  const diplomacyOrders=example?[]:Object.values(object(object(facts.diplomacy).commandTimelines)).flatMap(list).sort((a,b)=>(a.atMs??0)-(b.atMs??0)||(a.operationOrdinal??0)-(b.operationOrdinal??0)||String(a.sourceEventId).localeCompare(String(b.sourceEventId)));
  const deedCount=example?audit.deedCount:list(ledger.deeds).length;
  const annotations=example?Object.values(object(audit.samples)).flatMap(list):[...list(object(ledger.episodeContext).annotations),...list(object(ledger.episodeContext).sequences)];
  const neutralCoverage=example?[]:list(ledger.coverage);
  const coverage=example?Object.entries(object(audit.coverageCounts)).map(([key,count])=>({family:key.split(':')[0],status:key.split(':')[1],count})):list(object(ledger.episodeContext).coverage);
  const map=object(context.map),game=object(context.game);
  const hasFacts=context.modelVersion==='AOF_RECORDING_MATCH_FACTS_V1';
  const hasLedger=example||ledger.modelVersion==='AOF_PAIR_SOCIAL_EVIDENCE_V1';
  return <div className="br-record">
    {example&&<p className="sx-notice"><strong>Real recording example: {audit.id}.</strong> Separate from the illustrative Battle above. Names are recording player numbers; no league outcome is assigned. Episode samples are abbreviated.</p>}
    <h3>The Battle record</h3>
    {hasFacts?<><dl className="br-facts">
      <div><dt>Recorded map</dt><dd>{shown(map.mapName??map.rmsFileName)}{map.mapId!=null&&<small>Map ID {shown(map.mapId)}</small>}</dd></div>
      <div><dt>Map dimensions</dt><dd>{shown(map.width)} × {shown(map.height)}</dd></div>
      <div><dt>Population limit</dt><dd>{shown(rules.population)}</dd></div>
      <div><dt>Recorded speed</dt><dd>{shown(rules.speed)}</dd></div>
      <div><dt>Teams locked</dt><dd>{shown(rules.lockTeams)}</dd></div>
      <div><dt>Recorded interval</dt><dd>{typeof game.observedDurationMs==='number'?formatTime(game.observedDurationMs):'Unavailable'}<small>May end before the Game does</small></dd></div>
    </dl><details><summary>Rules and recorded groups</summary><dl className="br-facts">{[['Game type ID',rules.gameTypeId],['Victory type ID',rules.victoryTypeId],['Starting age ID',rules.startingAgeId],['Ending age ID',rules.endingAgeId],['Starting resources ID',rules.startingResourcesId],['Map reveal ID',rules.revealMapId],['All technologies',rules.allTechnologies],['Treaty length (header value)',rules.treatyLength],['Map seed',map.seed]].map(([label,value])=><div key={String(label)}><dt>{label}</dt><dd>{shown(value)}</dd></div>)}</dl>
      {list(context.lobbyGroups).map((group,index)=><p key={index}>Recorded group {shown(group.lobbyTeamIdRaw)}: {Array.isArray(group.memberPlayerIds)?group.memberPlayerIds.map(name).join(', '):'Unavailable'}</p>)}
      <p>These are lobby assignments. They do not establish alliances throughout a diplomacy Game.</p>
      {!example&&<p>Diplomacy commands: {shown(Object.keys(object(object(facts.diplomacy).commandTimelines)).length)} directed timelines retained. Effective changes of allegiance remain unqualified.</p>}
    </details></>:<p>Recording context is unavailable in this statistics revision. Existing measurements remain available above.</p>}
    {!example&&hasFacts&&<details><summary>Diplomacy orders ({diplomacyOrders.length})</summary><p>Recorded orders are directional. An order alone does not prove that an alliance changed.</p>{diplomacyOrders.length?<ol>{diplomacyOrders.map((row,i)=><li key={row.sourceEventId??i}>{formatTime(row.atMs??0)} · {name(row.replaySlot)} → {name(row.targetReplaySlot)} · requested mode ID {shown(row.diplomacyMode)}<small className="br-source"> · {shown(row.sourceEventId)}</small></li>)}</ol>:<p>No diplomacy orders retained here. This does not qualify changes of allegiance or an absence of cooperation.</p>}</details>}
    <details><summary>Alliance evidence over time</summary><p>Fixed team context and effective diplomacy are separate sources. Recorded orders do not prove a new alliance, and they cannot leave the previous stance certain indefinitely.</p>{alignment.status==='REVIEW_AVAILABLE'?<><p>{alignment.commandCount} recorded diplomacy orders · {alignment.normalizedInitialEdgeCount} normalized initial directions · {alignment.rawInitialVectorCount} raw header vectors retained.</p><p>{alignment.knownPairSegmentCount} qualified pair intervals · {alignment.unknownPairSegmentCount} intervals with unavailable effective state. Unknown does not mean neutral.</p>{list(object(alignment.timeline).changes).map((row,i)=><p key={row.eventId??i}>{formatTime(row.atMs??0)} · {name(row.fromPlayerId)} → {name(row.toPlayerId)} · requested {shown(row.commandedStance)} · effective stance {shown(row.effectiveStanceAfter)}{row.effectiveStateInvalidated&&<> · previous certainty ends here</>}</p>)}<p>Raw header modes remain unqualified. Confirming initial stances and accepted changes requires a controlled recording with observed game behavior.</p></>:<p>Effective alliance review unavailable in this revision. No relationship conclusion is drawn.</p>}</details>
    <h4>Official result</h4>
    {official.qualification==='OFFICIAL'&&Array.isArray(official.winnerPlayerIds)&&Array.isArray(official.loserPlayerIds)?<><p>Winners: {official.winnerPlayerIds.map(officialName).join(', ')}</p><p>Non-winning players: {official.loserPlayerIds.map(officialName).join(', ')}</p><small>Current league result · revision {official.resultRevision}</small></>:<p>Unresolved here. Resignations and post-game rankings alone do not establish a winner.</p>}
    <h4>Deeds between players</h4>
    {hasLedger&&<p><strong>{deedCount} recorded deeds</strong>. Family totals below count evidence episodes; linked pressure and contest episodes may belong to one deed. Do not add these totals together.</p>}
    <p>Episodes group commands into encounters. Pressure, proximity and support keep their own meaning. These records do not yet award Rivalry, Hostility, Bond or Reputation.</p>
    {hasLedger?<><dl className="br-facts">{Object.entries(labels).map(([family,label])=><div key={family}><dt>{label}</dt><dd>{counts[family]??'No episodes recorded'}</dd></div>)}</dl>
    <p>Missing episodes do not establish peacefulness or deliberate absence of help.</p>
    <details><summary>{example?'Recorded episode samples':'Inspect recorded episodes'} ({incidents.length})</summary>
    {incidents.length?<ol className="br-episodes">{[...incidents].sort((a,b)=>(a.startedAt?.atMs??0)-(b.startedAt?.atMs??0)||String(a.incidentId).localeCompare(String(b.incidentId))).map((row,index)=><li key={row.incidentId??index}>
      <strong>{labels[row.family]??row.family}</strong> · {formatTime(row.startedAt?.atMs??0)}
      <ul>{list(row.facets).map((facet,i)=><li key={i}>{describe(facet)}</li>)}</ul>
      <details><summary>Source references</summary><p className="br-source">{row.incidentId}</p>{list(row.facets).map((facet,i)=><p className="br-source" key={i}>{facet.kind}: {Array.isArray(facet.sourceEventIds)?facet.sourceEventIds.join(', '):'Unavailable'}{example&&facet.sourceEventCount!=null&&<> · {facet.sourceEventCount} references in the full record</>}</p>)}</details>
    </li>)}</ol>:<p>No episodes recorded. Coverage must qualify any conclusion about absence.</p>}
    </details>
    <details><summary>Episode context and coverage</summary>
      {neutralCoverage.map((row,i)=><p key={'neutral-'+i}>{labels[row.family]??shown(row.family)} · {name(row.fromPlayerId)} → {name(row.toPlayerId)} · {shown(row.status)}<small> · {String(row.reason??'Qualification unavailable').replaceAll('_',' ')} · Positive episodes only; absence unqualified.</small></p>)}
      {!neutralCoverage.length&&<p>Directed family coverage is unavailable in this abbreviated record.</p>}
      {annotations.map((row,i)=><p key={row.contextId??i}>{row.family==='PRESSURE_RESPONSE'?`${name(row.responseActorPlayerId)}: ${row.responseCommandType} command associated with pressure; recorded latency ${shown(row.sourceLatencyMs)} ms. This is not proven reaction time.`:row.family==='RETURN_PRESSURE'?`Later independent pressure: ${name(row.returnDirection?.fromPlayerId)} → ${name(row.returnDirection?.toPlayerId)}. This does not prove retaliation.`:row.family==='DEFENSIVE_SUPPORT_WITH_PRESSURE'?`Support associated with pressure: ${name(row.supportDirection?.fromPlayerId)} → ${name(row.supportDirection?.toPlayerId)}. Rescue and outcome are unconfirmed.`:row.family}</p>)}
      {coverage.map((row,i)=><p key={i}>{shown(row.family)} · {shown(row.status)}{row.count!=null&&<> · {row.count} coverage records</>}</p>)}
      {!coverage.length&&<p>Family coverage unavailable.</p>}
      <p>Relic targeting is command evidence; possession or taking is unconfirmed. APM describes activity, not motive or distress.</p>
    </details></>:<p>Social evidence is unavailable in this statistics revision.</p>}
    {example&&rebuild.notDeployedHistoricalStatistics===true&&<details><summary>Team-lock rebuild comparison</summary><p>This isolates the old lobby team-lock value against the decoded DE value for this recording. It is not a comparison with deployed league statistics.</p><p>Lobby flag: {shown(rebuild.legacyLobbyLockTeams)} · DE flag: {shown(rebuild.decodedDeLockTeams)}</p>{list(rebuild.changes).length?<div className="sx-table-scroll"><table className="sx-table"><caption>Checked changes by recording player</caption><thead><tr><th>Player</th><th>Measurement</th><th>Legacy lobby flag</th><th>Decoded DE flag</th></tr></thead><tbody>{list(rebuild.changes).map((row,i)=><tr key={i}><th scope="row">{name(row.playerId)}</th><td>{({cooperativeAttacks:'Cooperative attacks',defensiveAssistsGiven:'Defensive assists given',defensiveAssistsReceived:'Defensive assists received'} as Row)[row.metric]??row.metric}</td><td>{shown(row.before)}</td><td>{shown(row.after)}</td></tr>)}</tbody></table></div>:<p>No differences in the checked metrics.</p>}<p>Checked scope: {Array.isArray(rebuild.metricScope)?rebuild.metricScope.join(', '):'Unavailable'}. Active statistics were not replaced.</p></details>}
    <details><summary>Recording provenance</summary><dl className="br-facts"><div><dt>Recording fingerprint</dt><dd className="br-source">{shown(source.replaySha256)}</dd></div><div><dt>Game identity</dt><dd className="br-source">{shown(game.guid)}</dd></div><div><dt>Evidence model</dt><dd className="br-source">{shown(context.modelVersion)}</dd></div></dl>{example&&<p>Retained real-corpus audit at commit {audit.sourceCommit}. Structural seal; not full engine outcome verification. Samples are not a complete ledger.</p>}</details>
  </div>;
  function describe(f:Row){
    const directed=`${name(f.fromPlayerId)} → ${name(f.toPlayerId)}`;
    if(f.kind==='TARGETED_COMMAND')return `Targeted command: ${directed}; target controller attributed from retained commands. Hits and damage unconfirmed.`;
    if(f.kind==='ECONOMY_PRESSURE')return `Pressure: ${directed}; attribution: ${Array.isArray(f.attributionMethods)?f.attributionMethods.join(', '):'Unavailable'}. Proximity attribution is inferred.`;
    if(f.kind==='LOCAL_COMMAND_OVERLAP')return `Local overlap: ${name(f.contributorPlayerId)} with ${name(f.otherPlayerId)}; proximity does not establish a targeted attack.`;
    if(f.kind==='SHARED_OPPONENT_PARTICIPATION')return `Shared offensive participation: ${list(f.contributions).map(c=>name(c.contributorPlayerId)).join(' + ')} → ${name(f.targetPlayerId)}; common target, coordination intent unconfirmed.`;
    if(['DEFENSIVE_PARTICIPATION','REINFORCEMENT_COMMANDS'].includes(f.kind))return `${f.kind==='DEFENSIVE_PARTICIPATION'?'Defensive participation':'Reinforcement commands'}: ${directed}; helper → recipient. Effective assistance unconfirmed.`;
    return String(f.kind??'Unclassified evidence');
  }
}

export function BattleRecord({repository,matchId,gameId,players,preview,revision}:{repository:LeagueRepository;matchId:string;gameId:string;players:PlayerRecord[];preview:boolean;revision:string}){
  const [opened,setOpened]=useState(false),[result,setResult]=useState<any>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0),[exampleId,setExampleId]=useState('4v4');
  useEffect(()=>{let current=true;setResult(null);setError('');if(opened&&!preview)repository.replayStatistics(matchId,gameId).then(r=>{if(current)setResult(r);}).catch(e=>{if(current)setError(e instanceof Error?e.message:'The record could not be read.');});return()=>{current=false;};},[repository,matchId,gameId,revision,opened,preview,retry]);
  return <details className="sx-details br-review" onToggle={e=>setOpened(e.currentTarget.open)}><summary>{preview?'Review real recording evidence':'Battle record and social evidence'}</summary>{opened&&(preview?<><label>Recording example <select value={exampleId} onChange={e=>setExampleId(e.target.value)}>{recordingReviewExamples.map(row=><option key={row.id} value={row.id}>{row.id}</option>)}</select></label><BattleRecordContent audit={recordingReviewExamples.find(row=>row.id===exampleId)}/></>:error?<div role="alert"><p>{error}</p><button onClick={()=>setRetry(n=>n+1)}>Retry reading record</button></div>:result?<BattleRecordContent statistics={result.statistics} mapping={result.playerMapping} officialOutcome={result.officialOutcome} diplomacyReview={result.diplomacyReview} players={players}/>:<p role="status">Reading the retained Battle record…</p>)}</details>;
}
