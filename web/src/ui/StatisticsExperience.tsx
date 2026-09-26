import {useState} from 'react';
import {ArrowRight,Handshake,Info,Skull,Sparkles,Trophy} from 'lucide-react';
import type {EventDetail,MatchDetail,PlayerProfile} from '../domain/league';
import {
  FREEHOLDER_TOOLTIP,PERSONALITY_MINIMUM_ELIGIBLE_BATTLES,PLAYER_PERSONALITY_SLIDERS,REPUTATION_ESSENCES,STATISTIC_CATEGORIES,
  type BattleStatisticsPresentation,type EventStatisticsPresentation,type PlayerIdentityPresentation,type SeasonStatisticsPresentation,type StatisticCategory,type StatisticCategoryBlock
} from '../domain/statisticsExperience';
import {previewBattleStatistics,previewEventStatistics,previewPlayerIdentity,previewSeasonStatistics} from '../data/statisticsPreview';
import {EventDialog,MatchDialog,ProfileDialog} from './Views';
import type {ViewProps} from './App';

const emptyValues:Record<StatisticCategory,string[]>={
  Opening:['Build order','Feudal Age','Castle Age','Imperial Age','First military unit','First military building'],
  Economy:['Villagers @20','Dark Age TC idle','Eco upgrades by Castle','First extra TC','Third TC','Resources committed'],
  Military:['Military commitment @20','Army composition','Raids','Engagements','Military infrastructure','Teamplay'],
  'Map Presence':['Scout Coverage @5','Map Coverage','Forward Footprint','Expansion Zones','Enemy Base Contact','Gold Influence','Relic Activity'],
  Execution:['Raw APM','Combat APM','Economy actions during combat','Raid response']
};

function blankCategories():StatisticCategoryBlock[]{
  return STATISTIC_CATEGORIES.map(category=>({category,values:emptyValues[category].map(label=>({label,value:'—'}))}));
}

function SectionTabs({active,onChange}:{active:StatisticCategory;onChange:(value:StatisticCategory)=>void}){
  return <div className="stats-tabs" role="tablist" aria-label="Statistics category">{STATISTIC_CATEGORIES.map(category=><button key={category} role="tab" aria-selected={active===category} className={active===category?'active':''} onClick={()=>onChange(category)}>{category}</button>)}</div>;
}

function CategoryTable({block,context}:{block:StatisticCategoryBlock;context?:string}){
  return <section className="stats-category-panel"><div className="stats-category-heading"><div><span className="eyebrow">{context??'STATISTICS'}</span><h3>{block.category}</h3></div>{block.summary&&<p>{block.summary}</p>}</div><div className="stats-value-grid">{block.values.map(item=><div className="stats-value" key={item.label}><span>{item.label}</span><strong>{item.value}</strong>{item.note&&<small>{item.note}</small>}</div>)}</div></section>;
}

function DesignDataNotice({preview}:{preview:boolean}){
  return preview?<div className="stats-design-notice"><Sparkles size={15}/><span><strong>Design preview.</strong> Values on this surface are illustrative until the new statistics engine is connected.</span></div>:<div className="stats-design-notice neutral"><Info size={15}/><span>The player-facing structure is ready. Values appear when the new statistics projection is connected.</span></div>;
}

export function BattleStatisticsExperience({data,preview}:{data:MatchDetail;preview:boolean}){
  const [category,setCategory]=useState<StatisticCategory>('Opening');
  const playerNames=data.match.participants.map(player=>player.steamName);
  const presentation:BattleStatisticsPresentation=preview?previewBattleStatistics(playerNames):{highlights:[],categories:blankCategories()};
  const active=presentation.categories.find(item=>item.category===category)!;
  return <section className="statistics-experience battle-statistics-experience">
    <div className="stats-title-row"><div><span className="eyebrow">BATTLE STATISTICS</span><h2>The record of the field</h2><p>A focused reading of this Battle, followed by the detailed five-category record.</p></div><span className="quiet-badge">{preview?'ILLUSTRATIVE DATA':'ENGINE DATA PENDING'}</span></div>
    <DesignDataNotice preview={preview}/>
    <section className="battle-readout"><div className="stats-subheading"><span className="eyebrow">BATTLE READOUT</span><h3>What defined this Battle</h3></div>{presentation.highlights.length?<div className="battle-highlight-grid">{presentation.highlights.slice(0,3).map(highlight=><article key={highlight.eyebrow+highlight.title} className="battle-highlight"><span className="eyebrow">{highlight.eyebrow} · {highlight.category}</span><strong>{highlight.title}</strong><p>{highlight.detail}</p></article>)}</div>:<div className="stats-awaiting"><strong>Battle distinctions will appear here.</strong><p>Up to three strong, evidence-backed facts will be selected from the finished Battle rather than filling the space with weak trivia.</p></div>}</section>
    <section className="detailed-statistics"><div className="stats-subheading"><span className="eyebrow">DETAILED STATISTICS</span><h3>Five views of the same Battle</h3></div><SectionTabs active={category} onChange={setCategory}/><CategoryTable block={active} context="BATTLE"/></section>
  </section>;
}

