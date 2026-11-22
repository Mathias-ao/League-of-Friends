/** Mounted real owner-profile consumer; only the Auth/callable boundary is fake.
 * CLI input may be the real source-derived private DTO from emulator acceptance. */
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {ProfileDialogWithIdentity} from '../src/ui/StatisticsExperience.tsx';
import {emptySnapshot} from '../src/domain/league.ts';
export async function mountHostedSocial({owner='owner',enabled=true,uid='firebase-owner'}={}){
 const dom=new JSDOM('<div id="app"></div>',{url:'http://localhost/',pretendToBeVisual:true});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
 const root=createRoot(document.getElementById('app')),listeners=new Set(),calls=[];
 const repository={mode:'live',currentAuthUid:()=>uid,canReadMyHostedSocialProgression:()=>enabled,
  myHostedSocialProgression:()=>new Promise((resolve,reject)=>calls.push({resolve,reject})),
  onAuthChange:fn=>{listeners.add(fn);queueMicrotask(()=>{if(listeners.has(fn))fn();});return()=>listeners.delete(fn);}};
 const render=async(player=owner,viewer=player,membership='ACTIVE')=>{
  const snapshot={...emptySnapshot(),membership,viewer:viewer?{playerId:viewer,steamName:viewer}:null,
   players:[],season:{seasonId:'s1',name:'Season I',status:'ACTIVE'}};
  const data={player:{playerId:player,steamName:player},lifetime:{competition:null},activeSeason:null,
   achievements:[],opponents:[],teammates:[]};
  await act(async()=>root.render(React.createElement(ProfileDialogWithIdentity,{repository,snapshot,data,preview:false,busy:false,
   openPlayer:()=>{},openMatch:()=>{},openEvent:()=>{},act:async()=>true,enter:()=>{},navigate:()=>{}})));
 };
 await render();
 return {calls,render,body:()=>document.body.textContent,
  async complete(index,value){assert.ok(calls[index]);await act(async()=>calls[index].resolve(value));},
  async fail(index,error=new Error('Unavailable')){await act(async()=>calls[index].reject(error));},
  async auth(newUid){await act(async()=>{uid=newUid;for(const fn of listeners)fn();});},
  async click(){const button=document.querySelector('.private-social-progression button');assert.ok(button);await act(async()=>button.click());},
  async focus(){await act(async()=>window.dispatchEvent(new dom.window.Event('focus')));},
  async close(){await act(async()=>root.unmount());dom.window.close();}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 let text='';for await(const chunk of process.stdin)text+=chunk;
 const dto=JSON.parse(text),app=await mountHostedSocial({owner:dto.ownerPlayerId});
 try{
  await app.complete(0,dto);assert.match(app.body(),/Private pilot · source-supported conduct/);
  const numerics=[...Object.values(dto.reputation).map(t=>t.career),
   ...dto.relationships.flatMap(p=>Object.values(p.tracks).flatMap(t=>[t.outgoing,t.incoming]))]
   .filter(t=>t.progression==='PRIVATE_PREVIEW');
  const incomplete=process.argv.includes('--incomplete');
  if(incomplete){assert.equal(dto.coverage.complete,false);assert.equal(dto.relationships.length,0);
   assert.match(app.body(),/Shared history is incomplete/);assert.doesNotMatch(app.body(),/No current shared recorded Battles/);
  }else assert.ok(numerics.length,'Genuine source must produce at least one private numerical projection');
  for(const t of numerics)assert.ok(app.body().includes('Preview stage '+t.stage+' · Bank '+t.upBank));
  assert.match(app.body(),/Not yet measured/);
  await app.auth(null);assert.doesNotMatch(app.body(),/Preview stage/);
  console.log(JSON.stringify({version:dto.version,sourceDerivedProjectionRendered:true,logoutClears:true,
   incompleteSharedHistory:incomplete,numericTracks:numerics.length}));
 }finally{await app.close();}
}
