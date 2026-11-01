import {useEffect,useRef,useState} from 'react';
import type {LeagueRepository} from '../domain/league';
import type {PrivateHonoursPreview as Preview} from '../domain/privateHonoursPreview';
const BASELINE=['FAST_CASTLE','WONDER','UNBROKEN','THREE_SCHOOLS','FFA_SOLO_WIN','BOOMER','EXPLORER','GOLD','AGGRESSION','DEFENSIVE'];
export function PrivateHonoursPreview({repository,ownerId}:{repository:LeagueRepository;ownerId:string}){
  const attempt=useRef(0),[read,setRead]=useState<{owner:string;value:Preview}|null>(null);
  const [error,setError]=useState<{owner:string;text:string}|null>(null),[pending,setPending]=useState<string|null>(null);
  const value=read?.owner===ownerId?read.value:null;
  useEffect(()=>{
    const clear=()=>{attempt.current++;setRead(null);setError(null);setPending(null);};clear();
    const stop=repository.onAuthChange(clear);return()=>{attempt.current++;stop();};
  },[repository,ownerId]);
  if(!repository.myHonoursPreview)return null;
  async function open(){
    const token=++attempt.current;setRead(null);setError(null);setPending(ownerId);
    try{
      const v=await repository.myHonoursPreview!();
      if(token!==attempt.current)return;
      const candidatesValid=v.honours.every((h,i)=>{
        if(h.key!==BASELINE[i]||!['PENDING','SOURCE_CANDIDATE'].includes(h.status))return false;
        if(h.status==='PENDING')return h.evidence.length===0;
        return h.key==='FFA_SOLO_WIN'&&h.evidence.length>0&&
          h.independentBattles===new Set(h.evidence.map(e=>e.battleId)).size&&h.evidence.every(e=>e.resultRevision!==null&&
          v.sources.some(s=>JSON.stringify(s)===JSON.stringify(e)));
      });
      if(v.ownerPlayerId!==ownerId||v.version!=='AOF_HONOURS_PRIVATE_SOURCE_PREVIEW_1'||v.visibility!=='OWNER_ONLY'||
        v.mode!=='READ_ONLY_TESTING'||v.effects.officialWrites!==false||v.effects.receiptPublication!==false||v.effects.entitlementGrants!==false||
        v.honours.length!==BASELINE.length||!candidatesValid)
        throw new Error('Private honours source identity changed. Refresh your profile.');
      setRead({owner:ownerId,value:v});
    }catch(e){if(token===attempt.current)setError({owner:ownerId,text:e instanceof Error?e.message:'Private honours preview is unavailable.'});}
    finally{if(token===attempt.current)setPending(null);}
  }
  return <section aria-label="Your private honours testing">
    <h3>Honours testing</h3><p>The selected ten honours, checked against your current recording evidence.</p>
    <button onClick={open} disabled={pending===ownerId}>{value?'Refresh my honours preview':'Inspect my honours preview'}</button>
    {pending===ownerId&&<p role="status">Reading your current Battle evidence…</p>}
    {error?.owner===ownerId&&<p role="alert">{error.text}</p>}
    {value&&<div data-aof-honours-owner={ownerId} data-aof-honours-revision={value.inputDigest}>
      <p>{value.coverage.currentSources} current recordings across {value.coverage.ownBattles} {value.coverage.ownBattles===1?'Battle':'Battles'}. This private test view grants no honour or current trophy possession.</p>
      {value.pendingSources.length>0&&<p>Some Game sources are Pending. They provide no honour evidence.</p>}
      <ul>{value.honours.map(h=><li key={h.key}><strong>{h.label}</strong>: {h.status==='SOURCE_CANDIDATE'?'Source candidate':'Pending'}
        <p>{h.reason}</p>{h.status==='SOURCE_CANDIDATE'&&<p>{h.independentBattles} independent {h.independentBattles===1?'Battle':'Battles'} with a sole official FFA win.</p>}
        {h.evidence.length>0&&<details><summary>Current Game evidence</summary><ul>{h.evidence.map(e=><li key={e.battleId+'/'+e.gameId}>
          Battle {e.battleId} · Game {e.gameId} · statistics revision {e.statisticsRevision} · result revision {e.resultRevision}<br/>
          Source <code>{e.sourceHash}</code>
        </li>)}</ul></details>}</li>)}</ul>
      <button onClick={()=>{attempt.current++;setRead(null);setError(null);}}>Close honours preview</button>
    </div>}
  </section>;
}
