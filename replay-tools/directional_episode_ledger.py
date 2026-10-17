"""Read-only, replay-free directional Relationship evidence review (NOT scoring).

Consumes the retained AOF_PAIR_SOCIAL_EVIDENCE_V1 deeds and optional
AOF_PAIR_EPISODE_CONTEXT_V1 annotations. The caller supplies authoritative
league identity/eligibility/revision snapshots; this function cannot authenticate
those snapshots, publish them, award progression or establish game outcomes.

One source deed stays one episode even when it has multiple directional facets.
Observations are source-backed *candidates*, not qualified Relationship effects:
commands, local overlap and shared targets do not prove hostility, assistance
success, intent, reciprocity, substantive significance, or non-contact.
"""
from __future__ import annotations

from copy import deepcopy
from hashlib import sha256
import json
from typing import Any

DIRECTIONAL_EPISODE_LEDGER_VERSION = "AOF_DIRECTIONAL_EPISODE_LEDGER_V1"
PAIR_EVIDENCE_VERSION = "AOF_PAIR_SOCIAL_EVIDENCE_V1"
EPISODE_CONTEXT_VERSION = "AOF_PAIR_EPISODE_CONTEXT_V1"
ELIGIBILITY = {"ELIGIBLE", "INELIGIBLE", "PENDING"}
SOURCE_KEYS = {
    "canonical": ("replaySha256", "canonicalManifestSha256", "canonicalSchemaVersion", "parserVersion"),
    "native": ("replaySha256", "recordedEventsSha256", "recordedEventsVersion", "parserVersion"),
}
# Candidate means 'inspect for an independently qualified effect', never award.
DIRECTION_KINDS = {
    "ECONOMY_PRESSURE": ("DIRECTED_PRESSURE", "RIVALRY"),
    "TARGETED_COMMAND": ("TARGETED_COMMAND", "RIVALRY"),
    "REINFORCEMENT_COMMANDS": ("DIRECTED_ASSISTANCE_COMMANDS", "BOND"),
    "DEFENSIVE_PARTICIPATION": ("DIRECTED_DEFENSIVE_PARTICIPATION", "BOND"),
}


def _json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False)


def _digest(value: Any) -> str:
    return sha256(_json(value).encode("utf-8")).hexdigest()


def _text(value: Any) -> bool:
    return isinstance(value, str) and bool(value)


def _nonnegative(value: Any) -> bool:
    return type(value) is int and value >= 0


def _refs(value: Any) -> list[str]:
    if not isinstance(value, list) or any(not _text(v) for v in value):
        raise ValueError("Source references must be nonempty strings in a list")
    return sorted(set(value))


def _moment(value: Any) -> dict[str, int | None]:
    if not isinstance(value, dict) or not _nonnegative(value.get("atMs")):
        raise ValueError("Source moment is missing a valid game clock")
    ordinal = value.get("operationOrdinal")
    if ordinal is not None and not _nonnegative(ordinal):
        raise ValueError("Invalid source operation ordinal")
    return {"atMs": value["atMs"], "operationOrdinal": ordinal}


def _unique_rows(rows: Any, field: str) -> dict[str, dict]:
    if not isinstance(rows, list):
        raise ValueError("Missing source evidence rows")
    result: dict[str, dict] = {}
    for row in rows:
        if not isinstance(row, dict) or not _text(row.get(field)):
            raise ValueError("Invalid source evidence identity")
        key = row[field]
        if key in result and result[key] != row:
            raise ValueError("Conflicting source evidence identity")
        result[key] = row
    return result


