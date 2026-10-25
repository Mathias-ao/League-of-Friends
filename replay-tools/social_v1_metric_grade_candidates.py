"""SOC-GRADE-02: pure, *inert* game-local metric-grade candidate preparation.

Uses existing #149 original-source descriptors and merged #142 Context V2.
This is not a semantic qualifier, owner grade policy, source-authority adapter,
historical evaluator, replay parser, or a path to official writes. No metric is
ADMITTED or assigned a score/band merely because an original request exists.
"""
from __future__ import annotations

from hashlib import sha256
import json

from social_v1_source_measurements import (
    VERSION as SOURCE_VERSION, METHOD as SOURCE_METHOD, _original_index,
)

VERSION = "AOF_SOCIAL_METRIC_GRADE_CANDIDATES_1"
CONTRACT = "AOF_SOCIAL_V1_SHARED_1"
CONTEXT = "AOF_SOCIAL_V1_CONTEXT_V2"
TRACKS = {
    "GALLANTRY": "REPUTATION", "CRUELTY": "REPUTATION",
    "CHIVALRY": "REPUTATION", "RIVALRY": "RELATIONSHIP",
    "HOSTILITY": "RELATIONSHIP", "BOND": "RELATIONSHIP",
}
# Candidate hypotheses, NOT approved metric-to-track assignments.
CANDIDATE_HYPOTHESES = {
    "DIRECTED_TARGET_COMMAND": {
        "GALLANTRY": ["PAST_ONLY_OPPONENT_CHALLENGE", "MEANINGFUL_OFFENSIVE_COMMITMENT"],
        "RIVALRY": ["MATERIAL_OPPONENT_SPECIFIC_COMPETITION"],
        "HOSTILITY": ["DISTINCT_PREEXISTING_COOPERATION_AND_ATTRIBUTABLE_RUPTURE"],
    },
    "DIRECTED_PRESSURE_REQUEST": {
        "CRUELTY": ["INDEPENDENT_PREENTRY_VICTIM_VULNERABILITY",
                    "MEANINGFUL_EXECUTED_PRESSURE_NOT_JUST_ORDER"],
        "RIVALRY": ["MATERIAL_COMPETITIVE_OPPORTUNITY"],
        "HOSTILITY": ["NONROUTINE_DISTINCT_DIRECTED_ANTAGONISM_AND_HISTORY"],
    },
    "DEFENSIVE_PARTICIPATION_REQUEST": {
        "CHIVALRY": ["PREEXISTING_RECIPIENT_THREAT", "MATERIAL_RECIPIENT_SPECIFIC_PROTECTION"],
        "BOND": ["MATERIAL_INDEPENDENT_RECIPIENT_ASSISTANCE"],
        "RIVALRY": ["ACTIVE_DEFENDER_CONTRIBUTION_NOT_PASSIVE_SURVIVAL"],
    },
    "REINFORCEMENT_REQUEST": {
        "CHIVALRY": ["PREEXISTING_RECIPIENT_THREAT", "MATERIAL_PROTECTION"],
        "BOND": ["MATERIAL_INDEPENDENT_RECIPIENT_ASSISTANCE"],
    },
}
SOURCE_METRICS = {
    "DIRECTED_TARGET_COMMAND": "AOF_ORIGINAL_TARGET_REQUEST_COUNT_V1",
    "DIRECTED_PRESSURE_REQUEST": "AOF_ORIGINAL_ECONOMIC_PRESSURE_REQUEST_COUNT_V1",
    "DEFENSIVE_PARTICIPATION_REQUEST": "AOF_ORIGINAL_DEFENSE_REQUEST_COUNT_V1",
    "REINFORCEMENT_REQUEST": "AOF_ORIGINAL_REINFORCEMENT_REQUEST_COUNT_V1",
}
STOP_ACTIONS = frozenset({"STOP", "DE_STOP", "CANCEL", "DE_CANCEL"})


