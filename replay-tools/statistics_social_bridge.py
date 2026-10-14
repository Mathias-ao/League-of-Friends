"""Source-pinned, read-only bridge: statistics -> three independent social inboxes.

This is a private review projection, NOT a production adapter, scoring engine,
qualification authority, Chronicle publisher, or Firestore consumer. The upstream
statistics projector has already extracted neutral pair deeds and context; this
bridge does not parse a replay, count commands as points, create relationship
stages, infer player feelings, or transform every battle into social progress.

The caller owns authentication, active-source/revision verification, official
results, Event/Battle eligibility, replay-to-league bindings and permissions.
Inputs are *assertions*, not server-verifications, until an authorized connector
performs these checks. No output in this module is authorized for player UI.
"""
from __future__ import annotations

from copy import deepcopy
from hashlib import sha256
import json
from typing import Any

from directional_episode_ledger import (
    DIRECTIONAL_EPISODE_LEDGER_VERSION,
    SOURCE_KEYS,
    project_directional_episode_ledger,
    select_current_episode_chapters,
)
from chronicle_moment_design import project_chronicle_moment_design

VERSION = "AOF_STATISTICS_SOCIAL_BRIDGE_V1"
STATISTICS_VERSIONS = frozenset({
    "AOF_CANONICAL_STATISTICS_V1", "AOF_RECORDED_EVENTS_STATISTICS_V1",
})
MATCH_FACTS_VERSION = "AOF_RECORDING_MATCH_FACTS_V1"
REPUTATION_TRACKS = frozenset({"GALLANTRY", "CRUELTY", "CHIVALRY"})
RELATIONSHIP_TRACKS = frozenset({"RIVALRY", "HOSTILITY", "BOND"})
# Source-backed candidates and their *missing* independent social qualifiers.
# No qualifier in this matrix is supplied or satisfied by this module.
REPUTATION_REVIEW = {
    "DIRECTED_PRESSURE": (
        "CRUELTY", ("SUSTAINED_DISADVANTAGE_AT_EPISODE_ENTRY",
                    "MEANINGFUL_PUNISHING_CONDUCT", "DIRECTIONAL_CONTEXT_QUALIFIED")),
    "TARGETED_COMMAND": (
        "GALLANTRY", ("TARGETED_OFFENSIVE_ACTION_SEMANTICS",
                       "MEANINGFUL_EFFORT", "COMPARABLE_OR_STRONGER_OPPONENT_AT_EPISODE_ENTRY")),
    "DIRECTED_ASSISTANCE_COMMANDS": (
        "CHIVALRY", ("DIRECTED_ASSISTANCE_MATERIALITY", "QUALIFIED_BENEFICIARY_CONTEXT")),
    "DIRECTED_DEFENSIVE_PARTICIPATION": (
        "CHIVALRY", ("DEFENSIVE_ASSISTANCE_MATERIALITY", "QUALIFIED_DEFENSIVE_CONTEXT")),
}


def _canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False)


def _id(prefix: str, parts: Any) -> str:
    return prefix + "-" + sha256(_canonical(parts).encode("utf-8")).hexdigest()


