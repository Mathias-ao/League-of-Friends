import test from 'node:test';
import assert from 'node:assert/strict';
import {selectRareChronicleProposals,STRICT_TREACHERY_GATES,RARE_CHRONICLE_SELECTOR} from '../lib/engines/chronicleRareSelector.js';
import {invitationSlotId} from '../lib/domain/socialV1.js';

/** Synthetic evidence fixtures ONLY: not accepted owner thresholds or original replay proof. */
const h=x=>x.repeat(64);
const a=h('a'),b=h('b'),c=h('c'),d=h('d');
const battle={
  battleId:'battle-1',playerIds:['a','b','c','d'],
  currentGames:[{gameId:'g1',sourceAuthority:a},{gameId:'g2',sourceAuthority:b}],
  evidenceComplete:true,chronologyQualified:true,
};
const policy={
  approved:true,approvalRef:'test-only-owner-approval',
  qualifiedMethods:['test-only-executed-aid','test-only-grievance','test-only-three-loss','test-only-strict-treachery'],
  familyOrder:['TREACHERY_VICTIM','SKILL_ACKNOWLEDGMENT','ASSISTANCE','SITUATED_GRIEVANCE'],
  fatiguedPlayerIds:[],blockedPairKeys:[],
};
const fake=(overrides={})=>({
 battleId:battle.battleId,gameId:'g1',sourceAuthority:a,incidentId:'incident-1',
 incidentRevision:c,respondentPlayerId:'a',counterpartPlayerId:'b',
 family:'ASSISTANCE',qualifierMethod:'test-only-executed-aid',
 qualification:'ADMITTED',significance:'REVIEWED_TURNING_POINT',
 sourceEvidenceRefs:['original-event-1'],independentEpisodeKey:'episode-1',
 substantiveAssistanceVerified:true,...overrides
});
const choose=(candidates,changes={})=>selectRareChronicleProposals({
 battle,policy,candidates,existingSlots:[],...changes});
const slot=(respondent,state='DECLINED')=>({
 slotId:invitationSlotId('battle-1',respondent),battleId:'battle-1',matchId:'battle-1',
 respondentPlayerId:respondent,revision:2,state,firstOpportunityRevision:d,
 currentOpportunityRevision:state==='WITHDRAWN'?null:d
});

test('default OFF: unapproved/no-registry policy and ordinary 1v1 both select zero',()=>{
 assert.deepEqual(choose([fake()],{policy:null}),[]);
 assert.deepEqual(choose([fake()],{policy:{...policy,approved:false}}),[]);
 assert.deepEqual(choose([fake()],{policy:{...policy,qualifiedMethods:[]}}),[]);
 const ordinaryOneVOne={...battle,playerIds:['a','b'],currentGames:[battle.currentGames[0]]};
 assert.deepEqual(choose([],{battle:ordinaryOneVOne}),[]);
 assert.deepEqual(choose([fake({significance:'ROUTINE'})],{battle:ordinaryOneVOne}),[]);
 assert.deepEqual(choose([fake({qualification:'LIMITED'})],{battle:ordinaryOneVOne}),[]);
});

test('source-qualified exceptional substantive help: one private proposal, no claim of rescue/receipt/score',()=>{
 const out=choose([fake()]);
 assert.equal(out.length,1);
 assert.equal(out[0].version,RARE_CHRONICLE_SELECTOR);
 assert.equal(out[0].status,'PRIVATE_PROPOSAL_ONLY');
 assert.equal(out[0].slotId,invitationSlotId('battle-1','a'));
 assert.deepEqual(Object.keys(out[0]).sort(),[
 'battleId','counterpartPlayerId','family','gameId','incidentId',
 'incidentRevision','independentEpisodeKey','qualifierMethod','respondentPlayerId',
 'slotId','sourceAuthority','status','version'].sort());
 assert.equal(JSON.stringify(out).includes('rescued'),false);
 assert.equal(JSON.stringify(out).includes('note'),false);
});

test('a command-only assistance or ordinary attack cannot qualify a subjective report',()=>{
 assert.deepEqual(choose([fake({substantiveAssistanceVerified:false})]),[]);
 assert.deepEqual(choose([fake({qualification:'PENDING'})]),[]);
 assert.deepEqual(choose([fake({qualification:'REJECTED'})]),[]);
 assert.deepEqual(choose([fake({sourceEvidenceRefs:[]})]),[]);
 assert.deepEqual(choose([fake({sourceAuthority:d})]),[]);
 assert.deepEqual(choose([fake({gameId:'superseded-source'})]),[]);
 assert.deepEqual(choose([fake({respondentPlayerId:'outsider'})]),[]);
 assert.deepEqual(choose([fake({counterpartPlayerId:'outsider'})]),[]);
 assert.deepEqual(choose([fake({respondentPlayerId:'b',counterpartPlayerId:'b'})]),[]);
 assert.deepEqual(choose([fake({family:'SITUATED_GRIEVANCE',qualifierMethod:'test-only-grievance',
    situatedConductVerified:false})]),[]);
 assert.equal(choose([fake({family:'SITUATED_GRIEVANCE',qualifierMethod:'test-only-grievance',
    situatedConductVerified:true})]).length,1,'source-qualified exceptional grievance can be considered');
});

