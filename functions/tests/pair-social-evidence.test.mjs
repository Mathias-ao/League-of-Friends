import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDiplomacyTimeline} from '../lib/engines/diplomacyTimeline.js';
import {PAIR_SOCIAL_EVIDENCE_VERSION,buildPairSocialEvidence} from '../lib/engines/pairSocialEvidence.js';

const INITIAL='TEST_INITIAL_V1';
const ACTION='TEST_ACTION_V1';
const STATS='TEST_BATTLE_STATS_V1';

const coverage={
  diplomacy:'QUALIFIED',
  oppositionInteraction:'QUALIFIED',
  alliedCooperation:'QUALIFIED',
  economicTransfer:'QUALIFIED',
  spatialPressure:'QUALIFIED',
  communication:'UNAVAILABLE',
};

function edge(from,to,stance){return {fromPlayerId:from,toPlayerId:to,stance,sourceVersion:INITIAL};}
function change(id,atMs,from,to,rawMode,operationOrdinal){return {eventId:id,atMs,operationOrdinal,fromPlayerId:from,toPlayerId:to,rawMode,rawCommandId:0,sourceVersion:ACTION};}
function timeline({initial=[edge(1,2,'ENEMY'),edge(2,1,'ENEMY')],changes=[]}={}){
  return buildDiplomacyTimeline({playerIds:[1,2,3],durationMs:60_000,initialEdges:[...initial,edge(1,3,'ENEMY'),edge(3,1,'ENEMY'),edge(2,3,'ENEMY'),edge(3,2,'ENEMY')],changes});
}
function observation(id,type,startMs,source=1,target=2,extra={}){
  return {observationId:id,type,startMs,endMs:startMs,sourcePlayerId:source,targetPlayerId:target,units:1,confidence:'HIGH',sourceVersion:STATS,evidenceEventIds:[`ev-${id}`],...extra};
}
function opportunity(id,kind,startMs,endMs){return {opportunityId:id,kind,startMs,endMs,playerOneId:1,playerTwoId:2,sourceVersion:STATS,evidenceEventIds:[`opp-${id}`]};}

function build(extra={}){
  return buildPairSocialEvidence({
    matchId:'M1',playerOneId:1,playerTwoId:2,rosterPlayerIds:[1,2,3],durationMs:60_000,
    diplomacyTimeline:extra.diplomacyTimeline??timeline(),coverage:extra.coverage??coverage,
    observations:extra.observations??[],opportunities:extra.opportunities??[],thirdPartyPressure:extra.thirdPartyPressure??[],
  });
}

test('Pair Social Evidence exposes a versioned neutral contract',()=>{
  assert.equal(PAIR_SOCIAL_EVIDENCE_VERSION,'AOF_PAIR_SOCIAL_EVIDENCE_V1');
  assert.equal(build().schemaVersion,PAIR_SOCIAL_EVIDENCE_VERSION);
});

test('mutual alliance formation is a chronological beat, not a Battle-wide team label',()=>{
  const dip=timeline({changes:[
    change('a-to-b',10_000,1,2,0,10),
    change('b-to-a',20_000,2,1,0,20),
  ]});
  const evidence=build({diplomacyTimeline:dip});
  const formed=evidence.beats.find(beat=>beat.type==='MUTUAL_ALLIANCE_FORMED');
  assert.ok(formed);
  assert.equal(formed.startMs,20_000);
  assert.equal(formed.diplomacy?.pairState,'MUTUAL_ALLIANCE');
  assert.ok(evidence.beats.some(beat=>beat.type==='DIPLOMACY_STANCE_CHANGED'&&beat.startMs===10_000));
});

test('action beats carry the diplomacy state that existed when the evidence occurred',()=>{
  const dip=timeline({changes:[
    change('a-to-b',10_000,1,2,0,10),
    change('b-to-a',12_000,2,1,0,12),
    change('break',30_000,1,2,3,30),
  ]});
  const evidence=build({diplomacyTimeline:dip,observations:[
    observation('support','DEFENSIVE_ASSIST',20_000),
    observation('pressure','RAID_PRESSURE',35_000),
  ]});
  const support=evidence.beats.find(beat=>beat.beatId==='observation:support');
  const pressure=evidence.beats.find(beat=>beat.beatId==='observation:pressure');
  assert.equal(support?.diplomacy?.pairState,'MUTUAL_ALLIANCE');
  assert.equal(pressure?.diplomacy?.pairState,'CONFLICTED');
});

