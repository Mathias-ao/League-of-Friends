"""Player-facing Map Presence statistics over canonical replay evidence.

The model intentionally separates observed command/building coordinates from inferred
spatial labels. It does not claim fog-of-war visibility, completed construction,
resource gathering, or continuous unit positions.
"""
from __future__ import annotations

from collections import Counter, defaultdict
import math
from typing import Any, Iterable

from raid_detector import (
    STRONG_POSITIONAL_ACTIONS,
    VICTIM_AMBIGUITY_MARGIN_TILES,
    build_economic_zones,
)

MAP_PRESENCE_MODEL_VERSION = "AOF_MAP_PRESENCE_V1"
MAP_OBJECT_REFERENCE_VERSION = "SiegeEngineers/aoc-reference-data@3e98c1eb4551d0704d4f73d294babcc4abcff3da"

# Pinned DE object ids used only for initial neutral map objects.
GOLD_OBJECT_IDS = {66, 841}  # Gold Mine, Gold Rock
RELIC_OBJECT_IDS = {285}

COMMAND_COVERAGE_CELL_TILES = 8
GOLD_CLUSTER_LINK_DISTANCE_TILES = 4.5
EXPANSION_MIN_HOME_DISTANCE_TILES = 14.0
EXPANSION_DEDUPE_DISTANCE_TILES = 3.0
FORWARD_MIN_HOME_DISTANCE_TILES = 16.0
FORWARD_ENEMY_ADVANTAGE_TILES = 4.0

# Gold influence is a final-match spatial proxy over observed placements.
# Contribution decays linearly to zero at the declared radius.
GOLD_INFLUENCE_PROFILE = {
    "town_center": {"weight": 4.0, "radiusTiles": 20.0},
    "mining_camp": {"weight": 3.0, "radiusTiles": 10.0},
    "castle": {"weight": 4.0, "radiusTiles": 16.0},
    "tower": {"weight": 2.0, "radiusTiles": 12.0},
    "forward_military": {"weight": 1.5, "radiusTiles": 12.0},
}

KNOWN_TOWN_CENTER_IDS = {71, 109, 621}
KNOWN_CASTLE_IDS = {82, 1251}  # Castle and Krepost reference ids.


def _participants(manifest: dict[str, Any]) -> dict[int, dict[str, Any]]:
    return {int(player["playerId"]): player for player in manifest.get("participants", [])}


def _same_team(left: dict[str, Any], right: dict[str, Any]) -> bool:
    a, b = left.get("lobbyTeamId"), right.get("lobbyTeamId")
    return isinstance(a, int) and isinstance(b, int) and a > 0 and a == b


def _catalog_building(catalog: dict[str, Any], raw_id: Any) -> dict[str, Any]:
    try:
        key = str(int(raw_id))
    except (TypeError, ValueError):
        return {}
    item = (catalog.get("buildings") or {}).get(key)
    return item if isinstance(item, dict) else {}


def _roles(catalog: dict[str, Any], raw_id: Any) -> set[str]:
    return set(_catalog_building(catalog, raw_id).get("roleKeys") or [])


def _building_entity(catalog: dict[str, Any], raw_id: Any) -> dict[str, Any]:
    item = _catalog_building(catalog, raw_id)
    return {
        "rawId": raw_id,
        "kind": "building",
        "name": item.get("name"),
        "roleKeys": item.get("roleKeys", []),
        "resolutionStatus": (
            "reference_catalog_unqualified_for_replay_patch" if item else "unresolved"
        ),
    }


def _is_town_center(catalog: dict[str, Any], raw_id: Any) -> bool:
    if raw_id in KNOWN_TOWN_CENTER_IDS:
        return True
    item = _catalog_building(catalog, raw_id)
    roles = set(item.get("roleKeys") or [])
    return "town_center" in roles or item.get("name") == "Town Center"


def _is_castle(catalog: dict[str, Any], raw_id: Any) -> bool:
    return raw_id in KNOWN_CASTLE_IDS


