"""SOC-V1E (#167): pure, narrow, versioned, source-admitted *pilot* conduct.

This is NOT a change to #158's LIMITED original observations or to #141/#139.
Only a separately corroborated family/method can be METHOD_ADMITTED here.
Neither this module nor its caller authenticates a current READY Game: Sol
must prove the source/mapping/history and perform a separately reviewed bridge.
No public Claims, #139 effects, grants, production scoring or persistence.
"""
from __future__ import annotations

from copy import deepcopy
from hashlib import sha256
import json

from social_v1_metric_grade_candidates import (
    prepare_social_metric_grade_candidates, SOURCE_METHOD, SOURCE_METRICS,
)
from social_v1_source_measurements import _original_index

VERSION = "AOF_SOC_V1E_BOUNDED_GRADE_METHODS_1"
POLICY_VERSION = "AOF_SOC_V1E_PILOT_TUNING_1"
TRACKS = {"RIVALRY": "RELATIONSHIP", "BOND": "RELATIONSHIP",
          "CHIVALRY": "REPUTATION", "GALLANTRY": "REPUTATION",
          "CRUELTY": "REPUTATION", "HOSTILITY": "RELATIONSHIP"}
# A named method is never generic permission to upgrade a LIMITED source.
METHODS = {
    "RIVALRY": {
        "methodVersion": "AOF_SV1E_PAIR_RAID_ENGAGEMENT_CONTEST_1",
        "ruleId": "E2E_PAIR_CONTEST", "familyId": "PAIR_CONTEST",
        "sourceMethodVersion": SOURCE_METHOD,
        "metricIds": [SOURCE_METRICS["DIRECTED_PRESSURE_REQUEST"],
                      SOURCE_METRICS["DIRECTED_TARGET_COMMAND"]],
        "independentContext": ["AOF_RAID_DETECTION_V3",
                               "SKIRMISH_OR_TECHNICAL_BATTLE"],
    },
    "BOND": {
        "methodVersion": "AOF_SV1E_THREAT_LINKED_DIRECTED_HELP_1",
        "ruleId": "E2E_DIRECTED_HELP", "familyId": "DIRECTED_HELP",
        "sourceMethodVersion": SOURCE_METHOD,
        "metricIds": [SOURCE_METRICS["DEFENSIVE_PARTICIPATION_REQUEST"],
                      SOURCE_METRICS["REINFORCEMENT_REQUEST"]],
        "independentContext": ["EXACT_HELPER_TO_BENEFICIARY_DETECTOR",
                               "INDEPENDENT_THIRD_PARTY_PREENTRY_RAID_THREAT"],
    },
    "CHIVALRY": {
        "methodVersion": "AOF_SV1E_NOTEWORTHY_THREAT_PROTECTION_1",
        "ruleId": "E2E_NOTEWORTHY_DIRECTED_PROTECTION",
        "familyId": "NOTEWORTHY_DIRECTED_PROTECTION",
        "sourceMethodVersion": SOURCE_METHOD,
        "metricIds": [SOURCE_METRICS["DEFENSIVE_PARTICIPATION_REQUEST"],
                      SOURCE_METRICS["REINFORCEMENT_REQUEST"]],
        "independentContext": ["EXACT_DEFENSIVE_ASSIST",
                               "MULTIPLE_PRIOR_THIRD_PARTY_THREAT_COMMANDS"],
    },
    "GALLANTRY": {
        "methodVersion": "AOF_SV1E_CHALLENGED_RETURN_PRESSURE_1",
        "ruleId": "E2E_DARING_OFFENSE", "familyId": "DARING_OFFENSE",
        "sourceMethodVersion": SOURCE_METHOD,
        "metricIds": [SOURCE_METRICS["DIRECTED_PRESSURE_REQUEST"],
                      SOURCE_METRICS["DIRECTED_TARGET_COMMAND"]],
        "independentContext": ["OWN_DIRECTED_RAID_AND_ENGAGEMENT",
                               "PREENTRY_TARGET_TO_ACTOR_RAID_CHALLENGE"],
    },
    "CRUELTY": {
        "methodVersion": "AOF_SV1E_PREENTRY_DISADVANTAGE_PRESSURE_PENDING_1",
        "ruleId": "E2E_PREEXISTING_VULNERABILITY_PRESSURE",
        "familyId": "PREEXISTING_VULNERABILITY_PRESSURE",
        "sourceMethodVersion": SOURCE_METHOD,
        "metricIds": [SOURCE_METRICS["DIRECTED_PRESSURE_REQUEST"]],
        "independentContext": ["INDEPENDENT_PREENTRY_TARGET_DISADVANTAGE_UNAVAILABLE"],
    },
    "HOSTILITY": {
        "methodVersion": "AOF_SV1E_SELECTIVE_ANTAGONISM_PENDING_1",
        "ruleId": "E2E_DISTINCT_RUPTURE_ANTAGONISM",
        "familyId": "DISTINCT_RUPTURE_ANTAGONISM",
        "sourceMethodVersion": SOURCE_METHOD,
        "metricIds": [SOURCE_METRICS["DIRECTED_PRESSURE_REQUEST"],
                      SOURCE_METRICS["DIRECTED_TARGET_COMMAND"]],
        "independentContext": ["AUTHENTIC_HISTORICAL_SELECTIVITY_OR_EFFECTIVE_RUPTURE_UNAVAILABLE"],
    },
}
# Do not accept arbitrary client rules, method aliases, or reduced source floors.
def pilot_policy(*, min_original_commands=2, max_preentry_ms=90000):
    if type(min_original_commands) is not int or not 2 <= min_original_commands <= 20:
        raise ValueError("PILOT_MINIMUM_MUST_KEEP_TWO_OWN_EVENTS")
    if type(max_preentry_ms) is not int or not 1000 <= max_preentry_ms <= 180000:
        raise ValueError("BOUNDED_PREENTRY_WINDOW_REQUIRED")
    return {"version": POLICY_VERSION, "status": "PROPOSED_EMULATOR_ONLY",
            "minOriginalCommands": min_original_commands,
            "maxPreentryMs": max_preentry_ms,
            "gradeLabels": {"ordinary": "ORDINARY", "substantial": None},
            "approvalRef": None}


