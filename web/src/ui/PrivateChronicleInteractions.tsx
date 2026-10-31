import {useEffect,useRef,useState} from 'react';
import type {LeagueRepository} from '../domain/league';
import type {PrivateChronicleInvitations,PrivateChronicleInvitation,ChronicleInvitationAction} from '../domain/privateChronicleInteractions';

// Presentation of EXISTING server-authorized families/choice IDs only. No new
// invitation, source qualification, felt-path score or interpretation predicate.
const questions:Record<string,string>={
  ASSISTANCE:'What did this recorded participation mean to you?',
  SITUATED_GRIEVANCE:'How did this encounter feel to you?',
  SKILL_ACKNOWLEDGMENT:'How do you regard this opponent after these league meetings?',
  TREACHERY_VICTIM:'How do you regard these actions in this encounter?',
};
const choices:Record<string,Record<string,string>>={
  ASSISTANCE:{ACKNOWLEDGED_HELP:'It mattered to me',NOT_PERSONALLY_MEANINGFUL:'It was ordinary teamwork to me'},
  SITUATED_GRIEVANCE:{FELT_PERSONAL:'It felt personal to me',FAIR_WARFARE:'I saw it as fair competition'},
  SKILL_ACKNOWLEDGMENT:{ACKNOWLEDGED_SKILL:'Stronger in these meetings',DO_NOT_ACKNOWLEDGE:'Our contest is still unsettled'},
  TREACHERY_VICTIM:{FELT_BETRAYED:'I regarded it as betrayal',FAIR_GAME:'I regarded it as fair play'},
};
type Draft={slotId:string;battleId:string;revision:number;opportunityRevision:string;choiceId:string};
/** Author-owned response leaf. Choosing drafts a perspective; only a distinct
 * confirmation binds it to the exact invitation/opportunity revision. */
