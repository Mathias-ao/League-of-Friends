import {createHash} from 'node:crypto';
import {evaluatePlaystyleProfile, type PlaystyleRuleSet} from '../playstyleEngine.js';

/**
 * AOF_PERSONALITY_FEATURES_V1 — private, parameterized projection over ALREADY VERIFIED
 * and server-authorized statistics. No parser, Firestore writer, feature flag or public endpoint.
 * Neither source snapshots nor approval claims may be supplied by the browser.
 *
 * The shared social contract (PR #135) binds battleId === matchId. This module does
 * not import an unmerged PR; its caller must verify these server-resolved identities.
 */
export const PERSONALITY_FEATURE_VERSION = 'AOF_PERSONALITY_FEATURES_V1' as const;
export const PERSONALITY_AXES = {
  BOOMER_AGGRESSOR: ['Boomer', 'Aggressor'],
  CAUTIOUS_BOLD: ['Cautious', 'Bold'],
  GUERRILLA_FRONTLINE: ['Guerrilla', 'Frontline Fighter'],
  SPECIALIST_IMPROVISER: ['Specialist', 'Improviser'],
  COMPACT_EXPANSIVE: ['Compact', 'Expansive'],
} as const;
export type PersonalityAxis = keyof typeof PERSONALITY_AXES;
const AXES = Object.keys(PERSONALITY_AXES) as PersonalityAxis[];
type Json = Record<string, any>;
const obj = (v: unknown): Json => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Json : {};
const list = (v: unknown): Json[] => Array.isArray(v) ? v.filter(x => x !== null && typeof x === 'object') : [];
const num = (v: unknown): number | null => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
const id = (v: unknown): string | null => typeof v === 'string' && v.length > 0 ? v : null;
const digest = (v: unknown): string => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const mean = (v: number[]): number => v.reduce((s, x) => s + x, 0) / v.length;
const median = (values:number[]):number => {const a=[...values].sort((x,y)=>x-y), m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;};
/** A changed upstream formula requires explicit review and a new Personality feature version. */
const sourceVersion = (actual:unknown, expected:string):boolean => actual === expected;
const MODELS = {
  economy:'AOF_RESOURCE_COMMITMENT_V1',
  military:'AOF_MILITARY_STATISTICS_V5',
  map:'AOF_MAP_PRESENCE_V8',
  engagement:'AOF_ENGAGEMENT_STATISTICS_V4',
  raid:'AOF_RAID_DETECTION_V3',
} as const;