def _check(ok, reason):
    if not ok:
        raise ValueError(reason)


def _hash(v):
    return sha256(json.dumps(v, sort_keys=True, ensure_ascii=False,
                             separators=(",", ":"), allow_nan=False).encode()).hexdigest()


def _policy(p):
    _check(type(p) is dict and set(p) == {
        "version", "status", "minOriginalCommands", "maxPreentryMs",
        "gradeLabels", "approvalRef"}, "POLICY_SHAPE_NOT_ACCEPTED")
    _check(p.get("version") == POLICY_VERSION and
           p.get("status") == "PROPOSED_EMULATOR_ONLY" and
           p.get("approvalRef") is None and
           p.get("gradeLabels") == {"ordinary": "ORDINARY", "substantial": None},
           "UNAPPROVED_POLICY_OR_SUBSTANTIAL_GRADE")
    _check(type(p["minOriginalCommands"]) is int and
           2 <= p["minOriginalCommands"] <= 20 and
           type(p["maxPreentryMs"]) is int and
           1000 <= p["maxPreentryMs"] <= 180000,
           "PILOT_SOURCE_FLOOR_OR_WINDOW_OUT_OF_RANGE")
    return p


def _fixed_pair(statistics, actor, target):
    mf = statistics.get("matchFacts") or {}
    rule = (mf.get("rules") or {}).get("lockTeams") or {}
    if rule.get("status") != "DECODED" or rule.get("value") is not True:
        return "DYNAMIC_DIPLOMACY_UNPROVEN"
    rows = mf.get("players") or []
    teams = {row.get("playerId"): row.get("lobbyTeamIdRaw") for row in rows}
    roster = {p.get("playerId") for p in statistics.get("participants") or []}
    # An apparently fixed 1↔2 pair in a malformed/incomplete 4v4 lobby is
    # not enough. Match #158's full-roster mode-coverage requirement.
    if (len(teams) != len(rows) or set(teams) != roster or
            not all(type(v) is int and v > 0 for v in teams.values())):
        return "LOBBY_TEAM_UNVERIFIED"
    return "FIXED_ALLIES" if teams[actor] == teams[target] else "FIXED_OPPONENTS"


