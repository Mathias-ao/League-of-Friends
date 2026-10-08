import {BattleRecord} from './BattleRecord';
import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowRight,ChevronDown,RefreshCw,Star,X} from 'lucide-react';
import {CATEGORIES,FAMILIES,FAMILY_LABELS,METRICS,StatisticsExperience,formatStatistic,formatTime,type AggregatePlayer,type AggregationMode,type Category,type EvidenceEpisode,type GameStatistics,type Highlight,type MetricDefinition,type StatisticsDataset,type StatisticsScope} from '../domain/statistics';
import {formatName,type LeagueRepository,type MatchDetail,type EventDetail} from '../domain/league';
import type {ViewProps} from './App';
import {EventDialog,MatchDialog} from './Views';

const definition=(id:string)=>METRICS.find(m=>m.id===id)!;
const interactions=new Set(['raidsOut','firstRaid','raidsIn','assistsOut','assistsIn','cooperation','skirmishes','skirmishTime','response']);
const categoryHelp:Record<Category,string>={
  Opening:'Typical timings and recurring openings. Earlier is a timing distinction, not a strategy grade.',
  Economy:'Base-cost resource commitment from requests and placements; not income or exact resources spent.',
  Military:'Detected interactions and requested production. Raids and engagements do not establish damage or kills.',
  'Map Presence':'Command and placement geometry; not explored terrain or territory owned.',
  Execution:'Command activity and inferred response timing. These are descriptive measurements, not a skill score.'
};
const groupIds:Record<Category,string[][]>={
  Opening:[['feudal','castle','imperial']],
  Economy:[['food','wood','gold','stone','total']],
  Military:[['raidsOut','raidsIn','skirmishes','skirmishTime'],['assistsOut','assistsIn','cooperation','militaryCommitment']],
  'Map Presence':[['scouting','expansions','forward','forwardEco','walls']],
  Execution:[['apm','combatApm','response','responded','received']]
};

function contextLabel(key:string){
  const separator=key.indexOf(' · ');
  try{
    const config=JSON.parse(key.slice(separator+3));
    const maps=config.maps?.pool?.join(', ')||'Unrestricted map pool';
    const settings=Object.entries(config.additionalSettings??{}).map(([k,v])=>`${k}: ${v}`).join(', ');
    return `${formatName(key.slice(0,separator))} · ${maps}${config.recordScope?` · Battle ${config.recordScope}`:''}${settings?` · ${settings}`:''}`;
  }catch{return key;}
}

function useStatistics(repository:LeagueRepository,scope:StatisticsScope,revision=''){
  const [dataset,setDataset]=useState<StatisticsDataset|null>(null),[error,setError]=useState(''),[reload,setReload]=useState(0);
  const key=JSON.stringify(scope);
  useEffect(()=>{
    let current=true;
    setDataset(null);
    setError('');
    repository.statisticsExperience(JSON.parse(key)).then(data=>{if(current)setDataset(data);}).catch(error=>{if(current)setError(error instanceof Error?error.message:'Statistics could not be loaded.');});
    return()=>{current=false;};
  },[repository,key,revision,reload]);
  return {dataset,error,retry:()=>setReload(n=>n+1)};
}

function LoadState({dataset,error,retry}:{dataset:StatisticsDataset|null;error:string;retry:()=>void}){
  if(error)return <div className="alert" role="alert"><span>{error}</span><button onClick={retry}>Retry</button></div>;
  if(!dataset)return <p role="status">Reading the battle ledger…</p>;
  return null;
}

function EvidenceNotice({preview,pending,unavailable=0}:{preview:boolean;pending?:boolean;unavailable?:number}){
  return <div className="sx-notice">{preview&&<strong>Illustrative preview · </strong>}{pending?'Official result pending or disputed. These measurements do not contribute to leaders, records, or season totals.':'Measurements retain their recorded, reconstructed, or inferred meaning.'}{unavailable>0&&<span> {unavailable} completed {unavailable===1?'Game is':'Games are'} awaiting usable statistics. Leader and record claims wait for complete coverage.</span>}</div>;
}

function HighlightCards({items,openMatch}:{items:Highlight[];openMatch:(id:string)=>void}){
  return <div className="sx-highlights">{items.map(item=><article key={item.id}><span className="eyebrow">{item.category}</span><h3>{item.title}</h3><p>{item.detail}</p><button className="text-button" onClick={()=>openMatch(item.matchId)}>Source Battle <ArrowRight size={14}/></button></article>)}</div>;
}

