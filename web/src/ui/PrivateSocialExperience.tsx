import {useEffect,useRef,useState} from 'react';
import type {LeagueRepository} from '../domain/league';
import type {IntV1PrivateExperience} from '../domain/intV1Experience';
const AXES:Record<string,string>={BOOMER_AGGRESSOR:'Boomer ↔ Aggressor',CAUTIOUS_BOLD:'Cautious ↔ Bold',
  GUERRILLA_FRONTLINE:'Guerrilla ↔ Frontline Fighter',SPECIALIST_IMPROVISER:'Specialist ↔ Improviser',COMPACT_EXPANSIVE:'Compact ↔ Expansive'};
const label=(v:string)=>v[0]+v.slice(1).toLowerCase();

/** Explicit opt-in in the Battle view. No cache/storage or background scanning.
 * Identity changes hide previous data in the same render, before effects run. */
export function PrivateSocialExperience({repository,matchId,gameId,viewerId,sourceHash,revision}:{
  repository:LeagueRepository;matchId:string;gameId:string;viewerId:string;sourceHash:string;revision:number;
}){
  const key=JSON.stringify([matchId,gameId,viewerId,sourceHash,revision]);
  const generation=useRef(0),[result,setResult]=useState<{key:string;value:IntV1PrivateExperience}|null>(null);
  const [pending,setPending]=useState<string|null>(null),[error,setError]=useState<{key:string;text:string}|null>(null);
  const visible=result?.key===key?result.value:null;
  useEffect(()=>{generation.current++;setResult(null);setError(null);setPending(null);
    return repository.onAuthChange(()=>{generation.current++;setResult(null);setError(null);setPending(null);});
  },[key,repository]);
  useEffect(()=>()=>{generation.current++;},[]);
  if(!repository.mySocialExperience)return null;
  async function open(){
    const attempt=++generation.current;setResult(null);setError(null);setPending(key);
    try{
      const value=await repository.mySocialExperience!({matchId,gameId});
      if(attempt!==generation.current)return;
      if(value.version!=='AOF_INT_V1_PRIVATE_SOURCE_1'||value.ownerPlayerId!==viewerId||value.visibility!=='OWNER_ONLY'||
        value.source.matchId!==matchId||value.source.battleId!==matchId||value.source.gameId!==gameId||
        value.source.sourceHash!==sourceHash||value.source.statisticsRevision!==revision)
        throw new Error('Recording changed. Refresh the Battle before opening your private history.');
      setResult({key,value});
    }catch(e){if(attempt===generation.current)setError({key,text:e instanceof Error?e.message:'Private history is unavailable.'});}
    finally{if(attempt===generation.current)setPending(null);}
  }
  return <section aria-label="Your recording and social history">
    <button onClick={open} disabled={pending===key}>{visible?'Refresh my recording history':'Inspect my recording history'}</button>
    {pending===key&&<p role="status">Verifying your current recording…</p>}
    {error?.key===key&&<p role="alert">{error.text}</p>}
    {visible&&<div data-aof-private-owner={viewerId} data-aof-source={visible.source.sourceHash}
      data-aof-revision={visible.source.statisticsRevision}>
      <p>Your current recording is verified. This private view covers Game {gameId} in Battle {matchId}.</p>
      <p>Source <code>{visible.source.sourceHash}</code> · revision {visible.source.statisticsRevision}</p>
      <p>{visible.source.outcome.qualification==='OFFICIAL'?'Official Game result accepted.':'Official Game result pending; recording statistics remain available.'}</p>
      <h4>Personality</h4><ul>{visible.personality.map(row=><li key={row.axis}>{AXES[row.axis]??row.axis}: Pending — measurements and calibration await review.</li>)}</ul>
      <h4>Reputation and Relationships</h4><ul>{visible.tracks.map(row=><li key={row.track}>{label(row.track)}: Pending — qualified evidence and history are not ready.</li>)}</ul>
      <p>Chronicle: Pending. Recognition and epithets: Pending.</p>
      <p>No social credit has been issued by this view. A single recording does not establish a longitudinal profile.</p>
      <button onClick={()=>{generation.current++;setResult(null);}}>Close private history</button>
    </div>}
  </section>;
}
