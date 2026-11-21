import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {PlayerIdentityExperience,playerIdentity} from '../src/ui/StatisticsExperience';
import type {PlayerProfile} from '../src/domain/league';
import type {LivePersonalityEvidence} from '../src/domain/privateHistory';

const data={player:{playerId:'owner',steamName:'Owner'}} as PlayerProfile;
const axes=['BOOMER_AGGRESSOR','CAUTIOUS_BOLD','GUERRILLA_FRONTLINE',
  'SPECIALIST_IMPROVISER','COMPACT_EXPANSIVE'] as const;
function live(battles:number,games:number):LivePersonalityEvidence{
  return {version:'AOF_PERSONALITY_LIVE_EVIDENCE_V1',requiredGames:3,
    eligibleGames:games,gameUnlock:games>=3?'UNLOCKED':'LOCKED',
    requiredQualifiedBattles:3,qualifiedBattles:battles,
    status:battles>=3?'CALIBRATION_PENDING':'PENDING_BATTLES',
    calibration:'NOT_APPROVED',
    axes:axes.map((axis,i)=>({axis,
      status:i===0?'CALIBRATION_PENDING':'DEVELOPING',
      value:null,measuredBattles:i===0?battles:0,
      reasons:i===0?['APPROVED_HOSTED_CALIBRATION_REQUIRED']:
        ['CLASSIFIED_FAMILY_OPPORTUNITY_UNAVAILABLE']}))};
}

test('live profile before owner read is pending rather than falsely zero qualified Battles',()=>{
  const p=playerIdentity(data,false,null,'LOADING');
  assert.equal(p.eligibleBattles,null);
  assert.equal(p.eligibleGames,null);
  assert.equal(p.evidenceStatus,'LOADING');
  assert.ok(p.sliders.every(s=>s.value===null));
});
test('three Games and three complete Battles expose honest counts with five independent Developing/calibration reasons',()=>{
  const p=playerIdentity(data,false,live(4,4),'CURRENT');
  assert.equal(p.eligibleBattles,4);
  assert.equal(p.eligibleGames,4);
  assert.equal(p.evidenceStatus,'CURRENT');
  assert.equal(p.sliders[0].status,'CALIBRATION_PENDING');
  assert.equal(p.sliders[0].measuredBattles,4);
  assert.equal(p.sliders[0].value,null);
  assert.ok(p.sliders[1].reasons?.includes('CLASSIFIED_FAMILY_OPPORTUNITY_UNAVAILABLE'));
  assert.ok(p.sliders.every(s=>s.value===null));
});
test('three accepted BO3 Games do not turn one Battle into three qualified Battles',()=>{
  const p=playerIdentity(data,false,live(1,3),'CURRENT');
  assert.equal(p.eligibleGames,3);
  assert.equal(p.eligibleBattles,1);
});
test('withdrawal to two source Games retracts unlock and count',()=>{
  const p=playerIdentity(data,false,live(2,2),'CURRENT');
  assert.equal(p.eligibleBattles,2);
  assert.equal(p.eligibleGames,2);
  assert.ok(p.sliders.every(s=>s.value===null));
});
test('only reviewed server-approved per-axis READY can reveal numeric, other dimensions stay Developing',()=>{
  const x=live(4,4);
  x.calibration='APPROVED';x.axes[0].status='READY';x.axes[0].value=0;
  x.axes[0].measuredBattles=4;
  let p=playerIdentity(data,false,x,'CURRENT');
  assert.equal(p.sliders[0].value,0);
  assert.equal(p.sliders[1].value,null);
  x.axes[0].measuredBattles=1;
  p=playerIdentity(data,false,x,'CURRENT');
  assert.equal(p.sliders[0].value,null);
  x.axes[0].measuredBattles=4;x.calibration='NOT_APPROVED';
  p=playerIdentity(data,false,x,'CURRENT');
  assert.equal(p.sliders[0].value,null);
});
test('malformed owner-private data cannot masquerade as qualified profile',()=>{
  const x=live(4,4);
  x.axes[2].axis='BOOMER_AGGRESSOR';
  const p=playerIdentity(data,false,x,'UNAVAILABLE');
  assert.equal(p.eligibleBattles,null);
  assert.ok(p.sliders.every(s=>s.value===null));
});

test('rendered live owner UI reveals 4 counted Battles with Developing reasons and no invented midpoint; preview remains intact',async()=>{
  const dom=new JSDOM('<div id="app"></div>',{url:'http://localhost/'});
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,
    HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
  const root=createRoot(dom.window.document.getElementById('app')!);
  try{
    const liveIdentity=playerIdentity(data,false,live(4,4),'CURRENT');
    await act(async()=>root.render(React.createElement(PlayerIdentityExperience,{
      data,preview:false,identityOverride:liveIdentity})));
    assert.match(dom.window.document.body.textContent!,/Calibration pending/);
    assert.match(dom.window.document.body.textContent!,/4 independently measured Battles/);
    assert.match(dom.window.document.body.textContent!,/reviewed hosted calibration is not yet approved/);
    assert.equal(dom.window.document.querySelectorAll('.personality-track i').length,0);
    const illustrated={...data,player:{...data.player,playerId:'sample-ragnar'}};
    await act(async()=>root.render(React.createElement(PlayerIdentityExperience,{
      data:illustrated,preview:true,
      identityOverride:playerIdentity(illustrated,true)})));
    assert.match(dom.window.document.body.textContent!,/78 \/ 100/);
    assert.equal(dom.window.document.querySelectorAll('.personality-track i').length,5);
  }finally{await act(async()=>root.unmount());dom.window.close();}
});
