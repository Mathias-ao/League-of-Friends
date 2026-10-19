import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {PrivatePersonalityHistory} from '../src/ui/PrivatePersonalityHistory.tsx';
import {PlayerChronicleBook} from '../src/ui/PlayerChronicleBook.tsx';
const chunks=[];let count=0;for await(const part of process.stdin){count+=part.length;assert.ok(count<512*1024);chunks.push(part);}
const {history,book,oldEntryId,counterpartId}=JSON.parse(Buffer.concat(chunks).toString('utf8'));
const dom=new JSDOM('<div id="app"></div>',{url:'http://localhost/'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
dom.window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};dom.window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
const root=createRoot(document.getElementById('app'));
const owner=history.ownerPlayerId,player={playerId:owner,steamName:'Fixture owner'},other={playerId:counterpartId,steamName:'Fixture counterpart'};
const repository={myPersonalityHistory:async()=>history,playerChronicle:async()=>book,onAuthChange:()=>()=>{}};
try{
 await act(async()=>root.render(React.createElement(PrivatePersonalityHistory,{repository,ownerId:owner})));
 await act(async()=>document.querySelector('button').click());
 assert.equal(document.querySelector('[data-aof-history-owner]').dataset.aofHistoryRevision,history.inputDigest);
 assert.equal(document.querySelectorAll('li').length,5);assert.match(document.body.textContent,/Developing/);
 const key=`aof:chronicle-seen:${owner}:${counterpartId}`;dom.window.localStorage.setItem(key,JSON.stringify([oldEntryId]));
 const profile={player,lifetime:{competition:null},activeSeason:null,achievements:[],opponents:[],teammates:[],relationships:[]};
 const snapshot={viewer:player,players:[player,other],events:[],matches:[]};
 await act(async()=>root.render(React.createElement(PlayerChronicleBook,{repository,snapshot,sourceProfile:profile,initialPagePlayerId:counterpartId,onClose:()=>{}})));
 const entry=book.chronicle.pages.find(p=>p.counterpartPlayerId===counterpartId).entries[0];
 const seen=JSON.parse(dom.window.localStorage.getItem(key));assert.ok(seen.includes(oldEntryId));assert.ok(seen.includes(entry.sceneId));
 assert.ok(document.querySelector('.chronicle-entry'));assert.equal(document.querySelectorAll('.chronicle-entry.is-new').length,0);
 console.log(JSON.stringify({privatePersonalityRendered:true,legacySeenPreserved:true,stableSceneRendered:true,jsdomOnly:true}));
}finally{await act(async()=>root.unmount());dom.window.close();}
