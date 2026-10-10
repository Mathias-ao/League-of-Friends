import {useEffect,useRef,useState} from 'react';
import type {LeagueRepository,ActiveNativeBattleRecordResult,PlayerRecord} from '../domain/league';

const FAMILIES=[
  ['ledgerIncidents','Neutral incidents','ledgerIncident'],
  ['ledgerObservations','Recorded observations','ledgerObservation'],
  ['socialIncidents','Shadow incidents','socialIncident'],
  ['socialDecisions','Shadow decisions','socialDecision'],
  ['socialDeeds','Shadow deeds','socialDeed'],
] as const;
type Family=typeof FAMILIES[number][0];
const MAX_INLINE=256*1024;
const err=(e:unknown)=>e instanceof Error?e.message:'The Battle evidence is unavailable.';
async function decodeVerified(chunks:Uint8Array[],expected:string):Promise<unknown>{
  const length=chunks.reduce((n,c)=>n+c.length,0),result=new Uint8Array(length);
  let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}
  if(!globalThis.crypto?.subtle)throw new Error('Browser SHA-256 verification is unavailable.');
  const hash=[...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',result))]
    .map(c=>c.toString(16).padStart(2,'0')).join('');
  if(hash!==expected)throw new Error('Evidence fragment SHA-256 verification failed.');
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(result));
}

/** Native record never accepts a validation candidate or claims missing evidence
 * establishes peace. Every page and fragment is checked against the active Game. */
