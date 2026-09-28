import {useState} from 'react';
import {ArrowRight,BarChart3,BookOpen,Info,Sparkles,Swords,Trophy,Users} from 'lucide-react';
import {formatName,type EventDetail,type MatchDetail,type PlayerRecord} from '../domain/league';
import {EventDialog,MatchDialog} from './Views';
import type {ViewProps} from './App';
import '../statistics-experience-v2.css';

export {ProfileDialogWithIdentity} from './StatisticsExperience';

type StatisticCategory='Overview'|'Opening'|'Economy'|'Military'|'Map Presence'|'Execution';
type DetailCategory=Exclude<StatisticCategory,'Overview'>;
type AggregateMode='total'|'typical';
type SeasonViewMode='players'|'records';

type StatCell={value:string;leader?:boolean;note?:string;muted?:boolean};
type ComparisonRow={id:string;name:string;subtitle?:string;cells:Record<string,StatCell>};
type ComparisonColumn={key:string;label:string;help?:string};

type DisplayPlayer=Pick<PlayerRecord,'playerId'|'steamName'>;

const CATEGORY_TABS:StatisticCategory[]=['Overview','Opening','Economy','Military','Map Presence','Execution'];
const DETAIL_TABS:DetailCategory[]=['Opening','Economy','Military','Map Presence','Execution'];
const FALLBACK_PLAYERS:DisplayPlayer[]=[
  {playerId:'sample-ragnar',steamName:'Ragnar'},
  {playerId:'sample-steve',steamName:'Steve'},
  {playerId:'sample-baguette',steamName:'Lord Baguette'},
  {playerId:'sample-lancelot',steamName:'Sir Lancelot'}
];

const sample={
  resources:['222k','214k','238k','179k','196k','171k'],
  resourcesTypical:['27.8k','26.8k','29.8k','29.8k','24.5k','28.5k'],
  raids:['21','31','19','24','16','11'],
  raidsTypical:['2.6','3.9','2.4','4.0','2.0','1.8'],
  received:['17','12','25','20','14','9'],
  assists:['8','4','11','6','7','3'],
  assistsTypical:['1.0','0.5','1.4','1.0','0.9','0.5'],
  lines:['Knight','Scout','Archer','Spearman','Cavalry Archer','Siege'],
  openings:['Scout Rush · 5/8','Archer Rush · 4/8','Fast Castle · 5/8','Drush · 3/6','Scout Rush · 4/8','Boom · 2/6'],
  feudal:['10:18','10:42','11:03','10:31','10:54','11:12'],
  castle:['23:41','24:06','22:58','25:12','24:21','23:54'],
  imperial:['36:44','38:20','35:51','—','37:08','34:59'],
  qualified:['8 / 8','8 / 8','8 / 8','5 / 6','7 / 8','5 / 6'],
  units:['264','286','251','202','231','188'],
  unitsTypical:['33','36','31','34','29','31'],
  militaryCommitment:['42.8k','46.2k','39.4k','31.7k','37.9k','29.1k'],
  militaryCommitmentTypical:['5.4k','5.8k','4.9k','5.3k','4.7k','4.9k'],
  scout:['15.4%','12.8%','18.9%','10.7%','16.3%','14.1%'],
  expansion:['15','12','19','11','17','10'],
  forward:['18','27','14','21','16','9'],
  contact:['06:44','07:12','08:05','06:31','07:48','09:04'],
  relics:['7','4','11','5','8','3'],
  apm:['47','56','39','44','51','35'],
  response:['0:13','0:17','0:11','0:16','0:14','0:21'],
  responseCoverage:['7 / 8','8 / 9','9 / 10','5 / 6','6 / 7','4 / 5'],
  fightApm:['61','72','52','58','68','46']
};

function value(text:string,leader=false,note?:string,muted=false):StatCell{return {value:text,leader,note,muted};}

function designPlayers(players:DisplayPlayer[]){return players.length?players.slice(0,6):FALLBACK_PLAYERS;}

