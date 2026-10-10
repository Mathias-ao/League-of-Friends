import {useEffect,useRef,useState} from 'react';
import type {LeagueRepository,ActiveNativeDetailResult,PlayerRecord} from '../domain/league';

const GROUPS=[
  ['battles','Battles'],['greatBattles','Great battles'],
  ['skirmishes','Skirmishes'],['allyReinforcementsSent','Reinforcements sent'],
  ['allyReinforcementsReceived','Reinforcements received'],
  ['defensiveAssistsGiven','Defensive assistance given'],
  ['defensiveAssistsReceived','Defensive assistance received'],
  ['cooperativeAttacks','Cooperative attacks'],
] as const;
const FIELDS=[
  'body','sourceEventIds','parentSourceEventIds','directedInteractionEdges',
  'opponentInteractionPairs','contributionSourceEventIdsByPlayer',
  'unitClassEvidenceByPlayer',
] as const;
const MAX_INLINE_JSON=256*1024;
function message(error:unknown):string{
  return error instanceof Error?error.message:'The current detail revision is unavailable.';
}
function decodeChunk(value:string):Uint8Array {
  const binary=atob(value);
  return Uint8Array.from(binary,c=>c.charCodeAt(0));
}
async function readJsonVerified(chunks:Uint8Array[],sha:string):Promise<unknown> {
  const length=chunks.reduce((n,b)=>n+b.length,0),all=new Uint8Array(length);
  let offset=0;
  for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.length;}
  if(!crypto?.subtle)throw new Error('Browser evidence verification is unavailable.');
  const hash=await crypto.subtle.digest('SHA-256',all);
  const hex=[...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
  if(hex!==sha)throw new Error('Returned evidence fragments failed SHA-256 verification.');
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(all));
}

/** Normal player access ONLY for a published active native READY Game.
 * Detail is read in small fragments; no whole-Game expansion or public Storage URL.
 */
