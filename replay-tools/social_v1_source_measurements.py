"""AoF #126: neutral, replay-free, bounded original-source measurement catalogue.

This is NOT a semantic social qualifier. No MEANINGFUL_*/PREENTRY_CHALLENGE/
VULNERABILITY/RUPTURE facts are minted from command counts. It consumes already
retained Action Events, Pair Social Evidence and Worker #124 Context, checks source
identity and returns honest fact/proxy descriptors for a future reviewed method.
"""
from __future__ import annotations

from hashlib import sha256
import json
import math

VERSION = "AOF_SOCIAL_SOURCE_MEASUREMENTS_PREVIEW_1"
METHOD = "AOF_SOCIAL_SOURCE_EPISODE_COMMANDS_1"
ACTOR_FACETS = {"ECONOMY_PRESSURE", "TARGETED_COMMAND",
                "DEFENSIVE_PARTICIPATION", "REINFORCEMENT_COMMANDS"}
KINDS = {
    "ECONOMY_PRESSURE": "DIRECTED_PRESSURE_REQUEST",
    "TARGETED_COMMAND": "DIRECTED_TARGET_COMMAND",
    "DEFENSIVE_PARTICIPATION": "DEFENSIVE_PARTICIPATION_REQUEST",
    "REINFORCEMENT_COMMANDS": "REINFORCEMENT_REQUEST",
}


def _hash(parts):
    return sha256(json.dumps(parts, sort_keys=True, separators=(",", ":"),
                             ensure_ascii=False, allow_nan=False).encode("utf-8")).hexdigest()


def _require(ok, reason):
    if not ok:
        raise ValueError(reason)


def _original_index(action_events, max_events):
    """One bounded pass, stable dedup, no replay parsing or inferred replay slots."""
    _require(isinstance(action_events, list) and len(action_events) <= max_events,
             "ACTION_EVENT_BUDGET_EXCEEDED")
    original = {}
    for event in action_events:
        if not isinstance(event, dict):
            raise ValueError("INVALID_ORIGINAL_ACTION_EVENT")
        key = event.get("eventId")
        if not isinstance(key, str) or not key:
            continue
        at, actor, ordinal = (event.get(k) for k in
                              ("timestampMs", "actorPlayerId", "operationOrdinal"))
        if type(at) is not int or at < 0 or type(actor) is not int or actor <= 0:
            continue  # unknown actions cannot be proof of something happening
        if type(ordinal) is not int or ordinal < 0 or ordinal > 9007199254740991:
            ordinal = None
        row = {"sourceEventId": key, "actorReplayPlayerId": actor,
               "recordingAtMs": at, "operationOrdinal": ordinal,
               "originalAction": event.get("sourceActionName")}
        if key in original and original[key] != row:
            raise ValueError("CONFLICTING_ORIGINAL_SOURCE_EVENT")
        original[key] = row
    return original