export function MatchDialogWithStatistics(props:ViewProps&{data:MatchDetail;onUpdated:()=>void}){
  return <><MatchDialog {...props}/><hr className="statistics-divider"/><BattleStatisticsExperience data={props.data} preview={props.preview}/></>;
}

function EventStatisticsExperience({data,preview}:{data:EventDetail;preview:boolean}){
  const [category,setCategory]=useState<StatisticCategory>('Opening');
  const presentation:EventStatisticsPresentation=preview?previewEventStatistics(data.event.title):{eventLabel:data.event.title,battlesAnalyzed:null,distinctions:[],categories:blankCategories()};
  const active=presentation.categories.find(item=>item.category===category)!;
  return <section className="statistics-experience event-statistics-experience"><div className="stats-title-row"><div><span className="eyebrow">EVENT STATISTICS</span><h2>The event in numbers</h2><p>Curated distinctions and aggregates across the Battles that made up this Event.</p></div><span className="quiet-badge">{presentation.battlesAnalyzed==null?'AWAITING BATTLES':presentation.battlesAnalyzed+' BATTLES'}</span></div><DesignDataNotice preview={preview}/>{presentation.distinctions.length?<div className="event-distinction-grid">{presentation.distinctions.slice(0,6).map(item=><article className="event-distinction" key={item.title}><span className="eyebrow">{item.category}</span><strong>{item.title}</strong><p>{item.detail}</p></article>)}</div>:<div className="stats-awaiting"><strong>Event distinctions will be written by the Battles.</strong><p>Completed Events can surface four to six meaningful distinctions with provenance back to their source Battle.</p></div>}<SectionTabs active={category} onChange={setCategory}/><CategoryTable block={active} context="EVENT"/></section>;
}

export function EventDialogWithStatistics(props:ViewProps&{data:EventDetail;onUpdated:()=>void}){
  return <><EventDialog {...props}/><hr className="statistics-divider"/><EventStatisticsExperience data={props.data} preview={props.preview}/></>;
}

export function SeasonStatisticsView({snapshot,preview,openPlayer}:{snapshot:ViewProps['snapshot'];preview:boolean;openPlayer:(id:string)=>void}){
  const [category,setCategory]=useState<StatisticCategory>('Opening');
  const seasonLabel=snapshot.season?.name??'Current Season';
  const presentation:SeasonStatisticsPresentation=preview?previewSeasonStatistics(seasonLabel):{seasonLabel,battlesAnalyzed:null,categories:blankCategories(),records:[]};
  const active=presentation.categories.find(item=>item.category===category)!;
  const playerByName=(name:string)=>snapshot.players.find(player=>player.steamName===name);
  return <section className="section statistics-experience season-statistics-experience"><div className="section-heading stats-page-heading"><div><span className="eyebrow">SEASON STATISTICS</span><h1>{seasonLabel}</h1><p>The statistical character of the Season — the same language used in every Battle, accumulated across the campaign.</p></div><span className="quiet-badge">{presentation.battlesAnalyzed==null?'ENGINE DATA PENDING':presentation.battlesAnalyzed+' BATTLES ANALYZED'}</span></div><DesignDataNotice preview={preview}/><section className="panel season-stat-overview"><div className="stats-subheading"><span className="eyebrow">SEASON VIEW</span><h2>Opening · Economy · Military · Map Presence · Execution</h2><p>Comparisons favor timings, rates, medians, shares and fixed checkpoints so long Battles do not automatically dominate the Season.</p></div><SectionTabs active={category} onChange={setCategory}/><CategoryTable block={active} context="SEASON"/></section><section className="panel record-book"><div className="stats-title-row"><div><span className="eyebrow">THE RECORD BOOK</span><h2>Season records</h2><p>Approved record types retain a route back to the Battle that established them.</p></div></div>{presentation.records.length?<div className="record-book-list">{presentation.records.map(record=>{const player=playerByName(record.holder);return <article key={record.label}><span>{record.label}</span><strong>{record.value}</strong>{player?<button className="text-button small" onClick={()=>openPlayer(player.playerId)}>{record.holder}<ArrowRight size={13}/></button>:<small>{record.holder}</small>}<small>{record.provenance}</small></article>;})}</div>:<div className="stats-awaiting"><strong>No Season records yet.</strong><p>The record catalogue will populate from eligible Battle Statistics.</p></div>}</section></section>;
}

