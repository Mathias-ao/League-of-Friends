import {useEffect,useRef,useState} from 'react';
import type {LeagueRepository} from '../domain/league';
import type {PrivateGameplayPreview as Preview} from '../domain/gameplayPreview';
export function PrivateGameplayPreview({repository,ownerId}:{repository:LeagueRepository;ownerId:string}){
  const attempt=useRef(0),[read,setRead]=useState<{owner:string;value:Preview}|null>(null);
  const [error,setError]=useState<string|null>(null),[pending,setPending]=useState(false);
  useEffect(()=>{const clear=()=>{attempt.current++;setRead(null);setError(null);setPending(false);};clear();
    const stop=repository.onAuthChange(clear);return()=>{attempt.current++;stop();};},[repository,ownerId]);
  if(!repository.myGameplayPreview)return null;
  const value=read?.owner===ownerId?read.value:null;
  async function open(){
    const token=++attempt.current;setRead(null);setError(null);setPending(true);
    try{
      const v=await repository.myGameplayPreview!();if(token!==attempt.current)return;
      if(v.ownerPlayerId!==ownerId||v.version!=='AOF_INT_C1_PRIVATE_PREVIEW_1'||v.visibility!=='OWNER_ONLY'||v.status!=='PENDING'||
        v.simulation.status!=='UNAPPROVED_TEST_ONLY'||v.grades.some(g=>g.actorPlayerId!==ownerId||g.grade.status!=='PENDING')||
        v.history.officialWrites||v.history.publicationAllowed||v.history.receipts.length||v.history.projections.length||
        v.effects.officialWrites||v.effects.receiptPublication||v.effects.entitlementGrants)
        throw new Error('Private preview identity or admission changed. Reopen your profile.');
      setRead({owner:ownerId,value:v});
    }catch(e){if(token===attempt.current)setError(e instanceof Error?e.message:'Private gameplay preview is unavailable.');}
    finally{if(token===attempt.current)setPending(false);}
  }
  return <section aria-label="Your private gameplay preview">
    <h3>Gameplay evidence preview</h3><p>Private preview. Grade methods and owner rules are pending.</p>
    <button onClick={open} disabled={pending}>Inspect my gameplay evidence</button>
    {pending&&<p role="status">Verifying your current sources…</p>}{error&&<p role="alert">{error}</p>}
    {value&&<div data-aof-gameplay-owner={ownerId} data-aof-gameplay-revision={value.inputDigest}>
      <p>{value.coverage.currentSources} current recordings across {value.coverage.ownBattles} Battles. Unapproved test-only simulation: Pending, no progression or rewards.</p>
      <p>{new Set(value.grades.map(g=>g.contributionGroupId)).size} source groups. Correlated indicators share a group; they grant no separate credits.</p>
      {value.pendingSources.length>0&&<p>Some Game sources remain Pending.</p>}
      {!value.grades.length&&<p>No supported directional source episodes are available.</p>}
      <ul>{value.grades.map(g=><li key={g.candidateId} data-aof-contribution={g.contributionGroupId}>
        <strong>{g.metricId.replaceAll('_',' ').toLocaleLowerCase()}</strong>: {g.raw.value} recorded command requests toward {g.counterpartPlayerId}.
        <p>Inferred pair attribution; execution is unproven. Contextual grade: Pending.</p>
        <small>Source revision {g.sourceAuthority}; replay time {g.firstSourceMoment.recordingAtMs} ms; {g.firstSourceMoment.order.toLocaleLowerCase()}.</small>
      </li>)}</ul>
      <button onClick={()=>{attempt.current++;setRead(null);}}>Close gameplay evidence</button>
    </div>}
  </section>;
}
