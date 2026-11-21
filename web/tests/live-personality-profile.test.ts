import test from 'node:test';
import assert from 'node:assert/strict';
import {playerIdentity} from '../src/ui/StatisticsExperience';
import type {PlayerProfile} from '../src/domain/league';
import type {LivePersonalityEvidence} from '../src/domain/privateHistory';

const data={player:{playerId:'owner',steamName:'Owner'}} as PlayerProfile;
const axes=['BOOMER_AGGRESSOR','CAUTIOUS_BOLD','GUERRILLA_FRONTLINE',
  'SPECIALIST_IMPROVISER','COMPACT_EXPANSIVE'] as const;
function live(battles:number,games:number):LivePersonalityEvidence{
  return {version:'AOF_PERSONALITY_LIVE_EVIDENCE_V1',requiredGames:3,
    eligibleGames:games,gameUnlock:games>=3?'UNLOCKED':'LOCKED',
    requiredQualifiedBattles:3,qualifiedBattles:battles,
    status:battles>=3?'CALIBRATION_PENDING':'PENDING_BATTLES',
    calibration:'NOT_APPROVED',
    axes:axes.map((axis,i)=>({axis,
      status:i===0?'CALIBRATION_PENDING':'DEVELOPING',
      value:null,measuredBattles:i===0?battles:0,
      reasons:i===0?['APPROVED_HOSTED_CALIBRATION_REQUIRED']:
        ['CLASSIFIED_FAMILY_OPPORTUNITY_UNAVAILABLE']}))};
}

test('live profile before owner read is pending rather than falsely zero qualified Battles',()=>{
  const p=playerIdentity(data,false,null,'LOADING');
  assert.equal(p.eligibleBattles,null);
  assert.equal(p.eligibleGames,null);
  assert.equal(p.evidenceStatus,'LOADING');
  assert.ok(p.sliders.every(s=>s.value===null));
});
test('three Games and three complete Battles expose honest counts with five independent Developing/calibration reasons',()=>{
  const p=playerIdentity(data,false,live(4,4),'CURRENT');
  assert.equal(p.eligibleBattles,4);
  assert.equal(p.eligibleGames,4);
  assert.equal(p.evidenceStatus,'CURRENT');
  assert.equal(p.sliders[0].status,'CALIBRATION_PENDING');
  assert.equal(p.sliders[0].measuredBattles,4);
  assert.equal(p.sliders[0].value,null);
  assert.ok(p.sliders[1].reasons?.includes('CLASSIFIED_FAMILY_OPPORTUNITY_UNAVAILABLE'));
  assert.ok(p.sliders.every(s=>s.value===null));
});
test('three accepted BO3 Games do not turn one Battle into three qualified Battles',()=>{
  const p=playerIdentity(data,false,live(1,3),'CURRENT');
  assert.equal(p.eligibleGames,3);
  assert.equal(p.eligibleBattles,1);
});
test('withdrawal to two source Games retracts unlock and count',()=>{
  const p=playerIdentity(data,false,live(2,2),'CURRENT');
  assert.equal(p.eligibleBattles,2);
  assert.equal(p.eligibleGames,2);
  assert.ok(p.sliders.every(s=>s.value===null));
});
test('only reviewed server-approved per-axis READY can reveal numeric, other dimensions stay Developing',()=>{
  const x=live(4,4);
  x.calibration='APPROVED';x.axes[0].status='READY';x.axes[0].value=0;
  x.axes[0].measuredBattles=4;
  let p=playerIdentity(data,false,x,'CURRENT');
  assert.equal(p.sliders[0].value,0);
  assert.equal(p.sliders[1].value,null);
  x.axes[0].measuredBattles=1;
  p=playerIdentity(data,false,x,'CURRENT');
  assert.equal(p.sliders[0].value,null);
  x.axes[0].measuredBattles=4;x.calibration='NOT_APPROVED';
  p=playerIdentity(data,false,x,'CURRENT');
  assert.equal(p.sliders[0].value,null);
});
test('malformed owner-private data cannot masquerade as qualified profile',()=>{
  const x=live(4,4);
  x.axes[2].axis='BOOMER_AGGRESSOR';
  const p=playerIdentity(data,false,x,'UNAVAILABLE');
  assert.equal(p.eligibleBattles,null);
  assert.ok(p.sliders.every(s=>s.value===null));
});
