import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {PreviewLeagueRepository} from '../src/data/PreviewLeagueRepository';
import {ProfileDialogWithIdentity} from '../src/ui/StatisticsExperience';

test('preview profile opens a bookmark-driven chronological Relationship Chronicle scroll',async()=>{
  const dom=new JSDOM('<div id="app"></div>',{url:'http://localhost/'});
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,localStorage:dom.window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
  dom.window.HTMLElement.prototype.scrollIntoView=()=>{};
  const {createRoot}=await import('react-dom/client');
  const root=createRoot(document.getElementById('app')!);
  const repo=new PreviewLeagueRepository();
  await repo.signIn();
  await repo.requestMembership('Reviewer','','K7M4Q9');
  await repo.enterSeason('S001');
  const snapshot=await repo.load();
  const data=await repo.player('sample-you');
  const props={snapshot,preview:true,busy:false,repository:repo,openEvent:()=>{},openMatch:()=>{},openPlayer:()=>{},act:async()=>true,enter:()=>{},navigate:()=>{}};

  try{
    assert.equal(data.relationships?.length,3);
    assert.ok(data.opponents.length>0);
    assert.ok(data.teammates.length>0);
    await act(async()=>root.render(React.createElement(ProfileDialogWithIdentity,{...props,data})));
    assert.ok(document.querySelector('.profile-deeds-bar'));
    const chronicleButton=document.querySelector('.profile-chronicle-trigger') as HTMLButtonElement|null;
    assert.ok(chronicleButton);
    assert.equal(chronicleButton!.textContent?.trim(),'Chronicle');
    await act(async()=>chronicleButton!.click());
    const dialog=document.querySelector('.relationship-chronicle-dialog') as HTMLDialogElement|null;
    assert.ok(dialog);
    assert.ok(dialog!.hasAttribute('open'));
    assert.ok(document.querySelector('.chronicle-scroll-stage'));
    assert.ok(document.querySelector('.chronicle-parchment'));
    assert.equal(document.querySelector('.chronicle-track-row'),null);
    const bookmarks=[...document.querySelectorAll('.chronicle-bookmark')] as HTMLButtonElement[];
    assert.equal(bookmarks.length,3);
    assert.equal(new Set(bookmarks.map(button=>[...button.classList].find(name=>name.startsWith('bookmark-cloth-')))).size,3);
    const ragnarBookmark=bookmarks.find(button=>button.textContent?.includes('Ragnar'));
    assert.ok(ragnarBookmark);
    await act(async()=>ragnarBookmark!.click());
    assert.equal(ragnarBookmark!.getAttribute('aria-pressed'),'true');
    assert.match(document.querySelector('.chronicle-title')?.textContent??'',/D’Karius.*Ragnar/);
    assert.match(document.querySelector('.chronicle-standing')?.textContent??'',/Rivalry is dormant/);
    assert.match(document.querySelector('.chronicle-standing')?.textContent??'',/Hostility is dormant at Grudge/);
    const titles=[...document.querySelectorAll('.chronicle-entry h4')].map(node=>node.textContent?.trim());
    assert.equal(titles[0],'First meeting across the battlefield');
    assert.equal(titles.at(-1),'The quarrel went quiet');
    const signatures=[...document.querySelectorAll('.chronicle-entry-signature')];
    assert.equal(signatures.length,5);
    assert.ok(signatures.every(signature=>signature.querySelector('time')));
  }finally{
    await act(async()=>root.unmount());
    dom.window.close();
  }
});
