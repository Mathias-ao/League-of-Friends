import {useEffect,useMemo,useRef,useState,type Ref} from 'react';
import {ArrowRight,Crown,RefreshCw,X} from 'lucide-react';
import {CATEGORIES,METRICS,StatisticsExperience,formatStatistic,metricEligible,type AggregatePlayer,type AggregationMode,type Category,type GameStatistics,type Highlight,type MetricDefinition,type StatisticsDataset} from '../domain/statistics';
import {formatName,type PlayerRecord} from '../domain/league';
import type {ViewProps} from './App';
import {CompositionBars} from './StatisticsDashboardLegacy';

const definition=(id:string)=>METRICS.find(metric=>metric.id===id)!;
const categoryHelp:Record<Category,string>={
  Opening:'Typical early-game timings and activity. Villagers @10 and camp timings come from Economy evidence; early commands and Dark Age gaps come from Execution evidence without duplicating those calculations.',
  Economy:'Resource commitment plus recurring economy activity. Trade and Tribute compare only eligible team Games; queue and placement measurements do not claim completed units or buildings.',
  Military:'Detected interactions and requested production. Military technologies are distinct research requests, so cancelled or repeated clicks do not inflate the count.',
  'Map Presence':'Command and placement geometry; not explored terrain or territory owned. Enemy-base contact is command contact, and expansion TCs are placement evidence.',
  Execution:'Command activity and inferred response timing. These are descriptive measurements, not a skill score.'
};
const groupIds:Record<Category,string[]>={
  Opening:['feudal','castle','imperial','villagers10','commands5','darkAgeGap','firstLumberCamp','firstMiningCamp'],
  Economy:['food','wood','gold','stone','total','housesBuilt','tradeUnits','tributeSent','tributeReceived'],
  Military:['militaryTechs','raidsOut','raidsIn','skirmishes','skirmishTime','assistsOut','assistsIn','cooperation','militaryCommitment'],
  'Map Presence':['scouting','contact','expansionTCs','expansions','forward','forwardEco','walls'],
  Execution:['apm','combatApm','response','responded','received']
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
    let current=true;
    setDataset(null);setError('');
    repository.statisticsExperience({seasonId}).then(data=>{if(current)setDataset(data);}).catch(error=>{if(current)setError(error instanceof Error?error.message:'Statistics could not be loaded.');});
    return()=>{current=false;};
  },[repository,seasonId,revision,reload]);
  return {dataset,error,retry:()=>setReload(value=>value+1)};
}

function CategoryRail({category,onChange}:{category:Category;onChange:(category:Category)=>void}){
  return <nav className="sx-tabs" aria-label="Statistics categories">{CATEGORIES.map(item=><button key={item} aria-pressed={item===category} onClick={()=>onChange(item)}>{item}</button>)}</nav>;
}

interface SeasonColumn {
  playerId:string;
  name:string;
  rank?:number;
  row:AggregatePlayer|null;
  standing:PlayerRecord|null;
  emperor:boolean;
}

function seasonColumns(rows:AggregatePlayer[],standings:PlayerRecord[],emperor:PlayerRecord|null){
  const byId=new Map(rows.map(row=>[row.playerId,row] as const));
  const emperorId=emperor?.playerId??null;
  const ranked:SeasonColumn[]=standings
    .filter(player=>player.playerId!==emperorId)
    .map(player=>({playerId:player.playerId,name:byId.get(player.playerId)?.name??player.steamName,rank:player.rank,row:byId.get(player.playerId)??null,standing:player,emperor:false}))
    .reverse();
  const seen=new Set(standings.map(player=>player.playerId));
  if(emperorId)seen.add(emperorId);
  const extras:SeasonColumn[]=rows.filter(row=>!seen.has(row.playerId)).sort((a,b)=>a.name.localeCompare(b.name)).map(row=>({playerId:row.playerId,name:row.name,row,standing:null,emperor:false}));
  const emperorColumn:SeasonColumn|null=emperor?{playerId:emperor.playerId,name:byId.get(emperor.playerId)?.name??emperor.steamName,row:byId.get(emperor.playerId)??null,standing:emperor,emperor:true}:null;
  return {emperorColumn,scrolling:[...extras,...ranked]};
}

