"""Issue #124: neutral, replay-free military/territorial context over retained statistics.

No social scoring, admissions, Castle operation inference, dynamic-diplomacy state,
execution witness or extra incident identity. The server/SHARED_1 consumer alone
attests active Game/source authority. Do not use this DTO as a PublicClaim.
"""
from __future__ import annotations

from hashlib import sha256
import json
import math

VERSION = "AOF_SOCIAL_V1_CONTEXT_V2"
SHARED_CONTRACT = "AOF_SOCIAL_V1_SHARED_1"
PAIR_VERSION = "AOF_PAIR_SOCIAL_EVIDENCE_V1"
MAP_VERSION = "AOF_MAP_PRESENCE_V8"
FORWARD_ECO_VERSION = "AOF_FORWARD_ECO_V2"
# Only this raw type is a Castle candidate. 1251 (Krepost) is deliberately not.
GENUINE_CASTLE_RAW_ID = 82
FORWARD_CASTLE_QUEUE_WINDOW_MS = 5 * 60_000  # Existing approved rule; not calibration.
FORWARD_CASTLE_HOME_RADIUS_TILES = 15.0  # Owner-approved strict <15, not <=15.


def _digest(value):
    return sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False,
                             allow_nan=False).encode("utf-8")).hexdigest()


def _integer(value):
    return type(value) is int and value >= 0


def _point(value):
    if not isinstance(value, dict):
        return None
    x, y = value.get("x"), value.get("y")
    if not all(type(v) in (int, float) and math.isfinite(v) for v in (x, y)):
        return None
    return float(x), float(y)


def _distance(a, b):
    return round(math.hypot(a[0] - b[0], a[1] - b[1]), 4)


def _ref(row):
    return row.get("sourceEventId") if isinstance(row.get("sourceEventId"), str) and row["sourceEventId"] else None


def _policy(policy):
    """Explicit preview parameters only. No hidden territorial policy defaults."""
    if policy is None:
        return None
    if not isinstance(policy, dict) or set(policy) != {
        "friendlyMaxDistanceTiles", "enemyMaxDistanceTiles", "ambiguityMarginTiles",
    }:
        raise ValueError("territory_policy_requires_explicit_three_parameters")
    if any(type(v) not in (int, float) or not math.isfinite(v) or v < 0 for v in policy.values()):
        raise ValueError("invalid_territorial_parameter")
    return policy


def _alignment(a, b, teams, locked):
    if not locked:
        return "UNKNOWN"
    left, right = teams.get(a), teams.get(b)
    return "FIXED_ALLIES" if type(left) is int and left > 0 and left == right else "FIXED_OPPONENTS"


def _territory(actor, point, anchors, teams, locked, policy):
    """Per-opponent diagnostic, not V4 Enemy Progress or approved ownership.

    Friendly can use fixed teammates' initial TCs; enemy home attribution must
    remain unique among candidate opponents. Without approved numeric parameters
    the diagnostic retains distances, never promotes a proposed policy to fact.
    """
    own = anchors.get(actor)
    players = sorted(set(teams) | set(anchors))
    allies = [p for p in players if p == actor or _alignment(actor, p, teams, locked) == "FIXED_ALLIES"]
    enemies = [p for p in players if p != actor and _alignment(actor, p, teams, locked) == "FIXED_OPPONENTS"]
    friendly_distances = [_distance(point, anchors[p]) for p in allies if p in anchors]
    closest_friendly = min(friendly_distances) if friendly_distances else None
    results = []
    for other in [p for p in players if p != actor]:
        relation = _alignment(actor, other, teams, locked)
        candidate = anchors.get(other)
        opponents = {p: _distance(point, anchors[p]) for p in enemies if p in anchors}
        distance = _distance(point, candidate) if candidate else None
        reason = []
        territory = "ambiguous"
        if own is None or candidate is None or closest_friendly is None:
            reason.append("MISSING_STARTING_TC_ANCHOR")
        elif relation == "UNKNOWN":
            reason.append("EFFECTIVE_DIPLOMACY_UNRESOLVED")
        elif policy is None:
            reason.append("TERR_01_02_NOT_APPROVED")
        elif relation == "FIXED_ALLIES":
            # The location can be friendly, but is never enemy territory of an ally.
            territory = "friendly" if closest_friendly <= policy["friendlyMaxDistanceTiles"] else "neutral"
            if territory == "neutral":
                reason.append("NOT_NEAR_FRIENDLY_HOME")
        else:
            margin = policy["ambiguityMarginTiles"]
            near_friendly = closest_friendly <= policy["friendlyMaxDistanceTiles"]
            near_enemy = distance <= policy["enemyMaxDistanceTiles"]
            other_enemies = [d for p, d in opponents.items() if p != other]
            overlapping = near_friendly and near_enemy and abs(closest_friendly - distance) <= margin
            multi_enemy = near_enemy and any(d <= distance + margin for d in other_enemies)
            if overlapping:
                reason.append("OVERLAPPING_FRIENDLY_ENEMY_HOMES")
            elif multi_enemy:
                reason.append("MULTIPLE_PLAUSIBLE_ENEMY_HOMES")
            elif near_enemy and distance + margin < closest_friendly:
                territory = "enemy"
            elif near_friendly and closest_friendly + margin < distance:
                territory = "friendly"
            elif not near_enemy and not near_friendly:
                territory = "neutral"
            else:
                reason.append("TERRITORY_BOUNDARY_AMBIGUOUS")
        results.append({
            "counterpartReplayPlayerId": other,
            "relationContext": relation,
            "territory": territory,
            "qualification": "PROPOSED_PREVIEW" if policy is not None and not reason else "PENDING",
            "reasonCodes": reason,
            "distanceToOpponentStartingTcTiles": distance,
            "distanceToClosestFriendlyStartingTcTiles": closest_friendly,
            "otherOpponentStartingTcDistances": [
                {"replayPlayerId": p, "distanceTiles": d}
                for p, d in sorted(opponents.items()) if p != other
            ],
            "scope": "initial_TCs_and_locked_lobby_team_groups_not_effective_time_varying_diplomacy",
        })
    return results


