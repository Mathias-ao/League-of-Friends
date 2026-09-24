"""Map Presence V4 spatial fundamentals over replay command/placement evidence.

V4 normalizes forward geometry with Enemy Progress %, adds starting-scout
coverage at five minutes, fortification/camp/tower fundamentals, relic holding
inference from unique relic touches, and quantity-weighted/time-aware gold
influence diagnostics. It still does not claim continuous positions, fog-of-war
visibility, building completion/survival, resource depletion, or exact relic pickup.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from itertools import groupby
import math
from typing import Any, Iterable

import map_presence as v1
import map_presence_v2 as v2
import map_presence_v3 as v3

MAP_PRESENCE_MODEL_VERSION = "AOF_MAP_PRESENCE_V4"

HOME_SECTOR_MAX_PROGRESS_PERCENT = 35.0
FORWARD_MIN_PROGRESS_PERCENT = 65.0
SCOUT_COVERAGE_WINDOW_MS = 300_000
STARTING_SCOUT_RAW_IDS = {448, 751, 1755}
PALISADE_WALL_IDS = {72}
STONE_WALL_IDS = {117, 155}
TOWER_RAW_IDS = {79, 234, 235, 236, 1665}
CAMP_ROLE_KEYS = {"mining_camp", "lumber_camp"}


def _catalog_unit(catalog: dict[str, Any], raw_id: Any) -> dict[str, Any]:
    try:
        key = str(int(raw_id))
    except (TypeError, ValueError):
        return {}
    item = (catalog.get("units") or {}).get(key)
    return item if isinstance(item, dict) else {}


def _relative_position(
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
    player = participants[player_id]
    home_distance = math.hypot(x - float(home["x"]), y - float(home["y"]))
    candidates: list[dict[str, Any]] = []
    for enemy_id, enemy in participants.items():
        if enemy_id == player_id or v1._same_team(player, enemy):
            continue
        anchor = anchors.get(enemy_id)
        if anchor is None or anchor.get("method") != "initial_town_center":
            continue
        separation = math.hypot(
            float(anchor["x"]) - float(home["x"]),
            float(anchor["y"]) - float(home["y"]),
        )
        if separation <= 0:
            continue
        enemy_distance = math.hypot(x - float(anchor["x"]), y - float(anchor["y"]))
        raw_progress = 50.0 * (1.0 + (home_distance - enemy_distance) / separation)
        progress = max(0.0, min(100.0, raw_progress))
        if progress <= HOME_SECTOR_MAX_PROGRESS_PERCENT:
            sector = "home"
        elif progress >= FORWARD_MIN_PROGRESS_PERCENT:
            sector = "forward"
        else:
            sector = "midMap"
        candidates.append({
            "enemyPlayerId": enemy_id,
            "distanceFromHomeTownCenterTiles": round(home_distance, 2),
            "distanceToEnemyTownCenterTiles": round(enemy_distance, 2),
            "townCenterSeparationTiles": round(separation, 2),
            "enemyProgressPercent": round(progress, 2),
            "rawEnemyProgressPercent": round(raw_progress, 2),
            "sector": sector,
        })
    if not candidates:
        return None
    return max(
        candidates,
        key=lambda row: (
            row["enemyProgressPercent"],
            -row["distanceToEnemyTownCenterTiles"],
            -row["enemyPlayerId"],
        ),
    )


def _forward_placement(
    player_id: int,
    x: float,
    y: float,
    *,
    participants: dict[int, dict[str, Any]],
    anchors: dict[int, dict[str, Any]],
) -> dict[str, Any] | None:
    relative = _relative_position(
        player_id, x, y, participants=participants, anchors=anchors,
    )
    if relative is None or relative["enemyProgressPercent"] < FORWARD_MIN_PROGRESS_PERCENT:
        return None
    return relative


def _building_placement_range(
    player_id: int,
    build_events: Iterable[dict[str, Any]],
    *,
    anchors: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    base = v3._building_spread(player_id, build_events, anchors=anchors)
    return {
        "layer": base.get("layer"),
        "maximumPlacementSpanTiles": base.get("maxPairwiseDistanceTiles"),
        "furthestPlacementFromHomeTownCenterTiles": base.get("maxDistanceFromHomeTownCenterTiles"),
        "placementPointCount": base.get("placementPointCount"),
        "basis": (
            "maximum straight-line distance across the starting Town Center anchor and "
            "observed BUILD placement coordinates; the second value is the furthest "
            "single placement from the starting Town Center"
        ),
        "status": base.get("status"),
    }


def _building_sectors(
    player_id: int,
    build_events: Iterable[dict[str, Any]],
    *,
    participants: dict[int, dict[str, Any]],
    anchors: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    counts: Counter[str] = Counter()
    classified = 0
    evidence: list[dict[str, Any]] = []
    for event in build_events:
        if event.get("replaySlot") != player_id:
            continue
        point = v1._point_from_build(event)
        if point is None:
            continue
        relative = _relative_position(
            player_id, point[0], point[1], participants=participants, anchors=anchors,
        )
        if relative is None:
            continue
        classified += 1
        counts[relative["sector"]] += 1
        evidence.append({
            "atMs": event.get("atMs"),
            "buildingId": event.get("buildingId"),
            "position": {"x": point[0], "y": point[1]},
            **relative,
            "sourceEventId": event.get("sourceEventId"),
        })
    return {
        "layer": "reconstructed",
        "classifiedPlacementCount": classified,
        "homeCount": counts["home"],
        "midMapCount": counts["midMap"],
        "forwardCount": counts["forward"],
        "thresholds": {
            "homeMaximumEnemyProgressPercent": HOME_SECTOR_MAX_PROGRESS_PERCENT,
            "forwardMinimumEnemyProgressPercent": FORWARD_MIN_PROGRESS_PERCENT,
        },
        "evidence": evidence,
        "basis": (
            "Enemy Progress % is 0 at the player's starting TC, 50 on the equal-distance "
            "bisector, and 100 at the referenced enemy starting TC; values are clamped "
            "to 0-100 and the highest progress against any non-teammate is used"
        ),
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
    by_building: Counter[str] = Counter()
    by_category: Counter[str] = Counter()
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
        label = entity.get("name") or f"raw:{event.get('buildingId')}"
        by_building[str(label)] += 1
        by_category[v3._building_category(catalog, event.get("buildingId"))] += 1
        evidence.append({
            "atMs": at_ms,
            "building": entity,
            "position": {"x": point[0], "y": point[1]},
            **forward,
            "sourceEventId": event.get("sourceEventId"),
        })
    deepest = max((row["enemyProgressPercent"] for row in evidence), default=None)
    closest_enemy = min(
        (row["distanceToEnemyTownCenterTiles"] for row in evidence), default=None,
    )
    farthest_home = max(
        (row["distanceFromHomeTownCenterTiles"] for row in evidence), default=None,
    )
    return {
        "layer": "inferred",
        "count": len(evidence),
        "firstAtMs": evidence[0]["atMs"] if evidence else None,
        "byBuilding": dict(sorted(by_building.items())),
        "byCategory": dict(sorted(by_category.items())),
        "thresholds": {
            "minimumEnemyProgressPercent": FORWARD_MIN_PROGRESS_PERCENT,
            "homeMaximumEnemyProgressPercent": HOME_SECTOR_MAX_PROGRESS_PERCENT,
        },
        "deepest": {
            "maxEnemyProgressPercent": deepest,
            "closestEnemyTownCenterDistanceTiles": closest_enemy,
            "farthestFromHomeTownCenterTiles": farthest_home,
        },
        "evidence": evidence,
        "scope": (
            "BUILD placement with Enemy Progress >= 65%; placement is observed but "
            "construction completion or survival is not asserted"
        ),
    }


def _starting_scouts(
    player_id: int,
    initial_objects: Iterable[dict[str, Any]],
    catalog: dict[str, Any],
) -> list[dict[str, Any]]:
    scouts: list[dict[str, Any]] = []
    for event in initial_objects:
        payload = event.get("payload") or {}
        if payload.get("ownerPlayerId") != player_id:
            continue
        raw_id = payload.get("objectId")
        instance_id = payload.get("instanceId")
        if not isinstance(instance_id, int):
            continue
        item = _catalog_unit(catalog, raw_id)
        roles = set(item.get("roleKeys") or [])
        name = str(item.get("name") or "")
        if (
            raw_id not in STARTING_SCOUT_RAW_IDS
            and "scout_cavalry" not in roles
            and "scout" not in name.lower()
        ):
            continue
        scouts.append({
            "instanceId": instance_id,
            "rawId": raw_id,
            "name": item.get("name"),
            "sourceEventId": event.get("eventId"),
        })
    return scouts


def _scout_coverage_at_five_minutes(
    player_id: int,
    action_events: Iterable[dict[str, Any]],
    initial_objects: Iterable[dict[str, Any]],
    catalog: dict[str, Any],
    *,
    width: int,
    height: int,
) -> dict[str, Any]:
    scouts = _starting_scouts(player_id, initial_objects, catalog)
    scout_ids = {item["instanceId"] for item in scouts}
    columns = max(1, math.ceil(width / v1.COMMAND_COVERAGE_CELL_TILES))
    rows = max(1, math.ceil(height / v1.COMMAND_COVERAGE_CELL_TILES))
    cells: set[tuple[int, int]] = set()
    evidence: list[str] = []
    order_count = 0
    first_at = None
    if scout_ids:
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
            order_count += 1
            first_at = at_ms if first_at is None else first_at
            used = False
            for x, y in v1._command_points(event):
                if not (0 <= x < width and 0 <= y < height):
                    continue
                cells.add((
                    min(columns - 1, int(x // v1.COMMAND_COVERAGE_CELL_TILES)),
                    min(rows - 1, int(y // v1.COMMAND_COVERAGE_CELL_TILES)),
                ))
                used = True
            if used and event.get("eventId"):
                evidence.append(event["eventId"])
    total = columns * rows
    return {
        "layer": "reconstructed",
        "percent": round(100.0 * len(cells) / total, 2) if total else 0.0,
        "orderCount": order_count,
        "firstAtMs": first_at,
        "coveredCellCount": len(cells),
        "totalCellCount": total,
        "cellSizeTiles": v1.COMMAND_COVERAGE_CELL_TILES,
        "windowEndMs": SCOUT_COVERAGE_WINDOW_MS,
        "startingScoutInstanceIds": sorted(scout_ids),
        "startingScoutRawIds": sorted({
            item["rawId"] for item in scouts if isinstance(item.get("rawId"), int)
        }),
        "sourceEventIds": evidence,
        "status": "ok" if scouts else "no_supported_starting_scout_observed",
        "scope": (
            "8-tile cells containing positioned commands whose decoded selection includes "
            "an observed starting Scout/Eagle/Camel Scout during 0:00-5:00; this measures "
            "scouting-command attention, not fog-of-war exploration or unit arrival"
        ),
        "note": (
            "Commands that reuse an earlier selection without carrying object instance IDs "
            "can be missed by this reconstruction."
        ),
    }


def _line_tiles(x1: Any, y1: Any, x2: Any, y2: Any) -> list[tuple[int, int]]:
    if not all(isinstance(value, (int, float)) for value in (x1, y1, x2, y2)):
        return []
    x, y = int(round(float(x1))), int(round(float(y1)))
    end_x, end_y = int(round(float(x2))), int(round(float(y2)))
    points: list[tuple[int, int]] = []
    dx = abs(end_x - x)
    sx = 1 if x < end_x else -1
    dy = -abs(end_y - y)
    sy = 1 if y < end_y else -1
    err = dx + dy
    while True:
        points.append((x, y))
        if x == end_x and y == end_y:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x += sx
        if e2 <= dx:
            err += dx
            y += sy
    return points


def _wall_kind(catalog: dict[str, Any], raw_id: Any) -> str | None:
    item = v1._catalog_building(catalog, raw_id)
    name = str(item.get("name") or "").lower()
    if raw_id in PALISADE_WALL_IDS or "palisade" in name:
        return "palisade"
    if raw_id in STONE_WALL_IDS or ("wall" in name and "palisade" not in name):
        return "stone"
    return None


def _wall_tiles(
    player_id: int,
    wall_events: Iterable[dict[str, Any]],
    *,
    catalog: dict[str, Any],
) -> dict[str, Any]:
    by_kind: dict[str, set[tuple[int, int]]] = {
        "palisade": set(),
        "stone": set(),
    }
    unsupported = 0
    for event in wall_events:
        if event.get("replaySlot") != player_id:
            continue
        kind = _wall_kind(catalog, event.get("buildingId"))
        if kind is None:
            unsupported += 1
            continue
        by_kind[kind].update(
            _line_tiles(
                event.get("x"), event.get("y"), event.get("xEnd"), event.get("yEnd"),
            )
        )
    all_tiles = by_kind["palisade"] | by_kind["stone"]
    return {
        "layer": "reconstructed",
        "palisadeWallTiles": len(by_kind["palisade"]),
        "stoneWallTiles": len(by_kind["stone"]),
        "totalWallTiles": len(all_tiles),
        "unsupportedWallPlacementCount": unsupported,
        "basis": (
            "unique tile coordinates reconstructed from WALL placement endpoints; "
            "gates are not converted into wall tiles and completion/survival is not asserted"
        ),
    }


def _is_tower(catalog: dict[str, Any], raw_id: Any) -> bool:
    item = v1._catalog_building(catalog, raw_id)
    roles = set(item.get("roleKeys") or [])
    name = str(item.get("name") or "").lower()
    return (
        raw_id in TOWER_RAW_IDS
        or "tower" in roles
        or "tower" in name
        or name == "keep"
        or "donjon" in name
    )


def _towers(
    player_id: int,
    build_events: Iterable[dict[str, Any]],
    *,
    catalog: dict[str, Any],
    participants: dict[int, dict[str, Any]],
    anchors: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    evidence: list[dict[str, Any]] = []
    forward_evidence: list[dict[str, Any]] = []
    by_building: Counter[str] = Counter()
    for event in sorted(
        (item for item in build_events if item.get("replaySlot") == player_id),
        key=lambda item: (item.get("atMs", 0), item.get("sourceEventId") or ""),
    ):
        raw_id = event.get("buildingId")
        if not _is_tower(catalog, raw_id):
            continue
        point = v1._point_from_build(event)
        if point is None:
            continue
        entity = v1._building_entity(catalog, raw_id)
        label = entity.get("name") or f"raw:{raw_id}"
        by_building[str(label)] += 1
        relative = _relative_position(
            player_id, point[0], point[1], participants=participants, anchors=anchors,
        )
        row = {
            "atMs": event.get("atMs"),
            "building": entity,
            "position": {"x": point[0], "y": point[1]},
            "relativePosition": relative,
            "sourceEventId": event.get("sourceEventId"),
        }
        evidence.append(row)
        if relative is not None and relative["enemyProgressPercent"] >= FORWARD_MIN_PROGRESS_PERCENT:
            forward_evidence.append(row)
    return {
        "layer": "reconstructed",
        "count": len(evidence),
        "firstAtMs": evidence[0]["atMs"] if evidence else None,
        "forwardCount": len(forward_evidence),
        "firstForwardAtMs": forward_evidence[0]["atMs"] if forward_evidence else None,
        "byBuilding": dict(sorted(by_building.items())),
        "forwardThresholdEnemyProgressPercent": FORWARD_MIN_PROGRESS_PERCENT,
        "evidence": evidence,
        "forwardEvidence": forward_evidence,
        "scope": "tower-family BUILD placements; completion and survival are not asserted",
    }


def _camp_distance_from_home(
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
        if event.get("replaySlot") != player_id:
            continue
        item = v1._catalog_building(catalog, event.get("buildingId"))
        roles = set(item.get("roleKeys") or [])
        if not roles.intersection(CAMP_ROLE_KEYS):
            continue
        point = v1._point_from_build(event)
        if point is None:
            continue
        distance = math.hypot(point[0] - float(home["x"]), point[1] - float(home["y"]))
        values.append(distance)
        label = item.get("name") or f"raw:{event.get('buildingId')}"
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
            "Mining Camp and Lumber Camp BUILD commands; no separate enemy-progress metric "
            "is emitted because Forward Eco already covers forward economic placement"
        ),
    }


def _relic_state(
    action_events: Iterable[dict[str, Any]],
    initial_objects: Iterable[dict[str, Any]],
    *,
    participants: dict[int, dict[str, Any]],
) -> dict[int, dict[str, Any]]:
    relics = {
        item["instanceId"]: item
        for item in v1._initial_neutral_objects(initial_objects, v1.RELIC_OBJECT_IDS)
        if isinstance(item.get("instanceId"), int)
    }
    metrics = {
        player_id: {
            "commands": 0,
            "unique": set(),
            "first": None,
            "claims": 0,
            "stolen": 0,
            "lostEnemy": 0,
            "allyIn": 0,
            "allyOut": 0,
            "events": [],
        }
        for player_id in participants
    }
    holder: dict[int, int] = {}
    transfer_events: list[dict[str, Any]] = []
    for event in sorted(
        action_events,
        key=lambda item: (item.get("timestampMs", 0), item.get("eventId") or ""),
    ):
        actor = event.get("actorPlayerId")
        if actor not in participants or event.get("sourceActionName") not in {"ORDER", "SPECIAL"}:
            continue
        target = event.get("targetInstanceId")
        if target not in relics:
            continue
        row = metrics[int(actor)]
        row["commands"] += 1
        row["unique"].add(target)
        if row["first"] is None:
            row["first"] = event
        previous = holder.get(target)
        transfer_type = "repeat_holder_touch"
        if previous is None:
            holder[target] = int(actor)
            row["claims"] += 1
            transfer_type = "initial_claim"
        elif previous != actor:
            allied = v1._same_team(participants[int(actor)], participants[int(previous)])
            holder[target] = int(actor)
            if allied:
                row["allyIn"] += 1
                metrics[int(previous)]["allyOut"] += 1
                transfer_type = "ally_transfer"
            else:
                row["stolen"] += 1
                metrics[int(previous)]["lostEnemy"] += 1
                transfer_type = "enemy_theft"
        evidence = {
            "atMs": event.get("timestampMs"),
            "relicInstanceId": target,
            "fromPlayerId": previous,
            "toPlayerId": int(actor),
            "transferType": transfer_type,
            "sourceActionName": event.get("sourceActionName"),
            "sourceEventId": event.get("eventId"),
        }
        row["events"].append(evidence)
        if transfer_type != "repeat_holder_touch":
            transfer_events.append(evidence)

    held_by_player: dict[int, list[int]] = defaultdict(list)
    for relic_id, player_id in holder.items():
        held_by_player[player_id].append(relic_id)

    result: dict[int, dict[str, Any]] = {}
    for player_id in participants:
        row = metrics[player_id]
        first = row["first"]
        result[player_id] = {
            "layer": "inferred",
            "uniqueRelicsTouched": len(row["unique"]),
            "totalRelicCommands": row["commands"],
            "firstTouchAtMs": first.get("timestampMs") if first else None,
            "inferredRelicsHeldAtEnd": len(held_by_player.get(player_id, [])),
            "heldRelicInstanceIdsAtEnd": sorted(held_by_player.get(player_id, [])),
            "initialClaims": row["claims"],
            "relicsStolenFromEnemies": row["stolen"],
            "relicsLostToEnemies": row["lostEnemy"],
            "allyTransfersReceived": row["allyIn"],
            "allyTransfersGiven": row["allyOut"],
            "interactionEvidence": row["events"],
            "transferEvidence": [
                item for item in transfer_events
                if item.get("fromPlayerId") == player_id or item.get("toPlayerId") == player_id
            ],
            "scope": (
                "AoF V4 treats each distinct ORDER/SPECIAL touch of a known initial relic as "
                "an inferred change in who is holding that relic. A later touch by a different "
                "non-teammate is classified as inferred theft; monastery deposit is not required. "
                "The replay command still does not directly prove pickup, drop, death, or deposit."
            ),
        }
    return result


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
            "atMs": 0, "source": "initial_object", "sourceEventId": event.get("eventId"),
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
            "atMs": int(event.get("atMs") or 0),
            "source": "building_placement", "sourceEventId": event.get("sourceEventId"),
        })
    return dict(result)


def _gold_scores(
    cluster: dict[str, Any],
    infrastructure: dict[int, list[dict[str, Any]]],
    *,
    participants: dict[int, dict[str, Any]],
) -> tuple[dict[int, float], dict[int, list[dict[str, Any]]]]:
    raw_scores: dict[int, float] = {}
    contributions: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for candidate_id in participants:
        total = 0.0
        for building in infrastructure.get(candidate_id, []):
            distance = math.hypot(cluster["x"] - building["x"], cluster["y"] - building["y"])
            contribution = v1._influence_contribution(building["kind"], distance)
            if contribution <= 0:
                continue
            total += contribution
            contributions[candidate_id].append({
                "kind": building["kind"],
                "buildingId": building["buildingId"],
                "atMs": building.get("atMs"),
                "distanceTiles": round(distance, 2),
                "contribution": round(contribution, 4),
                "sourceEventId": building.get("sourceEventId"),
            })
        raw_scores[candidate_id] = total
    return raw_scores, contributions


def _controller(raw_scores: dict[int, float]) -> int | None:
    ranked = sorted(
        ((score, player_id) for player_id, score in raw_scores.items() if score > 0),
        reverse=True,
    )
    if not ranked:
        return None
    if len(ranked) > 1 and math.isclose(
        ranked[0][0], ranked[1][0], rel_tol=1e-9, abs_tol=1e-9,
    ):
        return None
    return ranked[0][1]


def _gold_control_all(
    clusters: list[dict[str, Any]],
    infrastructure: dict[int, list[dict[str, Any]]],
    *,
    participants: dict[int, dict[str, Any]],
) -> dict[int, dict[str, Any]]:
    if not clusters:
        return {
            player_id: {
                "layer": "inferred",
                "controlSharePercent": None,
                "controlledGoldDepositEquivalent": 0.0,
                "supportedGoldDepositCount": 0,
                "takeoversWon": 0,
                "takeoversLost": 0,
                "clusters": [],
                "status": "no_supported_gold_objects",
            }
            for player_id in participants
        }

    all_buildings = sorted(
        (
            (int(building.get("atMs") or 0), player_id, building)
            for player_id, buildings in infrastructure.items()
            for building in buildings
        ),
        key=lambda row: (row[0], row[1], str(row[2].get("sourceEventId") or "")),
    )
    total_deposits = sum(int(cluster.get("mineCount") or 0) for cluster in clusters)
    equivalents = {player_id: 0.0 for player_id in participants}
    per_player_clusters: dict[int, list[dict[str, Any]]] = defaultdict(list)
    takeovers_won: Counter[int] = Counter()
    takeovers_lost: Counter[int] = Counter()

    for cluster in clusters:
        active: dict[int, list[dict[str, Any]]] = defaultdict(list)
        previous_controller = None
        history: list[dict[str, Any]] = []
        for at_ms, group in groupby(all_buildings, key=lambda row: row[0]):
            for _, owner, building in group:
                active[owner].append(building)
            scores, _ = _gold_scores(cluster, active, participants=participants)
            current = _controller(scores)
            if current == previous_controller:
                continue
            if current is not None:
                relation = "initial_control"
                if previous_controller is not None:
                    if v1._same_team(participants[current], participants[previous_controller]):
                        relation = "ally_control_transfer"
                    else:
                        relation = "enemy_control_takeover"
                        takeovers_won[current] += 1
                        takeovers_lost[previous_controller] += 1
                history.append({
                    "atMs": at_ms,
                    "fromPlayerId": previous_controller,
                    "toPlayerId": current,
                    "changeType": relation,
                })
            previous_controller = current

        scores, contributions = _gold_scores(
            cluster, infrastructure, participants=participants,
        )
        score_sum = sum(scores.values())
        shares = {
            player_id: (score / score_sum if score_sum > 0 else 0.0)
            for player_id, score in scores.items()
        }
        final_controller = _controller(scores)
        mine_count = int(cluster.get("mineCount") or 0)
        for player_id in participants:
            share = shares.get(player_id, 0.0)
            equivalents[player_id] += mine_count * share
            per_player_clusters[player_id].append({
                "clusterId": cluster["clusterId"],
                "center": {"x": round(cluster["x"], 2), "y": round(cluster["y"], 2)},
                "depositCount": mine_count,
                "playerClaimShare": round(share, 4),
                "finalControllerPlayerId": final_controller,
                "controlHistory": history,
                "playerContributions": contributions.get(player_id, []),
                "unclaimed": score_sum == 0,
            })

    return {
        player_id: {
            "layer": "inferred",
            "controlSharePercent": (
                round(100.0 * equivalents[player_id] / total_deposits, 2)
                if total_deposits else None
            ),
            "controlledGoldDepositEquivalent": round(equivalents[player_id], 3),
            "supportedGoldDepositCount": total_deposits,
            "takeoversWon": takeovers_won[player_id],
            "takeoversLost": takeovers_lost[player_id],
            "clusters": per_player_clusters[player_id],
            "weighting": "initial supported gold deposit count, not equal cluster count",
            "status": "ok",
            "scope": (
                "time-aware placement-influence proxy over initial supported gold deposits. "
                "Control leadership can change when later infrastructure is placed. The current "
                "parser does not retain mined/depleted gold or building destruction, so this is "
                "not remaining gold on the map and old placement influence is not removed."
            ),
        }
        for player_id in participants
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
    gold = _gold_control_all(clusters, infrastructure, participants=participants)
    relics = _relic_state(action_events, initial_objects, participants=participants)
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
            "scoutCoverageAt5Minutes": _scout_coverage_at_five_minutes(
                player_id,
                action_events,
                initial_objects,
                catalog,
                width=width,
                height=height,
            ),
            "enemySideCommandPresence": v3._enemy_side_presence(
                player_id,
                action_events,
                participants=participants,
                anchors=anchors,
            ),
            "buildingPlacementRange": _building_placement_range(
                player_id, build_events, anchors=anchors,
            ),
            "buildingSectors": _building_sectors(
                player_id,
                build_events,
                participants=participants,
                anchors=anchors,
            ),
            "forwardBuildings": _forward_buildings(
                player_id,
                build_events,
                catalog=catalog,
                participants=participants,
                anchors=anchors,
            ),
            "wallTiles": _wall_tiles(player_id, wall_events, catalog=catalog),
            "towers": _towers(
                player_id,
                build_events,
                catalog=catalog,
                participants=participants,
                anchors=anchors,
            ),
            "campDistanceFromHomeTownCenter": _camp_distance_from_home(
                player_id, build_events, catalog=catalog, anchors=anchors,
            ),
            "expansionTownCenters": v2._expansions(
                player_id, build_events, catalog=catalog, anchors=anchors,
            ),
            "enemyBaseContact": v2._enemy_base_found(
                player_id, action_events, participants=participants, anchors=anchors,
            ),
            "goldControl": gold[player_id],
            "firstRelicTouch": v1._first_relic_touch(
                player_id, action_events, initial_objects,
            ),
            "relicControl": relics[player_id],
        }
    return result