def _point_from_initial(event: dict[str, Any]) -> tuple[float, float] | None:
    pos = event.get("position") or {}
    x, y = pos.get("x"), pos.get("y")
    if not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
        return None
    return float(x), float(y)


def _point_from_build(event: dict[str, Any]) -> tuple[float, float] | None:
    x, y = event.get("x"), event.get("y")
    if not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
        return None
    return float(x), float(y)


def _home_anchors(
    manifest: dict[str, Any],
    catalog: dict[str, Any],
    initial_objects: Iterable[dict[str, Any]],
) -> dict[int, dict[str, Any]]:
    participant_ids = set(_participants(manifest))
    tc_points: dict[int, list[tuple[float, float]]] = defaultdict(list)
    all_points: dict[int, list[tuple[float, float]]] = defaultdict(list)

    for event in initial_objects:
        payload = event.get("payload") or {}
        owner = payload.get("ownerPlayerId")
        point = _point_from_initial(event)
        if owner not in participant_ids or point is None:
            continue
        owner = int(owner)
        all_points[owner].append(point)
        if _is_town_center(catalog, payload.get("objectId")):
            tc_points[owner].append(point)

    anchors: dict[int, dict[str, Any]] = {}
    for player_id in participant_ids:
        points = tc_points.get(player_id) or all_points.get(player_id) or []
        if not points:
            continue
        anchors[player_id] = {
            "x": sum(point[0] for point in points) / len(points),
            "y": sum(point[1] for point in points) / len(points),
            "method": "initial_town_center" if tc_points.get(player_id) else "initial_owned_object_centroid",
        }
    return anchors


def _nearest_enemy(
    player_id: int,
    x: float,
    y: float,
    *,
    participants: dict[int, dict[str, Any]],
    anchors: dict[int, dict[str, Any]],
) -> tuple[int, float] | None:
    player = participants[player_id]
    best: tuple[int, float] | None = None
    for enemy_id, enemy in participants.items():
        if enemy_id == player_id or _same_team(player, enemy):
            continue
        anchor = anchors.get(enemy_id)
        if anchor is None:
            continue
        distance = math.hypot(x - anchor["x"], y - anchor["y"])
        candidate = (enemy_id, distance)
        if best is None or distance < best[1] or (distance == best[1] and enemy_id < best[0]):
            best = candidate
    return best


def _forward_placement(
    player_id: int,
    x: float,
    y: float,
    *,
    participants: dict[int, dict[str, Any]],
    anchors: dict[int, dict[str, Any]],
) -> dict[str, Any] | None:
    home = anchors.get(player_id)
    if home is None:
        return None
    home_distance = math.hypot(x - home["x"], y - home["y"])
    if home_distance < FORWARD_MIN_HOME_DISTANCE_TILES:
        return None
    nearest = _nearest_enemy(
        player_id, x, y, participants=participants, anchors=anchors,
    )
    if nearest is None:
        return None
    enemy_id, enemy_distance = nearest
    if enemy_distance + FORWARD_ENEMY_ADVANTAGE_TILES > home_distance:
        return None
    return {
        "enemyPlayerId": enemy_id,
        "distanceFromHomeTiles": round(home_distance, 2),
        "distanceToEnemyAnchorTiles": round(enemy_distance, 2),
    }


