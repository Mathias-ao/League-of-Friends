import test from 'node:test';
import assert from 'node:assert/strict';
import {act} from 'react';
import {navigationFixture} from './detail-navigation-fixture.mjs';
import {detailRequests} from '../src/ui/detailNavigation';

test('actual App opens every selected detail before any remote resolution, without global busy',async()=>{
 for(const kind of ['event','match','player']){
  const ui=await navigationFixture({kind,scale:200});try{
   await ui.open();assert.ok(document.querySelector('dialog[open]'),'immediate '+kind+' shell');
   assert.equal(document.querySelector('.working'),null);assert.equal(ui.loads(),1);
   assert.ok(ui.calls.length>0);assert.match(ui.body(),/Loading/);
   assert.equal(document.querySelector('.event-order-actions'),null,'no summary-derived action authority');
   await ui.click('button[aria-label="Close dialog"]');assert.equal(document.querySelector('dialog'),null);
   if(kind==='event')await ui.complete('essential',ui.event);
   if(kind==='match')await ui.complete('match',ui.match);
   if(kind==='player')await ui.complete('player',ui.profile);
   assert.equal(document.querySelector('dialog'),null,'late result cannot reopen a closed selection');
  }finally{await ui.close();}
 }
});

test('Event participation and Battles stay usable while Roundoff is slow/failed; Retry is local',async()=>{
 const ui=await navigationFixture({app:false});try{
  assert.deepEqual(ui.calls.map(c=>c.kind),['essential']);
  await ui.complete('essential',ui.event);assert.ok(document.querySelector('.event-briefing-layout'));
  await ui.click('[role="tab"]:nth-child(3)');assert.match(ui.body(),/Loading event roundoff/);
  assert.equal(document.querySelector('.event-points'),null);
  await ui.fail('roundoff');assert.match(ui.body(),/Event roundoff could not be loaded/);
  await ui.click('[role="tab"]:nth-child(2)');assert.ok(document.querySelector('.event-battle-board'));
  await ui.click('[role="tab"]:nth-child(3)');
  const retry=[...document.querySelectorAll('button')].find(b=>b.textContent==='Retry event roundoff')!;
  await act(async()=>retry.click());assert.equal(ui.calls.filter(c=>c.kind==='essential').length,1);
  await ui.complete('roundoff',{eventId:ui.eventId,roundoff:{revision:1,points:[]}},1);
  assert.doesNotMatch(ui.body(),/could not be loaded/);assert.ok(document.querySelector('.event-points'));
 }finally{await ui.close();}
});

test('older repositories retain one full Event call and local failed-detail retry',async()=>{
 const ui=await navigationFixture({app:false,split:false});try{
  assert.deepEqual(ui.calls.map(c=>c.kind),['full-event']);await ui.fail('full-event');
  assert.match(ui.body(),/Event participation and Battles could not be loaded/);
  const retry=[...document.querySelectorAll('button')].find(b=>b.textContent?.startsWith('Retry event participation'))!;
  await act(async()=>retry.click());await ui.complete('full-event',ui.event,1);
  assert.ok(document.querySelector('.event-briefing-layout'));
 }finally{await ui.close();}
});

test('owner private sections start independently of blocked public records, and records retry preserves identity',async()=>{
 const ui=await navigationFixture({app:false,kind:'player',privateReads:true});try{
  assert.deepEqual(new Set(ui.calls.map(c=>c.kind)),new Set(['player','personality','social']));
  await ui.fail('player');assert.match(ui.body(),/Player records could not be loaded/);
  assert.ok(document.querySelector('.personality-panel'));assert.ok(document.querySelector('.private-social-progression'));
  assert.doesNotMatch(ui.body(),/Chronicle unwritten|No Battles yet/);
  const retry=[...document.querySelectorAll('button')].find(b=>b.textContent==='Retry player records')!;
  await act(async()=>retry.click());await ui.complete('player',ui.profile,1);
  assert.equal(ui.calls.filter(c=>c.kind==='personality').length,1,'records Retry does not restart private sections');
  assert.equal(ui.calls.filter(c=>c.kind==='social').length,1);
  await ui.fail('personality');assert.match(ui.body(),/Retry private Personality/);
  const personalityRetry=[...document.querySelectorAll('button')].find(b=>b.textContent==='Retry private Personality')!;
  await act(async()=>personalityRetry.click());assert.equal(ui.calls.filter(c=>c.kind==='personality').length,2);
  assert.equal(ui.calls.filter(c=>c.kind==='player').length,2);
 }finally{await ui.close();}
});

