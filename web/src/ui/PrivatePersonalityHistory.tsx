import {useEffect,useRef,useState} from 'react';
import type {LeagueRepository} from '../domain/league';
import type {PrivatePersonalityHistory as History} from '../domain/privateHistory';
const LABELS:Record<string,string>={BOOMER_AGGRESSOR:'Boomer ↔ Aggressor',CAUTIOUS_BOLD:'Cautious ↔ Bold',
  GUERRILLA_FRONTLINE:'Guerrilla ↔ Frontline Fighter',SPECIALIST_IMPROVISER:'Specialist ↔ Improviser',COMPACT_EXPANSIVE:'Compact ↔ Expansive'};
export function PrivatePersonalityHistory({repository,ownerId}:{repository:LeagueRepository;ownerId:string}){
  const attempt=useRef(0),[read,setRead]=useState<{owner:string;value:History}|null>(null);
  const [error,setError]=useState<{owner:string;text:string}|null>(null),[pending,setPending]=useState<string|null>(null);
  const history=read?.owner===ownerId?read.value:null;
  useEffect(()=>{attempt.current++;setRead(null);setError(null);setPending(null);
    const stop=repository.onAuthChange(()=>{attempt.current++;setRead(null);setError(null);setPending(null);});
    return()=>{attempt.current++;stop();};
  },[repository,ownerId]);
  if(!repository.myPersonalityHistory)return null;
  async function open(){
    const token=++attempt.current;setRead(null);setError(null);setPending(ownerId);
    try{
      const value=await repository.myPersonalityHistory!();
      if(token!==attempt.current)return;
      if(value.ownerPlayerId!==ownerId||value.personality.personalityProfile.playerId!==ownerId||
        value.version!=='AOF_INT_B_PRIVATE_HISTORY_1'||value.visibility!=='OWNER_ONLY'||
        value.personality.publication!=='PRIVATE_PREVIEW_ONLY')throw new Error('Private history identity changed. Reopen your profile.');
      setRead({owner:ownerId,value});
    }catch(e){if(token===attempt.current)setError({owner:ownerId,text:e instanceof Error?e.message:'Private history is unavailable.'});}
    finally{if(token===attempt.current)setPending(null);}
  }
  return <section aria-label="Your private Personality history">
    <h3>Personality</h3><p>Descriptive history from your current verified recordings.</p>
    <button onClick={open} disabled={pending===ownerId}>{history?'Refresh my Personality history':'Inspect my Personality history'}</button>
    {pending===ownerId&&<p role="status">Reading your current Battle history…</p>}
    {error?.owner===ownerId&&<p role="alert">{error.text}</p>}
    {history&&<div data-aof-history-owner={ownerId} data-aof-history-revision={history.inputDigest}>
      <p>{history.coverage.currentSources} current recordings across {history.coverage.ownBattles} {history.coverage.ownBattles===1?'Battle':'Battles'}. Multiple Games share one Battle identity.</p>
      {history.pending.length>0&&<p>Some Game inputs are Pending. They do not count as qualifying Personality evidence.</p>}
      <ul>{history.personality.personalityProfile.sliders.map(axis=>{
        // A backend-declared READY label alone must never invent a value.
        const ready=history.personality.contextAdmission==='SOURCE_QUALIFIED'&&
          history.personality.calibration==='PROPOSED'&&
          history.personality.personalityProfile.policy.status==='PROPOSED'&&
          axis.status==='READY'&&typeof axis.value==='number'&&Number.isFinite(axis.value)&&
          axis.value>=0&&axis.value<=100&&axis.independentBattles>=2;
        return <li key={axis.axis}>
          <strong>{LABELS[axis.axis]}</strong>: {ready?'Provisional':axis.status==='CONTEXT_LIMITED'?'Context limited':'Developing'}
          {ready?<><p><strong>{axis.value!.toFixed(1)} / 100</strong> from {axis.independentBattles} independent source-qualified Battles. This is a private, provisional descriptive value.</p>
            <meter min={0} max={100} value={axis.value!} aria-label={LABELS[axis.axis]+' provisional value'}/></>
            :<p>Comparable source history or opportunity is insufficient; no value assigned.</p>}
        </li>;
      })}</ul>
      <p>Guerrilla ↔ Frontline describes military-command posture, not confirmed combat.</p>
      <p>Personality is descriptive, not a Reputation or Relationship award. This private view grants no honours.</p>
      <button onClick={()=>{attempt.current++;setRead(null);}}>Close Personality history</button>
    </div>}
  </section>;
}