export function NativeBattleEvidence({repository,matchId,gameId,mapping,players}:{
  repository:LeagueRepository;matchId:string;gameId:string;
  mapping:{playerId:string;replaySlot:number}[];players:PlayerRecord[];
}){
  const reader=repository.activeNativeBattleDetail;
  const [slot,setSlot]=useState(mapping[0]?.replaySlot??1);
  const [group,setGroup]=useState<string>('battles');
  const [offset,setOffset]=useState(0);
  const [artifact,setArtifact]=useState<string|null>(null);
  const [page,setPage]=useState<ActiveNativeDetailResult|null>(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);
  const [selected,setSelected]=useState<string|null>(null);
  const [field,setField]=useState<string>('body');
  const [detail,setDetail]=useState<unknown>(null);
  const [detailError,setDetailError]=useState('');
  const [detailLoading,setDetailLoading]=useState(false);
  const generation=useRef(0);
  useEffect(()=>{
    if(!reader)return;
    let cancelled=false;
    setPage(null);setError('');setLoading(true);
    reader({matchId,gameId,mode:'list',replaySlot:slot,group,pageSize:20,offset,
      ...(offset>0&&artifact?{expectedArtifactSha256:artifact}:{})})
      .then(next=>{
        if(cancelled)return;
        if(next.mode!=='list'||!Array.isArray(next.entries)||
           artifact&&next.artifactSha256!==artifact)throw new Error('Battle evidence revision changed. Refresh the Battle.');
        setPage(next);
        setArtifact(next.artifactSha256);
      })
      .catch(e=>{if(!cancelled)setError(message(e));})
      .finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;};
  },[reader,matchId,gameId,slot,group,offset,artifact]);
  const reset=(nextSlot:number,nextGroup:string)=>{
    generation.current++;
    setSlot(nextSlot);setGroup(nextGroup);setOffset(0);setArtifact(null);
    setSelected(null);setDetail(null);setDetailError('');
  };
  async function inspect(reference:string,nextField:string){
    if(!reader||!artifact)return;
    const requestId=++generation.current;
    setSelected(reference);setField(nextField);setDetail(null);setDetailError('');setDetailLoading(true);
    const fragments:Uint8Array[]=[];
    let nextOffset:number|null=0,contentHash:string|null=null;
    try{
      while(nextOffset!==null){
        const result=await reader({matchId,gameId,mode:'fragment',replaySlot:slot,group,
          reference,field:nextField,offset:nextOffset,expectedArtifactSha256:artifact});
        if(requestId!==generation.current)return;
        if(result.mode!=='fragment'||typeof result.chunkBase64!=='string'||
           typeof result.contentSha256!=='string'||typeof result.totalBytes!=='number'||
           result.artifactSha256!==artifact||contentHash&&result.contentSha256!==contentHash)
          throw new Error('Inconsistent Battle evidence fragments.');
        if(result.totalBytes>MAX_INLINE_JSON)
          throw new Error('This complete source field exceeds the 256 KiB inline viewer limit. It remains available through bounded authenticated fragments; no evidence has been discarded.');
        fragments.push(decodeChunk(result.chunkBase64));
        contentHash=result.contentSha256;
        nextOffset=result.nextOffset;
      }
      const parsed=await readJsonVerified(fragments,contentHash!);
      if(requestId===generation.current)setDetail(parsed);
    }catch(e){if(requestId===generation.current)setDetailError(message(e));}
    finally{if(requestId===generation.current)setDetailLoading(false);}
  }
  if(!reader||!mapping.length)return null;
  const caption=(id:string)=>players.find(p=>p.playerId===id)?.steamName??id;
  return <section className="native-battle-evidence" aria-label="Recorded Events Battle detail">
    <h3>Recorded Battle episodes</h3>
    <p className="sx-notice">Verified native evidence from this Game's active recording. Source arrays are loaded only when requested; no scoring or social conclusion is inferred from missing episodes.</p>
    <div className="br-facts">
      <label>Recording player <select aria-label="Native evidence player" value={slot} onChange={e=>reset(Number(e.target.value),group)}>
        {mapping.map(row=><option value={row.replaySlot} key={row.replaySlot}>{caption(row.playerId)}</option>)}
      </select></label>
      <label>Episode category <select aria-label="Native evidence category" value={group} onChange={e=>reset(slot,e.target.value)}>
        {GROUPS.map(([value,title])=><option key={value} value={value}>{title}</option>)}
      </select></label>
    </div>
    {loading&&<p role="status">Reading the current evidence revision…</p>}
    {error&&<p role="alert">{error} <button onClick={()=>{setArtifact(null);setOffset(0);}}>Refresh</button></p>}
    {page?.mode==='list'&&<div>
      <p>{page.total} recorded episodes in this category; showing {page.entries?.length??0} at a time. Missing observations are not zero activity.</p>
      <ol>{page.entries?.map(item=><li key={item.reference}>
        <button onClick={()=>inspect(item.reference,'body')}>{item.id??item.reference}</button>
        {item.startedAtMs!==null&&<small> · {Math.round(item.startedAtMs/1000)} seconds</small>}
      </li>)}</ol>
      <div>
        {offset>0&&<button onClick={()=>{generation.current++;setSelected(null);setDetail(null);setOffset(Math.max(0,offset-20));}}>Previous episodes</button>}
        {page.nextOffset!==null&&page.nextOffset!==undefined&&<button onClick={()=>{generation.current++;setSelected(null);setDetail(null);setOffset(page.nextOffset!);}}>Next episodes</button>}
      </div>
      {selected&&<section aria-label="Selected native episode detail">
        <p>Selected: {selected}. Large fields are retained separately.</p>
        <label>Source field <select aria-label="Native evidence field" value={field} onChange={e=>inspect(selected,e.target.value)}>
          {FIELDS.map(name=><option key={name} value={name}>{name}</option>)}
        </select></label>
        {detailLoading&&<p role="status">Verifying bounded evidence fragments…</p>}
        {detailError&&<p role="alert">{detailError}</p>}
        {detail!==null&&<pre className="br-source">{JSON.stringify(detail,null,2)}</pre>}
      </section>}
    </div>}
  </section>;
}