export function NativeBattleRecordViewer({repository,matchId,gameId,players,mapping}:{
  repository:LeagueRepository;matchId:string;gameId:string;
  players:PlayerRecord[];mapping:Array<{playerId:string;replaySlot:number}>;
}){
  const [open,setOpen]=useState(false),[retry,setRetry]=useState(0);
  const [header,setHeader]=useState<ActiveNativeBattleRecordResult|null>(null);
  const [error,setError]=useState(''),[loading,setLoading]=useState(false);
  const [family,setFamily]=useState<Family>('ledgerIncidents'),[offset,setOffset]=useState(0);
  const [page,setPage]=useState<ActiveNativeBattleRecordResult|null>(null),[pageError,setPageError]=useState('');
  const [selection,setSelection]=useState(''),[detail,setDetail]=useState<unknown>(null);
  const [detailError,setDetailError]=useState(''),[detailLoading,setDetailLoading]=useState(false);
  const serial=useRef(0);
  const reader=repository.activeNativeBattleRecord;
  const leagueName=(id:string)=>players.find(p=>p.playerId===id)?.steamName??id;
  const recordingName=(id:number)=>leagueName(mapping.find(m=>m.replaySlot===id)?.playerId??String(id));

  useEffect(()=>{
    if(!open||!reader)return;
    let live=true;serial.current++;setHeader(null);setError('');setLoading(true);
    repository.activeNativeBattleRecord!({matchId,gameId,mode:'overview'}).then(result=>{
      if(!live)return;
      if(result.mode!=='overview'||result.state!=='READY'||!result.artifactSha256)
        throw new Error('Unsupported Battle record revision.');
      setHeader(result);
    }).catch(e=>{if(live)setError(err(e));}).finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;serial.current++;};
  },[repository,reader,matchId,gameId,open,retry]);

  useEffect(()=>{
    if(!open||!header||!reader)return;
    let live=true;serial.current++;setPage(null);setPageError('');
    repository.activeNativeBattleRecord!({matchId,gameId,mode:'page',section:family,offset,
      expectedArtifactSha256:header.artifactSha256}).then(next=>{
      if(!live)return;
      if(next.mode!=='page'||next.artifactSha256!==header.artifactSha256||!Array.isArray(next.entries))
        throw new Error('The recorded Game revision changed.');
      setPage(next);
    }).catch(e=>{if(live)setPageError(err(e));});
    return()=>{live=false;serial.current++;};
  },[repository,reader,matchId,gameId,open,header,family,offset]);

  const resetFamily=(next:Family)=>{
    serial.current++;setFamily(next);setOffset(0);setSelection('');setDetail(null);setDetailError('');
  };
  async function inspect(section:string,index?:number){
    if(!header||!reader)return;
    const requestId=++serial.current;
    setSelection(section+(index===undefined?'':':'+index));setDetail(null);
    setDetailError('');setDetailLoading(true);
    const pieces:Uint8Array[]=[];let at=0,digest:string|null=null,total:number|null=null;
    try{
      for(let loops=0;loops<8192;loops++){
        const part=await repository.activeNativeBattleRecord!({matchId,gameId,mode:'fragment',
          section,index,offset:at,expectedArtifactSha256:header.artifactSha256});
        if(serial.current!==requestId)return;
        if(part.mode!=='fragment'||part.artifactSha256!==header.artifactSha256||
           typeof part.chunkBase64!=='string'||typeof part.contentSha256!=='string'||
           typeof part.totalBytes!=='number'||part.offset!==at||
           digest!==null&&digest!==part.contentSha256||total!==null&&total!==part.totalBytes)
          throw new Error('Native record fragments have different source revisions.');
        if(part.totalBytes>MAX_INLINE)
          throw new Error('This entry exceeds the 256 KiB inline viewer limit. Its complete evidence remains retrievable in verified fragments.');
        digest=part.contentSha256;total=part.totalBytes;
        const bytes=Uint8Array.from(atob(part.chunkBase64),c=>c.charCodeAt(0));
        if(bytes.length>32*1024)throw new Error('Oversized evidence fragment.');
        pieces.push(bytes);
        if(part.nextOffset==null){
          const value=await decodeVerified(pieces,digest);
          if(serial.current===requestId)setDetail(value);
          return;
        }
        if(!Number.isSafeInteger(part.nextOffset)||part.nextOffset<=at)
          throw new Error('Invalid evidence fragment cursor.');
        at=part.nextOffset;
      }
      throw new Error('Fragment limit exceeded.');
    }catch(e){if(serial.current===requestId)setDetailError(err(e));}
    finally{if(serial.current===requestId)setDetailLoading(false);}
  }
  const section=FAMILIES.find(s=>s[0]===family)?.[2]??'ledgerIncident';
  return <details className="sx-details br-review native-record" onToggle={e=>setOpen(e.currentTarget.open)}>
    <summary>Battle record and native social evidence</summary>
    {open&&<>
      <p className="sx-notice">Current verified Game evidence. Shadow Rivalry, Bond, Hostility and Reputation assessments do not award points. Missing evidence never establishes peacefulness.</p>
      {loading&&<p role="status">Reading the verified Battle record…</p>}
      {error&&<p role="alert">{error} <button onClick={()=>setRetry(n=>n+1)}>Retry</button></p>}
      {header&&<>
        <h4>Recorded Game and official result</h4>
        <dl className="br-facts">
          <div><dt>Map</dt><dd>{header.matchFacts?.mapName??'Unavailable'}</dd></div>
          <div><dt>Recorded duration</dt><dd>{header.matchFacts?.observedDurationMs!=null?Math.round(header.matchFacts.observedDurationMs/1000)+' seconds':'Unavailable'}</dd></div>
          <div><dt>Teams locked</dt><dd>{header.matchFacts?.rules?.lockTeams===true?'Yes':header.matchFacts?.rules?.lockTeams===false?'No':'Unavailable'}</dd></div>
        </dl>
        <p>{header.officialOutcome?.qualification==='OFFICIAL'?
          'Official winners: '+(header.officialOutcome.winnerPlayerIds??[]).map(leagueName).join(', ')+
          ' · result revision '+header.officialOutcome.resultRevision:
          'Current official result is unavailable.'}</p>
        <h4>Neutral and interpreted evidence</h4>
        {header.social?.status==='REVIEW_AVAILABLE'?<p>
          {header.social.neutralObservations} observations · {header.social.neutralIncidents} neutral incidents · {header.social.socialIncidents} social incidents · {header.social.decisions} shadow decisions · {header.social.deeds} shadow deeds. These are not additive scores.
        </p>:<p role="status">Social review unavailable: {header.social?.reason??'Incomplete evidence'}. No zero-conduct conclusion is drawn.</p>}
        <p>Diplomacy: {header.diplomacy?.status==='REVIEW_AVAILABLE'?
          String(header.diplomacy.commandCount)+' recorded orders, '+String(header.diplomacy.unknownPairSegmentCount)+' uncertain pair intervals. Orders do not prove effective alliances.':
          'Unavailable ('+(header.diplomacy?.reason??'incomplete')+').'}</p>
        <div>
          <button onClick={()=>inspect('matchFacts')}>Review recorded facts</button>
          <button onClick={()=>inspect('diplomacyReview')}>Review diplomacy</button>
          {header.social?.status==='REVIEW_AVAILABLE'&&<button onClick={()=>inspect('socialReview')}>Review shadow social interpretation</button>}
        </div>
        <h4>Evidence episodes</h4>
        <label>Evidence family <select aria-label="Native record evidence family" value={family}
          onChange={e=>resetFamily(e.target.value as Family)}>
          {FAMILIES.map(([id,label])=><option key={id} value={id}>{label}</option>)}
        </select></label>
        {pageError&&<p role="alert">{pageError}</p>}
        {page?.mode==='page'&&<>
          <p>{page.total} entries in the selected family. Source details load individually.</p>
          <ol>{page.entries?.map(e=><li key={e.index}>
            <button onClick={()=>inspect(section,e.index)}>{e.category??'Evidence'} · {e.id??'#'+e.index}</button>
            {e.atMs!=null&&<small> · {Math.round(e.atMs/1000)} sec</small>}
            {e.pairPlayerIds?.length===2&&<small> · {e.pairPlayerIds.map(recordingName).join(' ↔ ')}</small>}
          </li>)}</ol>
          {offset>0&&<button onClick={()=>{serial.current++;setOffset(Math.max(0,offset-20));setSelection('');setDetail(null);}}>Previous entries</button>}
          {page.nextOffset!=null&&<button onClick={()=>{serial.current++;setOffset(page.nextOffset!);setSelection('');setDetail(null);}}>Next entries</button>}
        </>}
        {selection&&<section aria-label="Native record selected evidence">
          <h4>Selected source · {selection}</h4>
          {detailLoading&&<p role="status">Verifying evidence fragments…</p>}
          {detailError&&<p role="alert">{detailError}</p>}
          {detail!==null&&<pre className="br-source">{JSON.stringify(detail,null,2)}</pre>}
        </section>}
        <p className="br-source">Recording source: {header.statisticsId} · statistics revision: {header.artifactSha256}</p>
      </>}
    </>}
  </details>;
}
