import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {renderToStaticMarkup} from 'react-dom/server';
import {reviewRelationshipEvidence} from '../src/domain/relationshipQualificationReview';
import {RelationshipQualificationReview} from '../src/ui/RelationshipQualificationReview';
import {recordingReviewExamples} from '../src/data/recordingReviewExamples';

const incident=(family:string,facets:any[],extra:any={})=>({incidentId:'incident-'+family,pairPlayerIds:[1,2],family,
 startedAt:{atMs:1000,operationOrdinal:1},relationContext:'FIXED_OPPONENTS',facets,...extra});
const target=(a:number,b:number)=>({kind:'TARGETED_COMMAND',fromPlayerId:a,toPlayerId:b,sourceEventIds:['command-'+a]});
test('proximity does not qualify reciprocal targeting and victim impact preserves opposite direction',()=>{
 const overlap=incident('LOCAL_CONTEST',[{kind:'LOCAL_COMMAND_OVERLAP',contributorPlayerId:1,otherPlayerId:2,sourceEventIds:['near-a']},
  {kind:'LOCAL_COMMAND_OVERLAP',contributorPlayerId:2,otherPlayerId:1,sourceEventIds:['near-b']}]);
 const pressure=incident('DIRECTED_PRESSURE',[{kind:'ECONOMY_PRESSURE',fromPlayerId:1,toPlayerId:2,sourceEventIds:['raid']}]);
 const input={incidents:[overlap,pressure]},before=structuredClone(input),rows=reviewRelationshipEvidence(input);
 assert.deepEqual(input,before);
 const rivalry=rows.find(x=>x.track==='Rivalry')!;
 assert.equal(rivalry.title,'Local participation only');
 assert.ok(rivalry.established.includes('Reciprocal targeting is not established by this episode.'));
 const hostility=rows.find(x=>x.track==='Hostility')!;
 assert.deepEqual(hostility.actionDirection,[1,2]);assert.deepEqual(hostility.contributionDirection,[2,1]);
 assert.equal(hostility.interpretationStatus,'UNCONFIGURED_POLICY');
 const one=reviewRelationshipEvidence({incidents:[incident('LOCAL_CONTEST',[target(1,2)])]})[0];
 assert.ok(one.established.includes('Reciprocal targeting is not established by this episode.'));
 const both=reviewRelationshipEvidence({incidents:[incident('LOCAL_CONTEST',[target(1,2),target(2,1)])]})[0];
 assert.ok(both.established.some(x=>x.startsWith('Targeted commands are present in both directions')));
});
test('support is helper-directed and unknown alliance blocks the Bond interpretation',()=>{
 const facet={kind:'DEFENSIVE_PARTICIPATION',fromPlayerId:1,toPlayerId:2,sourceEventIds:['help']};
 const support=incident('ALLIED_SUPPORT',[facet],{relationContext:'FIXED_ALLIES'});
 const rows=reviewRelationshipEvidence({incidents:[support,support]});assert.equal(rows.length,1);
 assert.deepEqual(rows[0].actionDirection,[1,2]);assert.deepEqual(rows[0].contributionDirection,[1,2]);
 const unknown=reviewRelationshipEvidence({incidents:[{...support,relationContext:'UNKNOWN'}]})[0];
 assert.equal(unknown.evidenceStatus,'UNAVAILABLE');assert.equal(unknown.interpretationStatus,'UNAVAILABLE');
 assert.ok(!rows.some(x=>x.contributionDirection?.join(':')==='2:1'));
});
test('common-target groups cannot manufacture unrelated allies or target pairs',()=>{
 const shared=(pairPlayerIds:number[],targetPlayerId:number,contributors:number[],id:string)=>incident('SHARED_OFFENSIVE_PARTICIPATION',
  [{kind:'SHARED_OPPONENT_PARTICIPATION',targetPlayerId,contributions:contributors.map(contributorPlayerId=>({contributorPlayerId,sourceEventIds:['source-'+contributorPlayerId]}))}],
  {incidentId:id,pairPlayerIds,relationContext:'FIXED_ALLIES'});
 const rows=reviewRelationshipEvidence({incidents:[shared([1,2],4,[1,2],'ab-x'),shared([2,3],5,[2,3],'bc-y'),
   shared([1,3],4,[1,2],'invalid-pair'),shared([1,2],2,[1,2],'invalid-target')]});
 assert.deepEqual(rows.map(r=>r.pair),[[1,2],[2,3]]);
 assert.ok(rows[0].established.some(x=>x==='Exact allies 1 + 2 share target 4.'));
 assert.ok(rows[1].established.some(x=>x==='Exact allies 2 + 3 share target 5.'));
});
test('return pressure requires independent deeds, exact reverse direction and full chronology',()=>{
 const c={contextId:'return',family:'RETURN_PRESSURE',pairPlayerIds:[1,2],sourceEventIds:['old','new'],
  previousDirection:{fromPlayerId:1,toPlayerId:2},returnDirection:{fromPlayerId:2,toPlayerId:1},
  previousPressureDeedId:'first',returnPressureDeedId:'second',previousEndedAt:{atMs:1000,operationOrdinal:4},
  returnStartedAt:{atMs:1000,operationOrdinal:5}};
 assert.equal(reviewRelationshipEvidence({annotations:[c]}).length,1);
 for(const bad of [{returnPressureDeedId:'first'},{returnDirection:{fromPlayerId:2,toPlayerId:3}},
   {returnStartedAt:{atMs:1000,operationOrdinal:3}},{returnStartedAt:{atMs:1000}}])
  assert.equal(reviewRelationshipEvidence({annotations:[{...c,...bad}]}).length,0);
});
test('declaration withdrawals always fail Treachery prerequisites and never create scores',()=>{
 const declaredHistory={modelVersion:'AOF_DECLARED_DIPLOMACY_HISTORY_V1',turningPoints:[{beatId:'withdrawal',fromPlayerId:1,toPlayerId:2,
  previousDeclaration:'ALLY',declarationAfter:'ENEMY',allyDeclarationWithdrawn:true,previousReciprocalAllyDeclarations:true,
  sourceEventId:'diplomacy-order',moment:{atMs:2000}}]};
 const row=reviewRelationshipEvidence({declaredHistory})[0];
 assert.equal(row.interpretationStatus,'UNAVAILABLE');assert.deepEqual(row.contributionDirection,[2,1]);
 assert.ok(row.missing.some(x=>x.includes('Confirmed king loss')));
 assert.ok(!('points' in row));assert.ok(!('level' in row));
 assert.deepEqual(reviewRelationshipEvidence({}),[]);
});
test('real corpus samples retain candidates without promoting recurrence, outcomes or scoring',()=>{
 for(const id of ['4v4','paired-duel-pov-1','ffa']){
  const audit=recordingReviewExamples.find(x=>x.id===id)!;
  const input={incidents:Object.entries(audit.ledgerSamples).flatMap(([family,values])=>(values as any[]).map(x=>({...x,family}))),
   annotations:Object.values(audit.samples).flat(),declaredHistory:audit.diplomacyReview.declaredHistory};
  const before=JSON.stringify(input),rows=reviewRelationshipEvidence(input);
  assert.ok(rows.length);assert.equal(JSON.stringify(input),before);
  assert.deepEqual(reviewRelationshipEvidence({...input,incidents:[...input.incidents].reverse(),annotations:[...input.annotations].reverse()}),rows);
  if(id==='ffa')assert.ok(rows.every(r=>r.interpretationStatus==='UNAVAILABLE'&&r.title.includes('Treachery blocked')));
  if(id==='4v4')assert.ok(rows.some(r=>r.track==='Bond'&&r.evidenceStatus==='QUALIFIED'));
  if(id==='paired-duel-pov-1')assert.ok(rows.some(r=>r.title==='Independent return pressure'));
 }
});
test('pair and track controls expose the selected decision and its blockers',async()=>{
 const dom=new JSDOM('<div id="review"></div>',{url:'http://localhost/'});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=await import('react-dom/client'),root=createRoot(document.getElementById('review')!);
 const incidents=[incident('DIRECTED_PRESSURE',[{kind:'ECONOMY_PRESSURE',fromPlayerId:1,toPlayerId:2,sourceEventIds:['raid']}]),
  incident('ALLIED_SUPPORT',[{kind:'REINFORCEMENT_COMMANDS',fromPlayerId:2,toPlayerId:3,sourceEventIds:['support']}],
    {pairPlayerIds:[2,3],relationContext:'FIXED_ALLIES'})];
 try{
  await act(async()=>root.render(React.createElement(RelationshipQualificationReview,{incidents,annotations:[],declaredHistory:{},
   name:id=>'Player '+id,sampled:true,available:true})));
  const selects=document.querySelectorAll('select');
  await act(async()=>{selects[0].value='2:3';selects[0].dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
  assert.ok(document.body.textContent!.includes('Reinforcement commands'));
  assert.ok(!document.body.textContent!.includes('Pressure toward a player'));
  await act(async()=>{selects[1].value='Hostility';selects[1].dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
  assert.ok(document.body.textContent!.includes('Empty output does not mean zero'));
  assert.ok(document.body.textContent!.includes('No points or levels are awarded'));
 }finally{await act(async()=>root.unmount());dom.window.close();}
 const legacy=renderToStaticMarkup(React.createElement(RelationshipQualificationReview,{incidents:[],annotations:[],
  declaredHistory:{},name:id=>'Player '+id,sampled:false,available:false}));
 assert.ok(legacy.includes('Versioned social evidence is unavailable'));
});
