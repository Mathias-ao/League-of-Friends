import type { FfaPlacementRule, GameConfiguration, MatchFormat, MatchParticipant, ScoringAct, SeasonScoringLock, ScoringSnapshot, VerifiedFfaPlacements } from '../domain/types.js';

export const SEASON_SCORING_VERSION = 'AOF_SEASON_SCORING_V1';
// Divisible by every possible winner count in an eight-player lobby.
export const POINT_UNITS = 840;
export function scoringSnapshot(): ScoringSnapshot {
  return {profileId: SEASON_SCORING_VERSION, profileVersion: 1, rules: {seasonScoringVersion: SEASON_SCORING_VERSION,
    mainEventParticipation: 4, mainEventWin: 6, warmupParticipation: 1, warmupWin: 2,
    secondPlace: 2, thirdPlace: 1, emperorBounty: 2}};
}
export function lockSeasonScoring(input: {
  act: ScoringAct; format: MatchFormat; gameConfig: GameConfiguration; emperorPlayerId: string | null;
  placementRule?: FfaPlacementRule | null; placementDescription?: string | null;
}): SeasonScoringLock {
  if (input.act !== 'MAIN_EVENT' && input.act !== 'WARMUP') throw new Error('Invalid scoring act.');
  const ffa = input.format === 'FFA';
  if (ffa && typeof input.gameConfig.diplomacyEnabled !== 'boolean') throw new Error('Scoring FFA requires an explicit diplomacy setting.');
  const placementRule = ffa && !input.gameConfig.diplomacyEnabled && input.act === 'MAIN_EVENT' ? input.placementRule ?? null : null;
  if (ffa && !input.gameConfig.diplomacyEnabled && input.act === 'MAIN_EVENT' && !placementRule) {
    throw new Error('Nondiplomatic FFA requires an announced verified placement rule.');
  }
  if (placementRule && !['VERIFIED_ELIMINATION', 'VERIFIED_OBJECTIVE'].includes(placementRule)) throw new Error('Invalid FFA placement rule.');
  const objective = input.gameConfig.victory.wonder || input.gameConfig.victory.relic || input.gameConfig.victory.customRuleCode;
  if (placementRule === 'VERIFIED_ELIMINATION' && objective) throw new Error('Objective FFA requires a defined objective ranking, not survival order.');
  if (placementRule === 'VERIFIED_OBJECTIVE' && !input.placementDescription?.trim()) throw new Error('Describe the objective ranking before play.');
  return {version: SEASON_SCORING_VERSION, act: input.act, emperorPlayerId: input.emperorPlayerId,
    diplomacyEnabled: input.gameConfig.diplomacyEnabled === true, placementRule, placementDescription: input.placementDescription?.trim() || null};
}
export function validateFfaPlacements(placements: VerifiedFfaPlacements, lock: SeasonScoringLock, participants: MatchParticipant[], winners: string[]): void {
  const order = placements.finishingOrder;
  if (lock.diplomacyEnabled || !lock.placementRule || placements.qualification !== 'VERIFIED' || placements.rule !== lock.placementRule ||
    !placements.evidence?.trim() || !placements.verifiedBy?.trim() || !Array.isArray(order) ||
    order.length !== participants.length || new Set(order).size !== order.length ||
    order.some(id => !participants.some(p => p.playerId === id)) || winners.length !== 1 || order[0] !== winners[0]) {
    throw new Error('Verified FFA order must cover every starter once, agree with the winner, and match the locked ranking rule.');
  }
}
export interface SeasonStanding {
  playerId: string; leaguePoints: number; leaguePointUnits?: number; mainEventWins?: number; warmupWins?: number;
}
export function rankSeasonStandings<T extends SeasonStanding>(standings: T[]): Array<T & {rank: number}> {
  const units = (s: T) => s.leaguePointUnits ?? Math.round(s.leaguePoints * POINT_UNITS);
  const compare = (a: T, b: T) => units(b) - units(a) || (b.mainEventWins ?? 0) - (a.mainEventWins ?? 0) || (b.warmupWins ?? 0) - (a.warmupWins ?? 0);
  const sorted = [...standings].sort((a, b) => compare(a, b) || a.playerId.localeCompare(b.playerId));
  let rank = 0;
  return sorted.map((s, i) => {if (!i || compare(sorted[i - 1], s)) rank = i + 1; return {...s, rank};});
}
