import {useRef,useState} from 'react';
import {ArrowRight,ChevronLeft,ChevronRight,Handshake,Info,Skull,Sparkles,Trophy} from 'lucide-react';
import {formatName,type EventDetail,type MatchDetail,type PlayerProfile} from '../domain/league';
import {
  FREEHOLDER_TOOLTIP,PERSONALITY_MINIMUM_ELIGIBLE_BATTLES,PLAYER_PERSONALITY_SLIDERS,REPUTATION_ESSENCES,STATISTIC_CATEGORIES,
  type BattleStatisticsPresentation,type EventStatisticsPresentation,type PlayerIdentityPresentation,type SeasonStatisticsPresentation,type StatisticCategory,type StatisticCategoryBlock
} from '../domain/statisticsExperience';
import {previewBattleStatistics,previewEventStatistics,previewPlayerIdentity,previewSeasonStatistics} from '../data/statisticsPreview';
import {EventDialog,MatchDialog} from './Views';
import {Avatar,Sigil} from './Primitives';
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
  return <section className="identity-panel personality-panel"><div className="identity-heading"><div><span className="eyebrow">PLAYER PERSONALITY</span><h3>Patterns of play</h3></div><span className="quiet-badge tooltip-target" tabIndex={0} data-tooltip={`Personality positions use qualified Battles. Sliders are revealed after ${PERSONALITY_MINIMUM_ELIGIBLE_BATTLES}.`}>{identity.eligibleBattles} ELIGIBLE</span></div><div className="personality-sliders">{PLAYER_PERSONALITY_SLIDERS.map(definition=>{
    const result=identity.sliders.find(slider=>slider.id===definition.id);
    const ready=result?.value!=null&&identity.eligibleBattles>=PERSONALITY_MINIMUM_ELIGIBLE_BATTLES;
    const value=ready?Math.round(result!.value!):null;
    return <div className={'personality-slider tooltip-target '+(!ready?'developing':'')} key={definition.id} tabIndex={0} data-tooltip={definition.question} aria-label={`${definition.left} to ${definition.right}: ${value==null?'developing':value+' out of 100'}`}><div className="personality-labels"><strong>{definition.left}</strong><span>{value==null?'Developing':value+' / 100'}</span><strong>{definition.right}</strong></div><div className="personality-track" aria-hidden="true"><span className="personality-mid"/><i style={{left:value==null?'50%':`${value}%`}}/></div></div>;
  })}</div></section>;
}

function ReputationPanel({identity,preview,data}:{identity:PlayerIdentityPresentation;preview:boolean;data:PlayerProfile}){
  const icons=[Trophy,Handshake,Skull];
  const reputationTooltip=identity.reputation.archetype==='Freeholder'?FREEHOLDER_TOOLTIP:identity.reputation.tooltip;
  const deeds=preview?[
    {label:'Most common opening',value:'Scout Rush',note:'Opening'},
    {label:'Military family',value:'Cavalry',note:'Military'},
    {label:'Fastest Castle',value:'16:42',note:'Personal record'},
    {label:'Raids initiated',value:'11',note:'Pressure'}
  ]:data.achievements.slice(0,4).map(item=>({label:item.name,value:'Earned',note:item.description}));
  return <section className="identity-panel reputation-panel"><div className="identity-heading"><div><span className="eyebrow">REPUTATION</span><h3>{identity.reputation.archetype}</h3></div><span className="reputation-info tooltip-target" tabIndex={0} data-tooltip={reputationTooltip} aria-label={reputationTooltip}><Info size={15}/></span></div><div className="reputation-crests">{REPUTATION_ESSENCES.map((definition,index)=>{
    const value=identity.reputation.essences.find(item=>item.id===definition.id);
    const intensity=value?.intensity??null;
    const Icon=icons[index];
    const points=value?.careerPoints==null?'Career points pending':`${value.careerPoints} career points${value.seasonPoints==null?'':` · +${value.seasonPoints} this season`}`;
    return <article className={'reputation-crest reputation-'+definition.tone+' tooltip-target '+(intensity==null?'unrated':'')} key={definition.id} tabIndex={0} data-tooltip={`${definition.meaning}. ${points}.`} aria-label={`${definition.label}: ${intensity==null?'unrated':Math.round(intensity)+' out of 100'}`}><div className="crest-frame"><div className="crest-charge" style={{height:`${intensity==null?0:Math.max(6,intensity)}%`}}/><span className="crest-icon"><Icon size={24}/></span><strong className="crest-score">{intensity==null?'—':Math.round(intensity)}</strong></div><strong className="crest-label">{definition.label}</strong><span className="crest-points">{value?.careerPoints==null?'—':value.careerPoints+' pts'}</span></article>;
  })}</div><div className="deeds-heading"><span className="eyebrow">DEEDS</span>{preview&&<span className="quiet-badge">ILLUSTRATIVE</span>}</div>{deeds.length?<div className="deeds-list">{deeds.map(deed=><article className="tooltip-target" tabIndex={0} data-tooltip={deed.note} key={deed.label}><strong>{deed.value}</strong><small>{deed.label}</small></article>)}</div>:<div className="deeds-awaiting tooltip-target" tabIndex={0} data-tooltip="Evidence-backed deeds appear as qualified Battle Statistics accumulate."><strong>Chronicle unwritten</strong></div>}</section>;
}