def _castle_home_proximity(actor, point, sources, teams, locked):
    """TERR-02 source precision: inspect every *individual* retained starting TC.

    The parser's header-object search is explicitly non-exhaustive. Observed
    unrounded distances cannot assert the unique actual starting TC set.
    """
    rows, nearby = [], []
    multiple_tcs = False
    incomplete = False
    for other in sorted(teams):
        if other == actor:
            continue
        relation = _alignment(actor, other, teams, locked)
        witness = sources.get(other) or {}
        observed = []
        for obj in witness.get("objects") or []:
            xy = _point(obj.get("position"))
            valid = (xy is not None and obj.get("positionPrecision") == "ORIGINAL_DECODED_NO_ROUNDING"
                     and obj.get("rawObjectId") in (71, 109, 621)
                     and type(obj.get("objectInstanceId")) is int
                     and isinstance(obj.get("sourceEventId"), str) and bool(obj["sourceEventId"]))
            distance = math.hypot(point[0] - xy[0], point[1] - xy[1]) if valid else None
            observed.append({
                "sourceEventId": obj.get("sourceEventId"),
                "objectInstanceId": obj.get("objectInstanceId"),
                "rawObjectId": obj.get("rawObjectId"),
                "originalPosition": obj.get("position"),
                "unroundedDistanceTiles": distance,
                "strictlyLessThan15Tiles": distance < FORWARD_CASTLE_HOME_RADIUS_TILES if distance is not None else None,
                "identityAndPrecisionAvailable": valid,
            })
        if relation == "FIXED_OPPONENTS":
            if len(observed) > 1:
                multiple_tcs = True
            if len(observed) != 1 or not observed[0]["identityAndPrecisionAvailable"]:
                incomplete = True
            if len(observed) == 1 and observed[0]["strictlyLessThan15Tiles"] is True:
                nearby.append(other)
        rows.append({
            "counterpartReplayPlayerId": other,
            "relationContext": relation,
            "sourceCoverage": witness.get("coverage", "UNAVAILABLE"),
            "exhaustiveInitialTcListEstablished": witness.get("exhaustiveInitialTcListEstablished") is True,
            "observedTcCount": len(observed),
            "sourceStartingTownCenters": observed,
        })
    if not locked:
        gate, reasons = "PENDING", ["EFFECTIVE_OPPONENT_RELATION_UNAVAILABLE"]
    elif multiple_tcs or len(nearby) > 1:
        gate, reasons = "AMBIGUOUS", ["MULTIPLE_PLAUSIBLE_STARTING_TCS_OR_OPPONENTS"]
    elif incomplete or not any(r["relationContext"] == "FIXED_OPPONENTS" for r in rows):
        gate, reasons = "PENDING", ["INCOMPLETE_SPECIFIC_OPPONENT_STARTING_TC_IDENTITY"]
    else:
        # Do not turn an incomplete snapshot into definitive PASS or FAIL.
        gate, reasons = "PENDING", ["HEADER_OBJECT_SEARCH_NOT_EXHAUSTIVE"]
    return {
        "modelVersion": "AOF_FORWARD_CASTLE_HOME_PROXIMITY_V2",
        "limitTiles": FORWARD_CASTLE_HOME_RADIUS_TILES,
        "comparison": "STRICT_LESS_THAN",
        "distanceGate": gate,
        "soleDistanceCandidateReplayPlayerId": None,
        "observedNearbyOpponentReplayPlayerIds": sorted(nearby),
        "perOpponent": rows,
        "reasonCodes": reasons,
        "sourceMeaning": "source_linked_unrounded_header_initial_TC_objects_nonexhaustive_not_operational_castle_proof",
    }


