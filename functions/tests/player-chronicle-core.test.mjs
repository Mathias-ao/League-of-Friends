import test from 'node:test';
import assert from 'node:assert/strict';
import {projectPlayerChronicle,PLAYER_CHRONICLE_VERSION} from '../lib/engines/playerChronicleCore.js';

const participants=[
  {playerId:1,name:'D’Karius',leaguePlayerId:'a'},
  {playerId:2,name:'Ragnar',leaguePlayerId:'b'},
  {playerId:3,name:'Steve',leaguePlayerId:'c'},
];
const exposure=(context='OPEN_DIPLOMACY')=>({pairPlayerIds:[1,2],context});
const beat=(id,kind,atMs,actorPlayerId=1,targetPlayerId=2,extra={})=>({
  id,kind,moment:{atMs,operationOrdinal:atMs},actorPlayerId,targetPlayerId,sourceEventIds:[id+'-source'],...extra
});
const chapter=(gameIdentity,battleId,order,beats=[],context='OPEN_DIPLOMACY')=>({
  gameIdentity,battleId,order,revision:1,accepted:true,playedAtMs:1_700_000_000_000+order*1000,eventId:'event-1',seasonId:'season-1',
  review:{status:'REVIEW_AVAILABLE',participants,exposure:[exposure(context)],chronicle:beats}
});
const history=(contributions=[])=>({
  modelVersion:'AOF_SOCIAL_HISTORY_V1',
  contributions,
  pairs:[{playerIds:['a','b'],tracks:{
    BOND:{battleIds:['battle-1'],directedActors:['a'],units:1,currentStage:1,historicalPeak:1}
  },exposure:{gameIds:['g1','g2'],battleIds:['battle-1'],contexts:['OPEN_DIPLOMACY'],lastOrder:2}}],
  profiles:[{playerId:'a',tracks:{CHIVALRY:{units:1,battleIds:['battle-1'],counterparts:['b'],status:'DEVELOPING'}}}]
});

test('Chronicle groups Games into one Battle story and never promotes declarations to effective alliance',()=>{
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
    {battleId:'battle-1',track:'BOND',actorLeagueId:'a',counterpartLeagueId:'b',family:'PROTECTIVE_PARTICIPATION',units:1}
  ]),names:{a:'D’Karius',b:'Ragnar'}});
  assert.equal(result.modelVersion,PLAYER_CHRONICLE_VERSION);
  assert.equal(result.status,'AVAILABLE');
  assert.equal(result.pages.length,1);
  assert.equal(result.pages[0].entries.length,1,'later co-presence alone must not create Chronicle spam');
  const entry=result.pages[0].entries[0];
  assert.equal(entry.battleId,'battle-1');
  assert.match(entry.paragraphs[0],/marked Ragnar as ally at 0:01/);
  assert.match(entry.paragraphs[0],/both players had ally declarations recorded/);
  assert.match(entry.paragraphs[0],/Reinforcement commands from D’Karius toward Ragnar/);
  assert.match(entry.paragraphs[0],/not their arrival or outcome/);
  assert.doesNotMatch(entry.paragraphs[0],/became allies|formed an alliance/i);
  assert.deepEqual(entry.sourceBeatIds,['d1','d2','s1']);
  assert.equal(entry.relationshipMarks[0].track,'BOND');
  assert.equal(result.pages[0].relationship.shadow,true);
  assert.equal(result.policy.relationshipAndReputationStagesAreShadow,true);
});

test('Chronicle states material aid as an instruction and retains reputation lineage without claiming delivery',()=>{
  const chapters=[chapter('battle-1/g1','battle-1',1,[
    beat('aid','MATERIAL_AID_ORDER',5000,1,2,{resourceAmounts:{food:0,wood:0,gold:500,stone:0}})
  ],'LOCKED_TEAMMATES')];
  const result=projectPlayerChronicle({ownerPlayerId:'a',chapters,history:history([
    {battleId:'battle-1',track:'BOND',actorLeagueId:'a',counterpartLeagueId:'b',family:'MATERIAL_ASSISTANCE',units:1},
    {battleId:'battle-1',track:'CHIVALRY',actorLeagueId:'a',counterpartLeagueId:'b',family:'MATERIAL_ASSISTANCE',units:1},
  ]),names:{a:'D’Karius',b:'Ragnar'}});
  const entry=result.pages[0].entries[0];
  assert.match(entry.paragraphs[0],/500 gold/);
  assert.match(entry.paragraphs[0],/instruction, not proof of delivery/);
  assert.doesNotMatch(entry.paragraphs[0],/gave|delivered|received/i);
  assert.equal(entry.relationshipMarks[0].track,'BOND');
  assert.equal(entry.reputationMarks[0].track,'CHIVALRY');
});

test('Chronicle writes qualified post-withdrawal offense only from the qualified beat and suppresses unknown-state noise',()=>{
  const chapters=[chapter('battle-1/g1','battle-1',1,[
    beat('unknown','DECLARATION_KNOWLEDGE_INTERRUPTED',1000),
    beat('withdraw','ALLY_DECLARATION_WITHDRAWN',2000,1,2,{declaration:'ENEMY'}),
    beat('offense','OFFENSIVE_ATTEMPT_AFTER_WITHDRAWAL',2500,1,2,{association:'IMMEDIATE',targetFunction:'ECONOMIC_UNIT'})
  ])];
  const result=projectPlayerChronicle({ownerPlayerId:'a',chapters,history:history(),names:{a:'D’Karius',b:'Ragnar'}});
  const text=result.pages[0].entries[0].paragraphs[0];
  assert.match(text,/withdrew an ally declaration/);
  assert.equal(result.pages[0].entries[0].title,'An offensive attempt followed the withdrawal');
  assert.equal(result.pages[0].entries[0].rubric,'WITHDRAWAL & OFFENSE');
  assert.match(text,/qualified offensive attempt/);
  assert.match(text,/economic unit/);
  assert.doesNotMatch(text,/knowledge interrupted|betrayed|slaughtered|destroyed/i);
  assert.deepEqual(result.pages[0].entries[0].evidenceKinds,[
    'DECLARATION_KNOWLEDGE_INTERRUPTED','ALLY_DECLARATION_WITHDRAWN','OFFENSIVE_ATTEMPT_AFTER_WITHDRAWAL'
  ]);
});