function CategoryTabs({category,onChange}:{category:Category;onChange:(c:Category)=>void}){
  return <nav className="sx-tabs" aria-label="Statistics categories">{CATEGORIES.map(c=><button key={c} aria-pressed={category===c} onClick={()=>onChange(c)}>{c}</button>)}</nav>;
}

interface PanelProps {games:GameStatistics[];viewerId?:string;openMatch:(id:string)=>void;openPlayer:(id:string)=>void;preview:boolean;unavailableGames?:number;battle?:boolean;standings?:{playerId:string;rank?:number}[];onRefresh?:()=>void;}

export function StatisticsPanel({games,viewerId,openMatch,openPlayer,preview,unavailableGames=0,battle=false,standings=[],onRefresh}:PanelProps){
  const [category,setCategory]=useState<Category>(()=>{if(battle)return 'Opening';try{const c=localStorage.getItem('aof-statistics-category');return CATEGORIES.includes(c as Category)?c as Category:'Military';}catch{return 'Military';}});
  const [format,setFormat]=useState('all'),[context,setContext]=useState('all'),[mode,setMode]=useState<AggregationMode>('total'),[sort,setSort]=useState<string>('name'),[inspect,setInspect]=useState<{playerId:string;metricId:string}|null>(null);
  const filtered=games.filter(g=>(format==='all'||g.format===format)&&(context==='all'||g.contextKey===context));
  const provisional=battle&&filtered.some(g=>!g.eligible);
  const engine=useMemo(()=>new StatisticsExperience(provisional?filtered.map(g=>({...g,eligible:true})):filtered),[games,format,context,provisional]);
  const rows=engine.aggregate(mode);
  if(battle)rows.sort((a,b)=>sort==='name'?a.name.localeCompare(b.name):(definition(sort).leader==='min'?(a.values[sort]?.value??Infinity)-(b.values[sort]?.value??Infinity):(b.values[sort]?.value??-Infinity)-(a.values[sort]?.value??-Infinity))||a.name.localeCompare(b.name));
  const changeCategory=(c:Category)=>{setCategory(c);setSort('name');setInspect(null);if(!battle)try{localStorage.setItem('aof-statistics-category',c);}catch{/* Storage is optional. */}};
  const select=(playerId:string,metricId:string)=>setInspect({playerId,metricId});
  return <div className="sx-panel">
    {!battle&&<CategoryTabs category={category} onChange={changeCategory}/>}    
    {!battle&&<div className="sx-toolbar" role="group" aria-label="Statistics filters"><label><span>Format</span><select value={format} onChange={e=>{setFormat(e.target.value);setContext('all');setInspect(null);}}><option value="all">All formats</option>{[...new Set(games.map(g=>g.format))].sort().map(f=><option key={f} value={f}>{formatName(f)}</option>)}</select></label><span className="sx-toolbar-rule" aria-hidden="true"/><label><span>Comparison</span><select value={context} onChange={e=>setContext(e.target.value)}><option value="all">All approved settings</option>{[...new Set(games.filter(g=>format==='all'||g.format===format).map(g=>g.contextKey))].map(c=><option key={c} value={c}>{contextLabel(c)}</option>)}</select></label><span className="sx-toolbar-meta">{engine.games.length} eligible Games{games.filter(g=>!g.eligible).length>0&&<> · {games.filter(g=>!g.eligible).length} pending / disputed</>}</span>{onRefresh&&<button className="sx-refresh" aria-label="Refresh season statistics" onClick={onRefresh}><RefreshCw size={15}/></button>}</div>}
    {battle&&<EvidenceNotice preview={preview} pending={provisional} unavailable={unavailableGames}/>}    
    {battle&&<FocusedScorecard rows={rows} engine={engine} select={select} viewerId={viewerId}/>}    
    {inspect&&<EvidenceInspector selection={inspect} games={provisional?filtered:engine.games} close={()=>setInspect(null)} openMatch={openMatch}/>}    
    {battle?<details className="sx-details"><summary>Full statistics <ChevronDown size={16}/></summary><CategoryTabs category={category} onChange={changeCategory}/>{categoryContent()}</details>:categoryContent()}
    {battle&&filtered[0]&&<details className="sx-details"><summary>Battle timeline <ChevronDown size={16}/></summary><BattleTimeline game={filtered[0]}/></details>}
  </div>;

  function categoryContent(){
    const provenanceText=`Metric leaders retain a visual distinction, ties share recognition, and unavailable values remain “—”. ${category==='Opening'?'Age timings are medians.':category==='Map Presence'?'Counts are per-Game means; scouting coverage is a median.':category==='Execution'?'APM is the median across Games. Response latency pools detected responses; opportunity counts stay totals.':mode==='average'?'Per Game is the mean across available Games.':'Counts and commitment are season totals.'} Select a value for its sample count and sources. ${battle?'':'Timing and per-Game distinctions require five samples per player with matching settings.'}`;
    return <section aria-label={`${category} statistics`} className={battle?'':'sx-ledger'}>
      {!battle&&<div className="sx-ledger-intro"><p>{categoryHelp[category]}</p>{['Economy','Military'].includes(category)&&<div className="sx-toggle" aria-label="Aggregation"><button aria-pressed={mode==='total'} onClick={()=>setMode('total')}>Total</button><button aria-pressed={mode==='average'} onClick={()=>setMode('average')}>Per Game</button></div>}</div>}
      {!rows.length?<p className="sx-empty">No eligible statistics in this selection. Accepted Game results and replay evidence will populate this table.</p>:<>
        {groupIds[category].map((ids,i)=><MetricTable key={ids.join()} label={category==='Military'?(i===0?'Combat':'Cooperation and commitment'):category} rows={rows} metrics={ids.map(definition)} engine={engine} mode={mode} battle={battle} allowLeaders={!provisional&&unavailableGames===0} viewerId={viewerId} select={select} sort={sort} setSort={setSort} openPlayer={openPlayer} showOpening={category==='Opening'} standings={standings}/>) }
        {!battle&&<details className="sx-provenance"><summary>Measurement provenance</summary><EvidenceNotice preview={preview} pending={provisional} unavailable={unavailableGames}/><p className="sx-legend">{provenanceText}</p></details>}
        {battle&&<p className="sx-legend"><Star size={12}/> {provenanceText}</p>}
        {category==='Economy'&&<CompositionBars rows={rows} kind="resources"/>}
        {category==='Military'&&<CompositionBars rows={rows} kind="military"/>}
        {battle&&<details className="sx-details"><summary>Supporting measurements and requests</summary>{METRICS.some(m=>m.category===category&&m.detail)&&<MetricTable label="Supporting measurements" rows={rows} metrics={METRICS.filter(m=>m.category===category&&m.detail)} engine={engine} mode={mode} battle allowLeaders={false} select={select} sort={sort} setSort={setSort} openPlayer={openPlayer}/>}<SupportingDetails games={filtered} category={category}/></details>}
        {!battle&&!provisional&&unavailableGames===0&&<RecordBook engine={engine} category={category} openMatch={openMatch}/>}        
      </>}
    </section>;
  }
}