export type Format = 'ONE_V_ONE' | 'TEAM' | 'FFA';
export type MapFamily = 'LAND' | 'WATER' | 'HYBRID';
export type StartFamily = 'STANDARD' | 'NOMAD' | 'CUSTOM';
export interface GameContext {
  format: Format;
  mapFamily: MapFamily | null;
  startFamily: StartFamily | null;
  mapId: string | null;
  /** Server-classified duration category; numeric cutoffs are an approval decision. */
  durationFamily: string | null;
  civilization: string | null;
  /** Approved opportunity class, not an assumed equivalence of all civilizations. */
  civilizationOpportunityKey: string | null;
  observedUntilMs: number;
  durationMs: number;
  /** FFA hostile episodes cannot be inferred from static initial diplomacy. */
  dynamicDiplomacyQualified: boolean;
}
export interface AuthorizedGame {
  /** Server-derived identity, never a recording file name. */
  battleId: string;
  matchId: string;
  gameId: string;
  gameNumber: number;
  playerId: string;
  replaySlot: number;
  sourceHash: string;
  sourceAuthority: string;
  mappingDigest: string;
  /** Monotone active-source/result/roster revision supplied by the authoritative reader. */
  authorityRevision: number;
  sourceStatus: 'READY' | 'WITHDRAWN';
  outcome: 'OFFICIAL' | 'PENDING' | 'DISPUTED';
  admitted: boolean;
  /** True only when the complete eligible engagement/raid episode arrays were read from the retained artifact. */
  episodeChronologyComplete: boolean;
  /** A real completion time, or the factual start of an approved Event schedule.
   * This is an ordering timestamp, not a claim the Battle was completed then. */
  playedAtMs: number;
  /** Server-derived approved Event/plan/explicit-Game ordering; never upload time. */
  historicalOrder?: {event: number; battle: number; game: number; revision: string};
  context: GameContext | null;
  /** The already-qualified participant row from Canonical Statistics V1. */
  statistics: unknown;
}
export interface Feature {
  axis: PersonalityAxis;
  numerator: number | null;
  denominator: number | null;
  fraction: number | null;
  evidenceIds: string[];
  modelVersions: string[];
  semantic: 'RECORDED_COMMITMENT' | 'PLACEMENT_POSTURE' | 'COMMAND_POSTURE' | 'QUEUE_COMPOSITION' | 'EXPANSION_PLACEMENT';
  reason: string | null;
}
export interface GameEvidence {
  battleId: string; gameId: string; gameNumber: number; playerId: string;
  sourceHash: string; authorityRevision: number; sourceAuthority: string;
  contextKey: string; eligible: boolean; features: Record<PersonalityAxis, Feature>;
}
export interface BattleEvidence {
  battleId: string; playerId: string; playedAtMs: number; contextKey: string;
  historicalOrder?: {event: number; battle: number; revision: string};
  /** Stable, sorted canonical hashes/revisions, not POV or upload count. */
  sourceRevision: string; gameIds: string[];
  features: Record<PersonalityAxis, Feature>;
}
export interface CalibrationAnchor {lower: number; upper: number; comparisonGroup: string}
export interface PersonalityCalibration {
  configurationVersion: string;
  status: 'PROPOSED' | 'APPROVED';
  /** No defaults for approval-gated numbers or tactical taxonomy. */
  minimumIndependentBattles: number;
  recentBattleCount: number;
  careerWeight: number;
  /** Robustness choice is proposed/configured, not an engine-hidden scoring policy. */
  aggregationMethod: 'MEAN' | 'MEDIAN';
  /** Only these building ids count as strategically relevant B placements. */
  strategicBuildingIds: number[];
  /** Qualifying family opportunity taxonomy is explicit, not inferred from observed unit selection. */
  availableMilitaryFamilies: Record<string, string[]>;
  /** Anchors indexed by exact compatible context + axis. No league-relative percentile fitting. */
  anchors: Record<string, Partial<Record<PersonalityAxis, CalibrationAnchor>>>;
  /** Command episode support requirement, never silently set to one. */
  minimumIndependentCommandEpisodes: number;
}
export interface AxisPreview {
  axis: PersonalityAxis; left: string; right: string;
  status: 'DEVELOPING' | 'READY' | 'CONTEXT_LIMITED';
  value: number | null; independentBattles: number;
  coverage: {source: 'VERIFIED_INPUT' | 'NO_ELIGIBLE_INPUT'; semantic: 'RECORDED' | 'INFERRED_COMMAND' | 'UNAVAILABLE'; sample: 'DEVELOPING' | 'SUPPORTED'};
  contextKey: string | null; reasons: string[]; sourceRevisions: string[];
}
export interface PersonalityPreview {
  featureVersion: typeof PERSONALITY_FEATURE_VERSION;
  configurationVersion: string | null; policyStatus: 'UNCONFIGURED' | 'PROPOSED' | 'APPROVED';
  /** Only private preview; no official publication or shared-contract approval assertion. */
  publication: 'PRIVATE_PREVIEW_ONLY';
  playerId: string; projectionRevision: string;
  battles: BattleEvidence[]; sliders: AxisPreview[];
}
const feature = (axis: PersonalityAxis, semantic: Feature['semantic'], numerator: number | null, denominator: number | null,
  evidenceIds: string[], modelVersions: string[], reason: string | null = null): Feature => {
  const valid = numerator !== null && denominator !== null && Number.isFinite(numerator) &&
    Number.isFinite(denominator) && numerator >= 0 && denominator > 0 && numerator <= denominator;
  return {axis, numerator: valid ? numerator : null, denominator: valid ? denominator : null,
    fraction: valid ? numerator / denominator : null,
    evidenceIds: [...new Set(evidenceIds)].sort(), modelVersions: [...new Set(modelVersions)].sort(),
    semantic, reason: valid ? null : (reason ?? 'MISSING_OR_INVALID_OPPORTUNITY')};
};
const missing = (axis: PersonalityAxis, semantic: Feature['semantic'], why: string): Feature =>
  feature(axis, semantic, null, null, [], [], why);
