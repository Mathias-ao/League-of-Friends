import type {Category,GameStatistics,PlayerMeasurement} from './statistics';

export type SeasonMetricKind='number'|'category';
export type SeasonMetricUnit='number'|'ms'|'seconds'|'percent'|'ratio';
export type SeasonAggregation='mean'|'median'|'sum'|'mode';
export type SeasonEligibility='all'|'team';

export interface SeasonMetricDefinition {
  id:string;
  label:string;
  category:Category;
  kind:SeasonMetricKind;
  unit:SeasonMetricUnit;
  aggregation:SeasonAggregation;
  eligibility:SeasonEligibility;
  hint:string;
  leader?:'min'|'max';
  record?:'min'|'max';
}

const numeric=(id:string,label:string,category:Category,unit:SeasonMetricUnit='number',aggregation:SeasonAggregation='mean',extra:Partial<SeasonMetricDefinition>={}):SeasonMetricDefinition=>({id,label,category,kind:'number',unit,aggregation,eligibility:'all',hint:aggregation==='median'?'Median across eligible Games':aggregation==='sum'?'Season total':'Average per eligible Game',...extra});
const category=(id:string,label:string,group:Category,extra:Partial<SeasonMetricDefinition>={}):SeasonMetricDefinition=>({id,label,category:group,kind:'category',unit:'number',aggregation:'mode',eligibility:'all',hint:'Most common result across eligible Games',...extra});

