import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {projectLivePersonalityEvidence} from '../lib/engines/personalityV1/liveEvidence.js';
import {PERSONALITY_AXES} from '../lib/engines/personalityV1/personalityV1.js';

const owner='p1',axisNames=Object.keys(PERSONALITY_AXES);
const sha=v=>createHash('sha256').update(String(v)).digest('hex');
const source=(battleId,gameId,seq)=>({
  contract:'AOF_SOCIAL_V1_SHARED_1',battleId,matchId:battleId,gameId,
  sourceHash:sha('original-'+seq),authorityRevision:sha('authority-'+seq),
  mappingDigest:sha('mapping-'+seq),gameGuid:'GUID_'+seq,statisticsRevision:1,
  roster:[{replaySlot:1,playerId:owner,teamId:'1'},
    {replaySlot:2,playerId:'p2',teamId:'2'}],
  outcome:{qualification:'UNRESOLVED',resultRevision:null,winningPlayerIds:null}
});
const battle=(id,parts)=>({battleId:id,
  gameIds:parts.map(([name])=>name),gameManifestComplete:true,
  sources:parts.map(([game,seq])=>({source:source(id,game,seq)}))
});
const unlock=(n)=>({version:'AOF_PERSONALITY_THREE_GAME_UNLOCK_V1',
  requiredGames:3,eligibleGames:n,status:n>=3?'UNLOCKED':'LOCKED',
  reason:n>=3?null:'THREE_SOURCE_QUALIFIED_GAMES_REQUIRED'});
const profile=(status='PROPOSED')=>({
  playerId:owner,policy:{status,configurationVersion:'TEST_CALIBRATION_REQUIRES_APPROVAL',
    approvalRef:status==='APPROVED'?'OWNER_APPROVAL_DOCUMENT':null},
  sliders:axisNames.map(axis=>({axis,status:'READY',value:42,independentBattles:4}))
});
const feature=(battleId,axis,measured=true)=>({
  playerId:owner,battleId,matchId:battleId,featureId:axis,
  featureVersion:'AOF_PERSONALITY_FEATURES_V1',sampleUnit:'INDEPENDENT_BATTLE',
  numerator:measured?3:null,denominator:measured?5:null,
  coverage:{missing:measured?[]:axis==='SPECIALIST_IMPROVISER'
    ?['CLASSIFIED_FAMILY_OPPORTUNITY_UNAVAILABLE']
    :['INSUFFICIENT_ATTRIBUTABLE_COMMAND_EPISODES']}
});
const four=()=>[1,2,3,4].map(i=>battle('battle'+i,[['g1',i]]));
const measurements=()=>four().flatMap((b,i)=>axisNames.map(axis=>feature(b.battleId,axis,
  axis==='BOOMER_AGGRESSOR'||axis==='COMPACT_EXPANSIVE'&&i!==3)));
const project=(b,u=unlock(4),f=measurements(),p=profile(),approved=false)=>
  projectLivePersonalityEvidence(owner,b,u,f,p,approved);

test('four source-current READY Battles produce true 4/4 count with per-axis coverage, no invented hosted numbers',()=>{
  const result=project(four());
  assert.equal(result.version,'AOF_PERSONALITY_LIVE_EVIDENCE_V1');
  assert.equal(result.qualifiedBattles,4);
  assert.equal(result.eligibleGames,4);
  assert.equal(result.gameUnlock,'UNLOCKED');
  assert.equal(result.requiredQualifiedBattles,3);
  assert.equal(result.calibration,'NOT_APPROVED');
  assert.equal(result.status,'CALIBRATION_PENDING');
  const data=Object.fromEntries(result.axes.map(x=>[x.axis,x]));
  assert.equal(data.BOOMER_AGGRESSOR.measuredBattles,4);
  assert.equal(data.COMPACT_EXPANSIVE.measuredBattles,3);
  assert.equal(data.SPECIALIST_IMPROVISER.measuredBattles,0);
  assert.equal(data.GUERRILLA_FRONTLINE.measuredBattles,0);
  assert.deepEqual(result.axes.map(x=>x.value),[null,null,null,null,null]);
  assert.equal(data.BOOMER_AGGRESSOR.status,'CALIBRATION_PENDING');
  assert.ok(data.SPECIALIST_IMPROVISER.reasons.includes('CLASSIFIED_FAMILY_OPPORTUNITY_UNAVAILABLE'));
  assert.ok(data.GUERRILLA_FRONTLINE.reasons.includes('INSUFFICIENT_ATTRIBUTABLE_COMMAND_EPISODES'));
});

test('three distinct Games inside one canonical BO3 satisfy Game milestone but not three-Battle display',()=>{
  const series=battle('series',[['g1',1],['g2',2],['g3',3]]);
  const f=axisNames.flatMap(axis=>[feature('series',axis)]);
  const result=project([series],unlock(3),f);
  assert.equal(result.eligibleGames,3);
  assert.equal(result.qualifiedBattles,1);
  assert.equal(result.status,'PENDING_BATTLES');
  assert.ok(result.axes.every(a=>a.value===null));
  assert.ok(result.axes.every(a=>a.reasons.includes('THREE_QUALIFIED_BATTLES_REQUIRED')));
});

test('missing sibling Game or accepted source correction retracts Battle eligibility but not unrelated Battle source',()=>{
  const b=four();
  const original=project(b);
  assert.equal(original.qualifiedBattles,4);
  b[2].sources=[];
  const corrected=project(b,unlock(3));
  assert.equal(corrected.qualifiedBattles,3);
  b[1].gameIds.push('g2'); // Incomplete canonical series: no invented Game/POV.
  assert.equal(project(b,unlock(2)).qualifiedBattles,2);
  assert.equal(project(b,unlock(2)).status,'PENDING_BATTLES');
  assert.ok(project(b,unlock(2)).axes.every(a=>a.value===null));
});

test('two POVs with same original GUID/hash across Battle IDs fail closed rather than count twice',()=>{
  const b=four();
  b[1].sources[0].source.gameGuid=b[0].sources[0].source.gameGuid;
  assert.throws(()=>project(b),/PERSONALITY_LIVE_DUPLICATE_CURRENT_RECORDING/);
  b[1].sources[0].source.gameGuid='NEW-GUID';
  b[1].sources[0].source.sourceHash=b[0].sources[0].source.sourceHash;
  assert.throws(()=>project(b),/PERSONALITY_LIVE_DUPLICATE_CURRENT_RECORDING/);
});

test('unresolved winner can contribute a source-qualified Battle; false winner qualification cannot',()=>{
  const b=four();
  assert.equal(project(b).qualifiedBattles,4);
  b[0].sources[0].source.outcome.resultRevision=3;
  assert.equal(project(b).qualifiedBattles,3);
});

test('a proposed calibration can never release hosted numbers, even if test caller requests approval',()=>{
  const result=project(four(),unlock(4),measurements(),profile('PROPOSED'),true);
  assert.equal(result.calibration,'NOT_APPROVED');
  assert.ok(result.axes.every(a=>a.value===null));
  const approved=project(four(),unlock(4),measurements(),profile('APPROVED'),true);
  assert.equal(approved.axes.find(a=>a.axis==='BOOMER_AGGRESSOR').value,42);
  assert.equal(approved.axes.find(a=>a.axis==='SPECIALIST_IMPROVISER').value,null);
});