export function PrivateChronicleInteractions({repository,ownerId,counterpartNames={}}:{repository:LeagueRepository;ownerId:string;counterpartNames?:Record<string,string>}){
  const attempt=useRef(0);
  const [read,setRead]=useState<{owner:string;repository:LeagueRepository;value:PrivateChronicleInvitations}|null>(null);
  const [error,setError]=useState<string|null>(null),[busy,setBusy]=useState(false);
  const [notes,setNotes]=useState<Record<string,string>>({}),[draft,setDraft]=useState<Draft|null>(null);
  useEffect(()=>{
    const clear=()=>{attempt.current++;setRead(null);setError(null);setBusy(false);setNotes({});setDraft(null);};
    clear();const stop=repository.onAuthChange(clear);return()=>{attempt.current++;stop();};
  },[repository,ownerId]);
  if(!repository.myChronicleInvitations||!repository.actOnChronicleInvitation)return null;
  const valid=(v:PrivateChronicleInvitations)=>v.version==='AOF_CHRONICLE_INTERACTIONS_V1E'&&
    v.visibility==='OWNER_ONLY'&&v.ownerPlayerId===ownerId&&v.testOnly===true&&
    v.narratorAuthority==='FACTUAL_SOURCE_ONLY'&&Array.isArray(v.officialEffects)&&!v.officialEffects.length&&
    v.invitations.every(i=>i.respondentPlayerId===ownerId&&i.effects.officialWrites===false&&
      i.effects.relationshipDelta===null&&i.effects.negativeForSilence===false&&
      (!i.context||i.context.version==='AOF_CHRONICLE_INVITATION_CONTEXT_V1'&&
        i.context.battleId===i.battleId&&i.context.opportunityRevision===i.opportunityRevision&&
        typeof i.context.gameId==='string'&&i.context.gameId.length>0&&
        i.context.incidentAccount===null&&i.context.recordingAtMs===null&&
        (i.context.status==='PENDING'&&i.context.gameNumber===null||
          i.sourceCurrent&&i.context.status==='CURRENT_GAME_ONLY'&&
          Number.isSafeInteger(i.context.gameNumber)&&i.context.gameNumber!>0))&&
      (i.speaker===null||i.speaker.authorPlayerId===ownerId&&i.speaker.qualification==='PENDING'&&
        i.speaker.presentation==='ATTRIBUTED_SPEAKER_NOT_OBJECTIVE_NARRATOR'));
  async function load(token:number){
    const value=await repository.myChronicleInvitations!();
    if(!valid(value))throw new Error('Chronicle invitation authority changed.');
    if(token===attempt.current){setRead({owner:ownerId,repository,value});setDraft(null);}
  }
  async function open(){
    const token=++attempt.current;setRead(null);setDraft(null);setNotes({});setError(null);setBusy(true);
    try{await load(token);}catch(e){if(token===attempt.current)setError(e instanceof Error?e.message:'Private Chronicle unavailable.');}
    finally{if(token===attempt.current)setBusy(false);}
  }
  async function answer(i:PrivateChronicleInvitation,action:ChronicleInvitationAction['action'],choiceId?:string){
    if(action==='SUBMIT'&&(!draft||draft.slotId!==i.slotId||draft.revision!==i.revision||
      draft.opportunityRevision!==i.opportunityRevision||draft.choiceId!==choiceId||!i.sourceCurrent||
      !i.choices.includes(choiceId!)||!choices[i.family]?.[choiceId!]))return;
    const token=++attempt.current;setDraft(null);setError(null);setBusy(true);
    try{
      const request:ChronicleInvitationAction={battleId:i.battleId,requestId:crypto.randomUUID(),
        expectedRevision:i.revision,opportunityRevision:i.opportunityRevision,action};
      if(action==='SUBMIT'){request.choiceId=choiceId;request.confirmed=true;
        const note=notes[i.battleId];if(note)request.privateNote=note;}
      await repository.actOnChronicleInvitation!(request);
      if(token!==attempt.current)return;
      await load(token);
      if(token===attempt.current)setNotes({});
    }catch(e){if(token===attempt.current){setRead(null);setNotes({});
      setError(e instanceof Error?e.message:'Invitation changed. Refresh your Chronicle.');}}
    finally{if(token===attempt.current)setBusy(false);}
  }
  const value=read?.owner===ownerId&&read.repository===repository?read.value:null;
  return <section aria-label="Your private Chronicle invitations">
    <h3>A moment you may remember</h3>
    <p>These questions are optional and uncommon. Your answer is your own perspective, not a factual claim or public Reputation score. Ignoring or declining never counts against you.</p>
    <button type="button" disabled={busy} onClick={()=>void open()}>{value?'Refresh my invitations':'Review my invitations'}</button>
    {busy&&<p role="status">Checking current Battle evidence…</p>}{error&&<p role="alert">{error}</p>}
    {value&&<div data-aof-chronicle-invitations-owner={ownerId}>
      {value.invitations.length===0&&<p>No rare moments are awaiting your perspective.</p>}
      <ul>{value.invitations.map(i=>{
        const eligible=i.sourceCurrent&&(i.state==='OFFERED'||i.state==='DEFERRED');
        const copy=Object.hasOwn(choices,i.family)?choices[i.family]:undefined;
        const known=typeof questions[i.family]==='string'&&!!copy&&i.choices.every(c=>c==='UNDECIDED'||typeof copy[c]==='string');
        const selected=eligible&&known&&draft?.slotId===i.slotId&&draft.revision===i.revision&&
          draft.opportunityRevision===i.opportunityRevision?draft.choiceId:null;
        const gameNumber=i.sourceCurrent&&i.context?.status==='CURRENT_GAME_ONLY'?i.context.gameNumber:null;
        const gameContext=gameNumber!==null?`Game ${gameNumber} of this Battle`:'The Game context is Pending';
        return <li key={i.slotId}>
          <strong>Your encounter with {counterpartNames[i.counterpartPlayerId]??'this league opponent'}</strong>
          <small> · Battle {i.battleId}</small>
          <p aria-label="Recorded moment context" data-aof-invitation-game={i.sourceCurrent?i.context?.gameId:undefined}>
            {i.sourceCurrent?gameContext:'The earlier Game context is no longer current'}.
            {' '}Details of this recorded moment and its time are Pending.
          </p>
          {!i.sourceCurrent&&<p>Its supporting source has changed; responses are disabled.</p>}
          {i.speaker&&<p>{i.sourceCurrent?'Your private perspective':'Earlier private reflection'}: {typeof copy?.[i.speaker.choiceId]==='string'?copy[i.speaker.choiceId]:'Saved privately'}.
            {i.sourceCurrent?' This is your account, not the narrator’s finding.':' Its supporting source changed; it is not used in current interpretation.'}</p>}
          {i.state==='SUBMITTED'&&<p>Your perspective is saved privately.</p>}
          {eligible&&!known&&<p>This question’s presentation is not available. You can decide later or decline.</p>}
          {eligible&&<>
            {known&&<><p>{questions[i.family]}</p>
              <p>The recorded encounter is separate from how you experienced it. This view does not establish its effects.</p>
              <div>{i.choices.filter(c=>c!=='UNDECIDED').map(c=>
                <button type="button" key={c} disabled={busy} aria-pressed={selected===c}
                  onClick={()=>setDraft({slotId:i.slotId,battleId:i.battleId,revision:i.revision,opportunityRevision:i.opportunityRevision,choiceId:c})}>{copy![c]}</button>)}</div>
              <details><summary>Add a private note (optional)</summary>
                <label>Visible only to you and an authorized correction reviewer
                  <textarea aria-label={'Private note for '+i.battleId} maxLength={1000}
                    value={notes[i.battleId]??''} onChange={e=>setNotes(old=>({...old,[i.battleId]:e.target.value}))}/>
                </label>
              </details>
              {selected&&<div role="group" aria-label="Review your private perspective">
                <p>Your choice: {copy![selected]}. You are making a binding private statement about this Battle and {counterpartNames[i.counterpartPlayerId]??'this league opponent'}, linked to the current source. {gameContext}. Details and timing remain Pending. Changing it later requires correction review.</p>
                <button type="button" disabled={busy} onClick={()=>void answer(i,'SUBMIT',selected)}>Save my private perspective</button>
                <button type="button" disabled={busy} onClick={()=>setDraft(null)}>Change my choice</button>
              </div>}
            </>}
            <button type="button" disabled={busy} onClick={()=>void answer(i,'DEFER')}>Not now</button>
            <button type="button" disabled={busy} onClick={()=>void answer(i,'DECLINE')}>Decline without penalty</button>
          </>}
        </li>;
      })}</ul>
      <button type="button" onClick={()=>{attempt.current++;setRead(null);setDraft(null);setNotes({});setBusy(false);}}>Close private invitations</button>
    </div>}
  </section>;
}
