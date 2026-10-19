// Real emulator DTO enters only this local child process, never an artifact/log.
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {PrivateSocialExperience} from '../src/ui/PrivateSocialExperience.tsx';
const chunks=[];let length=0;
for await(const chunk of process.stdin){length+=chunk.length;assert.ok(length<64*1024);chunks.push(chunk);}
const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));
const dom=new JSDOM('<div id="app"></div>',{url:'http://localhost/'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
const root=createRoot(document.getElementById('app'));
try{
 await act(async()=>root.render(React.createElement(PrivateSocialExperience,{
  repository:{mySocialExperience:async()=>value,onAuthChange:()=>()=>{}},
  matchId:value.source.matchId,gameId:value.source.gameId,viewerId:value.ownerPlayerId,
  sourceHash:value.source.sourceHash,revision:value.source.statisticsRevision})));
 await act(async()=>document.querySelector('button').click());
 const view=document.querySelector('[data-aof-private-owner]');assert.ok(view);
 assert.equal(view.dataset.aofSource,value.source.sourceHash);
 assert.equal(view.dataset.aofRevision,String(value.source.statisticsRevision));
 assert.equal(view.dataset.aofPrivateOwner,value.ownerPlayerId);
 assert.equal(view.querySelectorAll('li').length,11);
 assert.match(view.textContent,/No social credit has been issued/);
 console.log(JSON.stringify({sourceRevisionRendered:true,allFiveAxesAndSixTracksPending:true,jsdomOnly:true}));
}finally{await act(async()=>root.unmount());dom.window.close();}