function EvidencePanel({selection,games,close,openMatch}:{selection:{playerId:string;metricId:string};games:GameStatistics[];close:()=>void;openMatch:(id:string)=>void}){
  const metric=definition(selection.metricId);
  const samples=games.flatMap(game=>game.players.filter(player=>player.playerId===selection.playerId).map(player=>({game,player})));
  const eligible=samples.filter(({game,player})=>metricEligible(metric,game,player));
  const contributing=eligible.filter(({player})=>player.values[metric.id]!==null);
  const name=samples.at(-1)?.player.name??selection.playerId;
  return <section className="sx-inspector sx-season-evidence" aria-label="Statistic evidence" aria-live="polite">
    <div className="sx-heading"><h3>{name} · {metric.label}</h3><button onClick={close} aria-label="Close evidence"><X size={18}/></button></div>
    <p>{contributing.length} of {eligible.length} eligible Games contribute to this measurement.{metric.eligibility==='team'&&<> Team eligibility requires a same-team ally in that Game.</>}</p>
    <div className="sx-source-list">{samples.map(({game,player})=>{
      const isEligible=metricEligible(metric,game,player);
      const status=!isEligible?'Not eligible for this Season metric':player.values[metric.id]===null?player.unavailable[metric.id]:game.eligible?'Accepted':'Pending / disputed';
      return <button key={game.matchId+game.gameId} onClick={()=>openMatch(game.matchId)}><span>{game.matchId} / {game.gameId}<small>{player.civilization??'Civilization unavailable'} · {new Date(game.orderAtMs).toLocaleDateString()}</small></span><strong>{isEligible?formatStatistic(player.values[metric.id],metric):'—'}</strong><small>{status}</small><ArrowRight size={14}/></button>;
    })}</div>
    {!samples.length&&<p>No replay statistics are available for this player in the current selection.</p>}
  </section>;
}

function PlayerHeader({column,viewerId,openPlayer,viewerRef}:{column:SeasonColumn;viewerId?:string;openPlayer:(id:string)=>void;viewerRef?:Ref<HTMLTableCellElement>}){
  const isViewer=column.playerId===viewerId;
  const detail=column.row?`${column.row.games} ${column.row.games===1?'Game':'Games'}`:'No statistics in selection';
  return <th ref={viewerRef} scope="col" className={`sx-player-head${isViewer?' sx-player-focus':''}${column.emperor?' sx-emperor-head':''}`}>
    <span className="sx-player-marker">{column.emperor?<><Crown size={12}/> Emperor</>:<>{isViewer?'YOU · ':''}{column.rank?`#${column.rank}`:'UNRANKED'}</>}</span>
    <button className="sx-player-name" onClick={()=>openPlayer(column.playerId)}>{column.name}</button>
    <small>{detail}{column.emperor&&column.standing?.leaguePoints!=null?` · ${column.standing.leaguePoints} pts`:''}</small>
  </th>;
}

function EmptyValue({note='No data in selection'}:{note?:string}){return <span className="sx-value-empty"><strong>—</strong><small>{note}</small></span>;}

function OpeningCell({column,select}:{column:SeasonColumn;select:(playerId:string,metricId:string)=>void}){
  if(!column.row?.opening)return <td className={column.emperor?'sx-emperor-cell':''}><EmptyValue/></td>;
  return <td className={`sx-text-value${column.emperor?' sx-emperor-cell':''}`}><button className="sx-value-button" onClick={()=>select(column.playerId,'feudal')}><span className="sx-value-main">{column.row.opening}</span><small>View timing evidence</small></button></td>;
}