function PersonalityPanel({identity}:{identity:PlayerIdentityPresentation}){
  return <section className="identity-panel personality-panel"><div className="identity-heading"><div><span className="eyebrow">PLAYER PERSONALITY</span><h3>Patterns of play</h3></div><span className="quiet-badge">{identity.eligibleBattles} ELIGIBLE BATTLES</span></div><div className="personality-sliders">{PLAYER_PERSONALITY_SLIDERS.map(definition=>{
    const result=identity.sliders.find(slider=>slider.id===definition.id);
    const ready=result?.value!=null&&identity.eligibleBattles>=PERSONALITY_MINIMUM_ELIGIBLE_BATTLES;
    return <div className={'personality-slider '+(!ready?'developing':'')} key={definition.id} title={definition.question}><div className="personality-labels"><strong>{definition.left}</strong><span>{ready?Math.round(result!.value!)+' / 100':'Developing'}</span><strong>{definition.right}</strong></div><div className="personality-track" aria-label={`${definition.left} to ${definition.right}`}><span className="personality-mid"/><i style={ready?{left:`${result!.value}%`}:{left:'50%'}}/></div><p>{definition.question}</p></div>;
  })}</div>{identity.eligibleBattles<PERSONALITY_MINIMUM_ELIGIBLE_BATTLES&&<p className="identity-footnote">Slider positions are revealed after three eligible Battles.</p>}</section>;
}

function ReputationPanel({identity}:{identity:PlayerIdentityPresentation}){
  const icons=[Trophy,Handshake,Skull];
  return <section className="identity-panel reputation-panel"><div className="identity-heading"><div><span className="eyebrow">REPUTATION</span><h3>{identity.reputation.archetype}</h3></div><span className="reputation-info" title={identity.reputation.archetype==='Freeholder'?FREEHOLDER_TOOLTIP:identity.reputation.tooltip}><Info size={15}/></span></div><p className="reputation-title-copy">{identity.reputation.archetype==='Freeholder'?FREEHOLDER_TOOLTIP:identity.reputation.tooltip}</p><div className="essence-columns">{REPUTATION_ESSENCES.map((definition,index)=>{
    const value=identity.reputation.essences.find(item=>item.id===definition.id);
    const intensity=value?.intensity??0;
    const Icon=icons[index];
    return <article className={'essence essence-'+definition.tone} key={definition.id}><div className="essence-vessel"><div className="essence-liquid" style={{height:`${Math.max(4,intensity)}%`}}/><Icon size={21}/><span>{value?.intensity==null?'—':Math.round(value.intensity)}</span></div><strong>{definition.label}</strong><small>{definition.meaning}</small><span className="essence-points">{value?.careerPoints==null?'—':value.careerPoints+' pts'}<i>{value?.seasonPoints==null?'':'+'+value.seasonPoints+' season'}</i></span></article>;
  })}</div></section>;
}

export function PlayerIdentityExperience({data,preview}:{data:PlayerProfile;preview:boolean}){
  const identity=preview?previewPlayerIdentity(data.player.playerId):{
    eligibleBattles:0,
    sliders:PLAYER_PERSONALITY_SLIDERS.map(slider=>({id:slider.id,value:null,eligibleBattles:0})),
    reputation:{archetype:'Freeholder' as const,tooltip:FREEHOLDER_TOOLTIP,essences:REPUTATION_ESSENCES.map(essence=>({id:essence.id,intensity:null,careerPoints:null,seasonPoints:null}))}
  };
  return <section className="player-identity-experience"><DesignDataNotice preview={preview}/><div className="identity-layout"><PersonalityPanel identity={identity}/><ReputationPanel identity={identity}/></div></section>;
}

export function ProfileDialogWithIdentity(props:ViewProps&{data:PlayerProfile}){
  return <><PlayerIdentityExperience data={props.data} preview={props.preview}/><hr className="statistics-divider"/><ProfileDialog {...props}/></>;
}
