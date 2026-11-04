/** Source-to-component witness only; receives the actual authenticated reader's
 * response through stdin. No replacement axis values or fake source profile. */
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {PrivatePersonalityHistory} from '../src/ui/PrivatePersonalityHistory.tsx';
const chunks=[];let bytes=0;
for await(const chunk of process.stdin){bytes+=chunk.length;assert.ok(bytes<512*1024);chunks.push(chunk);}
const history=JSON.parse(Buffer.concat(chunks).toString('utf8'));
const dom=new JSDOM('<div id="app"></div>',{url:'http://localhost/'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
let authChange=()=>{};
const repository={myPersonalityHistory:async()=>history,onAuthChange:fn=>{authChange=fn;return()=>{};}};
const root=createRoot(document.getElementById('app'));
try{
  await act(async()=>root.render(React.createElement(PrivatePersonalityHistory,{repository,ownerId:history.ownerPlayerId})));
  await act(async()=>document.querySelector('button').click());
  assert.equal(document.querySelector('[data-aof-history-owner]').dataset.aofHistoryRevision,history.inputDigest);
  const supported=history.personality.personalityProfile.sliders.filter(s=>s.status==='READY');
  assert.equal(history.personality.unlock.status,'LOCKED');
  assert.equal(history.personality.unlock.eligibleGames,2);
  const meters=[...document.querySelectorAll('meter')];
  assert.equal(supported.length,0);assert.equal(meters.length,0);
  assert.match(document.body.textContent,/Personality is locked until 3 distinct source-accepted Games/);
  assert.match(document.body.textContent,/2 of 3 eligible current Games/);
  assert.match(document.body.textContent,/2 current recordings across 2 Battles/);
  await act(async()=>authChange());assert.equal(document.querySelector('[data-aof-history-owner]'),null);
  assert.equal(document.querySelectorAll('meter').length,0);
  console.log(JSON.stringify({renderedAxes:supported.map(s=>s.axis),pendingAxes:history.personality.personalityProfile.sliders.filter(s=>s.status!=='READY').map(s=>s.axis),
    lockedUntilThreeGames:true,actualApiNumbersRendered:false,authChangeClearsNumbers:true,jsdomOnly:true}));
}finally{await act(async()=>root.unmount());dom.window.close();}
