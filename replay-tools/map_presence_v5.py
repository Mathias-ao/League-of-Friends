"""Map Presence V5 refinements over V4 spatial fundamentals.

V5 keeps V4's normalized Enemy Progress geometry and evidence boundaries while
refining three concepts:
- Scout Coverage @5:00 becomes a command-directed route corridor with explicit
  candidate/attribution diagnostics instead of endpoint-cell coverage.
- Eco Camps mean Mill/Folwark, Lumber Camp and Mining Camp.
- Expansion Zones are clustered remote economy/territorial placements rather
  than a Town-Center-only distance threshold.

Enemy-base contact remains fully pairwise in the derived data package for later
relationship analysis. None of these models asserts fog-of-war visibility,
building completion/survival, or continuous unit position.
"""
from __future__ import annotations

from collections import Counter, defaultdict
import math
from typing import Any, Iterable

import map_presence as v1
import map_presence_v4 as v4

MAP_PRESENCE_MODEL_VERSION = "AOF_MAP_PRESENCE_V5"

SCOUT_COVERAGE_WINDOW_MS = 300_000
SCOUT_ROUTE_RADIUS_TILES = 6.0
EXPANSION_HOME_RADIUS_MAP_FRACTION = 0.13
EXPANSION_CLUSTER_LINK_TILES = 12.0

ECO_CAMP_ROLE_KEYS = {"mill", "lumber_camp", "mining_camp"}
EXPANSION_ROLE_KEYS = {
    "mill",
    "lumber_camp",
    "mining_camp",
    "market",
    "town_center",
    "dock",
    "harbor",
    "castle",
}


def _catalog_unit(catalog: dict[str, Any], raw_id: Any) -> dict[str, Any]:
    return v4._catalog_unit(catalog, raw_id)


def _catalog_building(catalog: dict[str, Any], raw_id: Any) -> dict[str, Any]:
    return v1._catalog_building(catalog, raw_id)


def _initial_owned_unit_candidates(
    player_id: int,
    initial_objects: Iterable[dict[str, Any]],
    catalog: dict[str, Any],
) -> list[dict[str, Any]]:
    buildings = catalog.get("buildings") or {}
    candidates: list[dict[str, Any]] = []
    for event in initial_objects:
        payload = event.get("payload") or {}
        if payload.get("ownerPlayerId") != player_id:
            continue
        raw_id = payload.get("objectId")
        instance_id = payload.get("instanceId")
        if not isinstance(instance_id, int):
            continue
        try:
            raw_key = str(int(raw_id))
        except (TypeError, ValueError):
            raw_key = ""
        if raw_key and raw_key in buildings:
            continue
        item = _catalog_unit(catalog, raw_id)
        roles = set(item.get("roleKeys") or [])
        name = str(item.get("name") or "")
        lowered = name.lower()
        excluded = (
            {"villager", "civilian", "king", "monk", "herdable"} & roles
            or any(token in lowered for token in (
                "villager", "sheep", "goat", "boar", "deer", "king", "monk",
            ))
        )
        if excluded:
            continue
        position = event.get("position") or {}
        x, y = position.get("x"), position.get("y")
        candidates.append({
            "instanceId": instance_id,
            "rawId": raw_id,
            "name": item.get("name"),
            "roleKeys": sorted(roles),
            "x": float(x) if isinstance(x, (int, float)) else None,
            "y": float(y) if isinstance(y, (int, float)) else None,
            "sourceEventId": event.get("eventId"),
        })
    return candidates


def _is_explicit_scout(candidate: dict[str, Any]) -> bool:
    raw_id = candidate.get("rawId")
    roles = set(candidate.get("roleKeys") or [])
    name = str(candidate.get("name") or "").lower()
    return (
        raw_id in v4.STARTING_SCOUT_RAW_IDS
        or "scout_cavalry" in roles
        or "scout" in name
        or "eagle" in name
        or ("camel" in name and "scout" in name)
    )


