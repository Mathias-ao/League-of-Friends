import {useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import {BookOpen,Medal,ScrollText,Trophy,X} from 'lucide-react';
import type {
  LeagueRepository,LeagueSnapshot,PlayerChronicleBookEntry,PlayerChronicleBookPage,
  PlayerProfile,PlayerRecord,PlayerRelationshipSummary,PlayerChronicleResponse
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

function hashValue(value:string){
  let result=2166136261;
  for(const character of value)result=Math.imul(result^character.codePointAt(0)!,16777619);
  return result>>>0;
}

function uniqueBookmarkTones(players:PlayerRecord[],ownerId:string){
  const result=new Map<string,{a:string;b:string}>(),used:number[]=[];
  const others=players.filter(player=>player.playerId!==ownerId).sort((a,b)=>a.playerId.localeCompare(b.playerId));
  const minDistance=Math.max(12,Math.min(34,280/Math.max(1,others.length)));
  const distance=(a:number,b:number)=>Math.min(Math.abs(a-b),360-Math.abs(a-b));
  for(const player of others){
    let hue=hashValue(player.playerId)%360,attempt=0;
    while(used.some(existing=>distance(existing,hue)<minDistance)&&attempt<32){hue=(hue+137.508)%360;attempt++;}
    used.push(hue);
    const saturation=24+(hashValue(player.playerId+':s')%8),lightness=33+(hashValue(player.playerId+':l')%5);
    result.set(player.playerId,{
      a:'hsl('+hue.toFixed(1)+' '+saturation+'% '+lightness+'%)',
      b:'hsl('+hue.toFixed(1)+' '+Math.min(38,saturation+4)+'% '+Math.max(18,lightness-14)+'%)',
    });
  }
  return result;
}

type RelationshipDepth={rank:number;dormant:boolean};
type RelationshipTrackKey='rivalry'|'hostility'|'bond';

const CHRONICLE_STAGE_DEPTHS:Record<RelationshipTrackKey,Record<string,number>>={
  rivalry:{friction:1,contest:2,rivalry:3,nemesis:4},
  hostility:{tension:1,grudge:2,feud:3,'blood feud':4,'internecine strife':5},
  bond:{fellowship:1,comrades:2,'trusted allies':3,oathbound:4},
};

function relationshipDepth(track:{state:string;stageId:string|null;historicalPeakStageId:string|null},key:RelationshipTrackKey):RelationshipDepth{
  const stage=(track.stageId??track.historicalPeakStageId??'').trim().toLowerCase();
  const rank=CHRONICLE_STAGE_DEPTHS[key][stage]??0;
  return {rank,dormant:rank>0&&(track.state==='DORMANT'||(!track.stageId&&!!track.historicalPeakStageId))};
}

function pickLine(lines:readonly string[],seed:string){
  return lines[hashValue(seed)%lines.length]!;
}

function depthBucket(value:number){return value<=1?0:value===2?1:value===3?2:3;}

const RIVALRY_LINES=[
  ['Something between them has begun to sharpen.','The first edge of competition has begun to show.'],
  ['Neither has gone long without measuring the other.','The measure between them is becoming a habit.'],
  ['Each meeting now carries the weight of the last.','The contest now arrives with history behind it.'],
  ['Too much has passed between them for any meeting to feel ordinary.','Neither enters another meeting without history already waiting on the page.'],
] as const;

const HOSTILITY_LINES=[
  ['There is already an edge between them.','A little strain has already found its way onto the page.'],
  ['The quarrel has found enough history to endure.','What lies between them is no longer a passing irritation.'],
  ['What began as strain has become difficult to leave behind.','Each new meeting inherits something from the quarrel before it.'],
  ['The old quarrel now follows them from battle to battle.','The quarrel has become one of the book’s enduring wounds.'],
  ['The quarrel has passed beyond any ordinary measure.','Whatever this once was, the ordinary scale no longer contains it.'],
] as const;

const BOND_LINES=[
  ['They have begun to stand well together.','The first signs of dependable company are already on the page.'],
  ['Standing together is no longer unusual.','Shared cause has begun to become familiar ground.'],
  ['Again and again, they have answered the same call.','Their history now carries the weight of repeated support.'],
  ['What binds their histories has become difficult to separate.','Few pages between them can be read without seeing what binds them.'],
] as const;

type ChronicleFlavor='neutral'|'rivalry'|'hostility'|'bond'|'mixed';
type ChronicleMarker='origin'|'contest'|'support'|'common'|'diplomacy'|'fracture'|'crown'|'record';

function relationshipFlavor(relationship:PlayerRelationshipSummary|null):ChronicleFlavor{
  if(!relationship?.relationshipRulesConfigured)return 'neutral';
  const present:(Exclude<ChronicleFlavor,'neutral'|'mixed'>)[]=[];
  if(relationship.tracks.rivalry.stageId||relationship.tracks.rivalry.historicalPeakStageId)present.push('rivalry');
  if(relationship.tracks.hostility.stageId||relationship.tracks.hostility.historicalPeakStageId)present.push('hostility');
  if(relationship.tracks.bond.stageId||relationship.tracks.bond.historicalPeakStageId)present.push('bond');
  return present.length===1?present[0]:present.length>1?'mixed':'neutral';
}

function markerForEntry(entry:PlayerChronicleBookEntry):ChronicleMarker{
  const rubric=entry.rubric.toUpperCase();
  if(rubric.includes('FIRST'))return 'origin';
  if(rubric.includes('DUEL')||rubric.includes('CONTEST'))return 'contest';
  if(rubric.includes('SUPPORT')||rubric.includes('AID'))return 'support';
  if(rubric.includes('COMMON'))return 'common';
  if(rubric.includes('DIPLOMACY')||rubric.includes('DECLARATION'))return 'diplomacy';
  if(rubric.includes('WITHDRAWAL')||rubric.includes('OFFENSE')||rubric.includes('FRACTURE'))return 'fracture';
  if(rubric.includes('KING'))return 'crown';
  return 'record';
}

function ManuscriptSpine(){
  return <div className="chronicle-manuscript-spine" aria-hidden="true">
    <span className="chronicle-spine-cap cap-top"/>
    <svg className="chronicle-spine-pattern" width="58" height="100%" focusable="false">
      <defs>
        <pattern id="chronicle-spine-weave" width="58" height="76" patternUnits="userSpaceOnUse">
          <path className="spine-ink-line" d="M29 -8 C11 6 13 23 29 34 C45 45 47 62 29 84"/>
          <path className="spine-accent-line" d="M29 -8 C47 6 45 23 29 34 C13 45 11 62 29 84"/>
          <path className="spine-fine-line" d="M29 4 C22 11 22 19 29 26 C36 19 36 11 29 4 Z M29 42 C22 49 22 57 29 64 C36 57 36 49 29 42 Z"/>
          <circle className="spine-knot" cx="29" cy="34" r="3.2"/>
          <path className="spine-leaf" d="M20 16 C12 13 8 17 9 23 C14 22 19 20 23 17 M38 54 C46 51 50 55 49 61 C44 60 39 58 35 55"/>
        </pattern>
      </defs>
      <rect width="58" height="100%" fill="url(#chronicle-spine-weave)"/>
    </svg>
    <span className="chronicle-spine-cap cap-bottom"/>
  </div>;
}

function ChronicleSpineMarker({kind}:{kind:ChronicleMarker}){
  return <span className={`chronicle-spine-marker marker-${kind}`} aria-hidden="true">
    {kind==='contest'?<svg viewBox="0 0 32 32"><path d="M8 6l17 18M24 6L7 24M6 5l4 1-3 3zM26 5l-4 1 3 3zM5 26l5-1-4-4zM27 26l-5-1 4-4z"/></svg>
      :kind==='support'?<svg viewBox="0 0 32 32"><path d="M8 16c4-7 12-7 16 0-4 7-12 7-16 0zM12 16c2 3 6 3 8 0-2-3-6-3-8 0z"/></svg>
      :kind==='common'?<svg viewBox="0 0 32 32"><path d="M7 22l9-15 9 15H7zm5-2l4-7 4 7h-8z"/></svg>
      :kind==='diplomacy'?<svg viewBox="0 0 32 32"><path d="M10 26V6m1 2h13l-4 5 4 5H11"/></svg>
      :kind==='fracture'?<svg viewBox="0 0 32 32"><path d="M9 6l6 8-4 4 12 8M23 6l-6 8 4 4-12 8"/></svg>
      :kind==='crown'?<svg viewBox="0 0 32 32"><path d="M7 11l6 5 3-9 3 9 6-5-2 13H9L7 11zm3 16h12"/></svg>
      :kind==='origin'?<svg viewBox="0 0 32 32"><path d="M16 5l3 8 8 3-8 3-3 8-3-8-8-3 8-3 3-8z"/></svg>
      :<svg viewBox="0 0 32 32"><path d="M16 7l6 9-6 9-6-9 6-9z"/></svg>}
  </span>;
}

function battleLabel(entry:PlayerChronicleBookEntry,snapshot:LeagueSnapshot){
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
  owner:PlayerRecord;counterpart:PlayerRecord;page:PlayerChronicleBookPage|null;official:PlayerRelationshipSummary|null;
  snapshot:LeagueSnapshot;partial:boolean;freshEntryIds:Set<string>;
}){
  const entries=page?.entries??[];
  const flavor=relationshipFlavor(official);
  return <section className={`chronicle-relationship-page flavor-${flavor}`} aria-label={`Chronicle with ${counterpart.steamName}`}>
    <header className="chronicle-title">
      <span className="eyebrow">RELATIONSHIP CHRONICLE</span>
      <h2>{owner.steamName} <span>&amp;</span> {counterpart.steamName}</h2>
      <p>The written record follows qualified Battle evidence. Missing evidence is never treated as peace, loyalty, damage or intent.</p>
    </header>
    <aside className="chronicle-standing" aria-label="Official relationship standing">
      <span className="eyebrow">PRESENT STANDING</span>
      <p>{officialStanding(official)}</p>
    </aside>
    {entries.length?<div className="chronicle-manuscript">
      <ManuscriptSpine/>
      <ol className="chronicle-entries">{entries.map((entry,index)=><li className={`chronicle-entry${freshEntryIds.has(entry.entryId)?' is-new':''}`} key={entry.entryId}>
        <ChronicleSpineMarker kind={markerForEntry(entry)}/>
        <article className="chronicle-entry-card">
          <span className="eyebrow">{entry.rubric}</span>
          <h4>{entry.title}</h4>
          {entry.paragraphs.map((paragraph,paragraphIndex)=><p key={paragraphIndex}>{paragraph}</p>)}
          <footer className="chronicle-entry-signature"><span>{battleLabel(entry,snapshot)}</span><time>{compactDate(entry.playedAtMs)}</time></footer>
        </article>
      </li>)}</ol>
    </div>:<div className="chronicle-empty-leaf"><BookOpen size={28}/><h3>This leaf remains unwritten.</h3><p>No qualified social event has yet earned an entry between {owner.steamName} and {counterpart.steamName}. The bookmark remains because every league relationship has a place in the book.</p></div>}
    {partial&&<footer className="chronicle-coverage-note">Some accepted Battles could not be read into the current evidence ledger. This Chronicle does not interpret those gaps as silence or non-interaction.</footer>}
  </section>;
}

export function PlayerChronicleBook({repository,snapshot,sourceProfile,initialPagePlayerId,onClose}:PlayerChronicleBookProps){
  const dialogRef=useRef<HTMLDialogElement>(null);
  const ownerId=snapshot.viewer?.playerId??'';
  const [ownerProfile,setOwnerProfile]=useState<PlayerProfile|null>(sourceProfile.player.playerId===ownerId?sourceProfile:null);
  const [chronicleRead,setChronicleRead]=useState<PlayerChronicleResponse|null>(null);
  const [selectedPlayerId,setSelectedPlayerId]=useState(initialPagePlayerId||ownerId);
  const [freshEntryIds,setFreshEntryIds]=useState<Set<string>>(()=>new Set());
  const [profileLoading,setProfileLoading]=useState(sourceProfile.player.playerId!==ownerId);
  const [chronicleLoading,setChronicleLoading]=useState(true);
  const [profileError,setProfileError]=useState('');
  const [chronicleError,setChronicleError]=useState('');

  const players=useMemo(()=>{
    const byId=new Map(snapshot.players.map(player=>[player.playerId,player]));
    if(snapshot.viewer)byId.set(snapshot.viewer.playerId,snapshot.viewer);
    if(ownerProfile)byId.set(ownerProfile.player.playerId,ownerProfile.player);
    if(!byId.has(sourceProfile.player.playerId))byId.set(sourceProfile.player.playerId,sourceProfile.player);
    for(const relationship of ownerProfile?.relationships??[])if(!byId.has(relationship.otherPlayer.playerId))byId.set(relationship.otherPlayer.playerId,relationship.otherPlayer);
    for(const page of chronicleRead?.chronicle.pages??[]){
      if(byId.has(page.counterpartPlayerId))continue;
      byId.set(page.counterpartPlayerId,{playerId:page.counterpartPlayerId,steamName:chronicleRead?.names[page.counterpartPlayerId]??page.counterpartPlayerId});
    }
    const owner=ownerId?byId.get(ownerId):null;
    const others=[...byId.values()].filter(player=>player.playerId!==ownerId).sort((left,right)=>left.steamName.localeCompare(right.steamName));
    return owner?[owner,...others]:others;
  },[snapshot.players,snapshot.viewer,sourceProfile.player,ownerProfile,chronicleRead,ownerId]);

  useEffect(()=>{
    const dialog=dialogRef.current;
    if(!dialog)return;
    const previous=document.activeElement as HTMLElement|null;
    if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
    return ()=>{if(typeof dialog.close==='function'&&dialog.open)dialog.close();else dialog.removeAttribute('open');previous?.focus();};
  },[]);

  useEffect(()=>{
    setSelectedPlayerId(initialPagePlayerId||ownerId);
  },[initialPagePlayerId,ownerId]);

  useEffect(()=>{
    if(!ownerId){setProfileError('The Chronicle needs a signed-in player.');setProfileLoading(false);return;}
    if(sourceProfile.player.playerId===ownerId){
      setOwnerProfile(sourceProfile);setProfileError('');setProfileLoading(false);return;
    }
    let active=true;
    setProfileLoading(true);setProfileError('');
    repository.player(ownerId).then(profile=>{if(active)setOwnerProfile(profile);}).catch(reason=>{
      if(active)setProfileError(reason instanceof Error?reason.message:'The personal Chronicle leaf could not be read.');
    }).finally(()=>{if(active)setProfileLoading(false);});
    return ()=>{active=false;};
  },[repository,ownerId,sourceProfile]);

  useEffect(()=>{
    if(!ownerId){setChronicleError('The Chronicle needs a signed-in player.');setChronicleLoading(false);return;}
    if(!repository.playerChronicle){setChronicleError('The Chronicle read surface is unavailable.');setChronicleLoading(false);return;}
    let active=true;
    setChronicleLoading(true);setChronicleError('');
    repository.playerChronicle().then(history=>{if(active)setChronicleRead(history);}).catch(reason=>{
      if(active)setChronicleError(reason instanceof Error?reason.message:'The relationship Chronicle could not be read.');
    }).finally(()=>{if(active)setChronicleLoading(false);});
    return ()=>{active=false;};
  },[repository,ownerId]);

  const selectedPlayer=players.find(player=>player.playerId===selectedPlayerId)??players[0]??null;
  const isSelf=selectedPlayer?.playerId===ownerId;
  const page=!isSelf&&selectedPlayer?chronicleRead?.chronicle.pages.find(candidate=>candidate.counterpartPlayerId===selectedPlayer.playerId)??null:null;
  const official=!isSelf&&selectedPlayer&&ownerProfile
    ? ownerProfile.relationships?.find(relationship=>relationship.otherPlayer.playerId===selectedPlayer.playerId)??null
    : null;
  const entrySignature=page?.entries.map(entry=>entry.entryId).join('|')??'';
  const pageLoading=isSelf?profileLoading:profileLoading||chronicleLoading;
  const pageError=isSelf?profileError:profileError||chronicleError;

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
          <span className="bookmark-monogram" aria-hidden="true">{monogram(player.steamName)}</span>
          <span className="bookmark-player-name">{self?'My record':player.steamName}</span>
        </button>;
      })}</nav>
      <article className="chronicle-parchment">
        <div className="chronicle-seal" aria-hidden="true"><BookOpen size={24}/></div>
        <span className="chronicle-book-owner" id="player-chronicle-title">{ownerProfile?.player.steamName??snapshot.viewer?.steamName??'Player'}'s Chronicle</span>
        {pageLoading?<div className="chronicle-loading" role="status"><BookOpen size={30}/><p>Opening the record…</p></div>
          :pageError?<div className="chronicle-loading" role="alert"><p>{pageError}</p></div>
          :ownerProfile&&selectedPlayer?(isSelf
            ?<SelfPage profile={ownerProfile}/>
            :<RelationshipPage owner={ownerProfile.player} counterpart={selectedPlayer} page={page} official={official} snapshot={snapshot} partial={chronicleRead?.status==='PARTIAL'} freshEntryIds={freshEntryIds}/>)
          :<div className="chronicle-loading"><p>The Chronicle has no page to show.</p></div>}
      </article>
    </div>
  </dialog>;
}