const keyOf = (c: GameContext | null): string =>
  c ? [c.format,c.mapFamily,c.startFamily,c.mapId,c.durationFamily,
    c.civilizationOpportunityKey].map(x=>x??'UNKNOWN').join('|') : 'CONTEXT_UNAVAILABLE';
/**
 * Personality describes habits across ordinary civilizations, maps and game lengths.
 * These remain exact source/context evidence, but not a reason to divide a player's
 * *entire* longitudinal comparison into incomparable one-game samples.
 *
 * A special start changes the starting opportunity itself. Until reviewed
 * per-axis normalization exists, keep Nomad/custom starts map-specific and
 * separate from ordinary initial-TC Games. Modes remain distinct because
 * their interaction opportunities differ.
 */
export function personalityComparisonGroup(c: GameContext | null, axis?: PersonalityAxis): string {
  // An unreviewed start/family cannot silently become an ordinary cohort.
  if(!c||!c.startFamily||!c.mapFamily)return 'SOURCE_OPPORTUNITY_NOT_CLASSIFIED';
  // Economy's proportion of *recorded resource commitments* remains comparable
  // across ordinary starts on land or water, with complete cost coverage.
  // Tactical, military-family and expansion opportunities can change on
  // WATER/HYBRID. Only those axes are segregated; do not erase economy data.
  const specialMapOpportunity=axis && axis!=='BOOMER_AGGRESSOR' &&
    (c.mapFamily==='WATER' || c.mapFamily==='HYBRID');
  if(c.startFamily==='STANDARD')return [
    c.format,'STANDARD_START',...(specialMapOpportunity?[c.mapFamily+'_OPPORTUNITY']:[])
  ].join('|');
  return [c.format,c.startFamily,c.mapFamily,c.mapId].join('|');
}
// Source/roster/subject admission is independent of an axis' opportunity.
// Only a verified format/observed clock is universal; reviewed map family,
// start, civilization and duration bucket qualify individual axes or anchors.
const known = (c: GameContext | null): c is GameContext => !!c &&
  num(c.observedUntilMs) !== null && num(c.durationMs) !== null &&
  c.observedUntilMs >= c.durationMs &&
  ['ONE_V_ONE','TEAM','FFA'].includes(c.format);
const ids = (items: Json[]): string[] => items.map(x => id(x.sourceEventId)).filter((x): x is string => !!x);

