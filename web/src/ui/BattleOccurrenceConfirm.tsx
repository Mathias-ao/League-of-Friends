import {useEffect,useState} from 'react';
import type {LeagueRepository} from '../domain/league';
import type {BattleOccurrenceRead,BattleOccurrenceBound} from '../domain/battleOccurrence';

type Window={start:string;end:string};
const localInput=(ms:number)=>new Date(ms-new Date(ms).getTimezoneOffset()*60000).toISOString().slice(0,23);
/** An optional Battle-owned post-result step, never a guessed play timestamp.
 * Two independent opponents must confirm identical windows on the backend.
 * Disabled in every environment without separate EU source-v1 approval. */
export function BattleOccurrenceConfirm({repository,battleId}:{repository:LeagueRepository;battleId:string}){
 const [version,setVersion]=useState(0);
 const [read,setRead]=useState<BattleOccurrenceRead|null>(null);
 const [windows,setWindows]=useState<Record<string,Window>>({});
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const uid=repository.currentAuthUid?.();
 useEffect(()=>{
  let alive=true;
  const ownerUid=repository.currentAuthUid?.();
  setRead(null);setError('');setWindows({});
  if(!ownerUid||!repository.canConfirmBattleOccurrence?.()||!repository.getMyBattleOccurrence)return;
  const current=()=>alive&&repository.currentAuthUid?.()===ownerUid;
  const unsubscribe=repository.onAuthChange(()=>{
   if(!current()){alive=false;setRead(null);setWindows({});setError('');}
  });
  void repository.getMyBattleOccurrence(battleId).then(value=>{
   if(current()&&value.battleId===battleId)setRead(value);
  }).catch(e=>{if(current())setError(e instanceof Error?e.message:'Occurrence status is unavailable.');});
  return()=>{alive=false;unsubscribe();};
 },[repository,battleId,uid,version]);
 if(!repository.canConfirmBattleOccurrence?.()||!uid)return null;
 const submit=async()=>{
  if(!read||!repository.confirmBattleOccurrence||busy)return;
  const userUid=repository.currentAuthUid?.();
  const valid=()=>!!userUid&&repository.currentAuthUid?.()===userUid;
  const bounds:BattleOccurrenceBound[]=[];
  for(const game of read.games){
   const value=windows[game.gameId];
   if(!value?.start||!value?.end){setError('Enter a start and end window for every required Game.');return;}
   const from=new Date(value.start).getTime(),to=new Date(value.end).getTime();
   if(!Number.isSafeInteger(from)||!Number.isSafeInteger(to)||from<=0||to<=from||
     to>Date.now()||game.receiptUpperBoundAtMs===null||to>game.receiptUpperBoundAtMs){
    setError('A Game window must be before the server receipt and in chronological order.');return;
   }
   if(bounds.length&&bounds.at(-1)!.notAfterMs>=from){
    setError('The required Games must have non-overlapping chronological windows.');return;
   }
   bounds.push({gameId:game.gameId,notBeforeMs:from,notAfterMs:to});
  }
  setBusy(true);setError('');
  try{
   await repository.confirmBattleOccurrence(battleId,read.expectedSourceBinding,bounds);
   if(valid()){setRead(null);setWindows({});setVersion(n=>n+1);}
  }catch(e){if(valid())setError(e instanceof Error?e.message:'Confirmation could not be saved. Refresh the current Battle.');}
  finally{if(valid())setBusy(false);}
 };
 return <section className="battle-occurrence-confirm" aria-label="Optional Battle play-time confirmation">
  <details>
   <summary>Historical Battle ordering <small>· optional private confirmation</small></summary>
   {!read&&!error?<p role="status">Checking the current official Battle and recording receipts…</p>:null}
   {read?.status==='APPROVED'?<p>Play-window evidence is approved. Other Battles may still have uncertain historical order.</p>:null}
   {read?.status==='PENDING'?<>
    <p>Official results and recordings remain unchanged. To establish when this Battle was played, both opposing players must independently confirm the same approximate start and finish for every required Game. No time is inferred from the upload.</p>

    {read.proposalMismatch?<p role="status">Your saved window differs from the current opposing confirmation. Adopt their exact window or edit yours and resubmit.</p>:null}
    {read.opponentProposalBounds?.length===read.games.length?
      <button type="button" disabled={busy} onClick={()=>{
       setWindows(Object.fromEntries(read.opponentProposalBounds!.map(w=>[w.gameId,{
        start:localInput(w.notBeforeMs),end:localInput(w.notAfterMs)}])));
       setError('');
      }}>Use opponent's exact proposed window</button>:null}
    {read.games.some(game=>game.receiptUpperBoundAtMs===null)?
     <p>At least one Game has no trusted receipt. This needs separate reviewed evidence; no time can be claimed from upload order.</p>:
     <>
      {read.games.map((game,index)=><fieldset key={game.gameId} disabled={busy}>
       <legend>Game {index+1}</legend>
       <p><small>Recording received by {new Date(game.receiptUpperBoundAtMs!).toLocaleString()} (upper bound only)</small></p>
       <label>Approximate play began <input aria-label={'Game '+(index+1)+' play began'}
        type="datetime-local" step="0.001" value={windows[game.gameId]?.start??''}
        onChange={e=>setWindows(old=>({...old,[game.gameId]:{start:e.target.value,end:old[game.gameId]?.end??''}}))}/></label>
       <label>Approximate play ended <input aria-label={'Game '+(index+1)+' play ended'}
        type="datetime-local" value={windows[game.gameId]?.end??''}
        onChange={e=>setWindows(old=>({...old,[game.gameId]:{start:old[game.gameId]?.start??'',end:e.target.value}}))}/></label>
      </fieldset>)}
      <button type="button" disabled={busy} onClick={()=>{void submit();}}>
       {busy?'Saving private confirmation…':'Confirm this play window'}
      </button>
     </>}
   </>:null}
   {error?<p role="alert">{error}</p>:null}
   <button type="button" disabled={busy} onClick={()=>setVersion(n=>n+1)}>Refresh current evidence</button>
  </details>
 </section>;
}
