import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {emptySnapshot,type LeagueRepository,type LeagueSnapshot,type PlayerProfile} from '../src/domain/league';
import type {PrivatePersonalityHistory,LivePersonalityEvidence} from '../src/domain/privateHistory';
import {ProfileDialogWithIdentity} from '../src/ui/StatisticsExperience';

const AXES=['BOOMER_AGGRESSOR','CAUTIOUS_BOLD','GUERRILLA_FRONTLINE',
  'SPECIALIST_IMPROVISER','COMPACT_EXPANSIVE'] as const;

function profile(playerId:string):PlayerProfile{
  return {player:{playerId,steamName:playerId},lifetime:{competition:null},
    activeSeason:null,achievements:[],opponents:[],teammates:[]} as unknown as PlayerProfile;
}
function response(playerId:string,battles=4):PrivatePersonalityHistory{
  const live:LivePersonalityEvidence={
    version:'AOF_PERSONALITY_LIVE_EVIDENCE_V1',requiredGames:3,
    eligibleGames:battles,gameUnlock:battles>=3?'UNLOCKED':'LOCKED',
    requiredQualifiedBattles:3,qualifiedBattles:battles,
    status:battles>=3?'CALIBRATION_PENDING':'PENDING_BATTLES',
    calibration:'NOT_APPROVED',
    axes:AXES.map((axis,i)=>({
      axis,status:i===0?'CALIBRATION_PENDING':'DEVELOPING',
      value:null,measuredBattles:i===0?battles:0,
      reasons:i===0?['APPROVED_HOSTED_CALIBRATION_REQUIRED']:
        ['CLASSIFIED_FAMILY_OPPORTUNITY_UNAVAILABLE']
    }))
  };
  // The mounted profile only consumes this exact owner-checked subset.
  // The server's separate tests enforce the full authenticated wire contract.
  return {ownerPlayerId:playerId,visibility:'OWNER_ONLY',
    personality:{personalityProfile:{playerId}},livePersonality:live} as PrivatePersonalityHistory;
}
function deferred<T>(){
  let resolve!:(value:T)=>void;
  let reject!:(reason:Error)=>void;
  const promise=new Promise<T>((ok,no)=>{resolve=ok;reject=no;});
  return {promise,resolve,reject};
}

/** Real ProfileDialogWithIdentity, not a pure slider mapper. The fake is only
 * the Firebase authentication + owner-callable boundary. Its first observer
 * notification arrives in a Promise microtask just like onAuthStateChanged. */
function mounted(options:{enabled?:boolean;initialUid?:string|null;
  initialNotificationUid?:string|null}={}){
  const dom=new JSDOM('<div id="app"></div>',{url:'http://localhost/'});
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,
    HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
  const root=createRoot(dom.window.document.getElementById('app')!);
  let uid:string|null=options.initialUid===undefined?'firebase-owner':options.initialUid;
  const listeners=new Set<()=>void>(),calls:Array<ReturnType<typeof deferred<PrivatePersonalityHistory>>>=[];
  let initialDeliveries=0,unsubscribed=0;
  const repo={
    mode:'live',currentAuthUid:()=>uid,
    canReadMyPersonalityHistory:()=>options.enabled!==false,
    myPersonalityHistory:()=>{
      const request=deferred<PrivatePersonalityHistory>();calls.push(request);return request.promise;
    },
    onAuthChange:(callback:()=>void)=>{
      listeners.add(callback);
      // The real SDK schedules its initial *current user* delivery, not only
      // later sign-ins. It may already reflect a changed first notification.
      queueMicrotask(()=>{
        if(!listeners.has(callback))return;
        initialDeliveries++;
        if(options.initialNotificationUid!==undefined)uid=options.initialNotificationUid;
        callback();
      });
      return ()=>{unsubscribed++;listeners.delete(callback);};
    }
  } as unknown as LeagueRepository;
  const render=async(playerId='owner',viewerId=playerId)=>{
    const snapshot:LeagueSnapshot={
      ...emptySnapshot(),membership:'ACTIVE',
      viewer:{playerId:viewerId,steamName:viewerId}
    } as LeagueSnapshot;
    await act(async()=>root.render(React.createElement(ProfileDialogWithIdentity,{
      repository:repo,preview:false,busy:false,snapshot,data:profile(playerId),
      openMatch:()=>{},openPlayer:()=>{},openEvent:()=>{},
      act:async()=>true,enter:()=>{},navigate:()=>{}
    })));
  };
  const emit=async(newUid:string|null)=>{
    await act(async()=>{uid=newUid;for(const callback of [...listeners])callback();});
  };
  const complete=async(index:number,playerId='owner',battles=4)=>{
    assert.ok(calls[index],`Missing authenticated owner request ${index}`);
    await act(async()=>calls[index].resolve(response(playerId,battles)));
  };
  const fail=async(index:number)=>{
    assert.ok(calls[index]);await act(async()=>calls[index].reject(new Error('Source corrected')));
  };
  const body=()=>dom.window.document.body.textContent??'';
  const close=async()=>{await act(async()=>root.unmount());dom.window.close();};
  return {render,emit,complete,fail,body,close,calls:()=>calls.length,
    initialDeliveries:()=>initialDeliveries,unsubscribed:()=>unsubscribed,
    activeListeners:()=>listeners.size};
}

