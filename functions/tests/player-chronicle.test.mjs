import test from 'node:test';
import assert from 'node:assert/strict';
import {projectPlayerChronicle} from '../lib/engines/playerChronicleCore.js';

const moment=(atMs,operationOrdinal=0)=>({atMs,operationOrdinal});
const participants=[
  {playerId:1,leaguePlayerId:'a',name:'Aldric'},
  {playerId:2,leaguePlayerId:'b',name:'Beren'},
  {playerId:3,leaguePlayerId:'c',name:'Cato'},
];
const baseHistory=(overrides={})=>({
  modelVersion:'AOF_SOCIAL_HISTORY_V1',
  contributions:[],
  pairs:[{playerIds:['a','b'],tracks:{},exposure:{gameIds:[],battleIds:[],contexts:[],lastOrder:null}}],
  profiles:[],
  ...overrides,
});
const chapter=({order=1,battleId='battle-1',gameIdentity='battle-1/game-1',playedAtMs=1000,chronicle=[],exposure=null}={})=>({
  order,battleId,gameIdentity,playedAtMs,eventId:'event-1',seasonId:'season-1',revision:1,accepted:true,
  review:{
    status:'REVIEW_AVAILABLE',
    participants,
    chronicle,
    exposure:exposure??[{pairPlayerIds:[1,2],context:'OPEN_DIPLOMACY'}],
  },
});
const beat=(id,kind,atMs,actorPlayerId,targetPlayerId,extra={})=>({
  id,kind,moment:moment(atMs),actorPlayerId,targetPlayerId,sourceEventIds:[id+'-source'],...extra,
});

test('dynamic diplomacy is narrated as directed declarations, never invented alliance or betrayal',()=>{
  const chapters=[chapter({chronicle:[
    beat('a-ally','DECLARATION_ESTABLISHED',10000,1,2,{previousDeclaration:'UNKNOWN',declaration:'ALLY'}),
    beat('b-ally','DECLARATION_ESTABLISHED',12000,2,1,{previousDeclaration:'UNKNOWN',declaration:'ALLY'}),
    beat('mutual','RECIPROCAL_ALLY_DECLARATIONS',12000,2,1),
    beat('a-withdraw','ALLY_DECLARATION_WITHDRAWN',30000,1,2,{previousDeclaration:'ALLY',declaration:'ENEMY'}),
    beat('a-offense','OFFENSIVE_ATTEMPT_AFTER_WITHDRAWAL',32000,1,2,{association:'IMMEDIATE',targetFunction:'ECONOMIC_UNIT'}),
  ]})];
  const result=projectPlayerChronicle({ownerPlayerId:'a',chapters,history:baseHistory(),names:{a:'Aldric',b:'Beren'}});
  assert.equal(result.pages.length,1);
  assert.equal(result.pages[0].entries.length,1);
  const prose=result.pages[0].entries[0].paragraphs.join(' ');
  assert.match(prose,/open-diplomacy Battle/);
  assert.match(prose,/Aldric marked Beren as ally at 0:10/);
  assert.match(prose,/both players had ally declarations recorded/);
  assert.match(prose,/Aldric withdrew an ally declaration toward Beren at 0:30/);
  assert.match(prose,/qualified offensive attempt/);
  assert.doesNotMatch(prose,/became allies|betray(ed|al)|refused|saved|rescued|conspired|successful raid/i);
});

test('one pair and Battle becomes one coherent entry across Games and later co-presence alone stays unwritten',()=>{
  const chapters=[
    chapter({order:1,gameIdentity:'battle-1/game-1',chronicle:[]}),
    chapter({order:2,gameIdentity:'battle-1/game-2',chronicle:[
      beat('support','SUPPORT_PARTICIPATION',22000,1,2,{scope:'INFERRED_SUPPORT_COMMAND_PARTICIPATION'}),
    ]}),
    chapter({order:3,battleId:'battle-2',gameIdentity:'battle-2/game-1',playedAtMs:2000,chronicle:[]}),
  ];
  const result=projectPlayerChronicle({ownerPlayerId:'a',chapters,history:baseHistory(),names:{a:'Aldric',b:'Beren'}});
  assert.equal(result.pages[0].entries.length,1,'two Games from one Battle must not create duplicate Chronicle entries');
  const entry=result.pages[0].entries[0];
  assert.equal(entry.battleId,'battle-1');
  assert.match(entry.paragraphs[0],/recorded history/);
  assert.match(entry.paragraphs[0],/support-command participation/);
});

test('material aid remains an order in the prose and retains exact qualified resource amounts',()=>{
  const chapters=[chapter({chronicle:[
    beat('aid','MATERIAL_AID_ORDER',45000,1,2,{resourceAmounts:{food:300,wood:0,gold:200,stone:0}}),
  ],exposure:[{pairPlayerIds:[1,2],context:'LOCKED_TEAMMATES'}]})];
  const history=baseHistory({contributions:[
    {battleId:'battle-1',actorLeagueId:'a',counterpartLeagueId:'b',track:'BOND',family:'MATERIAL_ASSISTANCE',units:1},
    {battleId:'battle-1',actorLeagueId:'a',counterpartLeagueId:'b',track:'CHIVALRY',family:'MATERIAL_ASSISTANCE',units:1},
  ]});
  const result=projectPlayerChronicle({ownerPlayerId:'a',chapters,history,names:{a:'Aldric',b:'Beren'}});
  const entry=result.pages[0].entries[0];
  assert.match(entry.paragraphs[0],/300 food, 200 gold/);
  assert.match(entry.paragraphs[0],/instruction, not proof of delivery/);
  assert.equal(entry.relationshipMarks[0].track,'BOND');
  assert.equal(entry.reputationMarks[0].track,'CHIVALRY');
});

test('projection is deterministic under chapter input reordering when historical order is stable',()=>{
  const chapters=[
    chapter({order:1,battleId:'battle-1',gameIdentity:'battle-1/game-1',chronicle:[beat('duel','ACCEPTED_DUEL_CONTEST',60000,1,2)]}),
    chapter({order:2,battleId:'battle-2',gameIdentity:'battle-2/game-1',playedAtMs:2000,chronicle:[
      beat('shared','SHARED_PARTICIPATION',25000,1,2,{opponentPlayerId:3}),
    ]}),
  ];
  const history=baseHistory();
  const input={ownerPlayerId:'a',history,names:{a:'Aldric',b:'Beren',c:'Cato'}};
  assert.deepEqual(projectPlayerChronicle({...input,chapters}),projectPlayerChronicle({...input,chapters:[...chapters].reverse()}));
});
