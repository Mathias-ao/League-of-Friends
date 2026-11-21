import test from 'node:test';
import assert from 'node:assert/strict';
import {projectRelationshipsEvidence,RELATIONSHIP_V1_RULE_PROPOSAL}
  from '../lib/integration/relationshipsEvidenceV1.js';
import {SOCIAL_SOURCE_EVIDENCE_VERSION} from '../lib/integration/socialEvidenceV1.js';

function deed(track,actor,other,battle,event,{game='g1',admitted=true}={}){
 return {track,system:'RELATIONSHIP',actorPlayerId:actor,counterpartPlayerId:other,
  battleId:battle,eventId:event,gameId:game,decision:admitted?'SOURCE_ADMITTED':'PENDING',
  methodVersion:RELATIONSHIP_V1_RULE_PROPOSAL.methods[track].method,
  missingEvidence:admitted?[]:['INDEPENDENT_METHOD_EVIDENCE_MISSING']};
}
const project=(records,factualPairs=[])=>projectRelationshipsEvidence({
 version:SOCIAL_SOURCE_EVIDENCE_VERSION,visibility:'OWNER_ONLY',sourcePolicy:'PROPOSED_EMULATOR_ONLY',
 ownerPlayerId:'p1',deeds:records,factualPairs,evidenceRevision:'current',
 gradeWeightsApproved:false,unconfiguredWeakening:true,publicationAllowed:false,officialWrites:false});
test('one-sided four original Battles supports directed Rivalry only, never reciprocal stage 3',()=>{
 const x=project([1,2,3,4].map(i=>deed('RIVALRY','p1','p2','b'+i,'e'+i)));
 assert.equal(x.pairs.length,1);
 const rivalry=x.pairs[0].tracks.RIVALRY;
 assert.equal(rivalry.outbound.sourceQualifiedBattles,4);
 assert.equal(rivalry.outbound.sourceQualifiedEvents,4);
 assert.equal(rivalry.inbound.sourceQualifiedEvents,0);
 assert.equal(rivalry.independentReciprocityKnown,false);
 assert.equal(rivalry.stageThreeEligibility,null);
 assert.equal(rivalry.stage,null);
 assert.equal(rivalry.numericPoints,null);
 assert.equal(x.pairs[0].tracks.HOSTILITY.status,'PENDING_SOURCE_METHOD');
 assert.equal(x.pairs[0].tracks.BOND.status,'PENDING_SOURCE_METHOD');
 assert.equal(x.officialWrites,false);
});
test('genuine B-owned evidence must be separate and source-bound to signal possible reciprocity',()=>{
 const x=project([
  deed('RIVALRY','p1','p2','b1','e1'),
  deed('RIVALRY','p2','p1','b2','e2'),
 ]);
 const rivalry=x.pairs[0].tracks.RIVALRY;
 assert.equal(rivalry.outbound.sourceQualifiedEvents,1);
 assert.equal(rivalry.inbound.sourceQualifiedEvents,1);
 assert.equal(rivalry.independentReciprocityKnown,true);
 assert.equal(rivalry.stageThreeEligibility,null,
  'Only #139 with approved calibration may accept stage-3 historical gate');
});
test('two Games one Battle/Event count once for independent history',()=>{
 const x=project([deed('RIVALRY','p1','p2','b1','e1',{game:'g1'}),
  deed('RIVALRY','p1','p2','b1','e1',{game:'g2'}),
  deed('RIVALRY','p1','p2','b2','e2',{game:'g1'})]);
 const r=x.pairs[0].tracks.RIVALRY.outbound;
 assert.equal(r.sourceQualifiedGames,3);
 assert.equal(r.sourceQualifiedBattles,2);
 assert.equal(r.sourceQualifiedEvents,2);
});
test('recipient-specific Bond under actual threat is directional, not shared enemy',()=>{
 const x=project([deed('BOND','p1','p2','b1','e1'),
  deed('BOND','p2','p1','b2','e2',{admitted:false})]);
 const bond=x.pairs[0].tracks.BOND;
 assert.equal(bond.status,'SOURCE_QUALIFIED');
 assert.equal(bond.outbound.sourceQualifiedBattles,1);
 assert.equal(bond.inbound.sourceQualifiedBattles,0);
 assert.equal(bond.independentReciprocityKnown,false);
 assert.ok(bond.inbound.missingEvidence.includes('INDEPENDENT_METHOD_EVIDENCE_MISSING'));
});
test('source correction retracts only the affected direction/track',()=>{
 const before=project([deed('RIVALRY','p1','p2','b1','e1'),
  deed('BOND','p1','p2','b1','e1')]);
 const after=project([deed('RIVALRY','p1','p2','b1','e1',{admitted:false}),
  deed('BOND','p1','p2','b1','e1')]);
 assert.equal(before.pairs[0].tracks.RIVALRY.outbound.sourceQualifiedBattles,1);
 assert.equal(after.pairs[0].tracks.RIVALRY.outbound.sourceQualifiedBattles,0);
 assert.equal(after.pairs[0].tracks.BOND.outbound.sourceQualifiedBattles,1);
});
test('ordinary 1v1 aggression and absent help do not manufacture Hostility or weakening',()=>{
 const x=project([deed('RIVALRY','p1','p2','b1','e1')]);
 const pair=x.pairs[0];
 assert.equal(pair.tracks.HOSTILITY.outbound.sourceQualifiedBattles,0);
 assert.equal(pair.tracks.HOSTILITY.outbound.pendingDeeds.length,0);
 assert.equal(pair.tracks.BOND.outbound.sourceQualifiedBattles,0);
 assert.equal(x.weakeningQualified,false);
 assert.equal(x.ruleStatus,'PROPOSED_UNAPPROVED');
});
test('cannot admit Hostility before independent method proof',()=>{
 assert.throws(()=>project([deed('HOSTILITY','p1','p2','b1','e1')]),
  /HOSTILITY_UNAPPROVED/);
 const pending=project([deed('HOSTILITY','p1','p2','b1','e1',{admitted:false})]);
 assert.equal(pending.pairs[0].tracks.HOSTILITY.status,'PENDING_SOURCE_METHOD');
});