def _digest(value):
    return sha256(json.dumps(value, sort_keys=True, ensure_ascii=False,
                             separators=(",", ":"), allow_nan=False).encode("utf-8")).hexdigest()


def _check(condition, reason):
    if not condition:
        raise ValueError(reason)


def _mode(statistics):
    """Only lobby-locked teams; FFA diplomacy is *never* fixed by a lobby flag."""
    facts = statistics.get("matchFacts") or {}
    team_rule = (facts.get("rules") or {}).get("lockTeams") or {}
    teams = (facts.get("players") or [])
    players = {p.get("playerId") for p in statistics.get("participants") or []}
    by_id = {r.get("playerId"): r.get("lobbyTeamIdRaw") for r in teams}
    if (team_rule.get("value") is not True or team_rule.get("status") != "DECODED"
            or set(by_id) != players or
            not all(type(v) is int and v > 0 for v in by_id.values())):
        return {"kind": "DYNAMIC_DIPLOMACY_OR_UNVERIFIED",
                "fixedAlignmentProven": False,
                "effectiveDiplomacyProven": False}
    ids = list(by_id.values())
    return {"kind": "LOCKED_TEAMS" if len(set(ids)) < len(ids)
            else "LOCKED_DISTINCT_TEAMS",
            "fixedAlignmentProven": True,
            "effectiveDiplomacyProven": False}