def _forward_buildings(
    player_id: int,
    build_events: Iterable[dict[str, Any]],
    *,
    catalog: dict[str, Any],
    participants: dict[int, dict[str, Any]],
    anchors: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    evidence: list[dict[str, Any]] = []
    counts: Counter[str] = Counter()
    for event in sorted(
        (item for item in build_events if item.get("replaySlot") == player_id),
        key=lambda item: (item.get("atMs", 0), item.get("sourceEventId") or ""),
    ):
        point = _point_from_build(event)
        at_ms = event.get("atMs")
        if point is None or not isinstance(at_ms, int):
            continue
        forward = _forward_placement(
            player_id, point[0], point[1], participants=participants, anchors=anchors,
        )
        if forward is None:
            continue
        entity = _building_entity(catalog, event.get("buildingId"))
        key = entity.get("name") or f"raw:{event.get('buildingId')}"
        counts[str(key)] += 1
        evidence.append({
            "atMs": at_ms,
            "building": entity,
            "position": {"x": point[0], "y": point[1]},
            **forward,
            "sourceEventId": event.get("sourceEventId"),
        })
    return {
        "layer": "inferred",
        "count": len(evidence),
        "firstAtMs": evidence[0]["atMs"] if evidence else None,
        "byBuilding": dict(sorted(counts.items())),
        "thresholds": {
            "minimumHomeDistanceTiles": FORWARD_MIN_HOME_DISTANCE_TILES,
            "minimumEnemyDistanceAdvantageTiles": FORWARD_ENEMY_ADVANTAGE_TILES,
        },
        "evidence": evidence,
    }


def _expansions(
    player_id: int,
    build_events: Iterable[dict[str, Any]],
    *,
    catalog: dict[str, Any],
    anchors: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    home = anchors.get(player_id)
    if home is None:
        return {
            "layer": "inferred",
            "count": 0,
            "firstAtMs": None,
            "thresholds": {
                "minimumHomeDistanceTiles": EXPANSION_MIN_HOME_DISTANCE_TILES,
                "dedupeDistanceTiles": EXPANSION_DEDUPE_DISTANCE_TILES,
            },
            "hubs": [],
            "status": "no_home_anchor",
        }

    hubs: list[dict[str, Any]] = []
    accepted_points: list[tuple[float, float]] = []
    for event in sorted(
        (item for item in build_events if item.get("replaySlot") == player_id),
        key=lambda item: (item.get("atMs", 0), item.get("sourceEventId") or ""),
    ):
        if not _is_town_center(catalog, event.get("buildingId")):
            continue
        point = _point_from_build(event)
        at_ms = event.get("atMs")
        if point is None or not isinstance(at_ms, int):
            continue
        distance_home = math.hypot(point[0] - home["x"], point[1] - home["y"])
        if distance_home < EXPANSION_MIN_HOME_DISTANCE_TILES:
            continue
        if any(
            math.hypot(point[0] - px, point[1] - py) < EXPANSION_DEDUPE_DISTANCE_TILES
            for px, py in accepted_points
        ):
            continue
        accepted_points.append(point)
        hubs.append({
            "atMs": at_ms,
            "position": {"x": point[0], "y": point[1]},
            "distanceFromHomeTiles": round(distance_home, 2),
            "building": _building_entity(catalog, event.get("buildingId")),
            "sourceEventId": event.get("sourceEventId"),
        })

    return {
        "layer": "inferred",
        "count": len(hubs),
        "firstAtMs": hubs[0]["atMs"] if hubs else None,
        "thresholds": {
            "minimumHomeDistanceTiles": EXPANSION_MIN_HOME_DISTANCE_TILES,
            "dedupeDistanceTiles": EXPANSION_DEDUPE_DISTANCE_TILES,
        },
        "hubs": hubs,
        "status": "ok",
    }


def _command_points(event: dict[str, Any]) -> list[tuple[float, float]]:
    points: list[tuple[float, float]] = []
    for key in ("position", "endPosition"):
        pos = event.get(key) or {}
        x, y = pos.get("x"), pos.get("y")
        if isinstance(x, (int, float)) and isinstance(y, (int, float)):
            point = (float(x), float(y))
            if point not in points:
                points.append(point)
    return points


def _command_map_coverage(
    player_id: int,
    action_events: Iterable[dict[str, Any]],
    *,
    width: int,
    height: int,
) -> dict[str, Any]:
    columns = max(1, math.ceil(width / COMMAND_COVERAGE_CELL_TILES))
    rows = max(1, math.ceil(height / COMMAND_COVERAGE_CELL_TILES))
    cells: set[tuple[int, int]] = set()
    source_events: list[str] = []

    for event in action_events:
        if event.get("actorPlayerId") != player_id:
            continue
        used = False
        for x, y in _command_points(event):
            if not (0 <= x < width and 0 <= y < height):
                continue
            cells.add((
                min(columns - 1, int(x // COMMAND_COVERAGE_CELL_TILES)),
                min(rows - 1, int(y // COMMAND_COVERAGE_CELL_TILES)),
            ))
            used = True
        if used and event.get("eventId"):
            source_events.append(event["eventId"])

    total = columns * rows
    percent = round(len(cells) / total * 100.0, 2) if total else 0.0
    return {
        "layer": "reconstructed",
        "percent": percent,
        "coveredCellCount": len(cells),
        "totalCellCount": total,
        "cellSizeTiles": COMMAND_COVERAGE_CELL_TILES,
        "scope": "cells containing recorded player command coordinates/endpoints; not fog-of-war exploration",
        "sourceEventIds": source_events,
    }


def _initial_neutral_objects(
    initial_objects: Iterable[dict[str, Any]],
    raw_ids: set[int],
) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for event in initial_objects:
        payload = event.get("payload") or {}
        raw_id = payload.get("objectId")
        if raw_id not in raw_ids:
            continue
        point = _point_from_initial(event)
        if point is None:
            continue
        result.append({
            "rawObjectId": raw_id,
            "instanceId": payload.get("instanceId"),
            "x": point[0],
            "y": point[1],
            "sourceEventId": event.get("eventId"),
        })
    return result


def _cluster_points(objects: list[dict[str, Any]], link_distance: float) -> list[list[dict[str, Any]]]:
    remaining = set(range(len(objects)))
    clusters: list[list[dict[str, Any]]] = []
    while remaining:
        seed = remaining.pop()
        queue = [seed]
        indexes = {seed}
        while queue:
            current = queue.pop()
            cx, cy = objects[current]["x"], objects[current]["y"]
            linked = [
                index for index in list(remaining)
                if math.hypot(objects[index]["x"] - cx, objects[index]["y"] - cy) <= link_distance
            ]
            for index in linked:
                remaining.remove(index)
                indexes.add(index)
                queue.append(index)
        clusters.append([objects[index] for index in sorted(indexes)])
    return clusters


def _gold_clusters(initial_objects: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    mines = _initial_neutral_objects(initial_objects, GOLD_OBJECT_IDS)
    clusters = _cluster_points(mines, GOLD_CLUSTER_LINK_DISTANCE_TILES)
    result: list[dict[str, Any]] = []
    for number, cluster in enumerate(
        sorted(
            clusters,
            key=lambda group: (min(item["x"] for item in group), min(item["y"] for item in group)),
        ),
        start=1,
    ):
        result.append({
            "clusterId": f"gold-{number}",
            "x": sum(item["x"] for item in cluster) / len(cluster),
            "y": sum(item["y"] for item in cluster) / len(cluster),
            "mineCount": len(cluster),
            "mineInstanceIds": [
                item["instanceId"] for item in cluster if isinstance(item.get("instanceId"), int)
            ],
            "sourceEventIds": [item["sourceEventId"] for item in cluster if item.get("sourceEventId")],
        })
    return result


def _influence_kind(catalog: dict[str, Any], raw_id: Any, is_forward: bool) -> str | None:
    roles = _roles(catalog, raw_id)
    if _is_town_center(catalog, raw_id):
        return "town_center"
    if "mining_camp" in roles:
        return "mining_camp"
    if _is_castle(catalog, raw_id):
        return "castle"
    if "tower" in roles:
        return "tower"
    if is_forward and roles.intersection({"military_production", "naval_production"}):
        return "forward_military"
    return None


def _influence_contribution(kind: str, distance: float) -> float:
    profile = GOLD_INFLUENCE_PROFILE[kind]
    radius = float(profile["radiusTiles"])
    if distance > radius:
        return 0.0
    return float(profile["weight"]) * max(0.0, 1.0 - distance / radius)


def _gold_infrastructure(
    *,
    manifest: dict[str, Any],
    catalog: dict[str, Any],
    initial_objects: Iterable[dict[str, Any]],
    build_events: Iterable[dict[str, Any]],
    anchors: dict[int, dict[str, Any]],
) -> dict[int, list[dict[str, Any]]]:
    participants = _participants(manifest)
    result: dict[int, list[dict[str, Any]]] = defaultdict(list)

    for event in initial_objects:
        payload = event.get("payload") or {}
        owner = payload.get("ownerPlayerId")
        if owner not in participants:
            continue
        point = _point_from_initial(event)
        if point is None:
            continue
        raw_id = payload.get("objectId")
        kind = _influence_kind(catalog, raw_id, False)
        if kind not in {"town_center", "mining_camp", "castle", "tower"}:
            continue
        result[int(owner)].append({
            "x": point[0],
            "y": point[1],
            "kind": kind,
            "buildingId": raw_id,
            "source": "initial_object",
            "sourceEventId": event.get("eventId"),
        })

    for event in build_events:
        owner = event.get("replaySlot")
        if owner not in participants:
            continue
        point = _point_from_build(event)
        if point is None:
            continue
        forward = _forward_placement(
            int(owner), point[0], point[1], participants=participants, anchors=anchors,
        )
        raw_id = event.get("buildingId")
        kind = _influence_kind(catalog, raw_id, forward is not None)
        if kind is None:
            continue
        result[int(owner)].append({
            "x": point[0],
            "y": point[1],
            "kind": kind,
            "buildingId": raw_id,
            "source": "building_placement",
            "sourceEventId": event.get("sourceEventId"),
        })

    return dict(result)


def _gold_control(
    player_id: int,
    clusters: list[dict[str, Any]],
    infrastructure: dict[int, list[dict[str, Any]]],
    *,
    participants: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    if not clusters:
        return {
            "layer": "inferred",
            "controlSharePercent": None,
            "goldClusterCount": 0,
            "influencedClusterEquivalent": 0.0,
            "referenceObjectIds": sorted(GOLD_OBJECT_IDS),
            "referenceVersion": MAP_OBJECT_REFERENCE_VERSION,
            "clusters": [],
            "status": "no_supported_gold_objects",
        }

    player_equivalent = 0.0
    cluster_evidence: list[dict[str, Any]] = []
    for cluster in clusters:
        raw_scores: dict[int, float] = {}
        contributions: dict[int, list[dict[str, Any]]] = defaultdict(list)
        for candidate_id in participants:
            total = 0.0
            for building in infrastructure.get(candidate_id, []):
                distance = math.hypot(cluster["x"] - building["x"], cluster["y"] - building["y"])
                contribution = _influence_contribution(building["kind"], distance)
                if contribution <= 0:
                    continue
                total += contribution
                contributions[candidate_id].append({
                    "kind": building["kind"],
                    "buildingId": building["buildingId"],
                    "distanceTiles": round(distance, 2),
                    "contribution": round(contribution, 4),
                    "sourceEventId": building.get("sourceEventId"),
                })
            raw_scores[candidate_id] = total

        score_sum = sum(raw_scores.values())
        shares = {
            candidate_id: (score / score_sum if score_sum > 0 else 0.0)
            for candidate_id, score in raw_scores.items()
        }
        player_share = shares.get(player_id, 0.0)
        player_equivalent += player_share
        cluster_evidence.append({
            "clusterId": cluster["clusterId"],
            "center": {"x": round(cluster["x"], 2), "y": round(cluster["y"], 2)},
            "mineCount": cluster["mineCount"],
            "playerClaimShare": round(player_share, 4),
            "allPlayerClaimShares": {
                str(candidate_id): round(share, 4)
                for candidate_id, share in sorted(shares.items())
                if share > 0
            },
            "playerContributions": contributions.get(player_id, []),
            "unclaimed": score_sum == 0,
        })

    return {
        "layer": "inferred",
        "controlSharePercent": round(player_equivalent / len(clusters) * 100.0, 2),
        "goldClusterCount": len(clusters),
        "influencedClusterEquivalent": round(player_equivalent, 3),
        "referenceObjectIds": sorted(GOLD_OBJECT_IDS),
        "referenceVersion": MAP_OBJECT_REFERENCE_VERSION,
        "influenceProfile": GOLD_INFLUENCE_PROFILE,
        "clusters": cluster_evidence,
        "status": "ok",
        "scope": "weighted final-placement spatial influence; not gold gathered or permanent ownership",
    }


def _zone_match(
    zones: list[dict[str, Any]], *, at_ms: int, x: float, y: float,
) -> tuple[float, dict[str, Any]] | None:
    best: tuple[float, dict[str, Any]] | None = None
    for zone in zones:
        if zone["activeFromMs"] > at_ms:
            continue
        distance = math.hypot(x - zone["x"], y - zone["y"])
        if distance > zone["radiusTiles"]:
            continue
        if best is None or distance < best[0]:
            best = (distance, zone)
    return best


def _strong_enemy_base_contact(
    event: dict[str, Any],
    *,
    attacker: dict[str, Any],
    participants: dict[int, dict[str, Any]],
    zones: dict[int, list[dict[str, Any]]],
    initial_object_owners: dict[int, int],
) -> dict[str, Any] | None:
    action = event.get("sourceActionName")
    at_ms = event.get("timestampMs")
    points = _command_points(event)
    if not isinstance(at_ms, int) or not points:
        return None
    x, y = points[0]

    if action == "ORDER":
        target = event.get("targetInstanceId")
        owner = initial_object_owners.get(target) if isinstance(target, int) else None
        if (
            owner in participants
            and owner != attacker["playerId"]
            and not _same_team(attacker, participants[owner])
        ):
            match = _zone_match(zones.get(owner, []), at_ms=at_ms, x=x, y=y)
            if match is not None:
                return {
                    "enemyPlayerId": owner,
                    "distanceToEconomicSeedTiles": round(match[0], 2),
                    "resolutionMethod": "target_instance_owner",
                }
        return None

    if action not in STRONG_POSITIONAL_ACTIONS:
        return None

    matches: list[tuple[float, int]] = []
    for enemy_id, enemy in participants.items():
        if enemy_id == attacker["playerId"] or _same_team(attacker, enemy):
            continue
        match = _zone_match(zones.get(enemy_id, []), at_ms=at_ms, x=x, y=y)
        if match is not None:
            matches.append((match[0], enemy_id))
    if not matches:
        return None
    matches.sort(key=lambda item: (item[0], item[1]))
    if len(matches) > 1 and matches[1][0] - matches[0][0] < VICTIM_AMBIGUITY_MARGIN_TILES:
        return None
    distance, enemy_id = matches[0]
    return {
        "enemyPlayerId": enemy_id,
        "distanceToEconomicSeedTiles": round(distance, 2),
        "resolutionMethod": "economic_zone_proximity",
    }


def _enemy_base_found(
    player_id: int,
    action_events: Iterable[dict[str, Any]],
    *,
    participants: dict[int, dict[str, Any]],
    zones: dict[int, list[dict[str, Any]]],
    initial_object_owners: dict[int, int],
) -> dict[str, Any]:
    contacts: list[dict[str, Any]] = []
    first_by_enemy: dict[int, dict[str, Any]] = {}
    attacker = participants[player_id]

    for event in sorted(
        (item for item in action_events if item.get("actorPlayerId") == player_id),
        key=lambda item: (item.get("timestampMs", 0), item.get("eventId") or ""),
    ):
        resolved = _strong_enemy_base_contact(
            event,
            attacker=attacker,
            participants=participants,
            zones=zones,
            initial_object_owners=initial_object_owners,
        )
        if resolved is None:
            continue
        point = _command_points(event)[0]
        contact = {
            "atMs": event["timestampMs"],
            "sourceActionName": event.get("sourceActionName"),
            "position": {"x": point[0], "y": point[1]},
            "sourceEventId": event.get("eventId"),
            **resolved,
        }
        contacts.append(contact)
        first_by_enemy.setdefault(resolved["enemyPlayerId"], contact)

    first = contacts[0] if contacts else None
    return {
        "layer": "inferred",
        "atMs": first["atMs"] if first else None,
        "enemyPlayerId": first["enemyPlayerId"] if first else None,
        "evidence": first,
        "firstByEnemy": {
            str(enemy_id): value for enemy_id, value in sorted(first_by_enemy.items())
        },
        "scope": "first strong hostile command/contact inside a reconstructed enemy economic zone",
    }


def _first_relic_touch(
    player_id: int,
    action_events: Iterable[dict[str, Any]],
    initial_objects: Iterable[dict[str, Any]],
) -> dict[str, Any]:
    relics = {
        item["instanceId"]: item
        for item in _initial_neutral_objects(initial_objects, RELIC_OBJECT_IDS)
        if isinstance(item.get("instanceId"), int)
    }
    for event in sorted(
        (item for item in action_events if item.get("actorPlayerId") == player_id),
        key=lambda item: (item.get("timestampMs", 0), item.get("eventId") or ""),
    ):
        if event.get("sourceActionName") not in {"ORDER", "SPECIAL"}:
            continue
        target = event.get("targetInstanceId")
        if target not in relics:
            continue
        relic = relics[target]
        return {
            "layer": "reconstructed",
            "atMs": event.get("timestampMs"),
            "relicInstanceId": target,
            "relicPosition": {"x": relic["x"], "y": relic["y"]},
            "sourceActionName": event.get("sourceActionName"),
            "sourceEventId": event.get("eventId"),
            "referenceObjectId": relic["rawObjectId"],
            "referenceVersion": MAP_OBJECT_REFERENCE_VERSION,
            "scope": "first ORDER/SPECIAL command targeting a known initial relic; not proof of pickup",
        }
    return {
        "layer": "reconstructed",
        "atMs": None,
        "relicInstanceId": None,
        "relicPosition": None,
        "sourceActionName": None,
        "sourceEventId": None,
        "referenceObjectId": None,
        "referenceVersion": MAP_OBJECT_REFERENCE_VERSION,
        "scope": "first ORDER/SPECIAL command targeting a known initial relic; not proof of pickup",
    }


def project_map_presence(
    *,
    manifest: dict[str, Any],
    catalog: dict[str, Any],
    initial_objects: Iterable[dict[str, Any]],
    build_events: Iterable[dict[str, Any]],
    action_events: Iterable[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    """Return Map Presence V1 statistics for every participant."""
    initial_objects = list(initial_objects)
    build_events = list(build_events)
    action_events = list(action_events)
    participants = _participants(manifest)
    anchors = _home_anchors(manifest, catalog, initial_objects)
    zones, initial_object_owners = build_economic_zones(
        manifest=manifest,
        catalog=catalog,
        initial_objects=initial_objects,
        build_events=build_events,
    )
    clusters = _gold_clusters(initial_objects)
    infrastructure = _gold_infrastructure(
        manifest=manifest,
        catalog=catalog,
        initial_objects=initial_objects,
        build_events=build_events,
        anchors=anchors,
    )
    map_data = (manifest.get("initialState") or {}).get("map") or {}
    width = int(map_data.get("width") or 1)
    height = int(map_data.get("height") or 1)

    result: dict[str, dict[str, Any]] = {}
    for player_id in sorted(participants):
        result[str(player_id)] = {
            "modelVersion": MAP_PRESENCE_MODEL_VERSION,
            "commandMapCoverage": _command_map_coverage(
                player_id, action_events, width=width, height=height,
            ),
            "forwardBuildings": _forward_buildings(
                player_id,
                build_events,
                catalog=catalog,
                participants=participants,
                anchors=anchors,
            ),
            "expansions": _expansions(
                player_id, build_events, catalog=catalog, anchors=anchors,
            ),
            "enemyBaseFound": _enemy_base_found(
                player_id,
                action_events,
                participants=participants,
                zones=zones,
                initial_object_owners=initial_object_owners,
            ),
            "goldControl": _gold_control(
                player_id, clusters, infrastructure, participants=participants,
            ),
            "firstRelicTouch": _first_relic_touch(
                player_id, action_events, initial_objects,
            ),
        }
    return result
