import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {PreviewLeagueRepository} from '../src/data/PreviewLeagueRepository';
import {ProfileDialogWithIdentity} from '../src/ui/StatisticsExperience';

const flush=()=>new Promise<void>(resolve=>setTimeout(resolve,0));

test('Chronicle is one viewer-owned book and profile entry points select the matching bookmark',async()=>{
  const dom=new JSDOM('<div id="app"></div>',{url:'http://localhost/'});
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,HTMLDialogElement:dom.window.HTMLDialogElement,localStorage:dom.window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
  dom.window.HTMLElement.prototype.scrollIntoView=()=>{};
  const {createRoot}=await import('react-dom/client');
  const root=createRoot(document.getElementById('app')!);
  const repo=new PreviewLeagueRepository();
  await repo.signIn();
  await repo.requestMembership('Reviewer','','K7M4Q9');
  await repo.enterSeason('S001');
  const snapshot=await repo.load();
  const owner=await repo.player('sample-you');
  const ragnar=await repo.player('sample-ragnar');
  const props={snapshot,preview:true,busy:false,repository:repo,openEvent:()=>{},openMatch:()=>{},openPlayer:()=>{},act:async()=>true,enter:()=>{},navigate:()=>{}};

  try{
    await act(async()=>root.render(React.createElement(ProfileDialogWithIdentity,{...props,data:owner})));
    assert.equal(document.querySelector('.profile-subnav'),null);
    const ownerTrigger=document.querySelector('.profile-chronicle-trigger') as HTMLButtonElement|null;
    assert.ok(ownerTrigger);
    await act(async()=>{ownerTrigger!.click();await flush();});
    assert.ok(document.querySelector('.relationship-chronicle-dialog'));
    const ownerBookmarks=[...document.querySelectorAll('.chronicle-bookmark')] as HTMLButtonElement[];
    assert.equal(ownerBookmarks.length,snapshot.players.length,'the book reserves a bookmark for every league player');
    assert.equal(document.querySelectorAll('.bookmark-self').length,1);
    assert.equal(document.querySelector('.bookmark-self')?.getAttribute('aria-pressed'),'true');
    assert.ok(document.querySelector('.chronicle-self-page'));
    assert.match(document.querySelector('.chronicle-honours')?.textContent??'',/First Rivalry/);
    assert.match(document.querySelector('.chronicle-selected-records')?.textContent??'',/Fastest Castle Age/);

    const close=document.querySelector('.chronicle-close') as HTMLButtonElement;
    await act(async()=>close.click());
    await act(async()=>root.render(React.createElement(ProfileDialogWithIdentity,{...props,data:ragnar})));
    const ragnarTrigger=document.querySelector('.profile-chronicle-trigger') as HTMLButtonElement;
    await act(async()=>{ragnarTrigger.click();await flush();});

    const relationshipBookmarks=[...document.querySelectorAll('.chronicle-bookmark')] as HTMLButtonElement[];
    assert.equal(relationshipBookmarks.length,snapshot.players.length,'opening from another profile must not create a one-bookmark Chronicle');
    const ragnarBookmark=relationshipBookmarks.find(button=>button.title.includes('Ragnar'));
    assert.ok(ragnarBookmark);
    assert.equal(ragnarBookmark!.getAttribute('aria-pressed'),'true','the source profile chooses the initial bookmark');
    assert.match(document.querySelector('.chronicle-book-owner')?.textContent??'',/D’Karius.*Chronicle/);
    assert.match(document.querySelector('.chronicle-title')?.textContent??'',/D’Karius.*Ragnar/);
    assert.match(document.querySelector('.chronicle-standing')?.textContent??'',/Rivalry is dormant/);
    assert.match(document.querySelector('.chronicle-entries')?.textContent??'',/official duel/);
    assert.doesNotMatch(document.querySelector('.chronicle-entries')?.textContent??'',/became allies|successful raid|betrayed/i);

    const mblBookmark=relationshipBookmarks.find(button=>button.title.includes('MBL'));
    assert.ok(mblBookmark);
    await act(async()=>mblBookmark!.click());
    assert.ok(document.querySelector('.chronicle-empty-leaf'));
    assert.equal(document.querySelectorAll('.chronicle-bookmark').length,snapshot.players.length);
  }finally{
    await act(async()=>root.unmount());
    dom.window.close();
  }
});