function MetricCell({column,metric,leader,select}:{column:SeasonColumn;metric:MetricDefinition;leader:boolean;select:(playerId:string,metricId:string)=>void}){
  const value=column.row?.values[metric.id];
  const classes=[leader?'sx-leading':'',column.emperor?'sx-emperor-cell':''].filter(Boolean).join(' ');
  if(!value||value.value===null)return <td className={classes}><EmptyValue note={value?.eligibleGames===0?'No eligible Games':'No data in eligible Games'}/></td>;
  const partial=value.samples!==value.eligibleGames||value.eligibleGames!==column.row?.games;
  return <td className={classes}><button className="sx-value-button" aria-label={`${column.name}, ${metric.label}: ${formatStatistic(value.value,metric)}${leader?', season lead':''}. View evidence.`} onClick={()=>select(column.playerId,metric.id)}><span className="sx-value-main">{formatStatistic(value.value,metric)}</span>{leader&&<span className="sx-lead-note">Season lead</span>}{partial&&<small>{value.samples}/{value.eligibleGames} eligible Games</small>}{value.models.length>1&&<small>Mixed models</small>}</button></td>;
}

function metricNote(metric:MetricDefinition){
  if(metric.eligibility==='team')return 'Team Games only · mean per eligible Game';
  if(metric.aggregation==='mean')return 'Mean per Game';
  if(metric.leader==='min')return 'Lower establishes the lead';
  if(metric.leader==='max')return 'Higher establishes the lead';
  return 'Descriptive measurement';
}

function HallTable({rows,metrics,engine,mode,allowLeaders,viewerId,standings,emperor,showOpening,select,openPlayer}:{rows:AggregatePlayer[];metrics:MetricDefinition[];engine:StatisticsExperience;mode:AggregationMode;allowLeaders:boolean;viewerId?:string;standings:PlayerRecord[];emperor:PlayerRecord|null;showOpening:boolean;select:(playerId:string,metricId:string)=>void;openPlayer:(id:string)=>void}){
  const leaders=Object.fromEntries(metrics.map(metric=>[metric.id,allowLeaders?engine.leaders(metric.id,mode,5):[]]));
  const {emperorColumn,scrolling}=seasonColumns(rows,standings,emperor);
  const scroller=useRef<HTMLDivElement>(null),viewerHeader=useRef<HTMLTableCellElement>(null);
  const columnKey=[emperorColumn?.playerId??'',...scrolling.map(column=>column.playerId)].join('|');
  useEffect(()=>{
    const container=scroller.current,cell=viewerHeader.current;if(!container||!cell)return;
    const frozen=emperorColumn?450:230;
    const visible=Math.max(200,container.clientWidth-frozen);
    container.scrollLeft=Math.max(0,cell.offsetLeft-frozen-visible/2+cell.clientWidth/2);
  },[viewerId,columnKey,emperorColumn?.playerId]);
  const allColumns=emperorColumn?[emperorColumn,...scrolling]:scrolling;
  return <div ref={scroller} className="sx-table-scroll sx-season-scroll sx-hall-v2-scroll"><table className="sx-table sx-season-table sx-hall-v2-table">
    <thead><tr><th scope="col" className="sx-metric-column"><span>Statistic</span></th>{allColumns.map(column=><PlayerHeader key={column.playerId} column={column} viewerId={viewerId} openPlayer={openPlayer} viewerRef={column.playerId===viewerId?viewerHeader:undefined}/>)}</tr></thead>
    <tbody>
      {showOpening&&<tr><th scope="row"><span className="sx-metric-title">Usual opening</span><small>Most common classified opening</small></th>{allColumns.map(column=><OpeningCell key={column.playerId} column={column} select={select}/>)}</tr>}
      {metrics.map(metric=><tr key={metric.id}><th scope="row"><span className="sx-metric-title">{metric.label}</span><small>{metricNote(metric)}</small></th>{allColumns.map(column=><MetricCell key={column.playerId} column={column} metric={metric} leader={leaders[metric.id].includes(column.playerId)} select={select}/>)}</tr>)}
    </tbody>
  </table></div>;
}

