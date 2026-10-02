import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDiplomacyTimeline} from '../lib/engines/diplomacyTimeline.js';
import {buildPairSocialEvidence} from '../lib/engines/pairSocialEvidence.js';
import {buildChronicleEvents} from '../lib/engines/chronicleEventEngine.js';
import {CHRONICLE_PHRASES,CHRONICLE_PROHIBITED_UNQUALIFIED_WORDS} from '../lib/engines/chroniclePhraseLibrary.js';
import {CHRONICLE_WRITER_VERSION,writeChronicleHistory} from '../lib/engines/chronicleWriter.js';

const INITIAL='TEST_INITIAL';
const ACTION='TEST_ACTION';
const STATS='TEST_STATS';
const coverage={diplomacy:'QUALIFIED',oppositionInteraction:'QUALIFIED',alliedCooperation:'QUALIFIED',economicTransfer:'QUALIFIED',spatialPressure:'QUALIFIED',communication:'UNAVAILABLE'};
function edge(from,to,stance){return {fromPlayerId:from,toPlayerId:to,stance,sourceVersion:INITIAL};}
function change(id,atMs,from,to,rawMode,operationOrdinal){return {eventId:id,atMs,operationOrdinal,fromPlayerId:from,toPlayerId:to,rawMode,rawCommandId:0,sourceVersion:ACTION};}
function obs(id,type,atMs,source=1,target=2,thirdPartyPlayerId=null){return {observationId:id,type,startMs:atMs,endMs:atMs,sourcePlayerId:source,targetPlayerId:target,thirdPartyPlayerId,units:1,confidence:'HIGH',sourceVersion:STATS,evidenceEventIds:[`ev-${id}`]};}
function battle(id,playedAtMs,{initial=[edge(1,2,'ENEMY'),edge(2,1,'ENEMY')],changes=[],observations=[],thirdPartyPressure=[],transitions=[]}={}){
  const diplomacyTimeline=buildDiplomacyTimeline({playerIds:[1,2,3],durationMs:60_000,initialEdges:[...initial,edge(1,3,'ENEMY'),edge(3,1,'ENEMY'),edge(2,3,'ENEMY'),edge(3,2,'ENEMY')],changes});
  const socialEvidence=buildPairSocialEvidence({matchId:id,playerOneId:1,playerTwoId:2,rosterPlayerIds:[1,2,3],durationMs:60_000,diplomacyTimeline,coverage,observations,thirdPartyPressure});
  return {matchId:id,playedAtMs,socialEvidence,diplomacyTimeline,relationshipTransitions:transitions};
}
function write(battles){
  const ordered=[...battles].sort((a,b)=>a.playedAtMs-b.playedAtMs||a.matchId.localeCompare(b.matchId));
  const evidenceByMatch=new Map(ordered.map(item=>[item.matchId,item.socialEvidence]));
  const events=buildChronicleEvents(ordered);
  return writeChronicleHistory(events.map(event=>({event,socialEvidence:evidenceByMatch.get(event.matchId)})),{1:'D’Karius',2:'Ragnar',3:'Baguette'});
}

test('Chronicle writer and phrase library are explicit versioned production assets',()=>{
  assert.equal(CHRONICLE_WRITER_VERSION,'AOF_CHRONICLE_WRITER_V1');
  assert.ok(CHRONICLE_PHRASES.length>=300,`expected at least 300 curated fragments, found ${CHRONICLE_PHRASES.length}`);
  assert.equal(new Set(CHRONICLE_PHRASES.map(item=>item.id)).size,CHRONICLE_PHRASES.length);
});

test('phrase library excludes unqualified motive and outcome words',()=>{
  const corpus=CHRONICLE_PHRASES.map(item=>item.template.toLowerCase()).join('\n');
  for(const word of CHRONICLE_PROHIBITED_UNQUALIFIED_WORDS){
    assert.ok(!new RegExp(`\\b${word}\\b`,'i').test(corpus),`prohibited unqualified word present: ${word}`);
  }
});

test('third-party pressure phrase family never upgrades coincidence into coordination or planning',()=>{
  const phrases=CHRONICLE_PHRASES.filter(item=>item.group==='ACTION_THIRD_PARTY_PRESSURE');
  assert.ok(phrases.length>=8);
  for(const phrase of phrases){
    assert.ok(!/\b(coordinated|coordination occurred|joint plan|planned together|conspired|conspiracy occurred|coalition attack)\b/i.test(phrase.template),phrase.id);
    assert.ok(/coincid|simultaneous|overlap|separate|same .*window|both .*pressure|no coordination|does not establish|without assigning intent|not conspiracy/i.test(phrase.template),`third-party phrase must encode coincidence rather than cooperation: ${phrase.id}`);
  }
});

