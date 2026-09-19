import {useCallback,useEffect,useRef,useState,type Ref} from 'react';
import {ArrowRight,ChevronLeft,ChevronRight,Pause,Play,Shield,Swords,Users,ChartNoAxesCombined,Lock,Flag,LogOut,Check,LoaderCircle} from 'lucide-react';
import {canBrowseLeague,emptySnapshot,type LeagueRepository,type LeagueSnapshot,type Page,type EventDetail,type MatchDetail,type PlayerProfile,type EmperorsFavorBatch} from '../domain/league';
import {lombardia,brand} from '../data/content';
import {Avatar,Modal,Sigil} from './Primitives';
import {SeasonView,EventsView,BattlesView,PlayersView,StatisticsView,EventDialog,MatchDialog,ProfileDialog} from './Views';
const pages:{id:Page;label:string;icon:typeof Shield;disabled?:boolean}[]=[
  {id:'season',label:'Season',icon:Shield},
  {id:'events',label:'Events',icon:Flag},
  {id:'battles',label:'Battles',icon:Swords},
  {id:'players',label:'Players',icon:Users},
  {id:'war-room',label:'War Room',icon:Lock,disabled:true},
  {id:'statistics',label:'Statistics',icon:ChartNoAxesCombined}
];
export interface ViewProps {
  snapshot:LeagueSnapshot;preview:boolean;busy:boolean;repository:LeagueRepository;
  openEvent:(id:string)=>void;openMatch:(id:string)=>void;openPlayer:(id:string)=>void;
  act:(action:()=>Promise<void>,message:string)=>Promise<boolean>;enter:()=>void;navigate:(page:Page)=>void;
}
type DialogState={type:'rules'}|{type:'story'}|{type:'account'}|{type:'favor-admin'}|{type:'favors';data:EmperorsFavorBatch}|{type:'event';data:EventDetail}|{type:'match';data:MatchDetail}|{type:'player';data:PlayerProfile}|null;
function pageFromHash():Page|null{return pages.find(p=>!p.disabled&&'#'+p.id===location.hash)?.id??null;}
function clearHash(){history.replaceState(null,'',location.pathname+location.search);}
export function App({repository}:{repository:LeagueRepository}){
  const [snapshot,setSnapshot]=useState(emptySnapshot),[page,setPage]=useState<Page>('season'),[sectionOpen,setSectionOpen]=useState(false),[dialog,setDialog]=useState<DialogState>(null);
  const [actionBusy,setBusy]=useState(false),[detailBusy,setDetailBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const generation=useRef(0),authEpoch=useRef(0),detailRequest=useRef(0),working=useRef(false),navRef=useRef<HTMLElement>(null),gateRef=useRef<HTMLElement>(null);
  const accessResolved=useRef(false),previousCanBrowse=useRef(false);
  const preview=repository.mode==='preview',busy=actionBusy||detailBusy,canBrowse=canBrowseLeague(snapshot);
  const leagueEntryVisible=loading||snapshot.membership!=='ACTIVE';
  const showSeasonGate=!loading&&snapshot.membership==='ACTIVE'&&!canBrowse;
  const refresh=useCallback(async()=>{
    const id=++generation.current;
    try{const data=await repository.load();if(id===generation.current){setSnapshot(data);setError('');}return true;}
    catch(e){if(id===generation.current){setSnapshot(emptySnapshot());setDialog(null);setError(errorMessage(e));}return false;}
    finally{if(id===generation.current)setLoading(false);}
  },[repository]);
  useEffect(()=>{
    void refresh();
    const unsubscribe=repository.onAuthChange(()=>{
      authEpoch.current++;detailRequest.current++;accessResolved.current=false;previousCanBrowse.current=false;
      setDetailBusy(false);setSnapshot(emptySnapshot());setDialog(null);setLoading(true);void refresh();
    });
    return ()=>{generation.current++;authEpoch.current++;detailRequest.current++;unsubscribe();};
  },[repository,refresh]);
  useEffect(()=>{
    const syncLocation=()=>{
      detailRequest.current++;setDetailBusy(false);setDialog(null);
      const next=pageFromHash();
      if(loading)return;
      if(!canBrowse){
        setPage('season');setSectionOpen(false);
        if(next)clearHash();
        if(snapshot.membership==='ACTIVE')requestAnimationFrame(()=>gateRef.current?.scrollIntoView({behavior:'smooth',block:'start'}));
        return;
      }
      setPage(next??'season');setSectionOpen(next!==null);
      if(next)requestAnimationFrame(()=>navRef.current?.scrollIntoView({behavior:'smooth',block:'start'}));
    };
    addEventListener('hashchange',syncLocation);addEventListener('popstate',syncLocation);
    return ()=>{removeEventListener('hashchange',syncLocation);removeEventListener('popstate',syncLocation);};
  },[canBrowse,loading,snapshot.membership]);
  useEffect(()=>{
    if(loading)return;
    if(!canBrowse){
      const requested=pageFromHash();
      previousCanBrowse.current=false;accessResolved.current=true;setPage('season');setSectionOpen(false);
      if(requested){clearHash();if(snapshot.membership==='ACTIVE')requestAnimationFrame(()=>gateRef.current?.scrollIntoView({block:'start'}));}
      return;
    }
    if(!accessResolved.current||!previousCanBrowse.current){
      const requested=pageFromHash();
      setPage(requested??'season');setSectionOpen(true);
      requestAnimationFrame(()=>navRef.current?.scrollIntoView({block:'start'}));
    }
    previousCanBrowse.current=true;accessResolved.current=true;
  },[canBrowse,loading,snapshot.membership]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),6000);return ()=>clearTimeout(timer);},[notice]);
  const openSection=(next:Page)=>{
    const target=pages.find(p=>p.id===next);
    if(!target||target.disabled)return;
    if(!canBrowse){
      detailRequest.current++;setDetailBusy(false);setPage('season');setSectionOpen(false);setDialog(null);clearHash();
      if(snapshot.membership==='ACTIVE')requestAnimationFrame(()=>gateRef.current?.scrollIntoView({behavior:'smooth',block:'start'}));
      return;
    }
    detailRequest.current++;setDetailBusy(false);setPage(next);setSectionOpen(true);setDialog(null);
    if(location.hash!=='#'+next)location.hash=next;
    requestAnimationFrame(()=>navRef.current?.scrollIntoView({behavior:'smooth',block:'start'}));
  };
  const returnHome=()=>{
    detailRequest.current++;setDetailBusy(false);setSectionOpen(false);setPage('season');setDialog(null);clearHash();
    scrollTo({top:0,behavior:'smooth'});
  };
  const navigate=(next:Page)=>openSection(next);
  const act=async(action:()=>Promise<void>,message:string)=>{
    if(working.current)return false;working.current=true;setBusy(true);setError('');
    try{await action();const loaded=await refresh();if(loaded)setNotice(message+(preview?' (Preview only.)':''));return loaded;}
    catch(e){setError(errorMessage(e));return false;}
    finally{working.current=false;setBusy(false);}
  };
  const generateFavors=async(batchName:string,count:number)=>{
    if(working.current)return;
    working.current=true;setBusy(true);setError('');
    try{
      const batch=await repository.generateEmperorsFavors(batchName,count);
      setDialog({type:'favors',data:batch});
      setNotice(`${batch.count} Emperor's Favors created. Print them now; the codes are not stored in readable form.`);
    }catch(e){setError(errorMessage(e));}
    finally{working.current=false;setBusy(false);}
  };
  const detail=async(type:'event'|'match'|'player',id:string)=>{
    if(!canBrowse){
      if(snapshot.membership==='ACTIVE')requestAnimationFrame(()=>gateRef.current?.scrollIntoView({behavior:'smooth',block:'start'}));
      return;
    }
    const request=++detailRequest.current,epoch=authEpoch.current;setDetailBusy(true);
    try{
      const result:DialogState=type==='event'?{type,data:await repository.event(id)}:type==='match'?{type,data:await repository.match(id)}:{type,data:await repository.player(id)};
      if(request===detailRequest.current&&epoch===authEpoch.current)setDialog(result);
    }catch(e){if(request===detailRequest.current&&epoch===authEpoch.current)setError(errorMessage(e));}
    finally{if(request===detailRequest.current)setDetailBusy(false);}
  };
  const enter=()=>{
    if(snapshot.membership!=='ACTIVE')return;
    if(snapshot.season)void act(()=>repository.enterSeason(snapshot.season!.seasonId),'You have entered the season.');
  };
  const openEvent=(id:string)=>{void detail('event',id);},openMatch=(id:string)=>{void detail('match',id);},openPlayer=(id:string)=>{void detail('player',id);};
  const next=snapshot.events.find(e=>e.status==='ACTIVE')??snapshot.events.find(e=>e.status==='PUBLISHED'&&(!e.startsAt||Date.parse(e.startsAt)>=Date.now()));
  const actionLabel=snapshot.membership==='ACTIVE'?(!snapshot.enteredSeason?'Enter the season':next?.viewer?.rsvp==='UNANSWERED'?'Answer the call':null):null;
  const props:ViewProps={snapshot,preview,busy,repository,openEvent,openMatch,openPlayer,act,enter,navigate};
  const title=dialog?.type==='rules'?'The rules of the campaign':dialog?.type==='story'?'The War for Lombardia':dialog?.type==='account'?'Your league identity':dialog?.type==='favor-admin'?"Issue Emperor's Favors":dialog?.type==='favors'?dialog.data.batchName:dialog?.type==='event'?dialog.data.event.title:dialog?.type==='match'?'Battle details':dialog?.type==='player'?dialog.data.player.steamName:'';
  const showContent=sectionOpen||showSeasonGate||(!leagueEntryVisible&&!!error);
  return <>
    <div className={leagueEntryVisible?'league-entry-underlay':''} inert={leagueEntryVisible}>
      {showContent&&<a className="skip" href="#main-content">Skip to content</a>}
      {preview&&<div className="preview-bar"><span>DESIGN PREVIEW</span> Sample standings and battles · Changes last only for this visit.</div>}
      <div className="landing-stage">
        <header className="site-header"><div className="header-inner">
          <div className="header-action">{actionLabel&&<button className="action-ribbon" onClick={()=>snapshot.enteredSeason&&next&&canBrowse?openEvent(next.eventId):enter()}><Flag size={16}/>{actionLabel}</button>}</div>
          <a className="brand" href="/" onClick={e=>{e.preventDefault();returnHome();}}><span className="brand-top">{brand.name}</span><span className="brand-bottom">AN AGE OF EMPIRES II LEAGUE</span></a>
          <div className="header-account">{snapshot.viewer?<button className="profile-button" onClick={()=>setDialog({type:'account'})}><Avatar player={snapshot.viewer}/><span>{snapshot.viewer.steamName}</span></button>:<span className="sign-in"><Shield size={16}/>League gate</span>}</div>
        </div></header>
        <Hero onStory={()=>setDialog({type:'story'})} onEvent={()=>next?openEvent(next.eventId):setDialog({type:'story'})}/>
      </div>
      <nav ref={navRef} className="main-nav stone-nav" aria-label="League navigation">
        {pages.map(({id,label,disabled})=>disabled?
          <span key={id} className="nav-item nav-disabled war-room-tab" aria-disabled="true" title="War Room sealed"><Lock size={15} strokeWidth={1.3}/><span>{label}</span></span>:
          <a key={id} className={'nav-item '+(!canBrowse?'nav-gated ':'')+(sectionOpen&&page===id?'active':'')} href={'#'+id} aria-current={sectionOpen&&page===id?'page':undefined} aria-disabled={!canBrowse||undefined} title={!canBrowse?'Enter the current season to unlock the league':undefined} onClick={e=>{e.preventDefault();openSection(id);}}><span>{label}</span></a>)}
      </nav>
      {showContent&&<div className="content-region"><div className="content-shell">
        <main id="main-content" tabIndex={-1}>
          {error&&!leagueEntryVisible&&<div className="alert" role="alert"><span>{error}</span><button onClick={()=>void refresh()}>Retry</button><button aria-label="Dismiss error" onClick={()=>setError('')}>×</button></div>}
          {loading?<div className="loading" role="status"><LoaderCircle className="spin"/>Gathering the banners…</div>:showSeasonGate?
            <SeasonAccessGate gateRef={gateRef} snapshot={snapshot} busy={busy} enter={enter}/>:
            page==='events'?<EventsView {...props}/>:page==='battles'?<BattlesView {...props}/>:page==='players'?<PlayersView {...props}/>:page==='statistics'?<StatisticsView/>:<SeasonView {...props} onRules={()=>setDialog({type:'rules'})}/>}
        </main>
        <footer className="site-footer"><span>AGE OF FRIENDS · SEASON I</span><span>A private Age of Empires II: DE league</span></footer>
      </div></div>}
    </div>
    {leagueEntryVisible&&<LeagueEntryGate snapshot={snapshot} loading={loading} preview={preview} busy={busy} repository={repository} act={act} error={error}/>} 
    {notice&&<div className="toast" role="status"><Check size={17}/>{notice}</div>}
    {busy&&<div className="working" role="status"><LoaderCircle size={16} className="spin"/>Working…</div>}
    {dialog&&<Modal key={dialog.type} title={title} wide={['event','match','player','favor-admin','favors'].includes(dialog.type)} onClose={()=>{detailRequest.current++;setDetailBusy(false);setDialog(null);setError('');}}>
      {error&&<div className="alert" role="alert">{error}</div>}
      {dialog.type==='rules'?<Rules/>:dialog.type==='story'?<article className="story"><span className="eyebrow">EVENT I · LOMBARDIA</span>{lombardia.story.brief.map(p=><p key={p}>{p}</p>)}<div className="story-facts"><span>4v4</span><span>Lombardia</span><span>Standard Victory</span></div></article>:
       dialog.type==='account'?<><div className="account-heading">{snapshot.viewer&&<Avatar player={snapshot.viewer} large/>}<div><h3>{snapshot.viewer?.steamName}</h3><p>{snapshot.membership==='ACTIVE'?'League member':snapshot.membership.toLowerCase()}</p></div></div><p>Your league identity persists between seasons.</p><div className="stack">{snapshot.membership==='ACTIVE'&&<button className="primary" onClick={()=>snapshot.viewer&&openPlayer(snapshot.viewer.playerId)}>View profile</button>}{snapshot.viewer?.role==='ADMIN'&&<button className="primary" onClick={()=>setDialog({type:'favor-admin'})}>Issue Emperor's Favors</button>}<button className="text-button" onClick={()=>void act(()=>repository.signOut(),'Signed out.')}><LogOut size={16}/>Sign out</button></div></>:
       dialog.type==='favor-admin'?<FavorGeneratorForm busy={busy} onGenerate={generateFavors}/>:
       dialog.type==='favors'?<FavorBatchSheet batch={dialog.data}/>:
       dialog.type==='event'?<EventDialog {...props} data={dialog.data} onUpdated={()=>openEvent(dialog.data.event.eventId)}/>:
       dialog.type==='match'?<MatchDialog {...props} data={dialog.data} onUpdated={()=>openMatch(dialog.data.match.matchId)}/>:
       <ProfileDialog {...props} data={dialog.data}/>}
    </Modal>}
  </>;
}
function LeagueEntryGate({snapshot,loading,preview,busy,repository,act,error}:{snapshot:LeagueSnapshot;loading:boolean;preview:boolean;busy:boolean;repository:LeagueRepository;act:ViewProps['act'];error:string}){
  const [name,setName]=useState(''),[discord,setDiscord]=useState(''),[favor,setFavor]=useState('');
  const favorReady=/^[A-HJ-NP-Z2-9]{6}$/.test(favor);
  const google=()=>{void act(()=>repository.signIn(),preview?'Preview identity selected.':'Signed in with Google.');};
  const signOut=()=>{void act(()=>repository.signOut(),'Signed out.');};
  if(loading)return <div className="league-entry-overlay"><section className="league-entry-slab" role="dialog" aria-modal="true" aria-labelledby="league-entry-title"><Shield className="league-entry-mark" strokeWidth={1}/><span className="eyebrow">AGE OF FRIENDS · PRIVATE LEAGUE</span><h1 id="league-entry-title">The league gate</h1><p className="league-entry-lead">The banners are being read.</p><div className="league-entry-loading"><LoaderCircle className="spin" size={17}/>Opening the ledger…</div></section></div>;
  if(snapshot.membership==='SIGNED_OUT')return <div className="league-entry-overlay"><section className="league-entry-slab" role="dialog" aria-modal="true" aria-labelledby="league-entry-title"><Shield className="league-entry-mark" strokeWidth={1}/><span className="eyebrow">AGE OF FRIENDS · PRIVATE LEAGUE</span><h1 id="league-entry-title">Enter the league</h1><p className="league-entry-lead">Raise a banner of your own, or return under the one you already carry. Your Google account keeps your league identity with you between visits.</p><div className="league-entry-rule"/><div className="league-entry-actions"><button className="league-entry-primary" disabled={busy} onClick={google}>Sign up for the league<ArrowRight size={18}/></button><button className="league-entry-secondary" disabled={busy} onClick={google}>Already a member? Sign in with Google</button></div>{error&&<div className="league-entry-error" role="alert">{error}</div>}<p className="league-entry-note">One league identity. Season entry comes next.</p></section></div>;
  if(snapshot.membership==='UNLINKED')return <div className="league-entry-overlay"><section className="league-entry-slab" role="dialog" aria-modal="true" aria-labelledby="league-entry-title"><Sigil className="league-entry-mark" size={48}/><span className="eyebrow">THE EMPEROR'S FAVOR</span><h1 id="league-entry-title">Present your Favor</h1><p className="league-entry-lead">Google has identified you. Admission to Age of Friends now requires a one-use Favor issued by the Emperor.</p><form className="league-entry-form" onSubmit={e=>{e.preventDefault();void act(()=>repository.requestMembership(name.trim(),discord.trim(),favor),'The Emperor has granted his Favor.');}}><label className="favor-field">Emperor's Favor<input className="favor-code-input" required maxLength={6} value={favor} onChange={e=>setFavor(e.target.value.toUpperCase().replace(/[\s-]+/g,'').slice(0,6))} autoComplete="one-time-code" autoCapitalize="characters" spellCheck={false} placeholder="K7M4Q9"/></label><p className="favor-help">Six characters · I, O, 0 and 1 are never used.{preview&&<> · Preview Favor: <strong>K7M4Q9</strong></>}</p><div className="league-entry-rule"/><span className="eyebrow">YOUR LEAGUE IDENTITY</span><label>Steam name<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)} autoComplete="nickname" placeholder="Your AoE II name"/></label><label>Discord name · optional<input maxLength={100} value={discord} onChange={e=>setDiscord(e.target.value)} placeholder="Your Discord name"/></label><button className="league-entry-primary" disabled={busy||!name.trim()||!favorReady}>Invoke the Favor<ArrowRight size={18}/></button></form>{error&&<div className="league-entry-error" role="alert">{error}</div>}<button className="league-entry-secondary" disabled={busy} onClick={signOut}>Use another Google account</button></section></div>;
  if(snapshot.membership==='PENDING')return <div className="league-entry-overlay"><section className="league-entry-slab" role="dialog" aria-modal="true" aria-labelledby="league-entry-title"><Shield className="league-entry-mark" strokeWidth={1}/><span className="eyebrow">LEAGUE MEMBERSHIP</span><h1 id="league-entry-title">Banner awaiting approval</h1><p className="league-entry-lead">This older membership request still requires administrator approval before the league can be entered.</p><div className="league-entry-status">Membership request pending</div>{error&&<div className="league-entry-error" role="alert">{error}</div>}<button className="league-entry-secondary" disabled={busy} onClick={signOut}>Sign out</button></section></div>;
  return <div className="league-entry-overlay"><section className="league-entry-slab" role="dialog" aria-modal="true" aria-labelledby="league-entry-title"><Shield className="league-entry-mark" strokeWidth={1}/><span className="eyebrow">LEAGUE MEMBERSHIP</span><h1 id="league-entry-title">The gate is closed</h1><p className="league-entry-lead">Your league membership is not currently active. Contact the league administrator to restore access.</p><div className="league-entry-status">{snapshot.membership.replaceAll('_',' ')}</div>{error&&<div className="league-entry-error" role="alert">{error}</div>}<button className="league-entry-secondary" disabled={busy} onClick={signOut}>Sign out</button></section></div>;
}
function FavorGeneratorForm({busy,onGenerate}:{busy:boolean;onGenerate:(batchName:string,count:number)=>void}){
  const [batchName,setBatchName]=useState('Founding Fifteen'),[count,setCount]=useState(15);
  return <form className="favor-generator" onSubmit={e=>{e.preventDefault();onGenerate(batchName.trim(),count);}}>
    <p>Create one-use six-character Favors. The readable codes are returned only once, immediately after generation.</p>
    <label>Batch name<input required maxLength={80} value={batchName} onChange={e=>setBatchName(e.target.value)} /></label>
    <label>Number of Favors<input required type="number" min={1} max={50} value={count} onChange={e=>setCount(Number(e.target.value))}/></label>
    <div className="subtle-box">The first batch defaults to 15. Later batches can contain 1–50 Favors each.</div>
    <button className="primary" disabled={busy||!batchName.trim()||!Number.isInteger(count)||count<1||count>50}>Create Favors</button>
  </form>;
}
function FavorBatchSheet({batch}:{batch:EmperorsFavorBatch}){
  return <div className="favor-batch">
    <div className="favor-batch-actions"><p><strong>{batch.count} Favors created.</strong> Print or securely record them now. The six-character codes cannot be recovered from the database later.</p><button className="primary" onClick={()=>window.print()}>Print Favors</button></div>
    <div className="favor-print-sheet">{batch.favors.map(favor=><article className="favor-card" key={favor.serialNumber}>
      <span className="favor-card-brand">AGE OF FRIENDS</span>
      <span className="favor-card-kicker">THE EMPEROR'S FAVOR</span>
      <h3>{favor.emperor}</h3>
      <p>By decree, the bearer of this Favor may raise a banner within the League.</p>
      <strong className="favor-card-code">{favor.code}</strong>
      <span className="favor-card-number">{favor.printLabel}</span>
      <small>{batch.batchName} · This Favor may be invoked once.</small>
    </article>)}</div>
  </div>;
}
function SeasonAccessGate({gateRef,snapshot,busy,enter}:{gateRef:Ref<HTMLElement>;snapshot:LeagueSnapshot;busy:boolean;enter:()=>void}){
  if(!snapshot.season)return <section ref={gateRef} className="season-access-gate" aria-labelledby="season-access-title"><div className="season-access-card"><Sigil kind="flag" size={42}/><span className="eyebrow">BETWEEN CAMPAIGNS</span><h1 id="season-access-title">The next season is being prepared</h1><p>Your league identity is ready. Season entry will open when the next campaign is announced.</p><div className="season-access-actions"><p className="season-access-note">Return when the next campaign is called.</p></div></div></section>;
  return <section ref={gateRef} className="season-access-gate" aria-labelledby="season-access-title"><div className="season-access-card"><Sigil kind="flag" size={42}/><span className="eyebrow">THE CURRENT CAMPAIGN</span><h1 id="season-access-title">Enter {snapshot.season.name}</h1><p>Your league banner is raised. Enter the current season to unlock its standings, events, battles, players and statistics.</p><div className="season-access-actions"><button className="season-access-primary" disabled={busy} onClick={enter}>Enter Season I<ArrowRight size={18}/></button><p className="season-access-note">One league identity. A fresh entry for every season.</p></div></div></section>;
}
function Hero({onStory,onEvent}:{onStory:()=>void;onEvent:()=>void}){
  const [slide,setSlide]=useState(0),[paused,setPaused]=useState(false),[interacting,setInteracting]=useState(false),[imageFailed,setImageFailed]=useState(false);
  const artworks=[
  '/artwork/season-fiefdom.png',
  '/artwork/event-lombardia.png'];
  const artwork=artworks[slide];
  useEffect(()=>{if(paused||interacting||matchMedia('(prefers-reduced-motion: reduce)').matches)return;const timer=setInterval(()=>setSlide(s=>1-s),12000);return ()=>clearInterval(timer);},[paused,interacting]);
  const change=()=>{setSlide(s=>1-s);setPaused(true);};
  return <section className="hero" aria-label="League news" aria-roledescription="carousel" onMouseEnter={()=>setInteracting(true)} onMouseLeave={()=>setInteracting(false)} onFocus={()=>setInteracting(true)} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setInteracting(false);}}>
    {artwork && !imageFailed &&  <img    src={artwork}    alt={slide===0?'The Fiefdom of Bad Neighbors':'The War for Lombardia'}    fetchPriority="high"    onError={()=>setImageFailed(true)}  />}
    <div className="hero-shade"/><div className="hero-content" key={slide}><span className="eyebrow">{slide===0?'SEASON I · THE FIRST CAMPAIGN':'EVENT I · THE CALL TO WAR'}</span><h2>{slide===0?<>THE FIEFDOM<br/>OF BAD NEIGHBORS</>:<>LOMBARDIA<br/>STANDS DIVIDED</>}</h2><p>{slide===0?'Good fences make good neighbors. Castles make better ones.':'Eight factions. Two grand alliances. One battlefield.'}</p><button className="hero-link" onClick={slide===0?onStory:onEvent}>{slide===0?'Read the opening story':'Answer the call'}<ArrowRight size={17}/></button></div>
    <div className="hero-bottom"><div className="carousel-controls"><button aria-label="Previous story" onClick={change}><ChevronLeft size={17}/></button>{[0,1].map(i=><button key={i} className={'slide-dot '+(slide===i?'active':'')} aria-label={'Show story '+(i+1)} aria-pressed={slide===i} onClick={()=>{setSlide(i);setPaused(true);}}/>)}<button aria-label="Next story" onClick={change}><ChevronRight size={17}/></button><button aria-label={paused?'Play stories':'Pause stories'} onClick={()=>setPaused(!paused)}>{paused?<Play size={13}/>:<Pause size={13}/>}</button></div></div>
  </section>;
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
