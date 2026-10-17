/** Type-only adapter for the frozen AOF_SOCIAL_V1_SHARED_1 contract.
 * Source authority and semantic admission must be server-resolved by #126 / INT-V1.
 */
import type {Claim, Receipt, PolicyRef, Subject, Ref, Position} from '../../domain/socialV1.js';

export declare const VERSION: 'AOF_SOCIAL_V1_HISTORY_1';
export interface HistoricalChapter {
  battleId: string; matchId: string; gameId: string; gameGuid: string | null;
  eventId: string; seasonId: string; sourceAuthority: string;
  revision: number; state: 'READY' | 'DISPUTED' | 'WITHDRAWN';
  /** Server-authenticated historical ordering; never upload/Firestore arrival time. */
  order: {event: number; battle: number; game: number; key: string} | null;
}
export interface AdmittedEffect {
  claim: Claim;
  battleId: string; gameId: string; eventId: string; sourceAuthority: string;
}
export interface ActorConductWitness {
  claimId: string; incidentId: string; battleId: string; actorPlayerId: string;
  qualification: 'QUALIFIED' | 'PENDING' | 'NOT_QUALIFIED';
  ref: Ref;
}
export type Polarity = 'STRENGTHEN' | 'WEAKEN';
export interface BoundaryRules {
  /** Upward per-boundary costs, indexed from stage 0->1. Not cumulative total points. */
  up: number[];
  /** Downward per-boundary costs, indexed from stage 1->0. */
  down: number[];
  /** Both directions must separately satisfy each ordinary stage 3+ minimum. */
  reciprocity?: Record<number, number>;
}
export interface CalibratedSocialHistoryRules {
  version: string; policy: PolicyRef;
  stages: {
    REPUTATION: Record<'GALLANTRY' | 'CRUELTY' | 'CHIVALRY', BoundaryRules>;
    RELATIONSHIP: Record<'RIVALRY' | 'HOSTILITY' | 'BOND', BoundaryRules>;
  };
  budgets: {
    reputationBattle: Record<'GALLANTRY' | 'CRUELTY' | 'CHIVALRY', Record<Polarity, number>>;
    relationshipEvent: Record<'RIVALRY' | 'HOSTILITY' | 'BOND', Record<Polarity, number>>;
  };
  rules: Record<string, {
    system: Subject['system']; track: string; effect: Polarity;
    /** Explicit significance-band -> units, no inherited/default numerical mapping. */
    bands: Record<string, number>;
  }>;
  treachery: {consumptionUnits: number; maximumStage: number};
}
export interface StrictTreacheryInput {
  incidentId: string; incidentRevision: string; qualifierVersion: string;
  victimPlayerId: string; responsiblePlayerId: string;
  battleId: string; gameId: string; eventId: string; sourceAuthority: string;
  qualifiedByStrictResolver: boolean; victimJudgment: 'BETRAYED' | 'FAIR_GAME' | 'PENDING';
  strictProofRef: Ref; bindingVictimJudgmentRef: Ref;
  strictGates: Record<'effectiveMutualAlliance' | 'unilateralRupture' |
    'orderedHostility' | 'kingLoss' | 'responsibility' |
    'associatedIncident' | 'eligibleModeAndIdentity', boolean>;
  historicalPosition: Position;
}
export interface ExplicitSkillAcknowledgment {
  battleId: string; gameId: string; eventId: string; sourceAuthority: string;
  fromPlayerId: string; toPlayerId: string; acknowledgedSuperiorPlayerId: string;
  qualification: 'QUALIFIED' | 'PENDING' | 'NOT_QUALIFIED';
  explicitStructuredJudgmentRef: Ref; historicalPosition: Position;
}
export interface HistoricalProjection {
  subject: Subject; stage: number; peak: number; upBank: number; downBank: number;
  currentStage: number | null; lastVerifiedHistoricalStage: number | null;
  status: 'VERIFIED' | 'PENDING'; pendingReasons: string[];
  transitions: Array<{kind: 'UP' | 'DOWN' | 'EXCEPTIONAL_UP'; stage: number; at: number[]}>;
  quarantinedPreExceptionWeakening: number;
  reciprocityEvents: number | null;
}
export interface HistoricalResult {
  version: typeof VERSION; sharedContract: 'AOF_SOCIAL_V1_SHARED_1';
  inputDigest: string; projectionRevision: string; policy: PolicyRef;
  publicationAllowed: boolean; officialWrites: false;
  projections: HistoricalProjection[]; receipts: Receipt[];
  simulation: null | {receiptPublicationBlocked: true};
  consumption: Array<{incidentId: string; budgetKey: string; requestedUnits: number;
    allocatedUnits: number; unappliedUnits: number}>;
  audit: Array<{claimId?: string; incidentId?: string; reason: string}>;
}
export declare function validateCalibration(c: CalibratedSocialHistoryRules): CalibratedSocialHistoryRules;
export declare function evaluateHistory(input: {
  chapters?: HistoricalChapter[]; effects?: AdmittedEffect[]; actorWitnesses?: ActorConductWitness[];
  treachery?: StrictTreacheryInput[]; acknowledgments?: ExplicitSkillAcknowledgment[];
  calibration: CalibratedSocialHistoryRules;
  /** Must be supplied from an external, server-trusted approval registry. */
  trustedApprovals?: PolicyRef[];
}): HistoricalResult;
