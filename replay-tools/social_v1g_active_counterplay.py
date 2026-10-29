"""#182 narrow default-OFF defender-owned Rivalry source method.

This module is NOT a new scorer, historical claim converter, deployed method,
executed-combat witness, or subjective relationship path selector. It
reconstructs the #158/#173 producer from the unchanged original source and
emits only a versioned PRIVATE source-method candidate. Sol owns READY
authentication, Game/POV mapping, C1-key compatibility and #139 history.
"""
from copy import deepcopy
from hashlib import sha256
import json

from social_v1_source_grades import admit_contextual_source_grades
from social_v1_metric_grade_candidates import prepare_social_metric_grade_candidates
from social_v1_source_measurements import _original_index

VERSION = "AOF_SOC_V1G_DEFENDER_COUNTER_TARGET_V1_PROPOSED"
METHOD = "AOF_SV1G_PRIOR_RAID_DEFENDER_OWN_TARGET_1"
POLICY = "AOF_SOC_V1G_PRIVATE_METHOD_ONLY_1"
TARGET = "AOF_ORIGINAL_TARGET_REQUEST_COUNT_V1"
SKIRMISH_KINDS = frozenset(("SKIRMISH", "TECHNICAL_BATTLE"))
NOOPS = frozenset(("STOP", "DE_STOP", "CANCEL", "DE_CANCEL"))


def _check(ok, code):
    if not ok:
        raise ValueError(code)


def _digest(value):
    return sha256(json.dumps(value, sort_keys=True, separators=(",", ":"),
                             ensure_ascii=False, allow_nan=False).encode()).hexdigest()


def _relation(stats, actor, other):
    facts = stats.get("matchFacts") or {}
    teams = (facts.get("rules") or {}).get("lockTeams") or {}
    rows = facts.get("players") or []
    players = {p.get("playerId") for p in stats.get("participants") or []}
    team_ids = {p.get("playerId"): p.get("lobbyTeamIdRaw") for p in rows}
    if not (teams.get("status") == "DECODED" and teams.get("value") is True
            and len(team_ids) == len(rows) and players == set(team_ids)
            and all(type(t) is int and t > 0 for t in team_ids.values())):
        return "LOBBY_OR_EFFECTIVE_ALIGNMENT_UNPROVEN"
    return ("FIXED_OPPONENTS" if team_ids[actor] != team_ids[other]
            else "SAME_FIXED_TEAM")


def _own_target_refs(group, originals, statistics, raw_events):
    actor, other = group["actorReplayPlayerId"], group["counterpartReplayPlayerId"]
    allowed = set().union(*(set(m["sourceEventIds"]) for m in group["rawMeasurements"]
                            if m["metricDefinitionId"] == TARGET))
    deeds = {d["deedId"]: d for d in
             (statistics.get("pairSocialEvidence") or {}).get("deeds") or []}
    trace = []
    for did in group["sourceDeedIds"]:
        deed = deeds.get(did)
        _check(deed is not None, "SOURCE_DEED_NOT_CURRENT")
        for facet in deed.get("facets") or []:
            if (facet.get("kind"), facet.get("fromPlayerId"), facet.get("toPlayerId")) != (
                    "TARGETED_COMMAND", actor, other):
                continue
            for detail in facet.get("targetEvidence") or []:
                ref = detail.get("sourceEventId")
                original = originals.get(ref)
                controller = detail.get("controllerEvidence") or {}
                if (ref in allowed and original is not None
                    and original["actorReplayPlayerId"] == actor
                    and original["operationOrdinal"] is not None
                    and original["originalAction"] == "ORDER"
                    and raw_events[ref].get("targetInstanceId") == detail.get("targetInstanceId")
                    and type(detail.get("targetInstanceId")) is int
                    and controller.get("controllerPlayerId") == other
                    and isinstance(controller.get("sourceEventId"), str)
                    and controller["sourceEventId"]):
                    trace.append(ref)
    # This is a controller-qualified directed ORDER, *not* a proven hit,
    # executed movement, winner, enemy intent or inferred passive defense.
    return sorted(set(trace), key=lambda r: (
        originals[r]["recordingAtMs"], originals[r]["operationOrdinal"], r))


