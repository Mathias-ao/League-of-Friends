import {useEffect,useState} from 'react';
import type {LeagueRepository,MatchDetail,NativeE2eReview,NativeE2ePublishRequest,NativeE2eEnvironmentStatus} from '../domain/league';

/** The frontend flag controls display, not authorization. Server-side gates
 * independently enforce project, active ADMIN, worker revision and exact Game. */
export function stagingE2eUiEnabled(env:Record<string,string|boolean|undefined>=import.meta.env??{}){
  const project=env.VITE_FIREBASE_PROJECT_ID;
  return env.VITE_AOF_STAGING_E2E==='true'&&(
    (project==='age-of-friends-staging'&&env.VITE_USE_EMULATORS!=='true')||
    (project==='demo-aof-e2e'&&env.VITE_USE_EMULATORS==='true'));
}
function errorText(error:unknown){
  return error instanceof Error?error.message:'The reviewed E2E operation was refused.';
}
const SHA=/^[a-f0-9]{64}$/;
const displayHash=(value:string|null|undefined)=>value?value.slice(0,14)+'…'+value.slice(-10):'none';

/** Staging-only human outcome claims. Player B must sign in independently
 * to confirm Player A's claim. This never guesses an outcome from the replay. */
function ResultConfirmation({repository,data,game,onUpdated}:{
  repository:LeagueRepository;data:MatchDetail;game:MatchDetail['games'][number];onUpdated:()=>void;
}){
  const [selection,setSelection]=useState(''),[accepted,setAccepted]=useState(false);
  const [pending,setPending]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const teamGame=data.match.format!=='FFA';
  const teams=[...new Set(game.players.map(p=>p.team).filter((x):x is number=>typeof x==='number'))];
  const claim=game.viewerSubmission;
  const waiting=game.confirmationRequests??[];
  const eligible=data.viewer.isParticipant&&!game.result&&!game.resultDisputeOpen&&
    !['CANCELLED','VOID','COMPLETED','DISPUTED'].includes(data.match.status);
  async function call(work:()=>Promise<unknown>,msg:string){
    setPending(true);setError('');setMessage('');
    try{await work();setMessage(msg);setSelection('');setAccepted(false);onUpdated();}
    catch(e){setError(errorText(e));}finally{setPending(false);}
  }
  return <details className="draft-admin" open>
    <summary>Staging E2E · independent official result</summary>
    <p>Test-only controls for an approved Game. The chosen result is independently reviewed by people; the replay does not decide official winners.</p>
    {game.result?<p role="status">Official result revision {game.result.revision} accepted. Do not submit again.</p>:null}
    {claim&&!game.result?<p role="status">Your result claim: {claim.status}. A different participant must confirm it.</p>:null}
    {eligible&&!claim&&repository.stagingSubmitGameResult?<div className="stack">
      <label>{teamGame?'Independently verified winning side':'Independently verified FFA winner'}
        <select value={selection} onChange={e=>{setSelection(e.target.value);setAccepted(false);}}>
          <option value="">Select only after independent verification</option>
          {teamGame?teams.map(t=><option key={t} value={String(t)}>Side {t} · {game.players.filter(p=>p.team===t).map(p=>p.steamName).join(', ')}</option>):
            game.players.map(p=><option key={p.playerId} value={p.playerId}>{p.steamName}</option>)}
        </select>
      </label>
      <label><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/>
        I independently verified the official outcome, actual roster and Game settings; it was not inferred from the file.</label>
      <button disabled={pending||!selection||!accepted} onClick={()=>void call(
        ()=>repository.stagingSubmitGameResult!(data.match.matchId,game.gameId,
          teamGame?{winnerTeam:Number(selection)}:{winnerPlayerId:selection}),
        'Result submitted; another independently signed-in participant must confirm it.')}>
        Submit independent result claim
      </button>
    </div>:null}
    {eligible&&waiting.length>0&&repository.stagingConfirmGameResult?<div className="stack">
      <h4>Independent confirmation requests</h4>
      {waiting.map(c=><section key={c.submissionId}>
        <p>Submitted by {c.submittedBy.steamName} · {c.outcome?.type??'Outcome pending'} ·
          {c.outcome?.winnerTeam!=null?' team '+c.outcome.winnerTeam:
            c.outcome?.winnerPlayerId?' player '+(game.players.find(p=>p.playerId===c.outcome!.winnerPlayerId)?.steamName??'unknown'):
            ' independently selected players'}</p>
        <label><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/>
          I am another real participant and have independently confirmed this exact outcome.</label>
        <button disabled={pending||!accepted} onClick={()=>void call(
          ()=>repository.stagingConfirmGameResult!(data.match.matchId,game.gameId,c.submissionId),
          'Independent confirmation submitted; official result will be reread from the backend.')}>
          Confirm this result
        </button>
      </section>)}
    </div>:null}
    {message&&<p role="status">{message}</p>}
    {error&&<p role="alert">{error}</p>}
  </details>;
}

