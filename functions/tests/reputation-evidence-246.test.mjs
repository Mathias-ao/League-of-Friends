import test from 'node:test';
import assert from 'node:assert/strict';
import {projectReputationEvidence,REPUTATION_V1_RULE_PROPOSAL}
  from '../lib/integration/reputationEvidenceV1.js';
import {SOCIAL_SOURCE_EVIDENCE_VERSION} from '../lib/integration/socialEvidenceV1.js';

function record(track,battle,game,season,{admitted=true,actor='p1'}={}){
 return {track,system:'REPUTATION',decision:admitted?'SOURCE_ADMITTED':'PENDING',
  methodVersion:REPUTATION_V1_RULE_PROPOSAL.methods[track].method,
  actorPlayerId:actor,counterpartPlayerId:'p2',battleId:battle,gameId:game,
  seasonId:season,contributionKey:'episode-'+battle+'-'+game+'-'+track,
  missingEvidence:admitted?[]:['INDEPENDENT_PROOF_MISSING']};
}
function view(records){
 return projectReputationEvidence({version:SOCIAL_SOURCE_EVIDENCE_VERSION,visibility:'OWNER_ONLY',
  sourcePolicy:'PROPOSED_EMULATOR_ONLY',ownerPlayerId:'p1',
  gradeWeightsApproved:false,unconfiguredWeakening:true,publicationAllowed:false,
  officialWrites:false,deeds:records,evidenceRevision:'source-current'});
}
test('source-qualified Gallantry and Chivalry remain distinct; Cruelty pending',()=>{
 const x=view([record('GALLANTRY','b1','g1','s1'),record('CHIVALRY','b1','g1','s1'),
  record('CRUELTY','b1','g1','s1',{admitted:false})]);
 assert.equal(x.ruleStatus,'PROPOSED_UNAPPROVED');
 assert.equal(x.tracks.GALLANTRY.readiness,'SOURCE_QUALIFIED');
 assert.equal(x.tracks.CHIVALRY.readiness,'SOURCE_QUALIFIED');
 assert.equal(x.tracks.CRUELTY.readiness,'PENDING_SOURCE_METHOD');
 assert.equal(x.tracks.CRUELTY.currentGrade,null);
 assert.equal(x.tracks.CRUELTY.careerPoints,null);
 assert.equal(x.tracks.GALLANTRY.careerPoints,null);
 assert.equal(x.officialWrites,false);
 assert.equal(x.tracks.GALLANTRY.currentGrade,'ORDINARY');
});
test('one Battle with two Games counts as one career Battle, but two source Games',()=>{
 const x=view([record('GALLANTRY','b1','g1','s1'),record('GALLANTRY','b1','g2','s1'),
   record('GALLANTRY','b2','g1','s2')]);
 assert.deepEqual(x.tracks.GALLANTRY.career,{
  sourceQualifiedBattles:2,sourceQualifiedGames:3,distinctOriginalContributions:3});
 assert.deepEqual(x.tracks.GALLANTRY.bySeason.s1,{
  sourceQualifiedBattles:1,sourceQualifiedGames:2,distinctOriginalContributions:2});
 assert.deepEqual(x.tracks.GALLANTRY.bySeason.s2,{
  sourceQualifiedBattles:1,sourceQualifiedGames:1,distinctOriginalContributions:1});
});
test('source correction replaces withdrawn method rather than freezing reputation',()=>{
 const before=view([record('GALLANTRY','b1','g1','s1')]);
 const after=view([record('GALLANTRY','b1','g1','s1',{admitted:false})]);
 assert.equal(before.tracks.GALLANTRY.career.sourceQualifiedBattles,1);
 assert.equal(after.tracks.GALLANTRY.career.sourceQualifiedBattles,0);
 assert.equal(after.tracks.GALLANTRY.currentGrade,null);
 assert.deepEqual(after.tracks.GALLANTRY.pendingReasons.includes('INDEPENDENT_PROOF_MISSING'),true);
});
test('no relevant source is Pending not zero; cannot infer missing Chivalry from one-on-one',()=>{
 const x=view([record('GALLANTRY','b1','g1','s1')]);
 assert.equal(x.tracks.CHIVALRY.readiness,'PENDING_SOURCE_METHOD');
 assert.equal(x.tracks.CHIVALRY.stage,null);
 assert.equal(x.tracks.CHIVALRY.career.sourceQualifiedBattles,0);
 assert.ok(x.tracks.CHIVALRY.pendingReasons.includes('NO_VERIFIED_TRACK_EPISODE'));
 assert.equal(x.tracks.CRUELTY.stage,null);
});
test('another actor and a source-poor axis cannot suppress independently justified evidence',()=>{
 const x=view([record('CHIVALRY','b1','g1','s1'),record('CRUELTY','b1','g1','s1',{admitted:false}),
   record('GALLANTRY','b1','g1','s1',{actor:'p2'})]);
 assert.equal(x.tracks.CHIVALRY.career.sourceQualifiedBattles,1);
 assert.equal(x.tracks.GALLANTRY.career.sourceQualifiedBattles,0);
 assert.equal(x.tracks.CRUELTY.readiness,'PENDING_SOURCE_METHOD');
});
test('not yet approved method cannot turn arbitrary Cruelty positive into a grade',()=>{
 assert.throws(()=>view([record('CRUELTY','b1','g1','s1')]),/CRUELTY_UNAPPROVED/);
 assert.throws(()=>projectReputationEvidence({version:'WRONG'}),/SHARED_SOURCE_REQUIRED/);
});

test('large Pending method candidate sets use compact references without losing source readiness',()=>{
 const candidates=Array.from({length:200},(_,i)=>({
  ...record('CRUELTY','b1','g1','s1',{admitted:false}),
  contributionKey:'unqualified-'+i,claimId:'pending-'+i,claimRevision:'current-'+i,
 }));
 const x=view(candidates);
 assert.equal(x.tracks.CRUELTY.withheldCandidateCount,200);
 assert.equal(x.tracks.CRUELTY.withheldDeeds.length,1,
   'one source/method/missing-evidence signature is enough for readiness display');
 assert.equal(x.tracks.CRUELTY.career.sourceQualifiedBattles,0);
 assert.equal(x.tracks.CRUELTY.careerPoints,null);
 assert.ok(JSON.stringify(x).length<10000,
   'the derived read model must not duplicate 200 full Pending source envelopes');
});
