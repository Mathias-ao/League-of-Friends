import {useEffect,useRef,useState} from 'react';
import type {LeagueRepository} from '../domain/league';
import type {PrivateGameplayPreview as Preview,PrivateGameplayCandidates} from '../domain/gameplayPreview';
export function PrivateGameplayPreview({repository,ownerId,sourceCandidates=false}:{repository:LeagueRepository;ownerId:string;sourceCandidates?:boolean}){
  const attempt=useRef(0),[read,setRead]=useState<{owner:string;value:Preview|PrivateGameplayCandidates}|null>(null);
  const [error,setError]=useState<string|null>(null),[pending,setPending]=useState(false);
  useEffect(()=>{const clear=()=>{attempt.current++;setRead(null);setError(null);setPending(false);};clear();
    const stop=repository.onAuthChange(clear);return()=>{attempt.current++;stop();};},[repository,ownerId,sourceCandidates]);
  if(sourceCandidates?!repository.myGameplayCandidates:!repository.myGameplayPreview)return null;
  const value=read?.owner===ownerId?read.value:null;
  async function open(){
    const token=++attempt.current;setRead(null);setError(null);setPending(true);
    try{
      const v=await (sourceCandidates?repository.myGameplayCandidates!():repository.myGameplayPreview!());if(token!==attempt.current)return;
      const valid=sourceCandidates?v.version==='AOF_INT_C2A_PRIVATE_PREVIEW_1'&&v.episodes.every(e=>e.binding.actorPlayerId===ownerId&&
        e.candidate.grade.decision==='PENDING'&&e.candidate.grade.bandId===null&&e.candidate.coverage.tier==='LIMITED'&&
        e.binding.producerGameScopeAuthenticated===false&&e.binding.sourceAuthorityVerified===true&&e.compatibility.keySubstitutionAllowed===false):
        v.version==='AOF_INT_C1_PRIVATE_PREVIEW_1'&&v.grades.every(g=>g.actorPlayerId===ownerId&&g.grade.status==='PENDING');
      if(!valid||v.ownerPlayerId!==ownerId||v.visibility!=='OWNER_ONLY'||v.status!=='PENDING'||
        v.simulation.status!=='UNAPPROVED_TEST_ONLY'||
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
      {value.version==='AOF_INT_C1_PRIVATE_PREVIEW_1'&&<p>{new Set(value.grades.map(g=>g.contributionGroupId)).size} source groups. Correlated indicators share a group; they grant no separate credits.</p>}
      {value.pendingSources.length>0&&<p>Some Game sources remain Pending.</p>}
      {value.version==='AOF_INT_C2A_PRIVATE_PREVIEW_1'?<>
        <p>Source coverage: LIMITED. Historical league order and approved opportunities are unavailable.</p>
        {!value.episodes.length&&<p>No supported directional source episodes are available.</p>}
        <ul>{value.episodes.map(e=><li key={e.binding.bindingRevision} data-aof-contribution={e.compatibility.componentId}>
          <strong>Recorded requests toward {e.binding.counterpartPlayerId}</strong>
          <p>{e.candidate.explanation} Contextual grade: Pending.</p>
          <ul>{e.candidate.rawMeasurements.map(m=><li key={m.metricDefinitionId}>{m.rawValue} {m.metricDefinitionId.replaceAll('_',' ').toLocaleLowerCase()} (requests, not execution).</li>)}</ul>
          <p>{e.candidate.opportunity.sourceEventIds.length} command references prior to their contributing deeds. They may follow the earliest linked action; pre-episode opportunity remains unqualified.</p>
          <p>{e.candidate.counterevidenceCandidates.length} counterevidence candidates; STOP/CANCEL does not prove cancellation or peaceful intent.</p>
          <details><summary>Inspect source and identity compatibility</summary>
            <p>Battle {e.binding.source.battleId}, Game {e.binding.source.gameId}; source revision {e.binding.source.authorityRevision}.</p>
            <p>Original GUID {e.binding.source.gameGuid}; replay time {e.candidate.firstSourceMoment.recordingAtMs} ms ({e.candidate.firstSourceMoment.order.toLocaleLowerCase()}).</p>
            <p>Producer key {e.compatibility.producerKey}; legacy keys {e.compatibility.legacyContributionKeys.join(', ')}. Keys are linked, never substituted.</p>
            <p>Original events: {e.candidate.sourceEventIds.join(', ')}. Original incidents: {e.compatibility.sourceIncidentIds.join(', ')}.</p>
            <p>Binding revision {e.binding.bindingRevision}; no grade band, credit or reciprocity is admitted.</p>
          </details>
        </li>)}</ul>
      </>:<>{!value.grades.length&&<p>No supported directional source episodes are available.</p>}
      <ul>{value.grades.map(g=><li key={g.candidateId} data-aof-contribution={g.contributionGroupId}>
        <strong>{g.metricId.replaceAll('_',' ').toLocaleLowerCase()}</strong>: {g.raw.value} recorded command requests toward {g.counterpartPlayerId}.
        <p>Inferred pair attribution; execution is unproven. Contextual grade: Pending.</p>
        <small>Source revision {g.sourceAuthority}; replay time {g.firstSourceMoment.recordingAtMs} ms; {g.firstSourceMoment.order.toLocaleLowerCase()}.</small>
      </li>)}</ul></>}
      <button onClick={()=>{attempt.current++;setRead(null);}}>Close gameplay evidence</button>
    </div>}
  </section>;
}