test('rapid selections, revision/Season/role changes discard old data and reject mismatched identities',async()=>{
 const ui=await navigationFixture({app:false});try{
  await ui.select('event','another-event');await ui.complete('essential',ui.event);
  assert.doesNotMatch(document.querySelector('#dialog-title')!.textContent!,new RegExp(ui.event.event.title));
  await ui.complete('essential',ui.event,1);assert.match(ui.body(),/selected detail changed/);
  await ui.select('match',ui.matchId);await ui.complete('match',ui.match);
  assert.ok(document.querySelector('.battle-details'));
  await ui.change(s=>({...s,season:{...s.season,seasonId:'new-season'},viewer:{...s.viewer,role:'ADMIN'},
   matches:s.matches.map(m=>({...m,result:{revision:99,winningPlayerIds:[]}}))}));
  assert.equal(document.querySelector('.battle-details'),null,'old source/action authority clears before refetch');
  assert.equal(ui.calls.filter(c=>c.kind==='match').length,2);
 }finally{await ui.close();}
});

test('logout, changed UID before observer delivery and membership loss cannot restore private details',async()=>{
 const ui=await navigationFixture({app:false,kind:'player',privateReads:true});try{
  await ui.auth('different-uid',false);await ui.complete('player',ui.profile);
  assert.equal(document.querySelector('.player-profile-experience'),null);
  await ui.render();assert.equal(document.querySelector('.personality-panel'),null);
  await ui.auth(null);await ui.change(s=>({...s,membership:'SUSPENDED'}));
  assert.equal(document.querySelector('.private-social-progression'),null);
 }finally{await ui.close();}
});

test('in-flight coalescing is bounded, has no completed authority cache, and clears between accounts',async()=>{
 const reads=detailRequests();let count=0,finish!:(n:number)=>void;
 const load=()=>{count++;return new Promise<number>(resolve=>{finish=resolve;});};
 const a=reads.read('owner:revision',load),b=reads.read('owner:revision',load);
 await Promise.resolve();assert.equal(count,1);finish(1);assert.equal(await a,1);assert.equal(await b,1);
 const c=reads.read('owner:revision',load);await Promise.resolve();assert.equal(count,2);finish(2);await c;
 const d=reads.read('owner:revision',load);await Promise.resolve();reads.clear();
 const e=reads.read('owner:revision',load);await Promise.resolve();assert.equal(count,4);finish(4);await e;
 void d;
});

test('repeated same-Event selection coalesces in flight; correction drops old Roundoff before the next read',async()=>{
 const ui=await navigationFixture({app:false});try{
  await ui.select('event',ui.eventId);assert.equal(ui.calls.filter(c=>c.kind==='essential').length,1);
  assert.equal(ui.calls.filter(c=>c.kind==='roundoff').length,0,'Briefing does not overfetch the Roundoff');
  await ui.complete('essential',ui.event);
  await ui.click('[role="tab"]:nth-child(3)');
  await ui.change(s=>({...s,matches:s.matches.map(m=>({...m,result:{revision:2,winningPlayerIds:[]}}))}));
  assert.equal(ui.calls.filter(c=>c.kind==='essential').length,2);
  await ui.complete('essential',ui.event,1);
  await ui.complete('roundoff',{eventId:ui.eventId,roundoff:{revision:111,points:[]}});
  await ui.click('[role="tab"]:nth-child(3)');assert.match(ui.body(),/Loading event roundoff/);
  await ui.complete('roundoff',{eventId:ui.eventId,roundoff:{revision:222,points:[]}},1);
  assert.ok(document.querySelector('.event-points'));
 }finally{await ui.close();}
});

