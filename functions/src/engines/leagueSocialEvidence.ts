import type {
  PairInteractionOpportunity,
  PairSocialBeat,
  PairSocialCoverage,
  PairSocialEvidence,
  PairSocialBeatType,
  SocialEvidenceConfidence,
} from "./pairSocialEvidence.js";
import type { PairDiplomacySnapshot } from "./pairSocialEvidence.js";

export const LEAGUE_SOCIAL_EVIDENCE_VERSION = "AOF_LEAGUE_SOCIAL_EVIDENCE_V1";

export interface LeaguePlayerBinding {
  replayPlayerId: number;
  leaguePlayerId: string;
  sourceVersion: string;
}

export interface LeaguePairInteractionOpportunity {
  opportunityId: string;
  kind: PairInteractionOpportunity["kind"];
  startMs: number;
  endMs: number;
  playerOneId: string;
  playerTwoId: string;
  sourceVersion: string;
  evidenceEventIds: string[];
}

export interface LeaguePairSocialBeat {
  beatId: string;
  type: PairSocialBeatType;
  startMs: number;
  endMs: number;
  sourcePlayerId: string | null;
  targetPlayerId: string | null;
  thirdPartyPlayerId: string | null;
  units: number;
  confidence: SocialEvidenceConfidence;
  sourceVersion: string;
  evidenceEventIds: string[];
  diplomacy: PairDiplomacySnapshot | null;
  metadata: Record<string, number | string | boolean | null>;
}

export interface LeaguePairSocialEvidence {
  schemaVersion: typeof LEAGUE_SOCIAL_EVIDENCE_VERSION;
  sourceSchemaVersion: string;
  matchId: string;
  playerOneId: string;
  playerTwoId: string;
  durationMs: number;
  coverage: PairSocialCoverage;
  opportunities: LeaguePairInteractionOpportunity[];
  beats: LeaguePairSocialBeat[];
  diagnostics: PairSocialEvidence["diagnostics"];
}

function sortedPair(a: string, b: string): [string, string] {
  return a.localeCompare(b) <= 0 ? [a, b] : [b, a];
}

function validateBindings(bindings: LeaguePlayerBinding[]): Map<number, string> {
  const replay = new Map<number, string>();
  const league = new Set<string>();
  for (const binding of bindings) {
    if (!Number.isInteger(binding.replayPlayerId) || binding.replayPlayerId <= 0) {
      throw new Error("League social evidence binding replayPlayerId must be a positive integer.");
    }
    const leaguePlayerId = binding.leaguePlayerId.trim();
    if (!leaguePlayerId) throw new Error("League social evidence binding leaguePlayerId is required.");
    if (!binding.sourceVersion) throw new Error(`League social evidence binding ${binding.replayPlayerId} requires sourceVersion.`);
    if (replay.has(binding.replayPlayerId)) {
      throw new Error(`Duplicate replay player binding ${binding.replayPlayerId}.`);
    }
    if (league.has(leaguePlayerId)) {
      throw new Error(`League player ${leaguePlayerId} is bound to more than one replay player.`);
    }
    replay.set(binding.replayPlayerId, leaguePlayerId);
    league.add(leaguePlayerId);
  }
  return replay;
}

function requireMapped(mapping: Map<number, string>, replayPlayerId: number, context: string): string {
  const mapped = mapping.get(replayPlayerId);
  if (!mapped) throw new Error(`${context} replay player ${replayPlayerId} has no league-player binding.`);
  return mapped;
}

function optionalMapped(mapping: Map<number, string>, replayPlayerId: number | null, context: string): string | null {
  return replayPlayerId == null ? null : requireMapped(mapping, replayPlayerId, context);
}

function mapBeat(mapping: Map<number, string>, beat: PairSocialBeat): LeaguePairSocialBeat {
  return {
    beatId: beat.beatId,
    type: beat.type,
    startMs: beat.startMs,
    endMs: beat.endMs,
    sourcePlayerId: optionalMapped(mapping, beat.sourcePlayerId, `Beat ${beat.beatId} source`),
    targetPlayerId: optionalMapped(mapping, beat.targetPlayerId, `Beat ${beat.beatId} target`),
    thirdPartyPlayerId: optionalMapped(mapping, beat.thirdPartyPlayerId, `Beat ${beat.beatId} third party`),
    units: beat.units,
    confidence: beat.confidence,
    sourceVersion: beat.sourceVersion,
    evidenceEventIds: [...beat.evidenceEventIds],
    diplomacy: beat.diplomacy ? { ...beat.diplomacy } : null,
    metadata: { ...beat.metadata },
  };
}

export function mapPairSocialEvidenceToLeague(input: {
  evidence: PairSocialEvidence;
  bindings: LeaguePlayerBinding[];
}): LeaguePairSocialEvidence {
  const mapping = validateBindings(input.bindings);
  const first = requireMapped(mapping, input.evidence.playerOneId, "Pair player one");
  const second = requireMapped(mapping, input.evidence.playerTwoId, "Pair player two");
  const [playerOneId, playerTwoId] = sortedPair(first, second);

  const opportunities = input.evidence.opportunities.map((opportunity): LeaguePairInteractionOpportunity => {
    const opportunityOne = requireMapped(mapping, opportunity.playerOneId, `Opportunity ${opportunity.opportunityId} player one`);
    const opportunityTwo = requireMapped(mapping, opportunity.playerTwoId, `Opportunity ${opportunity.opportunityId} player two`);
    const [mappedOne, mappedTwo] = sortedPair(opportunityOne, opportunityTwo);
    return {
      opportunityId: opportunity.opportunityId,
      kind: opportunity.kind,
      startMs: opportunity.startMs,
      endMs: opportunity.endMs,
      playerOneId: mappedOne,
      playerTwoId: mappedTwo,
      sourceVersion: opportunity.sourceVersion,
      evidenceEventIds: [...opportunity.evidenceEventIds],
    };
  });

  const beats = input.evidence.beats.map((beat) => mapBeat(mapping, beat));
  return {
    schemaVersion: LEAGUE_SOCIAL_EVIDENCE_VERSION,
    sourceSchemaVersion: input.evidence.schemaVersion,
    matchId: input.evidence.matchId,
    playerOneId,
    playerTwoId,
    durationMs: input.evidence.durationMs,
    coverage: { ...input.evidence.coverage },
    opportunities,
    beats,
    diagnostics: { ...input.evidence.diagnostics },
  };
}
