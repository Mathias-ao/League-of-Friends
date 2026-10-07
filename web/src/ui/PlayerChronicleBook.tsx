import {useEffect,useMemo,useRef,useState} from 'react';
import {BookOpen,Medal,ScrollText,Trophy,X} from 'lucide-react';
import type {
  LeagueRepository,LeagueSnapshot,PlayerChronicleEntry,PlayerChronicleRelationshipPage,
  PlayerProfile,PlayerRecord,PlayerRelationshipSummary,SocialHistoryResponse
} from '../domain/league';
import {formatName} from '../domain/league';

interface PlayerChronicleBookProps {
  repository:LeagueRepository;
  snapshot:LeagueSnapshot;
  sourceProfile:PlayerProfile;
  initialPagePlayerId:string;
  onClose:()=>void;
}

function compactDate(ms:number|null|undefined){
  if(ms==null||!Number.isFinite(ms))return 'Date pending';
  return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'}).format(new Date(ms));
}

function monogram(name:string){
  const letters=[...name].filter(character=>/[\p{L}\p{N}]/u.test(character));
  return (letters.slice(0,2).join('')||'?').toUpperCase();
}

function clothIndex(playerId:string){
  let value=2166136261;
  for(const character of playerId)value=Math.imul(value^character.codePointAt(0)!,16777619);
  return Math.abs(value)%8;
}

function trackSentence(track:{status:string;state:string;stageId:string|null;historicalPeakStageId:string|null},label:string){
  if(track.status!=='READY')return null;
  if(track.stageId){
    if(track.state==='DORMANT')return `${label} is dormant at ${track.stageId}`;
    return `${label} stands at ${track.stageId}`;
  }
  if(track.historicalPeakStageId)return `${label} is dormant; its recorded peak was ${track.historicalPeakStageId}`;
  return `${label} remains unestablished`;
}

function officialStanding(relationship:PlayerRelationshipSummary|null){
  if(!relationship)return 'No official Rivalry, Hostility or Bond standing has yet been established for this pair.';
  if(!relationship.relationshipRulesConfigured)return 'The official relationship stages remain sealed. Recorded evidence may still appear below where the replay supports it.';
  const clauses=[
    trackSentence(relationship.tracks.rivalry,'Rivalry'),
    trackSentence(relationship.tracks.hostility,'Hostility'),
    trackSentence(relationship.tracks.bond,'Bond'),
  ].filter((value):value is string=>!!value);
  return clauses.length?clauses.join('. ')+'.':'No official relationship standing has yet been established.';
}

function battleLabel(entry:PlayerChronicleEntry,snapshot:LeagueSnapshot){
  const event=entry.eventId?snapshot.events.find(candidate=>candidate.eventId===entry.eventId):null;
  if(event?.title)return event.title;
  const match=snapshot.matches.find(candidate=>candidate.matchId===entry.battleId);
  return match?.format?`${formatName(match.format)} Battle`:'League Battle';
}

function recordLabel(code:string){
  return code.toLowerCase().split('_').map(word=>word.charAt(0).toUpperCase()+word.slice(1)).join(' ');
}

function recordValue(record:{value?:number|null;unit?:string}){
  if(record.value==null)return 'Held';
  if(record.unit==='seconds'){
    const seconds=Math.round(record.value),minutes=Math.floor(seconds/60);
    return `${minutes}:${String(seconds%60).padStart(2,'0')}`;
  }
  return `${record.value}${record.unit?` ${record.unit}`:''}`;
}

