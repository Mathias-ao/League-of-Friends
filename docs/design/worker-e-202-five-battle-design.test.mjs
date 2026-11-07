/** Run manually: node --test docs/design/worker-e-202-five-battle-design.test.mjs
 * A review-only reference for #202 and #205, NOT a test of live Chronicle core.
 * The current source core's beatless-Battle filter is intentionally represented
 * as a failing product expectation (old count four, required count five).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const fixture=JSON.parse(readFileSync(new URL('./worker-e-202-five-battle-fixture-v1.json',import.meta.url),'utf8'));
const key=record=>[fixture.ownerId,fixture.counterpartId,record.battleId].join('|');
function projectReviewOnly(battles,{rareReceipt=true}={}){
  const accepted=battles.filter(x=>x.accepted);
  return accepted.map((battle,index)=>{
    const previous=accepted.slice(0,index);
    const historical=battle.historicalCallback;
    const reversal=historical?.type==='ACCEPTED_RESULT_REVERSAL'
      &&battle.result==='OFFICIAL'&&battle.winner===historical.newWinner
      &&previous.some(p=>p.battleId===historical.earlierBattleId
        &&p.result==='OFFICIAL'&&p.winner===historical.previousWinner
        &&p.winner!==battle.winner);
    const participation=battle.sourceBeats.some(x=>x.admitted===true&&x.kind==='SUPPORT_PARTICIPATION');
    const earlierOpposed=previous.some(x=>x.side==='OPPOSED');
    // Supplied receipt is injected by a *mock external qualifier* in this test.
    // No source count, ID name or authored prose qualifies an event.
    const receipt=rareReceipt?battle.syntheticExternalReceipt:null;
    const extraordinary=receipt?.qualification==='QUALIFIED_OWNER_APPROVED_TEST_ONLY'
      &&receipt.testOnly===true&&receipt.sourceEventRefs.length>=2;
    const tier=extraordinary?'EXTRAORDINARY_CHAPTER':
      reversal||(participation&&earlierOpposed)?'DEVELOPING_HISTORY':'ORDINARY_LEDGER';
    return {battleId:battle.battleId,sceneKey:key(battle),tier,
      resultLine:battle.result==='OFFICIAL'?'Official result: '+battle.winner:'Battle result pending',
      games:battle.games.length};
  });
}
test('source-accepted Battle count is five; current special-only filter demonstrates B1 omission',()=>{
  const current=fixture.battles.filter((x,i)=>i===0||x.sourceBeats.length||x.socialMarks.length);
  assert.deepEqual(current.map(x=>x.battleId),['H1','H3','H4','H5']);
  const target=projectReviewOnly(fixture.battles);
  assert.deepEqual(target.map(x=>x.battleId),['H1','H2','H3','H4','H5']);
  assert.equal(new Set(target.map(x=>x.sceneKey)).size,5);
});
test('three ordinary, one historically developing, one externally-qualified hypothetical rare',()=>{
  const scenes=projectReviewOnly(fixture.battles);
  assert.deepEqual(scenes.map(x=>x.tier),[
    'ORDINARY_LEDGER','ORDINARY_LEDGER','DEVELOPING_HISTORY','ORDINARY_LEDGER','EXTRAORDINARY_CHAPTER']);
});
test('two accepted Games in H3 are one canonical Battle scene',()=>{
  const scenes=projectReviewOnly(fixture.battles);
  assert.equal(scenes.length,5);assert.equal(scenes.find(x=>x.battleId==='H3').games,2);
  assert.equal(scenes.reduce((n,x)=>n+x.games,0),6);
});
test('unresolved results do not invent winners',()=>{
  for(const x of projectReviewOnly(fixture.battles).filter(x=>['H1','H4','H5'].includes(x.battleId)))
    assert.equal(x.resultLine,'Battle result pending');
});
test('earlier result correction downgrades callback but not scene identity or valid current pressure',()=>{
  const before=projectReviewOnly(fixture.battles);
  const corrected=fixture.battles.map(x=>x.battleId==='H2'
    ?{...x,sourceRevision:'r2',result:'UNRESOLVED',winner:null}:x);
  const after=projectReviewOnly(corrected);
  assert.equal(after.find(x=>x.battleId==='H3').tier,'ORDINARY_LEDGER');
  assert.deepEqual(after.map(x=>x.sceneKey),before.map(x=>x.sceneKey));
  assert.equal(corrected.find(x=>x.battleId==='H3').sourceBeats[0].admitted,true);
});
test('externally controlled rare receipt withdrawal removes extraordinary only',()=>{
  const after=projectReviewOnly(fixture.battles,{rareReceipt:false});
  assert.equal(after.find(x=>x.battleId==='H5').tier,'DEVELOPING_HISTORY');
  assert.equal(fixture.battles.find(x=>x.battleId==='H5').sourceBeats[0].admitted,true);
});
test('source-typed FFA mark alone is ordinary, never effective alliance or Treachery',()=>{
  const scene=projectReviewOnly(fixture.battles).find(x=>x.battleId==='H4');
  assert.equal(scene.tier,'ORDINARY_LEDGER');
  assert.equal(scene.resultLine,'Battle result pending');
  assert.equal(fixture.battles.find(x=>x.battleId==='H4').sourceBeats[0].kind,'DECLARATION_ESTABLISHED');
});
test('review projection contains no private testimony, inferred motive, rewards or scores',()=>{
  const dump=JSON.stringify(projectReviewOnly(fixture.battles));
  assert.doesNotMatch(dump,/grievance|betray|hated|score|award|testimony|saved|received/i);
});
