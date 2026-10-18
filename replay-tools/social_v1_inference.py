"""AoF #126: PURE, PROPOSED, source-linked six-track ordinary inference.

Consumes Worker #124's neutral, explicitly versioned V1/V2 context projection and the
merged SHARED_1 source/claim contract. Does not authenticate evidence, parse a
recording, decide objective execution, assign units, persist or publish scores.
The server integrator MUST admit original READY sources, prove all externally
attested witness refs/methods, map replay players and fence current revisions.

All numerical predicates and significance bands are explicit call parameters,
never an approved or implicit scoring rule.
"""
from __future__ import annotations

from copy import deepcopy
from hashlib import sha256
import json
import math

from social_v1_contract import CONTRACT, validate_record

VERSION = "AOF_SOCIAL_V1_INFERENCE_1"
# Exact supported neutral output contracts; V2 only adds Castle diagnostics.
# No territorial/castle decision or numeric threshold is imported as social evidence.
CONTEXT_VERSIONS = frozenset({"AOF_SOCIAL_V1_CONTEXT_V1", "AOF_SOCIAL_V1_CONTEXT_V2"})
ACTOR_OWNED_FACETS = frozenset({
    "TARGETED_COMMAND", "ECONOMY_PRESSURE",
    "DEFENSIVE_PARTICIPATION", "REINFORCEMENT_COMMANDS",
})

# Exact semantic branches. These are proposed ordinary *inference*, not evidence
# of a kill, military execution, a real rescue, a completed Castle or a motive.
FAMILIES = {
    "PAIR_CONTEST": ("RELATIONSHIP", "RIVALRY", "STRENGTHEN"),
    "DIRECTED_HELP": ("RELATIONSHIP", "BOND", "STRENGTHEN"),
    "DISTINCT_RUPTURE_ANTAGONISM": ("RELATIONSHIP", "HOSTILITY", "STRENGTHEN"),
    "DARING_OFFENSE": ("REPUTATION", "GALLANTRY", "STRENGTHEN"),
    "PREEXISTING_VULNERABILITY_PRESSURE": ("REPUTATION", "CRUELTY", "STRENGTHEN"),
    "NOTEWORTHY_DIRECTED_PROTECTION": ("REPUTATION", "CHIVALRY", "STRENGTHEN"),
    "RECONCILIATORY_HELP": ("RELATIONSHIP", "HOSTILITY", "WEAKEN"),
    "SERIOUS_BOND_ANTAGONISM": ("RELATIONSHIP", "BOND", "WEAKEN"),
    "QUALIFIED_DEESCALATION": ("RELATIONSHIP", "RIVALRY", "WEAKEN"),
}

# Exact typed source-bound measurement semantics. A fact is supplied ONLY by a
# trusted, future source-admission adapter, never by browser/user testimony.
# Its pre-entry window is checked against the historical episode start.
FACTS = {
    "PREENTRY_CHALLENGE", "PREENTRY_VULNERABILITY", "PREENTRY_RECIPIENT_THREAT",
    "MEANINGFUL_OFFENSIVE_COMMITMENT", "MEANINGFUL_DIRECTED_HELP",
    "DISTINCT_PREENTRY_COOPERATION", "ATTRIBUTABLE_RUPTURE",
    "POST_RUPTURE_DIRECTED_PRESSURE", "RECONCILIATION_CONTEXT",
    "SERIOUS_BOND_HARM_CONTEXT", "EXPLICIT_DEESCALATION_CONTEXT",
}
PREENTRY = {"PREENTRY_CHALLENGE", "PREENTRY_VULNERABILITY",
            "PREENTRY_RECIPIENT_THREAT", "DISTINCT_PREENTRY_COOPERATION"}
