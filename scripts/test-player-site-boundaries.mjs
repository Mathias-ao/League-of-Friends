// In-memory callable integration checks. No emulator, credentials or network used.
import assert from 'node:assert/strict';
import {db} from '../functions/lib/config/firebase.js';
import {getMyMembership} from '../functions/lib/queries/getMyMembership.js';
import {enterSeason} from '../functions/lib/commands/seasons/enterSeason.js';
import {setEventRsvp} from '../functions/lib/commands/events/setRsvp.js';
import {requestLeagueMembership} from '../functions/lib/commands/players/requestMembership.js';
import {adminGenerateEmperorsFavors} from '../functions/lib/commands/admin/generateEmperorsFavors.js';
import {fingerprintEmperorsFavor} from '../functions/lib/domain/emperorsFavor.js';

process.env.EMPERORS_FAVOR_HMAC_KEY='test-emperors-favor-secret-material-at-least-32-characters';

let autoId=0;
const records=new Map([
  ['authLinks/account-a',{playerId:'player-a'}],
  ['players/player-a',{steamName:'A',membershipStatus:'ACTIVE',role:'ADMIN'}],
  ['seasons/season-a',{status:'ACTIVE'}],
  ['events/event-a',{seasonId:'season-a',status:'PUBLISHED',maxParticipants:8}]
]);
const snapshot=path=>({id:path.split('/').at(-1),exists:records.has(path),data:()=>records.get(path),ref:reference(path)});
function reference(path,isCollection=false){
  return {
    path,isCollection,
    doc:id=>reference(path+'/'+(id??'auto-'+(++autoId))),
    get:async()=>isCollection?query(path):snapshot(path),
    collection:id=>reference(path+'/'+id,true)
  };
}
function query(path){return {docs:[...records.keys()].filter(key=>key.startsWith(path+'/')&&key.split('/').length===path.split('/').length+1).map(snapshot)};}
Object.defineProperty(db,'collection',{value:path=>reference(path,true)});
Object.defineProperty(db,'runTransaction',{value:async callback=>{
  let wrote=false;const writes=[];
  const result=await callback({
    get:async ref=>{assert.equal(wrote,false,'transaction reads must precede writes');return ref.isCollection?query(ref.path):snapshot(ref.path);},
    create:(ref,data)=>{assert.equal(records.has(ref.path),false,'transaction create must target a new document');wrote=true;writes.push(()=>records.set(ref.path,data));},
    set:(ref,data,options)=>{wrote=true;writes.push(()=>records.set(ref.path,options?.merge?{...records.get(ref.path),...data}:data));},
    update:(ref,data)=>{wrote=true;writes.push(()=>records.set(ref.path,{...records.get(ref.path),...data}));}
  });
  writes.forEach(fn=>fn());return result;
}});
const request=(data={},uid='account-a')=>({data,auth:{uid,token:{}},rawRequest:{}});

await assert.rejects(getMyMembership.run({data:{},rawRequest:{}}),e=>e.code==='unauthenticated');
const own=await getMyMembership.run(request({playerId:'another-player'}));
assert.equal(own.player.playerId,'player-a');assert.equal(own.status,'ACTIVE');assert.equal('role' in own.player,false);

const batch=await adminGenerateEmperorsFavors.run(request({batchName:'Founding Fifteen',count:15}));
assert.equal(batch.count,15);
assert.equal(new Set(batch.favors.map(f=>f.code)).size,15);
for(const favor of batch.favors){
  assert.match(favor.code,/^[A-HJ-NP-Z2-9]{6}$/);
  assert.equal(favor.code.length,6);
}
const firstFavor=batch.favors[0].code;
const firstFingerprint=fingerprintEmperorsFavor(firstFavor,process.env.EMPERORS_FAVOR_HMAC_KEY);
assert.equal(records.get('emperorFavors/'+firstFingerprint).status,'UNUSED');

const joined=await requestLeagueMembership.run(request({steamName:'New Banner',discordName:'new-banner',favor:firstFavor},'account-b'));
assert.equal(joined.membershipStatus,'ACTIVE');
const joinedMembership=await getMyMembership.run(request({},'account-b'));
assert.equal(joinedMembership.status,'ACTIVE');
assert.equal(joinedMembership.player.playerId,joined.playerId);
assert.equal(records.get('players/'+joined.playerId).membershipStatus,'ACTIVE');
assert.equal(records.get('emperorFavors/'+firstFingerprint).status,'REDEEMED');
await assert.rejects(
  requestLeagueMembership.run(request({steamName:'Second Claim',favor:firstFavor},'account-c')),
  /invalid or has already been invoked/i
);

for(let attempt=0;attempt<4;attempt++){
  await assert.rejects(
    requestLeagueMembership.run(request({steamName:'Guess',favor:'AAAAAA'},'account-rate')),
    /invalid or has already been invoked/i
  );
}
await assert.rejects(
  requestLeagueMembership.run(request({steamName:'Guess',favor:'AAAAAA'},'account-rate')),
  /sealed for fifteen minutes/i
);

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
console.log("Passed: Emperor's Favor generation, one-time redemption, rate limiting, authenticated self lookup, season signup prerequisite, transactional entry, idempotency, identity spoofing rejection, withdrawal, completed-season and pending-member rejection.");
