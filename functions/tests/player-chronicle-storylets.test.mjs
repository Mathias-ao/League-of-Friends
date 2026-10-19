import test from 'node:test';
import assert from 'node:assert/strict';
import {projectPlayerChronicle} from '../lib/engines/playerChronicleCore.js';
import {composeChronicleC1,CHRONICLE_STORYLET_VERSION} from '../lib/engines/playerChronicleStorylets.js';

const participants=[
  {playerId:1,leaguePlayerId:'a',name:'Aldric'},
  {playerId:2,leaguePlayerId:'b',name:'Beren'},
  {playerId:3,leaguePlayerId:'c',name:'Cato'},
  {playerId:4,leaguePlayerId:'d',name:'Doran'},
  {playerId:5,leaguePlayerId:'e',name:'Eadric'},
  {playerId:6,leaguePlayerId:'f',name:'Frida'},
  {playerId:7,leaguePlayerId:'g',name:'Gawain'},
  {playerId:8,leaguePlayerId:'h',name:'Hilda'},
];
const beat=(id,kind,actorPlayerId=1,targetPlayerId=2,extra={})=>({
  id,kind,moment:{atMs:1000,operationOrdinal:1},
  actorPlayerId,targetPlayerId,sourceEventIds:['event-'+id],...extra,
});
const episode=(id,kind)=>{
  if(kind==='DUEL')return [beat('duel-'+id,'ACCEPTED_DUEL_CONTEST')];
  if(kind==='DEFENCE')return [beat('defence-'+id,'SUPPORT_PARTICIPATION',1,2,{supportKind:'DEFENSIVE_PARTICIPATION'})];
  if(kind==='REVERSE_DEFENCE')return [beat('reverse-'+id,'SUPPORT_PARTICIPATION',2,1,{supportKind:'DEFENSIVE_PARTICIPATION'})];
  if(kind==='REINFORCEMENT')return [beat('reinforce-'+id,'SUPPORT_PARTICIPATION',1,2,{supportKind:'REINFORCEMENT_COMMANDS'})];
  if(kind==='AID')return [beat('aid-'+id,'MATERIAL_AID_ORDER',1,2,{resourceAmounts:{gold:500}})];
  if(kind==='SHARED')return [beat('shared-'+id,'SHARED_PARTICIPATION',1,2,{opponentPlayerId:3})];
  if(kind==='BREACH')return [
    beat('withdraw-'+id,'ALLY_DECLARATION_WITHDRAWN',1,2,{declaration:'ENEMY'}),
    beat('breach-'+id,'OFFENSIVE_ATTEMPT_AFTER_WITHDRAWAL',1,2,{association:'IMMEDIATE',targetFunction:'ECONOMIC_UNIT',moment:{atMs:2000,operationOrdinal:2}}),
  ];
  if(kind==='DIPLOMACY')return [
    beat('declaration-'+id,'DECLARATION_ESTABLISHED',1,2,{declaration:'ALLY'}),
  ];
  return [];
};
const chapter=(i,kind,options={})=>({
  gameIdentity:options.gameIdentity??'battle-'+i+'/game-1',
  battleId:'battle-'+i,order:i,accepted:true,
  playedAtMs:1_700_000_000_000+i*1000,
  // #125 authority: one canonical aggregate Match/Battle result, never a Game winner.
  battleOutcome:options.battleOutcome??(options.resultStatus==='UNRESOLVED'
    ?{qualification:'UNRESOLVED',resultRevision:null,winningPlayerIds:null}
    :{qualification:'OFFICIAL',resultRevision:1,winningPlayerIds:['a']}),
  chronologyQualified:options.chronologyQualified??true,
  eventId:'event-lombardia',seasonId:'season-1',
  sourceRevision:{revision:i},
  review:{
    status:'REVIEW_AVAILABLE',participants,
    exposure:[{pairPlayerIds:[1,2],context:options.exposure??'OPPOSED'}],
    chronicle:episode(i+'-'+(options.gameIdentity??'g1'),kind),
  },
});
const history={modelVersion:'AOF_SOCIAL_HISTORY_V1',contributions:[],
  pairs:[{playerIds:['a','b'],tracks:{},exposure:{battleIds:[],gameIds:[],contexts:[]}}],
  profiles:[]};
