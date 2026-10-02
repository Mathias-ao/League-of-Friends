import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDiplomacyTimeline} from '../lib/engines/diplomacyTimeline.js';
import {buildPairSocialEvidence} from '../lib/engines/pairSocialEvidence.js';
import {CHRONICLE_EVENT_VERSION,buildChronicleEvents,summarizeBattleAlignment} from '../lib/engines/chronicleEventEngine.js';

const INITIAL='TEST_INITIAL';
const ACTION='TEST_ACTION';
const STATS='TEST_STATS';
const coverage={diplomacy:'QUALIFIED',oppositionInteraction:'QUALIFIED',alliedCooperation:'QUALIFIED',economicTransfer:'QUALIFIED',spatialPressure:'QUALIFIED',communication:'UNAVAILABLE'};
function edge(from,to,stance){return {fromPlayerId:from,toPlayerId:to,stance,sourceVersion:INITIAL};}
function change(id,atMs,from,to,rawMode,operationOrdinal){return {eventId:id,atMs,operationOrdinal,fromPlayerId:from,toPlayerId:to,rawMode,rawCommandId:0,sourceVersion:ACTION};}
function obs(id,type,atMs,source=1,target=2){return {observationId:id,type,startMs:atMs,endMs:atMs,sourcePlayerId:source,targetPlayerId:target,units:1,confidence:'HIGH',sourceVersion:STATS,evidenceEventIds:[`ev-${id}`]};}
function makeBattle(id,playedAtMs,{initial=[edge(1,2,'ENEMY'),edge(2,1,'ENEMY')],changes=[],observations=[],opportunities=[],transitions=[]}={}){
  const diplomacyTimeline=buildDiplomacyTimeline({playerIds:[1,2],durationMs:60_000,initialEdges:initial,changes});
  const socialEvidence=buildPairSocialEvidence({matchId:id,playerOneId:1,playerTwoId:2,rosterPlayerIds:[1,2],durationMs:60_000,diplomacyTimeline,coverage,observations,opportunities});
  return {matchId:id,leagueEventId:'E1',seasonId:'S1',playedAtMs,socialEvidence,diplomacyTimeline,relationshipTransitions:transitions};
}

test('Chronicle Event V1 is semantic history rather than prose',()=>{
  const [event]=buildChronicleEvents([makeBattle('M1',1)]);
  assert.equal(event.schemaVersion,CHRONICLE_EVENT_VERSION);
  assert.equal(event.schemaVersion,'AOF_CHRONICLE_EVENT_V1');
  assert.equal(event.encounterNumber,1);
  assert.ok(event.concepts.includes('FIRST_MEETING'));
  assert.equal(typeof event,'object');
  assert.equal('text' in event,false);
});

test('first meaningful pressure becomes a landmark without inventing an outcome',()=>{
  const [event]=buildChronicleEvents([makeBattle('M1',1,{observations:[obs('raid','RAID_PRESSURE',20_000)]})]);
  assert.equal(event.significance,'LANDMARK');
  assert.equal(event.titleKey,'FIRST_MEETING');
  assert.ok(event.concepts.includes('RAID_PRESSURE'));
  assert.ok(event.concepts.includes('FIRST_RECORDED_PRESSURE'));
  assert.deepEqual(event.sourceEvidenceEventIds,['ev-raid']);
});

test('temporary alliance followed by rupture is a turning point',()=>{
  const battle=makeBattle('M1',1,{changes:[
    change('a-allies',10_000,1,2,0,10),
    change('b-allies',12_000,2,1,0,12),
    change('a-breaks',30_000,1,2,3,30),
  ],observations:[obs('contest','DIRECT_ENGAGEMENT',35_000)]});
  const [event]=buildChronicleEvents([battle]);
  assert.equal(event.alignment,'MIXED');
  assert.equal(event.significance,'TURNING_POINT');
  assert.ok(event.concepts.includes('MUTUAL_ALLIANCE_FORMED'));
  assert.ok(event.concepts.includes('MUTUAL_ALLIANCE_ENDED'));
  assert.ok(event.concepts.includes('DIRECT_CONTEST'));
});

test('history callbacks are based on earlier Battles, not the current Battle alone',()=>{
  const first=makeBattle('M1',100,{initial:[edge(1,2,'ALLY'),edge(2,1,'ALLY')],observations:[obs('assist','DEFENSIVE_ASSIST',20_000)]});
  const second=makeBattle('M2',200,{observations:[obs('contest','DIRECT_ENGAGEMENT',20_000)]});
  const events=buildChronicleEvents([second,first]);
  assert.equal(events[0].alignment,'ALLIANCE');
  assert.equal(events[1].alignment,'HOSTILITY');
  assert.ok(events[1].concepts.includes('PREVIOUS_MEETING_ALLIED'));
  assert.equal(events[1].storyFacts.alliedMeetingCountBefore,1);
});

test('relationship transitions elevate significance but remain externally supplied interpretations',()=>{
  const transition={track:'RIVALRY',kind:'ESTABLISHED',beforeStageId:null,afterStageId:'RIVALRY',sourceBeatIds:['observation:contest']};
  const [event]=buildChronicleEvents([makeBattle('M1',1,{observations:[obs('contest','DIRECT_ENGAGEMENT',20_000)],transitions:[transition]})]);
  assert.equal(event.significance,'TURNING_POINT');
  assert.equal(event.titleKey,'FIRST_MEETING');
  assert.ok(event.concepts.includes('RELATIONSHIP_ESTABLISHED'));
  assert.deepEqual(event.relationshipTransitions,[transition]);
});

test('quiet opposition remains evidence-backed and lower drama unless history changes',()=>{
  const opportunity={opportunityId:'opposed-window',kind:'OPPOSITION_CONTACT',startMs:10_000,endMs:30_000,playerOneId:1,playerTwoId:2,sourceVersion:STATS,evidenceEventIds:['window']};
  const first=makeBattle('M1',1,{opportunities:[opportunity]});
  const second=makeBattle('M2',2,{opportunities:[opportunity]});
  const events=buildChronicleEvents([first,second]);
  assert.ok(events[0].concepts.includes('NO_QUALIFYING_OPPOSITION_CONTACT'));
  assert.equal(events[1].titleKey,'QUIET_OPPOSITION');
  assert.equal(events[1].significance,'NOTABLE');
});

test('alignment summary refuses to flatten diplomacy reversals',()=>{
  assert.equal(summarizeBattleAlignment(['MUTUAL_HOSTILITY']),'HOSTILITY');
  assert.equal(summarizeBattleAlignment(['MUTUAL_ALLIANCE']),'ALLIANCE');
  assert.equal(summarizeBattleAlignment(['MUTUAL_NEUTRALITY']),'NEUTRALITY');
  assert.equal(summarizeBattleAlignment(['MUTUAL_ALLIANCE','MUTUAL_HOSTILITY']),'MIXED');
  assert.equal(summarizeBattleAlignment(['CONFLICTED']),'MIXED');
  assert.equal(summarizeBattleAlignment(['UNKNOWN']),'UNKNOWN');
});
