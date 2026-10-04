import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {PreviewLeagueRepository} from '../src/data/PreviewLeagueRepository';
import {ProfileDialogWithIdentity} from '../src/ui/StatisticsExperience';

test('preview profile exposes an illustrative selectable Relationship Chronicle',async()=>{
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
    const chronicleButton=[...document.querySelectorAll('button')].find(button=>button.textContent?.includes('Chronicle')) as HTMLButtonElement|undefined;
    assert.ok(chronicleButton);
    await act(async()=>chronicleButton!.click());
    assert.ok(document.querySelector('.relationship-chronicle-view'));
    assert.ok(document.querySelector('.chronicle-parchment'));
    const bookmarkRail=document.querySelector('.chronicle-bookmarks');
    assert.ok(bookmarkRail);
    const bookmarks=[...document.querySelectorAll('.chronicle-bookmark')] as HTMLButtonElement[];
    assert.equal(bookmarks.length,3);
    const ragnarBookmark=bookmarks.find(button=>button.textContent?.includes('Ragnar'));
    assert.ok(ragnarBookmark);
    await act(async()=>ragnarBookmark!.click());
    assert.equal(ragnarBookmark!.getAttribute('aria-pressed'),'true');
    assert.match(document.querySelector('.chronicle-title')?.textContent??'',/D’Karius.*Ragnar/);
    assert.match(document.querySelector('.chronicle-track-row')?.textContent??'',/Dormant Rivalry/);
    assert.match(document.querySelector('.chronicle-entries')?.textContent??'',/The quarrel went quiet/);
  }finally{
    await act(async()=>root.unmount());
    dom.window.close();
  }
});