const project=chapters=>projectPlayerChronicle({ownerPlayerId:'a',chapters,history,names:{a:'Aldric',b:'Beren',c:'Cato'}});
const entries=chs=>project(chs).pages.find(p=>p.counterpartPlayerId==='b').entries;
const paragraph=e=>e.paragraphs.join(' ');
const stats=es=>{
  const prose=es.map(paragraph),titles=es.map(e=>e.title);
  const opening=prose.map(p=>p.split(/\s+/).slice(0,5).join(' ').toLowerCase());
  const adjacent=xs=>xs.slice(1).filter((s,i)=>s===xs[i]).length;
  const maximum=xs=>Math.max(...Object.values(xs.reduce((m,s)=>(m[s]=(m[s]??0)+1,m),{})));
  return {
    entries:es.length,uniqueParagraphs:new Set(prose).size,
    uniqueTitles:new Set(titles).size,uniqueOpenings:new Set(opening).size,
    adjacentParagraphRepeats:adjacent(prose),adjacentTitleRepeats:adjacent(titles),
    adjacentFiveWordRepeats:adjacent(opening),maximumParagraphReuse:maximum(prose),
  };
};

test('C1: 100 repeated duels vary full paragraphs and titles, not merely opening words',()=>{
  const chs=Array.from({length:100},(_,i)=>chapter(i+1,'DUEL'));
  const es=entries(chs),s=stats(es);
  assert.equal(CHRONICLE_STORYLET_VERSION,'AOF_CHRONICLE_PROSE_C1');
  assert.equal(es.length,100);
  assert.equal(s.adjacentParagraphRepeats,0);
  assert.equal(s.adjacentTitleRepeats,0);
  assert.equal(s.adjacentFiveWordRepeats,0);
  assert.ok(s.uniqueParagraphs>=30,JSON.stringify(s));
  assert.ok(s.uniqueTitles>=4,JSON.stringify(s));
  assert.ok(s.maximumParagraphReuse<=4,JSON.stringify(s));
  assert.ok(es.every(e=>/accepted|official duel/i.test(paragraph(e))));
  console.log('CHRONICLE_C1_100_DUELS',JSON.stringify(s));
});

test('C1: 100 directed defensive episodes vary full prose without inventing rescue',()=>{
  const es=entries(Array.from({length:100},(_,i)=>chapter(i+1,'DEFENCE')));
  const s=stats(es);
  assert.equal(s.adjacentParagraphRepeats,0);
  assert.ok(s.uniqueParagraphs>=30,JSON.stringify(s));
  assert.ok(s.maximumParagraphReuse<=4,JSON.stringify(s));
  for(const e of es){
    assert.doesNotMatch(paragraph(e),/\b(saved|rescued|delivered|received|conspired|destroyed)\b/i);
    assert.match(paragraph(e),/defen[sc]e|defensive/i);
  }
  console.log('CHRONICLE_C1_100_DEFENCES',JSON.stringify(s));
});

test('C1: 120 mixed source-backed families remain understated and preserve proof grammar',()=>{
  const kinds=['DUEL','DEFENCE','AID','SHARED','BREACH','REINFORCEMENT'];
  const es=entries(Array.from({length:120},(_,i)=>chapter(i+1,kinds[i%kinds.length],{
    exposure:i%6===1?'LOCKED_TEAMMATES':'OPEN_DIPLOMACY',
  })));
  const s=stats(es);
  assert.equal(es.length,120);
  assert.equal(s.adjacentParagraphRepeats,0,JSON.stringify(s));
  assert.ok(s.uniqueParagraphs>=90,JSON.stringify(s));
  assert.ok(s.uniqueTitles>=12,JSON.stringify(s));
  for(const e of es){
    assert.doesNotMatch(paragraph(e),/\b(saved|rescued|delivered|received|conspired|successfully destroyed)\b/i);
    if(e.rubric==='MATERIAL AID')assert.match(paragraph(e),/order/i);
    if(e.rubric==='COMMON TARGET')assert.match(paragraph(e),/engagement/i);
    if(e.rubric==='WITHDRAWAL & OFFENSE')assert.match(paragraph(e),/attempt/i);
  }
  console.log('CHRONICLE_C1_120_MIXED',JSON.stringify(s));
});