function DesignDataNotice({preview}:{preview:boolean}){
  return preview?<div className="stats-v2-notice"><Sparkles size={15}/><span><strong>Design preview.</strong> Values are illustrative and isolated from the statistics engine so the comparison experience can be reviewed visually.</span></div>
    :<div className="stats-v2-notice neutral"><Info size={15}/><span>The presentation is ready for persisted Battle Statistics. Unsupported or unavailable measurements remain <strong>N/A</strong> rather than guessed.</span></div>;
}

function CategoryTabs({active,onChange,includeOverview=true}:{active:StatisticCategory;onChange:(category:StatisticCategory)=>void;includeOverview?:boolean}){
  const tabs=includeOverview?CATEGORY_TABS:DETAIL_TABS;
  return <div className="stats-v2-tabs" role="tablist" aria-label="Statistics categories">{tabs.map(tab=><button type="button" key={tab} className={active===tab?'active':''} aria-selected={active===tab} onClick={()=>onChange(tab)}>{tab}</button>)}</div>;
}

function LeaderValue({cell}:{cell:StatCell}){
  return <span className={'stats-v2-cell-value'+(cell.muted?' muted':'')}>{cell.value}{cell.leader&&<span className="stats-v2-star" aria-label="Leader in this comparison">★</span>}{cell.note&&<small>{cell.note}</small>}</span>;
}

function ComparisonTable({columns,rows,openPlayer,caption}:{columns:ComparisonColumn[];rows:ComparisonRow[];openPlayer?:(id:string)=>void;caption:string}){
  return <div className="stats-v2-table-shell"><table className="stats-v2-table"><caption className="sr-only">{caption}</caption><thead><tr><th className="sticky-player">Player</th>{columns.map(column=><th key={column.key} title={column.help}>{column.label}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.id}><th className="sticky-player" scope="row">{openPlayer?<button type="button" onClick={()=>openPlayer(row.id)}>{row.name}<ArrowRight size={12}/></button>:<span>{row.name}</span>}{row.subtitle&&<small>{row.subtitle}</small>}</th>{columns.map(column=><td key={column.key}><LeaderValue cell={row.cells[column.key]??value('N/A',false,undefined,true)}/></td>)}</tr>)}</tbody></table></div>;
}

function seasonOverviewRows(players:DisplayPlayer[],preview:boolean):ComparisonRow[]{
  const games=[8,8,8,6,8,6],wins=[6,5,4,3,4,2];
  return designPlayers(players).map((player,index)=>({
    id:player.playerId,name:player.steamName,
    cells:{
      games:value(preview?String(games[index]??6):'—'),
      wins:value(preview?String(wins[index]??2):'—',preview&&index===0),
      resources:value(preview?sample.resources[index]:'—',preview&&index===2,'estimated commitment'),
      raids:value(preview?sample.raids[index]:'—',preview&&index===1,'detected episodes'),
      assists:value(preview?sample.assists[index]:'—',preview&&index===2,'qualified defensive assists'),
      line:value(preview?sample.lines[index]:'—')
    }
  }));
}

