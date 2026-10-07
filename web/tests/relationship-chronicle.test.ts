import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {PreviewLeagueRepository} from '../src/data/PreviewLeagueRepository';
import {ProfileDialogWithIdentity} from '../src/ui/StatisticsExperience';
import {relationshipEpigraph} from '../src/ui/PlayerChronicleBook';
import type {PlayerRelationshipSummary,RelationshipTrackSummary} from '../src/domain/league';

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
    const playerBookmarkColours=relationshipBookmarks.filter(button=>!button.classList.contains('bookmark-self')).map(button=>button.style.getPropertyValue('--bookmark-a'));
    assert.ok(playerBookmarkColours.every(Boolean),'every relationship bookmark receives an explicit cloth colour');
    assert.equal(new Set(playerBookmarkColours).size,playerBookmarkColours.length,'bookmark colours are unique within the current book');
    const ragnarBookmark=relationshipBookmarks.find(button=>button.title.includes('Ragnar'));
    assert.ok(ragnarBookmark);
    assert.equal(ragnarBookmark!.getAttribute('aria-pressed'),'true','the source profile chooses the initial bookmark');
    assert.match(document.querySelector('.chronicle-book-owner')?.textContent??'',/D’Karius.*Chronicle/);
    assert.match(document.querySelector('.chronicle-title')?.textContent??'',/D’Karius.*Ragnar/);
    assert.equal(document.querySelector('.chronicle-standing'),null,'mechanical Present Standing is not rendered');
    const epigraph=document.querySelector('.chronicle-epigraph')?.textContent??'';
    assert.ok(epigraph.length>10);
    assert.doesNotMatch(epigraph,/\b(rivalry|hostility|bond|tension|grudge|feud|fellowship|comrades|trusted allies|oathbound|internecine strife)\b/i);
    assert.ok(document.querySelector('.chronicle-manuscript'),'relationship history uses one manuscript reading column');
    assert.ok(document.querySelector('.chronicle-manuscript-spine'),'the reading column carries an adorned spine');
    const relationshipPage=document.querySelector('.chronicle-relationship-page');
    assert.ok(relationshipPage);
    assert.match(relationshipPage!.className,/flavor-(neutral|rivalry|hostility|bond|mixed)/);
    const entries=[...document.querySelectorAll('.chronicle-entry')];
    assert.ok(entries.length>0);
    assert.ok(entries.every(entry=>!entry.classList.contains('entry-left')&&!entry.classList.contains('entry-right')),'entries no longer zig-zag across the parchment');
    assert.equal(document.querySelectorAll('.chronicle-spine-marker').length,entries.length,'every written entry receives one deterministic manuscript marker');
    assert.ok(document.querySelector('.chronicle-spine-marker.marker-origin, .chronicle-spine-marker.marker-contest'));
    assert.equal(document.querySelector('.chronicle-entry .eyebrow'),null,'entry classification rubrics stay internal rather than printing above the story');
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


function relationshipTrack(stageId:string|null,state='ESTABLISHED'):RelationshipTrackSummary{
  return {status:'READY',state,stageId,historicalPeakStageId:null};
}

function relationshipForStages(rivalry:string|null,hostility:string|null,bond:string|null,pairId:string):PlayerRelationshipSummary{
  return {
    pairId,
    otherPlayer:{playerId:'other',steamName:'Other'},
    relationshipEngineVersion:'AOF_RELATIONSHIP_ENGINE_V2',
    relationshipRulesConfigured:true,
    tracks:{
      rivalry:relationshipTrack(rivalry),
      hostility:relationshipTrack(hostility),
      bond:relationshipTrack(bond),
    },
    chronicle:[],
  };
}

test('Chronicle epigraphs cover every relationship depth and combination without exposing mechanics',()=>{
  const rivalry=[null,'Friction','Contest','Rivalry','Nemesis'];
  const hostility=[null,'Tension','Grudge','Feud','Blood Feud','Internecine Strife'];
  const bond=[null,'Fellowship','Comrades','Trusted Allies','Oathbound'];
  for(const r of rivalry)for(const h of hostility)for(const b of bond){
    const line=relationshipEpigraph(relationshipForStages(r,h,b,'pair:'+String(r)+':'+String(h)+':'+String(b)));
    assert.ok(line.length>=20&&line.length<=170,`epigraph length should stay manuscript-like for ${r}/${h}/${b}`);
    assert.doesNotMatch(line,/Their record shows|The record shows|Present Standing/);
    assert.doesNotMatch(line,/\b(rivalry|hostility|bond|tension|grudge|feud|fellowship|comrades|trusted allies|oathbound|internecine strife)\b/i);
  }

  const legendary=relationshipEpigraph(relationshipForStages(null,'Internecine Strife',null,'legendary'));
  assert.match(legendary,/ordinary|scale/i,'Internecine Strife receives a distinct legendary escalation voice without naming the stage');

  const dormant=relationshipForStages(null,null,'Fellowship','dormant');
  dormant.tracks.hostility={status:'READY',state:'DORMANT',stageId:null,historicalPeakStageId:'Blood Feud'};
  const dormantLine=relationshipEpigraph(dormant);
  assert.match(dormantLine,/older|quarrel|strain|ink/i);
  assert.doesNotMatch(dormantLine,/Blood Feud|Hostility|Bond/);
});