def _source_revision(pair_evidence: dict) -> dict:
    if pair_evidence.get("modelVersion") != PAIR_EVIDENCE_VERSION or pair_evidence.get("identityNamespace") != "CANONICAL_REPLAY_PLAYER_ID":
        raise ValueError("Unsupported pair evidence contract")
    scope = pair_evidence.get("gameScope")
    if not isinstance(scope, dict):
        raise ValueError("Missing source revision")
    native = "recordedEventsVersion" in scope or "recordedEventsSha256" in scope
    if native and any(k in scope for k in ("canonicalManifestSha256", "canonicalSchemaVersion")):
        raise ValueError("Ambiguous mixed replay provenance")
    fields = SOURCE_KEYS["native" if native else "canonical"]
    if any(not _text(scope.get(k)) for k in fields):
        raise ValueError("Incomplete source revision")
    if native and scope["recordedEventsVersion"] != "AOF_RECORDED_EVENTS_V1":
        raise ValueError("Unsupported recorded events revision")
    # A ledger from a different immutable source must never be relabeled with
    # current Game metadata or a different canonical/native artifact revision.
    reported = pair_evidence.get("source")
    if not isinstance(reported, dict) or any(reported.get(key) != scope[key] for key in fields):
        raise ValueError("Pair evidence/source revision mismatch")
    return deepcopy(scope)


def _league_context(context: dict, source_players: list[int]) -> tuple[dict, dict[int, str]]:
    if not isinstance(context, dict):
        raise ValueError("League context is required")
    for key in ("matchId", "battleId", "gameId", "playerMappingRevision"):
        if not _text(context.get(key)):
            raise ValueError("Missing authoritative league context: " + key)
    if context.get("eventId") is not None and not _text(context["eventId"]):
        raise ValueError("Invalid Event identity")
    if context.get("seasonId") is not None and not _text(context["seasonId"]):
        raise ValueError("Invalid Season identity")
    if context.get("eventBattleEligibility") not in ELIGIBILITY:
        raise ValueError("Event-Battle eligibility must be independently declared")
    if context["eventBattleEligibility"] != "PENDING" and not _text(context.get("eventEligibilitySourceRef")):
        raise ValueError("Verified Event eligibility requires a source reference")
    if context.get("eventBattleEligibility") == "ELIGIBLE" and not _text(context.get("eventId")):
        raise ValueError("Eligible Event Battle must identify its Event")
    for key in ("chapterRevision", "gameNumber"):
        if not _nonnegative(context.get(key)) or context[key] < 1:
            raise ValueError("Invalid league revision or Game order: " + key)
    result_revision = context.get("resultRevision")
    if not (_nonnegative(result_revision) and result_revision >= 1):
        if not (result_revision is None and context.get("officialOutcomeQualification") == "UNRESOLVED"):
            raise ValueError("Invalid official result revision")
    if context.get("battleOrder") is not None and not _nonnegative(context["battleOrder"]):
        raise ValueError("Invalid Battle chronology")
    mapping: dict[int, str] = {}
    used: set[str] = set()
    if not isinstance(context.get("playerMapping"), list):
        raise ValueError("Explicit replay-to-league identity mapping is required")
    for row in context["playerMapping"]:
        if not isinstance(row, dict):
            raise ValueError("Invalid player binding")
        player, league = row.get("replayPlayerId"), row.get("leaguePlayerId")
        if not _nonnegative(player) or player not in source_players or not _text(league):
            raise ValueError("Unqualified league identity binding")
        if player in mapping or league in used:
            raise ValueError("Conflicting or duplicated player identity binding")
        mapping[player] = league
        used.add(league)
    # Do not accept unrelated/scoring metadata into the identity digest. The
    # eligibility declaration is independent of whether this Battle earns points.
    snapshot = {k: deepcopy(context.get(k)) for k in (
        "matchId", "battleId", "gameId", "eventId", "seasonId", "chapterRevision",
        "resultRevision", "officialOutcomeQualification", "gameNumber", "battleOrder", "playerMappingRevision",
        "eventBattleEligibility", "eventEligibilitySourceRef",
    )}
    snapshot["playerMapping"] = [{"replayPlayerId": k, "leaguePlayerId": mapping[k]} for k in sorted(mapping)]
    return snapshot, mapping