function FocusedScorecard({rows,engine,select,viewerId}:{rows:AggregatePlayer[];engine:StatisticsExperience;select:(p:string,m:string)=>void;viewerId?:string}){
  const hasAllies=rows.some(p=>p.values.assistsOut.value!==null);
  const team=(id:string)=>engine.games[0]?.players.find(p=>p.playerId===id)?.team??0;
  return <div className="sx-table-scroll"><table className="sx-table sx-scorecard"><caption>Battle scorecard</caption><thead><tr><th>Player</th><th>Opening</th><th>Main military unit</th><th>Resources committed</th><th>Raids out / in</th>{hasAllies&&<th>Defensive assists</th>}</tr></thead><tbody>{[...rows].sort((a,b)=>team(a.playerId)-team(b.playerId)).map(p=>{
    const raw=engine.games[0]?.players.find(r=>r.playerId===p.playerId);
    return <tr key={p.playerId} className={viewerId===p.playerId?'sx-you':''}><th scope="row">{p.name}<small>{raw?.civilization??'Civilization unavailable'} · Team {raw?.team??'FFA'}</small></th><td>{raw?.opening??'Unclassified'}<small>Castle ≈ {formatStatistic(p.values.castle.value,definition('castle'))}</small></td><td>{raw?.mainUnit??'—'}<small>Most queued</small></td><td><button onClick={()=>select(p.playerId,'total')}>{formatStatistic(p.values.total.value,definition('total'))}</button></td><td><button aria-label={`${p.name}: raids initiated`} onClick={()=>select(p.playerId,'raidsOut')}>{p.values.raidsOut.value??'—'}</button> / <button aria-label={`${p.name}: raids received`} onClick={()=>select(p.playerId,'raidsIn')}>{p.values.raidsIn.value??'—'}</button></td>{hasAllies&&<td><button onClick={()=>select(p.playerId,'assistsOut')}>{p.values.assistsOut.value??'—'}</button></td>}</tr>;
  })}</tbody></table></div>;
}

