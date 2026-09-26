import {useRef,useState} from 'react';
import {ArrowRight,ChevronLeft,ChevronRight,Info,Sparkles} from 'lucide-react';
import {formatName,type EventDetail,type MatchDetail,type PlayerProfile} from '../domain/league';
import {
  FREEHOLDER_TOOLTIP,PERSONALITY_MINIMUM_ELIGIBLE_BATTLES,PLAYER_PERSONALITY_SLIDERS,REPUTATION_ESSENCES,STATISTIC_CATEGORIES,
  type BattleStatisticsPresentation,type EventStatisticsPresentation,type PlayerIdentityPresentation,type ReputationEssenceId,type SeasonStatisticsPresentation,type StatisticCategory,type StatisticCategoryBlock
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

const sliderTermTooltips:Record<string,[string,string]>={
  'boomer-aggressor':['Builds economy before committing to pressure.','Commits early resources to military pressure.'],
  'cautious-bold':['Keeps expansion and infrastructure protected.','Establishes forward positions with limited cover.'],
  'guerrilla-frontline':['Favors raids, mobility and disruption.','Favors direct, sustained engagements.'],
  'specialist-improviser':['Commits to a narrow plan or composition.','Uses a broad mix of tools and responses.'],
  'compact-expansive':['Keeps economy and infrastructure concentrated.','Spreads economy and infrastructure across the map.']
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
  const revealed=identity.eligibleBattles>=PERSONALITY_MINIMUM_ELIGIBLE_BATTLES&&identity.sliders.some(slider=>slider.value!=null);
  const remaining=Math.max(0,PERSONALITY_MINIMUM_ELIGIBLE_BATTLES-identity.eligibleBattles);
  return <section className="identity-panel personality-panel"><div className="identity-heading"><div><span className="eyebrow">PLAYER PERSONALITY</span><h3>Patterns of play</h3></div>{!revealed&&<span className="quiet-badge tooltip-target tooltip-below" tabIndex={0} data-tooltip={`${identity.eligibleBattles} of ${PERSONALITY_MINIMUM_ELIGIBLE_BATTLES} qualified Battles recorded.`}>{remaining} TO GO</span>}</div>{revealed?<div className="personality-sliders">{PLAYER_PERSONALITY_SLIDERS.map(definition=>{
    const result=identity.sliders.find(slider=>slider.id===definition.id);
    const value=result?.value==null?50:Math.round(result.value);
    const termHelp=sliderTermTooltips[definition.id];
    return <div className="personality-slider" key={definition.id} aria-label={`${definition.left} to ${definition.right}: ${result?.value==null?'unrated':value+' out of 100'}`}><div className="personality-labels"><strong className="slider-term tooltip-target tooltip-below" tabIndex={0} data-tooltip={termHelp[0]}>{definition.left}</strong><span>{result?.value==null?'Unrated':value+' / 100'}</span><strong className="slider-term tooltip-target tooltip-below" tabIndex={0} data-tooltip={termHelp[1]}>{definition.right}</strong></div><div className="personality-track" aria-hidden="true"><span className="personality-mid"/><i style={{left:`${value}%`}}/></div></div>;
  })}</div>:<div className="personality-locked"><strong>Patterns locked</strong><span>{identity.eligibleBattles} / {PERSONALITY_MINIMUM_ELIGIBLE_BATTLES} eligible Battles</span><small>The profile reveals its tendencies once enough Battles exist to support them.</small></div>}</section>;
}

function reputationRankStage(intensity:number|null,preview:boolean){
  if(!preview||intensity==null||intensity<=0)return 0;
  if(intensity>=75)return 4;
  if(intensity>=50)return 3;
  if(intensity>=25)return 2;
  return 1;
}

function ReputationEmblem({id}:{id:ReputationEssenceId}){
  if(id==='gallantry')return <svg className="reputation-emblem gallantry-emblem" viewBox="0 0 100 100" aria-hidden="true"><path className="emblem-line" d="M31 20c7-7 12-10 19-10s12 3 19 10M36 23c2 8 7 12 14 12s12-4 14-12"/><path className="emblem-fill" d="M37 36c-8 4-11 11-8 18 2 4 6 6 10 6-6 5-5 13 1 17 4 3 8 2 11-1 3 3 8 4 12 1 6-4 7-12 1-17 5 0 9-2 11-6 3-7 0-14-8-18-6-3-24-3-30 0Z"/><path className="emblem-line" d="M44 59c-1 8-2 14-5 21M56 59c1 8 2 14 5 21M45 46c3 2 7 2 10 0"/><circle cx="44" cy="48" r="1.5"/><circle cx="56" cy="48" r="1.5"/></svg>;
  if(id==='chivalry')return <svg className="reputation-emblem chivalry-emblem" viewBox="0 0 100 100" aria-hidden="true"><circle className="emblem-ring" cx="50" cy="50" r="37"/><path className="emblem-fill" d="M45 14h10l-2 22 15-16 8 8-18 14 24-2v12l-24-2 18 14-8 8-15-16 2 24H45l2-24-15 16-8-8 18-14-24 2V40l24 2-18-14 8-8 15 16-2-22Z"/><circle className="emblem-ring inner" cx="50" cy="50" r="27"/></svg>;
  return <svg className="reputation-emblem treachery-emblem" viewBox="0 0 100 100" aria-hidden="true"><path className="emblem-line bones" d="M24 72 73 35M27 34l47 39"/><path className="emblem-fill cap" d="M29 31c5-12 15-18 28-18 10 0 18 3 25 10l-5 8H29Z"/><path className="emblem-line" d="M33 30c11 5 27 5 41 0M45 22h24"/><path className="emblem-fill skull" d="M32 39c0-10 8-17 19-17 12 0 21 7 21 18 0 8-4 13-10 16v12l-8 6-8-6-7 4-7-6V55c-1-4 0-10 0-16Z"/><circle className="skull-eye" cx="44" cy="44" r="5"/><circle className="skull-eye" cx="61" cy="44" r="5"/><path className="skull-cut" d="m52 50-4 8h8l-4-8ZM43 64h18"/></svg>;
}

type SharedHistorySummary={playerName:string;allied:number|null;opposed:number|null};

function SharedHistory({summary}:{summary:SharedHistorySummary}){
  return <div className="profile-shared-history"><span className="eyebrow">SHARED HISTORY</span><div className="shared-history-numbers"><div className="tooltip-target tooltip-above" tabIndex={0} data-tooltip={`Battles where you and ${summary.playerName} fought on the same side.`}><strong>{summary.allied??'—'}</strong><span>Allies</span></div><div className="tooltip-target tooltip-above" tabIndex={0} data-tooltip={`Battles where you and ${summary.playerName} fought on opposing sides.`}><strong>{summary.opposed??'—'}</strong><span>Enemies</span></div></div></div>;
}

function ReputationPanel({identity,preview,sharedHistory}:{identity:PlayerIdentityPresentation;preview:boolean;sharedHistory:SharedHistorySummary}){
  return <section className="identity-panel reputation-panel"><div className="identity-heading"><span className="eyebrow">REPUTATION</span><span className="reputation-info tooltip-target tooltip-below" tabIndex={0} data-tooltip="Three independent reputations earned through league deeds." aria-label="About reputation"><Info size={15}/></span></div><div className="reputation-crests">{REPUTATION_ESSENCES.map(definition=>{
    const value=identity.reputation.essences.find(item=>item.id===definition.id);
    const intensity=value?.intensity??null;
    const stage=reputationRankStage(intensity,preview);
    const points=value?.careerPoints==null?'Points pending':`${value.careerPoints} career points${value.seasonPoints==null?'':` · +${value.seasonPoints} this season`}`;
    const stageText=stage===0?'Unformed insignia':`Illustrative insignia stage ${stage}`;
    return <article className={`reputation-crest reputation-${definition.id} rank-${stage}`} key={definition.id}><div className="crest-frame tooltip-target tooltip-below" tabIndex={0} data-tooltip={`${stageText}. ${points}.`} aria-label={`${definition.label}: ${points}`}><span className="crest-rank-ornaments" aria-hidden="true"><i/><i/><i/><i/></span><ReputationEmblem id={definition.id}/></div><strong className="crest-label tooltip-target tooltip-above" tabIndex={0} data-tooltip={definition.meaning}>{definition.label}</strong><span className="crest-points">{value?.careerPoints==null?'—':value.careerPoints+' pts'}</span></article>;
  })}</div><SharedHistory summary={sharedHistory}/></section>;
}

function playerIdentity(data:PlayerProfile,preview:boolean):PlayerIdentityPresentation{
  return preview?previewPlayerIdentity(data.player.playerId):{
    eligibleBattles:0,
    sliders:PLAYER_PERSONALITY_SLIDERS.map(slider=>({id:slider.id,value:null,eligibleBattles:0})),
    reputation:{archetype:'Freeholder' as const,tooltip:FREEHOLDER_TOOLTIP,essences:REPUTATION_ESSENCES.map(essence=>({id:essence.id,intensity:null,careerPoints:null,seasonPoints:null}))}
  };
}

export function PlayerIdentityExperience({data,preview,sharedHistory}:{data:PlayerProfile;preview:boolean;sharedHistory?:SharedHistorySummary}){
  const identity=playerIdentity(data,preview);
  const history=sharedHistory??{playerName:data.player.steamName,allied:null,opposed:null};
  return <section className="player-identity-experience"><div className="identity-layout"><PersonalityPanel identity={identity}/><ReputationPanel identity={identity} preview={preview} sharedHistory={history}/></div></section>;
}

function ProfileDeedsBar({data,preview}:{data:PlayerProfile;preview:boolean}){
  const deeds=preview?[
    {label:'Most common opening',value:'Scout Rush',note:'Opening'},
    {label:'Military family',value:'Cavalry',note:'Military'},
    {label:'Fastest Castle',value:'16:42',note:'Personal record'},
    {label:'Raids initiated',value:'11',note:'Pressure'}
  ]:data.achievements.slice(0,5).map(item=>({label:item.name,value:'Earned',note:item.description}));
  return <section className="profile-deeds-bar" aria-label="Player deeds"><div className="profile-deeds-title"><span className="eyebrow">DEEDS</span></div>{deeds.length?deeds.map(deed=><article className="profile-deed tooltip-target tooltip-below" tabIndex={0} data-tooltip={deed.note} key={deed.label}><span>{deed.label}</span><strong>{deed.value}</strong></article>):<div className="profile-deed-empty"><strong>Chronicle unwritten</strong></div>}</section>;
}

function compactDate(value:string|null|undefined){
  if(!value||!Number.isFinite(Date.parse(value)))return 'Date pending';
  return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'}).format(new Date(value));
}

function PlayerProfileExperience(props:ViewProps&{data:PlayerProfile}){
  const {data,snapshot,preview,openMatch}=props;
  const battleRail=useRef<HTMLDivElement>(null);
  const identity=playerIdentity(data,preview);
  const seasonStats=data.activeSeason?.competition??null;
  const winRate=seasonStats&&seasonStats.matchesPlayed>0?Math.round(seasonStats.matchesWon/seasonStats.matchesPlayed*100)+'%':'—';
  const viewerId=snapshot.viewer?.playerId;
  const sharedWithViewer=!!viewerId&&viewerId!==data.player.playerId;
  const alliedCount=sharedWithViewer?(data.teammates.find(item=>item.player.playerId===viewerId)?.matchesTogether??0):null;
  const opposedCount=sharedWithViewer?(data.opponents.find(item=>item.player.playerId===viewerId)?.matchesTogether??0):null;
  const sharedHistory:SharedHistorySummary={playerName:data.player.steamName,allied:alliedCount,opposed:opposedCount};
  const titleLabel=identity.reputation.archetype==='Freeholder'?'Novitiate':identity.reputation.archetype;
  const battles=snapshot.matches.filter(match=>match.participants.some(player=>player.playerId===data.player.playerId)).sort((left,right)=>{
    const leftEvent=snapshot.events.find(event=>event.eventId===left.eventId),rightEvent=snapshot.events.find(event=>event.eventId===right.eventId);
    return (right.completedAt??rightEvent?.startsAt??'').localeCompare(left.completedAt??leftEvent?.startsAt??'');
  });
  const scrollBattles=(direction:-1|1)=>battleRail.current?.scrollBy({left:direction*440,behavior:'smooth'});
  return <section className="player-profile-experience">
    <section className="profile-hero">
      <div className="profile-portrait-card"><div className="profile-portrait-frame"><Avatar player={data.player} large/></div><strong className="profile-player-name">{data.player.steamName}</strong></div>
      <div className="profile-identity-copy"><span className="eyebrow">CURRENT TITLE</span><div className="profile-title-slot tooltip-target tooltip-below" tabIndex={0} data-tooltip="This slot becomes the player's reputation title as their league identity develops."><strong>{titleLabel}</strong>{titleLabel==='Novitiate'&&<small>Identity still being forged</small>}</div></div>
      <div className="profile-hero-record" aria-label="Current season record"><div className="profile-record-primary"><div><strong>{seasonStats?.matchesWon??'—'}</strong><span>Won</span></div><div><strong>{seasonStats?.matchesLost??'—'}</strong><span>Lost</span></div><div><strong>{winRate}</strong><span>Win rate</span></div></div></div>
    </section>

    <ProfileDeedsBar data={data} preview={preview}/>

    <PlayerIdentityExperience data={data} preview={preview} sharedHistory={sharedHistory}/>

    <section className="profile-battle-record">
      <div className="profile-section-heading battle-record-heading"><div><span className="eyebrow">BATTLE RECORD</span></div></div>
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