test('C1: prior-only history, stable entry IDs, and correction recomposition',()=>{
  const ten=Array.from({length:10},(_,i)=>chapter(i+1,'DEFENCE'));
  const earlier=entries(ten);
  const expanded=entries([...ten,chapter(11,'DEFENCE')]);
  assert.deepEqual(expanded.slice(0,10),earlier,
    'appending a later Battle may not rewrite older scene contents or IDs');
  const revised=ten.map(c=>c.battleId==='battle-4'?chapter(4,'DUEL'):c);
  const corrected=entries(revised);
  const before=earlier.find(e=>e.battleId==='battle-10');
  const after=corrected.find(e=>e.battleId==='battle-10');
  assert.equal(after.entryId,before.entryId);
  assert.notEqual(paragraph(after),paragraph(before),
    'corrected earlier family evidence recomposes a later callback/variant');
  assert.equal(corrected[0].entryId,earlier[0].entryId);
  assert.equal(paragraph(corrected[0]),paragraph(earlier[0]));
  assert.deepEqual(entries([...ten].reverse()),earlier,
    'chapter input ordering cannot affect words or identities');
});

test('C1: reverse-directed assistance cannot inherit A-to-B narrative repetition',()=>{
  const es=entries([
    chapter(1,'DEFENCE'),chapter(2,'DEFENCE'),chapter(3,'DEFENCE'),
    chapter(4,'REVERSE_DEFENCE'),chapter(5,'REVERSE_DEFENCE'),
    chapter(6,'REVERSE_DEFENCE'),
  ]);
  assert.match(paragraph(es[3]),/Beren joined the defensive episode beside them|Beren.*defensive episode around Aldric/);
  assert.match(paragraph(es[5]),/defensive episode|defence/i);
  assert.notEqual(paragraph(es[5]),paragraph(es[3]),
    'only the third distinct B-to-A episode may enter C1 variation');
  assert.ok(es[5].narrativeContext.priorDirectedFamilyCounts['SUPPORT|b|a']>=2);
});

test('C1: two Games in one Battle do not create two chapters or accelerate repetition',()=>{
  const chapters=[chapter(1,'DEFENCE'),chapter(1,'DEFENCE',{gameIdentity:'battle-1/game-2'}),
    chapter(2,'DEFENCE'),chapter(3,'DEFENCE')];
  const es=entries(chapters);
  assert.equal(es.length,3);
  assert.equal(es[1].narrativeContext.priorDirectedFamilyCounts['SUPPORT|a|b'],1);
  assert.equal(es[2].narrativeContext.priorDirectedFamilyCounts['SUPPORT|a|b'],2);
});

test('C1: ten consecutive 1v1/4v4/FFA-style Battle scenes and a late correction',()=>{
  const kinds=['DUEL','DEFENCE','DIPLOMACY','AID','SHARED',
    'BREACH','REVERSE_DEFENCE','DUEL','DEFENCE','AID'];
  const exposures=['OPPOSED','LOCKED_TEAMMATES','OPEN_DIPLOMACY','LOCKED_TEAMMATES',
    'LOCKED_TEAMMATES','OPEN_DIPLOMACY','LOCKED_TEAMMATES','OPPOSED',
    'LOCKED_TEAMMATES','LOCKED_TEAMMATES'];
  const chs=kinds.map((kind,i)=>chapter(i+1,kind,{exposure:exposures[i]}));
  const es=entries(chs);
  assert.equal(es.length,10);
  const revised=chs.map((ch,i)=>i===2?chapter(3,'SHARED',{exposure:'OPEN_DIPLOMACY'}):ch);
  const corrected=entries(revised);
  assert.equal(corrected.length,10);
  assert.deepEqual(corrected.slice(0,2),es.slice(0,2));
  assert.equal(corrected[2].sceneId,es[2].sceneId,
    'source correction retains canonical pair×Battle identity');
  assert.notEqual(corrected[2].entryId,es[2].entryId,
    'legacy beat-derived IDs change only with corrected source beats; #125 owns seen-ID compatibility');
  assert.notEqual(paragraph(corrected[2]),paragraph(es[2]));
  assert.ok(es.some(e=>e.rubric==='WITHDRAWAL & OFFENSE'));
  assert.ok(es.some(e=>e.rubric==='MATERIAL AID'));
  assert.ok(es.some(e=>e.rubric==='COMMON TARGET'));
});

