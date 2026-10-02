import {useRef,useState} from 'react';
import {ArrowRight,BookOpen,ChevronLeft,ChevronRight,Info,Sparkles} from 'lucide-react';
import {formatName,type PlayerProfile,type PlayerRelationshipSummary} from '../domain/league';
import {
  FREEHOLDER_TOOLTIP,PERSONALITY_MINIMUM_ELIGIBLE_BATTLES,PLAYER_PERSONALITY_SLIDERS,REPUTATION_ESSENCES,
  type PlayerIdentityPresentation,type ReputationEssenceId
} from '../domain/statisticsExperience';
import {previewPlayerIdentity} from '../data/statisticsPreview';
import {Avatar,Sigil} from './Primitives';
import type {ViewProps} from './App';

const sliderTermTooltips:Record<string,[string,string]>={
  'boomer-aggressor':['Builds economy before committing to pressure.','Commits early resources to military pressure.'],
  'cautious-bold':['Keeps expansion and infrastructure protected.','Establishes forward positions with limited cover.'],
  'guerrilla-frontline':['Favors raids, mobility and disruption.','Favors direct, sustained engagements.'],
  'specialist-improviser':['Commits to a narrow plan or composition.','Uses a broad mix of tools and responses.'],
  'compact-expansive':['Keeps economy and infrastructure concentrated.','Spreads economy and infrastructure across the map.']
};

export {BattleStatisticsExperience,MatchDialogWithStatistics,EventDialogWithStatistics,SeasonStatisticsView} from './StatisticsDashboard';

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

function crueltyArtworkLevel(intensity:number|null,preview:boolean){
  // Visual preview only. Final Cruelty point thresholds remain intentionally unconfigured.
  if(!preview||intensity==null||intensity<=0)return 0;
  if(intensity>=80)return 5;
  if(intensity>=60)return 4;
  if(intensity>=40)return 3;
  if(intensity>=20)return 2;
  return 1;
}

function ReputationEmblem({id}:{id:ReputationEssenceId}){
  if(id==='gallantry')return <svg className="reputation-emblem gallantry-emblem" viewBox="0 0 100 100" aria-hidden="true"><path className="emblem-line" d="M31 20c7-7 12-10 19-10s12 3 19 10M36 23c2 8 7 12 14 12s12-4 14-12"/><path className="emblem-fill" d="M37 36c-8 4-11 11-8 18 2 4 6 6 10 6-6 5-5 13 1 17 4 3 8 2 11-1 3 3 8 4 12 1 6-4 7-12 1-17 5 0 9-2 11-6 3-7 0-14-8-18-6-3-24-3-30 0Z"/><path className="emblem-line" d="M44 59c-1 8-2 14-5 21M56 59c1 8 2 14 5 21M45 46c3 2 7 2 10 0"/><circle cx="44" cy="48" r="1.5"/><circle cx="56" cy="48" r="1.5"/></svg>;
  if(id==='chivalry')return <svg className="reputation-emblem chivalry-emblem" viewBox="0 0 100 100" aria-hidden="true"><circle className="emblem-ring" cx="50" cy="50" r="37"/><path className="emblem-fill" d="M45 14h10l-2 22 15-16 8 8-18 14 24-2v12l-24-2 18 14-8 8-15-16 2 24H45l2-24-15 16-8-8 18-14-24 2V40l24 2-18-14 8-8 15 16-2-22Z"/><circle className="emblem-ring inner" cx="50" cy="50" r="27"/></svg>;
  return null;
}

type SharedHistorySummary={playerName:string;allied:number|null;opposed:number|null};

function SharedHistory({summary}:{summary:SharedHistorySummary}){
  return <div className="profile-shared-history"><span className="eyebrow">SHARED HISTORY</span><div className="shared-history-numbers"><div className="tooltip-target tooltip-above" tabIndex={0} data-tooltip={`Battles where you and ${summary.playerName} fought on the same side.`}><strong>{summary.allied??'—'}</strong><span>Allies</span></div><div className="tooltip-target tooltip-above" tabIndex={0} data-tooltip={`Battles where you and ${summary.playerName} fought on opposing sides.`}><strong>{summary.opposed??'—'}</strong><span>Enemies</span></div></div></div>;
}

