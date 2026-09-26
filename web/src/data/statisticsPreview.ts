import {
  FREEHOLDER_TOOLTIP,PLAYER_PERSONALITY_SLIDERS,REPUTATION_ESSENCES,STATISTIC_CATEGORIES,
  type BattleStatisticsPresentation,type EventStatisticsPresentation,type PlayerIdentityPresentation,
  type SeasonStatisticsPresentation,type StatisticCategoryBlock
} from '../domain/statisticsExperience';

function categories(values:Record<string,[string,string][]>,summaries:Partial<Record<string,string>>={}):StatisticCategoryBlock[]{
  return STATISTIC_CATEGORIES.map(category=>({
    category,
    summary:summaries[category],
    values:(values[category]??[]).map(([label,value])=>({label,value}))
  }));
}

export function previewBattleStatistics(playerNames:string[]):BattleStatisticsPresentation{
  const leader=playerNames[0]??'Player';
  const rival=playerNames[1]??'Opponent';
  return {
    highlights:[
      {category:'Opening',eyebrow:'EARLY INTENT',title:`${leader} struck first`,detail:'Military production opened at 10:42 — earliest in this Battle.'},
      {category:'Military',eyebrow:'BATTLE FEAT',title:'The centre became the battlefield',detail:'A Great Battle drew four players into sustained contact.'},
      {category:'Map Presence',eyebrow:'FORWARD PRESSURE',title:`${rival} lived beyond the line`,detail:'42% of qualified infrastructure was established in forward territory.'}
    ],
    categories:categories({
      Opening:[['Build order','Scout Rush'],['Feudal Age','10:18'],['Castle Age','23:41'],['First military unit','10:42'],['First military building','09:31']],
      Economy:[['Villagers @20','54'],['Dark Age TC idle','0:38'],['Eco upgrades by Castle','4'],['First extra TC','24:16'],['Resources committed','18,940']],
      Military:[['Military commitment @20','3,620'],['Army identity','Cavalry · 54%'],['Raids','3 initiated'],['Engagements','7 Skirmishes · 3 Battles'],['Teamplay','2 defensive assists']],
      'Map Presence':[['Scout coverage @5','18.7%'],['Map coverage','36.4%'],['Forward footprint','42%'],['Expansion zones','3'],['Enemy base contact','06:44']],
      Execution:[['Raw APM','47'],['Combat APM','61'],['Economy actions in combat','38'],['Median raid response','0:13']]
    },{
      Opening:'The plan and the first commitments.',Economy:'Growth, investment and economic timing.',Military:'Composition, pressure and engagements.',
      'Map Presence':'Where the player explored, expanded and projected influence.',Execution:'Command activity and multitasking under pressure.'
    })
  };
}

export function previewSeasonStatistics(seasonLabel:string):SeasonStatisticsPresentation{
  return {
    seasonLabel,battlesAnalyzed:12,
    categories:categories({
      Opening:[['Most common opening','Scout Rush · 31%'],['Median Feudal','10:54'],['Median Castle','24:48'],['Early pressure leader','Ragnar']],
      Economy:[['Median Villagers @20','51'],['Median Dark Age TC idle','0:44'],['Economic commitment leader','Lord Baguette'],['Most expansion-minded','Sir Lancelot']],
      Military:[['Most common army family','Cavalry'],['Raid rate leader','Ragnar · 2.4 / Battle'],['Battle participation leader','Steve'],['Great Battles','2']],
      'Map Presence':[['Median Scout Coverage @5','14.8%'],['Map coverage leader','Sir Lancelot'],['Forward footprint leader','Ragnar'],['Relic activity leader','Steve']],
      Execution:[['Median raw APM','39'],['Combat APM leader','Ragnar'],['Fastest raid response','Steve · 0:08'],['Multitasking leader','Lord Baguette']]
    }),
    records:[
      {label:'Fastest Feudal Age',value:'09:44',holder:'Ragnar',provenance:'Battle 07'},
      {label:'Fastest Castle Age',value:'21:58',holder:'Lord Baguette',provenance:'Battle 03'},
      {label:'Highest Scout Coverage @5',value:'24.1%',holder:'Sir Lancelot',provenance:'Battle 09'},
      {label:'Earliest Raid',value:'11:32',holder:'Ragnar',provenance:'Battle 05'},
      {label:'Fastest Raid Response',value:'0:08',holder:'Steve',provenance:'Battle 11'}
    ]
  };
}

export function previewEventStatistics(eventLabel:string):EventStatisticsPresentation{
  return {
    eventLabel,battlesAnalyzed:4,
    distinctions:[
      {category:'Military',eyebrow:'EVENT DISTINCTION',title:'Ragnar set the tempo',detail:'Highest raid rate across the Event.'},
      {category:'Economy',eyebrow:'EVENT DISTINCTION',title:'Lord Baguette built deepest',detail:'Largest median economic commitment through Castle Age.'},
      {category:'Execution',eyebrow:'EVENT DISTINCTION',title:'Steve answered the call',detail:'Fastest median response to incoming raids.'}
    ],
    categories:categories({
      Opening:[['Most common opening','Scout Rush'],['Median Feudal','10:51']],
      Economy:[['Median Villagers @20','52'],['Median resources committed','17,880']],
      Military:[['Raids / Battle','1.8'],['Battles detected','9']],
      'Map Presence':[['Median Scout Coverage @5','15.4%'],['Median Forward Footprint','29%']],
      Execution:[['Median raw APM','41'],['Median raid response','0:16']]
    })
  };
}

const matureProfiles:Record<string,{values:number[];archetype:PlayerIdentityPresentation['reputation']['archetype'];essences:[number,number,number];points:[number,number,number]}>= {
  'sample-ragnar':{values:[78,82,27,31,66],archetype:'Vigilante',essences:[78,24,69],points:[31,9,27]},
  'sample-steve':{values:[44,38,61,72,47],archetype:'Justiciar',essences:[66,73,18],points:[24,28,6]},
  'sample-baguette':{values:[23,31,72,28,35],archetype:'Custodian',essences:[35,76,12],points:[12,29,4]},
  'sample-lancelot':{values:[62,68,48,79,84],archetype:'Monarch',essences:[58,61,55],points:[21,22,20]},
  'sample-mbl':{values:[71,76,19,22,58],archetype:'Tyrant',essences:[31,16,81],points:[10,5,32]}
};

export function previewPlayerIdentity(playerId:string):PlayerIdentityPresentation{
  const mature=matureProfiles[playerId];
  if(!mature){
    return {
      eligibleBattles:2,
      sliders:PLAYER_PERSONALITY_SLIDERS.map(slider=>({id:slider.id,value:null,eligibleBattles:2})),
      reputation:{
        archetype:'Freeholder',tooltip:FREEHOLDER_TOOLTIP,
        essences:REPUTATION_ESSENCES.map(essence=>({id:essence.id,intensity:null,careerPoints:0,seasonPoints:0}))
      }
    };
  }
  return {
    eligibleBattles:8,
    sliders:PLAYER_PERSONALITY_SLIDERS.map((slider,index)=>({id:slider.id,value:mature.values[index],eligibleBattles:8,evidence:'Illustrative preview evidence'})),
    reputation:{
      archetype:mature.archetype,tooltip:`${mature.archetype} is an illustrative preview reputation.`,
      essences:REPUTATION_ESSENCES.map((essence,index)=>({id:essence.id,intensity:mature.essences[index],careerPoints:mature.points[index],seasonPoints:Math.max(1,Math.round(mature.points[index]*.42))}))
    }
  };
}