function orderedSeasonColumns(rows:AggregatePlayer[],standings:{playerId:string;rank?:number}[]){
  const rankByPlayer=new Map(standings.map((player,index)=>[player.playerId,player.rank??index+1] as const));
  return [...rows].sort((a,b)=>(rankByPlayer.get(b.playerId)??Number.MAX_SAFE_INTEGER)-(rankByPlayer.get(a.playerId)??Number.MAX_SAFE_INTEGER)||a.name.localeCompare(b.name));
}

function SeasonMetricTable({rows,metrics,engine,mode,allowLeaders,viewerId,select,openPlayer,showOpening,standings}:{rows:AggregatePlayer[];metrics:MetricDefinition[];engine:StatisticsExperience;mode:AggregationMode;allowLeaders:boolean;viewerId?:string;select:(p:string,m:string)=>void;openPlayer:(id:string)=>void;showOpening?:boolean;standings:{playerId:string;rank?:number}[]}){
  const leaders=Object.fromEntries(metrics.map(m=>[m.id,allowLeaders?engine.leaders(m.id,mode,5):[]]));
  const rankByPlayer=new Map(standings.map((player,index)=>[player.playerId,player.rank??index+1] as const));
  const columns=orderedSeasonColumns(rows,standings);
  const scroller=useRef<HTMLDivElement>(null),viewerHeader=useRef<HTMLTableCellElement>(null);
  useEffect(()=>{const container=scroller.current,cell=viewerHeader.current;if(!container||!cell)return;container.scrollLeft=Math.max(0,cell.offsetLeft-container.clientWidth/2+cell.clientWidth/2);},[viewerId,columns.map(player=>player.playerId).join('|')]);
  return <div ref={scroller} className="sx-table-scroll sx-season-scroll"><table className="sx-table sx-season-table"><thead><tr><th scope="col" className="sx-metric-column"><span>Statistic</span></th>{columns.map(player=>{const isViewer=player.playerId===viewerId,rank=rankByPlayer.get(player.playerId);return <th ref={isViewer?viewerHeader:undefined} key={player.playerId} scope="col" className={`sx-player-head${isViewer?' sx-player-focus':''}`}><span className="sx-player-marker">{isViewer?'YOU · ':''}{rank?`#${rank}`:'UNRANKED'}</span><button className="sx-player-name" onClick={()=>openPlayer(player.playerId)}>{player.name}</button><small>{player.games} {player.games===1?'Game':'Games'}</small></th>;})}</tr></thead><tbody>{showOpening&&<tr><th scope="row"><span className="sx-metric-title">Usual opening</span><small>Most common classified opening</small></th>{columns.map(player=><td key={player.playerId} className="sx-text-value"><button onClick={()=>select(player.playerId,'feudal')} className="sx-value-button"><span className="sx-value-main">{player.opening??'Unclassified'}</span><small>View timing evidence</small></button></td>)}</tr>}{metrics.map(metric=><tr key={metric.id}><th scope="row"><span className="sx-metric-title">{metric.label}</span><small>{metric.leader==='min'?'Lower establishes the lead':'Higher establishes the lead'}</small></th>{columns.map(player=>{const value=player.values[metric.id];const lead=leaders[metric.id].includes(player.playerId);return <td key={player.playerId} className={lead?'sx-leading':''}><button className="sx-value-button" aria-label={`${player.name}, ${metric.label}: ${formatStatistic(value.value,metric)}${lead?', season lead':''}. View evidence.`} onClick={()=>select(player.playerId,metric.id)}><span className="sx-value-main">{formatStatistic(value.value,metric)}</span>{lead&&<span className="sx-lead-note">Season lead</span>}{value.samples!==player.games&&<small>{value.samples}/{player.games} Games</small>}{value.models.length>1&&<small>Mixed models</small>}</button></td>;})}</tr>)}</tbody></table></div>;
}