/** A staging/demo ADMIN can review only an exact allowlisted candidate.
 * No producer, reader, or result flags are automatically set by this panel. */
function NativeReview({repository,data,game,onUpdated}:{
  repository:LeagueRepository;data:MatchDetail;game:MatchDetail['games'][number];onUpdated:()=>void;
}){
  const [file,setFile]=useState<File|null>(null);
  const [candidateId,setCandidateId]=useState('');
  const [review,setReview]=useState<NativeE2eReview|null>(null);
  const [reason,setReason]=useState('');
  const [mappingApproved,setMappingApproved]=useState(false);
  const [officialApproved,setOfficialApproved]=useState(false);
  const [rollbackWord,setRollbackWord]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[note,setNote]=useState('');
  const [environment,setEnvironment]=useState<NativeE2eEnvironmentStatus|null>(null);
  const [environmentError,setEnvironmentError]=useState('');
  const [environmentChecking,setEnvironmentChecking]=useState(false);
  const expectedCommit=import.meta.env?.VITE_AOF_COMMIT_SHA??'';
  const environmentMatches=environment?.contract==='AOF_STAGING_E2E_PREFLIGHT_V1'&&
    environment.expectedCommit===expectedCommit;
  const canStart=environmentMatches&&environment?.configReady===true;
  const canEmergencyRollback=environmentMatches&&environment?.rollbackReady===true;
  const matchId=data.match.matchId,gameId=game.gameId;
  useEffect(()=>{setCandidateId('');setReview(null);setFile(null);setReason('');setMappingApproved(false);setOfficialApproved(false);setRollbackWord('');},[matchId,gameId]);
  async function refreshEnvironment(){
    setEnvironmentChecking(true);setEnvironmentError('');setEnvironment(null);
    if(!/^[a-f0-9]{40}$/.test(expectedCommit)||!repository.stagingNativeStatus){
      setEnvironmentError('NO-GO: This staging website has no reviewed Git commit configured.');
      setEnvironmentChecking(false);return;
    }
    try{
      const result=await repository.stagingNativeStatus(matchId,gameId,expectedCommit);
      if(result.contract!=='AOF_STAGING_E2E_PREFLIGHT_V1')
        throw new Error('Unsupported or stale staging health response.');
      setEnvironment(result);
    }catch(e){setEnvironmentError(errorText(e));}
    finally{setEnvironmentChecking(false);}
  }
  useEffect(()=>{void refreshEnvironment();},[matchId,gameId]);
  async function task(run:()=>Promise<void>){
    setBusy(true);setError('');setNote('');
    try{await run();}catch(e){setError(errorText(e));}
    finally{setBusy(false);}
  }
  function resetReview(){
    setReview(null);setMappingApproved(false);setOfficialApproved(false);setRollbackWord('');
  }
  async function readReview(id:string){
    const d=await repository.stagingNativeReview!(matchId,gameId,id.trim());
    if(d.contract!=='AOF_NATIVE_E2E_REVIEW_V1')throw new Error('Unsupported review source');
    setReview(d);setCandidateId(d.candidateId);setMappingApproved(false);setOfficialApproved(false);
  }
  async function validate(){
    if(!file||file.size===0||file.size>32*1024*1024)throw new Error('Choose a nonempty real recording up to 32 MiB');
    const response=await repository.stagingNativeValidate!(matchId,gameId,file);
    if(response.state!=='VALIDATED_NOT_READY'||response.activated!==false||!SHA.test(response.candidateId))
      throw new Error('Native validation failed to preserve unpublished candidate status.');
    resetReview();setCandidateId(response.candidateId);
    setNote('VALIDATED_NOT_READY: no READY source or awards. Result must be independently confirmed before publication.');
    await readReview(response.candidateId);
  }
  async function publish(operation:'PUBLISH'|'ROLLBACK'){
    if(!review)throw new Error('Review the pinned source first.');
    if(operation==='PUBLISH'&&!canStart)
      throw new Error('NO-GO: matching staging build, worker and all native flags are not verified.');
    if(operation==='ROLLBACK'&&!canEmergencyRollback)
      throw new Error('NO-GO: the separately gated emergency rollback is not approved.');
    const isPublish=operation==='PUBLISH';
    if(isPublish&&!review.candidatePublishEligible)throw new Error('Independent result or candidate is not currently eligible.');
    if(!isPublish&&!review.nativeSourceIsActive)throw new Error('Candidate is no longer the active native source.');
    if(!mappingApproved||!officialApproved||reason.trim().length<20||reason.length>1000)
      throw new Error('Recheck the exact roster/source/outcome and record a complete review reason.');
    if(!isPublish&&rollbackWord!=='ROLLBACK')throw new Error('Type ROLLBACK to confirm source-only rollback.');
    if(review.expectedResultRevision==null)throw new Error('No eligible independently accepted official result revision');
    const request:NativeE2ePublishRequest={
      operation,matchId,gameId,candidateId:review.candidateId,sourceHash:review.sourceHash,
      expectedArtifactSha256:review.statisticsSha256,
      expectedActiveSourceHash:review.expectedActiveSourceHash,
      expectedStatisticsRevision:review.expectedStatisticsRevision,
      expectedResultRevision:review.expectedResultRevision,reason:reason.trim()
    };
    const result=await repository.stagingNativePublish!(request);
    if(result.state!==(isPublish?'READY':'ROLLED_BACK'))
      throw new Error('Publication returned an unexpected state.');
    setNote(operation+' accepted with revised source pointer. Reopen the Battle detail to verify it.');
    setReason('');resetReview();await readReview(review.candidateId);
    onUpdated();
  }
  const displayedEligible=!!review?.candidatePublishEligible&&!game.resultDisputeOpen;
  const canReview=reason.trim().length>=20&&reason.length<=1000&&mappingApproved&&officialApproved;
  return <details className="draft-admin" open>
    <summary>Staging E2E · Emperor native evidence review</summary>
    <p>Experimental, exact-Game allowlisted, disabled by default. Normal Upload recording remains legacy.
      Native validation only creates an unpublished candidate. READY publication requires independently
      accepted result authority and all backend staging gates.</p>
    <div className="stack">
      <section className="stack" aria-label="Staging release and flags preflight">
        <strong>Authenticated staging environment preflight</strong>
        <p>Client commit {expectedCommit||'UNPINNED'} · backend status {environmentChecking?'checking':
          !environmentMatches?'NO-GO':environment?.configReady?'CONFIG CHECK PASSED':'NO-GO'}.
          A configuration check does not certify login, backups, worker connectivity or a successful browser E2E.</p>
        {environmentMatches&&!environment?.configReady&&<p role="alert">
          Missing release gates: {environment!.blockers.join(', ')}.
          Emergency source rollback {environment!.rollbackReady?'remains separately allowed':'is also unavailable'}.
        </p>}
        {environmentError&&<p role="alert">{environmentError}</p>}
        <button disabled={environmentChecking||busy} onClick={()=>void refreshEnvironment()}>
          Recheck deployed commit and scoped Game flags
        </button>
      </section>
      <label>Genuine source .aoe2record (not part of the normal player upload)
        <input type="file" accept=".aoe2record" onChange={e=>setFile(e.target.files?.[0]??null)}/>
      </label>
      <button disabled={busy||!file||file.size===0||file.size>32*1024*1024||
        !repository.stagingNativeValidate||!!game.result||!canStart}
        onClick={()=>void task(validate)}>Validate only — never publish READY</button>
      {!!game.result&&<p>Game result already accepted. Do not validate a different source without the reviewed correction protocol.</p>}
      <label>Exact SHA-256 candidate ID from validation (paste after reopening this Battle)
        <input value={candidateId} onChange={e=>{setCandidateId(e.target.value.trim().toLowerCase());resetReview();}}
          maxLength={64} placeholder="64 hexadecimal characters"/>
      </label>
      <button disabled={busy||!SHA.test(candidateId)||!repository.stagingNativeReview||!(canStart||canEmergencyRollback)}
        onClick={()=>void task(()=>readReview(candidateId))}>Load current admin review snapshot</button>
      {review&&<section className="stack" aria-label="Reviewed native candidate">
        <p>Candidate: <strong>{review.candidateState}</strong>. Source: <code>{review.sourceHash}</code></p>
        <p>Artifact SHA: <code>{review.statisticsSha256}</code> · Recorded Events: {displayHash(review.recordedEventsSha256)}
          · permanent original: {displayHash(review.originalSha256)} ({review.originalBytes} bytes).</p>
        <p>Game {review.gameStatus}; Match {review.matchStatus}; format {review.matchFormat}.
          Current active source: {displayHash(review.expectedActiveSourceHash)};
          statistics revision {review.expectedStatisticsRevision}.</p>
        <p>Official outcome: {review.officialQualification} ({review.officialSource??review.officialReason??'not accepted'})
          · revision {review.expectedResultRevision??'none'} · type {review.officialOutcomeType??'none'}.
          Winning Player IDs: {(review.officialWinnerPlayerIds??[]).join(', ')||'unavailable'}.</p>
        <h4>Source-to-league identity bindings (review manually)</h4>
        <ul>{review.sourcePlayers.map(p=><li key={p.replaySlot}>
          Slot {p.replaySlot}: source <strong>{p.sourceName}</strong> → league <strong>{
            game.players.find(player=>player.playerId===p.playerId)?.steamName??'UNKNOWN PLAYER'}</strong>
          </li>)}</ul>
        <label>Reviewed reason (20–1000 characters)
          <textarea value={reason} maxLength={1000} onChange={e=>setReason(e.target.value)}
            placeholder="Describe independently verified source, Game setup and official outcome."/>
        </label>
        <label><input type="checkbox" checked={mappingApproved}
          onChange={e=>setMappingApproved(e.target.checked)}/>
          I reviewed the exact replay identities, real Game/Match, map/settings and source SHA.</label>
        <label><input type="checkbox" checked={officialApproved}
          onChange={e=>setOfficialApproved(e.target.checked)}/>
          I independently checked the accepted result and current source/revision; I did not infer the winner from the replay.</label>
        {displayedEligible&&<button className="primary" disabled={busy||!canReview||!repository.stagingNativePublish||!canStart}
          onClick={()=>void task(()=>publish('PUBLISH'))}>Audited manual PUBLISH to READY</button>}
        {review.nativeSourceIsActive&&<div className="stack">
          <p>Emergency source-only rollback does not undo an independently accepted result;
            do not use for a corrected-result rebind.</p>
          <label>Type ROLLBACK<input value={rollbackWord} onChange={e=>setRollbackWord(e.target.value)}/></label>
          <button disabled={busy||!canReview||rollbackWord!=='ROLLBACK'||!repository.stagingNativePublish||!canEmergencyRollback}
            onClick={()=>void task(()=>publish('ROLLBACK'))}>Audited ROLLBACK of native source</button>
        </div>}
        {!displayedEligible&&!review.nativeSourceIsActive&&<p role="status">
          Not eligible for ordinary PUBLISH. Independently resolve/confirm the official result or inspect source revisions,
          then refresh this snapshot. Do not bypass the backend gate.</p>}
      </section>}
    </div>
    {note&&<p role="status">{note}</p>}
    {error&&<p role="alert">{error}</p>}
  </details>;
}

export function StagingE2eControls({data,game,repository,role,onUpdated}:{
  data:MatchDetail;game:MatchDetail['games'][number];repository:LeagueRepository;
  role:string|undefined;onUpdated:()=>void;
}){
  if(!stagingE2eUiEnabled())return null;
  const hasPlayerApi=!!repository.stagingSubmitGameResult&&!!repository.stagingConfirmGameResult;
  const hasAdminApi=!!repository.stagingNativeReview&&!!repository.stagingNativePublish&&
    !!repository.stagingNativeValidate;
  return <section aria-label="Staging E2E only" className="stack">
    <p className="sx-notice"><strong>Staging E2E controls only.</strong> Not normal league processing.
      All actions use authenticated backend callables; ordinary replay upload remains legacy.
      A green test here is not production activation.</p>
    {data.viewer.isParticipant&&hasPlayerApi&&<ResultConfirmation key={'result:'+data.match.matchId+':'+game.gameId}
      data={data} game={game} repository={repository} onUpdated={onUpdated}/>}
    {role==='ADMIN'&&hasAdminApi&&<NativeReview key={'native:'+data.match.matchId+':'+game.gameId}
      data={data} game={game} repository={repository} onUpdated={onUpdated}/>}
  </section>;
}