def _candidate_command_diagnostics(
    player_id: int,
    action_events: Iterable[dict[str, Any]],
    candidates: list[dict[str, Any]],
    *,
    home: dict[str, Any] | None,
) -> dict[int, dict[str, Any]]:
    ids = {row["instanceId"] for row in candidates}
    diagnostics = {
        row["instanceId"]: {
            "instanceId": row["instanceId"],
            "rawId": row.get("rawId"),
            "name": row.get("name"),
            "positionedCommandCount": 0,
            "moveLikeCommandCount": 0,
            "uniqueDestinationCount": 0,
            "maximumDestinationDistanceFromHomeTiles": 0.0,
            "_destinations": set(),
        }
        for row in candidates
    }
    move_like = {"MOVE", "ORDER", "PATROL", "ATTACK_MOVE", "SPECIAL"}
    for event in action_events:
        if event.get("actorPlayerId") != player_id:
            continue
        at_ms = event.get("timestampMs")
        if not isinstance(at_ms, int) or at_ms >= SCOUT_COVERAGE_WINDOW_MS:
            continue
        selected = ids.intersection(event.get("objectInstanceIds") or [])
        if not selected:
            continue
        points = v1._command_points(event)
        if not points:
            continue
        for instance_id in selected:
            row = diagnostics[instance_id]
            row["positionedCommandCount"] += 1
            if event.get("sourceActionName") in move_like:
                row["moveLikeCommandCount"] += 1
            for x, y in points:
                row["_destinations"].add((round(float(x), 2), round(float(y), 2)))
                if home is not None:
                    distance = math.hypot(
                        float(x) - float(home["x"]),
                        float(y) - float(home["y"]),
                    )
                    row["maximumDestinationDistanceFromHomeTiles"] = max(
                        row["maximumDestinationDistanceFromHomeTiles"], distance,
                    )
    for row in diagnostics.values():
        row["uniqueDestinationCount"] = len(row.pop("_destinations"))
        row["maximumDestinationDistanceFromHomeTiles"] = round(
            row["maximumDestinationDistanceFromHomeTiles"], 2,
        )
    return diagnostics


def _choose_scout_candidates(
    player_id: int,
    action_events: Iterable[dict[str, Any]],
    initial_objects: Iterable[dict[str, Any]],
    catalog: dict[str, Any],
    *,
    home: dict[str, Any] | None,
) -> tuple[list[dict[str, Any]], str, list[dict[str, Any]]]:
    candidates = _initial_owned_unit_candidates(player_id, initial_objects, catalog)
    diagnostics = _candidate_command_diagnostics(
        player_id, action_events, candidates, home=home,
    )
    explicit = [row for row in candidates if _is_explicit_scout(row)]
    explicit_with_commands = [
        row for row in explicit
        if diagnostics.get(row["instanceId"], {}).get("positionedCommandCount", 0) > 0
    ]
    if explicit_with_commands:
        return explicit_with_commands, "explicit_scout_identity", list(diagnostics.values())

    ranked = sorted(
        candidates,
        key=lambda row: (
            diagnostics.get(row["instanceId"], {}).get(
                "maximumDestinationDistanceFromHomeTiles", 0.0
            ),
            diagnostics.get(row["instanceId"], {}).get("moveLikeCommandCount", 0),
            diagnostics.get(row["instanceId"], {}).get("positionedCommandCount", 0),
            -row["instanceId"],
        ),
        reverse=True,
    )
    if ranked:
        best = ranked[0]
        diag = diagnostics.get(best["instanceId"], {})
        if (
            diag.get("positionedCommandCount", 0) >= 2
            and (
                diag.get("moveLikeCommandCount", 0) >= 2
                or diag.get("maximumDestinationDistanceFromHomeTiles", 0.0) >= 12.0
            )
        ):
            return [best], "behavioral_starting_unit_fallback", list(diagnostics.values())

    if explicit:
        return explicit, "explicit_scout_identity_no_positioned_commands", list(diagnostics.values())
    return [], "no_supported_starting_scout_observed", list(diagnostics.values())


