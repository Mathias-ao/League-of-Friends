import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeStatisticsExperienceInput} from '../lib/engines/nativeStatisticsReadAdapter.js';
import {projectStatistics} from '../lib/engines/statisticsExperience.js';
import {augmentSeasonShowcase} from '../lib/engines/seasonShowcaseProjection.js';

const participant=(id,skirmish,battle)=>({
  playerId:id,replaySlot:id,displayName:'Player '+id,
  military:{
    militaryUnitsTrained:{count:4},composition:{cavalry:4},engagements:{
      skirmishes:1,battlesFought:1,greatBattlesFought:1,
      allyInteractionApplicability:{status:'not_applicable'},
      engagementEvidence:{
        skirmishes:[skirmish],battles:[battle],greatBattles:[battle],
        allyReinforcementsSent:[],allyReinforcementsReceived:[],
        defensiveAssistsGiven:[],defensiveAssistsReceived:[],cooperativeAttacks:[],
      },
    },
  },
  economy:{resourceCommitment:{coverage:{unpricedRequestCommands:0}}},
});
const build=()=>{
  const skirmish={skirmishId:'s1',startedAtMs:60000,endedAtMs:72000,participantPlayerIds:[1,2],
    sourceEventIds:['op-000001'],directedInteractionEdges:[{fromPlayerId:1,toPlayerId:2}]};
  const battle={battleId:'b1',greatBattle:true,startedAtMs:60000,endedAtMs:72000,participantPlayerIds:[1,2],
    sourceEventIds:['op-000001'],directedInteractionEdges:[{fromPlayerId:1,toPlayerId:2}]};
  const full={scope:{observedUntilMs:180000},participants:[participant(1,skirmish,battle),participant(2,skirmish,battle)],
    pairSocialEvidence:{observations:[{sourceEventId:'op-000001'}]}};
  const direct=structuredClone(full);
  for(const p of direct.participants)delete p.military.engagements.engagementEvidence;
  direct.sharedEpisodeDelivery={
    version:'AOF_DIRECT_SHARED_EPISODES_V1_EXPERIMENTAL',
    producerGroups:{
      skirmishes:[{body:Object.fromEntries(Object.entries(skirmish).filter(([k])=>!['sourceEventIds','directedInteractionEdges'].includes(k)))}],
      battles:[{body:Object.fromEntries(Object.entries(battle).filter(([k])=>!['sourceEventIds','directedInteractionEdges'].includes(k)))}],
      reinforcements:[],defensiveAssists:[],cooperativeAttacks:[],
    },
    playerRefs:direct.participants.map(p=>({playerId:p.playerId,replaySlot:p.replaySlot,groups:{
      skirmishes:['skirmishes/0'],battles:['battles/0'],greatBattles:['battles/0'],
      allyReinforcementsSent:[],allyReinforcementsReceived:[],
      defensiveAssistsGiven:[],defensiveAssistsReceived:[],cooperativeAttacks:[],
    }})),
    sharedEvidence:{},
  };
  return {full,direct};
};
const metadata={
  matchId:'m',gameId:'g',seasonId:'s',eventId:'e',format:'ONE_V_ONE',contextKey:'test',
  orderAtMs:1000,revision:1,sourceHash:'fixture',eligible:true,exclusionReason:null,
  affectsSeason:true,affectsLifetime:true,
  roster:[{playerId:'a',steamName:'A'},{playerId:'b',steamName:'B'}],
  mapping:[{replaySlot:1,playerId:'a'},{replaySlot:2,playerId:'b'}],
};

test('selective native view preserves all projected read-model values and battle time',()=>{
  const {full,direct}=build();
  const before=structuredClone(direct);
  const projected=nativeStatisticsExperienceInput(direct);
  const expected=augmentSeasonShowcase(full,projectStatistics(full,metadata),metadata);
  const actual=augmentSeasonShowcase(projected,projectStatistics(projected,metadata),metadata);
  assert.deepEqual(actual,expected);
  assert.deepEqual(direct,before,'never mutate immutable native statistics');
  assert.equal(projected.participants[0].military.engagements.engagementEvidence.battles[0].battleId,'b1');
  assert.equal(projected.participants[0].military.engagements.engagementEvidence.battles[0].sourceEventIds,undefined,
    'detailed source references are intentionally not hydrated into a compact read model');
});

test('selective view fails closed on identity mismatch, missing evidence and malformed reference',()=>{
  const source=build().direct;
  const corrupt=mutate=>{
    const report=structuredClone(source);
    mutate(report);
    assert.throws(()=>nativeStatisticsExperienceInput(report));
  };
  corrupt(raw=>{raw.sharedEpisodeDelivery.playerRefs[0].playerId=99;});
  corrupt(raw=>{raw.sharedEpisodeDelivery.playerRefs[0].groups.battles=['battles/999'];});
  corrupt(raw=>{raw.sharedEpisodeDelivery.playerRefs[0].groups.skirmishes=['nonsense/0'];});
  corrupt(raw=>{delete raw.sharedEpisodeDelivery.playerRefs[0].groups.greatBattles;});
  corrupt(raw=>{delete raw.sharedEpisodeDelivery.producerGroups.battles;});
  corrupt(raw=>{raw.sharedEpisodeDelivery.version='unapproved';});
  corrupt(raw=>{raw.participants[0].military.engagements.engagementEvidence={};});
});