/** Exact player-facing Season catalogue selected for Season I. */
export const SEASON_METRICS:SeasonMetricDefinition[]=[
  numeric('buildOrderExecution','Build Order Execution','Opening','number','mean',{leader:'max',record:'max'}),
  numeric('villagers10','Villagers @10','Opening','number','mean',{leader:'max',record:'max'}),
  category('firstMilitaryUnit','First Military Unit','Opening'),
  numeric('tcIdle','Dark Age TC Idle','Opening','ms','median',{leader:'min',record:'min'}),
  numeric('earlyWalls','Walls Before Feudal','Opening','number','mean',{record:'max'}),
  numeric('loom','Loom Timing','Opening','ms','median',{record:'min'}),
  numeric('housesBeforeFeudal','Houses Before Feudal','Opening','number','mean',{record:'max'}),
  numeric('darkAgeGap','Dark Age Action Gap','Opening','ms','median',{leader:'min',record:'min'}),
  numeric('firstMiningCamp','First Mining Camp','Opening','ms','median',{record:'min'}),
  numeric('firstLumberCamp','First Lumber Camp','Opening','ms','median',{record:'min'}),
  category('wallStyle','Wall Style','Opening'),
  numeric('commands5','Commands @5','Opening','number','mean',{leader:'max',record:'max'}),
  numeric('scouting','Scout Coverage @5','Opening','percent','mean',{record:'max'}),

  numeric('villagerRequests','Villagers Trained','Economy','number','mean',{leader:'max',record:'max'}),
  numeric('villagers20','Villagers @20','Economy','number','mean',{leader:'max',record:'max'}),
  numeric('townCenters','Town Centers','Economy','number','mean',{record:'max'}),
  numeric('secondTC','2nd TC Timing','Economy','ms','median',{record:'min'}),
  numeric('economyBuildings','Economy Buildings','Economy','number','mean',{record:'max'}),
  numeric('total','Resources Committed','Economy','number','mean',{record:'max'}),
  numeric('horseCollar','Horse Collar Timing','Economy','ms','median',{record:'min'}),
  numeric('farmsPlaced','Farms Placed','Economy','number','mean',{record:'max'}),
  numeric('farmsBeforeCastle','Farms Before Castle','Economy','number','mean',{record:'max'}),
  numeric('boarsLured','Boars Lured','Economy','number','mean',{record:'max',hint:'Average boar interactions per eligible Game'}),
  numeric('ecoMilitary20','Eco : Military @20','Economy','ratio','median',{hint:'Median economy-to-military commitment ratio at 20:00'}),
  numeric('economyTechs','Economy Techs','Economy','number','mean',{record:'max'}),
  numeric('housesBuilt','Houses Built','Economy','number','mean',{record:'max'}),
  numeric('marketSales','Market Sales','Economy','number','mean',{record:'max'}),
  numeric('marketPurchases','Market Purchases','Economy','number','mean',{record:'max'}),
  numeric('tradeUnits','Trade Units Trained','Economy','number','mean',{eligibility:'team',record:'max',hint:'Team Games only · average per eligible Game'}),
  numeric('tributeSent','Tribute Sent','Economy','number','mean',{eligibility:'team',record:'max',hint:'Team Games only · average resources sent per eligible Game'}),
  numeric('tributeReceived','Tribute Received','Economy','number','mean',{eligibility:'team',record:'max',hint:'Team Games only · average resources received per eligible Game'}),

  numeric('unitRequests','Military Units Trained','Military','number','mean',{leader:'max',record:'max'}),
  numeric('militaryBuildingsCastle','Military Buildings @ Castle','Military','number','mean',{record:'max',hint:'Average placements before the Castle Age click'}),
  numeric('battlesFought','Battles Fought','Military','number','mean',{record:'max'}),
  numeric('battleTime','Battle Time','Military','ms','mean',{record:'max',hint:'Average promoted-Battle time per eligible Game'}),
  numeric('greatBattles','Great Battles','Military','number','sum',{leader:'max',record:'max',hint:'Season total · the only cumulative Season statistic'}),
  numeric('raidsOut','Raids Initiated','Military','number','mean',{record:'max'}),
  numeric('raidsIn','Raids Received','Military','number','mean',{record:'max'}),
  numeric('reinforcements','Reinforcements Sent','Military','number','mean',{eligibility:'team',record:'max',hint:'Team Games only · average per eligible Game'}),
  numeric('cooperation','Cooperative Attacks','Military','number','mean',{eligibility:'team',record:'max',hint:'Team Games only · average per eligible Game'}),
  numeric('assistsOut','Defensive Assists','Military','number','mean',{eligibility:'team',record:'max',hint:'Team Games only · average per eligible Game'}),
  numeric('castles','Castles','Military','number','mean',{record:'max'}),
  numeric('firstCastle','First Castle','Military','ms','median',{record:'min'}),
  numeric('militaryTechs','Military Techs','Military','number','mean',{record:'max'}),
  numeric('blacksmith30','Blacksmith Techs @30','Military','number','mean',{record:'max'}),
  numeric('army10','Army Commitment @10','Military','number','mean',{record:'max'}),
  numeric('army15','Army Commitment @15','Military','number','mean',{record:'max'}),
  numeric('army20','Army Commitment @20','Military','number','mean',{record:'max'}),

  numeric('mapCoverage','Map Coverage','Map Presence','percent','mean',{record:'max'}),
  numeric('enemySide','Enemy-Side Presence','Map Presence','percent','mean',{record:'max'}),
  numeric('forward','Forward Buildings','Map Presence','number','mean',{record:'max'}),
  numeric('forwardEco','Forward Eco','Map Presence','number','mean',{record:'max'}),
  numeric('expansionTCs','Expansion TCs','Map Presence','number','mean',{record:'max'}),
  numeric('contact','Enemy Base Contact','Map Presence','ms','median',{record:'min'}),
  numeric('goldControl','Gold Control','Map Presence','percent','mean',{record:'max'}),
  numeric('relics','Relics Touched','Map Presence','number','mean',{record:'max'}),
  numeric('firstRelic','First Relic Touch','Map Presence','ms','median',{record:'min'}),
  numeric('walls','Wall Tiles','Map Presence','number','mean',{record:'max'}),
  numeric('towers','Towers','Map Presence','number','mean',{record:'max'}),
  numeric('firstAggression','First Aggression','Map Presence','ms','median',{record:'min',hint:'Awaiting a qualified deterministic replay definition'}),

  numeric('apm','APM','Execution','number','mean',{record:'max'}),
  numeric('firstCommand','First Command','Execution','ms','median',{record:'min'}),
  numeric('response','Raid Response','Execution','seconds','median',{leader:'min',record:'min'}),
  numeric('garrisonsDuringRaids','Garrisons During Raids','Execution','number','mean',{record:'max'}),
  numeric('ecoActionsFights','Eco Actions in Fights','Execution','number','mean',{record:'max',hint:'Average economy-classified actions during detected Skirmish windows'}),
  numeric('longestInactivity','Longest Inactivity','Execution','ms','median',{leader:'min',record:'min'}),
  numeric('townBell','Town Bell','Execution','number','mean',{record:'max'}),
  numeric('backToWork','Back to Work','Execution','number','mean',{record:'max'}),
];