function MetricTable({label,rows,metrics,engine,mode,battle,allowLeaders,viewerId,select,sort,setSort,openPlayer,showOpening,standings=[]}:{label:string;rows:AggregatePlayer[];metrics:MetricDefinition[];engine:StatisticsExperience;mode:AggregationMode;battle:boolean;allowLeaders:boolean;viewerId?:string;select:(p:string,m:string)=>void;sort:string;setSort:(s:string)=>void;openPlayer:(id:string)=>void;showOpening?:boolean;standings?:{playerId:string;rank?:number}[]}){
  if(!battle)return <SeasonMetricTable rows={rows} metrics={metrics} engine={engine} mode={mode} allowLeaders={allowLeaders} viewerId={viewerId} select={select} openPlayer={openPlayer} showOpening={showOpening} standings={standings}/>;
  const leaders=Object.fromEntries(metrics.map(m=>[m.id,allowLeaders?engine.leaders(m.id,mode,battle?1:5):[]]));
  return <div className="sx-table-scroll"><table className="sx-table"><caption>{label}</caption><thead><tr><th><button onClick={()=>setSort('name')}>Player</button></th>{showOpening&&<th>{battle?'Opening':'Usual opening'}</th>}{metrics.map(m=><th key={m.id} aria-sort={sort===m.id?(m.leader==='min'?'ascending':'descending'):'none'}><button onClick={()=>setSort(m.id)}>{m.label}{sort===m.id?(m.leader==='min'?' ↑':' ↓'):''}</button></th>)}</tr></thead><tbody>{rows.map(p=><tr key={p.playerId} className={p.playerId===viewerId?'sx-you':''}><th scope="row"><button onClick={()=>openPlayer(p.playerId)}>{p.name}</button><small>{p.games} {p.games===1?'Game':'Games'}</small></th>{showOpening&&<td>{p.opening??'Unclassified'}</td>}{metrics.map(m=>{const v=p.values[m.id],lead=leaders[m.id].includes(p.playerId);return <td key={m.id} className={lead?'sx-leading':''}><button aria-label={`${p.name}, ${m.label}: ${formatStatistic(v.value,m)}${lead?', joint or sole metric leader':''}. View evidence.`} onClick={()=>select(p.playerId,m.id)}>{formatStatistic(v.value,m)}{lead&&<Star size={12} fill="currentColor"/>}</button>{v.samples!==p.games&&<small>{v.samples}/{p.games} Games</small>}{v.models.length>1&&<small>Mixed models</small>}</td>;})}</tr>)}</tbody></table></div>;
}

function relevantEpisode(e:EvidenceEpisode,playerId:string,metricId:string){
  if(metricId==='raidsOut'||metricId==='firstRaid')return e.kind==='raid'&&e.actors.includes(playerId);
  if(metricId==='raidsIn'||metricId==='response')return e.kind==='raid'&&e.targets.includes(playerId);
  if(metricId==='assistsOut')return e.kind==='assist'&&e.actors.includes(playerId);
  if(metricId==='assistsIn')return e.kind==='assist'&&e.targets.includes(playerId);
  if(metricId==='cooperation')return e.kind==='cooperation'&&e.actors.includes(playerId);
  return e.kind==='skirmish'&&e.actors.includes(playerId);
}

function EvidenceInspector({selection,games,close,openMatch}:{selection:{playerId:string;metricId:string};games:GameStatistics[];close:()=>void;openMatch:(id:string)=>void}){
  const panel=useRef<HTMLElement>(null);
  useEffect(()=>{panel.current?.scrollIntoView({block:'nearest',behavior:'smooth'});},[selection]);
  const metric=definition(selection.metricId),samples=games.flatMap(g=>g.players.filter(p=>p.playerId===selection.playerId).map(p=>({g,p})));
  const names=new Map(games.flatMap(g=>g.players.map(p=>[p.playerId,p.name] as const)));
  const episodes=games.flatMap(g=>g.episodes.filter(e=>relevantEpisode(e,selection.playerId,selection.metricId)).map(e=>({g,e})));
  const counterpart=new Map<string,number>();
  for(const {e} of episodes){const ids=e.actors.includes(selection.playerId)?e.targets:e.actors;for(const id of ids)counterpart.set(id,(counterpart.get(id)??0)+1);}
  return <section ref={panel} className="sx-inspector" aria-label="Statistic evidence" aria-live="polite"><div className="sx-heading"><h3>{names.get(selection.playerId)} · {metric.label}</h3><button onClick={close} aria-label="Close evidence"><X size={18}/></button></div><p>{samples.filter(({p})=>p.values[metric.id]!==null).length} of {samples.length} Games contribute. Source model: {[...new Set(samples.map(({p})=>p.models[metric.id]))].join(', ')}.</p>
    {interactions.has(metric.id)&&<><div className="sx-pair-list">{[...counterpart].sort((a,b)=>b[1]-a[1]).map(([id,n])=><span key={id}><strong>{names.get(id)??id}</strong> · {n} directed episodes</span>)}</div><div className="sx-episode-list">{episodes.map(({g,e})=><button key={g.matchId+g.gameId+e.id} onClick={()=>openMatch(g.matchId)}><time>{formatTime(e.atMs)}</time><span>{e.label}: {e.actors.map(id=>names.get(id)??id).join(' + ')}{e.targets.length?` → ${e.targets.map(id=>names.get(id)??id).join(' + ')}`:''}</span><small>{g.matchId} / {g.gameId}</small></button>)}</div>{!episodes.length&&<p>No corresponding detailed episodes are available.</p>}{games.some(g=>g.evidenceTruncated)&&<p>Episode details are limited to the first 600 per Game; aggregate counts retain the complete measurements.</p>}</>}
    <div className="sx-source-list">{samples.map(({g,p})=><button key={g.matchId+g.gameId} onClick={()=>openMatch(g.matchId)}><span>{g.matchId} / {g.gameId}<small>{p.civilization??'Civilization unavailable'} · {new Date(g.orderAtMs).toLocaleDateString()}</small></span><strong>{formatStatistic(p.values[metric.id],metric)}</strong><small>{p.values[metric.id]===null?p.unavailable[metric.id]:g.eligible?'Accepted':'Pending / disputed'}</small><ArrowRight size={14}/></button>)}</div>
  </section>;
}

