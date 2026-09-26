export const STATISTIC_CATEGORIES=['Opening','Economy','Military','Map Presence','Execution'] as const;
export type StatisticCategory=typeof STATISTIC_CATEGORIES[number];

export interface StatisticValue {
  label:string;
  value:string;
  note?:string;
}

export interface StatisticCategoryBlock {
  category:StatisticCategory;
  summary?:string;
  values:StatisticValue[];
}

export interface BattleHighlight {
  category:StatisticCategory;
  eyebrow:string;
  title:string;
  detail:string;
}

export interface BattleStatisticsPresentation {
  highlights:BattleHighlight[];
  categories:StatisticCategoryBlock[];
}

export interface SeasonRecordPresentation {
  label:string;
  value:string;
  holder:string;
  provenance?:string;
}

export interface SeasonStatisticsPresentation {
  seasonLabel:string;
  battlesAnalyzed:number|null;
  categories:StatisticCategoryBlock[];
  records:SeasonRecordPresentation[];
}

export interface EventStatisticsPresentation {
  eventLabel:string;
  battlesAnalyzed:number|null;
  distinctions:BattleHighlight[];
  categories:StatisticCategoryBlock[];
}

export const PLAYER_PERSONALITY_SLIDERS=[
  {id:'boomer-aggressor',left:'Boomer',right:'Aggressor',question:'Do they invest early in economic development or military pressure?'},
  {id:'cautious-bold',left:'Cautious',right:'Bold',question:'Do they secure home territory or establish themselves toward the enemy with little defence?'},
  {id:'guerrilla-frontline',left:'Guerrilla',right:'Frontline Fighter',question:'Do they prefer raids and disruption or direct sustained engagements?'},
  {id:'specialist-improviser',left:'Specialist',right:'Improviser',question:'Do they concentrate on a narrow plan or composition, or use a broader range of tools?'},
  {id:'compact-expansive',left:'Compact',right:'Expansive',question:'Do they keep infrastructure concentrated or spread economically across the map?'}
] as const;

export type PlayerPersonalitySliderId=typeof PLAYER_PERSONALITY_SLIDERS[number]['id'];

export interface PlayerPersonalitySliderPresentation {
  id:PlayerPersonalitySliderId;
  value:number|null;
  eligibleBattles:number;
  evidence?:string;
}

export const REPUTATION_ESSENCES=[
  {id:'gallantry',label:'Gallantry',tone:'gold',meaning:'Renown & Daring Feats'},
  {id:'chivalry',label:'Chivalry',tone:'blue',meaning:'Fealty & Kinship'},
  {id:'treachery',label:'Treachery',tone:'red',meaning:'Cruelty & Deceit'}
] as const;
export type ReputationEssenceId=typeof REPUTATION_ESSENCES[number]['id'];

export interface ReputationEssencePresentation {
  id:ReputationEssenceId;
  intensity:number|null;
  careerPoints:number|null;
  seasonPoints:number|null;
}

export type ReputationArchetype='Freeholder'|'Champion'|'Vigilante'|'Justiciar'|'Tyrant'|'Diplomat'|'Custodian'|'Monarch';

export interface PlayerIdentityPresentation {
  eligibleBattles:number;
  sliders:PlayerPersonalitySliderPresentation[];
  reputation:{
    archetype:ReputationArchetype;
    tooltip:string;
    essences:ReputationEssencePresentation[];
  };
}

export const FREEHOLDER_TOOLTIP='An unwritten history. The court has not yet seen enough to judge what kind of reputation this player will forge.';

export const RELATIONSHIP_TRACKS=[
  {
    id:'rivalry',label:'Rivalry',reputation:'Gallantry',
    stages:['Friction','Contest','Rivalry','Nemesis'],revealStage:3
  },
  {
    id:'hostility',label:'Hostility',reputation:'Treachery',
    stages:['Grudge','Bad Blood','Enmity','Blood Feud'],revealStage:3,
    secretLegendaryStage:'Internecine Strife'
  },
  {
    id:'friendship',label:'Friendship',reputation:'Chivalry',
    stages:['Familiarity','Respect','Alliance','Blood Brothers'],revealStage:3
  }
] as const;

export const PERSONALITY_MINIMUM_ELIGIBLE_BATTLES=3;
