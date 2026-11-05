import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {qualifyPersonalityGameUnlock,gatePersonalityProfileByGames,
  PERSONALITY_GAME_UNLOCK_VERSION}
  from '../lib/engines/personalityV1/gameUnlock.js';
import {validateSharedRecord} from '../lib/domain/socialV1Validation.js';

const sha=x=>createHash('sha256').update(String(x)).digest('hex');
const owner='TEST_ONLY_OWNER',other='TEST_ONLY_OPPONENT';
const fixture=(battle,game,sequence,actor=owner)=>({
  contract:'AOF_SOCIAL_V1_SHARED_1',authorityRevision:sha('authority'+sequence),
  battleId:battle,matchId:battle,gameId:game,
  eventId:'TEST_EVENT',seasonId:'TEST_SEASON',gameGuid:'genuine-shape-guid-'+sequence,
  sourceHash:sha('recording'+sequence),statisticsRevision:1,
  mappingDigest:sha('mapping'+sequence),eventAdmissionDigest:sha('event'+sequence),
  artifactRefs:[],outcome:{qualification:'UNRESOLVED',resultRevision:null,winningPlayerIds:null},
  roster:[{playerId:actor,replaySlot:1,teamId:'1'},
    {playerId:other,replaySlot:2,teamId:'2'}],
});
const subset=(xs)=>qualifyPersonalityGameUnlock(owner,xs);
const profiles=JSON.parse(readFileSync(new URL('../../contracts/social-v1/fixtures/conformance.json',import.meta.url),'utf8')).bases;
function readyProfile(){
  const initial=structuredClone(profiles.PersonalityProfile);
  initial.sliders=initial.sliders.map((s,i)=>({
    ...s,status:'READY',value:i===0?0:(i+1)*10,independentBattles:2,
    coverage:{...s.coverage,tier:'LIMITED',missing:[]},
  }));
  return validateSharedRecord('PersonalityProfile',initial);
}

test('1→2→3 unique current source Games unlock independent of Battle count and winning outcome',()=>{
  const games=[fixture('A','g1',1),fixture('B','g1',2),fixture('C','g1',3)];
  for(let i=0;i<3;i++){
    const state=subset(games.slice(0,i+1));
    assert.equal(state.version,PERSONALITY_GAME_UNLOCK_VERSION);
    assert.equal(state.eligibleGames,i+1);
    assert.equal(state.requiredGames,3);
    assert.equal(state.status,i===2?'UNLOCKED':'LOCKED');
    assert.equal(state.reason,i===2?null:'THREE_SOURCE_QUALIFIED_GAMES_REQUIRED');
    const shown=gatePersonalityProfileByGames(readyProfile(),state);
    if(i<2){
      assert.ok(shown.sliders.every(s=>s.status==='DEVELOPING'&&s.value===null&&s.featureRefs.length===0));
      assert.ok(shown.sliders.every(s=>s.coverage.missing.includes('THREE_SOURCE_QUALIFIED_GAMES_REQUIRED')));
    }else assert.equal(shown.sliders[0].value,0);
    validateSharedRecord('PersonalityProfile',shown);
  }
  // Same owner, same source observations: reversing arrival/upload order
  // cannot create or remove eligibility.
  assert.deepEqual(subset([...games].reverse()),subset(games));
});

test('BO3 three real-distinct source Game GUIDs unlock milestone but remain ONE Battle for numerical sampling',()=>{
  const series=[fixture('S','g1',1),fixture('S','g2',2),fixture('S','g3',3)];
  const result=subset(series);
  assert.equal(result.status,'UNLOCKED');
  assert.equal(result.eligibleGames,3);
  assert.equal(new Set(series.map(x=>x.battleId)).size,1);
  // Numerical sufficiency is deliberately not calculated from this Game counter.
  // The separate canonical Battle reducer continues to require 2 Battles.
});

test('duplicate POV, reused source GUID/hash or repeated canonical Game cannot create third Game',()=>{
  const one=fixture('A','g1',1),two=fixture('B','g1',2);
  for(const changed of [
    {...one,battleId:'C',matchId:'C',gameId:'g1'},
    {...fixture('C','g1',3),gameGuid:one.gameGuid},
    {...fixture('C','g1',3),gameGuid:one.gameGuid.toUpperCase()},
    {...fixture('C','g1',3),sourceHash:one.sourceHash},
    {...one,authorityRevision:sha('replayed-source-revision')},
  ])assert.throws(()=>subset([one,two,changed]),/PERSONALITY_UNLOCK_DUPLICATE/);
});

test('withdrawn or corrected current source 3→2 retracts the unlock; a fresh accepted original restores it',()=>{
  const originals=[fixture('A','g1',1),fixture('B','g1',2),fixture('C','g1',3)];
  assert.equal(subset(originals).status,'UNLOCKED');
  // Real current-source collector excludes withdrawn/obsolete source versions.
  assert.equal(subset(originals.slice(0,2)).status,'LOCKED');
  const replacement=fixture('C','g1',4);
  assert.equal(subset([...originals.slice(0,2),replacement]).status,'UNLOCKED');
  assert.notEqual(replacement.sourceHash,originals[2].sourceHash);
});

test('untrusted owner, missing GUID, wrong roster, invalid metadata or false result proof fails closed',()=>{
  const one=fixture('A','g1',1);
  for(const changed of [
    {...one,sourceHash:'bad'},
    {...one,gameGuid:null},
    {...one,outcome:{qualification:'UNRESOLVED',resultRevision:3,winningPlayerIds:[owner]}},
    {...one,roster:one.roster.map(p=>({...p,playerId:'unrelated'}))},
    {...one,roster:[one.roster[0],one.roster[0]]},
    {...one,statisticsRevision:0},
    {...one,matchId:'mismatch'},
  ])assert.throws(()=>subset([changed]),/PERSONALITY_UNLOCK_UNTRUSTED/);
  assert.throws(()=>qualifyPersonalityGameUnlock('OUTSIDER',[one]),/PERSONALITY_UNLOCK_UNTRUSTED/);
  assert.throws(()=>qualifyPersonalityGameUnlock('',[]),/PERSONALITY_UNLOCK_OWNER_REQUIRED/);
});

test('missing specialist taxonomy or independent command evidence does not lock an otherwise accepted third Game',()=>{
  const games=[fixture('A','g1',1),fixture('B','g1',2),fixture('C','g1',3)];
  // Eligibility uses the verified original/current-source wrapper, never
  // a feature taxonomy, synthetic zero, inferred combat or approved winner.
  assert.equal(subset(games).status,'UNLOCKED');
  const locked=gatePersonalityProfileByGames(readyProfile(),subset(games.slice(0,2)));
  assert.equal(locked.sliders[0].independentBattles,2);
  assert.equal(locked.sliders[0].value,null);
  assert.notEqual(locked.projectionRevision,readyProfile().projectionRevision);
});
