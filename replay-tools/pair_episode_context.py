"""Additive context over the neutral pair ledger; never a statistics detector.

Recorded responses and independent ordered episodes are context, not extra deeds,
points, causal explanations, or proof of reciprocal attacks.
"""
from __future__ import annotations

from copy import deepcopy
from hashlib import sha256
import json
from typing import Any, Iterable

CONTEXT_VERSION = "AOF_PAIR_EPISODE_CONTEXT_V1"
LEDGER_VERSION = "AOF_PAIR_SOCIAL_EVIDENCE_V1"
RAID_VERSION = "AOF_RAID_DETECTION_V3"
ENGAGEMENT_VERSION = "AOF_ENGAGEMENT_STATISTICS_V4"
EXECUTION_VERSION = "AOF_EXECUTION_STATISTICS_V2"
FAMILIES = ("PRESSURE_RESPONSE", "DEFENSIVE_SUPPORT_WITH_PRESSURE", "RETURN_PRESSURE")


def _json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False)


def _refs(values: Iterable[Any]) -> list[str]:
    return sorted({value for value in values if isinstance(value, str) and value})


def _moment(event: dict) -> tuple[int, int] | None:
    at, ordinal = event.get("timestampMs"), event.get("operationOrdinal")
    if type(at) is int and at >= 0 and type(ordinal) is int and ordinal >= 0:
        return at, ordinal
    return None