def _txt(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _positive_int(value: Any) -> bool:
    return type(value) is int and value > 0


def _refs(value: Any) -> list[str]:
    if not isinstance(value, list) or any(not _txt(ref) for ref in value):
        raise ValueError("Invalid source event references")
    return sorted(set(value))


def _validate_statistics(statistics: dict) -> tuple[dict, dict]:
    if not isinstance(statistics, dict) or statistics.get("statisticsProjectionVersion") not in STATISTICS_VERSIONS:
        raise ValueError("Unsupported canonical/Recorded Events statistics projection")
    source = statistics.get("source")
    facts = statistics.get("matchFacts")
    pair = statistics.get("pairSocialEvidence")
    if (not isinstance(source, dict) or not isinstance(facts, dict)
            or not isinstance(pair, dict)
            or facts.get("modelVersion") != MATCH_FACTS_VERSION
            or facts.get("identityNamespace") != "CANONICAL_REPLAY_PLAYER_ID"):
        raise ValueError("Statistics require qualified match facts and pair evidence contracts")
    native = "recordedEventsVersion" in source or "recordedEventsSha256" in source
    fields = SOURCE_KEYS["native" if native else "canonical"]
    if native and any(k in source for k in ("canonicalManifestSha256", "canonicalSchemaVersion")):
        raise ValueError("Ambiguous canonical/native source revision")
    if any(not _txt(source.get(key)) for key in (*fields, "extractionRunId")):
        raise ValueError("Incomplete statistics extraction/source revision")
    if (native and (source.get("recordedEventsVersion") != "AOF_RECORDED_EVENTS_V1"
                    or statistics["statisticsProjectionVersion"] != "AOF_RECORDED_EVENTS_STATISTICS_V1")):
        raise ValueError("Recorded Events source/projection version mismatch")
    if not native and statistics["statisticsProjectionVersion"] != "AOF_CANONICAL_STATISTICS_V1":
        raise ValueError("Canonical source/projection version mismatch")
    for value in (source.get("replaySha256"), source.get("recordedEventsSha256") if native else source.get("canonicalManifestSha256")):
        if not isinstance(value, str) or len(value) != 64 or any(c not in "0123456789abcdef" for c in value):
            raise ValueError("Invalid source SHA-256")
    for component in (facts.get("source"), pair.get("gameScope"), pair.get("source")):
        if (not isinstance(component, dict)
                or any(component.get(key) != source[key] for key in fields)
                or ("extractionRunId" in component
                    and component["extractionRunId"] != source["extractionRunId"])):
            raise ValueError("Cross-model source revision mismatch")
    if pair.get("modelVersion") != "AOF_PAIR_SOCIAL_EVIDENCE_V1" or pair.get("identityNamespace") != "CANONICAL_REPLAY_PLAYER_ID":
        raise ValueError("Unsupported social pair evidence")
    participant_rows = statistics.get("participants")
    fact_players = facts.get("players")
    pair_players = pair.get("playerIds")
    if (not isinstance(participant_rows, list) or not isinstance(fact_players, list)
            or not isinstance(pair_players, list) or len(pair_players) < 2):
        raise ValueError("Missing statistics roster")
    rosters = []
    for rows in (participant_rows, fact_players):
        ids = [row.get("playerId") if isinstance(row, dict) else None for row in rows]
        if any(type(p) is not int or p <= 0 for p in ids) or len(ids) != len(set(ids)):
            raise ValueError("Invalid or duplicated statistics player")
        rosters.append(set(ids))
    if (len(pair_players) != len(set(pair_players)) or any(type(p) is not int or p <= 0 for p in pair_players)
            or rosters[0] != rosters[1] or rosters[0] != set(pair_players)):
        raise ValueError("Statistics/match facts/episode player identities disagree")
    duration = (facts.get("game") or {}).get("observedDurationMs")
    if type(duration) is not int or duration < 0:
        raise ValueError("Unknown recording clock basis")
    for row in pair.get("deeds") or []:
        if not isinstance(row, dict) or type((row.get("endedAt") or {}).get("atMs")) is not int or row["endedAt"]["atMs"] > duration:
            raise ValueError("Pair deed falls outside observed recording duration")
    return pair, {"projectionVersion": statistics["statisticsProjectionVersion"],
                  "matchFactsVersion": MATCH_FACTS_VERSION,
                  "source": deepcopy(source),
                  "recordedEvents": native,
                  "observedUntilMs": duration}


def _episode_outputs(ledger: dict) -> dict:
    """Project three distinct interpretations; never duplicate underlying deeds."""
    chapter = ledger["leagueContext"]
    reputation, relationships, archive = [], [], []
    for episode in ledger["episodes"]:
        anchor = {
            "matchId": chapter["matchId"], "battleId": chapter["battleId"],
            "gameId": chapter["gameId"], "eventId": chapter["eventId"],
            "seasonId": chapter["seasonId"], "gameNumber": chapter["gameNumber"],
            "battleOrder": chapter["battleOrder"],
            "chapterRevision": chapter["chapterRevision"],
            "resultRevision": chapter["resultRevision"],
            "playerMappingRevision": chapter["playerMappingRevision"],
            "sourceRevision": deepcopy(ledger["sourceRevision"]),
            "sourceEpisodeId": episode["episodeId"],
            "sourceDeedId": episode["sourceDeedId"],
            "sourceIncidentIds": deepcopy(episode["sourceIncidentIds"]),
        }
        evidence_blockers = []
        if chapter["eventBattleEligibility"] != "ELIGIBLE":
            evidence_blockers.append("EVENT_BATTLE_ELIGIBILITY_NOT_VERIFIED")
        if episode["chronologyCoverage"] != "QUALIFIED":
            evidence_blockers.append("SOURCE_INCIDENT_CHRONOLOGY_UNAVAILABLE")
        if episode["independence"] != "SOURCE_EPISODE":
            evidence_blockers.append("SOURCE_EPISODE_INDEPENDENCE_UNRESOLVED")
        direction_index: dict[tuple[str, str, str], dict] = {}
        reputation_index: dict[tuple[str, str, str], dict] = {}
        evidence_kinds = set()
        for action in episode["directionalObservations"]:
            kind = action["kind"]
            evidence_kinds.add(kind)
            actor, other = action.get("fromLeaguePlayerId"), action.get("toLeaguePlayerId")
            if not _txt(actor) or not _txt(other):
                continue  # local overlap/shared offense never manufactures direction
            refs = _refs(action.get("sourceEventIds"))
            if not refs:
                continue
            track = action.get("candidateTrackForReview")
            if track in RELATIONSHIP_TRACKS:
                key = (actor, other, track)
                row = direction_index.setdefault(key, {"sourceEvidenceKinds": set(), "sourceEventIds": set()})
                row["sourceEvidenceKinds"].add(kind)
                row["sourceEventIds"].update(refs)
            if kind in REPUTATION_REVIEW:
                reputation_track, blockers = REPUTATION_REVIEW[kind]
                key = (actor, other, reputation_track)
                row = reputation_index.setdefault(key, {"sourceEvidenceKinds": set(), "sourceEventIds": set(), "missingQualifications": set()})
                row["sourceEvidenceKinds"].add(kind)
                row["sourceEventIds"].update(refs)
                row["missingQualifications"].update(blockers)
        for (actor, other, track), data in sorted(direction_index.items()):
            semantic = [episode["episodeId"], "RELATIONSHIP", actor, other, track]
            relationships.append({
                "reviewId": _id("relationship-review", semantic),
                **deepcopy(anchor),
                "fromLeaguePlayerId": actor, "toLeaguePlayerId": other,
                "trackForIndependentQualification": track,
                "sourceEvidenceKinds": sorted(data["sourceEvidenceKinds"]),
                "sourceEventIds": sorted(data["sourceEventIds"]),
                "reviewStatus": "BLOCKED" if evidence_blockers else "SOURCE_CANDIDATE_ONLY",
                "evidenceBlockers": list(evidence_blockers),
                "meaningfulnessQualified": False, "directionalEffectQualified": False,
                "reciprocityCreditQualified": False, "ordinaryStrengthening": None,
                "ordinaryWeakening": None, "stage": None,
            })
        for (actor, other, track), data in sorted(reputation_index.items()):
            semantic = [episode["episodeId"], "REPUTATION", actor, other, track]
            reputation.append({
                "reviewId": _id("reputation-review", semantic),
                **deepcopy(anchor),
                "actorLeaguePlayerId": actor, "counterpartLeaguePlayerId": other,
                "trackForIndependentQualification": track,
                "sourceEvidenceKinds": sorted(data["sourceEvidenceKinds"]),
                "sourceEventIds": sorted(data["sourceEventIds"]),
                "missingQualifications": sorted(data["missingQualifications"]),
                "reviewStatus": "BLOCKED" if evidence_blockers else "UNQUALIFIED_CIRCUMSTANCE_REVIEW",
                "evidenceBlockers": list(evidence_blockers),
                "reputationEffectQualified": False, "points": None,
            })
        archive.append({
            "archiveId": _id("chronicle-fact", [VERSION, episode["episodeId"]]),
            **deepcopy(anchor),
            "evidenceBlockers": list(evidence_blockers),
            "pairLeaguePlayerIds": deepcopy(episode["pairLeaguePlayerIds"]),
            "startedAt": deepcopy(episode["startedAt"]),
            "endedAt": deepcopy(episode["endedAt"]),
            "chronologyCoverage": episode["chronologyCoverage"],
            "independence": episode["independence"],
            "sourceEventIds": deepcopy(episode["sourceEventIds"]),
            "sourceEvidenceKinds": sorted(evidence_kinds),
            "relationshipReviewIds": [row["reviewId"] for row in relationships if row["sourceEpisodeId"] == episode["episodeId"]],
            "reputationReviewIds": [row["reviewId"] for row in reputation if row["sourceEpisodeId"] == episode["episodeId"]],
            "factsOnly": True, "narrativePublished": False,
            "playerFeelingKnown": False, "battleOutcomeInferred": False,
        })
    return {"reputationReview": reputation, "relationshipReview": relationships, "chronicleFacts": archive}


def project_statistics_social_chapter(*, statistics: dict[str, Any], league_context: dict[str, Any]) -> dict[str, Any]:
    """Make scoreless Game bridge from the actual V1 statistics output shape.

    `league_context` is an external asserted snapshot, not verified by this code.
    The full source revision and roster must agree across statistics/match facts/
    pair social evidence; rejected input raises instead of producing false peace.
    """
    pair, source = _validate_statistics(statistics)
    context = pair.get("episodeContext")
    ledger = project_directional_episode_ledger(
        pair_evidence=pair, league_context=league_context,
        episode_context=context if context is not None else None)
    output = _episode_outputs(ledger)
    return {
        "modelVersion": VERSION,
        "sourceModels": source,
        "leagueContext": deepcopy(ledger["leagueContext"]),
        "sourceRevision": deepcopy(ledger["sourceRevision"]),
        "directionalLedger": ledger,
        **output,
        "readiness": {
            "eventEvidenceEligibility": ledger["leagueContext"]["eventBattleEligibility"],
            "unmappedEpisodes": len(ledger["excludedEpisodes"]),
            "episodeContext": "AVAILABLE" if context is not None else "UNAVAILABLE",
            "recordedCommandsAreNotVerifiedOutcomes": True,
            "reputationQualification": "UNCONFIGURED_POLICY",
            "relationshipQualification": "UNCONFIGURED_POLICY",
            "playerJudgments": "NOT_COLLECTED",
            "officialOutcome": "NOT_ESTABLISHED_BY_STATISTICS",
            "sourceAndLeagueAuthorityVerified": False,
        },
        "policy": {
            "readOnly": True, "localReviewOnly": True,
            "reputationScoringEnabled": False,
            "relationshipScoringEnabled": False,
            "chroniclePublicationEnabled": False,
            "bindingPlayerJudgmentsEnabled": False,
            "warRoomEffectsEnabled": False,
        },
    }


def _chapter_key(context: dict) -> tuple[str, str]:
    if not isinstance(context, dict) or not _txt(context.get("matchId")) or not _txt(context.get("gameId")):
        raise ValueError("Chapter requires Match/Game identity")
    return context["matchId"], context["gameId"]


def project_statistics_social_history(
    *, chapters: list[dict[str, Any]],
    reviewed_cases: list[dict[str, Any]] | None = None,
    reviewed_moments: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Current-revision composite read model, including explicit tombstones.

    The caller must provide the complete trusted accepted/withdrawn source set.
    This function detects conflicts but cannot independently fetch/check Firestore
    or authorize publication. Missing Battle order is *pending*, not date-sorted.
    """
    if not isinstance(chapters, list):
        raise ValueError("Chapters must be a complete input list")
    # Select revisions BEFORE interpreting old statistics. A withdrawn or
    # superseded source may be stale, damaged, or no longer retrievable; it must
    # not poison the current projection or cause old claims to reappear.
    indexed: dict[tuple[str, str], dict] = {}
    for item in chapters:
        if not isinstance(item, dict) or type(item.get("accepted")) is not bool:
            raise ValueError("Every source chapter needs an explicit acceptance decision")
        context = item.get("leagueContext")
        key = _chapter_key(context)
        revision = context.get("chapterRevision")
        if not _positive_int(revision):
            raise ValueError("Missing current chapter revision")
        if item["accepted"]:
            if not isinstance(item.get("statistics"), dict):
                raise ValueError("Accepted Game needs actual projected statistics")
        elif item.get("statistics") is not None:
            raise ValueError("Withdrawn Game tombstone must not supply statistics")
        previous = indexed.get(key)
        if previous and previous["leagueContext"]["chapterRevision"] == revision:
            if previous != item:
                raise ValueError("Conflicting Game revision content or acceptance")
            continue
        if not previous or previous["leagueContext"]["chapterRevision"] < revision:
            indexed[key] = deepcopy(item)
    active = [project_statistics_social_chapter(
                  statistics=item["statistics"], league_context=item["leagueContext"])
              for _, item in sorted(indexed.items()) if item["accepted"]]
    withdrawn = [{"matchId": key[0], "gameId": key[1],
                  "chapterRevision": item["leagueContext"]["chapterRevision"]}
                 for key, item in sorted(indexed.items()) if not item["accepted"]]
    selected = select_current_episode_chapters([
        {"accepted": True, "ledger": row["directionalLedger"]} for row in active])
    design = project_chronicle_moment_design(
        selected_chapters=selected, reviewed_cases=reviewed_cases,
        reviewed_moments=reviewed_moments)
    archive = [entry for row in active for entry in row["chronicleFacts"]]
    reputation = [entry for row in active for entry in row["reputationReview"]]
    relationship = [entry for row in active for entry in row["relationshipReview"]]
    # A Battle is league Match/Battle, not a technical skirmish. Game numbers
    # order its Games; distinct Battles need distinct historical Battle order.
    ordered_battles: dict[int, str] = {}
    ordered_games: set[tuple[str, int]] = set()
    ambiguity = set()
    for row in active:
        ctx = row["leagueContext"]
        battle, order, game_no = ctx["battleId"], ctx["battleOrder"], ctx["gameNumber"]
        if order is None:
            ambiguity.add("BATTLE_ORDER_UNAVAILABLE")
        elif order in ordered_battles and ordered_battles[order] != battle:
            ambiguity.add("CONFLICTING_BATTLE_ORDER")
        else:
            ordered_battles[order] = battle
        key = (battle, game_no)
        if key in ordered_games:
            ambiguity.add("CONFLICTING_GAME_SEQUENCE")
        ordered_games.add(key)
        if ctx["eventBattleEligibility"] != "ELIGIBLE":
            ambiguity.add("EVENT_BATTLE_ELIGIBILITY_PENDING_OR_INELIGIBLE")
    index = {(_chapter_key(row["leagueContext"])): row["leagueContext"] for row in active}
    def order_entry(entry: dict) -> tuple:
        ctx = index[(entry["matchId"], entry["gameId"])]
        return (ctx["battleOrder"] if ctx["battleOrder"] is not None else -1,
                ctx["gameNumber"], entry["startedAt"]["atMs"],
                entry["startedAt"]["operationOrdinal"] if entry["startedAt"]["operationOrdinal"] is not None else -1,
                entry["archiveId"])
    archive.sort(key=order_entry)
    if any(e["chronologyCoverage"] != "QUALIFIED" for e in archive):
        ambiguity.add("INCIDENT_CHRONOLOGY_UNAVAILABLE")
    for entry in archive:
        entry["historicalOrderVerifiedByBridge"] = False  # source + Event chronology need server authentication
    return {
        "modelVersion": VERSION, "sourceChapterCount": len(active),
        "activeGameChapters": [{"leagueContext": deepcopy(row["leagueContext"]),
                                "sourceRevision": deepcopy(row["sourceRevision"]),
                                "episodeCount": len(row["chronicleFacts"])} for row in active],
        "withdrawnGames": withdrawn,
        "reputationReview": reputation,
        "relationshipReview": relationship,
        "chronicleFacts": archive,
        "chronicleOpportunityDesign": design,
        "coverage": {"historyOrderInputComplete": not ambiguity,
                     "historyOrderAuthenticated": False,
                     "blockingReasons": sorted(ambiguity),
                     "absenceQualified": False,
                     "playerMappingAuthenticated": False,
                     "officialResultsAuthenticated": False,
                     "sourceAcceptanceAuthenticated": False,
                     "eventEligibilityAuthenticated": False},
        "policy": {"readOnly": True, "sourceCandidatesOnly": True,
                   "scoresOrStagesGenerated": False, "reputationScoringEnabled": False,
                   "relationshipScoringEnabled": False, "chroniclePublicationEnabled": False,
                   "judgmentSubmissionEnabled": False, "warRoomEffectsEnabled": False},
    }