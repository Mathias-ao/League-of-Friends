"""Map Presence V2 successor rules.

V2 keeps Command Map Coverage, Gold Control and First Relic Touch from V1, while
changing the geometry for Enemy Base Found, Forward Buildings and Expansions.
Historical V1 code is left intact for reproducibility.
"""
from __future__ import annotations

from collections import Counter, defaultdict
import math
from typing import Any, Iterable

import map_presence as v1

MAP_PRESENCE_MODEL_VERSION = "AOF_MAP_PRESENCE_V2"

ENEMY_BASE_FOUND_RADIUS_TILES = 14.0
ENEMY_BASE_AMBIGUITY_MARGIN_TILES = 2.0
FORWARD_MAX_ENEMY_DISTANCE_TILES = 40.0
FORWARD_ENEMY_ADVANTAGE_TILES = 6.0
EXPANSION_MIN_HOME_DISTANCE_TILES = 30.0
EXPANSION_DEDUPE_DISTANCE_TILES = 3.0


def _nearest_enemy_tc(
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
        if enemy_id == player_id or v1._same_team(player, enemy):
            continue
        anchor = anchors.get(enemy_id)
        if anchor is None or anchor.get("method") != "initial_town_center":
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
    if home is None or home.get("method") != "initial_town_center":
        return None
    nearest = _nearest_enemy_tc(
        player_id, x, y, participants=participants, anchors=anchors,
    )
    if nearest is None:
        return None
    enemy_id, enemy_distance = nearest
    home_distance = math.hypot(x - home["x"], y - home["y"])
    if enemy_distance > FORWARD_MAX_ENEMY_DISTANCE_TILES:
        return None
    if home_distance - enemy_distance < FORWARD_ENEMY_ADVANTAGE_TILES:
        return None
    return {
        "enemyPlayerId": enemy_id,
        "distanceFromHomeTownCenterTiles": round(home_distance, 2),
        "distanceToEnemyTownCenterTiles": round(enemy_distance, 2),
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
        point = v1._point_from_build(event)
        at_ms = event.get("atMs")
        if point is None or not isinstance(at_ms, int):
            continue
        forward = _forward_placement(
            player_id, point[0], point[1], participants=participants, anchors=anchors,
        )
        if forward is None:
            continue
        entity = v1._building_entity(catalog, event.get("buildingId"))
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
            "maximumEnemyTownCenterDistanceTiles": FORWARD_MAX_ENEMY_DISTANCE_TILES,
            "minimumEnemyDistanceAdvantageTiles": FORWARD_ENEMY_ADVANTAGE_TILES,
        },
        "evidence": evidence,
        "scope": (
            "building placement within 40 tiles of an enemy starting Town Center "
            "and at least 6 tiles closer to that enemy Town Center than to the "
            "player's starting Town Center; completion is not asserted"
        ),
    }