test('third loss requires complete certified three distinct Battles, never three Games',()=>{
 const skill=fake({family:'SKILL_ACKNOWLEDGMENT',qualifierMethod:'test-only-three-loss',
  thirdLoss:{historyComplete:true,anchorBattleId:'battle-1',priorLossBattleIds:['battle-prev-1','battle-prev-2']}});
 assert.equal(choose([skill]).length,1);
 for(const thirdLoss of [
 {historyComplete:false,anchorBattleId:'battle-1',priorLossBattleIds:['p1','p2']},
 {historyComplete:true,anchorBattleId:'battle-1',priorLossBattleIds:['p1','p1']},
 {historyComplete:true,anchorBattleId:'battle-1',priorLossBattleIds:['battle-1','p2']},
 {historyComplete:true,anchorBattleId:'battle-X',priorLossBattleIds:['p1','p2']},
 ])assert.deepEqual(choose([{...skill,thirdLoss}]),[]);
});

test('strict Treachery only invites the proven victim when all six objective gates have source refs',()=>{
 const treachery=fake({family:'TREACHERY_VICTIM',qualifierMethod:'test-only-strict-treachery',
  treachery:{victimPlayerId:'a',responsiblePlayerId:'b',
   prerequisiteRefs:Object.fromEntries(STRICT_TREACHERY_GATES.map(k=>[k,['proof-'+k]]))}});
 assert.equal(choose([treachery]).length,1);
 assert.deepEqual(choose([{...treachery,treachery:{...treachery.treachery,victimPlayerId:'b'}}]),[]);
 assert.deepEqual(choose([{...treachery,treachery:{...treachery.treachery,
  prerequisiteRefs:{...treachery.treachery.prerequisiteRefs,QUALIFIED_KING_LOSS:[]}}}]),[]);
 assert.deepEqual(choose([fake({family:'TREACHERY_VICTIM',qualifierMethod:'test-only-strict-treachery'})]),[]);
});

test('4v4 and multi-Game/duplicate POV signal dedup is one respondent per Battle, no quota',()=>{
 const multi={...battle,playerIds:['a','b','c','d','e','f','g','h']};
 const various=[
 fake({incidentId:'strong-aid',independentEpisodeKey:'same-episode',sourceAuthority:a}),
 fake({incidentId:'same-episode-pov',independentEpisodeKey:'same-episode',gameId:'g2',sourceAuthority:b}),
 fake({incidentId:'different-episode',independentEpisodeKey:'other-episode',gameId:'g2',sourceAuthority:b}),
 fake({respondentPlayerId:'c',counterpartPlayerId:'d',incidentId:'help-c',independentEpisodeKey:'episode-c'}),
 ];
 const first=choose(various,{battle:multi});
 const second=choose([...various].reverse(),{battle:multi});
 assert.deepEqual(first,second,'no upload/POV input-order luck');
 assert.equal(first.length,2);
 assert.equal(new Set(first.map(x=>x.respondentPlayerId)).size,2);
 assert.deepEqual(choose([],{battle:multi}),[],'no questionnaire quota even in 4v4');
 assert.deepEqual(choose(various,{battle:{...multi,chronologyQualified:false}}),[]);
 assert.deepEqual(choose(various,{battle:{...multi,evidenceComplete:false}}),[]);
});

test('consumed permanent slot, fatigue and prior-pair cooldown block new offers across retries and revisions',()=>{
 const candidate=fake();
 for(const state of ['OFFERED','DEFERRED','DECLINED','SUBMITTED','WITHDRAWN']){
  assert.deepEqual(choose([candidate],{existingSlots:[slot('a',state)]}),[],state);
 }
 assert.deepEqual(choose([candidate],{policy:{...policy,fatiguedPlayerIds:['a']}}),[]);
 assert.deepEqual(choose([candidate],{policy:{...policy,blockedPairKeys:[JSON.stringify(['a','b'])]}}),[]);
 assert.deepEqual(choose([candidate],{existingSlots:[{...slot('a'),slotId:d}]}),[]);
 assert.equal(choose([candidate],{existingSlots:[slot('b')]}).length,1,
  'another player slot never prevents this player from having one');
});

test('silence, defer, declined and withdrawn never create negative judgments or effects',()=>{
 const base=choose([fake()]);
 assert.equal(base.length,1);
 for(const state of ['DEFERRED','DECLINED','WITHDRAWN']){
  const none=choose([fake()],{existingSlots:[slot('a',state)]});
  assert.deepEqual(none,[]);
 }
 const serialized=JSON.stringify(base);
 for(const forbidden of ['judgment','choiceIds','privateNote','negativeCredit','socialScore',
 'receipt','QUALIFIED','Not Qualified','authorUid','freeText']){
  assert.equal(serialized.includes(forbidden),false,forbidden);
 }
});

test('source mapping/roster revision cannot be accepted from stale or incompletely sourced Battle',()=>{
 const c1=fake();
 assert.deepEqual(choose([c1],{battle:{...battle,currentGames:[
  {gameId:'g1',sourceAuthority:b},{gameId:'g2',sourceAuthority:a}
 ]}}),[],'source replacements invalidate stale candidate');
 assert.deepEqual(choose([c1],{battle:{...battle,playerIds:['a','c','d']}}),[]);
 assert.deepEqual(choose([c1],{battle:{...battle,currentGames:[{gameId:'g1',sourceAuthority:a},
   {gameId:'g1',sourceAuthority:b}]}}),[],'duplicate Game/POV source not allowed');
});