function seasonCategoryTable(players:DisplayPlayer[],category:DetailCategory,mode:AggregateMode,preview:boolean):{columns:ComparisonColumn[];rows:ComparisonRow[];intro:string}{
  const source=designPlayers(players);
  if(category==='Opening')return {
    intro:'Opening shows preferred plans and median qualified timings. Age timing denominators stay visible so missing or unreached ages are not hidden.',
    columns:[{key:'opening',label:'Most common opening'},{key:'feudal',label:'Median Feudal'},{key:'castle',label:'Median Castle'},{key:'imperial',label:'Median Imperial'},{key:'qualified',label:'Qualified Games'}],
    rows:source.map((player,index)=>({id:player.playerId,name:player.steamName,cells:{opening:value(preview?sample.openings[index]:'—'),feudal:value(preview?sample.feudal[index]:'—',preview&&index===0),castle:value(preview?sample.castle[index]:'—',preview&&index===2),imperial:value(preview?sample.imperial[index]:'—'),qualified:value(preview?sample.qualified[index]:'—',false,'timing coverage')}}))
  };
  if(category==='Economy')return {
    intro:mode==='total'?'Totals describe accumulated Season commitment. They are useful history, not an efficiency rating.':'Typical Game uses per-Game medians where the metric supports it; qualified counts remain part of the claim.',
    columns:[{key:'resources',label:mode==='total'?'Resources committed':'Typical resources'},{key:'villagers',label:'Villagers @20'},{key:'idle',label:'Dark Age TC idle'},{key:'eco',label:'Eco upgrades by Castle'},{key:'expansion',label:'Expansion zones'}],
    rows:source.map((player,index)=>({id:player.playerId,name:player.steamName,cells:{resources:value(preview?(mode==='total'?sample.resources[index]:sample.resourcesTypical[index]):'—',preview&&index===2,'estimated commitment'),villagers:value(preview?['54','51','56','50','53','49'][index]:'—'),idle:value(preview?['0:38','0:46','0:31','0:52','0:41','0:57'][index]:'—',preview&&index===2),eco:value(preview?['4','5','4','3','5','3'][index]:'—'),expansion:value(preview?sample.expansion[index]:'—',preview&&index===2)}}))
  };
  if(category==='Military')return {
    intro:mode==='total'?'Military totals combine production requests and qualified interaction episodes across the Season.':'Typical Game compares medians per Game; production requests are not claims about surviving army.',
    columns:[{key:'units',label:mode==='total'?'Units queued':'Typical units queued'},{key:'commitment',label:mode==='total'?'Military commitment':'Typical commitment'},{key:'raids',label:mode==='total'?'Raids initiated':'Typical raids'},{key:'received',label:'Raids received'},{key:'assists',label:mode==='total'?'Defensive assists':'Typical assists'},{key:'line',label:'Main military line'}],
    rows:source.map((player,index)=>({id:player.playerId,name:player.steamName,cells:{units:value(preview?(mode==='total'?sample.units[index]:sample.unitsTypical[index]):'—'),commitment:value(preview?(mode==='total'?sample.militaryCommitment[index]:sample.militaryCommitmentTypical[index]):'—',preview&&index===1,'base-catalog estimate'),raids:value(preview?(mode==='total'?sample.raids[index]:sample.raidsTypical[index]):'—',preview&&index===1),received:value(preview?sample.received[index]:'—'),assists:value(preview?(mode==='total'?sample.assists[index]:sample.assistsTypical[index]):'—',preview&&index===2),line:value(preview?sample.lines[index]:'—')}}))
  };
  if(category==='Map Presence')return {
    intro:'Map Presence describes command and placement geometry. Scout coverage is command-route coverage, not explored fog of war or permanent territory.',
    columns:[{key:'scout',label:'Scout Coverage @5'},{key:'zones',label:'Expansion zones'},{key:'forward',label:'Forward placements'},{key:'contact',label:'Enemy base contact'},{key:'relics',label:'Relic touches'}],
    rows:source.map((player,index)=>({id:player.playerId,name:player.steamName,cells:{scout:value(preview?sample.scout[index]:'—',preview&&index===2,'command coverage'),zones:value(preview?sample.expansion[index]:'—',preview&&index===2),forward:value(preview?sample.forward[index]:'—',preview&&index===1),contact:value(preview?sample.contact[index]:'—',preview&&index===3),relics:value(preview?sample.relics[index]:'—',preview&&index===2)}}))
  };
  return {
    intro:'Execution shows command activity and qualified response timing. APM is intentionally descriptive and does not receive a leader star.',
    columns:[{key:'apm',label:'Raw APM'},{key:'fightApm',label:'APM in Skirmishes'},{key:'response',label:'Median raid response'},{key:'coverage',label:'Response coverage'},{key:'garrisons',label:'Garrisons in raids'}],
    rows:source.map((player,index)=>({id:player.playerId,name:player.steamName,cells:{apm:value(preview?sample.apm[index]:'—'),fightApm:value(preview?sample.fightApm[index]:'—'),response:value(preview?sample.response[index]:'—',preview&&index===2,'inferred timing'),coverage:value(preview?sample.responseCoverage[index]:'—'),garrisons:value(preview?['6','4','8','3','5','2'][index]:'—')}}))
  };
}

