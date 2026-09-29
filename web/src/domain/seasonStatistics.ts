import type {Category,GameStatistics,PlayerMeasurement} from './statistics';

export type SeasonMetricKind='number'|'category';
export type SeasonMetricUnit='number'|'ms'|'seconds'|'percent'|'ratio';
export type SeasonAggregation='mean'|'median'|'sum'|'mode';
export type SeasonEligibility='all'|'team';
export type SeasonDisplayMode='perBattle'|'allTime';

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
  /** When the archive is switched to All-time, semantically additive rows become totals. */
  allTime?:'sum';
}

const numeric=(id:string,label:string,category:Category,unit:SeasonMetricUnit='number',aggregation:SeasonAggregation='mean',extra:Partial<SeasonMetricDefinition>={}):SeasonMetricDefinition=>({id,label,category,kind:'number',unit,aggregation,eligibility:'all',hint:aggregation==='median'?'Median across eligible Battles':aggregation==='sum'?'Season total':'Average per eligible Battle',...extra});
const category=(id:string,label:string,group:Category,extra:Partial<SeasonMetricDefinition>={}):SeasonMetricDefinition=>({id,label,category:group,kind:'category',unit:'number',aggregation:'mode',eligibility:'all',hint:'Most common result across eligible Battles',...extra});

