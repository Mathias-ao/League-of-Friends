#!/usr/bin/env node
/** Offline DevTools-snippet generator. It performs no network or cloud action.
 * Run --help for protected manual capture instructions and unresolved gaps.
 */
import {pathToFileURL} from 'node:url';

export function validateObserverConfig(input){
  const c={...input};
  const origin=new URL(c.origin);
  const staging=['https://age-of-friends-staging.web.app','https://age-of-friends-staging.firebaseapp.com'].includes(origin.origin);
  if(origin.origin!==c.origin||origin.username||origin.password||!staging)throw Error('Explicit pinned staging origin required; production and localhost are denied.');
  if(c.project!=='age-of-friends-staging')throw Error('The fixed staging project is required.');
  if(!['compact','submit'].includes(c.mode))throw Error('Choose compact selection commit or selected-file submit.');
  if(!/^[a-f0-9]{64}$/.test(c.sourceSha256??''))throw Error('An independently pinned original SHA-256 is required.');
  if(!Number.isSafeInteger(c.revision)||c.revision<1)throw Error('Pin the expected statistics revision.');
  for(const key of ['matchId','gameId'])if(!/^[A-Za-z0-9_-]{1,200}$/.test(c[key]??''))throw Error('Pin the private target Game.');
  return {origin:c.origin,project:c.project,mode:c.mode,sourceSha256:c.sourceSha256,revision:c.revision,matchId:c.matchId,gameId:c.gameId};
}

/** Pure, privacy-minimizing reducer, also used by local synthetic unit tests. */
export function createUploadCapture(config,now){
  const state={t0:null,uploadStarted:null,uploadReturned:null,queryReturned:null,tableObserved:null,docketObserved:null,manualConfirmation:null,
    autoObserved:false,authHeaderObserved:false,additionalUploadObserved:false,uploadMatched:false,sourceMatched:false,superseded:false,alreadyProcessed:null,officialAggregateEligible:null,playerCount:null};
  const unwrap=body=>body?.result??body?.data??body;
  return {
    commit(){if(state.t0===null)state.t0=now();},
    uploadStarted(meta){if(state.t0===null)return false;if(state.uploadStarted!==null){state.additionalUploadObserved=true;return false;}
      state.uploadStarted=now();state.autoObserved=meta.auto===true;state.authHeaderObserved=meta.auth===true;return true;},
    uploadReturned(body){if(state.uploadStarted===null)return;const r=unwrap(body);state.uploadReturned=now();
      state.alreadyProcessed=r?.alreadyProcessed===true;state.uploadMatched=r?.state==='READY'&&r?.sourceHash===config.sourceSha256&&r?.replayStatisticsRevision===config.revision&&r?.matchId===config.matchId&&r?.gameId===config.gameId;},
    statisticsReturned(body){if(state.t0===null)return;const r=unwrap(body);
      const games=Array.isArray(r?.games)?r.games.filter(g=>g.matchId===config.matchId&&g.gameId===config.gameId):[];
      if(games.length!==1)return;
      const g=games[0];
      if(g.sourceHash!==config.sourceSha256||g.revision!==config.revision){if(g.revision>=config.revision)state.superseded=true;return;}
      const players=g.players;
      if(r.version!=='AOF_STATISTICS_EXPERIENCE_V3'||!Array.isArray(players)||players.length<2||players.length>8||
        new Set(players.map(p=>p.playerId)).size!==players.length||
        !players.every(p=>p.values&&Object.values(p.values).some(v=>typeof v==='number'&&Number.isFinite(v))))return;
      state.queryReturned=now();state.sourceMatched=true;state.playerCount=players.length;state.officialAggregateEligible=g.eligible===true;
    },
    observeDom({table,docket}){if(state.queryReturned===null||state.superseded)return;
      if(table&&state.tableObserved===null)state.tableObserved=now();
      if(table&&docket&&state.docketObserved===null)state.docketObserved=now();},
    confirmDisplayed(){if(!state.uploadMatched||!state.sourceMatched||!state.autoObserved||!state.authHeaderObserved||state.docketObserved===null||state.superseded||state.additionalUploadObserved)
      throw Error('Need matching READY, AUTO/auth evidence, current source-bound visible docket and usable statistics.');
      state.manualConfirmation=now();return this.report();},
    report(){const elapsed=t=>t===null||state.t0===null?null:Math.round((t-state.t0)*1000)/1000;
      return {contract:'AOF_UPLOAD_BROWSER_OBSERVER_1',t0Boundary:config.mode==='compact'?'trusted selected-file change before React upload':'trusted selected-file submit click before React upload',
        commitObserved:state.t0!==null,autoObserved:state.autoObserved,authHeaderObserved:state.authHeaderObserved,uploadMatched:state.uploadMatched,
        sourceMatched:state.sourceMatched,superseded:state.superseded,additionalUploadObserved:state.additionalUploadObserved,alreadyProcessed:state.alreadyProcessed,playerCount:state.playerCount,officialAggregateEligible:state.officialAggregateEligible,
        clientCommitToFetchMs:elapsed(state.uploadStarted),uploadResponseMs:elapsed(state.uploadReturned),sourceQualifiedQueryMs:elapsed(state.queryReturned),
        tableObservedAfterQueryMs:elapsed(state.tableObserved),sourceDocketObservedMs:elapsed(state.docketObserved),manualDisplayUpperBoundMs:elapsed(state.manualConfirmation),
        paintStatus:'NOT_AUTOMATICALLY_MEASURED',serverSpanCorrelation:'UNAVAILABLE_ANONYMOUS_SERVER_SPANS',p95Status:'NOT_ESTABLISHED'};},
  };
}