export function CompositionBars({rows,kind}:{rows:AggregatePlayer[];kind:'resources'|'military'}){
  const [selected,setSelected]=useState<string|null>(null);
  const keys=kind==='resources'?['food','wood','gold','stone']:[...FAMILIES];
  const data=rows.map(p=>({p,values:kind==='resources'?Object.fromEntries(keys.map(k=>[k,p.values[k].value])):p.composition}));
  const total=(v:Record<string,number|null>|null)=>v&&keys.every(k=>v[k]!=null)?keys.reduce((n,k)=>n+(v[k]??0),0):null;
  const max=kind==='military'?100:Math.max(1,...data.map(d=>total(d.values)??0));
  const label=(key:string)=>kind==='military'?FAMILY_LABELS[key]:key[0].toUpperCase()+key.slice(1);
  return <figure className="sx-bars"><figcaption><strong>{kind==='resources'?'Resource commitment':'Military queue composition'}</strong><span>{kind==='resources'?'Absolute scale · base-cost resource units':'Equal weight per Game · share of military queue requests'}</span></figcaption><div className="sx-chart-legend">{keys.map((k,i)=><button key={k} aria-pressed={selected===k} onClick={()=>setSelected(selected===k?null:k)}><i style={{background:`var(--sx-series-${i%10})`}}/>{label(k)}</button>)}</div>{data.map(({p,values})=>{const sum=total(values);return <div className="sx-bar-row" key={p.playerId}><span>{p.name}</span><div className="sx-bar-track" aria-label={`${p.name}: ${sum===null?'unavailable':keys.map(k=>`${label(k)} ${values?.[k]?.toFixed(1)}${kind==='military'?'%':''}`).join(', ')}`}>{sum!==null&&keys.map((k,i)=><button key={k} onClick={()=>setSelected(selected===k?null:k)} aria-label={`${p.name}, ${label(k)}: ${values?.[k]?.toFixed(1)}${kind==='military'?' percent':''}`} title={`${label(k)}: ${values?.[k]?.toFixed(1)}${kind==='military'?'%':''}`} style={{width:`${((values?.[k]??0)/max)*100}%`,background:`var(--sx-series-${i%10})`,opacity:selected&&selected!==k?0.2:1}}/>)}</div><strong>{sum===null?'—':kind==='military'?(selected?`${values?.[selected]?.toFixed(1)}%`:'100%'):new Intl.NumberFormat('en-GB',{maximumFractionDigits:0}).format(selected?(values?.[selected]??0):sum)}</strong></div>;})}<div className="sx-bar-scale"><span>0</span><span>{kind==='military'?'100%':`${new Intl.NumberFormat('en-GB',{maximumFractionDigits:0}).format(max)} resource units`}</span></div></figure>;
}

