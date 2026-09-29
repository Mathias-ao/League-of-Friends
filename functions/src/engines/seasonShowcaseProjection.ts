import type {GameStatistics,ProjectionMetadata} from './statisticsExperience.js';

export const SEASON_SHOWCASE_VERSION='AOF_SEASON_SHOWCASE_V1';

type Bag=Record<string,any>;
const object=(value:unknown):Bag=>value&&typeof value==='object'&&!Array.isArray(value)?value as Bag:{};
const array=(value:unknown):Bag[]=>Array.isArray(value)?value.filter(value=>value&&typeof value==='object') as Bag[]:[];
const number=(value:unknown):number|null=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;
const text=(value:unknown):string|null=>typeof value==='string'&&value.trim()?value.trim():null;

function wallStyle(value:unknown):string|null{
  const raw=text(value);
  if(!raw)return null;
  const labels:Record<string,string>={open:'Open',partially_walled:'Partially Walled',fully_walled:'Fully Walled'};
  return labels[raw]??raw.replaceAll('_',' ').replace(/\b\w/g,letter=>letter.toUpperCase());
}

function sumBattleTime(engagements:Bag):number|null{
  const battles=array(engagements.engagementEvidence?.battles);
  if(!battles.length)return 0;
  const durations=battles.map(row=>number(row.durationMs));
  if(durations.some(value=>value===null))return null;
  return (durations as number[]).reduce((sum,value)=>sum+value,0);
}

function blacksmithBy30(military:Bag):number|null{
  const rows=array(military.blacksmithUpgrades?.technologies);
  return rows.filter(row=>{
    const latest=number(row.latestRequestedAtMs??row.researchRequestedAtMs??row.firstRequestedAtMs);
    return latest!==null&&latest<=30*60_000;
  }).length;
}

function checkpoint(military:Bag,key:'at10Minutes'|'at15Minutes'|'at20Minutes'):{value:number|null;reason?:string}{
  const row=object(military.armyCommitmentCheckpoints?.[key]);
  if(Number(row.unpricedUnitAmount??0)>0)return {value:null,reason:'Unpriced military queues prevent a complete commitment value.'};
  if(Number(row.unknownAmountCommands??0)>0)return {value:null,reason:'Unknown queue amounts prevent a complete commitment value.'};
  return {value:number(row.netQueueResources)};
}

/**
 * Adds the complete player-facing Season catalogue to a base Game projection.
 * It never changes the underlying replay models: it only normalizes already
 * qualified Battle outputs into stable Season read-model keys.
 */
