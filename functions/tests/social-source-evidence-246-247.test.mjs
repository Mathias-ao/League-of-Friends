import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {projectSharedSocialSourceEvidence,SOCIAL_SOURCE_EVIDENCE_VERSION}
  from '../lib/integration/socialEvidenceV1.js';

const sha=x=>createHash('sha256').update(x).digest('hex');
const spec={
  RIVALRY:'AOF_SV1E_PAIR_RAID_ENGAGEMENT_CONTEST_1',
  BOND:'AOF_SV1E_THREAT_LINKED_DIRECTED_HELP_1',
  CHIVALRY:'AOF_SV1E_NOTEWORTHY_THREAT_PROTECTION_1',
  GALLANTRY:'AOF_SV1E_CHALLENGED_RETURN_PRESSURE_1',
  CRUELTY:'AOF_SV1E_PREENTRY_DISADVANTAGE_PRESSURE_PENDING_1',
  HOSTILITY:'AOF_SV1E_SELECTIVE_ANTAGONISM_PENDING_1',
};
function bound({battle='b1',game='g1',guid='guid1',season='s1',
  actor='p1',other='p2',track='RIVALRY',qualified=true,sourceSuffix='1'}={}){
  const authority=sha('authority'+battle+game+sourceSuffix);
  const source={contract:'AOF_SOCIAL_V1_SHARED_1',battleId:battle,matchId:battle,
    gameId:game,gameGuid:guid,seasonId:season,eventId:'e'+battle,sourceHash:sha('source'+guid+sourceSuffix),
    authorityRevision:authority,statisticsRevision:1,
    roster:[{playerId:'p1',replaySlot:1,teamId:null},{playerId:'p2',replaySlot:2,teamId:null}]};
  const component='component-'+battle+game+actor+other;
  const originalIds=qualified?['op1-'+guid+'-'+actor,'op2-'+guid+'-'+actor]:[];
  const cards=[{
    battleId:battle,gameId:game,sourceAuthority:authority,
    actorPlayerId:actor,counterpartPlayerId:other,track,
    methodVersion:spec[track],decision:qualified?'SOURCE_ADMITTED':'PENDING',
    sourceCoverage:'LIMITED',methodCoverage:qualified?'ADMITTED':'PENDING',
    gradeBandId:qualified?'ORDINARY':null,
    originalEventCount:originalIds.length,originalSourceEventIds:originalIds,
    sourceContextRevision:sha('context'+guid),
    missingEvidence:qualified?[]:['INDEPENDENT_CONTEXT_UNAVAILABLE'],
    reasonCodes:qualified?[]:['METHOD_UNAVAILABLE'],
    originalPosition:{recordingAtMs:15000,operationOrdinal:10,order:'ORDERED'},
    historicalOrder:{order:'ORDERED',leagueOrderKey:'official-'+battle,gameNumber:1},
    corroboration:qualified?[{kind:'RAID_V3',sourceDetectorId:'raid-1',
      originalSourceEventIds:[originalIds[0]]}]:[],
    identity:{version:'AOF_SOCIAL_E2E_CREDIT_IDENTITY_1',
      contributionKey:component,componentId:component,keySubstitutionAllowed:false},
    claimId:'claim-'+component+'-'+track,claimRevision:sha('claim'+component+track),
  }];
  return {source,sourceMethodRevision:sha('method'+guid),cards};
}
const project=(...inputs)=>projectSharedSocialSourceEvidence('p1',inputs);
test('one validated source envelope is versioned and read-only; source remains LIMITED',()=>{
  const x=project(bound());
  assert.equal(x.version,SOCIAL_SOURCE_EVIDENCE_VERSION);
  assert.equal(x.sourceBinding,'INT_B_CURRENT_READY_AND_C2A_VALIDATED');
  assert.equal(x.sourcePolicy,'PROPOSED_EMULATOR_ONLY');
  assert.equal(x.officialWrites,false);
  assert.equal(x.publicationAllowed,false);
  assert.equal(x.gradeWeightsApproved,false);
  assert.equal(x.unconfiguredWeakening,true);
  assert.equal(x.deeds.length,1);
  const d=x.deeds[0];
  assert.equal(d.decision,'SOURCE_ADMITTED');
  assert.equal(d.effect,'STRENGTHEN');
  assert.equal(d.gradeBandId,'ORDINARY');
  assert.equal(d.originalSourceCoverage,'LIMITED');
  assert.equal(d.originalSourceEventIds.length,2);
  assert.equal(d.actorPlayerId,'p1');
  assert.equal(d.counterpartPlayerId,'p2');
  assert.equal(d.opportunity.approvedDenominator,null);
  assert.equal(d.recordedContext.rosterRelation,'UNKNOWN');
  assert.equal(d.recordedContext.effectiveFfaDiplomacy,'UNAVAILABLE');
  assert.equal(d.evidenceMeaning,'SOURCE_BOUND_INFERRED_COMMAND_COMMITMENT_NOT_OUTCOME');
});
test('idempotent same source, two Games one Battle, cross-Battle means two samples',()=>{
  const a=bound(),b=bound({battle:'b1',game:'g2',guid:'guid2'}),c=bound({battle:'b2',game:'g1',guid:'guid3'});
  const x=project(a,a,b,c);
  assert.equal(x.deeds.length,3);
  assert.equal(new Set(x.deeds.map(d=>d.battleId)).size,2);
  assert.deepEqual(x,project(c,b,a));
});
test('a current recording correction invalidates even an empty or Pending evidence view',()=>{
  const first=bound();
  first.cards=[];
  const before=project(first);
  const corrected=structuredClone(first);
  corrected.source.sourceHash=sha('corrected-current-READY-source');
  corrected.source.authorityRevision=sha('corrected-current-authority');
  corrected.sourceMethodRevision=sha('corrected-method-projection');
  const after=project(corrected);
  assert.deepEqual(before.deeds,[]);
  assert.deepEqual(after.deeds,[]);
  assert.notEqual(before.evidenceRevision,after.evidenceRevision);
  assert.notDeepEqual(before.sourceRevisions,after.sourceRevisions);
});
test('corrected same GUID or same Game from distinct current revisions fails closed',()=>{
  const a=bound();
  assert.throws(()=>project(a,bound({sourceSuffix:'corrected'})),/CONFLICTING_CURRENT_GAME_SOURCE/);
  assert.throws(()=>project(a,bound({battle:'b2',game:'g1'})),/DUPLICATE_GAME_GUID/);
  assert.throws(()=>project(a,{...structuredClone(a),cards:[{...a.cards[0],sourceContextRevision:sha('other')}]}),
    /CONFLICTING_CURRENT_GAME_SOURCE/);
});
test('source actor/counterpart and exact original references are non-negotiable',()=>{
  const a=bound();
  for(const mutation of [
    x=>x.cards[0].actorPlayerId='unbound',
    x=>x.cards[0].originalEventCount=100,
    x=>x.cards[0].methodVersion='AOF_UNAPPROVED',
    x=>x.cards[0].identity.keySubstitutionAllowed=true,
    x=>x.cards[0].corroboration[0].originalSourceEventIds=['bad','bad'],
    x=>x.cards[0].sourceAuthority='stale',
  ]){
    const bad=structuredClone(a);mutation(bad);
    assert.throws(()=>project(bad),/SOCIAL_EVIDENCE_/);
  }
});
test('ordinary raids never become source-admitted Cruelty or Hostility',()=>{
  for(const track of ['CRUELTY','HOSTILITY']){
    const a=bound({track});
    assert.throws(()=>project(a),/UNAPPROVED_OR_UNSOURCED_TRACK_GRADE/);
    const pending=bound({track,qualified:false});
    const out=project(pending);
    assert.equal(out.deeds[0].decision,'PENDING');
    assert.equal(out.deeds[0].gradeBandId,null);
    assert.equal(out.deeds[0].effect,null);
  }
});
test('a pending unrelated track does not veto an independently sourced Rivalry',()=>{
  const a=bound();
  const b=bound({track:'CRUELTY',qualified:false});
  const combined={...a,cards:[...a.cards,...b.cards]};
  const x=project(combined);
  assert.equal(x.deeds.find(d=>d.track==='RIVALRY').decision,'SOURCE_ADMITTED');
  assert.equal(x.deeds.find(d=>d.track==='CRUELTY').decision,'PENDING');
  assert.equal(x.deeds.filter(d=>d.decision==='SOURCE_ADMITTED').length,1);
});
test('two allegedly separate same-direction credits cannot reuse an original event',()=>{
  const a=bound();const duplicate=structuredClone(a.cards[0]);
  duplicate.identity.contributionKey='other-component';
  duplicate.identity.componentId='other-component';
  duplicate.claimId='other-claim';duplicate.claimRevision=sha('other-claim');
  a.cards.push(duplicate);
  assert.throws(()=>project(a),/CORRELATED_ORIGINAL_SOURCE_CREDIT/);
});
test('distinct #165 Pending candidates may share one incident without another grade',()=>{
  const a=bound();
  const pending=bound({qualified:false}).cards[0];
  pending.identity.contributionKey=a.cards[0].identity.contributionKey;
  pending.identity.componentId=a.cards[0].identity.componentId;
  pending.claimId='pending-other-claim';
  pending.claimRevision=sha('pending-other-claim');
  a.cards.push(pending);
  const out=project(a);
  assert.equal(out.deeds.length,2);
  assert.equal(out.deeds.filter(d=>d.decision==='SOURCE_ADMITTED').length,1);
  assert.equal(out.deeds.filter(d=>d.decision==='PENDING').length,1);
});
test('second admitted row on the same #165 contribution is not another source method',()=>{
  const a=bound();
  const extra=structuredClone(a.cards[0]);
  extra.claimId='another-candidate';
  extra.claimRevision=sha('another-candidate');
  a.cards.push(extra);
  assert.throws(()=>project(a),/CORRELATED_COMPONENT_ALREADY_ADMITTED/);
});
test('recorded team membership is context, not proof of helpful conduct or FFA alignment',()=>{
 const teammate=bound();
 teammate.source.roster[0].teamId='alliance-1';
 teammate.source.roster[1].teamId='alliance-1';
 assert.equal(project(teammate).deeds[0].recordedContext.rosterRelation,'SAME_RECORDED_TEAM');
 teammate.source.roster[1].teamId='alliance-2';
 assert.equal(project(teammate).deeds[0].recordedContext.rosterRelation,'DIFFERENT_RECORDED_TEAMS');
 assert.equal(project(teammate).deeds[0].recordedContext.effectiveFfaDiplomacy,'UNAVAILABLE');
 teammate.source.roster[1].teamId=undefined;
 assert.throws(()=>project(teammate),/SOURCE_SNAPSHOT_NOT_BOUND/);
});
test('owner-private read cannot expose unrelated teammate-to-enemy pair deeds',()=>{
  const a=bound();
  a.source.roster.push({playerId:'p3',replaySlot:3,teamId:'a'});
  a.source.roster.push({playerId:'p4',replaySlot:4,teamId:'b'});
  a.cards[0].actorPlayerId='p3';
  a.cards[0].counterpartPlayerId='p4';
  const own=project(a);
  assert.equal(own.deeds.length,0);
  a.cards[0].counterpartPlayerId='p1';
  assert.equal(project(a).deeds.length,1,'incoming deed is allowed');
  a.source.roster=a.source.roster.filter(p=>p.playerId!=='p1');
  assert.throws(()=>project(a),/OWNER_NOT_CURRENT_SOURCE_PARTICIPANT/);
});
test('reverse participant action is never inferred from receiving a Raid',()=>{
  const a=bound();
  const x=project(a);
  assert.equal(x.deeds.filter(d=>d.actorPlayerId==='p2').length,0);
  assert.equal(x.deeds.filter(d=>d.track==='BOND').length,0);
});
