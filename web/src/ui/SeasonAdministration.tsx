import {useCallback,useEffect,useRef,useState} from 'react';
import type {ViewProps} from './App';
import {DateLabel} from './Primitives';
import {seasonCreation,type SeasonAdministrationData,type SeasonCreationInput,type SeasonSetupRecord} from '../domain/seasonAdministration';
import '../admin-release.css';

type Props=Pick<ViewProps,'snapshot'|'repository'|'preview'|'busy'|'act'>&{authUid:string|null|undefined};
export function SeasonAdministration({snapshot,repository,preview,busy,act,authUid}:Props){
  const [setup,setSetup]=useState<SeasonAdministrationData|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [name,setName]=useState(''),[starts,setStarts]=useState(''),[ends,setEnds]=useState('');
  const [creation,setCreation]=useState<SeasonCreationInput|null>(null),[activation,setActivation]=useState<SeasonSetupRecord|null>(null);
  const generation=useRef(0),request=useRef<{key:string;id:string}|null>(null),activationRequests=useRef(new Map<string,string>()),working=useRef(false);
  const allowed=!preview&&snapshot.membership==='ACTIVE'&&snapshot.viewer?.role==='ADMIN'&&!!authUid&&repository.currentAuthUid?.()===authUid;
  const identity=JSON.stringify([authUid,snapshot.viewer?.playerId,allowed]),currentIdentity=useRef(identity);currentIdentity.current=identity;
  const load=useCallback(async()=>{
    const id=++generation.current;
    if(!allowed){setSetup(null);return;}
    setLoading(true);setError('');
    try{
      if(!repository.seasonSetup)throw Error('Season administration is not available in this release.');
      const value=await repository.seasonSetup();
      if(id===generation.current&&identity===currentIdentity.current&&repository.currentAuthUid?.()===authUid)setSetup(value);
    }catch(e){if(id===generation.current&&identity===currentIdentity.current){setSetup(null);setError(e instanceof Error?e.message:'Season setup could not be read. Retry.');}}
    finally{if(id===generation.current&&identity===currentIdentity.current)setLoading(false);}
  },[allowed,repository,identity,authUid]);
  useEffect(()=>{setCreation(null);setActivation(null);setNotice('');request.current=null;activationRequests.current.clear();void load();return()=>{generation.current++;};},[load]);
  if(!allowed)return null;
  const disabled=busy||loading;
  const perform=async(action:()=>Promise<void>,message:string)=>{
    if(working.current||repository.currentAuthUid?.()!==authUid)return false;
    working.current=true;setError('');let failure:unknown;
    try{
      const saved=await act(async()=>{try{await action();}catch(e){failure=e;throw e;}},message);
      if(identity!==currentIdentity.current||repository.currentAuthUid?.()!==authUid)return false;
      if(saved){setNotice(message);await load();}else setError(failure instanceof Error?failure.message:'The operation was not confirmed. Refresh the Season ledger before retrying.');
      return saved;
    }finally{working.current=false;}
  };
  const prepare=(event:React.FormEvent)=>{
    event.preventDefault();setError('');setNotice('');
    try{
      const key=JSON.stringify([name.trim(),starts,ends]);
      if(request.current?.key!==key)request.current={key,id:crypto.randomUUID()};
      const value=seasonCreation(name,starts,ends,request.current!.id);
      if(setup?.seasons.some(s=>s.startsAt&&s.endsAt&&Date.parse(s.startsAt)<Date.parse(value.endsAt)&&Date.parse(s.endsAt)>Date.parse(value.startsAt)))
        throw Error('These dates overlap an existing Season. Choose a separate window.');
      setCreation(value);
    }catch(e){setError(e instanceof Error?e.message:'Review the Season details.');}
  };
  return <section className="admin-workspace season-administration" aria-label="Season administration">
    <header className="admin-workspace-heading"><span className="eyebrow">THE EMPEROR’S LEDGER</span><h3>Season administration</h3><p>Prepare a Season draft, review its dates, then activate it separately. Historical Seasons remain unchanged.</p></header>
    {error&&<p className="admin-error" role="alert">{error}</p>}{notice&&<p className="admin-success" role="status">{notice}</p>}
    <section className="admin-section"><div className="admin-section-heading"><h4>Season ledger</h4><button type="button" disabled={busy||loading} onClick={()=>void load()}>Refresh ledger</button></div>
      {loading?<p role="status">Reading Season setup…</p>:setup?<>
        <p>{setup.activeSeasonId?'One Season is active. Another cannot be activated until the existing lifecycle permits it.':'No Season is currently active. A draft may be prepared and activated below.'}</p>
        <div className="admin-season-list">{setup.seasons.map(season=><article key={season.seasonId} className="admin-season-record"><div><strong>{season.name}</strong><span className="admin-state">{season.status}{setup.activeSeasonId===season.seasonId?' · Current Season':''}</span><p><DateLabel value={season.startsAt}/> — <DateLabel value={season.endsAt}/></p></div>
          {['DRAFT','UPCOMING'].includes(season.status)&&<button type="button" disabled={disabled||!!setup.activeSeasonId||!repository.activateSeason} onClick={()=>{setCreation(null);setActivation(season);setError('');}}>Review activation</button>}
        </article>)}</div>{!setup.seasons.length&&<p>No Seasons have been created.</p>}
      </>:<p>Refresh to read the authoritative Season setup.</p>}
    </section>
    <section className="admin-section"><h4>Prepare a new Season</h4><form className="admin-form" onSubmit={prepare}>
      <label>Season name<input name="seasonName" required maxLength={100} value={name} onChange={e=>{setName(e.target.value);setCreation(null);}}/></label>
      <div className="admin-field-grid"><label>Season opening<input name="seasonStarts" type="datetime-local" required value={starts} onChange={e=>{setStarts(e.target.value);setCreation(null);}}/></label><label>Season closing<input name="seasonEnds" type="datetime-local" required value={ends} onChange={e=>{setEnds(e.target.value);setCreation(null);}}/></label></div>
      <p className="admin-help">Dates use your device’s local timezone and are saved as exact instants. Season windows cannot overlap.</p><button className="primary" disabled={disabled||!setup||!repository.createSeason}>Review Season draft</button>
    </form></section>
    {creation&&<section className="admin-confirmation" aria-label="Review Season draft"><h4>Review before creating</h4><dl><dt>Season</dt><dd>{creation.name}</dd><dt>Opens</dt><dd><DateLabel value={creation.startsAt}/></dd><dt>Closes</dt><dd><DateLabel value={creation.endsAt}/></dd></dl><p>This creates a draft. It does not activate the Season, open the War Room or change previous results.</p><div className="admin-actions"><button type="button" disabled={busy} onClick={()=>setCreation(null)}>Back to details</button><button className="primary" disabled={disabled||!repository.createSeason} onClick={async()=>{if(await perform(async()=>{await repository.createSeason!(creation);},'Season draft created. Review activation separately.')){setCreation(null);setName('');setStarts('');setEnds('');request.current=null;}}}>Create Season draft</button></div></section>}
    {activation&&<section className="admin-confirmation admin-consequential" aria-label="Confirm Season activation"><h4>Activate {activation.name}?</h4><p>This makes the selected draft the current Season. It does not enroll players or change historical Seasons. The existing War Room remains closed.</p><p><DateLabel value={activation.startsAt}/> — <DateLabel value={activation.endsAt}/></p><div className="admin-actions"><button type="button" disabled={busy} onClick={()=>setActivation(null)}>Keep as draft</button><button className="primary" disabled={disabled||!!setup?.activeSeasonId||!repository.activateSeason} onClick={async()=>{let id=activationRequests.current.get(activation.seasonId);if(!id){id=crypto.randomUUID();activationRequests.current.set(activation.seasonId,id);}if(await perform(()=>repository.activateSeason!(activation.seasonId,id!),'Season activated. Players may now enter it.'))setActivation(null);}}>Confirm Season activation</button></div></section>}
  </section>;
}