test('Sol P1 reproduction: initial unchanged Firebase user notification does NOT cancel a current owner 4/4 read',async()=>{
  const app=mounted();
  try{
    await app.render();
    assert.equal(app.calls(),1);
    assert.equal(app.initialDeliveries(),1,'Firebase initial currentUser was delivered');
    assert.match(app.body(),/Reading current recordings/);
    await app.complete(0);
    assert.match(app.body(),/4 independently measured Battles/);
    assert.match(app.body(),/Calibration pending/);
    assert.doesNotMatch(app.body(),/Source-qualified Personality pending/);
    // Subsequent unchanged-user delivery is also not a logout or refetch.
    await app.emit('firebase-owner');
    assert.equal(app.calls(),1);
    assert.match(app.body(),/4 independently measured Battles/);
  }finally{await app.close();}
});

test('initial callback that is already a different account is not blindly ignored',async()=>{
  const app=mounted({initialNotificationUid:'firebase-different-user'});
  try{
    await app.render();
    assert.equal(app.initialDeliveries(),1);
    assert.equal(app.calls(),1);
    await app.complete(0);
    assert.doesNotMatch(app.body(),/4 independently measured Battles/);
    assert.match(app.body(),/Source-qualified Personality pending/);
  }finally{await app.close();}
});

test('actual logout immediately clears a successful owner read, without restarting it under stale profile props',async()=>{
  const app=mounted();
  try{
    await app.render();
    await app.complete(0);
    assert.match(app.body(),/4 independently measured Battles/);
    await app.emit(null);
    assert.doesNotMatch(app.body(),/4 independently measured Battles/);
    assert.match(app.body(),/Source-qualified Personality pending/);
    assert.equal(app.calls(),1);
  }finally{await app.close();}
});

test('account replacement clears old evidence and only a new owner-bound profile can read for the replacement',async()=>{
  const app=mounted();
  try{
    await app.render();
    await app.complete(0);
    assert.match(app.body(),/4 independently measured Battles/);
    await app.emit('firebase-other');
    assert.doesNotMatch(app.body(),/4 independently measured Battles/);
    await app.render('other','other');
    assert.equal(app.calls(),2);
    assert.doesNotMatch(app.body(),/4 independently measured Battles/);
    await app.complete(1,'other',3);
    assert.match(app.body(),/3 independently measured Battles/);
    assert.doesNotMatch(app.body(),/4 independently measured Battles/);
  }finally{await app.close();}
});

test('delayed response after logout or changed owner is discarded even if the promise succeeds',async()=>{
  const app=mounted();
  try{
    await app.render();
    await app.emit('firebase-other');
    await app.complete(0);
    assert.doesNotMatch(app.body(),/4 independently measured Battles/);
    assert.equal(app.calls(),1);
    await app.render('other','other');
    assert.equal(app.calls(),2);
    await app.render('owner','other'); // outsider profile: never fetch
    assert.equal(app.calls(),2);
    await app.complete(1,'other',4);
    assert.doesNotMatch(app.body(),/4 independently measured Battles/);
    assert.match(app.body(),/private Personality of another player is not available here/);
  }finally{await app.close();}
});

test('wrong-owner response and rejected source cannot populate a valid mounted owner profile',async()=>{
  const app=mounted();
  try{
    await app.render();
    await app.complete(0,'outsider');
    assert.doesNotMatch(app.body(),/4 independently measured Battles/);
    assert.match(app.body(),/Source-qualified Personality pending/);
    // New view mount retries the same authenticated owner, never reuses a
    // previously rejected cross-account payload.
    await app.render('other','other');
    await app.render('owner','owner');
    assert.equal(app.calls(),3);
    await app.fail(2);
    assert.doesNotMatch(app.body(),/4 independently measured Battles/);
  }finally{await app.close();}
});

test('live private read capability is default-off for nonenabled repositories and outsider profiles',async()=>{
  const app=mounted({enabled:false});
  try{
    await app.render();
    assert.equal(app.calls(),0);
    assert.match(app.body(),/Source-qualified Personality pending/);
  }finally{await app.close();}
  const outsider=mounted();
  try{
    await outsider.render('other','owner');
    assert.equal(outsider.calls(),0);
    assert.match(outsider.body(),/private Personality of another player is not available here/);
  }finally{await outsider.close();}
});

test('unmount invalidates pending owner promise and unsubscribes the observer',async()=>{
  const app=mounted();
  await app.render();
  assert.equal(app.calls(),1);
  await app.close();
  assert.equal(app.activeListeners(),0);
  assert.ok(app.unsubscribed()>=1);
  await app.complete(0);
});
