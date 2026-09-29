import {useEffect,useMemo,useRef,useState,type Ref} from 'react';
import {ArrowRight,Crown,RefreshCw,X} from 'lucide-react';
import type {Category,GameStatistics,StatisticsDataset} from '../domain/statistics';
import {SEASON_CATEGORIES,SeasonStatisticsExperience,formatSeasonRecord,formatSeasonValue,seasonMetricEligible,seasonMetricsFor,type SeasonAggregatePlayer,type SeasonMetricDefinition} from '../domain/seasonStatistics';
import {formatName,type PlayerRecord} from '../domain/league';
import type {ViewProps} from './App';

const categoryHelp:Record<Category,string>={
  Opening:'How players start: execution, early economy, walls, scouting and first military choices.',
  Economy:'Per-Game economic production, expansion, technology, market and team-resource activity.',
  Military:'Per-Game military production and engagements. Great Battles alone remain a cumulative Season total.',
  'Map Presence':'Command and placement geometry, expansion, relic interaction and inferred resource control.',
  Execution:'Command activity, inactivity and response behavior. These are descriptive inputs, not a skill score.'
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

function useSeasonStatistics(repository:ViewProps['repository'],seasonId:string,revision:string){
  const [dataset,setDataset]=useState<StatisticsDataset|null>(null),[error,setError]=useState(''),[reload,setReload]=useState(0);
  useEffect(()=>{
    let current=true;setDataset(null);setError('');
    repository.statisticsExperience({seasonId}).then(data=>{if(current)setDataset(data);}).catch(error=>{if(current)setError(error instanceof Error?error.message:'Statistics could not be loaded.');});
    return()=>{current=false;};
  },[repository,seasonId,revision,reload]);
  return {dataset,error,retry:()=>setReload(value=>value+1)};
}

function CategoryRail({category,onChange}:{category:Category;onChange:(category:Category)=>void}){
  return <nav className="sx-tabs" aria-label="Statistics categories">{SEASON_CATEGORIES.map(item=><button key={item} aria-pressed={item===category} onClick={()=>onChange(item)}>{item}</button>)}</nav>;
}

interface SeasonColumn {playerId:string;name:string;rank?:number;row:SeasonAggregatePlayer|null;standing:PlayerRecord|null;emperor:boolean;}
function seasonColumns(rows:SeasonAggregatePlayer[],standings:PlayerRecord[],emperor:PlayerRecord|null){
  const byId=new Map(rows.map(row=>[row.playerId,row] as const)),emperorId=emperor?.playerId??null;
  const ranked:SeasonColumn[]=standings.filter(player=>player.playerId!==emperorId).map(player=>({playerId:player.playerId,name:byId.get(player.playerId)?.name??player.steamName,rank:player.rank,row:byId.get(player.playerId)??null,standing:player,emperor:false})).reverse();
  const seen=new Set(standings.map(player=>player.playerId));if(emperorId)seen.add(emperorId);
  const extras=rows.filter(row=>!seen.has(row.playerId)).sort((a,b)=>a.name.localeCompare(b.name)).map(row=>({playerId:row.playerId,name:row.name,row,standing:null,emperor:false}));
  const emperorColumn:SeasonColumn|null=emperor?{playerId:emperor.playerId,name:byId.get(emperor.playerId)?.name??emperor.steamName,row:byId.get(emperor.playerId)??null,standing:emperor,emperor:true}:null;
  return {emperorColumn,scrolling:[...extras,...ranked]};
}

function gameMetricValue(game:GameStatistics,playerId:string,metric:SeasonMetricDefinition){
  const player=game.players.find(player=>player.playerId===playerId);if(!player)return null;
  if(metric.kind==='category'){
    const text=(player as typeof player&{seasonText?:Record<string,string|null>}).seasonText?.[metric.id]??null;
    return {player,text,value:null};
  }
  return {player,text:null,value:player.values[metric.id]??null};
}

function EvidencePanel({selection,games,close,openMatch}:{selection:{playerId:string;metric:SeasonMetricDefinition};games:GameStatistics[];close:()=>void;openMatch:(id:string)=>void}){
  const {playerId,metric}=selection;
  const samples=games.flatMap(game=>{const result=gameMetricValue(game,playerId,metric);return result?[{game,...result}]:[];});
  const name=samples.at(-1)?.player.name??playerId;
  const eligible=samples.filter(({game,player})=>seasonMetricEligible(metric,game,player));
  const contributes=eligible.filter(sample=>metric.kind==='category'?!!sample.text:sample.value!==null);
  return <section className="sx-inspector sx-season-evidence" aria-label="Statistic evidence" aria-live="polite">
    <div className="sx-heading"><h3>{name} · {metric.label}</h3><button onClick={close} aria-label="Close evidence"><X size={18}/></button></div>
    <p>{contributes.length} of {eligible.length} eligible Games contribute{metric.eligibility==='team'?' · Team eligibility requires a same-team ally.':''}</p>
    <div className="sx-source-list">{samples.map(({game,player,text,value})=>{
      const isEligible=seasonMetricEligible(metric,game,player),display=metric.kind==='category'?(text??'—'):formatSeasonValue({value,text:null,sharePercent:null,samples:1,eligibleGames:1,models:[]},metric);
      return <button key={game.matchId+game.gameId} onClick={()=>openMatch(game.matchId)}><span>{game.matchId} / {game.gameId}<small>{player.civilization??'Civilization unavailable'} · {new Date(game.orderAtMs).toLocaleDateString()}</small></span><strong>{display}</strong><small>{!isEligible?'Not eligible for this Season metric':metric.kind==='category'?!text?(player.unavailable[metric.id]??'Not observed'):'Accepted':value===null?(player.unavailable[metric.id]??'Not observed'):'Accepted'}</small><ArrowRight size={14}/></button>;
    })}</div>
  </section>;
}

function PlayerHeader({column,viewerId,openPlayer,viewerRef}:{column:SeasonColumn;viewerId?:string;openPlayer:(id:string)=>void;viewerRef?:Ref<HTMLTableCellElement>}){
  const isViewer=column.playerId===viewerId,detail=column.row?`${column.row.games} ${column.row.games===1?'Game':'Games'}`:'No statistics in selection';
  return <th ref={viewerRef} scope="col" className={`sx-player-head${isViewer?' sx-player-focus':''}${column.emperor?' sx-emperor-head':''}`}><span className="sx-player-marker">{column.emperor?<><Crown size={12}/> Emperor</>:<>{isViewer?'YOU · ':''}{column.rank?`#${column.rank}`:'UNRANKED'}</>}</span><button className="sx-player-name" onClick={()=>openPlayer(column.playerId)}>{column.name}</button><small>{detail}</small></th>;
}
function EmptyValue(){return <span className="sx-value-empty"><strong>—</strong><small>No data in selection</small></span>;}
function MetricCell({column,metric,leader,select}:{column:SeasonColumn;metric:SeasonMetricDefinition;leader:boolean;select:(playerId:string,metric:SeasonMetricDefinition)=>void}){
  const value=column.row?.values[metric.id],classes=[leader?'sx-leading':'',column.emperor?' sx-emperor-cell':''].filter(Boolean).join(' ');
  if(!value||(metric.kind==='category'?value.text===null:value.value===null))return <td className={classes}><EmptyValue/></td>;
  const formatted=formatSeasonValue(value,metric);
  return <td className={classes}><button className="sx-value-button" aria-label={`${column.name}, ${metric.label}: ${formatted}${leader?', season lead':''}. View evidence.`} onClick={()=>select(column.playerId,metric)}><span className="sx-value-main">{formatted}</span>{leader&&<span className="sx-lead-note">Season lead</span>}{value.samples!==value.eligibleGames&&<small>{value.samples}/{value.eligibleGames} eligible Games</small>}{value.models.length>1&&<small>Mixed models</small>}</button></td>;
}

function HallTable({rows,metrics,engine,allowLeaders,viewerId,standings,emperor,select,openPlayer}:{rows:SeasonAggregatePlayer[];metrics:SeasonMetricDefinition[];engine:SeasonStatisticsExperience;allowLeaders:boolean;viewerId?:string;standings:PlayerRecord[];emperor:PlayerRecord|null;select:(playerId:string,metric:SeasonMetricDefinition)=>void;openPlayer:(id:string)=>void}){
  const leaders=Object.fromEntries(metrics.map(metric=>[metric.id,allowLeaders?engine.leaders(metric.id,5):[]])),{emperorColumn,scrolling}=seasonColumns(rows,standings,emperor);
  const scroller=useRef<HTMLDivElement>(null),viewerHeader=useRef<HTMLTableCellElement>(null),allColumns=emperorColumn?[emperorColumn,...scrolling]:scrolling,columnKey=allColumns.map(column=>column.playerId).join('|');
  useEffect(()=>{const container=scroller.current,cell=viewerHeader.current;if(!container||!cell)return;const frozen=emperorColumn?450:230,visible=Math.max(200,container.clientWidth-frozen);container.scrollLeft=Math.max(0,cell.offsetLeft-frozen-visible/2+cell.clientWidth/2);},[viewerId,columnKey,emperorColumn?.playerId]);
  return <div ref={scroller} className="sx-table-scroll sx-season-scroll sx-hall-v2-scroll"><table className="sx-table sx-season-table sx-hall-v2-table"><thead><tr><th scope="col" className="sx-metric-column"><span>Statistic</span></th>{allColumns.map(column=><PlayerHeader key={column.playerId} column={column} viewerId={viewerId} openPlayer={openPlayer} viewerRef={column.playerId===viewerId?viewerHeader:undefined}/>)}</tr></thead><tbody>{metrics.map(metric=><tr key={metric.id}><th scope="row"><span className="sx-metric-title">{metric.label}</span><small>{metric.hint}</small></th>{allColumns.map(column=><MetricCell key={column.playerId} column={column} metric={metric} leader={leaders[metric.id].includes(column.playerId)} select={select}/>)}</tr>)}</tbody></table></div>;
}

function RecordBook({engine,category,openMatch}:{engine:SeasonStatisticsExperience;category:Category;openMatch:(id:string)=>void}){
  const metrics=seasonMetricsFor(category),records=engine.records().filter(record=>metrics.some(metric=>metric.id===record.metricId));
  return <section className="sx-records sx-record-gallery"><span className="eyebrow">SINGLE-GAME RECORDS</span><h3>{category} record book</h3><p>Only statistics in the Season catalogue appear here. Records retain the source Battle, settings and model version.</p>{records.length?<div className="sx-record-grid">{records.map(record=>{const metric=metrics.find(metric=>metric.id===record.metricId)!;return <button key={record.metricId+record.contextKey+record.model+record.playerId} onClick={()=>openMatch(record.matchId)}><span>{metric.record==='min'?'Earliest / Lowest':'Most / Highest'} · {metric.label}</span><strong>{formatSeasonRecord(record.value,metric)}</strong><b>{record.name}</b><small>{record.civilization??'Civilization unavailable'} · {new Date(record.orderAtMs).toLocaleDateString()}</small><small>{contextLabel(record.contextKey)}</small><small>{record.matchId} / {record.gameId} · {record.model}</small><span>Source Battle →</span></button>;})}</div>:<p>No qualified records for this selection yet.</p>}</section>;
}

export function SeasonStatisticsView(props:Pick<ViewProps,'snapshot'|'preview'|'repository'|'openPlayer'|'openMatch'>){
  const {snapshot,preview,repository,openPlayer,openMatch}=props,revision=JSON.stringify(snapshot.matches.map(match=>[match.matchId,match.status,match.result?.revision]));
  const state=useSeasonStatistics(repository,snapshot.season?.seasonId??'unavailable',revision);
  const [category,setCategory]=useState<Category>(()=>{try{const stored=localStorage.getItem('aof-statistics-category');return SEASON_CATEGORIES.includes(stored as Category)?stored as Category:'Opening';}catch{return 'Opening';}}),[format,setFormat]=useState('all'),[context,setContext]=useState('all'),[inspect,setInspect]=useState<{playerId:string;metric:SeasonMetricDefinition}|null>(null);
  const games=state.dataset?.games.filter(game=>game.affectsSeason)??[],filtered=games.filter(game=>(format==='all'||game.format===format)&&(context==='all'||game.contextKey===context)),engine=useMemo(()=>new SeasonStatisticsExperience(filtered),[filtered]),rows=engine.aggregate(),metrics=seasonMetricsFor(category);
  const changeCategory=(next:Category)=>{setCategory(next);setInspect(null);try{localStorage.setItem('aof-statistics-category',next);}catch{/* optional */}},comparisonOptions=[...new Set(games.filter(game=>format==='all'||game.format===format).map(game=>game.contextKey))];
  if(state.error)return <section className="section statistics-experience sx-dashboard"><div className="alert" role="alert"><span>{state.error}</span><button onClick={state.retry}>Retry</button></div></section>;
  if(!state.dataset)return <section className="section statistics-experience sx-dashboard"><p role="status">Reading the battle ledger…</p></section>;
  return <section className="section statistics-experience sx-dashboard sx-season-hall-v2"><div className="sx-panel">
    <CategoryRail category={category} onChange={changeCategory}/>
    <div className="sx-toolbar" role="group" aria-label="Statistics filters"><label><span>Format</span><select value={format} onChange={event=>{setFormat(event.target.value);setContext('all');setInspect(null);}}><option value="all">All formats</option>{[...new Set(games.map(game=>game.format))].sort().map(item=><option key={item} value={item}>{formatName(item)}</option>)}</select></label><span className="sx-toolbar-rule" aria-hidden="true"/><label><span>Comparison</span><select value={context} onChange={event=>{setContext(event.target.value);setInspect(null);}}><option value="all">All approved settings</option>{comparisonOptions.map(item=><option key={item} value={item}>{contextLabel(item)}</option>)}</select></label><span className="sx-toolbar-meta">{engine.games.length} eligible Games{games.filter(game=>!game.eligible).length>0&&<> · {games.filter(game=>!game.eligible).length} pending / disputed</>}</span><button className="sx-refresh" aria-label="Refresh season statistics" onClick={state.retry}><RefreshCw size={15}/></button></div>
    {inspect&&<EvidencePanel selection={inspect} games={engine.games} close={()=>setInspect(null)} openMatch={openMatch}/>} 
    <section className="sx-ledger" aria-label={`${category} statistics`}><div className="sx-ledger-intro"><p>{categoryHelp[category]}</p></div><HallTable rows={rows} metrics={metrics} engine={engine} allowLeaders={state.dataset.unavailableGames===0} viewerId={snapshot.viewer?.playerId} standings={snapshot.standings} emperor={snapshot.emperor} select={(playerId,metric)=>setInspect({playerId,metric})} openPlayer={openPlayer}/><details className="sx-provenance"><summary>Measurement provenance</summary><p className="sx-legend">{preview&&<strong>Illustrative preview · </strong>}Counts and percentages compare players per eligible Game; timings use the median; categorical rows show the most common result and its share. Great Battles is the only cumulative Season sum. Queue, research and placement evidence retains its replay-model limitations. N/A never becomes zero.{state.dataset.unavailableGames>0&&<> {state.dataset.unavailableGames} completed {state.dataset.unavailableGames===1?'Game is':'Games are'} awaiting usable statistics.</>}</p></details></section>
    {state.dataset.unavailableGames===0&&<RecordBook engine={engine} category={category} openMatch={openMatch}/>} 
  </div></section>;
}
