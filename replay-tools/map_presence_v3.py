"""Map Presence V3 fundamentals over command/building coordinates.

V3 keeps the conservative V2 definitions and adds player-facing spatial
fundamentals needed for later combat/engagement inference. It does not claim
continuous unit positions, fog-of-war visibility, construction completion, or
territorial ownership.
"""
from __future__ import annotations

from collections import Counter
import math
from typing import Any, Iterable

import map_presence as v1
import map_presence_v2 as v2

MAP_PRESENCE_MODEL_VERSION = "AOF_MAP_PRESENCE_V3"
ENEMY_SIDE_AMBIGUITY_MARGIN_TILES = 2.0


def _building_category(catalog: dict[str, Any], raw_id: Any) -> str:
    item = v1._catalog_building(catalog, raw_id)
    roles = set(item.get("roleKeys") or [])
    name = str(item.get("name") or "")

    if v1._is_town_center(catalog, raw_id) or roles.intersection({
        "economy", "farm", "mill", "lumber_camp", "mining_camp",
        "market", "naval_economy",
    }):
        return "economy"
    if roles.intersection({"military_production", "naval_production"}):
        return "militaryProduction"
    if v1._is_castle(catalog, raw_id) or roles.intersection({
        "tower", "fortification", "wall",
    }):
        return "defensive"
    if name in {"Monastery", "University", "Blacksmith"}:
        return "support"
    return "other"