/** Derive exactly one observation per axis from retained player statistics. No endpoint scoring here. */
export function measurePersonalityGame(game: AuthorizedGame, config: PersonalityCalibration | null): GameEvidence {
  if (!game.playerId || !game.gameId || !game.battleId || game.matchId !== game.battleId ||
      !Number.isInteger(game.gameNumber) || game.gameNumber < 1 || !Number.isFinite(game.playedAtMs) ||
      game.playedAtMs < 0 || !Number.isInteger(game.authorityRevision) ||
      game.authorityRevision < 0 || !Number.isInteger(game.replaySlot) || game.replaySlot < 1 ||
      !(/^[0-9a-f]{64}$/.test(game.sourceHash)) || !(/^[0-9a-f]{64}$/.test(game.mappingDigest)) || !(/^[0-9a-f]{64}$/.test(game.sourceAuthority))) {
    throw new Error('PERSONALITY_UNTRUSTED_BATTLE_OR_SOURCE_BINDING');
  }
  const c = game.context, p = obj(game.statistics);
  const validPlayer = p.replaySlot === game.replaySlot && p.playerId === game.replaySlot;
  // Winning is not a prerequisite for a source-bound behavioral observation.
  // PENDING refers solely to result resolution; withdrawn/disputed records and
  // non-admitted sources remain ineligible. The authenticated source/context
  // adapter retains its independent current-source/roster/proof checks.
  const eligible = game.sourceStatus === 'READY' && game.outcome !== 'DISPUTED' &&
    game.admitted && validPlayer && known(c);
  const result = {} as Record<PersonalityAxis, Feature>;
  if (!eligible) {
    for (const axis of AXES) result[axis] = missing(axis, semanticOf(axis), 'SOURCE_CONTEXT_RESULT_OR_MAPPING_UNQUALIFIED');
    return {battleId:game.battleId, gameId:game.gameId,gameNumber:game.gameNumber,playerId:game.playerId,
      sourceHash:game.sourceHash,authorityRevision:game.authorityRevision,sourceAuthority:game.sourceAuthority,
      contextKey:keyOf(c),eligible:false,features:result};
  }
  if(!c)throw new Error('PERSONALITY_CONTEXT_ADMISSION_INVARIANT');
  const military = obj(p.military), economy = obj(p.economy), mp = obj(p.mapPresence);
  const commitment = obj(economy.resourceCommitment), spend = obj(military.militarySpend);
  const total = num(obj(commitment.resourcesCommitted).total);
  const mil = num(spend.resources);
  const coverage = obj(commitment.coverage);
  // A: same full-game positive-cost BUILD/queue/research request accounting, not actual spending
  // or a fabricated 20-minute economy denominator.
  result.BOOMER_AGGRESSOR = total !== null && mil !== null &&
    coverage.unpricedRequestCommands === 0 && spend.unpricedMilitaryCommandAmount === 0 &&
    sourceVersion(commitment.modelVersion,MODELS.economy) &&
    sourceVersion(military.modelVersion,MODELS.military)
    ? feature('BOOMER_AGGRESSOR','RECORDED_COMMITMENT',mil,total,[],
        [String(commitment.modelVersion ?? ''),String(military.modelVersion ?? '')])
    : missing('BOOMER_AGGRESSOR','RECORDED_COMMITMENT','FULL_GAME_COST_COVERAGE_UNAVAILABLE');

  // B: explicit owner-reviewed strategic building taxonomy required. Source event ids are
  // deduplicated; home/forward sectors only, ambiguous mid-map is excluded.
  const sectors = obj(mp.buildingSectors), strategic = config?.strategicBuildingIds ?? [];
  const placed = list(sectors.evidence), classified = placed.filter(x =>
    strategic.includes(x.buildingId) && ['home','forward'].includes(x.sector) && id(x.sourceEventId));
  const unique = [...new Map(classified.map(x => [x.sourceEventId,x])).values()];
  const unknown = placed.length !== sectors.classifiedPlacementCount ||
    placed.some(x => strategic.includes(x.buildingId) &&
    (!['home','forward','midMap'].includes(x.sector) || !id(x.sourceEventId)));
  result.CAUTIOUS_BOLD = config && strategic.length && !unknown &&
    obj(mp.homeAnchor).method === 'initial_town_center' &&
    num(sectors.classifiedPlacementCount) !== null && sourceVersion(mp.modelVersion,MODELS.map)
    ? feature('CAUTIOUS_BOLD','PLACEMENT_POSTURE',
        unique.filter(x => x.sector === 'forward').length,unique.length,ids(unique),
        [String(mp.modelVersion ?? '')])
    : missing('CAUTIOUS_BOLD','PLACEMENT_POSTURE','STRATEGIC_PLACEMENT_TAXONOMY_OR_ANCHOR_UNAVAILABLE');

  // C: *command* episodes, never confirmed raids/attacks. Both detectors are
  // command-derived; overlap groups sharing source events count once.
  const engagements = obj(military.engagements);
  const raidRows = list(obj(engagements.raidEvidence).initiatedEpisodes);
  const battleRows = list(obj(engagements.engagementEvidence).battles);
  const slot = String(p.playerId);
  const candidates: {kind:'ECONOMY'|'CONTESTED'; sources:string[]}[] = [];
  if ((c.format !== 'FFA' || c.dynamicDiplomacyQualified) && sourceVersion(engagements.engagementModelVersion,MODELS.engagement)) {
    for (const row of raidRows) {
      const sourceIds = Array.isArray(row.sourceEventIds) ? row.sourceEventIds.filter((v:unknown):v is string=>!!id(v)) : [];
      if (sourceVersion(row.modelVersion,MODELS.raid) && row.attackerPlayerId === p.playerId &&
          num(row.victimPlayerId) !== null &&
          sourceIds.length && num(row.startedAtMs) !== null && row.startedAtMs <= c.observedUntilMs &&
          (num(row.endedAtMs) === null || row.endedAtMs <= c.observedUntilMs)) candidates.push({kind:'ECONOMY',sources:sourceIds});
    }
    for (const row of battleRows) {
      const ownIds = obj(row.contributionSourceEventIdsByPlayer)[slot];
      const sourceIds = Array.isArray(ownIds) ? ownIds.filter((v:unknown):v is string=>!!id(v)) : [];
      const classRow = obj(obj(row.unitClassEvidenceByPlayer)[slot]);
      if (row.baseOwnerPlayerId === null && sourceIds.length &&
          num(row.startedAtMs) !== null && row.startedAtMs <= c.observedUntilMs &&
          num(row.endedAtMs) !== null && row.endedAtMs <= c.observedUntilMs &&
          num(classRow.militaryClassInstances) !== null && classRow.militaryClassInstances > 0) {
        candidates.push({kind:'CONTESTED',sources:sourceIds});
      }
    }
  }
  const seen = new Set<string>(), episodes: typeof candidates = [];
  let overlapAmbiguous = false;
  for (const row of [...candidates].sort((a,b) => a.kind.localeCompare(b.kind))) {
    if (row.sources.some(x => seen.has(x))) {overlapAmbiguous = true; continue;}
    for (const x of row.sources) seen.add(x);
    episodes.push(row);
  }
  result.GUERRILLA_FRONTLINE = config && game.episodeChronologyComplete === true &&
    !overlapAmbiguous && sourceVersion(engagements.engagementModelVersion,MODELS.engagement) &&
    (c.format !== 'FFA' || c.dynamicDiplomacyQualified) &&
    episodes.length >= config.minimumIndependentCommandEpisodes
    ? feature('GUERRILLA_FRONTLINE','COMMAND_POSTURE',
        episodes.filter(x => x.kind === 'CONTESTED').length, episodes.length,
        episodes.flatMap(x => x.sources),[String(engagements.engagementModelVersion ?? '')])
    : missing('GUERRILLA_FRONTLINE','COMMAND_POSTURE','INSUFFICIENT_ATTRIBUTABLE_COMMAND_EPISODES');

  // D: family breadth of positive military *queue requests*, with civilization/map
  // opportunity counted from separately reviewed taxonomy (not observed selection).
  const composition = obj(military.composition), requests = obj(military.militaryUnitsTrained);
  const allowed = c?.civilizationOpportunityKey ?
    (config?.availableMilitaryFamilies[c.civilizationOpportunityKey] ?? []) : [];
  const amounts = allowed.map(k => num(composition[k]));
  const included = amounts.every(x => x !== null) ? amounts.reduce<number>((s,x) => s+(x as number),0) : 0;
  const totalRequests = num(requests.positiveQueueAmount);
  const entropy = included > 0 && allowed.length > 1 ? -amounts.reduce<number>((s,x) => {
    const q = (x as number)/included; return s + (q > 0 ? q*Math.log(q) : 0);
  },0)/Math.log(allowed.length) : null;
  const entropyFraction = entropy === null ? null : Math.max(0, Math.min(1, entropy));
  // No unknown/unclassified positive queues or artificial zero-sample specialization.
  result.SPECIALIST_IMPROVISER = allowed.length > 1 && entropyFraction !== null &&
    totalRequests === included && num(requests.unknownAmountCommands) === 0 && sourceVersion(military.modelVersion,MODELS.military)
    ? feature('SPECIALIST_IMPROVISER','QUEUE_COMPOSITION',entropyFraction,1,[],
        [String(military.modelVersion ?? '')])
    : missing('SPECIALIST_IMPROVISER','QUEUE_COMPOSITION','CLASSIFIED_FAMILY_OPPORTUNITY_UNAVAILABLE');

  // E: site-normalized distinct remote expansion *placement* clusters, not raw clicks.
  const zones = obj(mp.expansionZones), remote = num(zones.eligibleRemoteBuildingCount),
    home = num(zones.eligibleBuildingPlacementsInsideHomeRadius), sites = num(zones.count);
  const supported = zones.status === 'ok' && sourceVersion(mp.modelVersion,MODELS.map) &&
    obj(mp.homeAnchor).method === 'initial_town_center' &&
    remote !== null && home !== null && sites !== null && sites <= remote &&
    list(zones.zones).length === sites &&
    list(zones.zones).reduce((sum,z) => sum+list(z.buildings).length,0) === remote;
  result.COMPACT_EXPANSIVE = supported ?
    feature('COMPACT_EXPANSIVE','EXPANSION_PLACEMENT',sites!,sites!+home!,
      list(zones.zones).flatMap(z => ids(list(z.buildings))),[String(mp.modelVersion ?? '')])
    : missing('COMPACT_EXPANSIVE','EXPANSION_PLACEMENT','EXPANSION_ZONES_OR_HOME_ANCHOR_UNAVAILABLE');
  return {battleId:game.battleId,gameId:game.gameId,gameNumber:game.gameNumber,playerId:game.playerId,
    sourceHash:game.sourceHash,authorityRevision:game.authorityRevision,sourceAuthority:game.sourceAuthority,
    contextKey:keyOf(c),eligible:true,features:result};
}
function semanticOf(axis: PersonalityAxis): Feature['semantic'] {
  switch(axis) {
    case 'BOOMER_AGGRESSOR': return 'RECORDED_COMMITMENT';
    case 'CAUTIOUS_BOLD': return 'PLACEMENT_POSTURE';
    case 'GUERRILLA_FRONTLINE': return 'COMMAND_POSTURE';
    case 'SPECIALIST_IMPROVISER': return 'QUEUE_COMPOSITION';
    case 'COMPACT_EXPANSIVE': return 'EXPANSION_PLACEMENT';
  }
}
function checkCalibration(config: PersonalityCalibration): void {
  if (!id(config.configurationVersion) || !['PROPOSED','APPROVED'].includes(config.status) ||
      !Number.isSafeInteger(config.minimumIndependentBattles) || config.minimumIndependentBattles < 1 ||
      !Number.isSafeInteger(config.recentBattleCount) || config.recentBattleCount < 1 ||
      !Number.isSafeInteger(config.minimumIndependentCommandEpisodes) || config.minimumIndependentCommandEpisodes < 1 ||
      !Number.isFinite(config.careerWeight) || config.careerWeight < 0 || config.careerWeight > 1 ||
      !['MEAN','MEDIAN'].includes(config.aggregationMethod) ||
      !Array.isArray(config.strategicBuildingIds) || !config.strategicBuildingIds.every(x => Number.isSafeInteger(x)) ||
      !config.anchors || !config.availableMilitaryFamilies) throw new Error('PERSONALITY_CALIBRATION_UNAPPROVED_SHAPE');
  for (const entries of Object.values(config.anchors)) for (const a of Object.values(entries)) {
    if (!a || !id(a.comparisonGroup) || !Number.isFinite(a.lower) || !Number.isFinite(a.upper) ||
        a.lower < 0 || a.upper > 1 || a.lower >= a.upper) throw new Error('PERSONALITY_CALIBRATION_ANCHOR_INVALID');
  }
}

