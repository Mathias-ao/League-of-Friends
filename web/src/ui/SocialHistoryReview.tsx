import {useState} from 'react';
import type {LeagueRepository} from '../domain/league';
export function SocialHistoryReview({repository,playerId}:{repository:LeagueRepository;playerId:string}){
  const [data,setData]=useState<any>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
  if(!repository?.socialHistory)return null;
  const load=()=>{setLoading(true);setError('');repository.socialHistory!().then(setData).catch(e=>setError(e.message??'History unavailable')).finally(()=>setLoading(false));};
  const pairs=(data?.history?.pairs??[]).filter((p:any)=>p.playerIds.includes(playerId));
  const name=(id:string)=>data?.names?.[id]??id;
  return <details className="br-social" onToggle={e=>{if(e.currentTarget.open&&!data&&!loading&&!error)load();}}><summary>Social history · shadow evaluation</summary>
    <p>This pilot rebuilds current accepted replay history. Official tracks and rewards are unchanged. Co-presence is not an opportunity to help.</p>
    {loading?<p role="status">Reading accepted replay history…</p>:error?<p role="alert">{error} <button onClick={load}>Retry</button></p>:data?<>
      <p>{data.coverage.readableAcceptedGames} readable accepted Games; {data.coverage.excludedGames} excluded. {data.status==='PARTIAL'?'Stages describe available sources, not complete league history.':''}</p>
      {pairs.length?<ul>{pairs.map((p:any)=><li key={p.playerIds.join(':')}><strong>{name(p.playerIds.find((id:string)=>id!==playerId))}</strong>: {p.exposure?.gameIds.length??0} Games met · {p.exposure?.battleIds.length??0} Battles{Object.entries(p.tracks).map(([track,value])=><span key={track}> · {track.toLowerCase()} shadow stage {(value as any).currentStage}</span>)}{!Object.keys(p.tracks).length&&' · No qualified track contributions in available sources'}</li>)}</ul>:<p>No mapped pair history is available here.</p>}
    </>:null}
  </details>;
}
