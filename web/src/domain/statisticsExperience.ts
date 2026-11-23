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
  {id:'boomer-aggressor',left:'Boomer',right:'Aggressor',question:'Share of recorded positive-cost resource requests committed to military choices.'},
  {id:'cautious-bold',left:'Cautious',right:'Bold',question:'Share of qualified strategic building placements made forward rather than at home.'},
  {id:'guerrilla-frontline',left:'Guerrilla',right:'Frontline Fighter',question:'Share of attributable military orders in contested episodes rather than economy-directed raid episodes.'},
  {id:'specialist-improviser',left:'Specialist',right:'Improviser',question:'Breadth of recorded military queue choices relative to verified available families.'},
  {id:'compact-expansive',left:'Compact',right:'Expansive',question:'Distinct remote economic placement clusters relative to those clusters and home placements.'}
] as const;

export type PlayerPersonalitySliderId=typeof PLAYER_PERSONALITY_SLIDERS[number]['id'];

export interface PlayerPersonalitySliderPresentation {
  id:PlayerPersonalitySliderId;
  value:number|null;
  eligibleBattles:number|null;
  status?:'DEVELOPING'|'CALIBRATION_PENDING'|'READY';
  measuredBattles?:number;
  comparableBattles?:number;
  reasons?:string[];
  evidence?:string;
}

export const REPUTATION_ESSENCES=[
  {id:'gallantry',label:'Gallantry',tone:'gold',meaning:'Renown & Daring Feats'},
  {id:'chivalry',label:'Chivalry',tone:'blue',meaning:'Fealty & Kinship'},
  {id:'cruelty',label:'Cruelty',tone:'red',meaning:'Cruelty & Deceit'}
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
  /** null means source-current owner evidence has not been read, never zero. */
  eligibleBattles:number|null;
  eligibleGames?:number|null;
  evidenceStatus?:'LOADING'|'UNAVAILABLE'|'NOT_OWNER'|'CURRENT'|'PREVIEW';
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
    id:'rivalry',label:'Rivalry',
    stages:['Friction','Contest','Rivalry','Nemesis'],revealStage:3
  },
  {
    id:'hostility',label:'Hostility',
    stages:['Tension','Grudge','Feud','Blood Feud'],revealStage:3
  },
  {
    id:'bond',label:'Bond',
    stages:['Fellowship','Comrades','Trusted Allies','Oathbound'],revealStage:3
  }
] as const;

export const PERSONALITY_MINIMUM_ELIGIBLE_BATTLES=3;
