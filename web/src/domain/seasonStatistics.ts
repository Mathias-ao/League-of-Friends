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

const numeric=(id:string,label:string,category:Category,unit:SeasonMetricUnit='number',aggregation:SeasonAggregation='mean',extra:Partial<SeasonMetricDefinition>={}):SeasonMetricDefinition=>({id,label,category,kind:'number',unit,aggregation,eligibility:'all',hint:aggregation==='median'?'Median of one timing observation per Battle':aggregation==='sum'?'Season total':'Battle-weighted mean of Game measurements',...extra});
const category=(id:string,label:string,group:Category,extra:Partial<SeasonMetricDefinition>={}):SeasonMetricDefinition=>({id,label,category:group,kind:'category',unit:'number',aggregation:'mode',eligibility:'all',hint:'Most common result across eligible Battles',...extra});

/** Exact player-facing Season catalogue. Metrics remain measurements, never player grades. */
export const SEASON_METRICS:SeasonMetricDefinition[]=[
  numeric('feudal','Feudal Age','Opening','ms','median',{record:'min',hint:'Median inferred Feudal age-up timing across eligible Battles'}),
  numeric('castle','Castle Age','Opening','ms','median',{record:'min',hint:'Median inferred Castle age-up timing across eligible Battles'}),
  numeric('imperial','Imperial Age','Opening','ms','median',{record:'min',hint:'Median inferred Imperial age-up timing across eligible Battles'}),
  numeric('buildOrderExecution','Build Order Execution','Opening','number','mean',{leader:'max',record:'max',hint:'Average execution score from the versioned Build Order model'}),
  numeric('villagers10','Villager Queue Estimate @10','Opening','number','mean',{leader:'max',record:'max',hint:'Qualified starting Villagers plus net queue requests through 10:00; not completed or surviving Villagers'}),
  category('firstMilitaryUnit','First Military Unit Queued','Opening'),
  numeric('tcIdle','Dark Age TC Idle','Opening','ms','median',{leader:'min',record:'min',hint:'Median reconstructed starting-TC idle workload before Feudal'}),
  numeric('earlyWalls','Walls Before Feudal','Opening','number','mean',{record:'max',allTime:'sum'}),
  numeric('loom','Loom Timing','Opening','ms','median',{record:'min'}),
  numeric('housesBeforeFeudal','Houses Before Feudal','Opening','number','mean',{record:'max',allTime:'sum'}),
  numeric('darkAgeGap','Dark Age Action Gap','Opening','ms','median',{leader:'min',record:'min'}),
  numeric('firstMiningCamp','First Mining Camp','Opening','ms','median',{record:'min'}),
  numeric('firstLumberCamp','First Lumber Camp','Opening','ms','median',{record:'min'}),
  category('wallStyle','Wall Style','Opening'),
  numeric('commands5','Commands @5','Opening','number','mean',{leader:'max',record:'max',allTime:'sum',hint:'Decoded player actions during the first five minutes'}),
  numeric('scouting','Scout Command Coverage @5','Opening','percent','mean',{record:'max',hint:'Buffered starting-scout command-route coverage; not fog-of-war exploration'}),

  numeric('villagerRequests','Villagers Queued','Economy','number','mean',{leader:'max',record:'max',allTime:'sum',hint:'Positive Villager queue requests; not proof every Villager completed'}),
  numeric('villagers20','Villager Queue Estimate @20','Economy','number','mean',{leader:'max',record:'max',hint:'Qualified starting Villagers plus net queue requests through 20:00; not completed or surviving Villagers'}),
  numeric('townCenters','Town Centers','Economy','number','mean',{record:'max',hint:'Qualified starting Town Centers plus observed placement commands'}),
  numeric('secondTC','2nd TC Timing','Economy','ms','median',{record:'min',hint:'Median placement-command timing for the first extra Town Center'}),
  numeric('economyBuildings','Economy Buildings','Economy','number','mean',{record:'max',allTime:'sum',hint:'Economic building placements and supported net requests'}),
  numeric('total','Resources Committed','Economy','number','mean',{record:'max',allTime:'sum',hint:'Base-catalog commitment estimate from replay requests and placements; not resources collected'}),
  numeric('horseCollar','Horse Collar Timing','Economy','ms','median',{record:'min'}),
  numeric('farmsPlaced','Farms Placed','Economy','number','mean',{record:'max',allTime:'sum'}),
  numeric('farmsBeforeCastle','Farms Before Castle','Economy','number','mean',{record:'max',allTime:'sum'}),
  numeric('boarsLured','Boar Interactions ≈','Economy','number','mean',{record:'max',allTime:'sum',hint:'Inferred distinct boar interactions; may undercount incomplete initial-object evidence'}),
  numeric('ecoMilitary20','Eco : Military @20','Economy','ratio','median',{hint:'Median economy-to-military commitment ratio at 20:00'}),
  numeric('economyTechs','Economy Tech Requests','Economy','number','mean',{record:'max',allTime:'sum'}),
  numeric('housesBuilt','House Placements','Economy','number','mean',{record:'max',allTime:'sum'}),
  numeric('marketSales','Market Sales','Economy','number','mean',{record:'max',allTime:'sum'}),
  numeric('marketPurchases','Market Purchases','Economy','number','mean',{record:'max',allTime:'sum'}),
  numeric('tradeUnits','Trade Units Queued','Economy','number','mean',{eligibility:'team',record:'max',allTime:'sum',hint:'Team Battles only · positive trade-unit queue requests'}),
  numeric('tributeSent','Tribute Amount Requested (Outgoing)','Economy','number','mean',{record:'max',allTime:'sum',hint:'Any format, including FFA diplomacy · decoded outgoing tribute-request amounts; delivery, fees and receipt unverified'}),
  numeric('tributeReceived','Tribute Amount Requested (Incoming)','Economy','number','mean',{record:'max',allTime:'sum',hint:'Any format, including FFA diplomacy · decoded incoming tribute-request amounts; receipt not independently verified'}),

  numeric('unitRequests','Military Units Queued','Military','number','mean',{leader:'max',record:'max',allTime:'sum',hint:'Positive military queue requests; not proof every unit completed'}),
  numeric('militaryCommitment','Military Unit Commitment','Military','number','mean',{record:'max',allTime:'sum',hint:'Pinned base-catalog value of positive military unit queues'}),
  numeric('militaryBuildingsCastle','Military Buildings @ Castle','Military','number','mean',{record:'max',allTime:'sum',hint:'Placements observed before the Castle Age click'}),
  numeric('battlesFought','Detected Battles','Military','number','mean',{record:'max',allTime:'sum',hint:'Promoted engagement episodes with opposing command contributors'}),
  numeric('battleTime','Detected Battle Time','Military','ms','mean',{record:'max',allTime:'sum',hint:'Time inside promoted Battle episodes; command-inference context, not engine combat telemetry'}),
  numeric('greatBattles','Detected Great Battles','Military','number','mean',{leader:'max',record:'max',allTime:'sum',hint:'Promoted exceptional multiplayer engagement episodes; Per Battle averages Game counts within each Battle, All-time sums confirmed episode counts'}),
  numeric('raidsOut','Detected Raids Initiated','Military','number','mean',{record:'max',allTime:'sum',hint:'Detected raid episodes; does not assert damage or kills'}),
  numeric('raidsIn','Detected Raids Received','Military','number','mean',{record:'max',allTime:'sum'}),
  numeric('reinforcements','Reinforcements Sent','Military','number','mean',{eligibility:'team',record:'max',allTime:'sum',hint:'Team Battles only · qualified allied military-control evidence'}),
  numeric('cooperation','Cooperative Attacks','Military','number','mean',{eligibility:'team',record:'max',allTime:'sum',hint:'Team Battles only · allied contributors against the same opponent'}),
  numeric('assistsOut','Defensive Assists','Military','number','mean',{eligibility:'team',record:'max',allTime:'sum',hint:'Team Battles only · allied contribution to a Battle inside a defended base'}),
  numeric('castles','Castle Placements','Military','number','mean',{record:'max',allTime:'sum',hint:'Castle placement commands; not confirmed completed buildings'}),
  numeric('firstCastle','First Castle Placement','Military','ms','median',{record:'min',hint:'Median Castle placement-command timing'}),
  numeric('militaryTechs','Military Tech Requests','Military','number','mean',{record:'max',allTime:'sum'}),
  numeric('blacksmith30','Supported Blacksmith Requests @30','Military','number','mean',{record:'max',allTime:'sum'}),
  numeric('army10','Net Queue Commitment @10','Military','number','mean',{record:'max',hint:'Net base-catalog military queue commitment at 10:00'}),
  numeric('army15','Net Queue Commitment @15','Military','number','mean',{record:'max',hint:'Net base-catalog military queue commitment at 15:00'}),
  numeric('army20','Net Queue Commitment @20','Military','number','mean',{record:'max',hint:'Net base-catalog military queue commitment at 20:00'}),

  numeric('mapCoverage','Command Map Coverage','Map Presence','percent','mean',{record:'max',hint:'Share of fixed map cells touched by recorded command coordinates/endpoints'}),
  numeric('enemySide','Opponent-Side Command Presence','Map Presence','percent','mean',{record:'max',hint:'Share of positioned commands closer to a lobby-opponent starting TC than to home; does not prove current hostility'}),
  numeric('contact','Opponent-Base Command Contact','Map Presence','ms','median',{record:'min',hint:'First command coordinate within the qualified enemy-base radius; not fog-of-war visibility'}),
  numeric('forward','Forward Buildings','Map Presence','number','mean',{record:'max',allTime:'sum',hint:'Placements at 65%+ Enemy Progress'}),
  numeric('forwardEco','Forward Eco','Map Presence','number','mean',{record:'max',allTime:'sum',hint:'Economic placements at 65%+ Enemy Progress'}),
  numeric('expansions','Expansion Zones','Map Presence','number','mean',{record:'max',allTime:'sum',hint:'Clusters of qualifying remote economic or territorial placements'}),
  numeric('walls','Wall Tiles','Map Presence','number','mean',{record:'max',allTime:'sum'}),
  numeric('towers','Towers','Map Presence','number','mean',{record:'max',allTime:'sum'}),
  numeric('goldControl','Gold Influence ≈','Map Presence','percent','mean',{record:'max',hint:'Deposit-weighted infrastructure influence; not mined gold or permanent ownership'}),
  numeric('relics','Known Relics Targeted','Map Presence','number','mean',{record:'max',allTime:'sum',hint:'Distinct known initial relics targeted by recorded commands; not pickup, possession or deposit proof'}),
  numeric('firstRelic','First Relic Target Command','Map Presence','ms','median',{record:'min'}),

  numeric('apm','Raw APM','Execution','number','mean',{record:'max',hint:'Decoded ACTION operations per observed replay minute; not an effectiveness score'}),
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
export interface SeasonAggregateValue {value:number|null;text:string|null;sharePercent:number|null;samples:number;eligibleGames:number;models:string[];/** Samples are distinct Battles, never individual Games. */eligibleBattles?:number;observedGames?:number;completeBattles?:number;selectedModel?:string|null;excludedModels?:string[];}

export interface SeasonAggregatePlayer {playerId:string;name:string;games:number;battles:number;values:Record<string,SeasonAggregateValue>;}
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

/**
 * Season read-model: each distinct matchId (Battle) has one vote.
 * Each Battle contributes one representative observation, including one
 * mean for repeatable per-Game counts. A BO3 must not win a typical-performance
 * comparison merely by playing three Games. All-time preserves the actual
 * compatible additive Game totals.
 *
 * A measurement model is a method, not an opportunity/context marker.
 * We never average incompatible model strings. The largest comparable
 * Battle-supported slice remains visible, with the omitted slice disclosed.
 */
export class SeasonStatisticsExperience{
  readonly games:GameStatistics[];
  constructor(games:GameStatistics[]){
    const revisions=new Map<string,GameStatistics>();
    for(const game of games){const key=game.matchId+'/'+game.gameId,previous=revisions.get(key);if(!previous||game.revision>previous.revision)revisions.set(key,game);}
    const hashes=new Set<string>();
    this.games=[...revisions.values()].sort((a,b)=>a.orderAtMs-b.orderAtMs||a.matchId.localeCompare(b.matchId)||a.gameId.localeCompare(b.gameId)).filter(game=>{if(!game.eligible)return false;if(game.sourceHash&&hashes.has(game.sourceHash))return false;if(game.sourceHash)hashes.add(game.sourceHash);return true;});
  }
  get battleCount():number{return new Set(this.games.map(game=>game.matchId)).size;}
  aggregate(mode:SeasonDisplayMode='perBattle'):SeasonAggregatePlayer[]{
    const ids=[...new Set(this.games.flatMap(game=>game.players.map(player=>player.playerId)))];
    return ids.map(playerId=>{
      const pairs=this.games.flatMap(game=>game.players.filter(player=>player.playerId===playerId).map(player=>({game,player:player as SeasonTextPlayer})));
      const values:Record<string,SeasonAggregateValue>={};
      for(const metric of SEASON_METRICS){
        const eligible=pairs.filter(({game,player})=>seasonMetricEligible(metric,game,player));
        const grouped=new Map<string,typeof eligible>();
        for(const pair of eligible)grouped.set(pair.game.matchId,[...(grouped.get(pair.game.matchId)??[]),pair]);
        const observation=(pair:typeof eligible[number]):number|string|null=>{
          if(metric.kind==='category')return pair.player.seasonText?.[metric.id]??null;
          const candidate=pair.player.values[metric.id];
          return typeof candidate==='number'&&Number.isFinite(candidate)?candidate:null;
        };
        const observed=eligible.filter(pair=>observation(pair)!==null&&observation(pair)!=='');
        const modelGroups=new Map<string,{battles:Set<string>;games:number}>();
        for(const pair of observed){
          const model=pair.player.models[metric.id]||'unknown',previous=modelGroups.get(model)??{battles:new Set<string>(),games:0};
          previous.battles.add(pair.game.matchId);previous.games++;modelGroups.set(model,previous);
        }
        const chosen=[...modelGroups].sort((a,b)=>
          Number(a[0]==='unknown')-Number(b[0]==='unknown')||
          b[1].battles.size-a[1].battles.size||b[1].games-a[1].games||a[0].localeCompare(b[0]))[0]?.[0]??null;
        const selected=observed.filter(pair=>(pair.player.models[metric.id]||'unknown')===chosen);
        const modelNames=chosen?[chosen]:[];
        const excludedModels=[...modelGroups.keys()].filter(model=>model!==chosen).sort();
        const byBattle=[...grouped.values()].map(group=>{
          const members=group.filter(pair=>(pair.player.models[metric.id]||'unknown')===chosen&&observation(pair)!==null&&observation(pair)!=='');
          if(!members.length)return null;
          const raw=members.map(observation);
          if(metric.kind==='category')return categoryMode(raw as string[]).text;
          const numbers=raw as number[];
          // Each multi-Game Battle has one representative typical Game value.
          // Historic cumulative counts are handled separately in All-time.
          return metric.aggregation==='median'?median(numbers):numbers.reduce((sum,item)=>sum+item,0)/numbers.length;
        }).filter((value):value is number|string=>value!==null);
        const completeBattles=[...grouped.values()].filter(group=>group.every(pair=>selected.includes(pair))).length;
        let value:number|null=null,text:string|null=null,sharePercent:number|null=null;
        if(metric.kind==='category'){
          const chosenMode=categoryMode(byBattle as string[]);
          text=chosenMode.text;sharePercent=chosenMode.sharePercent;
        }else{
          const numbers=byBattle as number[];
          if(numbers.length){
            if(mode==='allTime'&&(metric.allTime==='sum'||metric.aggregation==='sum'))value=selected.reduce((sum,pair)=>sum+(observation(pair) as number),0);
            else if(metric.aggregation==='median')value=median(numbers);
            else value=numbers.reduce((sum,item)=>sum+item,0)/numbers.length;
          }
        }
        values[metric.id]={value,text,sharePercent,samples:byBattle.length,eligibleGames:eligible.length,eligibleBattles:grouped.size,observedGames:selected.length,completeBattles,models:modelNames,selectedModel:chosen,excludedModels};
      }
      return {playerId,name:pairs.at(-1)?.player.name??playerId,games:pairs.length,battles:new Set(pairs.map(pair=>pair.game.matchId)).size,values};
    }).sort((a,b)=>a.name.localeCompare(b.name));
  }
  /**
   * Qualified peers, NOT a claim of an absolute Season champion.
   * A newcomer, unrelated missing measurement or different ordinary settings
   * never vetoes comparisons between two complete five-Battle peers.
   * Method cohorts are never numerically merged.
   */
  leaderComparison(metricId:string,minimumBattles=5,mode:SeasonDisplayMode='perBattle'):{ids:string[];qualifiedPlayers:number;model:string|null}{
    const metric=seasonMetric(metricId);
    if(!metric?.leader||metric.kind==='category')return {ids:[],qualifiedPlayers:0,model:null};
    const qualified=this.aggregate(mode).filter(row=>{
      const sample=row.values[metricId];
      return sample.value!==null&&sample.selectedModel!==null&&sample.selectedModel!=='unknown'&&
        sample.samples>=minimumBattles&&sample.samples===sample.eligibleBattles&&
        sample.observedGames===sample.eligibleGames&&sample.completeBattles===sample.eligibleBattles;
    });
    const byModel=new Map<string,typeof qualified>();
    for(const row of qualified){const model=row.values[metricId].selectedModel!;byModel.set(model,[...(byModel.get(model)??[]),row]);}
    const cohorts=[...byModel].filter(([,rows])=>rows.length>=2).sort((a,b)=>b[1].length-a[1].length||
      Math.min(...b[1].map(row=>row.values[metricId].samples))-Math.min(...a[1].map(row=>row.values[metricId].samples))||a[0].localeCompare(b[0]));
    if(!cohorts.length)return {ids:[],qualifiedPlayers:0,model:null};
    const [model,rows]=cohorts[0];
    const extreme=(metric.leader==='max'?Math.max:Math.min)(...rows.map(row=>row.values[metricId].value!));
    const ids=rows.every(row=>row.values[metricId].value===extreme)?[]:rows.filter(row=>row.values[metricId].value===extreme).map(row=>row.playerId);
    return {ids,qualifiedPlayers:rows.length,model};
  }
  leaders(metricId:string,minimumBattles=5,mode:SeasonDisplayMode='perBattle'):string[]{
    return this.leaderComparison(metricId,minimumBattles,mode).ids;
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
