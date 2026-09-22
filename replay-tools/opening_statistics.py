"""Player-facing opening statistics derived from canonical replay evidence.

Age-up requests, building placements and positive queue requests are treated as
current direct inputs by product policy. Exact summaries remain reconstructed,
and wall style is an explicitly versioned inference from unique wall-tile volume.
"""
from __future__ import annotations

from typing import Any, Iterable

OPENING_STATISTICS_VERSION = "AOF_OPENING_STATISTICS_V2"
AGE_TECH_IDS = {"feudal": 101, "castle": 102, "imperial": 103}
AGE_RESEARCH_MS = {"feudal": 130_000, "castle": 160_000, "imperial": 190_000}
LOOM_TECH_ID = 22
FULLY_WALLED_MINIMUM_TILES = 20


def _roles(catalog: dict[str, Any], section: str, raw_id: Any) -> set[str]:
    item = (catalog.get(section) or {}).get(str(raw_id)) or {}
    return set(item.get("roleKeys") or [])


def _entity(catalog: dict[str, Any], section: str, raw_id: Any) -> dict[str, Any]:
    kind = {"units": "unit", "buildings": "building", "technologies": "technology"}[section]
    item = (catalog.get(section) or {}).get(str(raw_id)) or {}
    return {
        "rawId": raw_id,
        "kind": kind,
        "name": item.get("name"),
        "roleKeys": item.get("roleKeys", []),
        "resolutionStatus": (
            "reference_catalog_unqualified_for_replay_patch" if item else "unresolved"
        ),
    }


def _player_events(events: Iterable[dict[str, Any]], player_id: int) -> list[dict[str, Any]]:
    return sorted(
        (event for event in events if event.get("replaySlot") == player_id),
        key=lambda event: (event.get("atMs", 0), event.get("sourceEventId", "")),
    )


def _first_research_time(research: list[dict[str, Any]], technology_id: int) -> int | None:
    for event in research:
        if event.get("technologyId") == technology_id and isinstance(event.get("atMs"), int):
            return event["atMs"]
    return None


def _latest_research_time(research: list[dict[str, Any]], technology_id: int) -> int | None:
    times = [
        event["atMs"]
        for event in research
        if event.get("technologyId") == technology_id and isinstance(event.get("atMs"), int)
    ]
    return max(times) if times else None


def _age_up(research: list[dict[str, Any]], age: str) -> dict[str, Any]:
    click = _latest_research_time(research, AGE_TECH_IDS[age])
    duration = AGE_RESEARCH_MS[age]
    return {
        "layer": "inferred",
        "clickAtMs": click,
        "ageUpAtMs": click + duration if click is not None else None,
        "researchDurationMs": duration,
        "basis": f"latest observed research request for technology {AGE_TECH_IDS[age]} + fixed {duration}ms",
    }


def _positive_queue(event: dict[str, Any]) -> bool:
    amount = event.get("requestedAmountPositive")
    return type(amount) is int and amount > 0


def _first_military_unit(production: list[dict[str, Any]], catalog: dict[str, Any]) -> dict[str, Any] | None:
    for event in production:
        unit_id = event.get("unitId")
        roles = _roles(catalog, "units", unit_id)
        if _positive_queue(event) and roles.intersection({"land_military", "water_military"}):
            return {
                "layer": "observed",
                "atMs": event.get("atMs"),
                "unit": _entity(catalog, "units", unit_id),
                "requestedAmountPositive": event.get("requestedAmountPositive"),
                "sourceEventId": event.get("sourceEventId"),
            }
    return None


def _first_military_building(builds: list[dict[str, Any]], catalog: dict[str, Any]) -> dict[str, Any] | None:
    for event in builds:
        building_id = event.get("buildingId")
        roles = _roles(catalog, "buildings", building_id)
        if roles.intersection({"military_production", "naval_production"}):
            return {
                "layer": "observed",
                "atMs": event.get("atMs"),
                "building": _entity(catalog, "buildings", building_id),
                "position": {"x": event.get("x"), "y": event.get("y")},
                "sourceEventId": event.get("sourceEventId"),
            }
    return None