export const SEASON_CATEGORIES=['Opening','Economy','Military','Map Presence','Execution'] as const satisfies readonly Category[];
export const seasonMetric=(id:string)=>SEASON_METRICS.find(metric=>metric.id===id)!;
export const seasonMetricsFor=(category:Category)=>SEASON_METRICS.filter(metric=>metric.category===category);

interface SeasonTextPlayer extends PlayerMeasurement {seasonText?:Record<string,string|null>}
export interface SeasonAggregateValue {value:number|null;text:string|null;sharePercent:number|null;samples:number;eligibleGames:number;models:string[];}
export interface SeasonAggregatePlayer {playerId:string;name:string;games:number;values:Record<string,SeasonAggregateValue>;}
export interface SeasonRecord {metricId:string;value:number;playerId:string;name:string;matchId:string;gameId:string;civilization:string|null;orderAtMs:number;contextKey:string;model:string;}

export function seasonMetricEligible(metric:SeasonMetricDefinition,game:GameStatistics,player:PlayerMeasurement):boolean{
  if(metric.eligibility!=='team')return true;
  if(player.team==null)return false;
  return game.players.some(other=>other.playerId!==player.playerId&&other.team===player.team);
}

function median(values:number[]):number|null{if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;}
function categoryMode(values:string[]):{text:string|null;sharePercent:number|null}{
  if(!values.length)return {text:null,sharePercent:null};
  const counts=new Map<string,number>();for(const value of values)counts.set(value,(counts.get(value)??0)+1);
  const max=Math.max(...counts.values()),modes=[...counts].filter(([,count])=>count===max).map(([value])=>value).sort();
  return {text:modes.join(' / '),sharePercent:100*max/values.length};
}