def _buffer_route_tiles(
    line_tiles: Iterable[tuple[int, int]],
    *,
    width: int,
    height: int,
    radius: float,
) -> set[tuple[int, int]]:
    covered: set[tuple[int, int]] = set()
    ceil_radius = int(math.ceil(radius))
    radius_sq = radius * radius
    for x, y in line_tiles:
        for dx in range(-ceil_radius, ceil_radius + 1):
            for dy in range(-ceil_radius, ceil_radius + 1):
                if dx * dx + dy * dy > radius_sq:
                    continue
                tx, ty = x + dx, y + dy
                if 0 <= tx < width and 0 <= ty < height:
                    covered.add((tx, ty))
    return covered


def _scout_coverage_at_five_minutes(
    player_id: int,
    action_events: Iterable[dict[str, Any]],
    initial_objects: Iterable[dict[str, Any]],
    catalog: dict[str, Any],
    *,
    anchors: dict[int, dict[str, Any]],
    width: int,
    height: int,
) -> dict[str, Any]:
    home = anchors.get(player_id)
    scouts, detection_method, candidate_diagnostics = _choose_scout_candidates(
        player_id,
        action_events,
        initial_objects,
        catalog,
        home=home,
    )
    scout_ids = {row["instanceId"] for row in scouts}
    starting_positions = [
        (float(row["x"]), float(row["y"]))
        for row in scouts
        if isinstance(row.get("x"), (int, float)) and isinstance(row.get("y"), (int, float))
    ]
    previous = starting_positions[0] if starting_positions else None
    route_tiles: set[tuple[int, int]] = set()
    covered_tiles: set[tuple[int, int]] = set()
    evidence: list[str] = []
    order_count = 0
    first_at = None
    destination_count = 0

    for event in sorted(
        (item for item in action_events if item.get("actorPlayerId") == player_id),
        key=lambda item: (item.get("timestampMs", 0), item.get("eventId") or ""),
    ):
        at_ms = event.get("timestampMs")
        if not isinstance(at_ms, int) or at_ms >= SCOUT_COVERAGE_WINDOW_MS:
            continue
        selected = set(event.get("objectInstanceIds") or [])
        if not selected.intersection(scout_ids):
            continue
        points = [
            (float(x), float(y))
            for x, y in v1._command_points(event)
            if 0 <= float(x) < width and 0 <= float(y) < height
        ]
        if not points:
            continue
        order_count += 1
        first_at = at_ms if first_at is None else first_at
        if event.get("eventId"):
            evidence.append(event["eventId"])
        for point in points:
            destination_count += 1
            if previous is None:
                segment = {(int(round(point[0])), int(round(point[1])))}
            else:
                segment = set(v4._line_tiles(previous[0], previous[1], point[0], point[1]))
            route_tiles.update(segment)
            covered_tiles.update(
                _buffer_route_tiles(
                    segment,
                    width=width,
                    height=height,
                    radius=SCOUT_ROUTE_RADIUS_TILES,
                )
            )
            previous = point

    total_tiles = max(1, width * height)
    return {
        "layer": "inferred",
        "percent": round(100.0 * len(covered_tiles) / total_tiles, 2),
        "orderCount": order_count,
        "firstAtMs": first_at,
        "destinationCount": destination_count,
        "routeTileCount": len(route_tiles),
        "coveredTileCount": len(covered_tiles),
        "totalTileCount": total_tiles,
        "coverageRadiusTiles": SCOUT_ROUTE_RADIUS_TILES,
        "windowEndMs": SCOUT_COVERAGE_WINDOW_MS,
        "startingScoutInstanceIds": sorted(scout_ids),
        "startingScoutRawIds": sorted({
            row["rawId"] for row in scouts if isinstance(row.get("rawId"), int)
        }),
        "candidateDetectionMethod": detection_method,
        "candidateDiagnostics": sorted(
            candidate_diagnostics,
            key=lambda row: row["instanceId"],
        ),
        "sourceEventIds": evidence,
        "status": "ok" if scouts else "no_supported_starting_scout_observed",
        "scope": (
            "buffered command-directed route reconstructed from an observed or behaviorally "
            "inferred starting scout candidate and its positioned commands during 0:00-5:00; "
            "this is a scouting-attention/coverage proxy, not fog-of-war visibility or actual "
            "unit movement"
        ),
    }