def _line_tiles(x0: Any, y0: Any, x1: Any, y1: Any) -> list[tuple[int, int]]:
    """Rasterize one wall command to unique map tiles using integer Bresenham."""
    if not all(isinstance(value, (int, float)) for value in (x0, y0)):
        return []
    if not all(isinstance(value, (int, float)) for value in (x1, y1)):
        x1, y1 = x0, y0
    x0i, y0i, x1i, y1i = (round(float(value)) for value in (x0, y0, x1, y1))
    points: list[tuple[int, int]] = []
    dx, dy = abs(x1i - x0i), -abs(y1i - y0i)
    sx, sy = (1 if x0i < x1i else -1), (1 if y0i < y1i else -1)
    err = dx + dy
    x, y = x0i, y0i
    while True:
        points.append((x, y))
        if x == x1i and y == y1i:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x += sx
        if e2 <= dx:
            err += dx
            y += sy
    return points


def _wall_tiles(events: list[dict[str, Any]], before_ms: int) -> set[tuple[int, int]]:
    result: set[tuple[int, int]] = set()
    for event in events:
        at_ms = event.get("atMs")
        if not isinstance(at_ms, int) or at_ms >= before_ms:
            continue
        result.update(_line_tiles(event.get("x"), event.get("y"), event.get("xEnd"), event.get("yEnd")))
    return result


def _first_wall_segment(walls: list[dict[str, Any]], catalog: dict[str, Any]) -> dict[str, Any] | None:
    if not walls:
        return None
    event = walls[0]
    tiles = _line_tiles(event.get("x"), event.get("y"), event.get("xEnd"), event.get("yEnd"))
    return {
        "layer": "observed",
        "atMs": event.get("atMs"),
        "wall": _entity(catalog, "buildings", event.get("buildingId")),
        "start": {"x": event.get("x"), "y": event.get("y")},
        "end": {"x": event.get("xEnd"), "y": event.get("yEnd")},
        "tileCount": len(set(tiles)),
        "sourceEventId": event.get("sourceEventId"),
    }


def _wall_style(tile_count: int, boundary: str) -> dict[str, Any]:
    if tile_count == 0:
        label = "open"
    elif tile_count < FULLY_WALLED_MINIMUM_TILES:
        label = "partially_walled"
    else:
        label = "fully_walled"
    return {
        "layer": "inferred",
        "label": label,
        "wallTilesBeforeCastle": tile_count,
        "method": "unique_wall_tile_volume",
        "boundary": boundary,
        "thresholds": {"openMaximumTiles": 0, "fullyWalledMinimumTiles": FULLY_WALLED_MINIMUM_TILES},
        "note": "V1 classifies wall style from wall-tile volume only; it does not prove a geometrically sealed base.",
    }


def _count_houses(builds: list[dict[str, Any]], catalog: dict[str, Any], before_ms: int) -> int:
    return sum(
        1 for event in builds
        if isinstance(event.get("atMs"), int)
        and event["atMs"] < before_ms
        and "house" in _roles(catalog, "buildings", event.get("buildingId"))
    )


def _initial_villager_count(
    initial_objects: list[dict[str, Any]], player_id: int, catalog: dict[str, Any],
) -> int:
    return sum(
        1
        for event in initial_objects
        if (event.get("payload") or {}).get("ownerPlayerId") == player_id
        and "villager" in _roles(catalog, "units", (event.get("payload") or {}).get("objectId"))
    )