test('allied non-cooperation is emitted only from qualified coverage plus a qualified opportunity',()=>{
  const dip=timeline({initial:[edge(1,2,'ALLY'),edge(2,1,'ALLY')]});
  const evidence=build({diplomacyTimeline:dip,opportunities:[opportunity('help-window','ALLIED_COOPERATION',20_000,30_000)]});
  assert.ok(evidence.beats.some(beat=>beat.type==='NO_QUALIFYING_ALLIED_COOPERATION'));

  const unavailable=build({
    diplomacyTimeline:dip,
    coverage:{...coverage,alliedCooperation:'UNAVAILABLE'},
    opportunities:[opportunity('help-window','ALLIED_COOPERATION',20_000,30_000)],
  });
  assert.ok(!unavailable.beats.some(beat=>beat.type==='NO_QUALIFYING_ALLIED_COOPERATION'));
});

test('real cooperation inside the opportunity suppresses non-cooperation absence',()=>{
  const dip=timeline({initial:[edge(1,2,'ALLY'),edge(2,1,'ALLY')]});
  const evidence=build({
    diplomacyTimeline:dip,
    opportunities:[opportunity('help-window','ALLIED_COOPERATION',20_000,30_000)],
    observations:[observation('reinforce','ALLY_REINFORCEMENT',25_000)],
  });
  assert.ok(evidence.beats.some(beat=>beat.type==='ALLY_REINFORCEMENT'));
  assert.ok(!evidence.beats.some(beat=>beat.type==='NO_QUALIFYING_ALLIED_COOPERATION'));
});

test('opposition silence also requires an explicit opportunity and qualified interaction coverage',()=>{
  const evidence=build({opportunities:[opportunity('contest-window','OPPOSITION_CONTACT',10_000,20_000)]});
  assert.ok(evidence.beats.some(beat=>beat.type==='NO_QUALIFYING_OPPOSITION_CONTACT'));

  const contacted=build({
    opportunities:[opportunity('contest-window','OPPOSITION_CONTACT',10_000,20_000)],
    observations:[observation('engagement','DIRECT_ENGAGEMENT',15_000)],
  });
  assert.ok(!contacted.beats.some(beat=>beat.type==='NO_QUALIFYING_OPPOSITION_CONTACT'));
});

test('simultaneous pressure on a third player remains coincident pressure and never claims coordination',()=>{
  const evidence=build({thirdPartyPressure:[{
    episodeId:'coalition-looking-window',startMs:40_000,endMs:42_000,playerOneId:1,playerTwoId:2,targetPlayerId:3,
    sourceVersion:STATS,evidenceEventIds:['x','y'],confidence:'HIGH',
  }]});
  const beat=evidence.beats.find(item=>item.type==='COINCIDENT_THIRD_PARTY_PRESSURE');
  assert.ok(beat);
  assert.equal(beat?.thirdPartyPlayerId,3);
  assert.equal(beat?.metadata.coordinationClaimed,false);
});

test('one-sided diplomacy plus tribute stays factual without being promoted to mutual cooperation',()=>{
  const dip=timeline({initial:[edge(1,2,'ALLY'),edge(2,1,'NEUTRAL')]});
  const evidence=build({diplomacyTimeline:dip,observations:[observation('tribute','MATERIAL_SUPPORT',10_000)]});
  const tribute=evidence.beats.find(beat=>beat.type==='MATERIAL_SUPPORT');
  assert.equal(tribute?.diplomacy?.pairState,'ONE_SIDED_ALLIANCE');
  assert.ok(!evidence.beats.some(beat=>beat.type==='MUTUAL_ALLIANCE_FORMED'));
});

test('observations about other pairs do not leak into this pair history',()=>{
  const evidence=build({observations:[observation('other','RAID_PRESSURE',10_000,1,3)]});
  assert.ok(!evidence.beats.some(beat=>beat.beatId==='observation:other'));
});