def _forward_buildings(
    player_id: int,
    build_events: Iterable[dict[str, Any]],
    *,
    catalog: dict[str, Any],
    participants: dict[int, dict[str, Any]],
    anchors: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    base = v2._forward_buildings(
        player_id,
        build_events,
        catalog=catalog,
        participants=participants,
        anchors=anchors,
    )
    by_category: Counter[str] = Counter()
    deepest = None
    closest_enemy = None
    farthest_home = None

    for row in base.get("evidence") or []:
        building = row.get("building") or {}
        raw_id = building.get("rawId")
        by_category[_building_category(catalog, raw_id)] += 1

        home_distance = row.get("distanceFromHomeTownCenterTiles")
        enemy_distance = row.get("distanceToEnemyTownCenterTiles")
        if isinstance(home_distance, (int, float)) and isinstance(enemy_distance, (int, float)):
            advantage = float(home_distance) - float(enemy_distance)
            deepest = advantage if deepest is None else max(deepest, advantage)
            closest_enemy = (
                float(enemy_distance)
                if closest_enemy is None
                else min(closest_enemy, float(enemy_distance))
            )
            farthest_home = (
                float(home_distance)
                if farthest_home is None
                else max(farthest_home, float(home_distance))
            )

    return {
        **base,
        "byCategory": dict(sorted(by_category.items())),
        "deepest": {
            "maxEnemyDistanceAdvantageTiles": round(deepest, 2) if deepest is not None else None,
            "closestEnemyTownCenterDistanceTiles": round(closest_enemy, 2) if closest_enemy is not None else None,
            "farthestFromHomeTownCenterTiles": round(farthest_home, 2) if farthest_home is not None else None,
            "basis": (
                "depth diagnostics over qualifying forward placements; positive enemy-distance "
                "advantage means the placement is closer to the referenced enemy starting TC "
                "than to the player's starting TC"
            ),
        },
    }


def _building_spread(
    player_id: int,
    build_events: Iterable[dict[str, Any]],
    *,
    anchors: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    home = anchors.get(player_id)
    if home is None or home.get("method") != "initial_town_center":
        return {
            "layer": "reconstructed",
            "maxPairwiseDistanceTiles": None,
            "maxDistanceFromHomeTownCenterTiles": None,
            "placementPointCount": 0,
            "status": "no_starting_town_center_anchor",
        }

    points: list[tuple[float, float]] = [(float(home["x"]), float(home["y"]))]
    placement_count = 0
    max_home = 0.0
    for event in build_events:
        if event.get("replaySlot") != player_id:
            continue
        point = v1._point_from_build(event)
        if point is None:
            continue
        placement_count += 1
        points.append(point)
        max_home = max(
            max_home,
            math.hypot(point[0] - float(home["x"]), point[1] - float(home["y"])),
        )

    max_pairwise = 0.0
    for index, left in enumerate(points):
        for right in points[index + 1:]:
            max_pairwise = max(
                max_pairwise,
                math.hypot(left[0] - right[0], left[1] - right[1]),
            )

    return {
        "layer": "reconstructed",
        "maxPairwiseDistanceTiles": round(max_pairwise, 2),
        "maxDistanceFromHomeTownCenterTiles": round(max_home, 2),
        "placementPointCount": placement_count,
        "basis": (
            "maximum geometric spread across the starting-TC anchor and observed BUILD "
            "placement coordinates; not completed/surviving settlement footprint"
        ),
        "status": "ok",
    }


def _enemy_side_presence(
    player_id: int,
    action_events: Iterable[dict[str, Any]],
    *,
    participants: dict[int, dict[str, Any]],
    anchors: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    home = anchors.get(player_id)
    if home is None or home.get("method") != "initial_town_center":
        return {
            "layer": "reconstructed",
            "percent": None,
            "enemySideCommandEvents": 0,
            "classifiedCommandEvents": 0,
            "positionedCommandEvents": 0,
            "ambiguousCommandEvents": 0,
            "byEnemy": {},
            "status": "no_starting_town_center_anchor",
        }

    player = participants[player_id]
    enemy_anchors = []
    for enemy_id, enemy in participants.items():
        if enemy_id == player_id or v1._same_team(player, enemy):
            continue
        anchor = anchors.get(enemy_id)
        if anchor is None or anchor.get("method") != "initial_town_center":
            continue
        enemy_anchors.append((enemy_id, anchor))

    if not enemy_anchors:
        return {
            "layer": "reconstructed",
            "percent": None,
            "enemySideCommandEvents": 0,
            "classifiedCommandEvents": 0,
            "positionedCommandEvents": 0,
            "ambiguousCommandEvents": 0,
            "byEnemy": {},
            "status": "no_enemy_starting_town_center_anchor",
        }

    positioned = 0
    classified = 0
    enemy_side = 0
    ambiguous = 0
    by_enemy: Counter[int] = Counter()

    for event in action_events:
        if event.get("actorPlayerId") != player_id:
            continue
        points = v1._command_points(event)
        if not points:
            continue
        positioned += 1

        candidates: list[tuple[float, int, float]] = []
        for point in points:
            home_distance = math.hypot(
                point[0] - float(home["x"]), point[1] - float(home["y"]),
            )
            distances = sorted(
                (
                    math.hypot(point[0] - float(anchor["x"]), point[1] - float(anchor["y"])),
                    enemy_id,
                )
                for enemy_id, anchor in enemy_anchors
            )
            nearest_distance, nearest_enemy = distances[0]
            if (
                len(distances) > 1
                and distances[1][0] - nearest_distance < ENEMY_SIDE_AMBIGUITY_MARGIN_TILES
            ):
                continue
            advantage = home_distance - nearest_distance
            candidates.append((advantage, nearest_enemy, nearest_distance))

        if not candidates:
            ambiguous += 1
            continue

        classified += 1
        advantage, enemy_id, _ = max(candidates, key=lambda row: (row[0], -row[1]))
        if advantage > 0:
            enemy_side += 1
            by_enemy[enemy_id] += 1

    percent = round(100.0 * enemy_side / classified, 2) if classified else None
    return {
        "layer": "reconstructed",
        "percent": percent,
        "enemySideCommandEvents": enemy_side,
        "classifiedCommandEvents": classified,
        "positionedCommandEvents": positioned,
        "ambiguousCommandEvents": ambiguous,
        "byEnemy": {str(key): value for key, value in sorted(by_enemy.items())},
        "ambiguityMarginTiles": ENEMY_SIDE_AMBIGUITY_MARGIN_TILES,
        "basis": (
            "share of positioned command events whose recorded coordinate is closer to an "
            "opponent starting TC than to the player's starting TC; teammates are excluded"
        ),
        "note": (
            "This is command-side presence, not continuous army presence, visibility, map "
            "ownership, or proof that selected units reached the coordinate."
        ),
        "status": "ok",
    }


def project_map_presence(
    *,
    manifest: dict[str, Any],
    catalog: dict[str, Any],
    initial_objects: Iterable[dict[str, Any]],
    build_events: Iterable[dict[str, Any]],
    action_events: Iterable[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    """Return Map Presence V3 statistics for every participant."""
    initial_objects = list(initial_objects)
    build_events = list(build_events)
    action_events = list(action_events)

    participants = v1._participants(manifest)
    anchors = v1._home_anchors(manifest, catalog, initial_objects)
    clusters = v1._gold_clusters(initial_objects)
    infrastructure = v2._gold_infrastructure(
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
        anchor = anchors.get(player_id)
        result[str(player_id)] = {
            "modelVersion": MAP_PRESENCE_MODEL_VERSION,
            "homeAnchor": {
                "layer": "reconstructed",
                "x": round(float(anchor["x"]), 2) if anchor else None,
                "y": round(float(anchor["y"]), 2) if anchor else None,
                "method": anchor.get("method") if anchor else None,
                "basis": "initial Town Center coordinate when available",
            },
            "commandMapCoverage": v1._command_map_coverage(
                player_id, action_events, width=width, height=height,
            ),
            "enemySideCommandPresence": _enemy_side_presence(
                player_id,
                action_events,
                participants=participants,
                anchors=anchors,
            ),
            "buildingSpread": _building_spread(
                player_id, build_events, anchors=anchors,
            ),
            "forwardBuildings": _forward_buildings(
                player_id,
                build_events,
                catalog=catalog,
                participants=participants,
                anchors=anchors,
            ),
            "expansionTownCenters": v2._expansions(
                player_id, build_events, catalog=catalog, anchors=anchors,
            ),
            "enemyBaseContact": v2._enemy_base_found(
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
