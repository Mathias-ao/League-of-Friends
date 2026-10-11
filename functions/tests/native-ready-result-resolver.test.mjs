import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveRecordingResult} from '../lib/services/recordingResult.js';
import {ACTIVE_NATIVE_SOURCE_VERSION} from '../lib/engines/activeNativeStatisticsSource.js';

const HASH='a'.repeat(64);
const fixture=(native=true)=>{
 const match={status:'COMPLETED',opponentKind:'HUMAN',format:'ONE_V_ONE'};
 const game={status:'COMPLETED',activeReplayStatisticsId:HASH,
   canonicalResult:{revision:4,source:'PLAYER_CONFIRMED',type:'PLAYER_WIN',
     winningPlayerIds:['p1'],losingPlayerIds:['p2']},
   players:[{playerId:'p1'},{playerId:'p2'}]};
 const source={state:'READY',matchId:'m',gameId:'g',sourceHash:HASH,
   playerMapping:[{playerId:'p1',replaySlot:1},{playerId:'p2',replaySlot:2}],
   matchFacts:{source:{replaySha256:HASH}}};
 if(native)source.nativePublicationVersion=ACTIVE_NATIVE_SOURCE_VERSION;
 const docs=new Map([
  ['matches/m',match],['matches/m/games/g',game],
  ['matches/m/games/g/replaySources/'+HASH,source],
 ]);
 let writes=0;
 const ref=path=>({path,
   get:async()=>({exists:docs.has(path),data:()=>docs.get(path)}),
   collection:name=>({doc:id=>ref(path+'/'+name+'/'+id)})});
 const firestore={
   collection:name=>({doc:id=>ref(name+'/'+id)}),
   runTransaction:async callback=>{
     const changes=[];
     const result=await callback({
       get:r=>r.get(),
       update:(r,payload)=>{changes.push({path:r.path,payload});},
     });
     for(const {path,payload} of changes)docs.set(path,{...docs.get(path),...payload});
     writes+=changes.length;
     return result;
   },
 };
 const resolve=review=>resolveRecordingResult('m','g',review,firestore);
 return {match,game,source,firestore,resolve,get writes(){return writes;}};
};

test('native READY source trigger is idempotent and never overwrites independent official outcome',async()=>{
 const f=fixture();
 for(let i=0;i<3;i++){
  const r=await f.resolve();
  assert.equal(r.state,'RESULT_ALREADY_RESOLVED');
  assert.equal(f.writes,0,'native result resolution trigger must stay read-only');
 }
 assert.equal(f.game.canonicalResult.revision,4);
 assert.equal(f.game.canonicalResult.winningPlayerIds[0],'p1');
 assert.equal(f.source.outcomeQualification,undefined,
   'no contradictory unverified replay result may be written to the published source');
});

test('native source under an opened canonical dispute remains unavailable rather than being promoted',async()=>{
 const f=fixture();
 f.game.status='DISPUTED';f.game.activeResultDisputeId='case';
 f.match.status='DISPUTED';f.match.activeResultDisputeId='case';
 const r=await f.resolve();
 assert.equal(r.state,'NATIVE_OFFICIAL_RESULT_UNAVAILABLE');
 assert.equal(f.writes,0);
 assert.equal(f.game.activeResultDisputeId,'case');
 assert.equal(f.game.canonicalResult.revision,4);
});

test('manual replay-result review cannot rebind an existing native READY recording',async()=>{
 const f=fixture();
 await assert.rejects(f.resolve({
   sourceHash:HASH,outcome:{type:'PLAYER_WIN',winnerPlayerId:'p2'},
   reason:'Invalid attempt at bypassing canonical result correction',
   actorUid:'uid',actorPlayerId:'admin',playedWithinWindow:true,
 }),error=>error.code==='failed-precondition');
 assert.equal(f.writes,0);
});

test('legacy canonical source retains its existing independent outcome qualification behavior',async()=>{
 const f=fixture(false);
 const r=await f.resolve();
 assert.equal(r.state,'RESULT_ALREADY_RESOLVED');
 assert.equal(f.writes,1,'legacy pending recording outcome continues to be recorded');
 assert.equal(f.source.outcomeQualification.state,'PENDING_ADMIN_REVIEW');
 assert.equal(f.game.canonicalResult.revision,4);
});