def _classify_building(raw, categories):
    if raw == GENUINE_CASTLE_RAW_ID:
        return "CASTLE_PLACEMENT"
    if raw == 1251:
        return "KREPOST_PLACEMENT"
    if "tower" in categories:
        return "TOWER_PLACEMENT"
    if "forwardEco" in categories:
        return "ECONOMIC_BUILDING_PLACEMENT"
    if "militaryProduction" in categories or "defensive" in categories:
        return "MILITARY_OR_DEFENSIVE_BUILDING_PLACEMENT"
    return "OTHER_BUILDING_PLACEMENT"


def _placements(player):
    presence = player.get("mapPresence") or {}
    # Independent V8 projections contain copies of the same BUILD action. Merge
    # by source event identity, reject conflicts, never count them as new deeds.
    sources = (
        ("forwardBuildings", (presence.get("forwardBuildings") or {}).get("evidence") or []),
        ("tower", (presence.get("towers") or {}).get("evidence") or []),
        ("forwardEco", (presence.get("forwardEco") or {}).get("evidence") or []),
        ("castleBuildCommands", (presence.get("castlePlacementCommands") or {}).get("evidence") or []),
    )
    merged = {}
    for category, rows in sources:
        for row in rows:
            if not isinstance(row, dict) or not _ref(row):
                continue
            building = row.get("building") or {}
            raw = building.get("rawId", row.get("buildingId"))
            pos = _point(row.get("position"))
            at = row.get("atMs")
            if pos is None or not _integer(at):
                raise ValueError("placement_geometry_or_clock_missing")
            semantic = (raw, pos, at)
            existing = merged.get(_ref(row))
            if existing and existing["semantic"] != semantic:
                raise ValueError("conflicting_build_placement_source_event")
            if existing:
                existing["categories"].add(category)
            else:
                merged[_ref(row)] = {"semantic": semantic, "categories": {category},
                                    "referenceEnemyProgress": row["enemyProgressPercent"] if "enemyProgressPercent" in row else
                                    (row.get("relativePosition") or {}).get("enemyProgressPercent")}
    for ref, row in sorted(merged.items()):
        raw, pos, at = row["semantic"]
        yield {"sourceEventId": ref, "rawBuildingId": raw, "atMs": at,
               "position": {"x": pos[0], "y": pos[1]},
               "sourceFamilies": sorted(row["categories"]),
               "buildingClass": _classify_building(raw, row["categories"]),
               "legacyEnemyProgressPercent": row["referenceEnemyProgress"]}