def project_pair_episode_context(
    *, pair_evidence: dict[str, Any], raid_statistics: dict[str, dict],
    engagement_statistics: dict[str, dict], execution_statistics: dict[str, dict],
    action_events: Iterable[dict[str, Any]],
) -> dict[str, Any]:
    """Join already-qualified episodes without changing their identities/bounds."""
    if pair_evidence.get("modelVersion") != LEDGER_VERSION:
        raise ValueError("Unsupported pair evidence model")
    if pair_evidence.get("identityNamespace") != "CANONICAL_REPLAY_PLAYER_ID":
        raise ValueError("Explicit replay identity namespace required")
    revision = pair_evidence.get("gameScope") or {}
    required = ("replaySha256", "recordedEventsSha256", "recordedEventsVersion", "parserVersion") if "recordedEventsVersion" in revision else (
        "replaySha256", "canonicalManifestSha256", "canonicalSchemaVersion", "parserVersion")
    if not all(isinstance(revision.get(key), str) and revision[key] for key in required):
        raise ValueError("Recorded events revision provenance required" if "recordedEventsVersion" in revision
                         else "Canonical revision provenance required")
    players = set(pair_evidence.get("playerIds") or [])
    lookup = {}
    for event in action_events:
        ref = event.get("eventId")
        if not isinstance(ref, str) or not ref:
            continue
        if ref in lookup and lookup[ref] != event:
            raise ValueError("Conflicting canonical event identity: " + ref)
        lookup[ref] = event
    incidents = {}
    for row in pair_evidence.get("incidents") or []:
        key = row["incidentId"]
        if key in incidents and incidents[key] != row:
            raise ValueError("Conflicting incident identity")
        incidents[key] = row
    memberships: dict[str, list[dict]] = {}
    for deed in pair_evidence.get("deeds") or []:
        for key in set(deed.get("incidentIds") or []):
            existing = memberships.setdefault(key, [])
            if not any(row["deedId"] == deed["deedId"] for row in existing):
                existing.append(deed)
    diagnostics, annotations, sequences = [], {}, {}

    def warn(code: str, family: str, refs: Iterable[Any] = (), ids: Iterable[str] = ()) -> None:
        diagnostics.append({"code": code, "family": family,
                            "sourceEventIds": _refs(refs), "incidentIds": sorted(set(ids))})

    def bounds(row: dict) -> tuple[tuple[int, int], tuple[int, int]] | None:
        refs = row.get("sourceEventIds") or []
        if (row.get("chronologyCoverage") != "QUALIFIED" or not refs
                or any(ref not in lookup or _moment(lookup[ref]) is None for ref in refs)):
            return None
        moments = [_moment(lookup[ref]) for ref in refs]
        return min(moments), max(moments)

    def deed_for(row: dict) -> dict | None:
        matches = memberships.get(row["incidentId"], [])
        return matches[0] if len(matches) == 1 else None

    def pressure_direction(row: dict) -> tuple[int, int] | None:
        facets = [facet for facet in row.get("facets") or [] if facet.get("kind") == "ECONOMY_PRESSURE"]
        directions = {(facet.get("fromPlayerId"), facet.get("toPlayerId")) for facet in facets}
        if len(directions) != 1:
            return None
        a, b = next(iter(directions))
        if a not in players or b not in players or a == b:
            return None
        if sorted((a, b)) != row.get("pairPlayerIds"):
            return None
        if any(ref not in lookup or lookup[ref].get("actorPlayerId") != a
               for ref in row.get("sourceEventIds") or []):
            return None
        return a, b

    pressures = [row for row in incidents.values()
                 if row.get("family") == "DIRECTED_PRESSURE"
                 and row.get("sourceModelVersion") == RAID_VERSION and pressure_direction(row)]
    for row in pressures:
        if bounds(row) is None:
            warn("PRESSURE_CHRONOLOGY_UNAVAILABLE", "RETURN_PRESSURE",
                 row.get("sourceEventIds") or [], [row["incidentId"]])

    def put(destination: dict, family: str, data: dict) -> None:
        semantic = {"family": family, **data, "claimLayer": "INFERRED_EPISODE_CONTEXT",
                    "newDeed": False, "outcomes": "UNAVAILABLE",
                    "causalResponseEstablished": False, "reciprocalAttacksEstablished": False}
        key = "context-" + sha256(_json([CONTEXT_VERSION, revision, semantic]).encode()).hexdigest()
        destination[key] = {"contextId": key, **semantic}

    # Execution response rows name the attacker and original Raid start, but not
    # a Raid identity. Resolve against raw source copies and qualified incidents.
    raid_starts: dict[tuple[int, int, int], set[str]] = {}
    for stats in raid_statistics.values():
        for name in ("initiatedEpisodes", "receivedEpisodes"):
            for raw in (stats.get("raidEvidence") or {}).get(name, []):
                if raw.get("modelVersion") != RAID_VERSION or type(raw.get("startedAtMs")) is not int:
                    continue
                raw_refs = _refs(raw.get("sourceEventIds") or [])
                for row in pressures:
                    if (pressure_direction(row) == (raw.get("attackerPlayerId"), raw.get("victimPlayerId"))
                            and _refs(row["sourceEventIds"]) == raw_refs):
                        key = (*pressure_direction(row), raw["startedAtMs"])
                        raid_starts.setdefault(key, set()).add(row["incidentId"])
    response_matches: dict[str, dict[str, dict]] = {}
    for victim in sorted(players):
        stats = execution_statistics.get(str(victim), {})
        if stats.get("modelVersion") != EXECUTION_VERSION:
            continue
        response = stats.get("raidResponse") or {}
        limit = response.get("maximumResponseWindowMs")
        for raw in response.get("evidence") or []:
            ref = raw.get("sourceEventId")
            event = lookup.get(ref)
            start, at, latency = raw.get("raidStartedAtMs"), raw.get("responseAtMs"), raw.get("responseTimeMs")
            if (event is None or event.get("actorPlayerId") != victim or _moment(event) is None
                    or type(start) is not int or type(at) is not int or type(latency) is not int
                    or type(limit) is not int or limit < 0 or latency < 0 or latency > limit
                    or at - start != latency or event.get("timestampMs") != at
                    or event.get("sourceActionName") != raw.get("responseAction")):
                warn("RESPONSE_SOURCE_UNAVAILABLE", "PRESSURE_RESPONSE", [ref])
                continue
            ids = raid_starts.get((raw.get("attackerPlayerId"), victim, start), set())
            valid = []
            for key in ids:
                row = incidents[key]
                interval = bounds(row)
                if interval is not None and interval[0] <= _moment(event) and deed_for(row):
                    valid.append(row)
            if not valid:
                warn("RESPONSE_PRESSURE_UNAVAILABLE", "PRESSURE_RESPONSE", [ref], ids)
            for row in valid:
                response_matches.setdefault(ref, {})[row["incidentId"]] = {
                    "pressure": row, "response": raw, "victim": victim}
    for ref, matches in sorted(response_matches.items()):
        if len(matches) != 1:
            warn("AMBIGUOUS_RESPONSE_PRESSURE", "PRESSURE_RESPONSE", [ref], matches)
            continue
        match = next(iter(matches.values()))
        row, raw, victim = match["pressure"], match["response"], match["victim"]
        actor = pressure_direction(row)[0]
        put(annotations, "PRESSURE_RESPONSE", {
            "pressureIncidentId": row["incidentId"], "pressureDeedId": deed_for(row)["deedId"],
            "pairPlayerIds": sorted((actor, victim)),
            "pressureDirection": {"fromPlayerId": actor, "toPlayerId": victim},
            "responseActorPlayerId": victim, "responseSourceEventId": ref,
            "responseMoment": {"atMs": lookup[ref]["timestampMs"],
                               "operationOrdinal": lookup[ref]["operationOrdinal"]},
            "responseCommandType": raw["responseAction"], "sourceLatencyMs": raw["responseTimeMs"],
            "sourceLatencyMeaning": "existing_execution_timestamp_difference_not_causal_reaction_time",
            "sourceModelVersion": EXECUTION_VERSION,
            "relationContext": row["relationContext"],
            "sourceEventIds": _refs([*row["sourceEventIds"], ref]),
            "associationBasis": "unique_existing_execution_response_to_attributed_raid",
        })

    # Temporal overlap alone never creates helper-versus-attacker attribution.
    # Require an existing defensive-assistance parent and the exact B/C contest
    # inside the same source Skirmish, already represented in a pressure deed.
    raw_support = {}
    for stats in engagement_statistics.values():
        if stats.get("engagementModelVersion") != ENGAGEMENT_VERSION:
            continue
        for name in ("defensiveAssistsGiven", "defensiveAssistsReceived"):
            for raw in (stats.get("engagementEvidence") or {}).get(name, []):
                if raw.get("modelVersion") == ENGAGEMENT_VERSION:
                    raw_support[_json(raw)] = raw
    for support in incidents.values():
        if (support.get("family") != "ALLIED_SUPPORT"
                or support.get("relationContext") != "FIXED_ALLIES"
                or bounds(support) is None or deed_for(support) is None):
            continue
        for facet in support.get("facets") or []:
            if facet.get("kind") != "DEFENSIVE_PARTICIPATION":
                continue
            helper, defended = facet.get("fromPlayerId"), facet.get("toPlayerId")
            for raw in raw_support.values():
                if (raw.get("helperPlayerId") != helper or raw.get("defendedPlayerId") != defended
                        or _refs(raw.get("sourceEventIds") or []) != _refs(facet.get("sourceEventIds") or [])):
                    continue
                parent_refs = _refs(raw.get("parentSourceEventIds") or [])
                parent = raw.get("sourceSkirmishId")
                if (not isinstance(parent, str) or not parent or not parent_refs
                        or any(ref not in lookup or _moment(lookup[ref]) is None for ref in parent_refs)
                        or not set(support["sourceEventIds"]).issubset(parent_refs)):
                    warn("SUPPORT_PARENT_UNAVAILABLE", "DEFENSIVE_SUPPORT_WITH_PRESSURE",
                         parent_refs, [support["incidentId"]])
                    continue
                for pressure in pressures:
                    actor, victim = pressure_direction(pressure)
                    if (victim != defended or actor == helper
                            or pressure.get("relationContext") != "FIXED_OPPONENTS"
                            or bounds(pressure) is None or deed_for(pressure) is None):
                        continue
                    pressure_deed = deed_for(pressure)
                    contests = [incidents[key] for key in pressure_deed["incidentIds"]
                                if key in incidents and incidents[key].get("family") == "LOCAL_CONTEST"
                                and incidents[key].get("pairPlayerIds") == sorted((actor, defended))
                                and any(ref.get("family") == "LOCAL_CONTEST" and ref.get("evidenceId") == parent
                                        for ref in incidents[key].get("sourceReferences") or [])]
                    if (not contests or not set(pressure["sourceEventIds"]) & set(parent_refs)
                            or bounds(support)[1] < bounds(pressure)[0]):
                        continue
                    put(annotations, "DEFENSIVE_SUPPORT_WITH_PRESSURE", {
                        "supportIncidentId": support["incidentId"],
                        "supportDeedId": deed_for(support)["deedId"],
                        "pressureIncidentId": pressure["incidentId"],
                        "pressureDeedId": pressure_deed["deedId"],
                        "pairPlayerIds": sorted((helper, defended)),
                        "supportDirection": {"fromPlayerId": helper, "toPlayerId": defended},
                        "pressureDirection": {"fromPlayerId": actor, "toPlayerId": defended},
                        "sourceEventIds": _refs([*support["sourceEventIds"], *pressure["sourceEventIds"]]),
                        "parentSourceEventIds": parent_refs,
                        "contestIncidentIds": sorted(row["incidentId"] for row in contests),
                        "sourceModelVersion": ENGAGEMENT_VERSION,
                        "associationBasis": "same_inferred_defensive_clash_with_exact_opponent_pair",
                        "directHelperAttackOnPressureActorEstablished": False,
                        "relationContext": "FIXED_ALLIES",
                        "continuousPressureEstablished": False,
                    })

    # At most one predecessor per subsequent episode, never an all-to-all list.
    # Intervening same-direction/overlapping/unordered episodes block the link.
    by_pair: dict[tuple[int, int], list[dict]] = {}
    for row in pressures:
        by_pair.setdefault(tuple(row["pairPlayerIds"]), []).append(row)
    for pair, rows in sorted(by_pair.items()):
        if any(bounds(row) is None for row in rows):
            continue
        rows.sort(key=lambda row: (bounds(row)[0], row["incidentId"]))
        for index, current in enumerate(rows):
            if index == 0:
                continue
            prior = rows[index - 1]
            start = bounds(current)[0]
            if sum(bounds(row)[0] == start for row in rows) != 1:
                warn("AMBIGUOUS_PRESSURE_ORDER", "RETURN_PRESSURE", (), [current["incidentId"]])
                continue
            if sum(bounds(row)[0] == bounds(prior)[0] for row in rows) != 1:
                warn("AMBIGUOUS_PRESSURE_ORDER", "RETURN_PRESSURE", (), [prior["incidentId"]])
                continue
            if pressure_direction(prior) != tuple(reversed(pressure_direction(current))):
                continue
            first, second = deed_for(prior), deed_for(current)
            if (bounds(prior)[1] >= start or any(bounds(row)[1] >= start for row in rows[:index])
                    or first is None or second is None or first["deedId"] == second["deedId"]
                    or first.get("independence") != "SOURCE_EPISODE"
                    or second.get("independence") != "SOURCE_EPISODE"
                    or set(prior["sourceEventIds"]) & set(current["sourceEventIds"])):
                warn("RETURN_PRESSURE_INDEPENDENCE_UNAVAILABLE", "RETURN_PRESSURE", (),
                     [prior["incidentId"], current["incidentId"]])
                continue
            put(sequences, "RETURN_PRESSURE", {
                "pairPlayerIds": list(pair),
                "previousPressureIncidentId": prior["incidentId"],
                "previousPressureDeedId": first["deedId"],
                "returnPressureIncidentId": current["incidentId"],
                "returnPressureDeedId": second["deedId"],
                "previousDirection": dict(zip(("fromPlayerId", "toPlayerId"), pressure_direction(prior))),
                "returnDirection": dict(zip(("fromPlayerId", "toPlayerId"), pressure_direction(current))),
                "previousEndedAt": {"atMs": bounds(prior)[1][0], "operationOrdinal": bounds(prior)[1][1]},
                "returnStartedAt": {"atMs": start[0], "operationOrdinal": start[1]},
                "sourceEventIds": _refs([*prior["sourceEventIds"], *current["sourceEventIds"]]),
                "relationContext": current["relationContext"],
                "associationBasis": "next_independent_reverse_pressure_episode_in_recorded_game",
                "sourceModelVersion": RAID_VERSION,
            })

    source_coverage = {(row["fromPlayerId"], row["toPlayerId"], row["family"]): row["status"]
                       for row in pair_evidence.get("coverage") or []}
    coverage = []
    for a in sorted(players):
        for b in sorted(players - {a}):
            for family in FAMILIES:
                dependencies = ([(a, b, "ALLIED_SUPPORT")] if family == "DEFENSIVE_SUPPORT_WITH_PRESSURE"
                                else [(a, b, "DIRECTED_PRESSURE")])
                if family == "RETURN_PRESSURE":
                    dependencies.append((b, a, "DIRECTED_PRESSURE"))
                states = [source_coverage.get(key, "UNAVAILABLE") for key in dependencies]
                status = "NOT_APPLICABLE" if "NOT_APPLICABLE" in states else "UNAVAILABLE"
                reason = "source_family_unavailable"
                if status == "NOT_APPLICABLE":
                    reason = "source_family_not_applicable"
                elif all(value == "QUALIFIED" for value in states):
                    if (family == "DEFENSIVE_SUPPORT_WITH_PRESSURE" and not any(
                            source_coverage.get((other, b, "DIRECTED_PRESSURE")) == "QUALIFIED"
                            and source_coverage.get((other, b, "LOCAL_CONTEST")) == "QUALIFIED"
                            for other in players - {a, b})):
                        reason = "pressure_and_contest_context_unavailable"
                    elif (family != "PRESSURE_RESPONSE"
                            or execution_statistics.get(str(b), {}).get("modelVersion") == EXECUTION_VERSION):
                        status, reason = "QUALIFIED", "supported_positive_context_projection"
                    else:
                        reason = "execution_model_unavailable"
                coverage.append({"family": family, "fromPlayerId": a, "toPlayerId": b,
                                 "status": status, "reason": reason,
                                 "qualificationScope": "POSITIVE_CONTEXT_ONLY",
                                 "absenceQualified": False,
                                 "contextCompletenessEstablished": False})
    return {
        "modelVersion": CONTEXT_VERSION, "sourceEvidenceModelVersion": LEDGER_VERSION,
        "identityNamespace": "CANONICAL_REPLAY_PLAYER_ID",
        "gameScope": deepcopy(revision),
        "annotations": sorted(annotations.values(), key=lambda row: row["contextId"]),
        "sequences": sorted(sequences.values(), key=lambda row: row["contextId"]),
        "coverage": coverage,
        "diagnostics": sorted({_json(row): row for row in diagnostics}.values(), key=_json),
        "policy": {"newDeedsCreated": False, "relationshipScoringEnabled": False,
                   "reputationScoringEnabled": False, "absenceMeaningEnabled": False,
                   "causalInterpretationEnabled": False, "crossGameOrderingEnabled": False,
                   "activityInterpretationEnabled": False, "effectiveDiplomacyEnabled": False},
    }