function RecordBook({engine,category,openMatch}:{engine:StatisticsExperience;category:Category;openMatch:(id:string)=>void}){
  const records=engine.records().filter(record=>definition(record.metricId).category===category);
  return <section className="sx-records sx-record-gallery"><span className="eyebrow">SINGLE-GAME RECORDS</span><h3>{category} record book</h3><p>Records compare available measurements within matching approved settings and model versions. Ties share recognition.</p>{records.length?<div className="sx-record-grid">{records.map(record=><button key={record.metricId+record.contextKey+record.model+record.playerId} onClick={()=>openMatch(record.matchId)}><span>{definition(record.metricId).record==='min'?'Earliest':'Most'} · {definition(record.metricId).label}</span><strong>{formatStatistic(record.value,definition(record.metricId))}</strong><b>{record.name}</b><small>{record.civilization??'Civilization unavailable'} · {new Date(record.orderAtMs).toLocaleDateString()}</small><small>{contextLabel(record.contextKey)}</small><small>{record.matchId} / {record.gameId} · {record.model}</small><span>Source Battle →</span></button>)}</div>:<p>No qualified records for this selection yet.</p>}</section>;
}

function HighlightCards({items,openMatch}:{items:Highlight[];openMatch:(id:string)=>void}){
  return <div className="sx-highlights">{items.map(item=><article key={item.id}><span className="eyebrow">{item.category}</span><h3>{item.title}</h3><p>{item.detail}</p><button className="text-button" onClick={()=>openMatch(item.matchId)}>Source Battle <ArrowRight size={14}/></button></article>)}</div>;
}