def prepare_social_metric_grade_candidates(
        *, statistics, context, source_measurements, action_events, game_scope,
        max_events=600000, max_candidates=10000):
    """Normalize verified-in-this-input source facts; all grade/effects PENDING.

    game_scope is caller-supplied metadata and remains explicitly untrusted:
    {battleId, gameId, gameGuid, authorityRevision}. Sol alone binds it to an
    authenticated READY Match/Game/current-source transaction later.
    """
    _check(isinstance(statistics, dict) and isinstance(context, dict)
           and isinstance(source_measurements, dict), "SOURCE_ARTIFACTS_REQUIRED")
    _check(context.get("version") == CONTEXT
           and context.get("compatibleSharedContract") == CONTRACT,
           "ACTUAL_CONTEXT_V2_REQUIRED")
    _check(context.get("trust", {}).get("officialLeagueAuthority") is False
           and context.get("trust", {}).get("socialClaimsQualified") is False,
           "CONTEXT_IMPERSONATES_AUTHORITY")
    _check(source_measurements.get("version") == SOURCE_VERSION
           and source_measurements.get("methodVersion") == SOURCE_METHOD
           and source_measurements.get("qualifiesAnySocialFact") is False
           and source_measurements.get("publicationAllowed") is False
           and source_measurements.get("officialLeagueAuthority") is False,
           "UNTRUSTED_SOURCE_MEASUREMENT_ADMISSION")
    rev = context.get("sourceRevision")
    _check(isinstance(rev, dict) and rev and rev == source_measurements.get("sourceRevision")
           and rev == {k: statistics.get("source", {}).get(k) for k in rev}
           and context.get("sourceContextRevision") ==
           source_measurements.get("sourceContextRevision"),
           "STALE_SOURCE_OR_CONTEXT_REVISION")
    _check(type(max_candidates) is int and 0 < max_candidates <= 20000,
           "CANDIDATE_BUDGET_REQUIRED")
    _check(isinstance(game_scope, dict)
           and set(game_scope) == {"battleId", "gameId", "gameGuid", "authorityRevision"}
           and all(isinstance(v, str) and v for v in game_scope.values()),
           "EXPLICIT_UNTRUSTED_GAME_SCOPE_REQUIRED")
    originals = _original_index(action_events, max_events)
    roster = {p.get("playerId") for p in statistics.get("participants") or []}
    _check(roster and all(type(p) is int and p > 0 for p in roster),
           "ORIGINAL_ROSTER_REQUIRED")
    neutral = {d["sourceDeedId"]: d for d in context.get("deedContexts") or []}
    mode = _mode(statistics)
    measurements = source_measurements.get("observations")
    _check(isinstance(measurements, list) and len(measurements) <= max_candidates,
           "MEASUREMENT_CANDIDATE_BUDGET_EXCEEDED")
    # A neutral measurement is a possible observation only. Never accept
    # client-added ADMITTED labels, fake grades or pre-entry semantic FACTS.
    nodes = []
    unique = {}
    for row in measurements:
        _check(isinstance(row, dict)
               and row.get("coverage") == "LIMITED"
               and row.get("qualifiesSocialFact") is False
               and row.get("methodVersion") == SOURCE_METHOD
               and row.get("kind") in SOURCE_METRICS,
               "MEASUREMENT_PRETENDS_TO_BE_QUALIFIED")
        did, actor, target = (row.get(k) for k in
                              ("sourceDeedId", "fromReplayPlayerId", "toReplayPlayerId"))
        d = neutral.get(did)
        _check(d is not None and type(actor) is int and type(target) is int
               and actor in roster and target in roster and actor != target,
               "UNBOUND_DIRECTIONAL_EPISODE")
        refs = row.get("sourceEventIds")
        _check(isinstance(refs, list) and refs and len(set(refs)) == len(refs)
               and set(refs).issubset(set(d["sourceEventIds"])),
               "ORIGINAL_EVENT_PROVENANCE_REQUIRED")
        _check(all(ref in originals and
                   originals[ref]["actorReplayPlayerId"] == actor and
                   d["firstAtMs"] <= originals[ref]["recordingAtMs"] <= d["lastAtMs"]
                   for ref in refs),
               "SOURCE_EVENT_ACTOR_CLOCK_MISMATCH")
        ordered = sorted((originals[ref] for ref in refs),
                         key=lambda r: (r["recordingAtMs"],
                                        -1 if r["operationOrdinal"] is None else r["operationOrdinal"],
                                        r["sourceEventId"]))
        reliable = (all(e["operationOrdinal"] is not None for e in ordered)
                    and len({(e["recordingAtMs"], e["operationOrdinal"])
                             for e in ordered}) == len(ordered))
        moment = row.get("firstSourceMoment")
        _check(isinstance(moment, dict)
               and moment.get("recordingAtMs") == ordered[0]["recordingAtMs"]
               and (moment.get("operationOrdinal") ==
                    (ordered[0]["operationOrdinal"] if reliable else None))
               and moment.get("order") == ("ORDERED" if reliable else "PARTIAL"),
               "ORIGINAL_POSITION_MISMATCH")
        _check(type(row.get("recordedCommandCount")) is int
               and row["recordedCommandCount"] == len(refs),
               "ORIGINAL_COMMAND_COUNT_MISMATCH")
        prior = row.get("preEntryRequestedActivity")
        _check(isinstance(prior, dict)
               and prior.get("windowEndExclusiveMs") == d["firstAtMs"]
               and type(prior.get("windowStartMs")) is int
               and 0 <= prior["windowStartMs"] <= d["firstAtMs"],
               "PREENTRY_WINDOW_NOT_PAST_ONLY")
        pre_refs = prior.get("sourceEventIds")
        _check(isinstance(pre_refs, list) and all(
            ref in originals and originals[ref]["actorReplayPlayerId"] == actor
            and prior["windowStartMs"] <= originals[ref]["recordingAtMs"] < d["firstAtMs"]
            for ref in pre_refs), "PREENTRY_HINDSIGHT_OR_ACTOR_MISMATCH")
        _check(prior.get("actorOriginalCommandCount") == len(pre_refs),
               "PREENTRY_COUNT_NOT_SOURCE_BACKED")
        prev = row.get("priorDirectedEpisodeCandidates") or {}
        valid_prior = {x["sourceDeedId"]: x for x in neutral.values()
                       if x["lastAtMs"] < d["firstAtMs"] and
                       x["lastAtMs"] >= prior["windowStartMs"]}
        for kind in ("sameDirectionSourceDeedIds", "oppositeDirectionSourceDeedIds"):
            _check(isinstance(prev.get(kind), list)
                   and all(p in valid_prior and p != did for p in prev[kind]),
                   "HISTORICAL_RECURRENCE_UNVERIFIED")
        ident = row.get("observationId")
        _check(isinstance(ident, str) and ident, "MISSING_SOURCE_OBSERVATION_ID")
        if ident in unique:
            _check(unique[ident] == row, "CONFLICTING_SOURCE_OBSERVATION")
            continue
        unique[ident] = row
        nodes.append({"source": row, "deed": d, "actor": actor, "target": target,
                      "refs": set(refs), "moment": moment})
    # Source-linked union only within the SAME original actor→counterpart
    # direction. Different participant directions never imply reciprocity.
    parent = list(range(len(nodes)))
    def root(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    def union(i, j):
        a, b = root(i), root(j)
        if a != b:
            parent[max(a, b)] = min(a, b)
    seen_events = {}
    seen_incidents = {}
    for i, n in enumerate(nodes):
        direction = (n["actor"], n["target"])
        for ref in n["refs"]:
            k = (direction, ref)
            if k in seen_events:
                union(i, seen_events[k])
            else:
                seen_events[k] = i
        for inc in n["deed"].get("sourceIncidentIds") or []:
            k = (direction, inc)
            if k in seen_incidents:
                union(i, seen_incidents[k])
            else:
                seen_incidents[k] = i
    components = {}
    for i, n in enumerate(nodes):
        components.setdefault(root(i), []).append(n)
    groups = []
    for members in components.values():
        actor, target = members[0]["actor"], members[0]["target"]
        refs = sorted(set().union(*(x["refs"] for x in members)))
        deeds = sorted({x["source"]["sourceDeedId"] for x in members})
        first, last = min(originals[e]["recordingAtMs"] for e in refs), max(
            originals[e]["recordingAtMs"] for e in refs)
        source_rows = sorted((originals[e] for e in refs),
                             key=lambda x: (x["recordingAtMs"],
                                            -1 if x["operationOrdinal"] is None else x["operationOrdinal"],
                                            x["sourceEventId"]))
        reliable = (all(e["operationOrdinal"] is not None for e in source_rows)
                    and len({(e["recordingAtMs"], e["operationOrdinal"])
                             for e in source_rows}) == len(source_rows))
        metric_rows = {}
        for member in members:
            src = member["source"]
            mid = SOURCE_METRICS[src["kind"]]
            metric_rows.setdefault(mid, set()).update(src["sourceEventIds"])
        measured = [{"metricDefinitionId": key, "rawValue": len(srcs),
                     "unit": "distinct_original_actor_commands",
                     "sourceEventIds": sorted(srcs),
                     "measurementMeaning": "OBSERVED_REQUEST_NOT_EXECUTION"}
                    for key, srcs in sorted(metric_rows.items())]
        hypotheses = {}
        for member in members:
            for track, needs in CANDIDATE_HYPOTHESES[member["source"]["kind"]].items():
                hypotheses.setdefault(track, set()).update(needs)
        opportunity = sorted({ref for n in members
            for ref in n["source"]["preEntryRequestedActivity"]["sourceEventIds"]})
        previous = sorted({ref for n in members for ref in
            n["source"]["priorDirectedEpisodeCandidates"]["sameDirectionSourceDeedIds"]})
        opposite = sorted({ref for n in members for ref in
            n["source"]["priorDirectedEpisodeCandidates"]["oppositeDirectionSourceDeedIds"]})
        detectors = sorted([
            {"kind": e["kind"], "sourceDetectorId": e["sourceDetectorId"],
             "sharedOriginalEventIds": sorted(set(refs) & set(e["sourceEventIds"]))}
            for e in context.get("engagementContexts") or []
            if set(refs) & set(e.get("sourceEventIds") or [])
        ], key=lambda d: (d["kind"], d["sourceDetectorId"]))
        no_op = sorted(set(ref for ref, event in originals.items()
            if event["actorReplayPlayerId"] == actor and first <= event["recordingAtMs"] <= last
            and event["originalAction"] in STOP_ACTIONS and ref not in refs))
        position = {"recordingAtMs": source_rows[0]["recordingAtMs"],
                    "operationOrdinal": source_rows[0]["operationOrdinal"] if reliable else None,
                    "order": "ORDERED" if reliable else "PARTIAL"}
        group_id = "metric-episode-" + _digest([
            VERSION, game_scope["battleId"], game_scope["gameId"],
            rev, context["sourceContextRevision"], actor, target, deeds, refs])
        groups.append({
            "candidateId": group_id,
            "independentContributionKey": group_id,
            "gameScope": dict(game_scope),
            "sourceRevision": dict(rev),
            "sourceContextRevision": context["sourceContextRevision"],
            "sourceMeasurementsRevision": source_measurements["projectionRevision"],
            "actorReplayPlayerId": actor, "counterpartReplayPlayerId": target,
            "sourceDeedIds": deeds, "sourceEventIds": refs,
            "firstSourceMoment": position,
            "window": {"startMs": first, "endMs": last},
            "mode": dict(mode),
            "rawMeasurements": measured,
            "originalMetricMethods": sorted({n["source"]["methodVersion"] for n in members}),
            "originalSourceLayer": "ORIGINAL_ACTOR_COMMANDS_WITH_INFERRED_DIRECTED_CONTEXT",
            "linkedDetectorCandidates": detectors,
            "priorDirectedEpisodeCandidateDeedIds": previous,
            "priorOppositeDirectedEpisodeCandidateDeedIds": opposite,
            "opportunity": {"status": "UNQUALIFIED",
                            "sourceEventIds": opportunity,
                            "meaning": "PRIOR_COMMAND_REQUESTS_NOT_OPPONENT_CAPACITY"},
            "counterevidenceCandidates": [
                {"kind": "STOP_OR_CANCEL_CONTEXT_NOT_PROVEN_CANCELLATION",
                 "sourceEventIds": no_op, "coverage": "LIMITED"}] if no_op else [],
            "trackHypotheses": [
                {"system": TRACKS[t], "track": t, "decision": "PENDING",
                 "missingEvidence": sorted(needs),
                 "proposedOnly": True, "noOfficialEligibility": True}
                for t, needs in sorted(hypotheses.items())],
            "coverage": {"tier": "LIMITED",
                         "limitations": ["REQUEST_NOT_EXECUTION",
                                         "BEHAVIORAL_MATERIALITY_UNAPPROVED",
                                         "OPPONENT_OPPORTUNITY_NOT_ESTABLISHED"]},
            "grade": {"decision": "PENDING", "bandId": None,
                      "ruleVersion": None, "units": None,
                      "historicalEffect": None},
            "explanation": ("Recorded, source-attributed command/context candidates "
                            "are grouped into one noncreditable episode; "
                            "neither severity nor a track grade is established."),
        })
    groups.sort(key=lambda g: (g["actorReplayPlayerId"], g["counterpartReplayPlayerId"],
                                g["window"]["startMs"], g["candidateId"]))
    # V2 placements and tribute requests are independently factual CONTEXT,
    # never a second social deed or inferred directed beneficiary.
    placements = []
    for p in context.get("placementContexts") or []:
        actor, ref = p.get("actorReplayPlayerId"), p.get("sourceEventId")
        e = originals.get(ref)
        if (e is None or type(actor) is not int or e["actorReplayPlayerId"] != actor
                or p.get("atMs") != e["recordingAtMs"]):
            continue
        placements.append({
            "sourceEventId": ref, "actorReplayPlayerId": actor,
            "originalMoment": {"recordingAtMs": e["recordingAtMs"],
                               "operationOrdinal": e["operationOrdinal"]},
            "buildingClass": p.get("buildingClass"),
            "rawBuildingId": p.get("rawBuildingId"),
            "sourceMeaning": "BUILD_PLACEMENT_REQUEST_NOT_COMPLETED_BUILDING",
            "counterpartReplayPlayerId": None,
            "grade": {"decision": "PENDING", "bandId": None},
            "castleOperationProven": False,
            "opponentSpecificTerritoryProven": False,
            "coverage": "LIMITED",
        })
    tribute = []
    for t in source_measurements.get("tributeRequestContexts") or []:
        actor, other, ref = (t.get(k) for k in
                             ("fromReplayPlayerId", "toReplayPlayerId", "sourceEventId"))
        e = originals.get(ref)
        _check(t.get("coverage") == "LIMITED" and
               t.get("qualifiesSocialFact") is False,
               "TRIBUTE_CANNOT_BE_PROMOTED_TO_HELP")
        if not e or e["actorReplayPlayerId"] != actor or other not in roster:
            continue
        tribute.append({"sourceEventId": ref, "actorReplayPlayerId": actor,
                        "counterpartReplayPlayerId": other,
                        "requestAmountStatus": t["requestAmountStatus"],
                        "decodedRequestAmount": t["decodedRequestAmount"],
                        "sourceMeaning": "TRIBUTE_REQUEST_NOT_DELIVERED_BENEFIT",
                        "grade": {"decision": "PENDING", "bandId": None},
                        "coverage": "LIMITED"})
    digest = _digest([VERSION, game_scope, rev, context["sourceContextRevision"],
                      source_measurements["projectionRevision"], groups,
                      placements, tribute, mode])
    return {"version": VERSION, "sharedContractCompatibility": CONTRACT,
            "ownerMatrixStatus": "EXACT_OWNER_MATRIX_NOT_SUPPLIED",
            "gradePolicyStatus": "UNAPPROVED_NO_DEFAULTS",
            "gameScope": dict(game_scope), "gameScopeAuthenticated": False,
            "sourceRevision": dict(rev),
            "sourceContextRevision": context["sourceContextRevision"],
            "sourceMeasurementsRevision": source_measurements["projectionRevision"],
            "projectionRevision": digest,
            "mode": mode, "candidateEpisodeGroups": groups,
            "neutralPlacementContexts": sorted(placements, key=lambda x: x["sourceEventId"]),
            "neutralTributeRequestContexts": sorted(tribute, key=lambda x: x["sourceEventId"]),
            "officialWrites": False, "publicationAllowed": False,
            "claims": [], "actorWitnesses": [], "receipts": [],
            "trackCredits": [], "significanceBands": [],
            "limitations": [
                "GAME_SCOPE_NOT_SERVER_AUTHENTICATED",
                "EXACT_OWNER_GRADE_MATRIX_NOT_RECEIVED",
                "COVERAGE_LIMITED_NEVER_PROMOTED_TO_ADMITTED",
                "NO_GRADE_ELIGIBILITY_OR_THRESHOLDS_APPROVED",
                "ONE_ORIGINAL_EPISODE_ONE_CANDIDATE_NOT_MULTIPLE_TRACK_CREDITS",
                "FFA_EFFECTIVE_DIPLOMACY_NOT_PROVEN_BY_LOBBY_TEAMS",
                "REQUESTS_NOT_EXECUTED_DAMAGE_RESCUE_SETTLED_TRANSFER_OR_COMPLETION",
                "CASTLE_V2_DISTANCE_NOT_OPERATIONAL_CASTLE_PROOF",
                "NO_PROVEN_COUNTERFACTUAL_OR_MATERIAL_RECIPROCITY",
            ]}