def _villagers_before_feudal(
    production: list[dict[str, Any]],
    initial_objects: list[dict[str, Any]],
    player_id: int,
    catalog: dict[str, Any],
    feudal_click_ms: int | None,
) -> dict[str, Any]:
    starting = _initial_villager_count(initial_objects, player_id, catalog)
    if feudal_click_ms is None:
        return {
            "layer": "reconstructed",
            "count": None,
            "basis": "starting villagers + net decoded villager queue amounts before latest observed Feudal click",
            "boundary": "no_feudal_click_observed",
        }

    net_queued = 0
    unknown_amount_commands = 0
    for event in production:
        at_ms = event.get("atMs")
        if not isinstance(at_ms, int) or at_ms >= feudal_click_ms:
            continue
        if "villager" not in _roles(catalog, "units", event.get("unitId")):
            continue
        signed = event.get("signedAmount")
        if type(signed) is int:
            net_queued += signed
        else:
            unknown_amount_commands += 1

    return {
        "layer": "reconstructed",
        "count": starting + net_queued if unknown_amount_commands == 0 else None,
        "basis": "starting villagers + net decoded villager queue amounts before latest observed Feudal click",
        "boundary": "latest_feudal_click",
        "startingVillagersObserved": starting,
        "netDecodedVillagerQueueAmount": net_queued,
        "unknownAmountVillagerQueueCommands": unknown_amount_commands,
    }


def project_opening_statistics(
    *,
    manifest: dict[str, Any],
    body: dict[str, Any],
    catalog: dict[str, Any],
    observed_until_ms: int,
    initial_objects: list[dict[str, Any]] | None = None,
) -> dict[str, dict[str, Any]]:
    results: dict[str, dict[str, Any]] = {}
    initial_objects = initial_objects or []
    for participant in manifest.get("participants", []):
        player_id = int(participant["playerId"])
        research = _player_events(body.get("researchEvents", []), player_id)
        production = _player_events(body.get("productionEvents", []), player_id)
        builds = _player_events(body.get("buildEvents", []), player_id)
        walls = _player_events(body.get("wallEvents", []), player_id)

        age_up = {age: _age_up(research, age) for age in ("feudal", "castle", "imperial")}
        feudal_click = age_up["feudal"]["clickAtMs"]
        feudal_age_up = age_up["feudal"]["ageUpAtMs"]
        castle_age_up = age_up["castle"]["ageUpAtMs"]

        feudal_boundary = feudal_age_up if feudal_age_up is not None else observed_until_ms + 1
        castle_boundary = castle_age_up if castle_age_up is not None else observed_until_ms + 1
        castle_boundary_name = "castle_age_up" if castle_age_up is not None else "observed_end_no_castle"

        loom_at = _first_research_time(research, LOOM_TECH_ID)
        loom_before_feudal = (
            loom_at < feudal_click if loom_at is not None and feudal_click is not None
            else False if feudal_click is not None
            else None
        )
        wall_tiles_feudal = _wall_tiles(walls, feudal_boundary)
        wall_tiles_castle = _wall_tiles(walls, castle_boundary)

        results[str(player_id)] = {
            "modelVersion": OPENING_STATISTICS_VERSION,
            "ageUp": age_up,
            "firstMilitaryUnitQueued": _first_military_unit(production, catalog),
            "firstMilitaryBuilding": _first_military_building(builds, catalog),
            "firstWallSegment": _first_wall_segment(walls, catalog),
            "wallTilesBeforeFeudal": {
                "layer": "reconstructed",
                "count": len(wall_tiles_feudal),
                "boundary": "feudal_age_up" if feudal_age_up is not None else "observed_end_no_feudal",
            },
            "wallStyle": _wall_style(len(wall_tiles_castle), castle_boundary_name),
            "housesBeforeFeudal": {
                "layer": "reconstructed",
                "count": _count_houses(builds, catalog, feudal_boundary),
                "boundary": "feudal_age_up" if feudal_age_up is not None else "observed_end_no_feudal",
            },
            "villagersBeforeFeudalAge": _villagers_before_feudal(
                production, initial_objects, player_id, catalog, feudal_click,
            ),
            "loomTiming": {
                "layer": "observed",
                "atMs": loom_at,
                "technology": _entity(catalog, "technologies", LOOM_TECH_ID),
            },
            "loomBeforeFeudal": {
                "layer": "reconstructed",
                "value": loom_before_feudal,
                "basis": "loom research request before Feudal Age research request",
            },
        }
    return results
