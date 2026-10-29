import test from 'node:test';
import assert from 'node:assert/strict';
import {projectPlayerChronicle,chronicleWasSeenByLegacyId} from '../lib/engines/playerChronicleCore.js';

const roster=[
  {playerId:1,leaguePlayerId:'a',name:'Aldric'},
  {playerId:2,leaguePlayerId:'b',name:'Beren'},
  {playerId:3,leaguePlayerId:'c',name:'Cato'},
];
const history=()=>({modelVersion:'AOF_SOCIAL_HISTORY_V1',
  pairs:[{playerIds:['a','b'],tracks:{},exposure:{gameIds:[],battleIds:[],contexts:[],lastOrder:null}}],
  contributions:[],profiles:[]});
const result=(qualification='UNRESOLVED',winner=null,revision=1)=>
  qualification==='OFFICIAL'
    ?{qualification,resultRevision:revision,winningPlayerIds:winner?[winner]:[]}
    :{qualification:'UNRESOLVED',resultRevision:null,winningPlayerIds:null};
function beat(id,kind='SUPPORT_PARTICIPATION',extra={}){
  return {id,kind,actorPlayerId:1,targetPlayerId:2,
    moment:{atMs:10000,operationOrdinal:100},
    sourceEventIds:[id+'-original'],
    ...(kind==='SUPPORT_PARTICIPATION'?{supportKind:'DEFENSIVE_PARTICIPATION'}:{}),
    ...extra};
}
function chapter(n,{battle='battle-'+n,game='g1',beats=[],context='OPPOSED',
  battleOutcome=result(),accepted=true,chronologyQualified=true,sourceRevision='rev-1',
  players=roster,exposures=[{pairPlayerIds:[1,2],context}],order=n}={}){
  return {accepted,battleId:battle,gameIdentity:battle+'/'+game,order,
    chronologyQualified,sourceRevision,playedAtMs:1_700_000_000_000+n*60000,
    eventId:'accepted-event',seasonId:'season-1',battleOutcome,
    review:{status:'REVIEW_AVAILABLE',participants:players,exposure:exposures,chronicle:beats}};
}
function entries(chapters,extra={}){
  return projectPlayerChronicle({ownerPlayerId:'a',chapters,history:history(),
    names:{a:'Aldric',b:'Beren',c:'Cato'},...extra}).pages.find(x=>x.counterpartPlayerId==='b')?.entries??[];
}
function quietEntry(e){
  assert.equal(e.storyTier,'ORDINARY_LEDGER');
  assert.equal(e.rubric,'BATTLE LEDGER');
  assert.equal(e.paragraphs.length,1);
  assert.ok(e.paragraphs[0].length<=160,e.paragraphs[0]);
  assert.deepEqual(e.sourceBeatIds,[]);
  assert.deepEqual(e.sourceEventIds,[]);
  assert.deepEqual(e.relationshipMarks,[]);
  assert.deepEqual(e.reputationMarks,[]);
  assert.doesNotMatch(e.paragraphs[0],/attacked|won|defeated|rescued|delivered|grievance|betray|hurt|damage|killed/i);
}
test('E1: Sol runtime reproduction — five distinct accepted quiet pair Battles give five one-line scenes',()=>{
  const cs=[1,2,3,4,5].map(n=>chapter(n));
  const es=entries(cs);
  assert.deepEqual(es.map(e=>e.battleId),cs.map(c=>c.battleId));
  assert.equal(new Set(es.map(e=>e.sceneId)).size,5);
  for(const e of es)quietEntry(e);
  assert.match(es[0].paragraphs[0],/first recorded league Battle/i);
  assert.ok(es.slice(1).every(e=>!e.paragraphs[0].includes('first recorded')));
  assert.ok(es.every(e=>/official result is pending/i.test(e.paragraphs[0])));
  assert.deepEqual(entries([...cs].reverse()),es,'source input order is not historical chronology');
});
test('E1: first qualified social event plus four ordinary later Battles does not silence the four',()=>{
  const cs=[chapter(1,{beats:[beat('defence')],context:'LOCKED_TEAMMATES'}),
    ...[2,3,4,5].map(n=>chapter(n,{context:n===4?'OPEN_DIPLOMACY':'OPPOSED'}))];
  const es=entries(cs);
  assert.equal(es.length,5);
  assert.equal(es[0].sourceBeatIds.length,1);
  assert.match(es[0].paragraphs[0],/defensive episode/i);
  es.slice(1).forEach(quietEntry);
  assert.match(es[3].paragraphs[0],/open-diplomacy league Battle/i);
  const appended=entries([...cs,chapter(6)]);
  assert.deepEqual(appended.slice(0,5),es,'later accepted Battles cannot rewrite earlier prose or identities');
});
test('E1: an official result does not require fabricated winner prose; pending is explicit',()=>{
  const cs=[
    chapter(1,{battleOutcome:result('OFFICIAL','a',1)}),
    chapter(2,{battleOutcome:result()}),
    chapter(3,{battleOutcome:result('OFFICIAL','b',2)}),
  ];
  const es=entries(cs);
  assert.equal(es.length,3);
  es.forEach(quietEntry);
  assert.deepEqual(es.map(e=>e.resultStatus),['OFFICIAL','UNRESOLVED','OFFICIAL']);
  assert.doesNotMatch(es[0].paragraphs[0],/pending|won|victory/i);
  assert.match(es[1].paragraphs[0],/pending/i);
  assert.doesNotMatch(es[2].paragraphs[0],/Aldric won|Beren won|defeated/);
  const corrected=entries(cs.map((c,i)=>i===1?{...c,battleOutcome:result('OFFICIAL','a',3),sourceRevision:'rev-2'}:c));
  assert.equal(es[1].sceneId,corrected[1].sceneId);
  assert.notEqual(es[1].sceneRevision,corrected[1].sceneRevision);
  assert.doesNotMatch(corrected[1].paragraphs[0],/pending/);
});
test('E1: three source-current Games and a duplicate POV of one Battle are one pair scene',()=>{
  const cs=[
    chapter(1,{battle:'series',game:'g1',order:1}),
    chapter(2,{battle:'series',game:'g2',order:2}),
    chapter(3,{battle:'series',game:'g3',order:3}),
    chapter(3,{battle:'series',game:'g3-pov2',order:3}),
    chapter(4,{battle:'next',game:'g1',order:4})
  ];
  const es=entries(cs);
  assert.deepEqual(es.map(e=>e.battleId),['series','next']);
  assert.equal(es[0].sourceBeatIds.length,0,'no spurious combat from multiple Games');
  assert.equal(new Set(es.map(e=>e.sceneId)).size,2);
  es.forEach(quietEntry);
});
test('E1: roster change, current source withdrawal and unknown chronology fail closed for relevant claims',()=>{
  const cs=[chapter(1),chapter(2),chapter(3)];
  const original=entries(cs);
  const withdrawn=entries(cs.map((c,i)=>i===1?{...c,accepted:false}:c));
  assert.deepEqual(withdrawn.map(e=>e.battleId),['battle-1','battle-3']);
  assert.equal(withdrawn[1].sceneId,original[2].sceneId);
  const remapped=entries(cs.map((c,i)=>i===1?
    {...c,review:{...c.review,exposure:[{pairPlayerIds:[1,3],context:'OPPOSED'}]}}:c));
  assert.deepEqual(remapped.map(e=>e.battleId),['battle-1','battle-3']);
  const unordered=entries(cs.map((c,i)=>i===0?{...c,chronologyQualified:false}:c));
  assert.equal(unordered[0].chronologyStatus,'UNRESOLVED');
  assert.doesNotMatch(unordered[0].paragraphs[0],/first recorded/i);
  assert.ok(unordered[0].paragraphs[0].includes('official result is pending'));
});
test('E1: correcting a prior qualified deed recomposes later callbacks without making a new scene',()=>{
  const support=n=>chapter(n,{beats:[beat('aid-'+n)],context:'LOCKED_TEAMMATES',
    battleOutcome:result('OFFICIAL','a',1)});
  const cs=[support(1),support(2),support(3),chapter(4),chapter(5)];
  const before=entries(cs);
  assert.equal(before.length,5);
  assert.equal(before[2].narrativeContext.priorDirectedFamilyCounts['SUPPORT|a|b'],2);
  assert.match(before[2].paragraphs[0],/defensive episode/i);
  const amended=cs.map((c,i)=>i===0?{...c,sourceRevision:'rev-2',review:{...c.review,chronicle:[]}}:c);
  const after=entries(amended);
  assert.equal(after[0].storyTier,'ORDINARY_LEDGER','source correction removes the unsupported deed');
  assert.equal(after[2].narrativeContext.priorDirectedFamilyCounts['SUPPORT|a|b'],1);
  assert.notEqual(after[2].paragraphs[0],before[2].paragraphs[0]);
  assert.notEqual(after[2].sceneRevision,before[2].sceneRevision,
    'prior-only callback correction changes the dependent scene revision');
  assert.deepEqual(after.map(e=>e.sceneId),before.map(e=>e.sceneId));
  assert.ok(chronicleWasSeenByLegacyId([before[0].entryId],after[0],'a','b'),
    'legacy seen IDs must recognize corrected new content as the same pair Battle');
  assert.deepEqual(after.slice(3),before.slice(3),'unrelated later quiet entries do not become new stories');
});
test('E1: witnessed strict rare episode upgrades only its original scene, not a second chapter or grant',()=>{
  const cs=[chapter(1),
    chapter(2,{beats:[beat('king-episode','QUALIFIED_KING_LOSS_TREACHERY')],
      context:'OPEN_DIPLOMACY'}),chapter(3)];
  const es=entries(cs);
  assert.equal(es.length,3);
  assert.equal(es[1].storyTier,'EXTRAORDINARY_CHAPTER',
    'strict *already admitted* beat only; this writer never qualifies Treachery');
  quietEntry(es[0]);quietEntry(es[2]);
  const corrected=entries(cs.map((c,i)=>i===1?{...c,sourceRevision:'rev-2',review:{...c.review,chronicle:[]}}:c));
  assert.equal(corrected[1].storyTier,'ORDINARY_LEDGER');
  assert.equal(corrected[1].sceneId,es[1].sceneId);
  assert.notEqual(corrected[1].sceneRevision,es[1].sceneRevision);
  assert.doesNotMatch(JSON.stringify(corrected[1].paragraphs),/king|betrayal|alliance broke/i);
  assert.equal(Object.prototype.hasOwnProperty.call(corrected[1],'award'),false);
});
