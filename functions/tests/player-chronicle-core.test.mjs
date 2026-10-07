import test from 'node:test';
import assert from 'node:assert/strict';
import {projectPlayerChronicle,PLAYER_CHRONICLE_VERSION} from '../lib/engines/playerChronicleCore.js';

const participants=[
  {playerId:1,name:'D’Karius',leaguePlayerId:'a'},
  {playerId:2,name:'Ragnar',leaguePlayerId:'b'},
  {playerId:3,name:'Steve',leaguePlayerId:'c'},
];
const exposure=(context='OPEN_DIPLOMACY',pairPlayerIds=[1,2])=>({pairPlayerIds,context});
const beat=(id,kind,atMs,actorPlayerId=1,targetPlayerId=2,extra={})=>({
  id,kind,moment:{atMs,operationOrdinal:atMs},actorPlayerId,targetPlayerId,sourceEventIds:[id+'-source'],...extra
});
const chapter=(gameIdentity,battleId,order,beats=[],context='OPEN_DIPLOMACY',pairPlayerIds=[1,2])=>({
  gameIdentity,battleId,order,revision:1,accepted:true,playedAtMs:1_700_000_000_000+order*1000,eventId:'event-1',seasonId:'season-1',
  review:{status:'REVIEW_AVAILABLE',participants,exposure:[exposure(context,pairPlayerIds)],chronicle:beats}
});
const history=(contributions=[])=>({
  modelVersion:'AOF_SOCIAL_HISTORY_V1',
  contributions,
  pairs:[{playerIds:['a','b'],tracks:{},exposure:{gameIds:[],battleIds:[],contexts:[],lastOrder:null}}],
  profiles:[],
});
const contribution=(battleId,gameIdentity,track,actorLeagueId='a',counterpartLeagueId='b',family='TEST')=>({
  battleId,gameIdentity,track,actorLeagueId,counterpartLeagueId,family,units:1
});
const prose=result=>result.pages[0].entries.at(-1).paragraphs.join(' ');
const assertPlayerFacing=text=>{
  assert.doesNotMatch(text,/\b\d{1,2}:\d{2}\b/,'Chronicle prose must not expose replay timestamps');
  assert.doesNotMatch(text,/\bqualified\b|source event|coverage|rule version|engine state/i,'Chronicle prose must not sound like an audit log');
  assert.doesNotMatch(text,/became allies|betray(ed|al)|refused|saved|rescued|conspired|successful raid|wanted to|hated/i,'Chronicle prose must not invent motive, outcome or stronger semantics');
};

test('Chronicle V2 groups Games into one Battle story and keeps declarations distinct from alliance',()=>{
  const chapters=[
    chapter('battle-1/g1','battle-1',1,[
      beat('d1','DECLARATION_ESTABLISHED',1000,1,2,{declaration:'ALLY',previousDeclaration:'UNKNOWN'}),
      beat('d2','RECIPROCAL_ALLY_DECLARATIONS',2000,2,1),
    ]),
    chapter('battle-1/g2','battle-1',2,[
      beat('s1','SUPPORT_PARTICIPATION',3000,1,2,{scope:'INFERRED_SUPPORT_COMMAND_PARTICIPATION',supportKind:'REINFORCEMENT_COMMANDS'})
    ]),
    chapter('battle-2/g1','battle-2',3,[]),
  ];
  const result=projectPlayerChronicle({ownerPlayerId:'a',chapters,history:history([
    contribution('battle-1','battle-1/g2','BOND','a','b','PROTECTIVE_PARTICIPATION')
  ]),names:{a:'D’Karius',b:'Ragnar'}});
  assert.equal(result.modelVersion,'AOF_PLAYER_CHRONICLE_V2');
  assert.equal(result.modelVersion,PLAYER_CHRONICLE_VERSION);
  assert.equal(result.pages[0].entries.length,1,'later co-presence alone must not create Chronicle spam');
  const entry=result.pages[0].entries[0],text=entry.paragraphs[0];
  assert.equal(entry.title,'A hand in the defence');
  assert.match(text,/first shared page/i);
  assert.match(text,/reinforcement commands toward Ragnar/i);
  assert.match(text,/orders are certain; what reached the field is not/i);
  assertPlayerFacing(text);
  assert.deepEqual(entry.sourceBeatIds,['d1','d2','s1']);
  assert.equal(entry.relationshipMarks[0].track,'BOND');
  assert.equal(result.policy.relationshipAndReputationStagesAreShadow,true);
});