def project_directional_episode_ledger(
    *, pair_evidence: dict[str, Any], league_context: dict[str, Any],
    episode_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Return neutral, provenance-bound pair episodes; produce NO Relationship state.

    An asserted Event/Battle context is *input*, not an eligibility decision made
    by this projector. Incomplete league mappings exclude affected pair episodes;
    source corrections require the caller to replace the old chapter, not append it.
    """
    if not isinstance(pair_evidence, dict):
        raise ValueError("Pair evidence is required")
    scope = _source_revision(pair_evidence)
    players = pair_evidence.get("playerIds")
    if (not isinstance(players, list) or not players
            or any(not _nonnegative(p) or p == 0 for p in players)
            or len(players) != len(set(players))):
        raise ValueError("Invalid replay player roster")
    chapter, binding = _league_context(league_context, players)
    if episode_context is not None:
        if (not isinstance(episode_context, dict)
                or episode_context.get("modelVersion") != EPISODE_CONTEXT_VERSION
                or episode_context.get("sourceEvidenceModelVersion") != PAIR_EVIDENCE_VERSION
                or episode_context.get("identityNamespace") != "CANONICAL_REPLAY_PLAYER_ID"
                or episode_context.get("gameScope") != scope):
            raise ValueError("Episode context is not bound to this source revision")

    observations = _unique_rows(pair_evidence.get("observations"), "sourceEventId")
    incidents = _unique_rows(pair_evidence.get("incidents"), "incidentId")
    deeds = _unique_rows(pair_evidence.get("deeds"), "deedId")
    context_records = []
    if episode_context is not None:
        context_records = list(_unique_rows(episode_context.get("annotations"), "contextId").values())
        context_records += list(_unique_rows(episode_context.get("sequences"), "contextId").values())
        _unique_rows(context_records, "contextId")  # disallow cross-section conflicts

    episodes: list[dict] = []
    excluded: list[dict] = []
    for deed in deeds.values():
        pair = deed.get("pairPlayerIds")
        if not isinstance(pair, list) or len(pair) != 2 or any(p not in players for p in pair) or pair != sorted(pair) or pair[0] == pair[1]:
            raise ValueError("Invalid deed pair attribution")
        incident_ids = _refs(deed.get("incidentIds"))
        if not incident_ids or any(ref not in incidents or incidents[ref].get("pairPlayerIds") != pair for ref in incident_ids):
            raise ValueError("Deed incident lineage is unavailable")
        refs = _refs(deed.get("sourceEventIds"))
        if not refs or any(ref not in observations for ref in refs):
            raise ValueError("Deed source observations are unavailable")
        if any(not set(_refs(incidents[i].get("sourceEventIds"))).issubset(refs) for i in incident_ids):
            raise ValueError("Incident lineage references outside the source deed")
        start, end = _moment(deed.get("startedAt")), _moment(deed.get("endedAt"))
        if start["atMs"] > end["atMs"]:
            raise ValueError("Inverted deed time window")
        if pair[0] not in binding or pair[1] not in binding:
            excluded.append({"deedId": deed["deedId"], "pairReplayPlayerIds": deepcopy(pair),
                             "sourceEventIds": refs, "reason": "LEAGUE_PAIR_BINDING_UNAVAILABLE"})
            continue
        actions: list[dict] = []
        for facet in deed.get("facets") or []:
            if not isinstance(facet, dict) or not _text(facet.get("kind")):
                raise ValueError("Invalid episode facet")
            kind = facet["kind"]
            frefs = _refs(facet.get("sourceEventIds")) if "sourceEventIds" in facet else []
            if not set(frefs).issubset(refs):
                raise ValueError("Facet is not supported by its source deed")
            if kind in DIRECTION_KINDS:
                actor, target = facet.get("fromPlayerId"), facet.get("toPlayerId")
                if (not _nonnegative(actor) or not _nonnegative(target)
                        or sorted([actor, target]) != pair):
                    raise ValueError("Facet direction does not match pair")
                if not frefs or any(observations[ref].get("actorPlayerId") != actor for ref in frefs):
                    raise ValueError("Facet actor attribution disagrees with source")
                evidence_kind, possible_track = DIRECTION_KINDS[kind]
                actions.append({
                    "kind": evidence_kind,
                    "fromLeaguePlayerId": binding[actor], "toLeaguePlayerId": binding[target],
                    "sourceEventIds": frefs, "candidateTrackForReview": possible_track,
                    "qualification": "SUBSTANTIVE_RELATIONSHIP_EFFECT_UNVERIFIED",
                })
            elif kind == "LOCAL_COMMAND_OVERLAP":
                actor, other = facet.get("contributorPlayerId"), facet.get("otherPlayerId")
                if (not _nonnegative(actor) or not _nonnegative(other)
                        or sorted([actor, other]) != pair
                        or facet.get("targetedActionEstablished") is not False):
                    raise ValueError("Invalid local overlap attribution")
                # This is participation, not a directed action against the other.
                actions.append({"kind": "LOCAL_COMMAND_OVERLAP", "participantLeaguePlayerId": binding[actor],
                                "otherLeaguePlayerId": binding[other], "sourceEventIds": frefs,
                                "candidateTrackForReview": None, "qualification": "NOT_DIRECTED_TARGETING"})
            elif kind == "SHARED_OPPONENT_PARTICIPATION":
                contributors = facet.get("contributions")
                if (not isinstance(contributors, list) or len(contributors) != 2
                        or not all(isinstance(c, dict) for c in contributors)
                        or {c.get("contributorPlayerId") for c in contributors} != set(pair)):
                    raise ValueError("Shared target lacks exact pair contributors")
                third = facet.get("targetPlayerId")
                if third not in players or third in pair:
                    raise ValueError("Shared target is not an independent opponent")
                copies = []
                for contribution in contributors:
                    r = _refs(contribution.get("sourceEventIds"))
                    a = contribution["contributorPlayerId"]
                    if not r or not set(r).issubset(refs) or any(observations[x].get("actorPlayerId") != a for x in r):
                        raise ValueError("Unqualified shared target contributor")
                    copies.append({"leaguePlayerId": binding[a], "sourceEventIds": r})
                actions.append({"kind": "SHARED_OPPONENT_PARTICIPATION",
                                "contributors": sorted(copies, key=lambda x: x["leaguePlayerId"]),
                                "commonTargetLeaguePlayerId": binding.get(third),
                                "commonTargetReplayPlayerId": third,
                                "sourceEventIds": refs,
                                "candidateTrackForReview": None,
                                "qualification": "SHARED_TARGET_NOT_DIRECTED_ASSISTANCE"})
            else:
                # Preserve unsupported facets with their source identity but never
                # quietly grant an inferred track candidate.
                actions.append({"kind": "UNSUPPORTED_SOURCE_FACET", "sourceFacetKind": kind,
                                "sourceEventIds": frefs, "candidateTrackForReview": None,
                                "qualification": "UNAVAILABLE"})
        actions = sorted({_json(row): row for row in actions}.values(), key=_json)
        links = []
        for record in context_records:
            if deed["deedId"] in [value for key, value in record.items()
                                    if key.endswith("DeedId") and isinstance(value, str)]:
                links.append({"contextId": record["contextId"], "family": record.get("family"),
                              "sourceEventIds": _refs(record.get("sourceEventIds", []))})
        if (deed.get("independence") not in ("SOURCE_EPISODE", "UNRESOLVED")):
            raise ValueError("Unrecognized episode independence qualification")
        eid = "rel-episode-" + _digest([DIRECTIONAL_EPISODE_LEDGER_VERSION, scope, chapter, deed["deedId"]])
        episodes.append({
            "episodeId": eid, "sourceDeedId": deed["deedId"],
            "sourceIncidentIds": incident_ids, "sourceEventIds": refs,
            "pairReplayPlayerIds": deepcopy(pair),
            "pairLeaguePlayerIds": sorted([binding[pair[0]], binding[pair[1]]]),
            "startedAt": start, "endedAt": end,
            "chronologyCoverage": ("QUALIFIED" if start["operationOrdinal"] is not None
                                   and end["operationOrdinal"] is not None
                                   and all(incidents[i].get("chronologyCoverage") == "QUALIFIED" for i in incident_ids)
                                   else "UNAVAILABLE"),
            "relationContext": deed.get("relationContext", "UNKNOWN"),
            "independence": deed["independence"],
            "sourceFacets": deepcopy(deed.get("facets", [])),
            "activeWindows": deepcopy(deed.get("activeWindows", [])),
            "directionalObservations": actions,
            "episodeContextLinks": sorted(links, key=lambda x: x["contextId"]),
            "relationshipContributionDirection": None,
            "relationshipEffect": "UNCONFIGURED_POLICY",
            "reciprocityCredit": None,
        })
    episodes.sort(key=lambda row: (row["startedAt"]["atMs"],
                                   row["startedAt"]["operationOrdinal"] if row["startedAt"]["operationOrdinal"] is not None else -1,
                                   row["episodeId"]))
    return {
        "modelVersion": DIRECTIONAL_EPISODE_LEDGER_VERSION,
        "sourceEvidenceModelVersion": PAIR_EVIDENCE_VERSION,
        "sourceRevision": scope,
        "leagueContext": chapter,
        "episodes": episodes,
        "excludedEpisodes": sorted(excluded, key=lambda row: row["deedId"]),
        "coverage": {"positiveEpisodesOnly": True, "absenceQualified": False,
                     "sourceEpisodeContextAvailable": episode_context is not None,
                     "leagueBattleOrderSupplied": chapter["battleOrder"] is not None,
                     "crossGameChronologyEstablished": False,
                     "eventEligibilityVerifiedByProjector": False},
        "policy": {"readOnly": True, "productionScoringEnabled": False,
                   "relationshipStageEstablished": False,
                   "ordinaryAndExceptionalEffectsEnabled": False,
                   "warRoomEffectsEnabled": False,
                   "eventAllowanceConsumptionEnabled": False},
    }


def select_current_episode_chapters(chapters: list[dict[str, Any]]) -> dict[str, Any]:
    """Pure revision selection, not an authoritative source-acceptance decision.

    The caller supplies a complete source-backed chapter set. The latest
    chapterRevision for each Match/Game wins; a voided/withdrawn latest chapter
    removes that Game's current evidence. Old immutable source evidence is not
    altered. Never use processing arrival order to choose a revision.
    """
    if not isinstance(chapters, list):
        raise ValueError("Explicit chapter set required")
    current: dict[tuple[str, str], dict] = {}
    for item in chapters:
        if not isinstance(item, dict) or type(item.get("accepted")) is not bool:
            raise ValueError("Explicit active source acceptance status required")
        ledger = item.get("ledger")
        if not isinstance(ledger, dict) or ledger.get("modelVersion") != DIRECTIONAL_EPISODE_LEDGER_VERSION:
            raise ValueError("Unknown directional ledger version")
        context = ledger.get("leagueContext") or {}
        if (not _text(context.get("matchId")) or not _text(context.get("gameId"))
                or not _nonnegative(context.get("chapterRevision")) or context["chapterRevision"] < 1):
            raise ValueError("Unqualified Game chapter revision")
        key = (context["matchId"], context["gameId"])
        previous = current.get(key)
        if previous and previous["ledger"]["leagueContext"]["chapterRevision"] == context["chapterRevision"]:
            if previous != item:
                raise ValueError("Conflicting current Game chapter revision")
            continue
        if not previous or context["chapterRevision"] > previous["ledger"]["leagueContext"]["chapterRevision"]:
            current[key] = deepcopy(item)
    active = [item["ledger"] for key, item in sorted(current.items()) if item["accepted"]]
    withdrawn = [{"matchId": key[0], "gameId": key[1],
                  "chapterRevision": item["ledger"]["leagueContext"]["chapterRevision"]}
                 for key, item in sorted(current.items()) if not item["accepted"]]
    return {"modelVersion": DIRECTIONAL_EPISODE_LEDGER_VERSION,
            "currentChapters": active, "withdrawnGames": withdrawn,
            "policy": {"readOnly": True, "scoreless": True,
                       "authoritativeSourceAcceptanceVerified": False,
                       "crossGameChronologyEstablished": False}}