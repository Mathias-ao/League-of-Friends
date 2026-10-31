import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {createRoot} from 'react-dom/client';
import {renderToStaticMarkup} from 'react-dom/server';
import {WarRoomView} from '../src/ui/WarRoom';
import {App} from '../src/ui/App';
import {closedWarRoom,mayAnswerWarChallenge,mayIssueWarChallenge,type WarRoomData,type WarRoomChallenge} from '../src/domain/warRoom';
import {PreviewLeagueRepository} from '../src/data/PreviewLeagueRepository';

const season={seasonId:'S1',name:'The Fiefdom of Bad Neighbors'};
const player=(playerId:string,steamName:string)=>({playerId,steamName});
const snapshot=(id:string|null='A')=>({
  membership:id?'ACTIVE':'SIGNED_OUT',viewer:id?{...player(id,id==='A'?'Alice':'Cara'),role:'PLAYER'}:null,
  season:{...season,status:'ACTIVE'},enteredSeason:!!id,hasLeagueHistory:false,
  emperor:null,standings:[],players:[],events:[],matches:[],
}) as any;
const challenge=(status='PENDING',override:Partial<WarRoomChallenge>={}):WarRoomChallenge=>({
  challengeId:'WAR_S1_A_B',challengeRevision:1,pairId:'A_B',
  challenger:player('A','Alice'),challenged:player('B','Bob'),status,matchId:null,winners:[],
  createdAt:'2026-10-01T12:00:00.000Z',respondedAt:null,completedAt:null,
  eligibilityReview:'PENDING_SOURCE',canRespond:false,...override,
});
function fake(id='A'):WarRoomData{
  return closedWarRoom(id,season);
}
async function mount(data:WarRoomData,opts:{id?:string|null;repo?:any}={}){
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/#war-room'});
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,
    HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
  const root=createRoot(document.getElementById('root')!);
  const opened:string[]=[];
  const calls:string[]=[];
  const repo=opts.repo??{warRoom:async()=>data,onAuthChange:()=>()=>{}};
  const props={snapshot:snapshot(opts.id===undefined?'A':opts.id),repository:repo,
    openMatch:(id:string)=>opened.push(id),openPlayer:(id:string)=>calls.push(id)};
  await act(async()=>{root.render(React.createElement(WarRoomView,props));await Promise.resolve();});
  async function click(label:string){
    const button=[...document.querySelectorAll('button')].find(x=>x.textContent?.includes(label));
    assert.ok(button,'Missing button: '+label);
    await act(async()=>{button!.click();await Promise.resolve();});
  }
  return {dom,root,repo,calls,opened,click,async close(){
    await act(async()=>root.unmount());dom.window.close();
  }};
}
test('War Room route exists for league browsing, without opening a gated challenge',()=>{
  const html=renderToStaticMarkup(React.createElement(App,{repository:new PreviewLeagueRepository()}));
  assert.match(html,/href="#war-room"/);
  const d=fake();
  assert.equal(mayIssueWarChallenge(d),false);
  d.status='OPEN';d.viewer.canChallenge=true;d.viewer.qualifiedRivals=[player('B','Bob')];
  assert.equal(mayIssueWarChallenge(d),false,'Legacy qualification cannot stand in for a current verified stage');
});
test('newcomer sees closed and pending states, unavailable standings and no challenge action',async()=>{
  const data=fake(),ui=await mount(data);
  try{
    assert.match(document.body.textContent!,/The doors remain closed/);
    assert.match(document.body.textContent!,/No current challenge permission/);
    assert.match(document.body.textContent!,/Standings awaiting verification/);
    assert.equal(document.body.textContent!.includes('Issue challenge'),false);
    assert.equal(document.body.textContent!.includes('Accept'),false);
    data.status='PENDING_SOURCE';
    await ui.click('Refresh records');
    assert.match(document.body.textContent!,/Qualification pending/);
    assert.equal(document.body.textContent!.includes('Issue challenge'),false);
  }finally{await ui.close();}
});
test('mock server-verified reciprocal stage enables send; server correction disables it on refresh',async()=>{
  const data=fake();data.status='OPEN';
  data.qualification={status:'VERIFIED',canIssueChallenges:true,canRespond:true};
  data.viewer.canChallenge=true;data.viewer.qualifiedRivals=[player('B','Bob')];
  const sent:string[]=[];
  const repo={warRoom:async()=>structuredClone(data),onAuthChange:()=>()=>{},
    createWarRoomChallenge:async(id:string)=>{sent.push(id);data.qualification.status='PENDING_SOURCE';}};
  const ui=await mount(data,{repo});
  try{
    assert.equal(mayIssueWarChallenge(data),true);
    await ui.click('Issue challenge');
    assert.deepEqual(sent,['B']);
    assert.match(document.body.textContent!,/Awaiting verification/);
    assert.equal(document.body.textContent!.includes('Issue challenge'),false);
  }finally{await ui.close();}
});
test('incoming invitation actions require individual server permission; accepted Game retains its Battle link',async()=>{
  const data=fake('B');data.status='OPEN';
  data.qualification={status:'VERIFIED',canIssueChallenges:false,canRespond:true};
  data.viewerChallenges=[challenge('PENDING',{canRespond:true,eligibilityReview:'VERIFIED'})];
  const replies:string[]=[];
  const repo={warRoom:async()=>structuredClone(data),onAuthChange:()=>()=>{},
    respondWarRoomChallenge:async(_id:string,response:string)=>{
      replies.push(response);data.viewerChallenges=[challenge('ACCEPTED',{matchId:'M1',canRespond:false,eligibilityReview:'VERIFIED'})];
    }};
  const ui=await mount(data,{id:'B',repo});
  try{
    assert.equal(mayAnswerWarChallenge(data,data.viewerChallenges[0]),true);
    await ui.click('Accept');
    assert.deepEqual(replies,['ACCEPT']);
    assert.match(document.body.textContent!,/Battle accepted/);
    await ui.click('View Battle');
    assert.deepEqual(ui.opened,['M1']);
  }finally{await ui.close();}
});
test('source correction keeps accepted Battle visible, blocks fresh response and hides unverified points',async()=>{
  const data=fake('B');data.status='PENDING_SOURCE';
  data.viewerChallenges=[challenge('COMPLETED',{matchId:'M1',eligibilityReview:'INVALIDATED'})];
  data.leaderboard=[{rank:1,player:player('B','Bob'),warRoomPoints:99}];
  const ui=await mount(data,{id:'B'});
  try{
    assert.match(document.body.textContent!,/historical Battle retained/);
    assert.equal(document.body.textContent!.includes('99'),false);
    assert.equal(document.body.textContent!.includes('Accept'),false);
    await ui.click('View Battle');
    assert.deepEqual(ui.opened,['M1']);
  }finally{await ui.close();}
});
test('signed-out visitors cannot load War Room history or issue a challenge',async()=>{
  const d=fake();let queries=0;
  const ui=await mount(d,{id:null,repo:{warRoom:async()=>{queries++;return d;},onAuthChange:()=>()=>{}}});
  try{
    assert.match(document.body.textContent!,/Enter the league Season/);
    assert.equal(queries,0);
  }finally{await ui.close();}
});