test('quiet authenticated pair remains visible with three independent Pending tracks',()=>{
 const pair={otherPlayerId:'p2',battleIds:['b1'],gameKeys:['b1\\u0000g1'],eventIds:['e1']};
 const x=project([], [pair]);
 assert.equal(x.pairs.length,1);
 assert.equal(x.pairs[0].factualCurrentSourceBattles,1);
 assert.equal(x.pairs[0].factualCurrentSourceGames,1);
 for(const track of ['RIVALRY','HOSTILITY','BOND']){
  const t=x.pairs[0].tracks[track];
  assert.equal(t.status,'PENDING_SOURCE_METHOD');
  assert.equal(t.outbound.sourceQualifiedBattles,0);
  assert.equal(t.inbound.sourceQualifiedBattles,0);
  assert.equal(t.stage,null);assert.equal(t.numericPoints,null);
 }
});
test('corrected final admitted deed retracts credit but does not erase the factual pair',()=>{
 const pair={otherPlayerId:'p2',battleIds:['b1'],gameKeys:['b1\\u0000g1'],eventIds:['e1']};
 const before=project([deed('RIVALRY','p1','p2','b1','e1')],[pair]);
 const corrected=project([], [pair]);
 assert.equal(before.pairs[0].tracks.RIVALRY.outbound.sourceQualifiedBattles,1);
 assert.equal(corrected.pairs[0].tracks.RIVALRY.outbound.sourceQualifiedBattles,0);
 assert.equal(corrected.pairs[0].factualCurrentSourceBattles,1);
 const withdrawn=project([],[]);
 assert.equal(withdrawn.pairs.length,0,'withdrawn last current Game cannot leave a ghost active pair');
});
test('factual source enumeration is scoped to its authenticated owner',()=>{
 const other={otherPlayerId:'p2',battleIds:['b1'],gameKeys:['b1\\u0000g1'],eventIds:['e1']};
 const x=project([], [other]);
 assert.deepEqual(x.pairs.map(p=>p.otherPlayerId),['p2']);
 assert.throws(()=>project([], [{...other,otherPlayerId:'p1'}]),/FACTUAL_PAIRS_INVALID/);
 assert.throws(()=>project([], [other,other]),/DUPLICATE_FACTUAL_PAIR/);
});

test('large directional Pending candidates retain counts without repeating full source envelopes',()=>{
 const candidates=Array.from({length:200},(_,i)=>({
  ...deed('HOSTILITY','p1','p2','b1','e1',{admitted:false}),
  claimId:'candidate-'+i,claimRevision:'revision-'+i,contributionKey:'candidate-'+i,
 }));
 const x=project(candidates);
 const track=x.pairs[0].tracks.HOSTILITY.outbound;
 assert.equal(track.pendingCandidateCount,200);
 assert.equal(track.pendingDeeds.length,1,
  'readiness is one private method/missing-proof signature, not 200 copied source envelopes');
 assert.equal(track.sourceQualifiedEvents,0);
 assert.equal(x.pairs[0].tracks.HOSTILITY.numericPoints,null);
 assert.ok(JSON.stringify(x).length<12000);
});