def _expansions(
    player_id: int,
    build_events: Iterable[dict[str, Any]],
    *,
    catalog: dict[str, Any],
    anchors: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    home = anchors.get(player_id)
    if home is None or home.get("method") != "initial_town_center":
        return {
            "layer": "inferred",
            "count": 0,
            "firstAtMs": None,
            "thresholds": {
                "minimumHomeTownCenterDistanceTiles": EXPANSION_MIN_HOME_DISTANCE_TILES,
                "dedupeDistanceTiles": EXPANSION_DEDUPE_DISTANCE_TILES,
            },
            "hubs": [],
            "status": "no_starting_town_center_anchor",
        }

    hubs: list[dict[str, Any]] = []
    accepted: list[tuple[float, float]] = []
    for event in sorted(
        (item for item in build_events if item.get("replaySlot") == player_id),
        key=lambda item: (item.get("atMs", 0), item.get("sourceEventId") or ""),
    ):
        if not v1._is_town_center(catalog, event.get("buildingId")):
            continue
        point = v1._point_from_build(event)
        at_ms = event.get("atMs")
        if point is None or not isinstance(at_ms, int):
            continue
        home_distance = math.hypot(point[0] - home["x"], point[1] - home["y"])
        if home_distance < EXPANSION_MIN_HOME_DISTANCE_TILES:
            continue
        if any(
            math.hypot(point[0] - px, point[1] - py) < EXPANSION_DEDUPE_DISTANCE_TILES
            for px, py in accepted
        ):
            continue
        accepted.append(point)
        hubs.append({
            "atMs": at_ms,
            "position": {"x": point[0], "y": point[1]},
            "distanceFromHomeTownCenterTiles": round(home_distance, 2),
            "building": v1._building_entity(catalog, event.get("buildingId")),
            "sourceEventId": event.get("sourceEventId"),
        })
    return {
        "layer": "inferred",
        "count": len(hubs),
        "firstAtMs": hubs[0]["atMs"] if hubs else None,
        "thresholds": {
            "minimumHomeTownCenterDistanceTiles": EXPANSION_MIN_HOME_DISTANCE_TILES,
            "dedupeDistanceTiles": EXPANSION_DEDUPE_DISTANCE_TILES,
        },
        "hubs": hubs,
        "status": "ok",
        "scope": (
            "Town Center placements at least 30 tiles from the player's starting "
            "Town Center; placement is the model input, not completion"
        ),
    }


def _enemy_base_contact(
    player_id: int,
    event: dict[str, Any],
    *,
    participants: dict[int, dict[str, Any]],
    anchors: dict[int, dict[str, Any]],
) -> dict[str, Any] | None:
    at_ms = event.get("timestampMs")
    if not isinstance(at_ms, int):
        return None
    player = participants[player_id]
    candidates: list[tuple[float, int, tuple[float, float]]] = []
    for point in v1._command_points(event):
        for enemy_id, enemy in participants.items():
            if enemy_id == player_id or v1._same_team(player, enemy):
                continue
            anchor = anchors.get(enemy_id)
            if anchor is None or anchor.get("method") != "initial_town_center":
                continue
            distance = math.hypot(point[0] - anchor["x"], point[1] - anchor["y"])
            if distance <= ENEMY_BASE_FOUND_RADIUS_TILES:
                candidates.append((distance, enemy_id, point))
    if not candidates:
        return None
    candidates.sort(key=lambda item: (item[0], item[1]))
    first = candidates[0]
    for second in candidates[1:]:
        if second[1] == first[1]:
            continue
        if second[0] - first[0] < ENEMY_BASE_AMBIGUITY_MARGIN_TILES:
            return None
        break
    distance, enemy_id, point = first
    return {
        "atMs": at_ms,
        "enemyPlayerId": enemy_id,
        "distanceToEnemyTownCenterTiles": round(distance, 2),
        "sourceActionName": event.get("sourceActionName"),
        "position": {"x": point[0], "y": point[1]},
        "sourceEventId": event.get("eventId"),
        "resolutionMethod": "command_coordinate_to_starting_town_center",
    }


def _enemy_base_found(
    player_id: int,
    action_events: Iterable[dict[str, Any]],
    *,
    participants: dict[int, dict[str, Any]],
    anchors: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    contacts: list[dict[str, Any]] = []
    first_by_enemy: dict[int, dict[str, Any]] = {}
    for event in sorted(
        (item for item in action_events if item.get("actorPlayerId") == player_id),
        key=lambda item: (item.get("timestampMs", 0), item.get("eventId") or ""),
    ):
        contact = _enemy_base_contact(
            player_id, event, participants=participants, anchors=anchors,
        )
        if contact is None:
            continue
        contacts.append(contact)
        first_by_enemy.setdefault(contact["enemyPlayerId"], contact)
    first = contacts[0] if contacts else None
    return {
        "layer": "inferred",
        "atMs": first["atMs"] if first else None,
        "enemyPlayerId": first["enemyPlayerId"] if first else None,
        "evidence": first,
        "firstByEnemy": {
            str(enemy_id): value for enemy_id, value in sorted(first_by_enemy.items())
        },
        "thresholds": {
            "maximumEnemyTownCenterDistanceTiles": ENEMY_BASE_FOUND_RADIUS_TILES,
            "ambiguityMarginTiles": ENEMY_BASE_AMBIGUITY_MARGIN_TILES,
        },
        "scope": (
            "first recorded command coordinate within 14 tiles of an enemy starting "
            "Town Center; hostile interaction is not required and actual fog-of-war "
            "visibility or unit arrival is not proven"
        ),
    }


def _gold_infrastructure(
    *,
    manifest: dict[str, Any],
    catalog: dict[str, Any],
    initial_objects: Iterable[dict[str, Any]],
    build_events: Iterable[dict[str, Any]],
    anchors: dict[int, dict[str, Any]],
) -> dict[int, list[dict[str, Any]]]:
    participants = v1._participants(manifest)
    result: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for event in initial_objects:
        payload = event.get("payload") or {}
        owner = payload.get("ownerPlayerId")
        if owner not in participants:
            continue
        point = v1._point_from_initial(event)
        if point is None:
            continue
        raw_id = payload.get("objectId")
        kind = v1._influence_kind(catalog, raw_id, False)
        if kind not in {"town_center", "mining_camp", "castle", "tower"}:
            continue
        result[int(owner)].append({
            "x": point[0], "y": point[1], "kind": kind, "buildingId": raw_id,
            "source": "initial_object", "sourceEventId": event.get("eventId"),
        })
    for event in build_events:
        owner = event.get("replaySlot")
        if owner not in participants:
            continue
        point = v1._point_from_build(event)
        if point is None:
            continue
        forward = _forward_placement(
            int(owner), point[0], point[1], participants=participants, anchors=anchors,
        )
        raw_id = event.get("buildingId")
        kind = v1._influence_kind(catalog, raw_id, forward is not None)
        if kind is None:
            continue
        result[int(owner)].append({
            "x": point[0], "y": point[1], "kind": kind, "buildingId": raw_id,
            "source": "building_placement", "sourceEventId": event.get("sourceEventId"),
        })
    return dict(result)


def project_map_presence(
    *,
    manifest: dict[str, Any],
    catalog: dict[str, Any],
    initial_objects: Iterable[dict[str, Any]],
    build_events: Iterable[dict[str, Any]],
    action_events: Iterable[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    """Return Map Presence V2 statistics for every participant."""
    initial_objects = list(initial_objects)
    build_events = list(build_events)
    action_events = list(action_events)
    participants = v1._participants(manifest)
    anchors = v1._home_anchors(manifest, catalog, initial_objects)
    clusters = v1._gold_clusters(initial_objects)
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
            "commandMapCoverage": v1._command_map_coverage(
                player_id, action_events, width=width, height=height,
            ),
            "forwardBuildings": _forward_buildings(
                player_id, build_events, catalog=catalog,
                participants=participants, anchors=anchors,
            ),
            "expansions": _expansions(
                player_id, build_events, catalog=catalog, anchors=anchors,
            ),
            "enemyBaseFound": _enemy_base_found(
                player_id, action_events, participants=participants, anchors=anchors,
            ),
            "goldControl": v1._gold_control(
                player_id, clusters, infrastructure, participants=participants,
            ),
            "firstRelicTouch": v1._first_relic_touch(
                player_id, action_events, initial_objects,
            ),
        }
    return result