test('BO3 navigation retains canonical Battle identity when another Battle reuses the same Game IDs',async()=>{
 const ui=await navigationFixture({app:false,kind:'match'});try{
  const games=[1,2,3].map(n=>({...ui.match.games[0],gameId:'g'+n,gameNumber:n}));
  await ui.complete('match',{...ui.match,games});
  const picker=document.querySelector<HTMLSelectElement>('.battle-game-picker select')!;
  assert.equal(picker.options.length,3);await act(async()=>{picker.value='g3';picker.dispatchEvent(new window.Event('change',{bubbles:true}));});
  await ui.select('match','second-battle');
  await ui.complete('match',{...ui.match,match:{...ui.match.match,matchId:'second-battle'},games},1);
  assert.equal(document.querySelector<HTMLSelectElement>('.battle-game-picker select')!.value,'g1');
  assert.deepEqual(ui.calls.filter(c=>c.kind==='statistics').map(c=>c.id),[ui.matchId,'second-battle']);
 }finally{await ui.close();}
});

test('actual App back navigation and account replacement fence pending detail responses',async()=>{
 const ui=await navigationFixture();try{
  await ui.open();await act(async()=>window.dispatchEvent(new window.PopStateEvent('popstate')));
  assert.ok(!document.querySelector('dialog'));await ui.complete('essential',ui.event);
  assert.ok(!document.querySelector('dialog'));await ui.open();await ui.auth('new-account');
  await ui.complete('essential',ui.event,1);assert.ok(!document.querySelector('.event-briefing-layout'));
 }finally{await ui.close();}
});

test('profile carousel is bounded and includes only the selected player’s actual Battle participation',async()=>{
 const ui=await navigationFixture({app:false,kind:'player',scale:200});try{
  await ui.change(s=>({...s,matches:[...s.matches,{...s.matches[0],matchId:'not-this-player',
   participants:[{playerId:'unrelated',steamName:'Unrelated player'}]}]}));
  assert.equal(ui.calls.filter(c=>c.kind==='player').length,1,'unrelated Battle insertion does not restart this profile');
  await ui.complete('player',ui.profile);
  assert.equal(document.querySelectorAll('.profile-battle-card').length,12);
  assert.doesNotMatch(document.querySelector('.profile-battle-record')!.textContent!,/Unrelated player/);
  const more=[...document.querySelectorAll('button')].find(b=>b.textContent?.startsWith('Show more Battles'))!;
  assert.match(more.textContent!,/12 of 200/);await act(async()=>more.click());
  assert.equal(document.querySelectorAll('.profile-battle-card').length,24);
 }finally{await ui.close();}
});

test('same-UID linked-player mismatch cannot grant action authority from another viewer',async()=>{
 const ui=await navigationFixture({app:false});try{
  await ui.complete('essential',{...ui.event,viewer:{...ui.event.viewer,playerId:'another-linked-player'}});
  assert.ok(!document.querySelector('.event-briefing-layout'));assert.match(ui.body(),/league identity changed/);
 }finally{await ui.close();}
});

function readyEvent(ui:any){return {...ui.event,event:{...ui.event.event,status:'PUBLISHED',signupDeadlineAt:new Date(Date.now()+86400000).toISOString()},
 viewer:{...ui.event.viewer,rsvp:'NO',signupState:'NONE'}};}
async function actionButton(text:string){const button=[...document.querySelectorAll<HTMLButtonElement>('dialog button')].find(b=>b.textContent===text);
 assert.ok(button,'Action '+text);await act(async()=>button.click());}