/** Read-only observer of requests already initiated by the actual application.
 * Never sends a request, reads a File, exports credentials, or stores payloads.
 */
export function installUploadObserver(config,win=window){
  config=validateObserverConfig(config);
  if(win.location.origin!==config.origin)throw Error('Browser origin differs from the explicitly pinned environment.');
  if(win.__aofUploadObserver)throw Error('Stop the previous observer before another attempt.');
  const capture=createUploadCapture(config,()=>win.performance.now());
  const originalFetch=win.fetch;let stopped=false;
  const callable=input=>{
    try{const u=new URL(typeof input==='string'?input:input.url,win.location.href),name=u.pathname.split('/').at(-1);
      if(!['uploadReplay','getStatisticsExperience'].includes(name))return null;
      const staged=u.origin===`https://europe-west1-${config.project}.cloudfunctions.net`&&u.pathname===`/${name}`;
      return staged?name:null;
    }catch{return null;}
  };
  async function observeJson(response,kind){
    // Consume only a clone, bounded to 8 MiB. Never retain response objects,
    // names, identities, headers, source hashes or payloads in the export.
    const clone=response.clone(),reader=clone.body?.getReader();if(!reader)return;
    const chunks=[];let size=0;
    try{while(true){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;
      if(size>8*1024*1024){await reader.cancel();return;}chunks.push(next.value);}
      const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
      const body=JSON.parse(new TextDecoder().decode(bytes));
      if(!stopped){if(kind==='uploadReplay')capture.uploadReturned(body);else capture.statisticsReturned(body);}
    }catch{/* Generic parse/size/network failures leave the observer incomplete. */}
  }
  function wrappedFetch(input,init){
    const kind=callable(input);let observe=true;
    if(kind==='uploadReplay'){
      let auth=false;try{auth=new win.Headers(init?.headers??input?.headers).has('authorization');}catch{}
      // Current FirebaseLeagueRepository serializes processingMode last. A
      // missing/unrecognized tail stays UNKNOWN; never scan or retain base64.
      const auto=typeof init?.body==='string'&&/"processingMode"\s*:\s*"AUTO"\s*}/.test(init.body.slice(-256));
      observe=capture.uploadStarted({auth,auto});
    }
    const result=originalFetch.call(this,input,init);
    if(kind&&observe)result.then(response=>{if(response.ok)void observeJson(response,kind).catch(()=>{});},()=>{});
    return result;
  }
  function commit(event){
    if(!event.isTrusted)return;
    const target=event.target;
    if(config.mode==='compact'&&event.type==='change'&&target?.matches?.('.battle-recording-action input[type="file"][aria-label="Choose Battle recording"]')&&target.files?.length===1)capture.commit();
    if(config.mode==='submit'&&event.type==='click'){
      const button=target?.closest?.('.replay-upload-form button.primary');
      if(button&&!button.disabled&&button.closest('.replay-upload-form')?.querySelector('input[type="file"]')?.files?.length===1)capture.commit();
    }
  }
  const visible=element=>{if(!element||win.document.visibilityState!=='visible')return false;
    const style=win.getComputedStyle(element),rect=element.getBoundingClientRect();
    return style.display!=='none'&&style.visibility==='visible'&&Number(style.opacity)!==0&&rect.width>0&&rect.height>0&&rect.bottom>0&&rect.right>0&&rect.top<win.innerHeight&&rect.left<win.innerWidth;};
  function sampleDom(){
    if(stopped)return;
    for(const ledger of win.document.querySelectorAll('.battle-ledger')){
      const table=ledger.querySelector('.battle-ledger-table');
      const usable=!!table&&[...table.querySelectorAll('.sx-value-button')].some(cell=>!/^(?:—|N\/A|\s*)$/.test(cell.textContent.trim()));
      const source=ledger.querySelector('.battle-ledger-source'),text=source?.textContent?.replace(/\s+/g,' ')??'';
      const docket=usable&&visible(source)&&text.includes(`${config.matchId} / ${config.gameId} · revision ${config.revision} ·`)&&text.endsWith(`Recording: ${config.sourceSha256}`);
      capture.observeDom({table:usable&&visible(table),docket:false});
      // The source docket and table belong to the same current component. An
      // operator must still visually confirm; rAF is not a paint certificate.
      if(docket)capture.observeDom({table:usable,docket:true});
    }
  }
  const observer=new win.MutationObserver(()=>{win.requestAnimationFrame(sampleDom);});
  observer.observe(win.document.documentElement,{subtree:true,childList:true,attributes:true});
  win.document.addEventListener('change',commit,true);win.document.addEventListener('click',commit,true);win.fetch=wrappedFetch;
  const api={report:()=>capture.report(),confirmDisplayed:()=>{sampleDom();return capture.confirmDisplayed();},stop:()=>{
    stopped=true;observer.disconnect();win.document.removeEventListener('change',commit,true);win.document.removeEventListener('click',commit,true);
    if(win.fetch===wrappedFetch)win.fetch=originalFetch;delete win.__aofUploadObserver;return capture.report();}};
  win.__aofUploadObserver=api;return api;
}

