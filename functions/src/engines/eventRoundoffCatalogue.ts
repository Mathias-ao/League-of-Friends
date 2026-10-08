export type ShowcaseTier='SPECIAL'|'EXTRAORDINARY'|'EXCEPTIONAL'|'NOTABLE';
export type ShowcaseCategory='Victory'|'History'|'Support'|'Development'|'Army'|'Pressure'|'Economy'|'Territory'|'Execution';
export type ShowcaseEmblem='crown'|'laurel'|'axes'|'shield'|'swords'|'coins'|'castle'|'tower'|'helmet'|'wheat'|'villager'|'settlement'|'banner'|'compass'|'hourglass'|'hand'|'pickaxe';
export type Aggregation='SUM'|'BEST'|'GOLD'|'APM'|'RESPONSES';
export interface MetricRule {
  id:string;title:string;category:ShowcaseCategory;emblem:ShowcaseEmblem;family:string;
  aggregation:Aggregation;thresholds:[number,number,number];unit:string;meaning:string;
  lower?:boolean;teamOnly?:boolean;checkpoint?:number;age?:boolean;
}
/** Editorial guesses approved for V1. No grants or points come from these thresholds. */
export const EVENT_SHOWCASE_METRICS:readonly MetricRule[]=[
  {id:'goldControl',title:'Gold dominion',category:'Territory',emblem:'pickaxe',family:'gold',aggregation:'GOLD',thresholds:[1.2,1.4,1.6],unit:'× equal share',meaning:'Duration-weighted gold influence relative to an equal share in each Game; infrastructure influence, not mined gold or verified ownership.'},
  {id:'raidsOut',title:'Raiding campaign',category:'Pressure',emblem:'axes',family:'raids',aggregation:'SUM',thresholds:[10,20,35],unit:'detected raids',meaning:'Detected raid episodes initiated; not kills, damage or confirmed successful raids.'},
  {id:'battlesFought',title:'Battle-hardened',category:'Army',emblem:'helmet',family:'battle-participation',aggregation:'SUM',thresholds:[16,30,50],unit:'detected Battles',meaning:'Participation in detected Battle episodes; not confirmed Battle victories.'},
  {id:'assistsOut',title:'At the defence of allies',category:'Support',emblem:'shield',family:'defence',aggregation:'SUM',thresholds:[3,6,10],unit:'defensive assists',teamOnly:true,meaning:'Detected allied contributions inside a defended base; not confirmed rescues.'},
  {id:'cooperation',title:'A united offensive',category:'Support',emblem:'swords',family:'cooperation',aggregation:'SUM',thresholds:[3,6,10],unit:'cooperative attacks',teamOnly:true,meaning:'Detected episodes of allied contributors attacking the same opponent.'},
  {id:'tributeSent',title:'The alliance supplied',category:'Support',emblem:'coins',family:'tribute',aggregation:'SUM',thresholds:[1000,3000,6000],unit:'resources sent',teamOnly:true,meaning:'Decoded resources sent through tribute in applicable team Games.'},
  {id:'castle',title:'Castle ascent',category:'Development',emblem:'castle',family:'age',aggregation:'BEST',thresholds:[1020000,900000,780000],unit:'',lower:true,age:true,meaning:'Best inferred Castle Age completion in a qualified standard-start Game.'},
  {id:'imperial',title:'Imperial ascent',category:'Development',emblem:'tower',family:'age',aggregation:'BEST',thresholds:[1920000,1680000,1440000],unit:'',lower:true,age:true,meaning:'Best inferred Imperial Age completion in a qualified standard-start Game.'},
  {id:'army20',title:'An army taking shape',category:'Army',emblem:'banner',family:'army',aggregation:'BEST',thresholds:[3000,5000,8000],unit:'resources at 20:00',checkpoint:1200000,meaning:'Best net military queue investment at 20:00, at base catalogue costs; not surviving army value.'},
  {id:'villagers20',title:'An early workforce',category:'Economy',emblem:'villager',family:'workforce',aggregation:'BEST',thresholds:[45,55,65],unit:'queue estimate at 20:00',checkpoint:1200000,meaning:'Best qualified starting-villager count plus net queues through 20:00; not completed or surviving villagers.'},
  {id:'farmsPlaced',title:'The granaries',category:'Economy',emblem:'wheat',family:'farms',aggregation:'SUM',thresholds:[80,140,200],unit:'farm placements',meaning:'Recorded Farm placement commands; not simultaneous working farms.'},
  {id:'villagerRequests',title:'Villager muster',category:'Economy',emblem:'villager',family:'workforce',aggregation:'SUM',thresholds:[160,240,320],unit:'villagers queued',meaning:'Positive Villager queue requests; not completed or surviving villagers.'},
  {id:'townCenters',title:'Expanding realm',category:'Economy',emblem:'settlement',family:'town-centers',aggregation:'SUM',thresholds:[6,9,12],unit:'starting / placed TCs',meaning:'Qualified starting Town Centers plus placement commands, summed across Games; not surviving TCs.'},
  {id:'unitRequests',title:'The military muster',category:'Army',emblem:'helmet',family:'army',aggregation:'SUM',thresholds:[200,400,700],unit:'military units queued',meaning:'Positive military queue requests; not completed or surviving units.'},
  {id:'castles',title:'Castle foundations',category:'Territory',emblem:'castle',family:'fortification',aggregation:'SUM',thresholds:[3,6,10],unit:'Castle placements',meaning:'Recorded Castle placement commands; not completed or surviving Castles.'},
  {id:'forward',title:'Beyond the frontier',category:'Territory',emblem:'banner',family:'fortification',aggregation:'SUM',thresholds:[5,10,16],unit:'forward placements',meaning:'Qualifying building placements at 65% or more progress toward a lobby-opponent base; not completed buildings or current hostile territory.'},
  {id:'expansions',title:'A widening domain',category:'Territory',emblem:'compass',family:'expansion',aggregation:'SUM',thresholds:[5,8,12],unit:'expansion zones',meaning:'Detected clusters of qualifying remote placements, summed across Games; not permanent territorial ownership.'},
  {id:'response',title:'Under pressure',category:'Execution',emblem:'hourglass',family:'response',aggregation:'RESPONSES',thresholds:[12,8,4],unit:'seconds median response ≈',lower:true,meaning:'Pooled median inferred raid-response delay, with at least three qualified responses.'},
  {id:'apm',title:'Relentless command',category:'Execution',emblem:'hand',family:'apm',aggregation:'APM',thresholds:[60,90,120],unit:'raw APM',meaning:'Duration-weighted decoded actions per observed minute across Event Games; not an effectiveness score.'},
];
export interface CatalogueEntry {id:string;accomplishmentId:string;rank:number;tier:ShowcaseTier;title:string;emblem:ShowcaseEmblem;threshold?:number;}
const special:CatalogueEntry[]=[
  {id:'emperor:SPECIAL',accomplishmentId:'emperor',rank:1,tier:'SPECIAL',title:'The Emperor defeated',emblem:'crown'},
  {id:'league-record:EXTRAORDINARY',accomplishmentId:'league-record',rank:2,tier:'EXTRAORDINARY',title:'A league record broken',emblem:'laurel'},
  {id:'greatBattles:EXTRAORDINARY',accomplishmentId:'greatBattles',rank:3,tier:'EXTRAORDINARY',title:'In the great engagements',emblem:'swords',threshold:2},
  {id:'season-record:EXCEPTIONAL',accomplishmentId:'season-record',rank:23,tier:'EXCEPTIONAL',title:'A Season record broken',emblem:'laurel'},
  {id:'greatBattles:EXCEPTIONAL',accomplishmentId:'greatBattles',rank:24,tier:'EXCEPTIONAL',title:'In the great engagement',emblem:'swords',threshold:1},
  {id:'unbeaten:EXCEPTIONAL',accomplishmentId:'unbeaten',rank:25,tier:'EXCEPTIONAL',title:'An unbeaten campaign',emblem:'laurel'},
  {id:'personal-best:NOTABLE',accomplishmentId:'personal-best',rank:45,tier:'NOTABLE',title:'A personal breakthrough',emblem:'laurel'},
];
export const EVENT_SHOWCASE_CATALOGUE:readonly CatalogueEntry[]=[...special,...(['EXTRAORDINARY','EXCEPTIONAL','NOTABLE'] as const).flatMap((tier,t)=>EVENT_SHOWCASE_METRICS.map((m,i)=>({id:`${m.id}:${tier}`,accomplishmentId:m.id,rank:[4,26,46][t]+i,tier,title:m.title,emblem:m.emblem,threshold:m.thresholds[2-t]})))].sort((a,b)=>a.rank-b.rank);