test('actual App Event action failure is visible inside its modal and clears on successful recovery',async()=>{
 const ui=await navigationFixture();try{
  ui.repository.rsvp=async()=>{throw Error('EVENT_ACTION_FAILURE');};
  await ui.open();await ui.complete('essential',readyEvent(ui));await actionButton('Raise your banner');
  assert.match(document.querySelector('dialog [role="alert"]')!.textContent!,/EVENT_ACTION_FAILURE/);
  ui.repository.rsvp=async()=>{};await actionButton('Raise your banner');
  assert.doesNotMatch(document.querySelector('dialog')!.textContent!,/EVENT_ACTION_FAILURE/);
  assert.equal(ui.calls.filter(c=>c.kind==='essential').length,2,'successful command revalidates loaded authority');
  await ui.complete('essential',readyEvent(ui),1);assert.ok(document.querySelector('.event-briefing-layout'));
 }finally{await ui.close();}
});

test('actual App shared Battle action path retains visible error and retry recovery',async()=>{
 // Pre-play summaries avoid the existing completed-Battle notification reads;
 // resolve the actual selected Battle RPC, rather than a background notice RPC.
 const ui=await navigationFixture({kind:'match',summaryStatus:'READY'});try{
  const battle={...ui.match,match:{...ui.match.match,status:'READY',result:null},viewer:{...ui.match.viewer,isParticipant:true},
   games:[{...ui.match.games[0],status:'READY',draftRequired:true,draft:null,result:null}]};
  ui.repository.ensureCivilizationDraft=async()=>{throw Error('BATTLE_ACTION_FAILURE');};
  await ui.open();await ui.complete('match',battle);await actionButton('Open civilization draft');
  assert.match(document.querySelector('dialog [role="alert"]')!.textContent!,/BATTLE_ACTION_FAILURE/);
  ui.repository.ensureCivilizationDraft=async()=>{};await actionButton('Open civilization draft');
  assert.doesNotMatch(document.querySelector('dialog')!.textContent!,/BATTLE_ACTION_FAILURE/);
  assert.equal(ui.calls.filter(c=>c.kind==='match').length,2);
 }finally{await ui.close();}
});

test('late action failure cannot appear in a replacement selection or another account',async()=>{
 for(const change of ['selection','account']){
  const ui=await navigationFixture();try{
   let reject!:(error:Error)=>void;ui.repository.rsvp=()=>new Promise((_resolve,no)=>{reject=no;});
   await ui.open();await ui.complete('essential',readyEvent(ui));await actionButton('Raise your banner');
   await ui.click('button[aria-label="Close dialog"]');
   if(change==='selection'){await ui.open();await ui.complete('essential',readyEvent(ui),1);}
   else await ui.auth('replacement-uid');
   await act(async()=>reject(Error('OLD_ACTION_MUST_STAY_HIDDEN')));
   assert.doesNotMatch(ui.body(),/OLD_ACTION_MUST_STAY_HIDDEN/);
  }finally{await ui.close();}
 }
});

test('successful action with exhausted revision-refresh retry recovers inside the modal without resubmission',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const ui=await navigationFixture();try{
  let commands=0;ui.repository.rsvp=async()=>{commands++;};
  const load=ui.repository.load.bind(ui.repository);
  await ui.open();await ui.complete('essential',readyEvent(ui));
  ui.repository.load=async()=>{throw Object.assign(Error('Controlled revision race'),{code:'functions/aborted'});};
  await actionButton('Raise your banner');
  await act(async()=>{t.mock.timers.tick(1000);});await act(async()=>{t.mock.timers.tick(2000);});
  assert.match(document.querySelector('dialog [role="alert"]')!.textContent!,/league changed while loading/);
  assert.doesNotMatch(ui.body(),/Sign in with Steam/);assert.equal(commands,1);
  ui.repository.load=load;await actionButton('Refresh league state');
  assert.ok(!document.querySelector('dialog [role="alert"]'));assert.equal(commands,1);
 }finally{await ui.close();t.mock.timers.reset();}
});