def _is_eco_camp(catalog: dict[str, Any], raw_id: Any) -> bool:
    item = _catalog_building(catalog, raw_id)
    roles = set(item.get("roleKeys") or [])
    name = str(item.get("name") or "").lower()
    return bool(
        roles.intersection(ECO_CAMP_ROLE_KEYS)
        or "lumber camp" in name
        or "mining camp" in name
        or name == "mill"
        or "folwark" in name
    )


def _eco_camp_distance_from_home(
    player_id: int,
    build_events: Iterable[dict[str, Any]],
    *,
    catalog: dict[str, Any],
    anchors: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    home = anchors.get(player_id)
    if home is None or home.get("method") != "initial_town_center":
        return {
            "layer": "reconstructed",
            "count": 0,
            "averageTiles": None,
            "minimumTiles": None,
            "maximumTiles": None,
            "byBuilding": {},
            "status": "no_starting_town_center_anchor",
        }

    values: list[float] = []
    by_building: dict[str, list[float]] = defaultdict(list)
    evidence: list[dict[str, Any]] = []
    for event in build_events:
        if event.get("replaySlot") != player_id or not _is_eco_camp(
            catalog, event.get("buildingId")
        ):
            continue
        point = v1._point_from_build(event)
        if point is None:
            continue
        distance = math.hypot(
            point[0] - float(home["x"]),
            point[1] - float(home["y"]),
        )
        item = _catalog_building(catalog, event.get("buildingId"))
        label = item.get("name") or f"raw:{event.get('buildingId')}"
        values.append(distance)
        by_building[str(label)].append(distance)
        evidence.append({
            "atMs": event.get("atMs"),
            "buildingId": event.get("buildingId"),
            "buildingName": item.get("name"),
            "distanceFromHomeTownCenterTiles": round(distance, 2),
            "sourceEventId": event.get("sourceEventId"),
        })
    return {
        "layer": "reconstructed",
        "count": len(values),
        "averageTiles": round(sum(values) / len(values), 2) if values else None,
        "minimumTiles": round(min(values), 2) if values else None,
        "maximumTiles": round(max(values), 2) if values else None,
        "byBuilding": {
            key: {
                "count": len(distances),
                "averageTiles": round(sum(distances) / len(distances), 2),
            }
            for key, distances in sorted(by_building.items())
        },
        "evidence": evidence,
        "status": "ok",
        "scope": (
            "straight-line placement distance from the starting Town Center for observed "
            "Mill/Folwark, Lumber Camp and Mining Camp BUILD commands; forwardness remains "
            "a separate Forward Eco concept"
        ),
    }


def _expansion_building_kind(catalog: dict[str, Any], raw_id: Any) -> str | None:
    item = _catalog_building(catalog, raw_id)
    roles = set(item.get("roleKeys") or [])
    name = str(item.get("name") or "").lower()

    if (
        "military_production" in roles
        or "wall" in roles
        or "tower" in roles
        or "farm" in roles
        or "house" in roles
    ):
        return None

    role_matches = roles.intersection(EXPANSION_ROLE_KEYS)
    if role_matches:
        return sorted(role_matches)[0]

    if "lumber camp" in name:
        return "lumber_camp"
    if "mining camp" in name:
        return "mining_camp"
    if name == "mill" or "folwark" in name:
        return "mill"
    if "market" in name:
        return "market"
    if "town center" in name or "town centre" in name:
        return "town_center"
    if name in {"dock", "harbor", "harbour"} or "harbor" in name or "harbour" in name:
        return "dock"
    if "feitoria" in name:
        return "feitoria"
    if name == "castle":
        return "castle"
    return None


def _cluster_indices(points: list[dict[str, Any]], link_distance: float) -> list[list[int]]:
    adjacency: dict[int, list[int]] = defaultdict(list)
    for left in range(len(points)):
        for right in range(left + 1, len(points)):
            distance = math.hypot(
                points[left]["x"] - points[right]["x"],
                points[left]["y"] - points[right]["y"],
            )
            if distance <= link_distance:
                adjacency[left].append(right)
                adjacency[right].append(left)

    unseen = set(range(len(points)))
    groups: list[list[int]] = []
    while unseen:
        root = min(unseen)
        stack = [root]
        unseen.remove(root)
        group: list[int] = []
        while stack:
            current = stack.pop()
            group.append(current)
            for neighbor in adjacency.get(current, []):
                if neighbor in unseen:
                    unseen.remove(neighbor)
                    stack.append(neighbor)
        groups.append(sorted(group))
    return groups


def _expansion_zones(
    player_id: int,
    build_events: Iterable[dict[str, Any]],
    *,
    catalog: dict[str, Any],
    participants: dict[int, dict[str, Any]],
    anchors: dict[int, dict[str, Any]],
    width: int,
    height: int,
) -> dict[str, Any]:
    home = anchors.get(player_id)
    home_radius = round(
        EXPANSION_HOME_RADIUS_MAP_FRACTION * float(min(width, height)),
        2,
    )
    if home is None or home.get("method") != "initial_town_center":
        return {
            "layer": "inferred",
            "count": 0,
            "firstAtMs": None,
            "bySector": {"home": 0, "midMap": 0, "forward": 0, "unclassified": 0},
            "zones": [],
            "status": "no_starting_town_center_anchor",
            "thresholds": {
                "homeExclusionRadiusTiles": home_radius,
                "homeExclusionMapFraction": EXPANSION_HOME_RADIUS_MAP_FRACTION,
                "clusterLinkDistanceTiles": EXPANSION_CLUSTER_LINK_TILES,
            },
        }

    remote: list[dict[str, Any]] = []
    excluded_home = 0
    for event in sorted(
        (item for item in build_events if item.get("replaySlot") == player_id),
        key=lambda item: (item.get("atMs", 0), item.get("sourceEventId") or ""),
    ):
        kind = _expansion_building_kind(catalog, event.get("buildingId"))
        if kind is None:
            continue
        point = v1._point_from_build(event)
        at_ms = event.get("atMs")
        if point is None or not isinstance(at_ms, int):
            continue
        distance = math.hypot(
            point[0] - float(home["x"]),
            point[1] - float(home["y"]),
        )
        if distance < home_radius:
            excluded_home += 1
            continue
        relative = v4._relative_position(
            player_id,
            point[0],
            point[1],
            participants=participants,
            anchors=anchors,
        )
        remote.append({
            "atMs": at_ms,
            "buildingId": event.get("buildingId"),
            "building": v1._building_entity(catalog, event.get("buildingId")),
            "kind": kind,
            "x": float(point[0]),
            "y": float(point[1]),
            "distanceFromHomeTownCenterTiles": round(distance, 2),
            "relativePosition": relative,
            "sourceEventId": event.get("sourceEventId"),
        })

    zones: list[dict[str, Any]] = []
    for group in _cluster_indices(remote, EXPANSION_CLUSTER_LINK_TILES):
        members = [remote[index] for index in group]
        center_x = sum(row["x"] for row in members) / len(members)
        center_y = sum(row["y"] for row in members) / len(members)
        center_distance = math.hypot(
            center_x - float(home["x"]),
            center_y - float(home["y"]),
        )
        relative = v4._relative_position(
            player_id,
            center_x,
            center_y,
            participants=participants,
            anchors=anchors,
        )
        sector = relative.get("sector") if relative else "unclassified"
        by_building: Counter[str] = Counter(
            str(row["building"].get("name") or f"raw:{row['buildingId']}")
            for row in members
        )
        zones.append({
            "firstAtMs": min(row["atMs"] for row in members),
            "buildingCount": len(members),
            "center": {"x": round(center_x, 2), "y": round(center_y, 2)},
            "distanceFromHomeTownCenterTiles": round(center_distance, 2),
            "sector": sector,
            "relativePosition": relative,
            "byBuilding": dict(sorted(by_building.items())),
            "buildings": members,
        })

    zones.sort(key=lambda row: (row["firstAtMs"], row["center"]["x"], row["center"]["y"]))
    by_sector = Counter(row["sector"] for row in zones)
    for index, zone in enumerate(zones, start=1):
        zone["zoneId"] = f"expansion-{index}"

    return {
        "layer": "inferred",
        "count": len(zones),
        "firstAtMs": zones[0]["firstAtMs"] if zones else None,
        "bySector": {
            "home": by_sector["home"],
            "midMap": by_sector["midMap"],
            "forward": by_sector["forward"],
            "unclassified": by_sector["unclassified"],
        },
        "eligibleRemoteBuildingCount": len(remote),
        "eligibleBuildingPlacementsInsideHomeRadius": excluded_home,
        "zones": zones,
        "thresholds": {
            "homeExclusionRadiusTiles": home_radius,
            "homeExclusionMapFraction": EXPANSION_HOME_RADIUS_MAP_FRACTION,
            "clusterLinkDistanceTiles": EXPANSION_CLUSTER_LINK_TILES,
            "homeMaximumEnemyProgressPercent": v4.HOME_SECTOR_MAX_PROGRESS_PERCENT,
            "forwardMinimumEnemyProgressPercent": v4.FORWARD_MIN_PROGRESS_PERCENT,
        },
        "status": "ok",
        "scope": (
            "distinct clusters of remote Mill/Folwark, Lumber Camp, Mining Camp, Market, "
            "Town Center, Dock/Harbor, Feitoria and Castle BUILD placements. Farms, houses, "
            "walls, towers and military-production buildings do not create zones. Nearby "
            "qualifying placements link into one expansion; placement does not assert "
            "construction completion or survival"
        ),
    }


def project_map_presence(
    *,
    manifest: dict[str, Any],
    catalog: dict[str, Any],
    initial_objects: Iterable[dict[str, Any]],
    build_events: Iterable[dict[str, Any]],
    wall_events: Iterable[dict[str, Any]],
    action_events: Iterable[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    initial_objects = list(initial_objects)
    build_events = list(build_events)
    wall_events = list(wall_events)
    action_events = list(action_events)

    result = v4.project_map_presence(
        manifest=manifest,
        catalog=catalog,
        initial_objects=initial_objects,
        build_events=build_events,
        wall_events=wall_events,
        action_events=action_events,
    )
    participants = v1._participants(manifest)
    anchors = v1._home_anchors(manifest, catalog, initial_objects)
    map_data = (manifest.get("initialState") or {}).get("map") or {}
    width = int(map_data.get("width") or 1)
    height = int(map_data.get("height") or 1)

    for player_id in sorted(participants):
        player = result[str(player_id)]
        player["modelVersion"] = MAP_PRESENCE_MODEL_VERSION
        player["scoutCoverageAt5Minutes"] = _scout_coverage_at_five_minutes(
            player_id,
            action_events,
            initial_objects,
            catalog,
            anchors=anchors,
            width=width,
            height=height,
        )
        player.pop("campDistanceFromHomeTownCenter", None)
        player["ecoCampDistanceFromHomeTownCenter"] = _eco_camp_distance_from_home(
            player_id,
            build_events,
            catalog=catalog,
            anchors=anchors,
        )
        player.pop("expansionTownCenters", None)
        player["expansionZones"] = _expansion_zones(
            player_id,
            build_events,
            catalog=catalog,
            participants=participants,
            anchors=anchors,
            width=width,
            height=height,
        )
    return result
