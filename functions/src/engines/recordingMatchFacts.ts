export const RECORDING_MATCH_FACTS_VERSION = "AOF_RECORDING_MATCH_FACTS_V1";
export const GAME_OUTCOME_CONTEXT_VERSION = "AOF_GAME_OUTCOME_CONTEXT_V1";

type RecordValue = Record<string, any>;
const record = (value: unknown): RecordValue | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : null;

export function validateRecordingMatchFacts(
  value: unknown, source: {replaySha256: string; canonicalManifestSha256?: string; extractionRunId?: string},
  replaySlots: number[],
): RecordValue {
  const facts = record(value);
  if (!facts || facts.modelVersion !== RECORDING_MATCH_FACTS_VERSION ||
      facts.identityNamespace !== "CANONICAL_REPLAY_PLAYER_ID") {
    throw new Error("Recording match facts contract is missing or unsupported.");
  }
  const provenance = record(facts.source);
  if (!provenance || provenance.replaySha256 !== source.replaySha256 ||
      source.canonicalManifestSha256 && provenance.canonicalManifestSha256 !== source.canonicalManifestSha256 ||
      source.extractionRunId && provenance.extractionRunId !== source.extractionRunId) {
    throw new Error("Recording match facts provenance does not match statistics.");
  }
  for (const key of ["game", "map", "rules", "diplomacy", "result", "coverage", "policy"]) {
    if (!record(facts[key])) throw new Error("Recording match facts are missing " + key + ".");
  }
  const players = facts.players;
  const expected = [...replaySlots].sort((a,b)=>a-b);
  if (!Array.isArray(players) || players.some(p=>!record(p) || !Number.isInteger(p.playerId) ||
      p.playerId<1 || p.playerId>8)) throw new Error("Recording match facts have invalid replay players.");
  const actual = players.map(p=>p.playerId).sort((a,b)=>a-b);
  if (new Set(actual).size !== actual.length || JSON.stringify(actual)!==JSON.stringify(expected)) {
    throw new Error("Recording match facts roster differs from recording.");
  }
  if (facts.result.qualification !== "UNRESOLVED" || facts.result.winnerPlayerIds !== null ||
      facts.result.loserPlayerIds !== null) throw new Error("Replay outcome was promoted without qualification.");
  for (const key of ["automaticResultSubmissionEnabled","rewardsEnabled","relationshipScoringEnabled",
                     "reputationScoringEnabled","rawFactsVisibleByDefault"]) {
    if (facts.policy[key] !== false) throw new Error("Recording match facts activated " + key + ".");
  }
  const serialized = JSON.stringify(facts);
  if (serialized.length>160_000) throw new Error("Recording match facts exceed the storage limit.");
  return JSON.parse(serialized);
}

/** Always read the current league result; ingestion snapshots are historical only. */
export function currentOfficialGameOutcome(gameValue: unknown, matchValue: unknown = {}): RecordValue {
  const game = record(gameValue) ?? {}, match = record(matchValue) ?? {};
  const result = record(game.canonicalResult);
  const base = {modelVersion: GAME_OUTCOME_CONTEXT_VERSION, authority: "LEAGUE_GAME_CANONICAL_RESULT",
                resultRevision: Number.isInteger(result?.revision) ? result!.revision : null};
  const unknown = (reason:string) => ({...base, qualification:"UNRESOLVED",
      winnerPlayerIds:null, loserPlayerIds:null, reason});
  if (game.activeResultDisputeId || match.activeResultDisputeId ||
      ["DISPUTED","CANCELLED","VOID","PROPOSED"].includes(match.status) || game.status!=="COMPLETED") {
    return unknown("official_result_not_currently_eligible");
  }
  if (!result || !Number.isInteger(result.revision) || result.revision<1 ||
      !["PLAYER_CONFIRMED","ADMIN_RESOLVED","ADMIN_CORRECTED"].includes(result.source) ||
      !["PLAYER_WIN","TEAM_WIN"].includes(result.type)) return unknown("official_result_missing_or_invalid");
  const roster = Array.isArray(game.players) ? game.players.map((p:unknown)=>record(p)?.playerId) : [];
  const winners = result.winningPlayerIds;
  if (roster.length<2 || roster.some((id:unknown)=>typeof id!=="string" || !id) ||
      new Set(roster).size!==roster.length || !Array.isArray(winners) || !winners.length ||
      winners.length>=roster.length || new Set(winners).size!==winners.length ||
      winners.some((id:unknown)=>!roster.includes(id))) return unknown("official_result_roster_unresolved");
  const losers = roster.filter((id:string)=>!winners.includes(id)).sort();
  if (result.losingPlayerIds != null && (!Array.isArray(result.losingPlayerIds) ||
      JSON.stringify([...result.losingPlayerIds].sort())!==JSON.stringify(losers))) {
    return unknown("official_loser_roster_mismatch");
  }
  return {...base, qualification:"OFFICIAL", source:result.source, outcomeType:result.type,
          winnerPlayerIds:[...winners].sort(), loserPlayerIds:losers,
          loserMeaning:"non_winning_members_of_the_official_Game_roster",
          replayOutcomeEstablished:false};
}