def project_social_source_measurements(*, statistics, context, action_events,
                                      lookback_ms, max_events=600000):
    """Inert authentic-source observation descriptors, not external social FACTS.

    lookback_ms is explicit unapproved experimental window, never a model
    default or game-state reconstruction. No outputs qualify LIMITED conduct.
    """
    _require(type(lookback_ms) is int and 0 < lookback_ms <= 1800000,
             "EXPLICIT_BOUNDED_LOOKBACK_REQUIRED")
    _require(isinstance(statistics, dict) and isinstance(context, dict),
             "SOURCE_AND_CONTEXT_REQUIRED")
    pair = statistics.get("pairSocialEvidence") or {}
    _require(pair.get("modelVersion") == "AOF_PAIR_SOCIAL_EVIDENCE_V1",
             "PAIR_SOURCE_VERSION_UNSUPPORTED")
    _require(context.get("version") in
             {"AOF_SOCIAL_V1_CONTEXT_V1", "AOF_SOCIAL_V1_CONTEXT_V2"},
             "CONTEXT_VERSION_UNSUPPORTED")
    _require(context.get("compatibleSharedContract") == "AOF_SOCIAL_V1_SHARED_1"
             and context.get("trust", {}).get("officialLeagueAuthority") is False,
             "UNAUTHENTICATED_CONTEXT_EXPECTED")
    source = statistics.get("source") or {}
    revision = context.get("sourceRevision") or {}
    _require(bool(revision) and all(source.get(k) == v for k, v in revision.items())
             and (pair.get("gameScope") or {}).get("replaySha256") == source.get("replaySha256"),
             "STALE_OR_INCONSISTENT_SOURCE_REVISION")
    roster = {p.get("playerId") for p in statistics.get("participants") or []}
    _require(roster and all(type(x) is int and x > 0 for x in roster),
             "AMBIGUOUS_REPLAY_ROSTER")
    original = _original_index(action_events, max_events)
    allowed = {r["sourceDeedId"]: r for r in context.get("deedContexts") or []}
    deeds = pair.get("deeds") or []
    # Reuse stable neutral deeds to describe strictly previous, independently
    # sourced pair episodes. This is not a second social/historical ledger.
    prior_pair = {}
    for row in deeds:
        did = row.get("deedId")
        d = allowed.get(did)
        if not d:
            continue
        for facet in row.get("facets") or []:
            if facet.get("kind") not in ACTOR_FACETS:
                continue
            direction = (facet.get("fromPlayerId"), facet.get("toPlayerId"))
            if any(type(p) is not int for p in direction):
                continue
            prior_pair.setdefault(direction, {})[did] = {
                "sourceDeedId": did, "firstAtMs": d["firstAtMs"],
                "lastAtMs": d["lastAtMs"],
                "facetKinds": sorted({f.get("kind") for f in row["facets"]
                                      if f.get("fromPlayerId") == direction[0] and
                                         f.get("toPlayerId") == direction[1]})}
    observations = []
    diagnostics = []
    for deed in sorted(deeds, key=lambda d: str(d.get("deedId"))):
        did = deed.get("deedId")
        neutral = allowed.get(did)
        if neutral is None:
            continue
        if set(deed.get("sourceEventIds") or []) != set(neutral.get("sourceEventIds") or []):
            raise ValueError("CONTEXT_DEED_SOURCE_ID_MISMATCH")
        first = neutral.get("firstAtMs")
        if type(first) is not int:
            raise ValueError("MISSING_EPISODE_ANCHOR")
        for facet in deed.get("facets") or []:
            if facet.get("kind") not in ACTOR_FACETS:
                continue  # no shared-target-to-directed conversion
            actor, target = facet.get("fromPlayerId"), facet.get("toPlayerId")
            refs = facet.get("sourceEventIds") or []
            _require(type(actor) is int and type(target) is int and
                     actor in roster and target in roster and actor != target,
                     "BAD_DIRECTIONAL_PAIR")
            _require(isinstance(refs, list) and len(refs) == len(set(refs)) and refs,
                     "BAD_FACET_REFERENCES")
            own = []
            if any(ref not in original or original[ref]["actorReplayPlayerId"] != actor
                   for ref in refs):
                diagnostics.append({"sourceDeedId": did, "fromReplayPlayerId": actor,
                                    "toReplayPlayerId": target,
                                    "reason": "ORIGINAL_ACTOR_OR_EVENT_UNVERIFIABLE"})
                continue
            if any(original[ref]["recordingAtMs"] < neutral["firstAtMs"] or
                   original[ref]["recordingAtMs"] > neutral["lastAtMs"] for ref in refs):
                raise ValueError("ACTOR_EVENTS_OUTSIDE_DEED_WINDOW")
            own = sorted([original[ref] for ref in refs],
                         key=lambda e: (e["recordingAtMs"],
                                        e["operationOrdinal"] if e["operationOrdinal"] is not None else -1,
                                        e["sourceEventId"]))
            # Missing or duplicate source ordinal is not reconstructed from
            # timestamp or list position.
            ordered = all(e["operationOrdinal"] is not None for e in own)
            ordered = ordered and len({(e["recordingAtMs"], e["operationOrdinal"])
                                       for e in own}) == len(own)
            entry = own[0]
            prior = sorted([e for e in original.values()
                            if e["actorReplayPlayerId"] == actor and
                            max(0, first - lookback_ms) <= e["recordingAtMs"] < first],
                           key=lambda e: (e["recordingAtMs"],
                                          e["operationOrdinal"] if e["operationOrdinal"] is not None else -1,
                                          e["sourceEventId"]))
            # Previous independent directed deeds are genuine prior candidate
            # observations. Their absence is *not* proof of cooperation/peace.
            previous = [row for row in prior_pair.get((actor, target), {}).values()
                        if row["sourceDeedId"] != did and
                        max(0, first - lookback_ms) <= row["lastAtMs"] < first]
            previous = sorted(previous, key=lambda row: (row["lastAtMs"], row["sourceDeedId"]))
            return_pressure = sorted([
                row for row in prior_pair.get((target, actor), {}).values()
                if max(0, first - lookback_ms) <= row["lastAtMs"] < first
                ], key=lambda row: (row["lastAtMs"], row["sourceDeedId"]))
            counts_by_source_command = {}
            for event in prior:
                action = event["originalAction"] or "UNRESOLVED_ACTION"
                counts_by_source_command[action] = counts_by_source_command.get(action, 0) + 1
            # Pre-entry command history is a requested-activity count, *not*
            # at-entry army size, completed production or opponent challenge.
            observation = {
                "observationId": "source-measurement-" +
                    _hash([VERSION, source["replaySha256"], context["sourceContextRevision"],
                           did, facet["kind"], actor, target, sorted(refs)]),
                "methodVersion": METHOD, "sourceContextRevision": context["sourceContextRevision"],
                "sourceDeedId": did, "kind": KINDS[facet["kind"]],
                "fromReplayPlayerId": actor, "toReplayPlayerId": target,
                "recordedCommandCount": len(own), "sourceEventIds": sorted(refs),
                "firstSourceMoment": {
                    "recordingAtMs": entry["recordingAtMs"],
                    "operationOrdinal": entry["operationOrdinal"] if ordered else None,
                    "order": "ORDERED" if ordered else "PARTIAL"},
                "preEntryRequestedActivity": {
                    "windowStartMs": max(0, first - lookback_ms),
                    "windowEndExclusiveMs": first,
                    "actorOriginalCommandCount": len(prior),
                    "originalCommandKinds": dict(sorted(counts_by_source_command.items())),
                    "sourceEventIds": [e["sourceEventId"] for e in prior],
                    "meaning": "ORIGINAL_REQUEST_COUNT_NOT_ARMY_SURVIVAL_OR_EFFECT"},
                "priorDirectedEpisodeCandidates": {
                    "sameDirectionSourceDeedIds": [row["sourceDeedId"] for row in previous],
                    "oppositeDirectionSourceDeedIds": [row["sourceDeedId"] for row in return_pressure],
                    "meaning": "CHRONOLOGICALLY_EARLIER_COMMAND_EPISODES_NOT_RECIPROCITY_OR_VENDETTA",
                    "absenceQualified": False},
                "layer": "OBSERVED_COMMANDS_AND_INFERRED_PAIR_ATTRIBUTION",
                "coverage": "LIMITED",
                "reasonCodes": ["BEHAVIORAL_MATERIALITY_UNAPPROVED",
                                "COMMAND_EXECUTION_NOT_PROVEN",
                                "OPPONENT_OPPORTUNITY_UNAVAILABLE"],
                "qualifiesSocialFact": False,
            }
            observations.append(observation)
    observations.sort(key=lambda x: x["observationId"])

    # A separate factual family already exposed by Economy Statistics V5.
    # A recorded DE_TRIBUTE *request* preserves direction and requested amount,
    # but is NOT proven settled transfer, helpfulness, urgency or recipient need.
    tribute = {}
    for player in statistics.get("participants") or []:
        actor = player["playerId"]
        evidence = (((player.get("economy") or {}).get("tributeSent") or {}).get("evidence") or [])
        for row in evidence:
            ref = row.get("sourceEventId")
            target = row.get("counterpartPlayerId")
            if type(target) is not int or target not in roster or target == actor:
                diagnostics.append({"sourceEventId": ref, "reason": "TRIBUTE_RECIPIENT_UNVERIFIED"})
                continue
            e = original.get(ref)
            if not e or e["actorReplayPlayerId"] != actor:
                diagnostics.append({"sourceEventId": ref, "reason": "TRIBUTE_REQUEST_ORIGINAL_ACTOR_UNVERIFIED"})
                continue
            if type(row.get("atMs")) is not int or row["atMs"] != e["recordingAtMs"]:
                diagnostics.append({"sourceEventId": ref, "reason": "TRIBUTE_REQUEST_SOURCE_CLOCK_MISMATCH"})
                continue
            amount = row.get("decodedResourceAmount")
            if amount is not None and (type(amount) not in (float, int)
                                       or not math.isfinite(amount) or amount < 0):
                raise ValueError("INVALID_DECODED_TRIBUTE_REQUEST_AMOUNT")
            record = {
                "sourceEventId": ref, "methodVersion": "AOF_ECONOMY_TRIBUTE_REQUEST_SOURCE_V1",
                "fromReplayPlayerId": actor, "toReplayPlayerId": target,
                "recordingAtMs": e["recordingAtMs"],
                "operationOrdinal": e["operationOrdinal"],
                "sourceAction": e["originalAction"],
                "resourceId": row.get("resourceId"),
                "decodedRequestAmount": amount,
                "requestAmountStatus": ("UNKNOWN" if amount is None
                                         else "ZERO" if amount == 0 else "NONZERO"),
                "layer": "OBSERVED_DECODED_TRIBUTE_COMMAND_REQUEST",
                "coverage": "LIMITED", "qualifiesSocialFact": False,
                "reasonCodes": ["DELIVERED_RESOURCES_NOT_PROVEN",
                                "BENEFICIARY_NEED_AND_MATERIALITY_UNQUALIFIED"],
            }
            if ref in tribute and tribute[ref] != record:
                raise ValueError("CONFLICTING_TRIBUTE_SOURCE_EVENT")
            tribute[ref] = record
    tribute_requests = [tribute[k] for k in sorted(tribute)]
    revision_digest = _hash([VERSION, revision, context["sourceContextRevision"],
                             lookback_ms, observations, tribute_requests, diagnostics])
    return {
        "version": VERSION, "methodVersion": METHOD,
        "sourceRevision": revision, "sourceContextRevision": context["sourceContextRevision"],
        "projectionRevision": revision_digest, "lookbackMs": lookback_ms,
        "authenticSourceAuthenticationPerformed": False,
        "officialLeagueAuthority": False, "publicationAllowed": False,
        "qualifiesAnySocialFact": False,
        "observations": observations, "tributeRequestContexts": tribute_requests,
        "diagnostics": diagnostics,
        "limitations": [
            "ORIGINAL_SOURCE_EVENT_VERIFIED_WITHIN_THIS_RETAINED_INPUT_ONLY",
            "SERVER_READY_SOURCE_AND_ACTIVE_MAPPING_MUST_BE_EXTERNALLY_ATTESTED",
            "NO_COMPLETED_ACTION_DAMAGE_KILL_CASTLE_OR_RESCUE_PROOF",
            "TRIBUTE_REQUEST_NOT_SETTLED_RECIPIENT_CREDIT_OR_HELP",
            "NO_PREENTRY_OPPONENT_STRENGTH_OR_VICTIM_VULNERABILITY_PROOF",
            "NO_EFFECTIVE_DIPLOMACY_OR_RUPTURE_PROOF",
            "NO_QUALIFIED_CONDUCT_CLAIMS_OR_RECIPROCITY",
        ],
    }