function AggregateToggle({mode,onChange}:{mode:AggregateMode;onChange:(mode:AggregateMode)=>void}){
  return <div className="stats-v2-segmented" aria-label="Aggregation basis"><button type="button" className={mode==='total'?'active':''} onClick={()=>onChange('total')}>Total</button><button type="button" className={mode==='typical'?'active':''} onClick={()=>onChange('typical')}>Typical Game</button></div>;
}

function CompositionBars({players,preview}:{players:DisplayPlayer[];preview:boolean}){
  const shares=[[54,28,12,6],[48,37,8,7],[18,61,13,8],[22,19,49,10]];
  const labels=['Cavalry','Archers','Infantry','Other'];
  return <section className="stats-v2-visual"><div className="stats-v2-visual-heading"><div><span className="eyebrow">COMPOSITION</span><h3>Military queue share</h3></div><p>Shares use classified military queue requests. Unknown or other classifications stay visible.</p></div><div className="stats-v2-composition">{designPlayers(players).slice(0,4).map((player,index)=><div className="stats-v2-composition-row" key={player.playerId}><strong>{player.steamName}</strong><div className="stats-v2-composition-bar" aria-label={`${player.steamName} military composition`}>{labels.map((label,part)=><span key={label} style={{width:`${preview?shares[index][part]:25}%`}} title={`${label}: ${preview?shares[index][part]:'—'}%`}><i>{preview&&shares[index][part]>=18?`${label} ${shares[index][part]}%`:''}</i></span>)}</div></div>)}</div></section>;
}

function InteractionMatrix({players,preview}:{players:DisplayPlayer[];preview:boolean}){
  const shown=designPlayers(players).slice(0,4);
  const matrix=[[null,7,3,5],[4,null,6,9],[2,5,null,4],[6,3,7,null]];
  return <section className="stats-v2-visual"><div className="stats-v2-visual-heading"><div><span className="eyebrow">DIRECTIONAL INTERACTIONS</span><h3>Detected raids</h3></div><p>Rows initiated; columns received. N/A is used where a relationship is not applicable.</p></div><div className="stats-v2-matrix-shell"><table className="stats-v2-matrix"><thead><tr><th>From \ To</th>{shown.map(player=><th key={player.playerId}>{player.steamName}</th>)}</tr></thead><tbody>{shown.map((rowPlayer,row)=><tr key={rowPlayer.playerId}><th>{rowPlayer.steamName}</th>{shown.map((columnPlayer,column)=><td key={columnPlayer.playerId} className={row===column?'na':''}>{row===column?'N/A':preview?matrix[row][column]:'—'}</td>)}</tr>)}</tbody></table></div></section>;
}

const seasonRecords=[
  ['Fastest Feudal Age','09:44','Ragnar','Battle 07'],
  ['Fastest Castle Age','21:58','Lord Baguette','Battle 03'],
  ['Highest Scout Coverage @5','24.1%','Sir Lancelot','Battle 09'],
  ['Most raids in one Game','7','Steve','Battle 06'],
  ['Most defensive assists','5','Lord Baguette','Battle 10'],
  ['Largest resource commitment','41.2k','Sir Lancelot','Battle 12']
] as const;

