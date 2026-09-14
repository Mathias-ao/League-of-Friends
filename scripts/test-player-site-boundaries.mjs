// In-memory callable integration checks. No emulator, credentials or network used.
import assert from 'node:assert/strict';
import {db} from '../functions/lib/config/firebase.js';
import {getMyMembership} from '../functions/lib/queries/getMyMembership.js';
import {enterSeason} from '../functions/lib/commands/seasons/enterSeason.js';
import {setEventRsvp} from '../functions/lib/commands/events/setRsvp.js';
const records=new Map([
  ['authLinks/account-a',{playerId:'player-a'}],
  ['players/player-a',{steamName:'A',membershipStatus:'ACTIVE',role:'PLAYER'}],
  ['seasons/season-a',{status:'ACTIVE'}],
  ['events/event-a',{seasonId:'season-a',status:'PUBLISHED',maxParticipants:8}]
]);
const snapshot=path=>({id:path.split('/').at(-1),exists:records.has(path),data:()=>records.get(path),ref:reference(path)});
function reference(path,isCollection=false){
  return {path,isCollection,doc:id=>reference(path+'/'+id),get:async()=>isCollection?query(path):snapshot(path),collection:id=>reference(path+'/'+id,true)};
}
function query(path){return {docs:[...records.keys()].filter(key=>key.startsWith(path+'/')&&key.split('/').length===path.split('/').length+1).map(snapshot)};}
Object.defineProperty(db,'collection',{value:path=>reference(path,true)});
Object.defineProperty(db,'runTransaction',{value:async callback=>{
  let wrote=false;const writes=[];
  const result=await callback({
    get:async ref=>{assert.equal(wrote,false,'transaction reads must precede writes');return ref.isCollection?query(ref.path):snapshot(ref.path);},
    set:(ref,data,options)=>{wrote=true;writes.push(()=>records.set(ref.path,options?.merge?{...records.get(ref.path),...data}:data));},
    update:(ref,data)=>{wrote=true;writes.push(()=>records.set(ref.path,{...records.get(ref.path),...data}));}
  });
  writes.forEach(fn=>fn());return result;
}});
const request=data=>({data,auth:{uid:'account-a',token:{}},rawRequest:{}});
await assert.rejects(getMyMembership.run({data:{},rawRequest:{}}),e=>e.code==='unauthenticated');
const own=await getMyMembership.run(request({playerId:'another-player'}));
assert.equal(own.player.playerId,'player-a');assert.equal(own.status,'ACTIVE');assert.equal('role' in own.player,false);
await assert.rejects(setEventRsvp.run(request({eventId:'event-a',rsvp:'YES'})),/Enter the season/);
assert.equal(records.has('events/event-a/participants/player-a'),false);
await enterSeason.run(request({seasonId:'season-a',playerId:'another-player'}));
const enrolled=records.get('seasons/season-a/participants/player-a');assert.equal(enrolled.status,'ENTERED');
await enterSeason.run(request({seasonId:'season-a'}));assert.equal(records.get('seasons/season-a/participants/player-a'),enrolled);
assert.equal(records.has('seasons/season-a/participants/another-player'),false);
await setEventRsvp.run(request({eventId:'event-a',rsvp:'YES'}));assert.equal(records.get('events/event-a/participants/player-a').signupState,'CONFIRMED');
records.delete('seasons/season-a/participants/player-a');
await setEventRsvp.run(request({eventId:'event-a',rsvp:'NO'}));assert.equal(records.get('events/event-a/participants/player-a').rsvp,'NO');
records.set('seasons/season-a',{status:'COMPLETED'});
await assert.rejects(enterSeason.run(request({seasonId:'season-a'})),/not open/);
records.get('players/player-a').membershipStatus='PENDING';
await assert.rejects(enterSeason.run(request({seasonId:'season-a'})),/not active/);
console.log('Passed: authenticated self lookup, signup prerequisite, transactional entry, idempotency, identity spoofing rejection, withdrawal, completed-season and pending-member rejection.');
