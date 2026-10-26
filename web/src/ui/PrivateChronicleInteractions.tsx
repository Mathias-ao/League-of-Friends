import {useEffect,useRef,useState} from 'react';
import type {LeagueRepository} from '../domain/league';
import type {PrivateChronicleInvitations,PrivateChronicleInvitation,ChronicleInvitationAction} from '../domain/privateChronicleInteractions';

/** Author-owned response leaf only; source selection and invitation creation stay server-owned.
 * No answer is equated with factual narrative or Relationship progression. */
export function PrivateChronicleInteractions({repository,ownerId}:{repository:LeagueRepository;ownerId:string}){
  const attempt=useRef(0);
  const [read,setRead]=useState<{owner:string;repository:LeagueRepository;value:PrivateChronicleInvitations}|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [notes,setNotes]=useState<Record<string,string>>({});
  useEffect(()=>{
    const clear=()=>{attempt.current++;setRead(null);setError(null);setBusy(false);setNotes({});};
    clear();const stop=repository.onAuthChange(clear);
    return()=>{attempt.current++;stop();};
  },[repository,ownerId]);
  if(!repository.myChronicleInvitations||!repository.actOnChronicleInvitation)return null;
  const valid=(v:PrivateChronicleInvitations)=>v.version==='AOF_CHRONICLE_INTERACTIONS_V1E'&&
    v.visibility==='OWNER_ONLY'&&v.ownerPlayerId===ownerId&&v.testOnly===true&&
    v.narratorAuthority==='FACTUAL_SOURCE_ONLY'&&Array.isArray(v.officialEffects)&&!v.officialEffects.length&&
    v.invitations.every(i=>i.respondentPlayerId===ownerId&&i.effects.officialWrites===false&&
      i.effects.relationshipDelta===null&&i.effects.negativeForSilence===false&&
      (i.speaker===null||i.speaker.qualification==='PENDING'));
  async function load(token:number){
    const value=await repository.myChronicleInvitations!();
    if(!valid(value))throw new Error('Chronicle invitation authority changed.');
    if(token===attempt.current)setRead({owner:ownerId,repository,value});
  }
  async function open(){
    const token=++attempt.current;setRead(null);setError(null);setBusy(true);
    try{await load(token);}catch(e){if(token===attempt.current)setError(e instanceof Error?e.message:'Private Chronicle unavailable.');}
    finally{if(token===attempt.current)setBusy(false);}
  }
  async function answer(i:PrivateChronicleInvitation,action:ChronicleInvitationAction['action'],choiceId?:string){
    const token=++attempt.current;setError(null);setBusy(true);
    try{
      const request:ChronicleInvitationAction={battleId:i.battleId,requestId:crypto.randomUUID(),
        expectedRevision:i.revision,opportunityRevision:i.opportunityRevision,action};
      if(action==='SUBMIT'){request.choiceId=choiceId;request.confirmed=true;
        const note=notes[i.battleId];if(note)request.privateNote=note;}
      await repository.actOnChronicleInvitation!(request);
      await load(token);
    }catch(e){if(token===attempt.current){setRead(null);
      setError(e instanceof Error?e.message:'Invitation changed. Refresh your Chronicle.');}}
    finally{if(token===attempt.current)setBusy(false);}
  }
  const value=read?.owner===ownerId&&read.repository===repository?read.value:null;
  return <section aria-label="Your private Chronicle invitations">
    <h3>Rare Chronicle moments</h3>
    <p>These questions are optional and uncommon. Your answer is your own perspective, not a factual claim or public Reputation score. Ignoring or declining never counts against you.</p>
    <button type="button" disabled={busy} onClick={()=>void open()}>{value?'Refresh my invitations':'Review my invitations'}</button>
    {busy&&<p role="status">Checking current Battle evidence…</p>}
    {error&&<p role="alert">{error}</p>}
    {value&&<div data-aof-chronicle-invitations-owner={ownerId}>
      {value.invitations.length===0&&<p>No rare moments are awaiting your perspective.</p>}
      <ul>{value.invitations.map(i=>{
        const eligible=i.sourceCurrent&&(i.state==='OFFERED'||i.state==='DEFERRED');
        return <li key={i.slotId}>
          <strong>{i.family.replaceAll('_',' ')}</strong> — Battle {i.battleId}.
          <p>{i.questionContext} Status: {i.sourceCurrent?i.state:'Source changed; responses disabled'}.</p>
          {i.speaker&&<p>Your attributed answer: {i.speaker.choiceId.replaceAll('_',' ')}. This remains private and pending.</p>}
          {eligible&&<>
            <label>Private note (optional, visible only to the author and authorized reviewer)
              <textarea aria-label={'Private note for '+i.battleId} maxLength={1000}
                value={notes[i.battleId]??''} onChange={e=>setNotes(old=>({...old,[i.battleId]:e.target.value}))}/>
            </label>
            <div>{i.choices.filter(c=>c!=='UNDECIDED').map(c=>
              <button type="button" key={c} disabled={busy}
                onClick={()=>void answer(i,'SUBMIT',c)}>{c.replaceAll('_',' ')}</button>)}</div>
            <button type="button" disabled={busy} onClick={()=>void answer(i,'DEFER')}>Decide later</button>
            <button type="button" disabled={busy} onClick={()=>void answer(i,'DECLINE')}>Decline without penalty</button>
          </>}
        </li>;
      })}</ul>
      <button type="button" onClick={()=>{attempt.current++;setRead(null);setNotes({});}}>Close private invitations</button>
    </div>}
  </section>;
}
