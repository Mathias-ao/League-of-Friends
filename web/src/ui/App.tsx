import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowRight,ChevronLeft,ChevronRight,Pause,Play,Shield,Swords,Users,ChartNoAxesCombined,Lock,Flag,LogOut,BookOpen,Check,LoaderCircle} from 'lucide-react';
import {emptySnapshot,type LeagueRepository,type LeagueSnapshot,type Page,type EventDetail,type MatchDetail,type PlayerProfile} from '../domain/league';
import {lombardia,brand} from '../data/content';
import {Avatar,Empty,Modal,Sigil} from './Primitives';
import {SeasonView,EventsView,BattlesView,PlayersView,WarRoomView,StatisticsView,EventDialog,MatchDialog,ProfileDialog} from './Views';
const pages:{id:Page;label:string;icon:typeof Shield}[]=[
  {id:'season',label:'Season',icon:Shield},{id:'events',label:'Events',icon:Flag},{id:'battles',label:'Battles',icon:Swords},
  {id:'players',label:'Players',icon:Users},{id:'war-room',label:'War Room',icon:Lock},{id:'statistics',label:'Statistics',icon:ChartNoAxesCombined}
];
export interface ViewProps {
  snapshot:LeagueSnapshot;preview:boolean;busy:boolean;repository:LeagueRepository;
  openEvent:(id:string)=>void;openMatch:(id:string)=>void;openPlayer:(id:string)=>void;
  act:(action:()=>Promise<void>,message:string)=>Promise<boolean>;enter:()=>void;navigate:(page:Page)=>void;
}
type DialogState={type:'login'}|{type:'rules'}|{type:'story'}|{type:'account'}|{type:'event';data:EventDetail}|{type:'match';data:MatchDetail}|{type:'player';data:PlayerProfile}|null;
function readPage():Page{return pages.find(p=>'#'+p.id===location.hash)?.id??'season';}
export function App({repository}:{repository:LeagueRepository}){
  const [snapshot,setSnapshot]=useState(emptySnapshot),[page,setPage]=useState<Page>(readPage),[dialog,setDialog]=useState<DialogState>(null);
  const [actionBusy,setBusy]=useState(false),[detailBusy,setDetailBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const generation=useRef(0),authEpoch=useRef(0),detailRequest=useRef(0),working=useRef(false);
  const preview=repository.mode==='preview',busy=actionBusy||detailBusy;
  const refresh=useCallback(async()=>{
    const id=++generation.current;
    try{const data=await repository.load();if(id===generation.current){setSnapshot(data);setError('');}return true;}
    catch(e){if(id===generation.current){setSnapshot(emptySnapshot());setDialog(null);setError(errorMessage(e));}return false;}
    finally{if(id===generation.current)setLoading(false);}
  },[repository]);
  useEffect(()=>{
    void refresh();
    const unsubscribe=repository.onAuthChange(()=>{authEpoch.current++;detailRequest.current++;setDetailBusy(false);setSnapshot(emptySnapshot());setDialog(null);setLoading(true);void refresh();});
    return ()=>{generation.current++;authEpoch.current++;detailRequest.current++;unsubscribe();};
  },[repository,refresh]);
  useEffect(()=>{const fn=()=>{detailRequest.current++;setDetailBusy(false);setPage(readPage());setDialog(null);};addEventListener('hashchange',fn);return ()=>removeEventListener('hashchange',fn);},[]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),6000);return ()=>clearTimeout(timer);},[notice]);
  const navigate=(next:Page)=>{detailRequest.current++;setDetailBusy(false);location.hash=next;setPage(next);setDialog(null);};
  const act=async(action:()=>Promise<void>,message:string)=>{
    if(working.current)return false;working.current=true;setBusy(true);setError('');
    try{await action();const loaded=await refresh();if(loaded)setNotice(message+(preview?' (Preview only.)':''));return loaded;}
    catch(e){setError(errorMessage(e));return false;}
    finally{working.current=false;setBusy(false);}
  };
  const detail=async(type:'event'|'match'|'player',id:string)=>{
    if(!preview&&snapshot.membership!=='ACTIVE'){setDialog({type:'login'});return;}
    const request=++detailRequest.current,epoch=authEpoch.current;setDetailBusy(true);
    try{
      const result:DialogState=type==='event'?{type,data:await repository.event(id)}:type==='match'?{type,data:await repository.match(id)}:{type,data:await repository.player(id)};
      if(request===detailRequest.current&&epoch===authEpoch.current)setDialog(result);
    }catch(e){if(request===detailRequest.current&&epoch===authEpoch.current)setError(errorMessage(e));}
    finally{if(request===detailRequest.current)setDetailBusy(false);}
  };
  const enter=()=>{
    if(snapshot.membership!=='ACTIVE'){setDialog({type:'login'});return;}
    if(snapshot.season)void act(()=>repository.enterSeason(snapshot.season!.seasonId),'You have entered the season.');
  };
  const openEvent=(id:string)=>{void detail('event',id);},openMatch=(id:string)=>{void detail('match',id);},openPlayer=(id:string)=>{void detail('player',id);};
  const next=snapshot.events.find(e=>e.status==='ACTIVE')??snapshot.events.find(e=>e.status==='PUBLISHED'&&(!e.startsAt||Date.parse(e.startsAt)>=Date.now()));
  const actionLabel=snapshot.membership==='SIGNED_OUT'?'Join the league':snapshot.membership!=='ACTIVE'?'Your membership':!snapshot.enteredSeason?'Enter the season':next?.viewer?.rsvp==='UNANSWERED'?'Answer the call':null;
  const props:ViewProps={snapshot,preview,busy,repository,openEvent,openMatch,openPlayer,act,enter,navigate};
  const title=dialog?.type==='login'?'Raise your banner':dialog?.type==='rules'?'The rules of the campaign':dialog?.type==='story'?'The War for Lombardia':dialog?.type==='account'?'Your league identity':dialog?.type==='event'?dialog.data.event.title:dialog?.type==='match'?'Battle details':dialog?.type==='player'?dialog.data.player.steamName:'';
  return <><a className="skip" href="#main-content">Skip to content</a>
    {preview&&<div className="preview-bar"><span>DESIGN PREVIEW</span> Sample standings and battles · Changes last only for this visit.</div>}
    <header className="site-header"><div className="header-inner">
      <div className="header-action">{actionLabel&&<button className="action-ribbon" onClick={()=>snapshot.enteredSeason&&next?openEvent(next.eventId):enter()}><Flag size={16}/>{actionLabel}</button>}</div>
      <a className="brand" href="#season"><span className="brand-top">{brand.name}</span><span className="brand-bottom">AN AGE OF EMPIRES II LEAGUE</span></a>
      <div className="header-account">{snapshot.viewer?<button className="profile-button" onClick={()=>setDialog({type:'account'})}><Avatar player={snapshot.viewer}/><span>{snapshot.viewer.steamName}</span></button>:<button className="sign-in" onClick={()=>setDialog({type:'login'})}><Shield size={16}/>Sign in</button>}</div>
    </div></header>
    <div className="site-shell"><Hero onStory={()=>setDialog({type:'story'})} onEvent={()=>next?openEvent(next.eventId):setDialog({type:'story'})}/>
      <nav className="main-nav" aria-label="League navigation">{pages.map(({id,label,icon:Icon})=><a key={id} href={'#'+id} aria-current={page===id?'page':undefined} className={page===id?'active':''}><Icon size={17} strokeWidth={1.4}/><span>{label}</span></a>)}</nav>
      <main id="main-content" tabIndex={-1}>
        {error&&<div className="alert" role="alert"><span>{error}</span><button onClick={()=>void refresh()}>Retry</button><button aria-label="Dismiss error" onClick={()=>setError('')}>×</button></div>}
        {loading?<div className="loading" role="status"><LoaderCircle className="spin"/>Gathering the banners…</div>:!preview&&snapshot.membership!=='ACTIVE'?
          <section className="section"><Empty title={snapshot.membership==='PENDING'?'Your banner awaits approval':snapshot.membership==='SUSPENDED'?'Membership suspended':snapshot.membership==='INACTIVE'?'Membership inactive':'The league is private'}>
            {snapshot.membership==='PENDING'?'Your membership request awaits the league administrator’s approval.':snapshot.membership==='INACTIVE'||snapshot.membership==='SUSPENDED'?'Contact the league administrator to restore access.':'Sign in to see your standings, the event roster and your next battle.'}
          </Empty><div className="center"><button className="primary" onClick={()=>setDialog({type:'login'})}>{snapshot.membership==='SIGNED_OUT'?'Sign in':'Your membership'}</button></div></section>:
          page==='season'?<SeasonView {...props} onRules={()=>setDialog({type:'rules'})}/>:
          page==='events'?<EventsView {...props}/>:page==='battles'?<BattlesView {...props}/>:page==='players'?<PlayersView {...props}/>:page==='war-room'?<WarRoomView/>:<StatisticsView/>}
      </main>
      <footer className="site-footer"><span>AGE OF FRIENDS · SEASON I</span><span>A private Age of Empires II: DE league</span></footer>
    </div>
    {notice&&<div className="toast" role="status"><Check size={17}/>{notice}</div>}
    {busy&&<div className="working" role="status"><LoaderCircle size={16} className="spin"/>Working…</div>}
    {dialog&&<Modal key={dialog.type} title={title} wide={['event','match','player'].includes(dialog.type)} onClose={()=>{detailRequest.current++;setDetailBusy(false);setDialog(null);setError('');}}>
      {error&&<div className="alert" role="alert">{error}</div>}
      {dialog.type==='login'?<MembershipForm snapshot={snapshot} repository={repository} preview={preview} busy={busy} act={act} onClose={()=>setDialog(null)}/>:
       dialog.type==='rules'?<Rules/>:dialog.type==='story'?<article className="story"><span className="eyebrow">EVENT I · LOMBARDIA</span>{lombardia.story.brief.map(p=><p key={p}>{p}</p>)}<div className="story-facts"><span>4v4</span><span>Lombardia</span><span>Standard Victory</span></div></article>:
       dialog.type==='account'?<><div className="account-heading">{snapshot.viewer&&<Avatar player={snapshot.viewer} large/>}<div><h3>{snapshot.viewer?.steamName}</h3><p>{snapshot.membership==='ACTIVE'?'League member':snapshot.membership.toLowerCase()}</p></div></div><p>Your league identity persists between seasons.</p><div className="stack">{snapshot.membership==='ACTIVE'&&<button className="primary" onClick={()=>snapshot.viewer&&openPlayer(snapshot.viewer.playerId)}>View profile</button>}<button className="text-button" onClick={()=>void act(()=>repository.signOut(),'Signed out.')}><LogOut size={16}/>Sign out</button></div></>:
       dialog.type==='event'?<EventDialog {...props} data={dialog.data} onUpdated={()=>openEvent(dialog.data.event.eventId)}/>:
       dialog.type==='match'?<MatchDialog {...props} data={dialog.data} onUpdated={()=>openMatch(dialog.data.match.matchId)}/>:
       <ProfileDialog {...props} data={dialog.data}/>}
    </Modal>}
  </>;
}
function Hero({onStory,onEvent}:{onStory:()=>void;onEvent:()=>void}){
  const [slide,setSlide]=useState(0),[paused,setPaused]=useState(false),[interacting,setInteracting]=useState(false),[imageFailed,setImageFailed]=useState(false);
  const artwork=import.meta.env.VITE_HERO_IMAGE_URL as string|undefined;
  useEffect(()=>{if(paused||interacting||matchMedia('(prefers-reduced-motion: reduce)').matches)return;const timer=setInterval(()=>setSlide(s=>1-s),12000);return ()=>clearInterval(timer);},[paused,interacting]);
  const change=()=>{setSlide(s=>1-s);setPaused(true);};
  return <section className="hero" aria-label="League news" aria-roledescription="carousel" onMouseEnter={()=>setInteracting(true)} onMouseLeave={()=>setInteracting(false)} onFocus={()=>setInteracting(true)} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setInteracting(false);}}>
    {artwork&&!imageFailed&&<img src={artwork} alt="The Lombardy campaign" fetchPriority="high" onError={()=>setImageFailed(true)}/>}
    <div className="hero-shade"/><div className="hero-content" key={slide}><span className="eyebrow">{slide===0?'SEASON I · THE FIRST CAMPAIGN':'EVENT I · THE CALL TO WAR'}</span><h2>{slide===0?<>THE FIEFDOM<br/>OF BAD NEIGHBORS</>:<>LOMBARDIA<br/>STANDS DIVIDED</>}</h2><p>{slide===0?'Good fences make good neighbors. Castles make better ones.':'Eight factions. Two grand alliances. One battlefield.'}</p><button className="hero-link" onClick={slide===0?onStory:onEvent}>{slide===0?'Read the opening story':'Answer the call'}<ArrowRight size={17}/></button></div>
    <div className="hero-bottom"><span className="hero-caption">THE ROAD TO MILAN</span><div className="carousel-controls"><button aria-label="Previous story" onClick={change}><ChevronLeft size={17}/></button>{[0,1].map(i=><button key={i} className={'slide-dot '+(slide===i?'active':'')} aria-label={'Show story '+(i+1)} aria-pressed={slide===i} onClick={()=>{setSlide(i);setPaused(true);}}/>)}<button aria-label="Next story" onClick={change}><ChevronRight size={17}/></button><button aria-label={paused?'Play stories':'Pause stories'} onClick={()=>setPaused(!paused)}>{paused?<Play size={13}/>:<Pause size={13}/>}</button></div></div>
  </section>;
}
function MembershipForm({snapshot,preview,busy,repository,act,onClose}:{snapshot:LeagueSnapshot;preview:boolean;busy:boolean;repository:LeagueRepository;act:ViewProps['act'];onClose:()=>void}){
  const [name,setName]=useState(''),[discord,setDiscord]=useState('');
  if(snapshot.membership==='SIGNED_OUT')return <div className="login-body"><Sigil size={42}/><p>Join the league once. Enter each season. Answer the call to battle.</p>{preview&&<p className="subtle-box">This preview uses an example player. No account is created and no league data is changed.</p>}<button className="primary full" disabled={busy} onClick={async()=>{if(await act(()=>repository.signIn(),preview?'Preview player selected.':'Signed in.'))onClose();}}>{preview?'Explore as D’Karius':'Continue with Google'}<ArrowRight size={16}/></button></div>;
  if(snapshot.membership==='UNLINKED')return <form className="form" onSubmit={async e=>{e.preventDefault();if(await act(()=>repository.requestMembership(name.trim(),discord.trim()),'Membership request sent.'))onClose();}}><p>Your Steam name connects your identity to your Games.</p><label>Steam name<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)} autoComplete="nickname"/></label><label>Discord name (optional)<input maxLength={100} value={discord} onChange={e=>setDiscord(e.target.value)}/></label><button className="primary" disabled={busy||!name.trim()}>Request league membership</button></form>;
  return <><Empty title={snapshot.membership==='PENDING'?'Awaiting approval':snapshot.membership==='ACTIVE'?'Your banner is raised':'Membership unavailable'}>{snapshot.membership==='PENDING'?'The league administrator will review your request.':snapshot.membership==='ACTIVE'?'You can enter the season and sign up for events.':'Contact the league administrator.'}</Empty><button className="text-button" onClick={()=>void act(()=>repository.signOut(),'Signed out.')}>Sign out</button></>;
}
function Rules(){
  const rows=[
    ['The campaign','League → Season → Event → Match → Game. Each recording represents one Game; a Match can contain multiple Games.'],
    ['Raise your banner','Join the league once, enter each season separately, then answer each event invitation. Check in on event day.'],
    ['The two acts','Act I is a 1v1 warm-up of approximately 30 minutes. Act II is the main event. The approved Game plan determines opponents and teams.'],
    ['Civilizations','Civilizations are unique within each Game. Duplicates are allowed across separate Games. A captain is chosen randomly where needed.'],
    ['After the battle','Keep your .aoe2record locally. Upload it when replay submission is available. There are no manual post-match statistics forms.'],
    ['Results and corrections','Qualified results become final directly. Use the small dispute option on a completed Game to request a correction.'],
    ['Points and legacy','League Points, War Room Points, relationship progression and Gold are separate. Season points reset; your player identity persists.']
  ];
  return <div className="rules">{rows.map(([heading,body])=><section key={heading}><h3>{heading}</h3><p>{body}</p></section>)}</div>;
}
function errorMessage(error:unknown){
  if(error instanceof Error){if(error.message.includes('popup-closed'))return 'Sign-in was closed. Try again when you’re ready.';if(error.message.includes('popup-blocked'))return 'Allow the sign-in window in your browser, then try again.';return error.message;}
  return 'Something went wrong. Please try again.';
}
