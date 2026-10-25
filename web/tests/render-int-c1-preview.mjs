import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {PrivateGameplayPreview} from '../src/ui/PrivateGameplayPreview.tsx';
const chunks=[];let count=0;for await(const part of process.stdin){count+=part.length;assert.ok(count<=4*1024*1024);chunks.push(part);}
const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));
const dom=new JSDOM('<div id="app"></div>',{url:'http://localhost/'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
const root=createRoot(document.getElementById('app'));
try{
 await act(async()=>root.render(React.createElement(PrivateGameplayPreview,{repository:{myGameplayPreview:async()=>value,onAuthChange:()=>()=>{}},ownerId:value.ownerPlayerId})));
 await act(async()=>document.querySelector('button').click());
 assert.equal(document.querySelector('[data-aof-gameplay-owner]').dataset.aofGameplayRevision,value.inputDigest);
 assert.equal(document.querySelectorAll('li').length,value.grades.length);
 assert.match(document.body.textContent,/Contextual grade: Pending/);assert.match(document.body.textContent,/no progression or rewards/);
 assert.ok(document.body.textContent.includes(value.grades[0].sourceAuthority));assert.equal(document.querySelector('input[type="range"]'),null);
 console.log(JSON.stringify({sourceRevisionRendered:true,pendingOnly:true,jsdomOnly:true}));
}finally{await act(async()=>root.unmount());dom.window.close();}