function SelfPage({profile}:{profile:PlayerProfile}){
  const achievements=profile.achievementCollection??profile.achievements;
  const records=profile.chronicleShowcase?.selectedRecords??[];
  return <section className="chronicle-self-page" aria-label="Personal Chronicle page">
    <header className="chronicle-title chronicle-self-title">
      <span className="eyebrow">PERSONAL LEAF</span>
      <h2>{profile.player.steamName}</h2>
      <p>Honours and records kept apart from the relationship leaves of the Chronicle.</p>
    </header>
    <div className="chronicle-self-grid">
      <section className="chronicle-honours">
        <div className="chronicle-section-heading"><Medal size={18}/><div><span className="eyebrow">ACHIEVEMENTS</span><h3>Honours entered in the book</h3></div></div>
        {achievements.length?<ol>{achievements.map(achievement=><li key={achievement.awardId}>
          <Trophy size={15}/><div><strong>{achievement.name}</strong>{achievement.description&&<p>{achievement.description}</p>}{achievement.firstAwardedAt&&<time>{new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'}).format(new Date(achievement.firstAwardedAt))}</time>}</div>
        </li>)}</ol>:<p className="chronicle-reserved-copy">No achievements have yet been entered on this leaf.</p>}
      </section>
      <section className="chronicle-selected-records">
        <div className="chronicle-section-heading"><ScrollText size={18}/><div><span className="eyebrow">SELECTED RECORDS</span><h3>Marks worth keeping close</h3></div></div>
        {records.length?<ol>{records.map(record=><li key={record.code}><strong>{recordLabel(record.code)}</strong><span>{recordValue(record)}</span></li>)}</ol>:<p className="chronicle-reserved-copy">This space is reserved for records selected for the personal Chronicle.</p>}
      </section>
    </div>
  </section>;
}

function RelationshipPage({owner,counterpart,page,official,snapshot,partial,freshEntryIds}:{
  owner:PlayerRecord;counterpart:PlayerRecord;page:PlayerChronicleRelationshipPage|null;official:PlayerRelationshipSummary|null;
  snapshot:LeagueSnapshot;partial:boolean;freshEntryIds:Set<string>;
}){
  const entries=page?.entries??[];
  return <section className="chronicle-relationship-page" aria-label={`Chronicle with ${counterpart.steamName}`}>
    <header className="chronicle-title">
      <span className="eyebrow">RELATIONSHIP CHRONICLE</span>
      <h2>{owner.steamName} <span>&amp;</span> {counterpart.steamName}</h2>
      <p>The written record follows qualified Battle evidence. Missing evidence is never treated as peace, loyalty, damage or intent.</p>
    </header>
    <aside className="chronicle-standing" aria-label="Official relationship standing">
      <span className="eyebrow">PRESENT STANDING</span>
      <p>{officialStanding(official)}</p>
    </aside>
    {entries.length?<ol className="chronicle-entries">{entries.map((entry,index)=><li className={`chronicle-entry ${index%2===0?'entry-left':'entry-right'}${freshEntryIds.has(entry.entryId)?' is-new':''}`} key={entry.entryId}>
      <article className="chronicle-entry-card">
        <span className="eyebrow">{entry.rubric}</span>
        <h4>{entry.title}</h4>
        {entry.paragraphs.map((paragraph,paragraphIndex)=><p key={paragraphIndex}>{paragraph}</p>)}
        <footer className="chronicle-entry-signature"><span>{battleLabel(entry,snapshot)}</span><time>{compactDate(entry.playedAtMs)}</time></footer>
      </article>
    </li>)}</ol>:<div className="chronicle-empty-leaf"><BookOpen size={28}/><h3>This leaf remains unwritten.</h3><p>No qualified social event has yet earned an entry between {owner.steamName} and {counterpart.steamName}. The bookmark remains because every league relationship has a place in the book.</p></div>}
    {partial&&<footer className="chronicle-coverage-note">Some accepted Battles could not be read into the current evidence ledger. This Chronicle does not interpret those gaps as silence or non-interaction.</footer>}
  </section>;
}

export function PlayerChronicleBook({repository,snapshot,sourceProfile,initialPagePlayerId,onClose}:PlayerChronicleBookProps){
  const dialogRef=useRef<HTMLDialogElement>(null);
  const ownerId=snapshot.viewer?.playerId??'';
  const [ownerProfile,setOwnerProfile]=useState<PlayerProfile|null>(sourceProfile.player.playerId===ownerId?sourceProfile:null);
  const [social,setSocial]=useState<SocialHistoryResponse|null>(null);
  const [selectedPlayerId,setSelectedPlayerId]=useState(initialPagePlayerId||ownerId);
  const [freshEntryIds,setFreshEntryIds]=useState<Set<string>>(()=>new Set());
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  const players=useMemo(()=>{
    const byId=new Map(snapshot.players.map(player=>[player.playerId,player]));
    if(snapshot.viewer)byId.set(snapshot.viewer.playerId,snapshot.viewer);
    if(!byId.has(sourceProfile.player.playerId))byId.set(sourceProfile.player.playerId,sourceProfile.player);
    const owner=ownerId?byId.get(ownerId):null;
    const others=[...byId.values()].filter(player=>player.playerId!==ownerId).sort((left,right)=>left.steamName.localeCompare(right.steamName));
    return owner?[owner,...others]:others;
  },[snapshot.players,snapshot.viewer,sourceProfile.player,ownerId]);

  useEffect(()=>{
    const dialog=dialogRef.current;
    if(!dialog)return;
    const previous=document.activeElement as HTMLElement|null;
    if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
    return ()=>{if(typeof dialog.close==='function'&&dialog.open)dialog.close();else dialog.removeAttribute('open');previous?.focus();};
  },[]);

  useEffect(()=>{
    if(!ownerId){setError('The Chronicle needs a signed-in player.');setLoading(false);return;}
    let active=true;
    setLoading(true);setError('');
    const profilePromise=ownerProfile?Promise.resolve(ownerProfile):repository.player(ownerId);
    const socialPromise=repository.socialHistory?repository.socialHistory():Promise.resolve(null);
    Promise.all([profilePromise,socialPromise]).then(([profile,history])=>{
      if(!active)return;
      setOwnerProfile(profile);
      setSocial(history);
    }).catch(reason=>{
      if(!active)return;
      setError(reason instanceof Error?reason.message:'The Chronicle could not be opened.');
    }).finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[repository,ownerId]);

  const selectedPlayer=players.find(player=>player.playerId===selectedPlayerId)??players[0]??null;
  const isSelf=selectedPlayer?.playerId===ownerId;
  const page=!isSelf&&selectedPlayer?social?.chronicle.pages.find(candidate=>candidate.counterpartPlayerId===selectedPlayer.playerId)??null:null;
  const official=!isSelf&&selectedPlayer&&ownerProfile
    ? ownerProfile.relationships?.find(relationship=>relationship.otherPlayer.playerId===selectedPlayer.playerId)??null
    : null;
  const entrySignature=page?.entries.map(entry=>entry.entryId).join('|')??'';

  useEffect(()=>{
    if(!page||typeof window==='undefined'){setFreshEntryIds(new Set());return;}
    const key=`aof:chronicle-seen:${ownerId}:${page.counterpartPlayerId}`;
    const ids=page.entries.map(entry=>entry.entryId);
    try{
      const stored=window.localStorage.getItem(key);
      if(stored==null){
        window.localStorage.setItem(key,JSON.stringify(ids));
        setFreshEntryIds(new Set());
        return;
      }
      const parsed=JSON.parse(stored);
      const seen=new Set(Array.isArray(parsed)?parsed.filter((value):value is string=>typeof value==='string'):[]);
      setFreshEntryIds(new Set(ids.filter(id=>!seen.has(id))));
      window.localStorage.setItem(key,JSON.stringify(ids));
    }catch{setFreshEntryIds(new Set());}
  },[ownerId,page?.counterpartPlayerId,entrySignature]);

  return <dialog ref={dialogRef} className="relationship-chronicle-dialog" aria-labelledby="player-chronicle-title" onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
    <button type="button" className="chronicle-close" aria-label="Close Chronicle" onClick={onClose}><X size={23}/></button>
    <div className="chronicle-scroll-stage">
      <nav className="chronicle-bookmarks" aria-label="Chronicle pages">{players.map(player=>{
        const self=player.playerId===ownerId,active=player.playerId===selectedPlayer?.playerId;
        return <button type="button" aria-pressed={active} className={`chronicle-bookmark ${self?'bookmark-self':`bookmark-cloth-${clothIndex(player.playerId)}`}${active?' active':''}`} onClick={()=>setSelectedPlayerId(player.playerId)} title={self?'Open your personal Chronicle leaf':`Open your Chronicle with ${player.steamName}`} key={player.playerId}>
          <span className="bookmark-monogram" aria-hidden="true">{self?'✦':monogram(player.steamName)}</span>
          <span className="bookmark-player-name">{self?'My record':player.steamName}</span>
        </button>;
      })}</nav>
      <article className="chronicle-parchment">
        <div className="chronicle-seal" aria-hidden="true"><BookOpen size={24}/></div>
        <span className="chronicle-book-owner" id="player-chronicle-title">{ownerProfile?.player.steamName??snapshot.viewer?.steamName??'Player'}'s Chronicle</span>
        {loading?<div className="chronicle-loading" role="status"><BookOpen size={30}/><p>Opening the record…</p></div>
          :error?<div className="chronicle-loading" role="alert"><p>{error}</p></div>
          :ownerProfile&&selectedPlayer?(isSelf
            ?<SelfPage profile={ownerProfile}/>
            :<RelationshipPage owner={ownerProfile.player} counterpart={selectedPlayer} page={page} official={official} snapshot={snapshot} partial={social?.status==='PARTIAL'} freshEntryIds={freshEntryIds}/>)
          :<div className="chronicle-loading"><p>The Chronicle has no page to show.</p></div>}
      </article>
    </div>
  </dialog>;
}
