import {seasonMetric,seasonMetricEligible,type SeasonMetricDefinition,formatSeasonValue} from './seasonStatistics';
import type {Category,GameStatistics,PlayerMeasurement} from './statistics';

export interface BattleMetricDefinition extends SeasonMetricDefinition {battleHint:string;}
const select=(id:string,battleHint:string):BattleMetricDefinition=>({...seasonMetric(id),battleHint});
/** A compact selection of the Season catalogue; each cell reads exactly one Game. */
const catalogue:Record<Category,BattleMetricDefinition[]>={
  Opening:[
    select('feudal','Inferred Feudal age-up timing.'),
    select('castle','Inferred Castle age-up timing.'),
    select('imperial','Inferred Imperial age-up timing.'),
    select('buildOrderExecution','Execution score for the classified opening.'),
    select('villagers10','Starting Villagers plus net queue requests at 10:00; not surviving Villagers.'),
    select('tcIdle','Reconstructed starting-TC idle workload before Feudal.'),
    select('firstMilitaryUnit','First military unit queue request.'),
    select('loom','Loom research-request timing.')
  ],
  Economy:[
    select('villagerRequests','Positive Villager queue requests; completion is not confirmed.'),
    select('villagers20','Starting Villagers plus net queue requests at 20:00; not surviving Villagers.'),
    select('townCenters','Starting Town Centers plus placement commands; completion is not confirmed.'),
    select('secondTC','Placement-command timing of the first extra Town Center.'),
    select('total','Base-cost commitment from requests and placements; not resources collected.'),
    select('farmsPlaced','Farm placement commands, including repeat placements.'),
    select('horseCollar','Horse Collar research-request timing.'),
    select('ecoMilitary20','Economy-to-military commitment ratio at 20:00.')
  ],
  Military:[
    select('unitRequests','Positive military queue requests; completion is not confirmed.'),
    select('militaryCommitment','Base-cost value of positive military unit queues.'),
    select('battlesFought','Promoted engagement episodes with opposing command contributors.'),
    select('battleTime','Time in promoted Battle episodes inferred from commands.'),
    select('raidsOut','Detected raids initiated; does not establish damage or kills.'),
    select('raidsIn','Detected raids received; does not establish damage or losses.'),
    select('castles','Castle placement commands; completion is not confirmed.'),
    select('militaryTechs','Military research requests; completion is not confirmed.')
  ],
  'Map Presence':[
    select('mapCoverage','Map cells touched by command coordinates; not explored terrain.'),
    select('enemySide','Positioned commands closer to an opponent starting TC than home.'),
    select('contact','First command coordinate within the qualified opponent-base radius.'),
    select('forward','Building placements at 65% or greater progress toward the opponent.'),
    select('expansions','Clusters of remote economic or territorial placements.'),
    select('goldControl','Deposit-weighted infrastructure influence; not mined gold or ownership.'),
    select('relics','Distinct known initial relics targeted; not confirmed possession.'),
    select('walls','Recorded wall placement commands.')
  ],
  Execution:[
    select('apm','Decoded player actions per observed replay minute.'),
    select('firstCommand','First decoded player-action timing.'),
    select('longestInactivity','Largest gap between consecutive player actions; replay edges excluded.'),
    select('response','Median inferred response delay to detected raids.'),
    select('garrisonsDuringRaids','Garrison orders during received raid windows and a short tail.'),
    select('ecoActionsFights','Economy actions during detected Skirmish windows.'),
    select('townBell','Recorded Town Bell commands.'),
    select('backToWork','Recorded Back to Work commands.')
  ]
};
export const BATTLE_CATEGORY_HELP:Record<Category,string>={
  Opening:'Compare the opening: age-up pace, early Villager queues, TC workload and execution of the chosen build.',
  Economy:'Follow growth and investment: Villagers, Town Centers, farms and the balance between economy and army.',
  Military:'Compare production and detected fighting. Team Battles also show assistance and shared attacks.',
  'Map Presence':'See where players applied pressure, expanded and influenced gold. These are command-based measurements.',
  Execution:'Compare activity and reactions under pressure, including economy actions during fighting.'
};
export function battleMetricsFor(category:Category,game:GameStatistics):BattleMetricDefinition[]{
  const metrics=[...catalogue[category]];
  const teamBattle=game.players.some(player=>player.team!=null&&game.players.some(other=>other.playerId!==player.playerId&&other.team===player.team));
  if(category==='Military'&&teamBattle)metrics.splice(6,2,
    select('assistsOut','Allied contribution to a detected Battle inside a defended base.'),
    select('cooperation','Allied command contributors against the same opponent.'));
  return metrics;
}
export function battleMeasurement(game:GameStatistics,player:PlayerMeasurement,metric:BattleMetricDefinition){
  const eligible=seasonMetricEligible(metric,game,player);
  const raw=player.values[metric.id];
  const value=eligible&&typeof raw==='number'&&Number.isFinite(raw)?raw:null;
  const rawText=(player as PlayerMeasurement&{seasonText?:Record<string,string|null>}).seasonText?.[metric.id];
  const text=eligible&&typeof rawText==='string'&&rawText.trim()?rawText:null;
  const unavailable=!eligible?'Requires a same-team ally.':player.unavailable[metric.id]??'Not observed or insufficient recording evidence.';
  return {value,text,unavailable,display:formatSeasonValue({value,text,sharePercent:null,samples:1,eligibleGames:1,models:[]},metric)};
}