function RecordsView({preview,players,openPlayer}:{preview:boolean;players:DisplayPlayer[];openPlayer:(id:string)=>void}){
  const byName=(name:string)=>designPlayers(players).find(player=>player.steamName===name);
  return <section className="stats-v2-record-book"><div className="stats-v2-section-heading"><div><span className="eyebrow">THE RECORD BOOK</span><h2>Qualified single-Game records</h2><p>Records remain distinct from Season totals and typical performance. Each approved record keeps its source Battle.</p></div></div><div className="stats-v2-record-grid">{seasonRecords.map(([label,recordValue,holder,source])=>{const player=byName(holder);return <article key={label}><span>{label}</span><strong>{preview?recordValue:'—'}</strong>{player?<button type="button" onClick={()=>openPlayer(player.playerId)}>{holder}<ArrowRight size={12}/></button>:<small>{holder}</small>}<small>{preview?source:'Source Battle pending'}</small></article>;})}</div></section>;
}

export function SeasonStatisticsView({snapshot,preview,openPlayer}:{snapshot:ViewProps['snapshot'];preview:boolean;openPlayer:(id:string)=>void}){
  const [category,setCategory]=useState<StatisticCategory>('Overview');
  const [mode,setMode]=useState<AggregateMode>('total');
  const [view,setView]=useState<SeasonViewMode>('players');
  const players=designPlayers(snapshot.players);
  const seasonLabel=snapshot.season?.name??'Current Season';
  const overviewColumns:ComparisonColumn[]=[{key:'games',label:'Games'},{key:'wins',label:'Wins'},{key:'resources',label:'Resources committed'},{key:'raids',label:'Raids initiated'},{key:'assists',label:'Defensive assists'},{key:'line',label:'Main military line'}];
  const active=category==='Overview'?null:seasonCategoryTable(players,category,mode,preview);
  return <section className="section statistics-experience stats-v2 season-statistics-v2">
    <header className="stats-v2-hero"><div><span className="eyebrow">SEASON STATISTICS</span><h1>{seasonLabel}</h1><p>Season totals, typical performance and exceptional records tell different stories. This view keeps them separate while using one shared vocabulary across the league.</p></div><div className="stats-v2-hero-meta"><span>{preview?'12 BATTLES · ILLUSTRATIVE':'BATTLE DATA PENDING'}</span><small>Opening · Economy · Military · Map Presence · Execution</small></div></header>
    <DesignDataNotice preview={preview}/>
    <div className="stats-v2-toolbar"><div className="stats-v2-view-switch" aria-label="Season statistics view"><button type="button" className={view==='players'?'active':''} onClick={()=>setView('players')}><Users size={15}/>Players</button><button type="button" className={view==='records'?'active':''} onClick={()=>setView('records')}><BookOpen size={15}/>Records</button></div><div className="stats-v2-season-controls"><span>Season I</span><span>All formats</span></div></div>
    {view==='records'?<RecordsView preview={preview} players={players} openPlayer={openPlayer}/>:<>
      <section className="panel stats-v2-panel"><CategoryTabs active={category} onChange={setCategory}/>{category==='Overview'?<><div className="stats-v2-section-heading compact"><div><span className="eyebrow">OVERVIEW</span><h2>The Season at a glance</h2><p>Outcome, economic scale, aggression, pressure endured, comradeship and military identity without inventing an overall player score.</p></div></div><ComparisonTable columns={overviewColumns} rows={seasonOverviewRows(players,preview)} openPlayer={openPlayer} caption="Season statistical overview"/><p className="stats-v2-footnote">★ marks a leader only where leadership has an understandable meaning. Genuine ties share the mark; all-zero and coverage-sensitive columns do not.</p></>:<><div className="stats-v2-category-heading"><div><span className="eyebrow">{category.toUpperCase()}</span><h2>{category}</h2><p>{active!.intro}</p></div>{(category==='Economy'||category==='Military')&&<AggregateToggle mode={mode} onChange={setMode}/>}</div><ComparisonTable columns={active!.columns} rows={active!.rows} openPlayer={openPlayer} caption={`${category} Season comparison`}/>{category==='Military'&&<div className="stats-v2-visual-grid"><CompositionBars players={players} preview={preview}/><InteractionMatrix players={players} preview={preview}/></div>}</>}</section>
    </>}
  </section>;
}