export function augmentSeasonShowcase(raw:unknown,game:GameStatistics,metadata:ProjectionMetadata):GameStatistics{
  const data=object(raw);
  const rawParticipants=array(data.participants);
  const bySlot=new Map(rawParticipants.map(row=>[Number(row.replaySlot),row] as const));
  const mapping=new Map(metadata.mapping.map(row=>[row.replaySlot,row.playerId] as const));
  const rawByPlayer=new Map<string,Bag>();
  for(const [slot,row] of bySlot){const playerId=mapping.get(slot);if(playerId)rawByPlayer.set(playerId,row);}

  for(const player of game.players){
    const p=rawByPlayer.get(player.playerId);
    if(!p)continue;
    const economy=object(p.economy),military=object(p.military),engagements=object(military.engagements),mapPresence=object(p.mapPresence),execution=object(p.execution),opening=object(p.opening),buildOrder=object(p.buildOrder);
    const values=player.values as Record<string,number|null>;
    const models=player.models as Record<string,string>;
    const unavailable=player.unavailable as Record<string,string>;
    const set=(id:string,value:unknown,model:string,reason?:string)=>{
      const normalized=number(value);values[id]=normalized;models[id]=model||'unknown';
      if(normalized===null)unavailable[id]=reason??unavailable[id]??'Not observed, inapplicable, or insufficient evidence.';
      else delete unavailable[id];
    };
    const economyModel=String(economy.modelVersion??'unknown');
    const openingModel=String(opening.modelVersion??'unknown');
    const militaryModel=String(military.modelVersion??'unknown');
    const engagementModel=String(engagements.engagementModelVersion??engagements.modelVersion??'unknown');
    const raidModel=String(engagements.modelVersion??militaryModel);
    const mapModel=String(mapPresence.modelVersion??'unknown');
    const executionModel=String(execution.modelVersion??'unknown');
    const resourceModel=String(economy.resourceCommitment?.modelVersion??economyModel);

    set('buildOrderExecution',buildOrder.executionScore,String(buildOrder.ruleVersion??'unknown'));
    set('villagers10',economy.villagersBy10Minutes?.count,economyModel);
    set('tcIdle',economy.tcIdleTimeDarkAge?.valueMs,economyModel);
    set('earlyWalls',opening.wallTilesBeforeFeudal?.count,openingModel);
    set('loom',opening.loomTiming?.atMs,openingModel);
    set('housesBeforeFeudal',opening.housesBeforeFeudal?.count,openingModel);
    set('darkAgeGap',execution.longestActionGapDarkAge?.valueMs,executionModel,execution.longestActionGapDarkAge?.unavailableReason);
    set('firstMiningCamp',economy.firstMiningCamp?.atMs,economyModel);
    set('firstLumberCamp',economy.firstLumberCamp?.atMs,economyModel);
    set('commands5',execution.commandsFirstFiveMinutes?.count,executionModel);
    set('scouting',mapPresence.scoutCoverageAt5Minutes?.percent,mapModel,mapPresence.scoutCoverageAt5Minutes?.status==='ok'?undefined:'Starting-scout command coverage is unavailable.');

    set('villagerRequests',economy.villagersTrained?.count,economyModel);
    set('villagers20',economy.villagersBy20Minutes?.count,economyModel);
    set('townCenters',economy.townCenters?.count,economyModel);
    set('secondTC',economy.firstExtraTownCenterTime?.atMs,economyModel);
    set('economyBuildings',economy.economyBuildings?.totalPlacementOrNetRequestCount,economyModel);
    set('total',economy.resourceCommitment?.resourcesCommitted?.total,resourceModel,Number(economy.resourceCommitment?.coverage?.unpricedRequestCommands??0)>0?'Unpriced requests prevent complete resource commitment.':undefined);
    set('horseCollar',economy.horseCollar?.researchRequestedAtMs,economyModel);
    set('farmsPlaced',economy.farmsPlaced?.count,economyModel);
    set('farmsBeforeCastle',economy.farmsBeforeCastle?.count,economyModel);
    set('boarsLured',economy.boarsTaken?.count,economyModel);
    set('ecoMilitary20',economy.ecoMilitaryRatioAt20Minutes?.economyToMilitaryRatio,String(economy.ecoMilitaryRatioAt20Minutes?.modelVersion??economyModel));
    set('economyTechs',economy.economicTechsResearched?.count,economyModel);
    set('housesBuilt',economy.housesBuilt?.count,economyModel);
    set('marketSales',economy.market?.sales?.count,economyModel);
    set('marketPurchases',economy.market?.purchases?.count,economyModel);
    set('tradeUnits',economy.tradeUnitsTrained?.count,economyModel);
    set('tributeSent',economy.tributeSent?.resourceAmount,economyModel);
    set('tributeReceived',economy.tributeReceived?.resourceAmount,economyModel);

    set('unitRequests',military.militaryUnitsTrained?.count,militaryModel);
    set('militaryBuildingsCastle',military.militaryBuildings?.atCastleClick?.count,militaryModel);
    set('battlesFought',engagements.battlesFought,engagementModel);
    set('battleTime',sumBattleTime(engagements),engagementModel);
    set('greatBattles',engagements.greatBattlesFought,engagementModel);
    set('raidsOut',engagements.raidsInitiated,raidModel);
    set('raidsIn',engagements.raidsAgainstYou,raidModel);
    set('reinforcements',engagements.allyReinforcementsSent,engagementModel);
    set('cooperation',engagements.cooperativeAttacks,engagementModel);
    set('assistsOut',engagements.defensiveAssistsGiven,engagementModel);
    set('castles',military.castles?.count,militaryModel);
    set('firstCastle',military.castles?.firstAtMs,militaryModel);
    set('militaryTechs',military.militaryTechs?.count,militaryModel);
    set('blacksmith30',blacksmithBy30(military),militaryModel);
    for(const [id,key] of [['army10','at10Minutes'],['army15','at15Minutes'],['army20','at20Minutes']] as const){const result=checkpoint(military,key);set(id,result.value,militaryModel,result.reason);}

    set('mapCoverage',mapPresence.commandMapCoverage?.percent,mapModel);
    set('enemySide',mapPresence.enemySideCommandPresence?.percent,mapModel);
    set('forward',mapPresence.forwardBuildings?.count,mapModel);
    set('forwardEco',mapPresence.forwardEco?.count,mapModel);
    set('expansionTCs',mapPresence.expansionTownCenters?.count,mapModel);
    set('contact',mapPresence.enemyBaseContact?.atMs,mapModel);
    set('goldControl',mapPresence.goldControl?.controlSharePercent,mapModel);
    set('relics',mapPresence.relicControl?.uniqueRelicsTouched,mapModel);
    set('firstRelic',mapPresence.firstRelicTouch?.atMs,mapModel);
    set('walls',mapPresence.wallTiles?.totalWallTiles,mapModel);
    set('towers',mapPresence.towers?.count,mapModel);
    set('firstAggression',null,'AOF_FIRST_AGGRESSION_UNQUALIFIED','First Aggression does not yet have a qualified deterministic replay definition.');

    set('apm',execution.apm,executionModel);
    set('firstCommand',execution.firstCommandAtMs,executionModel);
    set('response',execution.raidResponse?.medianSeconds,executionModel);
    set('garrisonsDuringRaids',execution.garrisonsDuringRaids,executionModel);
    set('ecoActionsFights',execution.skirmishContext?.ecoActions,executionModel);
    set('longestInactivity',execution.longestInactivityMs,executionModel);
    set('townBell',execution.townBellUses,executionModel);
    set('backToWork',execution.backToWorkCommands,executionModel);

    (player as any).seasonText={
      firstMilitaryUnit:text(opening.firstMilitaryUnitQueued?.unit?.name),
      wallStyle:wallStyle(opening.wallStyle?.label),
    };
    models.firstMilitaryUnit=openingModel;
    models.wallStyle=openingModel;
    if(!(player as any).seasonText.firstMilitaryUnit)unavailable.firstMilitaryUnit='No military-unit queue request was observed.';
    if(!(player as any).seasonText.wallStyle)unavailable.wallStyle='Wall style could not be classified.';
  }
  return {...game,seasonShowcaseVersion:SEASON_SHOWCASE_VERSION} as GameStatistics;
}