test('same evidence and writer version rebuild identical prose',()=>{
  const battles=[battle('M1',100,{observations:[obs('raid','RAID_PRESSURE',20_000)]})];
  const first=write(battles);
  const second=write(battles);
  assert.deepEqual(first,second);
  assert.equal(first[0].writerVersion,CHRONICLE_WRITER_VERSION);
  assert.ok(first[0].fragmentIds.length>=3);
  assert.deepEqual(first[0].sourceEvidenceEventIds,['ev-raid']);
});

test('FFA alliance, rupture and subsequent contest produce evidence-bound narrative',()=>{
  const battles=[battle('M1',100,{changes:[
    change('a-allies',10_000,1,2,0,10),
    change('b-allies',12_000,2,1,0,12),
    change('a-enemy',30_000,1,2,3,30),
  ],observations:[obs('contest','DIRECT_ENGAGEMENT',35_000)]})];
  const [entry]=write(battles);
  assert.equal(entry.significance,'TURNING_POINT');
  assert.match(entry.text,/alliance|aligned/i);
  assert.match(entry.text,/direct|contest|engagement/i);
  assert.ok(!/betray|treacher|revenge|refus/i.test(entry.text));
});

test('one-sided diplomacy is described as asymmetric rather than mutual friendship',()=>{
  const battles=[battle('M1',100,{initial:[edge(1,2,'ALLY'),edge(2,1,'NEUTRAL')],observations:[obs('tribute','MATERIAL_SUPPORT',20_000)]})];
  const [entry]=write(battles);
  assert.ok(!/friendship/i.test(entry.text));
  assert.ok(!/both players marked/i.test(entry.text));
  assert.match(entry.text,/one|asymmetric|allied|alliance|tribute|material/i);
});

test('third-party overlap is narrated as coincident pressure, not a conspiracy claim',()=>{
  const battles=[battle('M1',100,{thirdPartyPressure:[{
    episodeId:'same-target-window',startMs:20_000,endMs:25_000,playerOneId:1,playerTwoId:2,targetPlayerId:3,sourceVersion:STATS,evidenceEventIds:['x','y'],confidence:'HIGH',
  }]})];
  const [entry]=write(battles);
  assert.match(entry.text,/Baguette/);
  assert.ok(/coincid|simultaneous|overlap|separate|same .*window|both .*pressure|no coordination|does not establish|without assigning intent|not conspiracy/i.test(entry.text));
  assert.ok(!/\b(coordinated attack|joint plan|planned together|coalition attack)\b/i.test(entry.text));
});

test('historical callback wording varies across repeated Battles without losing determinism',()=>{
  const battles=[
    battle('M1',100,{observations:[obs('c1','DIRECT_ENGAGEMENT',20_000)]}),
    battle('M2',200,{observations:[obs('c2','DIRECT_ENGAGEMENT',20_000)]}),
    battle('M3',300,{observations:[obs('c3','DIRECT_ENGAGEMENT',20_000)]}),
    battle('M4',400,{observations:[obs('c4','DIRECT_ENGAGEMENT',20_000)]}),
  ];
  const entries=write(battles);
  assert.equal(entries.length,4);
  assert.equal(new Set(entries.map(item=>item.text)).size,4);
  assert.equal(new Set(entries.flatMap(item=>item.fragmentIds)).size,entries.flatMap(item=>item.fragmentIds).length);
});

test('writer binds social evidence by match identity after chronological sorting',()=>{
  const later=battle('M2',200,{observations:[obs('later','DIRECT_ENGAGEMENT',20_000)]});
  const earlier=battle('M1',100,{observations:[obs('earlier','RAID_PRESSURE',20_000)]});
  const entries=write([later,earlier]);
  assert.deepEqual(entries.map(item=>item.matchId),['M1','M2']);
  assert.deepEqual(entries[0].sourceEvidenceEventIds,['ev-earlier']);
  assert.deepEqual(entries[1].sourceEvidenceEventIds,['ev-later']);
});

test('relationship changes are narrated only when supplied by the relationship interpretation layer',()=>{
  const transition={track:'RIVALRY',kind:'ESTABLISHED',beforeStageId:null,afterStageId:'RIVALRY',sourceBeatIds:['observation:contest']};
  const withTransition=write([battle('M1',100,{observations:[obs('contest','DIRECT_ENGAGEMENT',20_000)],transitions:[transition]})])[0];
  assert.match(withTransition.text,/Rivalry/);

  const withoutTransition=write([battle('M2',200,{observations:[obs('contest2','DIRECT_ENGAGEMENT',20_000)]})])[0];
  assert.ok(!/Rivalry became|established Rivalry|Rivalry stage/i.test(withoutTransition.text));
});
