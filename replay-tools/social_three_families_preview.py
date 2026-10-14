"""Inactive V1 fixed-alignment social-evidence admission and Chronicle preview.

Consumes *existing* Pair Social Evidence V1 (no detector duplication). Neither
this module nor its caller may promote its candidate claims into awards.
"""
from __future__ import annotations

from hashlib import sha256
import json
from typing import Any

VERSION = "AOF_SOCIAL_THREE_FAMILIES_PREVIEW_V1"
PAIRS_VERSION = "AOF_PAIR_SOCIAL_EVIDENCE_V1"
FACETS = {
    "ECONOMY_PRESSURE": ("RAIDS_PRESSURE", "FIXED_OPPONENTS"),
    "TARGETED_COMMAND": ("CONTEST_COUNTERPLAY", "FIXED_OPPONENTS"),
    "LOCAL_COMMAND_OVERLAP": ("CONTEST_COUNTERPLAY", "FIXED_OPPONENTS"),
    "DEFENSIVE_PARTICIPATION": ("DEFENSIVE_ASSISTANCE", "FIXED_ALLIES"),
    "REINFORCEMENT_COMMANDS": ("DEFENSIVE_ASSISTANCE", "FIXED_ALLIES"),
}


def _record(value: Any) -> bool:
    return isinstance(value, dict)


def _moment(value: Any) -> tuple[int, int]:
    if not _record(value):
        raise ValueError("source_moment_missing")
    time, ordinal = value.get("atMs"), value.get("operationOrdinal")
    if type(time) is not int or type(ordinal) is not int or min(time, ordinal) < 0:
        raise ValueError("source_moment_unqualified")
    return time, ordinal


def _refs(values: Any) -> list[str]:
    if not isinstance(values, list) or not values or any(not isinstance(r, str) or not r for r in values):
        raise ValueError("source_references_missing")
    return sorted(set(values))