export class SeasonStatisticsExperience{
  readonly games:GameStatistics[];
  constructor(games:GameStatistics[]){
    const revisions=new Map<string,GameStatistics>();
    for(const game of games){const key=game.matchId+'/'+game.gameId,previous=revisions.get(key);if(!previous||game.revision>previous.revision)revisions.set(key,game);}
    const hashes=new Set<string>();
    this.games=[...revisions.values()].sort((a,b)=>a.orderAtMs-b.orderAtMs||a.matchId.localeCompare(b.matchId)||a.gameId.localeCompare(b.gameId)).filter(game=>{if(!game.eligible)return false;if(game.sourceHash&&hashes.has(game.sourceHash))return false;if(game.sourceHash)hashes.add(game.sourceHash);return true;});
  }
  aggregate():SeasonAggregatePlayer[]{
    const ids=[...new Set(this.games.flatMap(game=>game.players.map(player=>player.playerId)))];
    return ids.map(playerId=>{
      const pairs=this.games.flatMap(game=>game.players.filter(player=>player.playerId===playerId).map(player=>({game,player:player as SeasonTextPlayer})));
      const values:Record<string,SeasonAggregateValue>={};
      for(const metric of SEASON_METRICS){
        const eligible=pairs.filter(({game,player})=>seasonMetricEligible(metric,game,player));
        const models=[...new Set(eligible.map(({player})=>player.models[metric.id]).filter(Boolean))].sort();
        if(metric.kind==='category'){
          const texts=eligible.map(({player})=>player.seasonText?.[metric.id]??null).filter((value):value is string=>!!value);
          const mode=categoryMode(texts);
          values[metric.id]={value:null,text:mode.text,sharePercent:mode.sharePercent,samples:texts.length,eligibleGames:eligible.length,models};
          continue;
        }
        const numbers=eligible.map(({player})=>player.values[metric.id]).filter((value):value is number=>typeof value==='number'&&Number.isFinite(value));
        let value:number|null=null;
        if(numbers.length){if(metric.aggregation==='sum')value=numbers.reduce((sum,item)=>sum+item,0);else if(metric.aggregation==='median')value=median(numbers);else value=numbers.reduce((sum,item)=>sum+item,0)/numbers.length;}
        values[metric.id]={value,text:null,sharePercent:null,samples:numbers.length,eligibleGames:eligible.length,models};
      }
      return {playerId,name:pairs.at(-1)?.player.name??playerId,games:pairs.length,values};
    }).sort((a,b)=>a.name.localeCompare(b.name));
  }
  leaders(metricId:string,minimumGames=5):string[]{
    const metric=seasonMetric(metricId);if(!metric?.leader||metric.kind==='category')return [];
    const rows=this.aggregate(),values=rows.map(row=>row.values[metricId]);
    if(rows.length<2||values.some(value=>value.value===null||value.samples!==value.eligibleGames))return [];
    if(metric.aggregation!=='sum'&&(values.some(value=>value.samples<minimumGames)||new Set(this.games.map(game=>game.contextKey)).size!==1))return [];
    const modelSet=new Set(values.flatMap(value=>value.models));if(modelSet.size!==1||modelSet.has('unknown'))return [];
    const extreme=(metric.leader==='max'?Math.max:Math.min)(...values.map(value=>value.value!));
    if(values.every(value=>value.value===extreme))return [];
    return rows.filter(row=>row.values[metricId].value===extreme).map(row=>row.playerId);
  }
  records():SeasonRecord[]{
    const result=new Map<string,SeasonRecord[]>();
    for(const game of this.games)for(const metric of SEASON_METRICS.filter(metric=>metric.record&&metric.kind==='number'))for(const player of game.players){
      if(!seasonMetricEligible(metric,game,player))continue;
      const value=player.values[metric.id],model=player.models[metric.id];if(value==null||!model||model==='unknown')continue;
      const key=[metric.id,game.contextKey,model].join('|'),previous=result.get(key)??[];
      const record={metricId:metric.id,value,playerId:player.playerId,name:player.name,matchId:game.matchId,gameId:game.gameId,civilization:player.civilization,orderAtMs:game.orderAtMs,contextKey:game.contextKey,model};
      if(!previous.length||(metric.record==='max'?value>previous[0].value:value<previous[0].value))result.set(key,[record]);
      else if(value===previous[0].value&&!previous.some(row=>row.playerId===player.playerId))result.set(key,[...previous,record]);
    }
    return [...result.values()].flat();
  }
}

export function formatSeasonValue(value:SeasonAggregateValue,metric:SeasonMetricDefinition):string{
  if(metric.kind==='category')return value.text?`${value.text}${value.sharePercent==null?'':` · ${value.sharePercent.toFixed(0)}%`}`:'—';
  if(value.value==null)return '—';
  if(metric.unit==='ms'){const seconds=Math.round(value.value/1000);return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;}
  if(metric.unit==='seconds')return value.value.toFixed(1)+'s';
  if(metric.unit==='percent')return value.value.toFixed(1)+'%';
  if(metric.unit==='ratio')return value.value.toFixed(2)+' : 1';
  return new Intl.NumberFormat('en-GB',{maximumFractionDigits:1}).format(value.value);
}

export function formatSeasonRecord(value:number,metric:SeasonMetricDefinition):string{
  return formatSeasonValue({value,text:null,sharePercent:null,samples:1,eligibleGames:1,models:[]},metric);
}