test('same Battle preserves selected Game through correction and failed-read Retry; removed Game uses fresh valid target',async()=>{
 const ui=await navigationFixture({app:false,kind:'match'});try{
  const games=[1,2,3].map(n=>({...ui.match.games[0],gameId:'g'+n,gameNumber:n,status:'READY',draftRequired:true,draft:null,result:null})),
   battle={...ui.match,match:{...ui.match.match,status:'READY',result:null},viewer:{...ui.match.viewer,isParticipant:true},games};
  await ui.complete('match',battle);
  const choose=async(id:string)=>act(async()=>{const picker=document.querySelector<HTMLSelectElement>('.battle-game-picker select')!;
   picker.value=id;picker.dispatchEvent(new window.Event('change',{bubbles:true}));});
  await choose('g3');
  await ui.change(s=>({...s,matches:s.matches.map(m=>({...m,result:{revision:2,winningPlayerIds:[]}}))}));
  assert.ok(!document.querySelector('.battle-details'),'old authority stays unmounted');
  await ui.complete('match',battle,1);assert.equal(document.querySelector<HTMLSelectElement>('.battle-game-picker select')!.value,'g3');
  await ui.change(s=>({...s,matches:s.matches.map(m=>({...m,result:{revision:3,winningPlayerIds:[]}}))}));
  await ui.fail('match',Error('Controlled correction read failure'),2);
  const retry=[...document.querySelectorAll('button')].find(b=>b.textContent==='Retry battle controls')!;
  await act(async()=>retry.click());await ui.complete('match',battle,3);
  assert.equal(document.querySelector<HTMLSelectElement>('.battle-game-picker select')!.value,'g3');
  await ui.change(s=>({...s,matches:s.matches.map(m=>({...m,result:{revision:4,winningPlayerIds:[]}}))}));
  await ui.complete('match',{...battle,games:games.slice(0,2)},4);
  assert.equal(document.querySelector<HTMLSelectElement>('.battle-game-picker select')!.value,'g1');
  const targets:string[]=[];ui.repository.ensureCivilizationDraft=async(matchId:string,gameId:string)=>{targets.push(matchId+'/'+gameId);};
  await actionButton('Open civilization draft');assert.deepEqual(targets,[ui.matchId+'/g1'],'command targets only the current valid Game');
 }finally{await ui.close();}
});

test('same Event retains Roundoff through correction and Retry, with a fresh section; new Event resets choice',async()=>{
 const ui=await navigationFixture({app:false});try{
  await ui.complete('essential',ui.event);await ui.click('[role="tab"]:nth-child(3)');
  await ui.change(s=>({...s,matches:s.matches.map(m=>({...m,result:{revision:2,winningPlayerIds:[]}}))}));
  assert.ok(!document.querySelector('.event-details'));
  await ui.complete('essential',ui.event,1);
  assert.equal(document.querySelector('[role="tab"][aria-selected="true"]')!.textContent,'Roundoff');
  await ui.complete('roundoff',{eventId:ui.eventId,roundoff:{revision:111,points:[]}});
  assert.match(ui.body(),/Loading event roundoff/,'old section cannot complete this generation');
  await ui.complete('roundoff',{eventId:ui.eventId,roundoff:{revision:222,points:[]}},1);
  await ui.change(s=>({...s,matches:s.matches.map(m=>({...m,result:{revision:3,winningPlayerIds:[]}}))}));
  await ui.fail('essential',Error('Controlled retry'),2);
  const retry=[...document.querySelectorAll('button')].find(b=>b.textContent==='Retry event participation and battles')!;
  await act(async()=>retry.click());await ui.complete('essential',ui.event,3);
  assert.equal(document.querySelector('[role="tab"][aria-selected="true"]')!.textContent,'Roundoff');
  assert.equal(ui.calls.filter(c=>c.kind==='roundoff').length,4,'each current refresh/Retry has a distinct section request');
  await ui.select('event','new-event');
  await ui.complete('essential',{...ui.event,event:{...ui.event.event,eventId:'new-event'}},4);
  assert.equal(document.querySelector('[role="tab"][aria-selected="true"]')!.textContent,'Briefing');
 }finally{await ui.close();}
});