def _original_threats(*, statistics, originals, attacker, beneficiary, before, policy):
    """Independent Raid V3 owned by attacker, *not* the helper.

    A Raid V3 detector is inferred directional command pressure, not proof of
    a victim losing economy or surviving a battle. It must be source anchored,
    within the past-only lookback and authored by the claimed third party.
    """
    found = []
    earliest = max(0, before - policy["maxPreentryMs"])
    for player in statistics.get("participants") or []:
        if player.get("playerId") != attacker:
            continue
        military = ((player.get("military") or {}).get("engagements") or {})
        for raid in ((military.get("raidEvidence") or {}).get("initiatedEpisodes") or []):
            if raid.get("attackerPlayerId") != attacker or raid.get("victimPlayerId") != beneficiary:
                continue
            refs = raid.get("sourceEventIds") or []
            owned = sorted({r for r in refs
                if r in originals and originals[r]["actorReplayPlayerId"] == attacker and
                earliest <= originals[r]["recordingAtMs"] < before and
                originals[r]["operationOrdinal"] is not None})
            if owned and raid.get("modelVersion", military.get("modelVersion")) in (
                    None, "AOF_RAID_DETECTION_V3"):
                # Require detector's first strong command before the deed;
                # use earlier original commands, never future victim state.
                start = raid.get("startedAtMs")
                if type(start) is int and earliest <= start < before:
                    found.append({"raidId": raid["raidId"], "sourceEventIds": owned,
                                  "attackerReplayPlayerId": attacker,
                                  "victimReplayPlayerId": beneficiary,
                                  "firstAtMs": start})
    return sorted(found, key=lambda x: (x["firstAtMs"], x["raidId"]))


def _source_attestation(group, context, originals):
    """Recheck grouped original actor/time/ordinal and ref membership.

    The accepted #158 producer already validates original facets. This
    independent narrow method additionally checks exact detector source refs
    against the real Context V2, never trusting a UI-supplied linked label.
    """
    actor, other = group["actorReplayPlayerId"], group["counterpartReplayPlayerId"]
    refs = group["sourceEventIds"]
    _check(refs and len(refs) == len(set(refs)), "SOURCE_REFS_REQUIRED")
    _check(all(ref in originals and
               originals[ref]["actorReplayPlayerId"] == actor
               for ref in refs), "ORIGINAL_SOURCE_ACTOR_MISMATCH")
    first = sorted(refs, key=lambda r: (
        originals[r]["recordingAtMs"], originals[r]["operationOrdinal"]
        if originals[r]["operationOrdinal"] is not None else -1, r))[0]
    moment = group["firstSourceMoment"]
    _check(moment["recordingAtMs"] == originals[first]["recordingAtMs"],
           "SOURCE_MOMENT_MISMATCH")
    _check(moment["order"] != "ORDERED" or moment["operationOrdinal"] ==
           originals[first]["operationOrdinal"], "SOURCE_ORDINAL_MISMATCH")
    # A promoted skirmish/Battle is repeated in several per-player
    # projections. #158 deliberately unions their original source refs;
    # reconstruct that union, never take the last duplicate dictionary row.
    detector_refs = {}
    for e in context.get("engagementContexts") or []:
        key = (e["kind"], e["sourceDetectorId"])
        detector_refs.setdefault(key, set()).update(e.get("sourceEventIds") or [])
    for linked in group["linkedDetectorCandidates"]:
        key = (linked["kind"], linked["sourceDetectorId"])
        _check(key in detector_refs and
               set(linked["sharedOriginalEventIds"]) == set(refs) & detector_refs[key],
               "ENGAGEMENT_DETECTOR_SOURCE_MISMATCH")
    return actor, other, set(refs)


