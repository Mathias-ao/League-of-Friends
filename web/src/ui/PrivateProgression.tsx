import {useEffect,useRef,useState} from 'react';
import type {LeagueRepository} from '../domain/league';
import type {PrivateProgression as Preview} from '../domain/privateProgression';
export function PrivateProgression({repository,ownerId}:{repository:LeagueRepository;ownerId:string}){
 const [read,setRead]=useState<{repository:LeagueRepository;value:Preview}|null>(null),[error,setError]=useState<string|null>(null),[busy,setBusy]=useState(false),attempt=useRef(0);
 useEffect(()=>{const clear=()=>{attempt.current++;setRead(null);setError(null);setBusy(false);};clear();const stop=repository.onAuthChange(clear);return()=>{attempt.current++;stop();};},[repository,ownerId]);
 const value=read?.repository===repository&&read.value.ownerPlayerId===ownerId?read.value:null;
 if(!repository.mySocialProgression)return null;
 async function open(){const token=++attempt.current;setRead(null);setError(null);setBusy(true);
  try{const v=await repository.mySocialProgression!();if(token!==attempt.current)return;
   if(v.version!=='AOF_SOCIAL_E2E_PRIVATE_PROGRESSION_1'||v.ownerPlayerId!==ownerId||v.visibility!=='OWNER_ONLY'||
    v.simulation.status!=='PRIVATE_PROPOSED_SIMULATION_ONLY'||v.simulation.policy.status!=='PROPOSED'||v.simulation.policy.approvalRef!==null||
    v.history.publicationAllowed||v.history.officialWrites||v.history.receipts.length||v.effects.officialWrites||v.effects.entitlementGrants||v.effects.receiptPublication||
    v.claims.some(c=>c.subject.system==='REPUTATION'?c.subject.playerId!==ownerId:c.subject.fromPlayerId!==ownerId))throw new Error('Private simulation authority changed. Refresh your profile.');
   setRead({repository,value:v});
  }catch(e){if(token===attempt.current)setError(e instanceof Error?e.message:'Private simulation unavailable.');}
  finally{if(token===attempt.current)setBusy(false);}}
 return <section aria-label="Your private progression simulation"><h3>Private social progression</h3>
  <p>Provisional gameplay inference and calibration. These simulated stages grant no public score, award or entitlement.</p>
  <button onClick={open} disabled={busy}>Inspect my private progression</button>{busy&&<p role="status">Verifying current originals and scheduled history…</p>}{error&&<p role="alert">{error}</p>}
  {value&&<div data-aof-progression-owner={ownerId} data-aof-progression-revision={value.inputDigest}>
   <p>{value.coverage.currentSources} verified current recordings; {value.coverage.ownBattles} Battles. Original observations remain LIMITED; admission applies only to the listed inference method.</p>
   {value.pendingSources.length>0&&<p>History is Pending: some current sources could not supply qualified input. Displayed banks describe only the verified subset.</p>}
   <ul>{value.history.projections.map(p=><li key={JSON.stringify(p.subject)}><strong>{p.subject.track}</strong>{p.subject.system==='RELATIONSHIP'&&<> toward {p.subject.toPlayerId}</>}: {p.currentStage===null?'Pending':`simulated stage ${p.currentStage}`}.
    <p>Up bank {p.upBank}; down bank {p.downBank}; peak {p.peak}. {p.transitions.length} historical transitions; {p.reciprocityEvents??0} independently witnessed Events in this direction.</p>
    <ol>{p.transitions.map((t,i)=><li key={i}>{t.kind}: stage {t.stage}, scheduled position {t.at.join(' / ')}.</li>)}</ol>
   </li>)}</ul>
   {!value.history.projections.length&&<p>No source-admitted movement is available yet.</p>}
   <p>Pending methods: {value.pendingMethods.join(', ')}. Missing source methods never create a zero-valued earned track.</p>
   <details><summary>Inspect source-backed grades and revisions</summary><ul>{value.cards.map((c,i)=><li key={c.claimId+'-'+i}>
    {c.track} toward {c.counterpartPlayerId}: {c.decision==='SOURCE_ADMITTED'?`${c.gradeBandId} inferred conduct`:'Pending'}.
    <p>Battle {c.battleId}; Game {c.gameId}; source {c.sourceAuthority}. {c.originalEventCount} original actor requests; method {c.methodVersion}.</p>
    <p>{c.meaning??c.missingEvidence.join(', ')}. Claim revision {c.claimRevision}; source component {c.identity.componentId}.</p>
   </li>)}</ul></details>
   <button onClick={()=>{attempt.current++;setRead(null);}}>Close private progression</button>
  </div>}
 </section>;
}