def _key(parts: Any) -> str:
    return sha256(json.dumps(parts, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()).hexdigest()


def project_three_families_preview(statistics: dict[str, Any]) -> dict[str, Any]:
    """Return evidence-linked review candidates; NEVER award/stage/Chronicle credits.

    This intentionally validates source-event bounds again at the adapter seam.
    It cannot authenticate an active Firestore source, result, or league identity.
    """
    if not _record(statistics):
        raise ValueError("statistics_required")
    ledger = statistics.get("pairSocialEvidence")
    if not _record(ledger) or ledger.get("modelVersion") != PAIRS_VERSION or ledger.get("identityNamespace") != "CANONICAL_REPLAY_PLAYER_ID":
        raise ValueError("supported_pair_social_evidence_required")
    source, scope = statistics.get("source"), ledger.get("gameScope")
    if not _record(source) or not _record(scope) or not isinstance(source.get("replaySha256"), str):
        raise ValueError("source_revision_required")
    # Recorded Events and canonical manifests are distinct, non-interchangeable sources.
    native = "recordedEventsVersion" in source
    keys = ("replaySha256", "recordedEventsSha256", "recordedEventsVersion", "parserVersion") if native else (
        "replaySha256", "canonicalManifestSha256", "canonicalSchemaVersion", "parserVersion")
    if any(not isinstance(source.get(k), str) or not source[k] or scope.get(k) != source[k] for k in keys):
        raise ValueError("source_revision_mismatch")
    if native and "canonicalManifestSha256" in scope or not native and "recordedEventsSha256" in scope:
        raise ValueError("source_revision_cross_namespace")
    ids = ledger.get("playerIds")
    if not isinstance(ids, list) or len(ids) < 2 or len(set(map(str, ids))) != len(ids) or any(type(x) is not int or x < 1 for x in ids):
        raise ValueError("player_roster_invalid")
    roster = set(ids)
    observations: dict[str, dict] = {}
    if not isinstance(ledger.get("observations"), list) or not isinstance(ledger.get("deeds"), list):
        raise ValueError("source_evidence_incomplete")
    for raw in ledger["observations"]:
        if not _record(raw) or not isinstance(raw.get("sourceEventId"), str) or raw.get("actorPlayerId") not in roster:
            raise ValueError("observation_invalid")
        ref = raw["sourceEventId"]
        _moment(raw.get("moment"))
        if ref in observations and observations[ref] != raw:
            raise ValueError("conflicting_source_event")
        observations[ref] = raw
    deeds, candidates = {}, {}
    for deed in ledger["deeds"]:
        if not _record(deed) or not isinstance(deed.get("deedId"), str) or not deed["deedId"]:
            raise ValueError("deed_identity_missing")
        deed_id = deed["deedId"]
        if deed_id in deeds:
            if deeds[deed_id] != deed:
                raise ValueError("conflicting_deed_identity")
            continue
        pair = deed.get("pairPlayerIds")
        if not isinstance(pair, list) or len(pair) != 2 or pair != sorted(set(pair)) or not set(pair).issubset(roster):
            raise ValueError("deed_pair_invalid")
        refs = _refs(deed.get("sourceEventIds"))
        if any(ref not in observations for ref in refs):
            raise ValueError("missing_deed_source")
        recorded_moments = [ _moment(observations[ref]["moment"]) for ref in refs ]
        if _moment(deed.get("startedAt")) != min(recorded_moments) or _moment(deed.get("endedAt")) != max(recorded_moments):
            raise ValueError("deed_source_time_bounds_mismatch")
        if deed.get("independence") != "SOURCE_EPISODE":
            # Retain uncertain data in the neutral ledger, not as an eligible claim.
            deeds[deed_id] = deed
            continue
        facets = deed.get("facets")
        if not isinstance(facets, list):
            raise ValueError("deed_facets_missing")
        for facet in facets:
            if not _record(facet) or facet.get("kind") not in FACETS:
                continue
            family, relation = FACETS[facet["kind"]]
            if deed.get("relationContext") != relation:
                continue
            facet_refs = _refs(facet.get("sourceEventIds"))
            if not set(facet_refs).issubset(refs):
                raise ValueError("facet_deed_source_mismatch")
            if facet["kind"] == "LOCAL_COMMAND_OVERLAP":
                continue  # local command overlap is never independent directed conduct
            actor, other = facet.get("fromPlayerId"), facet.get("toPlayerId")
            if actor not in pair or other not in pair or actor == other:
                raise ValueError("facet_direction_invalid")
            if any(observations[ref]["actorPlayerId"] != actor for ref in facet_refs):
                raise ValueError("facet_actor_source_mismatch")
            if family == "DEFENSIVE_ASSISTANCE":
                tracks = ("BOND", "CHIVALRY")
            elif family == "RAIDS_PRESSURE":
                tracks = ("RIVALRY", "GALLANTRY", "CRUELTY")
            else:
                tracks = ("RIVALRY",)
            for track in tracks:
                key = (deed_id, actor, other, track)
                prior = candidates.get(key)
                if prior is None:
                    prior = {"candidateId": VERSION + ":" + _key([scope, key]),
                             "sourceDeedId": deed_id, "family": family,
                             "actorReplayPlayerId": actor, "counterpartReplayPlayerId": other,
                             "track": track, "sourceEventIds": [], "sourceFacetKinds": [],
                             "status": "PENDING_SUBSTANTIVE_QUALIFICATION"}
                    candidates[key] = prior
                prior["sourceEventIds"] = sorted(set(prior["sourceEventIds"] + facet_refs))
                prior["sourceFacetKinds"] = sorted(set(prior["sourceFacetKinds"] + [facet["kind"]]))
        deeds[deed_id] = deed
    return {"modelVersion": VERSION, "source": dict(scope),
            "deedsReviewed": len(deeds), "candidateClaims": sorted(candidates.values(), key=lambda row: row["candidateId"]),
            "status": "PRIVATE_EVIDENCE_REVIEW_ONLY",
            "policy": {"qualifiedProgression": False, "productionScoringEnabled": False,
                       "playerJudgmentsEnabled": False, "chroniclePublicationEnabled": False,
                       "absenceQualified": False, "leagueIdentityAuthenticated": False}}


def preview_chronicle_result_line(*, actor: str, opponent: str, map_name: str,
                                  result: str, team_battle: bool = False) -> dict[str, Any]:
    """Offline copy prototype; official result/map and authorizations must be checked elsewhere."""
    if any(not isinstance(x, str) or not x.strip() for x in (actor, opponent, map_name)):
        raise ValueError("official_names_and_map_required")
    if result not in {"WIN", "LOSS", "ALLY_WIN", "ALLY_LOSS", "UNRESOLVED"}:
        raise ValueError("result_unqualified")
    if result == "UNRESOLVED":
        return {"status": "PENDING_OFFICIAL_RESULT", "sentence": None, "extraEntries": []}
    name, foe, place = actor.strip(), opponent.strip(), map_name.strip()
    if team_battle and result in {"WIN", "LOSS"} or not team_battle and result in {"ALLY_WIN", "ALLY_LOSS"}:
        raise ValueError("unsupported_result_topology")
    if result == "WIN":
        sentence = f"{name} defeated {foe} on {place}."
    elif result == "LOSS":
        sentence = f"{name} was defeated by {foe} on {place}."
    elif result == "ALLY_WIN":
        sentence = f"{name}'s side defeated {foe}'s on {place}."
    else:
        sentence = f"{name}'s side was defeated by {foe}'s on {place}."
    return {"status": "PREVIEW_ONLY", "sentence": sentence, "extraEntries": [],
            "meaning": "one_result_sentence_until_authenticated_historical_credit_or_acknowledgment"}