/** Exact player-facing Season catalogue. Metrics remain measurements, never player grades. */
export const SEASON_METRICS:SeasonMetricDefinition[]=[
  numeric('feudal','Feudal Age','Opening','ms','median',{record:'min',hint:'Median inferred Feudal age-up timing across eligible Battles'}),
  numeric('castle','Castle Age','Opening','ms','median',{record:'min',hint:'Median inferred Castle age-up timing across eligible Battles'}),
  numeric('imperial','Imperial Age','Opening','ms','median',{record:'min',hint:'Median inferred Imperial age-up timing across eligible Battles'}),
  numeric('buildOrderExecution','Build Order Execution','Opening','number','mean',{leader:'max',record:'max',hint:'Average execution score from the versioned Build Order model'}),
  numeric('villagers10','Villagers @10','Opening','number','mean',{leader:'max',record:'max',hint:'Average reconstructed Villager count at 10:00'}),
  category('firstMilitaryUnit','First Military Unit','Opening'),
  numeric('tcIdle','Dark Age TC Idle','Opening','ms','median',{leader:'min',record:'min',hint:'Median reconstructed starting-TC idle workload before Feudal'}),
  numeric('earlyWalls','Walls Before Feudal','Opening','number','mean',{record:'max',allTime:'sum'}),
  numeric('loom','Loom Timing','Opening','ms','median',{record:'min'}),
  numeric('housesBeforeFeudal','Houses Before Feudal','Opening','number','mean',{record:'max',allTime:'sum'}),
  numeric('darkAgeGap','Dark Age Action Gap','Opening','ms','median',{leader:'min',record:'min'}),
  numeric('firstMiningCamp','First Mining Camp','Opening','ms','median',{record:'min'}),
  numeric('firstLumberCamp','First Lumber Camp','Opening','ms','median',{record:'min'}),
  category('wallStyle','Wall Style','Opening'),
  numeric('commands5','Commands @5','Opening','number','mean',{leader:'max',record:'max',allTime:'sum',hint:'Decoded player actions during the first five minutes'}),
  numeric('scouting','Scout Coverage @5','Opening','percent','mean',{record:'max',hint:'Buffered starting-scout command-route coverage; not fog-of-war exploration'}),

  numeric('villagerRequests','Villagers Trained','Economy','number','mean',{leader:'max',record:'max',allTime:'sum',hint:'Positive Villager queue requests; not proof every Villager completed'}),
  numeric('villagers20','Villagers @20','Economy','number','mean',{leader:'max',record:'max',hint:'Average reconstructed Villager count at 20:00'}),
  numeric('townCenters','Town Centers','Economy','number','mean',{record:'max',hint:'Qualified starting Town Centers plus observed placement commands'}),
  numeric('secondTC','2nd TC Timing','Economy','ms','median',{record:'min',hint:'Median placement-command timing for the first extra Town Center'}),
  numeric('economyBuildings','Economy Buildings','Economy','number','mean',{record:'max',allTime:'sum',hint:'Economic building placements and supported net requests'}),
  numeric('total','Resources Committed','Economy','number','mean',{record:'max',allTime:'sum',hint:'Base-catalog commitment estimate from replay requests and placements; not resources collected'}),
  numeric('horseCollar','Horse Collar Timing','Economy','ms','median',{record:'min'}),
  numeric('farmsPlaced','Farms Placed','Economy','number','mean',{record:'max',allTime:'sum'}),
  numeric('farmsBeforeCastle','Farms Before Castle','Economy','number','mean',{record:'max',allTime:'sum'}),
  numeric('boarsLured','Boars Lured','Economy','number','mean',{record:'max',allTime:'sum',hint:'Inferred distinct boar interactions; may undercount incomplete initial-object evidence'}),
  numeric('ecoMilitary20','Eco : Military @20','Economy','ratio','median',{hint:'Median economy-to-military commitment ratio at 20:00'}),
  numeric('economyTechs','Economy Techs','Economy','number','mean',{record:'max',allTime:'sum'}),
  numeric('housesBuilt','Houses Built','Economy','number','mean',{record:'max',allTime:'sum'}),
  numeric('marketSales','Market Sales','Economy','number','mean',{record:'max',allTime:'sum'}),
  numeric('marketPurchases','Market Purchases','Economy','number','mean',{record:'max',allTime:'sum'}),
  numeric('tradeUnits','Trade Units Trained','Economy','number','mean',{eligibility:'team',record:'max',allTime:'sum',hint:'Team Battles only · positive trade-unit queue requests'}),
  numeric('tributeSent','Tribute Sent','Economy','number','mean',{eligibility:'team',record:'max',allTime:'sum',hint:'Team Battles only · decoded resource amount sent'}),
  numeric('tributeReceived','Tribute Received','Economy','number','mean',{eligibility:'team',record:'max',allTime:'sum',hint:'Team Battles only · decoded resource amount received'}),

  numeric('unitRequests','Military Units Trained','Military','number','mean',{leader:'max',record:'max',allTime:'sum',hint:'Positive military queue requests; not proof every unit completed'}),
  numeric('militaryCommitment','Military Unit Commitment','Military','number','mean',{record:'max',allTime:'sum',hint:'Pinned base-catalog value of positive military unit queues'}),
  numeric('militaryBuildingsCastle','Military Buildings @ Castle','Military','number','mean',{record:'max',allTime:'sum',hint:'Placements observed before the Castle Age click'}),
  numeric('battlesFought','Battles Fought','Military','number','mean',{record:'max',allTime:'sum',hint:'Promoted engagement episodes with opposing command contributors'}),
  numeric('battleTime','Battle Time','Military','ms','mean',{record:'max',allTime:'sum',hint:'Time inside promoted Battle episodes; command-inference context, not engine combat telemetry'}),
  numeric('greatBattles','Great Battles','Military','number','sum',{leader:'max',record:'max',hint:'Season total · exceptional multiplayer-only promoted Battles'}),
  numeric('raidsOut','Raids Initiated','Military','number','mean',{record:'max',allTime:'sum',hint:'Detected raid episodes; does not assert damage or kills'}),
  numeric('raidsIn','Raids Received','Military','number','mean',{record:'max',allTime:'sum'}),
  numeric('reinforcements','Reinforcements Sent','Military','number','mean',{eligibility:'team',record:'max',allTime:'sum',hint:'Team Battles only · qualified allied military-control evidence'}),
  numeric('cooperation','Cooperative Attacks','Military','number','mean',{eligibility:'team',record:'max',allTime:'sum',hint:'Team Battles only · allied contributors against the same opponent'}),
  numeric('assistsOut','Defensive Assists','Military','number','mean',{eligibility:'team',record:'max',allTime:'sum',hint:'Team Battles only · allied contribution to a Battle inside a defended base'}),
  numeric('castles','Castles','Military','number','mean',{record:'max',allTime:'sum',hint:'Castle placement commands; not confirmed completed buildings'}),
  numeric('firstCastle','First Castle','Military','ms','median',{record:'min',hint:'Median Castle placement-command timing'}),
  numeric('militaryTechs','Military Techs','Military','number','mean',{record:'max',allTime:'sum'}),
  numeric('blacksmith30','Blacksmith Techs @30','Military','number','mean',{record:'max',allTime:'sum'}),
  numeric('army10','Army Commitment @10','Military','number','mean',{record:'max',hint:'Net base-catalog military queue commitment at 10:00'}),
  numeric('army15','Army Commitment @15','Military','number','mean',{record:'max',hint:'Net base-catalog military queue commitment at 15:00'}),
  numeric('army20','Army Commitment @20','Military','number','mean',{record:'max',hint:'Net base-catalog military queue commitment at 20:00'}),

  numeric('mapCoverage','Command Map Coverage','Map Presence','percent','mean',{record:'max',hint:'Share of fixed map cells touched by recorded command coordinates/endpoints'}),
  numeric('enemySide','Enemy-Side Presence','Map Presence','percent','mean',{record:'max',hint:'Share of positioned commands closer to an opponent starting TC than to home'}),
  numeric('contact','Enemy Base Contact','Map Presence','ms','median',{record:'min',hint:'First command coordinate within the qualified enemy-base radius; not fog-of-war visibility'}),
  numeric('forward','Forward Buildings','Map Presence','number','mean',{record:'max',allTime:'sum',hint:'Placements at 65%+ Enemy Progress'}),
  numeric('forwardEco','Forward Eco','Map Presence','number','mean',{record:'max',allTime:'sum',hint:'Economic placements at 65%+ Enemy Progress'}),
  numeric('expansions','Expansion Zones','Map Presence','number','mean',{record:'max',allTime:'sum',hint:'Clusters of qualifying remote economic or territorial placements'}),
  numeric('walls','Wall Tiles','Map Presence','number','mean',{record:'max',allTime:'sum'}),
  numeric('towers','Towers','Map Presence','number','mean',{record:'max',allTime:'sum'}),
  numeric('goldControl','Gold Control','Map Presence','percent','mean',{record:'max',hint:'Deposit-weighted infrastructure influence; not mined gold or permanent ownership'}),
  numeric('relics','Relics Touched','Map Presence','number','mean',{record:'max',allTime:'sum',hint:'Unique relic-touch inference; not direct monastery deposit proof'}),
  numeric('firstRelic','First Relic Touch','Map Presence','ms','median',{record:'min'}),

  numeric('apm','APM','Execution','number','mean',{record:'max',hint:'Decoded ACTION operations per observed replay minute; not an effectiveness score'}),
  numeric('firstCommand','First Command','Execution','ms','median',{record:'min'}),
  numeric('longestInactivity','Longest Inactivity','Execution','ms','median',{leader:'min',record:'min',hint:'Largest gap between consecutive decoded player actions; replay edges excluded'}),
  numeric('response','Raid Response','Execution','seconds','median',{leader:'min',record:'min',hint:'Median inferred delay from detected raid onset to a qualifying defender control command'}),
  numeric('garrisonsDuringRaids','Garrisons During Raids','Execution','number','mean',{record:'max',allTime:'sum',hint:'Conservative garrison orders inside received raid windows plus a short tail'}),
  numeric('ecoActionsFights','Economy Actions in Battles','Execution','number','mean',{record:'max',allTime:'sum',hint:'Economy-classified actions during detected Skirmish windows; later-produced Villager tasking may undercount'}),
  numeric('townBell','Town Bell','Execution','number','mean',{record:'max',allTime:'sum'}),
  numeric('backToWork','Back to Work','Execution','number','mean',{record:'max',allTime:'sum'}),
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
  aggregate(mode:SeasonDisplayMode='perBattle'):SeasonAggregatePlayer[]{
    const ids=[...new Set(this.games.flatMap(game=>game.players.map(player=>player.playerId)))];
    return ids.map(playerId=>{
      const pairs=this.games.flatMap(game=>game.players.filter(player=>player.playerId===playerId).map(player=>({game,player:player as SeasonTextPlayer})));
      const values:Record<string,SeasonAggregateValue>={};
      for(const metric of SEASON_METRICS){
        const eligible=pairs.filter(({game,player})=>seasonMetricEligible(metric,game,player));
        const models=[...new Set(eligible.map(({player})=>player.models[metric.id]).filter(Boolean))].sort();
        if(metric.kind==='category'){
          const texts=eligible.map(({player})=>player.seasonText?.[metric.id]??null).filter((value):value is string=>!!value);
          const modeValue=categoryMode(texts);
          values[metric.id]={value:null,text:modeValue.text,sharePercent:modeValue.sharePercent,samples:texts.length,eligibleGames:eligible.length,models};
          continue;
        }
        const numbers=eligible.map(({player})=>player.values[metric.id]).filter((value):value is number=>typeof value==='number'&&Number.isFinite(value));
        let value:number|null=null;
        if(numbers.length){
          if(metric.aggregation==='sum'||(mode==='allTime'&&metric.allTime==='sum'))value=numbers.reduce((sum,item)=>sum+item,0);
          else if(metric.aggregation==='median')value=median(numbers);
          else value=numbers.reduce((sum,item)=>sum+item,0)/numbers.length;
        }
        values[metric.id]={value,text:null,sharePercent:null,samples:numbers.length,eligibleGames:eligible.length,models};
      }
      return {playerId,name:pairs.at(-1)?.player.name??playerId,games:pairs.length,values};
    }).sort((a,b)=>a.name.localeCompare(b.name));
  }
  leaders(metricId:string,minimumGames=5,mode:SeasonDisplayMode='perBattle'):string[]{
    const metric=seasonMetric(metricId);if(!metric?.leader||metric.kind==='category')return [];
    const rows=this.aggregate(mode),values=rows.map(row=>row.values[metricId]);
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
  if(metric.unit==='ratio')return value.value.toFixed(2);
  return Number.isInteger(value.value)?String(value.value):value.value.toFixed(1);
}

export function formatSeasonRecord(value:number,metric:SeasonMetricDefinition):string{
  return formatSeasonValue({value,text:null,sharePercent:null,samples:1,eligibleGames:1,models:[]},metric);
}