MANDATORY = {
    "PAIR_CONTEST": (),
    "DIRECTED_HELP": ("MEANINGFUL_DIRECTED_HELP",),
    "DISTINCT_RUPTURE_ANTAGONISM": ("DISTINCT_PREENTRY_COOPERATION",
        "ATTRIBUTABLE_RUPTURE", "POST_RUPTURE_DIRECTED_PRESSURE"),
    "DARING_OFFENSE": ("PREENTRY_CHALLENGE", "MEANINGFUL_OFFENSIVE_COMMITMENT"),
    "PREEXISTING_VULNERABILITY_PRESSURE": (
        "PREENTRY_VULNERABILITY", "MEANINGFUL_OFFENSIVE_COMMITMENT"),
    "NOTEWORTHY_DIRECTED_PROTECTION": (
        "PREENTRY_RECIPIENT_THREAT", "MEANINGFUL_DIRECTED_HELP"),
    "RECONCILIATORY_HELP": ("MEANINGFUL_DIRECTED_HELP", "RECONCILIATION_CONTEXT"),
    "SERIOUS_BOND_ANTAGONISM": ("DISTINCT_PREENTRY_COOPERATION",
        "ATTRIBUTABLE_RUPTURE", "POST_RUPTURE_DIRECTED_PRESSURE",
        "SERIOUS_BOND_HARM_CONTEXT"),
    "QUALIFIED_DEESCALATION": ("EXPLICIT_DEESCALATION_CONTEXT",),
}
TRACKS = {"REPUTATION": {"GALLANTRY", "CRUELTY", "CHIVALRY"},
          "RELATIONSHIP": {"RIVALRY", "HOSTILITY", "BOND"}}


def _hash(value):
    return sha256(json.dumps(value, ensure_ascii=False, sort_keys=True,
                             separators=(",", ":"), allow_nan=False).encode("utf-8")).hexdigest()


def _require(ok, reason):
    if not ok:
        raise ValueError(reason)


def _positive(v):
    return type(v) in (int, float) and math.isfinite(v) and v > 0


def validate_inference_configuration(config):
    """No model defaults. Private preview only, pending explicit owner approval."""
    _require(isinstance(config, dict) and set(config) == {
        "version", "policy", "rules", "measurementMethods"}, "INFERENCE_CONFIG_INCOMPLETE")
    _require(isinstance(config["version"], str) and config["version"], "CONFIG_VERSION_REQUIRED")
    p = config["policy"]
    _require(isinstance(p, dict) and set(p) == {
        "policyVersion", "configurationVersion", "status", "approvalRef"}, "INVALID_POLICY")
    _require(p["status"] == "PROPOSED" and p["approvalRef"] is None,
             "QUALIFIER_ACCEPTS_PROPOSED_PREVIEWS_ONLY")
    _require(isinstance(config["measurementMethods"], dict) and config["measurementMethods"],
             "MEASUREMENT_METHOD_REGISTRY_REQUIRED")
    for name, method in config["measurementMethods"].items():
        _require(isinstance(name, str) and name and isinstance(method, str) and method,
                 "INVALID_METHOD_REGISTRY")
    _require(isinstance(config["rules"], dict), "RULES_REQUIRED")
    for family, rule in config["rules"].items():
        _require(family in FAMILIES and isinstance(rule, dict)
                 and set(rule) == {"ruleId", "significanceBandId", "minIndependentSourceEvents",
                                   "measurementMinimums"},
                 "INVALID_FAMILY_RULE")
        _require(isinstance(rule["ruleId"], str) and rule["ruleId"]
                 and isinstance(rule["significanceBandId"], str) and rule["significanceBandId"],
                 "RULE_AND_BAND_IDS_REQUIRED")
        _require(type(rule["minIndependentSourceEvents"]) is int
                 and rule["minIndependentSourceEvents"] > 0, "BAD_INDEPENDENT_EVENT_REQUIREMENT")
        minimums = rule["measurementMinimums"]
        _require(isinstance(minimums, dict) and set(minimums) == set(MANDATORY[family]),
                 "MEASUREMENT_THRESHOLD_MISSING")
        _require(all(_positive(v) for v in minimums.values()), "INVALID_MEASUREMENT_THRESHOLD")
    return config


