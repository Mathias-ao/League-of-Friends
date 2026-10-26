import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {PrivateProgression} from '../src/ui/PrivateProgression.tsx';
const chunks=[];let count=0;for await(const c of process.stdin){count+=c.length;assert.ok(count<=4*1024*1024);chunks.push(c);}
const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));
const dom=new JSDOM('<div id="app"></div>',{url:'http://localhost/'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
const root=createRoot(document.getElementById('app'));let authChanged;
const repository={mySocialProgression:async()=>value,onAuthChange:fn=>{authChanged=fn;return()=>{};}};
try{
 await act(async()=>root.render(React.createElement(PrivateProgression,{repository,ownerId:value.ownerPlayerId})));
 await act(async()=>document.querySelector('button').click());
 assert.equal(document.querySelector('[data-aof-progression-owner]').dataset.aofProgressionRevision,value.inputDigest);
 assert.match(document.body.textContent,/simulated stage/);assert.match(document.body.textContent,/independently witnessed Events in this direction/);assert.match(document.body.textContent,/Pending methods/);
 assert.ok(value.cards.some(c=>document.body.textContent.includes(c.sourceAuthority)));
 assert.match(document.body.textContent,/no public score, award or entitlement/);
 assert.equal(document.querySelector('input[type="range"]'),null);
 await act(async()=>authChanged());assert.equal(document.querySelector('[data-aof-progression-owner]'),null);
 await act(async()=>document.querySelector('button').click());
 await act(async()=>root.render(React.createElement(PrivateProgression,{repository,ownerId:'another-owner'})));
 assert.equal(document.querySelector('[data-aof-progression-owner]'),null);
 console.log(JSON.stringify({sourceRevisionRendered:true,genuineSimulatedStageRendered:true,pendingUnsupported:true,authChangeClearsHistory:true,jsdomOnly:true}));
}finally{await act(async()=>root.unmount());dom.window.close();}
