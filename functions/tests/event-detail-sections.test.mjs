import test from 'node:test';
import assert from 'node:assert/strict';
import {memoryFirestore} from './support/memory-firestore.mjs';
import {db} from '../lib/config/firebase.js';
import {getEventDetail} from '../lib/queries/getEventDetail.js';
const request=(section,uid='p')=>({auth:{uid},data:{eventId:'e',...(section===undefined?{}:{section})}});
function fixture(status='ACTIVE',membershipStatus='ACTIVE',role='PLAYER'){
 return memoryFirestore([['authLinks/p',{playerId:'p'}],['players/p',{steamName:'Player',membershipStatus,role}],
  ['events/e',{title:'Event',status,seasonId:'s'}],['seasons/s',{status:'ACTIVE'}]]);
}

test('default full parity, explicit essential and unchanged transactional roundoff projection',async()=>{
 fixture();const full=await getEventDetail.run(request());
 const essential=await getEventDetail.run(request('essential'));
 const section=await getEventDetail.run(request('roundoff'));
 assert.equal(Object.hasOwn(essential,'roundoff'),false);
 const {generatedAt:fullTime,...fullData}=full,{generatedAt:essentialTime,...essentialData}=essential;
 assert.ok(Number.isFinite(Date.parse(fullTime))&&Number.isFinite(Date.parse(essentialTime)));
 assert.deepEqual({...essentialData,roundoff:section.roundoff},fullData);
 assert.deepEqual(Object.keys(section).sort(),['eventId','roundoff']);assert.equal(section.eventId,'e');
});

test('essential has zero projection dependencies while full and explicit roundoff propagate its failure',async()=>{
 fixture();let projections=0;
 Object.defineProperty(db,'runTransaction',{configurable:true,value:async()=>{projections++;throw Error('Controlled projection unavailable');}});
 const core=await getEventDetail.run(request('essential'));assert.equal(core.event.title,'Event');assert.equal(projections,0);
 await assert.rejects(getEventDetail.run(request('roundoff')),/Controlled projection unavailable/);
 await assert.rejects(getEventDetail.run(request()),/Controlled projection unavailable/);assert.equal(projections,2);
});

test('both explicit sections deny signed-out, unlinked, inactive, suspended and hidden DRAFT access',async()=>{
 for(const section of ['essential','roundoff']){
  fixture();await assert.rejects(getEventDetail.run({data:{eventId:'e',section}}),e=>e.code==='unauthenticated');
  const rows=fixture();rows.delete('authLinks/p');await assert.rejects(getEventDetail.run(request(section)));
  for(const membership of ['INACTIVE','SUSPENDED']){fixture('ACTIVE',membership);await assert.rejects(getEventDetail.run(request(section)));}
  fixture('DRAFT');await assert.rejects(getEventDetail.run(request(section)),e=>e.code==='permission-denied');
  fixture('DRAFT','ACTIVE','ADMIN');assert.ok(await getEventDetail.run(request(section)));
  const missing=fixture();missing.delete('events/e');await assert.rejects(getEventDetail.run(request(section)),e=>e.code==='not-found');
 }
 for(const section of ['all','',null,1,{}]){fixture();await assert.rejects(getEventDetail.run(request(section)),e=>e.code==='invalid-argument');}
});

test('membership, linked account, role or Event visibility changes during roundoff invalidate the response',async()=>{
 for(const change of [rows=>rows.set('players/p',{membershipStatus:'SUSPENDED',role:'PLAYER'}),
  rows=>rows.set('players/p',{membershipStatus:'ACTIVE',role:'ADMIN'}),rows=>rows.delete('authLinks/p'),
  rows=>rows.set('events/e',{status:'DRAFT',seasonId:'s'}),rows=>rows.set('events/e',{status:'COMPLETED',seasonId:'s'})]){
  const rows=fixture(),transaction=db.runTransaction.bind(db);
  Object.defineProperty(db,'runTransaction',{configurable:true,value:async fn=>{const result=await transaction(fn);change(rows);return result;}});
  await assert.rejects(getEventDetail.run(request('roundoff')),e=>['permission-denied','aborted','failed-precondition'].includes(e.code));
 }
});

test('scaled essential read-operation count excludes roundoff Match/Game/source walks',async()=>{
 const counts=[];
 for(const size of [5,50,200]){
  const rows=fixture();for(let i=0;i<size;i++){
   rows.set('matches/m'+i,{eventId:'e',seasonId:'s',status:'READY',format:'ONE_V_ONE',participants:[]});
   rows.set('matches/m'+i+'/games/g1',{status:'READY',gameNumber:1,players:[],activeReplayStatisticsId:'a'.repeat(64)});
  }
  const original=db.collection.bind(db);let reads=0;
  const wrap=ref=>new Proxy(ref,{get(target,key){const value=target[key];
   if(key==='get')return async(...args)=>{reads++;return value.apply(target,args);};
   if(typeof value==='function')return(...args)=>{const result=value.apply(target,args);return result&&typeof result==='object'&&result.get?wrap(result):result;};
   return value;}});
  Object.defineProperty(db,'collection',{configurable:true,value:path=>wrap(original(path))});
  const transaction=db.runTransaction.bind(db);
  Object.defineProperty(db,'runTransaction',{configurable:true,value:fn=>transaction(tx=>fn({...tx,get:async ref=>{reads++;return tx.get(ref);}}))});
  await getEventDetail.run(request('essential'));const essential=reads;reads=0;
  await getEventDetail.run(request());counts.push({size,operations:essential,fullOperations:reads});
 }
 assert.equal(new Set(counts.map(x=>x.operations)).size,1,'query operations are independent of unrelated Game/source histories');
 console.log(JSON.stringify({controlledEssentialReadOperations:counts,notBillableDocumentCounts:true}));
});

test('warmup invitations use canonical league names rather than legacy or Steam aliases',async()=>{
 const rows=fixture();
 rows.set('players/p',{steamName:'Old player label',leagueAlias:'Permanent player',steamPersonaName:'Private persona',membershipStatus:'ACTIVE',role:'PLAYER'});
 rows.set('players/guest',{steamName:'Old guest label',leagueAlias:'Permanent guest',membershipStatus:'ACTIVE'});
 rows.set('events/e/warmupChallenges/challenge',{challengerPlayerId:'p',guestPlayerId:'guest',status:'PENDING'});
 const result=await getEventDetail.run(request('essential'));
 const text=JSON.stringify(result);assert.match(text,/Permanent player/);assert.match(text,/Permanent guest/);
 assert.doesNotMatch(text,/Old player label|Old guest label|Private persona/);
});