test('material aid reads as history while preserving the command-versus-delivery boundary',()=>{
  const chapters=[chapter('battle-1/g1','battle-1',1,[
    beat('aid','MATERIAL_AID_ORDER',5000,1,2,{resourceAmounts:{food:0,wood:0,gold:500,stone:0}})
  ],'LOCKED_TEAMMATES')];
  const result=projectPlayerChronicle({ownerPlayerId:'a',chapters,history:history([
    contribution('battle-1','battle-1/g1','BOND','a','b','MATERIAL_ASSISTANCE'),
    contribution('battle-1','battle-1/g1','CHIVALRY','a','b','MATERIAL_ASSISTANCE'),
  ]),names:{a:'D’Karius',b:'Ragnar'}});
  const entry=result.pages[0].entries[0],text=entry.paragraphs[0];
  assert.equal(entry.title,'Aid across the page');
  assert.match(text,/500 gold into an aid order for Ragnar/);
  assert.match(text,/delivery itself is not claimed/);
  assert.doesNotMatch(text,/\bgave\b|\bdelivered\b|\breceived\b/i);
  assertPlayerFacing(text);
  assert.equal(entry.relationshipMarks[0].track,'BOND');
  assert.equal(entry.reputationMarks[0].track,'CHIVALRY');
});