function ReputationPanel({identity,preview,sharedHistory}:{identity:PlayerIdentityPresentation;preview:boolean;sharedHistory:SharedHistorySummary}){
  return <section className="identity-panel reputation-panel"><div className="identity-heading"><span className="eyebrow">REPUTATION</span><span className="reputation-info tooltip-target tooltip-below" tabIndex={0} data-tooltip="Gallantry, Cruelty and Chivalry are independent reputations earned through league deeds." aria-label="About reputation"><Info size={15}/></span></div><div className="reputation-crests">{REPUTATION_ESSENCES.map(definition=>{
    const value=identity.reputation.essences.find(item=>item.id===definition.id);
    const intensity=value?.intensity??null;
    const stage=reputationRankStage(intensity,preview);
    const crueltyLevel=definition.id==='cruelty'?crueltyArtworkLevel(intensity,preview):null;
    const points=value?.careerPoints==null?'Points pending':`${value.careerPoints} career points${value.seasonPoints==null?'':` · +${value.seasonPoints} this season`}`;
    const stageText=definition.id==='cruelty'?`Cruelty level ${crueltyLevel}`:(stage===0?'Unformed insignia':`Illustrative insignia stage ${stage}`);
    return <article className={`reputation-crest reputation-${definition.id} rank-${stage}${crueltyLevel==null?'':` cruelty-level-${crueltyLevel}`}`} key={definition.id}><div className="crest-frame tooltip-target tooltip-below" tabIndex={0} data-tooltip={`${stageText}. ${points}.`} aria-label={`${definition.label}: ${stageText}. ${points}`}>{definition.id==='cruelty'?<img className="cruelty-artwork" src={`/Player-portraits/Cruelty-${crueltyLevel}.png`} alt={`Cruelty level ${crueltyLevel} insignia`}/>:<><span className="crest-rank-ornaments" aria-hidden="true"><i/><i/><i/><i/></span><ReputationEmblem id={definition.id}/></>}</div><strong className="crest-label tooltip-target tooltip-above" tabIndex={0} data-tooltip={definition.meaning}>{definition.label}</strong><span className="crest-points">{value?.careerPoints==null?'—':value.careerPoints+' pts'}</span></article>;
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

function relationshipTrackLabel(track:{status:string;state:string;stageId:string|null;historicalPeakStageId:string|null},label:string){
  if(track.status!=='READY')return `${label} · Unwritten`;
  if(!track.stageId&&track.historicalPeakStageId)return `${label} · Dormant (once ${track.historicalPeakStageId})`;
  if(!track.stageId)return `${label} · Unestablished`;
  return `${label} · ${track.state==='DORMANT'?'Dormant ':''}${track.stageId}`;
}

function RelationshipChronicle({data,snapshot}:{data:PlayerProfile;snapshot:ViewProps['snapshot']}){
  const relationships=data.relationships??[];
  const viewerId=snapshot.viewer?.playerId;
  const preferred=relationships.find(item=>item.otherPlayer.playerId===viewerId)??relationships[0]??null;
  const [selectedPairId,setSelectedPairId]=useState<string|null>(preferred?.pairId??null);
  const selected=relationships.find(item=>item.pairId===selectedPairId)??preferred;
  return <section className="relationship-chronicle-view" aria-label="Relationship Chronicle">
    <div className="chronicle-toolbar"><div><span className="eyebrow">RELATIONSHIP CHRONICLE</span><h3>What history remembers</h3></div>{relationships.length>1&&<label>Player<select value={selected?.pairId??''} onChange={event=>setSelectedPairId(event.target.value)}>{relationships.map(item=><option value={item.pairId} key={item.pairId}>{item.otherPlayer.steamName}</option>)}</select></label>}</div>
    <article className="chronicle-parchment">
      <div className="chronicle-seal"><BookOpen size={24}/></div>
      {selected?<>
        <header className="chronicle-title"><span className="eyebrow">A RECORDED HISTORY</span><h2>{data.player.steamName} &amp; {selected.otherPlayer.steamName}</h2><p>Only Battles and deeds supported by the league record are entered here.</p></header>
        <div className="chronicle-track-row">
          <span>{relationshipTrackLabel(selected.tracks.rivalry,'Rivalry')}</span>
          <span>{relationshipTrackLabel(selected.tracks.hostility,'Hostility')}</span>
          <span>{relationshipTrackLabel(selected.tracks.bond,'Bond')}</span>
        </div>
        <ol className="chronicle-entries">{selected.chronicle.length?selected.chronicle.map(entry=><li key={entry.entryId}><time>{compactDate(entry.playedAt)}</time><div><span className="eyebrow">{entry.relation==='ALLIED'?'UNDER ONE BANNER':entry.relation==='OPPOSED'?'ACROSS THE BATTLEFIELD':'RECORDED ENCOUNTER'}</span><h4>{entry.title}</h4><p>{entry.text}</p>{entry.matchId&&<small>{entry.matchId}</small>}</div></li>):<li className="chronicle-empty"><div><h4>The page remains unwritten.</h4><p>No qualified shared events have yet been entered for this pair.</p></div></li>}</ol>
        {!selected.relationshipRulesConfigured&&<footer>Relationship stages remain sealed until the V2 rule set is configured. The Chronicle itself is factual history and remains available.</footer>}
      </>:<div className="chronicle-empty-state"><BookOpen size={34}/><h3>No shared history has been entered.</h3><p>When this player shares a qualified Battle with another league member, their Chronicle begins.</p></div>}
    </article>
  </section>;
}

function PlayerProfileExperience(props:ViewProps&{data:PlayerProfile}){
  const {data,snapshot,preview,openMatch}=props;
  const [profileTab,setProfileTab]=useState<'profile'|'chronicle'>('profile');
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

    <nav className="profile-subnav" aria-label="Player profile sections"><button type="button" className={profileTab==='profile'?'active':''} onClick={()=>setProfileTab('profile')}>Profile</button><button type="button" className={profileTab==='chronicle'?'active':''} onClick={()=>setProfileTab('chronicle')}><BookOpen size={15}/>Chronicle</button></nav>

    {profileTab==='chronicle'?<RelationshipChronicle data={data} snapshot={snapshot}/>:<>
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
    </>}
  </section>;
}

export function ProfileDialogWithIdentity(props:ViewProps&{data:PlayerProfile}){
  return <PlayerProfileExperience {...props}/>;
}