def _fact_index(facts, *, authority, bindings, source_events, observations):
    """Validate typed provenance/clock, not factual authenticity of an external model."""
    index = {}
    for f in facts:
        _require(isinstance(f, dict) and set(f) == {
            "kind", "fromReplayPlayerId", "toReplayPlayerId", "value", "measuredAtMs",
            "windowStartMs", "windowEndMs", "sourceEventIds", "sourceAuthority",
            "methodVersion", "coverage"}, "MALFORMED_MEASUREMENT")
        _require(f["kind"] in FACTS and f["sourceAuthority"] == authority
                 and f["methodVersion"] in bindings["methodVersions"],
                 "UNADMITTED_MEASUREMENT_PROVENANCE")
        _require(_positive(f["value"]) and type(f["measuredAtMs"]) is int
                 and type(f["windowStartMs"]) is int and type(f["windowEndMs"]) is int
                 and 0 <= f["windowStartMs"] <= f["windowEndMs"] <= f["measuredAtMs"],
                 "INVALID_MEASUREMENT_CLOCK_OR_VALUE")
        _require(f["coverage"] in {"ADMITTED", "LIMITED", "INSUFFICIENT"},
                 "UNRECOGNIZED_MEASUREMENT_COVERAGE")
        _require(type(f["fromReplayPlayerId"]) is int and type(f["toReplayPlayerId"]) is int
                 and f["fromReplayPlayerId"] != f["toReplayPlayerId"]
                 and f["fromReplayPlayerId"] in bindings["players"]
                 and f["toReplayPlayerId"] in bindings["players"],
                 "UNBOUND_MEASUREMENT_PAIR")
        ids = f["sourceEventIds"]
        _require(isinstance(ids, list) and ids and len(ids) == len(set(ids))
                 and all(isinstance(x, str) and x and x in source_events
                         and x in observations for x in ids),
                 "UNVERIFIABLE_MEASUREMENT_EVENTS")
        _require(all(f["windowStartMs"] <= observations[e]["atMs"] <=
                     f["windowEndMs"] for e in ids),
                 "SOURCE_EVENTS_OUTSIDE_MEASUREMENT_WINDOW")
        k = (f["kind"], f["fromReplayPlayerId"], f["toReplayPlayerId"])
        if f in index.get(k, []):
            continue
        index.setdefault(k, []).append(f)
    return index


def _source_events(context):
    """Refs must exist in #124 projection, not claimed into existence by a caller."""
    events = set()
    for d in context["deedContexts"]:
        events.update(d["sourceEventIds"])
    for e in context["engagementContexts"]:
        events.update(e["sourceEventIds"])
    for p in context["placementContexts"]:
        events.add(p["sourceEventId"])
    for g in context["goldInfluenceContexts"]:
        for c in g.get("clusters") or []:
            events.update(c.get("contributingPlacementSourceEventIds") or [])
    return events


def _ref(kind, id_, revision, authority):
    return {"kind": kind, "id": id_, "revision": revision,
            "digest": _hash([CONTRACT, kind, id_, revision, authority])}


def _pos(order, facets, observations):
    """Chronology is anchored in *original actor-owned events*, not indexes or upload time.

    The earliest source-backed (atMs, operationOrdinal) supplies a genuine
    operation anchor. A missing/duplicated or contradictory ordinal makes this
    particular position PARTIAL, even when the league Game order is known.
    """
    refs = sorted({ref for f in facets if f["kind"] in ACTOR_OWNED_FACETS
                   for ref in f["sourceEventIds"]})
    anchors = [observations[r] for r in refs]
    usable = (order["order"] == "ORDERED" and bool(refs)
              and bool(order["leagueOrderKey"])
              and all(type(x["ordinal"]) is int and 0 <= x["ordinal"] <= 9007199254740991
                      for x in anchors)
              and len({(x["atMs"], x["ordinal"]) for x in anchors}) == len(anchors))
    first = min(anchors, key=lambda x: (x["atMs"], x["ordinal"] if x["ordinal"] is not None else -1)) if anchors else None
    return {"leagueOrderKey": order["leagueOrderKey"], "gameNumber": order["gameNumber"],
            "recordingAtMs": first["atMs"] if first else None,
            "operationOrdinal": first["ordinal"] if first and usable else None,
            "order": "ORDERED" if usable else ("UNKNOWN" if order["order"] == "UNKNOWN" else "PARTIAL")}


def _normalize_bindings(snapshot, bindings, config):
    _require(isinstance(bindings, dict) and set(bindings) == {
        "players", "methodVersions"}, "SERVER_BINDINGS_REQUIRED")
    _require(isinstance(bindings["players"], dict) and all(
        type(k) is int and isinstance(v, str) and v for k, v in bindings["players"].items()
    ), "INVALID_REPLAY_BINDINGS")
    _require(len(set(bindings["players"].values())) == len(bindings["players"])
             and set(bindings["players"].values()) == {r["playerId"] for r in snapshot["roster"]},
             "AMBIGUOUS_REPLAY_BINDINGS")
    _require(set(bindings["methodVersions"]) == set(config["measurementMethods"].values()),
             "METHOD_REGISTRY_NOT_MATCHED")
    return bindings