/** Latest authoritative revision wins even when it withdraws a formerly eligible Game. */
export function buildPersonalityBattles(games: AuthorizedGame[], config: PersonalityCalibration | null): BattleEvidence[] {
  if (config) checkCalibration(config);
  const latest = new Map<string,AuthorizedGame>();
  for (const game of games) {
    if (game.battleId !== game.matchId || !game.playerId || !game.gameId) throw new Error('PERSONALITY_BATTLE_IDENTITY_INVALID');
    const k = JSON.stringify([game.playerId,game.battleId,game.gameId]);
    const old = latest.get(k);
    if (!old || game.authorityRevision > old.authorityRevision) latest.set(k,game);
    else if (game.authorityRevision === old.authorityRevision &&
      JSON.stringify(old) !== JSON.stringify(game)) throw new Error('PERSONALITY_CONFLICTING_AUTHORITY_REVISION');
  }
  const recordings = new Map<string,string>();
  for (const game of latest.values()) {
    const identity = JSON.stringify([game.playerId,game.battleId,game.gameId]);
    const key = game.playerId + ':' + game.sourceHash;
    const prior = recordings.get(key);
    if (prior && prior !== identity) throw new Error('PERSONALITY_DUPLICATE_RECORDING_CROSS_BATTLES');
    recordings.set(key,identity);
  }
  const groups = new Map<string,AuthorizedGame[]>();
  for (const game of latest.values()) {
    const k=JSON.stringify([game.playerId,game.battleId]);
    groups.set(k,[...(groups.get(k)??[]),game]);
  }
  const result:BattleEvidence[]=[];
  for (const parts of groups.values()) {
    parts.sort((a,b) => a.gameNumber-b.gameNumber || a.gameId.localeCompare(b.gameId));
    if(new Set(parts.map(x => x.gameNumber)).size !== parts.length)throw new Error('PERSONALITY_DUPLICATE_GAME_NUMBER');
    const observations=parts.map(x => measurePersonalityGame(x,config));
    const contextKey = observations[0].contextKey;
    const features={} as Record<PersonalityAxis,Feature>;
    for(const axis of AXES) {
      const comparisonGroup = personalityComparisonGroup(parts[0].context,axis);
      const values=observations.map(x => x.features[axis]);
      // Game-level admission already protects source, slot and exact opportunity.
      // Raw fractions may be averaged only within one start/mode opportunity
      // and with identical explicitly configured per-axis normalization bounds.
      const anchors=parts.map(x => config?.anchors[keyOf(x.context)]?.[axis]);
      const bounds=anchors[0];
      const sameExactContext=observations.every(x=>x.contextKey===contextKey);
      const comparable=sameExactContext || anchors.every(x => !!x && !!bounds &&
        x.comparisonGroup===comparisonGroup &&
        x.lower===bounds.lower && x.upper===bounds.upper);
      const okay=observations.every((x,i) => x.eligible &&
        personalityComparisonGroup(parts[i].context,axis)===comparisonGroup) &&
        values.every(x => x.fraction !== null) && comparable;
      const reasons = new Set<string>();
      if(!observations.every(x=>x.eligible))reasons.add('SOURCE_CONTEXT_RESULT_OR_MAPPING_UNQUALIFIED');
      if(!observations.every((x,i)=>
        personalityComparisonGroup(parts[i].context,axis)===comparisonGroup))
        reasons.add('INCOMPATIBLE_FORMAT_START_OR_MAP_OPPORTUNITY');
      if(!comparable)reasons.add('INCOMPATIBLE_AXIS_CALIBRATION');
      for(const value of values)
        if(value.fraction===null)reasons.add(value.reason??'MISSING_AXIS_OPPORTUNITY');
      features[axis]=okay ? feature(axis,values[0].semantic,
        mean(values.map(x => x.fraction!)),1,values.flatMap(x => x.evidenceIds),
        values.flatMap(x => x.modelVersions)) :
        missing(axis,values[0].semantic,[...reasons].sort().join(';')||
          'MULTI_GAME_INCOMPLETE_OR_INCOMPATIBLE');
    }
    result.push({battleId:parts[0].battleId,playerId:parts[0].playerId,
      playedAtMs:Math.min(...parts.map(x => x.playedAtMs)),contextKey,
      historicalOrder:parts.every(x=>x.historicalOrder &&
        x.historicalOrder.event===parts[0].historicalOrder?.event &&
        x.historicalOrder.battle===parts[0].historicalOrder?.battle &&
        x.historicalOrder.game===x.gameNumber)
        ?{event:parts[0].historicalOrder!.event,battle:parts[0].historicalOrder!.battle,
          revision:digest(parts.map(x=>x.historicalOrder))}:undefined,
      sourceRevision:digest(parts.map(x => [x.gameId,x.gameNumber,x.playedAtMs,
        x.historicalOrder??null,x.context,
        x.sourceHash,x.sourceAuthority,x.mappingDigest,x.authorityRevision,
        x.sourceStatus,x.outcome,x.admitted])),
      gameIds:parts.map(x => x.gameId),features});
  }
  return result.sort((a,b)=>{
    // Approved canonical Event/plan order is authoritative even when two
    // Battles share the same scheduled Event start. Never sort those by IDs.
    if(a.historicalOrder&&b.historicalOrder)
      return a.historicalOrder.event-b.historicalOrder.event ||
        a.historicalOrder.battle-b.historicalOrder.battle;
    return a.playedAtMs-b.playedAtMs||a.battleId.localeCompare(b.battleId);
  });
}
export function projectPersonalityPreview(playerId: string,games: AuthorizedGame[],
    config: PersonalityCalibration | null): PersonalityPreview {
  if (!playerId)throw new Error('PERSONALITY_PLAYER_REQUIRED');
  if (games.some(g => g.playerId!==playerId))throw new Error('PERSONALITY_CROSS_PLAYER_INPUT');
  const battles=buildPersonalityBattles(games,config), sliders:AxisPreview[]=[];
  for(const axis of AXES){
    const qualified=battles.filter(b=>b.features[axis].fraction !== null);
    const reasonSet=new Set<string>();
    for(const b of battles)if(b.features[axis].reason)reasonSet.add(b.features[axis].reason!);
    const contexts=new Set<string>(), records:{battle:BattleEvidence;value:number;group:string}[]=[];
    for (const battle of qualified){
      const anchor=config?.anchors[battle.contextKey]?.[axis];
      if(!anchor){reasonSet.add('CONTEXT_ANCHOR_NOT_APPROVED');continue;}
      const fraction=battle.features[axis].fraction!;
      const value=100*Math.max(0,Math.min(1,(fraction-anchor.lower)/(anchor.upper-anchor.lower)));
      contexts.add(anchor.comparisonGroup);
      records.push({battle,value,group:anchor.comparisonGroup});
    }
    const mixed=contexts.size>1;
    // Incompatible unusual starts must not invalidate an otherwise sufficient
    // standard-start career. Pick one independently sufficient opportunity group,
    // preferring ordinary starts on ties; never combine unrelated groups.
    const byGroup=new Map<string,typeof records>();
    for(const record of records)byGroup.set(record.group,[...(byGroup.get(record.group)??[]),record]);
    const ordered=[...byGroup.entries()].sort(([left,ls],[right,rs])=>
      rs.length-ls.length || Number(right.endsWith('|STANDARD_START'))-Number(left.endsWith('|STANDARD_START')) ||
      left.localeCompare(right));
    const selected=ordered.find(([,rows])=>!!config && rows.length>=config.minimumIndependentBattles);
    const admitted=selected?.[1]??[];
    const supported=!!selected;
    if(mixed && selected)reasonSet.add('OTHER_START_OR_MODE_CONTEXT_NOT_AGGREGATED');
    // Reuse the existing versioned playstyle evaluator after qualification and
    // independent-Battle/context normalization; no hidden scoring rules.
    let value:number|null=null;
    if(supported){
      const aggregate=config!.aggregationMethod==='MEDIAN'?median:mean;
      const career=aggregate(admitted.map(r=>r.value));
      const recent=aggregate(admitted.slice(-config!.recentBattleCount).map(r=>r.value));
      const blended=config!.careerWeight*career+(1-config!.careerWeight)*recent;
      const ruleSet:PlaystyleRuleSet={ruleVersion:config!.configurationVersion,sliders:[{
        sliderId:axis,leftLabel:PERSONALITY_AXES[axis][0],rightLabel:PERSONALITY_AXES[axis][1],
        minimumAvailableComponents:1,requireAllComponents:true,
        components:[{metricId:axis,weight:1,direction:'RIGHT'}]
      }]};
      value=evaluatePlaystyleProfile(playerId,'CAREER',
        [{metricId:axis,value:blended,samples:admitted.length,sourceVersion:PERSONALITY_FEATURE_VERSION}],
        ruleSet).sliders[0].value;
    }else if(mixed)reasonSet.add('INCOMPATIBLE_CONTEXT_COMPARISON_GROUPS');
    else if(!config)reasonSet.add('CALIBRATION_NOT_CONFIGURED');
    else reasonSet.add('INSUFFICIENT_DISTINCT_BATTLES');
    sliders.push({axis,left:PERSONALITY_AXES[axis][0],right:PERSONALITY_AXES[axis][1],
      status:value!==null?'READY':mixed?'CONTEXT_LIMITED':'DEVELOPING',
      value,independentBattles:supported?admitted.length:records.length,
      coverage:{source:qualified.length?'VERIFIED_INPUT':'NO_ELIGIBLE_INPUT',
        semantic:axis==='GUERRILLA_FRONTLINE'?'INFERRED_COMMAND':
          qualified.length?'RECORDED':'UNAVAILABLE',sample:supported?'SUPPORTED':'DEVELOPING'},
      contextKey:supported?selected![0]:contexts.size===1?[...contexts][0]:null,
      reasons:[...reasonSet].sort(),sourceRevisions:(supported?admitted:records).map(r=>r.battle.sourceRevision)});
  }
  return {featureVersion:PERSONALITY_FEATURE_VERSION,
    configurationVersion:config?.configurationVersion??null,
    policyStatus:config?.status??'UNCONFIGURED',publication:'PRIVATE_PREVIEW_ONLY',
    playerId,projectionRevision:digest([PERSONALITY_FEATURE_VERSION,config??null,
      battles.map(x=>[x.battleId,x.playedAtMs,x.contextKey,x.sourceRevision,x.features])]),
    battles,sliders};
}