test('post-withdrawal offense becomes dramatic without promoting attempt to success or motive',()=>{
  const chapters=[chapter('battle-1/g1','battle-1',1,[
    beat('unknown','DECLARATION_KNOWLEDGE_INTERRUPTED',1000),
    beat('withdraw','ALLY_DECLARATION_WITHDRAWN',2000,1,2,{declaration:'ENEMY'}),
    beat('offense','OFFENSIVE_ATTEMPT_AFTER_WITHDRAWAL',2500,1,2,{association:'IMMEDIATE',targetFunction:'ECONOMIC_UNIT'})
  ])];
  const result=projectPlayerChronicle({ownerPlayerId:'a',chapters,history:history(),names:{a:'D’Karius',b:'Ragnar'}});
  const entry=result.pages[0].entries[0],text=entry.paragraphs[0];
  assert.equal(entry.title,'The banner did not hold');
  assert.equal(entry.rubric,'WITHDRAWAL & OFFENSE');
  assert.match(text,/withdrew the ally declaration toward Ragnar/);
  assert.match(text,/Soon after.*offensive attempt toward Ragnar's economy/);
  assert.match(text,/No success is claimed/);
  assertPlayerFacing(text);
  assert.deepEqual(entry.evidenceKinds,[
    'DECLARATION_KNOWLEDGE_INTERRUPTED','ALLY_DECLARATION_WITHDRAWN','OFFENSIVE_ATTEMPT_AFTER_WITHDRAWAL'
  ]);
});

test('repeated behaviour is noticed only across distinct earlier Battles, not micro-events or Games',()=>{
  const chapters=[
    chapter('battle-1/g1','battle-1',1,[beat('s1','SUPPORT_PARTICIPATION',1000,1,2,{supportKind:'DEFENSIVE_PARTICIPATION'})],'LOCKED_TEAMMATES'),
    chapter('battle-1/g2','battle-1',2,[beat('s2','SUPPORT_PARTICIPATION',2000,1,2,{supportKind:'DEFENSIVE_PARTICIPATION'})],'LOCKED_TEAMMATES'),
    chapter('battle-2/g1','battle-2',3,[beat('s3','SUPPORT_PARTICIPATION',3000,1,2,{supportKind:'DEFENSIVE_PARTICIPATION'})],'LOCKED_TEAMMATES'),
  ];
  const result=projectPlayerChronicle({ownerPlayerId:'a',chapters,history:history([
    contribution('battle-1','battle-1/g1','BOND','a','b','PROTECTIVE_PARTICIPATION'),
    contribution('battle-2','battle-2/g1','BOND','a','b','PROTECTIVE_PARTICIPATION'),
  ]),names:{a:'D’Karius',b:'Ragnar'}});
  assert.equal(result.pages[0].entries.length,2);
  const second=result.pages[0].entries[1];
  assert.equal(second.title,'Again to the line');
  assert.match(second.paragraphs[0],/not the first Battle/i);
  assert.equal(second.narrativeContext.priorDirectedFamilyCounts['SUPPORT|a|b'],1,'two Games in one Battle count as one prior behaviour episode');
});

test('earlier relationship history colours a deed but future history cannot repaint the past',()=>{
  const chapters=[
    chapter('battle-1/g1','battle-1',1,[beat('duel','ACCEPTED_DUEL_CONTEST',1000,1,2)]),
    chapter('battle-2/g1','battle-2',2,[beat('support','SUPPORT_PARTICIPATION',2000,1,2,{supportKind:'DEFENSIVE_PARTICIPATION'})],'LOCKED_TEAMMATES'),
    chapter('battle-3/g1','battle-3',3,[beat('future','OFFENSIVE_ATTEMPT_AFTER_WITHDRAWAL',3000,1,2,{association:'DELAYED',targetFunction:'ECONOMIC_UNIT'})]),
  ];
  const result=projectPlayerChronicle({ownerPlayerId:'a',chapters,history:history([
    contribution('battle-1','battle-1/g1','RIVALRY','a','b','ACCEPTED_DUEL_CONTEST'),
    contribution('battle-2','battle-2/g1','BOND','a','b','PROTECTIVE_PARTICIPATION'),
    contribution('battle-3','battle-3/g1','HOSTILITY','a','b','DECLARED_BREACH_OFFENSIVE_ATTEMPT'),
  ]),names:{a:'D’Karius',b:'Ragnar'}});
  const support=result.pages[0].entries.find(entry=>entry.battleId==='battle-2');
  assert.equal(support.narrativeContext.priorRelationshipEvidence.RIVALRY,1);
  assert.equal(support.narrativeContext.priorRelationshipEvidence.HOSTILITY,0,'future hostility must not colour an earlier entry');
  assert.doesNotMatch(support.paragraphs[0],/older quarrel|grievance/i);
});

test('prior reputation evidence can reinforce or contradict a directed deed without becoming motive',()=>{
  const chapters=[
    chapter('rep-1/g1','rep-1',1,[], 'LOCKED_TEAMMATES',[1,3]),
    chapter('rep-2/g1','rep-2',2,[], 'LOCKED_TEAMMATES',[1,3]),
    chapter('battle-3/g1','battle-3',3,[beat('support','SUPPORT_PARTICIPATION',3000,1,2,{supportKind:'DEFENSIVE_PARTICIPATION'})],'LOCKED_TEAMMATES'),
  ];
  const supportiveHistory=history([
    contribution('rep-1','rep-1/g1','CHIVALRY','a','c','MATERIAL_ASSISTANCE'),
    contribution('rep-2','rep-2/g1','CHIVALRY','a','c','MATERIAL_ASSISTANCE'),
    contribution('battle-3','battle-3/g1','BOND','a','b','PROTECTIVE_PARTICIPATION'),
  ]);
  const supportive=projectPlayerChronicle({ownerPlayerId:'a',chapters,history:supportiveHistory,names:{a:'D’Karius',b:'Ragnar',c:'Steve'}});
  const text=supportive.pages.find(page=>page.counterpartPlayerId==='b').entries[0].paragraphs[0];
  assert.match(text,/earlier acts of aid already attached to D’Karius's name/);
  assert.doesNotMatch(text,/because|wanted|intended/i);

  const cruelHistory=history([
    contribution('rep-1','rep-1/g1','CRUELTY','a','c','TRUST_BREAK_ECONOMIC_STRIKE'),
    contribution('rep-2','rep-2/g1','CRUELTY','a','c','TRUST_BREAK_ECONOMIC_STRIKE'),
    contribution('battle-3','battle-3/g1','BOND','a','b','PROTECTIVE_PARTICIPATION'),
  ]);
  const contradictory=projectPlayerChronicle({ownerPlayerId:'a',chapters,history:cruelHistory,names:{a:'D’Karius',b:'Ragnar',c:'Steve'}});
  const contraryText=contradictory.pages.find(page=>page.counterpartPlayerId==='b').entries[0].paragraphs[0];
  assert.match(contraryText,/sat strangely beside the harder deeds already attached to D’Karius's name/);
  assert.doesNotMatch(contraryText,/redeemed|regretted|softened|because/i);
});

test('projection remains deterministic under chapter input reordering when historical order is stable',()=>{
  const chapters=[
    chapter('battle-1/g1','battle-1',1,[beat('duel','ACCEPTED_DUEL_CONTEST',60000,1,2)]),
    chapter('battle-2/g1','battle-2',2,[beat('shared','SHARED_PARTICIPATION',25000,1,2,{opponentPlayerId:3})]),
  ];
  const h=history();
  const input={ownerPlayerId:'a',history:h,names:{a:'D’Karius',b:'Ragnar',c:'Steve'}};
  assert.deepEqual(projectPlayerChronicle({...input,chapters}),projectPlayerChronicle({...input,chapters:[...chapters].reverse()}));
});