def _has_linked_detector(deed, context, kinds, own_events, frm=None, to=None):
    lookup = {(x["kind"], x["sourceDetectorId"]): x for x in context["engagementContexts"]}
    for link in deed["linkedEngagementDetectors"]:
        x = lookup.get((link["kind"], link["sourceDetectorId"]))
        if not x or x["kind"] not in kinds:
            continue
        if frm is not None and (x.get("fromReplayPlayerId") != frm
                               or x.get("toReplayPlayerId") != to):
            continue
        if set(x["sourceEventIds"]).intersection(own_events):
            return True
    return False


def _base_family(deed, context, family, actor, target, directional_facets):
    # #124's flattened facetKinds cannot establish *which* participant acted.
    # The original source deed retains each facet's exact actor and event refs.
    facets = {f["kind"] for f in directional_facets}
    own_events = {x for f in directional_facets for x in f["sourceEventIds"]}
    directed = bool(own_events)
    contest = directed and ("TARGETED_COMMAND" in facets or
                            "DEFENSIVE_PARTICIPATION" in facets) and (
        "LOCAL_COMMAND_OVERLAP" in facets and
        _has_linked_detector(deed, context, {"SKIRMISH", "TECHNICAL_BATTLE"}, own_events))
    pressure = directed and ("ECONOMY_PRESSURE" in facets or
                            ("TARGETED_COMMAND" in facets and
                             _has_linked_detector(deed, context, {"SKIRMISH", "TECHNICAL_BATTLE"}, own_events)))
    help_ = directed and bool({"DEFENSIVE_PARTICIPATION", "REINFORCEMENT_COMMANDS"} & facets) and _has_linked_detector(
        deed, context, {"DEFENSIVE_ASSIST", "REINFORCEMENT"}, own_events, actor, target)
    if family == "PAIR_CONTEST":
        return contest
    if family in ("DIRECTED_HELP", "NOTEWORTHY_DIRECTED_PROTECTION", "RECONCILIATORY_HELP"):
        return help_
    if family == "QUALIFIED_DEESCALATION":
        return directed and ("TARGETED_COMMAND" in facets or "DEFENSIVE_PARTICIPATION" in facets)
    return pressure


