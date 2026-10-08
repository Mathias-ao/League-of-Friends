import type {PlayerMeasurement} from './statisticsExperience.js';

/** Shared final eligibility pass for Battle and Season presentation, including legacy artifacts.
 * Does not rewrite canonical metrics or promote command evidence into engine outcomes. */
export function qualifyStatistics(player:PlayerMeasurement,raw:any,scope:any,commandEvidence:any={}):void {
  const observed=typeof scope?.observedUntilMs==='number'&&Number.isFinite(scope.observedUntilMs)?scope.observedUntilMs:null;
  const reject=(ids:string[],reason:string)=>{for(const id of ids){player.values[id]=null;player.unavailable[id]=reason;}};
  const boundary=(ids:string[],ms:number)=>{if(observed===null||observed<ms)reject(ids,observed===null?'Recording duration is unavailable.':`Recording ends before ${ms/60000}:00; checkpoint unavailable.`);};
  boundary(['commands5','scouting'],300000);
  boundary(['villagers10','army10'],600000);
  boundary(['army15'],900000);
  boundary(['villagers20','ecoMilitary20','army20'],1200000);
  boundary(['blacksmith30'],1800000);
  for(const age of ['feudal','castle','imperial'])if(player.values[age]!=null&&(observed===null||player.values[age]!>observed))reject([age],'Projected age completion is beyond the recording.');
  const economy=raw?.economy??{},military=raw?.military??{},engagements=military.engagements??{};
  const scouting=raw?.mapPresence?.scoutCoverageAt5Minutes;
  if(scouting?.status!=='ok')reject(['scouting'],'Insufficient starting-scout attribution.');
  if(Number(economy.resourceCommitment?.coverage?.unpricedRequestCommands)>0)reject(['food','wood','gold','stone','total'],'Unpriced requests: complete base-cost commitment unavailable.');
  if(Number(military.militaryUnitCommitment?.unpricedQueuedUnitAmount)>0||Number(military.militaryUnitsTrained?.unknownAmountCommands)>0)
    reject(['militaryCommitment'],'Unpriced or unknown queue amounts: complete military commitment unavailable.');
  const ratio=economy.ecoMilitaryRatioAt20Minutes??{};
  if(Number(ratio.unpricedCommandCount)>0||Number(ratio.unclassifiedCommitment)>0)reject(['ecoMilitary20'],'Unpriced or unclassified requests prevent a complete economy-to-military comparison.');
  if(engagements.allyInteractionApplicability?.status!=='applicable')reject(['reinforcements','assistsOut','assistsIn','cooperation'],'No qualified allied interaction context.');
  const battleRows=engagements.engagementEvidence?.battles;
  if(!Array.isArray(battleRows)||player.values.battlesFought==null||battleRows.length!==player.values.battlesFought)
    reject(['battleTime'],'Complete Battle episode evidence is unavailable.');
  const technologies=military.blacksmithUpgrades?.technologies;
  if(!Array.isArray(technologies)||technologies.some((r:any)=>!Number.isFinite(r.latestRequestedAtMs??r.researchRequestedAtMs??r.firstRequestedAtMs)||(r.latestRequestedAtMs??r.researchRequestedAtMs??r.firstRequestedAtMs)<0))
    reject(['blacksmith30'],'Complete Blacksmith request timing evidence is unavailable.');
  const unresolvedBuilds=commandEvidence?.buildingPlacementsByPlayerAndBuilding?.[String(raw?.playerId)];
  if(Array.isArray(unresolvedBuilds)&&unresolvedBuilds.some((r:any)=>r.entity?.resolutionStatus==='unresolved'&&Number(r.commandCount)>0))
    reject(['farmsPlaced','farmsBeforeCastle','economyBuildings','housesBuilt','townCenters','extraTCs','castles','militaryBuildingsCastle','firstCastle','firstMiningCamp','firstLumberCamp','secondTC','thirdTC','forwardEco','expansions','expansionTCs','towers'],'Unresolved building IDs: classified placement totals are partial. Raw placement evidence remains available.');
  const unresolvedResearch=commandEvidence?.researchRequestsByPlayerAndTechnology?.[String(raw?.playerId)];
  if(Number(military.militaryTechs?.unresolvedDistinctTechnologyIds?.length)>0||Array.isArray(unresolvedResearch)&&unresolvedResearch.some((r:any)=>r.entity?.resolutionStatus==='unresolved'&&Number(r.commandCount)>0))
    reject(['militaryTechs','economyTechs'],'Unresolved research IDs: classified technology totals are partial.');
  const queueRows=commandEvidence?.queueRequestsByPlayerAndUnit?.[String(raw?.playerId)];
  const unitRows=Array.isArray(military.composition?.unitRows)?military.composition.unitRows:[];
  const classifiedIds=new Set(unitRows.map((r:any)=>r?.unit?.rawId));
  if(Array.isArray(queueRows)&&queueRows.some((r:any)=>r.entity?.resolutionStatus==='unresolved'&&Number(r.commandCount)>0&&!classifiedIds.has(r.entity?.rawId))){
    reject(['unitRequests','militaryCommitment'],'Unresolved unclassified unit queues: complete military production is unavailable.');
    player.composition=null;player.mainUnit=null;
  }
  // Missing family fields are not proof of zero. Valid unclassified queue remainder stays visible.
  const families=['infantry','archers','cavalry','siege','monks','warships','navalSupport','otherLandMilitary','specialMilitary'];
  if(!military.composition||families.some(id=>typeof military.composition[id]!=='number'||!Number.isFinite(military.composition[id])||military.composition[id]<0))player.composition=null;
  if(player.composition===null)player.mainUnit=null;
  if(player.values.total===null)player.byAge={};
}
