import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RELATIONSHIP_ENGINE_VERSION,
  deriveRelationshipPulses,
  evaluateRelationship,
  rebuildPairHistory,
} from '../lib/engines/relationshipEngine.js';

const A={playerId:'A',team:1};
const B={playerId:'B',team:2};

function match(id,{allied=false,signals=[],order=1,coverage='AVAILABLE'}={}){
  return {
    matchId:id,
    eventId:'E1',
    seasonId:'S1',
    orderAtMs:order,
    format:'TWO_V_TWO',
    participants:[{...A,team:1},{...B,team:allied?1:2}],
    canonicalResult:{winningPlayerIds:[],revision:1},
    affectsLifetimeStats:true,
    interactionCoverage:coverage,
    signals,
  };
}

function signal(source,target,type,count=1){
  return {sourcePlayerId:source,targetPlayerId:target,type,count,sourceVersion:'TEST_V1'};
}

const ruleSet={
  ruleVersion:'TEST_RELATIONSHIPS_V2',
  establishedBondDamageMultiplier:3,
  pulseRules:[
    {ruleId:'hostile',track:'HOSTILITY',reason:'DIRECTED_HOSTILITY',pointsPerUnit:1},
    {ruleId:'ally-silence',track:'HOSTILITY',reason:'ALLIED_WITHOUT_COOPERATION',pointsPerUnit:1},
    {ruleId:'ally-cooperation-cools',track:'HOSTILITY',reason:'ALLIED_COOPERATION',pointsPerUnit:1},
    {ruleId:'bond-cooperation',track:'BOND',reason:'ALLIED_COOPERATION',pointsPerUnit:1},
    {ruleId:'bond-breach',track:'BOND',reason:'ANTAGONISM_AGAINST_BOND',pointsPerUnit:1},
    {ruleId:'contest',track:'RIVALRY',reason:'DIRECT_CONTEST',pointsPerUnit:1},
  ],
  stages:{
    RIVALRY:[
      {stageId:'R1',minimumPoints:1},
      {stageId:'R2',minimumPoints:2},
      {stageId:'R3',minimumPoints:3,minimumDirectionalPoints:1,minimumReciprocalEncounters:1},
    ],
    HOSTILITY:[
      {stageId:'H1',minimumPoints:1},
      {stageId:'H2',minimumPoints:2},
      {stageId:'H3',minimumPoints:3,minimumDirectionalPoints:1,minimumReciprocalEncounters:1},
    ],
    BOND:[
      {stageId:'B1',minimumPoints:2},
      {stageId:'B2',minimumPoints:4},
      {stageId:'B3',minimumPoints:6,minimumDirectionalPoints:1,minimumReciprocalEncounters:1},
    ],
  },
};

test('Relationship V2 constants identify the successor engine',()=>{
  assert.equal(RELATIONSHIP_ENGINE_VERSION,'AOF_RELATIONSHIP_ENGINE_V2');
});

test('allied assignment without cooperation worsens Hostility rather than cooling it',()=>{
  const [history]=rebuildPairHistory([match('M1',{allied:true})]);
  const pulses=deriveRelationshipPulses(history);
  assert.ok(pulses.some(p=>p.track==='HOSTILITY'&&p.effect==='STRENGTHEN'&&p.reason==='ALLIED_WITHOUT_COOPERATION'));
  assert.ok(!pulses.some(p=>p.track==='HOSTILITY'&&p.effect==='WEAKEN'));
  assert.ok(!pulses.some(p=>p.track==='BOND'&&p.effect==='STRENGTHEN'));
});

test('real allied cooperation cools Hostility and strengthens Bond',()=>{
  const [history]=rebuildPairHistory([match('M1',{
    allied:true,
    signals:[signal('A','B','DEFENSIVE_ASSIST')],
  })]);
  const pulses=deriveRelationshipPulses(history);
  assert.ok(pulses.some(p=>p.track==='HOSTILITY'&&p.effect==='WEAKEN'&&p.reason==='ALLIED_COOPERATION'));
  assert.ok(pulses.some(p=>p.track==='BOND'&&p.effect==='STRENGTHEN'&&p.sourcePlayerId==='A'));
  assert.ok(!pulses.some(p=>p.reason==='ALLIED_WITHOUT_COOPERATION'));
});

test('opponents who have qualified coverage but no pair contact push Rivalry and Hostility dormant',()=>{
  const [history]=rebuildPairHistory([match('M1')]);
  const pulses=deriveRelationshipPulses(history);
  assert.ok(pulses.some(p=>p.track==='RIVALRY'&&p.effect==='DORMANT'));
  assert.ok(pulses.some(p=>p.track==='HOSTILITY'&&p.effect==='DORMANT'));
});

test('missing interaction coverage never invents avoidance or failed cooperation',()=>{
  const [history]=rebuildPairHistory([match('M1',{allied:true,coverage:'UNAVAILABLE'})]);
  assert.equal(history.encounterHistory[0].interactionState,'UNKNOWN_COVERAGE');
  assert.deepEqual(deriveRelationshipPulses(history),[]);
});

test('level three Hostility is blocked until hostile development is reciprocal',()=>{
  const oneSided=[
    match('M1',{order:1,signals:[signal('A','B','RAID')]}),
    match('M2',{order:2,signals:[signal('A','B','RAID')]}),
    match('M3',{order:3,signals:[signal('A','B','RAID')]}),
  ];
  const [oneSidedHistory]=rebuildPairHistory(oneSided);
  const oneSidedProjection=evaluateRelationship(oneSidedHistory,ruleSet);
  assert.equal(oneSidedProjection.hostility.stageId,'H2');
  assert.equal(oneSidedProjection.hostility.directionalPoints.B,0);

  const reciprocal=[...oneSided,match('M4',{order:4,signals:[signal('B','A','RAID')]})];
  const [reciprocalHistory]=rebuildPairHistory(reciprocal);
  const reciprocalProjection=evaluateRelationship(reciprocalHistory,ruleSet);
  assert.equal(reciprocalProjection.hostility.stageId,'H3');
  assert.ok(reciprocalProjection.hostility.directionalPoints.A>0);
  assert.ok(reciprocalProjection.hostility.directionalPoints.B>0);
});

test('shared allied non-cooperation cannot satisfy the level three reciprocity gate',()=>{
  const history=rebuildPairHistory([
    match('M1',{order:1,allied:true}),
    match('M2',{order:2,allied:true}),
    match('M3',{order:3,allied:true}),
  ])[0];
  const projection=evaluateRelationship(history,ruleSet);
  assert.equal(projection.hostility.points,3);
  assert.equal(projection.hostility.stageId,'H2');
  assert.equal(projection.hostility.directionalPoints.A,0);
  assert.equal(projection.hostility.directionalPoints.B,0);
});

test('antagonism hurts an established Bond more than an unestablished one',()=>{
  const history=rebuildPairHistory([
    match('M1',{order:1,allied:true,signals:[
      signal('A','B','DEFENSIVE_ASSIST'),
      signal('B','A','ALLY_REINFORCEMENT'),
    ]}),
    match('M2',{order:2,signals:[signal('A','B','RAID')]}),
  ])[0];
  const projection=evaluateRelationship(history,ruleSet);
  const breach=projection.bond.contributions.find(c=>c.reason==='ANTAGONISM_AGAINST_BOND');
  assert.ok(breach);
  assert.equal(breach.establishedBondMultiplierApplied,3);
  assert.equal(projection.bond.points,0);
});