def _grade(track, *, group, statistics, context, originals, policy):
    method = METHODS[track]
    actor, other, refset = _source_attestation(group, context, originals)
    metrics = {m["metricDefinitionId"]: set(m["sourceEventIds"])
               for m in group["rawMeasurements"]}
    relevant = set().union(*(metrics.get(mid, set()) for mid in method["metricIds"]))
    missing = []
    evidence = []
    if not relevant:
        missing.append("FAMILY_ORIGINAL_ACTOR_METRIC_ABSENT")
    if group["firstSourceMoment"]["order"] != "ORDERED":
        missing.append("ORIGINAL_OPERATION_ORDINAL_MISSING_OR_AMBIGUOUS")
    if group.get("counterevidenceCandidates"):
        missing.append("CANCEL_STOP_CONTEXT_CANNOT_ESTABLISH_COMMITTED_ACTION")
    if len(relevant) < policy["minOriginalCommands"]:
        missing.append("TWO_OR_MORE_DISTINCT_ORIGINAL_ACTOR_ACTIONS_REQUIRED")
    if any(originals[r]["originalAction"] in ("STOP", "DE_STOP", "CANCEL", "DE_CANCEL")
           for r in relevant):
        missing.append("NONCOMMITTAL_STOP_CANCEL_ACTION")
    relation = _fixed_pair(statistics, actor, other)
    if track in ("RIVALRY", "GALLANTRY"):
        if relation != "FIXED_OPPONENTS":
            missing.append("PAIR_OPPOSITION_NOT_FIXED_OR_EFFECTIVE_DIPLOMACY_UNPROVEN")
        linked_raids = [r for r in group["linkedRaidDetectorCandidates"]
            if r["attackerReplayPlayerId"] == actor and r["victimReplayPlayerId"] == other
            and len(set(r["sharedOriginalEventIds"]) & relevant) >= 2
            and r["modelVersion"] == "AOF_RAID_DETECTION_V3"]
        if not linked_raids:
            missing.append("OPPONENT_RAID_V3_WITH_TWO_OWN_EVENTS_MISSING")
        else:
            evidence.extend({"kind": "RAID_V3", "sourceDetectorId": r["raidId"],
                             "sourceEventIds": sorted(set(r["sharedOriginalEventIds"]) & relevant)}
                            for r in linked_raids)
        independent = []
        for linked in group["linkedDetectorCandidates"]:
            det = next((d for d in context.get("engagementContexts") or []
                if d["kind"] == linked["kind"] and
                d["sourceDetectorId"] == linked["sourceDetectorId"]), None)
            if (det is not None and linked["kind"] in ("SKIRMISH", "TECHNICAL_BATTLE")
                    and len(set(linked["sharedOriginalEventIds"]) & relevant) >= 1 and
                    actor in (det.get("contributorReplayPlayerIds") or [])):
                independent.append(linked)
        if not independent:
            missing.append("INDEPENDENT_ACTOR_ENGAGEMENT_CONTEXT_MISSING")
        else:
            evidence.extend({"kind": "ENGAGEMENT_"+r["kind"],
                             "sourceDetectorId": r["sourceDetectorId"],
                             "sourceEventIds": sorted(set(r["sharedOriginalEventIds"]) & relevant)}
                            for r in independent)
        if track == "GALLANTRY":
            prior = _original_threats(statistics=statistics, originals=originals,
                attacker=other, beneficiary=actor,
                before=group["window"]["startMs"], policy=policy)
            valid = [p for p in prior if len(p["sourceEventIds"]) >= 2]
            if not valid:
                missing.append("INDEPENDENT_TARGET_TO_ACTOR_PREENTRY_CHALLENGE_MISSING")
            else:
                evidence.extend({"kind": "PREENTRY_CHALLENGE_RAID",
                                 "sourceDetectorId": p["raidId"],
                                 "sourceEventIds": p["sourceEventIds"]} for p in valid)
    elif track in ("BOND", "CHIVALRY"):
        if relation == "FIXED_OPPONENTS":
            missing.append("HELPING_ENEMY_REQUIRES_EFFECTIVE_RELATIONSHIP_CONTEXT")
        allowed = {"DEFENSIVE_ASSIST", "REINFORCEMENT"} if track == "BOND" else {"DEFENSIVE_ASSIST"}
        links = []
        for linked in group["linkedDetectorCandidates"]:
            if linked["kind"] not in allowed:
                continue
            det = next((d for d in context.get("engagementContexts") or []
                if d["kind"] == linked["kind"] and
                d["sourceDetectorId"] == linked["sourceDetectorId"] and
                d.get("fromReplayPlayerId") == actor and
                d.get("toReplayPlayerId") == other), None)
            if det and len(set(linked["sharedOriginalEventIds"]) & relevant) >= 1:
                links.append(linked)
        if not links:
            missing.append("EXACT_RECIPIENT_LINKED_HELP_DETECTOR_MISSING")
        else:
            evidence.extend({"kind": "HELP_"+r["kind"],
                             "sourceDetectorId": r["sourceDetectorId"],
                             "sourceEventIds": sorted(set(r["sharedOriginalEventIds"]) & relevant)}
                            for r in links)
        threats = [_original_threats(statistics=statistics, originals=originals,
                    attacker=player["playerId"], beneficiary=other,
                    before=group["window"]["startMs"], policy=policy)
                   for player in statistics.get("participants") or []
                   if player.get("playerId") not in (actor, other)]
        genuine = [th for cluster in threats for th in cluster
                   if len(th["sourceEventIds"]) >= (2 if track=="CHIVALRY" else 1)]
        if not genuine:
            missing.append("INDEPENDENT_PREENTRY_THIRD_PARTY_RECIPIENT_THREAT_MISSING")
        else:
            evidence.extend({"kind": "PREENTRY_RECIPIENT_THREAT",
                             "sourceDetectorId": p["raidId"],
                             "sourceEventIds": p["sourceEventIds"]} for p in genuine)
        if track == "CHIVALRY" and len(relevant) < max(3, policy["minOriginalCommands"]):
            missing.append("NOTEWORTHY_HELP_NEEDS_THREE_OWN_ACTIONS")
    elif track == "CRUELTY":
        missing.append("INDEPENDENT_PREENTRY_VICTIM_DISADVANTAGE_NOT_AVAILABLE")
    elif track == "HOSTILITY":
        missing.append("EFFECTIVE_RUPTURE_OR_SELECTIVE_CROSS_GAME_ANTAGONISM_UNAVAILABLE")
    return {
        "track": track, "system": TRACKS[track],
        "sourceMethodVersion": SOURCE_METHOD,
        "methodVersion": method["methodVersion"], "familyId": method["familyId"],
        "pilotRuleId": method["ruleId"],
        "actorReplayPlayerId": actor, "counterpartReplayPlayerId": other,
        "decision": "SOURCE_ADMITTED" if not missing else "PENDING",
        "gradeBandId": "ORDINARY" if not missing else None,
        "sourceCoverage": "LIMITED",  # unchanged #149/#158 source layer
        "methodCoverage": "ADMITTED" if not missing else "PENDING",
        "materialMeaning": ("SOURCE_LINKED_BOUNDED_INFERRED_COMMITMENT_NOT_DAMAGE_OR_AID_RECEIPT"
                            if not missing else None),
        "sourceEventIds": sorted(relevant),
        "corroboration": sorted(evidence, key=lambda e: (e["kind"], e["sourceDetectorId"])),
        "missingEvidence": sorted(set(missing)),
        "independentContributionKey": group["independentContributionKey"],
        "canonicalContributionKey": None,
        "originalPosition": deepcopy(group["firstSourceMoment"]),
        "reasonCodes": (["BOUNDED_METHOD_ADMISSION_REQUIRES_SERVER_READY_BINDING"]
                        if not missing else ["SOURCE_METHOD_REQUIREMENTS_UNMET"]),
    }


