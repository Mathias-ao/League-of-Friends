import {useEffect,useState} from 'react';
import {ArrowRight,Check,Flag,Lock,RefreshCcw,Shield,Swords,Users,X} from 'lucide-react';
import {canBrowseLeague,type LeagueRepository,type LeagueSnapshot} from '../domain/league';
import {mayAnswerWarChallenge,mayIssueWarChallenge,type WarRoomChallenge,type WarRoomData,type WarRoomPlayer} from '../domain/warRoom';

export interface WarRoomViewProps {
  snapshot: LeagueSnapshot;
  repository: LeagueRepository;
  openMatch: (id:string)=>void;
  openPlayer: (id:string)=>void;
}
function humanDate(value:string|null){
  if(!value)return 'Date pending';
  const date=new Date(value);
  return Number.isNaN(date.getTime())?'Date pending':date.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});
}
function challengeLabel(status:string){
  switch(status){
    case 'PENDING':return 'Awaiting reply';
    case 'ACCEPTED':return 'Battle accepted';
    case 'DECLINED':return 'Declined';
    case 'COMPLETED':return 'Battle completed';
    case 'INVALIDATED':return 'Eligibility corrected';
    default:return 'Under review';
  }
}
function otherPlayer(row:WarRoomChallenge,viewerId:string):WarRoomPlayer {
  return row.challenger.playerId===viewerId?row.challenged:row.challenger;
}
function readableError(error:unknown){
  return error instanceof Error?error.message:'The War Room is unavailable. Try again.';
}