function battlePlayers(data:MatchDetail):DisplayPlayer[]{return data.match.participants.length?data.match.participants:FALLBACK_PLAYERS;}

function BattleResult({data}:{data:MatchDetail}){
  const winnerIds=new Set(data.match.result?.winningPlayerIds??data.games[0]?.result?.winningPlayerIds??[]);
  const gamePlayers=data.games[0]?.players??[];
  const groups=new Map<string,typeof data.match.participants>();
  data.match.participants.forEach(player=>{const key=player.team!=null?`Alliance ${player.team}`:'Field';groups.set(key,[...(groups.get(key)??[]),player]);});
  return <section className="stats-v2-battle-result"><div className="stats-v2-result-meta"><span className="eyebrow">RESULT</span><strong>{formatName(data.match.format)}</strong><small>{data.games.length>1?`${data.games.length} Games in this Battle`:'One recorded Game'}</small></div><div className="stats-v2-team-grid">{[...groups.entries()].map(([label,players])=><article key={label}><span>{label}</span>{players.map(player=>{const gamePlayer=gamePlayers.find(candidate=>candidate.playerId===player.playerId);return <div className="stats-v2-battle-player" key={player.playerId}><strong>{player.steamName}</strong><small>{gamePlayer?.civilization??'Civilization pending'}</small>{winnerIds.size>0&&<em className={winnerIds.has(player.playerId)?'winner':'defeated'}>{winnerIds.has(player.playerId)?'Victory':'Defeat'}</em>}</div>;})}</article>)}</div></section>;
}

function battleOverviewRows(players:DisplayPlayer[],preview:boolean):ComparisonRow[]{
  return designPlayers(players).map((player,index)=>({id:player.playerId,name:player.steamName,cells:{result:value(preview?(index===0||index===2?'Victory':'Defeat'):'—'),resources:value(preview?['31.4k','29.7k','34.1k','27.9k'][index]??'—':'—',preview&&index===2,'estimated commitment'),raids:value(preview?['4','7','3','5'][index]??'—':'—',preview&&index===1),received:value(preview?['3','2','6','4'][index]??'—':'—'),assists:value(preview?['2','1','3','2'][index]??'—':'—',preview&&index===2),line:value(preview?sample.lines[index]??'—':'—')}}));
}

function BattleTimeline({players,preview}:{players:DisplayPlayer[];preview:boolean}){
  const laneEvents=[
    [{p:22,t:'Feudal'},{p:36,t:'Raid'},{p:50,t:'Castle'},{p:63,t:'Assist'},{p:78,t:'Battle'}],
    [{p:24,t:'Feudal'},{p:32,t:'Raid'},{p:52,t:'Castle'},{p:60,t:'Raid'},{p:78,t:'Battle'}],
    [{p:25,t:'Feudal'},{p:46,t:'Pressure'},{p:48,t:'Castle'},{p:63,t:'Defense'},{p:78,t:'Battle'}],
    [{p:23,t:'Feudal'},{p:39,t:'Raid'},{p:54,t:'Castle'},{p:66,t:'Assist'},{p:78,t:'Battle'}]
  ];
  return <section className="stats-v2-timeline"><div className="stats-v2-visual-heading"><div><span className="eyebrow">BATTLE TIMELINE</span><h3>Development, pressure and cooperation</h3></div><p>Markers share one Game clock; they expose timing and evidence without claiming that an interaction decided the result.</p></div><div className="stats-v2-time-axis"><span>00:00</span><span>10:00</span><span>20:00</span><span>30:00</span><span>40:00</span></div>{designPlayers(players).slice(0,4).map((player,index)=><div className="stats-v2-timeline-lane" key={player.playerId}><strong>{player.steamName}</strong><div className="stats-v2-lane-track">{preview&&laneEvents[index].map(event=><span className={'stats-v2-marker '+event.t.toLowerCase()} key={`${event.p}-${event.t}`} style={{left:`${event.p}%`}}><i/>{event.t}</span>)}</div></div>)}</section>;
}