export function BattleTimeline({game}:{game:GameStatistics}){
  const [selected,setSelected]=useState<string>('');
  const episode=game.episodes.find(e=>e.id===selected),name=(id:string)=>game.players.find(p=>p.playerId===id)?.name??id;
  return <section className="sx-timeline"><h3>Battle timeline</h3><p>Game clock · inferred interactions and estimated age timings. Select a marker or episode.</p><div className="sx-timeline-scroll"><div className="sx-timeline-grid"><div className="sx-timeline-scale">{[0,.25,.5,.75,1].map(t=><span key={t}>{formatTime(game.durationMs*t)}</span>)}</div>{game.players.map(p=><div className="sx-timeline-row" key={p.playerId}><strong>{p.name}</strong><div className="sx-lane">{game.episodes.filter(e=>e.actors.includes(p.playerId)||e.targets.includes(p.playerId)).map(e=><button key={e.id} className={`sx-marker sx-${e.kind}${selected===e.id?' selected':''}`} aria-label={`${formatTime(e.atMs)} ${e.label}`} title={`${formatTime(e.atMs)} ${e.label}`} onClick={()=>setSelected(e.id)} style={{left:`${Math.min(99,e.atMs/Math.max(game.durationMs,1)*100)}%`,width:`${Math.max(.6,Math.min(game.durationMs-e.atMs,e.endMs-e.atMs)/Math.max(game.durationMs,1)*100)}%`}}/> )}</div></div>)}</div></div><div className="sx-timeline-legend"><span>◆ Age</span><span>━ Raid</span><span>● Assistance / cooperation</span><span>▰ Engagement</span></div><label className="sx-episode-picker">Episode<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choose an episode</option>{game.episodes.map(e=><option key={e.id} value={e.id}>{formatTime(e.atMs)} · {e.label} · {e.actors.map(name).join(', ')}</option>)}</select></label>{episode&&<p className="sx-timeline-selection" aria-live="polite"><strong>{episode.label} · {formatTime(episode.atMs)}–{formatTime(episode.endMs)}</strong><br/>{episode.actors.map(name).join(' + ')}{episode.targets.length?` → ${episode.targets.map(name).join(' + ')}`:''}</p>}{game.evidenceTruncated&&<p>Showing the first 600 episodes.</p>}</section>;
}

function SupportingDetails({games,category}:{games:GameStatistics[];category:Category}){
  return <div className="sx-supporting">{games.flatMap(g=>g.players.map(p=><details key={g.gameId+p.playerId}><summary>{p.name} · requests and breakdowns</summary>{category==='Economy'&&<div className="sx-table-scroll"><table className="sx-table"><caption>Resources committed by age</caption><thead><tr><th>Age</th>{['food','wood','gold','stone','total'].map(k=><th key={k}>{k}</th>)}</tr></thead><tbody>{Object.entries(p.byAge).map(([age,v])=><tr key={age}><th>{age}</th>{['food','wood','gold','stone','total'].map(k=><td key={k}>{typeof v[k]==='number'?v[k].toLocaleString():'—'}</td>)}</tr>)}</tbody></table></div>}{p.details.filter(d=>d.category===category).map((d,i)=><p key={i}>{d.atMs===null?'':`${formatTime(d.atMs)} · `}<strong>{d.label}</strong> · {d.value}</p>)}{!p.details.some(d=>d.category===category)&&category!=='Economy'&&<p>No additional request details available.</p>}</details>))}</div>;
}

function RecordBook({engine,category,openMatch}:{engine:StatisticsExperience;category:Category;openMatch:(id:string)=>void}){
  const records=engine.records().filter(r=>definition(r.metricId).category===category);
  return <section className="sx-records"><span className="eyebrow">SINGLE-GAME RECORDS</span><h3>{category} record book</h3><p>Records compare available measurements within matching approved settings and model versions. Ties share recognition.</p>{records.length?<div className="sx-record-grid">{records.map(r=><button key={r.metricId+r.contextKey+r.model+r.playerId} onClick={()=>openMatch(r.matchId)}><span>{definition(r.metricId).record==='min'?'Earliest':'Most'} · {definition(r.metricId).label}</span><strong>{formatStatistic(r.value,definition(r.metricId))}</strong><b>{r.name}</b><small>{r.civilization??'Civilization unavailable'} · {new Date(r.orderAtMs).toLocaleDateString()}</small><small>{contextLabel(r.contextKey)}</small><small>{r.matchId} / {r.gameId} · {r.model}</small><span>Source Battle →</span></button>)}</div>:<p>No qualified records for this selection yet.</p>}</section>;
}