export function WarRoomView({snapshot,repository,openMatch,openPlayer}:WarRoomViewProps){
  const viewerId=snapshot.viewer?.playerId??null;
  const seasonId=snapshot.season?.seasonId??null;
  const key=[viewerId??'',seasonId??''].join(':');
  const [read,setRead]=useState<{key:string;value:WarRoomData}|null>(null);
  const [refreshTick,setRefreshTick]=useState(0);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [actionError,setActionError]=useState('');
  const [notice,setNotice]=useState('');
  const [working,setWorking]=useState(false);

  useEffect(()=>{
    return repository.onAuthChange(()=>{
      setRead(null);setActionError('');setNotice('');setRefreshTick(n=>n+1);
    });
  },[repository]);
  useEffect(()=>{
    let current=true;
    setRead(null);setError('');setLoading(true);
    if(!viewerId||!canBrowseLeague(snapshot)||!repository.warRoom){
      setLoading(false);
      return ()=>{current=false;};
    }
    void repository.warRoom().then(value=>{
      if(!current)return;
      if(value.schemaVersion!=='WAR_ROOM_V1'||value.viewer.playerId!==viewerId||
         value.activeSeason?.seasonId!==(seasonId??null)){
        throw new Error('War Room season or league identity changed. Reload to verify access.');
      }
      setRead({key,value});
    }).catch(cause=>{if(current){setRead(null);setError(readableError(cause));}})
      .finally(()=>{if(current)setLoading(false);});
    return ()=>{current=false;};
  // The stable league identity/season key changes when authentication changes.
  },[repository,key,refreshTick]);

  const data=read?.key===key?read.value:null;
  const currentChallenges=data?.viewerChallenges??[];
  const openInvitation=(challenge:WarRoomChallenge)=>challenge.status==='PENDING'&&
    challenge.historyState!=='ARCHIVED'&&
    (challenge.currentChallengeRevision??challenge.challengeRevision)===challenge.challengeRevision;
  const incoming=currentChallenges.filter(challenge=>challenge.challenged.playerId===viewerId&&openInvitation(challenge));
  const outgoing=currentChallenges.filter(challenge=>challenge.challenger.playerId===viewerId&&openInvitation(challenge));
  const past=currentChallenges.filter(challenge=>!openInvitation(challenge));
  // Factual, viewer-authorized history only. Challenge revisions are not
  // competitive awards, and one original Battle may survive multiple invites.
  const linkedBattles=new Set(currentChallenges.map(row=>row.matchId).filter((id):id is string=>!!id)).size;
  const archivedInvitations=currentChallenges.filter(row=>row.historyState==='ARCHIVED').length;
  const canIssue=!!data&&mayIssueWarChallenge(data)&&!!repository.createWarRoomChallenge;
  async function perform(action:()=>Promise<void>,success:string){
    if(working)return;
    setWorking(true);setNotice('');setActionError('');
    try{await action();setNotice(success);setRefreshTick(n=>n+1);}
    catch(cause){setActionError(readableError(cause));setRefreshTick(n=>n+1);}
    finally{setWorking(false);}
  }
  const send=(opponent:WarRoomPlayer)=>{
    if(!data||!canIssue||!data.viewer.qualifiedRivals.some(p=>p.playerId===opponent.playerId))return;
    void perform(()=>repository.createWarRoomChallenge!(opponent.playerId),'Invitation submitted for source-current review.');
  };
  const answer=(challenge:WarRoomChallenge,response:'ACCEPT'|'DECLINE')=>{
    if(!data||!repository.respondWarRoomChallenge||!mayAnswerWarChallenge(data,challenge))return;
    void perform(()=>repository.respondWarRoomChallenge!(challenge.challengeId,response),
      response==='ACCEPT'?'Invitation accepted.':'Invitation declined.');
  };
  if(!viewerId||!canBrowseLeague(snapshot)){
    return <section className="section war-room war-v1"><div className="war-heading"><Lock size={32}/><h1>The War Room</h1><p>Enter the league Season to inspect your challenge history.</p></div></section>;
  }
  const state=data?.status==='OPEN'&&data.qualification.status==='VERIFIED'?'OPEN':
    data?.status==='PENDING_SOURCE'?'PENDING_SOURCE':'CLOSED';

  const renderChallenge=(challenge:WarRoomChallenge)=> {
    const opponent=otherPlayer(challenge,viewerId);
    const canRespond=!!data&&!!repository.respondWarRoomChallenge&&mayAnswerWarChallenge(data,challenge);
    return <article className="war-entry" key={challenge.challengeEntryId??`${challenge.challengeId}:R${challenge.challengeRevision}`}>
      <div className="war-entry-identity">
        <span className="eyebrow">{challenge.challenger.playerId===viewerId?'YOUR INVITATION':'INCOMING INVITATION'} · {humanDate(challenge.createdAt)}</span>
        <h3><button className="war-player-link" onClick={()=>openPlayer(opponent.playerId)}>{opponent.steamName}</button></h3>
        <p>{challengeLabel(challenge.status)}
          {challenge.matchId?' · 1v1 Battle':''}</p>
        {challenge.historyState==='ARCHIVED'&&<p className="war-fineprint">
          Archived invitation · revision {challenge.challengeRevision}.
          {challenge.currentChallengeRevision!==undefined&&<> Current invitation: revision {challenge.currentChallengeRevision}
            {challenge.currentChallengeStatus?` · ${challengeLabel(challenge.currentChallengeStatus)}`:''}.</>}
        </p>}
        {challenge.eligibilityReview!=='VERIFIED'&&<span className="war-review">
          {challenge.eligibilityReview==='INVALIDATED'?'Challenge eligibility corrected — historical Battle retained':'Original qualification pending review'}
        </span>}
      </div>
      <div className="war-entry-actions">
        {challenge.matchId&&<button className="text-button" onClick={()=>openMatch(challenge.matchId!)}>View Battle<ArrowRight size={15}/></button>}
        {canRespond?<><button className="primary" disabled={working} onClick={()=>answer(challenge,'ACCEPT')}><Check size={15}/>Accept</button>
          <button className="text-button" disabled={working} onClick={()=>answer(challenge,'DECLINE')}><X size={15}/>Decline</button></>:
          challenge.challenged.playerId===viewerId&&openInvitation(challenge)&&<small className="war-action-pending">Responses paused until current qualification is verified</small>}
      </div>
    </article>;
  };

  return <section className="section war-room war-v1" aria-label="War Room">
    <div className="war-heading"><span className="eyebrow">THE PRIVATE CHAMBER · SEASON CHALLENGES</span>
      <Swords size={36} strokeWidth={1}/><h1>The War Room</h1>
      <p>Rival histories. Contested banners. Battles earned on the field.</p>
    </div>
    <div className="war-v1-state panel">
      <div><span className="eyebrow">THE CHAMBER</span>
        <h2>{loading?'Reading the campaign records':!data?'Records unavailable':
          !data.activeSeason?'Between Seasons':
          state==='OPEN'?'Challenges open':
          state==='PENDING_SOURCE'?'Qualification pending':'The doors remain closed'}</h2>
        <p>{loading?'Checking your current Season and challenge history…':
          error||(!data?'The challenge ledger is not available.':
          !data.activeSeason?'A new Season has not yet been announced.':
          state==='OPEN'?'Reckonings require verified reciprocal pair history; honour challenges have separate access rules. Neither path is authorized by an unverified invitation.':
          state==='PENDING_SOURCE'?'Current Relationship proof is still under review. Previous challenges remain part of the historical ledger.':
          'War Room contests are not active in this Season. Existing accepted Battles remain historical facts.')}</p>
      </div>
      <button className="text-button" disabled={loading||working} onClick={()=>setRefreshTick(n=>n+1)}><RefreshCcw size={15}/>Refresh records</button>
    </div>
    {error&&<p className="war-error" role="alert">{error}</p>}
    {actionError&&<p className="war-error" role="alert">{actionError}</p>}
    {notice&&<p className="war-notice" role="status">{notice}</p>}
    {loading&&<p className="war-loading" role="status">Verifying the War Room ledger…</p>}
    {data&&<div className="war-v1-content">
      <div className="war-v1-summary" aria-label="Your challenge summary">
        <div><Shield size={20}/><span className="eyebrow">ELIGIBILITY</span><strong>{canIssue?'Qualified':'Awaiting verification'}</strong></div>
        <div><Flag size={20}/><span className="eyebrow">INVITATIONS RECEIVED</span><strong>{incoming.length}</strong></div>
        <div><Swords size={20}/><span className="eyebrow">CHALLENGE HISTORY</span><strong>{currentChallenges.length}</strong></div>
      </div>
      <div className="war-v1-grid">
        <section className="panel war-v1-panel" aria-labelledby="war-rivals-title">
          <div className="war-panel-header"><span className="eyebrow">I · QUALIFIED ENCOUNTERS</span><h2 id="war-rivals-title">Your rivals</h2></div>
          {canIssue&&data.viewer.qualifiedRivals.length? <div className="war-rivals">
            {data.viewer.qualifiedRivals.map(opponent=><article key={opponent.playerId} className="war-rival"><button className="war-player-link" onClick={()=>openPlayer(opponent.playerId)}>{opponent.steamName}</button>
              <button className="primary" disabled={working} onClick={()=>send(opponent)}>Issue challenge<ArrowRight size={15}/></button></article>)}
          </div>:<div className="war-empty"><Lock size={22}/><h3>No current challenge permission</h3>
            <p>Reckonings require independently verified reciprocal Rivalry or Hostility at stage three or above. Honour challenges have separate eligibility still under review. Neither is unlocked by unresolved evidence.</p></div>}
        </section>
        <section className="panel war-v1-panel" aria-labelledby="war-invites-title">
          <div className="war-panel-header"><span className="eyebrow">II · CHALLENGE NOTICES</span><h2 id="war-invites-title">Invitations</h2></div>
          {!incoming.length&&!outgoing.length?<div className="war-empty"><Users size={22}/><h3>No open invitations</h3><p>Any challenge you receive or send will appear here, with its current response state.</p></div>:
          <div className="war-entries">{incoming.map(renderChallenge)}{outgoing.map(renderChallenge)}</div>}
        </section>
      </div>
      <section className="panel war-v1-panel" aria-labelledby="war-history-title">
        <div className="war-panel-header"><span className="eyebrow">III · THE RECORD</span><h2 id="war-history-title">Challenge history</h2></div>
        {past.length?<div className="war-entries">{past.map(renderChallenge)}</div>:
          <div className="war-empty"><h3>History begins with the first accepted contest</h3>
            <p>Declined invitations, accepted Battles and corrected qualifications remain traceable here.</p></div>}
      </section>
      <section className="panel war-v1-panel" aria-labelledby="war-record-title">
        <div className="war-panel-header"><span className="eyebrow">IV · A SEPARATE CAMPAIGN</span><h2 id="war-record-title">Record of challenges</h2></div>
        <p>{linkedBattles} distinct {linkedBattles===1?'Battle link':'Battle links'} retained · {archivedInvitations} archived {archivedInvitations===1?'invitation':'invitations'}.</p>
        <p className="war-fineprint">This is a private factual ledger of invitations and their original Battles, not a competition score. Correcting challenge eligibility never erases an independently valid Battle.</p>
        <p className="war-fineprint">Reckonings and honour challenges need separately approved eligibility, meaningful stakes and correction rules before competitive rewards can be shown. No challenge rewards are active here.</p>
      </section>
    </div>}
  </section>;
}
