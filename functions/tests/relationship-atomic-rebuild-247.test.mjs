import test from 'node:test';
import assert from 'node:assert/strict';
import {db} from '../lib/config/firebase.js';
import {memoryFirestore} from './support/memory-firestore.mjs';
import {relationshipReplacementPlan,relationshipQueryRevision,relationshipPairUnchanged}
 from '../lib/engines/relationshipAtomicPlan.js';

const docs=(entries)=>entries.map(([id,time])=>({
  id,updateTime:{seconds:Math.floor(time/1000),
    nanoseconds:(time%1000)*1_000_000},
}));
test('unchanged source pair keeps its exact document and Chronicle seen state',()=>{
  const shared={schemaVersion:'AOF_PAIR_HISTORY_V2',pairId:'a__b',
    playerOneId:'a',playerTwoId:'b',
    pairHistory:{encounters:4,contributingMatchIds:['m1','m2','m3','m4']},
    relationship:{rivalry:{status:'UNCONFIGURED',stageId:null}},
    chronicle:[{entryId:'m1:FIRST_MEETING'},{entryId:'m2:COVERAGE_UNAVAILABLE'}],
    relationshipEngineVersion:'AOF_RELATIONSHIP_ENGINE_V2',
    relationshipRuleVersion:null,relationshipRulesConfigured:false,
    interactionCoverage:'UNAVAILABLE'};
  assert.equal(relationshipPairUnchanged({...structuredClone(shared),updatedAt:100},
    {...structuredClone(shared),updatedAt:200}),true);
  assert.equal(relationshipPairUnchanged({...structuredClone(shared),pairHistory:{encounters:5}},
    shared),false,'the corrected pair must be rewritten');
  assert.equal(relationshipPairUnchanged({...structuredClone(shared),chronicle:[]},shared),false,
    'changed factual history is not frozen');
  const legacy=structuredClone(shared);delete legacy.interactionCoverage;
  assert.equal(relationshipPairUnchanged(legacy,shared),false,
    'old missing coverage is migrated rather than silently retained');
});
test('full update performs only replacement sets; no old collection deletion before commit',()=>{
 const plan=relationshipReplacementPlan(['a__b','a__c'],['a__b','a__c']);
 assert.deepEqual(plan,{obsoletePairIds:[],totalPairWrites:2});
});
test('source correction withdraws only obsolete pair in same atomic transaction',()=>{
 const plan=relationshipReplacementPlan(['a__b','a__c','b__c'],['a__b','b__c']);
 assert.deepEqual(plan,{obsoletePairIds:['a__c'],totalPairWrites:3});
});
test('complete source and current relationship query order does not alter fingerprint',()=>{
 assert.equal(relationshipQueryRevision(docs([['a',10],['b',12]])),
              relationshipQueryRevision(docs([['b',12],['a',10]])));
});
test('two corrections in the SAME millisecond are not falsely equivalent',()=>{
 const first=[{id:'a',updateTime:{seconds:100,nanoseconds:100_000_000}}];
 const second=[{id:'a',updateTime:{seconds:100,nanoseconds:100_000_001}}];
 assert.notEqual(relationshipQueryRevision(first),relationshipQueryRevision(second));
 assert.throws(()=>relationshipQueryRevision([{id:'a',updateTime:{seconds:100,nanoseconds:1_000_000_000}}]),
   /REVISION_UNAVAILABLE/);
});
test('source or relationship changed mid-rebuild forces failed revision fence',()=>{
 const before=relationshipQueryRevision(docs([['a',10],['b',12]]));
 assert.notEqual(before,relationshipQueryRevision(docs([['a',11],['b',12]])));
 assert.notEqual(before,relationshipQueryRevision(docs([['a',10],['b',12],['c',1]])));
 assert.notEqual(before,relationshipQueryRevision(docs([['a',10]])));
});
test('large fanout refuses partial/chunked replacement and keeps current docs intact',()=>{
 const ids=Array.from({length:451},(_,i)=>'pair-'+i);
 assert.throws(()=>relationshipReplacementPlan([],ids),/BUDGET_EXCEEDED/);
 assert.deepEqual(relationshipReplacementPlan([],ids.slice(0,450)).totalPairWrites,450);
});
test('ambiguous source fingerprint or colliding pair IDs is refused',()=>{
 assert.throws(()=>relationshipReplacementPlan(['x','x'],['x']),/DUPLICATE/);
 assert.throws(()=>relationshipReplacementPlan([],['a/b']),/INVALID/);
 assert.throws(()=>relationshipQueryRevision(docs([['a',1],['a',2]])),/DUPLICATE/);
 assert.throws(()=>relationshipQueryRevision(docs([['a',NaN]])),/UNAVAILABLE/);
});

test('ordinary snapshot double preserves exact Firestore revision and notices source correction',async()=>{
 const records=memoryFirestore([['matches/m1',{status:'COMPLETED',canonicalResult:{revision:1}}]]);
 const completed=db.collection('matches').where('status','==','COMPLETED');
 const first=await completed.get();
 assert.equal(first.size,1);
 assert.equal(typeof first.docs[0].createTime.toMillis,'function');
 assert.equal(Number.isSafeInteger(first.docs[0].updateTime.seconds),true);
 assert.equal(Number.isSafeInteger(first.docs[0].updateTime.nanoseconds),true);
 const witness=relationshipQueryRevision(first.docs);
 assert.equal(relationshipQueryRevision((await completed.get()).docs),witness);
 records.set('matches/m1',{status:'COMPLETED',canonicalResult:{revision:2}});
 assert.notEqual(relationshipQueryRevision((await completed.get()).docs),witness,
   'normal current source correction must alter the revision before committing history');
});
test('interleaved correction aborts transaction before touching factual Chronicle pair',async()=>{
 const pair={pairHistory:{chronicle:[{entryId:'m1:ordinary'}]},relationshipRulesConfigured:false};
 const records=memoryFirestore([
  ['matches/m1',{status:'COMPLETED',canonicalResult:{revision:1}}],
  ['relationships/a__b',pair],
 ]);
 const matches=db.collection('matches').where('status','==','COMPLETED');
 const witness=relationshipQueryRevision((await matches.get()).docs);
 // Source changed after the expensive pair projection was calculated.
 records.set('matches/m1',{status:'COMPLETED',canonicalResult:{revision:2}});
 await assert.rejects(db.runTransaction(async tx=>{
  const latest=await tx.get(matches);
  if(relationshipQueryRevision(latest.docs)!==witness)
    throw new Error('SOURCE_CORRECTION_ABORT');
  tx.set(db.collection('relationships').doc('a__b'),{pairHistory:{chronicle:[]}});
 }),/SOURCE_CORRECTION_ABORT/);
 assert.deepEqual(records.get('relationships/a__b'),pair,
   'failed revision fence may not erase an existing factual Chronicle scene');
 await assert.rejects(db.runTransaction(async tx=>{
  await tx.get(matches);
  tx.set(db.collection('relationships').doc('a__b'),{pairHistory:{chronicle:[]}});
  throw new Error('SIMULATED_COMMIT_FAILURE');
 }),/SIMULATED_COMMIT_FAILURE/);
 assert.deepEqual(records.get('relationships/a__b'),pair,
   'failed transaction never leaks a partial replacement');
});
