import test from 'node:test';
import assert from 'node:assert/strict';
import {projectStatistics,EXPERIENCE_VERSION} from '../lib/engines/statisticsExperience.js';
import {augmentSeasonShowcase,SEASON_SHOWCASE_VERSION} from '../lib/engines/seasonShowcaseProjection.js';
const metadata={matchId:'m',gameId:'g',seasonId:'s',eventId:null,format:'ONE_V_ONE',contextKey:'standard',orderAtMs:1,revision:1,sourceHash:'sha',eligible:true,exclusionReason:null,affectsSeason:true,affectsLifetime:true,roster:[{playerId:'a'}],mapping:[{replaySlot:1,playerId:'a'}]};
function raw(duration=2000000){return {scope:{observedUntilMs:duration},participants:[{playerId:1,replaySlot:1,opening:{ageUp:{feudal:{ageUpAtMs:500000}}},economy:{villagersBy10Minutes:{count:30},villagersBy20Minutes:{count:60},farmsPlaced:{count:0},housesBuilt:{count:0},resourceCommitment:{resourcesCommitted:{food:50,wood:50,total:100},coverage:{unpricedRequestCommands:0}},ecoMilitaryRatioAt20Minutes:{economyToMilitaryRatio:2,unclassifiedCommitment:0}},military:{militaryUnitsTrained:{count:10},militaryUnitCommitment:{resources:1000,unpricedQueuedUnitAmount:0},composition:{infantry:0,archers:0,cavalry:8,siege:0,monks:0,warships:0,navalSupport:0,otherLandMilitary:0,specialMilitary:0},blacksmithUpgrades:{technologies:[]},armyCommitmentCheckpoints:{at10Minutes:{netQueueResources:100},at15Minutes:{netQueueResources:100},at20Minutes:{netQueueResources:100}},engagements:{battlesFought:0,engagementEvidence:{battles:[]},allyInteractionApplicability:{status:'not_applicable'},defensiveAssistsGiven:5,cooperativeAttacks:5}},mapPresence:{scoutCoverageAt5Minutes:{percent:10,status:'ok'}},execution:{commandsFirstFiveMinutes:{count:50}}}]};}
const project=data=>augmentSeasonShowcase(data,projectStatistics(data,metadata),metadata).players[0];
test('Season cannot restore rejected checkpoints, projected ages or unqualified ally values',()=>{
 const input=raw(240000),before=JSON.stringify(input),p=project(input);
 for(const id of ['commands5','scouting','villagers10','villagers20','army10','army15','army20','blacksmith30','feudal','assistsOut','cooperation'])assert.equal(p.values[id],null,id);
 assert.match(p.unavailable.army10,/ends before/);assert.equal(JSON.stringify(input),before);
});
test('complete zero counts differ from missing evidence; partial pricing never becomes a record',()=>{
 const input=raw();let p=project(input);assert.equal(p.values.farmsPlaced,0);assert.equal(p.values.battleTime,0);assert.equal(p.values.blacksmith30,0);assert.equal(p.values.total,100);assert.equal(p.composition.unknown,2);
 delete input.participants[0].military.engagements.engagementEvidence;
 delete input.participants[0].military.blacksmithUpgrades;
 input.participants[0].economy.resourceCommitment.coverage.unpricedRequestCommands=1;
 input.participants[0].economy.resourceCommitment.byAge={dark:{total:100}};
 input.participants[0].military.militaryUnitCommitment.unpricedQueuedUnitAmount=1;
 input.participants[0].economy.ecoMilitaryRatioAt20Minutes.unclassifiedCommitment=30;
 p=project(input);for(const id of ['battleTime','blacksmith30','total','food','militaryCommitment','ecoMilitary20'])assert.equal(p.values[id],null,id);assert.deepEqual(p.byAge,{});
});
test('short recording boundaries are inclusive and rejected scouting status is retained',()=>{
 let input=raw(600000),p=project(input);assert.equal(p.values.commands5,50);assert.equal(p.values.villagers10,30);assert.equal(p.values.army10,100);assert.equal(p.values.army15,null);
 input.participants[0].mapPresence.scoutCoverageAt5Minutes.status='unavailable';p=project(input);assert.equal(p.values.scouting,null);
});
test('unresolved building IDs expose partial classification rather than zero farms',()=>{
 const input=raw();input.commandEvidence={buildingPlacementsByPlayerAndBuilding:{'1':[{entity:{rawId:9999,resolutionStatus:'unresolved'},commandCount:2}]}};
 const p=project(input);assert.equal(p.values.farmsPlaced,null);assert.equal(p.values.housesBuilt,null);assert.match(p.unavailable.farmsPlaced,/Unresolved building IDs/);assert.equal(input.participants[0].economy.farmsPlaced.count,0);
});
test('missing composition families remain unavailable instead of fabricated zero shares',()=>{
 const input=raw();delete input.participants[0].military.composition.monks;assert.equal(project(input).composition,null);
 assert.equal(EXPERIENCE_VERSION,'AOF_STATISTICS_EXPERIENCE_V3');assert.equal(SEASON_SHOWCASE_VERSION,'AOF_SEASON_SHOWCASE_V2');
});

test('Battle time merges overlapping intervals and rejects missing chronology',()=>{
 const input=raw();input.participants[0].military.engagements.battlesFought=2;
 input.participants[0].military.engagements.engagementEvidence.battles=[{startedAtMs:100,endedAtMs:300,durationMs:200},{startedAtMs:200,endedAtMs:400,durationMs:200}];
 assert.equal(project(input).values.battleTime,300);
 delete input.participants[0].military.engagements.engagementEvidence.battles[1].endedAtMs;assert.equal(project(input).values.battleTime,null);
});

test('unresolved technology IDs prevent complete classified tech-count claims',()=>{
 const input=raw();input.participants[0].military.militaryTechs={count:2,unresolvedDistinctTechnologyIds:[9999]};
 const p=project(input);assert.equal(p.values.militaryTechs,null);assert.equal(p.values.blacksmith30,0,'unrelated unknown tech does not erase the explicit supported Blacksmith-ID count');assert.match(p.unavailable.militaryTechs,/Unresolved research IDs/);
});

test('unqualified ally evidence and out-of-recording episodes cannot generate highlights',()=>{
 const input=raw();input.participants[0].military.engagements.engagementEvidence.defensiveAssistsGiven=[{helperPlayerId:1,defendedPlayerId:1,startedAtMs:10,endedAtMs:20}];
 input.participants[0].military.engagements.raidEvidence={initiatedEpisodes:[{attackerPlayerId:1,victimPlayerId:1,startedAtMs:3000000,endedAtMs:3000010}]};
 const game=projectStatistics(input,metadata);assert.equal(game.episodes.filter(e=>['assist','raid'].includes(e.kind)).length,0);
});

test('unclassified unknown queues cannot establish a complete army; classified fallback remains usable',()=>{
 const input=raw();input.commandEvidence={queueRequestsByPlayerAndUnit:{'1':[{entity:{rawId:9999,resolutionStatus:'unresolved'},commandCount:2}]}};
 let p=project(input);assert.equal(p.values.unitRequests,null);assert.equal(p.composition,null);
 input.participants[0].military.composition.unitRows=[{unit:{rawId:9999},positiveQueueAmount:2}];p=project(input);assert.equal(p.values.unitRequests,10);assert.ok(p.composition);
});