test('C1: unresolved chronology/result and exceptional Treachery remain conservative',()=>{
  const base={title:'A crown entered the quarrel',primary:{kind:'QUALIFIED_KING_LOSS_TREACHERY'}};
  const args={group:{chronologyQualified:true,resultStatus:'OFFICIAL'},
    context:{familyCounts:{DUEL:40}},identity:base,
    primarySentence:'The alliance had broken.',patternSentence:'The contest returned.',
    sentences:['The alliance had broken.','The contest returned.']};
  assert.deepEqual(composeChronicleC1(args),{title:base.title,sentences:args.sentences});
  const duel={...args,identity:{title:'The contest returned',primary:{
    kind:'ACCEPTED_DUEL_CONTEST',actorLeagueId:'a',targetLeagueId:'b',
    actorName:'Aldric',targetName:'Beren'}}};
  assert.deepEqual(composeChronicleC1({...duel,group:{resultStatus:'UNRESOLVED'}}),
    {title:duel.identity.title,sentences:duel.sentences});
  assert.deepEqual(composeChronicleC1({...duel,group:{chronologyQualified:false}}),
    {title:duel.identity.title,sentences:duel.sentences});
});

test('C1: final #125 Battle-result seam gates variation, never a Game-level or unknown status',()=>{
  const base={context:{familyCounts:{DUEL:5}},
    identity:{title:'The contest returned',primary:{kind:'ACCEPTED_DUEL_CONTEST',
      actorLeagueId:'a',targetLeagueId:'b',actorName:'Aldric',targetName:'Beren'}},
    primarySentence:'Aldric and Beren met in an official duel and carried it through to an accepted result.',
    patternSentence:'The contest had found them before.'};
  base.sentences=[base.primarySentence,base.patternSentence];
  const current={result:{qualification:'OFFICIAL',resultRevision:2,winningPlayerIds:['a']},
    chronologyQualified:true};
  const authored=composeChronicleC1({...base,group:current});
  assert.notDeepEqual(authored.sentences,base.sentences,'accepted Battle result permits guarded C1 copy');
  for(const qualification of ['UNRESOLVED','PARTIAL','PENDING','CORRECTING']){
    const held=composeChronicleC1({...base,group:{result:{qualification},chronologyQualified:true}});
    assert.deepEqual(held,{title:base.identity.title,sentences:base.sentences},
      'unknown or nonofficial aggregate Battle result must fail closed: '+qualification);
  }
  assert.deepEqual(composeChronicleC1({...base,group:{chronologyQualified:true}}),
    {title:base.identity.title,sentences:base.sentences},'a Game-only status cannot authorize prose');
  assert.deepEqual(composeChronicleC1({...base,
    group:{result:{qualification:'OFFICIAL'},chronologyQualified:false}}),
    {title:base.identity.title,sentences:base.sentences},'undated chronology cannot earn a callback');
});

test('C1: projected unresolved aggregate Battle leaves the established writer unchanged',()=>{
  const chs=Array.from({length:5},(_,i)=>chapter(i+1,'DEFENCE',{resultStatus:'UNRESOLVED'}));
  const projected=entries(chs);
  assert.ok(projected.every(e=>e.result.qualification==='UNRESOLVED'));
  assert.equal(projected[4].title,'Again to the line',
    'a pending Battle may have a factual episode but earns no C1 editorial upgrade');
});

test('C1: missing resource quantity cannot trigger misleading or ungrammatical aid variant',()=>{
  const group={chronologyQualified:true,resultStatus:'OFFICIAL'};
  const input={group,context:{directedFamilyCounts:{'MATERIAL_AID|a|b':10}},
    identity:{title:'Another hand extended',primary:{
      kind:'MATERIAL_AID_ORDER',actorLeagueId:'a',targetLeagueId:'b',
      actorName:'Aldric',targetName:'Beren',resourceAmounts:{}}},
    primarySentence:'Aldric put into an aid order for Beren.',
    patternSentence:'It was not the first aid order.',
    sentences:['Aldric put into an aid order for Beren.','It was not the first aid order.']};
  assert.deepEqual(composeChronicleC1(input),
    {title:input.identity.title,sentences:input.sentences});
});