def _deed_contexts(pair, observed_until):
    obs = {}
    for row in pair.get("observations") or []:
        key = row.get("sourceEventId")
        if not isinstance(key, str) or not key:
            raise ValueError("invalid_source_observation_id")
        if key in obs and obs[key] != row:
            raise ValueError("conflicting_source_observation")
        obs[key] = row
    episodes = pair.get("episodeContext") or {}
    refs_by_deed = {}
    for row in (episodes.get("annotations") or []) + (episodes.get("sequences") or []):
        if not isinstance(row, dict):
            continue
        for key, value in row.items():
            if key.endswith("DeedId") and isinstance(value, str):
                refs_by_deed.setdefault(value, set()).add(row.get("contextId"))
    result = []
    for deed in pair.get("deeds") or []:
        refs = sorted(set(deed.get("sourceEventIds") or []))
        if any(ref not in obs for ref in refs):
            raise ValueError("deed_source_event_not_in_retained_observations")
        start, end = (deed.get("startedAt") or {}).get("atMs"), (deed.get("endedAt") or {}).get("atMs")
        if not _integer(start) or not _integer(end) or start > end or end > observed_until:
            raise ValueError("deed_outside_recording_clock")
        for ref in refs:
            at = (obs[ref].get("moment") or {}).get("atMs")
            if not _integer(at) or not start <= at <= end:
                raise ValueError("deed_reference_outside_episode_interval")
        facets = deed.get("facets") or []
        tags = sorted(set(f.get("kind") for f in facets if isinstance(f, dict) and f.get("kind")))
        directions = sorted({(f.get("fromPlayerId"), f.get("toPlayerId"))
                             for f in facets if isinstance(f, dict)
                             and type(f.get("fromPlayerId")) is int and type(f.get("toPlayerId")) is int})
        result.append({"sourceDeedId": deed["deedId"], "sourceIncidentIds": sorted(deed.get("incidentIds") or []),
                       "pairReplayPlayerIds": deed.get("pairPlayerIds"),
                       "directionalActors": [{"fromReplayPlayerId": a, "toReplayPlayerId": b} for a, b in directions],
                       "facetKinds": tags, "sourceEventIds": refs,
                       "contextIds": sorted(refs_by_deed.get(deed["deedId"], set()) - {None}),
                       "firstAtMs": start, "lastAtMs": end,
                       "coverage": "BOUNDED_INFERRED_COMMAND_EPISODE", "outcomesProven": False,
                       "independentSocialCredit": False})
    return result



def _engagement_contexts(players, observed_until):
    """Deduplicated original detector records; promoted Great Battle is not a new deed."""
    unique = {}
    specifications = (
        ("SKIRMISH", "skirmishes", "skirmishId"),
        ("TECHNICAL_BATTLE", "battles", "battleId"),
        ("CO_ATTACK", "cooperativeAttacks", "battleId"),
        ("DEFENSIVE_ASSIST", "defensiveAssistsGiven", "battleId"),
        ("REINFORCEMENT", "allyReinforcementsSent", "reinforcementId"),
    )
    for player in players:
        e = ((player.get("military") or {}).get("engagements") or {}).get("engagementEvidence") or {}
        for family, field, key in specifications:
            for item in e.get(field) or []:
                if not isinstance(item, dict) or not isinstance(item.get(key), str):
                    continue
                pair = ((item.get("helperPlayerId"), item.get("defendedPlayerId", item.get("supportedPlayerId")))
                        if family in {"DEFENSIVE_ASSIST", "REINFORCEMENT"} else None)
                target = item.get("targetPlayerId") if family == "CO_ATTACK" else None
                identity = (family, item[key], pair, target)
                refs = sorted(set(item.get("sourceEventIds") or []))
                first = item.get("startedAtMs")
                last = item.get("endedAtMs")
                if not _integer(first) or not _integer(last) or first > last or last > observed_until:
                    raise ValueError("engagement_outside_recording_scope")
                value = {"kind": family, "sourceDetectorId": item[key],
                         "sourceEventIds": refs, "fromReplayPlayerId": pair[0] if pair else None,
                         "toReplayPlayerId": pair[1] if pair else None,
                         "targetReplayPlayerId": target,
                         "contributorReplayPlayerIds": item.get("attackerPlayerIds") if target is not None else
                           item.get("participantPlayerIds"),
                         "sourceSkirmishId": item.get("sourceSkirmishId"),
                         "firstAtMs": first, "lastAtMs": last,
                         "greatBattleCandidate": item.get("greatBattle") is True if family == "TECHNICAL_BATTLE" else False,
                         "outcomeEstablished": False,
                         "intentOrMaterialAidEstablished": False}
                if identity in unique and unique[identity] != value:
                    raise ValueError("conflicting_detector_episode_copies")
                unique[identity] = value
    return sorted(unique.values(), key=lambda row: (row["firstAtMs"], row["kind"], row["sourceDetectorId"],
                     row["fromReplayPlayerId"] or 0))