function battleCategoryTable(players:DisplayPlayer[],category:DetailCategory,preview:boolean){
  return seasonCategoryTable(players,category,'total',preview);
}

export function BattleStatisticsExperience({data,preview}:{data:MatchDetail;preview:boolean}){
  const [category,setCategory]=useState<StatisticCategory>('Opening');
  const players=battlePlayers(data);
  const detail=battleCategoryTable(players,category as DetailCategory,preview);
  const overviewColumns:ComparisonColumn[]=[{key:'result',label:'Result'},{key:'resources',label:'Resources committed'},{key:'raids',label:'Raids initiated'},{key:'received',label:'Raids received'},{key:'assists',label:'Defensive assists'},{key:'line',label:'Main military line'}];
  return <section className="statistics-experience stats-v2 battle-statistics-v2">
    <header className="stats-v2-hero compact"><div><span className="eyebrow">BATTLE STATISTICS</span><h2>The record of the field</h2><p>Start with the result, then compare the players, follow the Game clock and inspect the five detailed categories.</p></div><div className="stats-v2-hero-meta"><span>{preview?'ILLUSTRATIVE DATA':'ENGINE DATA PENDING'}</span></div></header>
    <DesignDataNotice preview={preview}/>
    <BattleResult data={data}/>
    <section className="stats-v2-highlights"><article><span className="eyebrow">EARLY INTENT</span><strong>{preview?`${players[0]?.steamName??'A player'} struck first`:'Awaiting qualified evidence'}</strong><p>{preview?'Military production opened at 10:42 — earliest in this Game.':'Up to three evidence-backed Battle distinctions appear here.'}</p></article><article><span className="eyebrow">INTERACTION</span><strong>{preview?'The centre became the battlefield':'Awaiting qualified evidence'}</strong><p>{preview?'A Great Battle drew four contributors into sustained command contact.':'Highlights remain conservative when coverage is incomplete.'}</p></article><article><span className="eyebrow">COMRADESHIP</span><strong>{preview?`${players[2]?.steamName??'An ally'} answered pressure`:'Awaiting qualified evidence'}</strong><p>{preview?'Three qualified defensive assists were detected during allied base pressure.':'Assistance wording stays specific to detected evidence.'}</p></article></section>
    <section className="panel stats-v2-panel"><div className="stats-v2-section-heading compact"><div><span className="eyebrow">OVERVIEW COMPARISON</span><h3>How each player shaped the Battle</h3></div></div><ComparisonTable columns={overviewColumns} rows={battleOverviewRows(players,preview)} caption="Battle player comparison"/></section>
    <BattleTimeline players={players} preview={preview}/>
    <section className="panel stats-v2-panel"><div className="stats-v2-section-heading compact"><div><span className="eyebrow">DETAILED STATISTICS</span><h3>Five views of the same Game</h3></div></div><CategoryTabs active={category} onChange={setCategory} includeOverview={false}/><div className="stats-v2-category-heading"><div><span className="eyebrow">{category.toUpperCase()}</span><h3>{category}</h3><p>{detail.intro}</p></div></div><ComparisonTable columns={detail.columns} rows={detail.rows} caption={`${category} Battle comparison`}/>{category==='Military'&&<CompositionBars players={players} preview={preview}/>}</section>
  </section>;
}

export function MatchDialogWithStatistics(props:ViewProps&{data:MatchDetail;onUpdated:()=>void}){
  return <><MatchDialog {...props}/><hr className="statistics-divider"/><BattleStatisticsExperience data={props.data} preview={props.preview}/></>;
}

function eventPlayers(data:EventDetail):DisplayPlayer[]{
  const fromRoster=data.signup.confirmed??[];
  if(fromRoster.length)return fromRoster;
  const unique=new Map<string,DisplayPlayer>();
  data.matches.forEach(match=>match.participants.forEach(player=>unique.set(player.playerId,player)));
  return unique.size?[...unique.values()]:FALLBACK_PLAYERS;
}