def _engagement(group, context, targeted, actor):
    detector_refs = {}
    for e in context.get("engagementContexts") or []:
        if e.get("kind") in SKIRMISH_KINDS:
            k = (e["kind"], e["sourceDetectorId"])
            x = detector_refs.setdefault(k, {"refs": set(), "actor": False})
            x["refs"].update(e.get("sourceEventIds") or [])
            x["actor"] = x["actor"] or actor in (e.get("contributorReplayPlayerIds") or [])
    selected = []
    for linked in group["linkedDetectorCandidates"]:
        key = (linked["kind"], linked["sourceDetectorId"])
        found = detector_refs.get(key)
        refs = set(linked["sharedOriginalEventIds"]) & set(targeted)
        if found and found["actor"] and refs and refs <= found["refs"]:
            selected.append({"kind": "ENGAGEMENT_" + key[0],
                             "sourceDetectorId": key[1],
                             "sourceEventIds": sorted(refs)})
    return sorted(selected, key=lambda x: (x["kind"], x["sourceDetectorId"]))


def _prior_raids(statistics, originals, attacker, victim, first, lookback_ms):
    earliest = max(0, first["recordingAtMs"] - lookback_ms)
    found = []
    for p in statistics.get("participants") or []:
        if p.get("playerId") != attacker:
            continue
        mil = ((p.get("military") or {}).get("engagements") or {})
        if mil.get("modelVersion") not in ("AOF_RAID_DETECTION_V3", None):
            continue
        for raid in ((mil.get("raidEvidence") or {}).get("initiatedEpisodes") or []):
            if (raid.get("attackerPlayerId"), raid.get("victimPlayerId")) != (
                    attacker, victim) or raid.get("modelVersion") != "AOF_RAID_DETECTION_V3":
                continue
            start = raid.get("startedAtMs")
            if type(start) is not int or not earliest <= start < first["recordingAtMs"]:
                continue
            prior = []
            for ref in sorted(set(raid.get("sourceEventIds") or [])):
                e = originals.get(ref)
                if (e is not None and e["actorReplayPlayerId"] == attacker
                        and e["operationOrdinal"] is not None
                        and earliest <= e["recordingAtMs"] <= first["recordingAtMs"]
                        and (e["recordingAtMs"], e["operationOrdinal"]) <
                        (first["recordingAtMs"], first["operationOrdinal"])
                        and e["originalAction"] not in NOOPS):
                    prior.append(ref)
            if len(prior) >= 2 and isinstance(raid.get("raidId"), str):
                found.append({"kind": "PREENTRY_ATTACKER_RAID_V3",
                              "sourceDetectorId": raid["raidId"],
                              "sourceEventIds": sorted(prior)})
    return sorted(found, key=lambda x: x["sourceDetectorId"])