def admit_contextual_source_grades(*, statistics, context, source_measurements,
                                    action_events, game_scope, policy=None,
                                    producer=None):
    """Reproduce and validate #158 before admitting *per-family* source conduct.

    No trusted flag, current Game or canonical history is accepted as input.
    Sol must bind server-owned SourceSnapshot and reconcile two key versions.
    """
    p = _policy(policy if policy is not None else pilot_policy())
    canonical = prepare_social_metric_grade_candidates(
        statistics=statistics, context=context, source_measurements=source_measurements,
        action_events=action_events, game_scope=game_scope)
    if producer is not None:
        _check(producer == canonical, "SUPPLIED_PRODUCER_NOT_REPRODUCIBLE")
    originals = _original_index(action_events, 600000)
    entries = []
    # One original raid/skirmish/help detector may overlap several distinct
    # #158 source components. Anti-farming must extend across those components
    # within the same Game+actor→counterpart+track, not merely de-duplicate
    # row representations *inside* one component.
    consumed_detector = {}
    for group in canonical["candidateEpisodeGroups"]:
        # Fail closed for any source method revisions outside the known neutral
        # source grammar. This module adds separate admitted conduct methods.
        _check(group["originalMetricMethods"] == [SOURCE_METHOD] and
               group["coverage"]["tier"] == "LIMITED" and
               group["grade"]["decision"] == "PENDING",
               "SOURCE_GRAMMAR_MISMATCH_OR_UPSTREAM_ADMISSION")
        grades = [_grade(track, group=group, statistics=statistics, context=context,
                         originals=originals, policy=p)
                  for track in ("RIVALRY", "BOND", "CHIVALRY", "GALLANTRY", "CRUELTY", "HOSTILITY")]
        for grade in grades:
            if grade["decision"] != "SOURCE_ADMITTED":
                continue
            marker = (group["actorReplayPlayerId"],
                      group["counterpartReplayPlayerId"], grade["track"])
            ids = {(e["kind"], e["sourceDetectorId"])
                   for e in grade["corroboration"]
                   if e["kind"].startswith(("RAID_", "ENGAGEMENT_", "HELP_"))}
            _check(bool(ids), "ADMITTED_WITHOUT_INDEPENDENT_DETECTOR")
            consumed = consumed_detector.setdefault(marker, set())
            if consumed.intersection(ids):
                # Another source-connected component from the *same* raid,
                # promoted skirmish/Battle or helper detector is not another
                # independent social deed. Keep its full evidence for the
                # owner-private Pending explanation, not a second grade.
                grade.update(
                    decision="PENDING", gradeBandId=None, methodCoverage="PENDING",
                    materialMeaning=None,
                    missingEvidence=["CORRELATED_DETECTOR_EPISODE_ALREADY_ADMITTED"],
                    reasonCodes=["CROSS_COMPONENT_SOCIAL_ANTIMULTIPLICATION"],
                )
            else:
                consumed.update(ids)
        accepted = [g for g in grades if g["decision"] == "SOURCE_ADMITTED"]
        entries.append({
            "sourceCandidateId": group["candidateId"],
            "sourceIndependentContributionKey": group["independentContributionKey"],
            "gameScope": deepcopy(group["gameScope"]),
            "sourceRevision": deepcopy(group["sourceRevision"]),
            "sourceContextRevision": group["sourceContextRevision"],
            "sourceMeasurementsRevision": group["sourceMeasurementsRevision"],
            "actorReplayPlayerId": group["actorReplayPlayerId"],
            "counterpartReplayPlayerId": group["counterpartReplayPlayerId"],
            "sourceDeedIds": deepcopy(group["sourceDeedIds"]),
            "sourceEventIds": deepcopy(group["sourceEventIds"]),
            "sourcePosition": deepcopy(group["firstSourceMoment"]),
            "perTrackGrades": grades,
            "eligibleSourceMethods": [g["methodVersion"] for g in accepted],
            "overlapRule": "ONE_SOURCE_CONNECTED_EPISODE_PER_DIRECTION_PER_TRACK",
            "originalSourceCoverage": "LIMITED",
            "currentGameAuthorityVerified": False,
            "canonicalClaim": None,
            "canonicalContributionKey": None,
        })
    revision = _hash([VERSION, p, canonical["projectionRevision"], entries])
    return {
        "version": VERSION, "policy": deepcopy(p),
        "privatePilot": True, "sourceMethodRegistry": deepcopy(METHODS),
        "originalProducerVersion": canonical["version"],
        "producerProjectionRevision": canonical["projectionRevision"],
        "sourceRevision": deepcopy(canonical["sourceRevision"]),
        "sourceContextRevision": canonical["sourceContextRevision"],
        "sourceMeasurementsRevision": canonical["sourceMeasurementsRevision"],
        "gameScope": deepcopy(game_scope),
        "gameScopeAuthenticated": False,
        "projectionRevision": revision,
        "episodes": entries,
        "sourceAdmittedCount": sum(len(e["eligibleSourceMethods"]) for e in entries),
        "publicationAllowed": False, "officialWrites": False,
        "claims": [], "effects": [], "actorWitnesses": [], "receipts": [],
        "noAutomaticHistoricalImport": True,
        "limitations": [
            "SERVER_CURRENT_READY_SOURCE_AND_LEAGUE_ACTOR_MAPPING_REQUIRED",
            "INT_C2A_EPISODE_KEY_RECONCILIATION_REQUIRED_NO_KEY_SUBSTITUTION",
            "ONLY_LISTED_PER_FAMILY_METHOD_COVERAGE_CAN_BE_ADMITTED",
            "SOURCE_COMMAND_COMMITMENT_NOT_OBSERVED_EXECUTION_OR_DAMAGE",
            "ORDINARY_PILOT_GRADE_NOT_FINAL_NUMERICAL_CALIBRATION",
            "NO_SEASON_AGGREGATE_SOURCE_ADMISSION",
            "PENDING_UNSUPPORTED_CHALLENGE_VULNERABILITY_RUPTURE_WEAKENING",
            "HISTORICAL_GAME_ORDER_AND_CORRECTION_OWNED_BY_SOL",
            "NO_CANONICAL_CLAIMS_SCORE_PROJECTION_OR_PUBLICATION",
        ],
    }
