export const SOCIAL_INCIDENT_VERSION: string;
export const SOCIAL_SHADOW_RULES: Readonly<{ruleVersion:string;immediateMs:number;associationMs:number;contestedMs:number;trackBudget:number;maximumStage:number;acceptedQualifierVersions:string[];enabled:boolean}>;
export function projectSocialIncidents(input?: {statistics?:unknown;playerMapping?:unknown[];officialOutcome?:unknown;context?:Record<string,unknown>;qualifiedFacts?:unknown[];rules?:Partial<typeof SOCIAL_SHADOW_RULES>}): any;
export function capSocialContributions(deeds:unknown[],rules?:Partial<typeof SOCIAL_SHADOW_RULES>): any[];
export function rebuildSocialHistory(chapters:unknown[],rules?:Partial<typeof SOCIAL_SHADOW_RULES>): any;

export function applyTreacheryLevel(current:number,maximum:number):number;