def _qualify(deed, context, family, actor, target, index, rule, directional_facets):
    """Conservative three-way qualification with explicit refusal of future leakage."""
    reasons, support, before, counter = [], {
        x for f in directional_facets for x in f["sourceEventIds"]}, set(), set()
    if not _base_family(deed, context, family, actor, target, directional_facets):
        return "NOT_QUALIFIED", ["FAMILY_DIRECTION_OR_CONTEXT_NOT_SUPPORTED"], support, before, counter
    required = MANDATORY[family]
    independent = set(support)
    qualified = {}
    assigned_witnesses = set()
    for kind in required:
        pool = index.get((kind, actor, target), [])
        admitted = []
        for f in pool:
            if f["coverage"] == "INSUFFICIENT":
                continue
            if f["coverage"] == "LIMITED":
                # SHARED_1 coverage reports partial evidence, never implicit
                # family-level semantic admission. There is NO approved,
                # versioned, fact-kind + methodVersion-specific rule here
                # authorizing this partial measurement to qualify. A future
                # explicitly reviewed coverage contract must retain limitations.
                reasons.append("LIMITED_METHOD_COVERAGE_RULE_UNCONFIGURED")
                continue
            if kind in PREENTRY and f["windowEndMs"] >= deed["firstAtMs"]:
                counter.update(f["sourceEventIds"])
                reasons.append("POST_ENTRY_CONTEXT_CANNOT_PROVE_PREENTRY")
                continue
            if kind == "ATTRIBUTABLE_RUPTURE" and f["measuredAtMs"] > deed["firstAtMs"]:
                reasons.append("RUPTURE_AFTER_PRESSURE_START")
                counter.update(f["sourceEventIds"])
                continue
            if kind == "POST_RUPTURE_DIRECTED_PRESSURE" and (
                f["measuredAtMs"] < deed["firstAtMs"] or
                f["measuredAtMs"] > deed["lastAtMs"]
            ):
                reasons.append("RUPTURE_AFTER_PRESSURE_OR_INVALID_ASSOCIATION")
                counter.update(f["sourceEventIds"])
                continue
            if f["value"] < rule["measurementMinimums"][kind]:
                reasons.append("MEASUREMENT_BELOW_EXPLICIT_THRESHOLD")
                counter.update(f["sourceEventIds"])
                continue
            admitted.append(f)
        if not admitted:
            reasons.append("MISSING_OR_UNQUALIFIED_" + kind)
        else:
            selected = sorted(admitted, key=lambda x: (x["measuredAtMs"], x["sourceEventIds"]))[0]
            # Two semantic labels on one event are not independent corroboration.
            if set(selected["sourceEventIds"]) & assigned_witnesses:
                reasons.append("CORRELATED_MEASUREMENT_WITNESSES")
                counter.update(selected["sourceEventIds"])
                continue
            if kind in PREENTRY and set(selected["sourceEventIds"]) & set(support):
                reasons.append("PREENTRY_WITNESS_REUSES_EPISODE_COMMAND")
                counter.update(selected["sourceEventIds"])
                continue
            assigned_witnesses.update(selected["sourceEventIds"])
            qualified[kind] = selected
            if kind in PREENTRY:
                before.update(selected["sourceEventIds"])
            else:
                support.update(selected["sourceEventIds"])
            independent.update(selected["sourceEventIds"])
    # Complete, source-backed meaningfulness cannot be manufactured from multiple
    # versions/labels of the same command; new event IDs must genuinely differ.
    if len(independent) < rule["minIndependentSourceEvents"]:
        reasons.append("INSUFFICIENT_DISTINCT_SOURCE_EVENTS")
    if (set(qualified) != set(required) or
            "INSUFFICIENT_DISTINCT_SOURCE_EVENTS" in reasons):
        invalid = bool(counter)
        return ("NOT_QUALIFIED" if invalid else "PENDING"), sorted(set(reasons)), support, before, counter
    if family in ("DISTINCT_RUPTURE_ANTAGONISM", "SERIOUS_BOND_ANTAGONISM"):
        coop = qualified["DISTINCT_PREENTRY_COOPERATION"]
        rupture = qualified["ATTRIBUTABLE_RUPTURE"]
        aftermath = qualified["POST_RUPTURE_DIRECTED_PRESSURE"]
        if not coop["windowEndMs"] < rupture["measuredAtMs"] < aftermath["measuredAtMs"]:
            return "NOT_QUALIFIED", ["COOPERATION_RUPTURE_AFTER_MUST_BE_ORDERED"], support, before, counter
        # Prior alliance/cooperation+attributable breach alone still do not prove
        # actual attack or moral motive: only inferred, material directed pressure.
    return "QUALIFIED", ["BOUNDED_ORDINARY_INFERENCE_NOT_EXECUTION_PROOF"], support, before, counter