export function observerSnippet(config){
  const validated=validateObserverConfig(config);
  return `(()=>{const validateObserverConfig=${validateObserverConfig.toString()};const createUploadCapture=${createUploadCapture.toString()};return (${installUploadObserver.toString()})(${JSON.stringify(validated)});})();`;
}

const HELP=`Offline helper only; no deployment, browser connection or upload is initiated.
Usage: node scripts/upload-staging-observer.mjs --emit-snippet --origin ORIGIN --project age-of-friends-staging --mode compact|submit --source-sha SHA256 --revision N --match-id PRIVATE_ID --game-id PRIVATE_ID

Keep the generated snippet/config private. Install it manually in DevTools only
inside a separately authorized test window, after login and before selecting a
file. Use compact for the current Battle upload: T0 is the trusted file-change
commit, before ArrayBuffer/base64; opening the file picker is NOT T0. submit
uses the noncompact selected-file submit click. Drop uploads are unsupported.

Perform the ordinary AUTO flow. Open Battle Ledger and a measurement's evidence
docket. Visually check usable statistics, correct source/revision and pending
official outcome if applicable. Then run __aofUploadObserver.confirmDisplayed().
This reports a CONSERVATIVE MANUAL UPPER BOUND including navigation/check time,
not automated source-matched paint. report() exports only booleans/counts/times;
stop() restores fetch/listeners. Do not export HAR, headers, request bodies,
console snapshots, credentials, filenames, replay bytes or participant names.
Keep any required visual evidence/DevTools Performance filmstrip private.

Gaps: no source/revision fence on the ledger root before opening its evidence
docket; a later docket cannot prove an earlier table's source. Response cloning
adds uncalibrated observer overhead. SDK transport changes, Cloud Run callable
URLs or unavailable AUTO/auth evidence leave capture incomplete. Current server
spans lack per-request end-to-end correlation; do not join anonymous worker and
handler spans merely by overlapping clocks. Browser paint/p95 and cloud cold
starts remain unproven. No network, cloud flags or backend state is changed.
`;
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const args=process.argv.slice(2);
  if(args.length===0||args.includes('--help'))process.stdout.write(HELP);
  else{
    if(!args.includes('--emit-snippet')&&!args.includes('--snippet'))throw Error('Explicit --emit-snippet required.');
    const values={};for(let i=0;i<args.length;i++){if(['--emit-snippet','--snippet'].includes(args[i]))continue;
      if(!['--origin','--project','--mode','--source-sha','--revision','--match-id','--game-id'].includes(args[i])||!args[i+1])throw Error('Invalid option.');values[args[i].slice(2)]=args[++i];}
    process.stdout.write(observerSnippet({origin:values.origin,project:values.project,mode:values.mode,sourceSha256:values['source-sha'],revision:Number(values.revision),matchId:values['match-id'],gameId:values['game-id']})+'\n');
  }
}