function playerIdentity(data:PlayerProfile,preview:boolean):PlayerIdentityPresentation{
  return preview?previewPlayerIdentity(data.player.playerId):{
    eligibleBattles:0,
    sliders:PLAYER_PERSONALITY_SLIDERS.map(slider=>({id:slider.id,value:null,eligibleBattles:0})),
    reputation:{archetype:'Freeholder' as const,tooltip:FREEHOLDER_TOOLTIP,essences:REPUTATION_ESSENCES.map(essence=>({id:essence.id,intensity:null,careerPoints:null,seasonPoints:null}))}
  };
}

export function PlayerIdentityExperience({data,preview}:{data:PlayerProfile;preview:boolean}){
  const identity=playerIdentity(data,preview);
  return <section className="player-identity-experience"><div className="identity-layout"><PersonalityPanel identity={identity}/><ReputationPanel identity={identity} preview={preview} data={data}/></div></section>;
}

function compactDate(value:string|null|undefined){
  if(!value||!Number.isFinite(Date.parse(value)))return 'Date pending';
  return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'}).format(new Date(value));
}

function PlayerProfileExperience(props:ViewProps&{data:PlayerProfile}){
  const {data,snapshot,preview,openMatch}=props;
  const battleRail=useRef<HTMLDivElement>(null);
  const seasonStats=data.activeSeason?.competition??null;
  const winRate=seasonStats&&seasonStats.matchesPlayed>0?Math.round(seasonStats.matchesWon/seasonStats.matchesPlayed*100)+'%':'—';
  const viewerId=snapshot.viewer?.playerId;
  const sharedWithViewer=!!viewerId&&viewerId!==data.player.playerId;
  const alliedCount=sharedWithViewer?(data.teammates.find(item=>item.player.playerId===viewerId)?.matchesTogether??0):null;
  const opposedCount=sharedWithViewer?(data.opponents.find(item=>item.player.playerId===viewerId)?.matchesTogether??0):null;
  const battles=snapshot.matches.filter(match=>match.participants.some(player=>player.playerId===data.player.playerId)).sort((left,right)=>{
    const leftEvent=snapshot.events.find(event=>event.eventId===left.eventId),rightEvent=snapshot.events.find(event=>event.eventId===right.eventId);
    return (right.completedAt??rightEvent?.startsAt??'').localeCompare(left.completedAt??leftEvent?.startsAt??'');
  });
  const scrollBattles=(direction:-1|1)=>battleRail.current?.scrollBy({left:direction*440,behavior:'smooth'});
  return <section className="player-profile-experience">
    <section className="profile-hero">
      <div className="profile-portrait-card"><div className="profile-portrait-frame"><Avatar player={data.player} large/></div><span className="eyebrow">NEWCOMER</span></div>
      <div className="profile-identity-copy"><span className="eyebrow">PERSISTENT LEAGUE IDENTITY</span><h3>{data.player.steamName}</h3><span className="profile-forging-status tooltip-target" tabIndex={0} data-tooltip="Military identity replaces Newcomer when qualified Battle evidence supports it.">Identity still being forged</span></div>
      <div className="profile-hero-record" aria-label="Current season record and shared history"><div className="profile-record-primary"><div><strong>{seasonStats?.matchesWon??'—'}</strong><span>Won</span></div><div><strong>{seasonStats?.matchesLost??'—'}</strong><span>Lost</span></div><div><strong>{winRate}</strong><span>Win rate</span></div></div>{sharedWithViewer&&<div className="profile-shared-numbers"><div className="tooltip-target" tabIndex={0} data-tooltip={`Battles where you and ${data.player.steamName} fought on the same side.`}><strong>{alliedCount}</strong><span>Allied</span></div><div className="tooltip-target" tabIndex={0} data-tooltip={`Battles where you and ${data.player.steamName} fought on opposing sides.`}><strong>{opposedCount}</strong><span>Opposed</span></div></div>}</div>
    </section>

    <PlayerIdentityExperience data={data} preview={preview}/>

    <section className="profile-battle-record">
      <div className="profile-section-heading battle-record-heading"><div><span className="eyebrow">BATTLE RECORD</span><h3>Battles</h3></div></div>
      <div className="battle-carousel-shell">
        <button type="button" className="battle-carousel-arrow previous" aria-label="Scroll earlier Battles" onClick={()=>scrollBattles(-1)}><ChevronLeft size={22}/></button>
        <div className="battle-carousel" ref={battleRail}>
          {battles.length?battles.map(match=>{
            const event=snapshot.events.find(candidate=>candidate.eventId===match.eventId);
            const subject=match.participants.find(player=>player.playerId===data.player.playerId);
            const others=match.participants.filter(player=>player.playerId!==data.player.playerId);
            const opponents=subject?.team!=null?others.filter(player=>player.team==null||player.team!==subject.team):others;
            const resultKnown=match.status==='COMPLETED'&&Array.isArray(match.result?.winningPlayerIds)&&match.result!.winningPlayerIds!.length>0;
            const won=resultKnown&&match.result!.winningPlayerIds!.includes(data.player.playerId);
            const lost=resultKnown&&!won;
            const result=won?'WON':lost?'LOST':match.status.replaceAll('_',' ');
            const opponentsLabel=opponents.length?'vs '+opponents.slice(0,2).map(player=>player.steamName).join(' · ')+(opponents.length>2?` +${opponents.length-2}`:''):formatName(match.format);
            return <button type="button" className={'profile-battle-card '+(won?'won':lost?'lost':'pending')} key={match.matchId} onClick={()=>openMatch(match.matchId)}>
              <div className="profile-battle-card-mark"><Sigil kind={match.format==='ONE_V_ONE'?'duel':match.format==='FFA'?'ffa':'team'} size={22}/><span>{event?.title??'League Battle'}</span></div>
              <span className="profile-battle-result">{result}</span>
              <strong>{opponentsLabel}</strong>
              <small>{formatName(match.format)}</small>
              <span className="profile-battle-date">{compactDate(match.completedAt??event?.startsAt)}</span>
            </button>;
          }):<div className="profile-battle-empty"><strong>No Battles yet.</strong></div>}
          {battles.length>3&&<span className="battle-carousel-peek" aria-hidden="true"/>}
        </div>
        <button type="button" className="battle-carousel-arrow next" aria-label="Scroll later Battles" onClick={()=>scrollBattles(1)}><ChevronRight size={22}/></button>
      </div>
    </section>
  </section>;
}

export function ProfileDialogWithIdentity(props:ViewProps&{data:PlayerProfile}){
  return <PlayerProfileExperience {...props}/>;
}