def prepare_active_defender_counterplay(*, statistics, context, source_measurements,
                                        action_events, game_scope,
                                        lookback_ms=90000):
    """Proposed, no-authority method; all released side effects permanently false.

    Input replay source/linked Pair facets and context must be accepted by the
    unchanged #173 source reproducer. Does NOT manufacture current READY scope.
    """
    _check(type(lookback_ms) is int and 1000 <= lookback_ms <= 180000,
           "PROPOSED_PAST_ONLY_WINDOW_REQUIRED")
    old = admit_contextual_source_grades(
        statistics=statistics, context=context, source_measurements=source_measurements,
        action_events=action_events, game_scope=game_scope)
    canonical = prepare_social_metric_grade_candidates(
        statistics=statistics, context=context,
        source_measurements=source_measurements, action_events=action_events,
        game_scope=game_scope)
    groups = {g["candidateId"]: g for g in canonical["candidateEpisodeGroups"]}
    originals = _original_index(action_events, 600000)
    raw_events = {}
    for e in action_events:
        ref = e.get("eventId")
        if not isinstance(ref, str) or ref not in originals:
            continue
        if ref in raw_events:
            _check(raw_events[ref] == e, "CONFLICTING_ORIGINAL_TARGET_METADATA")
        raw_events[ref] = e
    episodes = []
    # New target-counterplay cannot re-award a Skirmish already used by the
    # accepted #173 Rivalry method in another source-connected component.
    consumed = {}
    for row in old["episodes"]:
        grade = next(g for g in row["perTrackGrades"] if g["track"] == "RIVALRY")
        if grade["decision"] == "SOURCE_ADMITTED":
            key = (row["actorReplayPlayerId"], row["counterpartReplayPlayerId"])
            consumed.setdefault(key, set()).update(
                (e["kind"], e["sourceDetectorId"]) for e in grade["corroboration"])
    for old_entry in old["episodes"]:
        group = groups[old_entry["sourceCandidateId"]]
        actor, other = group["actorReplayPlayerId"], group["counterpartReplayPlayerId"]
        reasons = []
        relation = _relation(statistics, actor, other)
        if relation != "FIXED_OPPONENTS":
            reasons.append("FIXED_OPPONENT_RELATION_OR_ROSTER_UNAVAILABLE")
        current = next(g for g in old_entry["perTrackGrades"] if g["track"] == "RIVALRY")
        if current["decision"] == "SOURCE_ADMITTED":
            reasons.append("EXISTING_RAID_RIVALRY_ALREADY_ADMITTED")
        if group["firstSourceMoment"]["order"] != "ORDERED":
            reasons.append("ORIGINAL_EVENT_ORDER_UNAVAILABLE")
        # STOP/CANCEL elsewhere in the broad episode may be tactical
        # repositioning, not cancellation of two actual target ORDERs.
        stop_context = bool(group.get("counterevidenceCandidates"))
        own = _own_target_refs(group, originals, statistics, raw_events)
        if len(own) < 2:
            reasons.append("TWO_CONTROLLER_BOUND_DEFENDER_OWN_TARGET_ORDERS_MISSING")
        engagement = _engagement(group, context, own, actor)
        if not engagement:
            reasons.append("ORIGINAL_DEFENDER_ENGAGEMENT_OVERLAP_MISSING")
        prior = (_prior_raids(statistics, originals, other, actor, originals[own[0]], lookback_ms)
                 if own else [])
        if not prior:
            reasons.append("TWO_OWN_PRIOR_OPPONENT_RAID_COMMANDS_MISSING")
        # One prior attacker raid and one promoted skirmish may be projected
        # into several different B deeds. Never farm several R admissions.
        if not reasons:
            k = (actor, other)
            detectors = {(e["kind"], e["sourceDetectorId"])
                         for e in engagement + prior}
            if detectors & consumed.get(k, set()):
                reasons.append("CORRELATED_SOURCE_DETECTOR_ALREADY_ADMITTED")
            else:
                consumed.setdefault(k, set()).update(detectors)
        decision = "SOURCE_ADMITTED" if not reasons else "PENDING"
        episodes.append({
            "sourceCandidateId": old_entry["sourceCandidateId"],
            "sourceIndependentContributionKey": old_entry["sourceIndependentContributionKey"],
            "actorReplayPlayerId": actor, "counterpartReplayPlayerId": other,
            "sourceEventIds": own, "sourceDeedIds": deepcopy(group["sourceDeedIds"]),
            "sourcePosition": deepcopy(old_entry["sourcePosition"]),
            "methodVersion": METHOD, "track": "RIVALRY",
            "decision": decision, "sourceCoverage": "LIMITED",
            "methodCoverage": "ADMITTED" if decision == "SOURCE_ADMITTED" else "PENDING",
            "gradeBandId": "ORDINARY" if decision == "SOURCE_ADMITTED" else None,
            "corroboration": engagement + prior,
            "missingEvidence": sorted(set(reasons)),
            "opportunity": {"pastOnlyAttackerPressureAvailable": bool(prior),
                            "observedResponseOrders": len(own),
                            "stopCancelContextObservedNotProvenCancellation": stop_context,
                            "approvedDenominator": None,
                            "mode": relation,
                            "meaning": "PAST_INFERRED_RAID_PLUS_DEFENDER_ORIGINAL_TARGET_REQUEST_NOT_DAMAGE"},
            "canonicalContributionKey": None, "canonicalClaim": None,
        })
    return {
        "version": VERSION, "policy": {"version": POLICY, "status": "PROPOSED_EMULATOR_ONLY",
                                       "lookbackMs": lookback_ms, "approvalRef": None},
        "sourceRevision": deepcopy(old["sourceRevision"]),
        "sourceContextRevision": old["sourceContextRevision"],
        "sourceMeasurementsRevision": old["sourceMeasurementsRevision"],
        "gameScope": deepcopy(old["gameScope"]),
        "gameScopeAuthenticated": False,
        "episodes": episodes,
        "sourceAdmittedCount": sum(x["decision"] == "SOURCE_ADMITTED" for x in episodes),
        "sourceProjectionRevision": _digest([VERSION, old["projectionRevision"], episodes]),
        "claims": [], "effects": [], "actorWitnesses": [], "receipts": [],
        "publicationAllowed": False, "officialWrites": False,
        "noAutomaticHistoricalImport": True,
    }
