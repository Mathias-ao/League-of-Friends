/** Local controlled App dependency benchmark. No hosted/browser paint claim. */
import {act} from 'react';
import {writeFileSync,unlinkSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {navigationFixture} from './detail-navigation-fixture.mjs';
const baseline=process.argv.includes('--baseline'),n=Number(process.env.AOF_NAV_SAMPLES??10),delay=80;
let Component,temporary,temporaryProfile;
if(baseline){
 const ref=process.env.AOF_NAV_BASELINE??'925101bc63434d96eabc0ae1f0211c7824417c0c';
 if(!/^[a-f0-9]{40}$/.test(ref))throw Error('Exact baseline SHA required');
 temporary=fileURLToPath(new URL('../src/ui/.navigation-baseline-'+randomUUID()+'.tsx',import.meta.url));
 temporaryProfile=temporary.replace('.tsx','-profile.tsx');
 writeFileSync(temporaryProfile,Buffer.concat([Buffer.from("import React from 'react';\n"),execFileSync('git',['show',ref+':web/src/ui/StatisticsExperience.tsx'])]));
 // Hidden temporary modules use the loader's classic JSX default. Supply its
 // runtime import; the baseline App's selection/control code stays verbatim.
 const source=execFileSync('git',['show',ref+':web/src/ui/App.tsx'],{encoding:'utf8'})
  .replace("from './StatisticsExperience'",`from './${temporaryProfile.split(/[\\/]/).at(-1).replace('.tsx','')}'`);
 writeFileSync(temporary,"import React from 'react';\n"+source);
 Component=(await import(pathToFileURL(temporary).href)).App;
}
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const percentile=(rows,p)=>rows.slice().sort((a,b)=>a-b)[Math.ceil(rows.length*p)-1];
const summarize=rows=>({p50Ms:+percentile(rows,.5).toFixed(2),p95Ms:+percentile(rows,.95).toFixed(2)});
const results=[];
try{
 for(const scale of [5,200])for(const kind of ['event','match','player'])for(const mode of ['cold-mount','warm-reopen']){
  let shared;const shell=[],essential=[],secondary=[],requests=[];
  try{for(let sample=0;sample<n;sample++){
   const ui=shared??await navigationFixture({kind,scale,Component});if(mode==='warm-reopen')shared=ui;
   const from=ui.calls.length,start=performance.now();await ui.open();
   let opened=document.querySelector('dialog[open]')?performance.now()-start:null;
   await wait(Math.max(0,delay-(performance.now()-start)));
   await act(async()=>{for(const call of ui.calls.slice(from)){
    if(call.kind==='full-event'||call.kind==='essential')call.resolve(ui.event);
    if(call.kind==='roundoff')call.resolve({eventId:ui.eventId,roundoff:ui.event.roundoff??{revision:1,points:[]}});
    if(call.kind==='match')call.resolve(ui.match);
    if(call.kind==='player')call.resolve(ui.profile);
   }});
   if(opened===null)opened=performance.now()-start;
   shell.push(opened);essential.push(performance.now()-start);
   if(kind==='event'){
    await ui.click('[role="tab"]:nth-child(3)');
    const roundoffs=ui.calls.slice(from).filter(call=>call.kind==='roundoff');
    if(roundoffs.length){await wait(delay);await act(async()=>{for(const call of roundoffs)
      call.resolve({eventId:ui.eventId,roundoff:ui.event.roundoff??{revision:1,points:[]}});});}
   }
   if(kind==='match'){
    const statistics=ui.calls.slice(from).filter(c=>c.kind==='statistics');
    if(statistics.length){await wait(delay);await act(async()=>{for(const call of statistics)call.resolve({version:'AOF_STATISTICS_EXPERIENCE_V1',games:[],unavailableGames:0});});}
   }
   secondary.push(performance.now()-start);requests.push(ui.calls.length-from);
   await ui.click('button[aria-label="Close dialog"]');
   if(!shared)await ui.close();
  }}finally{if(shared)await shared.close();}
  results.push({kind,scale,mode,samples:n,shell:summarize(shell),essential:summarize(essential),secondary:summarize(secondary),
   backendRequestsPerOpen:[...new Set(requests)]});
 }
 console.log(JSON.stringify({version:'AOF_NAVIGATION_CONTROLLED_BENCHMARK_1',strategy:baseline?'baseline-await-full':'immediate-shell',
  injectedDetailDelayMs:delay,observations:'React/JSDOM commit observation; not browser paint, real network or billable Firestore reads',
  baselineUsesPinnedAppAndProfileWithCompatibleCommonComponents:true,results},null,2));
}finally{if(temporary)unlinkSync(temporary);if(temporaryProfile)unlinkSync(temporaryProfile);}
