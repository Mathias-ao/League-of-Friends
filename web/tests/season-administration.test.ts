import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {SeasonAdministration} from '../src/ui/SeasonAdministration';
import {seasonCreation} from '../src/domain/seasonAdministration';
import {emptySnapshot,type LeagueRepository} from '../src/domain/league';
import {PreviewLeagueRepository} from '../src/data/PreviewLeagueRepository';
test('Season creation validates effective dates and retains the supplied retry identity',()=>{
 assert.throws(()=>seasonCreation('','2099-01-01','2099-02-01','id'),/name/);
 assert.throws(()=>seasonCreation('Next','2099-02-01','2099-01-01','id'),/after/);
 assert.equal(seasonCreation(' Next ','2099-01-01T00:00Z','2099-02-01T00:00Z','same-id').requestId,'same-id');
});
test('pre-Season admin UI reads setup, confirms separately, prevents double submission and disappears on role loss',async()=>{
 const dom=new JSDOM('<div id="app"></div>',{url:'http://localhost/'});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=await import('react-dom/client'),root=createRoot(document.getElementById('app')!);
 let uid='admin',reads=0;const calls:unknown[]=[];
 const repository:LeagueRepository=Object.assign(new PreviewLeagueRepository(),{
  currentAuthUid:()=>uid,seasonSetup:async()=>{reads++;return {schemaVersion:'AOF_SEASON_ADMINISTRATION_1',activeSeasonId:null,seasons:[{seasonId:'next',name:'Next campaign',status:'DRAFT',startsAt:'2099-01-01T00:00Z',endsAt:'2099-02-01T00:00Z'}]};},
  activateSeason:async(...args:unknown[])=>{calls.push(args);}
 });
 const snapshot={...emptySnapshot(),membership:'ACTIVE' as const,viewer:{playerId:'admin',steamName:'Emperor',role:'ADMIN'}};
 const props={snapshot,repository,preview:false,busy:false,authUid:'admin',act:async(action:()=>Promise<void>)=>{await action();return true;}};
 try{
  await act(async()=>root.render(React.createElement(SeasonAdministration,props)));
  assert.equal(reads,1);assert.match(document.body.textContent!,/No Season is currently active/);
  const button=(label:string)=>[...document.querySelectorAll('button')].find(b=>b.textContent===label)!;
  await act(async()=>button('Review activation').click());assert.equal(calls.length,0);
  await act(async()=>{const confirm=button('Confirm Season activation');confirm.click();confirm.click();});
  assert.equal(calls.length,1);assert.equal((calls[0] as string[])[0],'next');assert.ok((calls[0] as string[])[1]);
  await act(async()=>root.render(React.createElement(SeasonAdministration,{...props,snapshot:{...snapshot,viewer:{...snapshot.viewer,role:'PLAYER'}}})));
  assert.equal(document.querySelector('.season-administration'),null);
  uid='other';await act(async()=>root.render(React.createElement(SeasonAdministration,props)));
  assert.equal(document.querySelector('.season-administration'),null);
 }finally{await act(async()=>root.unmount());dom.window.close();}
});