function EventStatisticsExperience({data,preview,openPlayer,openMatch}:{data:EventDetail;preview:boolean;openPlayer:(id:string)=>void;openMatch:(id:string)=>void}){
  const players=eventPlayers(data);
  const overviewColumns:ComparisonColumn[]=[{key:'games',label:'Games'},{key:'wins',label:'Wins'},{key:'resources',label:'Resources committed'},{key:'raids',label:'Raids initiated'},{key:'assists',label:'Defensive assists'},{key:'line',label:'Main military line'}];
  const eventRows=seasonOverviewRows(players,preview);
  return <section className="statistics-experience stats-v2 event-statistics-v2"><header className="stats-v2-hero compact"><div><span className="eyebrow">EVENT STATISTICS</span><h2>What shaped this occasion</h2><p>Event Statistics add consequences and selected distinctions to the Battles themselves; they do not repeat every Game detail.</p></div><div className="stats-v2-hero-meta"><span>{preview?`${Math.max(1,data.matches.length||4)} BATTLES · ILLUSTRATIVE`:'AGGREGATION PENDING'}</span></div></header><DesignDataNotice preview={preview}/><section className="stats-v2-event-consequences"><article><Trophy size={18}/><span>Event result</span><strong>{preview?'Alliance II prevailed':'Pending'}</strong></article><article><Swords size={18}/><span>Battles recorded</span><strong>{preview?String(Math.max(1,data.matches.length||4)):'—'}</strong></article><article><Users size={18}/><span>Participants</span><strong>{preview?String(players.length):'—'}</strong></article></section><section className="stats-v2-highlights event"><article><span className="eyebrow">EVENT DISTINCTION</span><strong>{preview?`${players[0]?.steamName??'A player'} set the tempo`:'Awaiting Battles'}</strong><p>{preview?'Highest qualified raid count across the Event.':'Only meaningful distinctions will appear.'}</p></article><article><span className="eyebrow">EVENT DISTINCTION</span><strong>{preview?`${players[2]?.steamName??'A player'} built deepest`:'Awaiting Battles'}</strong><p>{preview?'Largest accumulated resource commitment across the Event.':'Correlated resource maxima should usually become one distinction.'}</p></article><article><span className="eyebrow">EVENT DISTINCTION</span><strong>{preview?`${players[1]?.steamName??'A player'} answered quickly`:'Awaiting Battles'}</strong><p>{preview?'Fastest qualified median raid response.':'The distinction ceiling is not a quota.'}</p></article></section>{data.matches.length>1||preview?<section className="panel stats-v2-panel"><div className="stats-v2-section-heading compact"><div><span className="eyebrow">EVENT COMPARISON</span><h3>Across the constituent Battles</h3><p>Use this only when the Event contains enough Battles to make aggregation useful.</p></div></div><ComparisonTable columns={overviewColumns} rows={eventRows} openPlayer={openPlayer} caption="Event player comparison"/></section>:null}<section className="stats-v2-battle-links"><div className="stats-v2-section-heading compact"><div><span className="eyebrow">CONSTITUENT BATTLES</span><h3>Return to the evidence</h3></div></div><div>{data.matches.length?data.matches.map((match,index)=><button type="button" key={match.matchId} onClick={()=>openMatch(match.matchId)}><span>Battle {index+1}</span><strong>{formatName(match.format)}</strong><ArrowRight size={14}/></button>):<span className="stats-v2-empty">No Battles have been formed yet.</span>}</div></section></section>;
}

export function EventDialogWithStatistics(props:ViewProps&{data:EventDetail;onUpdated:()=>void}){
  return <><EventDialog {...props}/><hr className="statistics-divider"/><EventStatisticsExperience data={props.data} preview={props.preview} openPlayer={props.openPlayer} openMatch={props.openMatch}/></>;
}