def project_social_v1_context(*, statistics, territory_policy=None, max_placements=4000):
    """Project inert source context; caller must separately authenticate authority.

    The output is not a SHARED_1 Observation/Inference: the integration lead must
    bind it to an independently authenticated SourceSnapshot and validate/fence
    official SHARED_1 records. No fabricated stable incident lineage or scores.
    """
    if not isinstance(statistics, dict):
        raise ValueError("statistics_required")
    policy = _policy(territory_policy)
    pair = statistics.get("pairSocialEvidence") or {}
    if pair.get("modelVersion") != PAIR_VERSION:
        raise ValueError("unsupported_pair_evidence_version")
    source = statistics.get("source") or {}
    scope = pair.get("gameScope") or {}
    fields = ("replaySha256", "recordedEventsSha256", "recordedEventsVersion", "parserVersion") if "recordedEventsVersion" in scope else (
        "replaySha256", "canonicalManifestSha256", "canonicalSchemaVersion", "parserVersion")
    if any(not isinstance(scope.get(k), str) or not scope[k] or scope[k] != source.get(k) for k in fields):
        raise ValueError("source_revision_mismatch")
    recorded_until = (statistics.get("scope") or {}).get("observedUntilMs")
    if not _integer(recorded_until):
        raise ValueError("recording_scope_missing")
    parts = statistics.get("participants") or []
    ids = [p.get("playerId") for p in parts]
    if not ids or any(type(v) is not int or v <= 0 for v in ids) or len(set(ids)) != len(ids):
        raise ValueError("ambiguous_recording_roster")
    facts = statistics.get("matchFacts") or {}
    players = (facts.get("players") or [])
    teams = {p.get("playerId"): p.get("lobbyTeamIdRaw") for p in players}
    if set(teams) != set(ids):
        raise ValueError("match_facts_roster_mismatch")
    rule = (facts.get("rules") or {}).get("lockTeams") or {}
    locked = rule.get("value") is True and rule.get("status") == "DECODED"
    anchors = {}
    for player in parts:
        presence = player.get("mapPresence") or {}
        anchor = presence.get("homeAnchor") or {}
        point = _point(anchor)
        if anchor.get("method") == "initial_town_center" and point is not None:
            anchors[player["playerId"]] = point
    # Starting-TC witness must be source-linked, exact and non-exhaustive.
    # Old Map Presence homeAnchor is rounded / possibly a multi-TC centroid.
    sources = {}
    all_source_ids = set()
    all_instances = set()
    for player in parts:
        pid = player["playerId"]
        witness = (player.get("mapPresence") or {}).get("startingTownCenters") or {}
        if witness:
            if (witness.get("modelVersion") != "AOF_STARTING_TOWN_CENTER_SOURCE_V1"
                    or witness.get("coverage") != "PARTIAL_HEADER_OBJECT_SEARCH"
                    or witness.get("exhaustiveInitialTcListEstablished") is not False):
                raise ValueError("untrusted_initial_town_center_coverage")
            records = witness.get("objects")
            if (not isinstance(records, list) or len(records) > 32
                    or witness.get("observedCount") != len(records)):
                raise ValueError("invalid_initial_town_center_count")
            for obj in records:
                if not isinstance(obj, dict) or type(obj.get("rawObjectId")) is not int or obj["rawObjectId"] < 0:
                    raise ValueError("invalid_initial_town_center_identity")
                ref, instance = obj.get("sourceEventId"), obj.get("objectInstanceId")
                if ref is not None:
                    if not isinstance(ref, str) or not ref or ref in all_source_ids:
                        raise ValueError("conflicting_initial_town_center_source")
                    all_source_ids.add(ref)
                if instance is not None:
                    if type(instance) is not int or instance < 0 or (pid, instance) in all_instances:
                        raise ValueError("conflicting_initial_town_center_instance")
                    all_instances.add((pid, instance))
                if obj.get("positionPrecision") == "ORIGINAL_DECODED_NO_ROUNDING":
                    if _point(obj.get("position")) is None:
                        raise ValueError("invalid_original_initial_town_center_position")
                elif obj.get("position") is not None:
                    raise ValueError("untrusted_initial_town_center_precision")
        sources[pid] = witness
    placements = []
    gold = []
    for player in parts:
        pid = player["playerId"]
        presence = player.get("mapPresence") or {}
        if presence.get("modelVersion") != MAP_VERSION:
            continue
        for placed in _placements(player):
            if placed["atMs"] > recorded_until:
                raise ValueError("placement_outside_recording_clock")
            territories = _territory(pid, _point(placed["position"]), anchors, teams, locked, policy)
            castle_home = (_castle_home_proximity(pid, _point(placed["position"]), sources, teams, locked)
                           if placed["buildingClass"] == "CASTLE_PLACEMENT" else None)
            reasons = ["COMPLETION_NOT_OBSERVED", "SAME_INSTANCE_QUEUE_NOT_VERIFIED",
                       "GENUINE_CASTLE_INSTANCE_BINDING_UNQUALIFIED", "TERR_01_ENEMY_TERRITORY_PENDING"] if castle_home else []
            if castle_home:
                reasons.extend(castle_home["reasonCodes"])
            placements.append({"actorReplayPlayerId": pid, **placed, "perOpponentTerritory": territories,
                               "specialForwardCastle": {
                                   "status": "PENDING",
                                   "reasonCodes": reasons,
                                   "homeProximity": castle_home,
                                   "sameInstanceQueueWindowMs": FORWARD_CASTLE_QUEUE_WINDOW_MS,
                                   "operationEstablished": False, "qualifies": False,
                               } if castle_home else None,
                               "sourceLayer": "OBSERVED_BUILD_PLACEMENT_AND_INFERRED_GEOMETRY",
                               "territoryPolicyApproval": "UNAPPROVED"})
            if len(placements) > max_placements:
                raise ValueError("context_placement_budget_exceeded")
        control = presence.get("goldControl") or {}
        if control.get("layer") == "inferred":
            gold.append({"actorReplayPlayerId": pid,
                         "controlSharePercent": control.get("controlSharePercent"),
                         "controlledGoldDepositEquivalent": control.get("controlledGoldDepositEquivalent"),
                         "takeoversWon": control.get("takeoversWon"), "takeoversLost": control.get("takeoversLost"),
                         "clusters": [{"clusterId": c.get("clusterId"), "center": c.get("center"),
                                       "depositCount": c.get("depositCount"),
                                       "playerClaimShare": c.get("playerClaimShare"),
                                       "finalInfluenceLeaderReplayPlayerId": c.get("finalControllerPlayerId"),
                                       "inferredInfluenceHistory": c.get("controlHistory"),
                                       "contributingPlacementSourceEventIds": sorted({
                                           v.get("sourceEventId") for v in c.get("playerContributions") or []
                                           if isinstance(v.get("sourceEventId"), str) and v.get("sourceEventId")})}
                                      for c in control.get("clusters") or []],
                         "meaning": "ESTIMATED_INFRASTRUCTURE_INFLUENCE_NOT_MINING_POSSESSION_OR_EXTRACTION"})
    if len({p["sourceEventId"] for p in placements}) != len(placements):
        raise ValueError("duplicate_build_placement_across_actors")
    deeds = _deed_contexts(pair, recorded_until)
    engagements = _engagement_contexts(parts, recorded_until)
    for deed in deeds:
        own = set(deed["sourceEventIds"])
        deed["linkedEngagementDetectors"] = [
            {"kind": e["kind"], "sourceDetectorId": e["sourceDetectorId"]}
            for e in engagements if own.intersection(e["sourceEventIds"])
        ]
    revision = _digest([VERSION, {k: scope[k] for k in fields},
                        statistics.get("statisticsProjectionVersion"), facts,
                        deeds, engagements, placements, gold, territory_policy])
    return {"version": VERSION, "compatibleSharedContract": SHARED_CONTRACT,
            "sourceContextRevision": revision,
            "sourceRevision": {k: scope[k] for k in fields},
            "trust": {"sourceScope": "CALLER_MUST_VERIFY_ACTIVE_READY_SOURCE",
                      "officialLeagueAuthority": False, "socialClaimsQualified": False,
                      "scoringOrPublicationEnabled": False},
            "territoryPolicy": {"status": "UNCONFIGURED" if policy is None else "PROPOSED_PREVIEW",
                                "parameters": policy, "approvedForClaims": False},
            "deedContexts": deeds, "engagementContexts": engagements,
            "placementContexts": sorted(placements, key=lambda p: (p["atMs"], p["actorReplayPlayerId"], p["sourceEventId"])),
            "goldInfluenceContexts": sorted(gold, key=lambda g: g["actorReplayPlayerId"]),
            "limitations": ["REQUESTED_COMMANDS_NOT_EXECUTION", "GAME_LOCAL_SOURCE_ONLY",
                            "UNKNOWN_OPPONENT_OPPORTUNITY_DENOMINATORS",
                            "NO_VERIFIED_COMPLETED_CASTLE_INSTANCE_OR_OWN_QUEUE_CHAIN",
                            "INITIAL_TC_SOURCE_SEARCH_NOT_EXHAUSTIVE",
                            "NO_MINED_GOLD_OR_POSSESSION_PROOF", "NO_RESCUE_DAMAGE_KILL_OR_INTENT_PROOF",
                            "DYNAMIC_DIPLOMACY_UNQUALIFIED", "NO_TRACK_CREDITS"]}