export function BattleStatisticsExperience(props:ViewProps&{data:MatchDetail}){
  const {data,repository,preview,openMatch,openPlayer,snapshot}=props;
  const revision=JSON.stringify(data.games.map(g=>[g.gameId,g.status,g.result?.revision,g.resultDisputeOpen,g.replay?.statisticsRevision]));
  const state=useStatistics(repository,{matchId:data.match.matchId},revision);
  const [gameId,setGameId]=useState(data.games[0]?.gameId??'');
  const [recordRefresh,setRecordRefresh]=useState(0);
  const selected=state.dataset?.games.find(g=>g.gameId===gameId)??state.dataset?.games[0];
  const highlights=selected?.eligible?new StatisticsExperience([selected]).highlights(3):[];
  return <section id="battle-statistics" className="statistics-experience sx-dashboard"><div className="sx-page-actions"><button aria-label="Refresh Battle statistics" onClick={()=>{state.retry();setRecordRefresh(n=>n+1);}}><RefreshCw size={16}/></button></div><LoadState {...state}/>{state.dataset&&<>{state.dataset.games.length>1&&<label>Game<select value={selected?.gameId} onChange={e=>setGameId(e.target.value)}>{state.dataset.games.map(g=><option key={g.gameId} value={g.gameId}>{g.gameId}</option>)}</select></label>}<HighlightCards items={highlights} openMatch={openMatch}/>{selected?<><BattleRecord key={selected.matchId+'/'+selected.gameId} repository={repository} matchId={selected.matchId} gameId={selected.gameId} players={data.games.find(g=>g.gameId===selected.gameId)?.players??[]} preview={preview} revision={revision+'/'+recordRefresh}/><StatisticsPanel key={selected.matchId+'/'+selected.gameId+'/'+selected.revision} games={[selected]} preview={preview} battle viewerId={snapshot.viewer?.playerId} openMatch={openMatch} openPlayer={openPlayer}/></>:<p className="sx-empty">Upload a recording above to populate this Battle’s statistics.</p>}</>}</section>;
}

export function MatchDialogWithStatistics(props:ViewProps&{data:MatchDetail;onUpdated:()=>void}){return <><MatchDialog {...props}/><hr className="statistics-divider"/><BattleStatisticsExperience {...props}/></>;}

export function EventDialogWithStatistics(props:ViewProps&{data:EventDetail;onUpdated:()=>void}){
  const state=useStatistics(props.repository,{eventId:props.data.event.eventId});
  const engine=new StatisticsExperience(state.dataset?.games??[]),highlights=state.dataset?.unavailableGames?[]:engine.highlights(4);
  return <><EventDialog {...props}/><hr className="statistics-divider"/><section className="sx-dashboard"><span className="eyebrow">EVENT STATISTICS</span><h2>What remains of this campaign</h2><LoadState {...state}/>{state.dataset&&<><EvidenceNotice preview={props.preview} unavailable={state.dataset.unavailableGames}/><p>{engine.games.length} eligible Games · {new Set(engine.games.map(g=>g.matchId)).size} Battles</p>{highlights.length?<HighlightCards items={highlights} openMatch={props.openMatch}/>:<p>No qualified distinctions yet. Highlights appear when the evidence supports a distinction.</p>}<div className="sx-source-list">{[...new Set(engine.games.map(g=>g.matchId))].map(id=><button key={id} onClick={()=>props.openMatch(id)}>Battle {id}<ArrowRight size={16}/></button>)}</div></>}</section></>;
}

export function SeasonStatisticsView(props:Pick<ViewProps,'snapshot'|'preview'|'repository'|'openPlayer'|'openMatch'>){
  const {snapshot,preview,repository,openPlayer,openMatch}=props;
  const state=useStatistics(repository,{seasonId:snapshot.season?.seasonId??'unavailable'},JSON.stringify(snapshot.matches.map(m=>[m.matchId,m.status,m.result?.revision])));
  const games=state.dataset?.games.filter(g=>g.affectsSeason)??[];
  const engine=new StatisticsExperience(games);
  const changes=state.dataset?.unavailableGames?[]:engine.leadershipChanges();
  const bests=snapshot.viewer&&!state.dataset?.unavailableGames?engine.personalBests(snapshot.viewer.playerId):[];
  return <section className="section statistics-experience sx-dashboard"><LoadState {...state}/>{state.dataset&&<><StatisticsPanel games={games} preview={preview} viewerId={snapshot.viewer?.playerId} openMatch={openMatch} openPlayer={openPlayer} unavailableGames={state.dataset.unavailableGames} standings={snapshot.standings} onRefresh={state.retry}/>{bests.length>0&&<details className="sx-personal"><summary>Your new personal bests · visible only to you</summary>{bests.map(r=><button key={r.metricId} onClick={()=>openMatch(r.matchId)}>{definition(r.metricId).label}: {formatStatistic(r.value,definition(r.metricId))} →</button>)}</details>}{changes.length>0&&<HighlightCards items={changes.slice(0,2)} openMatch={openMatch}/>}</>}</section>;
}