test('closing the window and account replacement reset retained tab choices',async()=>{
 const ui=await navigationFixture();try{
  await ui.open();await ui.complete('essential',ui.event);await ui.click('[role="tab"]:nth-child(3)');
  await ui.click('button[aria-label="Close dialog"]');await ui.open();await ui.complete('essential',ui.event,1);
  assert.equal(document.querySelector('[role="tab"][aria-selected="true"]')!.textContent,'Briefing');
 }finally{await ui.close();}
 const account=await navigationFixture({app:false});try{
  await account.complete('essential',account.event);await account.click('[role="tab"]:nth-child(3)');
  await account.auth('replacement-uid');await account.authorizeSnapshot('replacement-uid');await account.complete('essential',account.event,1);
  assert.equal(document.querySelector('[role="tab"][aria-selected="true"]')!.textContent,'Briefing');
  await account.auth('firebase-owner');await account.authorizeSnapshot('firebase-owner');await account.complete('essential',account.event,2);
  assert.equal(document.querySelector('[role="tab"][aria-selected="true"]')!.textContent,'Briefing','returning account starts with a new choice scope');
 }finally{await account.close();}
});


test('actual App returns from an Event Battle to the original Event and selected tab, revalidating authority',async()=>{
 const ui=await navigationFixture({summaryStatus:'READY'});try{
  const event={...ui.event,matches:[{...ui.match.match,eventId:ui.eventId,scoringAct:'WARMUP',status:'READY'}]};
  await ui.open();await ui.complete('essential',event);
  await ui.click('[role="tab"]:nth-child(2)');
  await ui.click('.event-battle-board .event-pairing');
  assert.equal(document.querySelector('#dialog-title')?.textContent,'Field of Battle');
  assert.equal(ui.calls.filter(c=>c.kind==='match').at(-1)?.id,ui.matchId);
  await ui.click('button[aria-label="Close dialog"]');
  assert.equal(document.querySelector('#dialog-title')?.textContent,event.event.title);
  assert.ok(document.querySelector('dialog[open]'),'return opens the shell immediately');
  assert.equal(ui.calls.filter(c=>c.kind==='essential').length,2,'return revalidates authority');
  await ui.complete('match',ui.match);
  assert.equal(document.querySelector('#dialog-title')?.textContent,event.event.title,'late Battle response cannot replace Event');
  await ui.complete('essential',event,1);
  assert.ok(document.querySelector('.event-battle-board'));
  assert.equal(document.querySelector('[role="tab"]:nth-child(2)')?.getAttribute('aria-selected'),'true');
  await ui.click('button[aria-label="Close dialog"]');assert.equal(document.querySelector('dialog'),null);
 }finally{await ui.close();}
});

test('actual App Event-origin Battle does not restore a dialog after account replacement',async()=>{
 const ui=await navigationFixture({summaryStatus:'READY'});try{
  const event={...ui.event,matches:[{...ui.match.match,eventId:ui.eventId,scoringAct:'WARMUP',status:'READY'}]};
  await ui.open();await ui.complete('essential',event);
  await ui.click('[role="tab"]:nth-child(2)');await ui.click('.event-battle-board .event-pairing');
  await ui.auth('new-account');await ui.complete('match',ui.match);
  assert.equal(document.querySelector('dialog'),null);
 }finally{await ui.close();}
});