export function SeasonStatisticsView(props:Pick<ViewProps,'snapshot'|'preview'|'repository'|'openPlayer'|'openMatch'>){
  const {snapshot,preview,repository,openPlayer,openMatch}=props;
  const revision=JSON.stringify(snapshot.matches.map(match=>[match.matchId,match.status,match.result?.revision]));
  const state=useSeasonStatistics(repository,snapshot.season?.seasonId??'unavailable',revision);
  const [category,setCategory]=useState<Category>(()=>{try{const stored=localStorage.getItem('aof-statistics-category');return CATEGORIES.includes(stored as Category)?stored as Category:'Opening';}catch{return 'Opening';}});
  const [format,setFormat]=useState('all'),[context,setContext]=useState('all'),[mode,setMode]=useState<AggregationMode>('total'),[inspect,setInspect]=useState<{playerId:string;metricId:string}|null>(null);
  const games=state.dataset?.games.filter(game=>game.affectsSeason)??[];
  const filtered=games.filter(game=>(format==='all'||game.format===format)&&(context==='all'||game.contextKey===context));
  const engine=useMemo(()=>new StatisticsExperience(filtered),[filtered]);
  const rows=engine.aggregate(mode);
  const overall=useMemo(()=>new StatisticsExperience(games),[games]);
  const changes=state.dataset?.unavailableGames?[]:overall.leadershipChanges();
  const bests=snapshot.viewer&&!state.dataset?.unavailableGames?overall.personalBests(snapshot.viewer.playerId):[];
  const metrics=groupIds[category].map(definition);
  const changeCategory=(next:Category)=>{setCategory(next);setInspect(null);try{localStorage.setItem('aof-statistics-category',next);}catch{/* Storage is optional. */}};
  const comparisonOptions=[...new Set(games.filter(game=>format==='all'||game.format===format).map(game=>game.contextKey))];
  const provenance=`Measurements retain their recorded, reconstructed, or inferred meaning. ${category==='Opening'?'Early showcase rows reuse their owning Economy/Execution measurements; age/camp timings are summarized across Games.':category==='Economy'?'House values are placements; Trade values are queue requests; Tribute is decoded sent/received resource amount. Team-only rows divide by eligible team Games, not all Games.':category==='Map Presence'?'Counts are per-Game means; scouting coverage and enemy-base contact are medians. Contact is a command-position proxy.':category==='Military'?'Military Techs count distinct qualifying research requests; repeated/cancelled requests do not increase the distinct count.':category==='Execution'?'APM is the median across Games. Response latency pools detected responses; opportunity counts stay totals.':mode==='average'?'Per Game is the mean across available Games.':'Counts and commitment are season totals.'} Timing and per-Game distinctions require five samples per player with matching settings before a season lead is declared.`;
  if(state.error)return <section className="section statistics-experience sx-dashboard"><div className="alert" role="alert"><span>{state.error}</span><button onClick={state.retry}>Retry</button></div></section>;
  if(!state.dataset)return <section className="section statistics-experience sx-dashboard"><p role="status">Reading the battle ledger…</p></section>;
  return <section className="section statistics-experience sx-dashboard sx-season-hall-v2">
    <div className="sx-panel">
      <CategoryRail category={category} onChange={changeCategory}/>
      <div className="sx-toolbar" role="group" aria-label="Statistics filters"><label><span>Format</span><select value={format} onChange={event=>{setFormat(event.target.value);setContext('all');setInspect(null);}}><option value="all">All formats</option>{[...new Set(games.map(game=>game.format))].sort().map(item=><option key={item} value={item}>{formatName(item)}</option>)}</select></label><span className="sx-toolbar-rule" aria-hidden="true"/><label><span>Comparison</span><select value={context} onChange={event=>{setContext(event.target.value);setInspect(null);}}><option value="all">All approved settings</option>{comparisonOptions.map(item=><option key={item} value={item}>{contextLabel(item)}</option>)}</select></label><span className="sx-toolbar-meta">{engine.games.length} eligible Games{games.filter(game=>!game.eligible).length>0&&<> · {games.filter(game=>!game.eligible).length} pending / disputed</>}</span><button className="sx-refresh" aria-label="Refresh season statistics" onClick={state.retry}><RefreshCw size={15}/></button></div>
      {inspect&&<EvidencePanel selection={inspect} games={engine.games} close={()=>setInspect(null)} openMatch={openMatch}/>}      
      <section className="sx-ledger" aria-label={`${category} statistics`}>
        <div className="sx-ledger-intro"><p>{categoryHelp[category]}</p>{['Economy','Military'].includes(category)&&<div className="sx-toggle" aria-label="Aggregation"><button aria-pressed={mode==='total'} onClick={()=>setMode('total')}>Total</button><button aria-pressed={mode==='average'} onClick={()=>setMode('average')}>Per Game</button></div>}</div>
        <HallTable rows={rows} metrics={metrics} engine={engine} mode={mode} allowLeaders={state.dataset.unavailableGames===0} viewerId={snapshot.viewer?.playerId} standings={snapshot.standings} emperor={snapshot.emperor} showOpening={category==='Opening'} select={(playerId,metricId)=>setInspect({playerId,metricId})} openPlayer={openPlayer}/>
        {category==='Economy'&&<CompositionBars rows={rows} kind="resources"/>}
        {category==='Military'&&<CompositionBars rows={rows} kind="military"/>}
        <details className="sx-provenance"><summary>Measurement provenance</summary><p className="sx-legend">{preview&&<strong>Illustrative preview · </strong>}{provenance}{state.dataset.unavailableGames>0&&<> {state.dataset.unavailableGames} completed {state.dataset.unavailableGames===1?'Game is':'Games are'} awaiting usable statistics.</>}</p></details>
      </section>
      {state.dataset.unavailableGames===0&&<RecordBook engine={engine} category={category} openMatch={openMatch}/>}      
    </div>
    {bests.length>0&&<details className="sx-personal"><summary>Your new personal bests · visible only to you</summary>{bests.map(record=><button key={record.metricId} onClick={()=>openMatch(record.matchId)}>{definition(record.metricId).label}: {formatStatistic(record.value,definition(record.metricId))} →</button>)}</details>}
    {changes.length>0&&<HighlightCards items={changes.slice(0,2)} openMatch={openMatch}/>}    
  </section>;
}