def qualify_social_v1(*, snapshot, context, pair_deeds, pair_observations, replay_bindings, incident_lineages,
                      measurements, calibration, historical_order):
    """Return canonical Inference/Claim DTOs and inactive #139 input wrappers.

    All supplied authority and measurement values must originate in a server
    admission transaction. This pure module checks consistency, not permissions.
    """
    validate_record("SourceSnapshot", snapshot)
    validate_inference_configuration(calibration)
    _require(context.get("version") in CONTEXT_VERSIONS and
             context.get("compatibleSharedContract") == CONTRACT, "INCOMPATIBLE_CONTEXT")
    _require(context.get("trust", {}).get("officialLeagueAuthority") is False and
             context.get("trust", {}).get("socialClaimsQualified") is False,
             "CONTEXT_IMPERSONATES_OFFICIAL_AUTHORITY")
    _require(context.get("sourceRevision", {}).get("replaySha256") == snapshot["sourceHash"]
             and len(context.get("sourceContextRevision", "")) == 64,
             "STALE_CONTEXT_SOURCE_REVISION")
    _require(isinstance(historical_order, dict) and
             set(historical_order) == {"leagueOrderKey", "gameNumber", "order"}
             and historical_order["order"] in {"ORDERED", "PARTIAL", "UNKNOWN"}
             and type(historical_order["gameNumber"]) is int and historical_order["gameNumber"] > 0
             and (historical_order["leagueOrderKey"] is None or
                  isinstance(historical_order["leagueOrderKey"], str)),
             "CANONICAL_HISTORICAL_ORDER_REQUIRED")
    _require(isinstance(incident_lineages, dict), "INCIDENT_LINEAGES_REQUIRED")
    bindings = _normalize_bindings(snapshot, replay_bindings, calibration)
    source_events = _source_events(context)
    _require(isinstance(pair_observations, list), "ORIGINAL_SOURCE_OBSERVATIONS_REQUIRED")
    original_events = {}
    for event in pair_observations:
        _require(isinstance(event, dict) and isinstance(event.get("sourceEventId"), str)
                 and isinstance(event.get("moment"), dict)
                 and type(event["moment"].get("atMs")) is int
                 and event["moment"]["atMs"] >= 0
                 and type(event.get("actorPlayerId")) is int
                 and event["actorPlayerId"] in bindings["players"],
                 "INVALID_RECORDED_EVENT_ANCHOR")
        ordinal = event["moment"].get("operationOrdinal")
        e = {"atMs": event["moment"]["atMs"], "actor": event["actorPlayerId"],
             "ordinal": ordinal if type(ordinal) is int and 0 <= ordinal <= 9007199254740991 else None}
        prior = original_events.get(event["sourceEventId"])
        _require(prior is None or prior == e, "CONFLICTING_RECORDED_EVENT_ID")
        original_events[event["sourceEventId"]] = e
    index = _fact_index(measurements, authority=snapshot["authorityRevision"],
                        bindings=bindings, source_events=source_events,
                        observations=original_events)
    _require(isinstance(pair_deeds, list), "PAIR_SOURCE_DEEDS_REQUIRED")
    source_deeds = {}
    for raw in pair_deeds:
        _require(isinstance(raw, dict) and isinstance(raw.get("deedId"), str)
                 and isinstance(raw.get("sourceEventIds"), list)
                 and isinstance(raw.get("facets"), list), "BAD_SOURCE_DEED")
        did = raw["deedId"]
        if did in source_deeds:
            _require(raw == source_deeds[did], "CONFLICTING_DUPLICATE_SOURCE_DEED")
            continue
        source_deeds[did] = raw
    seen = set()
    results, effects, witnesses = [], [], []
    refused_directions = []
    for deed in sorted(context["deedContexts"], key=lambda x: (
            x["firstAtMs"], x["sourceDeedId"])):
        did = deed["sourceDeedId"]
        _require(did not in seen, "CONFLICTING_DUPLICATE_SOURCE_DEED")
        seen.add(did)
        if did not in incident_lineages:
            continue  # unbound neutral evidence; never fabricate incident lineage
        original = source_deeds.get(did)
        _require(all(ref in original_events and
                     deed["firstAtMs"] <= original_events[ref]["atMs"] <= deed["lastAtMs"]
                     for ref in deed["sourceEventIds"]), "DEED_EVENTS_NOT_IN_ORIGINAL_CLOCK")
        _require(original is not None and
                 set(original["sourceEventIds"]) == set(deed["sourceEventIds"])
                 and sorted({f.get("kind") for f in original["facets"]}) == deed["facetKinds"],
                 "SOURCE_DEED_CONTEXT_MISMATCH")
        facet_events = {}
        invalid_direction = set()
        for f in original["facets"]:
            # Shared offensive participation records group contributions, not a
            # directed helper or competitive target pair. Retain as neutral
            # context; do not invent actor/target or reject the whole Game.
            if isinstance(f, dict) and f.get("kind") == "SHARED_OPPONENT_PARTICIPATION":
                contributions = f.get("contributions")
                _require(isinstance(contributions, list) and len(contributions) >= 2
                         and all(isinstance(c, dict)
                                 and type(c.get("contributorPlayerId")) is int
                                 and isinstance(c.get("sourceEventIds"), list)
                                 and c["sourceEventIds"]
                                 and set(c["sourceEventIds"]).issubset(set(deed["sourceEventIds"]))
                                 and all(ref in original_events and
                                         original_events[ref]["actor"] == c["contributorPlayerId"]
                                         for ref in c["sourceEventIds"])
                                 for c in contributions)
                         and len({c["contributorPlayerId"] for c in contributions}) >= 2,
                         "INVALID_SHARED_TARGET_CONTEXT")
                continue
            _require(isinstance(f, dict) and isinstance(f.get("kind"), str)
                     and type(f.get("fromPlayerId")) is int and
                     type(f.get("toPlayerId")) is int
                     and isinstance(f.get("sourceEventIds"), list) and f["sourceEventIds"]
                     and set(f["sourceEventIds"]).issubset(set(deed["sourceEventIds"])),
                     "DIRECTIONAL_FACET_PROVENANCE_REQUIRED")
            pair = (f["fromPlayerId"], f["toPlayerId"])
            facet_events.setdefault(pair, []).append(f)
            if f["kind"] in ACTOR_OWNED_FACETS and any(
                    ref not in original_events or
                    original_events[ref]["actor"] != f["fromPlayerId"]
                    for ref in f["sourceEventIds"]):
                invalid_direction.add(pair)
        _require(set(facet_events) == {(d["fromReplayPlayerId"], d["toReplayPlayerId"])
                    for d in deed["directionalActors"]}, "DIRECTIONAL_FACET_MAPPING_MISMATCH")
        lineage = incident_lineages[did]
        _require(isinstance(lineage, dict) and set(lineage) == {
            "incidentId", "overlapGroupId", "state", "lineage"},
            "INVALID_INCIDENT_LINEAGE")
        _require(lineage["state"] in ("CURRENT", "WITHDRAWN", "SUPERSEDED")
                 and lineage["lineage"] in ("SOURCE_ANCHORED", "REVIEWED_REBOUND", "PENDING")
                 and all(isinstance(lineage[k], str) and lineage[k]
                         for k in ("incidentId", "overlapGroupId")),
                 "INVALID_LINEAGE_IDENTITY")
        if lineage["state"] != "CURRENT" or lineage["lineage"] == "PENDING":
            continue
        _require(0 <= deed["firstAtMs"] <= deed["lastAtMs"], "BAD_DEED_ORDER")
        directions = sorted(facet_events)
        for actor, target in directions:
            if (actor, target) in invalid_direction:
                refused_directions.append({"sourceDeedId": did,
                    "fromReplayPlayerId": actor, "toReplayPlayerId": target,
                    "reason": "ACTOR_OWNED_SOURCE_EVENT_MISMATCH"})
                continue
            if actor not in bindings["players"] or target not in bindings["players"] or actor == target:
                continue
            actor_id, target_id = bindings["players"][actor], bindings["players"][target]
            for family, (system, track, effect) in FAMILIES.items():
                rule = calibration["rules"].get(family)
                if not rule:
                    continue
                decision, reasons, sr, br, cr = _qualify(
                    deed, context, family, actor, target, index, rule,
                    facet_events[(actor, target)])
                start = _pos(historical_order, facet_events[(actor, target)], original_events)
                if decision == "QUALIFIED" and start["order"] != "ORDERED":
                    decision = "PENDING"
                    reasons = sorted(set(reasons + ["SOURCE_ORDINAL_UNAVAILABLE_OR_AMBIGUOUS"]))
                revision = _hash([VERSION, snapshot["authorityRevision"],
                    context["sourceContextRevision"], did, lineage, deed,
                    actor, target, family, calibration])
                inference_id = _hash([VERSION, revision, family, sorted(sr), sorted(br), sorted(cr)])
                srefs = [_ref("SOURCE_EVENT", s, snapshot["authorityRevision"],
                              snapshot["sourceHash"]) for s in sorted(sr)]
                brefs = [_ref("CONTEXT", s, context["sourceContextRevision"],
                              snapshot["authorityRevision"]) for s in sorted(br)]
                crefs = [_ref("CONTEXT", s, context["sourceContextRevision"],
                              snapshot["authorityRevision"]) for s in sorted(cr)]
                tier = "ADMITTED" if decision == "QUALIFIED" else (
                    "LIMITED" if ("LIMITED_METHOD_COVERAGE_RULE_UNCONFIGURED" in reasons
                                  or decision == "NOT_QUALIFIED") else "INSUFFICIENT")
                inf = {"inferenceId": inference_id, "incidentRevision": revision,
                    "modelVersion": VERSION, "policy": deepcopy(calibration["policy"]),
                    "familyId": family, "basis": "BOUNDED_INFERENCE", "decision": decision,
                    "action": {"actorPlayerId": actor_id, "counterpartPlayerId": target_id},
                    "supportRefs": srefs, "contextBeforeRefs": brefs,
                    "counterevidenceRefs": crefs, "priorHistoryDigest": None,
                    "significanceBandId": rule["significanceBandId"] if decision == "QUALIFIED" else None,
                    "coverage": {"tier": tier, "ruleId": rule["ruleId"],
                        "missing": [x for x in reasons if x.startswith("MISSING") or x.startswith("INSUFFICIENT")],
                        "limitations": ["INFERRED_COMMANDS_NOT_OBSERVED_EXECUTION",
                           "REQUIRES_SERVER_AUTHENTICATED_ADMISSION"]},
                    "reasonCodes": reasons}
                validate_record("Inference", inf)
                subject = ({"system": system, "track": track, "playerId": actor_id}
                           if system == "REPUTATION" else
                           {"system": system, "track": track,
                            "fromPlayerId": actor_id, "toPlayerId": target_id})
                claim_id = "claim-" + _hash([CONTRACT, lineage["incidentId"],
                    subject, effect, family])
                infref = _ref("INFERENCE", inference_id, revision, snapshot["authorityRevision"])
                recip_eligible = (system == "RELATIONSHIP" and effect == "STRENGTHEN"
                                  and decision == "QUALIFIED" and
                                  family in ("PAIR_CONTEST", "DIRECTED_HELP",
                                             "DISTINCT_RUPTURE_ANTAGONISM"))
                # Actor-specific SOURCE_EVENT, never a shared pair-deed as proof that both
                # participants independently acted in both directions.
                own_event_ids = sorted({e for f in facet_events[(actor, target)]
                                        if f["kind"] in {"TARGETED_COMMAND", "ECONOMY_PRESSURE",
                                            "DEFENSIVE_PARTICIPATION", "REINFORCEMENT_COMMANDS"}
                                        for e in f["sourceEventIds"]})
                # A LOCAL_COMMAND_OVERLAP can contain the opponent's action; only
                # actor-owned targeted/offense/support event refs qualify.
                recip_eligible = recip_eligible and bool(own_event_ids)
                wref = (_ref("SOURCE_EVENT", own_event_ids[0],
                            snapshot["authorityRevision"], snapshot["sourceHash"])
                        if own_event_ids else None)
                claim = {"claimId": claim_id,
                    "claimRevision": _hash([claim_id, revision, decision, reasons,
                                            calibration["version"], calibration["policy"]]),
                    "incidentId": lineage["incidentId"], "incidentRevision": revision,
                    "subject": subject, "effect": effect, "basis": "BOUNDED_INFERENCE",
                    "ruleId": rule["ruleId"], "policy": deepcopy(calibration["policy"]),
                    "decision": decision, "supportRefs": [infref],
                    "significanceBandId": rule["significanceBandId"] if decision == "QUALIFIED" else None,
                    "contributionKey": lineage["overlapGroupId"],
                    "historicalPosition": start,
                    "reciprocity": {"decision": "ELIGIBLE" if recip_eligible else "INELIGIBLE",
                        "ruleId": rule["ruleId"] + "_INDEPENDENT_ACTOR",
                        "independentActorRefs": [wref] if recip_eligible else []}}
                validate_record("Claim", claim)
                results.append(inf)
                effects.append({"claim": claim, "battleId": snapshot["battleId"],
                    "gameId": snapshot["gameId"], "eventId": snapshot["eventId"],
                    "sourceAuthority": snapshot["authorityRevision"]})
                if recip_eligible:
                    witnesses.append({"claimId": claim_id, "incidentId": lineage["incidentId"],
                        "battleId": snapshot["battleId"], "actorPlayerId": actor_id,
                        "qualification": "QUALIFIED", "ref": wref})
    # Corrections fully replace projections; raw out-of-scope evidence remains in
    # #124's ledger, not a second history. No receipts, publication or scores.
    effects.sort(key=lambda e: (e["claim"]["historicalPosition"]["recordingAtMs"],
                    e["claim"]["claimId"]))
    results.sort(key=lambda e: e["inferenceId"])
    witnesses.sort(key=lambda e: e["claimId"])
    return {"version": VERSION, "sharedContract": CONTRACT,
        "sourceContextRevision": context["sourceContextRevision"],
        "authorityRevision": snapshot["authorityRevision"],
        "gameIdentity": [snapshot["battleId"], snapshot["gameId"]],
        "sourceDedupKey": _hash([snapshot["gameGuid"], snapshot["sourceHash"]]),
        "projectionRevision": _hash([VERSION, snapshot["authorityRevision"],
            context["sourceContextRevision"], effects, witnesses, calibration]),
        "publicationAllowed": False, "officialWrites": False,
        "inferences": results, "effects": effects,
        "actorWitnesses": witnesses,
        "rejectedActorDirections": refused_directions,
        "audit": {"notAnExecutionOracle": True,
                  "realSourceApprovalRequired": True,
                  "strictTreacheryUntouched": True,
                  "calibrationApprovalRequired": True}}
